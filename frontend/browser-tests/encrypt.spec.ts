import { expect, test, type Page } from '@playwright/test';

const toyPair = JSON.stringify({
  format: 'rsa-lab-keypair-v2',
  name: 'Toy pair',
  n: '3233',
  e: '17',
  p: '61',
  q: '53',
  d: '2753',
});
const toyPublic = JSON.stringify({
  format: 'rsa-lab-public-v2',
  name: 'Toy pair',
  n: '3233',
  e: '17',
});

async function envelopeText(page: Page) {
  await page.getByRole('button', { name: /^Show step \d+: The envelope travels$/ }).click();
  return (await page.locator('.step-detail .value-field .number').first().textContent())!.trim();
}

test('lecture example: 88 -> 11 -> 88 with the lecture key', async ({ page }) => {
  await page.goto('/learn/encrypt');
  await page.getByRole('button', { name: 'Load lecture example (M = 88, key 187)' }).click();
  await expect(page.getByLabel('Message number (M)')).toHaveValue('88');
  await page.getByRole('button', { name: 'Encrypt message', exact: true }).click();
  await expect(page.locator('.share-box')).toContainText('C = 11');
  await page.getByRole('button', { name: 'Decrypt', exact: true }).click();
  await expect(page.locator('.recovered-message')).toHaveText('88');
  await expect(page.locator('.step-detail')).toContainText('11^d mod 187 = 88');
});

test('Alice receives Arabic and emoji text in OAEP and textbook mode', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/learn/encrypt');
  await expect(page.getByLabel('To', { exact: true })).toHaveValue('demo-alice');
  for (const mode of ['oaep', 'textbook']) {
    const message = `مرحبا Alice 🔐 ${mode}`;
    await page.getByLabel('Message to encrypt').fill(message);
    await page.getByLabel('Padding', { exact: true }).selectOption(mode);
    await page.getByRole('button', { name: 'Encrypt message', exact: true }).click();
    await page.getByRole('button', { name: 'Decrypt', exact: true }).click();
    await expect(page.locator('.recovered-message')).toHaveText(message);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('an envelope decrypts in another browser that holds the key', async ({ browser }) => {
  // Browser B owns the key pair; browser A only has the public key.
  const owner = await (await browser.newContext()).newPage();
  await owner.goto('/learn/keys');
  await owner.getByText('Paste key text instead').click();
  await owner.getByLabel('Paste the contents of a .pub file (or a key-pair file)').fill(toyPair);
  await owner.getByRole('button', { name: 'Import pasted key' }).click();
  await expect(owner.locator('.keyring-panel strong', { hasText: 'Toy pair' })).toBeVisible();

  const sender = await (await browser.newContext()).newPage();
  await sender.goto('/learn/encrypt');
  await sender.getByLabel('To', { exact: true }).selectOption({ label: 'Paste a public key…' });
  await sender.getByLabel('Public key to encrypt for').fill(toyPublic);
  await sender.getByRole('button', { name: 'Use this key' }).click();
  await sender.getByLabel('Message to encrypt').fill('Meet at 5 · مرحبا');
  await sender.getByRole('button', { name: 'Encrypt message', exact: true }).click();
  await sender.getByRole('button', { name: 'Decrypt', exact: true }).click();
  await expect(sender.locator('.encrypt-notice')).toContainText('Only Toy pair can decrypt this');
  const envelope = await envelopeText(sender);
  expect(envelope).toMatch(/^rsa-lab\.v2:/);

  await owner.getByRole('link', { name: 'Encrypt / Decrypt', exact: true }).click();
  await owner.getByRole('tab', { name: 'Decrypt a received envelope' }).click();
  await owner.getByLabel('Envelope to decrypt').fill(envelope);
  await owner.getByRole('button', { name: 'Decrypt envelope' }).click();
  await expect(owner.locator('.recovered-message')).toHaveText('Meet at 5 · مرحبا');
  await expect(owner.locator('.recovered-box')).toContainText('TOY PAIR’S PRIVATE KEY');

  // A browser without the key gets a clear explanation.
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto('/learn/encrypt');
  await stranger.getByRole('tab', { name: 'Decrypt a received envelope' }).click();
  await stranger.getByLabel('Envelope to decrypt').fill(envelope);
  await stranger.getByRole('button', { name: 'Decrypt envelope' }).click();
  await expect(stranger.getByRole('alert')).toContainText('None of your private keys matches');
});

test('the journey fits a 375px screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/learn/encrypt');
  await page.getByRole('button', { name: 'Encrypt message', exact: true }).click();
  await page.getByRole('button', { name: 'Decrypt', exact: true }).click();
  await expect(page.locator('.recovered-message')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
