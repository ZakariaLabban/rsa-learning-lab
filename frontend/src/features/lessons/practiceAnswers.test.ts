import { describe, expect, it } from 'vitest';
import { practiceQuestions, type Difficulty, type PracticeQuestion } from './practiceModel';

/*
 * Issue #18 acceptance: every question type has tests proving its generated answer.
 * Each check below re-derives the answer from the prompt text alone, with small
 * independent oracles (plain BigInt loops, brute force), never the lesson engine.
 */

const modPow = (base: bigint, exp: bigint, mod: bigint) => {
  let result = 1n % mod;
  for (let i = 0n; i < exp; i++) result = (result * base) % mod;
  return result;
};
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));
const isPrime = (n: bigint) => {
  if (n < 2n) return false;
  for (let d = 2n; d * d <= n; d++) if (n % d === 0n) return false;
  return true;
};
const phiByCounting = (n: bigint) => {
  let count = 0n;
  for (let k = 1n; k <= n; k++) if (gcd(k, n) === 1n) count++;
  return count;
};
/** Strong-probable-prime test for one base, written from the definition. */
const passesBase = (n: bigint, a: bigint) => {
  let d = n - 1n,
    s = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    s++;
  }
  let x = modPow(a, d, n);
  if (x === 1n || x === n - 1n) return true;
  for (let r = 1; r < s; r++) {
    x = (x * x) % n;
    if (x === n - 1n) return true;
  }
  return false;
};
const numbers = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);
  if (!match) throw new Error(`Prompt "${text}" does not match ${pattern}`);
  return match.slice(1).map(BigInt);
};

const byTopic = (questions: PracticeQuestion[]) =>
  Object.fromEntries(questions.map((q) => [q.topic, q])) as Record<
    PracticeQuestion['topic'],
    PracticeQuestion
  >;

const seeds = [
  ...Array.from({ length: 250 }, (_, i) => i),
  632,
  65537,
  2 ** 31 - 1,
  2 ** 31,
  0xfffffffe,
  0xffffffff,
];
const difficulties: Difficulty[] = ['intro', 'exam'];

describe('practice answers are proven independently for every question type', () => {
  for (const difficulty of difficulties)
    it(`${difficulty}: ${seeds.length} seeds`, () => {
      for (const seed of seeds) {
        const questions = practiceQuestions(seed, difficulty);
        const q = byTopic(questions);
        const at = `${difficulty} seed ${seed}`;
        expect(questions, at).toHaveLength(10);
        expect(Object.keys(q), at).toHaveLength(10);

        // Key setup: n, φ(n), d.
        const [p, qq] = numbers(q.modulus.prompt, /p=(\d+) and q=(\d+), what is n\?/);
        expect(isPrime(p) && isPrime(qq) && p !== qq, at).toBe(true);
        expect(q.modulus.answer, at).toBe(p * qq);
        expect(numbers(q.totient.prompt, /p=(\d+) and q=(\d+)/), at).toEqual([p, qq]);
        expect(q.totient.answer, at).toBe(phiByCounting(p * qq));
        const [e, phi] = numbers(q['private-exponent'].prompt, /e=(\d+) and φ\(n\)=(\d+)/);
        expect(phi, at).toBe(q.totient.answer);
        expect(gcd(e, phi), at).toBe(1n);
        const d = q['private-exponent'].answer;
        expect(d > 0n && d < phi, at).toBe(true);
        expect((e * d) % phi, at).toBe(1n);

        // Encrypt and decrypt with that key.
        const [m, encE, encN] = numbers(q.encrypt.prompt, /M=(\d+) using e=(\d+) and n=(\d+)/);
        expect([encE, encN], at).toEqual([e, p * qq]);
        expect(m < encN, at).toBe(true);
        expect(q.encrypt.answer, at).toBe(modPow(m, e, encN));
        const [c, decD, decN] = numbers(q.decrypt.prompt, /C=(\d+) using d=(\d+) and n=(\d+)/);
        expect([c, decD, decN], at).toEqual([q.encrypt.answer, d, encN]);
        expect(q.decrypt.answer, at).toBe(modPow(c, decD, decN));
        expect(q.decrypt.answer, at).toBe(m);

        // Modular inverse.
        const [a, mod] = numbers(q.inverse.prompt, /Find (\d+)⁻¹ mod (\d+)\./);
        const inverse = q.inverse.answer;
        expect(inverse > 0n && inverse < mod, at).toBe(true);
        expect((a * inverse) % mod, at).toBe(1n);

        // Square-and-multiply.
        const [base, exponent, powMod] = numbers(
          q.power.prompt,
          /Compute (\d+)\^(\d+) mod (\d+)\./,
        );
        expect(q.power.answer, at).toBe(modPow(base, exponent, powMod));

        // Miller–Rabin single-base verdict.
        const [witnessBase, candidate] = numbers(
          q['miller-rabin'].prompt,
          /does base (\d+) pass for n=(\d+)\?/,
        );
        expect(q['miller-rabin'].answer, at).toBe(passesBase(candidate, witnessBase) ? 1n : 0n);

        // CRT: the unique solution in [0, m1·m2).
        const [r1, m1, r2, m2, bound] = numbers(
          q.crt.prompt,
          /A≡(\d+) mod(\d+), A≡(\d+) mod(\d+), 0≤A<(\d+)\./,
        );
        expect(gcd(m1, m2), at).toBe(1n);
        expect(bound, at).toBe(m1 * m2);
        const solutions: bigint[] = [];
        for (let x = 0n; x < bound; x++) if (x % m1 === r1 && x % m2 === r2) solutions.push(x);
        expect(solutions, at).toEqual([q.crt.answer]);

        // Totient of a composite by counting.
        const [phiInput] = numbers(q.phi.prompt, /Compute φ\((\d+)\)\./);
        expect(q.phi.answer, at).toBe(phiByCounting(phiInput));
      }
    });

  it('keeps every question hand-solvable and its worked solution consistent', () => {
    for (const difficulty of difficulties)
      for (const seed of seeds)
        for (const question of practiceQuestions(seed, difficulty)) {
          const at = `${difficulty} seed ${seed} ${question.topic}`;
          for (const value of question.prompt.match(/\d+/g) ?? [])
            expect(BigInt(value), at).toBeLessThan(10_000n);
          expect(question.answer >= 0n && question.answer < 10_000n, at).toBe(true);
          expect(question.frames.length, at).toBeGreaterThan(0);
          expect(question.frames.at(-1)!.output.value, at).toBe(String(question.answer));
          expect(question.hint.trim(), at).not.toBe('');
        }
  });

  it('uses the lecture key for intro questions and stable, unique progress IDs', () => {
    const intro = byTopic(practiceQuestions(5, 'intro'));
    expect(intro.modulus.answer).toBe(187n);
    expect(intro['private-exponent'].answer).toBe(23n);
    for (const difficulty of difficulties) {
      const ids = new Set<string>();
      for (const seed of seeds)
        for (const question of practiceQuestions(seed, difficulty)) {
          expect(question.id).toBe(`practice.v1:${difficulty}:${seed}:${question.topic}`);
          ids.add(question.id);
        }
      expect(ids.size).toBe(seeds.length * 10);
    }
  });

  it('rejects seeds outside the documented range', () => {
    for (const seed of [-1, 0.5, 2 ** 32, Number.NaN])
      expect(() => practiceQuestions(seed)).toThrow('Use a seed from 0 to 4294967295.');
  });
});
