import { Component, type ErrorInfo, type ReactNode } from 'react';
import './error-page.css';

type Props = {
  children: ReactNode;
  /** When this value changes (for example the address), the boundary tries again. */
  resetKey?: string;
};
type State = { error: Error | null };

/** Whether the error looks like a page file that could not be loaded (often right after an update). */
export function isLoadFailure(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|Loading chunk/i.test(
    `${error.name} ${error.message}`,
  );
}

/**
 * Catches errors while drawing a page, so a bug or a missing file shows a clear message with a
 * way out instead of a blank screen. Nothing is sent anywhere: the details stay on this screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept in the browser console only, for whoever is debugging; never uploaded.
    console.error('RSA Lab could not show this page.', error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey)
      this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const loadFailure = isLoadFailure(error);
    return (
      <main className="error-page" role="alert">
        <h1>{loadFailure ? 'This page could not be loaded' : 'Something went wrong'}</h1>
        <p>
          {loadFailure
            ? 'A file the page needs did not load. This often happens right after an update, or when the connection drops. Reloading usually fixes it.'
            : 'The page stopped working. Your keys and messages were not sent anywhere. Reloading usually fixes it.'}
        </p>
        <div className="error-actions">
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            Reload the page
          </button>
          <a href="/" className="secondary">
            Go to the start
          </a>
        </div>
        <details>
          <summary>Technical details</summary>
          <pre>{`${error.name}: ${error.message}`}</pre>
        </details>
      </main>
    );
  }
}
