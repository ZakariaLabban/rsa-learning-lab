/**
 * Logic for the Encrypt / Decrypt page (#13), kept free of React so it can be unit-tested.
 * Encryption needs only the recipient's public key; decryption picks a matching private key
 * from the keyring (my keys, demo characters, lecture key).
 */
import { os2ip, type PrivateKey } from '../../engine/math';
import { toHex, utf8 } from '../../engine/encoding';
import {
  capabilities,
  openBasic,
  sealBasic,
  textbookDecryptNumber,
  textbookEncryptNumber,
  type BasicMode,
  type Opened,
  type Sealed,
} from '../../engine/rsa';
import type { KeyEntry, KeyringState, Recipient } from '../../keyring';

export type InputMode = 'text' | 'number';
/** UI limit for text so a page action never runs thousands of RSA operations. */
export const TEXT_LIMIT = 1000;
const SHOWN_BLOCKS = 4;

export type EncryptRun =
  | { kind: 'number'; recipient: Recipient; m: bigint; c: bigint }
  | { kind: 'text'; mode: BasicMode; recipient: Recipient; text: string; sealed: Sealed };
export type DecryptRun =
  | { kind: 'number'; keyName: string; privateKey: PrivateKey; c: bigint; m: bigint }
  | { kind: 'text'; keyName: string; privateKey: PrivateKey; opened: Opened; text: string };

/** Default "To:": the active key, else my newest key, else demo Alice. */
export function defaultRecipientEntry(state: KeyringState): KeyEntry | undefined {
  const active = state.entries.find((e) => e.id === state.activeId && e.privateKey);
  const mine = state.entries.filter((e) => e.source === 'mine');
  return active ?? mine[mine.length - 1] ?? state.entries.find((e) => e.id === 'demo-alice');
}

/** The private key that can decrypt for this recipient, if this browser holds it. */
export function privateEntryFor(
  recipient: Recipient,
  entries: readonly KeyEntry[],
): KeyEntry | undefined {
  return entries.find((e) => e.privateKey && e.fingerprint === recipient.fingerprint);
}

/** Which padding modes and input modes the recipient's key allows, in plain words. */
export function recipientLimits(recipient: Recipient) {
  const caps = capabilities(recipient.key);
  return {
    caps,
    textAllowed: caps.textbookText,
    textProblem: caps.textbookText
      ? undefined
      : `This key is too small for text: n = ${recipient.key.n} is below 256, and one byte can be up to 255. Use Number mode.`,
    oaepProblem: caps.oaep
      ? undefined
      : `OAEP needs a 1024 or 2048-bit key; this is a ${caps.bits}-bit teaching key. Use textbook mode.`,
  };
}

/** Byte count / limit line for the text box, and a problem message when it does not fit. */
export function textCapacity(recipient: Recipient, mode: BasicMode, text: string) {
  const { caps } = recipientLimits(recipient);
  const length = utf8.encode(text).length;
  if (mode === 'oaep') {
    const max = caps.oaepMaxBytes;
    return {
      length,
      max,
      summary: `${length} / ${max} bytes`,
      problem:
        caps.oaep && length > max
          ? `With OAEP and a ${caps.bits}-bit key a message fits at most ${max} bytes; yours is ${length}. Shorten it, or use textbook mode to see it split into blocks.`
          : undefined,
    };
  }
  const chunk = Math.max(1, caps.textbookBlockBytes);
  const blocks = Math.max(1, Math.ceil(length / chunk));
  return {
    length,
    max: TEXT_LIMIT,
    summary: `${length} / ${TEXT_LIMIT} bytes · ${blocks} block${blocks === 1 ? '' : 's'} of up to ${chunk} byte${chunk === 1 ? '' : 's'}`,
    problem:
      length > TEXT_LIMIT
        ? `This lab encrypts at most ${TEXT_LIMIT} bytes of text at once; yours is ${length} bytes.`
        : undefined,
  };
}

/** Parses the number-mode message M, checking 0 <= M < n. */
export function parseMessageNumber(input: string, recipient: Recipient): bigint {
  const value = input.trim();
  if (!/^[0-9]+$/.test(value)) throw new Error('Enter M as a whole number (digits only).');
  const m = BigInt(value);
  if (m >= recipient.key.n)
    throw new Error(
      `M must be smaller than n (n = ${recipient.key.n}). Pick a smaller number or a bigger key.`,
    );
  return m;
}

export async function encrypt(
  recipient: Recipient,
  inputMode: InputMode,
  mode: BasicMode,
  input: string,
): Promise<EncryptRun> {
  const limits = recipientLimits(recipient);
  if (inputMode === 'number') {
    const m = parseMessageNumber(input, recipient);
    return { kind: 'number', recipient, m, c: textbookEncryptNumber(recipient.key, m) };
  }
  if (!limits.textAllowed) throw new Error(limits.textProblem);
  if (mode === 'oaep' && limits.oaepProblem) throw new Error(limits.oaepProblem);
  const capacity = textCapacity(recipient, mode, input);
  if (capacity.problem) throw new Error(capacity.problem);
  const sealed = await sealBasic(recipient.key, utf8.encode(input), mode);
  return { kind: 'text', mode, recipient, text: input, sealed };
}

const decoder = () => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** Decrypts the page's own run with the recipient's private key, if this browser has it. */
export async function decryptOwnRun(
  run: EncryptRun,
  entries: readonly KeyEntry[],
): Promise<DecryptRun> {
  const entry = privateEntryFor(run.recipient, entries);
  if (!entry?.privateKey)
    throw new Error(
      `Only ${run.recipient.label} can decrypt this: this browser doesn't hold their private key. Copy the envelope and send it to them.`,
    );
  if (run.kind === 'number')
    return {
      kind: 'number',
      keyName: entry.name,
      privateKey: entry.privateKey,
      c: run.c,
      m: textbookDecryptNumber(entry.privateKey, run.c),
    };
  return decryptReceived(run.sealed.envelope, [entry]);
}

/** Turns engine errors into plain explanations for the decrypt screens. */
function friendlyOpenError(message: string): string {
  if (message.includes('Legacy v1')) return message;
  if (message.includes('None of your'))
    return 'None of your private keys matches this envelope. It was encrypted for someone else’s key, or you need to import your key pair on the Keys page.';
  if (message.includes('Hybrid'))
    return 'This envelope uses hybrid encryption (signed messages or files), which this page can’t open yet.';
  if (message.includes('Invalid') || message.includes('envelope'))
    return 'This isn’t a complete RSA Lab envelope. Paste the whole text, starting with rsa-lab.v2:';
  return 'Decryption failed: the envelope was altered, or it doesn’t match this key.';
}

/** Decrypts a pasted envelope with whichever of my/demo private keys matches it. */
export async function decryptReceived(
  envelope: string,
  entries: readonly KeyEntry[],
): Promise<DecryptRun> {
  const holders = entries.filter((e) => e.privateKey);
  let opened: Opened;
  try {
    opened = await openBasic(
      envelope.trim(),
      holders.map((e) => e.privateKey!),
    );
  } catch (error) {
    throw new Error(friendlyOpenError((error as Error).message), { cause: error });
  }
  const entry = holders.find((e) => e.privateKey === opened.key)!;
  let text: string;
  try {
    text = decoder().decode(opened.bytes);
  } catch {
    throw new Error(
      'Decrypted, but the result isn’t valid text. Textbook RSA can’t detect changes, so the envelope was probably altered.',
    );
  }
  return { kind: 'text', keyName: entry.name, privateKey: entry.privateKey!, opened, text };
}

export type JourneyStep = {
  short: string;
  title: string;
  formula: string;
  who: 'Bob' | 'Wire' | 'Alice';
  explanation: string;
  values: { label: string; value: string; note?: string; privateValue?: boolean }[];
};

const dec = (bytes: Uint8Array) => String(os2ip(bytes));
function limited<T>(items: T[], make: (item: T, i: number) => JourneyStep['values'][number]) {
  const shown = items.slice(0, SHOWN_BLOCKS).map(make);
  if (items.length > SHOWN_BLOCKS)
    shown.push({ label: 'More blocks', value: `…and ${items.length - SHOWN_BLOCKS} more` });
  return shown;
}

/** The step-by-step journey with the real numbers of this run (and its decryption, if done). */
export function journeySteps(run: EncryptRun, decrypted?: DecryptRun): JourneyStep[] {
  const { key, label } = run.recipient;
  const pub = [
    { label: `n (${label}’s modulus)`, value: String(key.n) },
    { label: 'e (public exponent)', value: String(key.e) },
  ];
  if (run.kind === 'number') {
    const steps: JourneyStep[] = [
      {
        short: 'MESSAGE',
        title: 'Bob’s message',
        formula: `M = ${run.m}`,
        who: 'Bob',
        explanation:
          'In number mode the message is the number M itself; it must satisfy 0 ≤ M < n.',
        values: [{ label: 'M', value: String(run.m) }],
      },
      {
        short: 'ENCRYPT',
        title: `Encrypt with ${label}’s public key`,
        formula: 'C = Mᵉ mod n',
        who: 'Bob',
        explanation: `Bob only needs the public key (n, e). He computes ${run.m}^${key.e} mod ${key.n}.`,
        values: [...pub, { label: 'C = Mᵉ mod n', value: String(run.c) }],
      },
      {
        short: 'CIPHERTEXT',
        title: 'The ciphertext travels',
        formula: `C = ${run.c}`,
        who: 'Wire',
        explanation:
          'Anyone watching (Eve) sees C, n and e. Recovering M would need d, which requires factoring n.',
        values: [{ label: 'C', value: String(run.c) }],
      },
    ];
    if (decrypted?.kind === 'number')
      steps.push({
        short: 'DECRYPT',
        title: `${label} decrypts with the private key`,
        formula: 'M = Cᵈ mod n',
        who: 'Alice',
        explanation: `Only the private exponent d undoes the encryption: ${run.c}^d mod ${key.n} = ${decrypted.m}.`,
        values: [
          {
            label: 'd (private exponent)',
            value: String(decrypted.privateKey.d),
            privateValue: true,
          },
          { label: 'M = Cᵈ mod n', value: String(decrypted.m) },
        ],
      });
    return steps;
  }

  const bytes = utf8.encode(run.text);
  const { sealed } = run;
  const steps: JourneyStep[] = [
    {
      short: 'MESSAGE',
      title: 'Bob’s message',
      formula: 'text → bytes',
      who: 'Bob',
      explanation: 'RSA works on numbers, so the text is first encoded as UTF-8 bytes.',
      values: [
        { label: 'Text', value: run.text || '(empty)' },
        { label: `UTF-8 bytes (${bytes.length})`, value: toHex(bytes) || '(none)' },
      ],
    },
    run.mode === 'oaep'
      ? {
          short: 'PADDING',
          title: 'Add OAEP padding',
          formula: 'EM = OAEP(bytes, random seed)',
          who: 'Bob',
          explanation:
            'OAEP mixes the bytes with fresh randomness into one block EM. Encrypting the same text twice gives different ciphertexts.',
          values: [
            { label: 'EM (padded block, hex)', value: toHex(sealed.inputs[0]) },
            { label: 'EM as a number', value: dec(sealed.inputs[0]) },
          ],
        }
      : {
          short: 'BLOCKS',
          title: `Split into ${sealed.inputs.length} block${sealed.inputs.length === 1 ? '' : 's'}`,
          formula: 'bytes → m₁, m₂, … < n',
          who: 'Bob',
          explanation: `Each block holds at most ${capabilities(key).textbookBlockBytes} bytes, so its number is always smaller than n (“block if needed”). No randomness: textbook RSA is deterministic.`,
          values: limited(sealed.inputs, (block, i) => ({ label: `m${i + 1}`, value: dec(block) })),
        },
    {
      short: 'ENCRYPT',
      title: `Encrypt with ${label}’s public key`,
      formula: run.mode === 'oaep' ? 'C = EMᵉ mod n' : 'cᵢ = mᵢᵉ mod n',
      who: 'Bob',
      explanation: 'Bob raises each number to e and reduces mod n. Only the public key is needed.',
      values: [
        ...pub,
        ...limited(sealed.blocks, (block, i) => ({
          label: sealed.blocks.length === 1 ? 'C' : `c${i + 1}`,
          value: dec(block),
        })),
      ],
    },
    {
      short: 'ENVELOPE',
      title: 'The envelope travels',
      formula: 'rsa-lab.v2:…',
      who: 'Wire',
      explanation:
        'The ciphertext is packed with the recipient’s key fingerprint so the right private key can be found. Eve sees all of this but not d.',
      values: [{ label: 'Envelope', value: sealed.envelope }],
    },
  ];
  if (decrypted?.kind === 'text')
    steps.push({
      short: 'DECRYPT',
      title: `${label} decrypts with the private key`,
      formula: run.mode === 'oaep' ? 'EM = Cᵈ mod n → remove padding' : 'mᵢ = cᵢᵈ mod n',
      who: 'Alice',
      explanation:
        run.mode === 'oaep'
          ? 'The private exponent d recovers EM; removing the OAEP padding (and checking it) gives back the bytes.'
          : 'The private exponent d turns every block back into its bytes, which decode to the text.',
      values: [
        {
          label: 'd (private exponent)',
          value: String(decrypted.privateKey.d),
          privateValue: true,
        },
        ...limited(decrypted.opened.outputs, (block, i) => ({
          label: run.mode === 'oaep' ? 'EM recovered' : `m${i + 1} recovered`,
          value: dec(block),
        })),
        { label: 'Recovered text', value: decrypted.text || '(empty)' },
      ],
    });
  return steps;
}
