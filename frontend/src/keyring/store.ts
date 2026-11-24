/**
 * The keyring: one shared store for every key the app uses.
 *
 * - "mine": my key pairs. Saved in this browser ONLY when rememberPrivate is on (off by default).
 * - "contact": other people's PUBLIC keys, with a verified flag. Always saved.
 * - "demo" / "lecture": built into the app, never saved, cannot be deleted.
 * Storage holds decimal strings in a versioned schema; anything invalid is dropped on load.
 */
import { bitLength, deriveKey, type PrivateKey, type PublicKey } from '../engine/math';
import { dataKeyAtRevision, localClearRevision } from '../auth/localDataKey';
import { fingerprint } from '../engine/encoding';
import demoKeys from './demo-keys.json';
import { checkPublicKey, cleanName, KeyFileError, parseKeyFile, privateFromParts } from './files';

export type KeySource = 'mine' | 'contact' | 'demo' | 'lecture';
export type KeyEntry = {
  id: string;
  name: string;
  source: KeySource;
  key: PublicKey;
  /** Present when this device has the private part; cloud-only public keys omit it. */
  privateKey?: PrivateKey;
  /** Marks public-only entries that belong to the authenticated cloud keyring. */
  cloudManaged?: boolean;
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
const MAX_SAVED_ENTRIES = 600;

type StoredEntry = {
  id: string;
  name: string;
  source: 'mine' | 'contact';
  n: string;
  e: string;
  fingerprint: string;
  verified?: boolean;
  private?: { p: string; q: string; d: string };
  cloudManaged?: boolean;
  createdAt: number;
};

type StoredKeyring = {
  version: number;
  rememberPrivate: boolean;
  activeId: string | null;
  entries: StoredEntry[];
};

function newId(): string {
  return crypto.randomUUID();
}

async function cloudMineEntry(
  value: { id: string; name: string; n: string; e: string; fingerprint: string },
  current?: KeyEntry,
): Promise<KeyEntry> {
  const key = { n: BigInt(value.n), e: BigInt(value.e) };
  checkPublicKey(key);
  const keyFingerprint = await fingerprint(key);
  if (keyFingerprint !== value.fingerprint)
    throw new KeyFileError('Public-key fingerprint mismatch.');
  const privateKey =
    current?.source === 'mine' && current.key.n === key.n && current.key.e === key.e
      ? current.privateKey
      : undefined;
  return {
    id: value.id,
    name: cleanName(value.name),
    source: 'mine',
    key,
    ...(privateKey ? { privateKey } : {}),
    cloudManaged: true,
    bits: bitLength(key.n),
    fingerprint: keyFingerprint,
    createdAt: current?.createdAt ?? Date.now(),
  };
}

async function cloudContactEntry(value: {
  id: string;
  name: string;
  n: string;
  e: string;
  fingerprint: string;
  verified: boolean;
}): Promise<KeyEntry> {
  const key = { n: BigInt(value.n), e: BigInt(value.e) };
  checkPublicKey(key);
  const keyFingerprint = await fingerprint(key);
  if (keyFingerprint !== value.fingerprint)
    throw new KeyFileError('Public-key fingerprint mismatch.');
  return {
    id: value.id,
    name: cleanName(value.name),
    source: 'contact',
    key,
    cloudManaged: true,
    bits: bitLength(key.n),
    fingerprint: keyFingerprint,
    verified: value.verified === true,
    createdAt: Date.now(),
  };
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
  private clearRevision: string | null;
  private memoryRevision = 0;
  private pendingSaveBaseline: KeyringState | null = null;

  constructor(
    private readonly storage: StorageLike | null,
    private readonly storageKey = STORAGE_KEY,
    private readonly readClearRevision: () => string | null = () => null,
  ) {
    this.clearRevision = readClearRevision();
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
    const revision = this.memoryRevision;
    await this.ready;
    const keyFingerprint = await fingerprint(privateKey);
    this.checkClear(revision);
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

  /** Adds a public-only copy of one of the user's keys received from another device. */
  async addPublicMine(value: {
    id: string;
    name: string;
    n: string;
    e: string;
    fingerprint: string;
  }): Promise<KeyEntry> {
    const revision = this.memoryRevision;
    await this.ready;
    const key = { n: BigInt(value.n), e: BigInt(value.e) };
    checkPublicKey(key);
    const keyFingerprint = await fingerprint(key);
    if (keyFingerprint !== value.fingerprint)
      throw new KeyFileError('Public-key fingerprint mismatch.');
    this.checkClear(revision);
    const sameId = this.get(value.id);
    if (sameId && sameId.fingerprint !== keyFingerprint)
      throw new KeyFileError('A different key already uses this identifier.');
    const existing = this.state.entries.find(
      (entry) => entry.source === 'mine' && entry.fingerprint === keyFingerprint,
    );
    if (existing) {
      if (
        existing.id === value.id &&
        existing.name === cleanName(value.name) &&
        existing.cloudManaged === true
      )
        return existing;
      const managed = { ...existing, name: cleanName(value.name), cloudManaged: true };
      this.replace(managed);
      return managed;
    }
    const entry: KeyEntry = {
      id: value.id,
      name: cleanName(value.name),
      source: 'mine',
      key,
      cloudManaged: true,
      bits: bitLength(key.n),
      fingerprint: keyFingerprint,
      createdAt: Date.now(),
    };
    this.update({ entries: [...this.state.entries, entry] });
    return entry;
  }

  /** Merges an authenticated cloud snapshot into this account's local keyring. */
  async applyCloudPublicData(
    expected: {
      publicKeys: { id: string; name: string; n: string; e: string; fingerprint: string }[];
      contacts: {
        id: string;
        name: string;
        n: string;
        e: string;
        fingerprint: string;
        verified: boolean;
      }[];
    },
    next: {
      publicKeys: { id: string; name: string; n: string; e: string; fingerprint: string }[];
      contacts: {
        id: string;
        name: string;
        n: string;
        e: string;
        fingerprint: string;
        verified: boolean;
      }[];
    },
  ) {
    await this.ready;
    const expectedMine = new Map(expected.publicKeys.map((entry) => [entry.id, entry]));
    const expectedContacts = new Map(expected.contacts.map((entry) => [entry.id, entry]));
    const nextMine = new Map(next.publicKeys.map((entry) => [entry.id, entry]));
    const nextContacts = new Map(next.contacts.map((entry) => [entry.id, entry]));
    const mineIds = new Set([...expectedMine.keys(), ...nextMine.keys()]);
    const contactIds = new Set([...expectedContacts.keys(), ...nextContacts.keys()]);
    const currentMine = new Map(
      this.state.entries
        .filter((entry) => entry.source === 'mine')
        .map((entry) => [entry.id, entry]),
    );
    const currentContacts = new Map(
      this.state.entries
        .filter((entry) => entry.source === 'contact')
        .map((entry) => [entry.id, entry]),
    );
    const changedMine = new Map<string, KeyEntry | null>();
    const changedContacts = new Map<string, KeyEntry | null>();
    const valueOf = (entry: KeyEntry | undefined) =>
      entry
        ? {
            id: entry.id,
            name: entry.name,
            n: String(entry.key.n),
            e: String(entry.key.e),
            fingerprint: entry.fingerprint,
            ...(entry.source === 'contact' ? { verified: entry.verified === true } : {}),
          }
        : null;

    for (const id of mineIds) {
      const current = currentMine.get(id);
      if (JSON.stringify(valueOf(current)) !== JSON.stringify(expectedMine.get(id) ?? null))
        continue;
      const target = nextMine.get(id);
      changedMine.set(id, target ? await cloudMineEntry(target, current) : null);
    }
    for (const id of contactIds) {
      const current = currentContacts.get(id);
      if (JSON.stringify(valueOf(current)) !== JSON.stringify(expectedContacts.get(id) ?? null))
        continue;
      const target = nextContacts.get(id);
      changedContacts.set(id, target ? await cloudContactEntry(target) : null);
    }

    // Fingerprint checks above await. Recheck against the latest in-memory state before commit
    // so a user edit made during that work cannot be overwritten by this older cloud reply.
    for (const id of changedMine.keys()) {
      const current = this.state.entries.find(
        (entry) => entry.source === 'mine' && entry.id === id,
      );
      if (JSON.stringify(valueOf(current)) !== JSON.stringify(expectedMine.get(id) ?? null))
        changedMine.delete(id);
    }
    for (const id of changedContacts.keys()) {
      const current = this.state.entries.find(
        (entry) => entry.source === 'contact' && entry.id === id,
      );
      if (JSON.stringify(valueOf(current)) !== JSON.stringify(expectedContacts.get(id) ?? null))
        changedContacts.delete(id);
    }

    if (changedMine.size === 0 && changedContacts.size === 0) return;
    const entries = this.state.entries.filter((entry) => {
      if (entry.source === 'mine' && changedMine.has(entry.id)) return false;
      if (entry.source === 'contact' && changedContacts.has(entry.id)) return false;
      return true;
    });
    for (const entry of [...changedMine.values(), ...changedContacts.values()])
      if (entry) entries.push(entry);
    this.update({ entries });
  }

  /** Adds someone else's PUBLIC key as an unverified contact. */
  async addContact(key: PublicKey, name?: string): Promise<KeyEntry> {
    const revision = this.memoryRevision;
    await this.ready;
    checkPublicKey(key);
    const publicKey = { n: key.n, e: key.e },
      keyFingerprint = await fingerprint(publicKey);
    this.checkClear(revision);
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

  /** Imports an explicitly approved public contact while preserving its stable sync ID. */
  async addPublicContact(value: {
    id: string;
    name: string;
    n: string;
    e: string;
    fingerprint: string;
    verified: boolean;
  }): Promise<KeyEntry> {
    const revision = this.memoryRevision;
    await this.ready;
    const key = { n: BigInt(value.n), e: BigInt(value.e) };
    checkPublicKey(key);
    const keyFingerprint = await fingerprint(key);
    if (keyFingerprint !== value.fingerprint)
      throw new KeyFileError('Public-key fingerprint mismatch.');
    this.checkClear(revision);
    const byId = this.get(value.id);
    if (byId) {
      if (byId.source !== 'contact' || byId.fingerprint !== keyFingerprint)
        throw new KeyFileError('A different key already uses this identifier.');
      if (byId.cloudManaged) return byId;
      const managed = { ...byId, cloudManaged: true };
      this.replace(managed);
      return managed;
    }
    const duplicate = this.state.entries.find(
      (entry) => entry.source === 'contact' && entry.fingerprint === keyFingerprint,
    );
    if (duplicate) {
      const managed = { ...duplicate, cloudManaged: true };
      this.replace(managed);
      return managed;
    }
    const entry: KeyEntry = {
      id: value.id,
      name: cleanName(value.name),
      source: 'contact',
      key,
      cloudManaged: true,
      bits: bitLength(key.n),
      fingerprint: keyFingerprint,
      verified: value.verified === true,
      createdAt: Date.now(),
    };
    this.update({ entries: [...this.state.entries, entry] });
    return entry;
  }

  /** Imports a key file: a key pair becomes one of my keys, a public key becomes a contact. */
  async importFile(text: string, fallbackName?: string): Promise<KeyEntry> {
    const revision = this.memoryRevision;
    const parsed = await parseKeyFile(text);
    this.checkClear(revision);
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
  /** Turning this off prevents other open tabs from saving private keys again. */
  setRememberPrivate(rememberPrivate: boolean) {
    try {
      if (!this.storage) throw new Error('Browser storage unavailable.');
      this.storage.setItem(this.privatePreferenceKey, String(rememberPrivate));
    } catch {
      this.state = {
        ...this.state,
        storageProblem: 'This browser blocked changes to private-key storage.',
      };
      this.listeners.forEach((listener) => listener());
      return;
    }
    this.update({ rememberPrivate });
  }

  observePrivatePreference(key: string | null) {
    if (
      key !== this.privatePreferenceKey ||
      !this.state.rememberPrivate ||
      this.allowsPrivateKeys()
    )
      return;
    this.state = { ...this.state, rememberPrivate: false };
    this.listeners.forEach((listener) => listener());
  }

  private get privatePreferenceKey() {
    return `${this.storageKey}:remember-private`;
  }

  private privateStoragePreference() {
    try {
      return this.storage?.getItem(this.privatePreferenceKey) ?? null;
    } catch {
      return 'false';
    }
  }

  private allowsPrivateKeys() {
    return this.privateStoragePreference() !== 'false';
  }
  /** Deletes my keys and contacts (memory and storage). Built-in keys stay. */
  clearAll() {
    try {
      this.storage?.removeItem(dataKeyAtRevision(this.storageKey, this.clearRevision));
      this.storage?.setItem(this.privatePreferenceKey, 'false');
    } finally {
      this.resetAfterClear();
    }
  }

  resetAfterClear() {
    this.clearRevision = this.readClearRevision();
    this.memoryRevision++;
    this.pendingSaveBaseline = null;
    this.state = {
      ...this.state,
      entries: this.state.entries.filter(
        (entry) => entry.source === 'demo' || entry.source === 'lecture',
      ),
      activeId: null,
      rememberPrivate: false,
      storageProblem: undefined,
    };
    this.listeners.forEach((listener) => listener());
  }

  private checkClear(revision: number) {
    if (revision !== this.memoryRevision || this.clearRevision !== this.readClearRevision()) {
      throw new Error('Local data was cleared. Please retry.');
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
    const previous = this.state;
    this.state = { ...previous, ...change };
    if (this.state.ready) {
      const baseline = this.pendingSaveBaseline ?? previous;
      this.pendingSaveBaseline =
        change.rememberPrivate === true ? { ...baseline, rememberPrivate: false } : baseline;
      if (this.save(this.pendingSaveBaseline)) this.pendingSaveBaseline = null;
    }
    this.listeners.forEach((listener) => listener());
  }

  private stripStoredPrivateKeys(key: string, current: string, data: StoredKeyring) {
    if (!this.storage || this.storage.getItem(key) !== current) return;
    this.storage.setItem(
      key,
      JSON.stringify({
        ...data,
        rememberPrivate: false,
        activeId: null,
        entries: data.entries
          .filter(
            (entry) =>
              entry?.source === 'contact' ||
              (entry?.source === 'mine' && entry.cloudManaged === true),
          )
          .map((entry) => ({
            id: entry.id,
            name: entry.name,
            source: entry.source,
            n: entry.n,
            e: entry.e,
            fingerprint: entry.fingerprint,
            ...(entry.cloudManaged ? { cloudManaged: true } : {}),
            ...(entry.source === 'contact' ? { verified: entry.verified === true } : {}),
            createdAt: entry.createdAt,
          })),
      }),
    );
  }

  private readStoredKeyring(key: string): StoredKeyring | undefined {
    const raw = this.storage?.getItem(key);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as StoredKeyring;
      if (data?.version === SCHEMA_VERSION && Array.isArray(data.entries)) return data;
    } catch {
      // Individual saves can recover from a malformed snapshot.
    }
  }

  private save(previous: KeyringState): boolean {
    if (!this.storage || this.clearRevision !== this.readClearRevision()) return false;
    try {
      const key = dataKeyAtRevision(this.storageKey, this.clearRevision);
      const { entries, activeId } = this.state;
      const stored = this.readStoredKeyring(key);
      const preference = this.storage.getItem(this.privatePreferenceKey);
      const rememberPrivate = this.state.rememberPrivate && preference !== 'false';
      this.state = { ...this.state, rememberPrivate };

      const oldEntries = new Map(previous.entries.map((entry) => [entry.id, entry]));
      const removedIds = new Set(previous.entries.map((entry) => entry.id));
      for (const entry of entries) removedIds.delete(entry.id);

      const changed: StoredEntry[] = entries
        .filter(
          (entry) =>
            (entry.source === 'contact' && (!stored || oldEntries.get(entry.id) !== entry)) ||
            (entry.source === 'mine' &&
              (entry.cloudManaged === true || (entry.privateKey && rememberPrivate)) &&
              (!stored || !previous.rememberPrivate || oldEntries.get(entry.id) !== entry)),
        )
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          source: entry.source as 'mine' | 'contact',
          n: String(entry.key.n),
          e: String(entry.key.e),
          fingerprint: entry.fingerprint,
          ...(entry.cloudManaged ? { cloudManaged: true } : {}),
          ...(entry.source === 'contact' ? { verified: entry.verified === true } : {}),
          ...(entry.source === 'mine' && entry.privateKey && rememberPrivate
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
      // Apply this tab's changes to the current saved entries, including keys from other tabs.
      const changedIds = new Set(changed.map((entry) => entry.id));
      const keepSavedPrivate = stored?.rememberPrivate === true && preference !== 'false';
      const retained = (stored?.entries ?? []).filter(
        (entry) =>
          (entry?.source === 'contact' ||
            (entry?.source === 'mine' &&
              (entry.cloudManaged === true || (Boolean(entry.private) && keepSavedPrivate)))) &&
          !removedIds.has(entry.id) &&
          !changedIds.has(entry.id),
      );
      const saved = [...retained, ...changed]
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(-MAX_SAVED_ENTRIES);
      const selected = stored && previous.activeId === activeId ? stored.activeId : activeId;
      const keepActive =
        selected !== null &&
        (saved.some((entry) => entry.id === selected) ||
          entries.some((entry) => entry.id === selected && entry.source !== 'mine'));
      const payload = {
        version: SCHEMA_VERSION,
        rememberPrivate: rememberPrivate || keepSavedPrivate || preference === 'true',
        activeId: keepActive ? selected : null,
        entries: saved,
      };
      const serialized = JSON.stringify(payload);
      this.storage.setItem(key, serialized);
      if (this.clearRevision !== this.readClearRevision()) {
        this.storage.removeItem(key);
      } else if (
        payload.rememberPrivate &&
        this.storage.getItem(this.privatePreferenceKey) === 'false'
      ) {
        this.state = { ...this.state, rememberPrivate: false };
        this.stripStoredPrivateKeys(key, serialized, payload);
      }
      if (this.state.storageProblem) this.state = { ...this.state, storageProblem: undefined };
      return true;
    } catch {
      this.state = {
        ...this.state,
        storageProblem: 'This browser blocked saving. Keys will last only until you close the tab.',
      };
      return false;
    }
  }

  private async load() {
    const entries = await builtins();
    let rememberPrivate = false,
      activeId: string | null = null,
      storageProblem: string | undefined;
    try {
      const key = dataKeyAtRevision(this.storageKey, this.clearRevision);
      const raw = this.storage?.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.version !== SCHEMA_VERSION || !Array.isArray(data.entries))
          throw new Error('Unsupported keyring data.');
        rememberPrivate = data.rememberPrivate === true && this.allowsPrivateKeys();
        if (data.rememberPrivate === true && !rememberPrivate)
          this.stripStoredPrivateKeys(key, raw, data);
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
    if (rememberPrivate && !this.allowsPrivateKeys()) {
      const publicEntries = entries.filter((entry) => !entry.privateKey);
      this.state = {
        ready: true,
        entries: publicEntries,
        activeId: null,
        rememberPrivate: false,
        storageProblem,
      };
    } else {
      this.state = { ready: true, entries, activeId, rememberPrivate, storageProblem };
    }
    this.listeners.forEach((listener) => listener());
  }
}

/** Rebuilds one saved entry, re-checking every value. Returns null for anything invalid. */
async function restore(item: unknown, rememberPrivate: boolean): Promise<KeyEntry | null> {
  try {
    const s = item as StoredEntry;
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || s.id.length > 64) return null;
    if (s.source !== 'mine' && s.source !== 'contact') return null;
    if (s.source === 'mine' && !s.private && s.cloudManaged !== true) return null;
    if (s.source === 'mine' && s.private && !rememberPrivate) return null;
    const digits = (v: unknown) => {
      if (typeof v !== 'string' || !/^[0-9]{1,1300}$/.test(v)) throw new Error();
      return BigInt(v);
    };
    const key = { n: digits(s.n), e: digits(s.e) };
    const privateKey =
      s.source === 'mine' && rememberPrivate && s.private
        ? privateFromParts(digits(s.private.p), digits(s.private.q), key.e, digits(s.private.d))
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
      ...(s.cloudManaged === true ? { cloudManaged: true } : {}),
      bits: bitLength(key.n),
      fingerprint: keyFingerprint,
      ...(s.source === 'contact' ? { verified: s.verified === true } : {}),
      createdAt: typeof s.createdAt === 'number' ? s.createdAt : 0,
    };
  } catch {
    return null;
  }
}

export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The guest keyring uses the original on-device storage. */
export const keyring = new Keyring(browserStorage(), STORAGE_KEY, () => localClearRevision(null));
