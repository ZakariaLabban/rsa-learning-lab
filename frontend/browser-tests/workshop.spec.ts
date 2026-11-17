import { expect, test } from '@playwright/test';

test('guided journey opens both machines, animates real arithmetic and delivers the message', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/playground');
  await expect(page.getByRole('heading', { name: 'A secret. A little machinery.' })).toBeVisible();
  await page.getByLabel('Journey speed').selectOption('2');
  await page.getByRole('button', { name: 'Play journey', exact: true }).click();
  await expect(page.getByLabel('Inside the RSA machine')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Small steps. Real machinery.' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Pause calculations' })).toBeVisible();
  await expect(page.getByText('INSIDE / DECRYPTION', { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.getByRole('button', { name: 'Replay journey', exact: true })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator('.receipt strong')).toHaveText('88');
  await expect(page.getByRole('button', { name: 'Replay journey', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('calculation controls pause, step, move backward and explain zero bits', async ({ page }) => {
  await page.goto('/playground');
  await page.getByRole('button', { name: 'Open the decryption machine' }).click();
  await expect(page.getByRole('heading', { name: 'Small steps. Real machinery.' })).toBeFocused();
  await page.getByLabel('Calculation speed').selectOption('2');
  await page.getByRole('button', { name: 'Calculation 3: Square, bit 2' }).click();
  await expect(page.locator('.step-explanation')).toContainText('This bit is 0, so skip');
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeEnabled({
    timeout: 7000,
  });
  await expect(page.getByTestId('running-result')).toHaveText('121');
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeEnabled({
    timeout: 7000,
  });
  await expect(page.getByTestId('running-result')).toHaveText('55');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByTestId('running-result')).toHaveText('121');
  await page.getByRole('button', { name: 'Play calculations', exact: true }).click();
  await page.getByRole('button', { name: 'Pause calculations', exact: true }).click();
  const paused = await page.getByTestId('running-result').textContent();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('running-result')).toHaveText(paused!);
  await page.getByRole('button', { name: 'Calculation 9: Multiply, bit 5' }).click();
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(page.getByText('Recovered message = 88', { exact: true })).toBeVisible({
    timeout: 7000,
  });
  await expect(page.locator('.division-line')).toHaveText('1210=6 × 187+88');
  await page.getByRole('button', { name: 'Continue journey', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause journey', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Pause journey', exact: true }).click();
  await page.getByRole('button', { name: 'Open the decryption machine' }).click();
  await page.getByRole('button', { name: 'Back to workshop' }).click();
  await expect(page.getByRole('button', { name: 'Play journey', exact: true })).toBeFocused();
});

test('free exploration supports changed messages, validation and ciphertext interception', async ({
  page,
}) => {
  await page.goto('/playground');
  await page.getByRole('button', { name: 'Explore freely', exact: true }).click();
  for (const invalid of ['187', '-1', '1.5', 'abc']) {
    await page.getByLabel('YOUR MESSAGE', { exact: true }).fill(invalid);
    await page.getByRole('button', { name: 'Send it through' }).click();
    await expect(page.getByRole('alert')).toHaveText('Choose a whole number from 0 to 186.');
  }
  await page.getByLabel('YOUR MESSAGE', { exact: true }).fill('42');
  await page.getByRole('button', { name: 'Send it through' }).click();
  await page.getByRole('button', { name: 'Pause journey', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect what Eve can intercept' }).click();
  await expect(page.locator('.eve-value')).toHaveText('15');
  await page.getByRole('button', { name: 'Alter ciphertext (+1)', exact: true }).click();
  await expect(page.locator('.eve-value')).toHaveText('16');
  await page.getByRole('button', { name: 'Inspect Bob’s received message' }).click();
  await expect(page.getByRole('heading', { name: 'A changed message arrives.' })).toBeVisible();
  await expect(page.locator('.inspection')).toContainText('Alice sent 42. Bob receives 169.');
  await page.getByRole('button', { name: 'Inspect what Eve can intercept' }).click();
  await page.getByRole('button', { name: 'Restore original ciphertext' }).click();
  await page.getByRole('button', { name: 'Inspect Bob’s received message' }).click();
  await expect(page.locator('.receipt strong')).toHaveText('42');
});

test('Legacy lab is retained, remembers the choice and keeps unsaved keys during switching', async ({
  page,
}) => {
  await page.goto('/playground');
  await page.getByRole('link', { name: 'Legacy lab', exact: true }).click();
  await expect(page).toHaveURL(/\/legacy$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Understand the keys/ })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Understand the keys/ })).toBeVisible();
  await page.getByRole('link', { name: 'Keys', exact: true }).click();
  await page.getByRole('button', { name: 'Use Alice', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(1);
  await page.getByRole('link', { name: 'Animated workshop', exact: true }).click();
  await expect(page.locator('#lesson-title')).toHaveText('Keys');
  await page.getByRole('link', { name: 'Legacy lab', exact: true }).click();
  await page.getByRole('link', { name: 'Keys', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(1);
  await page.getByRole('link', { name: 'Animated workshop', exact: true }).click();
  await page.goto('/playground');
  await expect(page.getByRole('heading', { name: 'A secret. A little machinery.' })).toBeVisible();
});

for (const theme of ['light', 'dark'])
  test(`workshop fits phones, has keyboard controls and shares ${theme} theme with Legacy`, async ({
    page,
  }) => {
    await page.addInitScript((value) => localStorage.setItem('rsa-lab-theme', value), theme);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto('/playground');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(page.getByRole('button', { name: 'Reduce motion' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.getByRole('button', { name: 'Open the encryption machine' }).focus();
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(page.locator('.cutaway')).toHaveCSS('--calc-spin', '0deg');
      await page.getByRole('button', { name: 'Back to workshop' }).click();
      await page.getByText('Explore all lessons and tools', { exact: false }).click();
      await page.getByRole('link', { name: 'Square-and-Multiply', exact: true }).click();
      await expect(page.locator('#lesson-title')).toHaveText('Square-and-Multiply');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }
  });

test('operands reach the multiplier on both phone and desktop layouts', async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/playground');
    await page.getByRole('button', { name: 'Open the encryption machine' }).click();
    await page.getByRole('button', { name: 'Play calculations', exact: true }).click();
    await expect
      .poll(async () =>
        Number(
          await page
            .locator('.operand')
            .first()
            .evaluate((el) => getComputedStyle(el).opacity),
        ),
      )
      .toBeLessThan(0.6);
    await page.getByRole('button', { name: 'Pause calculations', exact: true }).click();
    const centers = await page.locator('.calculation-track').evaluate((track) => {
      const center = (selector: string) => {
        const rect = track.querySelector(selector)!.getBoundingClientRect();
        return rect.left + rect.width / 2;
      };
      return [
        center('.operand') - center('.multiply-chamber'),
        center('.operand-b') - center('.multiply-chamber'),
      ];
    });
    for (const delta of centers) expect(Math.abs(delta)).toBeLessThan(1);
  }
});

test('explicit experience routes work when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage disabled');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage disabled');
    };
  });
  await page.goto('/playground');
  await expect(page.getByRole('button', { name: 'Play journey', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Legacy lab', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Animated workshop', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Animated workshop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play journey', exact: true })).toBeVisible();
});
