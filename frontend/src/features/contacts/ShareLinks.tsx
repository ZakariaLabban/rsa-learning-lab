import { useEffect, useState } from 'react';
import type { KeyEntry } from '../../keyring';
import { useAuth } from '../../auth/AuthProvider';
import { listSharedKeys, shareKeys } from '../../lib/supabase';
import { CopyText } from '../lecture/parts';

const token = /^[A-Za-z0-9_-]{32,128}$/;
export function shareSlug(value: string) {
  try {
    const url = new URL(value, location.origin);
    const slug = url.pathname.slice(3);
    return url.origin === location.origin &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname.startsWith('/k/') &&
      token.test(slug)
      ? slug
      : null;
  } catch {
    return null;
  }
}

export function ShareLinks({ entry, onLink }: { entry?: KeyEntry; onLink: (url: string) => void }) {
  const { accountId } = useAuth();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listSharedKeys>>>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    void listSharedKeys(accountId).then(
      (rows) => {
        if (active) {
          setRows(rows);
          setLoading(false);
        }
      },
      () => {
        if (active) {
          setError('Could not load existing share links.');
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [accountId]);
  if (!accountId) return null;
  const url = (slug: string) => location.origin + '/k/' + slug;
  async function change(revoke?: string) {
    if (!accountId || busy || loading || (!entry && !revoke)) return;
    setBusy(true);
    setError('');
    try {
      const slug = await shareKeys(
        accountId,
        revoke || !entry
          ? undefined
          : {
              name: entry.name,
              n: String(entry.key.n),
              e: String(entry.key.e),
              fingerprint: entry.fingerprint,
            },
        revoke,
      );
      if (revoke) setRows((rows) => rows.filter((row) => row.slug !== revoke));
      onLink(slug ? url(slug) : '');
      setRows(await listSharedKeys(accountId));
    } catch {
      setError('Could not update sharing. Check your connection and account cloud status.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Online public key sharing">
      <p>
        Anyone with a link can read this public key. Revoking a link stops future lookups. Copies
        already imported remain.
      </p>
      {entry && (
        <button type="button" disabled={busy || loading} onClick={() => void change()}>
          Create public-key link
        </button>
      )}
      {rows.length > 0 && (
        <ul>
          {rows.map((row) => (
            <li key={row.slug}>
              {row.name} <CopyText value={url(row.slug)} label="Copy link" />
              {row.fingerprint === entry?.fingerprint && (
                <button
                  type="button"
                  disabled={busy || loading}
                  onClick={() => onLink(url(row.slug))}
                >
                  Use link in QR
                </button>
              )}
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => void change(row.slug)}
              >
                Revoke link
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
