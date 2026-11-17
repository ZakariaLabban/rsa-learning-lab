import { expect, test } from '@playwright/test';

test('tiny factoring reconstructs a private exponent, decrypts HI, and plots measured runs', async ({
  page,
}) => {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/break/factoring');
  await expect(page.getByLabel('Tiny modulus size', { exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: 'Let Eve factor the key' }).click();
  await expect(page.getByRole('status')).toHaveText('Recovered message: HI');
  await expect(page.getByText('Recovered d = e⁻¹ mod φ(n)', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Measured trial division time versus tiny RSA key size' }),
  ).toBeVisible();
  const table = page.getByRole('region', { name: 'Measured tiny-key trial-division runs' });
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Tiny modulus size', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Let Eve factor the key' }).click();
  await expect(page.getByRole('status')).toHaveText('Recovered message: HI');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(page.getByText('Rough extrapolation:', { exact: false })).toContainText(
    'this algorithm on this browser/hardware',
  );
  await page.getByRole('button', { name: 'Clear measurements' }).click();
  await expect(table).toHaveCount(0);
});

test('factoring cancellation terminates pending work and a new selection does not accept a stale result', async ({
  page,
}) => {
  let held = false;
  let release: (() => void) | undefined;
  let notify: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    notify = resolve;
  });
  await page.route(/\/assets\/worker-[^/]+\.js$/, async (route) => {
    if (held) {
      await route.continue();
      return;
    }
    held = true;
    await new Promise<void>((resolve) => {
      release = resolve;
      notify?.();
    });
    await route.abort();
  });
  await page.goto('/break/factoring');
  await page.getByLabel('Tiny modulus size', { exact: true }).selectOption('7');
  await page.getByRole('button', { name: 'Let Eve factor the key' }).click();
  await started;
  await page.getByRole('button', { name: 'Cancel factoring', exact: true }).click();
  release?.();
  await expect(page.getByRole('alert')).toContainText('Demonstration cancelled');
  await expect(page.getByRole('region', { name: 'Factoring outcome' })).toHaveCount(0);
  await page.getByLabel('Tiny modulus size', { exact: true }).selectOption('0');
  await page.getByRole('button', { name: 'Let Eve factor the key' }).click();
  await expect(page.getByRole('status')).toHaveText('Recovered message: HI');
});

test('factoring deadline is a responsive supported outcome, not a false completed measurement', async ({
  page,
}) => {
  // Controlled worker clock tests the actual budget branch without depending on CPU speed.
  await page.route(/\/assets\/worker-[^/]+\.js$/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        "Object.defineProperty(performance,'now',{value:(()=>{let t=0;return()=>t+=500})()});\n" +
        (await response.text()),
    });
  });
  await page.goto('/break/factoring');
  await page.getByLabel('Tiny modulus size', { exact: true }).selectOption('7');
  await page.getByLabel('Search budget', { exact: true }).selectOption('1000');
  await page.getByRole('button', { name: 'Let Eve factor the key' }).click();
  await expect(page.getByRole('status')).toContainText('Search timed out');
  await expect(page.getByRole('button', { name: 'Cancel factoring', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Let Eve factor the key' })).toBeEnabled();
  await expect(
    page.getByRole('region', { name: 'Measured tiny-key trial-division runs' }).locator('tbody tr'),
  ).toContainText('timeout');
  await expect(page.getByRole('heading', { name: 'Eve recovered the private key' })).toHaveCount(0);
});

test('YES/NO textbook votes are recovered while OAEP samples decrypt and expose real sender-only traces', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/break/yes-or-no');
  for (const [bits, vote] of [
    ['1024', 'YES'],
    ['2048', 'NO'],
  ]) {
    await page.getByLabel('Guessing demonstration key size', { exact: true }).selectOption(bits);
    await page.getByLabel('Alice’s vote', { exact: true }).selectOption(vote);
    await page.getByRole('button', { name: 'Run guessing attack', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Textbook guessing comparison' }).getByRole('status'),
    ).toHaveText(`Eve recovered the textbook vote: ${vote}`);
    await expect(page.getByRole('region', { name: 'OAEP guessing comparison' })).toContainText(
      `All three decrypt back to ${vote}`,
    );
    await expect(page.getByText('Fresh random seed', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Reveal demonstration randomness' }).click();
    await expect(page.getByText('Fresh random seed', { exact: true })).toBeVisible();
    const seed = await page
      .getByText('Fresh random seed', { exact: true })
      .locator('..')
      .locator('..')
      .locator('.number')
      .textContent();
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
    await page.getByRole('button', { name: 'Repeat with fresh OAEP randomness' }).click();
    await expect(
      page.getByRole('button', { name: 'Reveal demonstration randomness' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Reveal demonstration randomness' }).click();
    const nextSeed = await page
      .getByText('Fresh random seed', { exact: true })
      .locator('..')
      .locator('..')
      .locator('.number')
      .textContent();
    expect(nextSeed).not.toBe(seed);
  }
  // The demonstration did not save votes, seeds or traces through app storage.
  expect(
    await page.evaluate(() => Object.values(localStorage).join(' ').includes('maskedSeed')),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test('broadcast recovers the guided message via CRT, while OAEP recipients still decrypt', async ({
  page,
}) => {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/break/small-e');
  const message = await page
    .getByLabel('Common message (1–61 UTF-8 bytes)', { exact: true })
    .inputValue();
  await page.getByRole('button', { name: 'Run broadcast demonstration', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(`Eve recovered the common message: ${message}`);
  await expect(
    page
      .getByRole('region', { name: 'Public CRT reconstruction for three ciphertexts' })
      .locator('tbody tr'),
  ).toHaveCount(3);
  await page.getByLabel('Broadcast padding', { exact: true }).selectOption('oaep');
  await page.getByRole('button', { name: 'Run broadcast demonstration', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(
    'This cube-root procedure did not recover the original common message.',
  );
  await expect(page.getByText('Alice confirms that all three', { exact: false })).toBeVisible();
  await expect(
    page.getByText('OAEP uses independently randomized encoded blocks.', { exact: false }),
  ).toBeVisible();
});

test('broadcast explains failed assumptions and rejects oversized UTF-8 input', async ({
  page,
}) => {
  await page.goto('/break/small-e');
  for (const [scenario, expected] of [
    ['shared-factor', 'share a factor'],
    ['large-exponent', 'e=65537 stops this particular procedure'],
    ['different-messages', 'did not recover the original'],
  ]) {
    await page.getByLabel('Broadcast assumptions', { exact: true }).selectOption(scenario);
    await page.getByRole('button', { name: 'Run broadcast demonstration', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(expected);
  }
  await page.getByLabel('Broadcast assumptions', { exact: true }).selectOption('out-of-range');
  await page.getByRole('button', { name: 'Run broadcast demonstration', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('M must satisfy');
  await page.getByRole('button', { name: 'Load guided example' }).click();
  await page.getByLabel('Common message (1–61 UTF-8 bytes)', { exact: true }).fill('🔐'.repeat(20));
  await page.getByRole('button', { name: 'Run broadcast demonstration', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('61 UTF-8 bytes');
});

for (const theme of ['light', 'dark'])
  test(`attack lessons fit a phone and support keyboard controls in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.addInitScript((value) => localStorage.setItem('rsa-lab-theme', value), theme);
    for (const [path, button] of [
      ['/break/factoring', 'Let Eve factor the key'],
      ['/break/yes-or-no', 'Run guessing attack'],
      ['/break/small-e', 'Run broadcast demonstration'],
    ]) {
      await page.goto(path);
      await page.getByRole('button', { name: button, exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(
        page.locator('.attack-lessons .attack-answer[role="status"]').first(),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      await expect(page.getByRole('alert')).toHaveCount(0);
    }
  });
