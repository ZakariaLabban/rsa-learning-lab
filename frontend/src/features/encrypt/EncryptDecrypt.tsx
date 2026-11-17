import { LessonTrace } from '../lessons/LessonTrace';
import { useLessonExperience } from '../lessons/LessonExperience';
import { journeyFrames } from '../lessons/protocolTraces';
import { lazy, Suspense, useId, useRef, useState } from 'react';
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
import { JourneyTrack } from './JourneyTrack';
import {
  decryptOwnRun,
  decryptReceived,
  defaultRecipientEntry,
  describeSignature,
  encrypt,
  journeySteps,
  privateEntryFor,
  recipientLimits,
  signingEntries,
  textCapacity,
  type DecryptRun,
  type EncryptRun,
  type InputMode,
  type PaddingMode,
} from './model';

const FilePanel = lazy(() =>
  import('../files/FilePanel').then((module) => ({ default: module.FilePanel })),
);

/** The signature line shown with every decrypted hybrid (or unsigned) message. */
function SignatureLine({ run }: { run: DecryptRun }) {
  if (run.kind !== 'text' || run.opened.kind !== 'hybrid') return null;
  const { tone, text } = describeSignature(run.signature);
  return <p className={`signature-line ${tone}`}>{text}</p>;
}

const short = (value: bigint | string) => {
  const text = String(value);
  return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text;
};

/**
 * Encrypt / Decrypt (#13). With a demo character (or your own key) it is the one-screen
 * Alice-and-Bob simulation; with a contact or pasted key it produces an envelope to send.
 */
export function EncryptDecrypt() {
  const { modern } = useLessonExperience();
  const instanceId = useId();
  const keyring = useKeyring();
  const [tab, setTab] = useState<'encrypt' | 'decrypt' | 'files'>('encrypt');
  const [selection, setSelection] = useState<{ chosen: boolean; value: Recipient | null }>({
    chosen: false,
    value: null,
  });
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [padding, setPadding] = useState<PaddingMode>('oaep');
  const [signing, setSigning] = useState(false);
  const [signerId, setSignerId] = useState<string | null>(null);
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
  // Signers: my 1024/2048-bit keys first (the active one if possible), then demo characters.
  const signers = signingEntries(keyring.entries).sort(
    (a, b) => Number(b.source === 'mine') - Number(a.source === 'mine'),
  );
  const signer =
    signers.find((e) => e.id === signerId) ??
    signers.find((e) => e.id === keyring.activeId) ??
    signers.find((e) => e.source === 'mine') ??
    signers.find((e) => e.id === 'demo-bob');
  const canSign = !limits?.hybridProblem && !!signer;
  const signed = signing && canSign && effectiveInput === 'text';
  const effectivePadding: PaddingMode = limits?.oaepProblem
    ? 'textbook'
    : signed
      ? 'hybrid'
      : padding;
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
      const result = await encrypt(
        recipient,
        effectiveInput,
        effectivePadding,
        input,
        signed ? signer : undefined,
      );
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
        <button
          role="tab"
          aria-selected={tab === 'files'}
          className={tab === 'files' ? 'tab active' : 'tab'}
          onClick={() => setTab('files')}
        >
          Files
        </button>
      </div>

      {tab === 'files' && (
        <Suspense fallback={<p role="status">Loading files…</p>}>
          <FilePanel />
        </Suspense>
      )}
      {tab === 'files' ? null : tab === 'encrypt' ? (
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
              <label htmlFor={instanceId + '-message-to-encrypt'}>Message to encrypt</label>
              <textarea
                id={instanceId + '-message-to-encrypt'}
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
              <label htmlFor={instanceId + '-message-number'}>Message number (M)</label>
              <input
                id={instanceId + '-message-number'}
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
              <label htmlFor={instanceId + '-padding-mode'}>Padding</label>
              <select
                id={instanceId + '-padding-mode'}
                value={effectivePadding}
                disabled={signed}
                onChange={(event) => {
                  setPadding(event.target.value as PaddingMode);
                  reset();
                }}
              >
                <option value="oaep" disabled={!!limits?.oaepProblem}>
                  OAEP · randomized (secure)
                </option>
                <option value="textbook">Textbook · no padding (lecture formula)</option>
                <option value="hybrid" disabled={!!limits?.hybridProblem}>
                  Hybrid · AES-GCM + RSA-OAEP (any length)
                </option>
              </select>
              {limits?.oaepProblem && <span className="helper-text">{limits.oaepProblem}</span>}
              {effectivePadding === 'oaep' && (
                <span className="helper-text">
                  <Term term="oaep" /> adds randomness, so the same text never encrypts the same way
                  twice.
                </span>
              )}
              {effectivePadding === 'hybrid' && (
                <span className="helper-text">
                  A fresh AES key encrypts the message; RSA only encrypts that 32-byte key. This is
                  how real systems send long messages and files.
                </span>
              )}
            </div>
          ) : (
            <p className="helper-text">
              Number mode is raw textbook RSA: C = Mᵉ mod n, no padding.
            </p>
          )}

          {effectiveInput === 'text' && (
            <div className="sign-options">
              <label className="keyring-toggle">
                <input
                  type="checkbox"
                  checked={signed}
                  disabled={!canSign}
                  onChange={(event) => {
                    setSigning(event.target.checked);
                    reset();
                  }}
                />
                Also sign as me
              </label>
              {signed && signer && (
                <div className="encrypt-field sign-as">
                  <label htmlFor={instanceId + '-sign-as'}>Sign as</label>
                  <select
                    id={instanceId + '-sign-as'}
                    value={signer.id}
                    onChange={(event) => {
                      setSignerId(event.target.value);
                      reset();
                    }}
                  >
                    {signers.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} · {e.bits}-bit{e.source === 'demo' ? ' · demo' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <span className="helper-text">
                {limits?.hybridProblem
                  ? limits.hybridProblem
                  : !signer
                    ? 'Signing needs a 1024/2048-bit key of your own (create one on the Keys page).'
                    : signed
                      ? `Signs with ${signer.name}’s private key (RSA-PSS), then sends it in hybrid mode: a signature is too big to fit in one OAEP block.`
                      : 'Proves to the receiver who sent the message (the lecture’s authentication + confidentiality).'}
              </span>
            </div>
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
              <LessonTrace
                title="Message protocol machine"
                frames={journeyFrames(steps)}
                onStep={setStep}
                resetKey={`${run.kind}-${run.kind === 'number' ? run.c : run.sealed.envelope}-${Boolean(decrypted)}`}
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
                    v.protocolPrivate && modern ? (
                      <Value
                        key={v.label}
                        label={v.label}
                        value="Hidden in the new interface"
                        note="Sensitive protocol material stays local and is not displayed in this view."
                      />
                    ) : v.privateValue ? (
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
                {run.kind !== 'number' ? (
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
                  <SignatureLine run={decrypted} />
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
            <label htmlFor={instanceId + '-received-envelope'}>Envelope to decrypt</label>
            <textarea
              id={instanceId + '-received-envelope'}
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
                PRIVATE KEY ·{' '}
                {receivedResult.opened.kind === 'hybrid'
                  ? 'HYBRID'
                  : receivedResult.opened.mode === 'oaep'
                    ? 'OAEP'
                    : 'TEXTBOOK'}
              </span>
              <div className="recovered-message">{receivedResult.text}</div>
              <SignatureLine run={receivedResult} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
