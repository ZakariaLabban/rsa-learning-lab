import { describe, expect, it } from 'vitest';
import references from '../engine/__vectors__/reference-vectors.json';
import { bitLength, deriveKey } from '../engine/math';
import { fingerprint } from '../engine/encoding';
import { textbookDecryptNumber, textbookEncryptNumber } from '../engine/rsa';
import demoKeys from './demo-keys.json';
import {
  Keyring,
  keyPairFile,
  parseKeyFile,
  privateFromParts,
  publicKeyFile,
  recipientFromEntry,
  recipientFromPaste,
  recipientGroups,
  STORAGE_KEY,
  type StorageLike,
} from './index';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem = (key: string) => this.data.get(key) ?? null;
  setItem = (key: string, value: string) => void this.data.set(key, value);
  removeItem = (key: string) => void this.data.delete(key);
}
const [ref1024, ref2048] = references.keys;
const real = deriveKey(BigInt(ref1024.p), BigInt(ref1024.q), BigInt(ref1024.e));
const other = deriveKey(BigInt(ref2048.p), BigInt(ref2048.q), BigInt(ref2048.e));
const toy = deriveKey(61n, 53n, 17n);
async function fresh(storage: StorageLike | null = new MemoryStorage()) {
  const kr = new Keyring(storage);
  await kr.ready;
  return kr;
}
const saved = (storage: MemoryStorage) => JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');

describe('built-in keys', () => {
  it('provides demo Alice/Bob (2048-bit) and the lecture key, which cannot be changed', async () => {
    const kr = await fresh();
    const builtins = kr.getState().entries;
    expect(builtins.map((e) => [e.name, e.source, e.bits])).toEqual([
      ['Alice', 'demo', 2048],
      ['Bob', 'demo', 2048],
      ['Lecture key (p=17, q=11)', 'lecture', 8],
    ]);
    const lecture = kr.get('lecture')!;
    expect(lecture.privateKey?.d).toBe(23n);
    expect(textbookEncryptNumber(lecture.key, 88n)).toBe(11n);
    for (const entry of builtins) {
      expect(entry.fingerprint).toBe(await fingerprint(entry.key));
      expect(() => kr.rename(entry.id, 'x')).toThrow('Built-in');
      expect(() => kr.remove(entry.id)).toThrow('Built-in');
    }
    for (const k of demoKeys.keys) expect(bitLength(BigInt(k.p) * BigInt(k.q))).toBe(2048);
  });
});

describe('saving rules', () => {
  it('does not save private keys by default, but saves contacts', async () => {
    const storage = new MemoryStorage(),
      kr = await fresh(storage);
    const mine = await kr.addMine(real, 'Laptop key');
    await kr.addContact({ n: other.n, e: other.e }, 'Sara');
    kr.setActive(mine.id);
    const data = saved(storage);
    expect(data.rememberPrivate).toBe(false);
    expect(data.entries.map((e: { source: string }) => e.source)).toEqual(['contact']);
    expect(JSON.stringify(data)).not.toContain(String(real.d));
    expect(data.activeId).toBeNull();
    const reloaded = await fresh(storage);
    expect(reloaded.getState().entries.filter((e) => e.source === 'mine')).toHaveLength(0);
    expect(reloaded.getState().entries.find((e) => e.source === 'contact')?.name).toBe('Sara');
  });
  it('saves and restores private keys only while the toggle is on', async () => {
    const storage = new MemoryStorage(),
      kr = await fresh(storage);
    kr.setRememberPrivate(true);
    const mine = await kr.addMine(real, 'Laptop key');
    kr.setActive(mine.id);
    const reloaded = await fresh(storage);
    const restored = reloaded.get(mine.id)!;
    expect(reloaded.getState().rememberPrivate).toBe(true);
    expect(reloaded.getState().activeId).toBe(mine.id);
    expect(restored.privateKey?.d).toBe(real.d);
    expect(textbookDecryptNumber(restored.privateKey!, textbookEncryptNumber(real, 1234n))).toBe(
      1234n,
    );
    reloaded.setRememberPrivate(false);
    expect(JSON.stringify(saved(storage))).not.toContain(String(real.d));
    expect((await fresh(storage)).get(mine.id)).toBeUndefined();
  });
  it('keeps a built-in active key across reloads', async () => {
    const storage = new MemoryStorage(),
      kr = await fresh(storage);
    kr.setActive('demo-alice');
    expect((await fresh(storage)).getState().activeId).toBe('demo-alice');
  });
  it('ignores unreadable or tampered storage and reports blocked saving', async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    const broken = await fresh(storage);
    expect(broken.getState().storageProblem).toMatch('could not be read');
    expect(broken.getState().entries).toHaveLength(3);

    const good = new MemoryStorage(),
      kr = await fresh(good);
    await kr.addContact({ n: other.n, e: other.e }, 'Sara');
    const data = saved(good);
    data.entries[0].n = String(other.n + 2n);
    good.setItem(STORAGE_KEY, JSON.stringify(data));
    expect((await fresh(good)).getState().entries.some((e) => e.source === 'contact')).toBe(false);

    const blocked = new MemoryStorage();
    blocked.setItem = () => {
      throw new Error('blocked');
    };
    const kb = await fresh(blocked);
    await kb.addContact({ n: other.n, e: other.e });
    expect(kb.getState().storageProblem).toMatch('blocked saving');
  });
  it('clears my keys and contacts but keeps the built-in keys', async () => {
    const storage = new MemoryStorage(),
      kr = await fresh(storage);
    kr.setRememberPrivate(true);
    await kr.addMine(real);
    await kr.addContact({ n: other.n, e: other.e });
    kr.clearAll();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(kr.getState().entries.map((e) => e.source)).toEqual(['demo', 'demo', 'lecture']);
    expect(kr.getState().rememberPrivate).toBe(false);
  });
});

describe('editing', () => {
  it('renames, verifies, removes and guards the active key', async () => {
    const kr = await fresh();
    const mine = await kr.addMine(toy);
    expect(mine.name).toBe('My key 1');
    expect(await kr.addMine(toy)).toBe(mine);
    const contact = await kr.addContact({ n: other.n, e: other.e });
    expect(contact).toMatchObject({ name: 'Contact 1', verified: false });
    expect(contact.privateKey).toBeUndefined();
    await expect(kr.addContact({ n: other.n, e: other.e }, 'Again')).rejects.toThrow(
      'already saved',
    );
    kr.rename(contact.id, '  Sara  ');
    kr.setVerified(contact.id, true);
    expect(kr.get(contact.id)).toMatchObject({ name: 'Sara', verified: true });
    expect(() => kr.rename(contact.id, '')).toThrow('name is required');
    expect(() => kr.rename(contact.id, '   ')).toThrow('1 to 60');
    expect(() => kr.rename(contact.id, 'x'.repeat(61))).toThrow('1 to 60');
    expect(() => kr.setVerified(mine.id, true)).toThrow('Only contacts');
    expect(() => kr.setActive(contact.id)).toThrow('private part');
    kr.setActive(mine.id);
    kr.remove(mine.id);
    expect(kr.getState().activeId).toBeNull();
  });
});

describe('key files', () => {
  it('round-trips public and key-pair files between two keyrings', async () => {
    const alice = await fresh(),
      bob = await fresh();
    const mine = await alice.addMine(real, 'Alice laptop');
    const contact = await bob.importFile(publicKeyFile(mine.name, mine.key, mine.fingerprint));
    expect(contact).toMatchObject({
      source: 'contact',
      name: 'Alice laptop',
      fingerprint: mine.fingerprint,
    });
    const backup = await fresh();
    const restored = await backup.importFile(keyPairFile(mine.name, real, mine.fingerprint));
    expect(restored).toMatchObject({ source: 'mine', fingerprint: mine.fingerprint });
    expect(restored.privateKey?.d).toBe(real.d);
  });
  it('accepts the Key Studio export and library-style d (mod lambda)', async () => {
    const studio = JSON.stringify({
      format: 'rsa-lab-public-v2',
      n: String(real.n),
      e: String(real.e),
      bits: 1024,
      fingerprint: await fingerprint(real),
    });
    expect((await parseKeyFile(studio)).kind).toBe('public');
    const lambdaKey = privateFromParts(other.p, other.q, other.e, BigInt(ref2048.d));
    expect(lambdaKey.d).not.toBe(other.d);
    const roundTrip = textbookEncryptNumber(other, 99n);
    expect(textbookDecryptNumber(lambdaKey, roundTrip)).toBe(99n);
  });
  it('rejects bad files with a reason', async () => {
    const pair = JSON.parse(keyPairFile('k', toy, await fingerprint(toy)));
    const bad = (change: Record<string, unknown>) => JSON.stringify({ ...pair, ...change });
    const cases: [string, string][] = [
      ['not json', 'not valid JSON'],
      ['[]', 'not a key file'],
      [JSON.stringify({ format: 'something' }), 'Unknown key file format'],
      [JSON.stringify({ format: 'rsa-lab-public-v1' }), 'v1'],
      [bad({ extra: 1 }), 'Unknown field "extra"'],
      [bad({ n: '1' }), 'n does not equal p * q'],
      [bad({ d: '5' }), 'not the inverse of e'],
      [bad({ p: '63' }), 'must both be prime'],
      [bad({ q: '61' }), 'different primes'],
      [bad({ e: 12 }), 'whole number'],
      [bad({ fingerprint: '0'.repeat(64) }), 'may have been altered'],
      [bad({ bits: 2048 }), '"bits" field'],
      [bad({ name: 'a\u0007b' }), 'control characters'],
      ['x'.repeat(70000), 'too large'],
      [
        JSON.stringify({ format: 'rsa-lab-public-v2', n: String((1n << 511n) + 1n), e: '65537' }),
        'Unsupported key size',
      ],
      [JSON.stringify({ format: 'rsa-lab-public-v2', n: '3233', e: '3233' }), '1 < e < n'],
    ];
    for (const [text, reason] of cases)
      await expect(parseKeyFile(text), reason).rejects.toThrow(reason);
  });
});

describe('recipients', () => {
  it('groups Me, Demo characters and My contacts, and supports pasted keys', async () => {
    const kr = await fresh();
    expect(recipientGroups(kr.getState()).map((g) => g.label)).toEqual(['Demo characters']);
    const mine = await kr.addMine(real, 'Me');
    const contact = await kr.addContact({ n: other.n, e: other.e }, 'Sara');
    const groups = recipientGroups(kr.getState());
    expect(groups.map((g) => [g.label, g.entries.map((e) => e.name)])).toEqual([
      ['Me', ['Me']],
      ['Demo characters', ['Alice', 'Bob', 'Lecture key (p=17, q=11)']],
      ['My contacts', ['Sara']],
    ]);
    expect(recipientFromEntry(contact)).toMatchObject({ source: 'contact', verified: false });
    const pasted = await recipientFromPaste(
      `  ${keyPairFile('Pasted pair', real, mine.fingerprint)}  `,
    );
    expect(pasted).toEqual({
      label: 'Pasted pair',
      key: { n: real.n, e: real.e },
      fingerprint: mine.fingerprint,
      source: 'pasted',
    });
    expect('d' in pasted.key).toBe(false);
    await expect(recipientFromPaste('hello')).rejects.toThrow('not valid JSON');
  });
});
