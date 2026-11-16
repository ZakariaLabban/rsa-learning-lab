import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Save, Sparkles } from 'lucide-react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { LectureExampleButton } from '../../components/LectureExampleButton';
import { Term } from '../../components/Term';
import { Value } from '../../components/Value';
import { generateKey, privateKeyFor } from '../../engine/client';
import { bitLength, lcm } from '../../engine/math';
import { keyring } from '../../keyring';
import { EuclidTable } from '../euclid/EuclidTable';
import { euclidInverse, parseWhole } from '../euclid/euclidModel';
import {
  buildKey,
  exponentProblem,
  isTeaching,
  REAL_SIZES,
  suggestExponents,
  TEACHING_SIZES,
  typedPrimesProblem,
  type WizardSize,
} from './wizardModel';

type Generated = { p: bigint; q: bigint; bits: WizardSize; candidates: number };

/** Key Generation Wizard (#10): the Ch 9 RSA key setup, step by step, saved to the keyring. */
export function KeyWizard() {
  const [source, setSource] = useState<'generate' | 'type'>('generate');
  const [size, setSize] = useState<WizardSize>(16);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [typedP, setTypedP] = useState('17');
  const [typedQ, setTypedQ] = useState('11');
  const [eInput, setEInput] = useState('7');
  const [revealed, setRevealed] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  async function generate() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setGenerating(true);
    setProgress(0);
    setError('');
    setStatus('');
    try {
      const result = await generateKey(size, {
        signal: controller.signal,
        onProgress: (p) => setProgress(p.candidates),
      });
      const key = privateKeyFor(result.id);
      setGenerated({ p: key.p, q: key.q, bits: size, candidates: result.candidates });
      setEInput(isTeaching(size) ? String(key.e) : '65537');
      setRevealed(false);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (abort.current === controller) {
        abort.current = null;
        setGenerating(false);
      }
    }
  }
  function stop() {
    abort.current?.abort();
    abort.current = null;
    setGenerating(false);
  }

  // Step 1: p and q, from the generator or typed by the user.
  let p: bigint | null = null,
    q: bigint | null = null,
    primesProblem = '';
  if (source === 'generate') {
    if (generated) ({ p, q } = generated);
  } else {
    try {
      const tp = parseWhole(typedP, 'p'),
        tq = parseWhole(typedQ, 'q');
      primesProblem = typedPrimesProblem(tp, tq) ?? '';
      if (!primesProblem) [p, q] = [tp, tq];
    } catch (e) {
      primesProblem = (e as Error).message;
    }
  }
  const n = p !== null && q !== null ? p * q : null;
  const phi = p !== null && q !== null ? (p - 1n) * (q - 1n) : null;
  const bits = n === null ? 0 : bitLength(n);
  const teaching = isTeaching(bits);

  // Step 4: e (fixed 65537 for real keys).
  let e: bigint | null = null,
    eProblem = '';
  if (phi !== null) {
    try {
      const value = teaching ? parseWhole(eInput, 'e') : 65537n;
      eProblem = exponentProblem(value, phi) ?? '';
      if (!eProblem) e = value;
    } catch (err) {
      eProblem = (err as Error).message;
    }
  }
  const euclid = e !== null && phi !== null ? euclidInverse(e, phi, 12) : null;
  const built = p !== null && q !== null && e !== null ? buildKey(p, q, e) : null;
  const key = built?.key;

  async function save() {
    if (!key) return;
    setError('');
    try {
      const entry = await keyring.addMine(key, name.trim() || `My ${bits}-bit key`);
      keyring.setActive(entry.id);
      setStatus(`Saved “${entry.name}” to your keyring. It is now your active key.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const changedInput = () => {
    setRevealed(false);
    setStatus('');
  };

  return (
    <section className="panel wizard-panel" aria-labelledby="wizard-title">
      <div className="panel-top">
        <div className="panel-title">
          <Sparkles size={17} />
          <h2 id="wizard-title">Create a key, step by step</h2>
          <span className="subtle-badge">CH 9 · RSA KEY SETUP</span>
        </div>
      </div>
      <div className="wizard-body">
        <div className="wizard-intro">
          <p className="helper-text">
            Follow the lecture’s recipe: two primes → n and φ(n) → e → d. Small teaching keys let
            you check every number by hand; 1024/2048-bit keys are the real thing.
          </p>
          <LectureExampleButton
            label="Load lecture example (p=17, q=11, e=7)"
            onLoad={() => {
              stop();
              setSource('type');
              setTypedP('17');
              setTypedQ('11');
              setEInput('7');
              changedInput();
            }}
          />
        </div>
        <ErrorBanner message={error} onDismiss={() => setError('')} />

        <article className="wizard-step">
          <h3>
            <span className="step-number">1</span> Choose two primes p and q
          </h3>
          <div className="wizard-source" role="radiogroup" aria-label="Where p and q come from">
            {(
              [
                ['generate', 'Generate p and q for me'],
                ['type', 'Type my own p and q'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="wizard-radio">
                <input
                  type="radio"
                  name="prime-source"
                  checked={source === value}
                  onChange={() => {
                    setSource(value);
                    changedInput();
                  }}
                />
                {label}
              </label>
            ))}
          </div>

          {source === 'generate' ? (
            <>
              <fieldset className="size-options">
                <legend>Key size (bits of n)</legend>
                {[...TEACHING_SIZES, ...REAL_SIZES].map((value) => (
                  <label key={value} className="wizard-radio">
                    <input
                      type="radio"
                      name="key-size"
                      checked={size === value}
                      disabled={generating}
                      onChange={() => setSize(value)}
                    />
                    {value} bits
                    <small>
                      {isTeaching(value)
                        ? 'teaching'
                        : value === 1024
                          ? 'assignment only'
                          : 'recommended'}
                    </small>
                  </label>
                ))}
              </fieldset>
              <div className="wizard-actions">
                <button className="primary-button" disabled={generating} onClick={generate}>
                  <KeyRound size={15} /> Generate p and q
                </button>
                {generating && (
                  <>
                    <span className="helper-text" role="status">
                      Finding probable primes · {progress} candidates tried
                    </span>
                    <button className="text-button" onClick={stop}>
                      Stop searching
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="wizard-typed">
              <div className="encrypt-field">
                <label htmlFor="typed-p">p</label>
                <input
                  id="typed-p"
                  className="mono"
                  inputMode="numeric"
                  value={typedP}
                  onChange={(event) => {
                    setTypedP(event.target.value);
                    changedInput();
                  }}
                />
              </div>
              <div className="encrypt-field">
                <label htmlFor="typed-q">q</label>
                <input
                  id="typed-q"
                  className="mono"
                  inputMode="numeric"
                  value={typedQ}
                  onChange={(event) => {
                    setTypedQ(event.target.value);
                    changedInput();
                  }}
                />
              </div>
              <span className="helper-text">Distinct primes; n = p × q at most 64 bits.</span>
            </div>
          )}
          {primesProblem && <p className="encrypt-problem">{primesProblem}</p>}

          {source === 'generate' && p !== null && q !== null && (
            <div className="step-values">
              <Value label="p" value={String(p)} />
              <Value label="q" value={String(q)} />
            </div>
          )}
          {source === 'generate' && generated && (
            <details className="wizard-how">
              <summary>How were p and q generated?</summary>
              <ol>
                <li>Pick a random odd number with the right number of bits.</li>
                <li>
                  Quick check: divide it by small primes (3, 5, 7, …); most candidates fail here.
                </li>
                <li>
                  Run the <Term term="probablePrime" /> test: 64 rounds of Miller–Rabin with random
                  bases.
                </li>
                <li>If any check fails, try the next random number. Repeat for q.</li>
              </ol>
              <p className="helper-text">
                This search tried {generated.candidates} candidates in total.{' '}
                <Link to="/learn/miller-rabin">See the Miller–Rabin test step by step</Link>.
              </p>
            </details>
          )}
        </article>

        {n !== null && phi !== null && p !== null && q !== null && (
          <>
            <article className="wizard-step">
              <h3>
                <span className="step-number">2</span> Compute the <Term term="modulus" /> n = p × q
              </h3>
              <Value
                label={`n (${bits} bits)`}
                value={String(n)}
                note="Public: part of both keys"
              />
            </article>

            <article className="wizard-step">
              <h3>
                <span className="step-number">3</span> Compute φ(n) = (p − 1)(q − 1)
              </h3>
              <Value
                label="φ(n)"
                value={String(phi)}
                note={`(${p} − 1) × (${q} − 1) · secret: knowing φ(n) reveals d`}
              />
            </article>

            <article className="wizard-step">
              <h3>
                <span className="step-number">4</span> Choose e with gcd(e, φ(n)) = 1
              </h3>
              {teaching ? (
                <>
                  <div className="encrypt-field wizard-e">
                    <label htmlFor="wizard-e">e (public exponent)</label>
                    <input
                      id="wizard-e"
                      className="mono"
                      inputMode="numeric"
                      value={eInput}
                      onChange={(event) => {
                        setEInput(event.target.value);
                        changedInput();
                      }}
                    />
                  </div>
                  <div className="e-suggestions" aria-label="Valid choices of e">
                    <span className="helper-text">Valid choices:</span>
                    {suggestExponents(phi).map((value) => (
                      <button
                        key={String(value)}
                        className="keyring-badge"
                        onClick={() => {
                          setEInput(String(value));
                          changedInput();
                        }}
                      >
                        {String(value)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="helper-text">
                  Real keys use the standard e = 65537 (2¹⁶ + 1): fast to compute with, and the
                  primes were chosen so that gcd(65537, φ(n)) = 1.
                </p>
              )}
              {eProblem && <p className="encrypt-problem">{eProblem}</p>}
            </article>
          </>
        )}

        {euclid && key && built && phi !== null && n !== null && e !== null && (
          <>
            <article className="wizard-step">
              <h3>
                <span className="step-number">5</span> Find d = e⁻¹ mod φ(n) with Extended Euclid
              </h3>
              <EuclidTable result={euclid} caption={`Inverse of e = ${e} mod φ(n)`} />
              <p className="mono wizard-check">
                d = {String(key.d).length > 40 ? `${String(key.d).slice(0, 20)}…` : String(key.d)} ·
                check: e × d mod φ(n) = {String((e * key.d) % phi)}
              </p>
              <p className="helper-text">
                <Link to={`/learn/euclid?a=${e}&m=${phi}`}>Open this in Extended Euclid</Link>. Side
                note: many libraries use λ(n) = lcm(p − 1, q − 1) ={' '}
                {String(lcm(key.p - 1n, key.q - 1n)).slice(0, 24)}
                {String(lcm(key.p - 1n, key.q - 1n)).length > 24 ? '…' : ''} instead of φ(n), giving
                d = {String(built.dLambda).slice(0, 24)}
                {String(built.dLambda).length > 24 ? '…' : ''}. Both decrypt correctly.
              </p>
            </article>

            <article className="wizard-step">
              <h3>
                <span className="step-number">6</span> Your keys
              </h3>
              <p className="helper-text">
                Your <Term term="publicKey" /> is PU = {'{'}e, n{'}'}; give it to anyone. Your{' '}
                <Term term="privateKey" /> is PR = {'{'}d, n{'}'}; never share it.
              </p>
              <div className="key-pair-cards">
                <div className="key-pair-card">
                  <span className="eyebrow">PUBLIC KEY · SHARE IT</span>
                  <p className="mono key-pair-value">
                    PU = {'{'}
                    {String(e)}, {String(n).length > 30 ? `${String(n).slice(0, 24)}…` : String(n)}
                    {'}'}
                  </p>
                </div>
                <div className="key-pair-card private">
                  <span className="eyebrow">PRIVATE KEY · KEEP IT SECRET</span>
                  <p className="mono key-pair-value">
                    PR = {'{'}
                    {revealed
                      ? String(key.d).length > 30
                        ? `${String(key.d).slice(0, 24)}…`
                        : String(key.d)
                      : '•••'}
                    , {String(n).length > 30 ? `${String(n).slice(0, 24)}…` : String(n)}
                    {'}'}
                  </p>
                  <button className="text-button" onClick={() => setRevealed(!revealed)}>
                    {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    {revealed ? 'Hide private key' : 'Reveal private key'}
                  </button>
                  {revealed && <Value label="d" value={String(key.d)} privateValue />}
                </div>
              </div>
              <div className="wizard-save">
                <div className="encrypt-field">
                  <label htmlFor="wizard-name">Name</label>
                  <input
                    id="wizard-name"
                    value={name}
                    maxLength={60}
                    placeholder={`My ${bits}-bit key`}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <button className="primary-button" onClick={save}>
                  <Save size={15} /> Save to my keyring
                </button>
              </div>
              {status && (
                <p className="keyring-status" role="status">
                  {status} <Link to="/learn/encrypt">Encrypt a message with it →</Link>
                </p>
              )}
            </article>
          </>
        )}
      </div>
    </section>
  );
}
