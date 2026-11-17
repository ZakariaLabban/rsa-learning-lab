/**
 * Calculations exactly as the lectures (ch04, ch08, ch09) present them.
 * Every function returns the rows the slide tables show, so the UI can draw them one by one.
 * Small, independent BigInt code: tests compare it with the engine and with the slide numbers.
 */

export const MAX_DIGITS = 40;

export function parseWhole(text: string, name: string, min = 0n): bigint {
  const value = text.trim();
  if (!value) throw new Error(`Enter ${name}.`);
  if (!/^[0-9]+$/.test(value)) throw new Error(`${name} must be a whole number (digits only).`);
  if (value.length > MAX_DIGITS)
    throw new Error(`${name} is limited to ${MAX_DIGITS} digits here.`);
  const n = BigInt(value);
  if (n < min) throw new Error(`${name} must be at least ${min}.`);
  return n;
}

const mod = (a: bigint, n: bigint) => ((a % n) + n) % n;

/* ───────────── ch04: Euclidean algorithm ───────────── */

/** One line of the lecture's GCD example: dividend = quotient × divisor + remainder. */
export type GcdRow = { dividend: bigint; divisor: bigint; quotient: bigint; remainder: bigint };

export function gcdTable(a: bigint, b: bigint): { rows: GcdRow[]; gcd: bigint } {
  if (a < 0n || b < 0n) throw new Error('Use non-negative numbers.');
  if (a === 0n && b === 0n) throw new Error('gcd(0, 0) is not defined.');
  const rows: GcdRow[] = [];
  let A = a,
    B = b;
  while (B !== 0n) {
    const quotient = A / B,
      remainder = A % B;
    rows.push({ dividend: A, divisor: B, quotient, remainder });
    A = B;
    B = remainder;
  }
  return { rows, gcd: A };
}

type Triple = [bigint, bigint, bigint];
/** A row of the lecture's inverse table: Q, then (A1, A2, A3) and (B1, B2, B3). */
export type EeaRow = { q: bigint | null; A: Triple; B: Triple };
export type EeaResult = {
  m: bigint;
  b: bigint;
  /** True when the input b was larger than m and was first reduced mod m. */
  reduced: boolean;
  rows: EeaRow[];
  gcd: bigint;
  /** b⁻¹ mod m, or null when gcd(m, b) ≠ 1. */
  inverse: bigint | null;
  /** B2 in the last row before reducing mod m (can be negative). */
  b2: bigint | null;
};

/** EXTENDED EUCLID(m, b) from the "Finding Inverses" slide, row for row. */
export function extendedEuclid(m: bigint, bInput: bigint): EeaResult {
  if (m <= 1n) throw new Error('m must be greater than 1.');
  if (bInput < 0n) throw new Error('b must not be negative.');
  const b = bInput % m;
  let A: Triple = [1n, 0n, m],
    B: Triple = [0n, 1n, b];
  const rows: EeaRow[] = [{ q: null, A, B }];
  for (let guard = 0; guard < 5000; guard++) {
    if (B[2] === 0n)
      return { m, b, reduced: b !== bInput, rows, gcd: A[2], inverse: null, b2: null };
    if (B[2] === 1n)
      return { m, b, reduced: b !== bInput, rows, gcd: 1n, inverse: mod(B[1], m), b2: B[1] };
    const q = A[2] / B[2];
    const T: Triple = [A[0] - q * B[0], A[1] - q * B[1], A[2] - q * B[2]];
    A = B;
    B = T;
    rows.push({ q, A, B });
  }
  throw new Error('Too many steps.');
}

/* ───────────── ch09: square and multiply ───────────── */

/** One column of the lecture's exponentiation table, with the arithmetic that produced it. */
export type PowerStep = {
  i: number;
  bit: 0 | 1;
  /** The exponent built so far (the lecture's c). */
  c: bigint;
  /** f before this step. */
  before: bigint;
  /** f × f, and the same reduced mod n. */
  squareRaw: bigint;
  squared: bigint;
  /** f × a before reduction when the bit is 1, otherwise null. */
  multiplyRaw: bigint | null;
  /** The lecture's f after this step. */
  f: bigint;
};
/** a^(2^j) mod n: repeated squaring, simplifying after each square. */
export type SquareRow = { j: number; power: bigint; raw: bigint | null; value: bigint };
/** One multiplication when combining the needed powers. */
export type ProductRow = { left: bigint; right: bigint; raw: bigint; value: bigint; power: bigint };
export type PowerResult = {
  a: bigint;
  base: bigint;
  exponent: bigint;
  n: bigint;
  binary: string;
  /** The slide's table, left to right (i from the top bit down to 0). */
  steps: PowerStep[];
  /** The by-hand method: powers of the base, then the needed ones multiplied. */
  squares: SquareRow[];
  needed: number[];
  products: ProductRow[];
  result: bigint;
};

export function power(a: bigint, exponent: bigint, n: bigint): PowerResult {
  if (n < 2n) throw new Error('n must be at least 2.');
  if (exponent < 1n) throw new Error('The exponent must be at least 1.');
  if (a < 0n) throw new Error('The base must not be negative.');
  const base = a % n;
  const binary = exponent.toString(2);
  const k = binary.length - 1;

  const steps: PowerStep[] = [];
  let c = 0n,
    f = 1n;
  for (let i = k; i >= 0; i--) {
    const bit = binary[k - i] === '1' ? 1 : 0;
    const before = f;
    const squareRaw = f * f;
    const squared = squareRaw % n;
    c = 2n * c;
    let multiplyRaw: bigint | null = null;
    f = squared;
    if (bit) {
      c += 1n;
      multiplyRaw = f * base;
      f = multiplyRaw % n;
    }
    steps.push({ i, bit: bit as 0 | 1, c, before, squareRaw, squared, multiplyRaw, f });
  }

  const squares: SquareRow[] = [];
  let value = base;
  for (let j = 0; j <= k; j++) {
    if (j === 0) squares.push({ j, power: 1n, raw: null, value });
    else {
      const raw = value * value;
      value = raw % n;
      squares.push({ j, power: 1n << BigInt(j), raw, value });
    }
  }
  const needed: number[] = [];
  for (let j = 0; j <= k; j++) if (binary[k - j] === '1') needed.push(j);
  const products: ProductRow[] = [];
  let running = squares[needed[0]].value,
    exp = squares[needed[0]].power;
  for (const j of needed.slice(1)) {
    const raw = running * squares[j].value;
    exp += squares[j].power;
    products.push({ left: running, right: squares[j].value, raw, value: raw % n, power: exp });
    running = raw % n;
  }
  return { a, base, exponent, n, binary, steps, squares, needed, products, result: running };
}

/* ───────────── ch08: Miller–Rabin ───────────── */

export type MrTerm = {
  /** j in a^(2^j · q); the first term is j = 0, i.e. a^q. */
  j: number;
  exponent: bigint;
  /** Previous term squared (null for the first term, a^q itself). */
  squareRaw: bigint | null;
  value: bigint;
  isOne: boolean;
  isMinusOne: boolean;
};
export type MillerRabinRun = {
  n: bigint;
  a: bigint;
  k: number;
  q: bigint;
  terms: MrTerm[];
  /** Index into terms where the test stopped, or null when it ran out of terms. */
  stoppedAt: number | null;
  stopReason: 'one' | 'minus-one' | null;
  verdict: 'maybe prime' | 'composite';
};

/** TEST(n) from the "Miller Rabin Algorithm" slide, with a chosen a. */
export function millerRabinRun(n: bigint, a: bigint): MillerRabinRun {
  if (n < 5n) throw new Error('Use an odd n of at least 5 (n = 3 is prime).');
  if (n % 2n === 0n)
    throw new Error('n is even, so it is divisible by 2 and composite. Miller–Rabin needs odd n.');
  if (a <= 1n || a >= n - 1n) throw new Error(`Pick a with 1 < a < n − 1 (that is 2 … ${n - 2n}).`);
  let q = n - 1n,
    k = 0;
  while (q % 2n === 0n) {
    q /= 2n;
    k++;
  }
  const terms: MrTerm[] = [];
  let value = power(a, q, n).result;
  for (let j = 0; j < k; j++) {
    const squareRaw = j === 0 ? null : value * value;
    if (j > 0) value = squareRaw! % n;
    terms.push({
      j,
      exponent: (1n << BigInt(j)) * q,
      squareRaw,
      value,
      isOne: value === 1n,
      isMinusOne: value === n - 1n,
    });
  }
  // Step 3: a^q = 1  → maybe prime.   Step 4: some a^(2^j q) = n − 1 → maybe prime.
  if (terms[0].isOne)
    return { n, a, k, q, terms, stoppedAt: 0, stopReason: 'one', verdict: 'maybe prime' };
  const hit = terms.findIndex((t) => t.isMinusOne);
  if (hit >= 0)
    return { n, a, k, q, terms, stoppedAt: hit, stopReason: 'minus-one', verdict: 'maybe prime' };
  return { n, a, k, q, terms, stoppedAt: null, stopReason: null, verdict: 'composite' };
}

/* ───────────── ch09: RSA by hand ───────────── */

export function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let q = n - 1n,
    k = 0;
  while (q % 2n === 0n) {
    q /= 2n;
    k++;
  }
  // The first twelve prime bases decide primality for every n below 3.3 × 10^24;
  // beyond that this is the probabilistic test the lecture describes.
  witness: for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    let x = power(a, q, n).result;
    if (x === 1n || x === n - 1n) continue;
    for (let j = 1; j < k; j++) {
      x = (x * x) % n;
      if (x === n - 1n) continue witness;
    }
    return false;
  }
  return true;
}

export type RsaSetup = {
  p: bigint;
  q: bigint;
  n: bigint;
  phi: bigint;
  e: bigint;
  /** gcd(e, φ(n)) = 1 as a Euclid table. */
  coprime: { rows: GcdRow[]; gcd: bigint };
  /** d = e⁻¹ mod φ(n) from the inverse table. */
  inverse: EeaResult;
  d: bigint;
  /** e·d = 1 + k·φ(n). */
  k: bigint;
};

/** The seven steps of the "RSA Key Setup: Example" slide. */
export function rsaSetup(p: bigint, q: bigint, e: bigint): RsaSetup {
  if (!isPrime(p)) throw new Error(`p = ${p} is not prime. Pick a prime.`);
  if (!isPrime(q)) throw new Error(`q = ${q} is not prime. Pick a prime.`);
  if (p === q) throw new Error('p and q must be different primes.');
  const n = p * q,
    phi = (p - 1n) * (q - 1n);
  if (phi <= 2n) throw new Error('These primes are too small. Try p = 11, q = 17.');
  if (e <= 1n || e >= phi) throw new Error(`e must satisfy 1 < e < φ(n) = ${phi}.`);
  const coprime = gcdTable(e, phi);
  if (coprime.gcd !== 1n)
    throw new Error(`gcd(e, φ(n)) = ${coprime.gcd}, not 1. Choose a different e.`);
  const inverse = extendedEuclid(phi, e);
  const d = inverse.inverse!;
  return { p, q, n, phi, e, coprime, inverse, d, k: (e * d - 1n) / phi };
}

export function suggestExponent(phi: bigint): bigint {
  for (const e of [7n, 3n, 5n, 11n, 13n, 17n, 65537n])
    if (e < phi && gcdTable(e, phi).gcd === 1n) return e;
  for (let e = 3n; e < phi; e += 2n) if (gcdTable(e, phi).gcd === 1n) return e;
  return 3n;
}
