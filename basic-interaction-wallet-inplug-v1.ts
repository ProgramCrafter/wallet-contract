import { getHttpEndpoint } from "@orbs-network/ton-access";
import { Address, Cell, toNano, TonClient } from "ton";
import { keyPairFromSeed, mnemonicToPrivateKey, mnemonicToSeed } from "ton-crypto";
import { parseArgs } from "util";
import yargs from "yargs";
import { mnemonic } from "./env";
import { makeSender, WalletInplugV1 } from "./wallet-v5";

function expect(a: any) {
    return {
        toBe: function(b: any) {
            if (a === b) return;
            throw new Error("mismatch between " + a + " " + b);
        }
    }
}

const argv = yargs
    .option('action', {
        alias: 'a',
        description: 'The action to perform (info|transfer|install|<unsupported>uninstall|execute)',
        type: 'string',
        demandOption: true,
    })
    .option('dest', {
        alias: 'd',
        description: 'The destination address',
        type: 'string',
        demandOption: false,
    })
    .option('value', {
        alias: 'v',
        description: 'The value to transfer',
        type: 'string',
        demandOption: false,
    })
    .option('body', {
        alias: 'b',
        description: 'Plugin/optional body data',
        type: 'string',
        demandOption: false,
    }).argv;

(async () => {
    const args = await argv;
    
    const endpoint = await getHttpEndpoint({network: 'testnet'});
    const client = new TonClient({ endpoint });

    const key = await mnemonicToPrivateKey(mnemonic.split(' '));
    const wallet = client.open(WalletInplugV1.create({workchain: 0, publicKey: key.publicKey}));
    console.log(wallet.address);
    console.log(await wallet.getBalance());
    console.log(await wallet.getSeqno());

    if (args.action == 'info') {
        return;
    } else if (args.action == 'transfer') {
        const destination = Address.parse(args.dest!!);
        const value = toNano(args.value!!);
        
        const body = args.body ? Cell.fromBase64(args.body) : undefined;
        
        console.log(await makeSender(wallet, key.secretKey).send({
            to: destination,
            value,
            body
        }));
    } else if (args.action == 'install') {
        console.warn('Uninstalling plugins is not supported yet.');
        const plugin = Cell.fromBase64(args.body!!);
        await contract.sendInstallPlugin({secretKey: key.secretKey, code: plugin});
    } else if (args.action == 'execute') {
        const code = Cell.fromBase64(args.body!!);
        await contract.sendExecuteCode({secretKey: key.secretKey, code: code});
    } else {
        expect(args.action).toBe('uninstall');
        console.warn('Uninstalling plugins is not supported yet.');
    }
})();
