import { describe, expect, it } from 'vitest';
import { parseShareSlug } from './ShareLinks';

const origin = 'https://rsa.example.test';
const slug = 'a'.repeat(48);

describe('public-key share links', () => {
  it('accepts relative and absolute links on the app origin', () => {
    expect(parseShareSlug(`/k/${slug}`, origin)).toBe(slug);
    expect(parseShareSlug(`${origin}/k/${slug}`, origin)).toBe(slug);
  });

  it.each([
    `https://attacker.example/k/${slug}`,
    `http://rsa.example.test/k/${slug}`,
    `https://user@rsa.example.test/k/${slug}`,
    `https://rsa.example.test/k/${slug}?next=https://attacker.example`,
    `https://rsa.example.test/k/${slug}#fragment`,
    `https://rsa.example.test/k/${slug}/extra`,
    '/k/too-short',
    'javascript:alert(1)',
  ])('rejects an unsafe or malformed link: %s', (value) => {
    expect(parseShareSlug(value, origin)).toBeNull();
  });
});
