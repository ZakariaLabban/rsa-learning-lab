import { disableLessonGuides } from './helpers/lessonGuides';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => disableLessonGuides(context));

const authOrigin = 'https://rsa-lab-account-test.supabase.co';
const authStorageKey = 'sb-rsa-lab-account-test-auth-token';
const accountA = '11111111-1111-4111-8111-111111111111';
const accountB = '22222222-2222-4222-8222-222222222222';

test('clears guest progress across open tabs and preserves other browser preferences', async ({
  page,
  context,
}) => {
  await page.goto('/account');
  await page.evaluate(() => {
    localStorage.setItem(
      'rsa-lab-practice.v1',
      JSON.stringify({
        version: 1,
        attempts: 1,
        correct: 1,
        streak: 1,
        best: 1,
        seen: ['practice.v1:intro:632:modulus'],
        topics: { modulus: { attempts: 1, correct: 1 } },
      }),
    );
    localStorage.setItem('test-preference', 'keep');
  });
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByRole('link', { name: /^Account:/ })).toBeVisible();
  await expect(other.getByRole('link', { name: 'Privacy', exact: true })).toBeVisible();
  await other.goto('/lecture/practice');
  await expect(other.getByRole('heading', { name: /Practice with the lecture/ })).toBeVisible();
  expect(await other.evaluate(() => localStorage.getItem('rsa-lab-practice.v1'))).toContain(
    'attempts',
  );
  await expect(other.getByRole('link', { name: 'Privacy', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Clear local data...' }).click();
  const confirm = page.getByRole('button', { name: 'Permanently clear local data' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Type CLEAR to confirm:').fill('CLEAR');
  await Promise.all([other.waitForEvent('load'), confirm.click()]);
  await expect(page.getByRole('status').filter({ hasText: 'have been cleared' })).toBeVisible();
  await expect(other.getByRole('heading', { name: /Practice with the lecture/ })).toBeVisible();
  expect(await other.evaluate(() => localStorage.getItem('rsa-lab-practice.v1'))).toBeNull();
  expect(await other.evaluate(() => localStorage.getItem('test-preference'))).toBe('keep');
});

test.describe('mocked Supabase account flow', () => {
  test.skip(process.env.RSA_MOCK_AUTH !== '1', 'Requires the documented fake Supabase build.');

  test('isolates account changes and only deletes after explicit confirmation', async ({
    page,
    context,
  }) => {
    const writes: string[] = [];
    let failDelete = true;
    await context.route(`${authOrigin}/**`, async (route) => {
      const { pathname } = new URL(route.request().url());
      if (route.request().method() !== 'GET') writes.push(pathname);
      if (pathname === '/auth/v1/otp' || pathname === '/auth/v1/logout') {
        await route.fulfill({ status: 200, json: {} });
      } else if (pathname === '/rest/v1/rpc/delete_my_data') {
        expect(route.request().headers().authorization).toBe('Bearer token-b');
        if (failDelete) {
          await route.fulfill({ status: 403, json: { message: 'Deletion denied' } });
        } else {
          await route.fulfill({ status: 204 });
        }
      } else {
        await route.fulfill({
          json: [{ sync_enabled: failDelete, data_deleted_at: failDelete ? null : '2026-01-01' }],
        });
      }
    });

    await page.goto('/account');
    await expect(page.getByLabel('Email address')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByLabel('Email address').fill('a@example.test');
    await page.getByRole('button', { name: 'Send magic link' }).click();
    await expect(page.getByText('Check your email for a sign-in link.')).toBeVisible();
    expect(writes.splice(0)).toEqual(['/auth/v1/otp']);
    async function sessionFor(id: string, name: string) {
      await page.evaluate(
        ({ authStorageKey, id, name, accountA }) => {
          const session = {
            access_token: `token-${name}`,
            refresh_token: `refresh-${name}`,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id, email: `${name}@example.test` },
          };
          localStorage.setItem(authStorageKey, JSON.stringify(session));
          if (id === accountA) {
            localStorage.setItem(`rsa-lab.account.v1.${id}.contacts`, 'old account cache');
            localStorage.setItem('rsa-lab-practice.v1', '{}');
          }
          const channel = new BroadcastChannel(authStorageKey);
          channel.postMessage({ event: 'SIGNED_IN', session });
          channel.close();
        },
        { authStorageKey, id, name, accountA },
      );
    }

    await sessionFor(accountA, 'a');
    await expect(page.getByText('a@example.test')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('radio', { name: /Review this public data/ }).check();
    await expect(page.getByText(/separate confirmation/)).toBeVisible();
    await page.getByRole('button', { name: 'Delete my cloud data...' }).click();
    await page.getByLabel('Type DELETE to confirm:').fill('DELETE');

    await sessionFor(accountB, 'b');
    await expect(page.getByText('b@example.test')).toBeVisible();
    await expect(page.getByText('a@example.test')).toHaveCount(0);
    await expect(page.getByLabel('Type DELETE to confirm:')).toHaveCount(0);
    await expect(page.getByRole('radio', { name: /Keep my guest data/ })).toBeChecked();
    expect(writes).toEqual([]);
    expect(
      await page.evaluate(
        (id) => localStorage.getItem(`rsa-lab.account.v1.${id}.contacts`),
        accountA,
      ),
    ).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('rsa-lab-practice.v1'))).toBe('{}');

    const other = await context.newPage();
    await other.goto('/account');
    await expect(other.getByText('b@example.test')).toBeVisible();
    await expect(other.getByText(/Your account is ready/)).toBeVisible();

    await page.getByRole('button', { name: 'Delete my cloud data...' }).click();
    await page.getByLabel('Type DELETE to confirm:').fill('DELETE');
    const remove = page.getByRole('button', { name: 'Permanently delete cloud data' });
    await remove.click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Could not delete cloud data.' }),
    ).toBeVisible();
    await expect(page.getByText(/cloud application data has been deleted/)).toHaveCount(0);
    failDelete = false;
    await remove.click();
    await expect(page.getByText(/cloud application data has been deleted/)).toBeVisible();
    await expect(
      page.getByText(/Cloud synchronization is disabled for this account/),
    ).toBeVisible();
    expect(writes).toEqual(['/rest/v1/rpc/delete_my_data', '/rest/v1/rpc/delete_my_data']);
    await expect(
      other.getByText(/Cloud synchronization is disabled for this account/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out of this browser' }).click();
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Send magic link' })).toBeVisible();
  });

  test('waits for account recovery and honors an explicit guest choice', async ({ page }) => {
    await page.addInitScript(
      ({ authStorageKey, accountA }) => {
        localStorage.setItem(
          authStorageKey,
          JSON.stringify({
            access_token: 'expired-token',
            refresh_token: 'refresh-token',
            expires_at: 1,
            user: { id: accountA, email: 'a@example.test' },
          }),
        );
      },
      { authStorageKey, accountA },
    );
    let finishRefresh!: () => void;
    const deferred = new Promise<void>((resolve) => {
      finishRefresh = resolve;
    });
    await page.route(`${authOrigin}/auth/v1/token?grant_type=refresh_token`, async (route) => {
      await deferred;
      await route.fulfill({
        json: {
          access_token: 'refreshed-token',
          refresh_token: 'rotated-refresh-token',
          expires_in: 3600,
          user: { id: accountA, email: 'a@example.test' },
        },
      });
    });
    await page.route(`${authOrigin}/rest/v1/profiles?**`, (route) =>
      route.fulfill({ json: [{ sync_enabled: true, data_deleted_at: null }] }),
    );
    await page.goto('/lecture/practice', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('status').filter({ hasText: 'Checking your session' }),
    ).toBeVisible();
    await expect(page.getByLabel('Your answer')).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue as guest' }).click();
    await expect(page.getByLabel('Your answer').first()).toBeVisible();
    finishRefresh();
    await expect(
      page.getByRole('link', { name: 'Account: guest mode is active', exact: true }),
    ).toContainText('Guest mode');
    await page.getByRole('link', { name: /^Account:/ }).click();
    await expect(page.getByText('Guest mode is active in this tab.')).toBeVisible();
    await expect(page.getByText('a@example.test')).toHaveCount(0);
    await page.getByRole('button', { name: 'Check account session' }).click();
    await expect(page.getByText('a@example.test')).toBeVisible();
  });

  test('only completes a PKCE callback on the account route after a browser-initiated request', async ({
    page,
    context,
  }) => {
    let redirectTo = '';
    let exchanges = 0;
    await page.route(`${authOrigin}/auth/v1/otp?**`, async (route) => {
      const request = route.request();
      redirectTo = new URL(request.url()).searchParams.get('redirect_to') ?? '';
      expect(request.postDataJSON().code_challenge).toBeTruthy();
      await route.fulfill({ json: {} });
    });
    await page.route(`${authOrigin}/auth/v1/token?grant_type=pkce`, async (route) => {
      exchanges++;
      expect(route.request().postDataJSON()).toMatchObject({
        auth_code: 'fixture-code',
        code_verifier: expect.any(String),
      });
      await route.fulfill({
        json: {
          access_token: 'refreshed-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          user: { id: accountA, email: 'a@example.test' },
        },
      });
    });
    await page.route(`${authOrigin}/rest/v1/profiles?**`, (route) =>
      route.fulfill({ json: [{ sync_enabled: true, data_deleted_at: null }] }),
    );

    await page.goto('/account?code=unsolicited');
    await expect(page.getByRole('alert')).toContainText('invalid or expired');
    expect(exchanges).toBe(0);
    await page.getByLabel('Email address').fill('a@example.test');
    await page.getByRole('button', { name: 'Send magic link' }).click();
    await expect(page.getByText('Check your email for a sign-in link.')).toBeVisible();

    const callback = new URL(redirectTo);
    expect(callback.pathname).toBe('/account');
    callback.searchParams.set('code', 'fixture-code');
    const wrongPath = new URL(callback);
    wrongPath.pathname = '/lecture';
    await page.goto(wrongPath.href);
    await expect(page.getByRole('link', { name: 'Privacy', exact: true })).toBeVisible();
    expect(exchanges).toBe(0);

    await page.goto(callback.href);
    await expect(page.getByText('a@example.test')).toBeVisible();
    expect(exchanges).toBe(1);
    expect(new URL(page.url()).searchParams.has('code')).toBe(false);
    // Returning to the lab must visibly retain the real authenticated session.
    await page.getByRole('link', { name: 'Continue to the lab' }).click();
    const signedIn = page.getByRole('link', {
      name: 'Account: signed in a@example.test',
      exact: true,
    });
    await expect(signedIn).toBeVisible();
    await expect(signedIn).toContainText('Signed in');
    await expect(signedIn).toContainText('a@example.test');
    await page.reload();
    await expect(signedIn).toBeVisible();
    const other = await context.newPage();
    await other.goto('/lecture/gcd');
    await expect(
      other.getByRole('link', { name: 'Account: signed in a@example.test', exact: true }),
    ).toBeVisible();
    await signedIn.click();
    await page.route(`${authOrigin}/auth/v1/logout**`, (route) =>
      route.fulfill({ status: 200, json: {} }),
    );
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out of this browser' }).click();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(other.getByRole('link', { name: 'Account: sign in', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Back to RSA Lab' }).click();
    await expect(page.getByRole('link', { name: 'Account: sign in', exact: true })).toBeVisible();
  });

  for (const theme of ['light', 'dark']) {
    test(`signed-in identity fits small screens in ${theme}`, async ({ page }) => {
      const email = 'a-very-long-student-account-name-for-the-header@example.test';
      await page.addInitScript(
        ({ authStorageKey, accountA, email, theme }) => {
          localStorage.setItem('rsa-lab-theme', theme);
          localStorage.setItem(
            authStorageKey,
            JSON.stringify({
              access_token: 'test-token',
              refresh_token: 'test-refresh',
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              user: { id: accountA, email },
            }),
          );
        },
        { authStorageKey, accountA, email, theme },
      );
      await page.goto('/');
      const link = page.getByRole('link', { name: `Account: signed in ${email}`, exact: true });
      for (const width of [320, 375, 1440]) {
        await page.setViewportSize({ width, height: 850 });
        await expect(link).toBeVisible();
        await expect(link).toContainText('Signed in');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        if (width === 1440) {
          await link.hover();
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        }
      }
    });
  }

  test('warns before sign-out can discard a temporary private key', async ({ page }) => {
    await page.addInitScript(
      ({ authStorageKey, accountA }) => {
        localStorage.setItem(
          authStorageKey,
          JSON.stringify({
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: accountA, email: 'a@example.test' },
          }),
        );
      },
      { authStorageKey, accountA },
    );
    await page.route(`${authOrigin}/**`, (route) =>
      route.fulfill({ json: [{ sync_enabled: true, data_deleted_at: null }] }),
    );
    await page.goto('/lecture/keys');
    await page.getByRole('button', { name: 'Save as one of my keys' }).click();
    await expect(page.getByText(/It is now your active key/)).toBeVisible();
    await page.getByRole('link', { name: /^Account:/ }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(
      'temporary private keys in this and other open tabs',
    );
    await page.getByRole('button', { name: 'Keep working' }).click();
    await expect(page.getByText('a@example.test')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  });

  test('links an account-deletion request to the configured administrator mailbox', async ({
    page,
  }) => {
    await page.goto('/privacy');
    await expect(
      page.getByRole('link', { name: 'Request account and email deletion' }),
    ).toHaveAttribute(
      'href',
      'mailto:privacy@example.test?subject=RSA%20Learning%20Lab%20account%20deletion',
    );
  });

  test('shows a recoverable error for an expired sign-in link', async ({ page }) => {
    await page.route(`${authOrigin}/**`, (route) => route.abort());
    await page.goto('/account#error_code=otp_expired&error_description=Link+expired');
    await expect(page.getByRole('alert')).toContainText('invalid or expired');
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeEnabled();
  });
});
test('a guest explicitly imports a shared public key and a revoked link stops resolving', async ({
  page,
}) => {
  test.skip(process.env.RSA_MOCK_AUTH !== '1', 'Requires mocked Supabase.');
  const slug = 'a'.repeat(48);
  const { createHash } = await import('node:crypto');
  const fingerprint = createHash('sha256')
    .update('rsa-lab.key.v2\0')
    .update(Buffer.from([0, 0, 0, 1, 187, 0, 0, 0, 1, 7]))
    .digest('hex');
  let revoked = false;
  await page.route(`${authOrigin}/rest/v1/rpc/get_shared_key`, (route) => {
    expect(route.request().postDataJSON()).toEqual({ share_slug: slug });
    expect(route.request().headers()['cache-control']).toBe('no-store');
    return route.fulfill({
      json: revoked ? [] : [{ name: 'Shared teaching key', n: '187', e: '7', fingerprint }],
    });
  });
  await page.goto('/k/' + slug);
  await expect(page.getByRole('heading', { name: 'Shared teaching key' })).toBeVisible();
  await expect(page.getByText(fingerprint, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add to contacts' }).click();
  await expect(page.getByRole('status')).toContainText('Contact added');
  revoked = true;
  await page.reload();
  await expect(page.getByRole('status')).toContainText('revoked');
  await page.getByRole('link', { name: 'Back to Contacts' }).click();
  await expect(page.getByText('Shared teaching key', { exact: true })).toBeVisible();
});
