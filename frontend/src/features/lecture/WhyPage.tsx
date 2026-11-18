import { useState } from 'react';
import { whyRsaWorks, type WhyRsaRun } from './advanced';
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
  LessonHeader,
} from './parts';

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

// part 2: why decryption returns M
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
      <h3>Step 3 · Unlocking computes C^d = M^(ed)</h3>
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
          Here gcd(M, n) = {fmt(common)}, not 1, so Euler’s theorem does not apply directly. RSA
          still works for such M, as the check in the next step confirms.
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
      <h2>See it with numbers</h2>
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
  return (
    <article>
      <LessonHeader title="Why RSA works" />
      <Idea>
        Locking raises M to the power e and unlocking raises the result to the power d. Because d
        and e are chosen so that e × d = 1 + k × φ(n), the two steps together give M × (M
        <sup>φ(n)</sup>)<sup>k</sup>, and Euler’s theorem says M<sup>φ(n)</sup> = 1. So you get M
        back.
      </Idea>
      <UsedFor>
        It shows that unlocking really returns your message, so RSA is correct and not a trick.
      </UsedFor>
      <SlideRef>ch08 “Euler Totient Function”, “Euler’s Theorem”; ch09 “Why RSA Works”.</SlideRef>
      <Words terms={['phi', 'coprime', 'prime', 'mod', 'exponent']} />
      <h2>Two facts to know</h2>
      <ol className="lines">
        <li>
          <b>φ(n) for RSA.</b> φ(n) counts the numbers from 1 to n that share no factor with n. For
          n = p × q with p and q prime, φ(n) = (p − 1)(q − 1). For example φ(187) = 16 × 10 = 160.
        </li>
        <li>
          <b>Euler’s theorem.</b> If gcd(M, n) = 1, then{' '}
          <Num>
            M<sup>φ(n)</sup> = 1 (mod n)
          </Num>
          .
        </li>
      </ol>
      <ProofPart />
      <p className="lead small">
        What if M shares a factor with n (M is a multiple of p or q)? That is extremely unlikely
        with real keys, and RSA still works: the same argument holds separately mod p and mod q,
        because n is a product of two different primes.
      </p>
    </article>
  );
}
