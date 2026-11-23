import { expect, test } from '@playwright/test';

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
    localStorage.setItem('rsa-lab-practice.v1', '{}');
    localStorage.setItem('test-preference', 'keep');
  });
  const other = await context.newPage();
  await other.goto('/lecture');
  await expect(other.getByRole('link', { name: 'Privacy', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Clear local data...' }).click();
  const confirm = page.getByRole('button', { name: 'Permanently clear local data' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Type CLEAR to confirm:').fill('CLEAR');
  await Promise.all([other.waitForEvent('load'), confirm.click()]);
  await expect(page.getByRole('status').filter({ hasText: 'have been cleared' })).toBeVisible();
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
    const other = await context.newPage();
    await other.goto('/account');
    await expect(other.getByText('b@example.test')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Send magic link' })).toBeVisible();
  });

  test('shows a recoverable error for an expired sign-in link', async ({ page }) => {
    await page.route(`${authOrigin}/**`, (route) => route.abort());
    await page.goto('/account#error_code=otp_expired&error_description=Link+expired');
    await expect(page.getByRole('alert')).toContainText('invalid or expired');
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeEnabled();
  });
});
