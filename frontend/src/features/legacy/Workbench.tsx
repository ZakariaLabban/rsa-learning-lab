import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Braces,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  MessageSquare,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UnlockKeyhole,
} from 'lucide-react';
import {
  encryptMessage,
  decryptEnvelope,
  type CipherResult,
  type Mode,
  type Recovered,
} from '../../engine/client';
import { KeyBar, type KeyControls } from './KeyBar';
import { CopyButton } from '../../components/CopyButton';
const stageData = [
  {
    title: 'Your message',
    short: 'PLAINTEXT',
    icon: MessageSquare,
    formula: 'M',
    description:
      'Start with readable text. RSA works on numbers, so the first step is to encode this text as bytes.',
  },
  {
    title: 'Encode',
    short: 'UTF-8 BYTES',
    icon: Braces,
    formula: 'M → m',
    description:
      'UTF-8 represents text as bytes. In textbook mode these become the message integer; OAEP adds randomized encoding before RSA.',
  },
  {
    title: 'Encrypt',
    short: 'PUBLIC KEY',
    icon: LockKeyhole,
    formula: 'c = mᵉ mod n',
    description:
      'Raise the encoded integer to the public exponent, reducing modulo n. Anyone with the public key can perform this operation.',
  },
  {
    title: 'Ciphertext',
    short: 'ENCRYPTED DATA',
    icon: Fingerprint,
    formula: 'c',
    description:
      'The output is a fixed-width block of ciphertext. The copyable envelope also records the mode and key fingerprint.',
  },
  {
    title: 'Decrypt',
    short: 'PRIVATE KEY',
    icon: UnlockKeyhole,
    formula: 'm = cᵈ mod n',
    description:
      'The private exponent recovers the encoded block. Decode it to recover the original bytes and readable text.',
  },
];

export function Workbench(
  props: KeyControls & {
    active: boolean;
    setError: (e: string) => void;
    guide: boolean;
    setGuide: (v: boolean) => void;
  },
) {
  const { labKey, setError, guide, setGuide } = props;
  const [message, setMessage] = useState('Some things are worth keeping between us.');
  const [mode, setMode] = useState<Mode>('oaep');
  const [result, setResult] = useState<CipherResult>();
  const [recovered, setRecovered] = useState<Recovered>();
  const [envelope, setEnvelope] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [outputTab, setOutputTab] = useState<'cipher' | 'recovered'>('cipher');
  const [inputTab, setInputTab] = useState<'message' | 'cipher'>('message');
  const [inspector, setInspector] = useState(false);
  const reduced = useReducedMotion();
  const run = useRef(0);
  const bytes = new TextEncoder().encode(message);
  const capacity = (labKey?.bits ?? props.bits) / 8 - (mode === 'oaep' ? 66 : 1);

  function invalidate() {
    run.current++;
    setResult(undefined);
    setRecovered(undefined);
    setEnvelope('');
    setPlaying(false);
    setStep(0);
    setOutputTab('cipher');
  }
  useEffect(() => {
    invalidate();
  }, [labKey?.id]);
  useEffect(() => {
    if (!props.active) setPlaying(false);
  }, [props.active]);
  useEffect(() => {
    if (!playing) return;
    const max = recovered ? 4 : 3;
    if (step >= max) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStep((s) => s + 1), (reduced ? 200 : 1000) / speed);
    return () => clearTimeout(timer);
  }, [playing, step, speed, recovered, reduced]);
  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );

  async function encrypt() {
    if (!labKey) return;
    const thisRun = ++run.current;
    setBusy(true);
    setError('');
    setRecovered(undefined);
    setPlaying(false);
    try {
      const encrypted = await encryptMessage(labKey.id, message, mode);
      if (run.current !== thisRun) return;
      setResult(encrypted);
      setEnvelope(encrypted.envelope);
      setOutputTab('cipher');
      setStep(0);
      setPlaying(true);
    } catch (e) {
      if (run.current === thisRun) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function decrypt() {
    if (!labKey || !envelope) return;
    const thisRun = ++run.current;
    setBusy(true);
    setError('');
    try {
      const data = await decryptEnvelope(labKey.id, envelope);
      if (run.current !== thisRun) return;
      setRecovered(data);
      setOutputTab('recovered');
      setPlaying(false);
      setStep(4);
    } catch (e) {
      if (run.current === thisRun) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const selected = stageData[step];
  const maxStep = recovered ? 4 : result ? 3 : 0;
  const inspectValue = !result
    ? 'Run an encryption to inspect the calculated values.'
    : step === 0
      ? message
      : step === 1
        ? result.utf8_hex || '(empty byte string)'
        : step === 2
          ? `e = ${labKey?.e}\nn = ${labKey?.n}\n\n${result.mode === 'oaep' ? 'OAEP-encoded integer' : 'Message integer'} → modular exponentiation`
          : step === 3
            ? result.cipher_hex
            : (recovered?.message ?? '');

  return (
    <>
      <KeyBar {...props} />
      <section className="journey-panel panel">
        <div className="panel-top">
          <div className="panel-title">
            <Radio size={16} />
            <h2>The message journey</h2>
            <span className="subtle-badge">LIVE WORKSPACE</span>
          </div>
          <button
            className={`text-button ${guide ? 'aqua-text' : ''}`}
            aria-pressed={guide}
            onClick={() => setGuide(!guide)}
          >
            <BookOpen size={14} />
            {guide ? 'Guided view' : 'Compact view'}
            <ChevronDown size={12} />
          </button>
        </div>
        <div className="journey-canvas">
          <div className="canvas-label">
            <span className="canvas-corner" /> PUBLIC-KEY CRYPTOGRAPHY{' '}
            <span className="canvas-line" /> RSA
          </div>
          <div className="key-orbit orbit-public">
            <KeyRound size={12} />
            <span>PUBLIC KEY</span>
            <span className="mono">(n, e)</span>
          </div>
          <div className="key-orbit orbit-private">
            <KeyRound size={12} />
            <span>PRIVATE KEY</span>
            <span className="mono">(n, d)</span>
          </div>
          <div className="journey-stages">
            {stageData.map((stage, i) => (
              <div className="stage-wrap" key={stage.title}>
                <button
                  className={`journey-stage ${i === step ? 'current' : ''} ${i <= maxStep && result ? 'completed' : ''} ${i === 4 ? 'private-stage' : ''}`}
                  disabled={i > maxStep}
                  onClick={() => {
                    setStep(i);
                    setPlaying(false);
                    setInspector(true);
                  }}
                  aria-label={`Inspect ${stage.title}`}
                  aria-current={i === step ? 'step' : undefined}
                >
                  <span className="stage-index mono">0{i + 1}</span>
                  <span className="stage-icon">
                    <stage.icon size={25} strokeWidth={1.4} />
                  </span>
                  <span className="stage-short">{stage.short}</span>
                  <span className="stage-formula mono">{stage.formula}</span>
                  {i === step && <motion.span layoutId="active-dot" className="active-dot" />}
                </button>
                <strong className={i === step ? 'stage-label active-label' : 'stage-label'}>
                  {stage.title}
                </strong>
                {i < 4 && (
                  <div className={`stage-connector ${result && step > i ? 'lit' : ''}`}>
                    <span />
                    <ChevronRight size={12} />
                    {result && step === i + 1 && !reduced && (
                      <motion.div
                        className="travelling-packet"
                        initial={{ left: 0, opacity: 0 }}
                        animate={{ left: '85%', opacity: [0, 1, 0] }}
                        transition={{ duration: 0.6 }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="canvas-bottom">
            <span>
              <span className="tiny-square" />
              {result
                ? 'Computed by the custom RSA engine'
                : 'Your message. A mathematical transformation. A private conversation.'}
            </span>
            <span className="mono">{labKey ? `RSA-${labKey.bits}` : 'RSA-1024 / 2048'}</span>
          </div>
        </div>
        <div className="playback">
          <div className="playback-buttons">
            <button
              className="icon-button"
              disabled={!result}
              onClick={() => {
                setStep(0);
                setPlaying(false);
              }}
              aria-label="Restart journey"
            >
              <RotateCcw size={15} />
            </button>
            <button
              className="icon-button"
              disabled={!result || step === 0}
              onClick={() => {
                setStep((s) => s - 1);
                setPlaying(false);
              }}
              aria-label="Previous step"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="play-button"
              disabled={!result}
              onClick={() => {
                if (step === maxStep) setStep(0);
                setPlaying(!playing);
              }}
              aria-label={playing ? 'Pause journey' : 'Play journey'}
            >
              {playing ? (
                <Pause size={14} fill="currentColor" />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
            </button>
            <button
              className="icon-button"
              disabled={!result || step >= maxStep}
              onClick={() => {
                setStep((s) => s + 1);
                setPlaying(false);
              }}
              aria-label="Next step"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="timeline">
            <div style={{ width: `${step * 25}%` }} />
            {stageData.map((s, i) => (
              <button
                key={s.title}
                disabled={i > maxStep}
                aria-label={`Jump to ${s.title}`}
                className={i <= step ? 'passed' : ''}
                onClick={() => {
                  setStep(i);
                  setPlaying(false);
                }}
              />
            ))}
          </div>
          <span className="step-counter mono">
            0{step + 1}
            <span> / 05</span>
          </span>
          <button
            className="speed-button mono"
            onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 0.5 : 1)}
            aria-label="Change playback speed"
          >
            {speed}×
          </button>
        </div>
        <AnimatePresence>
          {guide && (
            <motion.div
              className="journey-explanation"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className="explanation-icon">
                <selected.icon size={16} />
              </div>
              <p>
                <strong>{selected.title}.</strong> {selected.description}
              </p>
              <button className="text-button" onClick={() => setInspector(!inspector)}>
                {inspector ? 'Hide values' : 'Inspect values'} <ArrowUpRight size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {inspector && (
          <div className="inspector">
            <div className="eyebrow">ACTUAL RUN VALUES · {selected.title}</div>
            <pre>{inspectValue}</pre>
          </div>
        )}
      </section>
      <div className="io-grid">
        <section className="panel input-panel">
          <div className="panel-top">
            <div className="tabs">
              <button
                className={inputTab === 'message' ? 'tab active' : 'tab'}
                onClick={() => setInputTab('message')}
              >
                <MessageSquare size={15} />
                Your message
              </button>
              <button
                className={inputTab === 'cipher' ? 'tab active' : 'tab'}
                onClick={() => setInputTab('cipher')}
              >
                <LockKeyhole size={14} />
                Paste ciphertext
              </button>
            </div>
            <span className="mono input-format">
              {inputTab === 'message' ? 'UTF-8' : 'ENVELOPE'}
            </span>
          </div>
          {inputTab === 'message' ? (
            <>
              <div className="input-area">
                <label className="sr-only" htmlFor="message">
                  Message to encrypt
                </label>
                <textarea
                  id="message"
                  value={message}
                  disabled={busy}
                  onChange={(e) => {
                    invalidate();
                    setMessage(e.target.value);
                  }}
                  spellCheck={false}
                  placeholder="What would you like to keep between us?"
                />
                <div className="input-meta">
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      invalidate();
                      setMessage('Hello Bob. Meet me where the numbers end.');
                    }}
                  >
                    <Sparkles size={12} /> Try an example
                  </button>
                  <span className={`mono ${bytes.length > capacity ? 'danger-text' : ''}`}>
                    {bytes.length} / {capacity} bytes
                  </span>
                </div>
              </div>
              <div className="input-toolbar">
                <div className="mode-select">
                  <label htmlFor="padding">Padding</label>
                  <select
                    id="padding"
                    value={mode}
                    disabled={busy}
                    onChange={(e) => {
                      invalidate();
                      setMode(e.target.value as Mode);
                    }}
                  >
                    <option value="oaep">OAEP · SHA-256</option>
                    <option value="textbook">Textbook · no padding</option>
                  </select>
                </div>
                <button
                  className="primary-button"
                  onClick={encrypt}
                  disabled={!labKey || busy || props.generating || bytes.length > capacity}
                >
                  <LockKeyhole size={15} />
                  {busy ? 'Computing…' : 'Encrypt message'}
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="input-area">
                <label className="sr-only" htmlFor="cipher-envelope">
                  Ciphertext envelope to decrypt
                </label>
                <textarea
                  className="envelope-input mono"
                  id="cipher-envelope"
                  value={envelope}
                  disabled={busy}
                  onChange={(e) => {
                    run.current++;
                    setEnvelope(e.target.value);
                    setRecovered(undefined);
                    setResult(undefined);
                    setStep(0);
                    setPlaying(false);
                  }}
                  placeholder="Paste a rsa-lab.v2: envelope created with the active key…"
                />
                <div className="input-meta">
                  <span>Uses the active private key. Keys stay in this tab until you refresh.</span>
                </div>
              </div>
              <div className="input-toolbar">
                <span className="helper-text">Mode is read from the envelope.</span>
                <button
                  className="primary-button"
                  onClick={decrypt}
                  disabled={!labKey || !envelope || busy || props.generating}
                >
                  <UnlockKeyhole size={15} />
                  Decrypt envelope
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          )}
        </section>
        <section className="panel output-panel">
          <div className="panel-top">
            <div className="tabs">
              <button
                className={outputTab === 'cipher' ? 'tab active' : 'tab'}
                onClick={() => setOutputTab('cipher')}
              >
                <Fingerprint size={15} />
                Ciphertext{result && <span className="tab-dot" />}
              </button>
              <button
                className={outputTab === 'recovered' ? 'tab active' : 'tab'}
                onClick={() => setOutputTab('recovered')}
              >
                <UnlockKeyhole size={14} />
                Recovered
              </button>
            </div>
            {outputTab === 'cipher' && result && (
              <CopyButton value={result.envelope} label="Copy envelope" />
            )}
            {outputTab === 'recovered' && recovered && <CopyButton value={recovered.message} />}
          </div>
          <div className="output-area">
            {outputTab === 'cipher' ? (
              result ? (
                <>
                  <div className="output-caption">
                    <span className="status-dot" /> ENCRYPTION COMPLETE{' '}
                    <span>{result.output_bytes} bytes · HEX PREVIEW</span>
                  </div>
                  <pre className="cipher-output">
                    {result.cipher_hex.match(/.{1,2}/g)?.join(' ')}
                  </pre>
                  <div className="output-meta">
                    <span className="mono">{result.elapsed_ms.toFixed(3)} ms computation</span>
                    <span>
                      {result.mode === 'oaep'
                        ? 'Randomized with OAEP'
                        : 'Deterministic · educational'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="empty-output">
                  <div className="empty-output-icon">
                    <Fingerprint size={32} strokeWidth={1} />
                  </div>
                  <strong>A little mystery, waiting to happen.</strong>
                  <p>Your encrypted message will appear here.</p>
                </div>
              )
            ) : recovered ? (
              <>
                <div className="output-caption">
                  <span className="status-dot" /> DECRYPTION COMPLETE <CheckCheck size={15} />
                </div>
                <div className="recovered-message">{recovered.message || '(empty message)'}</div>
                <div className="output-meta">
                  <span className="mono">{recovered.elapsed_ms.toFixed(3)} ms computation</span>
                  <span>Recovered using the private key</span>
                </div>
              </>
            ) : (
              <div className="empty-output">
                <UnlockKeyhole size={29} strokeWidth={1} />
                <strong>Bring your message back.</strong>
                <p>Encrypt, then decrypt to recover the original.</p>
              </div>
            )}
          </div>
          <div className="output-toolbar">
            <span>
              <ShieldCheck size={14} />
              {outputTab === 'recovered' && recovered
                ? 'Original bytes recovered'
                : result
                  ? `${result.bits}-bit RSA · ${result.mode === 'oaep' ? 'OAEP-SHA256' : 'textbook'}`
                  : 'Public key in. Ciphertext out.'}
            </span>
            <button
              className="secondary-button"
              onClick={decrypt}
              disabled={!labKey || !envelope || busy || props.generating}
            >
              <UnlockKeyhole size={14} />
              Decrypt
              <ArrowRight size={14} />
            </button>
          </div>
        </section>
      </div>
      <div className={`insight-strip ${mode === 'textbook' ? 'warning-strip' : ''}`}>
        <span className="insight-icon">
          <CircleHelp size={17} />
        </span>
        <p>
          <strong>
            {mode === 'oaep'
              ? 'Why does the ciphertext change every time?'
              : 'Textbook mode is a mathematical demonstration.'}
          </strong>{' '}
          {mode === 'oaep'
            ? 'OAEP adds fresh randomness before encryption. The same message takes a different path to the same destination.'
            : 'Identical messages produce identical ciphertexts. Raw RSA does not authenticate messages; explore OAEP to see why padding matters.'}
        </p>
        <span className="insight-tag">THE MORE YOU KNOW</span>
      </div>
    </>
  );
}
