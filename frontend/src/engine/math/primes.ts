import { bitLength, gcd, modexp, os2ip, traceLimit, type TraceOptions } from './arithmetic';

export type RandomBytes = (length: number) => Uint8Array;
const secureBytes: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

/** Uniform range [minimum, maximum], using rejection sampling (no modulo bias). */
export function randomRange(
  minimum: bigint,
  maximum: bigint,
  randomBytes: RandomBytes = secureBytes,
): bigint {
  if (maximum < minimum) throw new RangeError('Empty random range.');
  const span = maximum - minimum;
  if (span === 0n) return minimum;
  const bits = bitLength(span),
    length = Math.ceil(bits / 8);
  if (length > 65536) throw new RangeError('Random range exceeds the byte limit.');
  while (true) {
    const bytes = randomBytes(length).slice();
    if (bytes.length !== length)
      throw new RangeError('Random source returned the wrong byte length.');
    bytes[0] &= 255 >>> (length * 8 - bits);
    const candidate = os2ip(bytes);
    if (candidate <= span) return minimum + candidate;
  }
}

export type MillerRabinRow = { base: bigint; sequence: bigint[]; passed: boolean };
export function millerRabin(
  n: bigint,
  options: TraceOptions & {
    bases?: readonly bigint[];
    rounds?: number;
    randomBytes?: RandomBytes;
  } = {},
) {
  const limit = traceLimit(options);
  const rounds = options.bases?.length ?? options.rounds ?? 64;
  if (!Number.isSafeInteger(rounds) || rounds < 1 || rounds > 256)
    throw new RangeError('Use 1..256 Miller-Rabin rounds.');
  if (options.bases && options.bases.some((a) => a < 2n || a > n - 2n))
    throw new RangeError('Bases must lie between 2 and n-2.');
  const rows: MillerRabinRow[] = [];
  let q = n - 1n,
    k = 0;
  if (n < 2n || (n > 2n && n % 2n === 0n))
    return { probablePrime: false, q, k, rows, tested: 0, randomRounds: 0, truncated: false };
  if (n === 2n || n === 3n)
    return { probablePrime: true, q, k, rows, tested: 0, randomRounds: 0, truncated: false };
  while (q % 2n === 0n) {
    q /= 2n;
    k++;
  }
  for (let i = 0; i < rounds; i++) {
    const base = options.bases?.[i] ?? randomRange(2n, n - 2n, options.randomBytes);
    let x = modexp(base, q, n);
    const sequence = [x];
    let passed = x === 1n || x === n - 1n;
    for (let j = 1; !passed && j < k; j++) {
      x = (x * x) % n;
      if (sequence.length < limit) sequence.push(x);
      if (x === n - 1n) passed = true;
      if (x === 1n) break;
    }
    if (rows.length < limit) rows.push({ base, sequence, passed });
    if (!passed)
      return {
        probablePrime: false,
        q,
        k,
        rows,
        tested: i + 1,
        randomRounds: options.bases ? 0 : i + 1,
        truncated: options.trace === true && (i + 1 > rows.length || k > limit),
      };
  }
  return {
    probablePrime: true,
    q,
    k,
    rows,
    tested: rounds,
    randomRounds: options.bases ? 0 : rounds,
    truncated: options.trace === true && (rounds > rows.length || k > limit),
  };
}

const smallPrimes = [
  2n,
  3n,
  5n,
  7n,
  11n,
  13n,
  17n,
  19n,
  23n,
  29n,
  31n,
  37n,
  41n,
  43n,
  47n,
  53n,
  59n,
  61n,
  67n,
  71n,
  73n,
  79n,
  83n,
  89n,
  97n,
];
export function probablePrime(n: bigint, rounds = 64): boolean {
  if (!Number.isSafeInteger(rounds) || rounds < 1 || rounds > 256)
    throw new RangeError('Use 1..256 rounds.');
  if (n < 2n) return false;
  for (const p of smallPrimes) if (n % p === 0n) return n === p;
  return millerRabin(n, { rounds }).probablePrime;
}

/** Prime-search primitive only; cancellable worker/key construction is issue #42. */
export function generatePrime(bits: number, e = 65537n): { prime: bigint; candidates: number } {
  if (!Number.isSafeInteger(bits) || bits < 2 || bits > 4096 || e <= 1n || e % 2n === 0n)
    throw new RangeError('Use 2..4096 bits and an odd exponent greater than one.');
  const low = 1n << BigInt(bits - 1),
    high = (low << 1n) - 1n;
  for (let candidates = 1; ; candidates++) {
    const candidate = randomRange(low, high) | 1n;
    if (gcd(e, candidate - 1n) === 1n && probablePrime(candidate))
      return { prime: candidate, candidates };
  }
}

export function strongLiars(n: bigint): bigint[] {
  if (n < 5n || n > 10000n || n % 2n === 0n)
    throw new RangeError('Use an odd teaching integer from 5 to 10000.');
  const result: bigint[] = [];
  for (let a = 2n; a <= n - 2n; a++)
    if (millerRabin(n, { bases: [a] }).probablePrime) result.push(a);
  return result;
}
