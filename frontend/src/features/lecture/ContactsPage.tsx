import { useEffect, useRef, useState } from 'react';
import { downloadBlob } from '../../components/download';
import { groupFingerprint } from '../../engine/encoding';
import { fileSlug, keyring, publicKeyFile, useKeyring, type KeyEntry } from '../../keyring';
import { parseContact, shareText } from '../contacts/model';
import { QrScanner } from '../contacts/QrScanner';
import { Collapse, CopyText, Idea, SlideRef, UsedFor, Words, LessonHeader } from './parts';

function ShareMine({ entries }: { entries: readonly KeyEntry[] }) {
  const [id, setId] = useState(entries[0]?.id ?? '');
  const entry = entries.find((item) => item.id === id) ?? entries[0];
  const [qr, setQr] = useState(''),
    [qrError, setQrError] = useState('');
  const text = entry ? shareText(entry) : '';
  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    import('qrcode')
      .then((module) =>
        module.toDataURL(text, { errorCorrectionLevel: 'M', margin: 4, width: 512 }),
      )
      .then((url) => {
        if (!cancelled) {
          setQr(url);
          setQrError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQr('');
          setQrError('The QR code could not be made. Copy the text or download the file instead.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [text]);
  if (!entry)
    return <p className="note">Make a key on the Keys page first, or share a demo key.</p>;
  return (
    <>
      <div className="field">
        <label htmlFor="share-key">Which key?</label>
        <select id="share-key" value={entry.id} onChange={(event) => setId(event.target.value)}>
          {entries.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.bits}-bit)
            </option>
          ))}
        </select>
      </div>
      <p>
        Your fingerprint: <span className="num wrap">{groupFingerprint(entry.fingerprint)}</span>
      </p>
      <div className="controls">
        <CopyText value={text} label="Copy my public key" />
        <button
          type="button"
          onClick={() =>
            downloadBlob(
              new Blob([publicKeyFile(entry.name, entry.key, entry.fingerprint)], {
                type: 'application/json',
              }),
              `${fileSlug(entry.name)}.pub`,
            )
          }
        >
          Download .pub file
        </button>
      </div>
      <Collapse title="Show a QR code to scan">
        {qr ? (
          <img className="qr" src={qr} alt={`QR code of the public key ${entry.name}`} />
        ) : (
          <p role="status">{qrError || 'Making the QR code…'}</p>
        )}
        <p className="note">Only the public key is in this code, so it is safe to show.</p>
      </Collapse>
    </>
  );
}

function AddContact() {
  const [text, setText] = useState(''),
    [name, setName] = useState(''),
    [error, setError] = useState(''),
    [done, setDone] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  async function add(value = text) {
    try {
      const parsed = await parseContact(value.trim());
      const entry = await keyring.addContact(parsed.key, name.trim() || parsed.name);
      setDone(`Added ${entry.name}. Compare the fingerprint with them before you trust it.`);
      setError('');
      setText('');
      setName('');
    } catch (cause) {
      setDone('');
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }
  return (
    <>
      <div className="field">
        <label htmlFor="contact-text">Their public key (text from a .pub file)</label>
        <textarea
          id="contact-text"
          rows={4}
          value={text}
          spellCheck={false}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="contact-name">Name (optional)</label>
        <input
          id="contact-name"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="controls">
        <button type="button" className="primary" onClick={() => void add()}>
          Add contact
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Choose a .pub file…
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          accept=".pub,.json,.txt"
          aria-label="Public key file"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) await add(await file.text());
          }}
        />
      </div>
      <Collapse title="Scan their QR code with the camera">
        <QrScanner onRead={(value) => void add(value)} />
      </Collapse>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="result" role="status">
          {done}
        </p>
      )}
    </>
  );
}

function ContactCard({ entry, mine }: { entry: KeyEntry; mine: KeyEntry | undefined }) {
  const [name, setName] = useState(entry.name),
    [error, setError] = useState('');
  return (
    <li className="keycard">
      <div className="keyhead">
        <strong>{entry.name}</strong>
        <span className={`badge ${entry.verified ? 'on' : ''}`}>
          {entry.verified ? 'Fingerprint verified' : 'Not verified yet'}
        </span>
        <span className="badge">{entry.bits}-bit</span>
      </div>
      <p className="num wrap">{groupFingerprint(entry.fingerprint)}</p>
      <Collapse title="Verify, rename or delete">
        <p>
          A name or a QR code does not prove who a key belongs to. Ask them (in person or by phone)
          to read you their fingerprint, and compare it with the one above. If every group matches,
          tick the box.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={entry.verified === true}
            onChange={(event) => {
              try {
                keyring.setVerified(entry.id, event.target.checked);
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
              }
            }}
          />{' '}
          The fingerprint matches what {entry.name} told me
        </label>
        <div className="field">
          <label htmlFor={`cn-${entry.id}`}>Name</label>
          <input
            id={`cn-${entry.id}`}
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="controls">
          <button
            type="button"
            onClick={() => {
              try {
                keyring.rename(entry.id, name);
                setError('');
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
              }
            }}
          >
            Save name
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete the contact “${entry.name}”?`)) keyring.remove(entry.id);
            }}
          >
            Delete contact
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {mine && <p className="note">Your own fingerprint is on the “Share my key” part above.</p>}
      </Collapse>
    </li>
  );
}

export function ContactsPage() {
  const state = useKeyring();
  const contacts = state.entries.filter((entry) => entry.source === 'contact');
  const shareable = state.entries.filter((entry) => entry.source !== 'contact');
  const mine = state.entries.find((entry) => entry.source === 'mine');
  return (
    <article>
      <LessonHeader title="Contacts and sharing keys" />
      <Idea>
        To send someone an encrypted message you need <b>their public key</b>. Public keys are safe
        to share, but you must be sure a key really belongs to the person. That is why you compare
        <b> fingerprints</b> (a short summary of the key).
      </Idea>
      <SlideRef>
        ch09 “Public-Key Cryptography”: “a public key which may be known by anybody”.
      </SlideRef>
      <UsedFor>
        To send someone a secret you need their public key, and you must be sure it really is
        theirs.
      </UsedFor>
      <Words terms={['publicKey', 'fingerprint']} />

      <h2>Share my public key</h2>
      <ShareMine entries={shareable} />

      <h2>Add a contact</h2>
      <AddContact />

      <h2>My contacts ({contacts.length})</h2>
      {contacts.length === 0 ? (
        <p className="note">No contacts yet. Add one above to encrypt messages for them.</p>
      ) : (
        <ul className="keylist">
          {contacts.map((entry) => (
            <ContactCard key={entry.id} entry={entry} mine={mine} />
          ))}
        </ul>
      )}
    </article>
  );
}
