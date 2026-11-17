import {
  bitLength,
  decryptInt,
  deriveKey,
  gcd,
  i2osp,
  integerRoot,
  probablePrime,
  type PublicKey,
} from '../../engine/math';

export type FactorProgress = { attempts: number; divisor: bigint; elapsedMs: number };
export type FactorRequest = {
  key: PublicKey;
  ciphertext: bigint;
  byteLength: number;
  budgetMs: number;
};
export type FactorResult = FactorProgress &
  (
    | { status: 'timeout' }
    | { status: 'exhausted' }
    | {
        status: 'factored';
        p: bigint;
        q: bigint;
        phi: bigint;
        d: bigint;
        message: bigint;
        bytes: Uint8Array;
      }
  );

/** Deliberately naive, bounded trial division. Eve receives only public inputs. */
export function factorRace(
  request: FactorRequest,
  options: { now?: () => number; progress?: (value: FactorProgress) => void } = {},
): FactorResult {
  const { key, ciphertext, byteLength, budgetMs } = request;
  const bits = bitLength(key.n);
  if (bits < 16 || bits > 52 || key.n % 2n === 0n || key.e <= 1n || key.e >= key.n)
    throw new Error('Use an odd 16–52-bit RSA demonstration modulus and a valid public exponent.');
  if (
    ciphertext < 0n ||
    ciphertext >= key.n ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 1 ||
    byteLength > 6
  )
    throw new Error('Invalid demonstration ciphertext or message length.');
  if (!Number.isFinite(budgetMs) || budgetMs < 1 || budgetMs > 30000)
    throw new Error('The search budget must be between 1 ms and 30 seconds.');
  const now = options.now ?? (() => performance.now());
  const start = now();
  let attempts = 0,
    elapsedMs = 0,
    divisor = 3n,
    lastReport = -Infinity;
  const report = () => {
    elapsedMs = Math.max(0, now() - start);
    if (elapsedMs - lastReport >= 100) {
      options.progress?.({ attempts, divisor, elapsedMs });
      lastReport = elapsedMs;
    }
    return elapsedMs >= budgetMs;
  };
  for (; divisor * divisor <= key.n; divisor += 2n) {
    if (attempts % 256 === 0 && report())
      return { status: 'timeout', attempts, divisor, elapsedMs };
    attempts++;
    if (key.n % divisor !== 0n) continue;
    const p = divisor,
      q = key.n / p;
    elapsedMs = Math.max(0, now() - start);
    if (elapsedMs >= budgetMs) return { status: 'timeout', attempts, divisor, elapsedMs };
    if (p === q || !probablePrime(p) || !probablePrime(q) || gcd(key.e, (p - 1n) * (q - 1n)) !== 1n)
      throw new Error('The recovered factors do not form a valid distinct-prime RSA key.');
    const recovered = deriveKey(p, q, key.e);
    const message = decryptInt(ciphertext, recovered);
    return {
      status: 'factored',
      attempts,
      divisor,
      elapsedMs,
      p,
      q,
      phi: recovered.phi,
      d: recovered.d,
      message,
      bytes: i2osp(message, byteLength),
    };
  }
  return { status: 'exhausted', attempts, divisor, elapsedMs: Math.max(0, now() - start) };
}

/** Rough cost for the same trial-division loop, deliberately restricted to tiny keys. */
export function trialEstimate(run: FactorProgress, targetBits: number) {
  if (
    !Number.isSafeInteger(targetBits) ||
    targetBits < 16 ||
    targetBits > 52 ||
    run.attempts <= 0 ||
    run.elapsedMs <= 0
  )
    return null;
  const trials = Number((integerRoot((1n << BigInt(targetBits)) - 1n, 2) - 1n) / 2n);
  return { trials, milliseconds: (trials * run.elapsedMs) / run.attempts };
}
