import { LessonTrace } from '../lessons/LessonTrace';
import { euclidFrames } from '../lessons/mathTraces';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LectureExampleButton } from '../../components/LectureExampleButton';
import { EuclidTable } from './EuclidTable';
import { euclidInverse, parseWhole } from './euclidModel';

const short = (v: bigint) => {
  const text = String(v);
  return text.length > 40 ? `${text.slice(0, 16)}…${text.slice(-12)}` : text;
};

/**
 * Extended Euclid (#10): a, m → step table → a⁻¹ mod m or "no inverse (gcd = g)".
 * Accepts ?a=&m= so the key wizard can open it with its own numbers.
 */
export function EuclidPage() {
  const [params, setParams] = useSearchParams();
  const [a, setA] = useState(params.get('a') ?? '7');
  const [m, setM] = useState(params.get('m') ?? '160');

  let error = '',
    result: ReturnType<typeof euclidInverse> | null = null;
  try {
    result = euclidInverse(parseWhole(a, 'a'), parseWhole(m, 'm'));
  } catch (e) {
    error = (e as Error).message;
  }
  const update = (nextA: string, nextM: string) => {
    setA(nextA);
    setM(nextM);
    setParams({ a: nextA.trim(), m: nextM.trim() }, { replace: true });
  };

  return (
    <section className="panel euclid-panel" aria-labelledby="euclid-title">
      <div className="euclid-body">
        <h2 id="euclid-title">Find a⁻¹ mod m</h2>
        <p className="helper-text">
          RSA needs d = e⁻¹ mod φ(n): the number with e·d ≡ 1 (mod φ(n)). Extended Euclid finds it
          by running Euclid’s gcd algorithm and keeping track of how each remainder is built from m
          and a.
        </p>
        <div className="euclid-inputs">
          <div className="encrypt-field">
            <label htmlFor="euclid-a">a (the number to invert)</label>
            <input
              id="euclid-a"
              className="mono"
              inputMode="numeric"
              value={a}
              onChange={(e) => update(e.target.value, m)}
            />
          </div>
          <div className="encrypt-field">
            <label htmlFor="euclid-m">m (the modulus)</label>
            <input
              id="euclid-m"
              className="mono"
              inputMode="numeric"
              value={m}
              onChange={(e) => update(a, e.target.value)}
            />
          </div>
          <LectureExampleButton
            label="Load lecture example (7⁻¹ mod 160)"
            onLoad={() => update('7', '160')}
          />
        </div>
        {error ? (
          <p className="encrypt-problem" role="alert">
            {error}
          </p>
        ) : (
          result && (
            <>
              <LessonTrace
                title="Extended Euclid machine"
                frames={euclidFrames(result)}
                resetKey={`${result.a}-${result.m}`}
              />
              <EuclidTable result={result} />
              <p className="helper-text">
                Each row: q = previous r ÷ r (whole part), then the next r, s and t are “two rows up
                minus q × one row up”. The highlighted row is where r reaches 1.
              </p>
              {result.inverse !== null ? (
                <div className="recovered-box euclid-answer">
                  <span className="eyebrow">INVERSE FOUND</span>
                  <p className="mono">
                    {short(result.a)}⁻¹ mod {short(result.m)} = {String(result.inverse)}
                  </p>
                  <p className="mono helper-text">
                    Check: {short(result.a)} × {short(result.inverse)} mod {short(result.m)} ={' '}
                    {String((result.a * result.inverse) % result.m)}
                  </p>
                </div>
              ) : (
                <p className="encrypt-problem">
                  No inverse (gcd = {String(result.gcd)}): {short(result.a)} and {short(result.m)}{' '}
                  share the factor {String(result.gcd)}, so no multiple of {short(result.a)} can
                  leave remainder 1. In RSA this is why e must be coprime to φ(n).
                </p>
              )}
            </>
          )
        )}
      </div>
    </section>
  );
}
