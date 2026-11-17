import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseWhole, power, type PowerResult } from './model';
import {
  Field,
  fmt,
  HandMethod,
  handSteps,
  Idea,
  InputForm,
  Num,
  Pow,
  SlideRef,
  StepControls,
  UsedFor,
  useSteps,
  Words,
  TabList,
  TabPanel,
} from './parts';

/** The slide's table (Table 9.3): one column per bit of the exponent, filled left to right. */
export function LectureTable({ run, shown }: { run: PowerResult; shown: number }) {
  const rows: { name: string; cell: (index: number) => string }[] = [
    { name: 'i', cell: (index) => String(run.steps[index].i) },
    { name: 'bᵢ', cell: (index) => String(run.steps[index].bit) },
    { name: 'c', cell: (index) => fmt(run.steps[index].c) },
    { name: 'f', cell: (index) => fmt(run.steps[index].f) },
  ];
  return (
    <div className="table-wrap">
      <table className="grid horizontal" aria-label="Fast exponentiation table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              {run.steps.map((step, index) => (
                <td
                  key={step.i}
                  className={index === shown - 1 ? 'current' : index >= shown ? 'ghost' : ''}
                >
                  {index < shown ? row.cell(index) : '·'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LectureExplain({ run, shown }: { run: PowerResult; shown: number }) {
  const step = run.steps[shown - 1],
    previousC = shown > 1 ? run.steps[shown - 2].c : 0n;
  const a = fmt(run.base),
    n = fmt(run.n);
  return (
    <div className="explain" aria-live="polite">
      <p>
        <b>
          i = {step.i}: the bit bᵢ is {step.bit}.
        </b>
      </p>
      <ul className="lines plain">
        <li>
          c = 2 × {fmt(previousC)} = {fmt(2n * previousC)}
          {step.bit ? `, plus 1 because the bit is 1 → c = ${fmt(step.c)}` : ''}
        </li>
        <li>
          f = f × f mod n = {fmt(step.before)} × {fmt(step.before)} mod {n} = {fmt(step.squareRaw)}{' '}
          mod {n} = <b>{fmt(step.squared)}</b>
        </li>
        {step.multiplyRaw !== null ? (
          <li>
            The bit is 1, so also f = f × a mod n = {fmt(step.squared)} × {a} mod {n} ={' '}
            {fmt(step.multiplyRaw)} mod {n} = <b>{fmt(step.f)}</b>
          </li>
        ) : (
          <li>The bit is 0, so we do not multiply by a. f stays {fmt(step.f)}.</li>
        )}
      </ul>
    </div>
  );
}

function LectureSteps({ run }: { run: PowerResult }) {
  const steps = useSteps(run.steps.length);
  return (
    <>
      <p className="lead small">
        Start with c = 0 and f = 1. For each bit bᵢ of the exponent from the top bit down to bit 0:
        c = 2c, then f = f × f mod n; if the bit is 1 also c = c + 1 and f = f × a mod n. The last f
        is the answer, and c ends up equal to the exponent.
      </p>
      <StepControls steps={steps} label="Column" />
      <LectureTable run={run} shown={steps.shown} />
      <LectureExplain run={run} shown={steps.shown} />
      {steps.done && (
        <p className="result">
          <Pow base={fmt(run.a)} exp={fmt(run.exponent)} /> mod {fmt(run.n)} ={' '}
          <strong>{fmt(run.result)}</strong>, and c = {fmt(run.steps[run.steps.length - 1].c)} is
          the exponent.
        </p>
      )}
    </>
  );
}

function HandSteps({ run }: { run: PowerResult }) {
  const total = handSteps(run);
  const steps = useSteps(total);
  return (
    <>
      <p className="lead small">
        The same calculation as you would do it on paper: write the powers a¹, a², a⁴, a⁸ … each
        reduced mod n, then multiply the ones that make up the exponent.
      </p>
      <StepControls steps={steps} />
      <HandMethod run={run} shown={steps.shown} />
    </>
  );
}

export function PowerPage() {
  const [params] = useSearchParams();
  const start = {
    a: params.get('a') ?? '88',
    b: params.get('b') ?? '7',
    n: params.get('n') ?? '187',
  };
  const compute = (a: string, b: string, n: string) =>
    power(parseWhole(a, 'a'), parseWhole(b, 'the exponent', 1n), parseWhole(n, 'n', 2n));
  const [aText, setA] = useState(start.a),
    [bText, setB] = useState(start.b),
    [nText, setN] = useState(start.n),
    [error, setError] = useState(''),
    [view, setView] = useState<'hand' | 'table'>('hand'),
    [run, setRun] = useState<PowerResult | null>(() => {
      try {
        return compute(start.a, start.b, start.n);
      } catch {
        return null;
      }
    });
  const calculate = (a = aText, b = bText, n = nText) => {
    try {
      setRun(compute(a, b, n));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <article>
      <header>
        <p className="eyebrow">Lesson 4 · Chapter 9 · Exponentiation</p>
        <h1>Fast powers: square and multiply</h1>
      </header>
      <Idea>
        To compute <Num>a^b mod n</Num> you never need the giant number a^b. Square, reduce mod n,
        square again, and multiply together only the squares you need. The numbers stay small the
        whole time.
      </Idea>
      <UsedFor>
        Locking is C = M^e mod n and unlocking is M = C^d mod n. With real keys d has hundreds of
        digits, so this is the only way it can be done.
      </UsedFor>
      <SlideRef>ch09 “Exponentiation” and “Exponentiation: Example” (Table 9.3).</SlideRef>
      <Words terms={['mod', 'exponent']} />
      <InputForm
        summary={run ? `${run.a}^${run.exponent} mod ${run.n}` : 'no numbers yet'}
        onSubmit={() => calculate()}
        onExample={() => {
          setA('88');
          setB('7');
          setN('187');
          calculate('88', '7', '187');
        }}
        error={error}
      >
        <Field id="pow-a" label="a (base)" value={aText} onChange={setA} />
        <Field id="pow-b" label="b (exponent)" value={bText} onChange={setB} />
        <Field id="pow-n" label="n (modulus)" value={nText} onChange={setN} />
      </InputForm>
      {run && (
        <>
          <TabList
            id="power"
            label="How to show the calculation"
            items={[
              { id: 'hand', label: 'By hand (squares, then multiply)' },
              { id: 'table', label: 'The lecture table (i, bᵢ, c, f)' },
            ]}
            value={view}
            onChange={setView}
          />
          <TabPanel id="power" value={view}>
            {view === 'hand' ? (
              <HandSteps key={`h-${run.a}-${run.exponent}-${run.n}`} run={run} />
            ) : (
              <LectureSteps key={`t-${run.a}-${run.exponent}-${run.n}`} run={run} />
            )}
          </TabPanel>
        </>
      )}
    </article>
  );
}
