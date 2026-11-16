import { concat, fromBase64, toBase64, utf8 } from './bytes';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_ENVELOPE_CHARS = 64 * 1024 * 1024;
const PREFIX = 'rsa-lab.v2:';
type Base = { v: 2; kind: 'textbook-blocks' | 'oaep' | 'hybrid'; recipient: string; bits: number };
export type FileMetadata = { name: string; type: string; size: number };
export type TextbookEnvelope = Base & {
  kind: 'textbook-blocks';
  blocks: string[];
  byteLength: number;
};
export type OaepEnvelope = Base & { kind: 'oaep'; ciphertext: string };
export type HybridEnvelope = Base & {
  kind: 'hybrid';
  wrappedKey: string;
  nonce: string;
  ciphertext: string;
  contentType: 'text' | 'file';
  file?: FileMetadata;
};
export type EnvelopeV2 = TextbookEnvelope | OaepEnvelope | HybridEnvelope;
export type InnerPayload = {
  v: 2;
  type: 'text' | 'file';
  data: string;
  file?: FileMetadata;
  signature?: { algorithm: 'RSA-PSS-SHA256'; sender: string; value: string };
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  if (
    required.some((key) => !(key in value)) ||
    Object.keys(value).some((key) => ![...required, ...optional].includes(key))
  )
    throw new Error('Missing or unsupported fields.');
}
function integer(value: unknown, minimum: number, maximum: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  )
    throw new Error('Invalid integer or size.');
  return value;
}
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum)
    throw new Error('Invalid string or size.');
  return value;
}
function fp(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value))
    throw new Error('Invalid fingerprint.');
  return value;
}
function encoded(value: unknown, minimum: number, maximum: number): string {
  const result = text(value, 4 * Math.ceil(maximum / 3));
  const bytes = fromBase64(result, maximum);
  if (bytes.length < minimum) throw new Error('Encoded value has the wrong length.');
  return result;
}
function metadata(value: unknown): FileMetadata {
  const source = record(value);
  fields(source, ['name', 'type', 'size']);
  const name = text(source.name, 255),
    type = text(source.type, 255);
  const hasControl = (value: string) =>
    Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
  if (!name || name.includes('/') || name.includes('\\') || hasControl(name) || hasControl(type))
    throw new Error('Invalid file metadata.');
  return { name, type, size: integer(source.size, 0, MAX_FILE_BYTES) };
}
export function validateEnvelope(value: unknown): EnvelopeV2 {
  const source = record(value);
  if (source.v !== 2) throw new Error('Unsupported envelope version.');
  const bits = integer(source.bits, 4, 2048);
  if (bits > 64 && bits !== 1024 && bits !== 2048) throw new Error('Unsupported key size.');
  const base = { v: 2 as const, recipient: fp(source.recipient), bits };
  const width = Math.ceil(bits / 8),
    common = ['v', 'kind', 'recipient', 'bits'];
  if (source.kind === 'textbook-blocks') {
    fields(source, [...common, 'blocks', 'byteLength']);
    if (!Array.isArray(source.blocks) || source.blocks.length < 1 || source.blocks.length > 4096)
      throw new Error('Invalid block count.');
    const blocks = source.blocks.map((block) => encoded(block, width, width));
    const byteLength = integer(source.byteLength, 0, MAX_FILE_BYTES);
    // Blocks are canonical chunks of width-1 bytes; the final chunk can be shorter.
    const capacity = width - 1;
    if (capacity < 1 || blocks.length !== Math.max(1, Math.ceil(byteLength / capacity)))
      throw new Error('Inconsistent textbook block lengths.');
    return { ...base, kind: 'textbook-blocks', blocks, byteLength };
  }
  if (bits < 1024) throw new Error('This mode requires an assignment-size key.');
  if (source.kind === 'oaep') {
    fields(source, [...common, 'ciphertext']);
    return { ...base, kind: 'oaep', ciphertext: encoded(source.ciphertext, width, width) };
  }
  if (source.kind === 'hybrid') {
    fields(source, [...common, 'wrappedKey', 'nonce', 'ciphertext', 'contentType'], ['file']);
    if (source.contentType !== 'text' && source.contentType !== 'file')
      throw new Error('Invalid content type.');
    if ((source.contentType === 'file') !== 'file' in source)
      throw new Error('File metadata mismatch.');
    return {
      ...base,
      kind: 'hybrid',
      wrappedKey: encoded(source.wrappedKey, width, width),
      nonce: encoded(source.nonce, 12, 12),
      ciphertext: encoded(source.ciphertext, 16, 40 * 1024 * 1024),
      contentType: source.contentType,
      ...(source.contentType === 'file' ? { file: metadata(source.file) } : {}),
    };
  }
  throw new Error('Unknown envelope kind.');
}
export function packEnvelope(value: EnvelopeV2): string {
  const result = PREFIX + toBase64(utf8.encode(JSON.stringify(validateEnvelope(value))));
  if (result.length > MAX_ENVELOPE_CHARS) throw new Error('Envelope exceeds size limit.');
  return result;
}
export function parseEnvelope(envelope: string): EnvelopeV2 {
  if (envelope.startsWith('rsa-lab.v1:'))
    throw new Error('Legacy v1 envelopes are not supported. Re-encrypt the original message.');
  if (!envelope.startsWith(PREFIX) || envelope.length > MAX_ENVELOPE_CHARS)
    throw new Error('Invalid envelope prefix or size.');
  try {
    const json = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      fromBase64(envelope.slice(PREFIX.length), MAX_ENVELOPE_CHARS),
    );
    const value = validateEnvelope(JSON.parse(json));
    if (JSON.stringify(value) !== json) throw new Error('Noncanonical envelope JSON.');
    return value;
  } catch {
    throw new Error('Invalid ciphertext envelope.');
  }
}
export function validatePayload(value: unknown): InnerPayload {
  const source = record(value);
  fields(source, ['v', 'type', 'data'], ['file', 'signature']);
  if (source.v !== 2 || (source.type !== 'text' && source.type !== 'file'))
    throw new Error('Invalid payload.');
  if ((source.type === 'file') !== 'file' in source) throw new Error('File metadata mismatch.');
  const data = encoded(source.data, 0, MAX_FILE_BYTES),
    file = source.type === 'file' ? metadata(source.file) : undefined;
  if (file && fromBase64(data).length !== file.size) throw new Error('File size mismatch.');
  let signature: InnerPayload['signature'];
  if (source.signature !== undefined) {
    const s = record(source.signature);
    fields(s, ['algorithm', 'sender', 'value']);
    if (s.algorithm !== 'RSA-PSS-SHA256') throw new Error('Unsupported signature algorithm.');
    const bytes = fromBase64(text(s.value, 344), 256);
    if (bytes.length !== 128 && bytes.length !== 256) throw new Error('Invalid signature width.');
    signature = { algorithm: s.algorithm, sender: fp(s.sender), value: s.value as string };
  }
  return {
    v: 2,
    type: source.type,
    data,
    ...(file ? { file } : {}),
    ...(signature ? { signature } : {}),
  };
}
export function payloadBytes(payload: InnerPayload): Uint8Array {
  return utf8.encode(JSON.stringify(validatePayload(payload)));
}
export function parsePayload(bytes: Uint8Array): InnerPayload {
  if (bytes.length > 40 * 1024 * 1024) throw new Error('Payload exceeds size limit.');
  const json = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const value = validatePayload(JSON.parse(json));
  if (JSON.stringify(value) !== json) throw new Error('Noncanonical payload JSON.');
  return value;
}
export function signingBytes(payload: InnerPayload, sender: string): Uint8Array {
  const validated = validatePayload(payload);
  const base = {
    v: validated.v,
    type: validated.type,
    data: validated.data,
    ...(validated.file ? { file: validated.file } : {}),
  };
  return concat(
    utf8.encode('rsa-lab.signature.v2\0'),
    utf8.encode(
      JSON.stringify({ ...base, signer: { algorithm: 'RSA-PSS-SHA256', fingerprint: fp(sender) } }),
    ),
  );
}
export function hybridAad(
  envelope: Omit<HybridEnvelope, 'ciphertext'> | HybridEnvelope,
): Uint8Array {
  const value = validateEnvelope({
    ...envelope,
    ciphertext: toBase64(new Uint8Array(16)),
  }) as HybridEnvelope;
  const header = {
    v: value.v,
    recipient: value.recipient,
    bits: value.bits,
    kind: value.kind,
    wrappedKey: value.wrappedKey,
    nonce: value.nonce,
    contentType: value.contentType,
    ...(value.file ? { file: value.file } : {}),
  };
  return concat(utf8.encode('rsa-lab.aad.v2\0'), utf8.encode(JSON.stringify(header)));
}
