import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LockKeyhole,
} from 'lucide-react';
import { api, type LabKey } from '../../api';
import { KeyBar, type KeyControls } from './KeyBar';
import { Value } from '../../components/Value';
export function KeyStudio(
  props: KeyControls & {
    history: LabKey[];
    setKey: (key: LabKey) => void;
    setError: (error: string) => void;
  },
) {
  const { labKey, history, setKey, setError } = props;
  const [privateParts, setPrivateParts] = useState<Record<string, string>>();
  const [revealing, setRevealing] = useState(false);
  const [radix, setRadix] = useState<'decimal' | 'hex'>('decimal');
  useEffect(() => {
    setPrivateParts(undefined);
  }, [labKey?.id]);
  const format = (value: string) => (radix === 'hex' ? '0x' + BigInt(value).toString(16) : value);
  async function reveal() {
    if (privateParts) {
      setPrivateParts(undefined);
      return;
    }
    if (!labKey) return;
    setRevealing(true);
    try {
      setPrivateParts(await api<Record<string, string>>(`/keys/${labKey.id}/reveal`, {}));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRevealing(false);
    }
  }
  function download() {
    if (!labKey) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: 'rsa-lab-public-v1',
            n: labKey.n,
            e: labKey.e,
            bits: labKey.bits,
            fingerprint: labKey.fingerprint,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rsa-${labKey.bits}-public.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <>
      <KeyBar {...props} />
      <div className="studio-intro panel">
        <div className="studio-symbol">
          <KeyRound size={36} strokeWidth={1} />
          <span />
          <LockKeyhole size={30} strokeWidth={1} />
        </div>
        <div>
          <div className="eyebrow">ASYMMETRIC BY DESIGN</div>
          <h2>Share one. Keep one.</h2>
          <p>
            The public key encrypts. The private key decrypts. Both are connected by the same
            modulus.
          </p>
        </div>
        <div className="studio-fingerprint">
          <Fingerprint size={20} />
          <span className="mono">
            {labKey?.fingerprint ?? 'No key generated yet'}
            <small>KEY FINGERPRINT</small>
          </span>
        </div>
      </div>
      <div className="studio-controls">
        <span>
          {labKey
            ? `Inspecting a ${labKey.bits}-bit modulus · ${labKey.candidates} candidates · ${labKey.elapsed_ms.toFixed(1)} ms generation`
            : 'Generate a key pair to inspect its components.'}
        </span>
        <div className="segmented">
          <button
            className={radix === 'decimal' ? 'selected' : ''}
            onClick={() => setRadix('decimal')}
          >
            Decimal
          </button>
          <button className={radix === 'hex' ? 'selected' : ''} onClick={() => setRadix('hex')}>
            Hex
          </button>
        </div>
      </div>
      <div className="io-grid key-grid">
        <section className="panel key-detail">
          <div className="panel-top">
            <div className="panel-title">
              <KeyRound size={17} />
              <h2>Public key</h2>
              <span className="subtle-badge">SHAREABLE</span>
            </div>
            <button className="copy-button" disabled={!labKey} onClick={download}>
              <Download size={14} />
              Export JSON
            </button>
          </div>
          <div className="key-detail-body">
            {labKey ? (
              <>
                <Value
                  label="n · Modulus"
                  value={format(labKey.n)}
                  note={`${labKey.bits} bits · product of two private probable primes`}
                />
                <Value
                  label="e · Public exponent"
                  value={format(labKey.e)}
                  note="65537 · efficient and widely used"
                />
              </>
            ) : (
              <div className="empty-key">
                <KeyRound size={32} />
                <p>The public side of your key pair will appear here.</p>
              </div>
            )}
          </div>
        </section>
        <section className="panel key-detail private-panel">
          <div className="panel-top">
            <div className="panel-title">
              <LockKeyhole size={17} />
              <h2>Private components</h2>
              <span className="subtle-badge amber-badge">KEEP SECRET</span>
            </div>
            <button className="copy-button" onClick={reveal} disabled={!labKey || revealing}>
              {privateParts ? <EyeOff size={14} /> : <Eye size={14} />}
              {revealing ? 'Loading…' : privateParts ? 'Hide' : 'Reveal'}
            </button>
          </div>
          <div className="key-detail-body">
            {privateParts ? (
              <>
                {[
                  ['p', 'First probable prime'],
                  ['q', 'Second probable prime'],
                  ['d', 'Private exponent'],
                  ['phi', 'Euler’s totient'],
                  ['lambda', 'Carmichael’s function'],
                ].map(([name, note]) => (
                  <Value
                    key={name}
                    label={`${name} · ${note}`}
                    value={format(privateParts[name])}
                    privateValue
                  />
                ))}
              </>
            ) : (
              <div className="empty-key secret-placeholder">
                <div className="private-lock">
                  <LockKeyhole size={25} />
                </div>
                <strong>Some numbers are just for you.</strong>
                <p>
                  Reveal p, q, and d to study the mathematics.
                  <br />
                  These values expose the private key.
                </p>
                <span className="mono">•••• •••• •••• ••••</span>
              </div>
            )}
          </div>
        </section>
      </div>
      {history.length > 0 && (
        <section className="panel history-panel">
          <div className="panel-top">
            <div className="panel-title">
              <Activity size={16} />
              <h2>Session key history</h2>
            </div>
            <span className="helper-text">Last 8 keys · memory only</span>
          </div>
          {history
            .slice()
            .reverse()
            .map((k) => (
              <button
                className={`history-row ${k.id === labKey?.id ? 'selected-history' : ''}`}
                key={k.id}
                onClick={() => setKey(k)}
              >
                <span className="mono">{k.fingerprint}</span>
                <span>{k.bits} bit</span>
                <span className="mono">{k.elapsed_ms.toFixed(1)} ms</span>
                <span>
                  {k.id === labKey?.id ? (
                    <>
                      <Check size={14} /> Active
                    </>
                  ) : (
                    <>
                      Use key <ArrowRight size={14} />
                    </>
                  )}
                </span>
              </button>
            ))}
        </section>
      )}
    </>
  );
}
