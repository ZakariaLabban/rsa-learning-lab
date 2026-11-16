import { useEffect, useRef, useState } from 'react';
import { Activity, CircleHelp, Cpu, Download, Layers, Play, Plus, Sparkles } from 'lucide-react';
import {
  encryptMessage,
  decryptEnvelope,
  type CipherResult,
  type LabKey,
  type Mode,
} from '../../engine/client';

type CompareResult = { mode: Mode; first: CipherResult; second: CipherResult; recovered: boolean };
export function Experiments({
  labKey,
  generating,
  createKey,
  history,
  setError,
}: {
  labKey?: LabKey;
  generating: boolean;
  createKey: () => Promise<void>;
  history: LabKey[];
  setError: (v: string) => void;
}) {
  const [message, setMessage] = useState('The same message. A different mystery.');
  const [busy, setBusy] = useState(false);
  const [comparison, setComparison] = useState<CompareResult[]>([]);
  const [bench, setBench] = useState<{
    encrypt: number[];
    decrypt: number[];
    bits: number;
    fingerprint: string;
  }>();
  const version = useRef(0);
  useEffect(() => {
    version.current++;
    setComparison([]);
    setBench(undefined);
  }, [labKey?.id]);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  async function compare() {
    if (!labKey) return;
    const id = ++version.current;
    setBusy(true);
    setError('');
    setComparison([]);
    try {
      const results: CompareResult[] = [];
      for (const mode of ['textbook', 'oaep'] as Mode[]) {
        const first = await encryptMessage(labKey.id, message, mode);
        const second = await encryptMessage(labKey.id, message, mode);
        const recovered = await decryptEnvelope(labKey.id, second.envelope);
        results.push({ mode, first, second, recovered: recovered.message === message });
      }
      if (id === version.current) setComparison(results);
    } catch (e) {
      if (id === version.current) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function benchmark() {
    if (!labKey) return;
    const id = ++version.current;
    setBusy(true);
    setError('');
    try {
      const encrypt: number[] = [],
        decrypt: number[] = [];
      for (let i = 0; i < 6; i++) {
        const c = await encryptMessage(labKey.id, 'RSA Lab benchmark', 'oaep');
        const m = await decryptEnvelope(labKey.id, c.envelope);
        if (i > 0) {
          encrypt.push(c.elapsed_ms);
          decrypt.push(m.elapsed_ms);
        }
      }
      if (id === version.current)
        setBench({ encrypt, decrypt, bits: labKey.bits, fingerprint: labKey.fingerprint });
    } catch (e) {
      if (id === version.current) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function median(values: number[]) {
    return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  }
  function exportBench() {
    if (!bench) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...bench,
            backend: 'Custom browser RSA + OAEP-SHA256',
            samples: 5,
            discarded_runs: 1,
            units: 'ms',
            browser: navigator.userAgent,
            note: 'Browser worker computation time; excludes animation and rendering. Single key; not a cross-machine study.',
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rsa-lab-benchmark.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <>
      <div className="experiment-context">
        <span>
          <span className={`status-dot ${!labKey ? 'offline' : ''}`} />
          {labKey
            ? `Active key: RSA-${labKey.bits} · ${labKey.fingerprint.slice(0, 8)}`
            : 'Generate a key before running an experiment.'}
        </span>
        {!labKey && (
          <button className="secondary-button" disabled={generating} onClick={createKey}>
            {generating ? 'Generating…' : 'Generate key pair'}
            <Plus size={14} />
          </button>
        )}
      </div>
      <section className="panel experiment-panel">
        <div className="experiment-heading">
          <span className="experiment-number mono">EXPERIMENT / 01</span>
          <span className="subtle-badge">PADDING & RANDOMNESS</span>
          <h2>
            Same message. Same key.
            <br />
            <span>Same ciphertext?</span>
          </h2>
          <p>Encrypt twice with each mode, then compare the results.</p>
        </div>
        <div className="experiment-input">
          <label className="sr-only" htmlFor="experiment-message">
            Experiment message
          </label>
          <input
            id="experiment-message"
            value={message}
            disabled={busy}
            onChange={(e) => {
              setMessage(e.target.value);
              setComparison([]);
            }}
          />
          <button
            className="primary-button"
            onClick={compare}
            disabled={!labKey || busy || generating}
          >
            <Play size={14} />
            {busy ? 'Computing…' : 'Run experiment'}
          </button>
        </div>
        <div className="comparison-grid">
          {(['textbook', 'oaep'] as Mode[]).map((mode) => {
            const result = comparison.find((r) => r.mode === mode);
            const equal = result?.first.cipher_hex === result?.second.cipher_hex;
            return (
              <div
                key={mode}
                className={`comparison-card ${mode === 'oaep' ? 'oaep-comparison' : ''}`}
              >
                <div className="comparison-title">
                  <h3>{mode === 'oaep' ? 'RSA + OAEP' : 'Textbook RSA'}</h3>
                  <span>{mode === 'oaep' ? 'RANDOMIZED' : 'DETERMINISTIC'}</span>
                </div>
                <div className="comparison-run">
                  <span>RUN 01</span>
                  <code>
                    {result
                      ? result.first.cipher_hex.slice(0, 48) + '…'
                      : 'Waiting for your experiment'}
                  </code>
                </div>
                <div className="comparison-run">
                  <span>RUN 02</span>
                  <code>
                    {result
                      ? result.second.cipher_hex.slice(0, 48) + '…'
                      : 'Waiting for your experiment'}
                  </code>
                </div>
                <div className="comparison-verdict">
                  {result ? (
                    <>
                      <span>
                        {equal ? <Layers size={17} /> : <Sparkles size={17} />}
                        {equal ? 'Identical ciphertexts' : 'Different ciphertexts'}
                      </span>
                      <small>
                        {result.recovered
                          ? 'Second ciphertext decrypted correctly'
                          : 'Recovery failed'}
                      </small>
                    </>
                  ) : (
                    <span>
                      {mode === 'oaep'
                        ? 'Will fresh randomness change the result?'
                        : 'What do you predict?'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="experiment-takeaway">
          <CircleHelp size={17} />
          <p>
            {comparison.length
              ? 'Textbook RSA exposes repeated messages. OAEP adds randomness before the RSA operation, so repeated messages produce different ciphertexts. The private key can still recover the original.'
              : 'Make a prediction first. Both modes use the same real key and the same message; only the encoding changes.'}
          </p>
        </div>
      </section>
      <section className="panel benchmark-panel">
        <div className="panel-top">
          <div className="panel-title">
            <Activity size={16} />
            <h2>How much work does RSA do?</h2>
          </div>
          <button
            className="secondary-button"
            onClick={benchmark}
            disabled={!labKey || busy || generating}
          >
            <Cpu size={14} />
            Measure active key
          </button>
        </div>
        <div className="benchmark-body">
          <div>
            <div className="eyebrow">EXPERIMENT / 02</div>
            <h3>Measure it. Don’t guess.</h3>
            <p>
              Five recorded OAEP operations; the first run is discarded. Times come from the browser
              worker and exclude animation and rendering.
            </p>
            {bench && (
              <>
                <div className="benchmark-meta mono">
                  RSA-{bench.bits} · median · 5 samples · custom engine
                </div>
                <div className="benchmark-bar">
                  <span>Encrypt</span>
                  <div>
                    <i
                      style={{
                        width: `${Math.max(2, (median(bench.encrypt) / median(bench.decrypt)) * 100)}%`,
                      }}
                    />
                  </div>
                  <strong className="mono">{median(bench.encrypt).toFixed(3)} ms</strong>
                </div>
                <div className="benchmark-bar">
                  <span>Decrypt</span>
                  <div>
                    <i style={{ width: '100%' }} />
                  </div>
                  <strong className="mono">{median(bench.decrypt).toFixed(3)} ms</strong>
                </div>
                <p className="benchmark-range">
                  Encryption range {Math.min(...bench.encrypt).toFixed(3)}–
                  {Math.max(...bench.encrypt).toFixed(3)} ms · Decryption range{' '}
                  {Math.min(...bench.decrypt).toFixed(3)}–{Math.max(...bench.decrypt).toFixed(3)} ms
                </p>
                <button className="text-button aqua-text" onClick={exportBench}>
                  <Download size={14} />
                  Export measurements
                </button>
              </>
            )}
          </div>
          <div className="generation-history">
            <h4>Key generation · this session</h4>
            {history.length ? (
              history.slice(-5).map((k, i) => (
                <div key={k.id}>
                  <span className="mono">0{i + 1}</span>
                  <strong>{k.bits} bit</strong>
                  <span className="mono">{k.elapsed_ms.toFixed(1)} ms</span>
                </div>
              ))
            ) : (
              <p>Generate keys in Key Studio to record their actual generation times.</p>
            )}
            <small>Single-run observations, not a controlled comparison across key sizes.</small>
          </div>
        </div>
      </section>
    </>
  );
}
