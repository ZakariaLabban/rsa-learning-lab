import { expect, test } from '@playwright/test';

test('key generation cancels without losing existing keys or accepting stale results', async ({
  page,
}) => {
  await page.goto('/learn/keys');
  await page.getByRole('button', { name: /1024.*bit/ }).click();
  await page.getByRole('button', { name: 'Generate key pair', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(1, { timeout: 120000 });
  const original = await page.locator('.history-row .mono').first().textContent();
  await page.getByRole('button', { name: /2048.*bit/ }).click();
  await page.getByRole('button', { name: 'New key pair', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel key generation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New key pair', exact: true })).toBeEnabled();
  await expect(page.locator('.history-row')).toHaveCount(1);
  await expect(page.locator('.history-row .mono').first()).toHaveText(original!);
  await page.getByRole('link', { name: 'Encrypt / Decrypt', exact: true }).click();
  await page.getByLabel('Message to encrypt').fill('Retained after cancel');
  await page.getByRole('button', { name: 'Encrypt message', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copy envelope' })).toBeVisible();
  await page.getByRole('button', { name: 'Decrypt', exact: true }).click();
  await expect(page.locator('.recovered-message')).toHaveText('Retained after cancel');
});

for (const bits of [1024, 2048])
  test(`browser-only ${bits}-bit round trip, reveal, experiment and refresh`, async ({ page }) => {
    test.setTimeout(120000);
    const apiRequests: string[] = [],
      errors: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.startsWith('/api')) apiRequests.push(r.url());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/api/**', (route) => route.abort());
    await page.goto('/learn/keys');
    await page.getByRole('button', { name: new RegExp(`${bits}.*bit`) }).click();
    let beats = 0;
    page.on('console', (message) => {
      if (message.text() === 'UI heartbeat') beats++;
    });
    await page.evaluate(() => {
      const timer = setInterval(() => console.log('UI heartbeat'), 25);
      (window as unknown as { qaTimer: number }).qaTimer = timer;
    });
    await page.getByRole('button', { name: 'Generate key pair', exact: true }).click();
    await expect(page.locator('.history-row')).toHaveCount(1, { timeout: 120000 });
    await page.evaluate(() => clearInterval((window as unknown as { qaTimer: number }).qaTimer));
    expect(beats).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Reveal', exact: true }).click();
    await expect(page.locator('.private-panel .value-field')).toHaveCount(5);
    await page.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(page.locator('.private-panel .value-field')).toHaveCount(0);
    await page.getByRole('link', { name: 'Encrypt / Decrypt', exact: true }).click();
    const message = `\u0000Hello مرحبا 🔐 ${bits}`;
    for (const mode of ['oaep', 'textbook']) {
      await page.getByLabel('Message to encrypt').fill(message);
      await page.getByLabel('Padding', { exact: true }).selectOption(mode);
      await page.getByRole('button', { name: 'Encrypt message', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Copy envelope' })).toBeVisible();
      await page.getByRole('button', { name: 'Decrypt', exact: true }).click();
      // DOM text omits a leading NUL; validate the actual controlled input and recovered UTF-8 through the engine tests too.
      await expect(page.locator('.recovered-message')).toContainText(`Hello مرحبا 🔐 ${bits}`);
      await expect(page.getByRole('alert')).toHaveCount(0);
    }
    await page.getByRole('link', { name: 'Existing experiments', exact: true }).click();
    await page.getByRole('button', { name: 'Run experiment', exact: true }).click();
    await expect(page.locator('.comparison-verdict').first()).toContainText(
      'Identical ciphertexts',
    );
    await expect(page.locator('.comparison-verdict').last()).toContainText('Different ciphertexts');
    await page.reload();
    await expect(
      page.getByText('Generate a key before running an experiment.', { exact: true }),
    ).toBeVisible();
    expect(apiRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
