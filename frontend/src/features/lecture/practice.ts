/**
 * Practice questions in the style of the lecture. Every answer is computed by the same
 * step-by-step functions the lessons use, so the "show the steps" solution is the real work.
 */
import { crtSolve, crtSplit, type CrtResult } from './advanced';
import {
  extendedEuclid,
  gcdTable,
  millerRabinRun,
  power,
  rsaSetup,
  type EeaResult,
  type GcdRow,
  type PowerResult,
} from './model';

export type PracticeKind =
  'gcd' | 'phi' | 'inverse' | 'd' | 'power' | 'encrypt' | 'decrypt' | 'mr' | 'crt';
export type Solution =
  | { type: 'gcd'; rows: GcdRow[]; gcd: bigint }
  | { type: 'eea'; run: EeaResult }
  | { type: 'power'; run: PowerResult }
  | { type: 'crt'; run: CrtResult }
  | { type: 'text'; lines: string[] };
export type PracticeQuestion = {
  id: string;
  kind: PracticeKind;
  title: string;
  prompt: string;
  answer: bigint;
  hint: string;
  solution: Solution;
};
export type Level = 'lecture' | 'random';

export const PRACTICE_KINDS: PracticeKind[] = [
  'gcd',
  'phi',
  'inverse',
  'd',
  'power',
  'encrypt',
  'decrypt',
  'mr',
  'crt',
];

/** A small reproducible generator so a seed always gives the same quiz. Not for cryptography. */
function generator(seed: number) {
  let state = seed >>> 0;
  return (limit: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % limit;
  };
}
const PRIMES = [11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

export function practiceQuestion(kind: PracticeKind, seed: number, level: Level): PracticeQuestion {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Use a seed from 0 to 4294967295.');
  const draw = generator(seed + PRACTICE_KINDS.indexOf(kind) * 7919);
  const lecture = level === 'lecture';
  const p = lecture ? 17n : PRIMES[draw(PRIMES.length)];
  const others = PRIMES.filter((x) => x !== p);
  const q = lecture ? 11n : others[draw(others.length)];
  const phi = (p - 1n) * (q - 1n);
  const exponents = [3n, 5n, 7n, 11n, 13n].filter((x) => x < phi && gcdTable(x, phi).gcd === 1n);
  const e = lecture ? 7n : exponents[draw(exponents.length)];
  const setup = rsaSetup(p, q, e);
  const id = `${kind}-${seed}-${level}`;
  switch (kind) {
    case 'gcd': {
      const a = lecture ? 1970n : BigInt(100 + draw(900)),
        b = lecture ? 1066n : BigInt(50 + draw(500));
      const run = gcdTable(a, b);
      return {
        id,
        kind,
        title: 'Greatest common divisor',
        prompt: `Find gcd(${a}, ${b}).`,
        answer: run.gcd,
        hint: 'gcd(a, b) = gcd(b, a mod b). Repeat until the remainder is 0.',
        solution: { type: 'gcd', ...run },
      };
    }
    case 'phi':
      return {
        id,
        kind,
        title: 'Euler’s totient',
        prompt: `n = ${p} × ${q}, both primes. Find φ(n).`,
        answer: phi,
        hint: 'φ(pq) = (p − 1)(q − 1).',
        solution: {
          type: 'text',
          lines: [`φ(n) = (p − 1)(q − 1) = ${p - 1n} × ${q - 1n} = ${phi}`],
        },
      };
    case 'inverse': {
      const m = lecture ? 1759n : BigInt(200 + draw(800));
      let b = lecture ? 550n : BigInt(2 + draw(Number(m) - 3));
      while (gcdTable(b, m).gcd !== 1n) b++;
      const run = extendedEuclid(m, b);
      return {
        id,
        kind,
        title: 'Inverse mod m',
        prompt: `Find ${b}⁻¹ mod ${m}, using the Extended Euclid table.`,
        answer: run.inverse!,
        hint: 'Start with (1, 0, m) and (0, 1, b). Stop when B3 = 1: the inverse is B2 (add m if it is negative).',
        solution: { type: 'eea', run },
      };
    }
    case 'd': {
      const run = extendedEuclid(phi, e);
      return {
        id,
        kind,
        title: 'Private exponent',
        prompt: `An RSA key has p = ${p}, q = ${q} and e = ${e}. Find d.`,
        answer: setup.d,
        hint: 'First φ(n) = (p − 1)(q − 1). Then d = e⁻¹ mod φ(n).',
        solution: { type: 'eea', run },
      };
    }
    case 'power': {
      const a = lecture ? 7n : BigInt(2 + draw(10)),
        b = lecture ? 13n : BigInt(5 + draw(30)),
        n = lecture ? 53n : 53n + BigInt(draw(20));
      const run = power(a, b, n);
      return {
        id,
        kind,
        title: 'Fast power',
        prompt: `Compute ${a}^${b} mod ${n}.`,
        answer: run.result,
        hint: 'Square and reduce: a¹, a², a⁴, a⁸ … then multiply the powers that add up to the exponent.',
        solution: { type: 'power', run },
      };
    }
    case 'encrypt': {
      const M = lecture ? 88n : BigInt(2 + draw(Number(setup.n) - 3));
      const run = power(M, setup.e, setup.n);
      return {
        id,
        kind,
        title: 'Encrypt',
        prompt: `Public key {e = ${setup.e}, n = ${setup.n}}. Encrypt M = ${M}.`,
        answer: run.result,
        hint: 'C = M^e mod n. Use square and multiply.',
        solution: { type: 'power', run },
      };
    }
    case 'decrypt': {
      const M = lecture ? 88n : BigInt(2 + draw(Number(setup.n) - 3));
      const C = power(M, setup.e, setup.n).result;
      const run = power(C, setup.d, setup.n);
      return {
        id,
        kind,
        title: 'Decrypt',
        prompt: `Private key {d = ${setup.d}, n = ${setup.n}}. Decrypt C = ${C}.`,
        answer: M,
        hint: 'M = C^d mod n. Use square and multiply.',
        solution: { type: 'power', run },
      };
    }
    case 'mr': {
      const candidates = [29n, 37n, 41n, 53n, 61n];
      const n = lecture ? 29n : candidates[draw(candidates.length)];
      const a = lecture ? 10n : BigInt(2 + draw(Number(n) - 4));
      const run = millerRabinRun(n, a);
      return {
        id,
        kind,
        title: 'Miller–Rabin',
        prompt: `n = ${n}, so n − 1 = 2^${run.k} × q with q odd. With a = ${a}, find a^q mod n.`,
        answer: run.terms[0].value,
        hint: 'Find q by halving n − 1 until it is odd, then use square and multiply.',
        solution: { type: 'power', run: power(a, run.q, n) },
      };
    }
    case 'crt': {
      const pairs: [bigint, bigint][] = [
        [7n, 11n],
        [9n, 11n],
        [8n, 15n],
        [9n, 13n],
        [11n, 13n],
        [7n, 15n],
      ];
      const [m1, m2] = lecture ? pairs[0] : pairs[draw(pairs.length)];
      const A = lecture ? 52n : BigInt(draw(Number(m1 * m2)));
      const [r1, r2] = crtSplit(A, [m1, m2]);
      const run = crtSolve([m1, m2], [r1, r2]);
      return {
        id,
        kind,
        title: 'Chinese Remainder Theorem',
        prompt: `Find A in 0 … ${m1 * m2 - 1n} with A ≡ ${r1} (mod ${m1}) and A ≡ ${r2} (mod ${m2}).`,
        answer: run.A,
        hint: 'M = m₁m₂, Mᵢ = M/mᵢ, cᵢ = Mᵢ(Mᵢ⁻¹ mod mᵢ), A = Σ aᵢcᵢ mod M.',
        solution: { type: 'crt', run },
      };
    }
  }
}

export function practiceSet(seed: number, level: Level): PracticeQuestion[] {
  return PRACTICE_KINDS.map((kind) => practiceQuestion(kind, seed, level));
}
