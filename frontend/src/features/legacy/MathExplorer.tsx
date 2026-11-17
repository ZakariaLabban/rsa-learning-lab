import { Stepper } from '../../components/Stepper';
import { Term } from '../../components/Term';
import { LectureExampleButton } from '../../components/LectureExampleButton';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  GitBranch,
  MousePointer2,
} from 'lucide-react';
import { squareAndMultiply, modexp } from '../../engine/math';
const mathSteps = [
  {
    title: 'Choose two primes',
    formula: 'p = 61      q = 53',
    detail:
      'Start with two distinct prime numbers. Real keys use much larger probable primes; these tiny values are intentionally easy to follow.',
    result: '61 × 53 = 3233',
    label: 'THE TWO BUILDING BLOCKS',
  },
  {
    title: 'Build the modulus',
    formula: 'n = p × q = 3233',
    detail:
      'The modulus connects both keys. Multiplying the primes is straightforward; recovering the primes from a sufficiently large modulus is the difficult direction.',
    result: 'n = 3233',
    label: 'THE SHARED MODULUS',
  },
  {
    title: 'Calculate the totient',
    formula: 'φ(n) = (61 − 1)(53 − 1)',
    detail:
      'For two distinct primes, Euler’s totient is (p − 1)(q − 1). It counts the positive integers below n that are coprime to n.',
    result: 'φ(n) = 60 × 52 = 3120',
    label: 'THE NUMBER THEORY',
  },
  {
    title: 'Choose the exponents',
    formula: 'e = 17      d = 2753',
    detail:
      'Choose e coprime to φ(n). Find its modular inverse d, so e × d ≡ 1 mod φ(n). Our real-key engine uses e = 65537 and an inverse modulo φ(n), with Carmichael’s λ(n) as another valid choice.',
    result: '17 × 2753 = 46801 = 15 × 3120 + 1',
    label: 'THE CONNECTED EXPONENTS',
  },
  {
    title: 'Encrypt the message',
    formula: 'c = 65¹⁷ mod 3233',
    detail:
      'The integer 65 represents the ASCII byte for A. Encrypt using only the public key (3233, 17). Modular exponentiation keeps every intermediate value manageable.',
    result: 'c = 2790',
    label: 'THE PUBLIC OPERATION',
  },
  {
    title: 'Recover the original',
    formula: 'm = 2790²⁷⁵³ mod 3233',
    detail:
      'The private exponent reverses the RSA operation. The recovered integer is 65, which decodes to A. You have completed a full textbook RSA round trip.',
    result: 'm = 65 → “A”',
    label: 'THE PRIVATE OPERATION',
  },
];
export function MathExplorer() {
  const [index, setIndex] = useState(0);
  const [toy, setToy] = useState('65');
  const [traceOpen, setTraceOpen] = useState(false);
  const step = mathSteps[index];
  const valid = /^\d{1,4}$/.test(toy) && Number(toy) < 3233;
  const message = valid ? BigInt(toy) : 65n;
  const calculation = squareAndMultiply(message, 17n, 3233n, { trace: true });
  const value = calculation.value;
  const steps = calculation.rows.map((row) => ({
    bit: String(row.bit),
    square: `Square mod 3233 = ${row.square}`,
    multiply: row.bit ? `× ${message} mod 3233` : 'No multiply',
    value: String(row.f),
  }));
  const recovered = modexp(value, 2753n, 3233n);
  return (
    <>
      <div className="learning-layout">
        <section className="panel learning-steps">
          <div className="panel-top">
            <div className="panel-title">
              <GitBranch size={16} />
              <h2>One complete example</h2>
            </div>
          </div>
          {mathSteps.map((s, i) => (
            <button
              key={s.title}
              className={`math-step ${i === index ? 'selected-math' : ''}`}
              onClick={() => setIndex(i)}
            >
              <span className="math-step-number mono">
                {i < index ? <Check size={14} /> : `0${i + 1}`}
              </span>
              <span>
                {s.title}
                <small>{i < 4 ? 'KEY GENERATION' : i === 4 ? 'ENCRYPTION' : 'DECRYPTION'}</small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
          <div className="toy-label">
            <FlaskConical size={15} /> Tiny teaching key · 12-bit modulus
          </div>
        </section>
        <section className="panel math-canvas">
          <div className="math-grid" />
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="math-content"
            >
              <div className="eyebrow">{step.label}</div>
              <div className="math-display">{step.formula}</div>
              <div className="math-result mono">{step.result}</div>
              <h2>{step.title}</h2>
              <p>{step.detail}</p>
            </motion.div>
          </AnimatePresence>
          <Stepper step={index} count={mathSteps.length} onChange={setIndex} />
        </section>
      </div>
      <section className="panel toy-workbench">
        <div className="panel-top">
          <div className="panel-title">
            <MousePointer2 size={16} />
            <h2>Change the message. See the mathematics.</h2>
          </div>
          <span className="subtle-badge">INTERACTIVE</span>
        </div>
        <div className="toy-controls">
          <div>
            <label htmlFor="toy-message">Your message integer</label>
            <input
              id="toy-message"
              value={toy}
              inputMode="numeric"
              onChange={(e) => setToy(e.target.value)}
              aria-invalid={!valid}
            />
            <small>
              {valid
                ? 'Choose an integer from 0 to 3232.'
                : 'Enter a whole number between 0 and 3232.'}
            </small>
          </div>
          <ArrowRight className="toy-arrow" size={22} />
          <div className="toy-result">
            <small>CIPHERTEXT</small>
            <strong className="mono">{valid ? String(value) : '—'}</strong>
            <span>m¹⁷ mod 3233</span>
          </div>
          <ArrowRight className="toy-arrow" size={22} />
          <div className="toy-result recovered-toy">
            <small>RECOVERED INTEGER</small>
            <strong className="mono">{valid ? String(recovered) : '—'}</strong>
            <span>c²⁷⁵³ mod 3233</span>
          </div>
          <button className="secondary-button" onClick={() => setTraceOpen(!traceOpen)}>
            {traceOpen ? 'Hide' : 'Show'} exponentiation
            <ChevronDown size={14} />
          </button>
          <LectureExampleButton onLoad={() => setToy('65')} />
        </div>
        {traceOpen && (
          <div className="trace-table">
            <p>
              <Term term="squareAndMultiply" /> · exponent 17 = binary 10001 · read left to right
            </p>
            <table>
              <thead>
                <tr>
                  <th>Bit</th>
                  <th>Square</th>
                  <th>Multiply if bit is 1</th>
                  <th>Accumulator</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s, i) => (
                  <tr key={i}>
                    <td>{s.bit}</td>
                    <td>{s.square}</td>
                    <td>{s.multiply}</td>
                    <td>{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="insight-strip">
        <CircleHelp size={20} />
        <p>
          <strong>Small enough to understand. Too small to protect anything.</strong> This{' '}
          <Term term="textbookRsa">textbook RSA</Term> example demonstrates RSA’s mathematics. The
          Workbench generates the actual 1024-bit and 2048-bit keys required for the project.
        </p>
      </div>
    </>
  );
}
