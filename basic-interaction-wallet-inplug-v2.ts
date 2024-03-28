import { Address, Cell, toNano, TonClient } from "@ton/ton";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { mnemonicToPrivateKey } from "@ton/crypto";
import yargs from "yargs";

import { makeSender, WalletInplugV2 } from "./wallet-inplug-v2";
import { mnemonic } from "./env";

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
        description: 'Plugin storage/optional body data',
        type: 'string',
        demandOption: false,
    })
    .option('code', {
        alias: 'c',
        description: 'Invocable/plugin code',
        type: 'string',
        demandOption: false,
    }).argv;

(async () => {
    const args = await argv;
    
    const endpoint = await getHttpEndpoint({network: 'testnet'});
    const client = new TonClient({ endpoint });

    const key = await mnemonicToPrivateKey(mnemonic.split(' '));
    const wallet = client.open(await WalletInplugV2.create({workchain: 0, publicKey: key.publicKey}));
    console.log(wallet.address);
    console.log('TON:  ', await wallet.getBalance());
    console.log('Seqno:', await wallet.getSeqno());

    if (args.action == 'info') {
        return;
    } else if (args.action == 'transfer') {
        const destination = Address.parse(args.dest!!);
        const value = toNano(args.value!!);
        
        const body = args.body ? Cell.fromBase64(args.body) : undefined;
        
        console.log(await makeSender(wallet as any, key.secretKey).send({
            to: destination,
            value,
            body
        }));
    } else if (args.action == 'install') {
        const pluginCode = Cell.fromBase64(args.code!);
        const pluginData = args.body ? Cell.fromBase64(args.body!) : Cell.EMPTY;
        await wallet.sendInstallPlugin({secretKey: key.secretKey, code: pluginCode, data: pluginData});
    } else if (args.action == 'uninstall') {
        const pluginCode = Cell.fromBase64(args.code!);
        const pluginData = args.body ? Cell.fromBase64(args.body!) : Cell.EMPTY;
        await wallet.sendUninstallPlugin({secretKey: key.secretKey, code: pluginCode, data: pluginData});
    } else if (args.action == 'execute') {
        const code = Cell.fromBase64(args.code!);
        await wallet.sendExecuteCode({secretKey: key.secretKey, code});
    } else {
        console.warn('Unsupported operation');
    }
})();
