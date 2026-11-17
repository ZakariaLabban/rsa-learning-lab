import {
  abs,
  bitLength,
  crt,
  crtResidues,
  decryptCrt,
  decryptInt,
  encryptInt,
  gcd,
  millerRabin,
  mod,
  modexp,
  squareAndMultiply,
  strongLiars,
  totient,
  type PrivateKey,
} from '../../engine/math';
import { teachingKey } from '../../engine/keys/keygen';

/** Bound decimal parsing before BigInt, and bound every teaching computation. */
export function integer(text: string, label: string, bits = 2048, signed = false): bigint {
  const value = text.trim();
  if (value.length > 620 || !(signed ? /^-?\d+$/ : /^\d+$/).test(value))
    throw new Error(
      `${label} must be ${signed ? 'an integer' : 'a non-negative whole number'} (up to ${bits} bits).`,
    );
  const result = BigInt(value);
  if (bitLength(abs(result)) > bits) throw new Error(`${label} is limited to ${bits} bits.`);
  return result;
}

export function primality(
  nText: string,
  source: 'typed' | 'random',
  baseText: string,
  rounds: number,
) {
  const n = integer(nText, 'n');
  if (n < 2n) return { n, special: 'below-two' as const, result: null, source };
  if (n === 2n || n === 3n) return { n, special: 'small-prime' as const, result: null, source };
  if (n % 2n === 0n) return { n, special: 'even' as const, result: null, source };
  if (!Number.isSafeInteger(rounds) || rounds < 1 || rounds > 64)
    throw new Error('Use 1 to 64 random rounds.');
  const result =
    source === 'typed'
      ? millerRabin(n, { bases: [integer(baseText, 'a')], trace: true, maxRows: 2048 })
      : millerRabin(n, { rounds, trace: true, maxRows: 2048 });
  return { n, special: null, result, source };
}
export type PrimalityRun = ReturnType<typeof primality>;

export function liarSearch(nText: string) {
  const n = integer(nText, 'n', 14);
  const bases = strongLiars(n); // Rejects even, small or >10,000 candidates.
  let factor: bigint | null = null;
  for (let divisor = 3n; divisor * divisor <= n; divisor += 2n)
    if (n % divisor === 0n) {
      factor = divisor;
      break;
    }
  return { n, bases, prime: factor === null, factor, tested: Number(n - 3n) };
}

export function rsaProof(pText: string, qText: string, eText: string, messageText: string) {
  const key = teachingKey(
    integer(pText, 'p', 64),
    integer(qText, 'q', 64),
    integer(eText, 'e', 64),
  );
  const original = integer(messageText, 'M', 2048, true);
  const message = mod(original, key.n);
  const ciphertext = encryptInt(message, key);
  const recovered = decryptInt(ciphertext, key);
  const k = (key.e * key.d - 1n) / key.phi;
  const common = gcd(message, key.n);
  const eulerResidue = common === 1n ? modexp(message, key.phi, key.n) : null;
  const primeRows = [key.p, key.q].map((prime) => ({
    prime,
    message: message % prime,
    recovered: recovered % prime,
    exponentMultiple: (key.e * key.d - 1n) / (prime - 1n),
  }));
  if (recovered !== message) throw new Error('RSA proof did not recover the normalized message.');
  return { key, original, message, ciphertext, recovered, k, common, eulerResidue, primeRows };
}

export function residues(aText: string, nText: string) {
  const a = integer(aText, 'a', 64, true),
    n = integer(nText, 'n', 14);
  if (n < 2n || n > 10000n) throw new Error('Residue explorer: use 2 ≤ n ≤ 10,000.');
  const phi = totient(n),
    common = gcd(a, n),
    rows = [];
  let value = 1n;
  for (let exponent = 1n; exponent <= phi; exponent++) {
    value = mod(value * a, n);
    if (rows.length < 64) rows.push({ exponent, value });
  }
  return { a, n, phi, common, prime: phi === n - 1n, value, rows, truncated: phi > 64n };
}

export function exponentiation(aText: string, bText: string, nText: string) {
  const a = integer(aText, 'a', 2048, true),
    b = integer(bText, 'b', 256),
    n = integer(nText, 'n');
  if (n < 1n) throw new Error('n must be positive.');
  const result = squareAndMultiply(a, b, n, { trace: true, maxRows: 256 });
  return {
    a,
    b,
    n,
    normalizedBase: mod(a, n),
    binary: b.toString(2),
    result,
    // Naive initializes to 1 and multiplies by a exactly b times; same convention as the tracer.
    naiveMultiplications: b,
  };
}

function list(text: string, label: string) {
  if (text.length > 1500) throw new Error(`${label}: use 1 to 8 bounded integers.`);
  const parts = text.trim().split(/[\s,]+/);
  if (parts.length < 1 || parts.length > 8) throw new Error(`${label}: use 1 to 8 integers.`);
  return parts.map((part) => integer(part, label, 128, true));
}
export function crtLesson(
  moduliText: string,
  residuesText: string,
  valueText: string,
  direction: 'split' | 'combine',
) {
  const moduli = list(moduliText, 'Moduli');
  const original = direction === 'split' ? integer(valueText, 'A', 2048, true) : null;
  const input = original !== null ? crtResidues(original, moduli) : list(residuesText, 'Residues');
  const result = crt(input, moduli, { trace: true });
  return { ...result, original, residues: result.rows.map((row) => row.residue) };
}

export function median(values: readonly number[]) {
  if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0))
    throw new Error('Invalid timing samples.');
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export function compareDecryption(
  key: PrivateKey,
  messageText: string,
  now = () => performance.now(),
) {
  const bits = bitLength(key.n);
  if (bits > 64 && bits !== 1024 && bits !== 2048)
    throw new Error('Use a teaching, 1024-bit or 2048-bit private key.');
  const message = integer(messageText, 'M');
  const ciphertext = encryptInt(message, key);
  const directTimes: number[] = [],
    crtTimes: number[] = [];
  // One warm-up pair discarded, then five recorded pairs; alternate execution order.
  for (let pair = 0; pair < 6; pair++) {
    const runDirect = () => {
      const start = now();
      const value = decryptInt(ciphertext, key);
      const elapsed = now() - start;
      if (value !== message) throw new Error('Direct decryption mismatch.');
      if (pair) directTimes.push(elapsed);
    };
    const runCrt = () => {
      const start = now();
      const value = decryptCrt(ciphertext, key).value;
      const elapsed = now() - start;
      if (value !== message) throw new Error('CRT decryption mismatch.');
      if (pair) crtTimes.push(elapsed);
    };
    if (pair % 2) {
      runCrt();
      runDirect();
    } else {
      runDirect();
      runCrt();
    }
  }
  const direct = decryptInt(ciphertext, key),
    result = decryptCrt(ciphertext, key, { trace: true });
  return {
    bits,
    message,
    ciphertext,
    direct,
    crt: result.value,
    trace: result.trace!,
    directTimes,
    crtTimes,
    directMedian: median(directTimes),
    crtMedian: median(crtTimes),
  };
}
