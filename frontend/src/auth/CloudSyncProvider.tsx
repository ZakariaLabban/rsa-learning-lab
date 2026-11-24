import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Keyring } from '../keyring';
import { localClearRevision } from './localDataKey';
import {
  readSyncCheckpoint,
  ignoreStaleTabOmissions,
  writeSyncCheckpoint,
  type LocalImportSelection,
  type PublicSnapshot,
} from './cloudSync';
import { synchronizePublicData } from './cloudSyncRunner';
import { syncGateway } from './syncGateway';
import { readCloudProfile } from '../lib/supabase';
import {
  PRACTICE_PROGRESS_CHANGED,
  progressKey,
  readProgress,
  saveProgress,
} from '../features/lessons/practiceProgress';

export type CloudSyncStatus = 'checking' | 'syncing' | 'synced' | 'offline' | 'disabled' | 'error';
type CloudSyncContextValue = {
  status: CloudSyncStatus;
  lastSyncedAt: number | null;
  synchronize: (selection?: LocalImportSelection) => Promise<boolean>;
};

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

function localSnapshot(store: Keyring, accountId: string): PublicSnapshot {
  const entries = store.getState().entries;
  return {
    publicKeys: entries
      .filter((entry) => entry.source === 'mine')
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        n: String(entry.key.n),
        e: String(entry.key.e),
        fingerprint: entry.fingerprint,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    contacts: entries
      .filter((entry) => entry.source === 'contact')
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        n: String(entry.key.n),
        e: String(entry.key.e),
        fingerprint: entry.fingerprint,
        verified: entry.verified === true,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    practiceProgress: readProgress(accountId),
  };
}

function mergeSelections(
  first: LocalImportSelection | undefined,
  second: LocalImportSelection | undefined,
): LocalImportSelection | undefined {
  if (!first) return second;
  if (!second) return first;
  return {
    publicKeys: new Set([...(first.publicKeys ?? []), ...(second.publicKeys ?? [])]),
    contacts: new Set([...(first.contacts ?? []), ...(second.contacts ?? [])]),
    practiceProgress: first.practiceProgress === true || second.practiceProgress === true,
  };
}

export function CloudSyncProvider({
  accountId,
  store,
  children,
}: {
  accountId: string;
  store: Keyring;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<CloudSyncStatus>('checking');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const running = useRef(false);
  const rerun = useRef(false);
  const pendingSelection = useRef<LocalImportSelection | undefined>(undefined);
  const pendingResolvers = useRef<Array<(success: boolean) => void>>([]);
  const lastRunSucceeded = useRef(false);

  const synchronize = useCallback(
    async (selection?: LocalImportSelection) => {
      if (running.current) {
        pendingSelection.current = mergeSelections(pendingSelection.current, selection);
        if (!selection) {
          rerun.current = true;
          return false;
        }
        return new Promise<boolean>((resolve) => pendingResolvers.current.push(resolve));
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setStatus('offline');
        lastRunSucceeded.current = false;
        return false;
      }

      running.current = true;
      lastRunSucceeded.current = false;
      setStatus('syncing');
      const clearRevision = localClearRevision(accountId);
      try {
        await store.ready;
        const profileController = new AbortController();
        const { data: profile, error: profileError } = await readCloudProfile(
          accountId,
          profileController.signal,
        );
        if (profileError) throw profileError;
        if (!profile) throw new Error('Cloud profile is missing.');
        if (!profile.sync_enabled || profile.data_deleted_at !== null) {
          setStatus('disabled');
          return false;
        }

        const before = localSnapshot(store, accountId);
        const deleteIntents = store.cloudDeleteIntents();
        const checkpoint = ignoreStaleTabOmissions(
          readSyncCheckpoint(accountId),
          before,
          new Set(deleteIntents.keys()),
        );
        const result = await synchronizePublicData({
          accountId,
          local: before,
          checkpoint,
          importSelection: selection,
          gateway: syncGateway,
        });

        // A deliberate local clear during a network request must not be undone by its reply.
        if (clearRevision !== localClearRevision(accountId)) {
          setStatus('synced');
          setLastSyncedAt(Date.now());
          return false;
        }

        await store.applyCloudPublicData(
          { publicKeys: before.publicKeys, contacts: before.contacts },
          { publicKeys: result.local.publicKeys, contacts: result.local.contacts },
        );
        if (
          JSON.stringify(readProgress(accountId)) === JSON.stringify(before.practiceProgress) &&
          JSON.stringify(result.local.practiceProgress) !== JSON.stringify(before.practiceProgress)
        ) {
          saveProgress(result.local.practiceProgress, accountId, clearRevision);
        }
        writeSyncCheckpoint(accountId, result.checkpoint);
        for (const { id } of [...before.contacts, ...before.publicKeys]) deleteIntents.delete(id);
        store.acknowledgeCloudDeletes(deleteIntents);
        setLastSyncedAt(Date.now());
        setStatus('synced');
        lastRunSucceeded.current = true;
        return true;
      } catch {
        setStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
        return false;
      } finally {
        running.current = false;
        const queued = pendingSelection.current;
        pendingSelection.current = undefined;
        const retry = rerun.current;
        rerun.current = false;
        if (queued || retry) window.setTimeout(() => void synchronize(queued), 0);
        else
          pendingResolvers.current
            .splice(0)
            .forEach((resolve) => resolve(lastRunSucceeded.current));
      }
    },
    [accountId, store],
  );

  useEffect(() => {
    let timer = 0;
    const progressStorageKey = `${progressKey}:account:${encodeURIComponent(accountId)}`;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void synchronize(), 500);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === progressStorageKey || event.key?.startsWith(`${progressStorageKey}:clear:`))
        schedule();
    };
    void synchronize();
    const unsubscribe = store.subscribe(schedule);
    window.addEventListener('online', schedule);
    window.addEventListener('focus', schedule);
    window.addEventListener(PRACTICE_PROGRESS_CHANGED, schedule);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('online', schedule);
      window.removeEventListener('focus', schedule);
      window.removeEventListener(PRACTICE_PROGRESS_CHANGED, schedule);
      window.removeEventListener('storage', onStorage);
    };
  }, [accountId, store, synchronize]);

  return (
    <CloudSyncContext.Provider value={{ status, lastSyncedAt, synchronize }}>
      {children}
    </CloudSyncContext.Provider>
  );
}

export function useCloudSync() {
  const context = useContext(CloudSyncContext);
  if (!context) throw new Error('useCloudSync must be used inside CloudSyncProvider.');
  return context;
}
