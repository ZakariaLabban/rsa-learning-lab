import { LessonArticle } from './parts';
import { useState } from 'react';
import { millerRabinRun, parseWhole, power, type MillerRabinRun } from './model';
import {
  Field,
  fmt,
  HandMethod,
  Idea,
  InputForm,
  Pow,
  SlideRef,
  StepControls,
  UsedFor,
  useSteps,
  Words,
  LessonHeader,
  Procedure,
} from './parts';

function Steps({ run }: { run: MillerRabinRun }) {
  const visible = run.stoppedAt === null ? run.terms.length : run.stoppedAt + 1;
  const steps = useSteps(1 + visible);
  const shownTerms = run.terms.slice(0, Math.max(0, steps.shown - 1));
  const n = fmt(run.n);
  const asPower = (j: number) => (j === 0 ? 'q' : `2${j === 1 ? '' : superscript(j)}q`);
  // step 1 = lines 1-2, first term = line 3 + loop, after that just the loop
  const active =
    steps.shown === 1
      ? [1, 2]
      : steps.shown === 2
        ? [3, 4, 5]
        : steps.done && run.verdict === 'composite'
          ? [4, 5, 6]
          : [4, 5];
  return (
    <>
      <Procedure
        id="Algorithm 3.1"
        name="TEST(n)"
        input="an odd integer n ≥ 3"
        output="“maybe prime” or “composite”"
        active={active}
        lines={[
          { text: 'Find integers k, q with k > 0, q odd, so that (n − 1) = 2ᵏq' },
          { text: 'Select a random integer a, 1 < a < n − 1' },
          { text: 'if a^q mod n = 1 then return “maybe prime”' },
          { text: 'for j = 0 to k − 1 do' },
          { text: 'if a^(2^j q) mod n = n − 1 then return “maybe prime”', depth: 1 },
          { text: 'return “composite”' },
        ]}
      />
      <StepControls steps={steps} />
      <ol className="mr-steps">
        <li className={steps.shown === 1 ? 'current' : ''}>
          <h3>Step 1–2 · Write n − 1 = 2ᵏ × q and pick a</h3>
          <p>
            n − 1 = {fmt(run.n - 1n)} = 2<sup>{run.k}</sup> × {fmt(run.q)} (q is odd), so k ={' '}
            {run.k} and q = {fmt(run.q)}.
          </p>
          <p>
            The chosen a = {fmt(run.a)} (it must satisfy 1 &lt; a &lt; n − 1 = {fmt(run.n - 1n)}).
          </p>
        </li>
        {shownTerms.map((term, index) => (
          <li key={term.j} className={index === shownTerms.length - 1 ? 'current' : ''}>
            {term.j === 0 ? (
              <>
                <h3>Step 3 · Compute a^q mod n</h3>
                <p>
                  <Pow base={fmt(run.a)} exp={fmt(run.q)} /> mod {n} ={' '}
                  <strong>{fmt(term.value)}</strong>
                </p>
                <details>
                  <summary>Show how this power was computed</summary>
                  <HandMethod run={power(run.a, run.q, run.n)} />
                </details>
                <p>
                  Is it 1?{' '}
                  {term.isOne ? (
                    <b>Yes, so the answer is “maybe prime”.</b>
                  ) : (
                    <>No ({fmt(term.value)} ≠ 1), so continue.</>
                  )}
                </p>
              </>
            ) : (
              <>
                <h3>
                  Step 4 · j = {term.j}: a<sup>{asPower(term.j)}</sup> mod n
                </h3>
                <p>
                  Square the previous value: ({fmt(run.terms[term.j - 1].value)})<sup>2</sup> ={' '}
                  {fmt(term.squareRaw!)}, and {fmt(term.squareRaw!)} mod {n} ={' '}
                  <strong>{fmt(term.value)}</strong>
                </p>
              </>
            )}
            {!(term.j === 0 && term.isOne) && (
              <p>
                Is it n − 1 = {fmt(run.n - 1n)}?{' '}
                {term.isMinusOne ? (
                  <b>Yes, so the answer is “maybe prime”.</b>
                ) : (
                  <>
                    No ({fmt(term.value)} ≠ {fmt(run.n - 1n)}).
                  </>
                )}
              </p>
            )}
          </li>
        ))}
      </ol>
      {steps.done && (
        <div className={`result ${run.verdict === 'composite' ? 'bad' : ''}`}>
          {run.verdict === 'maybe prime' ? (
            <p>
              <strong>Maybe prime.</strong>{' '}
              {run.stopReason === 'one'
                ? `a^q mod n = 1.`
                : `a^(${asPower(run.stoppedAt!)}) mod n = n − 1.`}{' '}
              This base does not prove {n} is prime: a composite number can pass for some bases
              (liars), so try other values of a. For a prime, every base passes.
            </p>
          ) : (
            <p>
              <strong>Composite.</strong> The values a^q, a^(2q) … a^(2^(k−1) q) were never 1 first
              or n − 1, so {n} is definitely <b>not</b> prime.
            </p>
          )}
        </div>
      )}
    </>
  );
}

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const superscript = (value: number) =>
  String(value)
    .split('')
    .map((digit) => SUPERSCRIPTS[Number(digit)])
    .join('');

export function PrimalityPage() {
  const [nText, setN] = useState('29'),
    [aText, setA] = useState('10'),
    [error, setError] = useState(''),
    [run, setRun] = useState<MillerRabinRun | null>(() => millerRabinRun(29n, 10n));
  const calculate = (nValue = nText, aValue = aText) => {
    try {
      setRun(millerRabinRun(parseWhole(nValue, 'n'), parseWhole(aValue, 'a')));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const example = (n: string, a: string) => {
    setN(n);
    setA(a);
    calculate(n, a);
  };
  return (
    <LessonArticle>
      <LessonHeader title="Is n prime?" />
      <Idea>
        Checking every divisor is far too slow for huge numbers. Miller–Rabin instead tests a clever
        property that <b>every prime passes</b>. If a number fails it, it is{' '}
        <b>definitely not prime</b>. If it passes, it is <i>probably</i> prime, and a few more tries
        with different bases make that almost certain.
      </Idea>
      <UsedFor>
        Real RSA needs two huge random primes p and q. The lab guesses a number and uses this test
        to see whether it is prime.
      </UsedFor>
      <SlideRef>
        ch08 “Miller Rabin Algorithm”, “Probabilistic Considerations”, “Miller Rabin: Examples”.
      </SlideRef>
      <Words terms={['prime', 'composite', 'mod', 'exponent']} />
      <InputForm
        summary={run ? `n = ${run.n}, a = ${run.a}` : 'no numbers yet'}
        onSubmit={() => calculate()}
        error={error}
      >
        <Field id="mr-n" label="n (odd, at least 5)" value={nText} onChange={setN} />
        <Field id="mr-a" label="a (1 < a < n − 1)" value={aText} onChange={setA} />
      </InputForm>
      <div className="examples" role="group" aria-label="Lecture examples">
        <span>Lecture examples:</span>
        <button type="button" onClick={() => example('29', '10')}>
          n = 29, a = 10 (maybe prime)
        </button>
        <button type="button" onClick={() => example('221', '5')}>
          n = 221, a = 5 (composite)
        </button>
        <button type="button" onClick={() => example('221', '21')}>
          n = 221, a = 21 (a liar)
        </button>
      </div>
      {run && <Steps key={`${run.n}-${run.a}`} run={run} />}
    </LessonArticle>
  );
}
