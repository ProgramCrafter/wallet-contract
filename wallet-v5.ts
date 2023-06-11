import { SandboxContract } from "@ton-community/sandbox";
import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, internal, MessageRelaxed, Sender, SenderArguments, SendMode, storeMessageRelaxed, toNano } from "ton-core";
import { sign } from "ton-crypto";

export type Transfer = {action: 'transfer', message: MessageRelaxed, sendMode: SendMode};
export type UninstallPlugin = {action: 'uninstall', hash: Buffer};
export type InstallPlugin = {action: 'install', code: Cell};
export type InvokeCode = {action: 'invoke', code: Cell};
export type Action = InstallPlugin | InvokeCode | Transfer | UninstallPlugin;

export class WalletContractV5R1 implements Contract {
    readonly workchain: number;
    readonly publicKey: Buffer;
    readonly address: Address;
    readonly walletId: number;
    readonly init: { data: Cell, code: Cell };

    static create(args: {workchain: number, publicKey: Buffer, walletId?: number}) {
        let {workchain, publicKey, walletId} = args;
        return new WalletContractV5R1(workchain, publicKey, walletId);
    }

    private constructor(workchain: number, publicKey: Buffer, walletId?: number) {
        this.workchain = workchain;
        this.publicKey = publicKey;
        if (walletId !== undefined) {
            this.walletId = walletId;
        } else {
            this.walletId = 698983191 + workchain;
        }

        let code = Cell.fromBase64('te6ccgECIgEABNsAART/APSkE/S88sgLAQIBIAIDAgFIBAUB4vLTHyGCEEUJS/W6jmIBghBE1WK1uo5V7UTQ0z/0BPQEAfhh0x8E0/9RE4MH9A/y4SzQ7R4BbwGCAV1Wb4xopaX4foEA/2+EIKRhAX/bOGj4XqFvgDBVAvhBBMjLPxP0ABP0ABLLHwHPFsntVJEw4uMNIAICzAYHAgEgDA0CP9kGOASS+CcBDoaYGAuNhJL4LwAOmPkMEIYf/qJ91xh8CAkC97YDoaY+QwQgfdKH43UyY6hBrhYOJfYBHcRDBBP1f+11HC5iQa4X/iSkBQYP6LZh8IIlBg/otmHwwx18QwQg81xbP3UcZAMEINIRkyl1HEWoA6HaPN4A4N8Y0UtL8P0CAf7fCEFIwgL/tnDR8L1C3wBhJ+WCX8QDxhvEA8UKCwDqMWwiMvpAMI0IZ/8olf9ITD54aEoNbXf085JIgV+/WI1hdRU7aZ/xCT+UxMcFs+MI7UTQ0z/0BPQEAfhh0x8E0/8wUwKDB/QPMbPjCHLIywdSEMv/cc8jAoMHUEL0F0AT+EEEyMs/E/QAE/QAEssfAc8Wye1UAM4yghBE1WK1uo5Z7UTQ0z/0BPQEAfhh0x8E0/9RE4MH9A/y4SzQ7R4QOEdmbwQTggHav2+MaKWl+H6BAP9vhCCkYQF/2zho+F6hb4AwQzD4QQTIyz8T9AAT9AASyx8BzxbJ7VSSXwTiAPwx1CH5AFRCFIMH9BeCEEP/1E+AGMjLBY0IZ/8olf9ITD54aEoNbXf085JIgV+/WI1hdRU7aZ/xCT+UxM8WghAJiWgAJIIJ4TOAAYIBhqD5QTBYcIAS+DOAIPQMb6EwgQCo1yHTPwOoAtM/MFADqKABqKsPoPoCy4oSzMlw+wAABvQFAQIBIA4PAgEgFhcCASAQEQAluMl+1E0NM/9AT0BAH4YdMfXwOAIBIBITAgEgFBUAX7DFm8A7UTQ0z/0BPQEAfhh0x8QI18DkyBus44Rgwf0lm+lMAHXTNBvAlhvAgHoMIABzsmlbwDtRNDTP/QE9AQB+GHTHxAjXwOTIG6zjhuDB/SWb6Uw+EFSEIMH9A8wAtdM0FhvA1hvAgHoMIAAzsp37UTQ0z/0BPQEAfhh0x8QI18Dgwf0DzGAAJbDnO1E0NM/9AT0BAH4YdMfMzGACASAYGQIBIB4fADO0r92omhpn/oCegIA/DDpj4gRr4HBg/oHmEAICcRobAFGlCt4B2omhpn/oCegIA/DDpj4gRr4HJkDdZzkGD+ks30pgYrDeBAPQYQIBIBwdADOi47UTQ0z/0BPQEAfhh0x8QI18Dgwf0DzDQgAlollICgwf0WzD4QRKDB/RbMPhhgAztM09qJoaZ/6AnoCAPww6Y+vgnwgwYP6B5hAAXbYIDeAdqJoaZ/6AnoCAPww6Y+IEa+ByZA3WccIQYP6SzfSmADrpjeBLDeBAPQYQAfox7UTQ0z/0BPQEAfhh0x9UNBQC1CH5ACOCCIDeT7qbMwPXC/8T+RDy4TaOGAOCEGTd6+u6l1AD+RTy4TaWE18D8sE34uLQ0z9RFLry4TgjpFRzJfhBBMjLPxP0ABP0ABLLHwHPFsntVPgP+AD0BZMgbrOUWPALWegwAqRQIyEAKvhBBMjLPxP0ABP0ABLLHwHPFsntVA==');
        
        let data = beginCell()
            .storeUint(this.walletId, 32)   // subwallet_id  -\ uid
            .storeUint(0, 32)               // seqno         _/
            .storeUint(0, 2)                // plugins code and data
            .storeUint(0x0080de4f, 32)      // key::public::ed25519
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
                .storeUint(0x79ae2d9f, 32)
                .storeRef(add.code)
                .storeMaybeRef(nextAction)
                .endCell();
        } else if (add.action == 'transfer') {
            return beginCell()
                .storeUint(0x3ee943f1, 32)
                .storeUint(add.sendMode | SendMode.IGNORE_ERRORS, 8)
                .storeRef(beginCell().store(storeMessageRelaxed(add.message)))
                .storeMaybeRef(nextAction)
                .endCell();
        } else if (add.action == 'invoke') {
            return beginCell()
                .storeUint(0x6908c994, 32)
                .storeRef(add.code)
                .storeMaybeRef(nextAction)
                .endCell();
        } else if (add.action == 'uninstall') {
            return beginCell()
                .storeUint(0x01fabff6, 32)
                .storeBuffer(add.hash)
                .storeMaybeRef(nextAction)
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
            throw Error("Maximum number of messages in a single transfer is 255");
        }
        actions.reverse();
        
        let lastActionRepr: Cell | null = null;
        for (let a of actions) {
            lastActionRepr = this._storeAction(lastActionRepr, a);
        }
        const request = beginCell().storeUint(seqno, 64).storeMaybeRef(lastActionRepr).endCell();
        const signature: Buffer = sign(request.hash(), secretKey);
        const body = beginCell().storeUint(0x45094bf5, 32).storeBuffer(signature).storeRef(request).endCell();
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

    async sendInstallPlugin(provider: ContractProvider, args: {
        seqno?: bigint,
        secretKey: Buffer,
        code: Cell
    }): Promise<Buffer> {
        let transfer = this.signMultiAction({
            seqno: args.seqno ?? await this._nowrapGetSeqno(provider),
            secretKey: args.secretKey,
            actions: [{action: 'install', code: args.code}]
        })
        await this.sendExternal(provider, transfer);
        return args.code.hash();
    }

    async sendUninstallPlugin(provider: ContractProvider, args: {
        seqno?: bigint,
        secretKey: Buffer,
        hash?: Buffer,
        code?: Cell
    }) {
        let hash: Buffer = args.hash ?? args.code!!.hash();
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
}

export function makeSender(contract: SandboxContract<WalletContractV5R1>, secretKey: Buffer) : Sender {
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
