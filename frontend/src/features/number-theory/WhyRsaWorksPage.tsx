import { LessonTrace } from '../lessons/LessonTrace';
import { proofFrames, residueFrames } from '../lessons/mathTraces';
import { useState } from 'react';
import { IntegerField, LessonTable, WorkStatus } from './LessonParts';
import { useLesson } from './useLesson';

export function WhyRsaWorksPage() {
  const [p, setP] = useState('17'),
    [q, setQ] = useState('11'),
    [e, setE] = useState('7'),
    [message, setMessage] = useState('88');
  const proof = useLesson('proof');
  const [a, setA] = useState('3'),
    [n, setN] = useState('17');
  const explorer = useLesson('residues');
  const value = proof.result,
    cycle = explorer.result;
  return (
    <div className="feature-page math-lessons">
      <div className="page-heading">
        <h1>Why RSA works.</h1>
      </div>
      <section className="panel feature-body">
        <h2>Prove it with your numbers</h2>
        <p>
          Use distinct odd primes and an exponent coprime to φ(n). This teaching proof computes d
          modulo φ(n); typed keys are limited to a 64-bit modulus.
        </p>
        <div className="lesson-inputs">
          {(
            [
              ['Prime p', p, setP],
              ['Prime q', q, setQ],
              ['Public exponent e', e, setE],
              ['Message M (integer)', message, setMessage],
            ] as const
          ).map(([label, text, setter]) => (
            <IntegerField
              key={label}
              label={label}
              value={text}
              onChange={(next) => {
                setter(next);
                proof.reset();
              }}
            />
          ))}
        </div>
        <div className="feature-actions">
          <button
            className="primary-button"
            disabled={proof.busy}
            onClick={() => proof.run({ p, q, e, message })}
          >
            Show RSA proof
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setP('17');
              setQ('11');
              setE('7');
              setMessage('88');
              proof.reset();
            }}
          >
            Load lecture proof
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setP('17');
              setQ('11');
              setE('7');
              setMessage('17');
              proof.reset();
            }}
          >
            Try a non-coprime message
          </button>
        </div>
        <WorkStatus {...proof} />
        {value && (
          <section className="feature-result" aria-label="RSA correctness proof">
            <LessonTrace
              title="RSA correctness machine"
              frames={proofFrames(value)}
              resetKey={`${value.key.n}-${value.key.e}-${value.original}`}
            />
            <p className="mono">
              n = {String(value.key.n)}, φ(n) = {String(value.key.phi)}, d = {String(value.key.d)}
            </p>
            <p>
              Normalize M: {String(value.original)} mod {String(value.key.n)} ={' '}
              {String(value.message)}. All final comparisons use this residue.
            </p>
            <p className="mono">
              e·d = {String(value.key.e)} × {String(value.key.d)} = 1 + {String(value.k)} ×{' '}
              {String(value.key.phi)}
            </p>
            <p className="mono">
              C = M^e mod n = {String(value.ciphertext)}; gcd(M, n) = {String(value.common)}
            </p>
            {value.common === 1n ? (
              <>
                <h3>Euler’s argument applies</h3>
                <ol className="lesson-proof">
                  <li>M^φ(n) ≡ {String(value.eulerResidue)} (mod n), because gcd(M,n)=1.</li>
                  <li>C^d ≡ M^(e·d) ≡ M^(1+kφ(n)) ≡ M × (M^φ(n))^k (mod n).</li>
                  <li>
                    C^d ≡ {String(value.message)} × 1^{String(value.k)} ≡ {String(value.message)}{' '}
                    (mod {String(value.key.n)}).
                  </li>
                </ol>
              </>
            ) : (
              <p className="keyring-warning">
                Euler’s coprime argument does not apply here. We must prove equality separately
                modulo p and q, then use CRT.
              </p>
            )}
            <h3>The modulo-p / modulo-q proof covers every message</h3>
            {value.primeRows.map((row) => (
              <div className="lesson-proof-prime" key={String(row.prime)}>
                <p>
                  Modulo {String(row.prime)}: M ≡ {String(row.message)}.
                </p>
                {row.message === 0n ? (
                  <p>M is divisible by this prime, so M^(e·d) ≡ 0 ≡ M.</p>
                ) : (
                  <p>
                    Fermat gives M^({String(row.prime)}−1) ≡ 1. Since e·d = 1 +{' '}
                    {String(row.exponentMultiple)} × ({String(row.prime)}−1), M^(e·d) ≡ M.
                  </p>
                )}
                <p className="mono">
                  Recovered residue = {String(row.recovered)} = original residue{' '}
                  {String(row.message)}.
                </p>
              </div>
            ))}
            <p>
              p and q are coprime. Equality modulo both therefore gives equality modulo p·q = n, by
              CRT.
            </p>
            <p className="lesson-answer" role="status">
              Recovered M = {String(value.recovered)} = normalized M = {String(value.message)}.
            </p>
          </section>
        )}
      </section>
      <section className="panel feature-body">
        <h2>Fermat / Euler residue explorer</h2>
        <p>
          Try a small modulus (2…10,000) and inspect repeated multiplication by a. The theorem
          applies only when gcd(a,n)=1.
        </p>
        <div className="lesson-inputs">
          <IntegerField
            label="Residue base a"
            value={a}
            onChange={(next) => {
              setA(next);
              explorer.reset();
            }}
          />
          <IntegerField
            label="Residue modulus n"
            value={n}
            onChange={(next) => {
              setN(next);
              explorer.reset();
            }}
          />
        </div>
        <button
          className="secondary-button"
          disabled={explorer.busy}
          onClick={() => explorer.run({ a, n })}
        >
          Explore residues
        </button>
        <WorkStatus {...explorer} />
        {cycle && (
          <>
            <LessonTrace
              title="Residue cycle machine"
              frames={residueFrames(cycle)}
              resetKey={`${cycle.a}-${cycle.n}`}
            />
            <p role="status">
              φ({String(cycle.n)}) = {String(cycle.phi)}; gcd(a,n) = {String(cycle.common)}; a^φ(n)
              mod n = {String(cycle.value)}.
            </p>
            <p>
              {cycle.common === 1n
                ? cycle.prime
                  ? 'n is prime: Fermat’s exponent n−1 equals φ(n), and the final residue is 1.'
                  : 'Euler applies: the final residue is 1.'
                : 'The base is not coprime to n; neither this Euler argument nor the nonzero-base Fermat argument applies.'}
            </p>
            <LessonTable caption="Repeated-power residues">
              <thead>
                <tr>
                  <th scope="col">Exponent j</th>
                  <th scope="col">a^j mod n</th>
                </tr>
              </thead>
              <tbody>
                {cycle.rows.map((row) => (
                  <tr key={String(row.exponent)}>
                    <td>{String(row.exponent)}</td>
                    <td>{String(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </LessonTable>
            {cycle.truncated && (
              <p className="helper-text">
                Showing the first 64 powers; the final value above is computed through exponent φ(n)
                = {String(cycle.phi)}.
              </p>
            )}
          </>
        )}
        <p className="helper-text">
          Course Ch 9 · This is a correctness proof, not a security proof. Textbook RSA remains
          deterministic and insecure for general messaging.
        </p>
      </section>
    </div>
  );
}
