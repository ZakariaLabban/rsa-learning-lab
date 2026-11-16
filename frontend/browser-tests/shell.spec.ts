import { expect, test } from '@playwright/test';
import { routes } from '../src/app/routes';

test('workspace visibility and status follow router case and trailing-slash rules', async ({
  page,
}) => {
  await page.route('**/api/**', (route) => route.abort());
  for (const path of ['/learn/encrypt/', '/LEARN/ENCRYPT']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Every message has a journey.' })).toBeVisible();
    await expect(page.getByLabel('Message to encrypt')).toBeVisible();
    await expect(page.locator('.migration-notice')).toBeVisible();
    await expect(page.locator('.breadcrumb strong')).toHaveText('Encrypt / Decrypt');
  }
  for (const [path, label] of [
    ['/learn/keys/', 'Keys'],
    ['/LEARN/KEYS', 'Keys'],
    ['/experiments/', 'Existing experiments'],
  ]) {
    await page.goto(path);
    await expect(page.locator('.migration-notice')).toBeVisible();
    await expect(page.locator('.breadcrumb strong')).toHaveText(label);
  }
});

for (const width of [375, 1440])
  for (const theme of ['light', 'dark']) {
    test(`static routes work at ${width}px in ${theme} without Python`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem('rsa-lab-theme', value), theme);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/api/**', (route) => route.abort());
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /Understand the keys/ })).toBeVisible();
      await page.getByRole('button', { name: 'hex', exact: true }).click();
      await expect(page.getByText('0xbb', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'base64', exact: true }).click();
      await expect(page.getByText('uw==', { exact: true })).toBeVisible();
      for (const route of routes) {
        await page.goto(route.path);
        await expect(page.locator('main')).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBeTruthy();
        if (
          ![
            '/learn/keys',
            '/learn/encrypt',
            '/learn/euclid',
            '/learn/example',
            '/experiments',
          ].includes(route.path)
        )
          await expect(page.getByText('PLANNED FEATURE', { exact: true })).toBeVisible();
      }
      await page.goto('/learn/example');
      await page.getByLabel('Your message integer').fill('123');
      await expect(page.locator('.recovered-toy strong')).toHaveText('123');
      await page.getByRole('button', { name: 'Show exponentiation' }).click();
      await expect(page.locator('tbody tr')).toHaveCount(5);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'A complete RSA example.' })).toBeVisible();
      await page.goto('/missing-page');
      await expect(page.getByRole('heading', { name: 'Page not found.' })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

test('navigation, theme persistence, focus trap and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Worked example', exact: true }).click();
  await expect(page).toHaveURL(/\/learn\/example$/);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'About this lab' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close orientation' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Continue exploring' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'About this lab' })).toBeFocused();
});

test('mobile navigation contains keyboard focus and restores it on close', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
  await toggle.focus();
  await page.keyboard.press('Enter');
  const close = page.getByRole('button', { name: 'Close navigation menu', exact: true });
  await expect(close).toBeFocused();
  await expect(page.locator('.main-shell')).toHaveAttribute('inert', '');
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'A quick orientation' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await expect(page.locator('.main-shell')).not.toHaveAttribute('inert');
  await page.keyboard.press('Enter');
  await close.click();
  await expect(toggle).toBeFocused();
});
