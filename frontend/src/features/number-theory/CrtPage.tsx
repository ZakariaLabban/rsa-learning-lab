import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { generateKey, privateKeyFor } from '../../engine/client';
import type { PrivateKey } from '../../engine/math';
import { useKeyring } from '../../keyring';
import { Value } from '../../components/Value';
import { IntegerField, LessonTable, WorkStatus } from './LessonParts';
import { useLesson } from './useLesson';

export function CrtPage() {
  const [moduli, setModuli] = useState('37, 49'),
    [residues, setResidues] = useState('23, 34'),
    [a, setA] = useState('1651');
  const calculator = useLesson('crt'),
    value = calculator.result;
  const state = useKeyring();
  const [selected, setSelected] = useState('');
  const [generated, setGenerated] = useState<{ key: PrivateKey; bits: number } | null>(null);
  const own = state.entries.filter((entry) => entry.privateKey);
  const entry =
    own.find((key) => key.id === selected) ??
    (!selected
      ? (own.find((key) => key.id === state.activeId) ?? own.find((key) => key.id === 'demo-alice'))
      : undefined);
  const privateKey = selected === '__generated__' ? generated?.key : entry?.privateKey;
  const selectedId = selected === '__generated__' ? '__generated__' : (entry?.id ?? '');
  const [message, setMessage] = useState('88'),
    [revealed, setRevealed] = useState(false);
  const comparison = useLesson('benchmark'),
    bench = comparison.result;
  const [generating, setGenerating] = useState(false),
    [generationError, setGenerationError] = useState('');
  const [candidates, setCandidates] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  // Results are tied to the key actually measured, even if it is deleted while this page is open.
  const [measuredKey, setMeasuredKey] = useState<PrivateKey | null>(null);
  function clearComparison() {
    comparison.reset();
    setRevealed(false);
    setMeasuredKey(null);
  }
  async function generate(bits: 1024 | 2048) {
    clearComparison();
    setGenerating(true);
    setGenerationError('');
    setCandidates(0);
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    try {
      const key = await generateKey(bits, {
        signal: abort.signal,
        onProgress: (progress) => {
          if (!abort.signal.aborted) setCandidates(progress.candidates);
        },
      });
      if (!abort.signal.aborted) {
        setGenerated({ key: privateKeyFor(key.id), bits });
        setSelected('__generated__');
      }
    } catch (error) {
      if (!abort.signal.aborted) setGenerationError((error as Error).message);
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setGenerating(false);
      }
    }
  }
  return (
    <div className="feature-page math-lessons">
      <div className="page-heading">
        <h1>Chinese remainder theorem.</h1>
      </div>
      <section className="panel feature-body">
        <h2>One number, several residues</h2>
        <p>
          For pairwise-coprime moduli m_i, CRT reconstructs a unique residue A modulo N = ∏m_i.
          Moduli need not be prime: the lecture example uses 37 and 49, with N = 1813.
        </p>
        <IntegerField
          label="CRT moduli (comma separated)"
          value={moduli}
          onChange={(next) => {
            setModuli(next);
            calculator.reset();
          }}
        />
        <IntegerField
          label="Number A"
          value={a}
          onChange={(next) => {
            setA(next);
            calculator.reset();
          }}
        />
        <IntegerField
          label="CRT residues (comma separated)"
          value={residues}
          onChange={(next) => {
            setResidues(next);
            calculator.reset();
          }}
        />
        <div className="feature-actions">
          <button
            className="primary-button"
            disabled={calculator.busy}
            onClick={() => calculator.run({ moduli, residues, value: a, direction: 'split' })}
          >
            A → residues
          </button>
          <button
            className="secondary-button"
            disabled={calculator.busy}
            onClick={() => calculator.run({ moduli, residues, value: a, direction: 'combine' })}
          >
            Residues → A
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setModuli('37, 49');
              setResidues('23, 34');
              setA('1651');
              calculator.reset();
            }}
          >
            Load 1813 example
          </button>
        </div>
        <WorkStatus {...calculator} />
        {value && (
          <div className="feature-result">
            <p className="lesson-answer" role="status">
              A ≡ {String(value.value)} (mod {String(value.modulus)}) ↔ (
              {value.residues.map(String).join(', ')})
            </p>
            {value.original !== null && (
              <p>
                Input A = {String(value.original)}; the reconstruction is its canonical residue in
                0…N−1.
              </p>
            )}
            <LessonTable caption="CRT reconstruction · lecture sum formula">
              <thead>
                <tr>
                  {['m_i', 'a_i', 'N_i = N/m_i', 'y_i = N_i⁻¹ mod m_i', 'a_i N_i y_i'].map(
                    (label) => (
                      <th scope="col" key={label}>
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {value.rows.map((row, index) => (
                  <tr key={index}>
                    {[row.modulus, row.residue, row.partial, row.coefficient, row.term].map(
                      (cell, col) => (
                        <td className="mono" key={col}>
                          {String(cell)}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </LessonTable>
            <Value
              label="A = Σ a_i N_i y_i mod N"
              value={`${value.rows.map((row) => String(row.term)).join(' + ')} mod ${value.modulus} = ${value.value}`}
            />
            <button
              className="secondary-button"
              onClick={() => {
                setResidues(value.residues.map(String).join(', '));
                setA(String(value.value));
              }}
            >
              Use these canonical values in the inputs
            </button>
          </div>
        )}
        <p className="helper-text">
          Lecture example: 973 ↔ (11,42), 678 ↔ (12,41); adding gives 1651 ↔ (23,34), modulo
          37×49=1813. Up to 8 moduli, each at most 128 bits. Negative residues and A are normalized.
        </p>
      </section>
      <section className="panel feature-body">
        <h2>Alice’s private decryption: ordinary RSA versus CRT</h2>
        <p>
          Both methods recover the same M from the same C. Ordinary RSA computes C^d mod n. CRT
          computes two smaller powers modulo p and q, then recombines them. This panel requires
          Alice’s private key, including p and q; a contact’s public key is insufficient.
        </p>
        <fieldset className="feature-fields" disabled={comparison.busy || generating}>
          <legend>Private-key experiment</legend>
          <label>
            Alice’s private key
            <select
              aria-label="Alice’s private key"
              value={selectedId}
              onChange={(event) => {
                setSelected(event.target.value);
                clearComparison();
              }}
            >
              <option value="">Choose a private key…</option>
              {own.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.name} · {key.bits}-bit
                  {key.source === 'demo' ? ' · public demo private key' : ''}
                </option>
              ))}
              {generated && (
                <option value="__generated__">
                  Generated {generated.bits}-bit benchmark key · tab only
                </option>
              )}
            </select>
          </label>
          <IntegerField
            label="Message M for decryption comparison"
            value={message}
            onChange={(next) => {
              setMessage(next);
              clearComparison();
            }}
          />
          <div className="feature-actions">
            <button
              className="primary-button"
              disabled={!privateKey}
              onClick={() => {
                if (!privateKey) return;
                setRevealed(false);
                setMeasuredKey(privateKey);
                comparison.run({ key: privateKey, message });
              }}
            >
              Compare RSA decryption
            </button>
            <button className="secondary-button" onClick={() => void generate(1024)}>
              Generate 1024-bit benchmark key
            </button>
            <button className="secondary-button" onClick={() => void generate(2048)}>
              Generate 2048-bit benchmark key
            </button>
          </div>
        </fieldset>
        <WorkStatus {...comparison} />
        {generating && (
          <p role="status">
            Generating benchmark key · {candidates} candidates{' '}
            <button className="secondary-button" onClick={() => controller.current?.abort()}>
              Cancel benchmark key generation
            </button>
          </p>
        )}
        {generationError && <p role="alert">{generationError}</p>}
        {bench && measuredKey && (
          <div className="feature-result" aria-label="RSA decryption comparison">
            <p>
              Measured {bench.bits}-bit key. Raw textbook RSA is used only to compare arithmetic;
              this is not file encryption or a production security benchmark.
            </p>
            <Value label="Public ciphertext C = M^e mod n" value={String(bench.ciphertext)} />
            <div className="lesson-comparison">
              <div>
                <h3>Ordinary RSA</h3>
                <p>C^d mod n</p>
                <p className="mono">M = {String(bench.direct)}</p>
                <p>Median: {bench.directMedian.toFixed(3)} ms</p>
              </div>
              <div>
                <h3>CRT RSA</h3>
                <p>Two powers + recombination</p>
                <p className="mono">M = {String(bench.crt)}</p>
                <p>Median: {bench.crtMedian.toFixed(3)} ms</p>
              </div>
            </div>
            <p className="lesson-answer" role="status">
              Both routes agree: M = {String(bench.message)}.
            </p>
            <p className="helper-text">
              Five samples per method after discarding one warm-up pair, alternating execution
              order. Every pair is checked for equality. Worker computation times exclude key
              generation, encryption, animation and rendering. CRT is often faster for large keys,
              but browser/JIT noise can reverse a short measurement. A rounded 0.000 ms is below
              timer resolution, not zero work.
            </p>
            <details>
              <summary>Show recorded timing samples (ms)</summary>
              <p className="mono">
                Ordinary: {bench.directTimes.map((t) => t.toFixed(3)).join(', ')}
              </p>
              <p className="mono">CRT: {bench.crtTimes.map((t) => t.toFixed(3)).join(', ')}</p>
            </details>
            <button className="secondary-button" onClick={() => setRevealed((value) => !value)}>
              {revealed ? 'Hide private CRT details' : 'Reveal private CRT details'}
            </button>
            {revealed && (
              <div className="lesson-private" aria-label="Alice-only private CRT calculation">
                <p className="keyring-warning">
                  Private values: keep these on Alice’s device. Demo keys are public by design.
                </p>
                {[
                  ['p', measuredKey.p],
                  ['q', measuredKey.q],
                  ['d', measuredKey.d],
                  ['d_p = d mod (p−1)', measuredKey.dp],
                  ['d_q = d mod (q−1)', measuredKey.dq],
                  ['q⁻¹ mod p', bench.trace.qInv],
                  ['M_p = C^d_p mod p', bench.trace.mp],
                  ['M_q = C^d_q mod q', bench.trace.mq],
                  ['h = q⁻¹(M_p−M_q) mod p', bench.trace.h],
                ].map(([label, number]) => (
                  <Value
                    key={String(label)}
                    label={String(label)}
                    value={String(number)}
                    privateValue
                  />
                ))}
                <Value
                  label="M = M_q + h × q"
                  value={`${bench.trace.mq} + ${bench.trace.h} × ${measuredKey.q} = ${bench.crt}`}
                  privateValue
                />
              </div>
            )}
          </div>
        )}
        <p className="helper-text">
          Generate fresh 1024/2048-bit keys here using the existing cancellable key-generation
          worker, or use a key from <Link to="/learn/keys">Keys</Link>. Generated benchmark keys
          stay in this tab’s memory. 1024-bit RSA is included only for the assignment.
        </p>
        <p className="helper-text">
          Course Ch 8–9 ·{' '}
          <a href="https://cacr.uwaterloo.ca/hac/about/chap14.pdf" target="_blank" rel="noreferrer">
            Handbook of Applied Cryptography, §14.5–14.6
          </a>
          .
        </p>
      </section>
    </div>
  );
}
