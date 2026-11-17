import { describe, expect, it } from 'vitest';
import refs from '../../engine/__vectors__/reference-vectors.json';
import { deriveKey } from '../../engine/math';
import {
  compareDecryption,
  crtLesson,
  exponentiation,
  integer,
  liarSearch,
  median,
  primality,
  residues,
  rsaProof,
} from './model';

describe('Miller–Rabin lesson', () => {
  it('matches the lecture base traces and exhaustive strong liars', () => {
    expect(primality('29', 'typed', '10', 5)).toMatchObject({
      result: {
        k: 2,
        q: 7n,
        probablePrime: true,
        randomRounds: 0,
        rows: [{ base: 10n, sequence: [17n, 28n], passed: true }],
      },
    });
    expect(primality('221', 'typed', '5', 5)).toMatchObject({
      result: {
        k: 2,
        q: 55n,
        probablePrime: false,
        randomRounds: 0,
        rows: [{ base: 5n, sequence: [112n, 168n], passed: false }],
      },
    });
    expect(liarSearch('221')).toMatchObject({
      prime: false,
      bases: [21n, 47n, 174n, 200n],
      tested: 218,
    });
    expect(liarSearch('29')).toMatchObject({ prime: true, tested: 26 });
  });
  it('handles special cases without invalid bases and never accumulates typed confidence', () => {
    for (const n of ['0', '1']) expect(primality(n, 'typed', 'bad', 5).special).toBe('below-two');
    for (const n of ['2', '3']) expect(primality(n, 'typed', 'bad', 5).special).toBe('small-prime');
    expect(primality('4', 'typed', 'bad', 5).special).toBe('even');
    expect(primality('29', 'random', 'unused', 5).result?.randomRounds).toBe(5);
    for (let repeat = 0; repeat < 3; repeat++)
      expect(primality('29', 'typed', '10', 5).result?.randomRounds).toBe(0);
    for (const base of ['1', '28'])
      expect(() => primality('29', 'typed', base, 5)).toThrow('Bases must lie');
    for (const n of ['4', '10001', '100000']) expect(() => liarSearch(n)).toThrow();
  });
});
describe('RSA proof and residue explorer', () => {
  it('proves every lecture-key message, including zero/non-coprime messages and negative normalization', () => {
    for (let m = -1; m <= 187; m++) {
      const result = rsaProof('17', '11', '7', String(m));
      expect(result.recovered).toBe(BigInt(((m % 187) + 187) % 187));
      expect(result.key.e * result.key.d).toBe(1n + result.k * result.key.phi);
      expect(result.eulerResidue).toBe(result.common === 1n ? 1n : null);
      for (const row of result.primeRows) expect(row.recovered).toBe(row.message);
    }
    expect(rsaProof('17', '11', '7', '17')).toMatchObject({
      common: 17n,
      ciphertext: 85n,
      recovered: 17n,
      eulerResidue: null,
    });
    expect(() => rsaProof('15', '11', '7', '88')).toThrow('primes');
    expect(() => rsaProof('17', '17', '7', '88')).toThrow('distinct');
  });
  it('only applies Euler/Fermat in the coprime case and bounds long residue displays', () => {
    expect(residues('3', '17')).toMatchObject({ prime: true, phi: 16n, common: 1n, value: 1n });
    expect(residues('2', '15')).toMatchObject({ prime: false, phi: 8n, common: 1n, value: 1n });
    expect(residues('3', '15')).toMatchObject({ prime: false, common: 3n, value: 6n });
    const large = residues('-3', '9973');
    expect(large.rows).toHaveLength(64);
    expect(large.truncated).toBe(true);
    expect(large.value).toBe(1n);
    expect(() => residues('2', '10001')).toThrow('10,000');
  });
});
describe('square-and-multiply and CRT lessons', () => {
  it('matches Table 9.3 row by row with honest operation counts', () => {
    const run = exponentiation('7', '560', '561');
    expect(run.binary).toBe('1000110000');
    expect(run.result.rows.map((row) => [row.i, row.bit, row.c, row.f])).toEqual([
      [9, 1, 1n, 7n],
      [8, 0, 2n, 49n],
      [7, 0, 4n, 157n],
      [6, 0, 8n, 526n],
      [5, 1, 17n, 160n],
      [4, 1, 35n, 241n],
      [3, 0, 70n, 298n],
      [2, 0, 140n, 166n],
      [1, 0, 280n, 67n],
      [0, 0, 560n, 1n],
    ]);
    expect(run.result.multiplications).toBe(13);
    expect(run.naiveMultiplications).toBe(560n);
    expect(exponentiation('-7', '0', '1').result).toMatchObject({
      value: 0n,
      rows: [],
      multiplications: 0,
    });
    expect(() => exponentiation('7', '-1', '561')).toThrow();
    expect(() => exponentiation('7', '1', '0')).toThrow('positive');
    expect(() => exponentiation('7', String(1n << 256n), '561')).toThrow('256 bits');
  });
  it('splits and combines the 1813-modulus lecture example, normalizing residues and rejecting non-coprime moduli', () => {
    expect(crtLesson('37,49', '23,34', '', 'combine')).toMatchObject({
      value: 1651n,
      modulus: 1813n,
      rows: [
        { partial: 49n, coefficient: 34n, term: 38318n },
        { partial: 37n, coefficient: 4n, term: 5032n },
      ],
    });
    expect(crtLesson('37 49', '', '973', 'split').residues).toEqual([11n, 42n]);
    expect(crtLesson('37 49', '', '678', 'split').residues).toEqual([12n, 41n]);
    expect(crtLesson('37 49', '', '-1', 'split')).toMatchObject({
      value: 1812n,
      residues: [36n, 48n],
    });
    expect(crtLesson('37 49', '-14 83', '', 'combine').value).toBe(1651n);
    for (const moduli of ['4,6', '1,3', '0,3', '-3,5'])
      expect(() => crtLesson(moduli, '1,2', '', 'combine')).toThrow();
    expect(() => crtLesson('37,49', '1', '', 'combine')).toThrow('matching');
  });
  it('both decryption routes agree for all lecture messages and real-size non-coprime cases; sampling discards a warm-up', () => {
    const lecture = deriveKey(17n, 11n, 7n);
    for (let message = 0; message < 187; message++) {
      let tick = 0;
      const run = compareDecryption(lecture, String(message), () => (tick += 0.25));
      expect(run.direct).toBe(BigInt(message));
      expect(run.crt).toBe(run.direct);
      expect(run.directTimes).toEqual([0.25, 0.25, 0.25, 0.25, 0.25]);
      expect(run.crtTimes).toHaveLength(5);
    }
    for (const ref of refs.keys) {
      const key = deriveKey(BigInt(ref.p), BigInt(ref.q), BigInt(ref.e));
      for (const message of [0n, 1n, key.p, key.q, key.n - 1n]) {
        const run = compareDecryption(key, String(message));
        expect(run.direct).toBe(message);
        expect(run.crt).toBe(message);
        expect(run.directTimes).toHaveLength(5);
      }
    }
    expect(median([9, 1, 3])).toBe(3);
    expect(median([4, 2])).toBe(3);
    expect(() => median([])).toThrow();
    expect(() => integer('9'.repeat(10000), 'n')).toThrow();
  }, 30000);
});
