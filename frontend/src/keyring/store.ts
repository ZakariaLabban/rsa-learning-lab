/**
 * The keyring: one shared store for every key the app uses.
 *
 * - "mine": my key pairs. Saved in this browser ONLY when rememberPrivate is on (off by default).
 * - "contact": other people's PUBLIC keys, with a verified flag. Always saved.
 * - "demo" / "lecture": built into the app, never saved, cannot be deleted.
 * Storage holds decimal strings in a versioned schema; anything invalid is dropped on load.
 */
import { bitLength, deriveKey, type PrivateKey, type PublicKey } from '../engine/math';
import { fingerprint } from '../engine/encoding';
import demoKeys from './demo-keys.json';
import { checkPublicKey, cleanName, KeyFileError, parseKeyFile, privateFromParts } from './files';

export type KeySource = 'mine' | 'contact' | 'demo' | 'lecture';
export type KeyEntry = {
  id: string;
  name: string;
  source: KeySource;
  key: PublicKey;
  /** Present for mine/demo/lecture entries, never for contacts. */
  privateKey?: PrivateKey;
  bits: number;
  fingerprint: string;
  /** Contacts only: the user compared the fingerprint with its owner. */
  verified?: boolean;
  createdAt: number;
};
export type KeyringState = {
  ready: boolean;
  entries: readonly KeyEntry[];
  activeId: string | null;
  rememberPrivate: boolean;
  /** Set when saving or loading failed (for example, storage is blocked). */
  storageProblem?: string;
};
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const STORAGE_KEY = 'rsa-lab.keyring';
const SCHEMA_VERSION = 1;
const MAX_SAVED_ENTRIES = 200;

type StoredEntry = {
  id: string;
  name: string;
  source: 'mine' | 'contact';
  n: string;
  e: string;
  fingerprint: string;
  verified?: boolean;
  private?: { p: string; q: string; d: string };
  createdAt: number;
};

function newId(): string {
  return crypto.randomUUID();
}

async function builtins(): Promise<KeyEntry[]> {
  const make = async (
    id: string,
    name: string,
    source: 'demo' | 'lecture',
    privateKey: PrivateKey,
  ): Promise<KeyEntry> => ({
    id,
    name,
    source,
    key: { n: privateKey.n, e: privateKey.e },
    privateKey,
    bits: bitLength(privateKey.n),
    fingerprint: await fingerprint(privateKey),
    createdAt: 0,
  });
  const demos = await Promise.all(
    demoKeys.keys.map((k) =>
      make(
        `demo-${k.name.toLowerCase()}`,
        k.name,
        'demo',
        deriveKey(BigInt(k.p), BigInt(k.q), BigInt(k.e)),
      ),
    ),
  );
  const lecture = await make(
    'lecture',
    'Lecture key (p=17, q=11)',
    'lecture',
    deriveKey(17n, 11n, 7n),
  );
  return [...demos, lecture];
}

export class Keyring {
  private state: KeyringState = {
    ready: false,
    entries: [],
    activeId: null,
    rememberPrivate: false,
  };
  private listeners = new Set<() => void>();
  readonly ready: Promise<void>;

  constructor(private readonly storage: StorageLike | null) {
    this.ready = this.load();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getState = (): KeyringState => this.state;

  get(id: string | null | undefined): KeyEntry | undefined {
    return this.state.entries.find((entry) => entry.id === id);
  }
  /** Keys that can decrypt or sign (mine, demo, lecture). */
  privateEntries(): KeyEntry[] {
    return this.state.entries.filter((entry) => entry.privateKey);
  }

  /** Adds one of my key pairs. Returns the existing entry if this key is already mine. */
  async addMine(privateKey: PrivateKey, name?: string): Promise<KeyEntry> {
    await this.ready;
    const keyFingerprint = await fingerprint(privateKey);
    const existing = this.state.entries.find(
      (entry) => entry.source === 'mine' && entry.fingerprint === keyFingerprint,
    );
    if (existing) return existing;
    const count = this.state.entries.filter((entry) => entry.source === 'mine').length;
    const entry: KeyEntry = {
      id: newId(),
      name: cleanName(name, `My key ${count + 1}`),
      source: 'mine',
      key: { n: privateKey.n, e: privateKey.e },
      privateKey,
      bits: bitLength(privateKey.n),
      fingerprint: keyFingerprint,
      createdAt: Date.now(),
    };
    this.update({ entries: [...this.state.entries, entry] });
    return entry;
  }

  /** Adds someone else's PUBLIC key as an unverified contact. */
  async addContact(key: PublicKey, name?: string): Promise<KeyEntry> {
    await this.ready;
    checkPublicKey(key);
    const publicKey = { n: key.n, e: key.e },
      keyFingerprint = await fingerprint(publicKey);
    const existing = this.state.entries.find(
      (entry) => entry.source === 'contact' && entry.fingerprint === keyFingerprint,
    );
    if (existing)
      throw new KeyFileError(`This key is already saved as the contact "${existing.name}".`);
    const count = this.state.entries.filter((entry) => entry.source === 'contact').length;
    const entry: KeyEntry = {
      id: newId(),
      name: cleanName(name, `Contact ${count + 1}`),
      source: 'contact',
      key: publicKey,
      bits: bitLength(publicKey.n),
      fingerprint: keyFingerprint,
      verified: false,
      createdAt: Date.now(),
    };
    this.update({ entries: [...this.state.entries, entry] });
    return entry;
  }

  /** Imports a key file: a key pair becomes one of my keys, a public key becomes a contact. */
  async importFile(text: string, fallbackName?: string): Promise<KeyEntry> {
    const parsed = await parseKeyFile(text);
    const name = parsed.name ?? fallbackName;
    return parsed.kind === 'pair'
      ? this.addMine(parsed.key, name)
      : this.addContact(parsed.key, name);
  }

  rename(id: string, name: string) {
    const entry = this.editable(id);
    this.replace({ ...entry, name: cleanName(name) });
  }
  setVerified(id: string, verified: boolean) {
    const entry = this.editable(id);
    if (entry.source !== 'contact') throw new Error('Only contacts can be verified.');
    this.replace({ ...entry, verified });
  }
  remove(id: string) {
    this.editable(id);
    this.update({
      entries: this.state.entries.filter((entry) => entry.id !== id),
      activeId: this.state.activeId === id ? null : this.state.activeId,
    });
  }
  /** The active key is one of the keys with a private part (mine, demo or lecture). */
  setActive(id: string | null) {
    if (id !== null && !this.get(id)?.privateKey)
      throw new Error('Only a key with a private part can be the active key.');
    this.update({ activeId: id });
  }
  /** Turning this off immediately deletes saved private keys from this browser. */
  setRememberPrivate(rememberPrivate: boolean) {
    this.update({ rememberPrivate });
  }
  /** Deletes my keys and contacts (memory and storage). Built-in keys stay. */
  clearAll() {
    this.update({
      entries: this.state.entries.filter(
        (entry) => entry.source === 'demo' || entry.source === 'lecture',
      ),
      activeId: null,
      rememberPrivate: false,
    });
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      /* Nothing stored. */
    }
  }

  private editable(id: string): KeyEntry {
    const entry = this.get(id);
    if (!entry) throw new Error('That key no longer exists.');
    if (entry.source === 'demo' || entry.source === 'lecture')
      throw new Error('Built-in keys cannot be changed.');
    return entry;
  }
  private replace(entry: KeyEntry) {
    this.update({ entries: this.state.entries.map((e) => (e.id === entry.id ? entry : e)) });
  }
  private update(change: Partial<KeyringState>) {
    this.state = { ...this.state, ...change };
    if (this.state.ready) this.save();
    this.listeners.forEach((listener) => listener());
  }

  private save() {
    if (!this.storage) return;
    const { entries, rememberPrivate, activeId } = this.state;
    const saved: StoredEntry[] = entries
      .filter((entry) => entry.source === 'contact' || (entry.source === 'mine' && rememberPrivate))
      .slice(-MAX_SAVED_ENTRIES)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        source: entry.source as 'mine' | 'contact',
        n: String(entry.key.n),
        e: String(entry.key.e),
        fingerprint: entry.fingerprint,
        ...(entry.source === 'contact' ? { verified: entry.verified === true } : {}),
        ...(entry.source === 'mine' && entry.privateKey
          ? {
              private: {
                p: String(entry.privateKey.p),
                q: String(entry.privateKey.q),
                d: String(entry.privateKey.d),
              },
            }
          : {}),
        createdAt: entry.createdAt,
      }));
    const keepActive =
      activeId !== null &&
      (saved.some((entry) => entry.id === activeId) ||
        entries.some((entry) => entry.id === activeId && entry.source !== 'mine'));
    try {
      this.storage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: SCHEMA_VERSION,
          rememberPrivate,
          activeId: keepActive ? activeId : null,
          entries: saved,
        }),
      );
      if (this.state.storageProblem) this.state = { ...this.state, storageProblem: undefined };
    } catch {
      this.state = {
        ...this.state,
        storageProblem: 'This browser blocked saving. Keys will last only until you close the tab.',
      };
    }
  }

  private async load() {
    const entries = await builtins();
    let rememberPrivate = false,
      activeId: string | null = null,
      storageProblem: string | undefined;
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.version !== SCHEMA_VERSION || !Array.isArray(data.entries))
          throw new Error('Unsupported keyring data.');
        rememberPrivate = data.rememberPrivate === true;
        for (const item of data.entries.slice(0, MAX_SAVED_ENTRIES)) {
          const entry = await restore(item, rememberPrivate);
          if (entry && !entries.some((e) => e.id === entry.id)) entries.push(entry);
        }
        if (
          typeof data.activeId === 'string' &&
          entries.some((e) => e.id === data.activeId && e.privateKey)
        )
          activeId = data.activeId;
      }
    } catch {
      storageProblem = 'Saved keys could not be read and were ignored.';
    }
    this.state = { ready: true, entries, activeId, rememberPrivate, storageProblem };
    this.listeners.forEach((listener) => listener());
  }
}

/** Rebuilds one saved entry, re-checking every value. Returns null for anything invalid. */
async function restore(item: unknown, rememberPrivate: boolean): Promise<KeyEntry | null> {
  try {
    const s = item as StoredEntry;
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || s.id.length > 64) return null;
    if (s.source !== 'mine' && s.source !== 'contact') return null;
    if (s.source === 'mine' && (!rememberPrivate || !s.private)) return null;
    const digits = (v: unknown) => {
      if (typeof v !== 'string' || !/^[0-9]{1,1300}$/.test(v)) throw new Error();
      return BigInt(v);
    };
    const key = { n: digits(s.n), e: digits(s.e) };
    const privateKey =
      s.source === 'mine'
        ? privateFromParts(digits(s.private!.p), digits(s.private!.q), key.e, digits(s.private!.d))
        : undefined;
    if (privateKey && privateKey.n !== key.n) return null;
    checkPublicKey(key);
    const keyFingerprint = await fingerprint(key);
    if (keyFingerprint !== s.fingerprint) return null;
    return {
      id: s.id,
      name: cleanName(s.name),
      source: s.source,
      key,
      ...(privateKey ? { privateKey } : {}),
      bits: bitLength(key.n),
      fingerprint: keyFingerprint,
      ...(s.source === 'contact' ? { verified: s.verified === true } : {}),
      createdAt: typeof s.createdAt === 'number' ? s.createdAt : 0,
    };
  } catch {
    return null;
  }
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The app-wide keyring instance. Tests create their own with an in-memory storage. */
export const keyring = new Keyring(browserStorage());
