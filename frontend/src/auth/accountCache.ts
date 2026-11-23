export const ACCOUNT_CACHE_SECTIONS = ['public-keys', 'contacts', 'practice-progress'] as const;

export type AccountCacheSection = (typeof ACCOUNT_CACHE_SECTIONS)[number];

const PREFIX = 'rsa-lab.account.v1';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function accountCacheKey(userId: string, section: AccountCacheSection): string {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error('Invalid account ID.');
  }

  if (!ACCOUNT_CACHE_SECTIONS.includes(section)) {
    throw new Error('Invalid account cache section.');
  }

  return `${PREFIX}.${userId.toLowerCase()}.${section}`;
}

export function clearAccountCache(userId: string, storage: Pick<Storage, 'removeItem'>): void {
  for (const section of ACCOUNT_CACHE_SECTIONS) {
    storage.removeItem(accountCacheKey(userId, section));
  }
}
