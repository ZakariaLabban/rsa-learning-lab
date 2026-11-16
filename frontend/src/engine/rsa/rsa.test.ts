import { describe, expect, it } from 'vitest';
import references from '../__vectors__/reference-vectors.json';
import { deriveKey, type PrivateKey } from '../math';
import {
  fingerprint,
  fromBase64,
  fromHex,
  packEnvelope,
  parseEnvelope,
  toBase64,
  utf8,
} from '../encoding';
import {
  capabilities,
  oaepDecrypt,
  oaepEncrypt,
  openBasic,
  pssSign,
  pssVerifySignature,
  sealBasic,
  selectPrivateKey,
  teachingSign,
  teachingVerify,
  textbookDecryptBytes,
  textbookDecryptNumber,
  textbookEncryptBytes,
  textbookEncryptNumber,
} from './index';

const lecture = deriveKey(17n, 11n, 7n); // n = 187: the Ch 9 example, number-only
const toy = deriveKey(61n, 53n, 17n); // n = 3233: 1-byte textbook blocks
const fixtures = references.keys.map((v) => ({
  v,
  key: deriveKey(BigInt(v.p), BigInt(v.q), BigInt(v.e)),
}));
const publicOnly = (key: PrivateKey) => ({ n: key.n, e: key.e });

describe('capabilities', () => {
  it('classifies teaching keys', () => {
    expect(capabilities(lecture)).toMatchObject({
      keyClass: 'teaching',
      bits: 8,
      textbookText: false,
      oaep: false,
      pss: false,
      teachingSignature: true,
      hybrid: false,
    });
    expect(capabilities(toy)).toMatchObject({
      bits: 12,
      textbookText: true,
      textbookBlockBytes: 1,
    });
  });
  it('classifies assignment keys and rejects other sizes', () => {
    for (const { v, key } of fixtures)
      expect(capabilities(key)).toMatchObject({
        keyClass: 'assignment',
        bits: v.bits,
        oaep: true,
        oaepMaxBytes: v.bits / 8 - 66,
        pss: true,
        teachingSignature: false,
        hybrid: true,
      });
    expect(() => capabilities({ n: (1n << 511n) + 1n, e: 65537n })).toThrow('Unsupported key size');
    expect(() => capabilities({ n: 187n, e: 187n })).toThrow('Invalid public key');
  });
});

describe('textbook RSA', () => {
  it('reproduces the lecture example and the Python textbook vectors', () => {
    expect(textbookEncryptNumber(lecture, 88n)).toBe(11n);
    expect(textbookDecryptNumber(lecture, 11n)).toBe(88n);
    for (const { v, key } of fixtures)
      for (const t of v.textbook) {
        expect(textbookEncryptNumber(publicOnly(key), BigInt(t.message))).toBe(
          BigInt(t.ciphertext),
        );
        expect(textbookDecryptNumber(key, BigInt(t.ciphertext))).toBe(BigInt(t.message));
      }
    expect(() => textbookEncryptNumber(lecture, 187n)).toThrow('between 0 and n-1');
  });
  it('splits text into blocks smaller than n and restores exact bytes', () => {
    const text = utf8.encode('\0Hi مرحبا 🔐');
    const blocks = textbookEncryptBytes(toy, text);
    expect(blocks).toHaveLength(text.length);
    expect(textbookDecryptBytes(toy, blocks, text.length)).toEqual(text);
    expect(textbookEncryptBytes(toy, new Uint8Array())).toHaveLength(1);
    expect(textbookDecryptBytes(toy, textbookEncryptBytes(toy, new Uint8Array()), 0)).toHaveLength(
      0,
    );
    for (const { v, key } of fixtures) {
      const long = utf8.encode('x'.repeat(3 * (v.bits / 8 - 1) + 5));
      const many = textbookEncryptBytes(publicOnly(key), long);
      expect(many).toHaveLength(4);
      expect(textbookDecryptBytes(key, many, long.length)).toEqual(long);
      expect(() => textbookDecryptBytes(key, many, long.length + v.bits / 8)).toThrow(
        'block count',
      );
    }
    expect(() => textbookEncryptBytes(lecture, utf8.encode('A'))).toThrow('number mode');
  });
});

describe('RSAES-OAEP', () => {
  it('decrypts the independent cryptography-library ciphertexts', async () => {
    for (const { v, key } of fixtures)
      expect(await oaepDecrypt(key, fromHex(v.oaep_ciphertext_hex))).toEqual(
        fromHex(v.message_hex),
      );
  });
  it('round-trips at the capacity boundary and fails cleanly otherwise', async () => {
    for (const { v, key } of fixtures) {
      const max = new Uint8Array(v.bits / 8 - 66).fill(7);
      const cipher = await oaepEncrypt(publicOnly(key), max);
      expect(await oaepDecrypt(key, cipher)).toEqual(max);
      await expect(oaepEncrypt(key, new Uint8Array(max.length + 1))).rejects.toThrow('at most');
      const changed = cipher.slice();
      changed[changed.length - 1] ^= 1;
      await expect(oaepDecrypt(key, changed)).rejects.toThrow('Decryption failed.');
      await expect(oaepDecrypt(key, cipher.subarray(1))).rejects.toThrow('Decryption failed.');
    }
    const [small, large] = fixtures;
    const cipher = await oaepEncrypt(small.key, utf8.encode('wrong key'));
    await expect(oaepDecrypt(large.key, cipher)).rejects.toThrow('Decryption failed.');
    await expect(oaepEncrypt(toy, utf8.encode('x'))).rejects.toThrow('1024/2048');
  });
});

describe('RSASSA-PSS', () => {
  it('verifies the independent cryptography-library signatures', async () => {
    for (const { v, key } of fixtures)
      expect(
        await pssVerifySignature(
          publicOnly(key),
          fromHex(v.message_hex),
          fromHex(v.pss_signature_hex),
        ),
      ).toBe(true);
  });
  it('signs and rejects altered messages, signatures and keys', async () => {
    const message = utf8.encode('Signed by Alice');
    for (const { key } of fixtures) {
      const signature = await pssSign(key, message);
      expect(await pssVerifySignature(key, message, signature)).toBe(true);
      expect(await pssVerifySignature(key, utf8.encode('Signed by Eve'), signature)).toBe(false);
      const changed = signature.slice();
      changed[10] ^= 1;
      expect(await pssVerifySignature(key, message, changed)).toBe(false);
      expect(await pssVerifySignature(key, message, signature.subarray(1))).toBe(false);
      expect(
        await pssVerifySignature(key, message, new Uint8Array(signature.length).fill(255)),
      ).toBe(false);
    }
    const [small, large] = fixtures;
    const signature = await pssSign(small.key, message);
    expect(await pssVerifySignature(large.key, message, signature)).toBe(false);
    await expect(pssSign(toy, message)).rejects.toThrow('1024/2048');
  });
});

describe('teaching signature (insecure, tiny keys only)', () => {
  it('signs the hash mod n and verifies with e', async () => {
    const message = utf8.encode('Pay Bob 10');
    const signed = await teachingSign(lecture, message);
    expect(signed.digest).toBeLessThan(lecture.n);
    expect((await teachingVerify(lecture, message, signed.signature)).valid).toBe(true);
    expect(
      (await teachingVerify(lecture, message, (signed.signature + 1n) % lecture.n)).valid,
    ).toBe(false);
    expect((await teachingVerify(lecture, message, 187n)).valid).toBe(false);
    await expect(teachingSign(fixtures[0].key, message)).rejects.toThrow('teaching keys');
  });
  it('shows the limitation: different messages can share a tiny digest', async () => {
    const seen = new Map<bigint, string>();
    let collision: [string, string] | undefined;
    for (let i = 0; !collision; i++) {
      const text = `message ${i}`,
        { digest } = await teachingSign(lecture, utf8.encode(text));
      const earlier = seen.get(digest);
      if (earlier) collision = [earlier, text];
      seen.set(digest, text);
    }
    const original = await teachingSign(lecture, utf8.encode(collision[0]));
    expect(
      (await teachingVerify(lecture, utf8.encode(collision[1]), original.signature)).valid,
    ).toBe(true);
  });
});

describe('basic v2 envelopes', () => {
  it('seals with a public key and opens with the matching private key', async () => {
    const [small, large] = fixtures;
    for (const mode of ['textbook', 'oaep'] as const) {
      const message = utf8.encode(`Envelope ${mode} مرحبا`);
      const sealed = await sealBasic(publicOnly(large.key), message, mode);
      const opened = await openBasic(sealed.envelope, [toy, small.key, large.key]);
      expect(opened.bytes).toEqual(message);
      expect(opened.mode).toBe(mode);
      expect(opened.key).toBe(large.key);
      expect(await selectPrivateKey(parseEnvelope(sealed.envelope), [large.key])).toBe(large.key);
      await expect(openBasic(sealed.envelope, [small.key, toy])).rejects.toThrow('None of your');
    }
    const teaching = await sealBasic(toy, utf8.encode('toy'), 'textbook');
    expect((await openBasic(teaching.envelope, [toy])).bytes).toEqual(utf8.encode('toy'));
    await expect(sealBasic(toy, utf8.encode('toy'), 'oaep')).rejects.toThrow('1024/2048');
  });
  it('rejects tampered, foreign and unsupported envelopes', async () => {
    const { key } = fixtures[0];
    const sealed = await sealBasic(key, utf8.encode('tamper'), 'oaep');
    if (sealed.value.kind !== 'oaep') throw new Error('Expected OAEP.');
    const changed = fromBase64(sealed.value.ciphertext);
    changed[5] ^= 1;
    await expect(
      openBasic(packEnvelope({ ...sealed.value, ciphertext: toBase64(changed) }), [key]),
    ).rejects.toThrow('Decryption failed.');
    await expect(openBasic('rsa-lab.v1:abc', [key])).rejects.toThrow('Legacy v1');
    await expect(openBasic('rsa-lab.v2:not-json', [key])).rejects.toThrow('Invalid');
    const hybrid = {
      v: 2 as const,
      recipient: await fingerprint(key),
      bits: 1024,
      kind: 'hybrid' as const,
      wrappedKey: toBase64(new Uint8Array(128)),
      nonce: toBase64(new Uint8Array(12)),
      ciphertext: toBase64(new Uint8Array(16)),
      contentType: 'text' as const,
    };
    await expect(openBasic(packEnvelope(hybrid), [key])).rejects.toThrow('#44');
  });
});
