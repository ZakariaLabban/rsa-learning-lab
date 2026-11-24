import { useState, useSyncExternalStore } from 'react';
import { keyring, useKeyringStore } from '../keyring';
import {
  emptyProgress,
  mergePracticeProgress,
  parseProgress,
  readProgress,
  saveProgress,
  type PracticeProgress,
} from '../features/lessons/practiceProgress';
import { useAuth } from './AuthProvider';
import { selectPublicGuestData } from './publicGuestData';
import { useCloudSync } from './CloudSyncProvider';

function progressDelta(previous: PracticeProgress, current: PracticeProgress): PracticeProgress {
  const topics = Object.fromEntries(
    Object.entries(current.topics).map(([topic, stats]) => {
      const before = previous.topics[topic as keyof typeof previous.topics] ?? {
        attempts: 0,
        correct: 0,
      };
      return [
        topic,
        {
          attempts: Math.max(0, stats.attempts - before.attempts),
          correct: Math.max(0, stats.correct - before.correct),
        },
      ];
    }),
  ) as PracticeProgress['topics'];
  return {
    version: 1,
    attempts: Math.max(0, current.attempts - previous.attempts),
    correct: Math.max(0, current.correct - previous.correct),
    streak: current.streak,
    best: current.best,
    seen: current.seen.filter((id) => !previous.seen.includes(id)),
    topics,
  };
}

function GuestImportSummary() {
  const { entries, ready } = useSyncExternalStore(keyring.subscribe, keyring.getState);
  if (!ready) return <p role="status">Checking local guest data...</p>;

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { accountId } = useAuth();
  const accountKeyring = useKeyringStore();
  const { synchronize, status } = useCloudSync();

  async function importGuestData() {
    if (!accountId || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await keyring.ready;
      await accountKeyring.ready;
      const guest = selectPublicGuestData(keyring.getState().entries, readProgress());
      const publicKeys = new Set<string>();
      const contacts = new Set<string>();
      for (const value of guest.publicKeys) {
        const entry = await accountKeyring.addPublicMine(value);
        publicKeys.add(entry.id);
      }
      for (const value of guest.contacts) {
        const entry = await accountKeyring.addPublicContact(value);
        contacts.add(entry.id);
      }

      const receiptKey = `rsa-lab.guest-import.v1.${encodeURIComponent(accountId)}`;
      let previousGuestProgress = emptyProgress();
      try {
        previousGuestProgress = parseProgress(localStorage.getItem(receiptKey));
      } catch {
        // Browser storage may be unavailable; the explicit import can still proceed in memory.
      }
      const delta = progressDelta(previousGuestProgress, guest.practiceProgress);
      const current = readProgress(accountId);
      const merged = mergePracticeProgress(current, delta);
      saveProgress(merged, accountId);
      try {
        localStorage.setItem(receiptKey, JSON.stringify(guest.practiceProgress));
      } catch {
        // Sync metadata is best-effort; the user can still retry the cloud operation.
      }
      const hasGuestProgress = delta.attempts > 0;
      const synced = await synchronize({
        publicKeys,
        contacts,
        practiceProgress: hasGuestProgress,
      });
      if (!synced) throw new Error('Cloud synchronization did not complete.');
      setChoice('local');
      setMessage(
        `Imported guest public data: ${publicKeys.size} public keys, ${contacts.size} contacts, and ${guest.practiceProgress.attempts} practice attempts.`,
      );
    } catch {
      setError(
        'Guest data was copied locally, but cloud sync could not finish. Retry sync when online.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <hr style={{ margin: '32px 0' }} />
      <h2>Guest Data and Cloud Import</h2>
      <p>Signing in never uploads guest data automatically.</p>
      <p>
        Only public RSA values, contact details, verification choices, and practice progress are
        imported. Private RSA components remain on this device in the guest profile.
      </p>
      <fieldset style={{ margin: '20px 0', padding: '16px' }}>
        <legend>Choose what to do with guest data</legend>
        <label style={{ display: 'block', marginBottom: '12px' }}>
          <input
            type="radio"
            name="guest-import-choice"
            checked={choice === 'local'}
            onChange={() => setChoice('local')}
            disabled={busy}
          />{' '}
          Keep my guest data on this device
        </label>
        <label style={{ display: 'block' }}>
          <input
            type="radio"
            name="guest-import-choice"
            checked={choice === 'review'}
            onChange={() => setChoice('review')}
            disabled={busy}
          />{' '}
          Review guest data for import to this account
        </label>
      </fieldset>
      {choice === 'review' && (
        <>
          <GuestImportSummary />
          <button
            type="button"
            onClick={() => void importGuestData()}
            disabled={busy || status === 'disabled'}
          >
            {busy ? 'Importing and syncing...' : 'Import guest public data and sync'}
          </button>
          <p>
            This explicit action copies the selected public data into the signed-in account and
            starts synchronization. The guest profile and its private keys stay on this device.
          </p>
        </>
      )}
      {choice === 'local' && <p>Your guest information remains local and is not uploaded.</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
