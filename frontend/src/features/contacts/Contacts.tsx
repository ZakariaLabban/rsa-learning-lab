import { Term } from '../../components/Term';
import { LessonTrace } from '../lessons/LessonTrace';
import { contactFrames } from '../lessons/protocolTraces';
import { useEffect, useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { downloadBlob } from '../../components/download';
import { ErrorBanner } from '../../components/ErrorBanner';
import { groupFingerprint } from '../../engine/encoding';
import { fileSlug, keyring, MAX_FILE_CHARS, useKeyring, type KeyEntry } from '../../keyring';
import { parseContact, shareText } from './model';
import { QrScanner } from './QrScanner';

function ContactCard({ entry, onError }: { entry: KeyEntry; onError: (error: string) => void }) {
  const [name, setName] = useState(entry.name);
  const [comparing, setComparing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  function run(action: () => void) {
    try {
      action();
      onError('');
    } catch (e) {
      onError((e as Error).message);
    }
  }
  return (
    <li className="contact-card">
      <h3>
        {entry.name}{' '}
        <span className="keyring-badge">
          {entry.verified ? 'Fingerprint verified' : 'Unverified'}
        </span>
      </h3>
      <p className="mono fingerprint">{groupFingerprint(entry.fingerprint)}</p>
      <CopyButton value={entry.fingerprint} label={`Copy ${entry.name} fingerprint`} />
      <label>
        Contact name
        <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="feature-actions">
        <button
          className="secondary-button"
          onClick={() => run(() => keyring.rename(entry.id, name))}
        >
          Save name
        </button>
        <button
          className="secondary-button"
          onClick={() => {
            if (window.confirm(`Delete contact “${entry.name}”?`)) keyring.remove(entry.id);
          }}
        >
          Delete contact
        </button>
        <button
          className="secondary-button"
          onClick={() => {
            setComparing((value) => !value);
            setConfirmed(false);
          }}
        >
          Compare fingerprint
        </button>
        {entry.verified && (
          <button className="secondary-button" onClick={() => keyring.setVerified(entry.id, false)}>
            Mark unverified
          </button>
        )}
      </div>
      {comparing && (
        <div className="keyring-warning">
          <p>
            Ask the owner to read their full fingerprint over a trusted channel (in person or a
            known phone number). Compare every group above. A name, QR code or matching file alone
            does not establish identity.
          </p>
          <label className="keyring-toggle">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I compared the full fingerprint with the owner through a trusted channel
          </label>
          <button
            className="secondary-button"
            disabled={!confirmed}
            onClick={() => {
              keyring.setVerified(entry.id, true);
              setComparing(false);
            }}
          >
            Mark fingerprint verified
          </button>
        </div>
      )}
    </li>
  );
}

export function Contacts() {
  const state = useKeyring();
  const contacts = state.entries.filter((e) => e.source === 'contact');
  const own = state.entries.filter((e) => e.source === 'mine' || e.source === 'demo');
  const [shareId, setShareId] = useState('');
  const entry =
    own.find((e) => e.id === shareId) ??
    own.find((e) => e.source === 'mine') ??
    own.find((e) => e.id === 'demo-alice');
  const text = entry ? shareText(entry) : '';
  const [qr, setQr] = useState<{ text: string; image: string } | null>(null);
  const [qrError, setQrError] = useState('');
  const [paste, setPaste] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (text)
      void import('qrcode')
        .then((module) =>
          module.toDataURL(text, { errorCorrectionLevel: 'M', margin: 4, width: 768 }),
        )
        .then((image) => {
          if (!cancelled) {
            setQr({ text, image });
            setQrError('');
          }
        })
        .catch(() => {
          if (!cancelled)
            setQrError('QR generation failed. Copy the public-key text or download its .pub file.');
        });
    return () => {
      cancelled = true;
    };
  }, [text]);

  async function add(value: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const parsed = await parseContact(value);
      const added = await keyring.addContact(parsed.key, name.trim() || parsed.name);
      setNotice(`Added ${added.name}. Compare the fingerprint before trusting this contact.`);
      setPaste('');
      setName('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="feature-page">
      <div className="page-heading">
        <h1>Contacts and public-key sharing.</h1>
      </div>
      <section className="panel feature-body">
        <h2>Share my public key</h2>
        <p>
          Share only the <Term term="publicKey">public key</Term>. Your{' '}
          <Term term="privateKey">private values</Term> d, p and q are never included. Others
          compare its <Term term="fingerprint">fingerprint</Term> to confirm it is yours.
        </p>
        <label>
          Key to share
          <select value={entry?.id ?? ''} onChange={(e) => setShareId(e.target.value)}>
            {own.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.source === 'demo' ? ' · public demo private key' : ''}
              </option>
            ))}
          </select>
        </label>
        {entry?.source === 'demo' && (
          <p className="keyring-warning">
            Demonstration key: everyone has its private key. Generate your own key on the Keys page
            to exchange private demonstration messages.
          </p>
        )}
        {entry && (
          <>
            <LessonTrace
              title="Public-key sharing machine"
              frames={contactFrames(entry, text)}
              resetKey={`${entry.fingerprint}-${entry.verified}`}
            />
            <p className="mono fingerprint">{groupFingerprint(entry.fingerprint)}</p>
            <CopyButton value={entry.fingerprint} label="Copy my fingerprint" />
            <textarea
              aria-label="Public key to share"
              className="mono"
              value={text}
              readOnly
              rows={4}
            />
            <div className="feature-actions">
              <CopyButton value={text} label="Copy public key" />
              <button
                className="secondary-button"
                onClick={() =>
                  downloadBlob(
                    new Blob([text], { type: 'application/json' }),
                    `${fileSlug(entry.name)}.pub`,
                  )
                }
              >
                Download public key
              </button>
            </div>
            {qr?.text === text && (
              <img
                className="public-key-qr"
                src={qr.image}
                alt={`Public-key QR for ${entry.name}`}
                width={768}
                height={768}
              />
            )}
            {qrError && <p role="alert">{qrError}</p>}
            <p className="helper-text">
              The QR contains the same .pub key text, so it works without a cloud account or share
              link. Keep the full QR and its white border visible when scanning.
            </p>
          </>
        )}
      </section>
      <section className="panel feature-body">
        <h2>Add a contact</h2>
        <label>
          New contact name (optional)
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        <label htmlFor="contact-public-text">Public key text</label>
        <textarea
          id="contact-public-text"
          className="mono"
          value={paste}
          rows={4}
          maxLength={MAX_FILE_CHARS}
          onChange={(e) => setPaste(e.target.value)}
        />
        <button
          className="primary-button"
          disabled={busy || !paste.trim()}
          onClick={() => void add(paste)}
        >
          Add pasted contact
        </button>
        <label>
          Upload public-key file
          <input
            type="file"
            accept=".pub,application/json"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > MAX_FILE_CHARS) {
                setError('The public-key file is too large.');
                return;
              }
              await add(await file.text());
            }}
          />
        </label>
        <QrScanner
          onRead={(value) => {
            setPaste(value);
            setNotice('QR read. Check the key and name, then choose Add pasted contact.');
          }}
        />
        <ErrorBanner message={error} onDismiss={() => setError('')} />
        <p role="status">{notice}</p>
        {state.storageProblem && <p role="alert">{state.storageProblem}</p>}
      </section>
      <section className="panel feature-body">
        <h2>My contacts</h2>
        {contacts.length ? (
          <ul className="contact-list">
            {contacts.map((e) => (
              <ContactCard key={e.id} entry={e} onError={setError} />
            ))}
          </ul>
        ) : (
          <p>
            No contacts yet. Add someone’s public key above; they will appear in the recipient
            picker.
          </p>
        )}
      </section>
    </div>
  );
}
