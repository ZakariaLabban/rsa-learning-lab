import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const references = JSON.parse(
  readFileSync(
    new URL('../src/engine/__vectors__/reference-vectors.json', import.meta.url),
    'utf8',
  ),
);
const ref = references.keys[0];
const publicFile = JSON.stringify({ format: 'rsa-lab-public-v2', n: ref.n, e: ref.e });
// Toy teaching key pair (p=61, q=53, e=17, d=2753) as a key-pair file.
const pairFile = JSON.stringify({
  format: 'rsa-lab-keypair-v2',
  name: 'Toy pair',
  n: '3233',
  e: '17',
  p: '61',
  q: '53',
  d: '2753',
});

async function paste(page: import('@playwright/test').Page, text: string) {
  const details = page.locator('.keyring-paste');
  if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open)))
    await page.getByText('Paste key text instead').click();
  await page.getByLabel('Paste the contents of a .pub file (or a key-pair file)').fill(text);
  await page.getByRole('button', { name: 'Import pasted key' }).click();
}

test('keyring: built-ins, import, verify, persistence rules, use in lab, clear', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/learn/keys');
  const keyring = page.locator('.keyring-panel');
  await expect(keyring.getByRole('heading', { name: 'My keyring' })).toBeVisible();
  for (const name of ['Alice', 'Bob', 'Lecture key (p=17, q=11)'])
    await expect(keyring.locator('strong', { hasText: name })).toBeVisible();

  await paste(page, publicFile);
  await expect(
    page.getByRole('status').filter({ hasText: 'Added "Contact 1" to Contacts.' }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Mark as verified Contact 1' }).click();
  await expect(keyring.locator('li', { hasText: 'Contact 1' }).getByText('Verified')).toBeVisible();

  await paste(page, pairFile);
  await expect(keyring.locator('strong', { hasText: 'Toy pair' })).toBeVisible();
  await paste(
    page,
    '{"format":"rsa-lab-keypair-v2","n":"3233","e":"17","p":"61","q":"53","d":"5"}',
  );
  await expect(page.getByRole('alert')).toContainText('not the inverse of e');
  await page.getByRole('button', { name: 'Dismiss error' }).click();

  // Default: private keys are not saved, contacts are.
  await page.reload();
  await expect(keyring.locator('strong', { hasText: 'Contact 1' })).toBeVisible();
  await expect(keyring.locator('strong', { hasText: 'Toy pair' })).toHaveCount(0);

  // With the toggle on, my key pair survives a refresh.
  await page.getByLabel('Remember my private keys on this device').check();
  await expect(page.getByText('saved unencrypted in this browser')).toBeVisible();
  await paste(page, pairFile);
  await page.reload();
  await expect(keyring.locator('strong', { hasText: 'Toy pair' })).toBeVisible();
  await page.getByLabel('Remember my private keys on this device').uncheck();
  await page.reload();
  await expect(keyring.locator('strong', { hasText: 'Toy pair' })).toHaveCount(0);

  // A keyring key (demo Alice) can drive the existing Key Studio and Workbench.
  await page.getByRole('button', { name: 'Use Alice' }).click();
  await expect(page.getByText('"Alice" is now the active key.')).toBeVisible();
  await expect(page.locator('.history-row')).toHaveCount(1);
  await page.getByRole('link', { name: 'Encrypt / Decrypt', exact: true }).click();
  await page.getByLabel('Message to encrypt').fill('Hello from the keyring');
  await page.getByRole('button', { name: 'Encrypt message', exact: true }).click();
  await page.getByRole('button', { name: 'Decrypt', exact: true }).click();
  await expect(page.locator('.recovered-message')).toHaveText('Hello from the keyring');

  await page.getByRole('link', { name: 'Keys', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(keyring.locator('strong', { hasText: 'Contact 1' })).toHaveCount(0);
  await page.reload();
  await expect(keyring.locator('strong', { hasText: 'Contact 1' })).toHaveCount(0);
  await expect(keyring.locator('strong', { hasText: 'Alice' })).toBeVisible();
  expect(errors).toEqual([]);
});
