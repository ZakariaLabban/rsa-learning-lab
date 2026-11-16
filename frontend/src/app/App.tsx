import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  matchPath,
  useLocation,
} from 'react-router-dom';
import { Braces, CircleHelp, Menu, Moon, Sun, X } from 'lucide-react';
import { ErrorBanner } from '../components/ErrorBanner';
import { Home } from '../features/home/Home';
import { EuclidPage } from '../features/euclid/EuclidPage';
import { KeyWizard } from '../features/keys/KeyWizard';
import { MyKeys } from '../features/keys/MyKeys';
import { PlannedPage } from '../features/home/PlannedPage';
import { Experiments } from '../features/legacy/Experiments';
import { KeyStudio } from '../features/legacy/KeyStudio';
import { MathExplorer } from '../features/legacy/MathExplorer';
import { EncryptDecrypt } from '../features/encrypt/EncryptDecrypt';
import { Orientation } from './Orientation';
import { routes } from './routes';
import { useBrowserSession } from './useBrowserSession';

const Contacts = lazy(() =>
  import('../features/contacts/Contacts').then((module) => ({ default: module.Contacts })),
);
const Signatures = lazy(() =>
  import('../features/signatures/Signatures').then((module) => ({ default: module.Signatures })),
);

function Shell() {
  const location = useLocation();
  // Use the router's own matching rules, including case and trailing slashes.
  const matches = (path: string) => matchPath(path, location.pathname) !== null;
  const isWorkbench = matches('/learn/encrypt');
  const isLegacy = isWorkbench || ['/learn/keys', '/experiments'].some(matches);
  const session = useBrowserSession();
  const [mobileNav, setMobileNav] = useState(false),
    [help, setHelp] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const navToggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileNav) return;
    const drawer = drawerRef.current;
    const toggle = navToggleRef.current;
    const controls = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? [],
      ).filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileNav(false);
      }
      if (event.key !== 'Tab') return;
      const targets = controls();
      const first = targets[0],
        last = targets[targets.length - 1];
      if (!first || !last) return;
      const outside = !drawer?.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    const media = window.matchMedia('(max-width: 700px)');
    const onResize = () => {
      if (!media.matches) setMobileNav(false);
    };
    window.addEventListener('keydown', onKeyDown);
    media.addEventListener('change', onResize);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      media.removeEventListener('change', onResize);
      toggle?.focus();
    };
  }, [mobileNav]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('rsa-lab-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* Storage can be disabled. */
    }
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  const closeHelp = useCallback(() => setHelp(false), []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('rsa-lab-theme', theme);
    } catch {
      /* Memory-only theme remains usable. */
    }
  }, [theme]);
  const current = routes.find((route) => matches(route.path));
  useEffect(() => {
    document.title = `${current?.label ?? 'Explore'} · RSA Lab`;
  }, [current]);
  const keyProps = {
    labKey: session.key,
    bits: session.bits,
    setBits: session.setBits,
    createKey: session.createKey,
    generating: session.generating,
    seconds: session.seconds,
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          tabIndex={-1}
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        ref={drawerRef}
        className={`sidebar ${mobileNav ? 'nav-open' : ''}`}
        aria-label="Laboratory sidebar"
        role={mobileNav ? 'dialog' : undefined}
        aria-modal={mobileNav || undefined}
      >
        <button
          className="icon-button drawer-close"
          aria-label="Close navigation menu"
          onClick={() => setMobileNav(false)}
        >
          <X size={20} />
        </button>
        <Link
          to="/"
          className="brand"
          onClick={() => setMobileNav(false)}
          aria-label="RSA Lab home"
        >
          <span className="brand-mark">
            <Braces size={23} />
          </span>
          <span>
            rsa<span className="brand-light">lab</span>
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setMobileNav(false);
          }}
        >
          <NavLink to="/" className="nav-item" onClick={() => setMobileNav(false)}>
            Overview
          </NavLink>
          {['Learn', 'Break', 'Tools'].map((group) => (
            <div className="nav-group" key={group}>
              <div className="sidebar-label">{group}</div>
              {routes
                .filter((route) => route.group === group)
                .map((route) => (
                  <NavLink
                    key={route.path}
                    to={route.path}
                    className="nav-item"
                    onClick={() => setMobileNav(false)}
                  >
                    {route.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="sidebar-help"
            onClick={() => {
              setMobileNav(false);
              setHelp(true);
            }}
          >
            <CircleHelp size={17} /> A quick orientation
          </button>
          <span className="helper-text">EECE 455 / 632 · Project 12</span>
        </div>
      </aside>
      <div className="main-shell" inert={mobileNav}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              ref={navToggleRef}
              aria-label={mobileNav ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(!mobileNav)}
            >
              {mobileNav ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link to="/">Laboratory</Link>
            <span>/</span>
            <strong>{current?.label ?? 'Overview'}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="icon-button"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              className="icon-button"
              aria-label="About this lab"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={20} />
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {isLegacy && (
            <div className="migration-notice">
              <strong>Your keys stay on this device</strong>
              <span>
                RSA runs in your browser. Private keys stay in tab memory unless you enable
                “Remember my private keys” on the Keys page. Use demonstration data.
              </span>
              {session.bits === 1024 && (
                <span>
                  1024-bit RSA is included for the assignment; use 2048 bits for the practical
                  demonstrations.
                </span>
              )}
            </div>
          )}
          {session.generating && (
            <div className="generation-progress" role="status">
              <span>
                Finding probable primes · {session.candidates} candidates · {session.seconds}s
                elapsed
              </span>
              <button className="secondary-button" onClick={session.cancelGeneration}>
                Cancel key generation
              </button>
            </div>
          )}
          <ErrorBanner message={session.error} onDismiss={() => session.setError('')} />
          <div hidden={!isWorkbench}>
            {isWorkbench && (
              <div className="page-heading">
                <div>
                  <span className="eyebrow">LEARN · ENCRYPT / DECRYPT</span>
                  <h1>Every message has a journey.</h1>
                </div>
              </div>
            )}
            {/* Stays mounted while hidden so the message and journey survive navigation. */}
            <EncryptDecrypt />
          </div>
          <Routes>
            <Route
              path="/contacts"
              element={
                <Suspense fallback={<p role="status">Loading contacts…</p>}>
                  <Contacts />
                </Suspense>
              }
            />
            <Route
              path="/learn/signatures"
              element={
                <Suspense fallback={<p role="status">Loading signatures…</p>}>
                  <Signatures />
                </Suspense>
              }
            />
            <Route path="/" element={<Home />} />
            <Route path="/learn/encrypt" element={null} />
            <Route
              path="/learn/keys"
              element={
                <>
                  <div className="page-heading">
                    <h1>Explore your keys.</h1>
                  </div>
                  <KeyWizard />
                  <MyKeys onUse={session.activateKey} />
                  <h2 className="classic-heading">Key Studio (classic view)</h2>
                  <KeyStudio
                    {...keyProps}
                    history={session.history}
                    setKey={session.setKey}
                    setError={session.setError}
                  />
                </>
              }
            />
            <Route
              path="/learn/euclid"
              element={
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">LEARN · MODULAR INVERSE</span>
                      <h1>Extended Euclid.</h1>
                    </div>
                  </div>
                  <EuclidPage />
                </>
              }
            />
            <Route
              path="/learn/example"
              element={
                <>
                  <div className="page-heading">
                    <h1>A complete RSA example.</h1>
                  </div>
                  <MathExplorer />
                </>
              }
            />
            <Route
              path="/experiments"
              element={
                <>
                  <div className="page-heading">
                    <h1>Test the assumptions.</h1>
                  </div>
                  <Experiments
                    labKey={session.key}
                    generating={session.generating}
                    createKey={session.createKey}
                    history={session.history}
                    setError={session.setError}
                  />
                </>
              }
            />
            {routes
              .filter(
                (r) =>
                  ![
                    '/learn/encrypt',
                    '/learn/keys',
                    '/learn/euclid',
                    '/learn/example',
                    '/experiments',
                    '/contacts',
                    '/learn/signatures',
                  ].includes(r.path),
              )
              .map((r) => (
                <Route
                  key={r.path}
                  path={r.path}
                  element={<PlannedPage label={r.label} issue={r.issue} />}
                />
              ))}
            <Route
              path="*"
              element={
                <section className="panel planned-page">
                  <h1>Page not found.</h1>
                  <p>This address does not match a page in the lab.</p>
                  <Link className="primary-button" to="/">
                    Back to the overview
                  </Link>
                </section>
              }
            />
          </Routes>
          <footer className="app-footer">
            Educational software · Use demonstration data. Custom RSA is not audited or
            constant-time.
          </footer>
        </main>
      </div>
      {help && <Orientation onClose={closeHelp} />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
