import { Term } from '../../components/Term';
import { LessonLink as Link } from '../lessons/LessonLink';
import { LessonTrace } from '../lessons/LessonTrace';
import { guessingFrames } from '../lessons/protocolTraces';
import { useState } from 'react';

import { RolePanels } from '../../components/RolePanels';
import { Value } from '../../components/Value';
import { toHex } from '../../engine/encoding';
import type { Vote } from './guessing';
import { OaepDiagram } from './OaepDiagram';
import { useAttack } from './useAttack';

export function GuessingPage() {
  const [vote, setVote] = useState<Vote>('YES'),
    [bits, setBits] = useState<1024 | 2048>(2048);
  const [sample, setSample] = useState(0),
    work = useAttack('guess'),
    value = work.result;
  return (
    <div className="feature-page math-lessons attack-lessons">
      <div className="page-heading">
        <h1>YES or NO?</h1>
      </div>
      <section className="panel feature-body">
        <h2>Can Eve guess the vote?</h2>
        <p>
          There are only two possible messages. With <Term term="deterministic">deterministic</Term>{' '}
          <Term term="textbookRsa">textbook RSA</Term>, Eve can encrypt both using the public key
          and compare them with the intercepted ciphertext.
        </p>
        <p className="keyring-warning">
          Controlled lesson with public demonstration private keys. The vote and sender’s internal
          values are visible to you as the learner; Eve’s comparison receives only public
          ciphertexts.
        </p>
        <div className="lesson-inputs">
          <label>
            Alice’s vote
            <select
              aria-label="Alice’s vote"
              value={vote}
              onChange={(e) => {
                setVote(e.target.value as Vote);
                work.reset();
                setSample(0);
              }}
            >
              <option>YES</option>
              <option>NO</option>
            </select>
          </label>
          <label>
            Demonstration key size
            <select
              aria-label="Guessing demonstration key size"
              value={bits}
              onChange={(e) => {
                setBits(Number(e.target.value) as 1024 | 2048);
                work.reset();
                setSample(0);
              }}
            >
              <option value="1024">1024 bits · assignment only</option>
              <option value="2048">2048 bits</option>
            </select>
          </label>
        </div>
        <div className="feature-actions">
          <button
            className="primary-button"
            disabled={work.busy}
            onClick={() => {
              setSample(0);
              work.run({ vote, bits });
            }}
          >
            {value ? 'Repeat with fresh OAEP randomness' : 'Run guessing attack'}
          </button>
          {work.busy && (
            <button className="secondary-button" onClick={work.cancel}>
              Cancel guessing demonstration
            </button>
          )}
        </div>
        {work.busy && <p role="status">Encrypting and checking every demonstration round trip…</p>}
        {work.error && <p role="alert">{work.error}</p>}
        {value && (
          <>
            <LessonTrace
              title="Vote guessing machine"
              frames={guessingFrames(value)}
              resetKey={toHex(value.oaep[0].ciphertext)}
            />
            <Value label="Public modulus n" value={String(value.key.n)} />
            <Value label="Public exponent e" value={String(value.key.e)} />
            <section className="feature-result" aria-label="Textbook guessing comparison">
              <h3>Textbook RSA: equality reveals the vote</h3>
              <Value
                label="Intercepted textbook ciphertext"
                value={toHex(value.textbook.intercepted)}
              />
              <Value
                label="Eve encrypts YES with the public key"
                value={toHex(value.textbook.yes)}
              />
              <Value label="Eve encrypts NO with the public key" value={toHex(value.textbook.no)} />
              <p className="attack-answer" role="status">
                Eve recovered the textbook vote: {value.recoveredVote}
              </p>
              <p>Alice decrypted it back to {value.recovered}.</p>
            </section>
            <section className="feature-result" aria-label="OAEP guessing comparison">
              <h3>Fresh OAEP: the equality shortcut no longer identifies the vote</h3>
              <p>
                The same vote was independently encrypted three times.{' '}
                {value.samplesIdentical
                  ? 'This run happened to repeat ciphertexts; random outputs are not guaranteed to be unique.'
                  : 'These samples differ because their OAEP encodings used fresh randomness.'}{' '}
                All three decrypt back to {value.vote}.
              </p>
              {value.oaep.map((trace, index) => (
                <Value
                  key={index}
                  label={`OAEP sample ${index + 1}`}
                  value={toHex(trace.ciphertext)}
                />
              ))}
              <Value
                label="Eve’s fresh OAEP guess for YES"
                value={toHex(value.guesses.yes.ciphertext)}
              />
              <Value
                label="Eve’s fresh OAEP guess for NO"
                value={toHex(value.guesses.no.ciphertext)}
              />
              <p role="status">
                Observed equality with intercepted OAEP sample 1: YES ={' '}
                {String(value.oaepMatches.yes)}, NO = {String(value.oaepMatches.no)}.
              </p>
              <p>
                A non-match does not rule out either vote, because encrypting the same vote with a
                different seed can give a different ciphertext. This defeats this equality-based
                guessing method; it does not authenticate the sender or prove every attack
                impossible.
              </p>
            </section>
            <label>
              Inspect sender’s OAEP sample
              <select
                aria-label="Inspect OAEP sample"
                value={sample}
                onChange={(e) => setSample(Number(e.target.value))}
              >
                {value.oaep.map((_, index) => (
                  <option value={index} key={index}>
                    Sample {index + 1}
                  </option>
                ))}
              </select>
            </label>
            <OaepDiagram key={toHex(value.oaep[sample].ciphertext)} trace={value.oaep[sample]} />
          </>
        )}
      </section>
      <RolePanels
        roles={[
          {
            name: 'Alice',
            knowledge: 'The actual vote and her private demonstration key.',
            action: 'Decrypts every sample to confirm correctness.',
          },
          {
            name: 'Bob',
            knowledge: 'Alice’s public key and the vote he is sending.',
            action: 'Encrypts with textbook RSA or fresh OAEP.',
          },
          {
            name: 'Eve',
            knowledge: 'The public key, intercepted ciphertext, and the two possible votes.',
            action:
              'Can reproduce textbook ciphertexts. She does not receive the sender’s OAEP seed or encoded block.',
          },
        ]}
      />
      <section className="panel feature-body">
        <h2>The lesson</h2>
        <p>
          Correct RSA arithmetic alone is not enough for private messaging. Randomized padding such
          as <Term term="oaep" /> matters when the possible messages are easy to guess.
        </p>
        <Link to="/experiments">Try the existing repeated-message experiment</Link>
        <p className="helper-text">
          Uses the same textbook/OAEP engine as that experiment.{' '}
          <a
            href="https://www.rfc-editor.org/rfc/rfc8017#section-7.1"
            target="_blank"
            rel="noreferrer"
          >
            RFC 8017 §7.1: RSAES-OAEP
          </a>
          .
        </p>
      </section>
    </div>
  );
}
