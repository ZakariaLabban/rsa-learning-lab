import { disableLessonGuides } from './helpers/lessonGuides';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ context }) => disableLessonGuides(context));

/**
 * Automated accessibility checks (axe, WCAG 2.0/2.1 A and AA) for every page of the lecture view,
 * the 404 page and the error page, in both themes and at desktop and phone width. These catch
 * contrast, names, roles and structure problems; keyboard use is checked in the tests below.
 */
const LESSONS = [
  'start',
  'gcd',
  'inverse',
  'power',
  'rsa',
  'why',
  'signatures',
  'primality',
  'crt',
  'factoring',
  'small-e',
  'guessing',
  'keys',
  'contacts',
  'messages',
  'practice',
];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type Found = { where: string; rule: string; impact: string | null | undefined; targets: string[] };

/** Runs axe and returns what it found, so one test can report every page at once. */
async function scan(page: Page, where: string): Promise<Found[]> {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return result.violations.map((violation) => ({
    where,
    rule: violation.id,
    impact: violation.impact,
    targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
  }));
}

for (const theme of ['light', 'dark'] as const)
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('rsa-lab-theme', value), theme);
    });

    test('home page and every lesson have no axe violations', async ({ page }) => {
      test.setTimeout(180_000);
      const found: Found[] = [];
      for (const path of ['/', ...LESSONS.map((name) => `/lecture/${name}`)]) {
        await page.goto(path);
        await expect(page.locator('main h1')).toBeVisible();
        found.push(...(await scan(page, `${theme} ${path}`)));
      }
      expect(found).toEqual([]);
    });

    test('opened sections, finished tables and results have no axe violations', async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const found: Found[] = [];
      await page.goto('/lecture/inverse');
      await page.getByRole('button', { name: 'Show all', exact: true }).click();
      await page.getByText('Words you need').click();
      await page.getByRole('button', { name: 'Change the numbers' }).click();
      found.push(...(await scan(page, `${theme} inverse opened`)));
      await page.goto('/lecture/rsa');
      await page.getByRole('tab', { name: '2 · Encrypt' }).click();
      found.push(...(await scan(page, `${theme} rsa encrypt`)));
      await page.goto('/lecture/power?a=7&b=560&n=561');
      await page.getByRole('tab', { name: /Exponentiation algorithm/ }).click();
      await page.getByRole('button', { name: 'Show all', exact: true }).click();
      found.push(...(await scan(page, `${theme} power table`)));
      await page.goto('/lecture/practice');
      const first = page.locator('li.question').first();
      await first.getByLabel('Your answer').fill('3');
      await first.getByRole('button', { name: 'Check' }).click();
      await first.getByText('Show the steps and the answer').click();
      found.push(...(await scan(page, `${theme} practice wrong answer and steps`)));
      await page.goto('/lecture/messages');
      await page.getByRole('button', { name: 'Encrypt message' }).click();
      await expect(page.locator('#envelope-out')).toBeVisible();
      found.push(...(await scan(page, `${theme} messages result`)));
      expect(found).toEqual([]);
    });

    test('the 404 page has no axe violations', async ({ page }) => {
      const found: Found[] = [];
      await page.goto('/lecture/not-a-lesson');
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
      found.push(...(await scan(page, `${theme} 404`)));
      expect(found).toEqual([]);
    });

    test('the error page has no axe violations', async ({ page }) => {
      const found: Found[] = [];
      await page.route('**/assets/LectureShell-*.js', (route) => route.abort());
      await page.goto('/lecture/gcd');
      await expect(page.getByRole('alert')).toContainText('could not be loaded');
      found.push(...(await scan(page, `${theme} error page`)));
      expect(found).toEqual([]);
    });
  });

test('phone width pages have no axe violations', async ({ page }) => {
  test.setTimeout(120_000);
  const found: Found[] = [];
  await page.setViewportSize({ width: 375, height: 800 });
  for (const path of ['/', '/lecture/start', '/lecture/gcd', '/lecture/rsa', '/lecture/messages']) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    found.push(...(await scan(page, `phone ${path}`)));
  }
  expect(found).toEqual([]);
});

test.describe('keyboard only', () => {
  test('the skip link jumps to the lesson, and the first tab stop is the skip link', async ({
    page,
  }) => {
    await page.goto('/lecture/gcd');
    await expect(page.locator('main h1')).toBeVisible();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to the lesson' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#lesson$/);
  });

  test('a lesson can be stepped through with the keyboard alone', async ({ page }) => {
    await page.goto('/lecture/gcd');
    await page.getByRole('button', { name: 'Next step →' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('table.grid tbody tr')).toHaveCount(2);
    await page.keyboard.press('Space');
    await expect(page.locator('table.grid tbody tr')).toHaveCount(3);
    await page.getByRole('button', { name: '← Back' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('table.grid tbody tr')).toHaveCount(2);
  });

  test('every control shows a visible focus outline', async ({ page }) => {
    await page.goto('/lecture/gcd');
    for (const name of ['Next step →', 'Change the numbers']) {
      const control = page.getByRole('button', { name });
      await control.focus();
      const outline = await control.evaluate((node) => {
        const style = getComputedStyle(node);
        return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
      });
      expect(outline.style, name).not.toBe('none');
      expect(outline.width, name).toBeGreaterThanOrEqual(2);
    }
  });

  test('reduced motion removes the animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/lecture/start');
    const duration = await page
      .locator('svg.bigpicture .move')
      .first()
      .evaluate((node) => getComputedStyle(node).transitionDuration);
    expect(duration.split(',').every((value) => parseFloat(value) === 0)).toBe(true);
  });
});
