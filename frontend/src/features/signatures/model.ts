import { fromHex, sha256, toHex, utf8 } from '../../engine/encoding';
import { modexp, os2ip, type PrivateKey, type PublicKey } from '../../engine/math';
import {
  capabilities,
  pssSign,
  pssVerifySignature,
  teachingSign,
  teachingVerify,
} from '../../engine/rsa';

export type LessonMode = 'number' | 'hash' | 'pss';
export const MAX_SIGNATURE_MESSAGE_BYTES = 10000;

function bytes(message: string) {
  if (message.length > MAX_SIGNATURE_MESSAGE_BYTES)
    throw new Error('Messages are limited to 10,000 UTF-8 bytes.');
  const result = utf8.encode(message);
  if (result.length > MAX_SIGNATURE_MESSAGE_BYTES)
    throw new Error('Messages are limited to 10,000 UTF-8 bytes.');
  return result;
}
function number(text: string, n: bigint) {
  if (!/^[0-9]{1,20}$/.test(text))
    throw new Error('Enter a non-negative whole number of at most 20 digits.');
  const value = BigInt(text);
  if (value >= n) throw new Error('The number must be less than n.');
  return value;
}
function allowed(key: PublicKey, mode: LessonMode) {
  if ((mode === 'pss') !== capabilities(key).pss)
    throw new Error('Use RSA-PSS for 1024/2048-bit keys and teaching signatures for tiny keys.');
}
export type LessonSigned = { signature: string; hash?: string; digest?: string };
export async function signLesson(
  key: PrivateKey,
  mode: LessonMode,
  message: string,
): Promise<LessonSigned> {
  allowed(key, mode);
  if (mode === 'number') {
    const digest = number(message, key.n);
    return { signature: String(modexp(digest, key.d, key.n)), digest: String(digest) };
  }
  const input = bytes(message);
  if (mode === 'hash') {
    const result = await teachingSign(key, input);
    return {
      signature: String(result.signature),
      hash: toHex(result.hash),
      digest: String(result.digest),
    };
  }
  return { signature: toHex(await pssSign(key, input)), hash: toHex(await sha256(input)) };
}
export async function verifyLesson(
  key: PublicKey,
  mode: LessonMode,
  message: string,
  signature: string,
) {
  if ((mode === 'pss') !== capabilities(key).pss) return { valid: false };
  if (mode === 'pss') {
    const input = bytes(message);
    const hash = toHex(await sha256(input));
    if (!/^[a-f0-9]{256}$|^[a-f0-9]{512}$/i.test(signature)) return { valid: false, hash };
    return { valid: await pssVerifySignature(key, input, fromHex(signature)), hash };
  }
  const expected =
    mode === 'number' ? number(message, key.n) : os2ip(await sha256(bytes(message))) % key.n;
  if (!/^[0-9]{1,20}$/.test(signature) || BigInt(signature) >= key.n)
    return { valid: false, digest: String(expected) };
  const s = BigInt(signature);
  if (mode === 'hash') {
    const result = await teachingVerify(key, bytes(message), s);
    return {
      valid: result.valid,
      digest: String(result.digest),
      hash: toHex(result.hash),
      recovered: String(result.recovered),
    };
  }
  const recovered = modexp(s, key.e, key.n);
  return { valid: expected === recovered, digest: String(expected), recovered: String(recovered) };
}
