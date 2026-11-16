import { decryptCrt, i2osp, modexp, os2ip, type PrivateKey, type PublicKey } from '../math';
import { pssEncode, pssVerify, sha256 } from '../encoding';
import { requireCapability } from './capabilities';

/**
 * RSASSA-PSS-SIGN (RFC 8017 8.1.1): EMSA-PSS encode (SHA-256, 32-byte salt), then s = EM^d mod n.
 * `testSalt` exists only for deterministic fixtures; production callers never pass it.
 */
export async function pssSign(
  key: PrivateKey,
  message: Uint8Array,
  testSalt?: Uint8Array,
): Promise<Uint8Array> {
  const { bits, width } = requireCapability(key, 'pss');
  const encoded = await pssEncode(message, bits, testSalt);
  return i2osp(decryptCrt(os2ip(encoded), key).value, width);
}

/** RSASSA-PSS-VERIFY (RFC 8017 8.1.2). Returns false for any malformed or wrong signature. */
export async function pssVerifySignature(
  key: PublicKey,
  message: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  const { bits, width } = requireCapability(key, 'pss');
  if (signature.length !== width) return false;
  const s = os2ip(signature);
  if (s >= key.n) return false;
  const emLength = Math.ceil((bits - 1) / 8),
    m = modexp(s, key.e, key.n);
  if (m >= 1n << BigInt(8 * emLength)) return false;
  return pssVerify(message, i2osp(m, emLength), bits);
}

export type TeachingSignature = {
  /** SHA-256 of the message. */
  hash: Uint8Array;
  /** The hash reduced mod n: the number that actually gets signed. */
  digest: bigint;
  /** s = digest^d mod n. */
  signature: bigint;
};

/**
 * INSECURE teaching signature for tiny keys: s = (SHA-256(m) mod n)^d mod n.
 * With n <= 64 bits many messages share the same digest, so forgeries/collisions are easy.
 */
export async function teachingSign(
  key: PrivateKey,
  message: Uint8Array,
): Promise<TeachingSignature> {
  requireCapability(key, 'teachingSignature');
  const hash = await sha256(message),
    digest = os2ip(hash) % key.n;
  return { hash, digest, signature: decryptCrt(digest, key).value };
}

/** Verifies a teaching signature: s^e mod n must equal SHA-256(m) mod n. */
export async function teachingVerify(key: PublicKey, message: Uint8Array, signature: bigint) {
  requireCapability(key, 'teachingSignature');
  const hash = await sha256(message),
    digest = os2ip(hash) % key.n;
  if (signature < 0n || signature >= key.n) return { valid: false, hash, digest, recovered: null };
  const recovered = modexp(signature, key.e, key.n);
  return { valid: recovered === digest, hash, digest, recovered };
}
