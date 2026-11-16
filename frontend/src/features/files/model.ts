import {
  MAX_ENVELOPE_CHARS,
  MAX_FILE_BYTES,
  parseEnvelope,
  type FileMetadata,
} from '../../engine/encoding';
import {
  capabilities,
  openHybrid,
  sealHybrid,
  type KnownSender,
  type SignatureResult,
} from '../../engine/rsa';
import type { PrivateKey, PublicKey } from '../../engine/math';

export const FILE_FAILURE = 'Decryption failed. Check the key and ciphertext.';

/** Names are untrusted even after authentication: never use paths, devices or bidi controls. */
export function downloadName(name: string): string {
  const leaf = name.split(/[\\/]/).pop() ?? '';
  const cleaned = leaf
    .replace(/[<>:"|?*\u202a-\u202e\u2066-\u2069]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 180);
  return !cleaned ||
    /^\.+$/.test(cleaned) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(cleaned)
    ? 'download.bin'
    : Array.from(cleaned, (char) =>
        char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '_' : char,
      ).join('');
}

export function checkFileSize(size: number) {
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_FILE_BYTES)
    throw new Error('Choose a file of at most 25 MiB.');
}

export type FileJob =
  | { type: 'seal'; key: PublicKey; bytes: Uint8Array; file: FileMetadata; signer?: PrivateKey }
  | { type: 'open'; envelope: string; keys: PrivateKey[]; senders: KnownSender[] };
export type FileResult =
  | {
      type: 'sealed';
      envelope: string;
      size: number;
      elapsedMs: number;
      rsaMs: number;
      aesMs: number;
      rsaOnlyEstimateMs: number;
    }
  | {
      type: 'opened';
      bytes: Uint8Array;
      file: FileMetadata;
      signature: SignatureResult;
      elapsedMs: number;
    };

export async function runFileJob(job: FileJob): Promise<FileResult> {
  const start = performance.now();
  if (job.type === 'seal') {
    checkFileSize(job.bytes.length);
    if (job.file.size !== job.bytes.length) throw new Error('File size mismatch.');
    const caps = capabilities(job.key);
    const result = await sealHybrid(
      job.key,
      { type: 'file', data: job.bytes, file: job.file },
      job.signer,
    );
    return {
      type: 'sealed',
      envelope: result.envelope,
      size: job.bytes.length,
      elapsedMs: performance.now() - start,
      rsaMs: result.timings.rsaMs,
      aesMs: result.timings.aesMs,
      rsaOnlyEstimateMs: Math.ceil(job.bytes.length / caps.oaepMaxBytes) * result.timings.rsaMs,
    };
  }
  if (job.envelope.length > MAX_ENVELOPE_CHARS) throw new Error('The envelope file is too large.');
  // Format errors remain explicit. Authenticated-field changes share one decryption error.
  const value = parseEnvelope(job.envelope.trim());
  if (value.kind !== 'hybrid' || value.contentType !== 'file')
    throw new Error('Choose a hybrid file envelope, not a text message.');
  try {
    const result = await openHybrid(value, job.keys, job.senders);
    if (!result.file) throw new Error();
    return {
      type: 'opened',
      bytes: result.bytes,
      file: { ...result.file, name: downloadName(result.file.name) },
      signature: result.signature,
      elapsedMs: performance.now() - start,
    };
  } catch {
    throw new Error(FILE_FAILURE);
  }
}
