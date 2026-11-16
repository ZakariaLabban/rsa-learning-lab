/**
 * Hybrid encryption and sign-then-encrypt (#44), using the envelope v2 contract.
 *
 * Seal: optional RSA-PSS signature over the canonical inner payload (signingBytes), then a
 * fresh AES-256-GCM key encrypts the payload (outer header as associated data) and only that
 * 32-byte key is wrapped with RSA-OAEP. Open: pick the private key by fingerprint, unwrap,
 * verify the GCM tag BEFORE releasing any plaintext, check outer/inner metadata agree, then
 * verify the inner signature against a KNOWN sender key.
 *
 * Educational limitation: the lab signs and encrypts with the same key pair for simplicity;
 * real systems prefer separate signing and encryption keys.
 */
import { bitLength, type PrivateKey, type PublicKey } from '../math';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  fingerprint,
  freshAesParameters,
  fromBase64,
  hybridAad,
  MAX_FILE_BYTES,
  packEnvelope,
  parsePayload,
  payloadBytes,
  signingBytes,
  toBase64,
  type EnvelopeV2,
  type FileMetadata,
  type HybridEnvelope,
  type InnerPayload,
} from '../encoding';
import { capabilities, requireCapability } from './capabilities';
import { oaepDecrypt, oaepEncrypt } from './oaep';
import { selectPrivateKey } from './envelopes';
import { pssSign, pssVerifySignature } from './signatures';

const FAILED = 'Decryption failed. Check the key and ciphertext.';

export type HybridContent =
  { type: 'text'; data: Uint8Array } | { type: 'file'; data: Uint8Array; file: FileMetadata };

/** Fixed randomness for deterministic tests only; production callers never pass it. */
export type HybridTestRandomness = {
  aesKey: Uint8Array;
  nonce: Uint8Array;
  oaepSeed: Uint8Array;
  pssSalt?: Uint8Array;
};

export type SealedHybrid = {
  timings: { rsaMs: number; aesMs: number };
  envelope: string;
  value: HybridEnvelope;
  /** Shown in the teaching journey; never stored or sent. */
  aesKey: Uint8Array;
  nonce: Uint8Array;
  wrappedKey: Uint8Array;
  ciphertext: Uint8Array;
  /** Present when signed. */
  signature?: { sender: string; value: Uint8Array };
};

export async function sealHybrid(
  recipient: PublicKey,
  content: HybridContent,
  signer?: PrivateKey,
  test?: HybridTestRandomness,
): Promise<SealedHybrid> {
  requireCapability(recipient, 'hybrid');
  if (content.data.length > MAX_FILE_BYTES)
    throw new RangeError('Hybrid payloads are limited to 25 MiB.');
  const payload: InnerPayload = {
    v: 2,
    type: content.type,
    data: toBase64(content.data),
    ...(content.type === 'file' ? { file: content.file } : {}),
  };
  let signature: SealedHybrid['signature'];
  if (signer) {
    requireCapability(signer, 'pss');
    const sender = await fingerprint(signer);
    const value = await pssSign(signer, signingBytes(payload, sender), test?.pssSalt);
    payload.signature = { algorithm: 'RSA-PSS-SHA256', sender, value: toBase64(value) };
    signature = { sender, value };
  }
  const { key: aesKey, nonce } = test
    ? { key: test.aesKey, nonce: test.nonce }
    : freshAesParameters();
  const rsaStart = performance.now();
  const wrappedKey = await oaepEncrypt(recipient, aesKey, test?.oaepSeed);
  const rsaMs = performance.now() - rsaStart;
  const header = {
    v: 2 as const,
    recipient: await fingerprint(recipient),
    bits: bitLength(recipient.n),
    kind: 'hybrid' as const,
    wrappedKey: toBase64(wrappedKey),
    nonce: toBase64(nonce),
    contentType: content.type,
    ...(content.type === 'file' ? { file: content.file } : {}),
  };
  const encodedPayload = payloadBytes(payload);
  const aad = hybridAad(header);
  const aesStart = performance.now();
  const ciphertext = await aesGcmEncrypt(encodedPayload, aesKey, nonce, aad);
  const aesMs = performance.now() - aesStart;
  const value: HybridEnvelope = { ...header, ciphertext: toBase64(ciphertext) };
  return {
    timings: { rsaMs, aesMs },
    envelope: packEnvelope(value),
    value,
    aesKey,
    nonce,
    wrappedKey,
    ciphertext,
    ...(signature ? { signature } : {}),
  };
}

export type KnownSender = { fingerprint: string; key: PublicKey; name: string };
export type SignatureResult =
  | { status: 'unsigned' }
  | { status: 'valid'; sender: string; name: string }
  | { status: 'unknown-sender'; sender: string }
  | { status: 'invalid'; sender: string; name: string };

export type OpenedHybrid<K extends PrivateKey = PrivateKey> = {
  key: K;
  type: 'text' | 'file';
  bytes: Uint8Array;
  file?: FileMetadata;
  signature: SignatureResult;
  aesKey: Uint8Array;
  wrappedKey: Uint8Array;
};

/** Opens a hybrid envelope. Every decryption/authentication failure is one generic error. */
export async function openHybrid<K extends PrivateKey>(
  value: HybridEnvelope,
  keys: readonly K[],
  knownSenders: readonly KnownSender[] = [],
): Promise<OpenedHybrid<K>> {
  const key = await selectPrivateKey(value, keys);
  let payload: InnerPayload, aesKey: Uint8Array, wrappedKey: Uint8Array;
  try {
    const { width } = capabilities(key);
    wrappedKey = fromBase64(value.wrappedKey, width);
    aesKey = await oaepDecrypt(key, wrappedKey);
    if (aesKey.length !== 32) throw new Error();
    // GCM verifies the tag (and the authenticated header) before any plaintext is returned.
    const plaintext = await aesGcmDecrypt(
      fromBase64(value.ciphertext, 40 * 1024 * 1024),
      aesKey,
      fromBase64(value.nonce, 12),
      hybridAad(value),
    );
    payload = parsePayload(plaintext);
    if (
      payload.type !== value.contentType ||
      JSON.stringify(payload.file ?? null) !== JSON.stringify(value.file ?? null)
    )
      throw new Error();
  } catch {
    throw new Error(FAILED);
  }
  const bytes = fromBase64(payload.data);
  return {
    key,
    type: payload.type,
    bytes,
    ...(payload.file ? { file: payload.file } : {}),
    signature: await checkSignature(payload, knownSenders),
    aesKey,
    wrappedKey,
  };
}

async function checkSignature(
  payload: InnerPayload,
  knownSenders: readonly KnownSender[],
): Promise<SignatureResult> {
  if (!payload.signature) return { status: 'unsigned' };
  const { sender, value } = payload.signature;
  // An unknown fingerprint is never treated as a verified identity.
  const known = knownSenders.find((s) => s.fingerprint === sender);
  if (!known) return { status: 'unknown-sender', sender };
  let valid: boolean;
  try {
    valid =
      (await fingerprint(known.key)) === sender &&
      (await pssVerifySignature(known.key, signingBytes(payload, sender), fromBase64(value)));
  } catch {
    valid = false;
  }
  return valid
    ? { status: 'valid', sender, name: known.name }
    : { status: 'invalid', sender, name: known.name };
}

/** Narrowing helper for callers that receive any v2 envelope. */
export function isHybrid(value: EnvelopeV2): value is HybridEnvelope {
  return value.kind === 'hybrid';
}
