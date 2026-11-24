import { LessonArticle } from './parts';
import { useRef, useState } from 'react';
import { useBrowserSession } from '../../app/useBrowserSession';
import { downloadBlob } from '../../components/download';
import { groupFingerprint } from '../../engine/encoding';
import { bitLength } from '../../engine/math';
import { teachingKey } from '../../engine/keys/keygen';
import {
  fileSlug,
  keyPairFile,
  useKeyringStore,
  publicKeyFile,
  useKeyring,
  type KeyEntry,
} from '../../keyring';
import { parseWhole, rsaSetup } from './model';
import { Link } from 'react-router-dom';
import {
  Collapse,
  Field,
  Idea,
  InputForm,
  SlideRef,
  UsedFor,
  Words,
  TabList,
  TabPanel,
  LessonHeader,
} from './parts';

const SOURCE: Record<KeyEntry['source'], string> = {
  mine: 'Mine',
  demo: 'Demo',
  lecture: 'Lecture',
  contact: 'Contact',
};

function run(action: () => void, setError: (text: string) => void) {
  try {
    action();
    setError('');
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : String(cause));
  }
}

function KeyCard({ entry, active }: { entry: KeyEntry; active: boolean }) {
  const keyring = useKeyringStore();
  const [name, setName] = useState(entry.name),
    [error, setError] = useState('');
  const mine = entry.source === 'mine';
  return (
    <li className="keycard">
      <div className="keyhead">
        <strong>{entry.name}</strong>
        <span className="badge">{SOURCE[entry.source]}</span>
        <span className="badge">{entry.bits}-bit</span>
        {active && <span className="badge on">Active</span>}
      </div>
      <p className="num wrap" aria-label="Fingerprint">
        {groupFingerprint(entry.fingerprint)}
      </p>
      <Collapse title="Public key and actions">
        <p>
          <b>Public key</b> (safe to share): e = <span className="num">{String(entry.key.e)}</span>,
          n = <span className="num wrap">{String(entry.key.n)}</span>
        </p>
        <div className="controls">
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
            Download public key (.pub)
          </button>
          {entry.privateKey && !active && (
            <button type="button" onClick={() => run(() => keyring.setActive(entry.id), setError)}>
              Make this my active key
            </button>
          )}
        </div>
        {mine && entry.privateKey && (
          <>
            <div className="field">
              <label htmlFor={`rename-${entry.id}`}>Name</label>
              <input
                id={`rename-${entry.id}`}
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="controls">
              <button
                type="button"
                onClick={() => run(() => keyring.rename(entry.id, name), setError)}
              >
                Save name
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete “${entry.name}”? Its private key will be gone.`))
                    keyring.remove(entry.id);
                }}
              >
                Delete key
              </button>
            </div>
            <Collapse title="Private key (secret)">
              <p className="warn">
                Never share this. Anyone who has it can read your messages and sign as you.
              </p>
              <p>
                d = <span className="num wrap">{String(entry.privateKey.d)}</span>
              </p>
              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    new Blob([keyPairFile(entry.name, entry.privateKey!, entry.fingerprint)], {
                      type: 'application/json',
                    }),
                    `${fileSlug(entry.name)}-PRIVATE.json`,
                  )
                }
              >
                Download key pair (private!)
              </button>
            </Collapse>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </Collapse>
    </li>
  );
}

function HandMade() {
  const keyring = useKeyringStore();
  const [fields, setFields] = useState({ p: '17', q: '11', e: '7', name: 'Lecture-style key' }),
    [error, setError] = useState(''),
    [saved, setSaved] = useState('');
  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((old) => ({ ...old, [key]: value }));
  async function save() {
    try {
      const setup = rsaSetup(
        parseWhole(fields.p, 'p'),
        parseWhole(fields.q, 'q'),
        parseWhole(fields.e, 'e'),
      );
      if (bitLength(setup.n) > 64)
        throw new Error(
          'A key made by hand can have at most 64 bits (n below about 1.8 × 10¹⁹). For a bigger key, generate a real one.',
        );
      const entry = await keyring.addMine(teachingKey(setup.p, setup.q, setup.e), fields.name);
      await keyring.setActive(entry.id);
      setSaved(`Saved “${entry.name}” (n = ${setup.n}). It is now your active key.`);
      setError('');
    } catch (cause) {
      setSaved('');
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }
  return (
    <>
      <p className="lead small">
        Choose two primes p and q and an exponent e exactly as in the lecture. The lab calculates n,
        φ(n) and d for you (see them step by step on the <Link to="/lecture/rsa">RSA by hand</Link>{' '}
        page).
      </p>
      <InputForm onSubmit={() => void save()} submitLabel="Save as one of my keys" error={error}>
        <Field id="k-p" label="p (prime)" value={fields.p} onChange={set('p')} />
        <Field id="k-q" label="q (prime)" value={fields.q} onChange={set('q')} />
        <Field id="k-e" label="e" value={fields.e} onChange={set('e')} />
        <div className="field">
          <label htmlFor="k-name">Name</label>
          <input
            id="k-name"
            value={fields.name}
            onChange={(event) => set('name')(event.target.value)}
          />
        </div>
      </InputForm>
      {saved && (
        <p className="result" role="status">
          {saved}
        </p>
      )}
    </>
  );
}

function Generate() {
  const session = useBrowserSession();
  return (
    <>
      <p className="lead small">
        The lab finds two random primes with the Miller–Rabin test, as described in the lecture
        (“guess and use a probabilistic test”). A 2048-bit key can take a few seconds.
      </p>
      <div className="inputs">
        <div className="fields">
          <div className="field">
            <label htmlFor="g-bits">Key size</label>
            <select
              id="g-bits"
              value={session.bits}
              disabled={session.generating}
              onChange={(event) => session.setBits(Number(event.target.value))}
            >
              <option value={64}>64 bits (tiny, for learning)</option>
              <option value={1024}>1024 bits (assignment size)</option>
              <option value={2048}>2048 bits (recommended)</option>
            </select>
          </div>
        </div>
        <div className="controls">
          {session.generating ? (
            <>
              <button type="button" onClick={session.cancelGeneration}>
                Cancel
              </button>
              <span role="status">
                Working… {session.seconds}s, {session.candidates} candidates tested
              </span>
            </>
          ) : (
            <button type="button" className="primary" onClick={() => void session.createKey()}>
              Generate a key
            </button>
          )}
        </div>
        {session.error && (
          <p className="error" role="alert">
            {session.error}
          </p>
        )}
      </div>
      <p className="note">
        New keys appear in the list above as “Mine” and become your active key.
      </p>
    </>
  );
}

function ImportKey() {
  const keyring = useKeyringStore();
  const [text, setText] = useState(''),
    [error, setError] = useState(''),
    [done, setDone] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  async function submit(value = text) {
    try {
      const entry = await keyring.importFile(value);
      setDone(
        entry.source === 'mine'
          ? `Imported your key pair “${entry.name}”.`
          : `Added “${entry.name}” to your contacts.`,
      );
      setError('');
      setText('');
    } catch (cause) {
      setDone('');
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }
  return (
    <>
      <p className="lead small">
        Paste the text of a key file, or choose a file. A key-pair file becomes one of your keys; a
        public-key (.pub) file becomes a contact.
      </p>
      <div className="field">
        <label htmlFor="import-text">Key file text</label>
        <textarea
          id="import-text"
          rows={5}
          value={text}
          spellCheck={false}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <div className="controls">
        <button type="button" className="primary" onClick={() => void submit()}>
          Import
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Choose a file…
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          accept=".pub,.json,.txt,application/json,text/plain"
          aria-label="Key file"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) await submit(await file.text());
          }}
        />
      </div>
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

export function KeysPage() {
  const keyring = useKeyringStore();
  const state = useKeyring();
  const [tab, setTab] = useState<'hand' | 'generate' | 'import'>('hand');
  const mine = state.entries.filter((entry) => entry.source === 'mine');
  const others = state.entries.filter(
    (entry) => entry.source !== 'mine' && entry.source !== 'contact',
  );
  return (
    <LessonArticle>
      <LessonHeader title="My keys" />
      <Idea>
        A key pair has a <b>public</b> key (e, n) you give to everyone and a <b>private</b> key (d,
        n) you keep secret. Anybody can lock a message with your public key; only you can unlock it.
      </Idea>
      <SlideRef>ch09 “RSA Key Setup” and “RSA Key Generation”.</SlideRef>
      <UsedFor>
        To use RSA for real you first need a key pair. This page makes, imports and keeps them.
      </UsedFor>
      <Words terms={['publicKey', 'privateKey', 'fingerprint', 'modulus']} />

      <h2>Your keys</h2>
      {mine.length === 0 && (
        <p className="note">
          You have not made a key yet. Make one below, or just try the built-in demo keys Alice and
          Bob.
        </p>
      )}
      <ul className="keylist">
        {mine.map((entry) => (
          <KeyCard key={entry.id} entry={entry} active={state.activeId === entry.id} />
        ))}
      </ul>
      <Collapse title={`Built-in demo keys (${others.length})`}>
        <ul className="keylist">
          {others.map((entry) => (
            <KeyCard key={entry.id} entry={entry} active={state.activeId === entry.id} />
          ))}
        </ul>
      </Collapse>

      <h2>Make or add a key</h2>
      <TabList
        id="keys"
        label="Ways to get a key"
        items={[
          { id: 'hand', label: 'By hand (p, q, e)' },
          { id: 'generate', label: 'Generate a real key' },
          { id: 'import', label: 'Import a key file' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <TabPanel id="keys" value={tab}>
        {tab === 'hand' && <HandMade />}
        {tab === 'generate' && <Generate />}
        {tab === 'import' && <ImportKey />}
      </TabPanel>

      <Collapse title="Where are my private keys stored?">
        <p>
          Private keys stay in this browser only and are never sent anywhere. By default they are
          forgotten when you reload or close the tab. Keys held in memory for an account are also
          discarded when that account signs out or another account becomes active. Use this option
          to keep them on this device.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={state.rememberPrivate}
            onChange={(event) => keyring.setRememberPrivate(event.target.checked)}
          />{' '}
          Remember my private keys on this device
        </label>
        {state.storageProblem && <p className="error">{state.storageProblem}</p>}
        <p className="note">
          This is a teaching lab: it has not been audited and is not for protecting real secrets.
        </p>
      </Collapse>
    </LessonArticle>
  );
}
