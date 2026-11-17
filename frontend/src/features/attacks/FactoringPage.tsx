import { useRef, useState } from 'react';
import { RolePanels } from '../../components/RolePanels';
import { Value } from '../../components/Value';
import { factoringFixtures } from './keys';
import { trialEstimate } from './factoring';
import { FactorChart, type FactorMeasurement } from './FactorChart';
import { useAttack } from './useAttack';

export function FactoringPage() {
  const [fixture, setFixture] = useState(0),
    [budgetMs, setBudgetMs] = useState(30000);
  const [points, setPoints] = useState<FactorMeasurement[]>([]),
    [target, setTarget] = useState(40);
  const nextId = useRef(1),
    work = useAttack('factor');
  const selected = factoringFixtures[fixture],
    result = work.result;
  const lastFinished = [...points].reverse().find((point) => point.status === 'factored');
  const estimate = lastFinished ? trialEstimate({ ...lastFinished, divisor: 0n }, target) : null;
  return (
    <div className="feature-page math-lessons attack-lessons">
      <div className="page-heading">
        <h1>Factoring race.</h1>
      </div>
      <section className="panel feature-body">
        <p>
          Eve knows n, e and the intercepted ciphertext. A deliberately tiny modulus lets her try
          divisors until she finds p and q, rebuilds the private exponent, and decrypts.
        </p>
        <p className="keyring-warning">
          Educational fixtures only. These keys and sample messages are public. Default: 16 bits,
          chosen to finish comfortably on the tested presentation laptop. Other devices may differ.
        </p>
        <div className="lesson-inputs">
          <label>
            Tiny modulus size
            <select
              aria-label="Tiny modulus size"
              value={fixture}
              onChange={(e) => {
                setFixture(Number(e.target.value));
                work.reset();
              }}
            >
              {factoringFixtures.map((key, index) => (
                <option key={key.bits} value={index}>
                  {key.bits} bits{index === 0 ? ' · quick default' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search budget
            <select
              aria-label="Search budget"
              value={budgetMs}
              onChange={(e) => {
                setBudgetMs(Number(e.target.value));
                work.reset();
              }}
            >
              <option value="1000">1 second</option>
              <option value="5000">5 seconds</option>
              <option value="30000">30 seconds maximum</option>
            </select>
          </label>
        </div>
        <Value label="Public modulus n" value={selected.n} />
        <Value label="Public exponent e" value={selected.e} />
        <Value label="Intercepted C" value={selected.ciphertext} />
        <div className="feature-actions">
          <button
            className="primary-button"
            disabled={work.busy}
            onClick={() =>
              work.run({ fixture, budgetMs }, (value) => {
                const id = nextId.current++;
                setPoints((previous) => [
                  ...previous.slice(-11),
                  {
                    id,
                    bits: value.bits,
                    elapsedMs: value.elapsedMs,
                    attempts: value.attempts,
                    status: value.status,
                  },
                ]);
              })
            }
          >
            Let Eve factor the key
          </button>
          {work.busy && (
            <button className="secondary-button" onClick={work.cancel}>
              Cancel factoring
            </button>
          )}
        </div>
        {work.busy && (
          <p role="status">
            Trying odd divisors · {work.progress?.attempts.toLocaleString() ?? 0} divisions ·{' '}
            {((work.progress?.elapsedMs ?? 0) / 1000).toFixed(1)} s elapsed · {budgetMs / 1000} s
            search budget
          </p>
        )}
        {work.error && <p role="alert">{work.error}</p>}
        {result && (
          <section className="feature-result" aria-label="Factoring outcome">
            {result.status === 'timeout' ? (
              <p role="status">
                Search timed out after {result.elapsedMs.toFixed(1)} ms. No factors were recovered;
                the worker has stopped. This is a supported outcome.
              </p>
            ) : result.status === 'exhausted' ? (
              <p role="status">
                No nontrivial divisor found in this search. The worker has stopped.
              </p>
            ) : (
              <>
                <h2>Eve recovered the private key</h2>
                <Value label="n = p × q" value={`${result.n} = ${result.p} × ${result.q}`} />
                <Value label="φ(n) = (p−1)(q−1)" value={String(result.phi)} />
                <Value label="Recovered d = e⁻¹ mod φ(n)" value={String(result.d)} />
                <Value label="Recovered M = C^d mod n" value={String(result.message)} />
                <p className="attack-answer" role="status">
                  Recovered message:{' '}
                  {new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(result.bytes)}
                </p>
                <p>
                  {result.attempts.toLocaleString()} odd trial divisions in{' '}
                  {result.elapsedMs.toFixed(3)} ms of search time. Key reconstruction and decryption
                  follow the search and are not included in that measurement.
                </p>
              </>
            )}
          </section>
        )}
        <p className="helper-text">
          The search runs off the UI thread, checks its deadline regularly, and stops when cancelled
          or when you leave this page. Maximum search budget: 30 seconds; a watchdog adds at most
          one second for worker loading/delivery, without allowing extra search time.
        </p>
      </section>
      <RolePanels
        roles={[
          {
            name: 'Alice',
            knowledge: `The original demonstration message “${selected.message}” and her private key.`,
            action:
              'A properly sized modulus should keep finding its factors impractical for this naive search.',
          },
          {
            name: 'Bob',
            knowledge: 'Alice’s public key (n,e).',
            action: 'Uses it to encrypt the sample message.',
          },
          {
            name: 'Eve',
            knowledge: 'Only n, e, C and the declared two-byte message length.',
            action: 'Trial-divides n. Factors reveal φ(n), then d, then the message.',
          },
        ]}
      />
      <section className="panel feature-body">
        <h2>Measure the tiny cases</h2>
        <FactorChart points={points} />
        {!!points.length && (
          <button
            className="secondary-button"
            onClick={() => {
              setPoints([]);
              work.reset();
            }}
          >
            Clear measurements
          </button>
        )}
        <label>
          Extrapolate this trial-division rate to another tiny size
          <select
            aria-label="Trial-division extrapolation size"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          >
            {factoringFixtures.map((key) => (
              <option key={key.bits} value={key.bits}>
                {key.bits} bits
              </option>
            ))}
          </select>
        </label>
        {estimate ? (
          <p className="keyring-warning">
            Rough extrapolation:{' '}
            {(estimate.milliseconds / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })}{' '}
            seconds for {estimate.trials.toLocaleString()} odd trials up to √(2^{target}−1), using
            the last completed run’s rate. This is an estimate for this algorithm on this
            browser/hardware, not a measured completion time.
          </p>
        ) : (
          <p className="helper-text">
            Complete a measurable search to estimate another tiny case. Very short runs may be below
            useful clock resolution.
          </p>
        )}
        <p>
          There is no practical 1024/2048-bit attack-time estimate here. Modern large-integer
          factorization uses algorithms such as the number field sieve, not this classroom
          trial-division loop. A failed or timed-out demonstration does not prove a key is secure.
        </p>
        <p className="helper-text">
          Course Ch 9 ·{' '}
          <a
            href="https://crypto.stanford.edu/~dabo/papers/RSA-survey.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Boneh, Twenty Years of Attacks on RSA
          </a>
          . No current factorization-record claim is made.
        </p>
      </section>
    </div>
  );
}
