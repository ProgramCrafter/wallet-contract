import {compileFunc, compilerVersion} from '@ton-community/func-js';
import {readFile, writeFile} from 'fs/promises';
import {fromCode} from 'tvm-disassembler';
import {Cell} from '@ton/core';

export async function disasm(c: Cell): Promise<string> {
    let s = await fromCode(c);
    return s.replaceAll('s0 s1 XCHG', 'SWAP')
            .replaceAll('s0 PUSH', 'DUP');
}

export async function compile(outFile: boolean = true, postprocess: boolean = true) {
    console.log(await compilerVersion());

    let result = await compileFunc({
        targets: ['stdlib.fc', 'wallet.fc'],
        sources: {
            'stdlib.fc': await readFile('./func/stdlib.fc', {encoding: 'utf-8'}),
            'wallet.fc': await readFile('./func/wallet.fc', {encoding: 'utf-8'}),
        }
    });
    if (result.status === 'error') {
        console.error(result.message)
        return null;
    }
    if (result.warnings)
        console.warn(result.warnings);

    if (outFile) {
        await writeFile('./dist/wallet.fif', result.fiftCode);
        await writeFile('./dist/wallet.boc', result.codeBoc);
        if (postprocess)
            await writeFile('./dist/wallet-da.fif', await disasm(Cell.fromBase64(result.codeBoc)));
    }
    return result.codeBoc;
}

export async function compilePlugin() {
    let result = await compileFunc({
        targets: ['stdlib.fc', 'plugin.fc'],
        sources: {
            'stdlib.fc': await readFile('./func/stdlib.fc', {encoding: 'utf-8'}),
            'plugin.fc': await readFile('./func/plugin.fc', {encoding: 'utf-8'}),
        }
    });
    if (result.status === 'ok') return result.codeBoc;
    return null;
}

export const walletBoc = compile();
