import { useId, useState } from 'react';
import { groupFingerprint } from '../engine/encoding';
import {
  recipientFromEntry,
  recipientFromPaste,
  recipientGroups,
  useKeyring,
  type Recipient,
} from '../keyring';

const PASTE = '__paste__';

/**
 * "To:" field: choose who to encrypt for — Me, Demo characters, My contacts — or paste a
 * public key for one-time use (not saved). Reports the chosen recipient's public key.
 */
export function RecipientPicker({
  value,
  onChange,
  label = 'To',
}: {
  value: Recipient | null;
  onChange: (recipient: Recipient | null) => void;
  label?: string;
}) {
  const state = useKeyring();
  const id = useId();
  const [pasting, setPasting] = useState(value?.source === 'pasted'),
    [text, setText] = useState(''),
    [error, setError] = useState('');
  const groups = recipientGroups(state);
  const selected = pasting ? PASTE : (value?.entryId ?? '');

  return (
    <div className="recipient-picker">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={selected}
        onChange={(event) => {
          setError('');
          if (event.target.value === PASTE) {
            setPasting(true);
            onChange(null);
            return;
          }
          setPasting(false);
          const entry = state.entries.find((e) => e.id === event.target.value);
          onChange(entry ? recipientFromEntry(entry) : null);
        }}
      >
        <option value="">Choose a recipient…</option>
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} · {entry.bits}-bit
                {entry.source === 'contact' && !entry.verified ? ' · unverified' : ''}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={PASTE}>Paste a public key…</option>
      </select>
      {pasting && (
        <div className="recipient-paste">
          <textarea
            aria-label="Public key to encrypt for"
            className="mono"
            rows={4}
            placeholder="Paste the contents of their .pub file"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button
            className="secondary-button"
            disabled={!text.trim()}
            onClick={async () => {
              setError('');
              try {
                onChange(await recipientFromPaste(text));
              } catch (e) {
                onChange(null);
                setError((e as Error).message);
              }
            }}
          >
            Use this key
          </button>
          <span className="helper-text">Used once and not saved.</span>
        </div>
      )}
      {error && (
        <p role="alert" className="recipient-error">
          {error}
        </p>
      )}
      {value && (
        <p className="recipient-summary">
          <span className="mono" title={value.fingerprint}>
            {groupFingerprint(value.fingerprint).slice(0, 19)}…
          </span>
          {value.source === 'contact' && !value.verified && (
            <span className="keyring-badge warn">Unverified: compare fingerprints first</span>
          )}
          {value.source === 'demo' && (
            <span className="keyring-badge warn">Demo key: its private key is public</span>
          )}
        </p>
      )}
    </div>
  );
}
