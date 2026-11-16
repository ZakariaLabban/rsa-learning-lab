import { describe, expect, it } from 'vitest';
import references from '../../engine/__vectors__/reference-vectors.json';
import { encryptInt, decryptInt } from '../../engine/math';
import {
  buildKey,
  exponentProblem,
  smallestFactor,
  suggestExponents,
  typedPrimesProblem,
} from './wizardModel';

describe('key wizard', () => {
  it('builds the lecture key: PU = {7, 187}, PR = {23, 187}', () => {
    expect(typedPrimesProblem(17n, 11n)).toBeNull();
    expect(exponentProblem(7n, 160n)).toBeNull();
    const { key, dLambda } = buildKey(17n, 11n, 7n);
    expect([key.e, key.n, key.d, key.phi]).toEqual([7n, 187n, 23n, 160n]);
    expect(dLambda).toBe(23n); // λ(187) = lcm(16, 10) = 80 and 7 · 23 = 161 ≡ 1 (mod 80)
    expect(decryptInt(encryptInt(88n, key), key)).toBe(88n);
  });
  it('explains invalid p and q', () => {
    expect(typedPrimesProblem(15n, 11n)).toBe('p = 15 is not prime: 15 = 3 × 5.');
    expect(typedPrimesProblem(17n, 21n)).toBe('q = 21 is not prime: 21 = 3 × 7.');
    expect(typedPrimesProblem(2n, 11n)).toContain('too small');
    expect(typedPrimesProblem(17n, 17n)).toContain('must be different');
    expect(typedPrimesProblem(4294967311n, 4294967357n)).toContain('limited to 64 bits');
    expect(smallestFactor(91n)).toBe(7n);
  });
  it('explains invalid e and suggests valid ones', () => {
    expect(exponentProblem(1n, 160n)).toContain('greater than 1');
    expect(exponentProblem(160n, 160n)).toContain('smaller than φ(n) = 160');
    expect(exponentProblem(5n, 160n)).toBe(
      'gcd(e, φ(n)) = gcd(5, 160) = 5, so e has no inverse mod φ(n) and d cannot exist. Pick an e that shares no factor with φ(n).',
    );
    expect(suggestExponents(160n)).toEqual([3n, 7n, 9n, 11n, 13n]);
  });
  it('builds real 1024/2048-bit keys from generated primes with e = 65537', () => {
    for (const v of references.keys) {
      const { key } = buildKey(BigInt(v.p), BigInt(v.q), 65537n);
      expect(key.n.toString(2)).toHaveLength(v.bits);
      expect(key.d).toBe(BigInt(v.d_phi));
    }
  });
});
