import {
  createCipheriv,
  createPrivateKey,
  createPublicKey,
  constants,
  privateDecrypt,
  publicEncrypt,
  sign,
  verify,
} from 'node:crypto';
import { describe, expect, it } from 'vitest';
import fixtures from '../__vectors__/encoding-vectors.json';
import references from '../__vectors__/reference-vectors.json';
import { i2osp, inverse, modexp, os2ip } from '../math';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  equalBytes,
  fromBase64,
  fromHex,
  mgf1,
  oaepDecode,
  oaepEncode,
  pssEncode,
  pssVerify,
  sha256,
  toBase64,
  toHex,
  utf8,
} from './index';

const message = fromHex(fixtures.message),
  seed = fromHex(fixtures.seed),
  salt = fromHex(fixtures.salt);
function base64url(value: bigint) {
  return toBase64(i2osp(value, Math.ceil(value.toString(2).length / 8)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

describe('independent Python encoding fixtures', () => {
  it('matches SHA-256 and MGF1 across counter boundaries', async () => {
    expect(toHex(await sha256(message))).toBe(fixtures.sha256);
    expect(toHex(await mgf1(seed, 79))).toBe(fixtures.mgf1_79);
    expect(await mgf1(seed, 0)).toHaveLength(0);
    await expect(mgf1(seed, -1)).rejects.toThrow();
  });
  it('matches OAEP encodings and capacity boundaries', async () => {
    for (const v of fixtures.oaep) {
      const encoded = await oaepEncode(message, v.size, seed);
      expect(toHex(encoded)).toBe(v.encoded);
      expect(await oaepDecode(encoded)).toEqual(message);
      const boundary = new Uint8Array(v.size - 66);
      expect(await oaepDecode(await oaepEncode(boundary, v.size))).toEqual(boundary);
      expect(await oaepDecode(await oaepEncode(new Uint8Array(), v.size))).toHaveLength(0);
      await expect(oaepEncode(new Uint8Array(v.size - 65), v.size)).rejects.toThrow();
      for (const offset of [0, 1, 32, 33, encoded.length - 1]) {
        const changed = encoded.slice();
        changed[offset] ^= 1;
        await expect(oaepDecode(changed)).rejects.toThrow('Decryption failed.');
      }
    }
    await expect(oaepEncode(message, 128, new Uint8Array(31))).rejects.toThrow();
    await expect(oaepDecode(new Uint8Array(65))).rejects.toThrow();
  });
  it('matches PSS encodings including non-byte-aligned modulus sizes', async () => {
    for (const v of fixtures.pss) {
      const encoded = await pssEncode(message, v.bits, salt);
      expect(toHex(encoded)).toBe(v.encoded);
      expect(await pssVerify(message, encoded, v.bits)).toBe(true);
      expect(await pssVerify(utf8.encode('changed'), encoded, v.bits)).toBe(false);
      for (const offset of [0, 2, encoded.length - 2, encoded.length - 1]) {
        const changed = encoded.slice();
        changed[offset] ^= 1;
        expect(await pssVerify(message, changed, v.bits)).toBe(false);
      }
      expect(await pssVerify(message, encoded.slice(1), v.bits)).toBe(false);
    }
    await expect(pssEncode(message, 64)).rejects.toThrow();
    await expect(pssEncode(message, 1024, new Uint8Array(31))).rejects.toThrow();
  });
});

describe('independent OpenSSL RSA interoperability', () => {
  for (const v of references.keys)
    it(`OAEP and PSS agree both ways at ${v.bits} bits`, async () => {
      const p = BigInt(v.p),
        q = BigInt(v.q),
        n = BigInt(v.n),
        e = BigInt(v.e),
        d = BigInt(v.d);
      const key = createPrivateKey({
        format: 'jwk',
        key: {
          kty: 'RSA',
          n: base64url(n),
          e: base64url(e),
          d: base64url(d),
          p: base64url(p),
          q: base64url(q),
          dp: base64url(d % (p - 1n)),
          dq: base64url(d % (q - 1n)),
          qi: base64url(inverse(q, p)),
        },
      });
      const publicKey = createPublicKey(key),
        width = v.bits / 8;
      const encoded = await oaepEncode(message, width);
      const cipher = i2osp(modexp(os2ip(encoded), e, n), width);
      expect(
        new Uint8Array(
          privateDecrypt(
            { key, oaepHash: 'sha256', padding: constants.RSA_PKCS1_OAEP_PADDING },
            cipher,
          ),
        ),
      ).toEqual(message);
      const theirCipher = publicEncrypt(
        { key: publicKey, oaepHash: 'sha256', padding: constants.RSA_PKCS1_OAEP_PADDING },
        message,
      );
      expect(await oaepDecode(i2osp(modexp(os2ip(theirCipher), d, n), width))).toEqual(message);
      const pss = await pssEncode(message, v.bits),
        signature = i2osp(modexp(os2ip(pss), d, n), width);
      expect(
        verify(
          'sha256',
          message,
          { key: publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
          signature,
        ),
      ).toBe(true);
      const theirSignature = sign('sha256', message, {
        key,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32,
      });
      expect(
        await pssVerify(message, i2osp(modexp(os2ip(theirSignature), e, n), width), v.bits),
      ).toBe(true);
      const fixed = i2osp(modexp(os2ip(fromHex(v.pss_signature_hex)), e, n), width);
      expect(await pssVerify(fromHex(v.message_hex), fixed, v.bits)).toBe(true);
    });
});

it('AES-256-GCM agrees with OpenSSL and rejects altered AAD, nonce, data and tag', async () => {
  const key = seed,
    nonce = seed.slice(0, 12),
    aad = utf8.encode('metadata');
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aad);
  const expected = Buffer.concat([cipher.update(message), cipher.final(), cipher.getAuthTag()]);
  const encrypted = await aesGcmEncrypt(message, key, nonce, aad);
  expect(encrypted).toEqual(new Uint8Array(expected));
  expect(await aesGcmDecrypt(encrypted, key, nonce, aad)).toEqual(message);
  for (const offset of [0, encrypted.length - 1]) {
    const changed = encrypted.slice();
    changed[offset] ^= 1;
    await expect(aesGcmDecrypt(changed, key, nonce, aad)).rejects.toThrow('Decryption failed.');
  }
  await expect(aesGcmDecrypt(encrypted, key, nonce, utf8.encode('wrong'))).rejects.toThrow();
  await expect(
    aesGcmDecrypt(
      encrypted,
      key,
      nonce.map((x) => x ^ 1),
      aad,
    ),
  ).rejects.toThrow();
  await expect(aesGcmEncrypt(message, new Uint8Array(31), nonce, aad)).rejects.toThrow();
  expect(equalBytes(fromBase64(toBase64(message)), message)).toBe(true);
});
