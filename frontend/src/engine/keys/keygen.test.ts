import { expect, it } from 'vitest';
import { generateRsaKey, teachingKey } from './keygen';
import { bitLength, decryptCrt, decryptInt, encryptInt } from '../math';

it('validates typed teaching primes and reproduces the lecture example', () => {
  const key = teachingKey(17n, 11n, 7n);
  expect(key).toMatchObject({ n: 187n, phi: 160n, d: 23n });
  expect(encryptInt(88n, key)).toBe(11n);
  for (const args of [
    [2n, 11n, 7n],
    [17n, 17n, 7n],
    [15n, 11n, 7n],
    [17n, 11n, 8n],
  ] as const)
    expect(() => teachingKey(args[0], args[1], args[2])).toThrow();
});
for (const bits of [8, 16, 32, 64, 1024, 2048] as const)
  it(`generates an exact ${bits}-bit modulus with valid phi inverse and CRT`, () => {
    let last = 0;
    const { key, candidates } = generateRsaKey(bits, (progress) => {
      expect(progress.candidates).toBeGreaterThanOrEqual(last);
      last = progress.candidates;
    });
    expect(bitLength(key.n)).toBe(bits);
    expect(key.p).not.toBe(key.q);
    expect((key.e * key.d) % key.phi).toBe(1n);
    expect(candidates).toBe(last);
    for (const m of [0n, 1n, key.p, key.q, key.n - 1n]) {
      const cipher = encryptInt(m, key);
      expect(decryptInt(cipher, key)).toBe(m);
      expect(decryptCrt(cipher, key).value).toBe(m);
    }
  }, 120000);
