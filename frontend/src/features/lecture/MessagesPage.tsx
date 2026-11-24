import { LessonArticle } from './parts';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RecipientPicker } from '../../components/RecipientPicker';
import { downloadBlob } from '../../components/download';
import { parseEnvelope } from '../../engine/encoding';
import { recipientFromEntry, useKeyring, type Recipient } from '../../keyring';
import {
  decryptReceived,
  defaultRecipientEntry,
  describeSignature,
  encrypt,
  knownSenders,
  recipientLimits,
  signingEntries,
  textCapacity,
  type DecryptRun,
  type EncryptRun,
  type PaddingMode,
} from '../encrypt/model';
import { fileJob } from '../files/client';
import { checkFileSize, downloadName, type FileResult } from '../files/model';
import {
  Collapse,
  CopyText,
  Idea,
  SlideRef,
  UsedFor,
  Words,
  TabList,
  TabPanel,
  LessonHeader,
} from './parts';

const METHODS: { id: PaddingMode; label: string; text: string }[] = [
  {
    id: 'hybrid',
    label: 'Hybrid (recommended)',
    text: 'A random AES key locks your message (fast, any length); RSA locks only that small AES key. This is how real systems work. Needs a 1024 or 2048-bit key.',
  },
  {
    id: 'oaep',
    label: 'RSA with OAEP padding',
    text: 'RSA locks the message directly, after adding random padding so the same message never gives the same result. Only short messages fit (about 190 bytes for 2048 bits).',
  },
  {
    id: 'textbook',
    label: 'Textbook RSA (the formula from the course)',
    text: 'No padding: C = M^e mod n for each block of the message. Predictable and insecure, but it is exactly the formula you learned. Works with small keys.',
  },
];

const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

function SignatureNote({ run }: { run: DecryptRun }) {
  if (run.kind !== 'text') return null;
  if (run.opened.kind !== 'hybrid')
    return (
      <p className="sigline neutral">
        No signature to check: this method cannot carry one, so nothing here proves who sent it. To
        prove the sender, encrypt with the hybrid method and choose “Also sign”.
      </p>
    );
  const { tone, text } = describeSignature(run.signature);
  return <p className={`sigline ${tone}`}>{text}</p>;
}

// send
function Send({ onEnvelope }: { onEnvelope: (text: string) => void }) {
  const keys = useKeyring();
  const [chosen, setChosen] = useState<{ made: boolean; value: Recipient | null }>({
    made: false,
    value: null,
  });
  const fallback = defaultRecipientEntry(keys);
  const recipient = chosen.made ? chosen.value : fallback ? recipientFromEntry(fallback) : null;
  const [kind, setKind] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('Some things are worth keeping between us.');
  const [file, setFile] = useState<File | null>(null);
  const [method, setMethod] = useState<PaddingMode>('hybrid');
  const [signing, setSigning] = useState(false);
  const signers = signingEntries(keys.entries);
  const [signerId, setSignerId] = useState('');
  const signer = signing ? (signers.find((s) => s.id === signerId) ?? signers[0]) : undefined;
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [textRun, setTextRun] = useState<EncryptRun | null>(null),
    [fileRun, setFileRun] = useState<{ envelope: string; name: string; result: FileResult } | null>(
      null,
    );
  const limits = recipient ? recipientLimits(recipient) : null;
  const effective: PaddingMode = kind === 'file' || signer ? 'hybrid' : method;
  const capacity = recipient && kind === 'text' ? textCapacity(recipient, effective, text) : null;
  const envelope =
    kind === 'text'
      ? textRun && textRun.kind !== 'number'
        ? textRun.sealed.envelope
        : ''
      : (fileRun?.envelope ?? '');

  async function go() {
    if (!recipient) return;
    setBusy(true);
    setError('');
    setTextRun(null);
    setFileRun(null);
    setSentTo(recipient.label);
    try {
      if (kind === 'text') {
        const run = await encrypt(recipient, 'text', effective, text, signer);
        setTextRun(run);
        if (run.kind !== 'number') onEnvelope(run.sealed.envelope);
      } else {
        if (!file) throw new Error('Choose a file first.');
        checkFileSize(file.size);
        if (limits?.hybridProblem) throw new Error(limits.hybridProblem);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const result = await fileJob(
          {
            type: 'seal',
            key: recipient.key,
            bytes,
            file: {
              name: downloadName(file.name),
              type: file.type || 'application/octet-stream',
              size: bytes.length,
            },
            signer: signer?.privateKey,
          },
          new AbortController().signal,
        );
        if (result.type !== 'sealed') throw new Error('Unexpected result.');
        setFileRun({ envelope: result.envelope, name: downloadName(file.name), result });
        onEnvelope(result.envelope);
      }
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Send a message">
      <h2>1 · Lock a message</h2>
      <p className="lead small">
        Choose whose <b>public key</b> locks the message. Only the owner of the matching private key
        will be able to read it.
      </p>
      <RecipientPicker
        label="Lock with the public key of"
        value={recipient}
        onChange={(value) => setChosen({ made: true, value })}
      />
      {recipient && (
        <p className="note">
          {recipient.label}: {limits ? `${limits.caps.bits}-bit key` : ''}
          {recipient.source === 'contact' &&
            !recipient.verified &&
            ' · fingerprint not verified yet'}
        </p>
      )}

      <TabList
        id="send"
        label="What to send"
        items={[
          { id: 'text', label: 'A message' },
          { id: 'file', label: 'A file' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <TabPanel id="send" value={kind}>
        {kind === 'text' ? (
          <div className="field">
            <label htmlFor="msg-text">Message to encrypt</label>
            <textarea
              id="msg-text"
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            {capacity && <small>{capacity.summary}</small>}
            {capacity?.problem && (
              <p className="error" role="alert">
                {capacity.problem}
              </p>
            )}
          </div>
        ) : (
          <div className="field">
            <label htmlFor="msg-file">File to encrypt (up to 25 MiB)</label>
            <input
              id="msg-file"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {file && (
              <small>
                {file.name} · {file.size.toLocaleString()} bytes
              </small>
            )}
          </div>
        )}
      </TabPanel>

      <Collapse title="Options: how to encrypt, and signing">
        {kind === 'text' && (
          <fieldset className="methods">
            <legend>Method</legend>
            {METHODS.map((item) => (
              <label key={item.id} className="method">
                <input
                  type="radio"
                  name="method"
                  checked={effective === item.id}
                  disabled={Boolean(signer) && item.id !== 'hybrid'}
                  onChange={() => setMethod(item.id)}
                />{' '}
                <span>
                  <b>{item.label}</b>
                  <small>{item.text}</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {kind === 'file' && (
          <p className="note">
            Files always use the hybrid method: AES for the data, RSA for the AES key.
          </p>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={signing}
            disabled={signers.length === 0}
            onChange={(event) => setSigning(event.target.checked)}
          />{' '}
          Also sign it, so the receiver knows it is from me
        </label>
        {signing && (
          <div className="field">
            <label htmlFor="signer">Sign as</label>
            <select
              id="signer"
              value={signer?.id ?? ''}
              onChange={(event) => setSignerId(event.target.value)}
            >
              {signers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.bits}-bit)
                </option>
              ))}
            </select>
          </div>
        )}
        {signers.length === 0 && (
          <p className="note">Signing needs a 1024 or 2048-bit key with a private part.</p>
        )}
      </Collapse>

      <div className="controls">
        <button
          type="button"
          className="primary"
          disabled={busy || !recipient || Boolean(capacity?.problem)}
          onClick={() => void go()}
        >
          {busy ? 'Encrypting…' : kind === 'file' ? 'Encrypt file' : 'Encrypt message'}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {envelope && (
        <div className="result" role="status">
          <p>
            <strong>Encrypted.</strong> Send this text to {sentTo}. Only the owner of the matching
            private key can read it.
          </p>
          <label className="visually" htmlFor="envelope-out">
            Encrypted envelope
          </label>
          <textarea id="envelope-out" readOnly rows={4} value={envelope} className="mono-box" />
          <p>
            <a href="#unlock" className="next-step">
              Next: unlock it in step 2 ↓
            </a>
          </p>
          <div className="controls">
            <CopyText value={envelope} label="Copy the envelope" />
            <button
              type="button"
              onClick={() =>
                downloadBlob(
                  new Blob([envelope], { type: 'text/plain' }),
                  kind === 'file' && fileRun ? `${fileRun.name}.rsalab.txt` : 'message.rsalab.txt',
                )
              }
            >
              Download as a file
            </button>
          </div>
          <Collapse title="What just happened?">
            {textRun && textRun.kind === 'hybrid' && (
              <ol className="lines">
                <li>A fresh random AES-256 key was made.</li>
                {textRun.signerName && (
                  <li>
                    The message was signed with the private key of {textRun.signerName} (RSA-PSS).
                  </li>
                )}
                <li>AES-GCM locked the message with that key.</li>
                <li>RSA-OAEP locked the AES key with {textRun.recipient.label}’s public key.</li>
                <li>Both were packed into the envelope text above.</li>
              </ol>
            )}
            {textRun && textRun.kind === 'text' && (
              <ol className="lines">
                <li>
                  {textRun.mode === 'oaep'
                    ? 'Random OAEP padding was added to the message.'
                    : 'The message was cut into blocks, each smaller than n.'}
                </li>
                <li>
                  Each block was raised to the power e modulo n, with {textRun.recipient.label}’s
                  public key (the C = M^e mod n formula).
                </li>
              </ol>
            )}
            {fileRun && (
              <ol className="lines">
                <li>A fresh random AES-256 key was made.</li>
                <li>
                  AES-GCM encrypted the{' '}
                  {fileRun.result.type === 'sealed' ? fileRun.result.size.toLocaleString() : ''}{' '}
                  bytes of the file.
                </li>
                <li>RSA-OAEP locked the AES key with the recipient’s public key.</li>
                <li>
                  RSA took {fileRun.result.type === 'sealed' ? fileRun.result.rsaMs.toFixed(1) : ''}{' '}
                  ms and AES{' '}
                  {fileRun.result.type === 'sealed' ? fileRun.result.aesMs.toFixed(1) : ''} ms.
                </li>
              </ol>
            )}
          </Collapse>
        </div>
      )}
    </section>
  );
}

// receive
function Receive({ suggested }: { suggested: string }) {
  const keys = useKeyring();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [run, setRun] = useState<DecryptRun | null>(null),
    [fileOut, setFileOut] = useState<{
      bytes: Uint8Array;
      name: string;
      type: string;
      signature: ReturnType<typeof describeSignature>;
    } | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [holderId, setHolderId] = useState('');
  const holders = keys.entries.filter((entry) => entry.privateKey);
  const pool = holderId ? holders.filter((entry) => entry.id === holderId) : holders;

  async function go() {
    setBusy(true);
    setError('');
    setRun(null);
    setFileOut(null);
    try {
      const envelope = text.trim();
      if (!envelope) throw new Error('Paste the encrypted envelope first.');
      let isFile = false;
      try {
        const parsed = parseEnvelope(envelope);
        isFile = parsed.kind === 'hybrid' && parsed.contentType === 'file';
      } catch {
        throw new Error(
          'This is not a complete RSA Lab envelope. Paste the whole text, starting with rsa-lab.v2:',
        );
      }
      if (isFile) {
        const result = await fileJob(
          {
            type: 'open',
            envelope,
            keys: pool.map((entry) => entry.privateKey!),
            senders: knownSenders(keys.entries),
          },
          new AbortController().signal,
        );
        if (result.type !== 'opened') throw new Error('Unexpected result.');
        setFileOut({
          bytes: result.bytes,
          name: result.file.name,
          type: result.file.type,
          signature: describeSignature(result.signature),
        });
      } else {
        setRun(await decryptReceived(envelope, pool, keys.entries));
      }
    } catch (cause) {
      setError(
        holderId
          ? `${message(cause)} You chose to decrypt with one specific private key. If the message was locked for someone else, choose “Any of my keys”.`
          : message(cause),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Receive a message" id="unlock">
      <h2>2 · Unlock a message</h2>
      <p className="lead small">
        Paste an envelope that was encrypted for one of <b>your</b> keys (or one of the demo keys).
        The lab tries each private key you have, and tells you if a signature checks out.
      </p>
      <div className="field">
        <label htmlFor="holder">Unlock with the private key of</label>
        <select id="holder" value={holderId} onChange={(event) => setHolderId(event.target.value)}>
          <option value="">Any of my keys (the lab finds the right one)</option>
          {holders.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} · {entry.bits}-bit
            </option>
          ))}
        </select>
        <small>Only keys whose private part is stored in this browser are listed.</small>
      </div>
      <div className="field">
        <label htmlFor="envelope-in">Envelope to decrypt</label>
        <textarea
          id="envelope-in"
          rows={4}
          value={text}
          spellCheck={false}
          onChange={(event) => setText(event.target.value)}
          placeholder="rsa-lab.v2:…"
        />
      </div>
      <div className="controls">
        <button type="button" disabled={!suggested} onClick={() => setText(suggested)}>
          Use the envelope I just made
        </button>
        <button type="button" className="primary" disabled={busy} onClick={() => void go()}>
          {busy ? 'Decrypting…' : 'Decrypt'}
        </button>
        <button type="button" onClick={() => picker.current?.click()}>
          Open an envelope file…
        </button>
        <input
          ref={picker}
          type="file"
          hidden
          accept=".txt,text/plain"
          aria-label="Envelope file"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) setText(await file.text());
          }}
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {run && run.kind === 'text' && (
        <div className="result" role="status">
          <p>
            Decrypted with <b>{run.keyName}</b>’s private key:
          </p>
          <p className="recovered">{run.text}</p>
          <SignatureNote run={run} />
        </div>
      )}
      {fileOut && (
        <div className="result" role="status">
          <p>
            Decrypted the file <b>{fileOut.name}</b> ({fileOut.bytes.length.toLocaleString()}{' '}
            bytes).
          </p>
          <p className={`sigline ${fileOut.signature.tone}`}>{fileOut.signature.text}</p>
          <button
            type="button"
            onClick={() =>
              downloadBlob(
                new Blob([new Uint8Array(fileOut.bytes).buffer], {
                  type: fileOut.type || 'application/octet-stream',
                }),
                fileOut.name,
              )
            }
          >
            Save the file
          </button>
        </div>
      )}
    </section>
  );
}

export function MessagesPage() {
  const [envelope, setEnvelope] = useState('');
  return (
    <LessonArticle>
      <LessonHeader title="Send and receive secret messages" />
      <Idea>
        You lock a message with the receiver’s <b>public</b> key; only their <b>private</b> key can
        unlock it. For long messages and files, RSA locks a small AES key and AES does the heavy
        work.
      </Idea>
      <SlideRef>ch09 “RSA Use” and “Authentication and confidentiality”.</SlideRef>
      <UsedFor>
        This is RSA used for real: any text or file, locked for a chosen person, optionally signed.
      </UsedFor>
      <Words terms={['aes', 'publicKey', 'privateKey', 'signature', 'plaintext', 'ciphertext']} />
      <p className="note">
        New here? Try it as is: lock a message for the demo key Alice in step 1, then unlock it in
        step 2. To work with the numbers by hand, use <Link to="/lecture/rsa">RSA by hand</Link>.
      </p>
      <Send onEnvelope={setEnvelope} />
      <Receive suggested={envelope} />
    </LessonArticle>
  );
}
