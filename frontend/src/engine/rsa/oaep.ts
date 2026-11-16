import { decryptCrt, encryptInt, i2osp, os2ip, type PrivateKey, type PublicKey } from '../math';
import { oaepDecode, oaepEncode } from '../encoding';
import { requireCapability } from './capabilities';

const FAILED = 'Decryption failed. Check the key and ciphertext.';

/**
 * RSAES-OAEP-ENCRYPT (RFC 8017 7.1.1), SHA-256 / MGF1-SHA256, empty label.
 * `testSeed` exists only for deterministic fixtures; production callers never pass it.
 */
export async function oaepEncrypt(
  key: PublicKey,
  message: Uint8Array,
  testSeed?: Uint8Array,
): Promise<Uint8Array> {
  const { width, oaepMaxBytes } = requireCapability(key, 'oaep');
  if (message.length > oaepMaxBytes)
    throw new RangeError(`OAEP-SHA256 accepts at most ${oaepMaxBytes} bytes with this key.`);
  const encoded = await oaepEncode(message, width, testSeed);
  return i2osp(encryptInt(os2ip(encoded), key), width);
}

/** RSAES-OAEP-DECRYPT (RFC 8017 7.1.2). Every failure gives the same generic error. */
export async function oaepDecrypt(key: PrivateKey, ciphertext: Uint8Array): Promise<Uint8Array> {
  const { width } = requireCapability(key, 'oaep');
  try {
    if (ciphertext.length !== width) throw new Error();
    const value = os2ip(ciphertext);
    if (value >= key.n) throw new Error();
    return await oaepDecode(i2osp(decryptCrt(value, key).value, width));
  } catch {
    throw new Error(FAILED);
  }
}
