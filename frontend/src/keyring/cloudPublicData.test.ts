import { expect, it } from 'vitest';
import { deriveKey } from '../engine/math';
import { fingerprint } from '../engine/encoding/fingerprint';
import { Keyring } from './store';

it('stores cloud-owned public keys without private components and retains matching local private keys', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
  const store = new Keyring(storage, 'account-keyring');
  await store.ready;
  const privateKey = deriveKey(61n, 53n, 17n);
  const local = await store.addMine(privateKey, 'Local name');
  const publicValue = {
    id: local.id,
    name: 'Cloud name',
    n: String(privateKey.n),
    e: String(privateKey.e),
    fingerprint: await fingerprint({ n: privateKey.n, e: privateKey.e }),
  };

  await store.applyCloudPublicData(
    {
      publicKeys: [
        {
          ...publicValue,
          name: 'Local name',
        },
      ],
      contacts: [],
    },
    { publicKeys: [publicValue], contacts: [] },
  );

  expect(store.get(local.id)?.name).toBe('Cloud name');
  expect(store.get(local.id)?.privateKey).toBeDefined();
  expect(JSON.stringify(values.get('account-keyring'))).not.toContain('"private"');

  const reopened = new Keyring(storage, 'account-keyring');
  await reopened.ready;
  expect(reopened.get(local.id)?.name).toBe('Cloud name');
  expect(reopened.get(local.id)?.privateKey).toBeUndefined();
});

it('persists explicit account removals across reload until acknowledged', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
  const writer = new Keyring(storage, 'account-keyring');
  const stale = new Keyring(storage, 'account-keyring');
  await Promise.all([writer.ready, stale.ready]);
  const contact = await writer.addContact({ n: 3233n, e: 17n }, 'Demo');
  expect(stale.get(contact.id)).toBeUndefined();
  expect(stale.cloudDeleteIntents().size).toBe(0);

  writer.remove(contact.id);
  const reopened = new Keyring(storage, 'account-keyring');
  await reopened.ready;
  expect(reopened.get(contact.id)).toBeUndefined();
  const intents = reopened.cloudDeleteIntents();
  expect(intents.has(contact.id)).toBe(true);
  reopened.acknowledgeCloudDeletes(intents);
  expect(writer.cloudDeleteIntents().has(contact.id)).toBe(false);
});
