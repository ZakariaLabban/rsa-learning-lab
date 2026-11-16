import { bitLength, deriveKey, gcd, probablePrime, randomRange, type PrivateKey } from '../math';

export type KeyBits = 8 | 16 | 32 | 64 | 1024 | 2048;
export type KeyProgress = { candidates: number; phase: 'p' | 'q' | 'checking' };
export function teachingKey(p: bigint, q: bigint, e: bigint): PrivateKey {
  if (p === 2n || q === 2n)
    throw new RangeError('Teaching RSA requires odd primes; p=2 or q=2 is not supported.');
  if (p < 3n || q < 3n || bitLength(p) > 64 || bitLength(q) > 64 || bitLength(p * q) > 64)
    throw new RangeError('Typed teaching moduli must be at most 64 bits.');
  if (p === q || !probablePrime(p) || !probablePrime(q))
    throw new RangeError('p and q must be distinct primes.');
  return deriveKey(p, q, e);
}
/** Runs in a dedicated worker. Cancellation terminates that worker immediately. */
export function generateRsaKey(
  bits: KeyBits,
  onProgress: (progress: KeyProgress) => void = () => {},
  broadcast = false,
): { key: PrivateKey; candidates: number } {
  if (![8, 16, 32, 64, 1024, 2048].includes(bits)) throw new RangeError('Unsupported key size.');
  if (broadcast && bits !== 1024) throw new RangeError('The e=3 sandbox uses 1024-bit keys.');
  const e = broadcast ? 3n : bits <= 64 ? 7n : 65537n;
  let candidates = 0;
  const prime = (phase: 'p' | 'q') => {
    const primeBits = bits / 2,
      minimum = 1n << BigInt(primeBits - 1),
      maximum = (minimum << 1n) - 1n;
    while (true) {
      candidates++;
      onProgress({ candidates, phase });
      const value = randomRange(minimum, maximum) | 1n;
      if (gcd(e, value - 1n) === 1n && probablePrime(value)) return value;
    }
  };
  while (true) {
    const p = prime('p'),
      q = prime('q');
    onProgress({ candidates, phase: 'checking' });
    if (p === q || bitLength(p * q) !== bits) continue;
    const key = deriveKey(p, q, e);
    return { key, candidates };
  }
}
