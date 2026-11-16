import type { PrivateKey } from '../math';
import { parseEnvelope, type EnvelopeV2 } from '../encoding';
import { openBasic, type Opened } from './envelopes';
import { openHybrid, type KnownSender, type OpenedHybrid } from './hybrid';

export type OpenedAny<K extends PrivateKey = PrivateKey> =
  ({ kind: 'basic' } & Opened<K>) | ({ kind: 'hybrid' } & OpenedHybrid<K>);

/** Opens any v2 envelope: textbook blocks, OAEP or hybrid (with signature checking). */
export async function openEnvelope<K extends PrivateKey>(
  envelope: string | EnvelopeV2,
  keys: readonly K[],
  knownSenders: readonly KnownSender[] = [],
): Promise<OpenedAny<K>> {
  const value = typeof envelope === 'string' ? parseEnvelope(envelope) : envelope;
  if (value.kind === 'hybrid')
    return { kind: 'hybrid', ...(await openHybrid(value, keys, knownSenders)) };
  return { kind: 'basic', ...(await openBasic(value, keys)) };
}
