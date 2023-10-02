import { SandboxContract } from "@ton-community/sandbox";
import { Address, beginCell, Builder, Cell, Contract, contractAddress, ContractProvider, internal, MessageRelaxed, Sender, SenderArguments, SendMode, Slice, storeMessageRelaxed, toNano } from "ton-core";
import { sign } from "ton-crypto";

export type Transfer = {action: 'transfer', message: MessageRelaxed, sendMode: SendMode};
export type UninstallPlugin = {action: 'uninstall', hash: Buffer};
export type InstallPlugin = {action: 'install', code: Cell};
export type InvokeCode = {action: 'invoke', code: Cell};
export type Action = InstallPlugin | InvokeCode | Transfer | UninstallPlugin;

export class WalletInplugV1 implements Contract {
    readonly workchain: number;
    readonly publicKey: Buffer;
    readonly address: Address;
    readonly walletId: number;
    readonly init: { data: Cell, code: Cell };

    static create(args: {workchain: number, publicKey: Buffer, walletId?: number}) {
        let {workchain, publicKey, walletId} = args;
        return new WalletContractV5R2(workchain, publicKey, walletId);
    }

    private constructor(workchain: number, publicKey: Buffer, walletId?: number) {
        this.workchain = workchain;
        this.publicKey = publicKey;
        if (walletId !== undefined) {
            this.walletId = walletId;
        } else {
            this.walletId = 698983191 + workchain;
        }

        let code = Cell.fromBase64(
            'te6ccgECJAEABUUAART/APSkE/S88sgLAQIBIAIDAgFIBAUCNvLTHyGCEBQsfQS6jowBghBE1WK1upEw4w3jDR0eAkDQIMcAkl8E4CHQ0wMBcbCSXwXgAdMfIYIQw//UT7rjDwYHAgEgCQoA7jFsIjL6QDCNCGf/KJX/SEw+eGhKDW139POSSIFfv1iNYXUVO2mf8Qk/lMTHBbPjCO1E0NM/9AT0BAH4YdMfBNP/MFMCgwf0D2+hMbPjCHLIywdSEMv/cc8jAoMHUEL0F0AT+EEEyMs/E/QAE/QAEssfAc8Wye1UAfgyghBE1WK1uo7u7UTQ0z/0BPQEAfhh0x8E0/9TE4MH9A9vofLhLCL4QYMH9A9voTAB0O0eI0QVEDtKm28GFIIB2r9vjGilpfh+gQD/b4QgpGEBf9s4aPheoW+AbxAUIG6aMPhBgwf0WzD4YZn4QRKDB/QX+GHiQTCSXwTiCAAq+EEEyMs/E/QAE/QAEssfAc8Wye1UAgEgCwwCASATFAIBIA0OACW4yX7UTQ0z/0BPQEAfhh0x9fA4AgEgDxACASAREgBfsMWbwDtRNDTP/QE9AQB+GHTHxAjXwOTIG6zjhGDB/SWb6UwAddM0G8CWG8CAegwgAHeyaVvAO1E0NM/9AT0BAH4YdMfECNfA5MgbrOOHYMH9JZvpTD4QVIQgwf0D2+hMALXTNBYbwNYbwIB6DCAAN7Kd+1E0NM/9AT0BAH4YdMfECNfA4MH9A9voTGAAJbDnO1E0NM/9AT0BAH4YdMfMzGACASAVFgIBIBscADe0r92omhpn/oCegIA/DDpj4gRr4HBg/oHt9CYQAgJxFxgAUaUK3gHaiaGmf+gJ6AgD8MOmPiBGvgcmQN1nOQYP6SzfSmBisN4EA9BhAgEgGRoAN6LjtRNDTP/QE9AQB+GHTHxAjXwODB/QPb6Ew0IAJaJZSAoMH9Fsw+EESgwf0WzD4YYAN7TNPaiaGmf+gJ6AgD8MOmPr4J8IMGD+ge30JhAAXbYIDeAdqJoaZ/6AnoCAPww6Y+IEa+ByZA3WccIQYP6SzfSmADrpjeBLDeBAPQYQAPrtRNDTP/QE9AQB+GHTHwTT/1MTgwf0D2+h8uEsIvhBgwf0D2+hMAHQ7R5UQwNvA4IBXVZvjGilpfh+gQD/b4QgpGEBf9s4aPheoW+AbxAgbpow+EGDB/RbMPhhmfhBEoMH9Bf4YeJVAvhBBMjLPxP0ABP0ABLLHwHPFsntVAL+Me1E0NM/9AT0BAH4YdMfVDQUAtQh+QAjggiA3k+6mzMD1wv/E/kQ8uE2jhgDghBk3evrupdQA/kU8uE2lhNfA/LBN+Li0NM/URS68uE40x8B+CO+8uE5I6RUcyX4QQTIyz8T9AAT9AASyx8BzxbJ7VT4D/gA9AWTIG6ziugwAh8gAQhY2zxZIQAwpFAj+EEEyMs/E/QAE/QAEssfAc8Wye1UAvYB0NMfIYIQPulD8bqZMdQg1wsHEvsAjuIhggn6v/a6jhcxINcL/xJSAoMH9Fsw+EESgwf0WzD4YY6+IYIQea4tn7qOMgGCEGkIyZS6jiLUAdDtHm8AcG+MaKWl+H6BAP9vhCCkYQF/2zho+F6hb4Awk/LBL+IB4w3iAeIiIwD8MdQh+QBUQhSDB/QXghBD/9RPgBjIywWNCGf/KJX/SEw+eGhKDW139POSSIFfv1iNYXUVO2mf8Qk/lMTPFoIQCYloACSCCeEzgAGCAYag+UEwWHCAEvgzgCD0DG+hMIEAqNch0z8DqALTPzBQA6igAairD6D6AsuKEszJcvsAAAb0BQE='
        );
        
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
        const deadline = Math.floor(Date.now() / 1000) + 60;
        const request = beginCell().storeUint(seqno, 64).storeUint(deadline, 32).storeMaybeRef(lastActionRepr).endCell();
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

    async sendInvokePlugin(provider: ContractProvider, id: Buffer, data: Builder) {
        const body = beginCell().storeUint(0x44d562b5, 32).storeBuffer(id, 32).storeBuilder(data).endCell();
        await this.sendExternal(provider, body);
    }
}

export function makeSender(contract: SandboxContract<WalletInplugV1>, secretKey: Buffer) : Sender {
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
