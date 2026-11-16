import { describe, expect, it } from 'vitest';
import references from '../../engine/__vectors__/reference-vectors.json';
import { euclidInverse, parseWhole } from './euclidModel';

const rows = (a: bigint, m: bigint) =>
  euclidInverse(a, m).rows.map((r) =>
    [r.q, r.r, r.s, r.t].map((v) => (v === null ? '-' : String(v))),
  );

describe('Extended Euclid table', () => {
  it('reproduces the lecture inverse 7⁻¹ mod 160 = 23 row by row', () => {
    expect(rows(7n, 160n)).toEqual([
      ['-', '160', '1', '0'],
      ['-', '7', '0', '1'],
      ['22', '6', '1', '-22'],
      ['1', '1', '-1', '23'],
      ['6', '0', '7', '-160'],
    ]);
    const result = euclidInverse(7n, 160n);
    expect(result).toMatchObject({ gcd: 1n, inverse: 23n, stepCount: 3, truncated: false });
    for (const row of result.rows) expect(row.s * 160n + row.t * 7n).toBe(row.r);
  });
  it('reports no inverse with the gcd', () => {
    expect(euclidInverse(6n, 9n)).toMatchObject({ gcd: 3n, inverse: null });
    expect(euclidInverse(0n, 17n)).toMatchObject({ gcd: 17n, inverse: null });
    expect(euclidInverse(17n, 3120n).inverse).toBe(2753n);
    // a ≥ m works too: 200 ≡ 4 (mod 7) and 4 · 2 = 8 ≡ 1.
    expect(euclidInverse(200n, 7n).inverse).toBe(2n);
  });
  it('handles 2048-bit numbers and summarises long tables', () => {
    const v = references.keys[1];
    const phi = BigInt(v.phi);
    const result = euclidInverse(65537n, phi, 4);
    expect(result.inverse).toBe(BigInt(v.d_phi));
    expect(result.rows).toHaveLength(6);
    expect(result.truncated).toBe(result.stepCount > 4);
  });
  it('explains bad input', () => {
    expect(() => parseWhole('', 'a')).toThrow('Enter a');
    expect(() => parseWhole('7.5', 'a')).toThrow('whole number');
    expect(() => parseWhole('-3', 'm')).toThrow('whole number');
    expect(() => euclidInverse(3n, 1n)).toThrow('greater than 1');
  });
});
