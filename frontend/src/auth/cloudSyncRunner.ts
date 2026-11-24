import type { PracticeProgress } from '../features/lessons/practiceProgress';
import {
  emptySyncCheckpoint,
  hashSyncValue,
  makeSyncBase,
  reconcileRecord,
  type CloudContact,
  type CloudEntity,
  type CloudPublicKey,
  type CloudSnapshot,
  type LocalImportSelection,
  type PublicSnapshot,
  type SyncCheckpoint,
  type SyncEntityBase,
} from './cloudSync';

export type SyncGateway = {
  load(accountId: string): Promise<CloudSnapshot>;
  insertPublicKey(
    accountId: string,
    value: CloudPublicKey,
  ): Promise<CloudEntity<CloudPublicKey> | null>;
  updatePublicKey(
    accountId: string,
    id: string,
    revision: number,
    value: Omit<CloudPublicKey, 'id'> & { deleted_at: string | null },
  ): Promise<CloudEntity<CloudPublicKey> | null>;
  insertContact(accountId: string, value: CloudContact): Promise<CloudEntity<CloudContact> | null>;
  updateContact(
    accountId: string,
    id: string,
    revision: number,
    value: Omit<CloudContact, 'id'> & { deleted_at: string | null },
  ): Promise<CloudEntity<CloudContact> | null>;
  insertPracticeProgress(
    accountId: string,
    progress: PracticeProgress,
  ): Promise<CloudSnapshot['practiceProgress']>;
  updatePracticeProgress(
    accountId: string,
    revision: number,
    progress: PracticeProgress,
    deletedAt: string | null,
  ): Promise<CloudSnapshot['practiceProgress']>;
};

export class SyncRevisionConflict extends Error {
  constructor() {
    super('Cloud data changed during synchronization.');
    this.name = 'SyncRevisionConflict';
  }
}

function isRetryableSyncConflict(error: unknown) {
  return (
    error instanceof SyncRevisionConflict ||
    (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505')
  );
}

type SyncSection = 'publicKeys' | 'contacts';

function keyValue(row: CloudEntity<CloudPublicKey>): CloudPublicKey {
  return { id: row.id, name: row.name, n: row.n, e: row.e, fingerprint: row.fingerprint };
}

function contactValue(row: CloudEntity<CloudContact>): CloudContact {
  return {
    id: row.id,
    name: row.name,
    n: row.n,
    e: row.e,
    fingerprint: row.fingerprint,
    verified: row.verified,
  };
}

function keyHash(value: CloudPublicKey | null) {
  return hashSyncValue(value);
}

function contactHash(value: CloudContact | null) {
  return hashSyncValue(value);
}

function baseFor<T>(
  row: CloudEntity<T> | null,
  value: T | null,
  hash: (value: T | null) => string,
): SyncEntityBase | null {
  if (!row) return null;
  return makeSyncBase(
    row.deleted_at === null ? value : null,
    row.revision,
    row.deleted_at !== null,
    hash,
  );
}

async function runSection<T extends { id: string }>(args: {
  section: SyncSection;
  localValues: T[];
  remoteRows: CloudEntity<T>[];
  bases: Record<string, SyncEntityBase>;
  initialized: boolean;
  importSelection?: LocalImportSelection;
  hash: (value: T | null) => string;
  toValue: (row: CloudEntity<T>) => T;
  insert: (value: T) => Promise<CloudEntity<T> | null>;
  update: (
    id: string,
    revision: number,
    value: T & { deleted_at: string | null },
  ) => Promise<CloudEntity<T> | null>;
}): Promise<{ values: T[]; bases: Record<string, SyncEntityBase> }> {
  const local = new Map(args.localValues.map((value) => [value.id, value]));
  const remote = new Map(args.remoteRows.map((row) => [row.id, row]));
  const values = new Map<string, T>();
  const bases: Record<string, SyncEntityBase> = {};
  const ids = new Set([...local.keys(), ...remote.keys(), ...Object.keys(args.bases)]);

  for (const id of ids) {
    const localValue = local.get(id) ?? null;
    const remoteRow = remote.get(id) ?? null;
    const remoteValue = remoteRow ? args.toValue(remoteRow) : null;
    const base = args.bases[id] ?? null;
    const decision = reconcileRecord({
      section: args.section,
      id,
      local: localValue,
      remote: remoteRow
        ? {
            value: remoteValue as T,
            revision: remoteRow.revision,
            deleted: remoteRow.deleted_at !== null,
          }
        : null,
      base,
      initialized: args.initialized,
      importSelection: args.importSelection,
      hash: args.hash,
    });

    if (decision.kind === 'push') {
      if (decision.value === null) {
        if (!remoteRow || remoteRow.deleted_at !== null) continue;
        const tombstoneValue = {
          ...remoteValue,
          deleted_at: '1970-01-01T00:00:00.000Z',
        } as T & { deleted_at: string | null };
        const updated = await args.update(
          id,
          decision.baseRevision ?? remoteRow.revision,
          tombstoneValue,
        );
        if (!updated) throw new SyncRevisionConflict();
        const deletedValue = args.toValue(updated);
        bases[id] = baseFor(updated, deletedValue, args.hash)!;
        continue;
      }

      const activeValue = decision.value;
      let saved: CloudEntity<T> | null;
      if (decision.baseRevision !== null) {
        saved = await args.update(id, decision.baseRevision, {
          ...activeValue,
          deleted_at: null,
        } as T & { deleted_at: string | null });
      } else {
        saved = await args.insert(activeValue);
      }
      if (!saved) throw new SyncRevisionConflict();
      const savedValue = args.toValue(saved);
      values.set(id, savedValue);
      bases[id] = baseFor(saved, savedValue, args.hash)!;
      continue;
    }

    if (decision.kind === 'defer') {
      if (decision.value !== null) {
        values.set(id, decision.value);
        bases[id] = makeSyncBase(decision.value, 0, false, args.hash);
      }
      continue;
    }

    if (decision.value !== null) values.set(id, decision.value);
    if (remoteRow) {
      const rowValue = remoteRow.deleted_at !== null ? null : remoteValue;
      bases[id] = baseFor(remoteRow, rowValue as T | null, args.hash)!;
    } else if (base?.revision === 0 && decision.value !== null) {
      bases[id] = makeSyncBase(decision.value, 0, false, args.hash);
    }
  }

  return { values: [...values.values()], bases };
}

function isEmptyProgress(value: PracticeProgress) {
  return (
    value.attempts === 0 &&
    value.correct === 0 &&
    value.streak === 0 &&
    value.best === 0 &&
    value.seen.length === 0 &&
    Object.keys(value.topics).length === 0
  );
}

export async function synchronizePublicData(args: {
  accountId: string;
  local: PublicSnapshot;
  checkpoint: SyncCheckpoint;
  importSelection?: LocalImportSelection;
  gateway: SyncGateway;
}): Promise<{ local: PublicSnapshot; checkpoint: SyncCheckpoint }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const remote = await args.gateway.load(args.accountId);
    try {
      const keys = await runSection({
        section: 'publicKeys',
        localValues: args.local.publicKeys,
        remoteRows: remote.publicKeys,
        bases: args.checkpoint.publicKeys,
        initialized: args.checkpoint.initialized,
        importSelection: args.importSelection,
        hash: keyHash,
        toValue: keyValue,
        insert: (value) => args.gateway.insertPublicKey(args.accountId, value),
        update: (id, revision, value) =>
          args.gateway.updatePublicKey(args.accountId, id, revision, value),
      });
      const contacts = await runSection({
        section: 'contacts',
        localValues: args.local.contacts,
        remoteRows: remote.contacts,
        bases: args.checkpoint.contacts,
        initialized: args.checkpoint.initialized,
        importSelection: args.importSelection,
        hash: contactHash,
        toValue: contactValue,
        insert: (value) => args.gateway.insertContact(args.accountId, value),
        update: (id, revision, value) =>
          args.gateway.updateContact(args.accountId, id, revision, value),
      });

      const localProgress = args.local.practiceProgress;
      const remoteProgress = remote.practiceProgress;
      const remoteProgressValue = remoteProgress ? { progress: remoteProgress.progress } : null;
      const decision = reconcileRecord({
        section: 'practiceProgress',
        id: null,
        local: { progress: localProgress },
        remote: remoteProgress
          ? {
              value: remoteProgressValue!,
              revision: remoteProgress.revision,
              deleted: remoteProgress.deleted_at !== null,
            }
          : null,
        base: args.checkpoint.practiceProgress,
        initialized: args.checkpoint.initialized,
        importSelection: args.importSelection,
        hash: (value) => hashSyncValue(value),
      });

      let progress = localProgress;
      let progressBase: SyncEntityBase | null = null;
      if (decision.kind === 'push') {
        if (decision.value === null) {
          if (remoteProgress && remoteProgress.deleted_at === null) {
            const saved = await args.gateway.updatePracticeProgress(
              args.accountId,
              decision.baseRevision ?? remoteProgress.revision,
              remoteProgress.progress,
              '1970-01-01T00:00:00.000Z',
            );
            if (!saved) throw new SyncRevisionConflict();
            progressBase = makeSyncBase(null, saved.revision, true, (value) =>
              hashSyncValue(value),
            );
          }
        } else {
          const next = (decision.value as { progress: PracticeProgress }).progress;
          const saved =
            decision.baseRevision === null
              ? await args.gateway.insertPracticeProgress(args.accountId, next)
              : await args.gateway.updatePracticeProgress(
                  args.accountId,
                  decision.baseRevision,
                  next,
                  null,
                );
          if (!saved) throw new SyncRevisionConflict();
          progress = saved.deleted_at === null ? saved.progress : localProgress;
          progressBase = makeSyncBase(
            saved.deleted_at === null ? { progress: saved.progress } : null,
            saved.revision,
            saved.deleted_at !== null,
            (value) => hashSyncValue(value),
          );
        }
      } else if (decision.kind === 'defer') {
        progress = decision.value?.progress ?? localProgress;
        progressBase = makeSyncBase({ progress: progress }, 0, false, (value) =>
          hashSyncValue(value),
        );
      } else if (decision.kind === 'pull') {
        progress = decision.value?.progress ?? localProgress;
        progressBase = remoteProgress
          ? makeSyncBase(
              remoteProgress.deleted_at === null ? { progress: remoteProgress.progress } : null,
              remoteProgress.revision,
              remoteProgress.deleted_at !== null,
              (value) => hashSyncValue(value),
            )
          : null;
      } else if (remoteProgress) {
        progressBase = makeSyncBase(
          remoteProgress.deleted_at === null ? { progress: remoteProgress.progress } : null,
          remoteProgress.revision,
          remoteProgress.deleted_at !== null,
          (value) => hashSyncValue(value),
        );
      } else if (args.checkpoint.practiceProgress?.revision === 0) {
        progressBase = args.checkpoint.practiceProgress;
      } else if (!args.checkpoint.initialized && isEmptyProgress(localProgress)) {
        progressBase = makeSyncBase({ progress: localProgress }, 0, false, (value) =>
          hashSyncValue(value),
        );
      }

      const checkpoint: SyncCheckpoint = {
        version: 1,
        initialized: true,
        publicKeys: keys.bases,
        contacts: contacts.bases,
        practiceProgress: progressBase,
      };
      return {
        local: {
          publicKeys: keys.values,
          contacts: contacts.values,
          practiceProgress: progress,
        },
        checkpoint,
      };
    } catch (error) {
      if (!isRetryableSyncConflict(error) || attempt === 2) throw error;
      // Reload the latest server revision and deterministically resolve again.
      args.checkpoint = { ...args.checkpoint, initialized: true };
    }
  }
  throw new SyncRevisionConflict();
}

export function emptyProgressHash(value: PracticeProgress) {
  return hashSyncValue({ progress: value });
}

export { emptySyncCheckpoint };
