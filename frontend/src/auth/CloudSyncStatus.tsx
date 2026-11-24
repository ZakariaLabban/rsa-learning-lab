import { useCloudSync } from './CloudSyncProvider';

const MESSAGE = {
  checking: 'Checking whether cloud synchronization is available…',
  syncing: 'Syncing approved public data…',
  synced: 'Your approved public data is synchronized.',
  offline: 'You are offline. Local changes are saved and will sync when you reconnect.',
  disabled: 'Cloud sync is paused. Your local data remains available on this device.',
  error: 'Could not synchronize. Your local data is safe; check the connection and retry.',
} satisfies Record<ReturnType<typeof useCloudSync>['status'], string>;

export function CloudSyncStatus() {
  const { status, lastSyncedAt, synchronize } = useCloudSync();
  return (
    <section>
      <hr style={{ margin: '32px 0' }} />
      <h2>Cloud Sync</h2>
      <p role={status === 'error' ? 'alert' : 'status'}>{MESSAGE[status]}</p>
      {status === 'synced' && lastSyncedAt !== null && (
        <p>Last successful sync: {new Date(lastSyncedAt).toLocaleString()}.</p>
      )}
      {(status === 'offline' || status === 'error') && (
        <button type="button" onClick={() => void synchronize()}>
          Retry sync
        </button>
      )}
    </section>
  );
}
