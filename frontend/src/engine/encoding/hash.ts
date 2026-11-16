import { concat, uint32 } from './bytes';

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}
export async function mgf1(seed: Uint8Array, length: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(length) || length < 0 || length > 65536)
    throw new RangeError('Invalid mask length.');
  const output = new Uint8Array(length);
  for (let counter = 0; counter * 32 < length; counter++) {
    const block = await sha256(concat(seed, uint32(counter)));
    output.set(block.subarray(0, Math.min(32, length - counter * 32)), counter * 32);
  }
  return output;
}
