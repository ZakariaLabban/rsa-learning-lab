import { useState } from 'react';
import { Value } from '../../components/Value';
import { toHex } from '../../engine/encoding';
import type { OaepDemonstration } from './oaepTrace';

export function OaepDiagram({ trace }: { trace: OaepDemonstration }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <section className="feature-result" aria-label="OAEP sender-side teaching diagram">
      <h3>How this OAEP block was built</h3>
      <ol className="oaep-flow">
        <li>DB = SHA-256(empty label) || zero padding || 01 || message</li>
        <li>A fresh 32-byte seed → MGF1-SHA256 → dbMask</li>
        <li>maskedDB = DB XOR dbMask</li>
        <li>seedMask = MGF1-SHA256(maskedDB, 32); maskedSeed = seed XOR seedMask</li>
        <li>EM = 00 || maskedSeed || maskedDB → RSA public operation → ciphertext</li>
      </ol>
      <p className="keyring-warning">
        Alice’s local teaching view only: revealing the seed and encoded block exposes information
        Eve’s guessing experiment does not receive. Never send this trace alongside a real message.
        These values are generated fresh, stay in memory, and are not logged or saved.
      </p>
      <button className="secondary-button" onClick={() => setRevealed((value) => !value)}>
        {revealed ? 'Hide demonstration randomness' : 'Reveal demonstration randomness'}
      </button>
      {revealed && (
        <div className="oaep-values">
          {(
            [
              ['SHA-256(empty label)', trace.labelHash],
              ['Zero padding PS', trace.padding],
              ['Message bytes M', trace.message],
              ['Fresh random seed', trace.seed],
              ['DB', trace.db],
              ['dbMask = MGF1(seed)', trace.dbMask],
              ['maskedDB', trace.maskedDb],
              ['seedMask = MGF1(maskedDB)', trace.seedMask],
              ['maskedSeed', trace.maskedSeed],
              ['Actual OAEP encoded block EM', trace.encoded],
              ['Resulting RSA ciphertext', trace.ciphertext],
            ] as const
          ).map(([label, bytes]) => (
            <Value key={label} label={label} value={toHex(bytes)} />
          ))}
          <p className="helper-text">
            Hexadecimal values are from this run, not illustrative placeholders. The separator is
            the byte 01; EM starts with byte 00.
          </p>
        </div>
      )}
    </section>
  );
}
