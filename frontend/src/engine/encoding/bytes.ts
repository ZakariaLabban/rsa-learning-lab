import { i2osp } from '../math';

export const utf8 = new TextEncoder();
export function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) throw new RangeError('XOR operands must have equal lengths.');
  return a.map((byte, i) => byte ^ b[i]);
}
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function fromHex(text: string): Uint8Array {
  if (text.length % 2 || !/^[0-9a-f]*$/i.test(text)) throw new Error('Invalid hexadecimal.');
  return Uint8Array.from(text.match(/../g) ?? [], (byte) => Number.parseInt(byte, 16));
}
export function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 8192)
    text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
}
export function fromBase64(text: string, maximum = 25 * 1024 * 1024 + 16): Uint8Array {
  if (
    typeof text !== 'string' ||
    text.length > 4 * Math.ceil(maximum / 3) ||
    text.length % 4 ||
    /[^A-Za-z0-9+/=]/.test(text)
  )
    throw new Error('Invalid base64 or size limit exceeded.');
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  if (text.indexOf('=') !== (padding ? text.length - padding : -1))
    throw new Error('Invalid base64 padding.');
  const binary = atob(text),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.length > maximum || toBase64(bytes) !== text) throw new Error('Noncanonical base64.');
  return bytes;
}
export function randomBytes(length: number): Uint8Array {
  if (!Number.isSafeInteger(length) || length < 0 || length > 65536)
    throw new RangeError('Invalid random byte length.');
  return crypto.getRandomValues(new Uint8Array(length));
}
export function uint32(value: number): Uint8Array {
  return i2osp(BigInt(value), 4);
}
