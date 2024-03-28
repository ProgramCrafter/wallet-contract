import { SandboxContract } from "@ton/sandbox";
import { Address, beginCell, Builder, Cell, Contract, contractAddress, ContractProvider, internal, MessageRelaxed, Sender, SenderArguments, SendMode, storeMessageRelaxed, toNano } from "@ton/core";
import { sign } from "@ton/crypto";
import { walletBoc } from "./build";

export type Transfer = {action: 'transfer', message: MessageRelaxed, sendMode: SendMode};
export type UninstallPlugin = {action: 'uninstall', hash: Buffer};
export type InstallPlugin = {action: 'install', init: Cell};
export type InvokeCode = {action: 'invoke', code: Cell};
export type Action = InstallPlugin | InvokeCode | Transfer | UninstallPlugin;

export class WalletInplugV2 implements Contract {
    readonly workchain: number;
    readonly publicKey: Buffer;
    readonly address: Address;
    readonly walletId: number;
    readonly init: { data: Cell, code: Cell };

    static async create(args: {workchain: number, publicKey: Buffer, walletId?: number}) {
        let {workchain, publicKey, walletId} = args;
        let code = await walletBoc;
        return new WalletInplugV2(workchain, publicKey, Cell.fromBase64(code!), walletId);
    }

    private constructor(workchain: number, publicKey: Buffer, code: Cell, walletId?: number) {
        this.workchain = workchain;
        this.publicKey = publicKey;
        if (walletId !== undefined) {
            this.walletId = walletId;
        } else {
            this.walletId = 698983191 + workchain;
        }
        
        let data = beginCell()
            .storeUint(this.walletId, 32)   // subwallet_id  -\ uid
            .storeUint(0, 32)               // seqno         _/
            .storeUint(0, 1)                // plugins' state
            .storeBuffer(this.publicKey)
            .endCell();
        this.init = { code, data };
        this.address = contractAddress(workchain, { code, data });
    }
    
    async getBalance(provider: ContractProvider) {
        let state = await provider.getState();
        return state.balance;
    }
    
    async _nowrapGetSeqno(provider: ContractProvider): Promise<bigint> {
        let state = await provider.getState();
        if (state.state.type === 'active') {
            let res = await provider.get('seqno', []);
            return res.stack.readBigNumber();
        } else {
            return BigInt(this.walletId) * 4294967296n + 0n;
        }
    }
    
    async getSeqno(provider: ContractProvider): Promise<bigint> {
        return this._nowrapGetSeqno(provider);
    }

    async getIsPluginInstalled(provider: ContractProvider, id: Buffer): Promise<boolean> {
        let state = await provider.getState();
        if (state.state.type === 'active') {
            let cell_id = beginCell().storeBuffer(id, 32).endCell();
            let num_id = cell_id.beginParse().loadUintBig(256);

            let res = await provider.get('is_plugin_installed', [{type: 'int', value: num_id}]);
            return res.stack.readBoolean();
        } else {
            return false;
        }
    }
    
    async sendExternal(provider: ContractProvider, message: Cell) {
        await provider.external(message);
    }
    
    async sendTransfer(provider: ContractProvider, args: {
        seqno: bigint,
        secretKey: Buffer,
        messages: MessageRelaxed[]
        sendMode?: SendMode,
        timeout?: number,
    }) {
        let transfer = this.createTransfer(args);
        await this.sendExternal(provider, transfer);
    }

    _storeAction(nextAction: Cell | null, add: Action): Cell | null {
        if (add.action == 'install') {
            return beginCell()
                .storeUint(1, 2)
                .storeRef(add.init)
                .storeMaybeRef(nextAction)
                .endCell();
        } else if (add.action == 'invoke') {
            return beginCell()
                .storeUint(3, 2)
                .storeRef(add.code)
                .storeMaybeRef(nextAction)
                .endCell();
        } else if (add.action == 'uninstall') {
            return beginCell()
                .storeUint(0, 2)
                .storeBuffer(add.hash)
                .storeMaybeRef(nextAction)
                .endCell();
        } else {
            throw new Error("trying to store unsupported action");
        }
    }

    _storeTransfer(nextC5: Cell, add: Action): Cell {
        if (add.action == 'transfer') {
            return beginCell()
                .storeRef(nextC5)
                .storeUint(0x0ec3c86d, 32)
                .storeUint(add.sendMode | SendMode.IGNORE_ERRORS, 8)
                .storeRef(beginCell().store(storeMessageRelaxed(add.message)))
                .endCell();
        } else {
            throw new Error("trying to store unsupported action");
        }
    }
    
    signMultiAction(args: {
        seqno: bigint,
        secretKey: Buffer,
        actions: Action[],
    }): Cell {
        let {seqno, secretKey, actions} = args;
        
        if (actions.length > 255) {
            throw Error('Maximum number of messages in a single transfer is 255');
        }
        actions.reverse();
        
        let lastActionRepr: Cell | null = null;
        let lastC5: Cell = Cell.EMPTY;
        for (let a of actions) {
            if (a.action == 'transfer')
                lastC5 = this._storeTransfer(lastC5, a);
            else
                lastActionRepr = this._storeAction(lastActionRepr, a);
        }
        const deadline = Math.floor(Date.now() / 1000) + 60;
        const request = beginCell().storeUint(seqno, 64).storeUint(deadline, 32).storeMaybeRef(lastC5).storeMaybeRef(lastActionRepr).endCell();
        const signature: Buffer = sign(request.hash(), secretKey);
        const body = beginCell().storeUint(0x142c7d04, 32).storeBuffer(signature).storeRef(request).endCell();
        return body;
    }
    
    createTransfer(args: {
        seqno: bigint,
        secretKey: Buffer,
        messages: MessageRelaxed[],
        sendMode?: SendMode | null,
    }): Cell {
        let {seqno, secretKey, messages, sendMode} = args;
        let fixedSendMode : SendMode = (sendMode ?? SendMode.PAY_GAS_SEPARATELY) | SendMode.IGNORE_ERRORS;
        
        const actions: Action[] = messages.map(
            m => {return {action: 'transfer', message: m, sendMode: fixedSendMode};}
        );
        return this.signMultiAction({seqno, actions, secretKey});
    }

    async sendExecuteCode(provider: ContractProvider, args: {
        seqno?: bigint,
        secretKey: Buffer,
        code: Cell
    }): Promise<void> {
        let transfer = this.signMultiAction({
            seqno: args.seqno ?? await this._nowrapGetSeqno(provider),
            secretKey: args.secretKey,
            actions: [{action: 'invoke', code: args.code}]
        })
        await this.sendExternal(provider, transfer);
    }

    async sendInstallPlugin(provider: ContractProvider, args: {
        seqno?: bigint,
        secretKey: Buffer,
        code: Cell,
        data?: Cell
    }): Promise<Buffer> {
        let state = beginCell().storeUint(1, 1).storeRef(args.code).storeRef(args.data ?? Cell.EMPTY).endCell();
        let transfer = this.signMultiAction({
            seqno: args.seqno ?? await this._nowrapGetSeqno(provider),
            secretKey: args.secretKey,
            actions: [{action: 'install', init: state}]
        })
        await this.sendExternal(provider, transfer);
        return state.hash();
    }

    async sendUninstallPlugin(provider: ContractProvider, args: {
        seqno?: bigint,
        secretKey: Buffer,
        hash?: Buffer,
        code?: Cell,
        data?: Cell
    }) {
        let hash: Buffer = args.hash ??
            beginCell().storeUint(1, 1).storeRef(args.code!).storeRef(args.data! ?? Cell.EMPTY).endCell().hash();
        let transfer = this.signMultiAction({
            seqno: args.seqno ?? await this._nowrapGetSeqno(provider),
            secretKey: args.secretKey,
            actions: [{action: 'uninstall', hash}]
        })
        await this.sendExternal(provider, transfer);
    }
    
    async sendDeploy(provider: ContractProvider, via: Sender, value?: string) {
        await provider.internal(via, {
            value: toNano(value ?? '0.01'),
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY
        });
    }

    async sendInvokePlugin(provider: ContractProvider, id: Buffer, data: Builder) {
        const body = beginCell().storeUint(0x44d562b5, 32).storeBuffer(id, 32).storeBuilder(data).endCell();
        await this.sendExternal(provider, body);
    }
}

export function makeSender(contract: SandboxContract<WalletInplugV2>, secretKey: Buffer) : Sender {
    return {
        send: async (args: SenderArguments) => {
            let seqno = await contract.getSeqno();
            let transfer = contract.createTransfer({
                seqno,
                secretKey,
                sendMode: args.sendMode,
                messages: [internal(args)]
            });
            await contract.sendExternal(transfer);
        }
    };
}
