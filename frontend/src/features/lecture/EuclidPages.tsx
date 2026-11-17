import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { extendedEuclid, gcdTable, parseWhole, type EeaResult, type GcdRow } from './model';
import {
  Collapse,
  Field,
  fmt,
  Idea,
  InputForm,
  SlideRef,
  StepControls,
  UsedFor,
  useSteps,
  Words,
} from './parts';

/* ───────────── GCD (ch04: "Example GCD(1970,1066)") ───────────── */

type GcdRun = { a: bigint; b: bigint; rows: GcdRow[]; gcd: bigint };

function GcdSteps({ run }: { run: GcdRun }) {
  const steps = useSteps(Math.max(1, run.rows.length));
  const last = run.rows[steps.shown - 1];
  return (
    <>
      <StepControls steps={steps} />
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Division: dividend = quotient × divisor + remainder</th>
              <th scope="col">Next pair</th>
            </tr>
          </thead>
          <tbody>
            {run.rows.slice(0, steps.shown).map((row, index) => (
              <tr key={index} className={index === steps.shown - 1 ? 'current' : ''}>
                <td>{index + 1}</td>
                <td className="eq">
                  {fmt(row.dividend)} = {fmt(row.quotient)} × {fmt(row.divisor)} +{' '}
                  <strong>{fmt(row.remainder)}</strong>
                </td>
                <td>
                  gcd({fmt(row.divisor)}, {fmt(row.remainder)})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="explain" aria-live="polite">
        {fmt(last.dividend)} ÷ {fmt(last.divisor)} gives quotient {fmt(last.quotient)} and remainder{' '}
        {fmt(last.remainder)}, so {fmt(last.dividend)} = {fmt(last.quotient)} × {fmt(last.divisor)}{' '}
        + {fmt(last.remainder)}. Then gcd({fmt(last.dividend)}, {fmt(last.divisor)}) = gcd(
        {fmt(last.divisor)}, {fmt(last.remainder)}).
        {last.remainder === 0n
          ? ` The remainder is 0, so we stop: the gcd is the last divisor, ${fmt(last.divisor)}.`
          : ' The remainder is not 0 yet, so repeat with the new pair.'}
      </p>
      {steps.done && (
        <p className="result">
          gcd({fmt(run.a)}, {fmt(run.b)}) = <strong>{fmt(run.gcd)}</strong>
          {run.gcd === 1n && ' — relatively prime.'}
        </p>
      )}
    </>
  );
}

export function GcdPage() {
  const [aText, setA] = useState('1970'),
    [bText, setB] = useState('1066'),
    [error, setError] = useState(''),
    [run, setRun] = useState<GcdRun | null>(() => ({
      a: 1970n,
      b: 1066n,
      ...gcdTable(1970n, 1066n),
    }));
  const calculate = (aValue = aText, bValue = bText) => {
    try {
      const a = parseWhole(aValue, 'a'),
        b = parseWhole(bValue, 'b');
      if (b === 0n) throw new Error('b must be at least 1 (gcd(a, 0) = a already).');
      setRun({ a, b, ...gcdTable(a, b) });
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <article>
      <header>
        <p className="eyebrow">Lesson 2 · Chapter 4 · Euclidean algorithm</p>
        <h1>Greatest common divisor</h1>
      </header>
      <Idea>
        The <b>gcd</b> of two numbers is the biggest number that divides both. Euclid’s trick:
        gcd(a, b) = gcd(b, a mod b). Divide, keep the remainder, and repeat with the pair (divisor,
        remainder) until the remainder is 0. The last divisor is the gcd.
      </Idea>
      <UsedFor>
        The number e in an RSA key must share no factor with φ(n), that is gcd(e, φ(n)) = 1. This
        table is how you check it.
      </UsedFor>
      <SlideRef>
        ch04 “Greatest Common Divisor”, “Euclidean Algorithm”, “Example GCD(1970,1066)”.
      </SlideRef>
      <Words terms={['mod', 'gcd', 'coprime']} />
      <InputForm
        summary={run ? `a = ${run.a}, b = ${run.b}` : 'no numbers yet'}
        onSubmit={() => calculate()}
        onExample={() => {
          setA('1970');
          setB('1066');
          calculate('1970', '1066');
        }}
        error={error}
      >
        <Field id="gcd-a" label="a" value={aText} onChange={setA} />
        <Field id="gcd-b" label="b" value={bText} onChange={setB} />
      </InputForm>
      {run && <GcdSteps key={`${run.a}-${run.b}`} run={run} />}
    </article>
  );
}

/* ───────────── Inverse (ch04: "Finding Inverses", "Inverse of 550 in GF(1759)") ───────────── */

export function EeaTable({ run, shown }: { run: EeaResult; shown: number }) {
  const done = shown >= run.rows.length;
  return (
    <div className="table-wrap">
      <table className="grid eea">
        <thead>
          <tr>
            <th scope="col">Q</th>
            <th scope="col">A1</th>
            <th scope="col">A2</th>
            <th scope="col">A3</th>
            <th scope="col" className="split">
              B1
            </th>
            <th scope="col">B2</th>
            <th scope="col">B3</th>
          </tr>
        </thead>
        <tbody>
          {run.rows.slice(0, shown).map((row, index) => {
            const isLast = index === run.rows.length - 1 && done;
            return (
              <tr key={index} className={index === shown - 1 ? 'current' : ''}>
                <td>{row.q === null ? '—' : fmt(row.q)}</td>
                <td>{fmt(row.A[0])}</td>
                <td>{fmt(row.A[1])}</td>
                <td>{fmt(row.A[2])}</td>
                <td className="split">{fmt(row.B[0])}</td>
                <td className={isLast && run.inverse !== null ? 'answer' : ''}>{fmt(row.B[1])}</td>
                <td>{fmt(row.B[2])}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EeaExplain({ run, shown }: { run: EeaResult; shown: number }) {
  const index = shown - 1,
    row = run.rows[index];
  const check = (
    <>
      {' '}
      {row.B[2] === 0n ? (
        <>
          B3 = 0, so we stop: gcd({fmt(run.m)}, {fmt(run.b)}) = A3 = {fmt(row.A[2])}. There is{' '}
          <b>no inverse</b>.
        </>
      ) : row.B[2] === 1n ? (
        <>
          B3 = 1, so we stop: <b>B2 is the inverse</b> of {fmt(run.b)} mod {fmt(run.m)}.
        </>
      ) : (
        <>B3 = {fmt(row.B[2])} is not 0 or 1, so go on.</>
      )}
    </>
  );
  if (index === 0)
    return (
      <p className="explain" aria-live="polite">
        Start: (A1, A2, A3) = (1, 0, m) = (1, 0, {fmt(run.m)}) and (B1, B2, B3) = (0, 1, b) = (0, 1,{' '}
        {fmt(run.b)}).{check}
      </p>
    );
  const prev = run.rows[index - 1];
  const q = row.q!;
  return (
    <div className="explain" aria-live="polite">
      <p>
        Q = A3 div B3 = {fmt(prev.A[2])} div {fmt(prev.B[2])} = <b>{fmt(q)}</b>
      </p>
      <p>New B = old A − Q × old B, and the new A is the old B:</p>
      <ul className="lines plain">
        {[0, 1, 2].map((c) => (
          <li key={c}>
            B{c + 1} = {fmt(prev.A[c])} − {fmt(q)} × {fmt(prev.B[c])} = <b>{fmt(row.B[c])}</b>
          </li>
        ))}
      </ul>
      <p>{check}</p>
    </div>
  );
}

function EeaSteps({ run }: { run: EeaResult }) {
  const steps = useSteps(run.rows.length);
  const last = run.rows[run.rows.length - 1];
  return (
    <>
      <StepControls steps={steps} />
      <EeaTable run={run} shown={steps.shown} />
      <EeaExplain run={run} shown={steps.shown} />
      {steps.done && run.inverse !== null && (
        <div className="result">
          <p>
            B2 = {fmt(run.b2!)}
            {run.b2! < 0n && ` is negative, so add ${fmt(run.m)}: ${fmt(run.inverse)}`}.
          </p>
          <p>
            {fmt(run.b)}
            <sup>−1</sup> mod {fmt(run.m)} = <strong>{fmt(run.inverse)}</strong>
          </p>
          <p className="check">
            Check: {fmt(run.b)} × {fmt(run.inverse)} = {fmt(run.b * run.inverse)} ={' '}
            {fmt((run.b * run.inverse - 1n) / run.m)} × {fmt(run.m)} + 1, so it is 1 (mod{' '}
            {fmt(run.m)}). In the lecture's words: {fmt(run.m)}x + {fmt(run.b)}y = 1 with x ={' '}
            {fmt(last.B[0])} and y = {fmt(last.B[1])}.
          </p>
        </div>
      )}
      {steps.done && run.inverse === null && (
        <p className="result">
          gcd({fmt(run.m)}, {fmt(run.b)}) = <strong>{fmt(run.gcd)}</strong>, which is not 1, so{' '}
          {fmt(run.b)} has <strong>no inverse</strong> mod {fmt(run.m)}.
        </p>
      )}
    </>
  );
}

export function InversePage() {
  const [params] = useSearchParams();
  const startM = params.get('m') ?? '1759',
    startB = params.get('b') ?? '550';
  const compute = (mText: string, bText: string) => {
    const m = parseWhole(mText, 'm', 2n),
      b = parseWhole(bText, 'b');
    return extendedEuclid(m, b);
  };
  const [mText, setM] = useState(startM),
    [bText, setB] = useState(startB),
    [error, setError] = useState(''),
    [run, setRun] = useState<EeaResult | null>(() => {
      try {
        return compute(startM, startB);
      } catch {
        return null;
      }
    });
  const calculate = (m = mText, b = bText) => {
    try {
      setRun(compute(m, b));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <article>
      <header>
        <p className="eyebrow">Lesson 3 · Chapter 4 · Extended Euclidean algorithm</p>
        <h1>Inverse of b mod m</h1>
      </header>
      <Idea>
        The <b>inverse</b> of b mod m is the number x with b × x = 1 (mod m). It “undoes”
        multiplication by b, like dividing. The Extended Euclid table finds it, and also tells you
        when there is none.
      </Idea>
      <UsedFor>
        The private key d is the inverse of the public exponent e: d = e⁻¹ mod φ(n). This table is
        how d is found.
      </UsedFor>
      <SlideRef>ch04 “Finding Inverses” and “Inverse of 550 in GF(1759)”.</SlideRef>
      <Collapse title="The rules of the table">
        <p>
          Start with (A1, A2, A3) = (1, 0, m) and (B1, B2, B3) = (0, 1, b). In each row: Q = A3 div
          B3, the new B = old A − Q × old B, and the new A is the old B. Stop when B3 is 1 (then B2
          is the inverse) or 0 (there is no inverse).
        </p>
      </Collapse>
      <Words terms={['mod', 'inverse', 'gcd', 'coprime']} />
      <InputForm
        summary={run ? `b = ${run.b}, m = ${run.m}` : 'no numbers yet'}
        onSubmit={() => calculate()}
        onExample={() => {
          setM('1759');
          setB('550');
          calculate('1759', '550');
        }}
        error={error}
      >
        <Field id="inv-m" label="m (the modulus)" value={mText} onChange={setM} />
        <Field id="inv-b" label="b (find its inverse)" value={bText} onChange={setB} />
      </InputForm>
      {run && (
        <>
          {run.reduced && (
            <p className="note">
              b is larger than m, so it is first reduced: b mod m = {fmt(run.b)}.
            </p>
          )}
          <EeaSteps key={`${run.m}-${run.b}`} run={run} />
        </>
      )}
    </article>
  );
}
