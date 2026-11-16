import { useRef, useState } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { RecipientPicker } from '../../components/RecipientPicker';
import { RolePanels } from '../../components/RolePanels';
import { CopyButton } from '../../components/CopyButton';
import { recipientFromEntry, useKeyring, type Recipient } from '../../keyring';
import { signLesson, verifyLesson, type LessonMode, type LessonSigned } from './model';

export function Signatures() {
  const state = useKeyring();
  const signers = state.entries.filter((e) => e.privateKey);
  const [signerId, setSignerId] = useState('demo-alice');
  const signer =
    signers.find((e) => e.id === signerId) ?? signers.find((e) => e.id === 'demo-alice');
  const [teachingMode, setTeachingMode] = useState<'number' | 'hash'>('hash');
  const mode: LessonMode = signer && signer.bits > 64 ? 'pss' : teachingMode;
  const [message, setMessage] = useState('Meet me at the library.');
  const [signed, setSigned] = useState<LessonSigned | null>(null);
  const [signature, setSignature] = useState('');
  const [selection, setSelection] = useState<{ value: Recipient | null } | null>(null);
  const verifier = selection ? selection.value : signer ? recipientFromEntry(signer) : null;
  const [verdict, setVerdict] = useState<Awaited<ReturnType<typeof verifyLesson>> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  function changed(clearSignature = false) {
    version.current++;
    setVerdict(null);
    setError('');
    setBusy(false);
    if (clearSignature) {
      setSigned(null);
      setSignature('');
    }
  }
  async function act(action: 'sign' | 'verify') {
    if (!signer?.privateKey) return;
    const id = ++version.current;
    setBusy(true);
    setError('');
    setVerdict(null);
    try {
      if (action === 'sign') {
        const result = await signLesson(signer.privateKey, mode, message);
        if (id === version.current) {
          setSigned(result);
          setSignature(result.signature);
        }
      } else {
        if (!verifier) throw new Error('Choose the public key to verify with.');
        const result = await verifyLesson(verifier.key, mode, message, signature);
        if (id === version.current) setVerdict(result);
      }
    } catch (e) {
      if (id === version.current) setError((e as Error).message);
    } finally {
      if (id === version.current) setBusy(false);
    }
  }
  return (
    <div className="feature-page">
      <div className="page-heading">
        <h1>Digital signatures.</h1>
      </div>
      <section className="panel feature-body">
        <p>
          Alice signs with a private key. Bob checks with the corresponding public key. Signing
          proves a relationship to a key; it does not hide the message.
        </p>
        <label>
          Alice’s signing key
          <select
            value={signer?.id ?? ''}
            onChange={(e) => {
              setSignerId(e.target.value);
              setSelection(null);
              changed(true);
            }}
          >
            {signers.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.bits}-bit{e.source === 'demo' ? ' · private key is public' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="keyring-warning">
          Use demonstration data. Demo private keys are public. This lab reuses signing and
          encryption keys; real systems prefer separate key pairs.
        </p>
        {mode === 'pss' ? (
          <p>
            <strong>RSA-PSS · SHA-256 · 32-byte random salt</strong>. A signature scheme with
            randomized encoding, not simply “encrypting with the private key”.
          </p>
        ) : (
          <>
            <label>
              Teaching signature mode
              <select
                value={teachingMode}
                onChange={(e) => {
                  const next = e.target.value as 'number' | 'hash';
                  setTeachingMode(next);
                  if (next === 'number') setMessage('88');
                  changed(true);
                }}
              >
                <option value="number">Raw number · insecure</option>
                <option value="hash">Hash then sign (hash mod n) · insecure</option>
              </select>
            </label>
            <p className="keyring-warning">
              Insecure teaching scheme. Tiny keys can be factored, raw signatures can be forged, and
              reducing a hash modulo a tiny n creates collisions.
            </p>
          </>
        )}
        <label htmlFor="signature-message">
          {mode === 'number' ? 'Message number to sign' : 'Message to sign'}
        </label>
        <textarea
          id="signature-message"
          rows={3}
          maxLength={10000}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            changed();
          }}
        />
        <div className="feature-actions">
          <button
            className="primary-button"
            disabled={busy || !signer}
            onClick={() => void act('sign')}
          >
            Alice signs
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setSignerId('lecture');
              setSelection(null);
              setTeachingMode('number');
              setMessage('88');
              changed(true);
            }}
          >
            Load number example
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setSignerId('lecture');
              setSelection(null);
              setTeachingMode('hash');
              setMessage('16');
              changed(true);
            }}
          >
            Load collision example
          </button>
        </div>
        {signed && (
          <div className="feature-result">
            <h2>Alice’s signing calculation</h2>
            {signed.hash && (
              <>
                <p>SHA-256 of the message at signing:</p>
                <p className="mono fingerprint">{signed.hash}</p>
              </>
            )}
            {signed.digest && (
              <p className="mono">
                {mode === 'hash' ? 'SHA-256(M) mod n' : 'M'} = {signed.digest}; s = {signed.digest}
                ^d mod {signer?.key.n.toString()}
              </p>
            )}
            {mode === 'pss' && (
              <p>
                Hash the message → randomized PSS encoding → apply the private RSA operation. Bob
                checks the full PSS encoding, not only a recovered hash number.
              </p>
            )}
          </div>
        )}
        <label htmlFor="lesson-signature">Signature ({mode === 'pss' ? 'hex' : 'decimal'})</label>
        <textarea
          id="lesson-signature"
          className="mono"
          rows={3}
          maxLength={512}
          value={signature}
          onChange={(e) => {
            setSignature(e.target.value);
            changed();
          }}
        />
        {signature && <CopyButton value={signature} label="Copy signature" />}
        <RecipientPicker
          label="Bob verifies with public key"
          value={verifier}
          onChange={(value) => {
            setSelection({ value });
            changed();
          }}
        />
        <div className="feature-actions">
          <button
            className="primary-button"
            disabled={busy || !signature || !verifier}
            onClick={() => void act('verify')}
          >
            Bob verifies
          </button>
          <button
            className="secondary-button"
            disabled={!signature}
            onClick={() => {
              setMessage(mode === 'number' ? (message === '88' ? '89' : '88') : `${message}!`);
              changed();
            }}
          >
            Tamper with message
          </button>
          <button
            className="secondary-button"
            disabled={!signature}
            onClick={() => {
              setSignature(
                mode === 'pss' ? (signature[0] === '0' ? '1' : '0') + signature.slice(1) : '0',
              );
              changed();
            }}
          >
            Tamper with signature
          </button>
          {mode === 'hash' && signer?.id === 'lecture' && (
            <button
              className="secondary-button"
              disabled={!signature}
              onClick={() => {
                setMessage('46');
                changed();
              }}
            >
              Try collision message 46
            </button>
          )}
        </div>
        {verdict && (
          <div className="feature-result" role="status">
            <h2>
              {verdict.valid
                ? 'Signature valid for this public key'
                : 'Signature invalid for this public key'}
            </h2>
            {verdict.hash && (
              <p className="mono fingerprint">Current message SHA-256: {verdict.hash}</p>
            )}
            {verdict.digest && (
              <p className="mono">
                Expected value: {verdict.digest}
                {verdict.recovered !== undefined ? ` · s^e mod n = ${verdict.recovered}` : ''}
              </p>
            )}
            <p>
              A valid result establishes a match to this key. Verify the owner’s fingerprint through
              a trusted channel before trusting their identity.
            </p>
          </div>
        )}
        <ErrorBanner message={error} onDismiss={() => setError('')} />
      </section>
      <RolePanels
        roles={[
          {
            name: 'Alice',
            knowledge: 'The message and her private key d.',
            action: 'Creates a signature. d stays hidden and is never sent.',
          },
          {
            name: 'Bob',
            knowledge: 'The message, signature and Alice’s public key (e, n).',
            action: 'Checks the signature and compares the key fingerprint with Alice.',
          },
          {
            name: 'Eve',
            knowledge: 'The message, signature and public key.',
            action:
              'Can edit the message or signature; the PSS checks detect the chosen tampering examples.',
          },
        ]}
      />
      <section className="panel feature-body">
        <h2>Why hash first?</h2>
        <p>
          Messages can be longer than an RSA modulus. SHA-256 maps the message to 32 bytes. PSS then
          encodes that hash with a random salt and checks its structure during verification.
        </p>
        <p>
          For the tiny lecture modulus n = 187, both “16” and “46” have SHA-256 interpreted as an
          unsigned big-endian integer modulo 187 equal to 24. Sign “16”, switch to “46”, and verify:
          the toy signature still passes. That collision shows why a tiny hash-mod-n signature is
          insecure; changing every message is not guaranteed to fail.
        </p>
        <p className="helper-text">
          Lecture Ch 9: RSA and signatures. RSA-PSS: RFC 8017, sections 8.1 and 9.1.
        </p>
      </section>
    </div>
  );
}
