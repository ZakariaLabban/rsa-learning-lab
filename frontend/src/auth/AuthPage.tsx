import { AccountLayout } from './AccountLayout';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { auth, deleteCloudApplicationData } from '../lib/supabase';
import { ClearLocalData } from './ClearLocalData';
import { GuestImportChoice } from './GuestImportChoice';
import { CloudProfileStatus } from './CloudProfileStatus';
import { CloudSyncStatus } from './CloudSyncStatus';
import { clearAccountCache, cloudProfileChangeKey } from './accountCache';
import { clearSyncCheckpoint } from './cloudSync';

export function AuthPage() {
  const { session, loading, configured, guestOverride, setGuestOverride } = useAuth();

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const callbackFailed =
      query.has('code') ||
      fragment.has('access_token') ||
      [query, fragment].some((params) => params.has('error') || params.has('error_code'));
    return callbackFailed
      ? 'This sign-in link is invalid or expired. Request a new link in this browser.'
      : '';
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [profileRevision, setProfileRevision] = useState(0);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth) {
      setError('Supabase is not configured.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const { error: authError } = await auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/account`,
        },
      });

      if (authError) throw authError;

      setMessage('Check your email for a sign-in link.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the sign-in link.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGitHubSignIn() {
    if (!auth || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error: authError } = await auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/account` },
      });
      if (authError) throw authError;
    } catch {
      setError('Could not start GitHub sign-in.');
      setBusy(false);
    }
  }

  async function handleSignOut() {
    if (!auth) return;

    setBusy(true);
    setError('');
    setMessage('');
    setConfirmDelete(false);
    setDeleteText('');

    try {
      const { error: authError } = await auth.signOut({ scope: 'local' });

      if (authError) throw authError;

      setMessage('You have signed out.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCloudData() {
    if (!auth || !session || busy || deleteText !== 'DELETE') {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const { error: deleteError } = await deleteCloudApplicationData(session.access_token);

      if (deleteError) throw deleteError;

      // Cloud deletion succeeded.
      // Clear the current account's local cloud caches.
      // Do not remove the guest keyring or practice data.
      let cacheCleared = true;

      try {
        clearAccountCache(session.user.id, window.localStorage);
        clearSyncCheckpoint(session.user.id, window.localStorage);
        localStorage.setItem(cloudProfileChangeKey(session.user.id), crypto.randomUUID());
      } catch {
        cacheCleared = false;
      }

      setConfirmDelete(false);
      setDeleteText('');

      // Refresh the displayed Supabase profile.
      setProfileRevision((value) => value + 1);

      if (!cacheCleared) {
        setError(
          'Cloud data was deleted, but some local account ' +
            'caches could not be cleared. Please check your ' +
            'browser storage settings.',
        );
      }

      setMessage(
        'Your cloud application data has been deleted. ' +
          'Cloud synchronization is disabled. ' +
          'Your login account and local browser data remain.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete cloud data.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountLayout>
      <Link to="/">← Back to RSA Lab</Link>

      <h1 className="account-title">RSA Lab Account</h1>

      <p className="lead">
        {session
          ? 'You are signed in. Continue to the lab to pick up your lessons.'
          : 'Sign in to access optional account features. You can always use RSA Lab without an account.'}
      </p>

      <p>
        <Link to="/privacy">Privacy and Data</Link>
      </p>

      {!configured && (
        <p role="alert">Supabase is not configured. Guest mode is still available.</p>
      )}

      {loading && <p role="status">Checking your session...</p>}

      {guestOverride && (
        <p>
          Guest mode is active in this tab.{' '}
          <button type="button" onClick={() => setGuestOverride(false)}>
            Check account session
          </button>
        </p>
      )}

      {!loading && configured && !guestOverride && !session && (
        <form className="account-signin" onSubmit={handleSignIn}>
          <label htmlFor="auth-email">Email address</label>

          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            disabled={busy}
          />

          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Sending...' : 'Send magic link'}
          </button>
          <p>Open the link in the browser profile where you requested it.</p>
        </form>
      )}

      {!loading &&
        configured &&
        !guestOverride &&
        !session &&
        import.meta.env.VITE_SUPABASE_GITHUB_ENABLED === 'true' && (
          <button type="button" onClick={handleGitHubSignIn} disabled={busy}>
            Continue with GitHub
          </button>
        )}

      {!loading && session && (
        <>
          {/* SIGNED-IN ACCOUNT */}
          <section>
            <h2>Signed in</h2>

            <p>
              Email: <strong>{session.user.email ?? 'Unknown'}</strong>
            </p>

            <p>
              <Link to="/" className="button primary">
                Continue to the lab →
              </Link>
            </p>

            {confirmSignOut ? (
              <div>
                <p role="alert">
                  Signing out can discard temporary private keys in this and other open tabs.
                  <Link to="/lecture/keys"> Open My Keys to export or remember them.</Link>
                </p>
                <button type="button" onClick={handleSignOut} disabled={busy}>
                  Sign out of this browser
                </button>{' '}
                <button type="button" onClick={() => setConfirmSignOut(false)} disabled={busy}>
                  Keep working
                </button>
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={() => setConfirmSignOut(true)}>
                {busy ? 'Signing out...' : 'Sign out'}
              </button>
            )}
          </section>

          {/* CLOUD ACCOUNT STATUS */}
          <CloudProfileStatus key={`${session.user.id}-${profileRevision}`} />
          <CloudSyncStatus />

          {/* GUEST DATA IMPORT */}
          <GuestImportChoice key={session.user.id} />

          {/* CLOUD DATA DELETION */}
          <hr style={{ margin: '32px 0' }} />

          <section className="account-danger">
            <h2>Delete My Cloud Data</h2>

            <p>Delete your cloud public keys, contacts, practice progress, and shared-key links.</p>

            <p>
              Your authentication account and local browser data will remain. This disables cloud
              writes for this account.
            </p>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMessage('');
                  setConfirmDelete(true);
                }}
                disabled={busy}
              >
                Delete my cloud data...
              </button>
            ) : (
              <div>
                <p>
                  <strong>This permanently deletes your cloud application data.</strong>
                </p>
                <label htmlFor="delete-confirmation">Type DELETE to confirm:</label>
                <input
                  id="delete-confirmation"
                  type="text"
                  value={deleteText}
                  onChange={(event) => setDeleteText(event.target.value)}
                  disabled={busy}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={handleDeleteCloudData}
                  disabled={busy || deleteText !== 'DELETE'}
                >
                  {busy ? 'Deleting...' : 'Permanently delete cloud data'}
                </button>{' '}
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteText('');
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {/* LOCAL DATA DELETION */}
      {!loading && <ClearLocalData />}

      {/* FEEDBACK MESSAGES */}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </AccountLayout>
  );
}
