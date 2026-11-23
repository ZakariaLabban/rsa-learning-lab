import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';

type ProfileStatus = 'loading' | 'enabled' | 'disabled' | 'missing' | 'error';

export function CloudProfileStatus() {
  const { accountId } = useAuth();

  const [status, setStatus] = useState<ProfileStatus>('loading');

  useEffect(() => {
    const client = supabase;
    const userId = accountId;

    if (!client || !userId) return;

    const controller = new AbortController();

    void client
      .from('profiles')
      .select('sync_enabled, data_deleted_at')
      .eq('user_id', userId)
      .abortSignal(controller.signal)
      .maybeSingle()
      .then(({ data, error }) => {
        if (controller.signal.aborted) return;
        if (error) setStatus('error');
        else if (!data) setStatus('missing');
        else if (!data.sync_enabled || data.data_deleted_at !== null) setStatus('disabled');
        else setStatus('enabled');
      });

    return () => controller.abort();
  }, [accountId]);

  if (!accountId) return null;

  return (
    <section>
      <hr style={{ margin: '32px 0' }} />

      <h2>Cloud Account Status</h2>

      {status === 'loading' && <p role="status">Checking cloud account...</p>}

      {status === 'enabled' && (
        <p role="status">
          Your profile permits cloud writes. Import and synchronization are currently unavailable.
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
