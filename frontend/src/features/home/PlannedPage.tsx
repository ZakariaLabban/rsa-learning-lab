import { Link } from 'react-router-dom';

export function PlannedPage({ label, issue }: { label: string; issue: number }) {
  return (
    <section className="panel planned-page">
      <span className="subtle-badge">PLANNED FEATURE</span>
      <h1>{label}</h1>
      <p>This page has a route and navigation, but its interactive lesson is still being built.</p>
      <p>
        Track implementation in{' '}
        <a
          href={`https://github.com/ZakariaLabban/rsa-learning-lab/issues/${issue}`}
          target="_blank"
          rel="noreferrer"
        >
          issue #{issue}
        </a>
        .
      </p>
      <Link className="primary-button" to="/learn/example">
        Try the working RSA example
      </Link>
    </section>
  );
}
