import { lazy, Suspense, useEffect, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
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

export default function BackupExperiences() {
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
