import { LessonArticle } from './parts';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { parseEnvelope, utf8 } from '../../engine/encoding';
import { sealBasic } from '../../engine/rsa';
import { useKeyring } from '../../keyring';
import {
  broadcastAttack,
  broadcastCiphertexts,
  crackKey,
  guessAttack,
  type BroadcastRun,
  type CrackRun,
} from './advanced';
import { CrtCards } from './CrtPage';
import { EeaTable } from './EuclidPages';
import { parseWhole, power, rsaSetup } from './model';
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

const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

function Cards({
  cards,
  shown,
}: {
  cards: { key: string; body: React.ReactNode }[];
  shown: number;
}) {
  return (
    <ol className="mr-steps">
      {cards.slice(0, shown).map((card, index) => (
        <li key={card.key} className={index === shown - 1 ? 'current' : ''}>
          {card.body}
        </li>
      ))}
    </ol>
  );
}

// attack 1: factor n
const BIG_N = 999985999949n; // 999983 × 1000003
const BIG_C = power(123456n, 65537n, BIG_N).result;

function FactorSteps({ run, e, C }: { run: CrackRun; e: bigint; C: bigint }) {
  const steps = useSteps(5);
  const { factoring } = run;
  const hidden = factoring.tries - factoring.rows.length;
  const cards = [
    {
      key: 'public',
      body: (
        <>
          <h3>Step 1 · What the attacker knows</h3>
          <p>
            Only the public key PU = {`{${fmt(e)}, ${fmt(run.p * run.q)}}`} and the intercepted
            ciphertext C = {fmt(C)}. To decrypt, the attacker needs d, which needs φ(n) = (p − 1)(q
            − 1), which needs the secret primes p and q. So: <b>factor n</b>.
          </p>
        </>
      ),
    },
    {
      key: 'trial',
      body: (
        <>
          <h3>Step 2 · Trial division: try the primes up to √n</h3>
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Table, scrolls sideways on narrow screens"
          >
            <table className="grid">
              <thead>
                <tr>
                  <th scope="col">Try d</th>
                  <th scope="col">n mod d</th>
                  <th scope="col">Divides n?</th>
                </tr>
              </thead>
              <tbody>
                {factoring.rows.map((row, index) => (
                  <tr key={index} className={row.remainder === 0n ? 'current' : ''}>
                    <td>{row.d}</td>
                    <td>{fmt(row.remainder)}</td>
                    <td>{row.remainder === 0n ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hidden > 0 && (
            <p className="note">
              The first {factoring.shownFirst} tries and the last one are shown; {fmt(hidden)} more
              tries in between all gave a non-zero remainder. Total tries: {factoring.tries}.
            </p>
          )}
          <p>
            Found: <b>{fmt(run.p)}</b> divides {fmt(factoring.n)}, and {fmt(factoring.n)} /{' '}
            {fmt(run.p)} = <b>{fmt(run.q)}</b>. So p = {fmt(run.p)} and q = {fmt(run.q)}.
          </p>
        </>
      ),
    },
    {
      key: 'phi',
      body: (
        <>
          <h3>Step 3 · Compute φ(n)</h3>
          <p>
            φ(n) = (p − 1)(q − 1) = {fmt(run.p - 1n)} × {fmt(run.q - 1n)} ={' '}
            <strong>{fmt(run.phi)}</strong>
          </p>
        </>
      ),
    },
    {
      key: 'd',
      body: (
        <>
          <h3>Step 4 · Find the private exponent d</h3>
          <p>
            d = e<sup>−1</sup> mod φ(n) = {fmt(e)}
            <sup>−1</sup> mod {fmt(run.phi)} = <strong>{fmt(run.d)}</strong>
          </p>
          <Collapse title="Show the Extended Euclid table">
            <EeaTable run={run.inverse} shown={run.inverse.rows.length} />
          </Collapse>
        </>
      ),
    },
    {
      key: 'm',
      body: (
        <>
          <h3>Step 5 · Decrypt like the owner</h3>
          <p>
            M = C<sup>d</sup> mod n = <Pow base={fmt(C)} exp={fmt(run.d)} /> mod {fmt(factoring.n)}{' '}
            = <strong>{fmt(run.M)}</strong>
          </p>
          <Collapse title="Show the squaring and multiplying">
            <HandMethod run={run.decrypt} />
          </Collapse>
        </>
      ),
    },
  ];
  return (
    <>
      <StepControls steps={steps} />
      <Cards cards={cards} shown={steps.shown} />
      {steps.done && (
        <p className="result bad">
          The message was <strong>{fmt(run.M)}</strong>. The key was broken because n is small. With
          a 1024-bit n, trial division would need about 10¹⁵¹ divisions, which is why real RSA uses
          huge primes.
        </p>
      )}
    </>
  );
}

export function FactoringPage() {
  const [fields, setFields] = useState({ n: '187', e: '7', c: '11' }),
    [error, setError] = useState('');
  const compute = (values = fields) => {
    const n = parseWhole(values.n, 'n'),
      e = parseWhole(values.e, 'e'),
      C = parseWhole(values.c, 'C');
    return { run: crackKey(n, e, C), e, C };
  };
  const [state, setState] = useState<{ run: CrackRun; e: bigint; C: bigint } | null>(() =>
    compute(),
  );
  const calculate = (values = fields) => {
    try {
      setState(compute(values));
      setError('');
    } catch (cause) {
      setError(message(cause));
    }
  };
  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((old) => ({ ...old, [key]: value }));
  const load = (values: typeof fields) => {
    setFields(values);
    calculate(values);
  };
  return (
    <LessonArticle>
      <LessonHeader title="Break a small key by factoring n" />
      <Idea>
        RSA is safe only because factoring n = p × q is hard when p and q are huge. If n is small,
        anyone can factor it, rebuild the private key, and read the message.
      </Idea>
      <SlideRef>ch09 “RSA Security”, “Factoring Problem” and “Progress in Factoring”.</SlideRef>
      <UsedFor>
        RSA is safe only because factoring n is hard. Here you see exactly what an attacker gains
        when it is not.
      </UsedFor>
      <Words terms={['prime', 'composite', 'phi', 'attacker', 'publicKey']} />
      <InputForm
        summary={state ? `n = ${state.run.factoring.n}, e = ${state.e}, C = ${state.C}` : ''}
        onSubmit={() => calculate()}
        error={error}
      >
        <Field
          id="fa-n"
          label="n (public modulus, up to 12 digits)"
          value={fields.n}
          onChange={set('n')}
        />
        <Field id="fa-e" label="e (public exponent)" value={fields.e} onChange={set('e')} />
        <Field id="fa-c" label="C (intercepted ciphertext)" value={fields.c} onChange={set('c')} />
      </InputForm>
      <div className="examples" role="group" aria-label="Examples">
        <span>Examples:</span>
        <button type="button" onClick={() => load({ n: '187', e: '7', c: '11' })}>
          Lecture key (n = 187)
        </button>
        <button
          type="button"
          onClick={() => load({ n: String(BIG_N), e: '65537', c: String(BIG_C) })}
        >
          12-digit key (e = 65537)
        </button>
      </div>
      {state && (
        <FactorSteps
          key={`${state.run.factoring.n}-${state.e}-${state.C}`}
          run={state.run}
          e={state.e}
          C={state.C}
        />
      )}
    </LessonArticle>
  );
}

// attack 2: the same message to several recipients, small e
function BroadcastSteps({
  run,
  moduli,
  ciphertexts,
  M,
}: {
  run: BroadcastRun;
  moduli: bigint[];
  ciphertexts: bigint[];
  M: bigint;
}) {
  const steps = useSteps(4);
  const { crt, e } = run;
  const cards = [
    {
      key: 'see',
      body: (
        <>
          <h3>Step 1 · What the attacker sees</h3>
          <p>
            The same message M was encrypted with e = {fmt(e)} for {moduli.length} different people.
            Anyone watching sees these public keys and ciphertexts:
          </p>
          <ul className="lines plain">
            {moduli.map((n, i) => (
              <li key={i}>
                n<sub>{i + 1}</sub> = {fmt(n)}, C<sub>{i + 1}</sub> = M<sup>{fmt(e)}</sup> mod n
                <sub>{i + 1}</sub> = <strong>{fmt(ciphertexts[i])}</strong>
              </li>
            ))}
          </ul>
          <Collapse title="How were these made?">
            <p>
              For example C<sub>1</sub> = <Pow base={fmt(M)} exp={fmt(e)} /> mod {fmt(moduli[0])} ={' '}
              {fmt(ciphertexts[0])}. The attacker does not know M; only the sender does.
            </p>
          </Collapse>
        </>
      ),
    },
    {
      key: 'crt',
      body: (
        <>
          <h3>Step 2 · Combine the ciphertexts with the CRT</h3>
          <p>
            M<sup>{fmt(e)}</sup> is known modulo each n<sub>i</sub>. The Chinese Remainder Theorem
            gives M<sup>{fmt(e)}</sup> modulo n₁n₂…
          </p>
          <Collapse title="Show the CRT calculation" open>
            <ol className="mr-steps">
              <CrtCards
                crt={crt}
                shown={crt.rows.length + 3}
                from="Residues are the ciphertexts."
              />
            </ol>
          </Collapse>
        </>
      ),
    },
    {
      key: 'exact',
      body: (
        <>
          <h3>Step 3 · The modulus never mattered</h3>
          <p>
            M is smaller than every n<sub>i</sub>, so M<sup>{fmt(e)}</sup> is smaller than their
            product {fmt(crt.M)}. The CRT answer {fmt(crt.A)} is therefore <b>not reduced at all</b>
            : it is exactly M<sup>{fmt(e)}</sup>.
          </p>
        </>
      ),
    },
    {
      key: 'root',
      body: (
        <>
          <h3>Step 4 · Take the {fmt(e)}-th root</h3>
          <p>
            M = {fmt(crt.A)}
            <sup>1/{fmt(e)}</sup> = <strong>{fmt(run.root)}</strong>
            {run.exact ? (
              <>
                {' '}
                (check: {fmt(run.root)}
                <sup>{fmt(e)}</sup> = {fmt(run.root ** e)} ✓)
              </>
            ) : (
              <>
                {' '}
                — but {fmt(run.root)}^{fmt(e)} is not exactly {fmt(crt.A)}, so M was too large for
                this attack.
              </>
            )}
          </p>
        </>
      ),
    },
  ];
  return (
    <>
      <StepControls steps={steps} />
      <Cards cards={cards} shown={steps.shown} />
      {steps.done && (
        <p className={`result ${run.exact ? 'bad' : ''}`}>
          {run.exact ? (
            <>
              Recovered M = <strong>{fmt(run.root)}</strong> without any private key.{' '}
              {run.root === M && 'It is the original message.'} Defence: random padding (OAEP) makes
              every copy different, so this does not work, and e = 65537 makes M^e far larger than
              the product.
            </>
          ) : (
            'The attack needs M^e to be smaller than the product of the moduli.'
          )}
        </p>
      )}
    </>
  );
}

export function BroadcastPage() {
  const [fields, setFields] = useState({ m: '100', e: '3', moduli: '187, 667, 1927' }),
    [error, setError] = useState('');
  const compute = (values = fields) => {
    const e = parseWhole(values.e, 'e', 2n),
      M = parseWhole(values.m, 'M');
    const moduli = values.moduli
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map((part) => parseWhole(part, 'a modulus', 2n));
    if (moduli.length < Number(e))
      throw new Error(`With e = ${e}, use at least ${e} recipients (moduli).`);
    const ciphertexts = broadcastCiphertexts(M, moduli, e);
    return { run: broadcastAttack(moduli, ciphertexts, e), moduli, ciphertexts, M };
  };
  const [state, setState] = useState<ReturnType<typeof compute> | null>(() => compute());
  const calculate = (values = fields) => {
    try {
      setState(compute(values));
      setError('');
    } catch (cause) {
      setError(message(cause));
    }
  };
  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((old) => ({ ...old, [key]: value }));
  return (
    <LessonArticle>
      <LessonHeader title="Same message, three recipients, e = 3" />
      <Idea>
        A small e makes encryption fast, but if one message M is sent to e different people, the
        attacker can combine the ciphertexts with the CRT and take an ordinary root. No factoring
        and no private key needed.
      </Idea>
      <SlideRef>
        ch09 “Efficient Encryption” (“can attack using CRT and 3 messages with different moduli”).
      </SlideRef>
      <UsedFor>
        Choosing a small e makes locking fast, but this shows the trap it sets when one message goes
        to several people.
      </UsedFor>
      <Words terms={['attacker', 'coprime', 'residue', 'exponent', 'ciphertext']} />
      <InputForm
        summary={
          state ? `M = ${state.M}, e = ${state.run.e}, moduli ${state.moduli.join(', ')}` : ''
        }
        onSubmit={() => calculate()}
        onExample={() => {
          const lecture = { m: '100', e: '3', moduli: '187, 667, 1927' };
          setFields(lecture);
          calculate(lecture);
        }}
        error={error}
      >
        <Field
          id="b-m"
          label="Secret message M (the attacker does not know it)"
          value={fields.m}
          onChange={set('m')}
        />
        <Field id="b-e" label="e (same for everyone)" value={fields.e} onChange={set('e')} />
        <Field
          id="b-n"
          label="The recipients’ moduli (pairwise relatively prime)"
          value={fields.moduli}
          onChange={set('moduli')}
        />
      </InputForm>
      {state && (
        <BroadcastSteps
          key={`${fields.m}-${state.moduli.join()}-${state.run.e}`}
          run={state.run}
          moduli={state.moduli}
          ciphertexts={state.ciphertexts}
          M={state.M}
        />
      )}
    </LessonArticle>
  );
}

// attack 3: YES or NO? (deterministic encryption)
export function GuessingPage() {
  const keys = useKeyring();
  const [fields, setFields] = useState({ p: '17', q: '11', e: '7', a: '12', b: '34', secret: 'b' }),
    [error, setError] = useState('');
  const compute = (values = fields) => {
    const setup = rsaSetup(
      parseWhole(values.p, 'p'),
      parseWhole(values.q, 'q'),
      parseWhole(values.e, 'e'),
    );
    const a = parseWhole(values.a, 'Message A'),
      b = parseWhole(values.b, 'Message B');
    if (a === b) throw new Error('Messages A and B must be different.');
    const C = power(values.secret === 'a' ? a : b, setup.e, setup.n).result;
    return { setup, a, b, C, rows: guessAttack(setup, [a, b], C), secret: values.secret };
  };
  const [state, setState] = useState<ReturnType<typeof compute> | null>(() => compute());
  const calculate = (values = fields) => {
    try {
      setState(compute(values));
      setError('');
    } catch (cause) {
      setError(message(cause));
    }
  };
  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((old) => ({ ...old, [key]: value }));
  const [demo, setDemo] = useState<{ textbook: string[]; oaep: string[] } | null>(null),
    [oaepError, setOaepError] = useState('');
  // only the ciphertext part (the header is the same for every message to Alice)
  function cipherOf(envelope: string): string {
    const value = parseEnvelope(envelope);
    if (value.kind === 'oaep') return value.ciphertext;
    if (value.kind === 'textbook-blocks') return value.blocks[0];
    throw new Error('Unexpected envelope.');
  }
  async function showOaep() {
    try {
      const alice = keys.entries.find((entry) => entry.id === 'demo-alice');
      if (!alice) throw new Error('The demo key is still loading. Try again in a moment.');
      const bytes = utf8.encode('YES');
      const run = async (mode: 'textbook' | 'oaep') =>
        cipherOf((await sealBasic(alice.key, bytes, mode)).envelope);
      setDemo({
        textbook: [await run('textbook'), await run('textbook')],
        oaep: [await run('oaep'), await run('oaep')],
      });
      setOaepError('');
    } catch (cause) {
      setOaepError(message(cause));
    }
  }
  const steps = useSteps(3);
  return (
    <LessonArticle>
      <LessonHeader title="YES or NO? Guessing the message" />
      <Idea>
        Textbook RSA always gives the same ciphertext for the same message. If there are only a few
        possible messages (like YES and NO), the attacker simply encrypts each one with the public
        key and sees which result matches. No decryption needed.
      </Idea>
      <SlideRef>
        ch09 “Chosen Ciphertext Attacks”: “can counter with random pad of plaintext, or use OAEP”.
      </SlideRef>
      <UsedFor>It explains why real systems never use RSA without random padding.</UsedFor>
      <Words terms={['attacker', 'ciphertext', 'plaintext', 'publicKey']} />
      <InputForm
        summary={
          state ? `n = ${state.setup.n}, e = ${state.setup.e}, A = ${state.a}, B = ${state.b}` : ''
        }
        onSubmit={() => calculate()}
        onExample={() => {
          const lecture = { p: '17', q: '11', e: '7', a: '12', b: '34', secret: 'b' };
          setFields(lecture);
          calculate(lecture);
        }}
        error={error}
      >
        <Field id="g-p" label="p" value={fields.p} onChange={set('p')} />
        <Field id="g-q" label="q" value={fields.q} onChange={set('q')} />
        <Field id="g-e" label="e" value={fields.e} onChange={set('e')} />
        <Field id="g-a" label="Message A (say, YES = 12)" value={fields.a} onChange={set('a')} />
        <Field id="g-b" label="Message B (say, NO = 34)" value={fields.b} onChange={set('b')} />
        <div className="field">
          <label htmlFor="g-s">Which one does the sender secretly send?</label>
          <select id="g-s" value={fields.secret} onChange={(e) => set('secret')(e.target.value)}>
            <option value="a">Message A</option>
            <option value="b">Message B</option>
          </select>
        </div>
      </InputForm>
      {state && (
        <>
          <StepControls steps={steps} />
          <Cards
            shown={steps.shown}
            cards={[
              {
                key: 'see',
                body: (
                  <>
                    <h3>Step 1 · The attacker intercepts C</h3>
                    <p>
                      The attacker knows the public key{' '}
                      {`{${fmt(state.setup.e)}, ${fmt(state.setup.n)}}`}, knows the sender sends
                      either A = {fmt(state.a)} or B = {fmt(state.b)}, and sees the ciphertext{' '}
                      <strong>C = {fmt(state.C)}</strong>.
                    </p>
                  </>
                ),
              },
              {
                key: 'try',
                body: (
                  <>
                    <h3>Step 2 · Encrypt every candidate with the public key</h3>
                    <ul className="lines plain">
                      {state.rows.map((row, i) => (
                        <li key={i} className={row.match ? 'hit' : ''}>
                          {i === 0 ? 'A' : 'B'} = {fmt(row.M)}:{' '}
                          <Pow base={fmt(row.M)} exp={fmt(state.setup.e)} /> mod{' '}
                          {fmt(state.setup.n)} = <strong>{fmt(row.C)}</strong>{' '}
                          {row.match ? '← equals C!' : '≠ C'}
                        </li>
                      ))}
                    </ul>
                    <Collapse title="Show the calculations">
                      {state.rows.map((row, i) => (
                        <HandMethod key={i} run={row.run} />
                      ))}
                    </Collapse>
                  </>
                ),
              },
              {
                key: 'result',
                body: (
                  <>
                    <h3>Step 3 · The attacker knows the message</h3>
                    <p>
                      The matching candidate is{' '}
                      <strong>
                        {state.rows[0].match ? `A = ${fmt(state.a)}` : `B = ${fmt(state.b)}`}
                      </strong>
                      . The key was never broken, yet the secret leaked.
                    </p>
                  </>
                ),
              },
            ]}
          />
        </>
      )}
      <Collapse title="The defence: random padding (OAEP)">
        <p>
          OAEP mixes fresh random bytes into the message before encrypting, so the same message
          gives a different ciphertext every time and the attacker has nothing to compare. Here
          “YES” is encrypted twice for the demo key Alice (2048 bits):
        </p>
        <div className="controls">
          <button type="button" onClick={() => void showOaep()}>
            Encrypt “YES” twice, both ways
          </button>
        </div>
        {oaepError && (
          <p className="error" role="alert">
            {oaepError}
          </p>
        )}
        {demo && (
          <>
            <p>
              <b>Textbook RSA</b> (no padding): the same message, twice. The start of each
              ciphertext:
            </p>
            <p className="num wrap">1st: {demo.textbook[0].slice(0, 48)}…</p>
            <p className="num wrap">2nd: {demo.textbook[1].slice(0, 48)}…</p>
            <p className={demo.textbook[0] === demo.textbook[1] ? 'warn' : 'ok'}>
              {demo.textbook[0] === demo.textbook[1]
                ? 'Identical: an attacker can compare guesses.'
                : 'Different.'}
            </p>
            <p>
              <b>RSA with OAEP</b> (random padding): the same message, twice.
            </p>
            <p className="num wrap">1st: {demo.oaep[0].slice(0, 48)}…</p>
            <p className="num wrap">2nd: {demo.oaep[1].slice(0, 48)}…</p>
            <p className={demo.oaep[0] === demo.oaep[1] ? 'warn' : 'ok'}>
              {demo.oaep[0] === demo.oaep[1]
                ? 'Identical (this should never happen).'
                : 'Different every time, so guessing does not work.'}{' '}
              Try it yourself on the <Link to="/lecture/messages">Messages</Link> page.
            </p>
          </>
        )}
      </Collapse>
    </LessonArticle>
  );
}
