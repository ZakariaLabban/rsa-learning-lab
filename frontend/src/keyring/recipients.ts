import type { PublicKey } from '../engine/math';
import { parseKeyFile } from './files';
import type { KeyEntry, KeyringState, KeySource } from './store';

export type Recipient = {
  label: string;
  key: PublicKey;
  fingerprint: string;
  source: KeySource | 'pasted';
  /** Keyring entry id; absent for a pasted one-time key. */
  entryId?: string;
  /** Contacts only. */
  verified?: boolean;
};
export type RecipientGroup = { label: string; entries: KeyEntry[] };

/** Groups for the "To:" picker: Me, Demo characters (incl. the lecture key), My contacts. */
export function recipientGroups(state: KeyringState): RecipientGroup[] {
  const of = (...sources: KeySource[]) =>
    state.entries.filter((entry) => sources.includes(entry.source));
  return [
    { label: 'Me', entries: of('mine') },
    { label: 'Demo characters', entries: of('demo', 'lecture') },
    { label: 'My contacts', entries: of('contact') },
  ].filter((group) => group.entries.length > 0);
}

export function recipientFromEntry(entry: KeyEntry): Recipient {
  return {
    label: entry.name,
    key: entry.key,
    fingerprint: entry.fingerprint,
    source: entry.source,
    entryId: entry.id,
    ...(entry.source === 'contact' ? { verified: entry.verified === true } : {}),
  };
}

/**
 * One-time recipient from pasted key-file text (not saved). If a key-pair file is pasted,
 * only its public part is used.
 */
export async function recipientFromPaste(text: string): Promise<Recipient> {
  const parsed = await parseKeyFile(text.trim());
  return {
    label: parsed.name ?? 'Pasted key',
    key: { n: parsed.key.n, e: parsed.key.e },
    fingerprint: parsed.fingerprint,
    source: 'pasted',
  };
}
