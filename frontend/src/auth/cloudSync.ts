import type { PracticeProgress } from '../features/lessons/practiceProgress';

export type CloudPublicKey = {
  id: string;
  name: string;
  n: string;
  e: string;
  fingerprint: string;
};

export type CloudContact = CloudPublicKey & { verified: boolean };
export type CloudEntity<T> = T & {
  revision: number;
  updated_at: string;
  deleted_at: string | null;
};

export type CloudSnapshot = {
  publicKeys: CloudEntity<CloudPublicKey>[];
  contacts: CloudEntity<CloudContact>[];
  practiceProgress: (CloudEntity<{ progress: PracticeProgress }> & { user_id: string }) | null;
};

export type PublicSnapshot = {
  publicKeys: CloudPublicKey[];
  contacts: CloudContact[];
  practiceProgress: PracticeProgress;
};

export type SyncEntityBase = { revision: number; hash: string; deleted: boolean };
export type SyncCheckpoint = {
  version: 1;
  initialized: boolean;
  publicKeys: Record<string, SyncEntityBase>;
  contacts: Record<string, SyncEntityBase>;
  practiceProgress: SyncEntityBase | null;
};

export const emptySyncCheckpoint = (): SyncCheckpoint => ({
  version: 1,
  initialized: false,
  publicKeys: {},
  contacts: {},
  practiceProgress: null,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECKPOINT_PREFIX = 'rsa-lab.sync.v1';

export function syncCheckpointKey(userId: string) {
  if (!UUID.test(userId)) throw new Error('Invalid account ID.');
  return `${CHECKPOINT_PREFIX}.${userId.toLowerCase()}`;
}

export function clearSyncCheckpoint(userId: string, storage: Pick<Storage, 'removeItem'>) {
  storage.removeItem(syncCheckpointKey(userId));
}

export function readSyncCheckpoint(
  userId: string,
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined'
    ? null
    : localStorage,
): SyncCheckpoint {
  try {
    const raw = storage?.getItem(syncCheckpointKey(userId));
    if (!raw || raw.length > 500_000) return emptySyncCheckpoint();
    const value = JSON.parse(raw) as SyncCheckpoint;
    if (
      value.version !== 1 ||
      typeof value.initialized !== 'boolean' ||
      !isBaseMap(value.publicKeys) ||
      !isBaseMap(value.contacts) ||
      (value.practiceProgress !== null && !isBase(value.practiceProgress))
    )
      return emptySyncCheckpoint();
    return value;
  } catch {
    return emptySyncCheckpoint();
  }
}

export function writeSyncCheckpoint(
  userId: string,
  value: SyncCheckpoint,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined'
    ? null
    : localStorage,
) {
  storage?.setItem(syncCheckpointKey(userId), JSON.stringify(value));
}

function isBase(value: unknown): value is SyncEntityBase {
  if (!value || typeof value !== 'object') return false;
  const base = value as SyncEntityBase;
  return (
    Number.isSafeInteger(base.revision) &&
    base.revision >= 0 &&
    typeof base.hash === 'string' &&
    base.hash.length <= 100_000 &&
    typeof base.deleted === 'boolean'
  );
}

function isBaseMap(value: unknown): value is Record<string, SyncEntityBase> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(([id, base]) => UUID.test(id) && isBase(base))
  );
}

export function hashSyncValue(value: unknown): string {
  // Inputs are constructed in a fixed property order from allowlisted fields.
  return JSON.stringify(value);
}

export type LocalImportSelection = {
  publicKeys?: ReadonlySet<string>;
  contacts?: ReadonlySet<string>;
  practiceProgress?: boolean;
};

export type ReconcileAction<T> =
  | { kind: 'push'; value: T | null; baseRevision: number | null }
  | { kind: 'pull'; value: T | null }
  | { kind: 'defer'; value: T | null }
  | { kind: 'keep'; value: T | null };

function selected(
  section: keyof Required<LocalImportSelection>,
  id: string | null,
  selection?: LocalImportSelection,
) {
  if (!selection) return false;
  if (section === 'practiceProgress') return selection.practiceProgress === true;
  if (!id) return false;
  return selection[section]?.has(id) === true;
}

/**
 * Resolve one local/cloud record. The server revision is authoritative: a remote
 * revision that changed since the base wins an unresolved concurrent edit. This
 * is deterministic and prevents an offline snapshot from resurrecting a cloud
 * tombstone. Explicit guest import can override an active remote record once.
 */
export function reconcileRecord<T>(args: {
  section: keyof Required<LocalImportSelection>;
  id: string | null;
  local: T | null;
  remote: { value: T; revision: number; deleted: boolean } | null;
  base: SyncEntityBase | null;
  initialized: boolean;
  importSelection?: LocalImportSelection;
  hash: (value: T | null) => string;
}): ReconcileAction<T> {
  const { local, remote, base } = args;
  const importLocal = selected(args.section, args.id, args.importSelection) && local !== null;

  if (remote?.deleted) return { kind: 'pull', value: null };

  if (!base) {
    if (remote) {
      if (importLocal && args.hash(local) !== args.hash(remote.value))
        return { kind: 'push', value: local, baseRevision: remote.revision };
      return { kind: 'pull', value: remote.value };
    }
    if (!local) return { kind: 'keep', value: null };
    return { kind: 'push', value: local, baseRevision: null };
  }

  const localHash = args.hash(local);
  const remoteHash = remote ? args.hash(remote.value) : '';
  const localUnchanged = localHash === base.hash || (local === null && base.deleted);
  const remoteUnchanged = Boolean(
    remote &&
    remote.revision === base.revision &&
    remoteHash === base.hash &&
    remote.deleted === base.deleted,
  );
  const remoteMissingUnchanged = !remote && base.revision === 0;

  if (importLocal && remote && localHash !== remoteHash)
    return { kind: 'push', value: local, baseRevision: remote.revision };
  if (localUnchanged && (remoteUnchanged || remoteMissingUnchanged))
    return { kind: 'keep', value: local };
  if (!localUnchanged && (remoteUnchanged || remoteMissingUnchanged))
    return { kind: 'push', value: local, baseRevision: remote?.revision ?? null };
  if (remote && local !== null && localHash === remoteHash)
    return { kind: 'pull', value: remote.value };

  // A cloud row was changed or removed since the last successful sync. It wins.
  return { kind: 'pull', value: remote && !remote.deleted ? remote.value : null };
}

export function makeSyncBase<T>(
  value: T | null,
  revision: number,
  deleted: boolean,
  hash: (value: T | null) => string,
): SyncEntityBase {
  return { revision, hash: value === null ? '' : hash(value), deleted };
}

/** Only treat an absent local record as deleted when someone explicitly removed it. */
export function ignoreStaleTabOmissions(
  checkpoint: SyncCheckpoint,
  local: PublicSnapshot,
  deletedIds: ReadonlySet<string>,
): SyncCheckpoint {
  const dropUnloaded = (bases: SyncCheckpoint['contacts'], records: CloudPublicKey[]) => {
    const loadedIds = new Set(records.map(({ id }) => id));
    return Object.fromEntries(
      Object.entries(bases).filter(([id]) => loadedIds.has(id) || deletedIds.has(id)),
    );
  };
  return {
    ...checkpoint,
    publicKeys: dropUnloaded(checkpoint.publicKeys, local.publicKeys),
    contacts: dropUnloaded(checkpoint.contacts, local.contacts),
  };
}
