import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Braces, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Copy, Cpu, Download, Eye, EyeOff, Fingerprint, FlaskConical, GitBranch, KeyRound, Layers, LockKeyhole, Menu, MessageSquare, MousePointer2, Pause, Play, Plus, Radio, RotateCcw, ShieldCheck, Sparkles, UnlockKeyhole, X } from 'lucide-react';
import { api, generateKey, type CipherResult, type LabKey, type Mode, type Recovered } from './api';

type Page = 'workbench' | 'keys' | 'learn' | 'experiments';
const nav = [
  { id: 'workbench' as Page, label: 'Workbench', icon: Layers, tag: '01' },
  { id: 'keys' as Page, label: 'Key studio', icon: KeyRound, tag: '02' },
  { id: 'learn' as Page, label: 'Math explorer', icon: GitBranch, tag: '03' },
  { id: 'experiments' as Page, label: 'Experiments', icon: FlaskConical, tag: '04' },
];
const copy = {
  workbench: { eyebrow: 'THE INTERACTIVE WORKSPACE', title: 'Every message has a journey.', sub: 'Follow yours through the mathematics of public-key cryptography.' },
  keys: { eyebrow: 'THE FOUNDATION OF RSA', title: 'Two keys. One connection.', sub: 'Create a key pair. Explore the numbers that make it possible.' },
  learn: { eyebrow: 'MAKE THE INVISIBLE UNDERSTANDABLE', title: 'Big ideas. Small numbers.', sub: 'Walk through a real RSA calculation, one meaningful step at a time.' },
  experiments: { eyebrow: 'ASK A QUESTION. RUN AN EXPERIMENT.', title: 'A little curiosity goes a long way.', sub: 'Test your assumptions against actual cryptographic results.' },
};

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return <button className="copy-button" aria-label={label} title={error ? 'Clipboard unavailable. Select and copy the text.' : label} onClick={async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setError(true); }
  }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : error ? 'Select text' : label}</button>;
}

function Value({ label, value, note, privateValue = false }: { label: string; value: string; note?: string; privateValue?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return <div className={`value-field ${privateValue ? 'private-value' : ''}`}>
    <div className="value-label"><span>{label}</span><CopyButton value={value} /></div>
    <p className={`mono number ${expanded ? 'expanded' : ''}`}>{value}</p>
    <div className="value-bottom">{note && <small>{note}</small>}{value.length > 65 && <button onClick={() => setExpanded(!expanded)}>{expanded ? 'Collapse' : 'Show all'} <ChevronDown size={12} /></button>}</div>
  </div>;
}

function App() {
  const [page, setPage] = useState<Page>('workbench');
  const [bits, setBits] = useState(2048);
  const [key, setKey] = useState<LabKey>();
  const [generating, setGenerating] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [error, setError] = useState('');
  const [help, setHelp] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [history, setHistory] = useState<LabKey[]>([]);
  const [guide, setGuide] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch('/api/health').then(r => setOnline(r.ok)).catch(() => setOnline(false)); }, []);
  useEffect(() => {
    if (!generating) return;
    setGenerationSeconds(0);
    const timer = setInterval(() => setGenerationSeconds(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, [generating]);
  useEffect(() => {
    if (!help) return;
    const previous = document.activeElement as HTMLElement | null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelp(false);
      if (e.key !== 'Tab') return;
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); previous?.focus(); };
  }, [help]);

  async function createKey() {
    setError(''); setGenerating(true);
    try {
      const result = await generateKey(bits);
      setKey(result); setHistory(old => [...old.slice(-7), result]); setOnline(true);
    } catch (e) { setError((e as Error).message); }
    finally { setGenerating(false); }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'nav-open' : ''}`}>
      <a href="#" className="brand" onClick={e => { e.preventDefault(); setPage('workbench'); }} aria-label="RSA Lab home"><div className="brand-mark"><Braces size={23} /><span /></div><span>rsa<span className="brand-light">lab</span><sup>®</sup></span></a>
      <div className="sidebar-label">YOUR CRYPTOGRAPHY SANDBOX</div>
      <nav aria-label="Main navigation">{nav.map(item => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMobileNav(false); setError(''); }}><item.icon size={18} /><span>{item.label}</span><small>{item.tag}</small></button>)}</nav>
      <div className="sidebar-bottom">
        <div className="course-card"><div className="course-icon"><BookOpen size={18} /></div><span>Built to understand.<small>EECE 455 / 632 · Project 12</small></span><ArrowUpRight size={15} /></div>
        <button className="sidebar-help" onClick={() => setHelp(true)}><CircleHelp size={17} /> A quick orientation <ArrowUpRight size={14} /></button>
        <div className="local-status"><span className={online === false ? 'status-dot offline' : 'status-dot'} />{online === null ? 'Connecting to local engine' : online ? 'Local engine connected' : 'Local engine unavailable'}<span className="mono">v0.1</span></div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Toggle navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button><span>Laboratory</span><ChevronRight size={13} /><strong>{nav.find(n => n.id === page)?.label}</strong></div><div className="topbar-right"><span className="session-label"><span className="status-dot" /> LOCAL SESSION</span><span className="header-divider" /><button onClick={() => setHelp(true)} className="icon-button" aria-label="About this lab"><CircleHelp size={18} /></button><div className="avatar">R</div></div></header>
      <main>
        <div className="page-heading"><div><div className="eyebrow"><span />{copy[page].eyebrow}</div><h1>{copy[page].title}</h1><p>{copy[page].sub}</p></div><span className="educational-badge"><FlaskConical size={14} /> EDUCATIONAL EDITION</span></div>
        {error && <div role="alert" className="error-banner"><CircleHelp size={17} /><span>{error}</span><button className="icon-button" onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
        <div hidden={page !== 'workbench'}><Workbench active={page === 'workbench'} labKey={key} bits={bits} setBits={setBits} createKey={createKey} generating={generating} seconds={generationSeconds} setError={setError} guide={guide} setGuide={setGuide} /></div>
        <AnimatePresence mode="wait"><motion.div key={page} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .2 }}>
          {page === 'keys' && <KeyStudio labKey={key} bits={bits} setBits={setBits} createKey={createKey} generating={generating} seconds={generationSeconds} history={history} setKey={setKey} setError={setError} />}
          {page === 'learn' && <MathExplorer />}
          {page === 'experiments' && <Experiments labKey={key} generating={generating} createKey={createKey} history={history} setError={setError} />}
        </motion.div></AnimatePresence>
        <footer className="main-footer"><span><ShieldCheck size={13} /> Custom RSA engine. Real calculations. Made for learning.</span><span>Explore the mathematics behind the message <ArrowUpRight size={13} /></span></footer>
      </main>
    </div>
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="help-title" className="modal" onClick={e => e.stopPropagation()}><button autoFocus className="icon-button close-modal" onClick={() => setHelp(false)} aria-label="Close orientation"><X size={20} /></button><div className="modal-icon"><Sparkles size={25} /></div><div className="eyebrow">WELCOME TO RSA LAB</div><h2 id="help-title">A few numbers.<br />A whole new way to communicate.</h2><p>Start in the Workbench: generate a key, write a message, and follow it into ciphertext. Pause the journey to inspect every stage.</p><div className="help-steps"><span><KeyRound size={19} /> Generate your keys</span><span><MessageSquare size={19} /> Encrypt a message</span><span><MousePointer2 size={19} /> Explore what happened</span></div><p className="help-note">This is a local educational application. Our Python engine computes RSA and OAEP; the browser visualizes the results. Keys stay in session memory and expire after an hour of inactivity. Refreshing starts a new browser session. Use demonstration data: custom arithmetic is not constant time, and 1024-bit RSA is included for the assignment.</p><button className="primary-button" onClick={() => setHelp(false)}>Enter the laboratory <ArrowRight size={16} /></button></div></div>}
  </div>;
}

type KeyControls = { labKey?: LabKey; bits: number; setBits: (bits: number) => void; createKey: () => Promise<void>; generating: boolean; seconds: number };
function KeyBar({ labKey, bits, setBits, createKey, generating, seconds }: KeyControls) {
  return <div className="key-bar"><div className="key-bar-label"><span className="small-icon"><KeyRound size={17} /></span><div><strong>Key configuration</strong><small>{generating ? `Finding probable primes · ${seconds}s elapsed` : labKey ? `Active key · ${labKey.fingerprint.slice(0, 8)}` : 'Your first step into the lab'}</small></div></div><div className="key-bar-actions"><div className="segmented" aria-label="Key size">{[1024, 2048].map(n => <button disabled={generating} key={n} aria-pressed={bits === n} className={bits === n ? 'selected' : ''} onClick={() => setBits(n)}>{n}<span>bit</span></button>)}</div><button className="secondary-button" onClick={createKey} disabled={generating}><Plus size={15} className={generating ? 'spin' : ''} />{generating ? 'Generating…' : labKey ? 'New key pair' : 'Generate key pair'}</button><span className={`key-status ${labKey && !generating ? 'ready' : ''}`}><span className="status-dot" />{generating ? 'WORKING' : labKey ? `${labKey.bits} BIT READY` : 'NO KEY YET'}</span></div></div>;
}

const stageData = [
  { title: 'Your message', short: 'PLAINTEXT', icon: MessageSquare, formula: 'M', description: 'Start with readable text. RSA works on numbers, so the first step is to encode this text as bytes.' },
  { title: 'Encode', short: 'UTF-8 BYTES', icon: Braces, formula: 'M → m', description: 'UTF-8 represents text as bytes. In textbook mode these become the message integer; OAEP adds randomized encoding before RSA.' },
  { title: 'Encrypt', short: 'PUBLIC KEY', icon: LockKeyhole, formula: 'c = mᵉ mod n', description: 'Raise the encoded integer to the public exponent, reducing modulo n. Anyone with the public key can perform this operation.' },
  { title: 'Ciphertext', short: 'ENCRYPTED DATA', icon: Fingerprint, formula: 'c', description: 'The output is a fixed-width block of ciphertext. The copyable envelope also records the mode and key fingerprint.' },
  { title: 'Decrypt', short: 'PRIVATE KEY', icon: UnlockKeyhole, formula: 'm = cᵈ mod n', description: 'The private exponent recovers the encoded block. Decode it to recover the original bytes and readable text.' },
];

function Workbench(props: KeyControls & { active: boolean; setError: (e: string) => void; guide: boolean; setGuide: (v: boolean) => void }) {
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

  function invalidate() { run.current++; setResult(undefined); setRecovered(undefined); setEnvelope(''); setPlaying(false); setStep(0); setOutputTab('cipher'); }
  useEffect(() => { invalidate(); }, [labKey?.id]);
  useEffect(() => { if (!props.active) setPlaying(false); }, [props.active]);
  useEffect(() => {
    if (!playing) return;
    const max = recovered ? 4 : 3;
    if (step >= max) { setPlaying(false); return; }
    const timer = setTimeout(() => setStep(s => s + 1), (reduced ? 200 : 1000) / speed);
    return () => clearTimeout(timer);
  }, [playing, step, speed, recovered, reduced]);
  useEffect(() => () => { run.current++; }, []);

  async function encrypt() {
    if (!labKey) return;
    const thisRun = ++run.current;
    setBusy(true); setError(''); setRecovered(undefined); setPlaying(false);
    try {
      const encrypted = await api<CipherResult>('/encrypt', { key_id: labKey.id, message, mode });
      if (run.current !== thisRun) return;
      setResult(encrypted); setEnvelope(encrypted.envelope); setOutputTab('cipher'); setStep(0); setPlaying(true);
    } catch (e) { if (run.current === thisRun) setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function decrypt() {
    if (!labKey || !envelope) return;
    const thisRun = ++run.current;
    setBusy(true); setError('');
    try {
      const data = await api<Recovered>('/decrypt', { key_id: labKey.id, envelope });
      if (run.current !== thisRun) return;
      setRecovered(data); setOutputTab('recovered'); setPlaying(false); setStep(4);
    } catch (e) { if (run.current === thisRun) setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const selected = stageData[step];
  const maxStep = recovered ? 4 : result ? 3 : 0;
  const inspectValue = !result ? 'Run an encryption to inspect the calculated values.' : step === 0 ? message : step === 1 ? result.utf8_hex || '(empty byte string)' : step === 2 ? `e = ${labKey?.e}\nn = ${labKey?.n}\n\n${result.mode === 'oaep' ? 'OAEP-encoded integer' : 'Message integer'} → modular exponentiation` : step === 3 ? result.cipher_hex : recovered?.message ?? '';

  return <>
    <KeyBar {...props} />
    <section className="journey-panel panel">
      <div className="panel-top"><div className="panel-title"><Radio size={16} /><h2>The message journey</h2><span className="subtle-badge">LIVE WORKSPACE</span></div><button className={`text-button ${guide ? 'aqua-text' : ''}`} aria-pressed={guide} onClick={() => setGuide(!guide)}><BookOpen size={14} />{guide ? 'Guided view' : 'Compact view'}<ChevronDown size={12} /></button></div>
      <div className="journey-canvas">
        <div className="canvas-label"><span className="canvas-corner" /> PUBLIC-KEY CRYPTOGRAPHY <span className="canvas-line" /> RSA</div>
        <div className="key-orbit orbit-public"><KeyRound size={12} /><span>PUBLIC KEY</span><span className="mono">(n, e)</span></div>
        <div className="key-orbit orbit-private"><KeyRound size={12} /><span>PRIVATE KEY</span><span className="mono">(n, d)</span></div>
        <div className="journey-stages">{stageData.map((stage, i) => <div className="stage-wrap" key={stage.title}>
          <button className={`journey-stage ${i === step ? 'current' : ''} ${i <= maxStep && result ? 'completed' : ''} ${i === 4 ? 'private-stage' : ''}`} disabled={i > maxStep} onClick={() => { setStep(i); setPlaying(false); setInspector(true); }} aria-label={`Inspect ${stage.title}`} aria-current={i === step ? 'step' : undefined}><span className="stage-index mono">0{i + 1}</span><span className="stage-icon"><stage.icon size={25} strokeWidth={1.4} /></span><span className="stage-short">{stage.short}</span><span className="stage-formula mono">{stage.formula}</span>{i === step && <motion.span layoutId="active-dot" className="active-dot" />}</button>
          <strong className={i === step ? 'stage-label active-label' : 'stage-label'}>{stage.title}</strong>
          {i < 4 && <div className={`stage-connector ${result && step > i ? 'lit' : ''}`}><span /><ChevronRight size={12} />{result && step === i + 1 && !reduced && <motion.div className="travelling-packet" initial={{ left: 0, opacity: 0 }} animate={{ left: '85%', opacity: [0, 1, 0] }} transition={{ duration: .6 }} />}</div>}
        </div>)}</div>
        <div className="canvas-bottom"><span><span className="tiny-square" />{result ? 'Computed by the custom RSA engine' : 'Your message. A mathematical transformation. A private conversation.'}</span><span className="mono">{labKey ? `RSA-${labKey.bits}` : 'RSA-1024 / 2048'}</span></div>
      </div>
      <div className="playback"><div className="playback-buttons"><button className="icon-button" disabled={!result} onClick={() => { setStep(0); setPlaying(false); }} aria-label="Restart journey"><RotateCcw size={15} /></button><button className="icon-button" disabled={!result || step === 0} onClick={() => { setStep(s => s - 1); setPlaying(false); }} aria-label="Previous step"><ChevronLeft size={16} /></button><button className="play-button" disabled={!result} onClick={() => { if (step === maxStep) setStep(0); setPlaying(!playing); }} aria-label={playing ? 'Pause journey' : 'Play journey'}>{playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button><button className="icon-button" disabled={!result || step >= maxStep} onClick={() => { setStep(s => s + 1); setPlaying(false); }} aria-label="Next step"><ChevronRight size={16} /></button></div><div className="timeline"><div style={{ width: `${step * 25}%` }} />{stageData.map((s, i) => <button key={s.title} disabled={i > maxStep} aria-label={`Jump to ${s.title}`} className={i <= step ? 'passed' : ''} onClick={() => { setStep(i); setPlaying(false); }} />)}</div><span className="step-counter mono">0{step + 1}<span> / 05</span></span><button className="speed-button mono" onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? .5 : 1)} aria-label="Change playback speed">{speed}×</button></div>
      <AnimatePresence>{guide && <motion.div className="journey-explanation" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}><div className="explanation-icon"><selected.icon size={16} /></div><p><strong>{selected.title}.</strong> {selected.description}</p><button className="text-button" onClick={() => setInspector(!inspector)}>{inspector ? 'Hide values' : 'Inspect values'} <ArrowUpRight size={13} /></button></motion.div>}</AnimatePresence>
      {inspector && <div className="inspector"><div className="eyebrow">ACTUAL RUN VALUES · {selected.title}</div><pre>{inspectValue}</pre></div>}
    </section>
    <div className="io-grid">
      <section className="panel input-panel"><div className="panel-top"><div className="tabs"><button className={inputTab === 'message' ? 'tab active' : 'tab'} onClick={() => setInputTab('message')}><MessageSquare size={15} />Your message</button><button className={inputTab === 'cipher' ? 'tab active' : 'tab'} onClick={() => setInputTab('cipher')}><LockKeyhole size={14} />Paste ciphertext</button></div><span className="mono input-format">{inputTab === 'message' ? 'UTF-8' : 'ENVELOPE'}</span></div>
        {inputTab === 'message' ? <><div className="input-area"><label className="sr-only" htmlFor="message">Message to encrypt</label><textarea id="message" value={message} disabled={busy} onChange={e => { invalidate(); setMessage(e.target.value); }} spellCheck={false} placeholder="What would you like to keep between us?" /><div className="input-meta"><button className="text-button" disabled={busy} onClick={() => { invalidate(); setMessage('Hello Bob. Meet me where the numbers end.'); }}><Sparkles size={12} /> Try an example</button><span className={`mono ${bytes.length > capacity ? 'danger-text' : ''}`}>{bytes.length} / {capacity} bytes</span></div></div><div className="input-toolbar"><div className="mode-select"><label htmlFor="padding">Padding</label><select id="padding" value={mode} disabled={busy} onChange={e => { invalidate(); setMode(e.target.value as Mode); }}><option value="oaep">OAEP · SHA-256</option><option value="textbook">Textbook · no padding</option></select></div><button className="primary-button" onClick={encrypt} disabled={!labKey || busy || props.generating || bytes.length > capacity}><LockKeyhole size={15} />{busy ? 'Computing…' : 'Encrypt message'}<ArrowRight size={15} /></button></div></> : <><div className="input-area"><label className="sr-only" htmlFor="cipher-envelope">Ciphertext envelope to decrypt</label><textarea className="envelope-input mono" id="cipher-envelope" value={envelope} disabled={busy} onChange={e => { run.current++; setEnvelope(e.target.value); setRecovered(undefined); setResult(undefined); setStep(0); setPlaying(false); }} placeholder="Paste a rsa-lab.v1: envelope created with the active key…" /><div className="input-meta"><span>Uses the active private key. Session keys are not persistent.</span></div></div><div className="input-toolbar"><span className="helper-text">Mode is read from the envelope.</span><button className="primary-button" onClick={decrypt} disabled={!labKey || !envelope || busy || props.generating}><UnlockKeyhole size={15} />Decrypt envelope<ArrowRight size={15} /></button></div></>}
      </section>
      <section className="panel output-panel"><div className="panel-top"><div className="tabs"><button className={outputTab === 'cipher' ? 'tab active' : 'tab'} onClick={() => setOutputTab('cipher')}><Fingerprint size={15} />Ciphertext{result && <span className="tab-dot" />}</button><button className={outputTab === 'recovered' ? 'tab active' : 'tab'} onClick={() => setOutputTab('recovered')}><UnlockKeyhole size={14} />Recovered</button></div>{outputTab === 'cipher' && result && <CopyButton value={result.envelope} label="Copy envelope" />}{outputTab === 'recovered' && recovered && <CopyButton value={recovered.message} />}</div>
        <div className="output-area">{outputTab === 'cipher' ? result ? <><div className="output-caption"><span className="status-dot" /> ENCRYPTION COMPLETE <span>{result.output_bytes} bytes · HEX PREVIEW</span></div><pre className="cipher-output">{result.cipher_hex.match(/.{1,2}/g)?.join(' ')}</pre><div className="output-meta"><span className="mono">{result.elapsed_ms.toFixed(3)} ms computation</span><span>{result.mode === 'oaep' ? 'Randomized with OAEP' : 'Deterministic · educational'}</span></div></> : <div className="empty-output"><div className="empty-output-icon"><Fingerprint size={32} strokeWidth={1} /></div><strong>A little mystery, waiting to happen.</strong><p>Your encrypted message will appear here.</p></div> : recovered ? <><div className="output-caption"><span className="status-dot" /> DECRYPTION COMPLETE <CheckCheck size={15} /></div><div className="recovered-message">{recovered.message || '(empty message)'}</div><div className="output-meta"><span className="mono">{recovered.elapsed_ms.toFixed(3)} ms computation</span><span>Recovered using the private key</span></div></> : <div className="empty-output"><UnlockKeyhole size={29} strokeWidth={1} /><strong>Bring your message back.</strong><p>Encrypt, then decrypt to recover the original.</p></div>}</div>
        <div className="output-toolbar"><span><ShieldCheck size={14} />{outputTab === 'recovered' && recovered ? 'Original bytes recovered' : result ? `${result.bits}-bit RSA · ${result.mode === 'oaep' ? 'OAEP-SHA256' : 'textbook'}` : 'Public key in. Ciphertext out.'}</span><button className="secondary-button" onClick={decrypt} disabled={!labKey || !envelope || busy || props.generating}><UnlockKeyhole size={14} />Decrypt<ArrowRight size={14} /></button></div>
      </section>
    </div>
    <div className={`insight-strip ${mode === 'textbook' ? 'warning-strip' : ''}`}><span className="insight-icon"><CircleHelp size={17} /></span><p><strong>{mode === 'oaep' ? 'Why does the ciphertext change every time?' : 'Textbook mode is a mathematical demonstration.'}</strong> {mode === 'oaep' ? 'OAEP adds fresh randomness before encryption. The same message takes a different path to the same destination.' : 'Identical messages produce identical ciphertexts. Raw RSA does not authenticate messages; explore OAEP to see why padding matters.'}</p><span className="insight-tag">THE MORE YOU KNOW</span></div>
  </>;
}

function KeyStudio(props: KeyControls & { history: LabKey[]; setKey: (key: LabKey) => void; setError: (error: string) => void }) {
  const { labKey, history, setKey, setError } = props;
  const [privateParts, setPrivateParts] = useState<Record<string, string>>();
  const [revealing, setRevealing] = useState(false);
  const [radix, setRadix] = useState<'decimal' | 'hex'>('decimal');
  useEffect(() => { setPrivateParts(undefined); }, [labKey?.id]);
  const format = (value: string) => radix === 'hex' ? '0x' + BigInt(value).toString(16) : value;
  async function reveal() {
    if (privateParts) { setPrivateParts(undefined); return; }
    if (!labKey) return;
    setRevealing(true);
    try { setPrivateParts(await api<Record<string, string>>(`/keys/${labKey.id}/reveal`, {})); }
    catch (e) { setError((e as Error).message); }
    finally { setRevealing(false); }
  }
  function download() {
    if (!labKey) return;
    const blob = new Blob([JSON.stringify({ format: 'rsa-lab-public-v1', n: labKey.n, e: labKey.e, bits: labKey.bits, fingerprint: labKey.fingerprint }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `rsa-${labKey.bits}-public.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  return <><KeyBar {...props} /><div className="studio-intro panel"><div className="studio-symbol"><KeyRound size={36} strokeWidth={1} /><span /><LockKeyhole size={30} strokeWidth={1} /></div><div><div className="eyebrow">ASYMMETRIC BY DESIGN</div><h2>Share one. Keep one.</h2><p>The public key encrypts. The private key decrypts. Both are connected by the same modulus.</p></div><div className="studio-fingerprint"><Fingerprint size={20} /><span className="mono">{labKey?.fingerprint ?? 'No key generated yet'}<small>KEY FINGERPRINT</small></span></div></div>
    <div className="studio-controls"><span>{labKey ? `Inspecting a ${labKey.bits}-bit modulus · ${labKey.candidates} candidates · ${labKey.elapsed_ms.toFixed(1)} ms generation` : 'Generate a key pair to inspect its components.'}</span><div className="segmented"><button className={radix === 'decimal' ? 'selected' : ''} onClick={() => setRadix('decimal')}>Decimal</button><button className={radix === 'hex' ? 'selected' : ''} onClick={() => setRadix('hex')}>Hex</button></div></div>
    <div className="io-grid key-grid"><section className="panel key-detail"><div className="panel-top"><div className="panel-title"><KeyRound size={17} /><h2>Public key</h2><span className="subtle-badge">SHAREABLE</span></div><button className="copy-button" disabled={!labKey} onClick={download}><Download size={14} />Export JSON</button></div><div className="key-detail-body">{labKey ? <><Value label="n · Modulus" value={format(labKey.n)} note={`${labKey.bits} bits · product of two private probable primes`} /><Value label="e · Public exponent" value={format(labKey.e)} note="65537 · efficient and widely used" /></> : <div className="empty-key"><KeyRound size={32} /><p>The public side of your key pair will appear here.</p></div>}</div></section>
    <section className="panel key-detail private-panel"><div className="panel-top"><div className="panel-title"><LockKeyhole size={17} /><h2>Private components</h2><span className="subtle-badge amber-badge">KEEP SECRET</span></div><button className="copy-button" onClick={reveal} disabled={!labKey || revealing}>{privateParts ? <EyeOff size={14} /> : <Eye size={14} />}{revealing ? 'Loading…' : privateParts ? 'Hide' : 'Reveal'}</button></div><div className="key-detail-body">{privateParts ? <>{[['p', 'First probable prime'], ['q', 'Second probable prime'], ['d', 'Private exponent'], ['phi', 'Euler’s totient'], ['lambda', 'Carmichael’s function']].map(([name, note]) => <Value key={name} label={`${name} · ${note}`} value={format(privateParts[name])} privateValue />)}</> : <div className="empty-key secret-placeholder"><div className="private-lock"><LockKeyhole size={25} /></div><strong>Some numbers are just for you.</strong><p>Reveal p, q, and d to study the mathematics.<br />These values expose the private key.</p><span className="mono">•••• •••• •••• ••••</span></div>}</div></section></div>
    {history.length > 0 && <section className="panel history-panel"><div className="panel-top"><div className="panel-title"><Activity size={16} /><h2>Session key history</h2></div><span className="helper-text">Last 8 keys · memory only</span></div>{history.slice().reverse().map(k => <button className={`history-row ${k.id === labKey?.id ? 'selected-history' : ''}`} key={k.id} onClick={() => setKey(k)}><span className="mono">{k.fingerprint}</span><span>{k.bits} bit</span><span className="mono">{k.elapsed_ms.toFixed(1)} ms</span><span>{k.id === labKey?.id ? <><Check size={14} /> Active</> : <>Use key <ArrowRight size={14} /></>}</span></button>)}</section>}
  </>;
}

const mathSteps = [
  { title: 'Choose two primes', formula: 'p = 61      q = 53', detail: 'Start with two distinct prime numbers. Real keys use much larger probable primes; these tiny values are intentionally easy to follow.', result: '61 × 53 = 3233', label: 'THE TWO BUILDING BLOCKS' },
  { title: 'Build the modulus', formula: 'n = p × q = 3233', detail: 'The modulus connects both keys. Multiplying the primes is straightforward; recovering the primes from a sufficiently large modulus is the difficult direction.', result: 'n = 3233', label: 'THE SHARED MODULUS' },
  { title: 'Calculate the totient', formula: 'φ(n) = (61 − 1)(53 − 1)', detail: 'For two distinct primes, Euler’s totient is (p − 1)(q − 1). It counts the positive integers below n that are coprime to n.', result: 'φ(n) = 60 × 52 = 3120', label: 'THE NUMBER THEORY' },
  { title: 'Choose the exponents', formula: 'e = 17      d = 2753', detail: 'Choose e coprime to φ(n). Find its modular inverse d, so e × d ≡ 1 mod φ(n). Our real-key engine uses e = 65537 and an inverse modulo Carmichael’s λ(n).', result: '17 × 2753 = 46801 = 15 × 3120 + 1', label: 'THE CONNECTED EXPONENTS' },
  { title: 'Encrypt the message', formula: 'c = 65¹⁷ mod 3233', detail: 'The integer 65 represents the ASCII byte for A. Encrypt using only the public key (3233, 17). Modular exponentiation keeps every intermediate value manageable.', result: 'c = 2790', label: 'THE PUBLIC OPERATION' },
  { title: 'Recover the original', formula: 'm = 2790²⁷⁵³ mod 3233', detail: 'The private exponent reverses the RSA operation. The recovered integer is 65, which decodes to A. You have completed a full textbook RSA round trip.', result: 'm = 65 → “A”', label: 'THE PRIVATE OPERATION' },
];
function MathExplorer() {
  const [index, setIndex] = useState(0);
  const [toy, setToy] = useState('65');
  const [traceOpen, setTraceOpen] = useState(false);
  const step = mathSteps[index];
  const valid = /^\d{1,4}$/.test(toy) && Number(toy) < 3233;
  const steps: { bit: string; square: string; multiply: string; value: string }[] = [];
  let value = 1n;
  const message = valid ? BigInt(toy) : 65n;
  for (const bit of '10001') {
    const square = (value * value) % 3233n;
    const next = bit === '1' ? square * message % 3233n : square;
    steps.push({ bit, square: `${value}² mod 3233 = ${square}`, multiply: bit === '1' ? `× ${message} mod 3233` : 'No multiply', value: String(next) });
    value = next;
  }
  let recovered = 1n, base = value, exponent = 2753n;
  while (exponent > 0n) { if (exponent & 1n) recovered = recovered * base % 3233n; base = base * base % 3233n; exponent >>= 1n; }
  return <><div className="learning-layout"><section className="panel learning-steps"><div className="panel-top"><div className="panel-title"><GitBranch size={16} /><h2>One complete example</h2></div></div>{mathSteps.map((s, i) => <button key={s.title} className={`math-step ${i === index ? 'selected-math' : ''}`} onClick={() => setIndex(i)}><span className="math-step-number mono">{i < index ? <Check size={14} /> : `0${i+1}`}</span><span>{s.title}<small>{i < 4 ? 'KEY GENERATION' : i === 4 ? 'ENCRYPTION' : 'DECRYPTION'}</small></span><ChevronRight size={15} /></button>)}<div className="toy-label"><FlaskConical size={15} /> Tiny teaching key · 12-bit modulus</div></section>
      <section className="panel math-canvas"><div className="math-grid" /><AnimatePresence mode="wait"><motion.div key={index} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="math-content"><div className="eyebrow">{step.label}</div><div className="math-display">{step.formula}</div><div className="math-result mono">{step.result}</div><h2>{step.title}</h2><p>{step.detail}</p></motion.div></AnimatePresence><div className="math-pagination"><button className="text-button" disabled={index === 0} onClick={() => setIndex(i => i-1)}><ArrowLeft size={15} />Previous</button><span className="mono">0{index+1} / 06</span><button className="text-button aqua-text" disabled={index === 5} onClick={() => setIndex(i => i+1)}>Next step<ArrowRight size={15} /></button></div></section></div>
      <section className="panel toy-workbench"><div className="panel-top"><div className="panel-title"><MousePointer2 size={16} /><h2>Change the message. See the mathematics.</h2></div><span className="subtle-badge">INTERACTIVE</span></div><div className="toy-controls"><div><label htmlFor="toy-message">Your message integer</label><input id="toy-message" value={toy} inputMode="numeric" onChange={e => setToy(e.target.value)} aria-invalid={!valid} /><small>{valid ? 'Choose an integer from 0 to 3232.' : 'Enter a whole number between 0 and 3232.'}</small></div><ArrowRight className="toy-arrow" size={22} /><div className="toy-result"><small>CIPHERTEXT</small><strong className="mono">{valid ? String(value) : '—'}</strong><span>m¹⁷ mod 3233</span></div><ArrowRight className="toy-arrow" size={22} /><div className="toy-result recovered-toy"><small>RECOVERED INTEGER</small><strong className="mono">{valid ? String(recovered) : '—'}</strong><span>c²⁷⁵³ mod 3233</span></div><button className="secondary-button" onClick={() => setTraceOpen(!traceOpen)}>{traceOpen ? 'Hide' : 'Show'} exponentiation<ChevronDown size={14} /></button></div>{traceOpen && <div className="trace-table"><p>Square-and-multiply · exponent 17 = binary 10001 · read left to right</p><table><thead><tr><th>Bit</th><th>Square</th><th>Multiply if bit is 1</th><th>Accumulator</th></tr></thead><tbody>{steps.map((s, i) => <tr key={i}><td>{s.bit}</td><td>{s.square}</td><td>{s.multiply}</td><td>{s.value}</td></tr>)}</tbody></table></div>}</section>
      <div className="insight-strip"><CircleHelp size={20} /><p><strong>Small enough to understand. Too small to protect anything.</strong> This example demonstrates RSA’s mathematics. The Workbench generates the actual 1024-bit and 2048-bit keys required for the project.</p></div>
  </>;
}

type CompareResult = { mode: Mode; first: CipherResult; second: CipherResult; recovered: boolean };
function Experiments({ labKey, generating, createKey, history, setError }: { labKey?: LabKey; generating: boolean; createKey: () => Promise<void>; history: LabKey[]; setError: (v: string) => void }) {
  const [message, setMessage] = useState('The same message. A different mystery.');
  const [busy, setBusy] = useState(false);
  const [comparison, setComparison] = useState<CompareResult[]>([]);
  const [bench, setBench] = useState<{ encrypt: number[]; decrypt: number[]; bits: number; fingerprint: string }>();
  const version = useRef(0);
  useEffect(() => { version.current++; setComparison([]); setBench(undefined); }, [labKey?.id]);
  useEffect(() => () => { version.current++; }, []);
  async function compare() {
    if (!labKey) return;
    const id = ++version.current;
    setBusy(true); setError(''); setComparison([]);
    try {
      const results: CompareResult[] = [];
      for (const mode of ['textbook', 'oaep'] as Mode[]) {
        const first = await api<CipherResult>('/encrypt', { key_id: labKey.id, message, mode });
        const second = await api<CipherResult>('/encrypt', { key_id: labKey.id, message, mode });
        const recovered = await api<Recovered>('/decrypt', { key_id: labKey.id, envelope: second.envelope });
        results.push({ mode, first, second, recovered: recovered.message === message });
      }
      if (id === version.current) setComparison(results);
    } catch (e) { if (id === version.current) setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function benchmark() {
    if (!labKey) return;
    const id = ++version.current;
    setBusy(true); setError('');
    try {
      const encrypt: number[] = [], decrypt: number[] = [];
      for (let i = 0; i < 6; i++) {
        const c = await api<CipherResult>('/encrypt', { key_id: labKey.id, message: 'RSA Lab benchmark', mode: 'oaep' });
        const m = await api<Recovered>('/decrypt', { key_id: labKey.id, envelope: c.envelope });
        if (i > 0) { encrypt.push(c.elapsed_ms); decrypt.push(m.elapsed_ms); }
      }
      if (id === version.current) setBench({ encrypt, decrypt, bits: labKey.bits, fingerprint: labKey.fingerprint });
    } catch (e) { if (id === version.current) setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function median(values: number[]) { return [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)]; }
  function exportBench() {
    if (!bench) return;
    const blob = new Blob([JSON.stringify({ ...bench, backend: 'Custom Python RSA + OAEP-SHA256', samples: 5, warmup: 1, units: 'ms', browser: navigator.userAgent, note: 'API computation time; excludes network, animation, and rendering. Single key; not a cross-machine study.' }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rsa-lab-benchmark.json'; a.click(); URL.revokeObjectURL(a.href);
  }
  return <>
    <div className="experiment-context"><span><span className={`status-dot ${!labKey ? 'offline' : ''}`} />{labKey ? `Active key: RSA-${labKey.bits} · ${labKey.fingerprint.slice(0, 8)}` : 'Generate a key before running an experiment.'}</span>{!labKey && <button className="secondary-button" disabled={generating} onClick={createKey}>{generating ? 'Generating…' : 'Generate key pair'}<Plus size={14} /></button>}</div>
    <section className="panel experiment-panel"><div className="experiment-heading"><span className="experiment-number mono">EXPERIMENT / 01</span><span className="subtle-badge">PADDING & RANDOMNESS</span><h2>Same message. Same key.<br /><span>Same ciphertext?</span></h2><p>Encrypt twice with each mode, then compare the results.</p></div><div className="experiment-input"><label className="sr-only" htmlFor="experiment-message">Experiment message</label><input id="experiment-message" value={message} disabled={busy} onChange={e => { setMessage(e.target.value); setComparison([]); }} /><button className="primary-button" onClick={compare} disabled={!labKey || busy || generating}><Play size={14} />{busy ? 'Computing…' : 'Run experiment'}</button></div><div className="comparison-grid">{(['textbook', 'oaep'] as Mode[]).map(mode => {
      const result = comparison.find(r => r.mode === mode);
      const equal = result?.first.cipher_hex === result?.second.cipher_hex;
      return <div key={mode} className={`comparison-card ${mode === 'oaep' ? 'oaep-comparison' : ''}`}><div className="comparison-title"><h3>{mode === 'oaep' ? 'RSA + OAEP' : 'Textbook RSA'}</h3><span>{mode === 'oaep' ? 'RANDOMIZED' : 'DETERMINISTIC'}</span></div><div className="comparison-run"><span>RUN 01</span><code>{result ? result.first.cipher_hex.slice(0, 48) + '…' : 'Waiting for your experiment'}</code></div><div className="comparison-run"><span>RUN 02</span><code>{result ? result.second.cipher_hex.slice(0, 48) + '…' : 'Waiting for your experiment'}</code></div><div className="comparison-verdict">{result ? <><span>{equal ? <Layers size={17} /> : <Sparkles size={17} />}{equal ? 'Identical ciphertexts' : 'Different ciphertexts'}</span><small>{result.recovered ? 'Second ciphertext decrypted correctly' : 'Recovery failed'}</small></> : <span>{mode === 'oaep' ? 'Will fresh randomness change the result?' : 'What do you predict?'}</span>}</div></div>;
    })}</div><div className="experiment-takeaway"><CircleHelp size={17} /><p>{comparison.length ? 'Textbook RSA exposes repeated messages. OAEP adds randomness before the RSA operation, so repeated messages produce different ciphertexts. The private key can still recover the original.' : 'Make a prediction first. Both modes use the same real key and the same message; only the encoding changes.'}</p></div></section>
    <section className="panel benchmark-panel"><div className="panel-top"><div className="panel-title"><Activity size={16} /><h2>How much work does RSA do?</h2></div><button className="secondary-button" onClick={benchmark} disabled={!labKey || busy || generating}><Cpu size={14} />Measure active key</button></div><div className="benchmark-body"><div><div className="eyebrow">EXPERIMENT / 02</div><h3>Measure it. Don’t guess.</h3><p>Five measured OAEP operations after one warm-up. Times come from the Python engine and exclude the network and animation.</p>{bench && <><div className="benchmark-meta mono">RSA-{bench.bits} · median · 5 samples · custom engine</div><div className="benchmark-bar"><span>Encrypt</span><div><i style={{ width: `${Math.max(2, median(bench.encrypt) / median(bench.decrypt) * 100)}%` }} /></div><strong className="mono">{median(bench.encrypt).toFixed(3)} ms</strong></div><div className="benchmark-bar"><span>Decrypt</span><div><i style={{ width: '100%' }} /></div><strong className="mono">{median(bench.decrypt).toFixed(3)} ms</strong></div><p className="benchmark-range">Encryption range {Math.min(...bench.encrypt).toFixed(3)}–{Math.max(...bench.encrypt).toFixed(3)} ms · Decryption range {Math.min(...bench.decrypt).toFixed(3)}–{Math.max(...bench.decrypt).toFixed(3)} ms</p><button className="text-button aqua-text" onClick={exportBench}><Download size={14} />Export measurements</button></>}</div><div className="generation-history"><h4>Key generation · this session</h4>{history.length ? history.slice(-5).map((k, i) => <div key={k.id}><span className="mono">0{i+1}</span><strong>{k.bits} bit</strong><span className="mono">{k.elapsed_ms.toFixed(1)} ms</span></div>) : <p>Generate keys in Key Studio to record their actual generation times.</p>}<small>Single-run observations, not a controlled comparison across key sizes.</small></div></div></section>
  </>;
}

export default App;
