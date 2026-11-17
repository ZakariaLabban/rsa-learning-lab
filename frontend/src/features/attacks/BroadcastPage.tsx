import { useState } from 'react';
import { RolePanels } from '../../components/RolePanels';
import { Value } from '../../components/Value';
import { LessonTable } from '../number-theory/LessonParts';
import { BROADCAST_MESSAGE, type BroadcastMode, type BroadcastScenario } from './broadcast';
import { useAttack } from './useAttack';

export function BroadcastPage() {
  const [message, setMessage] = useState(BROADCAST_MESSAGE),
    [mode, setMode] = useState<BroadcastMode>('textbook');
  const [scenario, setScenario] = useState<BroadcastScenario>('normal');
  const [rowIndex, setRowIndex] = useState(0);
  const work = useAttack('broadcast'),
    value = work.result;
  const contribution = value?.attack?.rows[rowIndex];
  const short = (number: bigint) => {
    const text = String(number);
    return text.length > 24 ? `${text.slice(0, 12)}…${text.slice(-8)}` : text;
  };
  return (
    <div className="feature-page math-lessons attack-lessons">
      <div className="page-heading">
        <h1>Small-e broadcast attack.</h1>
      </div>
      <section className="panel feature-body">
        <h2>One message, three recipients</h2>
        <p>
          Textbook RSA with e=3 can expose a common message sent to three pairwise-coprime
          recipients. Eve combines the three ciphertexts with CRT, then takes an exact integer cube
          root.
        </p>
        <p className="keyring-warning">
          The normal fixture uses three distinct 1024-bit demonstration moduli with e=3. Their
          private keys are public test data. No saved personal keys are used.
        </p>
        <label htmlFor="broadcast-message">Common message (1–61 UTF-8 bytes)</label>
        <textarea
          id="broadcast-message"
          rows={3}
          maxLength={61}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            work.reset();
          }}
        />
        <div className="lesson-inputs">
          <label>
            Padding
            <select
              aria-label="Broadcast padding"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as BroadcastMode);
                setScenario('normal');
                work.reset();
              }}
            >
              <option value="textbook">Textbook · unpadded</option>
              <option value="oaep">Fresh OAEP per recipient</option>
            </select>
          </label>
          <label>
            Assumptions to test
            <select
              aria-label="Broadcast assumptions"
              value={scenario}
              onChange={(e) => {
                const next = e.target.value as BroadcastScenario;
                setScenario(next);
                if (next !== 'normal') setMode('textbook');
                work.reset();
              }}
            >
              <option value="normal">Normal: same message, e=3, coprime keys</option>
              <option value="shared-factor">Recipients share a prime</option>
              <option value="different-messages">Third recipient gets a different message</option>
              <option value="large-exponent">Use e=65537 instead</option>
              <option value="out-of-range">Invalid M equal to a modulus</option>
            </select>
          </label>
        </div>
        <div className="feature-actions">
          <button
            className="primary-button"
            disabled={work.busy}
            onClick={() => work.run({ message, mode, scenario })}
          >
            Run broadcast demonstration
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setMessage(BROADCAST_MESSAGE);
              setMode('textbook');
              setScenario('normal');
              work.reset();
            }}
          >
            Load guided example
          </button>
          {work.busy && (
            <button className="secondary-button" onClick={work.cancel}>
              Cancel broadcast demonstration
            </button>
          )}
        </div>
        {work.busy && (
          <p role="status">
            Encrypting for three recipients, verifying decryption, then running Eve’s public-key
            attack…
          </p>
        )}
        {work.error && <p role="alert">{work.error}</p>}
        {value && (
          <>
            <p>
              Alice confirms that all three intended recipients decrypted their own messages
              correctly.
            </p>
            {value.publicKeys.map((key, index) => (
              <section
                className="feature-result"
                key={index}
                aria-label={`Recipient ${index + 1} public values`}
              >
                <h3>Recipient {index + 1}</h3>
                <Value label={`n${index + 1}`} value={String(key.n)} />
                <Value label={`e${index + 1}`} value={String(key.e)} />
                <Value
                  label={`Intercepted C${index + 1}`}
                  value={String(value.ciphertexts[index])}
                />
              </section>
            ))}
            {value.problem ? (
              <p className="keyring-warning" role="status">
                Attack precondition failed: {value.problem}
              </p>
            ) : (
              value.attack && (
                <section className="feature-result" aria-label="Broadcast recovery calculation">
                  <h3>Eve’s CRT calculation</h3>
                  <p>
                    For unpadded equal M and e=3, each C_i ≡ M³ mod n_i. Since M is below every
                    modulus, M³ is below their product, so CRT recovers the integer M³, not just its
                    residue.
                  </p>
                  {!value.commonRawInteger && (
                    <p className="keyring-warning">
                      This run does not have the same raw integer at every recipient:{' '}
                      {value.mode === 'oaep'
                        ? 'OAEP uses independently randomized encoded blocks.'
                        : 'The third plaintext was changed.'}{' '}
                      The common-M³ argument therefore does not apply.
                    </p>
                  )}
                  <LessonTable caption="Public CRT reconstruction for three ciphertexts">
                    <thead>
                      <tr>
                        {['Recipient', 'N_i = N/n_i', 'N_i⁻¹ mod n_i', 'C_i N_i inverse'].map(
                          (label) => (
                            <th key={label} scope="col">
                              {label}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {value.attack.rows.map((row, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td className="mono" title={String(row.partial)}>
                            {short(row.partial)}
                          </td>
                          <td className="mono" title={String(row.coefficient)}>
                            {short(row.coefficient)}
                          </td>
                          <td className="mono" title={String(row.term)}>
                            {short(row.term)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </LessonTable>
                  <p className="helper-text">
                    Large table values are shortened. Select a recipient to inspect and copy their
                    full calculated values.
                  </p>
                  <label>
                    Inspect CRT contribution
                    <select
                      aria-label="Inspect CRT contribution"
                      value={rowIndex}
                      onChange={(e) => setRowIndex(Number(e.target.value))}
                    >
                      {value.attack.rows.map((_, index) => (
                        <option key={index} value={index}>
                          Recipient {index + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                  {contribution && (
                    <>
                      <Value
                        label={`N_i for recipient ${rowIndex + 1}`}
                        value={String(contribution.partial)}
                      />
                      <Value
                        label={`Inverse for recipient ${rowIndex + 1}`}
                        value={String(contribution.coefficient)}
                      />
                      <Value
                        label={`CRT contribution term for recipient ${rowIndex + 1}`}
                        value={String(contribution.term)}
                      />
                    </>
                  )}
                  <Value
                    label="CRT result X = Σ C_i N_i inverse mod N"
                    value={String(value.attack.value)}
                  />
                  <Value label="floor(cube root of X)" value={String(value.attack.candidate)} />
                  <p>
                    Is the cube root exact? <strong>{String(value.attack.exactCube)}</strong>.
                  </p>
                  <p className="attack-answer" role="status">
                    {value.matchesOriginal
                      ? `Eve recovered the common message: ${value.attack.text}`
                      : 'This cube-root procedure did not recover the original common message.'}
                  </p>
                  {!value.matchesOriginal && (
                    <p>
                      Failure of this procedure is not proof of general security. It tests only the
                      stated common-message e=3 attack.
                    </p>
                  )}
                </section>
              )
            )}
          </>
        )}
      </section>
      <RolePanels
        roles={[
          {
            name: 'Alice',
            knowledge: 'The message and all three recipients’ public keys.',
            action:
              'Sends the same message. In OAEP mode she chooses fresh independent randomness for each recipient.',
          },
          {
            name: 'Bob',
            title: 'Bob and the other recipients',
            knowledge: 'Each recipient’s own private key.',
            action: 'Decrypts their own ciphertext normally in both modes.',
          },
          {
            name: 'Eve',
            knowledge: 'Only the three public keys (n_i,e_i) and intercepted ciphertexts C_i.',
            action:
              'Uses CRT and an integer cube root. She is not given p,q,d or the sender’s OAEP encodings.',
          },
        ]}
      />
      <section className="panel feature-body">
        <h2>Which assumption changed?</h2>
        <ol className="lesson-proof">
          <li>Textbook mode must encode exactly the same M for all three recipients.</li>
          <li>
            All exponents must be 3 and all moduli pairwise coprime. Shared factors enable a
            different, direct gcd attack.
          </li>
          <li>Each M must be smaller than every modulus; then M³ &lt; n₁n₂n₃.</li>
          <li>
            Fresh OAEP encodings remove the shared raw-M³ structure. e=65537 also stops this
            particular three-recipient cube-root procedure, but does not make deterministic textbook
            RSA safe for messaging.
          </li>
        </ol>
        <p>
          For encryption outside this lesson, use randomized OAEP or hybrid encryption with an
          OAEP-wrapped key. This educational implementation is not audited production software.
        </p>
        <p className="helper-text">
          The default message is large enough that M³ exceeds each individual modulus, so this
          fixture genuinely demonstrates CRT reconstruction.{' '}
          <a
            href="https://crypto.stanford.edu/~dabo/papers/RSA-survey.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Boneh’s RSA survey, broadcast attacks
          </a>
          .
        </p>
      </section>
    </div>
  );
}
