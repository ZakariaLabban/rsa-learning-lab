import { describe, expect, it } from 'vitest';
import { crt as engineCrt, decryptCrt, deriveKey, modexp } from '../../engine/math';
import {
  broadcastAttack,
  broadcastCiphertexts,
  crackKey,
  crtDecrypt,
  crtSolve,
  crtSplit,
  fermat,
  guessAttack,
  integerRoot,
  reducedResidues,
  signByHand,
  trialDivision,
  whyRsaWorks,
} from './advanced';
import { rsaSetup } from './model';

describe('CRT (ch08)', () => {
  it('splits and rebuilds A for the 1813 example moduli 37 and 49', () => {
    const residues = crtSplit(1813n, [37n, 49n]);
    expect(residues).toEqual([1813n % 37n, 1813n % 49n]);
    const run = crtSolve([37n, 49n], residues);
    expect(run.M).toBe(1813n);
    expect(run.A).toBe(0n); // 1813 = 37 × 49, so A mod M = 0
    expect(run.rows[0].Mi).toBe(49n);
    expect(run.rows[0].c).toBe(run.rows[0].Mi * run.rows[0].invValue);
  });
  it('agrees with the engine for many values and moduli sets', () => {
    for (const moduli of [
      [3n, 5n],
      [7n, 11n, 13n],
      [4n, 9n, 25n],
      [37n, 49n],
    ]) {
      const M = moduli.reduce((a, b) => a * b, 1n);
      for (let A = 0n; A < M; A += M > 300n ? 17n : 1n) {
        const residues = crtSplit(A, moduli);
        expect(crtSolve(moduli, residues).A).toBe(A);
        expect(crtSolve(moduli, residues).A).toBe(engineCrt(residues, moduli).value);
      }
    }
  });
  it('rejects moduli that are not coprime, naming the pair', () => {
    expect(() => crtSolve([6n, 9n], [1n, 2n])).toThrow('gcd(6, 9) = 3');
    expect(() => crtSolve([7n], [1n])).toThrow('2 to 6');
  });
  it('decrypts RSA with CRT exactly like direct decryption', () => {
    for (const [p, q, e] of [
      [17n, 11n, 7n],
      [61n, 53n, 17n],
      [101n, 103n, 7n],
    ] as const) {
      const key = deriveKey(p, q, e);
      for (let M = 0n; M < key.n; M += key.n > 500n ? 97n : 1n) {
        const C = modexp(M, e, key.n);
        const run = crtDecrypt(C, key.d, p, q);
        expect(run.M).toBe(M);
        expect(run.M).toBe(decryptCrt(C, key).value);
      }
    }
    expect(crtDecrypt(11n, 23n, 17n, 11n).M).toBe(88n);
  });
});

describe('Fermat, Euler and why RSA works', () => {
  it('reproduces 7^18 mod 19 = 1 and lists reduced residues of 10', () => {
    const run = fermat(7n, 19n);
    expect(run.run.result).toBe(1n);
    expect(run.run.squares.map((s) => s.value).slice(0, 5)).toEqual([7n, 11n, 7n, 11n, 7n]);
    expect(reducedResidues(10n).residues).toEqual([1n, 3n, 7n, 9n]);
    expect(() => fermat(3n, 15n)).toThrow('not prime');
  });
  it('recovers every message and shows Euler’s M^φ = 1 when gcd(M, n) = 1', () => {
    const setup = rsaSetup(17n, 11n, 7n);
    for (let M = 1n; M < setup.n; M++) {
      const run = whyRsaWorks(setup, M);
      expect(run.recovered).toBe(M);
      if (run.common === 1n) expect(run.euler!.result).toBe(1n);
      else expect(run.euler).toBeNull();
    }
    expect(whyRsaWorks(setup, 88n).C).toBe(11n);
  });
});

describe('signatures by hand', () => {
  it('signs with d and verifies with e; altering the message fails', () => {
    const setup = rsaSetup(17n, 11n, 7n);
    const good = signByHand(setup, 88n);
    expect(good.sign.result).toBe(modexp(88n, 23n, 187n));
    expect(good.valid).toBe(true);
    expect(signByHand(setup, 88n, 89n).valid).toBe(false);
    for (let M = 0n; M < 187n; M++) expect(signByHand(setup, M).valid).toBe(true);
  });
});

describe('attacks', () => {
  it('factors by trial division and then reads the message', () => {
    const run = trialDivision(187n);
    expect(run.factor).toBe(11n);
    expect(run.rows.map((r) => r.d)).toEqual([2, 3, 5, 7, 11]);
    const crack = crackKey(187n, 7n, 11n);
    expect([crack.p, crack.q, crack.phi, crack.d, crack.M]).toEqual([11n, 17n, 160n, 23n, 88n]);
    expect(trialDivision(97n).factor).toBeNull();
    const big = crackKey(999985999949n, 65537n, modexp(123456n, 65537n, 999985999949n));
    expect(big.M).toBe(123456n);
    expect(() => trialDivision(10n ** 13n)).toThrow('limited');
    // n = p × p is not an RSA modulus: no silent wrong answer.
    expect(() => crackKey(49n, 5n, 3n)).toThrow('perfect square');
  });
  it('computes exact integer roots', () => {
    expect(integerRoot(1000000n, 3n)).toEqual({ root: 100n, exact: true });
    expect(integerRoot(1000001n, 3n)).toEqual({ root: 100n, exact: false });
    expect(integerRoot(0n, 3n).root).toBe(0n);
  });
  it('recovers a message sent with e = 3 to three recipients', () => {
    const moduli = [187n, 667n, 1927n];
    for (const M of [2n, 100n, 186n]) {
      const run = broadcastAttack(moduli, broadcastCiphertexts(M, moduli, 3n), 3n);
      expect(run.exact).toBe(true);
      expect(run.root).toBe(M);
    }
    expect(() => broadcastCiphertexts(200n, moduli, 3n)).toThrow('smaller than every modulus');
  });
  it('matches the intercepted ciphertext to one candidate', () => {
    const setup = rsaSetup(17n, 11n, 7n);
    const C = modexp(34n, 7n, 187n);
    const rows = guessAttack(setup, [12n, 34n], C);
    expect(rows.map((r) => r.match)).toEqual([false, true]);
  });
});
