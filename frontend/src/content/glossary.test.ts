import { describe, expect, it } from 'vitest';
import { glossary } from './glossary';

describe('glossary', () => {
  const entries = Object.entries(glossary);

  it('gives every term a name, a short explanation ending in punctuation and a reference', () => {
    for (const [key, entry] of entries) {
      expect(entry.name.trim(), key).not.toBe('');
      expect(entry.explanation, key).toMatch(/^[A-Z0-9a-zφλ].*[.)]$/s);
      expect(entry.explanation.length, key).toBeLessThanOrEqual(140);
      expect(entry.reference.trim(), key).not.toBe('');
    }
  });

  it('uses unique display names', () => {
    const names = entries.map(([, entry]) => entry.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('points number-theory and RSA terms to the course chapters', () => {
    for (const key of [
      'totient',
      'gcd',
      'modularInverse',
      'extendedEuclid',
      'fermat',
      'euler',
      'millerRabin',
      'crt',
      'squareAndMultiply',
      'publicExponent',
      'privateExponent',
      'textbookRsa',
    ] as const)
      expect(glossary[key].reference, key).toMatch(/\bCh [89]\b/);
  });

  it('keeps the slide notation', () => {
    expect(glossary.totient.name).toBe('φ(n)');
    expect(glossary.totient.explanation).toContain('(p−1)(q−1)');
    expect(glossary.publicKey.explanation).toContain('PU = {e, n}');
    expect(glossary.privateKey.explanation).toContain('PR = {d, n}');
    expect(glossary.publicExponent.explanation).toContain('PU = {e, n}');
    expect(glossary.privateExponent.explanation).toContain('PR = {d, n}');
    expect(glossary.ciphertext.explanation).toContain('C = M^e mod n');
  });
});
