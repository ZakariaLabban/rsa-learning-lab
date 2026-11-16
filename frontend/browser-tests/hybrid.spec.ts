import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const references = JSON.parse(
  readFileSync(
    new URL('../src/engine/__vectors__/reference-vectors.json', import.meta.url),
    'utf8',
  ),
);
const ref = references.keys[0];
const senderPair = JSON.stringify({
  format: 'rsa-lab-keypair-v2',
  name: 'Sami laptop',
  n: ref.n,
  e: ref.e,
  p: ref.p,
  q: ref.q,
  d: ref.d,
});
const senderPublic = JSON.stringify({
  format: 'rsa-lab-public-v2',
  name: 'Sami',
  n: ref.n,
  e: ref.e,
});

async function importKey(page: Page, text: string) {
  await page.goto('/learn/keys');
  await page.getByText('Paste key text instead').click();
  await page.getByLabel('Paste the contents of a .pub file (or a key-pair file)').fill(text);
  await page.getByRole('button', { name: 'Import pasted key' }).click();
}
async function envelopeText(page: Page) {
  await page.getByRole('button', { name: /^Show step \d+: The envelope travels$/ }).click();
  return (await page.locator('.step-detail .value-field .number').first().textContent())!.trim();
}

test('Bob signs, Alice decrypts a hybrid message and sees the valid signature', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/learn/encrypt');
  await page.getByLabel('Also sign as me').check();
  await expect(page.getByLabel('Sign as', { exact: true })).toHaveValue('demo-bob');
  await expect(page.getByLabel('Padding', { exact: true })).toHaveValue('hybrid');
  const message = 'Long signed note 🔐 ' + 'مرحبا '.repeat(60);
  await page.getByLabel('Message to encrypt').fill(message);
  await page.getByRole('button', { name: 'Encrypt message', exact: true }).click();
  await expect(page.getByRole('button', { name: /Show step 2: Bob signs/ })).toBeVisible();
  await page.getByRole('button', { name: 'Decrypt', exact: true }).click();
  await expect(page.locator('.recovered-message')).toHaveText(message);
  await expect(page.locator('.signature-line.good')).toHaveText(
    '✓ Signed by Bob: the signature is valid.',
  );
  expect(errors).toEqual([]);
});

test('an unknown signer becomes verified after adding their public key', async ({ browser }) => {
  const sender = await (await browser.newContext()).newPage();
  await importKey(sender, senderPair);
  await sender.getByRole('link', { name: 'Encrypt / Decrypt', exact: true }).click();
  await sender.getByLabel('To', { exact: true }).selectOption('demo-alice');
  await sender.getByLabel('Also sign as me').check();
  await expect(sender.getByLabel('Sign as', { exact: true })).toHaveValue(/.+/);
  await expect(sender.locator('#sign-as option:checked')).toContainText('Sami laptop');
  await sender.getByLabel('Message to encrypt').fill('From Sami, signed');
  await sender.getByRole('button', { name: 'Encrypt message', exact: true }).click();
  const envelope = await envelopeText(sender);

  const receiver = await (await browser.newContext()).newPage();
  await receiver.goto('/learn/encrypt');
  await receiver.getByRole('tab', { name: 'Decrypt a received envelope' }).click();
  await receiver.getByLabel('Envelope to decrypt').fill(envelope);
  await receiver.getByRole('button', { name: 'Decrypt envelope' }).click();
  await expect(receiver.locator('.recovered-message')).toHaveText('From Sami, signed');
  await expect(receiver.locator('.recovered-box')).toContainText('· HYBRID');
  await expect(receiver.locator('.signature-line.warn')).toContainText('Signed by an unknown key');

  await importKey(receiver, senderPublic);
  await receiver.getByRole('link', { name: 'Encrypt / Decrypt', exact: true }).click();
  await receiver.getByRole('tab', { name: 'Decrypt a received envelope' }).click();
  await receiver.getByLabel('Envelope to decrypt').fill(envelope);
  await receiver.getByRole('button', { name: 'Decrypt envelope' }).click();
  await expect(receiver.locator('.signature-line.good')).toHaveText(
    '✓ Signed by Sami: the signature is valid.',
  );
});
