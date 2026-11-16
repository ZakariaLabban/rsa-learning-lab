import { concat, equalBytes, randomBytes, xor } from './bytes';
import { mgf1, sha256 } from './hash';

const FAILED = 'Decryption failed. Check the key and ciphertext.';
/** RFC 8017, SHA-256/MGF1-SHA256 and empty label. Seed injection is for tests only. */
export async function oaepEncode(
  message: Uint8Array,
  size: number,
  testSeed?: Uint8Array,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(size) || size < 66 || size > 512)
    throw new RangeError('Invalid OAEP block size.');
  if (message.length > size - 66)
    throw new RangeError(`OAEP-SHA256 accepts at most ${size - 66} bytes with this key.`);
  const seed = testSeed?.slice() ?? randomBytes(32);
  if (seed.length !== 32) throw new RangeError('OAEP seed must be 32 bytes.');
  const db = concat(
    await sha256(new Uint8Array()),
    new Uint8Array(size - message.length - 66),
    new Uint8Array([1]),
    message,
  );
  const maskedDb = xor(db, await mgf1(seed, size - 33));
  return concat(new Uint8Array([0]), xor(seed, await mgf1(maskedDb, 32)), maskedDb);
}
export async function oaepDecode(encoded: Uint8Array): Promise<Uint8Array> {
  if (encoded.length < 66 || encoded.length > 512) throw new Error(FAILED);
  const seed = xor(encoded.subarray(1, 33), await mgf1(encoded.subarray(33), 32));
  const db = xor(encoded.subarray(33), await mgf1(seed, encoded.length - 33));
  let invalid = encoded[0] !== 0 || !equalBytes(db.subarray(0, 32), await sha256(new Uint8Array()));
  let separator = 32;
  while (separator < db.length && db[separator] === 0) separator++;
  invalid ||= separator >= db.length || db[separator] !== 1;
  if (invalid) throw new Error(FAILED);
  return db.slice(separator + 1);
}
