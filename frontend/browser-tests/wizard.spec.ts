import { expect, test } from '@playwright/test';

test('wizard: lecture example gives PU = {7, 187} and PR = {23, 187}, then saves', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/learn/keys');
  const wizard = page.locator('.wizard-panel');
  await page.getByRole('button', { name: 'Load lecture example (p=17, q=11, e=7)' }).click();
  await expect(wizard.locator('.key-pair-value').first()).toHaveText('PU = {7, 187}');
  await expect(wizard.locator('.key-pair-value').last()).toHaveText('PR = {•••, 187}');
  await page.getByRole('button', { name: 'Reveal private key' }).click();
  await expect(wizard.locator('.key-pair-value').last()).toHaveText('PR = {23, 187}');
  await expect(wizard.locator('.wizard-check')).toContainText('check: e × d mod φ(n) = 1');
  await expect(wizard.locator('.euclid-hit td').last()).toHaveText('23');

  await page.getByLabel('Name', { exact: true }).fill('Lecture copy');
  await page.getByRole('button', { name: 'Save to my keyring' }).click();
  await expect(page.getByText('Saved “Lecture copy” to your keyring.')).toBeVisible();
  await expect(page.locator('.keyring-panel strong', { hasText: 'Lecture copy' })).toBeVisible();
  await page.getByRole('link', { name: 'Encrypt a message with it →' }).click();
  await expect(page.getByLabel('To', { exact: true })).toHaveValue(/.+/);
  await expect(page.locator('.recipient-picker select option:checked')).toContainText(
    'Lecture copy',
  );
  expect(errors).toEqual([]);
});

test('wizard explains bad primes and a bad e', async ({ page }) => {
  await page.goto('/learn/keys');
  await page.getByText('Type my own p and q').click();
  await page.getByLabel('p', { exact: true }).fill('15');
  await expect(page.getByText('p = 15 is not prime: 15 = 3 × 5.')).toBeVisible();
  await page.getByLabel('p', { exact: true }).fill('17');
  await page.getByLabel('e (public exponent)').fill('5');
  await expect(page.getByText('gcd(e, φ(n)) = gcd(5, 160) = 5')).toBeVisible();
  await page.locator('.e-suggestions').getByRole('button', { name: '3', exact: true }).click();
  await expect(page.locator('.wizard-panel .key-pair-value').first()).toHaveText('PU = {3, 187}');
});

test('wizard generates teaching and 1024-bit keys in the worker', async ({ page }) => {
  test.setTimeout(150000);
  await page.goto('/learn/keys');
  await page.getByRole('radio', { name: /16 bits/ }).check();
  await page.getByRole('button', { name: 'Generate p and q' }).click();
  await expect(page.getByText('n (16 bits)')).toBeVisible();
  await page.getByText('How were p and q generated?').click();
  await expect(page.getByText(/This search tried \d+ candidates in total/)).toBeVisible();

  await page.getByRole('radio', { name: /1024 bits/ }).check();
  await page.getByRole('button', { name: 'Generate p and q' }).click();
  await expect(page.getByText('n (1024 bits)')).toBeVisible({ timeout: 120000 });
  await expect(page.getByText('Real keys use the standard e = 65537')).toBeVisible();
  await expect(page.locator('.wizard-check')).toContainText('check: e × d mod φ(n) = 1');
});

test('Extended Euclid page: URL parameters, inverse and no-inverse', async ({ page }) => {
  await page.goto('/learn/euclid?a=7&m=160');
  await expect(page.locator('.euclid-answer')).toContainText('7⁻¹ mod 160 = 23');
  await expect(page.locator('.euclid-answer')).toContainText('Check: 7 × 23 mod 160 = 1');
  await page.getByLabel('a (the number to invert)').fill('6');
  await page.getByLabel('m (the modulus)').fill('9');
  await expect(page.getByText('No inverse (gcd = 3)')).toBeVisible();
  await expect(page).toHaveURL(/a=6&m=9/);
  await page.getByLabel('m (the modulus)').fill('1');
  await expect(page.getByRole('alert')).toHaveText('m must be greater than 1.');
});
