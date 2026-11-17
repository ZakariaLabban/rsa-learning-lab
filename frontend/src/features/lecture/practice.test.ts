import { describe, expect, it } from 'vitest';
import { inverse, modexp, totient } from '../../engine/math';
import { PRACTICE_KINDS, practiceQuestion, practiceSet } from './practice';

const numbers = (text: string) => text.match(/\d+/g)!.map(BigInt);

describe('practice questions', () => {
  it('lecture level uses the slide numbers', () => {
    const byKind = Object.fromEntries(practiceSet(1, 'lecture').map((q) => [q.kind, q]));
    expect(byKind.gcd.answer).toBe(2n);
    expect(byKind.inverse.answer).toBe(355n);
    expect(byKind.d.answer).toBe(23n);
    expect(byKind.encrypt.answer).toBe(11n);
    expect(byKind.decrypt.answer).toBe(88n);
    expect(byKind.phi.answer).toBe(160n);
    expect(byKind.mr.answer).toBe(17n);
    expect(byKind.crt.answer).toBe(52n);
  });
  it('every random answer agrees with independent engine math', () => {
    for (let seed = 0; seed < 300; seed++)
      for (const kind of PRACTICE_KINDS) {
        const q = practiceQuestion(kind, seed, 'random');
        const n = numbers(q.prompt);
        expect(q.answer).toBeGreaterThanOrEqual(0n);
        if (kind === 'phi') expect(q.answer).toBe(totient(n[0] * n[1]));
        if (kind === 'power') expect(q.answer).toBe(modexp(n[0], n[1], n[2]));
        if (kind === 'encrypt') expect(q.answer).toBe(modexp(n[2], n[0], n[1]));
        if (kind === 'decrypt') expect(modexp(n[2], n[0], n[1])).toBe(q.answer);
        if (kind === 'inverse') expect(q.answer).toBe(inverse(n[0], n[1]));
        if (kind === 'd') expect(q.answer).toBe(inverse(n[2], (n[0] - 1n) * (n[1] - 1n)));
        if (kind === 'mr') {
          // prompt numbers: n, 1, 2, k, a  → q = (n − 1) / 2^k
          const [modulus, k, base] = [n[0], n[3], n[4]];
          expect(q.answer).toBe(modexp(base, (modulus - 1n) >> k, modulus));
        }
        if (kind === 'crt') {
          // prompt numbers: 0, top, r1, m1, r2, m2 (A ≡ r1 (mod m1), A ≡ r2 (mod m2)
          const [r1, m1, r2, m2] = [n[2], n[3], n[4], n[5]];
          expect(q.answer % m1).toBe(r1);
          expect(q.answer % m2).toBe(r2);
        }
      }
  });
  it('is reproducible and rejects bad seeds', () => {
    expect(practiceSet(42, 'random')).toEqual(practiceSet(42, 'random'));
    expect(() => practiceQuestion('gcd', -1, 'random')).toThrow('seed');
  });
});
