import { describe, expect, it } from 'vitest';
import { deriveKey } from '../engine/math';
import type { KeyEntry } from '../keyring';
import { emptyProgress } from '../features/lessons/practiceProgress';
import { selectPublicGuestData } from './publicGuestData';

const privateKey = deriveKey(61n, 53n, 17n);

const myKey: KeyEntry = {
  id: 'my-key-1',
  name: 'My RSA Key',
  source: 'mine',
  key: {
    n: privateKey.n,
    e: privateKey.e,
  },
  privateKey,
  bits: 12,
  fingerprint: 'a'.repeat(64),
  createdAt: 1,
};

const contact: KeyEntry = {
  id: 'contact-1',
  name: 'Alice',
  source: 'contact',
  key: {
    n: 2773n,
    e: 17n,
  },
  bits: 12,
  fingerprint: 'b'.repeat(64),
  verified: true,
  createdAt: 2,
};

describe('Public guest data security', () => {
  it('includes only approved public-key fields', () => {
    const result = selectPublicGuestData([myKey], emptyProgress());

    expect(result.publicKeys).toHaveLength(1);

    expect(result.publicKeys[0]).toEqual({
      id: 'my-key-1',
      name: 'My RSA Key',
      n: String(privateKey.n),
      e: String(privateKey.e),
      fingerprint: 'a'.repeat(64),
    });
  });

  it('never includes private RSA components', () => {
    const result = selectPublicGuestData([myKey], emptyProgress());

    const json = JSON.stringify(result);

    for (const field of ['privateKey', 'p', 'q', 'd', 'dp', 'dq', 'qInv', 'phi', 'lambda']) {
      expect(json).not.toContain(`"${field}":`);
    }
  });

  it('rejects invalid public components and drops unapproved progress fields', () => {
    const invalid = { ...myKey, key: { n: 17n, e: 17n } };
    const progress = { ...emptyProgress(), d: 'unexpected data', seen: ['unexpected-data'] };

    expect(selectPublicGuestData([invalid], progress)).toEqual({
      publicKeys: [],
      contacts: [],
      practiceProgress: emptyProgress(),
    });
  });

  it('includes contacts but excludes demo keys', () => {
    const demoKey: KeyEntry = {
      ...myKey,
      id: 'demo-1',
      source: 'demo',
    };

    const result = selectPublicGuestData([myKey, contact, demoKey], emptyProgress());

    expect(result.publicKeys).toHaveLength(1);
    expect(result.contacts).toHaveLength(1);

    expect(result.contacts[0]).toEqual({
      id: 'contact-1',
      name: 'Alice',
      n: '2773',
      e: '17',
      fingerprint: 'b'.repeat(64),
      verified: true,
    });
  });

  it('copies practice progress without sharing references', () => {
    const progress = emptyProgress();

    progress.attempts = 2;
    progress.correct = 1;
    progress.seen.push('practice.v1:intro:632:modulus');

    const result = selectPublicGuestData([], progress);

    expect(result.practiceProgress.attempts).toBe(2);
    expect(result.practiceProgress.correct).toBe(1);

    progress.seen.push('practice.v1:intro:632:totient');

    expect(result.practiceProgress.seen).toEqual(['practice.v1:intro:632:modulus']);
  });
});
