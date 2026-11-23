import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, matchPath, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { localClearKey, localClearRevision, localDataKey } from '../auth/localDataKey';
import { browserStorage, Keyring, keyring, KeyringContext, STORAGE_KEY } from '../keyring';
import { ErrorBoundary } from './ErrorBoundary';
import { LabThemeProvider } from './LabTheme';
import { preferredInterface } from './interfacePreference';

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

const LegacyShell = lazy(() => import('./LegacyShell'));

const LectureShell = lazy(() =>
  import('../features/lecture/LectureShell').then((module) => ({
    default: module.LectureShell,
  })),
);

const ModernLab = lazy(() =>
  import('../features/lessons/ModernLab').then((module) => ({
    default: module.ModernLab,
  })),
);

function Experiences() {
  const { pathname } = useLocation();

  const account = pathname === '/account' || pathname === '/account/';
  const privacy = pathname === '/privacy' || pathname === '/privacy/';

  const atRoot = Boolean(matchPath('/', pathname));

  const lecture =
    !account &&
    !privacy &&
    (Boolean(matchPath('/lecture/*', pathname)) ||
      Boolean(matchPath('/lecture', pathname)) ||
      (atRoot && preferredInterface() === 'lecture'));

  const workshop =
    !account &&
    !privacy &&
    !lecture &&
    (Boolean(matchPath('/playground/*', pathname)) ||
      (atRoot && preferredInterface() === 'workshop'));

  const classic = !account && !privacy && !lecture && !workshop;

  const [visitedLegacy, setVisitedLegacy] = useState(classic);

  useEffect(() => {
    if (classic) setVisitedLegacy(true);
  }, [classic]);

  return (
    <>
      {account && (
        <Suspense fallback={<p role="status">Opening account...</p>}>
          <AuthPage />
        </Suspense>
      )}

      {privacy && (
        <Suspense fallback={<p role="status">Opening privacy page...</p>}>
          <PrivacyPage />
        </Suspense>
      )}

      {lecture && (
        <Suspense fallback={<p role="status">Opening the lecture lab…</p>}>
          <LectureShell />
        </Suspense>
      )}

      {workshop && (
        <div className="workshop-host">
          <Suspense fallback={<p role="status">Opening the workshop…</p>}>
            <ModernLab />
          </Suspense>
        </div>
      )}

      {!account && !privacy && (visitedLegacy || classic) && (
        <div hidden={!classic} inert={!classic} aria-hidden={!classic || undefined}>
          <Suspense fallback={<p role="status">Opening the Legacy lab…</p>}>
            <LegacyShell active={classic} />
          </Suspense>
        </div>
      )}
    </>
  );
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
    const clearKey = localClearKey(accountId);
    const reloadAfterClear = (event: StorageEvent) => {
      if (event.key === clearKey || event.key === null) {
        window.location.reload();
      }
    };
    window.addEventListener('storage', reloadAfterClear);
    return () => window.removeEventListener('storage', reloadAfterClear);
  }, [accountId]);

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
