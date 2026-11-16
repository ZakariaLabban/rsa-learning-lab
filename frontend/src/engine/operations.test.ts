import { expect, it } from 'vitest';
import references from './__vectors__/reference-vectors.json';
import { deriveKey } from './math';
import { decryptMessage, encryptMessage } from './operations';
import { packEnvelope, parseEnvelope, toBase64, fromBase64 } from './encoding';

for (const fixture of references.keys)
  it(`preserves exact empty, Unicode and zero-prefixed message bytes at ${fixture.bits} bits`, async () => {
    const key = deriveKey(BigInt(fixture.p), BigInt(fixture.q), BigInt(fixture.e));
    for (const mode of ['oaep', 'textbook'] as const)
      for (const message of ['', '\0\0Hello', 'مرحبا 🔐\n']) {
        const encrypted = await encryptMessage(key, message, mode);
        const recovered = await decryptMessage(key, encrypted.envelope);
        expect(recovered.message).toBe(message);
        expect(recovered.utf8_hex).toBe(encrypted.utf8_hex);
        expect(encrypted.cipher_hex).toHaveLength(fixture.bits / 4);
      }
    const a = await encryptMessage(key, 'same', 'textbook'),
      b = await encryptMessage(key, 'same', 'textbook');
    expect(a.envelope).toBe(b.envelope);
    expect((await encryptMessage(key, 'same', 'oaep')).envelope).not.toBe(
      (await encryptMessage(key, 'same', 'oaep')).envelope,
    );
    const original = await encryptMessage(key, 'tamper', 'oaep'),
      env = parseEnvelope(original.envelope);
    if (env.kind !== 'oaep') throw new Error('Expected OAEP.');
    const changed = fromBase64(env.ciphertext);
    changed[0] ^= 1;
    await expect(
      decryptMessage(key, packEnvelope({ ...env, ciphertext: toBase64(changed) })),
    ).rejects.toThrow('Decryption failed.');
    const wrong = deriveKey(61n, 53n, 17n);
    await expect(decryptMessage(wrong, original.envelope)).rejects.toThrow('Decryption failed.');
    await expect(encryptMessage(key, 'a'.repeat(fixture.bits / 8 - 65), 'oaep')).rejects.toThrow(
      'accepts at most',
    );
  });
