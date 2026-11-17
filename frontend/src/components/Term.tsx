import { useId, type ReactNode } from 'react';
import { glossary, type GlossaryTerm } from '../content/glossary';

/**
 * Glossary term with a tooltip on hover and keyboard focus. `children` replaces the
 * visible label (for example "φ(n)" or "coprime") while the tooltip keeps the entry.
 */
export function Term({ term, children }: { term: GlossaryTerm; children?: ReactNode }) {
  const id = useId(),
    entry = glossary[term];
  return (
    <span className="term" data-term={term}>
      <button type="button" aria-describedby={id}>
        {children ?? entry.name}
      </button>
      <span id={id} role="tooltip" className="term-tooltip">
        <strong>{entry.name}.</strong> {entry.explanation}
        <small>{entry.reference}</small>
      </span>
    </span>
  );
}
