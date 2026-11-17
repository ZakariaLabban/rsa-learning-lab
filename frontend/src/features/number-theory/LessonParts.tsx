import type { ReactNode } from 'react';
import { useId } from 'react';
import { TraceDetails } from '../lessons/TraceDetails';

export function IntegerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="lesson-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="mono"
        inputMode="text"
        maxLength={620}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function WorkStatus({
  busy,
  error,
  cancel,
}: {
  busy: boolean;
  error: string;
  cancel: () => void;
}) {
  return (
    <>
      {busy && (
        <p role="status">
          Calculating in a worker…{' '}
          <button className="secondary-button" onClick={cancel}>
            Cancel calculation
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="encrypt-problem">
          {error}
        </p>
      )}
    </>
  );
}
export function LessonTable({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <TraceDetails title={`Inspect table: ${caption}`}>
      <div className="lesson-table-wrap" role="region" aria-label={caption} tabIndex={0}>
        <table className="lesson-table">
          <caption>{caption}</caption>
          {children}
        </table>
      </div>
    </TraceDetails>
  );
}
