import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    for (const path of [
      'start',
      'gcd',
      'inverse',
      'power',
      'rsa',
      'why',
      'signatures',
      'primality',
      'crt',
      'factoring',
      'small-e',
      'guessing',
      'keys',
      'contacts',
      'messages',
      'practice',
    ])
      localStorage.setItem(`rsa-lab-guide.v1:/lecture/${path}`, 'hidden');
  });
});

const references = JSON.parse(
  readFileSync(
    new URL('../src/engine/__vectors__/reference-vectors.json', import.meta.url),
    'utf8',
  ),
);
const ref = references.keys[0];

async function showAll(page: Page) {
  await page.getByRole('button', { name: 'Show all', exact: true }).click();
}
/** The numbers panel starts folded into one line; open it before typing. */
async function change(page: Page) {
  await page.getByRole('button', { name: 'Change the numbers' }).first().click();
}
const resultText = (page: Page) => page.locator('div.result, p.result').last();

test('the home page is a course map with sixteen lessons in order', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Learn RSA, one step at a time' })).toBeVisible();
  await expect(page.locator('ol.cards li')).toHaveCount(16);
  await page.getByRole('link', { name: 'Start with lesson 1' }).click();
  await expect(page).toHaveURL(/\/lecture\/start$/);
  await page.getByRole('link', { name: /Next lesson/ }).click();
  await expect(page).toHaveURL(/\/lecture\/gcd$/);
  await page.getByRole('link', { name: /Next lesson/ }).click();
  await expect(page).toHaveURL(/\/lecture\/inverse$/);
  await page.getByRole('link', { name: /Previous/ }).click();
  await expect(page).toHaveURL(/\/lecture\/gcd$/);
  expect(errors).toEqual([]);
});

test('every lesson opens without errors and has a title', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const path of [
    'start',
    'gcd',
    'inverse',
    'power',
    'primality',
    'crt',
    'rsa',
    'why',
    'signatures',
    'factoring',
    'small-e',
    'guessing',
    'keys',
    'contacts',
    'messages',
    'practice',
  ]) {
    await page.goto(`/lecture/${path}`);
    await expect(page.locator('main h1')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('GCD table matches the lecture example one row at a time', async ({ page }) => {
  await page.goto('/lecture/gcd');
  await expect(page.locator('table.grid tbody tr')).toHaveCount(1);
  await expect(page.getByText('Step 1 of 11')).toBeVisible();
  await page.getByRole('button', { name: 'Next step →' }).click();
  await expect(page.locator('table.grid tbody tr')).toHaveCount(2);
  await showAll(page);
  await expect(page.locator('table.grid tbody tr')).toHaveCount(11);
  await expect(page.locator('.result')).toContainText('gcd(1970, 1066) = 2');
});

test('slow playback fills the table by itself, can be paused and resumed', async ({ page }) => {
  await page.clock.install();
  await page.goto('/lecture/gcd');
  const rows = page.locator('table.grid tbody tr');
  await page.getByRole('button', { name: 'Play slowly' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.clock.fastForward(1700);
  await expect(rows).toHaveCount(2);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.clock.fastForward(8000);
  await expect(rows).toHaveCount(2);
  await page.getByRole('button', { name: 'Play slowly' }).click();
  await page.clock.fastForward(1700);
  await expect(rows).toHaveCount(3);
});

test('Extended Euclid draws the Q, A1–A3, B1–B3 table for 550⁻¹ mod 1759', async ({ page }) => {
  await page.goto('/lecture/inverse');
  await expect(page.locator('table.grid tbody tr')).toHaveCount(1);
  await showAll(page);
  const rows = await page
    .locator('table.grid tbody tr')
    .evaluateAll((trs) =>
      trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent)),
    );
  expect(rows).toEqual([
    ['—', '1', '0', '1759', '0', '1', '550'],
    ['3', '0', '1', '550', '1', '−3', '109'],
    ['5', '1', '−3', '109', '−5', '16', '5'],
    ['21', '−5', '16', '5', '106', '−339', '4'],
    ['1', '106', '−339', '4', '−111', '355', '1'],
  ]);
  await expect(page.locator('td.answer')).toHaveText('355');
  await expect(page.locator('.result')).toContainText('550−1 mod 1759 = 355');
});

test('an inverse that does not exist is explained', async ({ page }) => {
  await page.goto('/lecture/inverse');
  await change(page);
  await page.getByLabel('m (the modulus)').fill('12');
  await page.getByLabel('b (find its inverse)').fill('8');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await showAll(page);
  await expect(page.locator('.result')).toContainText('no inverse');
});

test('the exponentiation table is drawn like Table 9.3 and fills column by column', async ({
  page,
}) => {
  await page.goto('/lecture/power?a=7&b=560&n=561');
  await page.getByRole('tab', { name: /Exponentiation algorithm/ }).click();
  await expect(page.locator('table.horizontal td:not(.ghost)')).toHaveCount(4);
  await showAll(page);
  const table = await page
    .locator('table.horizontal tr')
    .evaluateAll((trs) => trs.map((tr) => [...tr.children].map((cell) => cell.textContent)));
  expect(table).toEqual([
    ['i', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0'],
    ['bᵢ', '1', '0', '0', '0', '1', '1', '0', '0', '0', '0'],
    ['c', '1', '2', '4', '8', '17', '35', '70', '140', '280', '560'],
    ['f', '7', '49', '157', '526', '160', '241', '298', '166', '67', '1'],
  ]);
  await expect(page.locator('.result')).toContainText('561 = 1');
});

test('RSA by hand shows squaring, simplifying and multiplying: 88^7 mod 187 = 11', async ({
  page,
}) => {
  await page.goto('/lecture/rsa');
  await expect(page.getByText('n = p × q = 17 × 11 = 187')).toBeVisible();
  await expect(page.getByText('{7, 187}', { exact: true })).toBeVisible();
  await expect(page.getByText('{23, 187}', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '2 · Encrypt' }).click();
  const lines = page.locator('.hand ol.lines li');
  await expect(lines.nth(1)).toContainText('7744');
  await expect(lines.nth(1)).toContainText('77');
  await expect(lines.nth(2)).toContainText('5929');
  await expect(lines.nth(2)).toContainText('132');
  await expect(lines.nth(3)).toContainText('88 × 77 = 6776');
  await expect(lines.nth(4)).toContainText('44 × 132 = 5808');
  await expect(page.locator('.hand .result strong')).toHaveText('11');
  await page.getByRole('button', { name: 'Next: decrypt →' }).click();
  await expect(page.locator('.hand .result strong')).toHaveText('88');
  await expect(page.getByText('we got the original message back')).toBeVisible();
});

test('RSA explains a bad choice and accepts a new key', async ({ page }) => {
  await page.goto('/lecture/rsa');
  await change(page);
  await page.getByLabel('p (prime)').fill('15');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.getByRole('alert')).toContainText('p = 15 is not prime');
  await page.getByLabel('p (prime)').fill('61');
  await page.getByLabel('q (prime)').fill('53');
  await page.getByLabel('e (public exponent)').fill('17');
  await page.getByLabel('M (message number', { exact: false }).fill('65');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.getByText('{2753, 3233}', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '2 · Encrypt' }).click();
  await expect(page.locator('.hand .result strong')).toHaveText('2790');
});

test('Miller–Rabin follows the lecture examples', async ({ page }) => {
  await page.goto('/lecture/primality');
  await expect(page.locator('ol.mr-steps > li')).toHaveCount(1);
  await showAll(page);
  await expect(page.locator('div.result')).toContainText('Maybe prime');
  await page.getByRole('button', { name: /n = 221, a = 5/ }).click();
  await showAll(page);
  await expect(page.locator('div.result.bad')).toContainText('Composite');
  await expect(page.locator('ol.mr-steps')).toContainText('112');
  await expect(page.locator('ol.mr-steps')).toContainText('168');
  await change(page);
  await page.getByLabel('n (odd, at least 5)').fill('28');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.getByRole('alert')).toContainText('even');
});

test('CRT rebuilds A from its residues and speeds up RSA decryption', async ({ page }) => {
  await page.goto('/lecture/crt');
  await showAll(page);
  await expect(resultText(page)).toContainText('A ≡ 52 (mod 105)');
  await change(page);
  await page.getByLabel('Moduli m₁, m₂, … (pairwise relatively prime)').fill('6, 9');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.getByRole('alert')).toContainText('gcd(6, 9) = 3');
  await page.getByRole('tab', { name: 'Faster RSA decryption' }).click();
  await showAll(page);
  await expect(resultText(page)).toContainText('M = 88');
  await expect(resultText(page)).toContainText('same 88');
});

test('Why RSA works: two facts, then the proof with real numbers', async ({ page }) => {
  await page.goto('/lecture/why');
  await expect(page.getByText('φ(187) = 16 × 10 = 160')).toBeVisible();
  await showAll(page);
  await expect(page.locator('ol.mr-steps')).toContainText('1 + 1 × 160');
  await expect(page.locator('ol.mr-steps')).toContainText('the original message');
});

test('Signatures verify, and a forged message is rejected', async ({ page }) => {
  await page.goto('/lecture/signatures');
  await showAll(page);
  await expect(page.locator('p.ok')).toContainText('authentic');
  await change(page);
  await page.getByLabel('Message Alice receives').fill('89');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await showAll(page);
  await expect(page.locator('p.warn')).toContainText('does not belong');
});

test('Attack 1 factors n and reads the message, including a 12-digit key', async ({ page }) => {
  await page.goto('/lecture/factoring');
  await showAll(page);
  await expect(page.locator('.result.bad')).toContainText('The message was 88');
  await page.getByRole('button', { name: '12-digit key (e = 65537)' }).click();
  await showAll(page);
  await expect(page.locator('.result.bad')).toContainText('The message was 123456');
});

test('Attack 2 recovers M from three ciphertexts with e = 3', async ({ page }) => {
  await page.goto('/lecture/small-e');
  await showAll(page);
  await expect(page.locator('.result.bad')).toContainText('Recovered M = 100');
  await change(page);
  await page.getByLabel('The recipients’ moduli (pairwise relatively prime)').fill('187, 187, 667');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.getByRole('alert')).toContainText('gcd(187, 187)');
});

test('Attack 3 matches the ciphertext; textbook repeats, OAEP differs', async ({ page }) => {
  await page.goto('/lecture/guessing');
  await showAll(page);
  await expect(page.locator('li.hit')).toContainText('equals C');
  await page.getByText('The defence: random padding (OAEP)').click();
  await page.getByRole('button', { name: /Encrypt “YES” twice/ }).click();
  const lines = page.locator('.collapse-body p.num');
  await expect(lines).toHaveCount(4);
  const [a, b, c, d] = (await lines.allTextContents()).map((text) => text.replace(/^\w+: /, ''));
  expect(a).toBe(b);
  expect(c).not.toBe(d);
  await expect(page.getByText('Identical: an attacker can compare guesses.')).toBeVisible();
  await expect(page.getByText(/Different every time/)).toBeVisible();
});

test('Keys: demo keys are listed, a key can be made by hand and appears under My keys', async ({
  page,
}) => {
  await page.goto('/lecture/keys');
  await expect(page.getByText('Built-in demo keys (3)')).toBeVisible();
  await page.getByRole('tab', { name: 'By hand (p, q, e)' }).click();
  await page.getByRole('button', { name: 'Save as one of my keys' }).click();
  await expect(page.getByRole('status')).toContainText('Saved');
  await expect(page.getByRole('status')).not.toContainText('d =');
  await expect(page.locator('ul.keylist .keycard').first()).toContainText('Lecture-style key');
  await expect(page.locator('ul.keylist .keycard').first()).toContainText('Active');
  await page.getByLabel('p (prime)').fill('15');
  await page.getByRole('button', { name: 'Save as one of my keys' }).click();
  await expect(page.getByRole('alert')).toContainText('not prime');
});

test('Contacts: add a public key, then it can be verified', async ({ page }) => {
  await page.goto('/lecture/contacts');
  const pub = JSON.stringify({ format: 'rsa-lab-public-v2', name: 'Sami', n: ref.n, e: ref.e });
  await page.getByLabel('Their public key (text from a .pub file)').fill(pub);
  await page.getByRole('button', { name: 'Add contact' }).click();
  await expect(page.getByRole('status').first()).toContainText('Added Sami');
  const card = page.locator('ul.keylist .keycard').first();
  await expect(card).toContainText('Not verified yet');
  await card.getByText('Verify, rename or delete').click();
  await card.getByLabel(/The fingerprint matches/).check();
  await expect(card).toContainText('Fingerprint verified');
  await page.getByLabel('Their public key (text from a .pub file)').fill('{"hello": 1}');
  await page.getByRole('button', { name: 'Add contact' }).click();
  await expect(page.getByRole('alert')).toContainText('public-key');
});

test('Messages: encrypt for Alice and decrypt it, with and without a signature', async ({
  page,
}) => {
  await page.goto('/lecture/messages');
  await page.getByLabel('Message to encrypt').fill('Meet at 5 · مرحبا');
  await page.getByRole('button', { name: 'Encrypt message' }).click();
  await expect(page.locator('#envelope-out')).toHaveValue(/^rsa-lab\.v2:/);
  await page.getByRole('button', { name: 'Use the envelope I just made' }).click();
  await page.getByRole('button', { name: 'Decrypt', exact: true }).click();
  await expect(page.locator('.recovered')).toHaveText('Meet at 5 · مرحبا');
  await expect(page.locator('.sigline')).toContainText('Not signed');

  await page.getByText('Options: how to encrypt, and signing').click();
  await page.getByLabel('Also sign it, so the receiver knows it is from me').check();
  await page.getByRole('button', { name: 'Encrypt message' }).click();
  await page.getByRole('button', { name: 'Use the envelope I just made' }).click();
  await page.getByRole('button', { name: 'Decrypt', exact: true }).click();
  await expect(page.locator('.sigline')).toContainText('Signed by');
  await expect(page.locator('.sigline')).toContainText('valid');
});

test('Messages: a message too long for OAEP is explained and cannot be sent', async ({ page }) => {
  await page.goto('/lecture/messages');
  await page.getByText('Options: how to encrypt, and signing').click();
  await page.getByLabel(/RSA with OAEP padding/).check();
  await page.getByLabel('Message to encrypt').fill('x'.repeat(400));
  await expect(page.getByRole('alert')).toContainText('fits at most');
  await expect(page.getByRole('button', { name: 'Encrypt message' })).toBeDisabled();
});

test('Messages: a file is encrypted and decrypted again', async ({ page }) => {
  await page.goto('/lecture/messages');
  await page.getByRole('tab', { name: 'A file' }).click();
  await page.getByLabel('File to encrypt (up to 25 MiB)').setInputFiles({
    name: 'note.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('file contents 123'),
  });
  await page.getByRole('button', { name: 'Encrypt file' }).click();
  await expect(page.locator('#envelope-out')).toHaveValue(/^rsa-lab\.v2:/);
  await page.getByRole('button', { name: 'Use the envelope I just made' }).click();
  await page.getByRole('button', { name: 'Decrypt', exact: true }).click();
  await expect(page.getByText('Decrypted the file')).toContainText('note.txt');
  await expect(page.getByRole('button', { name: 'Save the file' })).toBeVisible();
});

test('Practice: a wrong answer, a hint, the steps and a correct answer', async ({ page }) => {
  await page.goto('/lecture/practice');
  const first = page.locator('li.question').first();
  await first.getByLabel('Your answer').fill('3');
  await first.getByRole('button', { name: 'Check' }).click();
  await expect(first.locator('.verdict')).toContainText('Not quite');
  await first.getByText('Hint', { exact: true }).click();
  await expect(first).toContainText('gcd(a, b) = gcd(b, a mod b)');
  await first.getByText('Show the steps and the answer').click();
  await expect(first.locator('table.grid tbody tr')).toHaveCount(11);
  await first.getByLabel('Your answer').fill('2');
  await first.getByRole('button', { name: 'Check' }).click();
  await expect(first.locator('.verdict')).toContainText('Correct');
  await expect(page.getByText('1 of 9 correct')).toBeVisible();
});

test('the course map works on a phone and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of [
    '/',
    '/lecture/inverse',
    '/lecture/power',
    '/lecture/rsa',
    '/lecture/crt',
    '/lecture/factoring',
    '/lecture/keys',
    '/lecture/messages',
    '/lecture/practice',
  ]) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.goto('/lecture/gcd');
  await page.getByText('Course map', { exact: true }).click();
  await page.locator('.map-toggle').getByRole('link', { name: 'Inverse mod m' }).click();
  await expect(page).toHaveURL(/\/lecture\/inverse$/);
});

test('the numbers panel is folded, opens on request and folds again with the new numbers', async ({
  page,
}) => {
  await page.goto('/lecture/gcd');
  await expect(page.locator('.numbers-bar')).toContainText('a = 1970, b = 1066');
  await expect(page.getByLabel('a', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Change the numbers' }).click();
  await page.getByLabel('a', { exact: true }).fill('48');
  await page.getByLabel('b', { exact: true }).fill('18');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('.numbers-bar')).toContainText('a = 48, b = 18');
  await showAll(page);
  await expect(page.locator('.result')).toContainText('gcd(48, 18) = 6');
  // A mistake keeps the panel open so the message is next to the fields.
  await page.getByRole('button', { name: 'Change the numbers' }).click();
  await page.getByLabel('b', { exact: true }).fill('abc');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.getByRole('alert')).toContainText('whole number');
  await expect(page.getByLabel('b', { exact: true })).toBeVisible();
});

test('every lesson has a short idea, why you need it, and a words list; the tab title follows', async ({
  page,
}) => {
  await page.goto('/lecture/gcd');
  await expect(page.locator('.idea')).toContainText('biggest number that divides both');
  await expect(page.locator('.used-for')).toContainText('Why you need it');
  await expect(page).toHaveTitle(/Greatest common divisor · RSA Lab/);
  await page.getByText('Words you need').click();
  await expect(page.locator('.words dt', { hasText: 'Relatively prime' })).toBeVisible();
});

test('the big picture is a five-step animation with clear buttons', async ({ page }) => {
  await page.goto('/lecture/start');
  const next = page.getByRole('button', { name: 'Next step →' });
  await expect(page.getByText('Picture 1 of 5')).toBeVisible();
  await expect(page.locator('.explain')).toContainText('Bob makes two keys');
  await next.click();
  await expect(page.locator('.explain')).toContainText('Bob shares his public key');
  await next.click();
  await next.click();
  await expect(page.locator('.explain')).toContainText('Eve sees 11 go by');
  await next.click();
  await expect(page.locator('.explain')).toContainText('Bob unlocks it');
  const finished = page.getByRole('button', { name: 'Finished' });
  await expect(finished).toBeDisabled();
  await finished.focus();
  await expect(finished).toBeFocused();
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByText('Picture 4 of 5')).toBeVisible();
  await expect(page.getByRole('link', { name: /Start the maths/ })).toBeVisible();
});

test('the Next step button stays on screen while a long table grows', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto('/lecture/gcd');
  await showAll(page);
  const next = page.getByRole('button', { name: /Next step|Finished/ });
  await page.mouse.wheel(0, 450);
  await expect
    .poll(async () => {
      const box = await next.boundingBox();
      return box !== null && box.y > 0 && box.y + box.height <= 700;
    })
    .toBe(true);
});

test('RSA by hand explains each step in plain words and animates lock and unlock', async ({
  page,
}) => {
  await page.goto('/lecture/rsa');
  await expect(page.locator('.rsa-step .plain').first()).toContainText('Pick two prime numbers');
  await expect(page.locator('svg.rsaflow')).toHaveAttribute('aria-label', /ready to be sent/);
  await page.getByRole('button', { name: 'Next: encrypt →' }).click();
  await expect(page.locator('svg.rsaflow')).toHaveAttribute('aria-label', /turns 88 into 11/);
  await page.getByRole('button', { name: 'Next: decrypt →' }).click();
  await expect(page.locator('svg.rsaflow')).toHaveAttribute('aria-label', /turns 11 back into 88/);
});

test('each lesson ends with a try-it link to the matching practice question', async ({ page }) => {
  await page.goto('/lecture/inverse');
  await page.getByRole('link', { name: /Try a practice question/ }).click();
  await expect(page).toHaveURL(/practice\?q=inverse$/);
  await expect(page.locator('li.question.focus h3')).toContainText('Inverse mod m');
});

test('CRT example button works even when the residues mode is selected', async ({ page }) => {
  await page.goto('/lecture/crt');
  await page.getByRole('button', { name: 'Change the numbers' }).click();
  await page.getByLabel('the residues').check();
  await page.getByLabel('Residues a₁, a₂, … (one per modulus)').fill('2, 2, 2');
  await page.getByRole('button', { name: 'Use the lecture example' }).click();
  await showAll(page);
  await expect(page.locator('ol.mr-steps')).toContainText('Start with A = 52');
  await expect(resultText(page)).toContainText('A ≡ 52 (mod 105)');
});

test('tabs follow the keyboard pattern and have a labelled panel', async ({ page }) => {
  await page.goto('/lecture/keys');
  const hand = page.getByRole('tab', { name: 'By hand (p, q, e)' });
  const generate = page.getByRole('tab', { name: 'Generate a real key' });
  const imports = page.getByRole('tab', { name: 'Import a key file' });
  await expect(hand).toHaveAttribute('aria-selected', 'true');
  await expect(hand).toHaveAttribute('tabindex', '0');
  await expect(generate).toHaveAttribute('tabindex', '-1');
  await hand.focus();
  await page.keyboard.press('ArrowRight');
  await expect(generate).toHaveAttribute('aria-selected', 'true');
  await expect(generate).toBeFocused();
  await page.keyboard.press('End');
  await expect(imports).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(hand).toHaveAttribute('aria-selected', 'true');
  const panel = page.getByRole('tabpanel');
  await expect(panel).toHaveAttribute('aria-labelledby', await hand.getAttribute('id'));
  await expect(await hand.getAttribute('aria-controls')).toBe(await panel.getAttribute('id'));
});

test('an encrypted message keeps the name it was made for when the recipient changes', async ({
  page,
}) => {
  await page.goto('/lecture/messages');
  await page.getByRole('button', { name: 'Encrypt message' }).click();
  await expect(page.locator('div.result').first()).toContainText('Send this text to Alice.');
  await page.getByLabel('Lock with the public key of').selectOption('demo-bob');
  await expect(page.locator('div.result').first()).toContainText('Send this text to Alice.');
});

test('GCD lets the student check an answer', async ({ page }) => {
  await page.goto('/lecture/gcd');
  await page.getByLabel(/Work it out on paper/).fill('3');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Not quite' })).toBeVisible();
  await page.getByLabel(/Work it out on paper/).fill('2');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
});

test('Extended Euclid says A1 and B1 can be skipped, and the contents menu collapses', async ({
  page,
}) => {
  await page.goto('/lecture/inverse');
  await expect(page.getByText('You can skip A1 and B1.')).toBeVisible();
  await page.getByRole('button', { name: 'Next step →' }).click();
  await page.getByRole('button', { name: 'Hide A1 and B1' }).click();
  await expect(page.locator('table.eea th', { hasText: 'A1' })).toBeHidden();
  const rail = page.getByRole('navigation', { name: 'Course map' }).first();
  await page.getByRole('button', { name: 'Hide contents' }).click();
  await expect(rail).toBeHidden();
  await page.getByRole('button', { name: 'Show contents' }).click();
  await expect(rail).toBeVisible();
});
