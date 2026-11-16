import { useRef, useState } from 'react';
import { CheckCheck, Info, LockKeyhole, UnlockKeyhole } from 'lucide-react';
import { CopyButton } from '../../components/CopyButton';
import { ErrorBanner } from '../../components/ErrorBanner';
import { LectureExampleButton } from '../../components/LectureExampleButton';
import { RecipientPicker } from '../../components/RecipientPicker';
import { RolePanels } from '../../components/RolePanels';
import { Stepper } from '../../components/Stepper';
import { Term } from '../../components/Term';
import { NumberView } from '../../components/NumberView';
import { Value } from '../../components/Value';
import { recipientFromEntry, useKeyring, type Recipient } from '../../keyring';
import type { BasicMode } from '../../engine/rsa';
import { JourneyTrack } from './JourneyTrack';
import {
  decryptOwnRun,
  decryptReceived,
  defaultRecipientEntry,
  encrypt,
  journeySteps,
  privateEntryFor,
  recipientLimits,
  textCapacity,
  type DecryptRun,
  type EncryptRun,
  type InputMode,
} from './model';

const short = (value: bigint | string) => {
  const text = String(value);
  return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text;
};

/**
 * Encrypt / Decrypt (#13). With a demo character (or your own key) it is the one-screen
 * Alice-and-Bob simulation; with a contact or pasted key it produces an envelope to send.
 */
export function EncryptDecrypt() {
  const keyring = useKeyring();
  const [tab, setTab] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [selection, setSelection] = useState<{ chosen: boolean; value: Recipient | null }>({
    chosen: false,
    value: null,
  });
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [padding, setPadding] = useState<BasicMode>('oaep');
  const [text, setText] = useState('Some things are worth keeping between us.');
  const [numberInput, setNumberInput] = useState('88');
  const [run, setRun] = useState<EncryptRun | null>(null);
  const [decrypted, setDecrypted] = useState<DecryptRun | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [received, setReceived] = useState('');
  const [receivedResult, setReceivedResult] = useState<DecryptRun | null>(null);
  const [receivedError, setReceivedError] = useState('');
  const runId = useRef(0);

  // The explicit choice wins; otherwise the active key, my newest key, or demo Alice.
  const chosenStillExists =
    !selection.value?.entryId || keyring.entries.some((e) => e.id === selection.value?.entryId);
  const fallback = defaultRecipientEntry(keyring);
  const recipient: Recipient | null =
    selection.chosen && chosenStillExists
      ? selection.value
      : fallback
        ? recipientFromEntry(fallback)
        : null;
  const limits = recipient ? recipientLimits(recipient) : undefined;
  const effectiveInput: InputMode = limits && !limits.textAllowed ? 'number' : inputMode;
  const effectivePadding: BasicMode = limits?.oaepProblem ? 'textbook' : padding;
  const capacity =
    recipient && effectiveInput === 'text'
      ? textCapacity(recipient, effectivePadding, text)
      : undefined;
  const holder = recipient ? privateEntryFor(recipient, keyring.entries) : undefined;
  const steps = run ? journeySteps(run, decrypted ?? undefined) : [];
  const current = steps[Math.min(step, steps.length - 1)];

  function reset() {
    runId.current++;
    setRun(null);
    setDecrypted(null);
    setStep(0);
    setError('');
    setNotice('');
  }
  function choose(value: Recipient | null) {
    setSelection({ chosen: true, value });
    reset();
  }

  async function doEncrypt() {
    if (!recipient) return;
    const id = ++runId.current;
    setBusy(true);
    setError('');
    setNotice('');
    setDecrypted(null);
    try {
      const input = effectiveInput === 'number' ? numberInput : text;
      const result = await encrypt(recipient, effectiveInput, effectivePadding, input);
      if (id !== runId.current) return;
      setRun(result);
      setStep(0);
    } catch (e) {
      if (id === runId.current) {
        setRun(null);
        setError((e as Error).message);
      }
    } finally {
      if (id === runId.current) setBusy(false);
    }
  }
  async function doDecrypt() {
    if (!run) return;
    const id = runId.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await decryptOwnRun(run, keyring.entries);
      if (id !== runId.current) return;
      setDecrypted(result);
      setStep(journeySteps(run, result).length - 1);
    } catch (e) {
      if (id === runId.current) setNotice((e as Error).message);
    } finally {
      if (id === runId.current) setBusy(false);
    }
  }
  async function doDecryptReceived() {
    setReceivedError('');
    setReceivedResult(null);
    setBusy(true);
    try {
      setReceivedResult(await decryptReceived(received, keyring.entries));
    } catch (e) {
      setReceivedError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const recipientName = recipient?.label ?? 'the recipient';
  const aliceTitle = recipientName === 'Alice' ? 'Alice' : `Alice (${recipientName})`;
  const problem = effectiveInput === 'text' ? capacity?.problem : undefined;

  return (
    <section className="panel encrypt-panel" aria-label="Encrypt and decrypt">
      <div className="encrypt-tabs" role="tablist" aria-label="Mode">
        <button
          role="tab"
          aria-selected={tab === 'encrypt'}
          className={tab === 'encrypt' ? 'tab active' : 'tab'}
          onClick={() => setTab('encrypt')}
        >
          <LockKeyhole size={15} /> Encrypt a message
        </button>
        <button
          role="tab"
          aria-selected={tab === 'decrypt'}
          className={tab === 'decrypt' ? 'tab active' : 'tab'}
          onClick={() => setTab('decrypt')}
        >
          <UnlockKeyhole size={15} /> Decrypt a received envelope
        </button>
      </div>

      {tab === 'encrypt' ? (
        <div className="encrypt-body">
          <div className="encrypt-row">
            <RecipientPicker value={recipient} onChange={choose} />
            <LectureExampleButton
              label="Load lecture example (M = 88, key 187)"
              onLoad={() => {
                const lecture = keyring.entries.find((e) => e.source === 'lecture');
                if (!lecture) return;
                choose(recipientFromEntry(lecture));
                setInputMode('number');
                setNumberInput('88');
              }}
            />
          </div>
          {recipient && (
            <p className="helper-text">
              Encrypting for <strong>{recipient.label}</strong> with their <Term term="publicKey" />{' '}
              ({recipient.key.n.toString(2).length}-bit <Term term="modulus" />
              ).{' '}
              {holder
                ? 'This browser also holds the matching private key, so you can decrypt here too.'
                : 'Only they can decrypt it: copy the envelope and send it.'}
            </p>
          )}

          <div className="segmented input-mode" aria-label="Message type">
            {(['text', 'number'] as const).map((value) => (
              <button
                key={value}
                aria-pressed={effectiveInput === value}
                className={effectiveInput === value ? 'selected' : ''}
                disabled={value === 'text' && !!limits && !limits.textAllowed}
                title={value === 'text' ? limits?.textProblem : undefined}
                onClick={() => {
                  setInputMode(value);
                  reset();
                }}
              >
                {value === 'text' ? 'Text' : 'Number (M)'}
              </button>
            ))}
          </div>

          {effectiveInput === 'text' ? (
            <div className="encrypt-field">
              <label htmlFor="message-to-encrypt">Message to encrypt</label>
              <textarea
                id="message-to-encrypt"
                rows={3}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  reset();
                }}
              />
              {capacity && (
                <span className={`mono helper-text ${capacity.problem ? 'danger-text' : ''}`}>
                  {capacity.summary}
                </span>
              )}
            </div>
          ) : (
            <div className="encrypt-field">
              <label htmlFor="message-number">Message number (M)</label>
              <input
                id="message-number"
                inputMode="numeric"
                className="mono"
                value={numberInput}
                onChange={(event) => {
                  setNumberInput(event.target.value);
                  reset();
                }}
              />
              {recipient && (
                <span className="helper-text">
                  Any whole number with 0 ≤ M &lt; n = {short(recipient.key.n)}.
                </span>
              )}
            </div>
          )}

          {effectiveInput === 'text' ? (
            <div className="encrypt-field">
              <label htmlFor="padding-mode">Padding</label>
              <select
                id="padding-mode"
                value={effectivePadding}
                onChange={(event) => {
                  setPadding(event.target.value as BasicMode);
                  reset();
                }}
              >
                <option value="oaep" disabled={!!limits?.oaepProblem}>
                  OAEP · randomized (secure)
                </option>
                <option value="textbook">Textbook · no padding (lecture formula)</option>
              </select>
              {limits?.oaepProblem && <span className="helper-text">{limits.oaepProblem}</span>}
              {effectivePadding === 'oaep' && (
                <span className="helper-text">
                  <Term term="oaep" /> adds randomness, so the same text never encrypts the same way
                  twice.
                </span>
              )}
            </div>
          ) : (
            <p className="helper-text">
              Number mode is raw textbook RSA: C = Mᵉ mod n, no padding.
            </p>
          )}

          {problem && <p className="encrypt-problem">{problem}</p>}
          <ErrorBanner message={error} onDismiss={() => setError('')} />
          <div>
            <button
              className="primary-button"
              disabled={!recipient || busy || !!problem}
              onClick={doEncrypt}
            >
              <LockKeyhole size={15} /> Encrypt message
            </button>
            {!recipient && <span className="helper-text"> Choose who to encrypt for first.</span>}
          </div>

          {run && current && (
            <div className="journey-result">
              <RolePanels
                roles={[
                  {
                    name: 'Bob',
                    title: 'Bob (you, the sender)',
                    knowledge: (
                      <>
                        The message and {recipientName}’s public key (n ={' '}
                        {short(run.recipient.key.n)}, e = {String(run.recipient.key.e)}).
                      </>
                    ),
                  },
                  {
                    name: 'Alice',
                    title: aliceTitle,
                    knowledge: holder ? (
                      <>
                        The private key d. This browser holds it, so you can play {recipientName}{' '}
                        and decrypt below.
                      </>
                    ) : (
                      <>The private key d, which only {recipientName} has.</>
                    ),
                  },
                  {
                    name: 'Eve',
                    title: 'Eve (anyone watching)',
                    knowledge: (
                      <>Everything on the wire: n, e and the ciphertext. Not d, not the message.</>
                    ),
                  },
                ]}
              />
              <JourneyTrack steps={steps} step={step} onSelect={setStep} />
              <Stepper step={step} count={steps.length} onChange={setStep} label="Journey steps" />
              <article className="step-detail" aria-live="polite">
                <span className="eyebrow">
                  STEP {step + 1} ·{' '}
                  {current.who === 'Wire' ? 'ON THE WIRE' : current.who.toUpperCase()}
                </span>
                <h3>{current.title}</h3>
                <p className="mono step-formula">{current.formula}</p>
                <p>{current.explanation}</p>
                <div className="step-values">
                  {current.values.map((v) =>
                    v.privateValue ? (
                      // Private values stay hidden until the user reveals them.
                      <NumberView
                        key={`${run.recipient.fingerprint}-${v.label}`}
                        label={v.label}
                        value={BigInt(v.value)}
                        privateValue
                      />
                    ) : (
                      <Value key={v.label} label={v.label} value={v.value} note={v.note} />
                    ),
                  )}
                </div>
              </article>

              <div className="share-box">
                {run.kind === 'text' ? (
                  <>
                    <CopyButton value={run.sealed.envelope} label="Copy envelope" />
                    <span className="helper-text">
                      Send this text to {recipientName}; they paste it under “Decrypt a received
                      envelope”.
                    </span>
                  </>
                ) : (
                  <>
                    <CopyButton value={String(run.c)} label="Copy ciphertext C" />
                    <span className="helper-text">C = {short(run.c)}</span>
                  </>
                )}
                <span className="helper-text educational-note">
                  <Info size={13} /> Educational engine: not audited or constant-time. Don’t use it
                  for real secrets.
                </span>
              </div>

              <div className="decrypt-row">
                <button className="secondary-button" disabled={busy} onClick={doDecrypt}>
                  <UnlockKeyhole size={15} />
                  Decrypt
                </button>
                {notice && <p className="encrypt-notice">{notice}</p>}
              </div>
              {decrypted && (
                <div className="recovered-box">
                  <span className="eyebrow">
                    <CheckCheck size={14} /> DECRYPTED WITH {decrypted.keyName.toUpperCase()}’S
                    PRIVATE KEY
                  </span>
                  <div className="recovered-message">
                    {decrypted.kind === 'number' ? String(decrypted.m) : decrypted.text}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="encrypt-body">
          <p className="helper-text">
            Paste an envelope someone encrypted for you. The lab picks the matching private key from
            your keys and the demo characters automatically.
          </p>
          <div className="encrypt-field">
            <label htmlFor="received-envelope">Envelope to decrypt</label>
            <textarea
              id="received-envelope"
              className="mono"
              rows={5}
              placeholder="rsa-lab.v2:…"
              value={received}
              onChange={(event) => {
                setReceived(event.target.value);
                setReceivedResult(null);
                setReceivedError('');
              }}
            />
          </div>
          <div>
            <button
              className="primary-button"
              disabled={!received.trim() || busy}
              onClick={doDecryptReceived}
            >
              <UnlockKeyhole size={15} /> Decrypt envelope
            </button>
          </div>
          <ErrorBanner message={receivedError} onDismiss={() => setReceivedError('')} />
          {receivedResult?.kind === 'text' && (
            <div className="recovered-box">
              <span className="eyebrow">
                <CheckCheck size={14} /> DECRYPTED WITH {receivedResult.keyName.toUpperCase()}’S
                PRIVATE KEY · {receivedResult.opened.mode === 'oaep' ? 'OAEP' : 'TEXTBOOK'}
              </span>
              <div className="recovered-message">{receivedResult.text}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
