import type { BrowserContext } from '@playwright/test';
import { LESSONS } from '../../src/features/lecture/lessons';

// Calculation regressions opt out explicitly. Onboarding is tested separately.
export async function disableLessonGuides(context: BrowserContext) {
  await context.addInitScript(
    (paths) => {
      for (const path of paths) localStorage.setItem(`rsa-lab-guide.v1:${path}`, 'hidden');
    },
    LESSONS.map((lesson) => lesson.path),
  );
}
