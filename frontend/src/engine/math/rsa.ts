import { gcd, inverse, lcm, mod, modexp, type TraceOptions } from './arithmetic';

export type PublicKey = { n: bigint; e: bigint };
export type PrivateKey = PublicKey & {
  p: bigint;
  q: bigint;
  d: bigint;
  phi: bigint;
  lambda: bigint;
  dp: bigint;
  dq: bigint;
  qInv: bigint;
};

/** Requires distinct odd primes; primality validation belongs to the constructor in #42. */
export function deriveKey(
  p: bigint,
  q: bigint,
  e: bigint,
  inverseModulus: 'phi' | 'lambda' = 'phi',
): PrivateKey {
  if (p < 3n || q < 3n || p % 2n === 0n || q % 2n === 0n || p === q || gcd(p, q) !== 1n)
    throw new RangeError('Use distinct, coprime odd primes.');
  const phi = (p - 1n) * (q - 1n),
    lambda = lcm(p - 1n, q - 1n);
  if (e <= 1n || e >= phi || gcd(e, phi) !== 1n)
    throw new RangeError('Exponent must satisfy 1 < e < phi and gcd(e,phi)=1.');
  const d = inverse(e, inverseModulus === 'phi' ? phi : lambda);
  return {
    p,
    q,
    n: p * q,
    e,
    d,
    phi,
    lambda,
    dp: d % (p - 1n),
    dq: d % (q - 1n),
    qInv: inverse(q, p),
  };
}

function checkInput(value: bigint, n: bigint) {
  if (n <= 1n || value < 0n || value >= n)
    throw new RangeError('RSA input must be between 0 and n-1.');
}
export function encryptInt(message: bigint, key: PublicKey): bigint {
  checkInput(message, key.n);
  if (key.e <= 1n) throw new RangeError('Invalid public exponent.');
  return modexp(message, key.e, key.n);
}
export function decryptInt(ciphertext: bigint, key: Pick<PrivateKey, 'n' | 'd'>): bigint {
  checkInput(ciphertext, key.n);
  if (key.d <= 0n) throw new RangeError('Invalid private exponent.');
  return modexp(ciphertext, key.d, key.n);
}
export function decryptCrt(ciphertext: bigint, key: PrivateKey, options: TraceOptions = {}) {
  checkInput(ciphertext, key.n);
  const mp = modexp(ciphertext, key.dp, key.p),
    mq = modexp(ciphertext, key.dq, key.q);
  const h = mod(key.qInv * (mp - mq), key.p),
    value = mq + h * key.q;
  return { value, trace: options.trace ? { mp, mq, h, qInv: key.qInv, value } : undefined };
}

/** Pairwise-coprime CRT, using the lecture sum of residue * partial product * inverse. */
export function crt(
  residues: readonly bigint[],
  moduli: readonly bigint[],
  options: TraceOptions = {},
) {
  if (residues.length === 0 || residues.length !== moduli.length || moduli.length > 256)
    throw new RangeError('Use 1..256 matching residues and moduli.');
  for (let i = 0; i < moduli.length; i++) {
    if (moduli[i] <= 1n) throw new RangeError('CRT moduli must exceed one.');
    for (let j = 0; j < i; j++)
      if (gcd(moduli[i], moduli[j]) !== 1n)
        throw new RangeError('CRT moduli must be pairwise coprime.');
  }
  const modulus = moduli.reduce((a, b) => a * b, 1n);
  const rows = moduli.map((m, i) => {
    const partial = modulus / m,
      coefficient = inverse(partial, m),
      residue = mod(residues[i], m);
    return { modulus: m, residue, partial, coefficient, term: residue * partial * coefficient };
  });
  return {
    value: mod(
      rows.reduce((sum, r) => sum + r.term, 0n),
      modulus,
    ),
    modulus,
    rows: options.trace ? rows : [],
  };
}
export function crtResidues(value: bigint, moduli: readonly bigint[]): bigint[] {
  return moduli.map((m) => {
    if (m <= 1n) throw new RangeError('CRT moduli must exceed one.');
    return mod(value, m);
  });
}
