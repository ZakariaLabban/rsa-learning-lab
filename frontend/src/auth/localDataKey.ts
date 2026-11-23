/** Existing unscoped data stays with the guest profile. */
export function localDataKey(key: string, accountId: string | null): string {
  return accountId === null ? key : `${key}:account:${encodeURIComponent(accountId)}`;
}

export const localClearKey = (accountId: string | null) =>
  localDataKey('rsa-lab.local-clear', accountId);

export function localClearRevision(accountId: string | null): string | null {
  try {
    return localStorage.getItem(localClearKey(accountId));
  } catch {
    return null;
  }
}

/** A late writer can only recreate an obsolete key after a profile is cleared. */
export function dataKeyAtRevision(key: string, revision: string | null) {
  return revision === null ? key : `${key}:clear:${revision}`;
}
