import { randomBytes } from './bytes';

function validate(key: Uint8Array, nonce: Uint8Array) {
  if (key.length !== 32 || nonce.length !== 12)
    throw new RangeError('AES-256-GCM requires a 32-byte key and 12-byte nonce.');
}
export function freshAesParameters() {
  return { key: randomBytes(32), nonce: randomBytes(12) };
}
/** Low-level primitive. Composition must use a fresh key/nonce for every payload. */
export async function aesGcmEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  validate(key, nonce);
  const imported = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
  return new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128 },
      imported,
      plaintext,
    ),
  );
}
export async function aesGcmDecrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  validate(key, nonce);
  if (ciphertext.length < 16) throw new Error('Decryption failed.');
  const imported = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128 },
        imported,
        ciphertext,
      ),
    );
  } catch {
    throw new Error('Decryption failed.');
  }
}
