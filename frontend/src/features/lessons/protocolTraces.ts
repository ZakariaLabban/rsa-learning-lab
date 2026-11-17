import { toHex } from '../../engine/encoding';
import type { KeyEntry } from '../../keyring';
import type { LessonSigned, verifyLesson } from '../signatures/model';
import type { AttackResults } from '../attacks/jobs';
import type { OaepDemonstration } from '../attacks/oaepTrace';
import type { FileResult } from '../files/model';
import type { JourneyStep } from '../encrypt/model';
import { frame, datum, type TraceFrame } from './traceTypes';

export function factoringFrames(value: AttackResults['factor']): TraceFrame[] {
  const frames: TraceFrame[] = [];
  // These are the first actual odd divisors counted by the completed engine run.
  for (let i = 0; i < Math.min(value.attempts, 12); i++) {
    const divisor = BigInt(3 + 2 * i),
      remainder = value.n % divisor;
    frames.push({
      ...frame(
        `Try divisor ${divisor}`,
        'A zero remainder reveals a factor.',
        [datum('public n', value.n), datum('trial divisor', divisor)],
        'divide',
        datum('remainder', remainder),
        `${value.n} mod ${divisor} = ${remainder}`,
      ),
      reduction: { product: value.n, modulus: divisor },
    });
  }
  if (value.attempts > 12)
    frames.push(
      frame(
        'Skip the middle trials',
        `The animation omits ${value.attempts - 12} trial divisions. The measured worker run performed them; animation time is not search time.`,
        [datum('actual attempts', value.attempts)],
        'search summary',
        datum('last divisor', value.divisor),
      ),
    );
  if (value.status !== 'factored')
    return [
      ...frames,
      frame(
        'Search stopped',
        'A timeout or exhausted search does not prove the key secure.',
        [datum('attempts', value.attempts)],
        'stop',
        datum('status', value.status),
      ),
    ];
  return [
    ...frames,
    frame(
      'Recover the primes',
      'The exact divisor and quotient reconstruct n.',
      [datum('p', value.p), datum('q', value.q)],
      'multiply',
      datum('n', value.n),
    ),
    frame(
      'Recover the totient',
      'Both factors expose φ(n).',
      [datum('p−1', value.p - 1n), datum('q−1', value.q - 1n)],
      'multiply',
      datum('φ(n)', value.phi),
    ),
    frame(
      'Rebuild the private exponent',
      'Invert the public exponent modulo φ(n).',
      [datum('e', value.e), datum('φ(n)', value.phi)],
      'inverse',
      datum('recovered d', value.d),
    ),
    frame(
      'Read the intercepted message',
      'Eve uses her recovered private exponent, not a supplied secret.',
      [datum('C', value.ciphertext), datum('recovered d', value.d)],
      'RSA decrypt',
      datum('M', value.message),
    ),
  ];
}

export function guessingFrames(value: AttackResults['guess']): TraceFrame[] {
  return [
    frame(
      'Prepare both guesses',
      'Eve only needs the public key to encrypt each possible vote.',
      [
        datum('YES ciphertext', toHex(value.textbook.yes)),
        datum('NO ciphertext', toHex(value.textbook.no)),
      ],
      'compare',
      datum('intercepted C', toHex(value.textbook.intercepted)),
    ),
    frame(
      'Match deterministic ciphertext',
      'Identical textbook plaintext and public key give identical ciphertext.',
      [datum('intercepted', toHex(value.textbook.intercepted))],
      'equality',
      datum('Eve recovers', value.recoveredVote ?? 'No match'),
    ),
    ...value.oaep.map((sample, i) =>
      frame(
        `OAEP sample ${i + 1}`,
        'Each sample uses independently generated padding randomness. The ciphertext is from this run.',
        [datum('same vote', value.vote)],
        'OAEP / RSA',
        datum('ciphertext', toHex(sample.ciphertext)),
      ),
    ),
    frame(
      'Test the equality shortcut',
      'A non-match cannot rule out a vote when OAEP uses a different random seed.',
      [
        datum('YES equal?', String(value.oaepMatches.yes)),
        datum('NO equal?', String(value.oaepMatches.no)),
      ],
      'check guesses',
      datum('roundtrip', value.oaepRecovered.join(' / ')),
    ),
  ];
}

export function oaepFrames(trace: OaepDemonstration, revealed: boolean): TraceFrame[] {
  const secret = (bytes: Uint8Array) =>
    revealed ? toHex(bytes) : 'Hidden · reveal demonstration randomness';
  return [
    frame(
      'Assemble the data block',
      'Join the empty-label hash, zero padding, separator 01 and message bytes.',
      [datum('label hash', toHex(trace.labelHash)), datum('message', secret(trace.message))],
      'concatenate',
      datum('DB', secret(trace.db)),
    ),
    frame(
      'Expand fresh randomness',
      'MGF1 expands this run’s random seed into a DB-sized mask.',
      [datum('seed', secret(trace.seed))],
      'MGF1',
      datum('dbMask', secret(trace.dbMask)),
    ),
    frame(
      'Mask the data block',
      'XOR DB and dbMask byte by byte.',
      [datum('DB', secret(trace.db)), datum('dbMask', secret(trace.dbMask))],
      'XOR',
      datum('maskedDB', secret(trace.maskedDb)),
    ),
    frame(
      'Mask the seed',
      'MGF1(maskedDB,32) masks the original seed.',
      [datum('seed', secret(trace.seed)), datum('seedMask', secret(trace.seedMask))],
      'XOR',
      datum('maskedSeed', secret(trace.maskedSeed)),
    ),
    frame(
      'Build the encoded block',
      'Prefix 00 and concatenate maskedSeed and maskedDB.',
      [datum('maskedSeed', secret(trace.maskedSeed)), datum('maskedDB', secret(trace.maskedDb))],
      'concatenate',
      datum('EM', secret(trace.encoded)),
    ),
    frame(
      'Apply public RSA',
      'Only the ciphertext goes onto the wire; the teaching randomness stays local.',
      [datum('EM', secret(trace.encoded))],
      'RSA encrypt',
      datum('ciphertext', toHex(trace.ciphertext)),
    ),
  ];
}

export function broadcastFrames(value: AttackResults['broadcast']): TraceFrame[] {
  const frames = value.ciphertexts.map((c, i) =>
    frame(
      `Recipient ${i + 1}`,
      'Each public modulus produces its own intercepted ciphertext.',
      [datum('public n', value.publicKeys[i].n), datum('public e', value.publicKeys[i].e)],
      'public RSA',
      datum('ciphertext', c),
    ),
  );
  if (!value.attack)
    return [
      ...frames,
      frame(
        'Check the preconditions',
        'This run does not meet this attack’s CRT or exponent assumptions.',
        [datum('scenario', value.scenario)],
        'stop',
        datum('reason', value.problem),
      ),
    ];
  const attack = value.attack;
  frames.push(
    ...attack.rows.map((row, i) =>
      frame(
        `CRT term ${i + 1}`,
        'Weight this ciphertext with its CRT partial product and inverse.',
        [datum('C_i', row.residue), datum('N_i', row.partial), datum('inverse', row.coefficient)],
        'multiply',
        datum('term', row.term),
      ),
    ),
  );
  frames.push(
    frame(
      'Combine ciphertexts',
      'Sum the weighted ciphertext terms modulo the product of the three moduli.',
      [datum('product N', attack.modulus)],
      'CRT',
      datum('combined value', attack.value),
    ),
    frame(
      'Take an integer cube root',
      'Accept only an exact cube; rounded floating-point roots are not used.',
      [datum('combined value', attack.value)],
      'cube root',
      datum('candidate M', attack.candidate),
    ),
    frame(
      'Check the cube',
      value.mode === 'oaep'
        ? 'Randomized encodings are not one common raw integer; this shortcut does not identify the original message.'
        : 'Compare the cube with the CRT result and the decoded candidate.',
      [datum('candidate³', attack.candidate ** 3n), datum('combined value', attack.value)],
      'exact equality',
      datum(
        'outcome',
        value.matchesOriginal
          ? `Recovered: ${attack.text}`
          : `Exact cube: ${attack.exactCube}; original recovered: ${value.matchesOriginal}`,
      ),
    ),
  );
  return frames;
}

export function signingFrames(signed: LessonSigned, n: bigint): TraceFrame[] {
  const frames: TraceFrame[] = [];
  if (signed.hash)
    frames.push(
      frame(
        'Hash the signed message',
        'This is the actual SHA-256 hash at signing time.',
        [datum('operation', 'SHA-256 of message at signing')],
        'hash',
        datum('hash', signed.hash),
      ),
    );
  if (signed.digest)
    frames.push(
      frame(
        'Form the teaching representative',
        'Number mode uses M; the insecure hash teaching mode reduces SHA-256 modulo n.',
        [datum('representative', signed.digest), datum('modulus n', n)],
        'prepare',
        datum('RSA input', signed.digest),
      ),
    );
  else
    frames.push(
      frame(
        'Encode with PSS',
        'PSS uses SHA-256 and a fresh 32-byte salt. This practical operation does not expose the salt or private exponent in the UI.',
        [datum('message hash', signed.hash ?? '')],
        'PSS encode',
        datum('encoding', 'Produced by the RSA-PSS engine; internal block not exposed'),
      ),
    );
  frames.push(
    frame(
      'Apply the private operation',
      'Apply RSA with the signer’s private key. The key itself is never sent.',
      [datum('modulus n', n), datum('exponent', 'private d (hidden)')],
      'RSA sign',
      datum('signature', signed.signature),
    ),
  );
  return frames;
}

export function verificationFrames(
  verdict: Awaited<ReturnType<typeof verifyLesson>>,
  signature: string,
  e: bigint,
  n: bigint,
): TraceFrame[] {
  const frames = [
    frame(
      'Receive public evidence',
      'Verification needs the public key and signature, not the signer’s private key.',
      [datum('signature', signature), datum('e', e), datum('n', n)],
      'public RSA',
      datum(
        'recovered representative',
        'recovered' in verdict
          ? (verdict.recovered ?? 'Rejected encoding')
          : 'PSS encoded block checked by engine',
      ),
    ),
  ];
  if ('hash' in verdict && verdict.hash)
    frames.push(
      frame(
        'Hash the current message',
        'Changing the message changes the value being checked.',
        [datum('operation', 'SHA-256 of the current verification message')],
        'hash',
        datum('message hash', verdict.hash),
      ),
    );
  frames.push(
    frame(
      'Compare the evidence',
      'Teaching modes compare representatives; RSA-PSS verifies the complete encoding and hash structure.',
      [
        datum(
          'expected digest',
          'digest' in verdict ? (verdict.digest ?? 'PSS structure') : 'PSS structure',
        ),
      ],
      'verify',
      datum('verdict', verdict.valid ? 'Signature valid' : 'Signature invalid'),
    ),
  );
  return frames;
}

export function contactFrames(entry: KeyEntry, text: string): TraceFrame[] {
  return [
    frame(
      'Select public components',
      'Only n and e are exported. No private exponent or primes enter the share file.',
      [datum('n', entry.key.n), datum('e', entry.key.e)],
      'serialize',
      datum('public-key text', text),
    ),
    frame(
      'Identify the key',
      'The fingerprint is derived from the canonical public key, not from the displayed name.',
      [datum('public key', text)],
      'fingerprint',
      datum('SHA-256 fingerprint', entry.fingerprint),
    ),
    frame(
      'Share and compare',
      'QR, copy and .pub export carry the same public key. Verify the complete fingerprint through a trusted channel.',
      [datum('fingerprint', entry.fingerprint)],
      'trusted comparison',
      datum('status', entry.verified ? 'Marked verified' : 'Unverified · compare with owner'),
    ),
  ];
}

export function fileFrames(value: FileResult): TraceFrame[] {
  if (value.type === 'opened')
    return [
      frame(
        'Open the envelope',
        'Use the matching private RSA key to unwrap the AES key; it stays local.',
        [datum('encrypted file', 'Hybrid file envelope')],
        'RSA unwrap',
        datum('AES key', 'Recovered locally · not displayed'),
      ),
      frame(
        'Authenticate before release',
        'AES-GCM verifies authentication before any plaintext download is offered.',
        [datum('file name', value.file.name)],
        'AES-GCM open',
        datum('plaintext bytes', value.bytes.length),
      ),
      frame(
        'Check the sender',
        'Signature status is checked separately from successful decryption.',
        [datum('signature status', value.signature.status)],
        'verify',
        datum('ready to download', value.file.name),
      ),
    ];
  const trace = value.publicTrace;
  return [
    frame(
      'Protect the bulk data',
      'AES-GCM encrypts the file with a random AES key. The key is not exposed by this animation.',
      [datum('file bytes', value.size), datum('nonce', trace?.nonce ?? 'Not retained')],
      'AES-GCM seal',
      datum(
        'ciphertext + tag preview',
        trace
          ? `${trace.ciphertextPrefix}… (${trace.ciphertextChars} base64 characters)`
          : 'Not retained',
      ),
    ),
    frame(
      'Wrap the AES key',
      'RSA-OAEP protects only the small AES key, not every file block.',
      [datum('AES key', 'Local secret · not displayed')],
      'RSA-OAEP',
      datum('wrapped AES key', trace?.wrappedKey ?? 'Not retained'),
    ),
    frame(
      'Assemble the envelope',
      'Package the public encrypted fields for the receiver. The AES key and private RSA key are not included.',
      [
        datum('wrapped key', trace?.wrappedKey ?? 'Not retained'),
        datum('nonce', trace?.nonce ?? 'Not retained'),
      ],
      'package',
      datum('encrypted file envelope', `${value.envelope.length} characters`),
    ),
  ];
}

export function journeyFrames(steps: JourneyStep[]): TraceFrame[] {
  return steps.map((step) => {
    const values = step.values.filter((value) => !value.privateValue);
    return frame(
      step.title,
      step.explanation,
      values.slice(0, 3).map((value) => datum(value.label, value.value)),
      step.short,
      values.length
        ? datum(values.at(-1)!.label, values.at(-1)!.value)
        : datum('computed state', step.formula),
      step.formula,
    );
  });
}
