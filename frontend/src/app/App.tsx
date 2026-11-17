import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, matchPath, useLocation } from 'react-router-dom';
import { LabThemeProvider } from './LabTheme';
import { preferredInterface } from './interfacePreference';

const LegacyShell = lazy(() => import('./LegacyShell'));
const Workshop = lazy(() =>
  import('../features/workshop/Workshop').then((module) => ({ default: module.Workshop })),
);

function Experiences() {
  const { pathname } = useLocation();
  const workshop =
    Boolean(matchPath('/playground', pathname)) ||
    (Boolean(matchPath('/', pathname)) && preferredInterface() !== 'legacy');
  const [visitedLegacy, setVisitedLegacy] = useState(!workshop);
  useEffect(() => {
    if (!workshop) setVisitedLegacy(true);
  }, [workshop]);
  return (
    <>
      {workshop && (
        <div className="workshop-host">
          <Suspense fallback={<p role="status">Opening the workshop…</p>}>
            <Workshop />
          </Suspense>
        </div>
      )}
      {(visitedLegacy || !workshop) && (
        <div hidden={workshop} inert={workshop} aria-hidden={workshop || undefined}>
          <Suspense fallback={<p role="status">Opening the Legacy lab…</p>}>
            <LegacyShell active={!workshop} />
          </Suspense>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LabThemeProvider>
        <Experiences />
      </LabThemeProvider>
    </BrowserRouter>
  );
}
