import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CopyButton } from './CopyButton';
export function Value({
  label,
  value,
  note,
  privateValue = false,
}: {
  label: string;
  value: string;
  note?: string;
  privateValue?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`value-field ${privateValue ? 'private-value' : ''}`}>
      <div className="value-label">
        <span>{label}</span>
        <CopyButton value={value} />
      </div>
      <p className={`mono number ${expanded ? 'expanded' : ''}`}>{value}</p>
      <div className="value-bottom">
        {note && <small>{note}</small>}
        {value.length > 65 && (
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Collapse' : 'Show all'} <ChevronDown size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
