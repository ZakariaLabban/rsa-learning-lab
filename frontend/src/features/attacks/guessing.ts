import { equalBytes, toHex, utf8 } from '../../engine/encoding';
import { oaepDecrypt, textbookDecryptBytes, textbookEncryptBytes } from '../../engine/rsa';
import { guessingKey } from './keys';
import { oaepDemonstration } from './oaepTrace';

export type Vote = 'YES' | 'NO';
export async function guessingLesson(vote: Vote, bits: 1024 | 2048) {
  if (vote !== 'YES' && vote !== 'NO') throw new Error('Choose YES or NO.');
  const key = guessingKey(bits),
    message = utf8.encode(vote);
  const textbook = {
    intercepted: textbookEncryptBytes(key, message)[0],
    yes: textbookEncryptBytes(key, utf8.encode('YES'))[0],
    no: textbookEncryptBytes(key, utf8.encode('NO'))[0],
  };
  // This is the same repeat-encryption experiment/engine as Existing experiments:
  // same key + same message, repeated with independent OAEP randomness.
  const oaep = await Promise.all(Array.from({ length: 3 }, () => oaepDemonstration(key, message)));
  const guesses = {
    yes: await oaepDemonstration(key, utf8.encode('YES')),
    no: await oaepDemonstration(key, utf8.encode('NO')),
  };
  const textbookRecovered = textbookDecryptBytes(key, [textbook.intercepted], message.length);
  const oaepRecovered = await Promise.all(oaep.map((value) => oaepDecrypt(key, value.ciphertext)));
  if (
    !equalBytes(textbookRecovered, message) ||
    oaepRecovered.some((value) => !equalBytes(value, message))
  )
    throw new Error('The demonstration did not decrypt correctly.');
  const recoveredVote = equalBytes(textbook.intercepted, textbook.yes)
    ? 'YES'
    : equalBytes(textbook.intercepted, textbook.no)
      ? 'NO'
      : null;
  return {
    vote,
    bits,
    key: { n: key.n, e: key.e },
    textbook,
    recoveredVote,
    oaep,
    guesses,
    samplesIdentical: new Set(oaep.map((value) => toHex(value.ciphertext))).size === 1,
    oaepMatches: {
      yes: equalBytes(oaep[0].ciphertext, guesses.yes.ciphertext),
      no: equalBytes(oaep[0].ciphertext, guesses.no.ciphertext),
    },
    recovered: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(textbookRecovered),
    oaepRecovered: oaepRecovered.map((bytes) =>
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes),
    ),
  };
}
