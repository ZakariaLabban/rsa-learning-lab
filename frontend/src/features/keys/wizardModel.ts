/**
 * Key Generation Wizard logic (#10), following the Ch 9 "RSA Key Setup" steps.
 * Pure functions with plain-language errors; unit-tested.
 */
import {
  bitLength,
  deriveKey,
  gcd,
  inverse,
  lcm,
  probablePrime,
  type PrivateKey,
} from '../../engine/math';
import { teachingKey } from '../../engine/keys/keygen';

export const TEACHING_SIZES = [8, 16, 32, 64] as const;
export const REAL_SIZES = [1024, 2048] as const;
export type WizardSize = (typeof TEACHING_SIZES)[number] | (typeof REAL_SIZES)[number];
export const isTeaching = (bits: number) => bits <= 64;

/** Smallest factor found by trial division up to `limit`, or null. Explains "not prime". */
export function smallestFactor(n: bigint, limit = 1_000_000n): bigint | null {
  if (n % 2n === 0n) return 2n;
  for (let f = 3n; f <= limit && f * f <= n; f += 2n) if (n % f === 0n) return f;
  return null;
}

function primeProblem(name: string, value: bigint): string | null {
  if (value < 3n)
    return `${name} = ${value} is too small: use an odd prime of at least 3 (p = 2 does not work with RSA here).`;
  if (probablePrime(value)) return null;
  const factor = smallestFactor(value);
  return factor && factor !== value
    ? `${name} = ${value} is not prime: ${value} = ${factor} × ${value / factor}.`
    : `${name} = ${value} is not prime (it failed the Miller–Rabin test).`;
}

/** Checks typed p and q for a teaching key; returns the first problem, or null if usable. */
export function typedPrimesProblem(p: bigint, q: bigint): string | null {
  const problem = primeProblem('p', p) ?? primeProblem('q', q);
  if (problem) return problem;
  if (p === q) return 'p and q must be different primes: with p = q, n = p² is easy to factor.';
  if (bitLength(p * q) > 64)
    return `n = p × q has ${bitLength(p * q)} bits; typed teaching keys are limited to 64 bits. Use “Generate p and q” for 1024/2048-bit keys.`;
  if (p * q < 15n) return 'n = p × q is too small to encrypt anything useful.';
  return null;
}

/** Checks e against φ(n): 1 < e < φ(n) and gcd(e, φ(n)) = 1. */
export function exponentProblem(e: bigint, phi: bigint): string | null {
  if (e <= 1n) return 'e must be greater than 1.';
  if (e >= phi) return `e must be smaller than φ(n) = ${phi}.`;
  const g = gcd(e, phi);
  if (g !== 1n)
    return `gcd(e, φ(n)) = gcd(${e}, ${phi}) = ${g}, so e has no inverse mod φ(n) and d cannot exist. Pick an e that shares no factor with φ(n).`;
  return null;
}

/** The first `count` valid choices of e (odd, starting at 3). */
export function suggestExponents(phi: bigint, count = 5): bigint[] {
  const result: bigint[] = [];
  for (let e = 3n; e < phi && result.length < count; e += 2n)
    if (gcd(e, phi) === 1n) result.push(e);
  return result;
}

export type WizardKey = {
  key: PrivateKey;
  /** d computed mod λ(n) instead, as many libraries do. */
  dLambda: bigint;
};

/** Builds the key once p, q and e are valid (teaching keys re-checked by teachingKey). */
export function buildKey(p: bigint, q: bigint, e: bigint): WizardKey {
  const key = bitLength(p * q) <= 64 ? teachingKey(p, q, e) : deriveKey(p, q, e);
  return { key, dLambda: inverse(e, lcm(p - 1n, q - 1n)) };
}
