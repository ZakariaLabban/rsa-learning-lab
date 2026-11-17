import { useState } from 'react';
import { fermat, reducedResidues, whyRsaWorks, type WhyRsaRun } from './advanced';
import { parseWhole, rsaSetup } from './model';
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
} from './parts';

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

/* ───────────── Part 1: Fermat and Euler ───────────── */

function FermatPart() {
  const [aText, setA] = useState('7'),
    [pText, setP] = useState('19'),
    [nText, setN] = useState('10'),
    [error, setError] = useState('');
  const [run, setRun] = useState<ReturnType<typeof fermat> | null>(() => fermat(7n, 19n));
  const calculate = (a = aText, p = pText) => {
    try {
      setRun(fermat(parseWhole(a, 'a'), parseWhole(p, 'p')));
      setError('');
    } catch (cause) {
      setError(message(cause));
    }
  };
  let totient: ReturnType<typeof reducedResidues> | null = null,
    totientError = '';
  try {
    totient = reducedResidues(parseWhole(nText, 'n', 2n));
  } catch (cause) {
    totientError = message(cause);
  }
  return (
    <>
      <h2>
        Fermat’s theorem: a<sup>p−1</sup> = 1 (mod p)
      </h2>
      <InputForm
        summary={run ? `a = ${run.a}, p = ${run.p}` : ''}
        onSubmit={() => calculate()}
        onExample={() => {
          setA('7');
          setP('19');
          calculate('7', '19');
        }}
        error={error}
      >
        <Field id="f-a" label="a" value={aText} onChange={setA} />
        <Field id="f-p" label="p (prime)" value={pText} onChange={setP} />
      </InputForm>
      {run && (
        <div className="calc">
          <p className="formula">
            <Pow base={fmt(run.a)} exp={fmt(run.p - 1n)} /> mod {fmt(run.p)} ={' '}
            <strong>{fmt(run.run.result)}</strong>
          </p>
          <HandMethod run={run.run} />
          <p>
            It is 1, as Fermat’s theorem says for every a that shares no factor with the prime{' '}
            {fmt(run.p)}.
          </p>
        </div>
      )}
      <Collapse title="Why is it true? (the lecture's proof, in numbers)">
        {run && (
          <>
            <p>
              Multiply every number 1, 2, …, {fmt(run.p - 1n)} by a = {fmt(run.a)} and reduce mod{' '}
              {fmt(run.p)}. You get the same numbers again, only shuffled:
            </p>
            <p className="num">
              {Array.from({ length: Number(run.p - 1n) }, (_, i) => BigInt(i + 1))
                .slice(0, 20)
                .map((k) => `${k}→${(k * run.a) % run.p}`)
                .join('   ')}
              {run.p > 21n ? '   …' : ''}
            </p>
            <p>
              So the product of the first set equals the product of the second:{' '}
              <Num>
                a<sup>p−1</sup> × (p−1)! = (p−1)!
              </Num>
              , and cancelling (p−1)! leaves a<sup>p−1</sup> = 1.
            </p>
          </>
        )}
      </Collapse>

      <h2>Euler’s totient φ(n) and Euler’s theorem</h2>
      <p className="lead small">
        φ(n) counts the numbers from 1 to n that share no factor with n. Euler’s theorem generalises
        Fermat: <Num>a^φ(n) = 1 (mod n)</Num> when gcd(a, n) = 1.
      </p>
      <InputForm onSubmit={() => undefined} error={totientError} submitLabel={null}>
        <Field id="e-n" label="n (2 to 300)" value={nText} onChange={setN} />
      </InputForm>
      {totient && (
        <div className="calc">
          <p>
            Complete set of residues: 0 … {totient.complete - 1}. The <b>reduced</b> set (numbers
            relatively prime to {nText.trim()}):
          </p>
          <p className="num">{totient.residues.map(String).join(', ')}</p>
          <p>
            So φ({nText.trim()}) = <strong>{totient.residues.length}</strong>.
          </p>
          <Collapse title="Shortcuts from the lecture">
            <ul className="lines plain">
              <li>For a prime p: φ(p) = p − 1 (for example φ(37) = 36).</li>
              <li>
                For two primes p and q: φ(pq) = (p − 1)(q − 1) (for example φ(21) = 2 × 6 = 12).
              </li>
            </ul>
          </Collapse>
        </div>
      )}
    </>
  );
}

/* ───────────── Part 2: why decryption returns M ───────────── */

function ProofSteps({ run }: { run: WhyRsaRun }) {
  const { setup, M, common, C } = run;
  const steps = useSteps(5);
  const k = setup.k;
  const cards = [
    <li key="1">
      <h3>Step 1 · The setup</h3>
      <p>
        n = p × q = {fmt(setup.p)} × {fmt(setup.q)} = {fmt(setup.n)} and φ(n) = (p − 1)(q − 1) ={' '}
        {fmt(setup.phi)}. e = {fmt(setup.e)} and d = {fmt(setup.d)} are inverses mod φ(n), so
      </p>
      <p className="formula">
        e × d = {fmt(setup.e)} × {fmt(setup.d)} = {fmt(setup.e * setup.d)} = 1 + {fmt(k)} ×{' '}
        {fmt(setup.phi)} = 1 + k × φ(n) with k = {fmt(k)}.
      </p>
    </li>,
    <li key="2">
      <h3>Step 2 · Encrypt: C = M^e mod n</h3>
      <p>
        C = <Pow base={fmt(M)} exp={fmt(setup.e)} /> mod {fmt(setup.n)} = <strong>{fmt(C)}</strong>
      </p>
      <Collapse title="Show the squaring and multiplying">
        <HandMethod run={run.encrypt} />
      </Collapse>
    </li>,
    <li key="3">
      <h3>Step 3 · Decrypting means computing C^d = M^(ed)</h3>
      <p>
        C<sup>d</sup> = (M<sup>e</sup>)<sup>d</sup> = M<sup>ed</sup> = M<sup>1 + kφ(n)</sup> = M ×
        (M<sup>φ(n)</sup>)<sup>k</sup> (mod n).
      </p>
    </li>,
    <li key="4">
      <h3>Step 4 · Euler’s theorem: M^φ(n) = 1</h3>
      {run.euler ? (
        <>
          <p>
            gcd(M, n) = gcd({fmt(M)}, {fmt(setup.n)}) = 1, so Euler applies:{' '}
            <Pow base={fmt(M)} exp={fmt(setup.phi)} /> mod {fmt(setup.n)} ={' '}
            <strong>{fmt(run.euler.result)}</strong>.
          </p>
          <Collapse title="Show this power calculated">
            <HandMethod run={run.euler} />
          </Collapse>
          <p>
            Therefore C<sup>d</sup> = M × 1<sup>{fmt(k)}</sup> = M (mod n).
          </p>
        </>
      ) : (
        <p>
          Here gcd(M, n) = {fmt(common)}, not 1, so this proof does not apply directly (the lecture
          assumes gcd(M, n) = 1). RSA still works for such M (it can be shown prime by prime), as
          the check in the next step confirms.
        </p>
      )}
    </li>,
    <li key="5">
      <h3>Step 5 · Check with the real numbers</h3>
      <p>
        M = C<sup>d</sup> mod n = <Pow base={fmt(C)} exp={fmt(setup.d)} /> mod {fmt(setup.n)} ={' '}
        <strong>{fmt(run.recovered)}</strong>
        {run.recovered === M ? ' — the original message. ✓' : ' — does not match!'}
      </p>
      <Collapse title="Show this power calculated">
        <HandMethod run={run.decrypt} />
      </Collapse>
    </li>,
  ];
  return (
    <>
      <StepControls steps={steps} />
      <ol className="mr-steps">
        {cards.slice(0, steps.shown).map((card, index) => (
          <li key={card.key} className={index === steps.shown - 1 ? 'current' : ''}>
            {card.props.children}
          </li>
        ))}
      </ol>
    </>
  );
}

function ProofPart() {
  const [fields, setFields] = useState({ p: '17', q: '11', e: '7', m: '88' }),
    [error, setError] = useState('');
  const compute = (values = fields) =>
    whyRsaWorks(
      rsaSetup(parseWhole(values.p, 'p'), parseWhole(values.q, 'q'), parseWhole(values.e, 'e')),
      parseWhole(values.m, 'M'),
    );
  const [run, setRun] = useState<WhyRsaRun | null>(() => compute());
  const calculate = (values = fields) => {
    try {
      setRun(compute(values));
      setError('');
    } catch (cause) {
      setError(message(cause));
    }
  };
  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((old) => ({ ...old, [key]: value }));
  return (
    <>
      <h2>Why decryption returns the message</h2>
      <InputForm
        summary={
          run ? `p = ${run.setup.p}, q = ${run.setup.q}, e = ${run.setup.e}, M = ${run.M}` : ''
        }
        onSubmit={() => calculate()}
        onExample={() => {
          const lecture = { p: '17', q: '11', e: '7', m: '88' };
          setFields(lecture);
          calculate(lecture);
        }}
        error={error}
      >
        <Field id="w-p" label="p (prime)" value={fields.p} onChange={set('p')} />
        <Field id="w-q" label="q (prime)" value={fields.q} onChange={set('q')} />
        <Field id="w-e" label="e" value={fields.e} onChange={set('e')} />
        <Field id="w-m" label="M (below n)" value={fields.m} onChange={set('m')} />
      </InputForm>
      {run && <ProofSteps key={`${run.setup.n}-${run.setup.e}-${run.M}`} run={run} />}
    </>
  );
}

export function WhyPage() {
  const [tab, setTab] = useState<'fermat' | 'proof'>('fermat');
  return (
    <article>
      <header>
        <p className="eyebrow">Chapter 8 and 9 · Fermat, Euler, RSA</p>
        <h1>Why RSA works</h1>
      </header>
      <Idea>
        Raising a number to the power φ(n) always gives back 1 (mod n). Because e and d are chosen
        so that e × d is one more than a multiple of φ(n), encrypting and then decrypting multiplies
        M by 1 over and over, and lands on M again.
      </Idea>
      <SlideRef>
        ch08 “Fermat’s Theorem”, “Euler Totient Function”, “Euler’s Theorem”; ch09 “Why RSA Works”.
      </SlideRef>
      <UsedFor>
        It shows that unlocking really returns your message, so RSA is correct and not a trick.
      </UsedFor>
      <Words terms={['phi', 'coprime', 'prime', 'mod', 'exponent']} />
      <TabList
        id="why"
        label="Parts"
        items={[
          { id: 'fermat', label: '1 · Fermat and Euler' },
          { id: 'proof', label: '2 · Why decryption works' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <TabPanel id="why" value={tab}>
        {tab === 'fermat' ? <FermatPart /> : <ProofPart />}
      </TabPanel>
    </article>
  );
}
