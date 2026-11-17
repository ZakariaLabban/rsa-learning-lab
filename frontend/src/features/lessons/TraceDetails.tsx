import type { ReactNode } from 'react';
import { useLessonExperience } from './LessonExperience';

export function TraceDetails({ title, children }: { title: string; children: ReactNode }) {
  const { enabled } = useLessonExperience();
  return enabled ? (
    <details className="lesson-source-table">
      <summary>{title}</summary>
      {children}
    </details>
  ) : (
    <>{children}</>
  );
}
