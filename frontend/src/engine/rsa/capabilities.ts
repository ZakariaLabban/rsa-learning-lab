import { bitLength, type PublicKey } from '../math';

export type KeyClass = 'teaching' | 'assignment';
export type Capabilities = {
  keyClass: KeyClass;
  bits: number;
  /** RSA block width in bytes: ceil(bits / 8). */
  width: number;
  /** Raw textbook RSA on integers 0 <= M < n. Always available. */
  textbookNumbers: true;
  /** Textbook RSA on bytes, split into blocks of `textbookBlockBytes`. Needs n >= 256. */
  textbookText: boolean;
  textbookBlockBytes: number;
  /** RSAES-OAEP (SHA-256). Assignment-size keys only. */
  oaep: boolean;
  oaepMaxBytes: number;
  /** RSASSA-PSS (SHA-256, 32-byte salt). Assignment-size keys only. */
  pss: boolean;
  /** Insecure hash-mod-n signature for the Learn pages. Teaching keys only. */
  teachingSignature: boolean;
  /** AES-256-GCM + OAEP-wrapped key; composition is implemented in #44. */
  hybrid: boolean;
};

export const TEACHING_MAX_BITS = 64;
export const ASSIGNMENT_BITS = [1024, 2048] as const;

/**
 * Decides what a key may be used for (key classes in roadmap #25).
 * Teaching keys (n <= 64 bits): textbook operations and the teaching signature only;
 * n < 256 cannot hold a byte, so it is number-only.
 * Assignment keys (exactly 1024/2048 bits): textbook, OAEP, PSS and hybrid.
 * Every other size is rejected.
 */
export function capabilities(key: PublicKey): Capabilities {
  if (key.n <= 1n || key.e <= 1n || key.e >= key.n) throw new RangeError('Invalid public key.');
  const bits = bitLength(key.n),
    width = Math.ceil(bits / 8);
  const assignment = (ASSIGNMENT_BITS as readonly number[]).includes(bits);
  if (!assignment && bits > TEACHING_MAX_BITS)
    throw new RangeError(
      'Unsupported key size: use a teaching key (<= 64 bits) or 1024/2048 bits.',
    );
  const text = key.n >= 256n;
  return {
    keyClass: assignment ? 'assignment' : 'teaching',
    bits,
    width,
    textbookNumbers: true,
    textbookText: text,
    textbookBlockBytes: text ? width - 1 : 0,
    oaep: assignment,
    oaepMaxBytes: assignment ? width - 66 : 0,
    pss: assignment,
    teachingSignature: !assignment,
    hybrid: assignment,
  };
}

export function requireCapability(
  key: PublicKey,
  capability: 'textbookText' | 'oaep' | 'pss' | 'teachingSignature' | 'hybrid',
): Capabilities {
  const result = capabilities(key);
  if (!result[capability]) throw new RangeError(UNAVAILABLE[capability]);
  return result;
}

const UNAVAILABLE = {
  textbookText: 'This teaching key is too small for text (n < 256); use number mode.',
  oaep: 'OAEP requires a 1024/2048-bit key.',
  pss: 'PSS signatures require a 1024/2048-bit key.',
  teachingSignature: 'Teaching signatures are only for teaching keys (n <= 64 bits); use PSS.',
  hybrid: 'Hybrid encryption requires a 1024/2048-bit recipient key.',
};
