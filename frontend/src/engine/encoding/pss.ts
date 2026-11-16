import { concat, equalBytes, randomBytes, xor } from './bytes';
import { mgf1, sha256 } from './hash';

function dimensions(modulusBits: number) {
  if (!Number.isSafeInteger(modulusBits) || modulusBits < 2 || modulusBits > 4096)
    throw new RangeError('Invalid PSS modulus size.');
  const emBits = modulusBits - 1,
    length = Math.ceil(emBits / 8);
  if (length < 66) throw new RangeError('Key is too small for PSS-SHA256 with 32-byte salt.');
  return { length, unused: 8 * length - emBits };
}
/** RFC 8017 EMSA-PSS. Normal callers always use fresh 32-byte salt. */
export async function pssEncode(
  message: Uint8Array,
  modulusBits: number,
  testSalt?: Uint8Array,
): Promise<Uint8Array> {
  const { length, unused } = dimensions(modulusBits);
  const salt = testSalt?.slice() ?? randomBytes(32);
  if (salt.length !== 32) throw new RangeError('PSS salt must be 32 bytes.');
  const h = await sha256(concat(new Uint8Array(8), await sha256(message), salt));
  const db = concat(new Uint8Array(length - 66), new Uint8Array([1]), salt);
  const maskedDb = xor(db, await mgf1(h, length - 33));
  maskedDb[0] &= 255 >>> unused;
  return concat(maskedDb, h, new Uint8Array([0xbc]));
}
export async function pssVerify(
  message: Uint8Array,
  encoded: Uint8Array,
  modulusBits: number,
): Promise<boolean> {
  const { length, unused } = dimensions(modulusBits);
  if (
    encoded.length !== length ||
    encoded[length - 1] !== 0xbc ||
    (encoded[0] & (255 << (8 - unused))) !== 0
  )
    return false;
  const h = encoded.subarray(length - 33, length - 1);
  const db = xor(encoded.subarray(0, length - 33), await mgf1(h, length - 33));
  db[0] &= 255 >>> unused;
  for (let i = 0; i < length - 66; i++) if (db[i] !== 0) return false;
  if (db[length - 66] !== 1) return false;
  return equalBytes(
    h,
    await sha256(concat(new Uint8Array(8), await sha256(message), db.subarray(db.length - 32))),
  );
}
