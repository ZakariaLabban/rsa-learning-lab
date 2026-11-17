import { expect, test, type Page, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { routes } from '../src/app/routes';

const path = (slug: string) => `/playground${slug}`;
async function finish(machine: Locator) {
  const slider = machine.getByRole('slider', { name: 'Calculation progress' });
  await slider.focus();
  await slider.press('End');
}
async function map(machine: Locator) {
  const details = machine.locator('.lesson-trace-map');
  if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open)))
    await details.locator('summary').click();
}
async function run(page: Page, slug: string, button: string, title: string) {
  await page.goto(path(slug));
  await page.getByRole('button', { name: button, exact: true }).click();
  const machine = page.getByRole('region', { name: `${title} animation`, exact: true });
  await expect(machine).toBeVisible();
  return machine;
}

test('every lesson and tool has a new route, stays in the new UI and can return to Legacy', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of [...routes, { path: '/files', label: 'File exchange' }]) {
    await page.goto(path(route.path));
    await expect(page.locator('.lesson-studio')).toBeVisible();
    await expect(page.locator('#lesson-title')).toHaveText(route.label);
    await expect(page.getByRole('button', { name: 'Guide me', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('link', { name: 'Legacy lab', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('#lesson-title')).toHaveText(route.label);
  }
  await page.goto('/playground/learn/miller-rabin');
  await page.getByRole('link', { name: 'Next: why RSA decryption works' }).click();
  await expect(page).toHaveURL(/\/playground\/learn\/why-rsa-works$/);
  await page.getByRole('link', { name: 'Legacy lab', exact: true }).click();
  await expect(page).toHaveURL(/\/learn\/why-rsa-works$/);
  await expect(page.locator('.lesson-machine')).toHaveCount(0);
  await page.getByRole('link', { name: 'Animated workshop', exact: true }).click();
  await expect(page).toHaveURL(/\/playground\/learn\/why-rsa-works$/);
  expect(errors).toEqual([]);
});

test('key assembly and Euclid show current inputs and honor private reveal', async ({ page }) => {
  const keys = await run(
    page,
    '/learn/keys',
    'Load lecture example (p=17, q=11, e=7)',
    'Key assembly machine',
  );
  await expect(keys).toContainText('Hidden · reveal private key');
  await page.getByRole('button', { name: 'Reveal private key', exact: true }).click();
  await expect(keys.locator('.lesson-number-token strong').first()).toHaveText('17');
  await page.goto(path('/learn/euclid') + '?a=7&m=160');
  const euclid = page.getByRole('region', { name: 'Extended Euclid machine animation' });
  await expect(euclid).toBeVisible();
  await map(euclid);
  await euclid.getByRole('button', { name: /Normalize the inverse/ }).click();
  await finish(euclid);
  await expect(euclid.locator('.lesson-output-register strong')).toHaveText('23');
  await page.getByLabel('a (the number to invert)').fill('5');
  await map(euclid);
  await euclid.getByRole('button', { name: /No inverse exists/ }).click();
  await finish(euclid);
  await expect(euclid.locator('.lesson-output-register strong')).toHaveText('No inverse');
});

test('prime, power, CRT and proof animations use actual computed values', async ({ page }) => {
  const prime = await run(page, '/learn/miller-rabin', 'Test candidate', 'Prime witness machine');
  await expect(prime).toContainText('2^2 × 7');
  const power = await run(
    page,
    '/learn/square-and-multiply',
    'Trace exponentiation',
    'Square-and-multiply machine',
  );
  await map(power);
  await power.locator('.lesson-trace-map button').last().click();
  await finish(power);
  await expect(power.locator('.lesson-output-register strong')).toHaveText('1');
  const crt = await run(page, '/learn/crt', 'Residues → A', 'CRT reconstruction machine');
  await map(crt);
  await crt.locator('.lesson-trace-map button').last().click();
  await finish(crt);
  await expect(crt.locator('.lesson-output-register strong')).toHaveText('1651');
  await page.goto(path('/learn/why-rsa-works'));
  await page.getByRole('button', { name: 'Try a non-coprime message' }).click();
  await page.getByRole('button', { name: 'Show RSA proof' }).click();
  const proof = page.getByRole('region', { name: 'RSA correctness machine animation' });
  await map(proof);
  await proof.getByRole('button', { name: /Check the coprime condition/ }).click();
  await expect(proof).toContainText('does not apply');
});

test('shared player pauses, steps backward, scrubs and explores a calculation map', async ({
  page,
}) => {
  const machine = await run(
    page,
    '/learn/square-and-multiply',
    'Trace exponentiation',
    'Square-and-multiply machine',
  );
  await page.getByRole('button', { name: 'Explore freely', exact: true }).click();
  await expect(machine.locator('.lesson-trace-map')).toHaveAttribute('open', '');
  await machine.getByLabel('Animation speed').selectOption('4');
  await machine.getByRole('button', { name: 'Next calculation', exact: true }).click();
  await expect(
    machine.getByRole('button', { name: 'Next calculation', exact: true }),
  ).toBeEnabled();
  await machine.getByRole('button', { name: 'Next calculation', exact: true }).click();
  await expect(
    machine.getByRole('button', { name: 'Next calculation', exact: true }),
  ).toBeEnabled();
  await machine.getByRole('button', { name: 'Previous calculation', exact: true }).click();
  await expect(machine.locator('.lesson-machine-count')).toHaveText(/2 \/ /);
  await machine.getByRole('button', { name: 'Play animation', exact: true }).click();
  await machine.getByRole('button', { name: 'Pause animation', exact: true }).click();
  const before = await machine.getByRole('slider').inputValue();
  await page.waitForTimeout(250);
  await expect(machine.getByRole('slider')).toHaveValue(before);
  await finish(machine);
  await expect(machine.locator('.lesson-output-register strong')).not.toHaveText('…');
});

test('keyboard stepping retains focus in both calculation players and source captions follow the animation', async ({
  page,
}) => {
  const machine = await run(
    page,
    '/learn/square-and-multiply',
    'Trace exponentiation',
    'Square-and-multiply machine',
  );
  await machine.getByLabel('Animation speed').selectOption('4');
  const next = machine.getByRole('button', { name: 'Next calculation', exact: true });
  await next.focus();
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Enter');
    await expect(next).toBeFocused();
    await expect(next).toBeEnabled();
    await expect(next).toBeFocused();
  }
  await expect(machine.locator('.lesson-machine-count')).toHaveText('2 / 13');
  const prime = await run(page, '/learn/miller-rabin', 'Test candidate', 'Prime witness machine');
  await map(prime);
  await prime.getByRole('button', { name: /Square residue 1/ }).click();
  await finish(prime);
  await expect(prime.locator('.lesson-output-register strong')).toHaveText('28');
  await expect(page.getByText('Step 2: x = 28 (n−1)', { exact: true })).toBeVisible();
  await page.goto('/playground');
  await page.getByRole('button', { name: 'Open the encryption machine' }).click();
  await page.getByLabel('Calculation speed').selectOption('4');
  const nextStep = page.getByRole('button', { name: 'Next step', exact: true });
  await nextStep.focus();
  await page.keyboard.press('Enter');
  await expect(nextStep).toBeFocused();
  await expect(nextStep).toBeEnabled();
  await expect(nextStep).toBeFocused();
});

test('hybrid protocol hides session secrets and invalid raw signatures show validation rather than PSS', async ({
  page,
}) => {
  await page.goto(path('/learn/encrypt'));
  await page.getByLabel('Padding', { exact: true }).selectOption('hybrid');
  await page.getByRole('button', { name: 'Encrypt message', exact: true }).click();
  const protocol = page.getByRole('region', { name: 'Message protocol machine animation' });
  await map(protocol);
  await protocol.getByRole('button', { name: /Encrypt the message with a fresh AES key/ }).click();
  await expect(page.locator('.step-values')).toContainText('Hidden in the new interface');
  await expect(protocol).not.toContainText('AES key K (hex');
  await page.goto(path('/learn/signatures'));
  await page.getByRole('button', { name: 'Load number example' }).click();
  await page.getByLabel('Signature (decimal)', { exact: true }).fill('abc');
  await page.getByRole('button', { name: 'Bob verifies', exact: true }).click();
  const verify = page.getByRole('region', { name: 'Signature verification machine animation' });
  await expect(verify).toContainText('Reject before RSA');
  await expect(verify).not.toContainText('PSS');
});

test('factoring, vote guessing, OAEP and broadcast expose real attack steps', async ({ page }) => {
  const factor = await run(
    page,
    '/break/factoring',
    'Let Eve factor the key',
    'Factoring attack machine',
  );
  await map(factor);
  await factor.locator('.lesson-trace-map button').last().click();
  await finish(factor);
  await expect(factor.locator('.lesson-output-register strong')).toHaveText('18505');
  const guess = await run(page, '/break/yes-or-no', 'Run guessing attack', 'Vote guessing machine');
  await map(guess);
  await guess.getByRole('button', { name: /Match deterministic ciphertext/ }).click();
  await finish(guess);
  await expect(guess.locator('.lesson-output-register strong')).toHaveText('YES');
  const oaep = page.getByRole('region', { name: 'OAEP encoding machine animation' });
  await expect(oaep).toContainText('Hidden');
  await page.getByRole('button', { name: 'Reveal demonstration randomness', exact: true }).click();
  await expect(oaep).not.toContainText('Hidden');
  const broadcast = await run(
    page,
    '/break/small-e',
    'Run broadcast demonstration',
    'Broadcast reconstruction machine',
  );
  await map(broadcast);
  await broadcast.locator('.lesson-trace-map button').last().click();
  await finish(broadcast);
  await expect(broadcast.locator('.lesson-output-register strong')).toContainText('Recovered:');
});

test('signatures and practical encryption animate actual operations without leaking private values', async ({
  page,
}) => {
  await page.goto(path('/learn/signatures'));
  await page.getByRole('button', { name: 'Load number example' }).click();
  await page.getByRole('button', { name: 'Alice signs', exact: true }).click();
  const sign = page.getByRole('region', { name: 'Signature creation machine animation' });
  await map(sign);
  await sign.getByRole('button', { name: /Apply the private operation/ }).click();
  await expect(sign).toContainText('private d (hidden)');
  await page.getByRole('button', { name: 'Bob verifies', exact: true }).click();
  const verify = page.getByRole('region', { name: 'Signature verification machine animation' });
  await map(verify);
  await verify.locator('.lesson-trace-map button').last().click();
  await finish(verify);
  await expect(verify.locator('.lesson-output-register strong')).toHaveText('Signature valid');
  await page.goto(path('/learn/encrypt'));
  await page.getByRole('button', { name: 'Load lecture example (M = 88, key 187)' }).click();
  await page.getByRole('button', { name: 'Encrypt message', exact: true }).click();
  const protocol = page.getByRole('region', { name: 'Message protocol machine animation' });
  await expect(protocol).toBeVisible();
});

test('contacts, worked examples, repeated encryption and practice all have animation players', async ({
  page,
}) => {
  await page.goto(path('/contacts'));
  await expect(
    page.getByRole('region', { name: 'Public-key sharing machine animation' }),
  ).toBeVisible();
  await page.goto(path('/learn/example'));
  await expect(
    page.getByRole('region', { name: 'Worked RSA journey machine animation' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('65 → 2790 → 65');
  await page.goto(path('/learn/practice'));
  await page.getByLabel('Your answer', { exact: true }).fill('187');
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Correct.');
  await page.getByRole('button', { name: 'Animate worked solution' }).click();
  await expect(
    page.getByRole('region', { name: 'Practice solution machine animation' }),
  ).toBeVisible();
  await page.goto(path('/learn/keys'));
  await page.getByRole('button', { name: 'Use Alice', exact: true }).click();
  await page.getByLabel('Jump to a lesson').selectOption(path('/experiments'));
  await page.getByRole('button', { name: 'Run experiment', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Repeated encryption machine animation' }),
  ).toBeVisible();
});

test('new file tool animates an authenticated roundtrip and keeps private workbench state during navigation', async ({
  page,
}) => {
  await page.goto(path('/files'));
  await page.getByLabel('File recipient', { exact: true }).selectOption('demo-alice');
  const data = Buffer.from('Animated file journey مرحبا');
  await page
    .getByLabel('File to encrypt', { exact: true })
    .setInputFiles({ name: 'lesson.txt', mimeType: 'text/plain', buffer: data });
  await page.getByRole('button', { name: 'Encrypt file', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Hybrid file machine animation' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download encrypted envelope' }).click();
  const sealed = await download;
  const envelope = await readFile((await sealed.path())!);
  await page
    .getByLabel('Encrypted envelope file', { exact: true })
    .setInputFiles({ name: 'lesson.rsa', mimeType: 'text/plain', buffer: envelope });
  await page.getByRole('button', { name: 'Decrypt file', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'File authenticated and decrypted' }),
  ).toBeVisible();
  const machine = page.getByRole('region', { name: 'Hybrid file machine animation' });
  await expect(machine).toContainText('Open the envelope');
  await page.goto(path('/learn/encrypt'));
  await page.getByLabel('Message to encrypt', { exact: true }).fill('Keep this draft');
  await page.getByLabel('Jump to a lesson').selectOption(path('/contacts'));
  await page.getByLabel('Jump to a lesson').selectOption(path('/learn/encrypt'));
  await expect(page.getByLabel('Message to encrypt', { exact: true })).toHaveValue(
    'Keep this draft',
  );
});

test('seeded practice restores versioned progress without double-counting and offers difficulty levels', async ({
  page,
}) => {
  await page.goto(path('/learn/practice'));
  await page.getByLabel('Your answer', { exact: true }).fill('187');
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByText(/First attempts: 1\/1 correct/)).toBeVisible();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByText(/First attempts: 1\/1 correct/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/First attempts: 1\/1 correct/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Difficulty', exact: true }).selectOption('exam');
  await page.getByLabel('Practice seed').fill('42');
  await page.getByRole('button', { name: 'Load seed', exact: true }).click();
  const prompt = await page.locator('.practice-lesson h3').textContent();
  await page.getByRole('button', { name: 'Animate worked solution' }).click();
  await expect(
    page.getByRole('region', { name: 'Practice solution machine animation' }),
  ).toBeVisible();
  await page.getByLabel('Practice seed').fill('43');
  await page.getByRole('button', { name: 'Load seed', exact: true }).click();
  await page.getByLabel('Practice seed').fill('42');
  await page.getByRole('button', { name: 'Load seed', exact: true }).click();
  await expect(page.locator('.practice-lesson h3')).toHaveText(prompt!);
});

for (const theme of ['light', 'dark'])
  test(`all new lessons fit phones in ${theme}, including the calculation player`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.addInitScript((t) => localStorage.setItem('rsa-lab-theme', t), theme);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of [...routes, { path: '/files' }]) {
      await page.setViewportSize({ width: 375, height: 900 });
      await page.goto(path(route.path));
      await expect(page.locator('#lesson-title')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
    }
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      const machine = await run(
        page,
        '/learn/square-and-multiply',
        'Trace exponentiation',
        'Square-and-multiply machine',
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      await expect(machine.locator('.lesson-apparatus')).toHaveClass(/reduced/);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }
  });
