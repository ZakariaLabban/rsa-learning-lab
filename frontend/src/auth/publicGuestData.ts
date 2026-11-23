import type { KeyEntry } from '../keyring';
import { checkPublicKey } from '../keyring/files';
import { parseProgress, type PracticeProgress } from '../features/lessons/practiceProgress';

export type PublicGuestData = {
  publicKeys: {
    id: string;
    name: string;
    n: string;
    e: string;
    fingerprint: string;
  }[];
  contacts: {
    id: string;
    name: string;
    n: string;
    e: string;
    fingerprint: string;
    verified: boolean;
  }[];
  practiceProgress: PracticeProgress;
};

export function selectPublicGuestData(
  entries: readonly KeyEntry[],
  inputProgress: PracticeProgress,
): PublicGuestData {
  const publicKeys: PublicGuestData['publicKeys'] = [];
  const contacts: PublicGuestData['contacts'] = [];
  for (const entry of entries) {
    if (entry.source !== 'mine' && entry.source !== 'contact') continue;
    const { n, e } = entry.key;
    if (
      typeof n !== 'bigint' ||
      typeof e !== 'bigint' ||
      typeof entry.id !== 'string' ||
      typeof entry.name !== 'string' ||
      typeof entry.fingerprint !== 'string' ||
      !/^[0-9a-f]{64}$/.test(entry.fingerprint)
    )
      continue;
    try {
      checkPublicKey({ n, e });
    } catch {
      continue;
    }
    const payload = {
      id: entry.id,
      name: entry.name,
      n: String(n),
      e: String(e),
      fingerprint: entry.fingerprint,
    };
    if (entry.source === 'mine') publicKeys.push(payload);
    else contacts.push({ ...payload, verified: entry.verified === true });
  }

  const progress = parseProgress(JSON.stringify(inputProgress));
  const topics = Object.fromEntries(
    Object.entries(progress.topics).map(([topic, stats]) => [
      topic,
      {
        attempts: stats.attempts,
        correct: stats.correct,
      },
    ]),
  ) as PracticeProgress['topics'];

  return {
    publicKeys,
    contacts,
    practiceProgress: {
      version: 1,
      attempts: progress.attempts,
      correct: progress.correct,
      streak: progress.streak,
      best: progress.best,
      seen: [...progress.seen],
      topics,
    },
  };
}
