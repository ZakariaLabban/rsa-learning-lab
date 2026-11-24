import { useState, useSyncExternalStore } from 'react';
import { keyring } from '../keyring';
import { readProgress } from '../features/lessons/practiceProgress';
import { selectPublicGuestData } from './publicGuestData';

function GuestImportSummary() {
  const { entries, ready } = useSyncExternalStore(keyring.subscribe, keyring.getState);
  if (!ready) return <p role="status">Checking local data...</p>;

  const data = selectPublicGuestData(entries, readProgress());
  return (
    <p>
      <strong>Guest data available in this browser</strong>
      <br />
      Public keys: {data.publicKeys.length}
      <br />
      Contacts: {data.contacts.length}
      <br />
      Practice attempts: {data.practiceProgress.attempts}
    </p>
  );
}

export function GuestImportChoice() {
  const [choice, setChoice] = useState<'local' | 'review'>('local');

  return (
    <section>
      <hr style={{ margin: '32px 0' }} />

      <h2>Guest Data and Cloud Import</h2>

      <p>Signing in does not automatically upload information saved in this browser.</p>

      <p>
        If cloud synchronization is enabled later, only approved public RSA information, contacts,
        and practice progress may be imported.
      </p>

      <p>
        Private RSA components stay on this device. Public keys and contact names do not verify
        identities.
      </p>

      {choice === 'review' && <GuestImportSummary />}

      <fieldset style={{ margin: '20px 0', padding: '16px' }}>
        <legend>What would you prefer?</legend>

        <label style={{ display: 'block', marginBottom: '12px' }}>
          <input
            type="radio"
            name="guest-import-choice"
            checked={choice === 'local'}
            onChange={() => setChoice('local')}
          />{' '}
          Keep my guest data on this device
        </label>

        <label style={{ display: 'block' }}>
          <input
            type="radio"
            name="guest-import-choice"
            checked={choice === 'review'}
            onChange={() => setChoice('review')}
          />{' '}
          Review this public data for a future cloud import
        </label>
      </fieldset>

      {choice === 'review' && (
        <p role="status">
          Your preference is noted for this page only. No information has been uploaded or approved
          for automatic synchronization. A separate confirmation will be required when cloud import
          is implemented.
        </p>
      )}

      {choice === 'local' && (
        <p>Your guest information will remain local. No cloud import has been requested.</p>
      )}
    </section>
  );
}
