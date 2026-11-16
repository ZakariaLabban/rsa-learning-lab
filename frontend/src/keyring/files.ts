/**
 * Key files: validation and export/import formats.
 *
 * - Public key file (`.pub`): { format: 'rsa-lab-public-v2', name?, bits, n, e, fingerprint }
 *   (same format as the Key Studio "Export JSON" button).
 * - Key-pair file (`.json`): { format: 'rsa-lab-keypair-v2', warning, name?, bits, n, e, p, q, d,
 *   fingerprint }. Contains secrets; the UI warns before exporting it.
 * Integers are decimal strings, never JSON numbers.
 */
import {
  bitLength,
  gcd,
  inverse,
  lcm,
  probablePrime,
  type PrivateKey,
  type PublicKey,
} from '../engine/math';
import { fingerprint } from '../engine/encoding';
import { capabilities } from '../engine/rsa';

export const PUBLIC_FORMAT = 'rsa-lab-public-v2';
export const PAIR_FORMAT = 'rsa-lab-keypair-v2';
export const MAX_FILE_CHARS = 64 * 1024;
const MAX_DIGITS = 1300;

export type ParsedKey =
  | { kind: 'public'; name?: string; key: PublicKey; fingerprint: string }
  | { kind: 'pair'; name?: string; key: PrivateKey; fingerprint: string };

export class KeyFileError extends Error {}

function fail(reason: string): never {
  throw new KeyFileError(reason);
}

export function cleanName(value: unknown, fallback?: string): string {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    fail('A name is required.');
  }
  if (typeof value !== 'string') fail('The name must be text.');
  const name = value.trim();
  if (!name || name.length > 60) fail('Names must be 1 to 60 characters.');
  if (Array.from(name).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))
    fail('Names cannot contain control characters.');
  return name;
}

function integer(source: Record<string, unknown>, field: string): bigint {
  const value = source[field];
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value) || value.length > MAX_DIGITS)
    fail(`"${field}" must be a whole number written as text.`);
  return BigInt(value);
}

/** Checks a public key and returns it with its size class (throws a readable reason). */
export function checkPublicKey(key: PublicKey): void {
  if (key.n <= 1n) fail('The modulus n must be greater than 1.');
  if (key.e <= 1n || key.e >= key.n) fail('The public exponent must satisfy 1 < e < n.');
  try {
    capabilities(key);
  } catch {
    fail('Unsupported key size: use a teaching key (up to 64 bits) or 1024/2048 bits.');
  }
}

/**
 * Builds a full private key from p, q, e, d after checking every relationship:
 * distinct odd probable primes, n = p*q, gcd(e, lambda) = 1 and e*d = 1 (mod lambda).
 * Both lecture-style d (mod phi) and library-style d (mod lambda) are accepted.
 */
export function privateFromParts(p: bigint, q: bigint, e: bigint, d: bigint): PrivateKey {
  if (p < 3n || q < 3n || p % 2n === 0n || q % 2n === 0n) fail('p and q must be odd primes.');
  if (p === q) fail('p and q must be different primes.');
  if (!probablePrime(p, 16) || !probablePrime(q, 16)) fail('p and q must both be prime.');
  const n = p * q;
  checkPublicKey({ n, e });
  const phi = (p - 1n) * (q - 1n),
    lambda = lcm(p - 1n, q - 1n);
  if (gcd(e, lambda) !== 1n) fail('e must be coprime to (p-1)(q-1).');
  if (d <= 0n || d >= n) fail('The private exponent d must satisfy 0 < d < n.');
  if ((e * d) % lambda !== 1n) fail('d is not the inverse of e: e*d is not 1 mod lambda(n).');
  return { p, q, n, e, d, phi, lambda, dp: d % (p - 1n), dq: d % (q - 1n), qInv: inverse(q, p) };
}

function record(text: string): Record<string, unknown> {
  if (typeof text !== 'string' || text.length > MAX_FILE_CHARS) fail('The key file is too large.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    fail('This is not a key file (it is not valid JSON).');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('This is not a key file.');
  return value as Record<string, unknown>;
}

function onlyFields(source: Record<string, unknown>, allowed: string[]) {
  const extra = Object.keys(source).filter((key) => !allowed.includes(key));
  if (extra.length) fail(`Unknown field "${extra[0]}" in the key file.`);
}

/** Parses and fully validates a public-key or key-pair file. */
export async function parseKeyFile(text: string): Promise<ParsedKey> {
  const source = record(text);
  const name = source.name === undefined ? undefined : cleanName(source.name);
  let parsed: ParsedKey;
  if (source.format === PUBLIC_FORMAT) {
    onlyFields(source, ['format', 'name', 'bits', 'n', 'e', 'fingerprint']);
    const key = { n: integer(source, 'n'), e: integer(source, 'e') };
    checkPublicKey(key);
    parsed = { kind: 'public', name, key, fingerprint: await fingerprint(key) };
  } else if (source.format === PAIR_FORMAT) {
    onlyFields(source, [
      'format',
      'warning',
      'name',
      'bits',
      'n',
      'e',
      'p',
      'q',
      'd',
      'fingerprint',
    ]);
    const key = privateFromParts(
      integer(source, 'p'),
      integer(source, 'q'),
      integer(source, 'e'),
      integer(source, 'd'),
    );
    if (integer(source, 'n') !== key.n) fail('n does not equal p * q.');
    parsed = { kind: 'pair', name, key, fingerprint: await fingerprint(key) };
  } else if (source.format === 'rsa-lab-public-v1') {
    fail('Old v1 key files are not supported. Export the key again from the current app.');
  } else fail('Unknown key file format.');
  if (source.bits !== undefined && source.bits !== bitLength(parsed.key.n))
    fail('The "bits" field does not match the key.');
  if (source.fingerprint !== undefined && source.fingerprint !== parsed.fingerprint)
    fail('The fingerprint in the file does not match the key (the file may have been altered).');
  return parsed;
}

export function publicKeyFile(name: string, key: PublicKey, keyFingerprint: string): string {
  return (
    JSON.stringify(
      {
        format: PUBLIC_FORMAT,
        name,
        bits: bitLength(key.n),
        n: String(key.n),
        e: String(key.e),
        fingerprint: keyFingerprint,
      },
      null,
      2,
    ) + '\n'
  );
}

export function keyPairFile(name: string, key: PrivateKey, keyFingerprint: string): string {
  return (
    JSON.stringify(
      {
        format: PAIR_FORMAT,
        warning: 'PRIVATE KEY: anyone with this file can decrypt your messages and sign as you.',
        name,
        bits: bitLength(key.n),
        n: String(key.n),
        e: String(key.e),
        p: String(key.p),
        q: String(key.q),
        d: String(key.d),
        fingerprint: keyFingerprint,
      },
      null,
      2,
    ) + '\n'
  );
}

export function fileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'key'
  );
}
