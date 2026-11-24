import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import {
  localClearKey,
  localClearRevision,
  localDataKey,
  purgeObsoleteLocalData,
} from '../auth/localDataKey';
import { browserStorage, Keyring, keyring, KeyringContext, STORAGE_KEY } from '../keyring';
import { progressKey } from '../features/lessons/practiceProgress';
import { ErrorBoundary } from './ErrorBoundary';
import { LabThemeProvider } from './LabTheme';
import { lectureRedirect } from './lectureRedirect';

const AuthPage = lazy(() =>
  import('../auth/AuthPage').then((module) => ({
    default: module.AuthPage,
  })),
);

const PrivacyPage = lazy(() =>
  import('../auth/PrivacyPage').then((module) => ({
    default: module.PrivacyPage,
  })),
);

const LectureShell = lazy(() =>
  import('../features/lecture/LectureShell').then((module) => ({
    default: module.LectureShell,
  })),
);

// Vite eliminates this branch and its backup modules from production builds.
const BackupExperiences =
  import.meta.env.MODE === 'backup-test' ? lazy(() => import('./BackupExperiences')) : null;

function Experiences() {
  const { pathname, search, hash } = useLocation();
  if (BackupExperiences)
    return (
      <Suspense fallback={<p role="status">Opening backup test…</p>}>
        <BackupExperiences />
      </Suspense>
    );
  const redirect = lectureRedirect(pathname);
  if (redirect) return <Navigate replace to={`${redirect}${search}${hash}`} />;
  const page = /^\/account\/?$/i.test(pathname) ? (
    <AuthPage />
  ) : /^\/privacy\/?$/i.test(pathname) ? (
    <PrivacyPage />
  ) : (
    <LectureShell />
  );
  return <Suspense fallback={<p role="status">Opening RSA Lab…</p>}>{page}</Suspense>;
}

function Guarded() {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary resetKey={pathname}>
      <Experiences />
    </ErrorBoundary>
  );
}

function Profile({ accountId }: { accountId: string | null }) {
  const [store] = useState(() =>
    accountId === null
      ? keyring
      : new Keyring(browserStorage(), localDataKey(STORAGE_KEY, accountId), () =>
          localClearRevision(accountId),
        ),
  );
  useEffect(() => {
    try {
      if (localClearRevision(accountId) !== null) {
        purgeObsoleteLocalData(window.localStorage, accountId, [STORAGE_KEY, progressKey]);
      }
    } catch {
      // Explicit clearing reports storage failures. The startup sweep is best effort.
    }
    const clearKey = localClearKey(accountId);
    const reloadAfterClear = (event: StorageEvent) => {
      if (event.key === clearKey || event.key === null) {
        window.location.reload();
      } else {
        store.observePrivatePreference(event.key);
      }
    };
    window.addEventListener('storage', reloadAfterClear);
    return () => window.removeEventListener('storage', reloadAfterClear);
  }, [accountId, store]);

  return (
    <KeyringContext.Provider value={store}>
      <Guarded />
    </KeyringContext.Provider>
  );
}

function ActiveProfile() {
  const { accountId, loading, setGuestOverride } = useAuth();
  useEffect(() => {
    const resetGuestKeyring = (event: StorageEvent) => {
      if (event.key === localClearKey(null) || event.key === null) {
        void keyring.ready.then(() => keyring.resetAfterClear());
      }
    };
    window.addEventListener('storage', resetGuestKeyring);
    return () => window.removeEventListener('storage', resetGuestKeyring);
  }, []);

  if (loading) {
    return (
      <main>
        <p role="status">Checking your session…</p>
        <button type="button" onClick={() => setGuestOverride(true)}>
          Continue as guest
        </button>
      </main>
    );
  }
  return <Profile key={localDataKey('profile', accountId)} accountId={accountId} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <LabThemeProvider>
        <AuthProvider>
          <ActiveProfile />
        </AuthProvider>
      </LabThemeProvider>
    </BrowserRouter>
  );
}
