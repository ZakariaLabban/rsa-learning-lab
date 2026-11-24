import { describe, expect, it } from 'vitest';
import {
  clearSyncCheckpoint,
  emptySyncCheckpoint,
  hashSyncValue,
  readSyncCheckpoint,
  reconcileRecord,
  syncCheckpointKey,
  writeSyncCheckpoint,
  type CloudPublicKey,
  type SyncCheckpoint,
} from './cloudSync';

const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const key: CloudPublicKey = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  name: 'Public key',
  n: '3233',
  e: '17',
  fingerprint: 'sha256:example',
};

describe('cloud sync checkpoints', () => {
  it('keeps checkpoint state isolated by account and supports clearing it', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => void values.set(name, value),
      removeItem: (name: string) => void values.delete(name),
    };
    const checkpoint: SyncCheckpoint = {
      ...emptySyncCheckpoint(),
      initialized: true,
      publicKeys: { [key.id]: { revision: 4, hash: hashSyncValue(key), deleted: false } },
    };

    writeSyncCheckpoint(userA, checkpoint, storage);
    expect(readSyncCheckpoint(userA, storage)).toEqual(checkpoint);
    expect(readSyncCheckpoint(userB, storage)).toEqual(emptySyncCheckpoint());
    clearSyncCheckpoint(userA, storage);
    expect(readSyncCheckpoint(userA, storage)).toEqual(emptySyncCheckpoint());
    expect(syncCheckpointKey(userB)).not.toBe(syncCheckpointKey(userA));
  });
});

describe('cloud record reconciliation', () => {
  it('syncs account-local data on first sync', () => {
    expect(
      reconcileRecord({
        section: 'publicKeys',
        id: key.id,
        local: key,
        remote: null,
        base: null,
        initialized: false,
        hash: hashSyncValue,
      }),
    ).toEqual({ kind: 'push', value: key, baseRevision: null });
  });

  it('lets the server tombstone win over an offline stale copy', () => {
    expect(
      reconcileRecord({
        section: 'publicKeys',
        id: key.id,
        local: key,
        remote: { value: key, revision: 8, deleted: true },
        base: { revision: 7, hash: hashSyncValue(key), deleted: false },
        initialized: true,
        hash: hashSyncValue,
      }),
    ).toEqual({ kind: 'pull', value: null });
  });

  it('uses the server revision when both devices changed the same record', () => {
    const local = { ...key, name: 'Offline edit' };
    const remote = { ...key, name: 'Other device edit' };
    expect(
      reconcileRecord({
        section: 'publicKeys',
        id: key.id,
        local,
        remote: { value: remote, revision: 9, deleted: false },
        base: { revision: 7, hash: hashSyncValue(key), deleted: false },
        initialized: true,
        hash: hashSyncValue,
      }),
    ).toEqual({ kind: 'pull', value: remote });
  });

  it('allows only explicitly selected guest records to replace an active cloud record', () => {
    const guest = { ...key, name: 'Imported guest key' };
    expect(
      reconcileRecord({
        section: 'publicKeys',
        id: key.id,
        local: guest,
        remote: { value: key, revision: 3, deleted: false },
        base: null,
        initialized: false,
        importSelection: { publicKeys: new Set([key.id]) },
        hash: hashSyncValue,
      }),
    ).toEqual({ kind: 'push', value: guest, baseRevision: 3 });
  });
});
