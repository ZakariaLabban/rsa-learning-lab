import { decryptCrt, encryptInt, i2osp, os2ip, type PrivateKey, type PublicKey } from '../math';
import { capabilities, requireCapability } from './capabilities';

export const MAX_TEXTBOOK_BLOCKS = 4096;

/** Raw textbook RSA on one integer: C = M^e mod n. No padding, deterministic. */
export function textbookEncryptNumber(key: PublicKey, message: bigint): bigint {
  capabilities(key);
  return encryptInt(message, key);
}
/** Raw textbook RSA decryption: M = C^d mod n (computed with CRT). */
export function textbookDecryptNumber(key: PrivateKey, ciphertext: bigint): bigint {
  capabilities(key);
  return decryptCrt(ciphertext, key).value;
}

/**
 * Textbook RSA on bytes ("block if needed"): the bytes are split into chunks of
 * width-1 bytes, so every chunk is < 2^(bits-1) <= n. Empty input encrypts one zero block.
 * Deterministic and not tamper-evident: this is for lessons and attacks, not real secrecy.
 */
export function textbookEncryptBytes(key: PublicKey, bytes: Uint8Array): Uint8Array[] {
  const { width, textbookBlockBytes: chunk } = requireCapability(key, 'textbookText');
  const count = Math.max(1, Math.ceil(bytes.length / chunk));
  if (count > MAX_TEXTBOOK_BLOCKS)
    throw new RangeError(`Textbook mode accepts at most ${MAX_TEXTBOOK_BLOCKS * chunk} bytes.`);
  return Array.from({ length: count }, (_, i) =>
    i2osp(encryptInt(os2ip(bytes.subarray(i * chunk, (i + 1) * chunk)), key), width),
  );
}

/**
 * Reverses textbookEncryptBytes. A wrong key usually yields a block that does not fit its
 * expected length (rejected), but textbook RSA cannot detect every alteration.
 */
export function textbookDecryptBytes(
  key: PrivateKey,
  blocks: readonly Uint8Array[],
  byteLength: number,
): Uint8Array {
  const { width, textbookBlockBytes: chunk } = requireCapability(key, 'textbookText');
  if (
    !Number.isSafeInteger(byteLength) ||
    byteLength < 0 ||
    blocks.length !== Math.max(1, Math.ceil(byteLength / chunk)) ||
    blocks.length > MAX_TEXTBOOK_BLOCKS
  )
    throw new RangeError('Inconsistent textbook block count.');
  const output = new Uint8Array(byteLength);
  blocks.forEach((block, i) => {
    if (block.length !== width) throw new RangeError('Textbook block has the wrong width.');
    const length = Math.min(chunk, byteLength - i * chunk);
    const value = decryptCrt(os2ip(block), key).value;
    output.set(i2osp(value, Math.max(0, length)), i * chunk);
  });
  return output;
}
