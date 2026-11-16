import { bitLength, i2osp, type PublicKey } from '../math';
import { concat, toHex, uint32, utf8 } from './bytes';
import { sha256 } from './hash';

export async function fingerprint(key: PublicKey): Promise<string> {
  if (key.n <= 1n || key.e <= 1n || key.e >= key.n) throw new RangeError('Invalid public key.');
  const n = i2osp(key.n, Math.ceil(bitLength(key.n) / 8));
  const e = i2osp(key.e, Math.ceil(bitLength(key.e) / 8));
  return toHex(
    await sha256(concat(utf8.encode('rsa-lab.key.v2\0'), uint32(n.length), n, uint32(e.length), e)),
  );
}
export function groupFingerprint(value: string): string {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error('Invalid fingerprint.');
  return value.match(/.{4}/g)!.join(' ');
}
