import { expect, it } from 'vitest';
import { emptyProgress, recordAnswer } from '../features/lessons/practiceProgress';
import { emptySyncCheckpoint } from './cloudSync';
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
