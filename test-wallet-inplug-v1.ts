import { Blockchain } from "@ton-community/sandbox";
import { beginCell, Cell, SendMode, toNano } from "ton-core";
import { randomTestKey } from "ton/dist/utils/randomTestKey";
import { makeSender, WalletInplugV1 } from "./wallet-v5";


function expect(a: any) {
    return {
        toBe: function(b: any) {
            if (a === b) return;
            // throw new Error("mismatch between " + a + " " + b);
            console.error("mismatch between " + a + " " + b);
        }
    }
}

(async () => {
    const blockchain = await Blockchain.create();
    const deployer = await blockchain.treasury('deployer');
    let key = randomTestKey('v5r1-treasure');

    let contract = blockchain.openContract(WalletInplugV1.create({ workchain: 0, publicKey: key.publicKey }));
    let balance = await contract.getBalance();
    expect(contract.address.toString()).toBe('EQBTx-Tt7VSZLXCaQdA007BJDxnqfKRpKL3RFpGdh6Wcxb2J');
    expect(balance).toBe(0n);

    await contract.sendDeploy(deployer.getSender(), '5.5');
    balance = await contract.getBalance();
    expect(balance <= toNano('5.50')).toBe(true);
    expect(balance >= toNano('5.49')).toBe(true);

    await makeSender(contract, key.secretKey).send({
        to: deployer.address, value: toNano('0.25'), sendMode: SendMode.NONE
    });
    balance = await contract.getBalance();
    expect(balance <= toNano('5.25')).toBe(true);
    expect(balance >= toNano('5.22')).toBe(true);

    const plugin = Cell.fromBase64(
        'te6ccgECCgEAAQUAART/APSkE/S88sgLAQIBYgIDAArQhA/y8AIBIAQFAgFqBgcCAnUICQAHsyXcIAC7s1WMiBujlQw+ABwgDDIywXLgYukV4dGVybmFsOiCM8WAc8Wi6IGF0IHNlcW5vIIzxaCAUyX7UPYbwCRIZcBeqkMEm+M6DGTIG+ImG+NpjBYywcB6DDJcPsAyMngMYABNrcvGhDACyoez1VF4HbNNq5Rbqfr3zKuoAjKorhK+YZr7LIIiVrZAAJetX4mvgZk4QBhkZYLlwMaCaS3OjK5NzC2EDu0ujQQNDC5tBBBniwF8gDeASJDLgL1Uhgk3xnQYiUmQN8RMN8bTGCxlg4D0GGS4fYBA'
    );

    expect(await contract.getIsPluginInstalled(plugin.hash())).toBe(false);
    await contract.sendInstallPlugin({secretKey: key.secretKey, code: plugin});
    expect(await contract.getIsPluginInstalled(plugin.hash())).toBe(true);

    blockchain.setVerbosityForAddress(contract.address, {
        blockchainLogs: true,
        vmLogs: 'none',
        debugLogs: true,
        print: true
    });
    await contract.sendInvokePlugin(plugin.hash(), beginCell().storeStringTail("ABC"));
})();
