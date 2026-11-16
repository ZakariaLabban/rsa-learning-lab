/**
 * Logic for the Encrypt / Decrypt page (#13), kept free of React so it can be unit-tested.
 * Encryption needs only the recipient's public key; decryption picks a matching private key
 * from the keyring (my keys, demo characters, lecture key).
 */
import { os2ip, type PrivateKey } from '../../engine/math';
import { toHex, utf8 } from '../../engine/encoding';
import {
  capabilities,
  openEnvelope,
  sealBasic,
  sealHybrid,
  textbookDecryptNumber,
  textbookEncryptNumber,
  type BasicMode,
  type KnownSender,
  type OpenedAny,
  type Sealed,
  type SealedHybrid,
  type SignatureResult,
} from '../../engine/rsa';
import type { KeyEntry, KeyringState, Recipient } from '../../keyring';

export type InputMode = 'text' | 'number';
/** Textbook blocks, OAEP, or hybrid (AES-GCM + RSA-OAEP key wrap, optionally signed). */
export type PaddingMode = BasicMode | 'hybrid';
/** UI limit for textbook text so a page action never runs thousands of RSA operations. */
export const TEXT_LIMIT = 1000;
/** Hybrid text limit: AES does the bulk work, RSA only wraps the 32-byte key. */
export const HYBRID_TEXT_LIMIT = 100_000;
const SHOWN_BLOCKS = 4;

export type EncryptRun =
  | { kind: 'number'; recipient: Recipient; m: bigint; c: bigint }
  | { kind: 'text'; mode: BasicMode; recipient: Recipient; text: string; sealed: Sealed }
  | {
      kind: 'hybrid';
      recipient: Recipient;
      text: string;
      sealed: SealedHybrid;
      /** Set when signed ("Also sign as me"). */
      signerName?: string;
    };
export type DecryptRun =
  | { kind: 'number'; keyName: string; privateKey: PrivateKey; c: bigint; m: bigint }
  | {
      kind: 'text';
      keyName: string;
      privateKey: PrivateKey;
      opened: OpenedAny;
      text: string;
      /** Hybrid envelopes only. */
      signature?: SignatureResult;
    };

/** Keys whose signatures the receiver can check, named as the user knows them. */
export function knownSenders(entries: readonly KeyEntry[]): KnownSender[] {
  return entries.map((e) => ({
    fingerprint: e.fingerprint,
    key: e.key,
    name: e.source === 'mine' ? `${e.name} (you)` : e.name,
  }));
}

/** Keys that can sign: any 1024/2048-bit key with a private part (mine or demo). */
export function signingEntries(entries: readonly KeyEntry[]): KeyEntry[] {
  return entries.filter((e) => e.privateKey && (e.bits === 1024 || e.bits === 2048));
}

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
    hybridProblem: caps.hybrid
      ? undefined
      : `Hybrid encryption and signing need a 1024 or 2048-bit key; this is a ${caps.bits}-bit teaching key.`,
  };
}

/** Byte count / limit line for the text box, and a problem message when it does not fit. */
export function textCapacity(recipient: Recipient, mode: PaddingMode, text: string) {
  const { caps } = recipientLimits(recipient);
  const length = utf8.encode(text).length;
  if (mode === 'hybrid')
    return {
      length,
      max: HYBRID_TEXT_LIMIT,
      summary: `${length} / ${HYBRID_TEXT_LIMIT} bytes · AES encrypts the text, RSA only the 32-byte AES key`,
      problem:
        length > HYBRID_TEXT_LIMIT
          ? `This page encrypts at most ${HYBRID_TEXT_LIMIT} bytes of text; yours is ${length}. Use file encryption for bigger data.`
          : undefined,
    };
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

/**
 * Encrypts for the recipient. With `signer` ("Also sign as me") the message is signed with
 * RSA-PSS first and sent in hybrid mode, since a full signature cannot fit in one OAEP block.
 */
export async function encrypt(
  recipient: Recipient,
  inputMode: InputMode,
  mode: PaddingMode,
  input: string,
  signer?: KeyEntry,
): Promise<EncryptRun> {
  const limits = recipientLimits(recipient);
  if (inputMode === 'number') {
    const m = parseMessageNumber(input, recipient);
    return { kind: 'number', recipient, m, c: textbookEncryptNumber(recipient.key, m) };
  }
  if (!limits.textAllowed) throw new Error(limits.textProblem);
  const effective: PaddingMode = signer ? 'hybrid' : mode;
  if (effective === 'oaep' && limits.oaepProblem) throw new Error(limits.oaepProblem);
  if (effective === 'hybrid' && limits.hybridProblem) throw new Error(limits.hybridProblem);
  const capacity = textCapacity(recipient, effective, input);
  if (capacity.problem) throw new Error(capacity.problem);
  if (effective === 'hybrid') {
    if (signer && !signer.privateKey)
      throw new Error('This key cannot sign: it has no private part.');
    const sealed = await sealHybrid(
      recipient.key,
      { type: 'text', data: utf8.encode(input) },
      signer?.privateKey,
    );
    return { kind: 'hybrid', recipient, text: input, sealed, signerName: signer?.name };
  }
  const sealed = await sealBasic(recipient.key, utf8.encode(input), effective);
  return { kind: 'text', mode: effective, recipient, text: input, sealed };
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
  return decryptReceived(run.sealed.envelope, [entry], entries);
}

/** Turns engine errors into plain explanations for the decrypt screens. */
function friendlyOpenError(message: string): string {
  if (message.includes('Legacy v1')) return message;
  if (message.includes('None of your'))
    return 'None of your private keys matches this envelope. It was encrypted for someone else’s key, or you need to import your key pair on the Keys page.';
  if (message.includes('Invalid') || message.includes('envelope'))
    return 'This isn’t a complete RSA Lab envelope. Paste the whole text, starting with rsa-lab.v2:';
  return 'Decryption failed: the envelope was altered, or it doesn’t match this key.';
}

/**
 * Decrypts a pasted envelope with whichever of my/demo private keys matches it. Signatures in
 * hybrid envelopes are checked against `senders` (my keys, contacts and demo characters).
 */
export async function decryptReceived(
  envelope: string,
  entries: readonly KeyEntry[],
  senders: readonly KeyEntry[] = entries,
): Promise<DecryptRun> {
  const holders = entries.filter((e) => e.privateKey);
  let opened: OpenedAny;
  try {
    opened = await openEnvelope(
      envelope.trim(),
      holders.map((e) => e.privateKey!),
      knownSenders(senders),
    );
  } catch (error) {
    throw new Error(friendlyOpenError((error as Error).message), { cause: error });
  }
  const entry = holders.find((e) => e.privateKey === opened.key)!;
  if (opened.kind === 'hybrid' && opened.type === 'file')
    throw new Error(
      `This envelope contains the file “${opened.file?.name}”. Open it with file decryption (coming with #17).`,
    );
  let text: string;
  try {
    text = decoder().decode(opened.bytes);
  } catch {
    throw new Error(
      'Decrypted, but the result isn’t valid text. Textbook RSA can’t detect changes, so the envelope was probably altered.',
    );
  }
  return {
    kind: 'text',
    keyName: entry.name,
    privateKey: entry.privateKey!,
    opened,
    text,
    ...(opened.kind === 'hybrid' ? { signature: opened.signature } : {}),
  };
}

/** One plain-language line for a signature check result. */
export function describeSignature(result: SignatureResult | undefined): {
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  text: string;
} {
  if (!result || result.status === 'unsigned')
    return {
      tone: 'neutral',
      text: 'Not signed: encryption alone doesn’t prove who sent it. Anyone with the public key could have.',
    };
  if (result.status === 'valid')
    return { tone: 'good', text: `✓ Signed by ${result.name}: the signature is valid.` };
  if (result.status === 'unknown-sender')
    return {
      tone: 'warn',
      text: `Signed by an unknown key (${result.sender.slice(0, 16)}…). Add the sender’s public key as a contact to check who it is.`,
    };
  return {
    tone: 'bad',
    text: `✗ Invalid signature: this was not signed by ${result.name}’s key, or it was changed after signing.`,
  };
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
  if (run.kind === 'hybrid') return hybridSteps(run, pub, decrypted);
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
  if (decrypted?.kind === 'text' && decrypted.opened.kind === 'basic')
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

/** Journey for hybrid (optionally signed) messages: sign → AES → wrap the AES key → travel → open. */
function hybridSteps(
  run: Extract<EncryptRun, { kind: 'hybrid' }>,
  pub: JourneyStep['values'],
  decrypted?: DecryptRun,
): JourneyStep[] {
  const { label } = run.recipient;
  const { sealed } = run;
  const bytes = utf8.encode(run.text);
  const steps: JourneyStep[] = [
    {
      short: 'MESSAGE',
      title: 'Bob’s message',
      formula: 'text → bytes',
      who: 'Bob',
      explanation:
        'Hybrid mode can carry any length: RSA will only ever encrypt a small AES key, never the message itself.',
      values: [
        { label: 'Text', value: run.text || '(empty)' },
        { label: `UTF-8 bytes (${bytes.length})`, value: toHex(bytes) || '(none)' },
      ],
    },
  ];
  if (sealed.signature)
    steps.push({
      short: 'SIGN',
      title: `${run.signerName ?? 'Bob'} signs with their private key`,
      formula: 'S = PSS(hash(message))ᵈ mod n',
      who: 'Bob',
      explanation:
        'The signature uses the SENDER’s private key, so anyone with the sender’s public key can check it. It goes inside the encrypted message (the lecture’s “authentication and confidentiality”). The lab signs and encrypts with one key pair; real systems prefer separate keys.',
      values: [
        { label: 'Signer fingerprint', value: sealed.signature.sender },
        {
          label: `Signature S (${sealed.signature.value.length} bytes, hex)`,
          value: toHex(sealed.signature.value),
        },
      ],
    });
  steps.push(
    {
      short: 'AES',
      title: 'Encrypt the message with a fresh AES key',
      formula: 'AES-256-GCM(K, message)',
      who: 'Bob',
      explanation:
        'A random 32-byte key K encrypts the message with AES-GCM, which is fast and adds a tag that detects any change. K is new for every message.',
      values: [
        { label: 'AES key K (hex, secret, used once)', value: toHex(sealed.aesKey) },
        { label: 'Nonce (hex)', value: toHex(sealed.nonce) },
        {
          label: `AES ciphertext + tag (${sealed.ciphertext.length} bytes)`,
          value:
            toHex(sealed.ciphertext).slice(0, 160) + (sealed.ciphertext.length > 80 ? '…' : ''),
        },
      ],
    },
    {
      short: 'WRAP',
      title: `Encrypt only K with ${label}’s public key`,
      formula: 'W = OAEP(K)ᵉ mod n',
      who: 'Bob',
      explanation:
        'RSA encrypts just the 32-byte AES key (with OAEP padding). This is the lecture’s “a session key is encrypted and sent”.',
      values: [...pub, { label: 'Wrapped key W', value: dec(sealed.wrappedKey) }],
    },
    {
      short: 'ENVELOPE',
      title: 'The envelope travels',
      formula: 'rsa-lab.v2:…',
      who: 'Wire',
      explanation:
        'Eve sees W, the nonce and the AES ciphertext. Without the private key she can’t recover K, and changing anything breaks the AES-GCM tag.',
      values: [{ label: 'Envelope', value: sealed.envelope }],
    },
  );
  if (decrypted?.kind === 'text' && decrypted.opened.kind === 'hybrid')
    steps.push({
      short: 'DECRYPT',
      title: `${label} unwraps K, checks the tag and decrypts`,
      formula: 'K = Wᵈ mod n → AES-GCM⁻¹',
      who: 'Alice',
      explanation: `The private exponent d recovers K. AES-GCM checks the tag before releasing any text, then the signature is checked. ${describeSignature(decrypted.signature).text}`,
      values: [
        {
          label: 'd (private exponent)',
          value: String(decrypted.privateKey.d),
          privateValue: true,
        },
        { label: 'K recovered (hex)', value: toHex(decrypted.opened.aesKey) },
        { label: 'Recovered text', value: decrypted.text || '(empty)' },
      ],
    });
  return steps;
}
