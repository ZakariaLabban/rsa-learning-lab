import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  matchPath,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { ArrowLeft, ArrowRight, Moon, Sun } from 'lucide-react';
import { lessonRoutes, modernPath } from './lessonRoutes';
import { useLabTheme } from '../../app/LabTheme';
import { rememberInterface } from '../../app/interfacePreference';
import { useBrowserSession } from '../../app/useBrowserSession';
import { ErrorBanner } from '../../components/ErrorBanner';
import {
  LessonExperienceProvider,
  LessonVisibility,
  useLessonExperience,
} from './LessonExperience';

const Workshop = lazy(() => import('../workshop/Workshop').then((m) => ({ default: m.Workshop })));
const Keys = lazy(() => import('./PracticalPages').then((m) => ({ default: m.KeysLesson })));
const Experiments = lazy(() =>
  import('../legacy/Experiments').then((m) => ({ default: m.Experiments })),
);
const Euclid = lazy(() => import('../euclid/EuclidPage').then((m) => ({ default: m.EuclidPage })));
const Prime = lazy(() =>
  import('../number-theory/MillerRabinPage').then((m) => ({ default: m.MillerRabinPage })),
);
const Power = lazy(() =>
  import('../number-theory/PowerPage').then((m) => ({ default: m.PowerPage })),
);
const Proof = lazy(() =>
  import('../number-theory/WhyRsaWorksPage').then((m) => ({ default: m.WhyRsaWorksPage })),
);
const Crt = lazy(() => import('../number-theory/CrtPage').then((m) => ({ default: m.CrtPage })));
const Signatures = lazy(() =>
  import('../signatures/Signatures').then((m) => ({ default: m.Signatures })),
);
const Encrypt = lazy(() =>
  import('../encrypt/EncryptDecrypt').then((m) => ({ default: m.EncryptDecrypt })),
);
const Contacts = lazy(() => import('../contacts/Contacts').then((m) => ({ default: m.Contacts })));
const Example = lazy(() =>
  import('./WorkedExampleLesson').then((m) => ({ default: m.WorkedExampleLesson })),
);
const Factoring = lazy(() =>
  import('../attacks/FactoringPage').then((m) => ({ default: m.FactoringPage })),
);
const Guessing = lazy(() =>
  import('../attacks/GuessingPage').then((m) => ({ default: m.GuessingPage })),
);
const Broadcast = lazy(() =>
  import('../attacks/BroadcastPage').then((m) => ({ default: m.BroadcastPage })),
);
const Practice = lazy(() =>
  import('./PracticeLesson').then((m) => ({ default: m.PracticeLesson })),
);
const Files = lazy(() => import('./PracticalPages').then((m) => ({ default: m.FilesLesson })));

function LessonShell() {
  const location = useLocation(),
    navigate = useNavigate(),
    { theme, setTheme } = useLabTheme();
  const { mode, setMode, reduced, toggleMotion } = useLessonExperience();
  const session = useBrowserSession();
  const home = Boolean(
    matchPath('/playground', location.pathname) || matchPath('/', location.pathname),
  );
  const path = location.pathname
    .replace(/^\/playground/i, '')
    .replace(/\/$/, '')
    .toLowerCase();
  const index = lessonRoutes.findIndex((route) => route.path.toLowerCase() === path);
  const isEncrypt = path === '/learn/encrypt';
  const [visitedEncrypt, setVisitedEncrypt] = useState(isEncrypt);
  useEffect(() => {
    if (isEncrypt) setVisitedEncrypt(true);
  }, [isEncrypt]);
  const current = lessonRoutes[index],
    previous = lessonRoutes[index - 1],
    next = lessonRoutes[index + 1];
  useEffect(() => {
    if (!home) document.title = `${current?.label ?? 'Page not found'} · RSA Playground`;
  }, [current, home]);
  useEffect(() => {
    if (!home) document.getElementById('lesson-title')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, home]);
  const legacyPath = path === '/files' ? '/learn/encrypt' : (current?.path ?? '/legacy');
  return (
    <>
      {home && (
        <Suspense fallback={<p role="status">Opening the workshop…</p>}>
          <Workshop />
        </Suspense>
      )}
      <main hidden={home} className="rsa-playground lesson-studio" id="lesson-content">
        <a className="skip-link" href="#lesson-workbench">
          Skip to lesson
        </a>
        <header className="world-header">
          <Link to="/playground" className="wordmark">
            rsa<span>playground</span>
          </Link>
          <div className="world-links">
            <Link
              className="legacy-switch"
              to={legacyPath}
              onClick={() => rememberInterface('legacy')}
            >
              Legacy lab <ArrowRight size={14} />
            </Link>
            <button
              className="theme-switch"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            </button>
          </div>
        </header>
        <div className="lesson-navigation">
          <Link to="/playground">
            <ArrowLeft size={14} /> Workshop
          </Link>
          <label>
            Jump to a lesson
            <select
              aria-label="Jump to a lesson"
              value={current ? modernPath(current.path) : ''}
              onChange={(e) => navigate(e.target.value)}
            >
              <option value="" disabled>
                Choose a lesson
              </option>
              {['Learn', 'Break', 'Tools'].map((group) => (
                <optgroup key={group} label={group}>
                  {lessonRoutes
                    .filter((route) => route.group === group)
                    .map((route) => (
                      <option key={route.path} value={modernPath(route.path)}>
                        {route.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <section className="lesson-heading">
          <span className="eyebrow">
            {current?.group.toUpperCase() ?? 'EXPLORE'} / {String(index + 1).padStart(2, '0')}
          </span>
          <h1 id="lesson-title" tabIndex={-1}>
            {current?.label ?? 'Page not found'}
          </h1>
          <p>Change an input. Open the calculation. Follow what happens.</p>
        </section>
        <div className="entry-controls">
          <div className="mode-switch" aria-label="Learning mode">
            <button aria-pressed={mode === 'guided'} onClick={() => setMode('guided')}>
              Guide me
            </button>
            <button aria-pressed={mode === 'explore'} onClick={() => setMode('explore')}>
              Explore freely
            </button>
          </div>
          <span>
            {mode === 'guided'
              ? 'Run the lesson, then follow each calculation in order.'
              : 'Choose any calculation from the map and inspect its exact values.'}
          </span>
          <button className="quiet" aria-pressed={reduced} onClick={toggleMotion}>
            Reduce motion
          </button>
        </div>
        {session.generating && (
          <div className="lesson-generation" role="status">
            Finding primes · {session.candidates} candidates{' '}
            <button className="action" onClick={session.cancelGeneration}>
              Cancel key generation
            </button>
          </div>
        )}
        <ErrorBanner message={session.error} onDismiss={() => session.setError('')} />
        <div id="lesson-workbench">
          {(visitedEncrypt || isEncrypt) && (
            <div hidden={!isEncrypt}>
              <LessonVisibility visible={isEncrypt}>
                <Suspense fallback={<p role="status">Opening the message workbench…</p>}>
                  <Encrypt />
                </Suspense>
              </LessonVisibility>
            </div>
          )}
          <Suspense fallback={<p role="status">Opening this lesson…</p>}>
            <Routes>
              <Route path="/playground/learn/keys" element={<Keys onUse={session.activateKey} />} />
              <Route path="/playground/learn/miller-rabin" element={<Prime />} />
              <Route path="/playground/learn/euclid" element={<Euclid />} />
              <Route path="/playground/learn/square-and-multiply" element={<Power />} />
              <Route path="/playground/learn/encrypt" element={null} />
              <Route path="/playground/learn/crt" element={<Crt />} />
              <Route path="/playground/learn/signatures" element={<Signatures />} />
              <Route path="/playground/learn/why-rsa-works" element={<Proof />} />
              <Route path="/playground/learn/practice" element={<Practice />} />
              <Route path="/playground/break/factoring" element={<Factoring />} />
              <Route path="/playground/break/yes-or-no" element={<Guessing />} />
              <Route path="/playground/break/small-e" element={<Broadcast />} />
              <Route path="/playground/contacts" element={<Contacts />} />
              <Route path="/playground/learn/example" element={<Example />} />
              <Route
                path="/playground/experiments"
                element={
                  <Experiments
                    labKey={session.key}
                    generating={session.generating}
                    createKey={session.createKey}
                    history={session.history}
                    setError={session.setError}
                  />
                }
              />
              <Route path="/playground/files" element={<Files />} />
              <Route path="/playground/legacy" element={<Navigate to="/legacy" replace />} />
              <Route
                path="*"
                element={
                  <p>
                    This lesson address does not exist.{' '}
                    <Link to="/playground">Return to the workshop</Link>.
                  </p>
                }
              />
            </Routes>
          </Suspense>
        </div>
        <nav className="lesson-path-controls" aria-label="Guided lesson path">
          {previous ? (
            <Link className="action" to={modernPath(previous.path)}>
              <ArrowLeft size={14} />
              {previous.label}
            </Link>
          ) : (
            <Link className="action" to="/playground">
              Workshop
            </Link>
          )}
          {next && (
            <Link className="action" to={modernPath(next.path)}>
              {mode === 'guided' ? 'Next lesson: ' : ''}
              {next.label}
              <ArrowRight size={14} />
            </Link>
          )}
        </nav>
        <details className="lesson-directory">
          <summary>All lessons and tools</summary>
          <nav aria-label="All lessons">
            {['Learn', 'Break', 'Tools'].map((group) => (
              <div key={group}>
                <h2>{group}</h2>
                {lessonRoutes
                  .filter((route) => route.group === group)
                  .map((route) => (
                    <Link key={route.path} to={modernPath(route.path)}>
                      {route.label}
                      <ArrowRight size={13} />
                    </Link>
                  ))}
              </div>
            ))}
          </nav>
        </details>
        <footer className="world-footer">
          <span>Learning by taking things apart.</span>
          <span>Educational software · Use demonstration data · Custom RSA is unaudited</span>
        </footer>
      </main>
    </>
  );
}
export function ModernLab() {
  return (
    <LessonExperienceProvider>
      <LessonShell />
    </LessonExperienceProvider>
  );
}
