/**
 * TypeScript -> Python interoperability fixture.
 *
 * Builds deterministic outputs of OUR engine (fixed OAEP seed / PSS salt, public test keys)
 * and compares them with the committed `__vectors__/ts-outputs.json`. CI's Python job then
 * verifies that committed file with the independent `cryptography` library
 * (`python -m reference.check_ts_outputs`). To refresh the file after an intended change:
 *   bash:        UPDATE_TS_OUTPUTS=1 npm run vectors:ts
 *   PowerShell:  $env:UPDATE_TS_OUTPUTS=1; npm run vectors:ts; Remove-Item Env:UPDATE_TS_OUTPUTS
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import references from '../__vectors__/reference-vectors.json';
import { deriveKey } from '../math';
import { fingerprint, fromHex, toHex, utf8 } from '../encoding';
import {
  openBasic,
  oaepEncrypt,
  pssSign,
  sealBasic,
  teachingSign,
  textbookEncryptNumber,
} from './index';

const OUTPUT = fileURLToPath(new URL('../__vectors__/ts-outputs.json', import.meta.url));
const SEED = fromHex('a5'.repeat(32)),
  SALT = fromHex('5a'.repeat(32));

async function build() {
  const message = utf8.encode('TypeScript → Python: مرحبا 🔐');
  const assignment = [];
  for (const v of references.keys) {
    const key = deriveKey(BigInt(v.p), BigInt(v.q), BigInt(v.e));
    const longText = utf8.encode('Textbook blocks. '.repeat(Math.ceil((2 * v.bits) / 8 / 17)));
    const textbook = await sealBasic(key, longText, 'textbook');
    const oaep = await sealBasic(key, message, 'oaep', SEED);
    // Sanity: our own engine opens what it produced.
    expect((await openBasic(textbook.envelope, [key])).bytes).toEqual(longText);
    expect((await openBasic(oaep.envelope, [key])).bytes).toEqual(message);
    assignment.push({
      bits: v.bits,
      n: String(key.n),
      e: String(key.e),
      fingerprint: await fingerprint(key),
      message_hex: toHex(message),
      oaep_seed_hex: toHex(SEED),
      oaep_ciphertext_hex: toHex(await oaepEncrypt(key, message, SEED)),
      oaep_envelope: oaep.envelope,
      textbook_message_hex: toHex(longText),
      textbook_envelope: textbook.envelope,
      pss_salt_hex: toHex(SALT),
      pss_signature_hex: toHex(await pssSign(key, message, SALT)),
    });
  }
  const lecture = deriveKey(17n, 11n, 7n),
    note = utf8.encode('Pay Bob 10');
  const signed = await teachingSign(lecture, note);
  return {
    schema: 'rsa-lab-ts-outputs-v1',
    warning: 'PUBLIC TEST KEYS AND FIXED RANDOMNESS: NEVER USE FOR REAL DATA',
    assignment,
    teaching: {
      p: '17',
      q: '11',
      e: '7',
      number: { message: '88', ciphertext: String(textbookEncryptNumber(lecture, 88n)) },
      signature: {
        message_hex: toHex(note),
        digest: String(signed.digest),
        signature: String(signed.signature),
      },
    },
  };
}

it('TypeScript outputs match the committed fixture verified by Python', async () => {
  const generated = JSON.stringify(await build(), null, 2) + '\n';
  if (process.env.UPDATE_TS_OUTPUTS === '1') writeFileSync(OUTPUT, generated, 'utf8');
  expect(existsSync(OUTPUT), 'Run `npm run vectors:ts` with UPDATE_TS_OUTPUTS=1').toBe(true);
  expect(readFileSync(OUTPUT, 'utf8').replaceAll('\r\n', '\n')).toBe(generated);
});
