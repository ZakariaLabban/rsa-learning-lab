import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, matchPath, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { LabThemeProvider } from './LabTheme';
import { preferredInterface } from './interfacePreference';

const LegacyShell = lazy(() => import('./LegacyShell'));
const LectureShell = lazy(() =>
  import('../features/lecture/LectureShell').then((module) => ({ default: module.LectureShell })),
);
const ModernLab = lazy(() =>
  import('../features/lessons/ModernLab').then((module) => ({ default: module.ModernLab })),
);

function Experiences() {
  const { pathname } = useLocation();
  const atRoot = Boolean(matchPath('/', pathname));
  const lecture =
    Boolean(matchPath('/lecture/*', pathname)) ||
    Boolean(matchPath('/lecture', pathname)) ||
    (atRoot && preferredInterface() === 'lecture');
  const workshop =
    !lecture &&
    (Boolean(matchPath('/playground/*', pathname)) ||
      (atRoot && preferredInterface() === 'workshop'));
  const classic = !lecture && !workshop;
  const [visitedLegacy, setVisitedLegacy] = useState(classic);
  useEffect(() => {
    if (classic) setVisitedLegacy(true);
  }, [classic]);
  return (
    <>
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
      {(visitedLegacy || classic) && (
        <div hidden={!classic} inert={!classic} aria-hidden={!classic || undefined}>
          <Suspense fallback={<p role="status">Opening the Legacy lab…</p>}>
            <LegacyShell active={classic} />
          </Suspense>
        </div>
      )}
    </>
  );
}

/** A page that fails to draw shows a clear message; moving to another address tries again. */
function Guarded() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Experiences />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LabThemeProvider>
        <Guarded />
      </LabThemeProvider>
    </BrowserRouter>
  );
}
