import { os2ip, type PrivateKey, type PublicKey } from './math';
import { concat, toHex, utf8 } from './encoding';
import { capabilities, openBasic, sealBasic } from './rsa';

export type Mode = 'oaep' | 'textbook';
export type LabKey = {
  id: string;
  n: string;
  e: string;
  bits: number;
  fingerprint: string;
  candidates: number;
  elapsed_ms: number;
};
export type CipherResult = {
  envelope: string;
  cipher_hex: string;
  cipher_int: string;
  message_int: string;
  utf8_hex: string;
  input_bytes: number;
  output_bytes: number;
  elapsed_ms: number;
  mode: Mode;
  bits: number;
};
export type Recovered = {
  message: string;
  utf8_hex: string;
  elapsed_ms: number;
  mode: Mode;
  input_bytes: number;
};

/** UI adapter: encrypts UTF-8 text for a public key (see engine/rsa for the operations). */
export async function encryptMessage(
  key: PublicKey,
  message: string,
  mode: Mode,
): Promise<CipherResult> {
  if (mode !== 'oaep' && mode !== 'textbook') throw new Error('Unsupported encryption mode.');
  const start = performance.now(),
    bytes = utf8.encode(message),
    { bits, width } = capabilities(key);
  const sealed = await sealBasic(key, bytes, mode);
  const ciphertext = concat(...sealed.blocks);
  return {
    envelope: sealed.envelope,
    cipher_hex: toHex(ciphertext),
    cipher_int: sealed.blocks.map((block) => String(os2ip(block))).join(' '),
    message_int: String(os2ip(bytes)),
    utf8_hex: toHex(bytes),
    input_bytes: bytes.length,
    output_bytes: sealed.blocks.length * width,
    elapsed_ms: performance.now() - start,
    mode,
    bits,
  };
}

/** UI adapter: decrypts a v2 envelope with the given private key; all failures are generic. */
export async function decryptMessage(key: PrivateKey, value: string): Promise<Recovered> {
  const start = performance.now();
  try {
    const opened = await openBasic(value, [key]);
    return {
      message: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(opened.bytes),
      utf8_hex: toHex(opened.bytes),
      elapsed_ms: performance.now() - start,
      mode: opened.mode,
      input_bytes: opened.blocks.length * capabilities(key).width,
    };
  } catch {
    throw new Error('Decryption failed. Check the key and ciphertext envelope.');
  }
}
