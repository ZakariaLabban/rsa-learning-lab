import { bitLength, decryptCrt, encryptInt, i2osp, os2ip, type PrivateKey } from './math';
import {
  concat,
  fingerprint,
  fromBase64,
  oaepDecode,
  oaepEncode,
  packEnvelope,
  parseEnvelope,
  toBase64,
  toHex,
  utf8,
} from './encoding';

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

export async function encryptMessage(
  key: PrivateKey,
  message: string,
  mode: Mode,
): Promise<CipherResult> {
  if (mode !== 'oaep' && mode !== 'textbook') throw new Error('Unsupported encryption mode.');
  const start = performance.now(),
    bytes = utf8.encode(message),
    bits = bitLength(key.n),
    width = Math.ceil(bits / 8);
  if (key.n < 256n) throw new Error('This teaching key supports numbers only.');
  if (mode === 'oaep' && bits !== 1024 && bits !== 2048)
    throw new Error('OAEP requires a 1024/2048-bit key.');
  if (mode === 'textbook' && bytes.length > width - 1)
    throw new Error(`Textbook text mode accepts at most ${width - 1} bytes.`);
  const encoded = mode === 'oaep' ? await oaepEncode(bytes, width) : bytes;
  const cipher = encryptInt(os2ip(encoded), key),
    ciphertext = i2osp(cipher, width);
  const recipient = await fingerprint(key);
  const base = { v: 2 as const, bits, recipient };
  const envelope = packEnvelope(
    mode === 'oaep'
      ? { ...base, kind: 'oaep', ciphertext: toBase64(ciphertext) }
      : {
          ...base,
          kind: 'textbook-blocks',
          blocks: [toBase64(ciphertext)],
          byteLength: bytes.length,
        },
  );
  return {
    envelope,
    cipher_hex: toHex(ciphertext),
    cipher_int: String(cipher),
    message_int: String(os2ip(bytes)),
    utf8_hex: toHex(bytes),
    input_bytes: bytes.length,
    output_bytes: width,
    elapsed_ms: performance.now() - start,
    mode,
    bits,
  };
}
export async function decryptMessage(key: PrivateKey, value: string): Promise<Recovered> {
  const start = performance.now();
  try {
    const envelope = parseEnvelope(value),
      bits = bitLength(key.n),
      width = Math.ceil(bits / 8);
    if (
      envelope.recipient !== (await fingerprint(key)) ||
      envelope.bits !== bits ||
      envelope.kind === 'hybrid'
    )
      throw new Error('Wrong key or unsupported mode.');
    let bytes: Uint8Array, inputBytes: number;
    if (envelope.kind === 'oaep') {
      const ciphertext = fromBase64(envelope.ciphertext, width);
      bytes = await oaepDecode(i2osp(decryptCrt(os2ip(ciphertext), key).value, width));
      inputBytes = width;
    } else {
      const chunks = envelope.blocks.map((block, i) => {
        const length = Math.min(width - 1, envelope.byteLength - i * (width - 1));
        return i2osp(decryptCrt(os2ip(fromBase64(block, width)), key).value, length);
      });
      bytes = concat(...chunks);
      inputBytes = envelope.blocks.length * width;
    }
    return {
      message: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      utf8_hex: toHex(bytes),
      elapsed_ms: performance.now() - start,
      mode: envelope.kind === 'oaep' ? 'oaep' : 'textbook',
      input_bytes: inputBytes,
    };
  } catch {
    throw new Error('Decryption failed. Check the key and ciphertext envelope.');
  }
}
