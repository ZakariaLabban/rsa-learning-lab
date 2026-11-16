import { MAX_FILE_CHARS, parseKeyFile, publicKeyFile, type KeyEntry } from '../../keyring';

export async function parseContact(text: string) {
  if (text.length > MAX_FILE_CHARS) throw new Error('The public-key file is too large.');
  // Reject private material before doing costly private-key validation.
  let source: unknown;
  try {
    source = JSON.parse(text);
  } catch {
    throw new Error('Paste a valid public-key .pub file, not a link or message.');
  }
  if (
    !source ||
    typeof source !== 'object' ||
    !('format' in source) ||
    source.format !== 'rsa-lab-public-v2'
  )
    throw new Error(
      'Contacts accept public-key .pub files only. Never share a private key-pair file.',
    );
  const parsed = await parseKeyFile(text);
  if (parsed.kind !== 'public') throw new Error('A contact needs a public key only.');
  return parsed;
}

/** Compact version of the existing .pub contract, with no private fields. */
export function shareText(entry: KeyEntry): string {
  return JSON.stringify(JSON.parse(publicKeyFile(entry.name, entry.key, entry.fingerprint)));
}
