import { describe, expect, it } from 'vitest';
import { extendedGcd, inverse, millerRabin, modexp } from '../../engine/math';
import {
  extendedEuclid,
  gcdTable,
  isPrime,
  millerRabinRun,
  power,
  rsaSetup,
  suggestExponent,
} from './model';

describe('ch04 Euclid tables', () => {
  it('reproduces the GCD(1970, 1066) slide row for row', () => {
    const { rows, gcd } = gcdTable(1970n, 1066n);
    expect(gcd).toBe(2n);
    expect(rows.map((r) => [r.dividend, r.divisor, r.quotient, r.remainder])).toEqual(
      [
        [1970, 1066, 1, 904],
        [1066, 904, 1, 162],
        [904, 162, 5, 94],
        [162, 94, 1, 68],
        [94, 68, 1, 26],
        [68, 26, 2, 16],
        [26, 16, 1, 10],
        [16, 10, 1, 6],
        [10, 6, 1, 4],
        [6, 4, 1, 2],
        [4, 2, 2, 0],
      ].map((row) => row.map(BigInt)),
    );
  });
  it('reproduces the GCD(1160718174, 316258250) slide', () => {
    const { rows, gcd } = gcdTable(1160718174n, 316258250n);
    expect(rows.map((r) => r.quotient)).toEqual([3n, 1n, 2n, 31n, 2n, 11n, 1n, 1n, 31n, 2n]);
    expect(rows.map((r) => r.remainder).slice(0, 3)).toEqual([211943424n, 104314826n, 3313772n]);
    expect(gcd).toBe(1078n);
  });
  it('reproduces the inverse of 550 in GF(1759) table', () => {
    const run = extendedEuclid(1759n, 550n);
    expect(run.rows.map((r) => [r.q, ...r.A, ...r.B])).toEqual([
      [null, 1n, 0n, 1759n, 0n, 1n, 550n],
      [3n, 0n, 1n, 550n, 1n, -3n, 109n],
      [5n, 1n, -3n, 109n, -5n, 16n, 5n],
      [21n, -5n, 16n, 5n, 106n, -339n, 4n],
      [1n, 106n, -339n, 4n, -111n, 355n, 1n],
    ]);
    expect(run.inverse).toBe(355n);
    expect(1759n * -111n + 550n * 355n).toBe(1n);
  });
  it('matches the engine for many (m, b), including no inverse', () => {
    for (let m = 2n; m < 60n; m++)
      for (let b = 0n; b < 70n; b++) {
        const run = extendedEuclid(m, b);
        const g = extendedGcd(m, b % m).gcd;
        expect(run.gcd).toBe(g);
        if (g === 1n) {
          expect(run.inverse).toBe(inverse(b % m, m));
          expect((b * run.inverse!) % m).toBe(1n % m);
        } else expect(run.inverse).toBeNull();
      }
  });
  it('rejects bad input', () => {
    expect(() => extendedEuclid(1n, 3n)).toThrow('greater than 1');
    expect(() => gcdTable(0n, 0n)).toThrow('not defined');
  });
});

describe('ch09 exponentiation table', () => {
  it('reproduces Table 9.3: 7^560 mod 561', () => {
    const run = power(7n, 560n, 561n);
    expect(run.binary).toBe('1000110000');
    expect(run.steps.map((s) => s.i)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    expect(run.steps.map((s) => s.bit)).toEqual([1, 0, 0, 0, 1, 1, 0, 0, 0, 0]);
    expect(run.steps.map((s) => s.c)).toEqual([1n, 2n, 4n, 8n, 17n, 35n, 70n, 140n, 280n, 560n]);
    expect(run.steps.map((s) => s.f)).toEqual([
      7n,
      49n,
      157n,
      526n,
      160n,
      241n,
      298n,
      166n,
      67n,
      1n,
    ]);
    expect(run.result).toBe(1n);
  });
  it('shows 88^7 mod 187 = 11 by squaring then multiplying', () => {
    const run = power(88n, 7n, 187n);
    expect(run.squares.map((s) => s.value)).toEqual([88n, 77n, 132n]);
    expect(run.squares[1].raw).toBe(7744n);
    expect(run.needed).toEqual([0, 1, 2]);
    expect(run.products.map((p) => p.value)).toEqual([44n, 11n]);
    expect(run.result).toBe(11n);
    expect(power(11n, 23n, 187n).result).toBe(88n);
  });
  it('matches the slide shortcuts 7^5 mod 11 and 3^129 mod 11', () => {
    expect(power(7n, 5n, 11n).result).toBe(10n);
    expect(power(3n, 129n, 11n).result).toBe(4n);
  });
  it('agrees with the engine, both methods, for many inputs', () => {
    for (let n = 2n; n < 40n; n++)
      for (let a = 0n; a < 45n; a += 3n)
        for (let b = 1n; b < 70n; b += 3n) {
          const run = power(a, b, n);
          const expected = modexp(a, b, n);
          expect(run.result).toBe(expected);
          expect(run.steps[run.steps.length - 1].f).toBe(expected);
          expect(run.steps[run.steps.length - 1].c).toBe(b);
        }
    const big = 2n ** 127n - 1n;
    expect(power(123456789n, 987654321n, big).result).toBe(modexp(123456789n, 987654321n, big));
  });
  it('rejects bad input', () => {
    expect(() => power(2n, 0n, 7n)).toThrow('at least 1');
    expect(() => power(2n, 3n, 1n)).toThrow('at least 2');
  });
});

describe('ch08 Miller–Rabin', () => {
  it('reproduces Example #1: n = 29, a = 10', () => {
    const run = millerRabinRun(29n, 10n);
    expect([run.k, run.q]).toEqual([2, 7n]);
    expect(run.terms.map((t) => t.value)).toEqual([17n, 28n]);
    expect(run.verdict).toBe('maybe prime');
    expect(run.stopReason).toBe('minus-one');
  });
  it('reproduces Example #2: n = 221, a = 5', () => {
    const run = millerRabinRun(221n, 5n);
    expect([run.k, run.q]).toEqual([2, 55n]);
    expect(run.terms.map((t) => t.value)).toEqual([112n, 168n]);
    expect(run.verdict).toBe('composite');
  });
  it('lists exactly the lecture’s liars for n = 221 (21, 47, 174, 200)', () => {
    const liars: number[] = [];
    for (let a = 2n; a <= 219n; a++)
      if (millerRabinRun(221n, a).verdict === 'maybe prime') liars.push(Number(a));
    expect(liars).toEqual([21, 47, 174, 200]);
  });
  it('agrees with the engine for every base of every odd n below 400', () => {
    for (let n = 5n; n < 400n; n += 2n)
      for (let a = 2n; a <= n - 2n; a++) {
        const mine = millerRabinRun(n, a).verdict === 'maybe prime';
        expect(mine).toBe(millerRabin(n, { bases: [a] }).probablePrime);
      }
  });
  it('rejects even n and bad bases', () => {
    expect(() => millerRabinRun(28n, 3n)).toThrow('even');
    expect(() => millerRabinRun(29n, 28n)).toThrow('1 < a < n');
    expect(() => millerRabinRun(3n, 2n)).toThrow('at least 5');
  });
});

describe('ch09 RSA by hand', () => {
  it('reproduces the key setup example: p = 17, q = 11, e = 7', () => {
    const s = rsaSetup(17n, 11n, 7n);
    expect([s.n, s.phi, s.d, s.k]).toEqual([187n, 160n, 23n, 1n]);
    expect(s.coprime.gcd).toBe(1n);
    expect(power(88n, s.e, s.n).result).toBe(11n);
    expect(power(11n, s.d, s.n).result).toBe(88n);
  });
  it('round-trips every message for a few small keys', () => {
    for (const [p, q, e] of [
      [3n, 11n, 3n],
      [5n, 11n, 3n],
      [17n, 23n, 5n],
    ] as const) {
      const s = rsaSetup(p, q, e);
      for (let m = 0n; m < s.n; m++)
        expect(power(power(m, s.e, s.n).result, s.d, s.n).result).toBe(m);
    }
  });
  it('explains every rejection', () => {
    expect(() => rsaSetup(15n, 11n, 7n)).toThrow('not prime');
    expect(() => rsaSetup(11n, 11n, 7n)).toThrow('different');
    expect(() => rsaSetup(17n, 11n, 4n)).toThrow('gcd(e, φ(n)) = 4');
    expect(() => rsaSetup(17n, 11n, 160n)).toThrow('1 < e < φ(n)');
    expect(() => rsaSetup(2n, 3n, 3n)).toThrow('too small');
  });
  it('tests primality correctly and suggests a valid exponent', () => {
    const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]);
    for (let n = 0; n <= 48; n++) expect(isPrime(BigInt(n))).toBe(primes.has(n));
    expect(isPrime(2n ** 61n - 1n)).toBe(true);
    expect(isPrime((2n ** 61n - 1n) * 3n)).toBe(false);
    expect(suggestExponent(160n)).toBe(7n);
  });
});
