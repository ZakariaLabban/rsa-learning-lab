import { describe, expect, it } from 'vitest';
import refs from '../../engine/__vectors__/reference-vectors.json';
import { deriveKey } from '../../engine/math';
import {
  fromBase64,
  MAX_FILE_BYTES,
  packEnvelope,
  parseEnvelope,
  toBase64,
  utf8,
  type HybridEnvelope,
} from '../../engine/encoding';
import { checkFileSize, downloadName, FILE_FAILURE, runFileJob } from './model';

const keys = refs.keys.map((k) => deriveKey(BigInt(k.p), BigInt(k.q), BigInt(k.e)));
async function seal(bytes: Uint8Array, name = 'document.pdf') {
  const result = await runFileJob({
    type: 'seal',
    key: keys[1],
    bytes,
    file: { name, type: 'application/pdf', size: bytes.length },
  });
  if (result.type !== 'sealed') throw new Error();
  return result;
}
describe('file envelopes', () => {
  it('recovers empty, PDF-like, image and Unicode text bytes exactly and records computation times', async () => {
    for (const data of [
      new Uint8Array(),
      utf8.encode('%PDF-1.7\nDemo'),
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255]),
      utf8.encode('\ufeffمرحبا 🔐'),
    ]) {
      const sealed = await seal(data);
      const opened = await runFileJob({
        type: 'open',
        envelope: sealed.envelope,
        keys: [keys[0], keys[1]],
        senders: [],
      });
      expect(opened).toMatchObject({
        type: 'opened',
        bytes: data,
        file: { name: 'document.pdf' },
        signature: { status: 'unsigned' },
      });
      expect(sealed.elapsedMs).toBeGreaterThanOrEqual(sealed.aesMs + sealed.rsaMs);
      expect(sealed.rsaOnlyEstimateMs).toBeGreaterThanOrEqual(0);
    }
  });
  it('rejects protected ciphertext, tag, wrap, nonce and metadata edits with the same error, including a wrong key', async () => {
    const sealed = await seal(utf8.encode('file contents'));
    const source = parseEnvelope(sealed.envelope) as HybridEnvelope;
    for (const field of [
      'ciphertext',
      'tag',
      'wrappedKey',
      'nonce',
      'name',
      'type',
      'size',
      'recipient',
    ] as const) {
      const changed = structuredClone(source);
      if (field === 'name') changed.file!.name = 'altered.pdf';
      else if (field === 'type') changed.file!.type = 'text/plain';
      else if (field === 'size') changed.file!.size++;
      else if (field === 'recipient') changed.recipient = 'a'.repeat(64);
      else {
        const prop = field === 'tag' ? 'ciphertext' : field;
        const data = fromBase64(changed[prop]);
        data[field === 'tag' ? data.length - 1 : 0] ^= 1;
        changed[prop] = toBase64(data);
      }
      await expect(
        runFileJob({ type: 'open', envelope: packEnvelope(changed), keys: [keys[1]], senders: [] }),
      ).rejects.toThrow(FILE_FAILURE);
    }
    await expect(
      runFileJob({ type: 'open', envelope: sealed.envelope, keys: [keys[0]], senders: [] }),
    ).rejects.toThrow(FILE_FAILURE);
    await expect(
      runFileJob({ type: 'open', envelope: 'rsa-lab.v2:invalid', keys: [], senders: [] }),
    ).rejects.toThrow('Invalid ciphertext envelope');
  });
  it('round-trips the full 25 MiB boundary (including the base64-expanded encrypted payload)', async () => {
    const data = new Uint8Array(MAX_FILE_BYTES);
    data[0] = 137;
    data[data.length - 1] = 255;
    const sealed = await seal(data);
    const opened = await runFileJob({
      type: 'open',
      envelope: sealed.envelope,
      keys: [keys[1]],
      senders: [],
    });
    if (opened.type !== 'opened') throw new Error();
    expect(opened.bytes.length).toBe(data.length);
    // Avoid constructing millions of assertion entries for a full binary comparison.
    expect(Buffer.compare(Buffer.from(opened.bytes), Buffer.from(data))).toBe(0);
    expect(() => checkFileSize(MAX_FILE_BYTES + 1)).toThrow('25 MiB');
  }, 120000);
  it('normalizes untrusted filenames and rejects sizes before processing', () => {
    expect(downloadName('../../evil.txt')).toBe('evil.txt');
    expect(downloadName('CON.txt')).toBe('download.bin');
    expect(downloadName('photo\u202egnp.exe')).toBe('photo_gnp.exe');
    expect(downloadName('file?.txt. ')).toBe('file_.txt');
    expect(downloadName('..')).toBe('download.bin');
    for (const size of [-1, NaN, Infinity, MAX_FILE_BYTES + 1])
      expect(() => checkFileSize(size)).toThrow();
  });
});
