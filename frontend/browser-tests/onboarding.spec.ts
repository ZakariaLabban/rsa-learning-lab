import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LESSONS } from '../src/features/lecture/lessons';
import { LESSON_GUIDES } from '../src/features/lecture/lessonGuides';

test('all lessons introduce themselves and spotlight their actual controls', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const lesson of LESSONS) {
    await page.goto(lesson.path);
    const guide = page.getByRole('dialog');
    await expect(guide).toBeVisible();
    await expect(guide.getByRole('heading')).toHaveText(lesson.title);
    await expect(guide).toContainText(LESSON_GUIDES[lesson.path].purpose);
    await guide.getByRole('button', { name: 'Show me how' }).click();
    for (const [index, step] of LESSON_GUIDES[lesson.path].steps.entries()) {
      await expect(guide.getByRole('heading')).toHaveText(step.title);
      await expect(guide.locator('.guide-spot'), `${lesson.path}: ${step.target}`).toBeVisible();
      const bounds = await guide.locator('.guide-spot').boundingBox();
      expect(bounds!.width).toBeGreaterThan(0);
      expect(bounds!.height).toBeGreaterThan(0);
      await expect(guide.getByText('This control is not shown', { exact: false })).toHaveCount(0);
      await guide
        .getByRole('button', {
          name:
            index === LESSON_GUIDES[lesson.path].steps.length - 1 ? 'Finish & explore' : 'Next →',
          exact: true,
        })
        .click();
    }
    await expect(guide).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Page guide', exact: true })).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
  expect(errors).toEqual([]);
});

test('skip, return visits, per-lesson opt-out and replay preserve calculations', async ({
  page,
}) => {
  await page.goto('/lecture/gcd');
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.locator('[data-guide="next"]').click();
  await expect(page.locator('table tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Page guide', exact: true }).click();
  await page.getByRole('button', { name: 'Show me how' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Next →', exact: true }).click();
  await page.getByRole('button', { name: 'Try the highlighted Next step' }).click();
  await expect(page.locator('table tbody tr')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Don’t open automatically for this lesson').check();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.reload();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Page guide', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/lecture/inverse');
  await expect(page.getByRole('dialog')).toBeVisible();
});

for (const width of [375, 1440])
  for (const theme of ['light', 'dark']) {
    test(`tour and account layout work at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 850 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('rsa-lab-theme', value), theme);
      await page.goto('/lecture/gcd');
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page })
            .include('dialog')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.getByRole('button', { name: 'Show me how' }).click();
      for (let index = 0; index < LESSON_GUIDES['/lecture/gcd'].steps.length; index++) {
        await expect
          .poll(async () => {
            const bounds = await page.locator('.guide-card').boundingBox();
            const spot = await page.locator('.guide-spot').boundingBox();
            if (!bounds || !spot) return false;
            const overlap =
              Math.max(
                0,
                Math.min(bounds.x + bounds.width, spot.x + spot.width) - Math.max(bounds.x, spot.x),
              ) *
              Math.max(
                0,
                Math.min(bounds.y + bounds.height, spot.y + spot.height) -
                  Math.max(bounds.y, spot.y),
              );
            return (
              bounds.x >= 0 &&
              bounds.x + bounds.width <= width &&
              bounds.y >= 0 &&
              bounds.y + bounds.height <= 851 &&
              overlap === 0
            );
          })
          .toBe(true);
        await page
          .getByRole('dialog')
          .getByRole('button', {
            name:
              index === LESSON_GUIDES['/lecture/gcd'].steps.length - 1
                ? 'Finish & explore'
                : 'Next →',
            exact: true,
          })
          .click();
      }
      for (const route of ['/account', '/privacy']) {
        await page.goto(route);
        await expect(page.locator('.account-sheet h1')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      }
    });
  }

test('old interfaces cannot be opened, including with a stored interface preference', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('rsa-lab-interface', 'workshop'));
  for (const path of [
    '/',
    '/legacy',
    '/playground',
    '/playground/learn/keys',
    '/learn/euclid',
    '/break/factoring',
    '/playground/unknown',
  ]) {
    await page.goto(path);
    await expect(page.locator('.lecture')).toBeVisible();
    await expect(page.locator('.workshop-host, .lab-shell')).toHaveCount(0);
    await expect(page.locator('a[href^="/legacy"], a[href^="/playground"]')).toHaveCount(0);
    if (await page.getByRole('dialog').isVisible()) await page.keyboard.press('Escape');
  }
  await page.goto('/learn/euclid?m=160&b=7');
  await expect(page).toHaveURL('/lecture/inverse?m=160&b=7');
});

test('tour supports keyboard focus and browser history without leaving an overlay', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Start with lesson 1' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Start with lesson 1' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

for (const viewport of [
  { width: 375, height: 812 },
  { width: 812, height: 375 },
]) {
  test(`callouts leave their controls visible at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize(viewport);
    for (const path of ['/lecture/gcd', '/lecture/keys', '/lecture/start']) {
      await page.goto(path);
      await page.getByRole('button', { name: 'Show me how' }).click();
      for (let i = 0; i < LESSON_GUIDES[path].steps.length; i++) {
        await expect(page.locator('.guide-spot')).toBeVisible();
        await expect
          .poll(async () => {
            const card = (await page.locator('.guide-card').boundingBox())!;
            const spot = (await page.locator('.guide-spot').boundingBox())!;
            return (
              Math.max(
                0,
                Math.min(card.x + card.width, spot.x + spot.width) - Math.max(card.x, spot.x),
              ) *
              Math.max(
                0,
                Math.min(card.y + card.height, spot.y + spot.height) - Math.max(card.y, spot.y),
              )
            );
          })
          .toBe(0);
        await page
          .getByRole('dialog')
          .getByRole('button', {
            name: i === LESSON_GUIDES[path].steps.length - 1 ? 'Finish & explore' : 'Next →',
            exact: true,
          })
          .click();
      }
    }
  });
}

test('guides still open and can be skipped if preference storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('rsa-lab-guide.')) throw new Error('Blocked');
      return read.call(this, key);
    };
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('rsa-lab-guide.')) throw new Error('Blocked');
      return write.call(this, key, value);
    };
  });
  await page.goto('/lecture/gcd');
  await page.getByLabel('Don’t open automatically for this lesson').check();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Page guide', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
