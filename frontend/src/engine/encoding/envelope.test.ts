import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  concat,
  fingerprint,
  fromBase64,
  groupFingerprint,
  hybridAad,
  packEnvelope,
  parseEnvelope,
  parsePayload,
  payloadBytes,
  signingBytes,
  toBase64,
  uint32,
  utf8,
  type HybridEnvelope,
  type InnerPayload,
} from './index';

const recipient = 'a'.repeat(64),
  block = toBase64(new Uint8Array(128));
const header = { v: 2 as const, recipient, bits: 1024 };

it('base64 handles large file buffers without recursive regex or character-array expansion', () => {
  const bytes = new Uint8Array(1024 * 1024 + 1);
  bytes[bytes.length - 1] = 93;
  const result = fromBase64(toBase64(bytes));
  expect(result.length).toBe(bytes.length);
  expect(result[result.length - 1]).toBe(93);
});
it('fingerprints include version, lengths, n and e with canonical unsigned bytes', async () => {
  const encoded = concat(
    utf8.encode('rsa-lab.key.v2\0'),
    uint32(1),
    new Uint8Array([187]),
    uint32(1),
    new Uint8Array([7]),
  );
  const result = await fingerprint({ n: 187n, e: 7n });
  expect(result).toBe(createHash('sha256').update(encoded).digest('hex'));
  expect(await fingerprint({ n: 187n, e: 3n })).not.toBe(result);
  expect(groupFingerprint(result).replaceAll(' ', '')).toBe(result);
});
it('round-trips every envelope kind and preserves byte length', () => {
  for (const value of [
    { ...header, kind: 'oaep' as const, ciphertext: block },
    { ...header, kind: 'textbook-blocks' as const, blocks: [block], byteLength: 0 },
    {
      ...header,
      kind: 'hybrid' as const,
      wrappedKey: block,
      nonce: toBase64(new Uint8Array(12)),
      ciphertext: toBase64(new Uint8Array(16)),
      contentType: 'file' as const,
      file: { name: 'example.pdf', type: 'application/pdf', size: 0 },
    },
  ])
    expect(parseEnvelope(packEnvelope(value))).toEqual(value);
});
it('rejects legacy versions, extra fields, bad sizes, noncanonical encoding and duplicate JSON keys', () => {
  expect(() => parseEnvelope('rsa-lab.v1:abc')).toThrow('Legacy v1');
  const bad = [
    { ...header, kind: 'oaep', ciphertext: block, privateKey: 'secret' },
    { ...header, kind: 'oaep', ciphertext: 'AAAA' },
    { ...header, kind: 'oaep', ciphertext: block, bits: 512 },
    { ...header, kind: 'textbook-blocks', blocks: [block], byteLength: 128 },
  ];
  for (const value of bad)
    expect(() =>
      parseEnvelope('rsa-lab.v2:' + toBase64(utf8.encode(JSON.stringify(value)))),
    ).toThrow();
  const packed = packEnvelope({ ...header, kind: 'oaep', ciphertext: block });
  const json = new TextDecoder().decode(fromBase64(packed.slice('rsa-lab.v2:'.length)));
  expect(() =>
    parseEnvelope('rsa-lab.v2:' + toBase64(utf8.encode(json.replace('"v":2', '"v":1,"v":2')))),
  ).toThrow();
  expect(() => fromBase64('AB==')).toThrow();
  expect(() => fromBase64('AA=')).toThrow();
});
it('canonical signed payload bytes bind sender and file metadata, and hybrid AAD binds headers', () => {
  const payload: InnerPayload = {
    v: 2,
    type: 'file',
    data: toBase64(new Uint8Array([1, 2])),
    file: { name: 'note.txt', type: 'text/plain', size: 2 },
  };
  expect(parsePayload(payloadBytes(payload))).toEqual(payload);
  expect(signingBytes(payload, recipient)).not.toEqual(signingBytes(payload, 'b'.repeat(64)));
  expect(() => payloadBytes({ ...payload, file: { ...payload.file!, size: 3 } })).toThrow();
  const value: HybridEnvelope = {
    ...header,
    kind: 'hybrid',
    wrappedKey: block,
    nonce: toBase64(new Uint8Array(12)),
    ciphertext: toBase64(new Uint8Array(16)),
    contentType: 'file',
    file: payload.file,
  };
  expect(hybridAad(value)).not.toEqual(
    hybridAad({ ...value, file: { ...payload.file!, name: 'other.txt' } }),
  );
});
