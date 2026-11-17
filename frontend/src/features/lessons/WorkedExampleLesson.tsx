import { useState } from 'react';
import { deriveKey } from '../../engine/math';
import { exponentiation } from '../number-theory/model';
import { keyFrames, powerFrames } from './mathTraces';
import { LessonTrace } from './LessonTrace';

const key = deriveKey(61n, 53n, 17n);
export function WorkedExampleLesson() {
  const [input, setInput] = useState('65'),
    [part, setPart] = useState<'keys' | 'encrypt' | 'decrypt' | 'all'>('all');
  const valid = /^\d{1,4}$/.test(input) && BigInt(input) < key.n;
  const encryption = valid ? exponentiation(input, '17', '3233') : null;
  const decryption = encryption
    ? exponentiation(String(encryption.result.value), '2753', '3233')
    : null;
  const setup = keyFrames(key, true),
    enc = encryption ? powerFrames(encryption) : [],
    dec = decryption ? powerFrames(decryption) : [];
  const frames =
    part === 'keys'
      ? setup
      : part === 'encrypt'
        ? enc
        : part === 'decrypt'
          ? dec
          : [
              ...setup,
              ...enc.map((f) => ({ ...f, title: `Encrypt · ${f.title}` })),
              ...dec.map((f) => ({ ...f, title: `Decrypt · ${f.title}` })),
            ];
  return (
    <section className="panel feature-body">
      <h2>One complete RSA example</h2>
      <p>
        Public teaching key: p=61, q=53, e=17, d=2753, n=3233. Start with 65, the byte for “A”, or
        choose your own integer.
      </p>
      <label>
        Your message integer
        <input
          inputMode="numeric"
          maxLength={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </label>
      {!valid && <p role="alert">Use a whole number from 0 to 3232.</p>}
      {encryption && decryption && (
        <p className="lesson-answer" role="status">
          {input} → {String(encryption.result.value)} → {String(decryption.result.value)}
        </p>
      )}
      <div className="feature-actions" aria-label="Worked example section">
        {(
          [
            ['all', 'Full journey'],
            ['keys', 'Build the keys'],
            ['encrypt', 'Inside encryption'],
            ['decrypt', 'Inside decryption'],
          ] as const
        ).map(([value, label]) => (
          <button
            className="secondary-button"
            key={value}
            aria-pressed={part === value}
            onClick={() => setPart(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {valid && (
        <LessonTrace
          title="Worked RSA journey machine"
          frames={frames}
          resetKey={`${input}-${part}`}
        />
      )}
    </section>
  );
}
