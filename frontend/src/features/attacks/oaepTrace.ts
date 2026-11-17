import { equalBytes, mgf1, xor } from '../../engine/encoding';
import { oaepEncryptTrace } from '../../engine/rsa';
import type { PublicKey } from '../../engine/math';

/** Isolated teaching trace. Recover the actual random seed from the sender's EM.
 * No randomness injection; never used by practical-message/file operations or storage. */
export async function oaepDemonstration(key: PublicKey, message: Uint8Array) {
  const sealed = await oaepEncryptTrace(key, message);
  const maskedSeed = sealed.encoded.slice(1, 33),
    maskedDb = sealed.encoded.slice(33);
  const seedMask = await mgf1(maskedDb, 32),
    seed = xor(maskedSeed, seedMask);
  const dbMask = await mgf1(seed, maskedDb.length),
    db = xor(maskedDb, dbMask);
  const separator = db.length - message.length - 1;
  if (db[separator] !== 1 || !equalBytes(db.slice(separator + 1), message))
    throw new Error('OAEP demonstration trace mismatch.');
  return {
    ...sealed,
    seed,
    db,
    dbMask,
    maskedDb,
    seedMask,
    maskedSeed,
    labelHash: db.slice(0, 32),
    padding: db.slice(32, separator),
    message,
  };
}
export type OaepDemonstration = Awaited<ReturnType<typeof oaepDemonstration>>;
