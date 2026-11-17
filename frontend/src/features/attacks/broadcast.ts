import {
  bitLength,
  crt,
  decryptInt,
  deriveKey,
  encryptInt,
  gcd,
  i2osp,
  integerRoot,
  os2ip,
  type PublicKey,
} from '../../engine/math';
import { equalBytes, utf8 } from '../../engine/encoding';
import { oaepDecrypt, oaepEncrypt } from '../../engine/rsa';
import { broadcastKeys } from './keys';

export type BroadcastScenario =
  'normal' | 'shared-factor' | 'different-messages' | 'large-exponent' | 'out-of-range';
export type BroadcastMode = 'textbook' | 'oaep';
export const BROADCAST_MESSAGE = 'Meet at the library at noon; bring the blue notebook.';

/** Eve's attack: takes ONLY public keys and intercepted ciphertext integers. */
export function recoverBroadcast(keys: readonly PublicKey[], ciphertexts: readonly bigint[]) {
  if (keys.length !== 3 || ciphertexts.length !== 3)
    throw new Error('This demonstration needs three recipients.');
  if (keys.some((key) => key.n <= 1n || bitLength(key.n) > 2048))
    throw new Error('Invalid or oversized demonstration modulus.');
  for (let i = 0; i < keys.length; i++)
    for (let j = 0; j < i; j++) {
      const factor = gcd(keys[i].n, keys[j].n);
      if (factor !== 1n)
        throw new Error(
          `Recipients ${j + 1} and ${i + 1} share a factor: gcd = ${factor}. Pairwise-coprime CRT assumptions fail; shared primes are a separate vulnerability.`,
        );
    }
  if (keys.some((key) => key.e !== 3n))
    throw new Error(
      'This three-recipient cube-root attack requires e=3 for every recipient. e=65537 stops this particular procedure; textbook RSA is still deterministic.',
    );
  if (ciphertexts.some((value, index) => value < 0n || value >= keys[index].n))
    throw new Error('Ciphertext must satisfy 0 ≤ C < its modulus.');
  const combined = crt(
    ciphertexts,
    keys.map((key) => key.n),
    { trace: true },
  );
  const candidate = integerRoot(combined.value, 3);
  const exactCube = candidate ** 3n === combined.value;
  let text: string | null = null;
  if (exactCube) {
    try {
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        i2osp(candidate, Math.max(1, Math.ceil(bitLength(candidate) / 8))),
      );
    } catch {
      /* An integer cube does not necessarily encode valid UTF-8. */
    }
  }
  return { ...combined, candidate, exactCube, text };
}

export async function broadcastLesson(
  message: string,
  mode: BroadcastMode,
  scenario: BroadcastScenario,
) {
  if (
    !['textbook', 'oaep'].includes(mode) ||
    !['normal', 'shared-factor', 'different-messages', 'large-exponent', 'out-of-range'].includes(
      scenario,
    )
  )
    throw new Error('Choose a supported broadcast demonstration.');
  if (message.length > 61) throw new Error('Use 1 to 61 UTF-8 bytes.');
  const bytes = utf8.encode(message);
  if (!bytes.length || bytes.length > 61 || bytes[0] === 0)
    throw new Error('Use 1 to 61 UTF-8 bytes, without a leading zero byte.');
  let keys = broadcastKeys();
  if (scenario === 'shared-factor') keys[2] = deriveKey(keys[0].p, keys[2].q, 3n);
  if (scenario === 'large-exponent') keys = keys.map((key) => deriveKey(key.p, key.q, 65537n));
  const publicKeys = keys.map((key) => ({ n: key.n, e: key.e }));
  const original = os2ip(bytes);
  if (scenario === 'out-of-range')
    throw new Error(
      'M must satisfy 0 ≤ M < every recipient modulus. This failing example sets M equal to the first modulus.',
    );
  if (publicKeys.some((key) => original >= key.n))
    throw new Error('M must be less than every modulus.');
  // Failure controls use textbook RSA so only one assumption changes at a time.
  if (scenario !== 'normal' && mode !== 'textbook')
    throw new Error(
      'Use textbook mode to isolate a failing precondition; OAEP is compared in the normal scenario.',
    );
  const plaintexts = keys.map((_, index) =>
    scenario === 'different-messages' && index === 2 ? utf8.encode(`${message}!`) : bytes,
  );
  const ciphertextBytes =
    mode === 'oaep'
      ? await Promise.all(keys.map((key, index) => oaepEncrypt(key, plaintexts[index])))
      : null;
  const ciphertexts = ciphertextBytes
    ? ciphertextBytes.map(os2ip)
    : keys.map((key, index) => encryptInt(os2ip(plaintexts[index]), key));
  const recipientsRecovered = ciphertextBytes
    ? await Promise.all(keys.map((key, index) => oaepDecrypt(key, ciphertextBytes[index])))
    : keys.map((key, index) =>
        i2osp(decryptInt(ciphertexts[index], key), plaintexts[index].length),
      );
  if (recipientsRecovered.some((value, index) => !equalBytes(value, plaintexts[index])))
    throw new Error('A recipient failed to decrypt the demonstration.');
  let attack: ReturnType<typeof recoverBroadcast> | null = null,
    problem = '';
  try {
    attack = recoverBroadcast(publicKeys, ciphertexts);
  } catch (error) {
    problem = (error as Error).message;
  }
  return {
    message,
    mode,
    scenario,
    publicKeys,
    ciphertexts,
    original,
    // These comparisons belong to Alice's controlled demonstration, not Eve's inputs.
    allRecipientsRecovered: true,
    attack,
    problem,
    matchesOriginal: !!attack?.exactCube && attack.candidate === original,
    commonRawInteger: scenario !== 'different-messages' && mode === 'textbook',
  };
}
