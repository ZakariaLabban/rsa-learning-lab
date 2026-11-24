import { useEffect, useState } from 'react';
import { cloudProfileChangeKey } from './accountCache';
import { useAuth } from './AuthProvider';
import { readCloudProfile } from '../lib/supabase';

type ProfileStatus = 'loading' | 'enabled' | 'disabled' | 'missing' | 'error';

export function CloudProfileStatus() {
  const { accountId } = useAuth();

  const [status, setStatus] = useState<ProfileStatus>('loading');

  useEffect(() => {
    if (!accountId) return;
    const userId = accountId;

    let request: AbortController | undefined;
    function refresh() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      void readCloudProfile(userId, controller.signal)
        .then(({ data, error }) => {
          if (controller.signal.aborted) return;
          if (error) setStatus('error');
          else if (!data) setStatus('missing');
          else if (!data.sync_enabled || data.data_deleted_at !== null) setStatus('disabled');
          else setStatus('enabled');
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus('error');
        });
    }

    const refreshAfterCloudChange = (event: StorageEvent) => {
      if (event.key === cloudProfileChangeKey(userId)) refresh();
    };

    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refreshAfterCloudChange);
    return () => {
      request?.abort();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refreshAfterCloudChange);
    };
  }, [accountId]);

  if (!accountId) return null;

  return (
    <section>
      <hr style={{ margin: '32px 0' }} />

      <h2>Cloud Account Status</h2>

      {status === 'loading' && <p role="status">Checking cloud account...</p>}

      {status === 'enabled' && (
        <p role="status">
          Cloud sync is enabled. Guest data remains separate until you explicitly choose to import
          it.
        </p>
      )}

      {status === 'disabled' && (
        <p role="status">
          Cloud synchronization is disabled for this account. Your local RSA tools remain available.
        </p>
      )}

      {status === 'missing' && <p role="alert">No cloud profile was found for this account.</p>}

      {status === 'error' && (
        <p role="alert">
          Could not verify cloud permissions. Cloud operations should remain disabled until this is
          resolved.
        </p>
      )}
    </section>
  );
}
