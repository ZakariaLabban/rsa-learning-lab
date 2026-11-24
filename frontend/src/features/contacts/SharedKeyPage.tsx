import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { lookupSharedKey } from '../../lib/supabase';
import { useKeyringStore } from '../../keyring';
import { parseContact } from './model';
import { shareSlug } from './ShareLinks';
import '../lecture/standard.css';

export default function SharedKeyPage() {
  const { pathname } = useLocation();
  return <SharedKey key={pathname} path={pathname} />;
}

function SharedKey({ path }: { path: string }) {
  const store = useKeyringStore();
  const slug = shareSlug(path);
  const [key, setKey] = useState<Awaited<ReturnType<typeof parseContact>>>();
  const [status, setStatus] = useState(
    slug ? 'Looking up public key…' : 'Invalid public-key link.',
  );
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const request = new AbortController();
    void (async () => {
      try {
        const row = await lookupSharedKey(slug, request.signal);
        const parsed =
          row && (await parseContact(JSON.stringify({ format: 'rsa-lab-public-v2', ...row })));
        if (request.signal.aborted) return;
        if (parsed) setKey(parsed);
        setStatus(parsed ? '' : 'This link is invalid or has been revoked.');
      } catch {
        if (!request.signal.aborted)
          setStatus('Could not load this public key. Check your connection and reload.');
      }
    })();
    return () => request.abort();
  }, [slug]);

  async function add() {
    if (!key || !slug || busy || added) return;
    setBusy(true);
    try {
      const row = await lookupSharedKey(slug, new AbortController().signal);
      if (!row) {
        setKey(undefined);
        setStatus('This link has been revoked.');
        return;
      }
      const current = await parseContact(JSON.stringify({ format: 'rsa-lab-public-v2', ...row }));
      if (current.fingerprint !== key.fingerprint) {
        setKey(undefined);
        setStatus('The public key changed. Reload to review it.');
        return;
      }
      await store.addContact(key.key, key.name);
      setAdded(true);
      setStatus(
        'Contact added. Compare the fingerprint with its owner before marking it verified.',
      );
    } catch {
      setStatus('Could not add this contact. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lecture">
      <main>
        <Link to="/lecture/contacts">Back to Contacts</Link>
        <h1>Shared public key</h1>
        {key && (
          <>
            <h2>{key.name}</h2>
            <p className="num wrap">{key.fingerprint}</p>
            <p>
              Anyone can choose this display name. Compare the fingerprint with its owner before
              trusting the key.
            </p>
            <button
              type="button"
              className="primary"
              disabled={busy || added}
              onClick={() => void add()}
            >
              Add to contacts
            </button>
          </>
        )}
        <p role="status">{status}</p>
      </main>
    </div>
  );
}
