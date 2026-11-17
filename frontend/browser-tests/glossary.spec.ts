import { expect, test } from '@playwright/test';
import { routes } from '../src/app/routes';
import { lessonRoutes, modernPath } from '../src/features/lessons/lessonRoutes';

// Legacy shows a planned-feature page for practice; the playground has the real lesson.
const legacyPlanned = new Set(['/learn/practice']);

test('every playground lesson and tool page explains its key terms', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
  for (const route of lessonRoutes) {
    await page.goto(modernPath(route.path));
    await expect(page.locator('main .term:visible').first(), route.path).toBeVisible();
  }
});

test('every legacy lesson and tool page explains its key terms', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
  for (const route of routes) {
    if (legacyPlanned.has(route.path)) continue;
    await page.goto(route.path);
    await expect(page.locator('main .term:visible').first(), route.path).toBeVisible();
  }
});

for (const width of [375, 1440])
  test(`term tooltip opens on focus and stays on screen at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(modernPath('/learn/why-rsa-works'));
    const term = page.locator('main .term[data-term="totient"]').first();
    const tooltip = term.getByRole('tooltip');
    await expect(tooltip).toBeHidden();
    await term.getByRole('button', { name: 'φ(n)' }).focus();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('(p−1)(q−1)');
    await expect(tooltip).toContainText('Ch 8');
    const box = await tooltip.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Tab');
    await expect(tooltip).toBeHidden();
  });
