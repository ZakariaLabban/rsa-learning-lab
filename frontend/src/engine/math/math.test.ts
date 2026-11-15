import { describe, expect, it } from 'vitest';
import vectors from '../__vectors__/reference-vectors.json';
import {
  bitLength,
  crt,
  crtResidues,
  decryptCrt,
  decryptInt,
  deriveKey,
  encryptInt,
  extendedGcd,
  gcd,
  generatePrime,
  i2osp,
  integerRoot,
  inverse,
  lcm,
  millerRabin,
  modexp,
  os2ip,
  probablePrime,
  randomRange,
  squareAndMultiply,
  strongLiars,
  totient,
} from './index';

describe('independent Python reference vectors', () => {
  it('matches modular exponentiation, inverses and Bezout identities', () => {
    for (const v of vectors.modexp)
      expect(modexp(BigInt(v.base), BigInt(v.exponent), BigInt(v.modulus))).toBe(BigInt(v.result));
    for (const v of vectors.inverse) {
      if (v.result === null) expect(() => inverse(BigInt(v.a), BigInt(v.modulus))).toThrow();
      else expect(inverse(BigInt(v.a), BigInt(v.modulus))).toBe(BigInt(v.result));
    }
    for (const v of vectors.euclid) {
      const a = BigInt(v.a),
        b = BigInt(v.b),
        result = extendedGcd(a, b, { trace: true });
      expect(result.gcd).toBe(BigInt(v.gcd));
      expect(a * result.x + b * result.y).toBe(result.gcd);
      for (const row of result.rows) expect(a * row.s + b * row.t).toBe(row.r);
    }
  });
  it('matches fixed-base primality decisions', () => {
    for (const v of vectors.miller_rabin)
      expect(millerRabin(BigInt(v.n), { bases: v.bases.map(BigInt) }).probablePrime).toBe(
        v.probable_prime,
      );
  });
  for (const v of vectors.keys)
    it(`matches ${v.bits}-bit ciphertexts and CRT recovery, including non-coprime messages`, () => {
      const key = deriveKey(BigInt(v.p), BigInt(v.q), BigInt(v.e));
      expect(key.n).toBe(BigInt(v.n));
      expect(key.d).toBe(BigInt(v.d_phi));
      expect(bitLength(key.n)).toBe(v.bits);
      expect(key.lambda).toBe(BigInt(v.lambda));
      for (const pair of v.textbook) {
        const m = BigInt(pair.message),
          c = BigInt(pair.ciphertext);
        expect(encryptInt(m, key)).toBe(c);
        expect(decryptInt(c, key)).toBe(m);
        expect(decryptCrt(c, key, { trace: true }).value).toBe(m);
      }
    });
});

describe('lecture examples and boundary behavior', () => {
  it('reproduces both teaching keys and Table 9.3', () => {
    const key = deriveKey(17n, 11n, 7n);
    expect(key).toMatchObject({ n: 187n, phi: 160n, d: 23n });
    expect(encryptInt(88n, key)).toBe(11n);
    expect(decryptInt(11n, key)).toBe(88n);
    expect(encryptInt(65n, deriveKey(61n, 53n, 17n))).toBe(2790n);
    const trace = squareAndMultiply(7n, 560n, 561n, { trace: true });
    expect(trace.rows.map((r) => r.f)).toEqual([
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
    expect(trace.rows.at(-1)?.c).toBe(560n);
    expect(squareAndMultiply(7n, 560n, 561n, { trace: true, maxRows: 2 })).toMatchObject({
      value: 1n,
      truncated: true,
      rowCount: 10,
    });
    expect(modexp(17n, 0n, 1n)).toBe(0n);
    expect(() => modexp(2n, -1n, 5n)).toThrow();
    expect(() => modexp(2n, 3n, 0n)).toThrow();
  });
  it('reproduces Miller-Rabin witnesses/liars and limits confidence to random rounds', () => {
    expect(millerRabin(29n, { bases: [10n], trace: true })).toMatchObject({
      probablePrime: true,
      k: 2,
      q: 7n,
      randomRounds: 0,
    });
    expect(millerRabin(221n, { bases: [5n] }).probablePrime).toBe(false);
    expect(strongLiars(221n)).toEqual([21n, 47n, 174n, 200n]);
    for (const n of [-1n, 0n, 1n, 4n, 561n, 1105n, 1729n]) expect(probablePrime(n)).toBe(false);
    for (const n of [2n, 3n, 29n, 97n, 65537n]) expect(probablePrime(n)).toBe(true);
    expect(() => millerRabin(29n, { bases: [1n] })).toThrow();
    expect(() => millerRabin(29n, { rounds: 0 })).toThrow();
  });
  it('reconstructs residues and rejects unsupported CRT systems', () => {
    expect(crtResidues(973n, [37n, 49n])).toEqual([11n, 42n]);
    expect(crtResidues(973n + 678n, [37n, 49n])).toEqual([23n, 34n]);
    expect(crt([23n, 34n], [37n, 49n], { trace: true })).toMatchObject({
      value: 1651n,
      modulus: 1813n,
    });
    expect(() => crt([1n, 2n], [4n, 6n])).toThrow();
    expect(() => crt([], [])).toThrow();
    const key = deriveKey(17n, 11n, 7n);
    for (let m = 0n; m < key.n; m++) expect(decryptCrt(encryptInt(m, key), key).value).toBe(m);
    expect(() => encryptInt(key.n, key)).toThrow();
    expect(() => decryptInt(-1n, key)).toThrow();
  });
  it('preserves byte widths and zero prefixes', () => {
    expect(i2osp(256n, 4)).toEqual(new Uint8Array([0, 0, 1, 0]));
    expect(os2ip(i2osp(256n, 4))).toBe(256n);
    expect(i2osp(0n, 0)).toEqual(new Uint8Array());
    expect(bitLength(0n)).toBe(0);
    expect(() => i2osp(256n, 1)).toThrow();
    expect(() => i2osp(-1n, 4)).toThrow();
    expect(() => i2osp(1n, -1)).toThrow();
  });
  it('computes integer roots and the phi table without floating point', () => {
    expect(integerRoot(123456789n ** 3n, 3)).toBe(123456789n);
    expect(integerRoot(123456789n ** 3n - 1n, 3)).toBe(123456788n);
    expect(Array.from({ length: 30 }, (_, i) => Number(totient(BigInt(i + 1))))).toEqual([
      1, 1, 2, 2, 4, 2, 6, 4, 6, 4, 10, 4, 12, 6, 8, 8, 16, 6, 18, 8, 12, 10, 22, 8, 20, 12, 18, 12,
      28, 8,
    ]);
    expect(gcd(-12n, 18n)).toBe(6n);
    expect(lcm(-12n, 18n)).toBe(36n);
    expect(lcm(0n, 0n)).toBe(0n);
  });
  it('rejection-samples instead of introducing modulo bias', () => {
    let draws = 0;
    const source = () => new Uint8Array([draws++ === 0 ? 255 : 5]);
    expect(randomRange(10n, 19n, source)).toBe(15n);
    expect(draws).toBe(2);
    expect(randomRange(9n, 9n)).toBe(9n);
    expect(() => randomRange(9n, 8n)).toThrow();
    const prime = generatePrime(8);
    expect(bitLength(prime.prime)).toBe(8);
    expect(probablePrime(prime.prime)).toBe(true);
  });
});
