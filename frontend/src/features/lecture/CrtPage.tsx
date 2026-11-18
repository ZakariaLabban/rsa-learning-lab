import { useState } from 'react';
import { crtDecrypt, crtSolve, crtSplit, type CrtDecryption, type CrtResult } from './advanced';
import { EeaTable } from './EuclidPages';
import { parseWhole, rsaSetup, power } from './model';
import {
  Collapse,
  Field,
  fmt,
  HandMethod,
  Idea,
  InputForm,
  Num,
  Pow,
  SlideRef,
  UsedFor,
  Words,
  StepControls,
  useSteps,
  TabList,
  TabPanel,
  LessonHeader,
} from './parts';

function parseList(text: string, name: string, min = 0n): bigint[] {
  const parts = text
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new Error(`Enter ${name}, separated by commas.`);
  return parts.map((part) => parseWhole(part, name, min));
}

// CRT steps from the lecture, one card each. `from` = what we started with
export function CrtCards({ crt, shown, from }: { crt: CrtResult; shown: number; from: string }) {
  const k = crt.rows.length;
  const cards = [
    <li key="residues">
      <h3>Step 1 · The residues aᵢ = A mod mᵢ</h3>
      <p>{from}</p>
      <p>
        {crt.rows.map((row, i) => (
          <span key={i}>
            a<sub>{i + 1}</sub> = {fmt(row.a)} (mod {fmt(row.m)}){i < k - 1 ? ' · ' : ''}
          </span>
        ))}
      </p>
    </li>,
    <li key="M">
      <h3>Step 2 · M = m₁ × m₂ × …</h3>
      <p>
        M = {crt.rows.map((row) => fmt(row.m)).join(' × ')} = <strong>{fmt(crt.M)}</strong>. The
        answer A will be a number from 0 to {fmt(crt.M - 1n)}.
      </p>
    </li>,
    ...crt.rows.map((row, i) => (
      <li key={`c${i}`}>
        <h3>
          Step {3 + i} · c<sub>{i + 1}</sub> for m<sub>{i + 1}</sub> = {fmt(row.m)}
        </h3>
        <p>
          M<sub>{i + 1}</sub> = M / m<sub>{i + 1}</sub> = {fmt(crt.M)} / {fmt(row.m)} ={' '}
          <strong>{fmt(row.Mi)}</strong>
        </p>
        <p>
          Inverse: M<sub>{i + 1}</sub>
          <sup>−1</sup> mod {fmt(row.m)} = {fmt(row.Mi % row.m)}
          <sup>−1</sup> mod {fmt(row.m)} = <strong>{fmt(row.invValue)}</strong>
        </p>
        <Collapse title="Show the Extended Euclid table for this inverse">
          <EeaTable run={row.inverse} shown={row.inverse.rows.length} />
        </Collapse>
        <p>
          c<sub>{i + 1}</sub> = M<sub>{i + 1}</sub> × (M<sub>{i + 1}</sub>
          <sup>−1</sup> mod m<sub>{i + 1}</sub>) = {fmt(row.Mi)} × {fmt(row.invValue)} ={' '}
          <strong>{fmt(row.c)}</strong>
        </p>
      </li>
    )),
    <li key="sum">
      <h3>Step {3 + k} · Combine: A = (Σ aᵢ cᵢ) mod M</h3>
      <ul className="lines plain">
        {crt.rows.map((row, i) => (
          <li key={i}>
            a<sub>{i + 1}</sub> × c<sub>{i + 1}</sub> = {fmt(row.a)} × {fmt(row.c)} ={' '}
            {fmt(row.term)}
          </li>
        ))}
      </ul>
      <p>
        Sum = {fmt(crt.sum)}, and {fmt(crt.sum)} mod {fmt(crt.M)} = <strong>{fmt(crt.A)}</strong>
      </p>
    </li>,
  ];
  return (
    <ol className="mr-steps">
      {cards.slice(0, shown).map((card, index) => (
        <li key={card.key} className={index === shown - 1 ? 'current' : ''}>
          {card.props.children}
        </li>
      ))}
    </ol>
  );
}

function RebuildTab() {
  const [moduliText, setModuli] = useState('3, 5, 7'),
    [valueText, setValue] = useState('52'),
    [residuesText, setResiduesText] = useState('1, 2, 3'),
    [mode, setMode] = useState<'A' | 'residues'>('A'),
    [error, setError] = useState('');
  type Input = { moduli: string; value: string; residues: string; mode: 'A' | 'residues' };
  const current = (): Input => ({
    moduli: moduliText,
    value: valueText,
    residues: residuesText,
    mode,
  });
  const compute = (input: Input) => {
    const moduli = parseList(input.moduli, 'the moduli', 2n);
    if (input.mode === 'A') {
      const A = parseWhole(input.value, 'A');
      return {
        crt: crtSolve(moduli, crtSplit(A, moduli)),
        from: `Start with A = ${A} and divide it by each modulus.`,
        A,
      };
    }
    const residues = parseList(input.residues, 'the residues');
    return {
      crt: crtSolve(moduli, residues),
      from: 'You gave the residues directly.',
      A: null,
    };
  };
  const [run, setRun] = useState(() => {
    try {
      return compute(current());
    } catch {
      return null;
    }
  });
  const calculate = (input: Input = current()) => {
    try {
      setRun(compute(input));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <>
      <InputForm
        summary={
          run
            ? `moduli ${run.crt.moduli.join(', ')}, residues ${run.crt.rows.map((r) => r.a).join(', ')}`
            : ''
        }
        onSubmit={() => calculate()}
        onExample={() => {
          setMode('A');
          setModuli('3, 5, 7');
          setValue('52');
          calculate({ moduli: '3, 5, 7', value: '52', residues: residuesText, mode: 'A' });
        }}
        error={error}
      >
        <div className="field wide">
          <span className="label">Start from</span>
          <div className="radios" role="radiogroup" aria-label="What do you know?">
            <label>
              <input
                type="radio"
                name="crt-mode"
                checked={mode === 'A'}
                onChange={() => setMode('A')}
              />{' '}
              the number A
            </label>
            <label>
              <input
                type="radio"
                name="crt-mode"
                checked={mode === 'residues'}
                onChange={() => setMode('residues')}
              />{' '}
              the residues
            </label>
          </div>
        </div>
        <Field
          id="crt-moduli"
          label="Moduli m₁, m₂, … (pairwise relatively prime)"
          value={moduliText}
          onChange={setModuli}
        />
        {mode === 'A' ? (
          <Field id="crt-a" label="A" value={valueText} onChange={setValue} />
        ) : (
          <Field
            id="crt-res"
            label="Residues a₁, a₂, … (one per modulus)"
            value={residuesText}
            onChange={setResiduesText}
          />
        )}
      </InputForm>
      {run && (
        <CrtSteps
          key={`${run.crt.M}-${run.crt.A}-${run.from}`}
          crt={run.crt}
          from={run.from}
          A={run.A}
        />
      )}
    </>
  );
}

function CrtSteps({ crt, from, A }: { crt: CrtResult; from: string; A: bigint | null }) {
  const steps = useSteps(crt.rows.length + 3);
  return (
    <>
      <StepControls steps={steps} />
      <CrtCards crt={crt} shown={steps.shown} from={from} />
      {steps.done && (
        <p className="result">
          A ≡ <strong>{fmt(crt.A)}</strong> (mod {fmt(crt.M)})
          {A !== null && A % crt.M === crt.A && (
            <>
              {' '}
              — it matches {fmt(A)} mod {fmt(crt.M)}. ✓
            </>
          )}
        </p>
      )}
    </>
  );
}

function DecryptCards({ run, shown }: { run: CrtDecryption; shown: number }) {
  const { p, q, n, C, d } = run;
  const cards = [
    <li key="intro">
      <h3>Step 1 · Why CRT?</h3>
      <p>
        Direct decryption computes <Pow base={fmt(C)} exp={fmt(d)} /> mod {fmt(n)} with a big
        exponent. Only the key owner knows p = {fmt(p)} and q = {fmt(q)}, so they can work mod p and
        mod q separately (smaller numbers, about 4 times faster), then combine with the CRT.
      </p>
    </li>,
    ...run.parts.map((part, i) => (
      <li key={`p${i}`}>
        <h3>
          Step {2 + i} · Decrypt mod {i === 0 ? 'p' : 'q'} = {fmt(part.prime)}
        </h3>
        <p>
          C mod {fmt(part.prime)} = {fmt(C)} mod {fmt(part.prime)} = <strong>{fmt(part.cr)}</strong>
        </p>
        <p>
          Fermat says a<sup>{fmt(part.prime - 1n)}</sup> = 1 (mod {fmt(part.prime)}), so the
          exponent can be shortened: d mod (p − 1) = {fmt(d)} mod {fmt(part.prime - 1n)} ={' '}
          <strong>{fmt(d % (part.prime - 1n))}</strong>
          {part.exponentAdjusted && ` (0, so we use ${fmt(part.prime - 1n)})`}.
        </p>
        {part.run ? (
          <>
            <p>
              M<sub>{i === 0 ? 'p' : 'q'}</sub> ={' '}
              <Pow base={fmt(part.cr)} exp={fmt(part.exponent)} /> mod {fmt(part.prime)} ={' '}
              <strong>{fmt(part.value)}</strong>
            </p>
            <Collapse title="Show how this power is calculated">
              <HandMethod run={part.run} />
            </Collapse>
          </>
        ) : (
          <p>
            C mod {fmt(part.prime)} = 0, so M<sub>{i === 0 ? 'p' : 'q'}</sub> = 0.
          </p>
        )}
      </li>
    )),
    <li key="combine">
      <h3>Step 4 · Combine with the CRT</h3>
      <p>
        We know M ≡ {fmt(run.parts[0].value)} (mod {fmt(p)}) and M ≡ {fmt(run.parts[1].value)} (mod{' '}
        {fmt(q)}). In the CRT recipe the moduli are m₁ = p = {fmt(p)} and m₂ = q = {fmt(q)}, and the
        residues are a₁ = M<sub>p</sub> = {fmt(run.parts[0].value)} and a₂ = M<sub>q</sub> ={' '}
        {fmt(run.parts[1].value)}.
      </p>
      <p>
        M = m₁ × m₂ = {fmt(p)} × {fmt(q)} = {fmt(n)}
      </p>
      {run.combine.rows.map((row, i) => (
        <ul className="lines plain crt-row" key={i}>
          <li>
            <b>
              For m{i === 0 ? '₁' : '₂'} = {fmt(row.m)}:
            </b>
          </li>
          <li>
            M<sub>{i + 1}</sub> = M / m<sub>{i + 1}</sub> = {fmt(n)} / {fmt(row.m)} ={' '}
            <strong>{fmt(row.Mi)}</strong>
          </li>
          <li>
            M<sub>{i + 1}</sub>
            <sup>−1</sup> mod {fmt(row.m)} = <strong>{fmt(row.invValue)}</strong>
          </li>
          <li>
            c<sub>{i + 1}</sub> = M<sub>{i + 1}</sub> × {fmt(row.invValue)} = {fmt(row.Mi)} ×{' '}
            {fmt(row.invValue)} = <strong>{fmt(row.c)}</strong>
          </li>
          <li>
            a<sub>{i + 1}</sub> × c<sub>{i + 1}</sub> = {fmt(row.a)} × {fmt(row.c)} ={' '}
            <strong>{fmt(row.term)}</strong>
          </li>
        </ul>
      ))}
      <p>
        M = ({run.combine.rows.map((row) => fmt(row.term)).join(' + ')}) mod {fmt(n)} ={' '}
        <strong>{fmt(run.M)}</strong>
      </p>
    </li>,
  ];
  return (
    <ol className="mr-steps">
      {cards.slice(0, shown).map((card, index) => (
        <li key={card.key} className={index === shown - 1 ? 'current' : ''}>
          {card.props.children}
        </li>
      ))}
    </ol>
  );
}

function DecryptSteps({ run }: { run: CrtDecryption }) {
  const steps = useSteps(4);
  const direct = power(run.C, run.d, run.n).result;
  return (
    <>
      <StepControls steps={steps} />
      <DecryptCards run={run} shown={steps.shown} />
      {steps.done && (
        <p className="result">
          M = <strong>{fmt(run.M)}</strong>.{' '}
          {run.M === direct
            ? `Direct decryption ${fmt(run.C)}^${fmt(run.d)} mod ${fmt(run.n)} gives the same ${fmt(direct)}. ✓`
            : 'Something is wrong: the two methods disagree.'}
        </p>
      )}
    </>
  );
}

function DecryptTab() {
  const [pText, setP] = useState('17'),
    [qText, setQ] = useState('11'),
    [eText, setE] = useState('7'),
    [cText, setC] = useState('11'),
    [error, setError] = useState('');
  const compute = (p = pText, q = qText, e = eText, c = cText) => {
    const setup = rsaSetup(parseWhole(p, 'p'), parseWhole(q, 'q'), parseWhole(e, 'e'));
    return crtDecrypt(parseWhole(c, 'C'), setup.d, setup.p, setup.q);
  };
  const [run, setRun] = useState<CrtDecryption | null>(() => compute());
  const calculate = (...args: string[]) => {
    try {
      setRun(compute(...args));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <>
      <InputForm
        summary={run ? `p = ${run.p}, q = ${run.q}, C = ${run.C}, d = ${run.d}` : ''}
        onSubmit={() => calculate()}
        onExample={() => {
          setP('17');
          setQ('11');
          setE('7');
          setC('11');
          calculate('17', '11', '7', '11');
        }}
        error={error}
      >
        <Field id="crtd-p" label="p (prime)" value={pText} onChange={setP} />
        <Field id="crtd-q" label="q (prime)" value={qText} onChange={setQ} />
        <Field id="crtd-e" label="e" value={eText} onChange={setE} />
        <Field id="crtd-c" label="C (ciphertext)" value={cText} onChange={setC} />
      </InputForm>
      {run && <DecryptSteps key={`${run.n}-${run.C}-${run.d}`} run={run} />}
    </>
  );
}

export function CrtPage() {
  const [tab, setTab] = useState<'rebuild' | 'decrypt'>('rebuild');
  return (
    <article>
      <LessonHeader title="Chinese Remainder Theorem" />
      <Idea>
        A number A below M = m₁m₂…mₖ is completely described by its remainders (a₁, a₂, …, aₖ) when
        the mᵢ share no factors. We can work with the small moduli separately, then rebuild A.
      </Idea>
      <SlideRef>
        ch08 “Chinese Remainder Theorem” (two slides) and ch09 “Efficient Decryption”.
      </SlideRef>
      <UsedFor>
        RSA decryption can be made about four times faster by working mod p and mod q separately and
        rebuilding the answer with the CRT. The small-e attack uses it too.
      </UsedFor>
      <Words terms={['mod', 'coprime', 'inverse', 'residue']} />
      <Collapse title="The four formulas" open>
        <dl className="formulas">
          <div>
            <dt>1. The residues</dt>
            <dd>
              <Num>aᵢ = A mod mᵢ</Num>
            </dd>
          </div>
          <div>
            <dt>2. The product of the moduli</dt>
            <dd>
              <Num>M = m₁ × m₂ × … × mₖ</Num> and <Num>Mᵢ = M / mᵢ</Num>
            </dd>
          </div>
          <div>
            <dt>3. One helper number for each modulus</dt>
            <dd>
              <Num>cᵢ = Mᵢ × (Mᵢ⁻¹ mod mᵢ)</Num>
            </dd>
          </div>
          <div>
            <dt>4. Rebuild A</dt>
            <dd>
              <Num>A = (a₁c₁ + a₂c₂ + … + aₖcₖ) mod M</Num>
            </dd>
          </div>
        </dl>
      </Collapse>
      <TabList
        id="crt"
        label="CRT topics"
        items={[
          { id: 'rebuild', label: 'Rebuild A from its residues' },
          { id: 'decrypt', label: 'Faster RSA decryption' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <TabPanel id="crt" value={tab}>
        {tab === 'rebuild' ? <RebuildTab /> : <DecryptTab />}
      </TabPanel>
    </article>
  );
}
