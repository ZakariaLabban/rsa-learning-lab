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
