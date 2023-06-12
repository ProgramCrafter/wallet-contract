import { getHttpEndpoint } from "@orbs-network/ton-access";
import { Address, Cell, toNano, TonClient } from "ton";
import { keyPairFromSeed, mnemonicToPrivateKey, mnemonicToSeed } from "ton-crypto";
import { parseArgs } from "util";
import yargs from "yargs";
import { mnemonic } from "./env";
import { makeSender, WalletContractV5R2 } from "./wallet-v5";

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
        description: 'The action to perform (info|transfer|<unsupported>install|uninstall|execute)',
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
        description: 'Optional body data',
        type: 'string',
    }).argv;

(async () => {
    const args = await argv;
    
    const endpoint = await getHttpEndpoint({network: 'testnet'});
    const client = new TonClient({ endpoint });

    const key = await mnemonicToPrivateKey(mnemonic.split(' '));
    const wallet = client.open(WalletContractV5R2.create({workchain: 0, publicKey: key.publicKey}));
    console.log(wallet.address);
    console.log(await wallet.getBalance());
    console.log(await wallet.getSeqno());

    if (args.action == 'info') {
        return;
    }

    expect(args.action).toBe('transfer');

    const destination = Address.parse(args.dest!!);
    const value = toNano(args.value!!);

    const body = args.body ? Cell.fromBase64(args.body) : undefined;

    console.log(await makeSender(wallet, key.secretKey).send({
        to: destination,
        value,
        body
    }));
})();
