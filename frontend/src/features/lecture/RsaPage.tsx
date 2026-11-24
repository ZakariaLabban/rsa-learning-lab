import { LessonArticle } from './parts';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RsaFlow } from './diagrams';
import { parseWhole, power, rsaSetup, suggestExponent, type RsaSetup } from './model';
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
  TabList,
  TabPanel,
  LessonHeader,
} from './parts';

type Phase = 'keys' | 'encrypt' | 'decrypt';
const PHASES: { id: Phase; label: string }[] = [
  { id: 'keys', label: '1 · Make the keys' },
  { id: 'encrypt', label: '2 · Encrypt' },
  { id: 'decrypt', label: '3 · Decrypt' },
];

// one step of the key setup: sentence first, formula after
function Step({ number, plain, children }: { number: number; plain: string; children: ReactNode }) {
  return (
    <li className="rsa-step">
      <span className="step-no">{number}</span>
      <div>
        <p className="plain">{plain}</p>
        <p className="formula-line">{children}</p>
      </div>
    </li>
  );
}

function Keys({ setup }: { setup: RsaSetup }) {
  const { p, q, n, phi, e, d, k } = setup;
  return (
    <ol className="rsa-steps">
      <Step number={1} plain="Pick two prime numbers and keep them secret.">
        p = <strong>{fmt(p)}</strong> and q = <strong>{fmt(q)}</strong>
      </Step>
      <Step
        number={2}
        plain="Multiply them. This product n is public. Nobody can easily get p and q back from it when they are huge."
      >
        n = p × q = {fmt(p)} × {fmt(q)} = <strong>{fmt(n)}</strong>
      </Step>
      <Step
        number={3}
        plain="Count the numbers that share no factor with n. Only you can do this, because it needs p and q."
      >
        φ(n) = (p − 1)(q − 1) = {fmt(p - 1n)} × {fmt(q - 1n)} = <strong>{fmt(phi)}</strong>
      </Step>
      <Step number={4} plain="Choose the public exponent e. It must share no factor with φ(n).">
        gcd(e, φ(n)) = gcd({fmt(e)}, {fmt(phi)}) = {fmt(setup.coprime.gcd)} ✓, so e ={' '}
        <strong>{fmt(e)}</strong>.{' '}
        <Link to="/lecture/gcd" className="see">
          How gcd works
        </Link>
      </Step>
      <Step
        number={5}
        plain="Find the private exponent d: the number that undoes e when you multiply mod φ(n)."
      >
        d = e<sup>−1</sup> mod {fmt(phi)} = <strong>{fmt(d)}</strong>. Check: {fmt(d)} × {fmt(e)} ={' '}
        {fmt(d * e)} = {fmt(k)} × {fmt(phi)} + 1 ✓.{' '}
        <Link to={`/lecture/inverse?m=${phi}&b=${e}`} className="see">
          See the table for this inverse
        </Link>
      </Step>
      <Step number={6} plain="Publish the public key. Anyone can use it to lock messages for you.">
        PU = {'{'}e, n{'}'} = <strong>{`{${fmt(e)}, ${fmt(n)}}`}</strong>
      </Step>
      <Step
        number={7}
        plain="Keep the private key secret. It is the only thing that unlocks those messages."
      >
        PR = {'{'}d, n{'}'} = <strong>{`{${fmt(d)}, ${fmt(n)}}`}</strong>
      </Step>
    </ol>
  );
}

function Calc({
  title,
  formula,
  base,
  exponent,
  n,
  labelResult,
}: {
  title: string;
  formula: ReactNode;
  base: bigint;
  exponent: bigint;
  n: bigint;
  labelResult: string;
}) {
  const run = power(base, exponent, n);
  return (
    <section className="calc" aria-label={title}>
      <h3>{title}</h3>
      <p className="formula">
        {labelResult} = {formula} = <Pow base={fmt(base)} exp={fmt(exponent)} /> mod {fmt(n)}
      </p>
      <Collapse title="The squaring and multiplying, step by step" open>
        <HandMethod run={run} />
      </Collapse>
      <p className="see-row">
        <Link to={`/lecture/power?a=${base}&b=${exponent}&n=${n}`} className="see">
          Step through this with the exponentiation algorithm
        </Link>
      </p>
    </section>
  );
}

export function RsaPage() {
  const [pText, setP] = useState('17'),
    [qText, setQ] = useState('11'),
    [eText, setE] = useState('7'),
    [mText, setM] = useState('88'),
    [error, setError] = useState(''),
    [setup, setSetup] = useState<RsaSetup | null>(() => rsaSetup(17n, 11n, 7n)),
    [message, setMessage] = useState<bigint>(88n),
    [phase, setPhase] = useState<Phase>('keys');

  const calculate = (values = { p: pText, q: qText, e: eText, m: mText }) => {
    try {
      const p = parseWhole(values.p, 'p'),
        q = parseWhole(values.q, 'q');
      const phi = p > 1n && q > 1n ? (p - 1n) * (q - 1n) : 0n;
      const eValue = values.e.trim() ? parseWhole(values.e, 'e') : suggestExponent(phi);
      const next = rsaSetup(p, q, eValue);
      const m = parseWhole(values.m, 'the message M');
      if (m >= next.n)
        throw new Error(`The message M must be smaller than n = ${next.n} (0 ≤ M < n).`);
      setSetup(next);
      setMessage(m);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const ciphertext = setup ? power(message, setup.e, setup.n).result : 0n;
  return (
    <LessonArticle>
      <LessonHeader title="RSA by hand" />
      <Idea>
        You make a pair of keys from two secret primes. <b>Anyone</b> can lock a message with your
        public key,{' '}
        <Num>
          C = M<sup>e</sup> mod n
        </Num>
        . <b>Only you</b> can unlock it with your private key,{' '}
        <Num>
          M = C<sup>d</sup> mod n
        </Num>
        . Below, you do all three parts with small numbers.
      </Idea>
      <UsedFor>
        This is the whole algorithm. The earlier lessons gave you the tools (gcd, inverse, powers);
        here you use them together.
      </UsedFor>
      <SlideRef>ch09 “RSA Key Setup: Example”, “RSA Use”, “RSA En/Decryption: Example”.</SlideRef>
      <Words
        terms={[
          'prime',
          'modulus',
          'phi',
          'coprime',
          'inverse',
          'plaintext',
          'ciphertext',
          'publicKey',
          'privateKey',
        ]}
      />
      <InputForm
        summary={
          setup ? `p = ${setup.p}, q = ${setup.q}, e = ${setup.e}, message M = ${message}` : ''
        }
        onSubmit={() => calculate()}
        onExample={() => {
          const lecture = { p: '17', q: '11', e: '7', m: '88' };
          setP(lecture.p);
          setQ(lecture.q);
          setE(lecture.e);
          setM(lecture.m);
          calculate(lecture);
        }}
        error={error}
      >
        <Field id="rsa-p" label="p (prime)" value={pText} onChange={setP} />
        <Field id="rsa-q" label="q (prime)" value={qText} onChange={setQ} />
        <Field
          id="rsa-e"
          label="e (public exponent)"
          value={eText}
          onChange={setE}
          hint="Leave empty to let the lab choose one."
        />
        <Field id="rsa-m" label="M (message number, below n)" value={mText} onChange={setM} />
      </InputForm>
      {setup && (
        <>
          <TabList
            id="rsa"
            label="RSA parts"
            items={PHASES}
            value={phase}
            onChange={setPhase}
            className="steps-tabs"
          />
          <TabPanel id="rsa" value={phase}>
            <RsaFlow
              phase={phase}
              m={String(message)}
              c={String(ciphertext)}
              e={String(setup.e)}
              d={String(setup.d)}
              n={String(setup.n)}
            />
            {phase === 'keys' && (
              <>
                <Keys setup={setup} />
                <div className="controls nav-row">
                  <button type="button" className="primary big" onClick={() => setPhase('encrypt')}>
                    Next: encrypt →
                  </button>
                </div>
              </>
            )}
            {phase === 'encrypt' && (
              <>
                <p className="explain">
                  <b>Anyone can do this.</b> To send M = {fmt(message)} to the owner of the keys,
                  use their <b>public</b> key PU = {`{${fmt(setup.e)}, ${fmt(setup.n)}}`}. The
                  message must be a number smaller than n = {fmt(setup.n)}.
                </p>
                <Calc
                  title="Encryption"
                  labelResult="C"
                  formula={
                    <>
                      M<sup>e</sup> mod n
                    </>
                  }
                  base={message}
                  exponent={setup.e}
                  n={setup.n}
                />
                <div className="controls nav-row">
                  <button type="button" className="primary big" onClick={() => setPhase('decrypt')}>
                    Next: decrypt →
                  </button>
                  <button type="button" className="back" onClick={() => setPhase('keys')}>
                    ← Back
                  </button>
                </div>
              </>
            )}
            {phase === 'decrypt' && (
              <>
                <p className="explain">
                  <b>Only the key owner can do this.</b> The ciphertext C = {fmt(ciphertext)} is
                  unlocked with the <b>private</b> key PR = {`{${fmt(setup.d)}, ${fmt(setup.n)}}`}.
                </p>
                <Calc
                  title="Decryption"
                  labelResult="M"
                  formula={
                    <>
                      C<sup>d</sup> mod n
                    </>
                  }
                  base={ciphertext}
                  exponent={setup.d}
                  n={setup.n}
                />
                {power(ciphertext, setup.d, setup.n).result === message && (
                  <p className="result">M = {fmt(message)}: we got the original message back. ✓</p>
                )}
                <div className="controls nav-row">
                  <button type="button" className="back" onClick={() => setPhase('encrypt')}>
                    ← Back
                  </button>
                </div>
                <Collapse title="Why does it work?">
                  <p>
                    Because d and e undo each other. The proof is in the lesson{' '}
                    <Link to="/lecture/why">Why RSA works</Link>.
                  </p>
                </Collapse>
              </>
            )}
          </TabPanel>
        </>
      )}
    </LessonArticle>
  );
}
