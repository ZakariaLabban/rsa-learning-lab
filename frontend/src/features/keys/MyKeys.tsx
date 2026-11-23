import { Term } from '../../components/Term';
import { useRef, useState } from 'react';
import { BadgeCheck, Download, KeyRound, Trash2, Upload, Users } from 'lucide-react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { groupFingerprint } from '../../engine/encoding';
import type { PrivateKey } from '../../engine/math';
import {
  fileSlug,
  keyPairFile,
  useKeyringStore,
  publicKeyFile,
  useKeyring,
  type KeyEntry,
} from '../../keyring';

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const SOURCE_LABEL = {
  mine: 'My keys',
  contact: 'Contacts',
  demo: 'Built-in demo keys',
  lecture: 'Built-in demo keys',
} as const;

/**
 * Keys page section: every key in the shared keyring, plus import/export, the
 * "remember private keys" toggle and clear-all. `onUse` lets the existing Key Studio and
 * Workbench use an assignment-size key.
 */
export function MyKeys({ onUse }: { onUse?: (key: PrivateKey) => Promise<void> }) {
  const keyring = useKeyringStore();
  const state = useKeyring();
  const [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [pasted, setPasted] = useState(''),
    [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const run = async (action: () => unknown | Promise<unknown>, done?: string) => {
    setError('');
    setStatus('');
    try {
      await action();
      if (done) setStatus(done);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const imported = (entry: KeyEntry) =>
    `Added "${entry.name}" to ${entry.source === 'mine' ? 'My keys' : 'Contacts'}.`;

  async function importText(text: string, fallbackName?: string) {
    await run(async () => setStatus(imported(await keyring.importFile(text, fallbackName))));
  }

  const groups = (['mine', 'contact', 'demo'] as const).map((source) => ({
    source,
    title: SOURCE_LABEL[source],
    entries: state.entries.filter((entry) =>
      source === 'demo'
        ? entry.source === 'demo' || entry.source === 'lecture'
        : entry.source === source,
    ),
  }));

  return (
    <section className="panel keyring-panel" aria-labelledby="keyring-title">
      <div className="panel-top">
        <div className="panel-title">
          <KeyRound size={17} />
          <h2 id="keyring-title">My keyring</h2>
          <span className="subtle-badge">THIS BROWSER ONLY</span>
        </div>
      </div>
      <div className="keyring-body">
        <p className="keyring-intro">
          Every key the lab uses: your key pairs, other people’s{' '}
          <Term term="publicKey">public keys</Term> and the built-in demo keys. Nothing is uploaded.
        </p>
        <ErrorBanner message={error} onDismiss={() => setError('')} />
        {state.storageProblem && <p className="keyring-warning">{state.storageProblem}</p>}
        <p className="keyring-status" role="status" aria-live="polite">
          {status}
        </p>

        <div className="keyring-toolbar">
          <button className="secondary-button" onClick={() => fileInput.current?.click()}>
            <Upload size={15} /> Import key file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".pub,.json,application/json"
            hidden
            aria-label="Key file to import"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) await importText(await file.text(), file.name.replace(/\.[^.]*$/, ''));
            }}
          />
          <label className="keyring-toggle">
            <input
              type="checkbox"
              checked={state.rememberPrivate}
              onChange={(event) => run(() => keyring.setRememberPrivate(event.target.checked))}
            />
            Remember my private keys on this device
          </label>
          <button
            className="text-button danger-text"
            onClick={() => {
              if (window.confirm('Delete all your keys and contacts from this browser?'))
                run(() => keyring.clearAll(), 'Your keys and contacts were cleared.');
            }}
          >
            <Trash2 size={14} /> Clear all
          </button>
        </div>
        {state.rememberPrivate ? (
          <p className="keyring-warning">
            Your private keys are saved unencrypted in this browser. Anyone using this browser
            profile can read them. Turn this off to delete them from storage.
          </p>
        ) : (
          <p className="helper-text">
            Private keys held in memory disappear when you refresh or close the tab. For a signed-in
            profile, they also disappear when the active account changes. Export a key-pair file to
            keep a backup. Contacts are saved.
          </p>
        )}

        <details className="keyring-paste">
          <summary>Paste key text instead</summary>
          <label htmlFor="keyring-paste-text" className="helper-text">
            Paste the contents of a .pub file (or a key-pair file)
          </label>
          <textarea
            id="keyring-paste-text"
            className="mono"
            rows={4}
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
          />
          <button
            className="secondary-button"
            disabled={!pasted.trim()}
            onClick={async () => {
              await importText(pasted);
              setPasted('');
            }}
          >
            Import pasted key
          </button>
        </details>

        {groups.map((group) => (
          <div className="keyring-group" key={group.source}>
            <h3>
              {group.source === 'contact' ? <Users size={15} /> : <KeyRound size={15} />}
              {group.title}
            </h3>
            {group.entries.length === 0 ? (
              <p className="helper-text">
                {group.source === 'mine'
                  ? 'Generate a key pair above or import a key-pair file.'
                  : 'Import someone’s .pub file to add them.'}
              </p>
            ) : (
              <ul className="keyring-list">
                {group.entries.map((entry) => (
                  <li key={entry.id} className={entry.id === state.activeId ? 'active-key' : ''}>
                    <div className="keyring-entry-main">
                      {renaming?.id === entry.id ? (
                        <form
                          className="keyring-rename"
                          onSubmit={(event) => {
                            event.preventDefault();
                            run(() => {
                              keyring.rename(entry.id, renaming.name);
                              setRenaming(null);
                            });
                          }}
                        >
                          <input
                            aria-label={`New name for ${entry.name}`}
                            value={renaming.name}
                            maxLength={60}
                            autoFocus
                            onChange={(event) =>
                              setRenaming({ id: entry.id, name: event.target.value })
                            }
                          />
                          <button className="text-button" type="submit">
                            Save
                          </button>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => setRenaming(null)}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <strong>{entry.name}</strong>
                      )}
                      <span className="keyring-badges">
                        <span className="keyring-badge">{entry.bits}-bit</span>
                        {entry.id === state.activeId && (
                          <span className="keyring-badge active">Active</span>
                        )}
                        {entry.source === 'demo' && (
                          <span className="keyring-badge warn">Demo · private key is public</span>
                        )}
                        {entry.source === 'lecture' && (
                          <span className="keyring-badge">Lecture example</span>
                        )}
                        {entry.source === 'contact' && (
                          <span className={`keyring-badge ${entry.verified ? 'active' : 'warn'}`}>
                            {entry.verified ? 'Verified' : 'Unverified'}
                          </span>
                        )}
                      </span>
                      <span className="mono keyring-fingerprint" title={entry.fingerprint}>
                        {groupFingerprint(entry.fingerprint).slice(0, 39)}…
                      </span>
                    </div>
                    <div className="keyring-actions">
                      {entry.privateKey && entry.id !== state.activeId && (
                        <button
                          className="text-button"
                          aria-label={`Use ${entry.name}`}
                          onClick={() =>
                            run(async () => {
                              keyring.setActive(entry.id);
                              if (onUse && (entry.bits === 1024 || entry.bits === 2048))
                                await onUse(entry.privateKey!);
                            }, `"${entry.name}" is now the active key.`)
                          }
                        >
                          Use
                        </button>
                      )}
                      <button
                        className="text-button"
                        aria-label={`.pub file: export public key of ${entry.name}`}
                        onClick={() =>
                          download(
                            `${fileSlug(entry.name)}.pub`,
                            publicKeyFile(entry.name, entry.key, entry.fingerprint),
                          )
                        }
                      >
                        <Download size={13} /> .pub
                      </button>
                      {entry.source === 'mine' && entry.privateKey && (
                        <button
                          className="text-button"
                          aria-label={`Export key pair of ${entry.name}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                'This file contains your PRIVATE key. Anyone who gets it can decrypt your messages and sign as you. Export it?',
                              )
                            )
                              download(
                                `${fileSlug(entry.name)}-keypair.json`,
                                keyPairFile(entry.name, entry.privateKey!, entry.fingerprint),
                              );
                          }}
                        >
                          <Download size={13} /> Key pair
                        </button>
                      )}
                      {entry.source === 'contact' && (
                        <button
                          className="text-button"
                          aria-label={`${entry.verified ? 'Unverify' : 'Mark as verified'} ${entry.name}`}
                          onClick={() => {
                            if (
                              !entry.verified &&
                              !window.confirm(
                                `Compare this complete fingerprint with ${entry.name} in person or over a separately trusted channel:\n\n${groupFingerprint(entry.fingerprint)}\n\nHave you compared every group with the owner? A name or QR code alone does not establish identity.`,
                              )
                            )
                              return;
                            void run(() => keyring.setVerified(entry.id, !entry.verified));
                          }}
                        >
                          <BadgeCheck size={13} /> {entry.verified ? 'Unverify' : 'Verify'}
                        </button>
                      )}
                      {(entry.source === 'mine' || entry.source === 'contact') && (
                        <>
                          <button
                            className="text-button"
                            aria-label={`Rename ${entry.name}`}
                            onClick={() => setRenaming({ id: entry.id, name: entry.name })}
                          >
                            Rename
                          </button>
                          <button
                            className="text-button danger-text"
                            aria-label={`Delete ${entry.name}`}
                            onClick={() => {
                              if (window.confirm(`Delete "${entry.name}"?`))
                                run(() => keyring.remove(entry.id), `Deleted "${entry.name}".`);
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {!state.ready && <p className="helper-text">Loading built-in keys…</p>}
      </div>
    </section>
  );
}
