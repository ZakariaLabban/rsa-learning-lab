/**
 * Extended Euclid as taught for RSA: find x with a·x ≡ 1 (mod m).
 * The table runs Euclid on (m, a) so every row satisfies r = s·m + t·a, and the inverse is the
 * t of the row where r = 1. Pure functions, unit-tested.
 */
import { extendedGcd, mod } from '../../engine/math';

export type EuclidTableRow = { step: number; q: bigint | null; r: bigint; s: bigint; t: bigint };
export type EuclidResult = {
  a: bigint;
  m: bigint;
  gcd: bigint;
  /** a⁻¹ mod m, or null when gcd(a, m) ≠ 1. */
  inverse: bigint | null;
  rows: EuclidTableRow[];
  /** Total division steps (rows after the two starting rows). */
  stepCount: number;
  truncated: boolean;
};

export function parseWhole(input: string, name: string): bigint {
  const value = input.trim();
  if (!value) throw new Error(`Enter ${name}.`);
  if (!/^[0-9]+$/.test(value)) throw new Error(`${name} must be a whole number (digits only).`);
  if (value.length > 1300) throw new Error(`${name} is too long (at most 1300 digits).`);
  return BigInt(value);
}

/** Runs the table for a⁻¹ mod m. Requires m > 1 and a ≥ 0. */
export function euclidInverse(a: bigint, m: bigint, maxRows = 64): EuclidResult {
  if (m <= 1n) throw new Error('m must be greater than 1.');
  if (a < 0n) throw new Error('a must not be negative.');
  const run = extendedGcd(m, a, { trace: true, maxRows });
  const rows: EuclidTableRow[] = [
    { step: 0, q: null, r: m, s: 1n, t: 0n },
    { step: 1, q: null, r: a, s: 0n, t: 1n },
    ...run.rows.map((row, i) => ({ step: i + 2, q: row.q, r: row.r, s: row.s, t: row.t })),
  ];
  return {
    a,
    m,
    gcd: run.gcd,
    inverse: run.gcd === 1n ? mod(run.y, m) : null,
    rows,
    stepCount: run.rowCount,
    truncated: run.truncated,
  };
}
