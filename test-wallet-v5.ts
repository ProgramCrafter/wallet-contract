import { Blockchain } from "@ton-community/sandbox";
import { SendMode, toNano } from "ton-core";
import { randomTestKey } from "ton/dist/utils/randomTestKey";
import { makeSender, WalletContractV5R2 } from "./wallet-v5";


function expect(a: any) {
    return {
        toBe: function(b: any) {
            if (a === b) return;
            throw new Error("mismatch between " + a + " " + b);
        }
    }
}

(async () => {
    const blockchain = await Blockchain.create();
    const deployer = await blockchain.treasury('deployer');
    let key = randomTestKey('v5r1-treasure');

    let contract = blockchain.openContract(WalletContractV5R2.create({ workchain: 0, publicKey: key.publicKey }));
    let balance = await contract.getBalance();
    expect(contract.address.toString()).toBe('EQCYcccF6VVg72UeDXeinJ7Xt_tErqinE53K-W-ynuhTFvyz');
    expect(balance).toBe(0n);

    await contract.sendDeploy(deployer.getSender(), '0.5');
    balance = await contract.getBalance();
    expect(balance <= toNano('0.50')).toBe(true);
    expect(balance >= toNano('0.49')).toBe(true);

    await makeSender(contract, key.secretKey).send({
        to: deployer.address, value: toNano('0.25'), sendMode: SendMode.NONE
    });
    balance = await contract.getBalance();
    expect(balance <= toNano('0.25')).toBe(true);
    expect(balance >= toNano('0.22')).toBe(true);
})();
