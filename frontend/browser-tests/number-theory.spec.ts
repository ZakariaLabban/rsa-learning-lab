import { expect, test } from '@playwright/test';

test('Miller–Rabin lecture traces, liars, random evidence and small/invalid inputs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/learn/miller-rabin?n=29');
  await page.getByRole('button', { name: 'Test candidate', exact: true }).click();
  const sequence = page.getByRole('region', { name: 'Miller–Rabin residue sequence', exact: true });
  await expect(sequence.locator('tbody tr')).toHaveCount(2);
  await expect(sequence.locator('tbody tr').first()).toContainText('17');
  await expect(sequence.locator('tbody tr').last()).toContainText('28');
  await page
    .getByRole('group', { name: 'Miller–Rabin sequence steps' })
    .getByRole('button', { name: 'Next step' })
    .click();
  await expect(sequence.locator('[aria-current="step"]')).toContainText('28');
  await expect(
    page.getByText('Independent random rounds in this run:', { exact: false }),
  ).toContainText('0');
  await page.getByRole('button', { name: 'Load 221 / base 5' }).click();
  await expect(page).toHaveURL(/n=221/);
  await page.getByRole('button', { name: 'Test candidate', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Composite: base 5 is a witness');
  await expect(sequence.locator('tbody tr').first()).toContainText('112');
  await expect(sequence.locator('tbody tr').last()).toContainText('168');
  await page.getByRole('button', { name: 'Find passing bases' }).click();
  await expect(page.locator('.lesson-list')).toHaveText('21, 47, 174, 200');
  await page.getByRole('button', { name: 'Load 29 / base 10' }).click();
  await page.getByLabel('Base selection', { exact: true }).selectOption('random');
  await page.getByRole('button', { name: 'Test candidate', exact: true }).click();
  await expect(
    page.getByText('Independent random rounds in this run:', { exact: false }),
  ).toContainText('5');
  await expect(page.getByText('For any fixed odd composite n,', { exact: false })).toContainText(
    '1 / 1024',
  );
  await page.getByLabel('Base selection', { exact: true }).selectOption('typed');
  await page.getByRole('button', { name: 'Test candidate', exact: true }).click();
  await expect(
    page.getByText('Independent random rounds in this run:', { exact: false }),
  ).toContainText('0');
  for (const [n, explanation] of [
    ['2', 'is prime'],
    ['1', 'is not prime'],
    ['4', 'is composite'],
  ]) {
    await page.getByLabel('Candidate n', { exact: true }).fill(n);
    await page.getByRole('button', { name: 'Test candidate', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(explanation);
  }
  await page.getByLabel('Candidate n', { exact: true }).fill('29');
  await page.getByLabel('Base a', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Test candidate', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Bases must lie between 2 and n-2');
  expect(errors).toEqual([]);
});

test('worker cancellation and edits discard stale Miller–Rabin results', async ({ page }) => {
  // Hold the first worker script so fast machines cannot finish the bounded search
  // before the cancellation button receives a click. Later searches use the real worker.
  let held = false;
  let release: (() => void) | undefined;
  let requested: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route(/\/assets\/worker-[^/]+\.js$/, async (route) => {
    if (held) {
      await route.continue();
      return;
    }
    held = true;
    await new Promise<void>((resolve) => {
      release = resolve;
      requested?.();
    });
    await route.abort();
  });
  await page.goto('/learn/miller-rabin?n=9973');
  await page.getByRole('button', { name: 'Find passing bases' }).click();
  await started;
  await page.getByRole('button', { name: 'Cancel calculation' }).click();
  release?.();
  await expect(page.getByRole('alert')).toHaveText('Calculation cancelled.');
  await expect(page.locator('.lesson-list')).toHaveCount(0);
  await page.getByLabel('Candidate n', { exact: true }).fill('221');
  await page.getByRole('button', { name: 'Find passing bases' }).click();
  await expect(page.locator('.lesson-list')).toHaveText('21, 47, 174, 200');
});

test('RSA proof handles coprime, non-coprime, zero and negative messages; explorer checks theorem conditions', async ({
  page,
}) => {
  await page.goto('/learn/why-rsa-works');
  await page.getByLabel('Message M (integer)', { exact: true }).fill('89');
  await page.getByRole('button', { name: 'Show RSA proof' }).click();
  await expect(page.getByRole('heading', { name: 'Euler’s argument applies' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Recovered M = 89 = normalized M = 89');
  await page.getByRole('button', { name: 'Try a non-coprime message' }).click();
  await page.getByRole('button', { name: 'Show RSA proof' }).click();
  await expect(
    page.getByText('Euler’s coprime argument does not apply here.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('M is divisible by this prime,', { exact: false })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Recovered M = 17 = normalized M = 17');
  for (const [message, expected] of [
    ['0', '0'],
    ['-1', '186'],
  ]) {
    await page.getByLabel('Message M (integer)', { exact: true }).fill(message);
    await page.getByRole('button', { name: 'Show RSA proof' }).click();
    await expect(
      page.getByRole('region', { name: 'RSA correctness proof' }).getByRole('status'),
    ).toHaveText(`Recovered M = ${expected} = normalized M = ${expected}.`);
  }
  for (const [message, expected] of [
    ['0', '0'],
    ['-1', '186'],
    ['204', '17'],
  ]) {
    await page.getByLabel('Message M (integer)', { exact: true }).fill(message);
    await page.getByRole('button', { name: 'Show RSA proof' }).click();
    await expect(page.getByRole('status')).toContainText(
      `Recovered M = ${expected} = normalized M = ${expected}`,
    );
  }
  await page.getByRole('button', { name: 'Explore residues' }).click();
  await expect(page.getByText('n is prime: Fermat’s exponent', { exact: false })).toBeVisible();
  await page.getByLabel('Residue modulus n', { exact: true }).fill('15');
  await page.getByRole('button', { name: 'Explore residues' }).click();
  await expect(page.getByText('The base is not coprime', { exact: false })).toBeVisible();
  await page.getByLabel('Prime p', { exact: true }).fill('15');
  await page.getByRole('button', { name: 'Show RSA proof' }).click();
  await expect(page.getByRole('alert')).toContainText('p and q must be distinct primes');
});

test('square-and-multiply reproduces Table 9.3 and handles exponent zero without fake steps', async ({
  page,
}) => {
  await page.goto('/learn/square-and-multiply');
  await page.getByRole('button', { name: 'Trace exponentiation' }).click();
  const rows = page
    .getByRole('region', { name: 'Table 9.3 · left-to-right square-and-multiply', exact: true })
    .locator('tbody tr');
  await expect(rows).toHaveCount(10);
  expect(
    await rows.evaluateAll((elements) =>
      elements.map((element) => Array.from(element.querySelectorAll('td'), (td) => td.textContent)),
    ),
  ).toEqual([
    ['9', '1', '1', '7'],
    ['8', '0', '2', '49'],
    ['7', '0', '4', '157'],
    ['6', '0', '8', '526'],
    ['5', '1', '17', '160'],
    ['4', '1', '35', '241'],
    ['3', '0', '70', '298'],
    ['2', '0', '140', '166'],
    ['1', '0', '280', '67'],
    ['0', '0', '560', '1'],
  ]);
  await page
    .getByRole('group', { name: 'Square-and-multiply steps' })
    .getByRole('button', { name: 'Show result', exact: true })
    .click();
  await expect(rows.last()).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('status')).toHaveText('Result: 7^560 mod 561 = 1');
  await expect(page.getByText('Square-and-multiply:', { exact: false })).toContainText('13');
  await page.getByLabel('Exponent b', { exact: true }).fill('0');
  await page.getByLabel('Modulus n', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Trace exponentiation' }).click();
  await expect(page.getByRole('status')).toHaveText('Result: 7^0 mod 1 = 0');
  await expect(page.getByRole('group', { name: 'Square-and-multiply steps' })).toHaveCount(0);
  await page.getByLabel('Exponent b', { exact: true }).fill('-1');
  await page.getByRole('button', { name: 'Trace exponentiation' }).click();
  await expect(page.getByRole('alert')).toContainText('non-negative');
});

test('CRT splits and reconstructs the 1813 example and rejects non-coprime moduli', async ({
  page,
}) => {
  await page.goto('/learn/crt');
  await page.getByRole('button', { name: 'Residues → A', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('A ≡ 1651 (mod 1813) ↔ (23, 34)');
  await page.getByLabel('Number A', { exact: true }).fill('973');
  await page.getByRole('button', { name: 'A → residues', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('A ≡ 973 (mod 1813) ↔ (11, 42)');
  await page.getByRole('button', { name: 'Use these canonical values in the inputs' }).click();
  await expect(page.getByLabel('CRT residues (comma separated)', { exact: true })).toHaveValue(
    '11, 42',
  );
  await page.getByRole('button', { name: 'Residues → A', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('A ≡ 973 (mod 1813) ↔ (11, 42)');
  await page.getByLabel('CRT moduli (comma separated)', { exact: true }).fill('4,6');
  await page.getByRole('button', { name: 'Residues → A', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('pairwise coprime');
});

test('CRT benchmarks both real sizes, hides private details, and keeps key generation cancellable', async ({
  page,
}) => {
  test.setTimeout(120000);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api')) requests.push(request.url());
  });
  await page.goto('/learn/crt');
  await page.getByRole('button', { name: 'Compare RSA decryption', exact: true }).click();
  await expect(page.getByText('Measured 2048-bit key.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Alice-only private CRT calculation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal private CRT details' }).click();
  await expect(page.getByLabel('Alice-only private CRT calculation')).toContainText(
    'M = M_q + h × q',
  );
  await page.getByRole('button', { name: 'Hide private CRT details' }).click();
  await expect(page.getByLabel('Alice-only private CRT calculation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Generate 2048-bit benchmark key', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel benchmark key generation' }).click();
  await expect(
    page.getByRole('button', { name: 'Compare RSA decryption', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Generate 1024-bit benchmark key', exact: true }).click();
  await expect(page.getByLabel('Alice’s private key', { exact: true })).toHaveValue(
    '__generated__',
    { timeout: 90000 },
  );
  await page.getByRole('button', { name: 'Compare RSA decryption', exact: true }).click();
  await expect(page.getByText('Measured 1024-bit key.', { exact: false })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Both routes agree: M = 88.');
  await page.getByText('Show recorded timing samples (ms)', { exact: true }).click();
  await expect(page.getByText('Ordinary:', { exact: false })).toBeVisible();
  expect(requests).toEqual([]);
});

for (const theme of ['light', 'dark'])
  test(`math lessons fit a phone and remain keyboard-accessible in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.addInitScript((value) => localStorage.setItem('rsa-lab-theme', value), theme);
    const routes = [
      ['/learn/miller-rabin?n=221', 'Test candidate'],
      ['/learn/why-rsa-works', 'Show RSA proof'],
      ['/learn/square-and-multiply', 'Trace exponentiation'],
      ['/learn/crt', 'Residues → A'],
    ];
    for (const [path, button] of routes) {
      await page.goto(path);
      const action = page.getByRole('button', { name: button, exact: true });
      await action.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.math-lessons [role="status"]').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      await expect(page.getByRole('alert')).toHaveCount(0);
    }
  });
