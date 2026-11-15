/** Educational BigInt arithmetic. This implementation is not constant-time. */
export const abs = (n: bigint) => (n < 0n ? -n : n);

export function mod(n: bigint, modulus: bigint): bigint {
  if (modulus < 1n) throw new RangeError('Modulus must be positive.');
  return ((n % modulus) + modulus) % modulus;
}

export function bitLength(n: bigint): number {
  if (n < 0n) throw new RangeError('Expected an unsigned integer.');
  return n === 0n ? 0 : n.toString(2).length;
}

export function i2osp(n: bigint, length: number): Uint8Array {
  if (!Number.isSafeInteger(length) || length < 0 || length > 65536)
    throw new RangeError('Byte length must be between 0 and 65536.');
  if (n < 0n || bitLength(n) > length * 8) throw new RangeError('Integer does not fit.');
  const result = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    result[i] = Number(n & 255n);
    n >>= 8n;
  }
  return result;
}

export function os2ip(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) result = (result << 8n) | BigInt(byte);
  return result;
}

export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: bigint, b: bigint): bigint {
  return a === 0n || b === 0n ? 0n : abs((a / gcd(a, b)) * b);
}

/** Traces retain only a bounded prefix; arithmetic always finishes independently. */
export type TraceOptions = { trace?: boolean; maxRows?: number };
export function traceLimit(options: TraceOptions): number {
  const count = options.maxRows ?? 256;
  if (!Number.isSafeInteger(count) || count < 0 || count > 4096)
    throw new RangeError('Trace limit must be between 0 and 4096 rows.');
  return options.trace ? count : 0;
}

export type EuclidRow = { q: bigint; r: bigint; s: bigint; t: bigint };
export function extendedGcd(a: bigint, b: bigint, options: TraceOptions = {}) {
  const limit = traceLimit(options);
  let oldR = abs(a),
    r = abs(b),
    oldS = 1n,
    s = 0n,
    oldT = 0n,
    t = 1n;
  const rows: EuclidRow[] = [];
  let rowCount = 0;
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
    if (rows.length < limit) rows.push({ q, r, s: a < 0n ? -s : s, t: b < 0n ? -t : t });
    rowCount++;
  }
  return {
    gcd: oldR,
    x: a < 0n ? -oldS : oldS,
    y: b < 0n ? -oldT : oldT,
    rows,
    rowCount,
    truncated: options.trace === true && rowCount > rows.length,
  };
}

export function inverse(a: bigint, modulus: bigint): bigint {
  if (modulus <= 1n) throw new RangeError('Inverse modulus must exceed one.');
  const result = extendedGcd(a, modulus);
  if (result.gcd !== 1n) throw new RangeError(`No inverse (gcd = ${result.gcd}).`);
  return mod(result.x, modulus);
}

export type ModExpRow = { i: number; bit: 0 | 1; c: bigint; f: bigint; square: bigint };
export function squareAndMultiply(
  base: bigint,
  exponent: bigint,
  modulus: bigint,
  options: TraceOptions = {},
) {
  if (exponent < 0n) throw new RangeError('Exponent must be nonnegative.');
  const limit = traceLimit(options);
  base = mod(base, modulus);
  let f = 1n % modulus,
    c = 0n,
    multiplications = 0;
  const binary = exponent === 0n ? '' : exponent.toString(2);
  const rows: ModExpRow[] = [];
  for (let j = 0; j < binary.length; j++) {
    const bit = binary[j] === '1' ? 1 : 0;
    const square = (f * f) % modulus;
    f = bit ? (square * base) % modulus : square;
    c = 2n * c + BigInt(bit);
    multiplications += 1 + bit;
    if (rows.length < limit) rows.push({ i: binary.length - j - 1, bit, c, f, square });
  }
  return {
    value: f,
    rows,
    rowCount: binary.length,
    multiplications,
    truncated: options.trace === true && binary.length > rows.length,
  };
}

export function modexp(base: bigint, exponent: bigint, modulus: bigint): bigint {
  return squareAndMultiply(base, exponent, modulus).value;
}

/** Floor of the nonnegative integer k-th root; no floating point conversion. */
export function integerRoot(n: bigint, k: number): bigint {
  if (n < 0n || !Number.isSafeInteger(k) || k < 1 || k > 4096)
    throw new RangeError('Use a nonnegative integer and root degree 1..4096.');
  if (n < 2n || k === 1) return n;
  let low = 0n,
    high = 1n << BigInt(Math.ceil(bitLength(n) / k));
  while (low < high) {
    const middle = (low + high + 1n) / 2n;
    if (middle ** BigInt(k) <= n) low = middle;
    else high = middle - 1n;
  }
  return low;
}

export function totient(n: bigint): bigint {
  if (n < 1n || n > 1_000_000n) throw new RangeError('Teaching totient supports 1..1000000.');
  let remaining = n,
    result = n;
  for (let p = 2n; p * p <= remaining; p++) {
    if (remaining % p === 0n) {
      result -= result / p;
      while (remaining % p === 0n) remaining /= p;
    }
  }
  if (remaining > 1n) result -= result / remaining;
  return result;
}
