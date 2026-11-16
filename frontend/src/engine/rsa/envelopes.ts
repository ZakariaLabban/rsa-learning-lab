import { bitLength, type PrivateKey, type PublicKey } from '../math';
import {
  fingerprint,
  fromBase64,
  packEnvelope,
  parseEnvelope,
  toBase64,
  type EnvelopeV2,
} from '../encoding';
import { capabilities } from './capabilities';
import { oaepDecrypt, oaepEncrypt } from './oaep';
import { textbookDecryptBytes, textbookEncryptBytes } from './textbook';

export type BasicMode = 'textbook' | 'oaep';
export type Sealed = { envelope: string; value: EnvelopeV2; blocks: Uint8Array[] };
export type Opened = { bytes: Uint8Array; mode: BasicMode; key: PrivateKey; blocks: Uint8Array[] };

/**
 * Encrypts bytes for a recipient's PUBLIC key and packs a v2 envelope.
 * Hybrid and signed envelopes are composed in #44.
 */
export async function sealBasic(
  key: PublicKey,
  bytes: Uint8Array,
  mode: BasicMode,
  testSeed?: Uint8Array,
): Promise<Sealed> {
  const base = { v: 2 as const, recipient: await fingerprint(key), bits: bitLength(key.n) };
  let value: EnvelopeV2, blocks: Uint8Array[];
  if (mode === 'oaep') {
    blocks = [await oaepEncrypt(key, bytes, testSeed)];
    value = { ...base, kind: 'oaep', ciphertext: toBase64(blocks[0]) };
  } else if (mode === 'textbook') {
    blocks = textbookEncryptBytes(key, bytes);
    value = {
      ...base,
      kind: 'textbook-blocks',
      blocks: blocks.map(toBase64),
      byteLength: bytes.length,
    };
  } else throw new RangeError('Unsupported encryption mode.');
  return { envelope: packEnvelope(value), value, blocks };
}

/**
 * Picks the private key whose public-key fingerprint and size match the envelope.
 * Throws when none of the given keys can decrypt it.
 */
export async function selectPrivateKey<K extends PrivateKey>(
  envelope: EnvelopeV2,
  keys: readonly K[],
): Promise<K> {
  for (const key of keys)
    if (bitLength(key.n) === envelope.bits && (await fingerprint(key)) === envelope.recipient)
      return key;
  throw new Error('None of your private keys matches this envelope.');
}

/** Parses an envelope, chooses the matching private key and decrypts textbook/OAEP content. */
export async function openBasic(
  envelope: string | EnvelopeV2,
  keys: readonly PrivateKey[],
): Promise<Opened> {
  const value = typeof envelope === 'string' ? parseEnvelope(envelope) : envelope;
  if (value.kind === 'hybrid')
    throw new Error('Hybrid envelopes are opened by the hybrid engine (#44).');
  const key = await selectPrivateKey(value, keys);
  const { width } = capabilities(key);
  if (value.kind === 'oaep') {
    const blocks = [fromBase64(value.ciphertext, width)];
    return { bytes: await oaepDecrypt(key, blocks[0]), mode: 'oaep', key, blocks };
  }
  const blocks = value.blocks.map((block) => fromBase64(block, width));
  return {
    bytes: textbookDecryptBytes(key, blocks, value.byteLength),
    mode: 'textbook',
    key,
    blocks,
  };
}
