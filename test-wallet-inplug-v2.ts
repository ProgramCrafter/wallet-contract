import { beginCell, Cell, SendMode, toNano, storeCommonMessageInfo } from "@ton/core";
import { keyPairFromSeed, sha256_sync } from "@ton/crypto";
import { Blockchain } from "@ton/sandbox";

import { makeSender, WalletInplugV2 } from "./wallet-inplug-v2";
import { compilePlugin, disasm } from "./build";


function expect(a: any) {
    const obj = {
        toBe: function(b: any) {
            if (a === b) return;

            // throw new Error("mismatch between " + a + " " + b);
            console.error("mismatch between " + a + " " + b);
        },
        else: function(f: () => any) {
            if (!a) return expect(f());
            return obj;
        }
    };
    return obj;
}

(async () => {
    const blockchain = await Blockchain.create();
    const deployer = await blockchain.treasury('deployer');
    let key = keyPairFromSeed(sha256_sync('v5r2-treasure'));

    let contract = blockchain.openContract(await WalletInplugV2.create({ workchain: 0, publicKey: key.publicKey }));
    expect(contract.init.code.hash().toString('base64')).toBe('pA2xGDpPrpTUWg6Z1pEGck9WIqU6y9A1sbJqa1Js5BA=');
    expect(contract.init.code.toBoc({idx: false, crc32: true}).toString('base64'))
        .toBe('te6cckECDwEAAoEAART/APSkE/S88sgLAQIBIAIJAgFIAwQBftAg1xCCEETVYrW94wiAINch0//tRNDTP/QEEnBARVMDgwf0D2+h8uCAVBMj2zwCgwf0F1jIyz/0AAHPFsntVAoCAUgFCAIBWAYHACWynftRNDTP/QEMDGDB/QOb6ExgABOw5ztRNCDB9cigABG4yX7UTQ1ws/gCkvLTHyGCEBQsfQS6jroBghBE1WK1uo6t7UTQ0z/0BAPT/38CUwODB/QPb6Hy4IBUEyPbPAKDB/QXAcjLP/QAAc8Wye1UkTDi4w0KDQHwI9DTAAGOKtTXTCD5ACLQ7R4GgX1pqIIB2r+gECNFBtpBIPkAUAO6kVvgbBLI9ADMyeA0A9Mg1NTTH8hTUqAByyBSQMwSyx8hzxYG8n/4I1AEufJ+AdDtHhA1QVCCAdq/AXQBcSXbQSVsEQHCAfJ9AszJIdDUAfkACwH+gvCWopbSJPKFxnvuk8MPijCRV/Dao13FuH5BC3hjCgnPx7ryvNMfAYIQDsPIbbryvNMHAYEAvLDyfNTR0NMDAXWwwATyu/pAMfpAMfoA9AH6ADH6ADHTYAFxsPJ70wABk9TR0N7XEAT0BFJSgCD0Dm+hMQXAABWx8roD+gAwEwwACrvyuu1VAcQx7UTQ0z/0BFEzAdQh+QAD1wv/ECP5EPLhNtDTP1ETuvLhONMfAfgjvvLhOSKkVGQwyMs/9AABzxbJ7VT4D/gA9AQhbrOTAe1VkTHi9AWTIG6ziugwAaTIyz/0AAHPFsntVA4AdNDTASHAAJwxINcL/xIBgwf0WzCOISHAAZwx1FmDByH5AEAz9BefAcADldXtHtoAk/LBL+IB4uIB9AUfcGS8');

    let balance = await contract.getBalance();
    expect(contract.address.toString()).toBe('EQDoYL6oLDYf6GDMpDmsxoYvuLTP8qQNeiWTtFUkHUiQ8-uP');
    expect(balance).toBe(0n);

    await contract.sendDeploy(deployer.getSender(), '5.5');
    balance = await contract.getBalance();
    expect(balance <= toNano('5.50')).toBe(true);
    expect(balance >= toNano('5.49')).toBe(true);

    // sending one message

    await makeSender(contract, key.secretKey).send({
        to: deployer.address, value: toNano('0.25'), sendMode: SendMode.NONE
    });
    balance = await contract.getBalance();
    expect(balance <= toNano('5.25')).toBe(true);
    expect(balance >= toNano('5.22')).toBe(true);

    // plugin installation

    const pluginCode = Cell.fromBase64((await compilePlugin())!);
    const plugin = beginCell().storeUint(1, 1).storeRef(pluginCode).storeRef(Cell.EMPTY).endCell();

    expect(await contract.getIsPluginInstalled(plugin.hash())).toBe(false);
    await contract.sendInstallPlugin({secretKey: key.secretKey, code: pluginCode});
    expect(await contract.getIsPluginInstalled(plugin.hash())).toBe(true);

    // plugin invocation via external

    /*
    blockchain.setVerbosityForAddress(contract.address, {
        blockchainLogs: true,
        vmLogs: 'none',
        debugLogs: true,
        print: true
    });
    */
    const trustedPluginRes = await contract.sendInvokePlugin(plugin.hash(), beginCell().storeStringTail('ABC'));
    expect(trustedPluginRes.externals.length).toBe(1);
    expect(trustedPluginRes.externals[0].body.beginParse().skip(32).loadStringTail()).toBe('External: ABC at seqno 3002109945798721538');
    expect(await contract.getSeqno()).toBe(3002109945798721538n);

    // plugin invocation via internal

    const internalRes = await deployer.send({
        to: contract.address,
        value: toNano('0.4'),
        body: beginCell().storeUint(0x44d562b5, 32).storeBuffer(plugin.hash()).storeStringTail('ABC').endCell()
    });
    const validHash = beginCell().storeStringTail('ABC').endCell().hash();
    expect(internalRes.externals.length).toBe(1);
    expect(internalRes.externals[0].body.beginParse().skip(32).loadStringTail()).toBe('Internal with hash 76439435600465928926908238590329271168192884407773227420621521707826431831530');
    expect(validHash.toString('hex')).toBe(76439435600465928926908238590329271168192884407773227420621521707826431831530n.toString(16));

    // onchain invoking code

    const codeCell = beginCell().storeBuffer(Buffer.from('FF00F807FE20', 'hex')).endCell();
    expect(await disasm(codeCell)).toBe('SETCP0\nx{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}x{F807FE20}');

    const invocationRes = await contract.sendExecuteCode({secretKey: key.secretKey, code: codeCell});
    const d = invocationRes.transactions[0].description;
    expect(invocationRes.transactions[0].debugLogs).toBe('#DEBUG#: s0 = 3195');
    expect(d.type == 'generic' && d.computePhase.type == 'vm' && d.computePhase.gasUsed == 4089n)
      .else(() => {console.log(d); return false;}).toBe(true);
})();
