import { constants, createDecipheriv, createPrivateKey, privateDecrypt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import references from '../__vectors__/reference-vectors.json';
import { deriveKey, i2osp, inverse, type PrivateKey } from '../math';
import {
  aesGcmEncrypt,
  fingerprint,
  fromBase64,
  hybridAad,
  packEnvelope,
  parseEnvelope,
  parsePayload,
  payloadBytes,
  signingBytes,
  toBase64,
  utf8,
  type HybridEnvelope,
  type InnerPayload,
} from '../encoding';
import { oaepEncrypt, openEnvelope, openHybrid, pssSign, sealBasic, sealHybrid } from './index';

const keys = references.keys.map((v) => deriveKey(BigInt(v.p), BigInt(v.q), BigInt(v.e)));
const [small, large] = keys;
const toy = deriveKey(61n, 53n, 17n);
const known = async (key: PrivateKey, name: string) => ({
  fingerprint: await fingerprint(key),
  key: { n: key.n, e: key.e },
  name,
});
const hybridOf = (envelope: string) => parseEnvelope(envelope) as HybridEnvelope;

describe('hybrid encryption', () => {
  it('round-trips empty, Unicode and binary file data at 1024 and 2048 bits', async () => {
    for (const key of keys) {
      for (const data of [new Uint8Array(), utf8.encode('مرحبا 🔐 '.repeat(200))]) {
        const sealed = await sealHybrid({ n: key.n, e: key.e }, { type: 'text', data });
        const opened = await openEnvelope(sealed.envelope, [toy, key]);
        expect(opened.kind).toBe('hybrid');
        expect(opened.bytes).toEqual(data);
        expect(opened.kind === 'hybrid' && opened.signature).toEqual({ status: 'unsigned' });
      }
      const binary = Uint8Array.from({ length: 70000 }, (_, i) => (i * 31) % 256);
      const file = { name: 'photo.png', type: 'image/png', size: binary.length };
      const sealed = await sealHybrid(key, { type: 'file', data: binary, file });
      const opened = await openHybrid(hybridOf(sealed.envelope), [key]);
      expect(opened).toMatchObject({ type: 'file', file });
      expect(opened.bytes).toEqual(binary);
    }
  });
  it('is randomized and requires assignment-size keys', async () => {
    const data = utf8.encode('same');
    const a = await sealHybrid(small, { type: 'text', data });
    const b = await sealHybrid(small, { type: 'text', data });
    expect(a.envelope).not.toBe(b.envelope);
    expect(a.aesKey).not.toEqual(b.aesKey);
    await expect(sealHybrid(toy, { type: 'text', data })).rejects.toThrow(
      '1024/2048-bit recipient',
    );
    await expect(sealHybrid(small, { type: 'text', data }, toy)).rejects.toThrow('PSS signatures');
  });
  it('is readable by OpenSSL: unwrap with RSA-OAEP, decrypt with AES-256-GCM and the AAD', async () => {
    const v = references.keys[1];
    const b64url = (x: bigint) =>
      Buffer.from(i2osp(x, Math.ceil(x.toString(2).length / 8))).toString('base64url');
    const p = BigInt(v.p),
      q = BigInt(v.q),
      d = large.d;
    const openssl = createPrivateKey({
      format: 'jwk',
      key: {
        kty: 'RSA',
        n: b64url(large.n),
        e: b64url(large.e),
        d: b64url(d),
        p: b64url(p),
        q: b64url(q),
        dp: b64url(d % (p - 1n)),
        dq: b64url(d % (q - 1n)),
        qi: b64url(inverse(q, p)),
      },
    });
    const message = utf8.encode('Hybrid, checked by OpenSSL');
    const value = hybridOf((await sealHybrid(large, { type: 'text', data: message })).envelope);
    const aesKey = privateDecrypt(
      { key: openssl, oaepHash: 'sha256', padding: constants.RSA_PKCS1_OAEP_PADDING },
      fromBase64(value.wrappedKey),
    );
    const ciphertext = fromBase64(value.ciphertext);
    const decipher = createDecipheriv('aes-256-gcm', aesKey, fromBase64(value.nonce));
    decipher.setAAD(hybridAad(value));
    decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
    const plain = Buffer.concat([
      decipher.update(ciphertext.subarray(0, ciphertext.length - 16)),
      decipher.final(),
    ]);
    expect(fromBase64(parsePayload(new Uint8Array(plain)).data)).toEqual(message);
  });
});

describe('sign then encrypt', () => {
  it('reports valid, unknown-sender and unsigned results separately', async () => {
    const data = utf8.encode('Signed by Alice, for Bob');
    const sealed = await sealHybrid(large, { type: 'text', data }, small);
    expect(sealed.signature?.value).toHaveLength(128);
    const alice = await known(small, 'Alice');
    const opened = await openHybrid(hybridOf(sealed.envelope), [large], [alice]);
    expect(opened.bytes).toEqual(data);
    expect(opened.signature).toEqual({ status: 'valid', sender: alice.fingerprint, name: 'Alice' });
    const stranger = await openHybrid(hybridOf(sealed.envelope), [large], []);
    expect(stranger.signature).toEqual({ status: 'unknown-sender', sender: alice.fingerprint });
  });
  it('reports an invalid signature when the signed content does not match', async () => {
    // Build a hybrid envelope whose inner signature covers different data.
    const sender = await fingerprint(small);
    const payload: InnerPayload = { v: 2, type: 'text', data: toBase64(utf8.encode('pay 10')) };
    const forged = await pssSign(
      small,
      signingBytes({ v: 2, type: 'text', data: toBase64(utf8.encode('pay 1000')) }, sender),
    );
    payload.signature = { algorithm: 'RSA-PSS-SHA256', sender, value: toBase64(forged) };
    const aesKey = new Uint8Array(32).fill(9),
      nonce = new Uint8Array(12).fill(4);
    const header = {
      v: 2 as const,
      recipient: await fingerprint(large),
      bits: 2048,
      kind: 'hybrid' as const,
      wrappedKey: toBase64(await oaepEncrypt(large, aesKey)),
      nonce: toBase64(nonce),
      contentType: 'text' as const,
    };
    const ciphertext = await aesGcmEncrypt(payloadBytes(payload), aesKey, nonce, hybridAad(header));
    const envelope = packEnvelope({ ...header, ciphertext: toBase64(ciphertext) });
    const opened = await openHybrid(
      parseEnvelope(envelope) as HybridEnvelope,
      [large],
      [await known(small, 'Alice')],
    );
    expect(opened.signature).toMatchObject({ status: 'invalid', name: 'Alice' });
    // A known name attached to the wrong public key is also invalid, never "valid".
    const sealed = await sealHybrid(large, { type: 'text', data: utf8.encode('hi') }, small);
    const wrongKey = { ...(await known(small, 'Alice')), key: { n: large.n, e: large.e } };
    const result = await openHybrid(hybridOf(sealed.envelope), [large], [wrongKey]);
    expect(result.signature.status).toBe('invalid');
  });
});

describe('tampering and wrong keys', () => {
  it('fails without plaintext for any altered field', async () => {
    const file = { name: 'a.txt', type: 'text/plain', size: 5 };
    const sealed = await sealHybrid(
      large,
      { type: 'file', data: utf8.encode('hello'), file },
      small,
    );
    const value = hybridOf(sealed.envelope);
    const flip = (b64: string, at: number) => {
      const bytes = fromBase64(b64);
      bytes[at < 0 ? bytes.length + at : at] ^= 1;
      return toBase64(bytes);
    };
    const altered: HybridEnvelope[] = [
      { ...value, wrappedKey: flip(value.wrappedKey, 7) },
      { ...value, nonce: flip(value.nonce, 0) },
      { ...value, ciphertext: flip(value.ciphertext, 3) },
      { ...value, ciphertext: flip(value.ciphertext, -1) }, // the GCM tag
      { ...value, file: { ...file, name: 'b.txt' } },
      { ...value, contentType: 'text', file: undefined } as unknown as HybridEnvelope,
    ];
    for (const bad of altered) {
      const text = (() => {
        try {
          return packEnvelope(bad);
        } catch {
          return null;
        }
      })();
      if (text === null) continue; // rejected by strict parsing already
      await expect(openEnvelope(text, [large])).rejects.toThrow('Decryption failed.');
    }
  });
  it('needs the matching private key and keeps basic envelopes working', async () => {
    const sealed = await sealHybrid(large, { type: 'text', data: utf8.encode('x') });
    await expect(openEnvelope(sealed.envelope, [small, toy])).rejects.toThrow('None of your');
    const basic = await sealBasic(small, utf8.encode('still basic'), 'oaep');
    const opened = await openEnvelope(basic.envelope, [small]);
    expect(opened.kind).toBe('basic');
    expect(opened.bytes).toEqual(utf8.encode('still basic'));
  });
});
