import { Term } from '../../components/Term';
import { LessonTrace } from '../lessons/LessonTrace';
import { fileFrames } from '../lessons/protocolTraces';
import { useEffect, useRef, useState } from 'react';
import { RecipientPicker } from '../../components/RecipientPicker';
import { ErrorBanner } from '../../components/ErrorBanner';
import { downloadBlob } from '../../components/download';
import { MAX_ENVELOPE_CHARS } from '../../engine/encoding';
import { recipientFromEntry, useKeyring, type Recipient } from '../../keyring';
import {
  defaultRecipientEntry,
  describeSignature,
  knownSenders,
  signingEntries,
} from '../encrypt/model';
import { checkFileSize, downloadName, type FileResult } from './model';
import { fileJob } from './client';

export function FilePanel() {
  const state = useKeyring();
  const fallback = defaultRecipientEntry(state);
  const [choice, setChoice] = useState<{ value: Recipient | null } | null>(null);
  // The panel survives navigation: resolve saved selections against the current keyring.
  const chosenEntry = state.entries.find((e) => e.id === choice?.value?.entryId);
  const recipient = choice
    ? choice.value?.entryId
      ? chosenEntry
        ? recipientFromEntry(chosenEntry)
        : null
      : choice.value
    : fallback
      ? recipientFromEntry(fallback)
      : null;
  const [file, setFile] = useState<File | null>(null);
  const [received, setReceived] = useState<File | null>(null);
  const [sign, setSign] = useState(false);
  const [signerId, setSignerId] = useState('');
  const signers = signingEntries(state.entries);
  const signer =
    signers.find((e) => e.id === signerId) ??
    signers.find((e) => e.source === 'mine') ??
    signers.find((e) => e.id === 'demo-bob');
  const [result, setResult] = useState<FileResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function perform(kind: 'encrypt' | 'decrypt') {
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      if (kind === 'encrypt') {
        if (!file || !recipient) throw new Error('Choose a file and recipient.');
        checkFileSize(file.size);
        if (sign && !signer?.privateKey) throw new Error('Choose a signing key.');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const value = await fileJob(
          {
            type: 'seal',
            key: recipient.key,
            bytes,
            file: { name: downloadName(file.name), type: file.type.slice(0, 255), size: file.size },
            signer: sign ? signer?.privateKey : undefined,
          },
          abort.signal,
        );
        if (!abort.signal.aborted) setResult(value);
      } else {
        if (!received) throw new Error('Choose an encrypted envelope file.');
        if (received.size > MAX_ENVELOPE_CHARS)
          throw new Error('The envelope file is too large (maximum 64 MiB).');
        const envelope = await received.text();
        const value = await fileJob(
          {
            type: 'open',
            envelope,
            keys: state.entries.flatMap((e) => (e.privateKey ? [e.privateKey] : [])),
            senders: knownSenders(state.entries),
          },
          abort.signal,
        );
        if (!abort.signal.aborted) setResult(value);
      }
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error).message);
    } finally {
      if (controller.current === abort) {
        setBusy(false);
        controller.current = null;
      }
    }
  }

  const signature = result?.type === 'opened' ? describeSignature(result.signature) : null;
  return (
    <div className="feature-body file-panel">
      <h2>Encrypt and decrypt files</h2>
      <p>
        Files stay in your browser and use <Term term="hybridEncryption">hybrid encryption</Term>.
        Up to 25 MiB per file. Use demonstration data.
      </p>
      <fieldset disabled={busy} className="feature-fields">
        <legend>Encrypt a file</legend>
        <RecipientPicker
          label="File recipient"
          value={recipient}
          onChange={(value) => {
            setChoice({ value });
            setResult(null);
          }}
        />
        {recipient && ![1024, 2048].includes(recipient.key.n.toString(2).length) && (
          <p className="keyring-warning">
            Files need a 1024/2048-bit recipient key. Choose a real-size key.
          </p>
        )}
        <label>
          File to encrypt
          <input
            type="file"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
              setError('');
            }}
          />
        </label>
        <label className="keyring-toggle">
          <input
            type="checkbox"
            checked={sign}
            onChange={(e) => {
              setSign(e.target.checked);
              setResult(null);
            }}
          />
          Also sign this file
        </label>
        {sign && (
          <label>
            File signing key
            <select
              value={signer?.id ?? ''}
              onChange={(e) => {
                setSignerId(e.target.value);
                setResult(null);
              }}
            >
              {signers.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.name}
                  {e.source === 'demo' ? ' · public demo private key' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        {sign && (
          <p className="helper-text">
            RSA-PSS signs the file and metadata before encryption. This lab reuses signing and
            encryption keys for simplicity.
          </p>
        )}
        <button
          className="primary-button"
          disabled={
            !file || !recipient || ![1024, 2048].includes(recipient.key.n.toString(2).length)
          }
          onClick={() => void perform('encrypt')}
        >
          Encrypt file
        </button>
      </fieldset>
      <fieldset disabled={busy} className="feature-fields">
        <legend>Decrypt a file envelope</legend>
        <label>
          Encrypted envelope file
          <input
            type="file"
            accept=".rsa,.txt"
            onChange={(e) => {
              setReceived(e.target.files?.[0] ?? null);
              setResult(null);
              setError('');
            }}
          />
        </label>
        <p className="helper-text">
          The matching private key is selected automatically from your keyring. The GCM tag is
          checked before any download is available.
        </p>
        <button
          className="secondary-button"
          disabled={!received}
          onClick={() => void perform('decrypt')}
        >
          Decrypt file
        </button>
      </fieldset>
      {busy && (
        <div role="status">
          Processing file…{' '}
          <button
            className="secondary-button"
            onClick={() => {
              controller.current?.abort();
              setResult(null);
            }}
          >
            Cancel file operation
          </button>
        </div>
      )}
      {result && (
        <LessonTrace
          title="Hybrid file machine"
          frames={fileFrames(result)}
          resetKey={`${result.type}-${result.elapsedMs}`}
        />
      )}
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      {result?.type === 'sealed' && (
        <section className="feature-result" aria-label="Encrypted file result">
          <h3>Your encrypted file is ready</h3>
          <p>
            RSA encrypted 32 bytes (the AES key). AES encrypted the payload containing{' '}
            {(result.size / 1024 / 1024).toFixed(3)} MiB of file data.
          </p>
          <p className="mono">
            RSA key wrap: {result.rsaMs.toFixed(2)} ms · AES-GCM: {result.aesMs.toFixed(2)} ms ·
            Total computation: {result.elapsedMs.toFixed(2)} ms
          </p>
          <p className="helper-text">
            RSA-only estimate: {result.rsaOnlyEstimateMs.toFixed(2)} ms, extrapolating OAEP blocks
            from this key-wrap measurement. This is an estimate, not a measured file-encryption run.
            Total includes encoding and optional signing; no animation time is included.
          </p>
          <button
            className="primary-button"
            onClick={() =>
              downloadBlob(
                new Blob([result.envelope], { type: 'text/plain' }),
                `${downloadName(file?.name ?? 'file')}.rsa`,
              )
            }
          >
            Download encrypted envelope
          </button>
        </section>
      )}
      {result?.type === 'opened' && (
        <section className="feature-result" aria-label="Decrypted file result">
          <h3>File authenticated and decrypted</h3>
          <p>
            {result.file.name} · {result.bytes.length.toLocaleString()} bytes ·{' '}
            {result.elapsedMs.toFixed(2)} ms computation
          </p>
          {signature && <p className={`signature-line ${signature.tone}`}>{signature.text}</p>}
          <p className="helper-text">
            A valid signature matches a key; confirm a contact’s fingerprint through a trusted
            channel to establish their identity. Downloaded files can still contain unsafe content.
          </p>
          <button
            className="primary-button"
            onClick={() =>
              downloadBlob(
                new Blob([new Uint8Array(result.bytes).buffer], {
                  type: 'application/octet-stream',
                }),
                result.file.name,
              )
            }
          >
            Download decrypted file
          </button>
        </section>
      )}
    </div>
  );
}
