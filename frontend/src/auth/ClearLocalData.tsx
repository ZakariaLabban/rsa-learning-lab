import { useState } from 'react';
import { STORAGE_KEY, useKeyringStore } from '../keyring';
import { clearKeyVault } from '../engine/client';
import { progressKey } from '../features/lessons/practiceProgress';

import { useAuth } from './AuthProvider';
import { localClearKey, purgeObsoleteLocalData } from './localDataKey';

export function ClearLocalData() {
  const keyring = useKeyringStore();
  const { accountId } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleClear() {
    if (confirmation !== 'CLEAR' || busy) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await keyring.ready;

      localStorage.setItem(localClearKey(accountId), crypto.randomUUID());
      keyring.clearAll();
      purgeObsoleteLocalData(localStorage, accountId, [STORAGE_KEY, progressKey]);

      setConfirming(false);
      setConfirmation('');

      setMessage('Your local RSA keys, contacts, and practice progress ' + 'have been cleared.');
    } catch {
      keyring.resetAfterClear();
      setError(
        'Some local information could not be cleared. ' +
          'Please check your browser storage settings.',
      );
    } finally {
      clearKeyVault();
      setBusy(false);
    }
  }

  return (
    <section>
      <hr style={{ margin: '32px 0' }} />

      <h2>Clear Local Data</h2>

      <p>
        Remove RSA keys, contacts, and practice progress for the current profile in this browser.
      </p>

      <p>
        This also removes locally saved private keys. Export any keys you need before continuing.
      </p>

      <p>
        Your Supabase account, cloud records, authentication session, and display preferences will
        remain.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => {
            setMessage('');
            setError('');
            setConfirming(true);
          }}
        >
          Clear local data...
        </button>
      ) : (
        <div>
          <p>
            <strong>This will remove your local RSA data. This action cannot be undone.</strong>
          </p>
          <label htmlFor="clear-confirmation">Type CLEAR to confirm:</label>
          <input
            id="clear-confirmation"
            type="text"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={busy}
            autoComplete="off"
            style={{
              display: 'block',
              width: '100%',
              padding: '12px',
              margin: '10px 0 16px',
              boxSizing: 'border-box',
            }}
          />
          <button type="button" onClick={handleClear} disabled={busy || confirmation !== 'CLEAR'}>
            {busy ? 'Clearing...' : 'Permanently clear local data'}
          </button>{' '}
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              setConfirmation('');
            }}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      )}

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
