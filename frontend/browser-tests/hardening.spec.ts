import { disableLessonGuides } from './helpers/lessonGuides';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => disableLessonGuides(context));

// These regression checks inspect the page behind the optional onboarding dialog.

test.describe('unknown addresses', () => {
  test('an unknown lesson shows a 404 page with a way back, and is marked noindex', async ({
    page,
  }) => {
    await page.goto('/lecture/not-a-lesson');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page).toHaveTitle('Page not found · RSA Lab');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await page.getByRole('link', { name: 'Back to the course map' }).click();
    await expect(page).toHaveURL(/\/lecture$/);
    await expect(
      page.getByRole('heading', { name: 'Learn RSA, one step at a time' }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test('the 404 page can start the course', async ({ page }) => {
    await page.goto('/lecture/nope/nope');
    await page.getByRole('link', { name: 'Start with lesson 1' }).click();
    await expect(page).toHaveURL(/\/lecture\/start$/);
  });

  test('retired interfaces return to the course map and unknown public addresses show 404', async ({
    page,
  }) => {
    await page.goto('/playground/nope');
    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('heading', { name: 'Learn RSA, one step at a time' }),
    ).toBeVisible();
    await page.goto('/nope');
    await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
  });
});

test.describe('error page', () => {
  test('a page file that fails to load shows a clear message and recovers on reload', async ({
    page,
  }) => {
    let blocked = true;
    await page.route('**/assets/LectureShell-*.js', (route) =>
      blocked ? route.abort() : route.continue(),
    );
    await page.goto('/lecture/gcd');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('This page could not be loaded');
    await expect(alert).toContainText('Reloading usually fixes it');
    await expect(page.getByRole('link', { name: 'Go to the start' })).toHaveAttribute('href', '/');
    await page.getByText('Technical details').click();
    await expect(page.locator('.error-page pre')).toContainText('Error');
    // The file is available again: Reload brings the lesson back.
    blocked = false;
    await page.getByRole('button', { name: 'Reload the page' }).click();
    await expect(page.getByRole('heading', { name: 'Greatest common divisor' })).toBeVisible();
  });
});

test.describe('titles, descriptions and sharing', () => {
  test('each lesson has its own title and description', async ({ page }) => {
    await page.goto('/lecture/gcd');
    await expect(page).toHaveTitle('Greatest common divisor · RSA Lab');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Divide and keep the remainder until it is 0.',
    );
    await page.getByRole('link', { name: /Next lesson/ }).click();
    await expect(page).toHaveTitle('Inverse mod m · RSA Lab');
    await page.goto('/lecture');
    await expect(page).toHaveTitle('RSA Lab · Learn RSA step by step');
  });

  test('the page head has a description, icons and link-preview tags', async ({ page }) => {
    await page.goto('/');
    const head = page.locator('head');
    await expect(head.locator('meta[name="description"]')).toHaveAttribute('content', /RSA/);
    await expect(head.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
    await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      '/apple-touch-icon.png',
    );
    await expect(head.locator('meta[property="og:title"]')).toHaveAttribute('content', /RSA Lab/);
    await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /og-image\.png$/,
    );
    await expect(head.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    // No address is invented before the domain is chosen (#41).
    await expect(head.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(head.locator('meta[property="og:url"]')).toHaveCount(0);
  });

  test('the icons, the share image and robots.txt are served', async ({ request }) => {
    const favicon = await request.get('/favicon.svg');
    expect(favicon.ok()).toBe(true);
    expect(favicon.headers()['content-type']).toContain('svg');
    const share = await request.get('/og-image.png');
    expect(share.ok()).toBe(true);
    const bytes = await share.body();
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
    const touch = await request.get('/apple-touch-icon.png');
    expect(touch.ok()).toBe(true);
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
  });
});

test.describe('per-page canonical links (when the build has a public address)', () => {
  test('each page points at itself, and a missing page has none', async ({ page }) => {
    await page.goto('/');
    // The build sets this tag when SITE_URL is given; here it is added the same way.
    await page.evaluate(() => {
      const tag = document.createElement('meta');
      tag.name = 'site-origin';
      tag.content = 'https://rsa-lab.example';
      document.head.append(tag);
    });
    const canonical = page.locator('link[rel="canonical"]');
    await page.goto('/lecture/gcd');
    // A full load drops the injected tag, so add it again and move between pages inside the app.
    await page.evaluate(() => {
      const tag = document.createElement('meta');
      tag.name = 'site-origin';
      tag.content = 'https://rsa-lab.example';
      document.head.append(tag);
    });
    await page.getByRole('link', { name: /Next lesson/ }).click();
    await expect(canonical).toHaveAttribute('href', 'https://rsa-lab.example/lecture/inverse');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      'https://rsa-lab.example/lecture/inverse',
    );
    await page.getByRole('link', { name: /Previous/ }).click();
    await expect(canonical).toHaveAttribute('href', 'https://rsa-lab.example/lecture/gcd');
    await page.getByRole('link', { name: 'RSA Lab', exact: true }).click();
    await expect(canonical).toHaveAttribute('href', 'https://rsa-lab.example/');
  });
});

test.describe('leaving a page leaves nothing behind', () => {
  test('leaving an unknown lesson for Account clears its noindex metadata', async ({ page }) => {
    await page.goto('/lecture/not-a-lesson');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await page.getByRole('link', { name: 'Account', exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /RSA/);
  });
});
