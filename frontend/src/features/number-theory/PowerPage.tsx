import { useState } from 'react';
import { Stepper } from '../../components/Stepper';
import { Value } from '../../components/Value';
import { IntegerField, LessonTable, WorkStatus } from './LessonParts';
import { useLesson } from './useLesson';

export function PowerPage() {
  const [a, setA] = useState('7'),
    [b, setB] = useState('560'),
    [n, setN] = useState('561');
  const [step, setStep] = useState(0);
  const work = useLesson('power'),
    value = work.result;
  function reset() {
    work.reset();
    setStep(0);
  }
  const row = value?.result.rows[step];
  return (
    <div className="feature-page math-lessons">
      <div className="page-heading">
        <h1>Square-and-multiply.</h1>
      </div>
      <section className="panel feature-body">
        <h2>Compute a^b mod n</h2>
        <p>
          Read the exponent from its most significant bit. Start with c=0 and f=1 mod n. For every
          bit, square f; for a 1 bit, also multiply by a. The invariant is f ≡ a^c (mod n).
        </p>
        <div className="lesson-inputs">
          <IntegerField
            label="Base a"
            value={a}
            onChange={(next) => {
              setA(next);
              reset();
            }}
          />
          <IntegerField
            label="Exponent b"
            value={b}
            onChange={(next) => {
              setB(next);
              reset();
            }}
          />
          <IntegerField
            label="Modulus n"
            value={n}
            onChange={(next) => {
              setN(next);
              reset();
            }}
          />
        </div>
        <div className="feature-actions">
          <button
            className="primary-button"
            disabled={work.busy}
            onClick={() => {
              setStep(0);
              work.run({ a, b, n });
            }}
          >
            Trace exponentiation
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setA('7');
              setB('560');
              setN('561');
              reset();
            }}
          >
            Load Table 9.3 example
          </button>
        </div>
        <WorkStatus {...work} />
        {value && (
          <>
            <Value label="Binary exponent b" value={value.binary} />
            <p className="mono">
              Normalized base: {String(value.normalizedBase)}; initial c = 0, f ={' '}
              {String(1n % value.n)}.
            </p>
            {value.result.rows.length > 0 ? (
              <>
                <Stepper
                  step={step}
                  count={value.result.rows.length}
                  onChange={setStep}
                  label="Square-and-multiply steps"
                />
                <LessonTable caption="Table 9.3 · left-to-right square-and-multiply">
                  <thead>
                    <tr>
                      {['i', 'b_i', 'c', 'f'].map((label) => (
                        <th scope="col" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {value.result.rows.map((r, index) => (
                      <tr
                        key={r.i}
                        className={index === step ? 'lesson-current' : undefined}
                        aria-current={index === step ? 'step' : undefined}
                      >
                        <td>{r.i}</td>
                        <td>{r.bit}</td>
                        <td className="mono">{String(r.c)}</td>
                        <td className="mono">{String(r.f)}</td>
                      </tr>
                    ))}
                  </tbody>
                </LessonTable>
                {row && (
                  <div className="feature-result" aria-label="Current exponentiation step">
                    <p>
                      Bit i={row.i} is {row.bit}. Set c = 2×previous c + {row.bit} = {String(row.c)}
                      .
                    </p>
                    <Value label="After squaring (previous f² mod n)" value={String(row.square)} />
                    <Value
                      label={
                        row.bit
                          ? 'After multiplying by a (square × a mod n)'
                          : 'Bit is zero: keep the squared value'
                      }
                      value={String(row.f)}
                    />
                  </div>
                )}
              </>
            ) : (
              <p>
                b = 0: no loop iterations. The result is the initial 1 mod n (including 0 when n=1).
              </p>
            )}
            <p className="lesson-answer" role="status">
              Result: {String(value.a)}^{String(value.b)} mod {String(value.n)} ={' '}
              {String(value.result.value)}
            </p>
            <p>
              Square-and-multiply: <strong>{value.result.multiplications}</strong> modular
              multiplications ({value.result.rowCount} squarings plus one multiply per 1 bit). Naive
              repeated multiplication: <strong>{String(value.naiveMultiplications)}</strong>.
            </p>
            <p className="helper-text">
              Both counts initialize to 1 and include all loop operations. The naive count is
              calculated without running the slow loop. Inputs: a/n up to 2048 bits; non-negative b
              up to 256 bits, so every trace row can be shown.
            </p>
          </>
        )}
        <p className="helper-text">
          Course Ch 9, Table 9.3 ·{' '}
          <a href="https://cacr.uwaterloo.ca/hac/about/chap14.pdf" target="_blank" rel="noreferrer">
            Handbook of Applied Cryptography, §14.6
          </a>
          .
        </p>
      </section>
    </div>
  );
}
