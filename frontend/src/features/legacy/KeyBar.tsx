import { KeyRound, Plus } from 'lucide-react';
import { type LabKey } from '../../engine/client';

export type KeyControls = {
  labKey?: LabKey;
  bits: number;
  setBits: (bits: number) => void;
  createKey: () => Promise<void>;
  generating: boolean;
  seconds: number;
};
export function KeyBar({ labKey, bits, setBits, createKey, generating, seconds }: KeyControls) {
  return (
    <div className="key-bar">
      <div className="key-bar-label">
        <span className="small-icon">
          <KeyRound size={17} />
        </span>
        <div>
          <strong>Key configuration</strong>
          <small>
            {generating
              ? `Finding probable primes · ${seconds}s elapsed`
              : labKey
                ? `Active key · ${labKey.fingerprint.slice(0, 8)}`
                : 'Your first step into the lab'}
          </small>
        </div>
      </div>
      <div className="key-bar-actions">
        <div className="segmented" aria-label="Key size">
          {[1024, 2048].map((n) => (
            <button
              disabled={generating}
              key={n}
              aria-pressed={bits === n}
              className={bits === n ? 'selected' : ''}
              onClick={() => setBits(n)}
            >
              {n}
              <span>bit</span>
            </button>
          ))}
        </div>
        <button className="secondary-button" onClick={createKey} disabled={generating}>
          <Plus size={15} className={generating ? 'spin' : ''} />
          {generating ? 'Generating…' : labKey ? 'New key pair' : 'Generate key pair'}
        </button>
        <span className={`key-status ${labKey && !generating ? 'ready' : ''}`}>
          <span className="status-dot" />
          {generating ? 'WORKING' : labKey ? `${labKey.bits} BIT READY` : 'NO KEY YET'}
        </span>
      </div>
    </div>
  );
}
