import { decryptCrt, encryptInt, i2osp, os2ip, type PrivateKey, type PublicKey } from '../math';
import { oaepDecode, oaepEncode } from '../encoding';
import { requireCapability } from './capabilities';

const FAILED = 'Decryption failed. Check the key and ciphertext.';

/** OAEP encryption that also returns the padded block EM (what RSA actually encrypts). */
export async function oaepEncryptTrace(
  key: PublicKey,
  message: Uint8Array,
  testSeed?: Uint8Array,
): Promise<{ encoded: Uint8Array; ciphertext: Uint8Array }> {
  const { width, oaepMaxBytes } = requireCapability(key, 'oaep');
  if (message.length > oaepMaxBytes)
    throw new RangeError(`OAEP-SHA256 accepts at most ${oaepMaxBytes} bytes with this key.`);
  const encoded = await oaepEncode(message, width, testSeed);
  return { encoded, ciphertext: i2osp(encryptInt(os2ip(encoded), key), width) };
}

/**
 * RSAES-OAEP-ENCRYPT (RFC 8017 7.1.1), SHA-256 / MGF1-SHA256, empty label.
 * `testSeed` exists only for deterministic fixtures; production callers never pass it.
 */
export async function oaepEncrypt(
  key: PublicKey,
  message: Uint8Array,
  testSeed?: Uint8Array,
): Promise<Uint8Array> {
  return (await oaepEncryptTrace(key, message, testSeed)).ciphertext;
}

/** OAEP decryption that also returns the recovered padded block EM. Generic error on failure. */
export async function oaepDecryptTrace(
  key: PrivateKey,
  ciphertext: Uint8Array,
): Promise<{ encoded: Uint8Array; message: Uint8Array }> {
  const { width } = requireCapability(key, 'oaep');
  try {
    if (ciphertext.length !== width) throw new Error();
    const value = os2ip(ciphertext);
    if (value >= key.n) throw new Error();
    const encoded = i2osp(decryptCrt(value, key).value, width);
    return { encoded, message: await oaepDecode(encoded) };
  } catch {
    throw new Error(FAILED);
  }
}

/** RSAES-OAEP-DECRYPT (RFC 8017 7.1.2). Every failure gives the same generic error. */
export async function oaepDecrypt(key: PrivateKey, ciphertext: Uint8Array): Promise<Uint8Array> {
  return (await oaepDecryptTrace(key, ciphertext)).message;
}
