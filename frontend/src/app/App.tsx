import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Braces, CircleHelp, Menu, Moon, Sun, X } from 'lucide-react';
import { ErrorBanner } from '../components/ErrorBanner';
import { Home } from '../features/home/Home';
import { PlannedPage } from '../features/home/PlannedPage';
import { Experiments } from '../features/legacy/Experiments';
import { KeyStudio } from '../features/legacy/KeyStudio';
import { MathExplorer } from '../features/legacy/MathExplorer';
import { Workbench } from '../features/legacy/Workbench';
import { Orientation } from './Orientation';
import { routes } from './routes';
import { useLegacySession } from './useLegacySession';

function Shell() {
  const location = useLocation();
  const isWorkbench = location.pathname === '/learn/encrypt';
  const isLegacy = isWorkbench || ['/learn/keys', '/experiments'].includes(location.pathname);
  const session = useLegacySession(isLegacy);
  const [guide, setGuide] = useState(true),
    [mobileNav, setMobileNav] = useState(false),
    [help, setHelp] = useState(false);
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
  const current = routes.find((route) => route.path === location.pathname);
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
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? 'nav-open' : ''}`} aria-label="Laboratory sidebar">
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
          <button className="sidebar-help" onClick={() => setHelp(true)}>
            <CircleHelp size={17} /> A quick orientation
          </button>
          <span className="helper-text">EECE 455 / 632 · Project 12</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
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
              <strong>Existing local workspace</strong>
              <span>
                {session.online === null
                  ? 'Checking the local Python engine…'
                  : session.online
                    ? 'Python engine connected. Browser migration is in progress.'
                    : 'Start the local Python server to generate keys and encrypt. The worked example runs without it.'}
              </span>
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
            <Workbench
              {...keyProps}
              active={isWorkbench}
              setError={session.setError}
              guide={guide}
              setGuide={setGuide}
            />
          </div>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/learn/encrypt" element={null} />
            <Route
              path="/learn/keys"
              element={
                <>
                  <div className="page-heading">
                    <h1>Explore your keys.</h1>
                  </div>
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
                  !['/learn/encrypt', '/learn/keys', '/learn/example', '/experiments'].includes(
                    r.path,
                  ),
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
