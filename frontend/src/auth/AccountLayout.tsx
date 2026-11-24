import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useLabTheme } from '../app/LabTheme';
import '../features/lecture/standard.css';
import './account.css';

export function AccountLayout({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useLabTheme();
  return (
    <div className="lecture account-view">
      <a className="skip-link" href="#account-content">
        Skip to account content
      </a>
      <header className="bar">
        <Link to="/" className="brand">
          RSA Lab
        </Link>
        <span className="tagline">Learn RSA step by step</span>
        <Link to="/" className="alt">
          Back to the lessons →
        </Link>
        <button
          type="button"
          className="theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? (
            <Sun size={16} aria-hidden="true" />
          ) : (
            <Moon size={16} aria-hidden="true" />
          )}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </header>
      <div className="account-layout">
        <aside className="account-margin" aria-label="Learning without an account">
          <span className="account-kicker">YOUR LEARNING SPACE</span>
          <p>
            Learn freely.
            <br />
            <mark>Keep control.</mark>
          </p>
          <div className="account-key-art" aria-hidden="true">
            <span>e, n</span>
            <i>↔</i>
            <span>d, n</span>
          </div>
          <p className="account-small">
            Every lesson works without signing in. Your private RSA keys stay on this device.
          </p>
          <Link to="/lecture/start">New to RSA? Start here →</Link>
        </aside>
        <main id="account-content" className="account-sheet" tabIndex={-1}>
          {children}
        </main>
      </div>
      <footer className="app-footer">
        <Link to="/">Course map</Link> · <Link to="/account">Account</Link> ·{' '}
        <Link to="/privacy">Privacy and Data</Link>
      </footer>
    </div>
  );
}
