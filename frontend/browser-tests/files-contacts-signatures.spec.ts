import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function fileTab(page: Page) {
  await page.goto('/learn/encrypt');
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
}

test('signed file download round trip and tampering never offers a plaintext download', async ({
  page,
}) => {
  await page.route('**/api/**', (route) => route.abort());
  await fileTab(page);
  await page.getByLabel('File recipient', { exact: true }).selectOption('demo-alice');
  await page.getByLabel('Also sign this file').check();
  await page.getByLabel('File signing key').selectOption('demo-bob');
  const data = Buffer.from('%PDF-1.7\nDemo مرحبا 🔐\n\x00\xff');
  await page
    .getByLabel('File to encrypt', { exact: true })
    .setInputFiles({ name: 'رسالة.pdf', mimeType: 'application/pdf', buffer: data });
  await page.getByRole('button', { name: 'Encrypt file', exact: true }).click();
  await expect(page.getByText('RSA encrypted 32 bytes', { exact: false })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download encrypted envelope' }).click();
  const encrypted = await downloading;
  const envelope = await readFile((await encrypted.path())!, 'utf8');
  await page
    .getByLabel('Encrypted envelope file', { exact: true })
    .setInputFiles({ name: 'file.rsa', mimeType: 'text/plain', buffer: Buffer.from(envelope) });
  await page.getByRole('button', { name: 'Decrypt file', exact: true }).click();
  await expect(page.locator('.file-panel .signature-line.good')).toContainText('Signed by Bob');
  const plainDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download decrypted file' }).click();
  const plain = await plainDownload;
  expect(plain.suggestedFilename()).toBe('رسالة.pdf');
  expect(await readFile((await plain.path())!)).toEqual(data);

  const value = JSON.parse(
    Buffer.from(envelope.slice('rsa-lab.v2:'.length), 'base64').toString('utf8'),
  );
  const bytes = Buffer.from(value.ciphertext, 'base64');
  bytes[bytes.length - 1] ^= 1;
  value.ciphertext = bytes.toString('base64');
  const tampered = 'rsa-lab.v2:' + Buffer.from(JSON.stringify(value)).toString('base64');
  await page
    .getByLabel('Encrypted envelope file', { exact: true })
    .setInputFiles({ name: 'altered.rsa', mimeType: 'text/plain', buffer: Buffer.from(tampered) });
  await expect(page.getByRole('button', { name: 'Download decrypted file' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Decrypt file', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Decryption failed. Check the key and ciphertext.',
  );
  await expect(page.getByRole('button', { name: 'Download decrypted file' })).toHaveCount(0);
});

test('file size rejected before worker processing and a running operation can be cancelled', async ({
  page,
}) => {
  await fileTab(page);
  await page.getByLabel('File to encrypt', { exact: true }).setInputFiles({
    name: 'too-big.bin',
    mimeType: 'application/octet-stream',
    buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
  });
  await page.getByRole('button', { name: 'Encrypt file', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('at most 25 MiB');
  await page.getByLabel('File to encrypt', { exact: true }).setInputFiles({
    name: 'large.bin',
    mimeType: 'application/octet-stream',
    buffer: Buffer.alloc(8 * 1024 * 1024),
  });
  await page.getByRole('button', { name: 'Encrypt file', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel file operation' }).click();
  await expect(page.getByRole('button', { name: 'Encrypt file', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Download encrypted envelope' })).toHaveCount(0);
});

test('2048-bit QR fallback imports the same public fingerprint in a second mobile browser context', async ({
  browser,
}) => {
  const senderContext = await browser.newContext();
  const receiverContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const sender = await senderContext.newPage();
  const receiver = await receiverContext.newPage();
  await sender.goto('/contacts');
  const image = sender.getByRole('img', { name: 'Public-key QR for Alice' });
  await expect(image).toBeVisible();
  const publicText = await sender.getByLabel('Public key to share').inputValue();
  const key = JSON.parse(publicText);
  expect(key.bits).toBe(2048);
  expect(Object.keys(key)).not.toEqual(expect.arrayContaining(['d', 'p', 'q']));
  const png = Buffer.from((await image.getAttribute('src'))!.split(',')[1], 'base64');
  await receiver.addInitScript(() =>
    Object.defineProperty(globalThis, 'BarcodeDetector', { value: undefined, configurable: true }),
  );
  await receiver.goto('/contacts');
  await receiver
    .getByLabel('Or upload a QR image')
    .setInputFiles({ name: 'alice.png', mimeType: 'image/png', buffer: png });
  await expect(receiver.getByLabel('Public key text', { exact: true })).toHaveValue(publicText);
  await receiver.getByLabel('New contact name (optional)').fill('Sara');
  await receiver.getByRole('button', { name: 'Add pasted contact' }).click();
  const card = receiver.locator('.contact-card');
  await expect(card.locator('.fingerprint')).toHaveText(key.fingerprint.match(/.{4}/g).join(' '));
  await expect(card).toContainText('Unverified');
  await card.getByRole('button', { name: 'Compare fingerprint' }).click();
  await expect(card.getByRole('button', { name: 'Mark fingerprint verified' })).toBeDisabled();
  await card.getByLabel('I compared the full fingerprint', { exact: false }).check();
  await card.getByRole('button', { name: 'Mark fingerprint verified' }).click();
  await expect(card).toContainText('Fingerprint verified');
  await card.getByLabel('Contact name', { exact: true }).fill('Sara phone');
  await card.getByRole('button', { name: 'Save name' }).click();
  await receiver.reload();
  await expect(receiver.locator('.contact-card')).toContainText('Sara phone');
  await receiver.goto('/learn/encrypt');
  await expect(
    receiver.getByLabel('To', { exact: true }).locator('option').filter({ hasText: 'Sara phone' }),
  ).toHaveCount(1);
  await receiver.goto('/contacts');
  receiver.once('dialog', (dialog) => dialog.accept());
  await receiver.getByRole('button', { name: 'Delete contact' }).click();
  await expect(receiver.locator('.contact-card')).toHaveCount(0);
  await senderContext.close();
  await receiverContext.close();
});

test('native QR camera path stops tracks after scan and permission denial has a useful fallback', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const fixture = { format: 'rsa-lab-public-v2', name: 'Camera key', n: '187', e: '7' };
    Object.defineProperty(globalThis, 'BarcodeDetector', {
      configurable: true,
      value: class {
        async detect() {
          return [{ rawValue: JSON.stringify(fixture) }];
        }
      },
    });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        canvas.getContext('2d')!.fillRect(0, 0, 300, 300);
        const stream = canvas.captureStream(10);
        Object.assign(window, { testCameraTrack: stream.getTracks()[0] });
        return stream;
      },
    });
  });
  await page.goto('/contacts');
  await page.getByRole('button', { name: 'Scan public-key QR' }).click();
  await expect(page.getByLabel('Public key text', { exact: true })).toHaveValue(/Camera key/);
  await expect(page.getByLabel('Public-key scanner camera')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { testCameraTrack: MediaStreamTrack }).testCameraTrack.readyState,
    ),
  ).toBe('ended');
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        throw new DOMException('denied', 'NotAllowedError');
      },
    }),
  );
  await page.getByRole('button', { name: 'Scan public-key QR' }).click();
  await expect(page.getByRole('alert')).toContainText('Camera permission denied');
  await expect(page.getByLabel('Or upload a QR image')).toBeEnabled();
});

test('deleting a selected contact during navigation invalidates the persistent file recipient', async ({
  page,
}) => {
  await page.goto('/contacts');
  const publicText = await page.getByLabel('Public key to share').inputValue();
  await page.getByLabel('Public key text', { exact: true }).fill(publicText);
  await page.getByLabel('New contact name (optional)').fill('Temporary recipient');
  await page.getByRole('button', { name: 'Add pasted contact' }).click();
  await page.getByRole('link', { name: 'Encrypt / Decrypt', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  const picker = page.getByLabel('File recipient', { exact: true });
  const option = picker.locator('option').filter({ hasText: 'Temporary recipient' });
  await picker.selectOption((await option.getAttribute('value'))!);
  await page
    .getByLabel('File to encrypt', { exact: true })
    .setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('note') });
  await expect(page.getByRole('button', { name: 'Encrypt file', exact: true })).toBeEnabled();
  await page.getByRole('link', { name: 'Contacts', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete contact' }).click();
  await page.getByRole('link', { name: 'Encrypt / Decrypt', exact: true }).click();
  await expect(page.getByLabel('File recipient', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Encrypt file', exact: true })).toBeDisabled();
});

test('signature lesson demonstrates PSS verification, wrong-key and tamper failures, then the teaching collision', async ({
  page,
}) => {
  await page.goto('/learn/signatures');
  await page.getByRole('button', { name: 'Alice signs', exact: true }).click();
  await page.getByRole('button', { name: 'Bob verifies', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Signature valid for this public key', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Bob verifies with public key', { exact: true }).selectOption('demo-bob');
  await page.getByRole('button', { name: 'Bob verifies', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Signature invalid for this public key', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Bob verifies with public key', { exact: true }).selectOption('demo-alice');
  await page.getByRole('button', { name: 'Tamper with signature' }).click();
  await page.getByRole('button', { name: 'Bob verifies', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Signature invalid for this public key', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Alice signs', exact: true }).click();
  await page.getByRole('button', { name: 'Tamper with message' }).click();
  await page.getByRole('button', { name: 'Bob verifies', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Signature invalid for this public key', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Load collision example' }).click();
  await page.getByRole('button', { name: 'Alice signs', exact: true }).click();
  await page.getByRole('button', { name: 'Try collision message 46' }).click();
  await page.getByRole('button', { name: 'Bob verifies', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Signature valid for this public key', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Expected value: 24', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Load number example' }).click();
  await page.getByRole('button', { name: 'Alice signs', exact: true }).click();
  await page.getByRole('button', { name: 'Bob verifies', exact: true }).click();
  await expect(page.getByText('Expected value: 88', { exact: false })).toBeVisible();
});

for (const theme of ['light', 'dark'])
  test(`new pages and files fit a phone in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript((value) => localStorage.setItem('rsa-lab-theme', value), theme);
    for (const path of ['/contacts', '/learn/signatures', '/learn/encrypt']) {
      await page.goto(path);
      if (path === '/learn/encrypt')
        await page.getByRole('tab', { name: 'Files', exact: true }).click();
      await expect(page.locator('.feature-body').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
    }
  });
