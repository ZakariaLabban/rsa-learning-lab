import { dataKeyAtRevision, localClearRevision, localDataKey } from '../../auth/localDataKey';
import type { PracticeTopic } from './practiceModel';
export type PracticeProgress = {
  version: 1;
  attempts: number;
  correct: number;
  streak: number;
  best: number;
  seen: string[];
  topics: Partial<Record<PracticeTopic, { attempts: number; correct: number }>>;
};
export const progressKey = 'rsa-lab-practice.v1';
export const PRACTICE_PROGRESS_CHANGED = 'rsa-lab:practice-progress-changed';
export const emptyProgress = (): PracticeProgress => ({
  version: 1,
  attempts: 0,
  correct: 0,
  streak: 0,
  best: 0,
  seen: [],
  topics: {},
});
export function parseProgress(text: string | null): PracticeProgress {
  try {
    if (!text || text.length > 100000) return emptyProgress();
    const value = JSON.parse(text) as PracticeProgress;
    const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
    const topics: PracticeTopic[] = [
      'modulus',
      'totient',
      'private-exponent',
      'encrypt',
      'decrypt',
      'inverse',
      'power',
      'miller-rabin',
      'crt',
      'phi',
    ];
    if (
      value.version !== 1 ||
      ![value.attempts, value.correct, value.streak, value.best].every(count) ||
      value.correct > value.attempts ||
      value.streak > value.correct ||
      value.best > value.correct ||
      !Array.isArray(value.seen) ||
      value.seen.length > 128 ||
      value.seen.some((id) => typeof id !== 'string' || id.length > 100) ||
      !value.topics ||
      typeof value.topics !== 'object' ||
      Array.isArray(value.topics)
    )
      return emptyProgress();
    if (
      Object.entries(value.topics).some(
        ([key, stats]) =>
          !topics.includes(key as PracticeTopic) ||
          !stats ||
          !count(stats.attempts) ||
          !count(stats.correct) ||
          stats.correct > stats.attempts,
      )
    )
      return emptyProgress();
    return value;
  } catch {
    return emptyProgress();
  }
}
export function readProgress(accountId: string | null = null) {
  try {
    return parseProgress(
      localStorage.getItem(
        dataKeyAtRevision(localDataKey(progressKey, accountId), localClearRevision(accountId)),
      ),
    );
  } catch {
    return emptyProgress();
  }
}
export function recordAnswer(
  progress: PracticeProgress,
  id: string,
  topic: PracticeTopic,
  correct: boolean,
): PracticeProgress {
  if (progress.seen.includes(id)) return progress;
  const stats = progress.topics[topic] ?? { attempts: 0, correct: 0 },
    streak = correct ? progress.streak + 1 : 0;
  return {
    ...progress,
    attempts: progress.attempts + 1,
    correct: progress.correct + Number(correct),
    streak,
    best: Math.max(progress.best, streak),
    seen: [...progress.seen.slice(-127), id],
    topics: {
      ...progress.topics,
      [topic]: { attempts: stats.attempts + 1, correct: stats.correct + Number(correct) },
    },
  };
}
export function saveProgress(
  value: PracticeProgress,
  accountId: string | null = null,
  revision = localClearRevision(accountId),
) {
  if (revision !== localClearRevision(accountId)) return;
  try {
    const key = dataKeyAtRevision(localDataKey(progressKey, accountId), revision);
    localStorage.setItem(key, JSON.stringify(value));
    if (revision !== localClearRevision(accountId)) localStorage.removeItem(key);
    else if (typeof window !== 'undefined')
      window.dispatchEvent(new Event(PRACTICE_PROGRESS_CHANGED));
  } catch {
    /* Practice remains usable without storage. */
  }
}

/** Combines explicitly imported guest practice history with this account's local history. */
export function mergePracticeProgress(
  account: PracticeProgress,
  guest: PracticeProgress,
): PracticeProgress {
  const add = (left: number, right: number) => Math.min(Number.MAX_SAFE_INTEGER, left + right);
  const topics = { ...account.topics };
  for (const [topic, stats] of Object.entries(guest.topics)) {
    if (!stats) continue;
    const current = topics[topic as keyof typeof topics] ?? { attempts: 0, correct: 0 };
    topics[topic as keyof typeof topics] = {
      attempts: add(current.attempts, stats.attempts),
      correct: add(current.correct, stats.correct),
    };
  }
  const attempts = add(account.attempts, guest.attempts);
  const correct = Math.min(attempts, add(account.correct, guest.correct));
  const streak = Math.min(correct, Math.max(account.streak, guest.streak));
  return {
    version: 1,
    attempts,
    correct,
    streak,
    best: Math.min(correct, Math.max(account.best, guest.best, streak)),
    seen: [...new Set([...account.seen, ...guest.seen])].slice(-128),
    topics,
  };
}
