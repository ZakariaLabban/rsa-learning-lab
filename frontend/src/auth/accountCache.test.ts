import { describe, expect, it } from 'vitest';
import { ACCOUNT_CACHE_SECTIONS, accountCacheKey, clearAccountCache } from './accountCache';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';

describe('Account cache isolation', () => {
  it('uses different storage keys for different users', () => {
    const keyA = accountCacheKey(userA, 'contacts');
    const keyB = accountCacheKey(userB, 'contacts');

    expect(keyA).not.toBe(keyB);
  });

  it('separates different types of account data', () => {
    const contacts = accountCacheKey(userA, 'contacts');
    const progress = accountCacheKey(userA, 'practice-progress');

    expect(contacts).not.toBe(progress);
  });

  it('clears only the selected account cache', () => {
    const values = new Map<string, string>();

    for (const section of ACCOUNT_CACHE_SECTIONS) {
      values.set(accountCacheKey(userA, section), 'User A');
      values.set(accountCacheKey(userB, section), 'User B');
    }

    const storage = {
      removeItem(key: string) {
        values.delete(key);
      },
    };

    clearAccountCache(userA, storage);

    for (const section of ACCOUNT_CACHE_SECTIONS) {
      expect(values.has(accountCacheKey(userA, section))).toBe(false);
      expect(values.get(accountCacheKey(userB, section))).toBe('User B');
    }
  });

  it('rejects an invalid account identifier', () => {
    expect(() => accountCacheKey('invalid-user', 'contacts')).toThrow('Invalid account ID.');
  });
});
