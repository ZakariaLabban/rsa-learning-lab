import { afterEach, expect, it, vi } from 'vitest';
import { deriveKey } from '../engine/math';
import { readProgress, recordAnswer, saveProgress } from '../features/lessons/practiceProgress';
import { Keyring, STORAGE_KEY } from '../keyring/store';
import { localDataKey } from './localDataKey';

afterEach(() => vi.unstubAllGlobals());

it('keeps legacy guest data and saved account data isolated on a shared browser', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
  vi.stubGlobal('localStorage', storage);

  const guest = new Keyring(storage);
  await guest.ready;
  const key = deriveKey(61n, 53n, 17n);
  guest.setRememberPrivate(true);
  const guestKey = await guest.addMine(key, 'Guest key');
  saveProgress(recordAnswer(readProgress(), 'guest-question', 'modulus', true));

  const accountStorageKey = localDataKey(STORAGE_KEY, 'a');
  const account = new Keyring(storage, accountStorageKey);
  await account.ready;
  expect(account.get(guestKey.id)).toBeUndefined();
  expect(readProgress('a').attempts).toBe(0);

  account.setRememberPrivate(true);
  const accountKey = await account.addMine(deriveKey(17n, 19n, 5n), 'Account key');
  saveProgress(recordAnswer(readProgress('a'), 'account-question', 'modulus', true), 'a');

  const otherAccount = new Keyring(storage, localDataKey(STORAGE_KEY, 'b'));
  const returningAccount = new Keyring(storage, accountStorageKey);
  const returningGuest = new Keyring(storage);
  await Promise.all([otherAccount.ready, returningAccount.ready, returningGuest.ready]);
  expect(otherAccount.get(accountKey.id)).toBeUndefined();
  expect(readProgress('b').attempts).toBe(0);
  expect(returningGuest.get(accountKey.id)).toBeUndefined();
  expect(returningGuest.get(guestKey.id)?.privateKey?.d).toBe(key.d);
  expect(returningAccount.get(accountKey.id)?.privateKey).toBeDefined();
  expect(readProgress().seen).toEqual(['guest-question']);
  expect(readProgress('a').seen).toEqual(['account-question']);

  returningAccount.clearAll();
  expect(storage.getItem(accountStorageKey)).toBeNull();
  expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
});

it('blocks stale keyring writes after another tab clears the active profile', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
  let cleared: string | null = null;
  const first = new Keyring(storage, STORAGE_KEY, () => cleared);
  await first.ready;
  const contact = await first.addContact({ n: 187n, e: 7n }, 'Before clear');
  const second = new Keyring(storage, STORAGE_KEY, () => cleared);
  await second.ready;

  cleared = 'new revision';
  first.clearAll();
  second.rename(contact.id, 'Stale tab');
  expect(storage.getItem(STORAGE_KEY)).toBeNull();
  await expect(second.addContact({ n: 221n, e: 11n })).rejects.toThrow('Local data was cleared');
  await expect(first.addContact({ n: 221n, e: 11n })).resolves.toBeDefined();
});

it('keeps a practice write that races a clear out of the new generation', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === 'rsa-lab-practice.v1') {
        values.set('rsa-lab.local-clear', 'new-generation');
        values.delete(key);
      }
      values.set(key, value);
    },
    removeItem: (key: string) => void values.delete(key),
  };
  vi.stubGlobal('localStorage', storage);
  saveProgress(recordAnswer(readProgress(), 'racing', 'modulus', true), null, null);
  expect(readProgress().attempts).toBe(0);
  expect(values.has('rsa-lab-practice.v1')).toBe(false);

  saveProgress(recordAnswer(readProgress(), 'new', 'modulus', true));
  expect(readProgress().seen).toEqual(['new']);
});
