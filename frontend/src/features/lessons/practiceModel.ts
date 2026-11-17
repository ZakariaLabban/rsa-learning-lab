import { gcd, totient } from '../../engine/math';
import { exponentiation, crtLesson, primality } from '../number-theory/model';
import { euclidInverse } from '../euclid/euclidModel';
import { buildKey } from '../keys/wizardModel';
import { crtFrames, euclidFrames, keyFrames, powerFrames, primalityFrames } from './mathTraces';
import { datum, frame, type TraceFrame } from './traceTypes';

export type Difficulty = 'intro' | 'exam';
export type PracticeTopic =
  | 'modulus'
  | 'totient'
  | 'private-exponent'
  | 'encrypt'
  | 'decrypt'
  | 'inverse'
  | 'power'
  | 'miller-rabin'
  | 'crt'
  | 'phi';
export type PracticeQuestion = {
  id: string;
  topic: PracticeTopic;
  prompt: string;
  answer: bigint;
  frames: TraceFrame[];
  hint: string;
};
/** Reproducible 32-bit PRNG for exercises only; never used for cryptographic keys/randomness. */
export function practiceQuestions(
  seed: number,
  difficulty: Difficulty = 'intro',
): PracticeQuestion[] {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Use a seed from 0 to 4294967295.');
  let state = seed >>> 0;
  const draw = (limit: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % limit;
  };
  const primes = [11n, 13n, 17n, 19n, 23n, 29n];
  const p = difficulty === 'intro' ? 17n : primes[draw(primes.length)];
  const choices = primes.filter((q) => q !== p),
    q = difficulty === 'intro' ? 11n : choices[draw(choices.length)];
  const phi = (p - 1n) * (q - 1n),
    validE = [3n, 5n, 7n, 11n, 17n].filter((e) => e < phi && gcd(e, phi) === 1n);
  const key = buildKey(p, q, difficulty === 'intro' ? 7n : validE[draw(validE.length)]).key;
  const message = BigInt(2 + draw(difficulty === 'intro' ? 40 : 80));
  const power = exponentiation(String(message), String(key.e), String(key.n));
  const decryption = exponentiation(String(power.result.value), String(key.d), String(key.n));
  const inverse = euclidInverse(key.e, key.phi);
  const a = difficulty === 'intro' ? 7n : BigInt(2 + draw(10)),
    b = difficulty === 'intro' ? 13n : BigInt(5 + draw(20));
  const modularPower = exponentiation(String(a), String(b), '53');
  const m1 = difficulty === 'intro' ? 37n : 11n,
    m2 = difficulty === 'intro' ? 49n : 13n;
  const original = BigInt(draw(Number(m1 * m2))),
    crt = crtLesson(
      `${m1},${m2}`,
      `${original % m1},${original % m2}`,
      String(original),
      'combine',
    );
  const [candidate, base] = (
    [
      [29, 10],
      [221, 5],
      [341, 2],
      [91, 3],
    ] as const
  )[draw(4)];
  const prime = primality(String(candidate), 'typed', String(base), 1);
  const n = BigInt([12, 20, 27, 30, 36, 45][draw(6)]),
    phiFrames: TraceFrame[] = [];
  let remaining = n,
    current = n;
  for (let factor = 2n; factor <= remaining; factor++)
    if (remaining % factor === 0n) {
      const before = current;
      current = (current / factor) * (factor - 1n);
      phiFrames.push(
        frame(
          `Remove multiples of ${factor}`,
          'For each distinct prime factor r, multiply the count by (r−1)/r.',
          [datum('previous count', before), datum('prime factor', factor)],
          'φ update',
          datum('remaining count', current),
          `${before} ÷ ${factor} × ${factor - 1n} = ${current}`,
        ),
      );
      while (remaining % factor === 0n) remaining /= factor;
    }
  const make = (
    topic: PracticeTopic,
    prompt: string,
    answer: bigint,
    frames: TraceFrame[],
    hint: string,
  ): PracticeQuestion => ({
    id: `practice.v1:${difficulty}:${seed}:${topic}`,
    topic,
    prompt,
    answer,
    frames,
    hint,
  });
  return [
    make(
      'modulus',
      `For p=${p} and q=${q}, what is n?`,
      key.n,
      keyFrames(key, true),
      'Multiply the two primes.',
    ),
    make(
      'totient',
      `For p=${p} and q=${q}, what is φ(n)?`,
      key.phi,
      keyFrames(key, true),
      'Use (p−1)(q−1).',
    ),
    make(
      'private-exponent',
      `Find d when e=${key.e} and φ(n)=${key.phi}.`,
      key.d,
      euclidFrames(inverse),
      'Find the modular inverse using Extended Euclid.',
    ),
    make(
      'encrypt',
      `Encrypt M=${message} using e=${key.e} and n=${key.n}.`,
      power.result.value,
      powerFrames(power),
      'Reduce modulo n after each square and multiply.',
    ),
    make(
      'decrypt',
      `Decrypt C=${power.result.value} using d=${key.d} and n=${key.n}.`,
      message,
      powerFrames(decryption),
      'Use the private exponent and square-and-multiply.',
    ),
    make(
      'inverse',
      `Find ${key.e}⁻¹ mod ${key.phi}.`,
      inverse.inverse!,
      euclidFrames(inverse),
      'Track the Bézout coefficients and normalize the inverse.',
    ),
    make(
      'power',
      `Compute ${a}^${b} mod 53.`,
      modularPower.result.value,
      powerFrames(modularPower),
      'Read the exponent in binary.',
    ),
    make(
      'miller-rabin',
      `Miller–Rabin: does base ${base} pass for n=${candidate}? Enter 1 for passes this base, or 0 for a composite witness.`,
      prime.result!.probablePrime ? 1n : 0n,
      [
        ...primalityFrames(prime, 0),
        frame(
          'Encode the verdict',
          'A pass is not a primality proof.',
          [datum('base passes', String(prime.result!.probablePrime))],
          'answer code',
          datum('answer', prime.result!.probablePrime ? 1 : 0),
        ),
      ],
      'Compute a^q mod n, then inspect the squaring sequence.',
    ),
    make(
      'crt',
      `Reconstruct A: A≡${original % m1} mod${m1}, A≡${original % m2} mod${m2}, 0≤A<${m1 * m2}.`,
      crt.value,
      crtFrames(crt),
      'Combine the two CRT lanes.',
    ),
    make('phi', `Compute φ(${n}).`, totient(n), phiFrames, 'Use each distinct prime factor once.'),
  ];
}
