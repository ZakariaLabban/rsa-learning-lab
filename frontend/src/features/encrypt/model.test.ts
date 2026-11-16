import { describe, expect, it } from 'vitest';
import references from '../../engine/__vectors__/reference-vectors.json';
import { deriveKey } from '../../engine/math';
import { fromBase64, packEnvelope, parseEnvelope, toBase64 } from '../../engine/encoding';
import { Keyring, recipientFromEntry, type KeyEntry } from '../../keyring';
import {
  decryptOwnRun,
  decryptReceived,
  defaultRecipientEntry,
  encrypt,
  journeySteps,
  parseMessageNumber,
  recipientLimits,
  textCapacity,
  TEXT_LIMIT,
} from './model';

async function setup() {
  const kr = new Keyring(null);
  await kr.ready;
  const entry = (id: string) => kr.getState().entries.find((e) => e.id === id)!;
  return { kr, alice: entry('demo-alice'), bob: entry('demo-bob'), lecture: entry('lecture') };
}
const ref = references.keys[0];
const real = deriveKey(BigInt(ref.p), BigInt(ref.q), BigInt(ref.e));

describe('default recipient', () => {
  it('prefers the active key, then my newest key, then demo Alice', async () => {
    const { kr } = await setup();
    expect(defaultRecipientEntry(kr.getState())?.id).toBe('demo-alice');
    const mine = await kr.addMine(real, 'Mine');
    expect(defaultRecipientEntry(kr.getState())?.id).toBe(mine.id);
    kr.setActive('demo-bob');
    expect(defaultRecipientEntry(kr.getState())?.id).toBe('demo-bob');
  });
});

describe('lecture example in number mode', () => {
  it('encrypts 88 to 11 and decrypts back to 88 with d = 23', async () => {
    const { kr, lecture } = await setup();
    const run = await encrypt(recipientFromEntry(lecture), 'number', 'textbook', '88');
    expect(run).toMatchObject({ kind: 'number', m: 88n, c: 11n });
    const done = await decryptOwnRun(run, kr.getState().entries);
    expect(done).toMatchObject({ kind: 'number', m: 88n, keyName: lecture.name });
    const steps = journeySteps(run, done);
    expect(steps.map((s) => s.short)).toEqual(['MESSAGE', 'ENCRYPT', 'CIPHERTEXT', 'DECRYPT']);
    expect(steps[1].explanation).toContain('88^7 mod 187');
    expect(steps[3].explanation).toContain('= 88');
    expect(steps[3].values[0]).toMatchObject({ value: '23', privateValue: true });
  });
  it('explains M >= n, non-numbers and text with n < 256', async () => {
    const { lecture } = await setup();
    const to = recipientFromEntry(lecture);
    expect(() => parseMessageNumber('187', to)).toThrow('smaller than n (n = 187)');
    expect(() => parseMessageNumber('-3', to)).toThrow('whole number');
    expect(recipientLimits(to)).toMatchObject({ textAllowed: false });
    expect(recipientLimits(to).textProblem).toContain('below 256');
    await expect(encrypt(to, 'text', 'textbook', 'A')).rejects.toThrow('too small for text');
    await expect(encrypt(to, 'number', 'textbook', '200')).rejects.toThrow('smaller than n');
  });
});

describe('text with Alice and Bob', () => {
  it('round-trips Arabic and emoji with OAEP and textbook blocks', async () => {
    const { kr, alice } = await setup();
    const to = recipientFromEntry(alice);
    for (const mode of ['oaep', 'textbook'] as const) {
      const message = 'مرحبا Bob 🔐 ' + (mode === 'textbook' ? 'x'.repeat(300) : '');
      const run = await encrypt(to, 'text', mode, message);
      const done = await decryptOwnRun(run, kr.getState().entries);
      expect(done.kind === 'text' && done.text).toBe(message);
      const steps = journeySteps(run, done);
      expect(steps.map((s) => s.short)).toEqual([
        'MESSAGE',
        mode === 'oaep' ? 'PADDING' : 'BLOCKS',
        'ENCRYPT',
        'ENVELOPE',
        'DECRYPT',
      ]);
      if (mode === 'textbook') expect(steps[1].title).toBe('Split into 2 blocks');
    }
  });
  it('explains OAEP limits and teaching keys', async () => {
    const { alice } = await setup();
    const to = recipientFromEntry(alice);
    expect(textCapacity(to, 'oaep', 'hi').summary).toBe('2 / 190 bytes');
    await expect(encrypt(to, 'text', 'oaep', 'x'.repeat(191))).rejects.toThrow('at most 190 bytes');
    await expect(encrypt(to, 'text', 'textbook', 'x'.repeat(TEXT_LIMIT + 1))).rejects.toThrow(
      `at most ${TEXT_LIMIT} bytes`,
    );
    const kr = new Keyring(null);
    const toy = await kr.addMine(deriveKey(61n, 53n, 17n), 'Toy');
    const toTeaching = recipientFromEntry(toy);
    expect(recipientLimits(toTeaching).oaepProblem).toContain('12-bit teaching key');
    await expect(encrypt(toTeaching, 'text', 'oaep', 'hi')).rejects.toThrow('OAEP needs');
    expect(textCapacity(toTeaching, 'textbook', 'hi').summary).toContain(
      '2 blocks of up to 1 byte',
    );
  });
  it('says who can decrypt when this browser lacks the private key', async () => {
    const kr = new Keyring(null);
    const contact = await kr.addContact({ n: real.n, e: real.e }, 'Sara');
    const run = await encrypt(recipientFromEntry(contact), 'text', 'oaep', 'for Sara');
    await expect(decryptOwnRun(run, kr.getState().entries)).rejects.toThrow(
      'Only Sara can decrypt this',
    );
  });
});

describe('decrypting a received envelope', () => {
  it('picks the matching key automatically and explains failures', async () => {
    const { kr, bob } = await setup();
    const entries: readonly KeyEntry[] = kr.getState().entries;
    const run = await encrypt(recipientFromEntry(bob), 'text', 'oaep', 'Hi Bob');
    if (run.kind !== 'text') throw new Error('expected text');
    const opened = await decryptReceived(`  ${run.sealed.envelope}\n`, entries);
    expect(opened).toMatchObject({ kind: 'text', text: 'Hi Bob', keyName: 'Bob' });

    const other = new Keyring(null);
    const sealedForSomeoneElse = await encrypt(
      recipientFromEntry(await other.addMine(real, 'Someone')),
      'text',
      'oaep',
      'secret',
    );
    if (sealedForSomeoneElse.kind !== 'text') throw new Error('expected text');
    await expect(decryptReceived(sealedForSomeoneElse.sealed.envelope, entries)).rejects.toThrow(
      'None of your private keys matches',
    );
    await expect(decryptReceived('hello', entries)).rejects.toThrow('complete RSA Lab envelope');
    await expect(decryptReceived('rsa-lab.v1:abc', entries)).rejects.toThrow('Legacy v1');

    const value = parseEnvelope(run.sealed.envelope);
    if (value.kind !== 'oaep') throw new Error('expected oaep');
    const bytes = fromBase64(value.ciphertext);
    bytes[3] ^= 1;
    await expect(
      decryptReceived(packEnvelope({ ...value, ciphertext: toBase64(bytes) }), entries),
    ).rejects.toThrow('envelope was altered');
  });
});
