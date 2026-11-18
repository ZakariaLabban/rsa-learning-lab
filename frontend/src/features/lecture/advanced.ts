// the other lecture topics: CRT, why RSA works, signatures and the attacks.
// uses the functions from model.ts
import {
  extendedEuclid,
  gcdTable,
  isPrime,
  power,
  type EeaResult,
  type PowerResult,
  type RsaSetup,
} from './model';

const gcdOf = (a: bigint, b: bigint) => gcdTable(a, b).gcd;
const mod = (a: bigint, n: bigint) => ((a % n) + n) % n;

// ch08: Chinese Remainder Theorem
export type CrtRow = {
  m: bigint;
  // A mod m.
  a: bigint;
  // mᵢ = M / mᵢ.
  Mi: bigint;
  // mᵢ⁻¹ mod mᵢ, found with the Extended Euclid table.
  inverse: EeaResult;
  invValue: bigint;
  // cᵢ = Mᵢ × (Mᵢ⁻¹ mod mᵢ).
  c: bigint;
  // aᵢ × cᵢ.
  term: bigint;
};
export type CrtResult = {
  moduli: bigint[];
  M: bigint;
  rows: CrtRow[];
  sum: bigint;
  // the unique A in 0 … M − 1.
  A: bigint;
};

export function crtSplit(A: bigint, moduli: readonly bigint[]): bigint[] {
  return moduli.map((m) => mod(A, m));
}

// rebuilds A (mod M) from its residues, exactly as the "Chinese Remainder Theorem" slide.
export function crtSolve(moduli: readonly bigint[], residues: readonly bigint[]): CrtResult {
  if (moduli.length < 2 || moduli.length > 6) throw new Error('Use 2 to 6 moduli.');
  if (moduli.length !== residues.length) throw new Error('Give one residue for each modulus.');
  if (moduli.some((m) => m < 2n)) throw new Error('Every modulus must be at least 2.');
  for (let i = 0; i < moduli.length; i++)
    for (let j = i + 1; j < moduli.length; j++) {
      const g = gcdOf(moduli[i], moduli[j]);
      if (g !== 1n)
        throw new Error(
          `gcd(${moduli[i]}, ${moduli[j]}) = ${g}, not 1. The moduli must be pairwise relatively prime.`,
        );
    }
  const M = moduli.reduce((product, m) => product * m, 1n);
  const rows: CrtRow[] = moduli.map((m, i) => {
    const Mi = M / m;
    const inverse = extendedEuclid(m, Mi % m);
    const invValue = inverse.inverse!;
    const c = Mi * invValue;
    const a = mod(residues[i], m);
    return { m, a, Mi, inverse, invValue, c, term: a * c };
  });
  const sum = rows.reduce((total, row) => total + row.term, 0n);
  return { moduli: [...moduli], M, rows, sum, A: sum % M };
}

export type CrtDecryption = {
  C: bigint;
  d: bigint;
  p: bigint;
  q: bigint;
  n: bigint;
  // for each prime: C mod prime, the reduced exponent, and the small power.
  parts: {
    prime: bigint;
    cr: bigint;
    exponent: bigint;
    // true when d mod (prime − 1) was 0 and prime − 1 was used instead.
    exponentAdjusted: boolean;
    value: bigint;
    run: PowerResult | null;
  }[];
  combine: CrtResult;
  M: bigint;
};

// RSA decryption by CRT: work mod p and mod q separately, then combine (ch09 "Efficient Decryption").
export function crtDecrypt(C: bigint, d: bigint, p: bigint, q: bigint): CrtDecryption {
  const n = p * q;
  if (C < 0n || C >= n) throw new Error(`C must satisfy 0 ≤ C < n = ${n}.`);
  if (d < 1n) throw new Error('d must be at least 1.');
  const parts = [p, q].map((prime) => {
    const cr = C % prime;
    let exponent = d % (prime - 1n),
      exponentAdjusted = false;
    if (exponent === 0n) {
      exponent = prime - 1n;
      exponentAdjusted = true;
    }
    if (cr === 0n) return { prime, cr, exponent, exponentAdjusted, value: 0n, run: null };
    const run = power(cr, exponent, prime);
    return { prime, cr, exponent, exponentAdjusted, value: run.result, run };
  });
  const combine = crtSolve([p, q], [parts[0].value, parts[1].value]);
  return { C, d, p, q, n, parts, combine, M: combine.A };
}

// ch08/09: Fermat, Euler and why RSA works
export function reducedResidues(n: bigint): { residues: bigint[]; complete: number } {
  if (n < 2n || n > 300n) throw new Error('Use 2 ≤ n ≤ 300 to list the residues.');
  const residues: bigint[] = [];
  for (let k = 1n; k < n; k++) if (gcdOf(k, n) === 1n) residues.push(k);
  return { residues, complete: Number(n) };
}

export function fermat(a: bigint, p: bigint) {
  if (!isPrime(p)) throw new Error(`p = ${p} is not prime. Fermat’s theorem needs a prime p.`);
  if (a < 1n || a >= p) throw new Error(`Use a with 1 ≤ a < p = ${p}.`);
  return { a, p, run: power(a, p - 1n, p) };
}

export type WhyRsaRun = {
  setup: RsaSetup;
  M: bigint;
  // gcd(M, n).
  common: bigint;
  C: bigint;
  encrypt: PowerResult;
  decrypt: PowerResult;
  // M^φ(n) mod n, when gcd(M, n) = 1.
  euler: PowerResult | null;
  recovered: bigint;
};

export function whyRsaWorks(setup: RsaSetup, M: bigint): WhyRsaRun {
  if (M < 1n || M >= setup.n) throw new Error(`M must satisfy 1 ≤ M < n = ${setup.n}.`);
  const common = gcdOf(M, setup.n);
  const encrypt = power(M, setup.e, setup.n);
  const decrypt = power(encrypt.result, setup.d, setup.n);
  const euler = common === 1n ? power(M, setup.phi, setup.n) : null;
  return {
    setup,
    M,
    common,
    C: encrypt.result,
    encrypt,
    decrypt,
    euler,
    recovered: decrypt.result,
  };
}

// ch09: signatures (authentication) by hand
export type SignatureRun = {
  setup: RsaSetup;
  M: bigint;
  // S = M^d mod n, made with the PRIVATE key.
  sign: PowerResult;
  // what the receiver gets and checks, possibly altered.
  receivedM: bigint;
  // S^e mod n, computed with the PUBLIC key.
  verify: PowerResult;
  valid: boolean;
};

export function signByHand(setup: RsaSetup, M: bigint, receivedM: bigint = M): SignatureRun {
  for (const [name, value] of [
    ['M', M],
    ['the received message', receivedM],
  ] as const)
    if (value < 0n || value >= setup.n)
      throw new Error(`${name} must satisfy 0 ≤ M < n = ${setup.n}.`);
  const sign = power(M, setup.d, setup.n);
  const verify = power(sign.result, setup.e, setup.n);
  return { setup, M, sign, receivedM, verify, valid: verify.result === receivedM };
}

// ch09: the factoring problem
export type FactorRun = {
  n: bigint;
  // prime divisors tried, in order, up to and including the one that worked.
  rows: { d: number; remainder: bigint }[];
  // how many tries there were in total (rows can be shortened for display).
  tries: number;
  shownFirst: number;
  factor: bigint | null;
  other: bigint | null;
  limit: number;
};

const MAX_FACTOR_N = 10n ** 12n;
export function primesUpTo(limit: number): number[] {
  const flags = new Uint8Array(limit + 1).fill(1);
  const list: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (!flags[i]) continue;
    list.push(i);
    for (let j = i * i; j <= limit; j += i) flags[j] = 0;
  }
  return list;
}

// trial division by primes up to √n (the "sieve using trial division" slide).
export function trialDivision(n: bigint, shown = 40): FactorRun {
  if (n < 4n) throw new Error('Use n ≥ 4.');
  if (n > MAX_FACTOR_N) throw new Error('Trial division here is limited to n ≤ 10¹² (13 digits).');
  const limit = Math.floor(Math.sqrt(Number(n))) + 1;
  const rows: FactorRun['rows'] = [];
  let tries = 0;
  for (const d of primesUpTo(limit)) {
    if (BigInt(d) * BigInt(d) > n) break;
    tries++;
    const remainder = n % BigInt(d);
    if (rows.length < shown || remainder === 0n) rows.push({ d, remainder });
    if (remainder === 0n)
      return {
        n,
        rows,
        tries,
        shownFirst: shown,
        factor: BigInt(d),
        other: n / BigInt(d),
        limit,
      };
  }
  return { n, rows, tries, shownFirst: shown, factor: null, other: null, limit };
}

export type CrackRun = {
  factoring: FactorRun;
  p: bigint;
  q: bigint;
  phi: bigint;
  inverse: EeaResult;
  d: bigint;
  decrypt: PowerResult;
  M: bigint;
};

// everything an attacker does once n is factored: φ(n), d, then M = C^d mod n.
export function crackKey(n: bigint, e: bigint, C: bigint): CrackRun {
  const factoring = trialDivision(n);
  if (factoring.factor === null) throw new Error(`${n} has no small factor: it looks prime.`);
  const p = factoring.factor,
    q = factoring.other!;
  if (p === q)
    throw new Error(
      `n = ${p} × ${p} is a perfect square. An RSA modulus uses two different primes.`,
    );
  if (!isPrime(q))
    throw new Error('n has more than two prime factors, so it is not an RSA modulus.');
  const phi = (p - 1n) * (q - 1n);
  if (e <= 1n || e >= phi || gcdOf(e, phi) !== 1n)
    throw new Error(`e must satisfy 1 < e < φ(n) = ${phi} and gcd(e, φ(n)) = 1.`);
  if (C < 0n || C >= n) throw new Error(`C must satisfy 0 ≤ C < n = ${n}.`);
  const inverse = extendedEuclid(phi, e);
  const d = inverse.inverse!;
  const decrypt = power(C, d, n);
  return { factoring, p, q, phi, inverse, d, decrypt, M: decrypt.result };
}

// ch09: small e (broadcast) attack
export function integerRoot(value: bigint, k: bigint): { root: bigint; exact: boolean } {
  if (value < 0n || k < 1n) throw new Error('Use a non-negative value and k ≥ 1.');
  let low = 0n,
    high = 1n;
  while (high ** k <= value) high *= 2n;
  while (low < high) {
    const middle = (low + high + 1n) / 2n;
    if (middle ** k <= value) low = middle;
    else high = middle - 1n;
  }
  return { root: low, exact: low ** k === value };
}

export function broadcastCiphertexts(M: bigint, moduli: readonly bigint[], e: bigint) {
  return moduli.map((n) => {
    if (M >= n) throw new Error(`M = ${M} must be smaller than every modulus (${n} is not).`);
    return power(M, e, n).result;
  });
}

export type BroadcastRun = {
  e: bigint;
  crt: CrtResult;
  root: bigint;
  exact: boolean;
};

// håstad's attack for tiny e: CRT gives M^e exactly, then take the e-th root.
export function broadcastAttack(
  moduli: readonly bigint[],
  ciphertexts: readonly bigint[],
  e: bigint,
): BroadcastRun {
  if (e < 2n || e > 9n) throw new Error('Use a small exponent e from 2 to 9.');
  const crt = crtSolve(moduli, ciphertexts);
  const { root, exact } = integerRoot(crt.A, e);
  return { e, crt, root, exact };
}

// ch09: why determinism hurts (YES / NO)
export function guessAttack(setup: RsaSetup, candidates: readonly bigint[], C: bigint) {
  return candidates.map((M) => {
    if (M < 0n || M >= setup.n)
      throw new Error(`Every candidate must satisfy 0 ≤ M < n = ${setup.n}.`);
    const run = power(M, setup.e, setup.n);
    return { M, C: run.result, match: run.result === C, run };
  });
}
