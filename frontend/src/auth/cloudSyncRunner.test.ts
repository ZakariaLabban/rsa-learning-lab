import { expect, it } from 'vitest';
import { emptyProgress, recordAnswer } from '../features/lessons/practiceProgress';
import { emptySyncCheckpoint, ignoreStaleTabOmissions, hashSyncValue } from './cloudSync';
import { synchronizePublicData, type SyncGateway } from './cloudSyncRunner';

it('clears local practice history when the server has a tombstone', async () => {
  const localProgress = recordAnswer(emptyProgress(), 'old-question', 'modulus', true);
  const gateway: SyncGateway = {
    load: async () => ({
      publicKeys: [],
      contacts: [],
      practiceProgress: {
        user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        progress: emptyProgress(),
        revision: 2,
        updated_at: '2026-11-24T00:00:00.000Z',
        deleted_at: '2026-11-24T00:00:00.000Z',
      },
    }),
    insertPublicKey: async () => null,
    updatePublicKey: async () => null,
    insertContact: async () => null,
    updateContact: async () => null,
    insertPracticeProgress: async () => null,
    updatePracticeProgress: async () => null,
  };

  const result = await synchronizePublicData({
    accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    local: { publicKeys: [], contacts: [], practiceProgress: localProgress },
    checkpoint: { ...emptySyncCheckpoint(), initialized: true },
    gateway,
  });

  expect(result.local.practiceProgress).toEqual(emptyProgress());
  expect(result.checkpoint.practiceProgress).toMatchObject({ revision: 2, deleted: true });
});

it('pulls a contact saved by another tab instead of deleting it', async () => {
  const contact = {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    name: 'Demo',
    n: '3233',
    e: '17',
    fingerprint: 'example',
    verified: false,
  };
  const local = { publicKeys: [], contacts: [], practiceProgress: emptyProgress() };
  const checkpoint = {
    ...emptySyncCheckpoint(),
    initialized: true,
    contacts: { [contact.id]: { revision: 1, hash: hashSyncValue(contact), deleted: false } },
  };
  const row = { ...contact, revision: 1, deleted_at: null, updated_at: '2026-11-24T00:00:00Z' };
  const updates: Array<string | null> = [];
  const gateway: SyncGateway = {
    load: async () => ({ publicKeys: [], contacts: [row], practiceProgress: null }),
    insertPublicKey: async () => null,
    updatePublicKey: async () => null,
    insertContact: async () => null,
    updateContact: async (_owner, _id, _revision, value) => {
      updates.push(value.deleted_at);
      return { ...row, revision: 2, deleted_at: value.deleted_at };
    },
    insertPracticeProgress: async (user_id, progress) => ({
      user_id,
      progress,
      revision: 1,
      deleted_at: null,
      updated_at: row.updated_at,
    }),
    updatePracticeProgress: async () => null,
  };
  const args = { accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', local, gateway };
  const stale = await synchronizePublicData({
    ...args,
    checkpoint: ignoreStaleTabOmissions(checkpoint, local, new Set()),
  });
  expect(stale.local.contacts).toEqual([contact]);
  expect(updates).toEqual([]);
  await synchronizePublicData({
    ...args,
    checkpoint: ignoreStaleTabOmissions(checkpoint, local, new Set([contact.id])),
  });
  expect(updates).toEqual(['1970-01-01T00:00:00.000Z']);
});
