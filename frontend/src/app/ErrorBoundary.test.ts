import { describe, expect, it } from 'vitest';
import { isLoadFailure } from './ErrorBoundary';

describe('isLoadFailure', () => {
  it('recognises a page file that could not be loaded', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://x.example/assets/a.js',
      'Importing a module script failed.',
      'Loading chunk 12 failed.',
      'error loading dynamically imported module',
    ])
      expect(isLoadFailure(new TypeError(message)), message).toBe(true);
  });
  it('treats ordinary bugs as something went wrong', () => {
    expect(isLoadFailure(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isLoadFailure(new RangeError('Invalid array length'))).toBe(false);
    // An ordinary network error is not a page-file failure.
    expect(isLoadFailure(new TypeError('Failed to fetch'))).toBe(false);
  });
});
