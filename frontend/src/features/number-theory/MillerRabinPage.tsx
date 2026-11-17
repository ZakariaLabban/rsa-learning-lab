import { Term } from '../../components/Term';
import { LessonLink as Link } from '../lessons/LessonLink';
import { LessonTrace } from '../lessons/LessonTrace';
import { primalityFrames, liarFrames } from '../lessons/mathTraces';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Stepper } from '../../components/Stepper';
import { Value } from '../../components/Value';
import { IntegerField, LessonTable, WorkStatus } from './LessonParts';
import { useLesson } from './useLesson';

export function MillerRabinPage() {
  const [params, setParams] = useSearchParams();
  const n = params.get('n') ?? '29';
  const [base, setBase] = useState('10'),
    [source, setSource] = useState<'typed' | 'random'>('typed');
  const [rounds, setRounds] = useState(5),
    [round, setRound] = useState(0),
    [step, setStep] = useState(0);
  const test = useLesson('primality'),
    liars = useLesson('liars');
  const result =
    test.result?.n.toString() === n.trim().replace(/^0+(?=\d)/, '') ? test.result : null;
  const liarResult =
    liars.result?.n.toString() === n.trim().replace(/^0+(?=\d)/, '') ? liars.result : null;
  const row = result?.result?.rows[round];
  function reset() {
    test.reset();
    liars.reset();
    setRound(0);
    setStep(0);
  }
  function example(candidate: string, witness: string) {
    setParams({ n: candidate }, { replace: true });
    setBase(witness);
    setSource('typed');
    reset();
  }
  return (
    <div className="feature-page math-lessons">
      <div className="page-heading">
        <h1>Miller–Rabin prime testing.</h1>
      </div>
      <section className="panel feature-body">
        <p>
          <Term term="millerRabin" /> searches for evidence that n is composite. A failing witness
          proves compositeness; one passing base is evidence, not proof: n is then a{' '}
          <Term term="probablePrime">probable prime</Term>.
        </p>
        <div className="lesson-inputs">
          <IntegerField
            label="Candidate n"
            value={n}
            onChange={(value) => {
              setParams({ n: value }, { replace: true });
              reset();
            }}
          />
          <label>
            Base selection
            <select
              aria-label="Base selection"
              value={source}
              onChange={(e) => {
                setSource(e.target.value as 'typed' | 'random');
                test.reset();
                setStep(0);
                setRound(0);
              }}
            >
              <option value="typed">Type one base</option>
              <option value="random">Independent random bases</option>
            </select>
          </label>
          {source === 'typed' ? (
            <IntegerField
              label="Base a"
              value={base}
              onChange={(value) => {
                setBase(value);
                test.reset();
                setStep(0);
                setRound(0);
              }}
            />
          ) : (
            <label>
              Random rounds
              <select
                aria-label="Random rounds"
                value={rounds}
                onChange={(e) => {
                  setRounds(Number(e.target.value));
                  test.reset();
                  setStep(0);
                  setRound(0);
                }}
              >
                {[1, 5, 10, 32, 64].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="feature-actions">
          <button
            className="primary-button"
            disabled={test.busy}
            onClick={() => {
              setRound(0);
              setStep(0);
              test.run({ n, base, source, rounds });
            }}
          >
            Test candidate
          </button>
          <button className="secondary-button" onClick={() => example('29', '10')}>
            Load 29 / base 10
          </button>
          <button className="secondary-button" onClick={() => example('221', '5')}>
            Load 221 / base 5
          </button>
        </div>
        <WorkStatus {...test} />
        {result && (
          <section className="feature-result" aria-label="Miller–Rabin result">
            <LessonTrace
              title="Prime witness machine"
              frames={primalityFrames(result, round)}
              onStep={setStep}
              resetKey={`${result.n}-${row?.base}-${row?.sequence.join(',')}`}
            />
            {result.special === 'below-two' ? (
              <p role="status">
                {n} is not prime: primes are at least 2. No random rounds were run.
              </p>
            ) : result.special === 'small-prime' ? (
              <p role="status">{n} is prime. This small case needs no Miller–Rabin bases.</p>
            ) : result.special === 'even' ? (
              <p role="status">
                {n} is composite: it is even and greater than 2. No random rounds were run.
              </p>
            ) : (
              result.result && (
                <>
                  <Value
                    label="n − 1 = 2^k × q"
                    value={`${result.n - 1n} = 2^${result.result.k} × ${result.result.q}`}
                  />
                  <p role="status">
                    {result.result.probablePrime
                      ? `Passed ${result.result.tested} tested base(s). This run does not prove n is prime.`
                      : `Composite: base ${result.result.rows.at(-1)?.base} is a witness.`}
                  </p>
                  <p className="helper-text">
                    Start with x = a^q mod n. Accept this base if x is 1 or n−1; otherwise square up
                    to k−1 times, accepting if n−1 appears. If neither condition is met, the base is
                    a compositeness witness.
                  </p>
                  <label>
                    Inspect tested base
                    <select
                      aria-label="Inspect tested base"
                      value={round}
                      onChange={(e) => {
                        setRound(Number(e.target.value));
                        setStep(0);
                      }}
                    >
                      {result.result.rows.map((r, index) => (
                        <option key={index} value={index}>
                          Round {index + 1} · {r.passed ? 'passes' : 'witness'}
                        </option>
                      ))}
                    </select>
                  </label>
                  {row && (
                    <>
                      <Value label="Selected base a" value={String(row.base)} />
                      <Stepper
                        step={step}
                        count={row.sequence.length}
                        onChange={setStep}
                        label="Miller–Rabin sequence steps"
                      />
                      <LessonTable caption="Miller–Rabin residue sequence">
                        <thead>
                          <tr>
                            <th scope="col">j</th>
                            <th scope="col">Operation</th>
                            <th scope="col">x = a^(2^j q) mod n</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.sequence.map((value, index) => (
                            <tr
                              key={index}
                              className={index === step ? 'lesson-current' : undefined}
                              aria-current={index === step ? 'step' : undefined}
                            >
                              <td>{index}</td>
                              <td>{index === 0 ? 'a^q mod n' : 'previous x² mod n'}</td>
                              <td className="mono">{String(value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </LessonTable>
                      <p className="mono">
                        Step {step + 1}: x = {String(row.sequence[step])}
                        {row.sequence[step] === 1n
                          ? ' (1)'
                          : row.sequence[step] === result.n - 1n
                            ? ' (n−1)'
                            : ''}
                      </p>
                    </>
                  )}
                  <p>
                    Independent random rounds in this run:{' '}
                    <strong>{result.result.randomRounds}</strong>. Typed bases and manually repeated
                    tests do not accumulate the random-round bound.
                  </p>
                  {result.source === 'random' && result.result.probablePrime && (
                    <p className="keyring-warning">
                      For any fixed odd composite n, the probability that all{' '}
                      {result.result.randomRounds} independent uniformly random bases pass is at
                      most 4^−{result.result.randomRounds} = 1 /{' '}
                      {String(4n ** BigInt(result.result.randomRounds))}. This is not the
                      probability that this n is prime.
                    </p>
                  )}
                </>
              )
            )}
          </section>
        )}
        <p className="helper-text">
          Each run starts fresh. Random draws use browser cryptographic randomness and rejection
          sampling over 2…n−2; accidental repeated draws are allowed. Typing or deliberately
          replaying a base is not an independent random draw. Candidates are limited to 2048 bits.
        </p>
      </section>
      <section className="panel feature-body">
        <h2>Find the strong liars</h2>
        <p>
          For an odd composite, a <Term term="strongLiar">strong liar</Term> is a base that passes
          despite the number being composite. Search every base from 2 to n−2 for an odd n from 5 to
          10,000.
        </p>
        <button className="secondary-button" disabled={liars.busy} onClick={() => liars.run({ n })}>
          Find passing bases
        </button>
        <WorkStatus {...liars} />
        {liarResult && (
          <div className="feature-result" role="status">
            <LessonTrace
              title="Strong liar enumeration machine"
              frames={liarFrames(liarResult)}
              resetKey={String(liarResult.n)}
            />
            <p>
              {liarResult.prime
                ? `${liarResult.n} is prime; these passing bases are not liars.`
                : `${liarResult.n} is composite (${liarResult.factor} × ${liarResult.n / liarResult.factor!}). Strong liars:`}
            </p>
            <p className="mono lesson-list">
              {liarResult.bases.length ? liarResult.bases.map(String).join(', ') : 'None'}
            </p>
            <p>
              {liarResult.bases.length} of {liarResult.tested} bases pass. Exhaustive enumeration
              does not count as random rounds.
            </p>
          </div>
        )}
        <Link to="/learn/why-rsa-works">Next: why RSA decryption works</Link>
        <p className="helper-text">
          Course Ch 8 ·{' '}
          <a href="https://cacr.uwaterloo.ca/hac/about/chap4.pdf" target="_blank" rel="noreferrer">
            Handbook of Applied Cryptography, §4.2.3
          </a>
          .
        </p>
      </section>
    </div>
  );
}
