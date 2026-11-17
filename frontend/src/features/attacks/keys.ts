import fixtures from './fixtures.json';
import { deriveKey } from '../../engine/math';

/** Public demonstration private keys: never use a visitor's saved keyring here. */
export function broadcastKeys() {
  return fixtures.broadcast.map((key) => deriveKey(BigInt(key.p), BigInt(key.q), BigInt(key.e)));
}
export function guessingKey(bits: 1024 | 2048) {
  const key = fixtures.guessing[String(bits) as '1024' | '2048'];
  if (!key) throw new Error('Choose a 1024-bit or 2048-bit demonstration key.');
  return deriveKey(BigInt(key.p), BigInt(key.q), BigInt(key.e));
}
export const factoringFixtures = fixtures.factoring;
