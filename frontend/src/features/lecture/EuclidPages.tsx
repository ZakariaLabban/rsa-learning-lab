import { useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { extendedEuclid, gcdTable, parseWhole, type EeaResult, type GcdRow } from './model';
import {
  Field,
  fmt,
  Idea,
  InputForm,
  SlideRef,
  StepControls,
  UsedFor,
  useSteps,
  Words,
  LessonHeader,
  Procedure,
  CheckAnswer,
} from './parts';

// GCD (ch04: "Example GCD(1970,1066)")
type GcdRun = { a: bigint; b: bigint; rows: GcdRow[]; gcd: bigint };

function GcdSteps({ run }: { run: GcdRun }) {
  const steps = useSteps(Math.max(1, run.rows.length));
  const last = run.rows[steps.shown - 1];
  // every row does lines 3-5, then line 2 (stop) or line 6 (repeat)
  const active = [...(steps.shown === 1 ? [1] : []), 3, 4, 5, last.remainder === 0n ? 2 : 6];
  return (
    <>
      <Procedure
        id="Algorithm 1.1"
        name="EUCLID(a, b)"
        input="integers a and b"
        output="gcd(a, b)"
        active={active}
        lines={[
          { text: 'A = a ; B = b' },
          { text: 'if B = 0 return A = gcd(a, b)' },
          { text: 'R = A mod B' },
          { text: 'A = B' },
          { text: 'B = R' },
          { text: 'goto 2' },
        ]}
      />
      <CheckAnswer
        key={`check-${run.a}-${run.b}`}
        id="gcd-check"
        question={
          <>
            Work it out on paper, then type gcd({fmt(run.a)}, {fmt(run.b)}):
          </>
        }
        answer={run.gcd}
        wrongHint="Not quite. Divide the bigger number by the smaller one, keep the remainder, and repeat. The gcd is the last divisor before the remainder reaches 0. Step through the table to compare."
      />
      <StepControls steps={steps} />
      <div
        className="table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Table, scrolls sideways on narrow screens"
      >
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
      <LessonHeader title="Greatest common divisor" />
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

// inverse (ch04: "Finding Inverses", "Inverse of 550 in GF(1759)")
type Mark = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  kind: 'src' | 'dst';
  // true if the cell is in the highlighted row (outline needs to be dark)
  band: boolean;
};

// extended euclid table. with `links` the newest row outlines the cells it was
// calculated from. `column` = which of B1, B2, B3 to show
export function EeaTable({
  run,
  shown,
  links = false,
  column = 2,
}: {
  run: EeaResult;
  shown: number;
  links?: boolean;
  column?: number;
}) {
  const done = shown >= run.rows.length;
  const [hideSkip, setHideSkip] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<{ list: Mark[]; width: number; height: number }>({
    list: [],
    width: 0,
    height: 0,
  });
  useLayoutEffect(() => {
    const box = wrap.current;
    if (!links || !box || shown < 2) {
      setMarks({ list: [], width: 0, height: 0 });
      return;
    }
    const measure = () => {
      const base = box.getBoundingClientRect();
      const at = (row: number, col: number, label: string, kind: Mark['kind']): Mark | null => {
        const cell = box.querySelector<HTMLElement>(`[data-r="${row}"][data-c="${col}"]`);
        if (!cell) return null;
        const r = cell.getBoundingClientRect();
        return {
          x: r.left - base.left + box.scrollLeft,
          y: r.top - base.top,
          w: r.width,
          h: r.height,
          label,
          kind,
          band: row === shown - 1,
        };
      };
      const r = shown - 1;
      const list = [
        at(r - 1, 1 + column, 'A', 'src'),
        at(r - 1, 4 + column, 'B', 'src'),
        at(r, 0, 'Q', 'src'),
        at(r, 4 + column, 'new B', 'dst'),
      ].filter((mark): mark is Mark => mark !== null);
      setMarks({ list, width: box.scrollWidth, height: box.scrollHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    const table = box.querySelector('table');
    if (table) observer.observe(table);
    let live = true;
    void document.fonts?.ready.then(() => live && measure());
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [links, shown, run, column, hideSkip]);
  return (
    <>
      {links && (
        <p className="skip-note">
          <b>You can skip A1 and B1.</b> The inverse only needs A2, B2, A3 and B3, so those two
          columns never change the answer.{' '}
          <button
            type="button"
            className="quiet"
            aria-pressed={hideSkip}
            onClick={() => setHideSkip(!hideSkip)}
          >
            {hideSkip ? 'Show A1 and B1' : 'Hide A1 and B1'}
          </button>
        </p>
      )}
      <div
        className="table-wrap"
        ref={wrap}
        tabIndex={0}
        role="region"
        aria-label="Table, scrolls sideways on narrow screens"
      >
        <table className={`grid eea${hideSkip ? ' hide-skip' : ''}`}>
          <thead>
            <tr>
              <th scope="col">Q</th>
              <th scope="col" className="skippable">
                A1
              </th>
              <th scope="col">A2</th>
              <th scope="col">A3</th>
              <th scope="col" className="split skippable">
                B1
              </th>
              <th scope="col">B2</th>
              <th scope="col">B3</th>
            </tr>
          </thead>
          <tbody>
            {run.rows.slice(0, shown).map((row, index) => {
              const isLast = index === run.rows.length - 1 && done;
              const cells = [
                row.q === null ? '—' : fmt(row.q),
                fmt(row.A[0]),
                fmt(row.A[1]),
                fmt(row.A[2]),
                fmt(row.B[0]),
                fmt(row.B[1]),
                fmt(row.B[2]),
              ];
              return (
                <tr key={index} className={index === shown - 1 ? 'current' : ''}>
                  {cells.map((text, col) => (
                    <td
                      key={col}
                      data-r={index}
                      data-c={col}
                      className={
                        col === 4
                          ? 'split skippable'
                          : col === 1
                            ? 'skippable'
                            : col === 5 && isLast && run.inverse !== null
                              ? 'answer'
                              : undefined
                      }
                    >
                      {text}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {links && marks.list.length > 0 && (
          <svg
            className="links"
            aria-hidden="true"
            width={marks.width}
            height={marks.height}
            key={`${shown}-${column}`}
          >
            {marks.list.map((mark, index) => (
              <g
                key={index}
                style={{ ['--d' as string]: `${index * 0.12}s` }}
                className={`${mark.kind} ${mark.band ? 'band' : 'paper'}`}
              >
                <rect
                  className="box"
                  pathLength={1}
                  x={mark.x + 1.5}
                  y={mark.y + 1.5}
                  width={mark.w - 3}
                  height={mark.h - 3}
                />
                <g className="tag" transform={`translate(${mark.x + 2} ${mark.y - 1})`}>
                  <rect width={mark.label.length * 7.4 + 9} height="14" />
                  <text x="4.5" y="10.5">
                    {mark.label}
                  </text>
                </g>
              </g>
            ))}
          </svg>
        )}
      </div>
    </>
  );
}

function EeaExplain({
  run,
  shown,
  column,
  onPick,
}: {
  run: EeaResult;
  shown: number;
  column: number;
  onPick: (column: number) => void;
}) {
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
      <p>
        New B = old A − Q × old B, and the new A is the old B. Pick a line to see where its number
        came from in the table:
      </p>
      <ul className="lines plain">
        {[0, 1, 2].map((c) => (
          <li key={c}>
            <button
              type="button"
              className="pick"
              aria-pressed={column === c}
              onClick={() => onPick(c)}
            >
              B{c + 1} = {fmt(prev.A[c])} − {fmt(q)} × {fmt(prev.B[c])} = <b>{fmt(row.B[c])}</b>
            </button>
          </li>
        ))}
      </ul>
      <p>{check}</p>
    </div>
  );
}

function EeaSteps({ run }: { run: EeaResult }) {
  const steps = useSteps(run.rows.length);
  const [column, setColumn] = useState(2);
  const last = run.rows[run.rows.length - 1];
  const row = run.rows[steps.shown - 1];
  // first row = line 1, later rows = lines 4-7
  const decided = row.B[2] === 0n ? 2 : row.B[2] === 1n ? 3 : 8;
  const active = steps.shown === 1 ? [1, decided] : [4, 5, 6, 7, decided];
  return (
    <>
      <Procedure
        id="Algorithm 1.2"
        name="EXTENDED EUCLID(m, b)"
        input="integers m and b"
        output="b⁻¹ mod m, or no inverse"
        active={active}
        lines={[
          { text: '(A1, A2, A3) = (1, 0, m) ; (B1, B2, B3) = (0, 1, b)' },
          { text: 'if B3 = 0 return A3 = gcd(m, b) ; no inverse' },
          { text: 'if B3 = 1 return B3 = gcd(m, b) ; B2 = b⁻¹ mod m' },
          { text: 'Q = A3 div B3' },
          { text: '(T1, T2, T3) = (A1 − Q B1, A2 − Q B2, A3 − Q B3)' },
          { text: '(A1, A2, A3) = (B1, B2, B3)' },
          { text: '(B1, B2, B3) = (T1, T2, T3)' },
          { text: 'goto 2' },
        ]}
      />
      <StepControls steps={steps} />
      <EeaTable run={run} shown={steps.shown} links column={column} />
      <EeaExplain run={run} shown={steps.shown} column={column} onPick={setColumn} />
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
      <LessonHeader title="Inverse of b mod m" />
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
