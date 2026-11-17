import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { preview, type PreviewServer } from 'vite';

/*
 * #50: after one online visit the guest app reloads and works offline.
 * `context.setOffline` blocks page requests before the service worker sees them,
 * which real browsers do not do, so these tests run their own preview server and
 * shut it down to make the site genuinely unreachable.
 */

test.use({ serviceWorkers: 'allow' });

const DIST = resolve('dist');
const PORT = 4183;
const ORIGIN = `http://127.0.0.1:${PORT}`;

async function startServer(outDir = DIST) {
  return preview({
    root: resolve('.'),
    logLevel: 'silent',
    build: { outDir },
    preview: { host: '127.0.0.1', port: PORT, strictPort: true },
  });
}
let server: PreviewServer | undefined;
const temporary: string[] = [];
test.afterEach(async () => {
  await server?.close();
  server = undefined;
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Copy of the build as a new deploy: its service worker reports a different version
 * and its index.html carries a marker, so a test can tell which build a page runs.
 */
function buildWithNewVersion(version: string) {
  const dir = mkdtempSync(join(tmpdir(), 'rsa-lab-sw-'));
  temporary.push(dir);
  cpSync(DIST, dir, { recursive: true });
  const script = readFileSync(join(dir, 'sw.js'), 'utf8');
  const versions = script.match(/"[0-9a-f]{16}"/g) ?? [];
  expect(versions).toHaveLength(1);
  writeFileSync(join(dir, 'sw.js'), script.replace(versions[0], `"${version}"`));
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  expect(html).toContain('<head>');
  writeFileSync(
    join(dir, 'index.html'),
    html.replace('<head>', '<head><meta name="rsa-lab-build" content="next" />'),
  );
  return dir;
}
const newBuildMarkers = (page: Page) => page.locator('meta[name="rsa-lab-build"]').count();

/**
 * Waits until the page is controlled and the active version's cache holds every
 * file listed in the served sw.js. (`expect.poll` awaits the async check each time;
 * `page.waitForFunction` would treat the returned promise itself as truthy.)
 */
async function waitForOfflineInstall(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration?.active?.state !== 'activated' || !navigator.serviceWorker.controller)
            return 'not controlled yet';
          const script = await (
            await fetch(registration.active.scriptURL, { cache: 'no-store' })
          ).text();
          const list = script.match(/\[(?:"\/[^"]*",?)+\]/);
          const version = script.match(/"([0-9a-f]{16})"/);
          if (!list || !version) return 'sw.js has no file list';
          const cache = await caches.open(`rsa-lab-shell-${version[1]}`);
          const expected = (JSON.parse(list[0]) as string[]).length;
          return (await cache.keys()).length === expected ? 'ready' : 'caching';
        }),
      { timeout: 20000 },
    )
    .toBe('ready');
}

const shellCaches = (page: Page) =>
  page.evaluate(async () =>
    (await caches.keys()).filter((key) => key.startsWith('rsa-lab-shell-')),
  );

test('after the first visit, deep links reload offline and keygen/encrypt/decrypt still work', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  server = await startServer();
  await page.goto(`${ORIGIN}/`);
  await waitForOfflineInstall(page);
  expect(await shellCaches(page)).toHaveLength(1);

  await server.close();
  server = undefined;
  expect(
    await page.evaluate(() =>
      fetch('/sw.js', { cache: 'no-store' }).then(
        () => 'reachable',
        () => 'unreachable',
      ),
    ),
  ).toBe('unreachable');
  for (const [path, heading] of [
    ['/playground/learn/crt', 'One number, several residues'],
    ['/playground/break/factoring', 'Measure the tiny cases'],
    ['/learn/why-rsa-works', 'Prove it with your numbers'],
  ]) {
    await page.goto(`${ORIGIN}${path}`);
    await expect(page.getByRole('heading', { name: heading }), path).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Prove it with your numbers' })).toBeVisible();

  await page.goto(`${ORIGIN}/learn/keys`);
  await page.getByRole('button', { name: /1024.*bit/ }).click();
  await page.getByRole('button', { name: 'Generate key pair', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(1, { timeout: 90000 });
  await page.getByRole('link', { name: 'Encrypt / Decrypt', exact: true }).click();
  await page.getByLabel('Message to encrypt').fill('Offline message');
  await page.getByLabel('Padding', { exact: true }).selectOption('oaep');
  await page.getByRole('button', { name: 'Encrypt message', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copy envelope' })).toBeVisible();
  await page.getByRole('button', { name: 'Decrypt', exact: true }).click();
  await expect(page.locator('.recovered-message')).toHaveText('Offline message');

  // The browser's own offline signal shows the notice, and it clears when back online.
  await context.setOffline(true);
  await expect(page.getByText('You are offline. RSA Lab is saved in this browser')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('You are offline.')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a new version waits for the user, then replaces the old cache without user data', async ({
  page,
}) => {
  server = await startServer();
  await page.goto(`${ORIGIN}/playground`);
  await waitForOfflineInstall(page);
  const [oldCache] = await shellCaches(page);

  // Deploy a new version: same origin, different service worker version.
  await server.close();
  server = await startServer(buildWithNewVersion('00000000feedbeef'));
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
  const notice = page.getByText('A new version of RSA Lab is ready.');
  await expect(notice).toBeVisible();
  // Nothing changes until the user agrees: the old version still controls the page.
  expect(await shellCaches(page)).toContain(oldCache);
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistration())!.waiting?.state,
    ),
  ).toBe('installed');

  // Online reloads and new routes keep running the old build from the old cache,
  // so the page never mixes builds and the old version stays fully offline-ready.
  await page.reload();
  expect(await newBuildMarkers(page)).toBe(0);
  await page.goto(`${ORIGIN}/playground/learn/signatures`);
  await expect(page.getByRole('heading', { name: 'Why hash first?' })).toBeVisible();
  expect(await newBuildMarkers(page)).toBe(0);
  await expect(notice).toBeVisible();

  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Reload now', exact: true }).click(),
  ]);
  await waitForOfflineInstall(page);
  await expect(notice).toHaveCount(0);
  expect(await newBuildMarkers(page)).toBe(1);
  expect(await shellCaches(page)).toEqual(['rsa-lab-shell-00000000feedbeef']);
  const cached = await page.evaluate(async () => {
    const cache = await caches.open('rsa-lab-shell-00000000feedbeef');
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  expect(cached).toContain('/index.html');
  for (const path of cached)
    expect(path === '/index.html' || path.startsWith('/assets/'), path).toBe(true);
});
