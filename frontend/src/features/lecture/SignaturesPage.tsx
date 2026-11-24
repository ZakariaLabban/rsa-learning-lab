import { LessonArticle } from './parts';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signByHand, type SignatureRun } from './advanced';
import { parseWhole, rsaSetup } from './model';
import {
  Collapse,
  Field,
  fmt,
  HandMethod,
  Idea,
  InputForm,
  Pow,
  SlideRef,
  UsedFor,
  Words,
  StepControls,
  useSteps,
  LessonHeader,
} from './parts';

function Cards({ run }: { run: SignatureRun }) {
  const steps = useSteps(4);
  const { setup, M, receivedM } = run;
  const tampered = receivedM !== M;
  const cards = [
    <li key="1">
      <h3>Step 1 · Bob’s keys</h3>
      <p>
        Bob’s <b>public</b> key PU = {`{${fmt(setup.e)}, ${fmt(setup.n)}}`} is known to everyone.
        His <b>private</b> key PR = {`{${fmt(setup.d)}, ${fmt(setup.n)}}`} is known only to Bob. For
        a signature the roles are swapped compared with encryption: the private key is used first.
      </p>
    </li>,
    <li key="2">
      <h3>Step 2 · Bob signs M = {fmt(M)} with his private key</h3>
      <p>
        S = M<sup>d</sup> mod n = <Pow base={fmt(M)} exp={fmt(setup.d)} /> mod {fmt(setup.n)} ={' '}
        <strong>{fmt(run.sign.result)}</strong>
      </p>
      <Collapse title="Show the squaring and multiplying">
        <HandMethod run={run.sign} />
      </Collapse>
      <p>
        Bob sends the pair (M, S) = ({fmt(receivedM)}, {fmt(run.sign.result)}).
        {tampered && (
          <>
            {' '}
            <b>
              On the way, someone changed the message from {fmt(M)} to {fmt(receivedM)}.
            </b>
          </>
        )}
      </p>
    </li>,
    <li key="3">
      <h3>Step 3 · Alice verifies with Bob’s public key</h3>
      <p>
        S<sup>e</sup> mod n = <Pow base={fmt(run.sign.result)} exp={fmt(setup.e)} /> mod{' '}
        {fmt(setup.n)} = <strong>{fmt(run.verify.result)}</strong>
      </p>
      <Collapse title="Show the squaring and multiplying">
        <HandMethod run={run.verify} />
      </Collapse>
    </li>,
    <li key="4">
      <h3>Step 4 · Compare</h3>
      <p>
        The message Alice received is {fmt(receivedM)}. The verification gave{' '}
        {fmt(run.verify.result)}.
      </p>
      <p className={run.valid ? 'ok' : 'warn'}>
        {run.valid
          ? '✓ They are equal: the message is authentic. It really comes from the sender, and it has not been changed.'
          : '✗ They are different, so this signature does not belong to this message. Alice rejects it.'}
      </p>
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

export function SignaturesPage() {
  const [fields, setFields] = useState({ p: '17', q: '11', e: '7', m: '88', r: '88' }),
    [error, setError] = useState('');
  const compute = (values = fields) => {
    const setup = rsaSetup(
      parseWhole(values.p, 'p'),
      parseWhole(values.q, 'q'),
      parseWhole(values.e, 'e'),
    );
    const M = parseWhole(values.m, 'M');
    const received = values.r.trim() ? parseWhole(values.r, 'the received message') : M;
    return signByHand(setup, M, received);
  };
  const [run, setRun] = useState<SignatureRun | null>(() => compute());
  const calculate = (values = fields) => {
    try {
      setRun(compute(values));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((old) => ({ ...old, [key]: value }));
  return (
    <LessonArticle>
      <LessonHeader title="Digital signatures" />
      <Idea>
        Encryption uses the receiver’s public key. A signature turns this around: the sender
        transforms the message with their <b>private</b> key, and anybody can check it with the
        sender’s <b>public</b> key. Only the real owner could have made it.
      </Idea>
      <SlideRef>
        ch09 “Public-Key Cryptography” (figure (b) Authentication) and “Public-Key Applications”.
      </SlideRef>
      <UsedFor>
        Encryption keeps a message secret. A signature proves who wrote it and that nobody changed
        it.
      </UsedFor>
      <Words terms={['signature', 'publicKey', 'privateKey', 'plaintext']} />
      <InputForm
        summary={
          run
            ? `p = ${run.setup.p}, q = ${run.setup.q}, e = ${run.setup.e}, M = ${run.M}, received ${run.receivedM}`
            : ''
        }
        onSubmit={() => calculate()}
        onExample={() => {
          const lecture = { p: '17', q: '11', e: '7', m: '88', r: '88' };
          setFields(lecture);
          calculate(lecture);
        }}
        error={error}
      >
        <Field id="s-p" label="p (prime)" value={fields.p} onChange={set('p')} />
        <Field id="s-q" label="q (prime)" value={fields.q} onChange={set('q')} />
        <Field id="s-e" label="e" value={fields.e} onChange={set('e')} />
        <Field id="s-m" label="Message M Bob signs" value={fields.m} onChange={set('m')} />
        <Field
          id="s-r"
          label="Message Alice receives"
          value={fields.r}
          onChange={set('r')}
          hint="Change it to see a forged message fail."
        />
      </InputForm>
      {run && <Cards key={`${run.setup.n}-${run.setup.e}-${run.M}-${run.receivedM}`} run={run} />}
      <Collapse title="Real signatures are a little different">
        <p>
          This is a “textbook” signature with small numbers, so you can follow every step. Real
          systems sign a <b>hash</b> of the message (so any length works) and add padding (RSA-PSS).
          You can try that with 1024-bit and 2048-bit keys on the{' '}
          <Link to="/lecture/messages">Messages</Link> page by choosing “Also sign”.
        </p>
      </Collapse>
    </LessonArticle>
  );
}
