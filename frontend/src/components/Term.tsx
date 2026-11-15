import { useId } from 'react';
import { glossary, type GlossaryTerm } from '../content/glossary';

export function Term({ term }: { term: GlossaryTerm }) {
  const id = useId(),
    entry = glossary[term];
  return (
    <span className="term">
      <button type="button" aria-describedby={id}>
        {entry.name}
      </button>
      <span id={id} role="tooltip" className="term-tooltip">
        {entry.explanation}
        <small>{entry.reference}</small>
      </span>
    </span>
  );
}
