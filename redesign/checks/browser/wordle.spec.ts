import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function tapWord(page: Page, word: string) {
  const keyboard = page.getByRole('group', { name: 'Letter keyboard' });
  for (const letter of word)
    await keyboard
      .getByRole('button', { name: new RegExp(`^${letter}(?::|$)`) })
      .click();
}

test('Wordle restores, scores repeated letters, wins, clears the checkpoint and starts a new word', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'arcade:game.sessions',
      JSON.stringify({
        wordle: {
          state: { answer: 'APPLE', guesses: [] },
          savedAt: Date.now(),
        },
      }),
    ),
  );
  await page.goto('/#/game/wordle');
  await tapWord(page, 'ALLEY');
  await page.getByRole('button', { name: 'Guess', exact: true }).click();
  await expect(
    page.locator('.wordle-board').getByLabel('A: correct'),
  ).toBeVisible();
  await expect(
    page.locator('.wordle-board').getByLabel('L: present'),
  ).toBeVisible();
  await expect(
    page.locator('.wordle-board').getByLabel('L: absent'),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator('.wordle-board').getByLabel('L: present'),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await tapWord(page, 'APPLE');
  await page.getByRole('button', { name: 'Guess', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Word solved!' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}').wordle,
    ),
  ).toBeUndefined();
  await page.getByRole('button', { name: 'New word' }).click();
  await expect(
    page.getByRole('heading', { name: 'Guess 1 of 6' }),
  ).toBeVisible();
});

test('Wordle rejects incomplete and unknown guesses and reveals the answer after six misses', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'arcade:game.sessions',
      JSON.stringify({
        wordle: {
          state: {
            answer: 'APPLE',
            guesses: ['SHEEP', 'LEVEL', 'SPEED', 'ALLEY', 'ACORN'],
          },
          savedAt: Date.now(),
        },
      }),
    ),
  );
  await page.goto('/#/game/wordle');
  const board = page.getByRole('group', { name: 'Guess board' });
  await tapWord(page, 'Z');
  await expect(board.getByLabel('Z: unsubmitted')).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete letter' }).click();
  await expect(board.getByLabel('Z: unsubmitted')).toHaveCount(0);
  await tapWord(page, 'A');
  await page.getByRole('button', { name: 'Guess', exact: true }).click();
  await expect(page.getByText('Enter five letters.')).toBeVisible();
  await page.getByRole('button', { name: 'Delete letter' }).click();
  await tapWord(page, 'ZZZZZ');
  await page.getByRole('button', { name: 'Guess', exact: true }).click();
  await expect(page.getByText(/outside this practice word list/)).toBeVisible();
  for (let i = 0; i < 5; i++)
    await page.getByRole('button', { name: 'Delete letter' }).click();
  await tapWord(page, 'ABOUT');
  await page.getByRole('button', { name: 'Guess', exact: true }).click();
  await expect(
    page.getByText('The word was APPLE. Try another!'),
  ).toBeVisible();
});

test('Wordle clears unfinished input when starting a fresh match', async ({
  page,
}) => {
  await page.goto('/#/game/wordle');
  await page.getByRole('button', { name: 'Start playing' }).click();
  await tapWord(page, 'APP');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New match' }).click();
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(
    page.getByRole('img', { name: 'Empty', exact: true }),
  ).toHaveCount(30);
});

test('Wordle starts with the entire play area visible and no software keyboard input', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Exercises the phone viewport with touch input.');
  for (const [width, height] of [
    [320, 568],
    [390, 664],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('arcade:game.sessions'));
    await page.goto('/#/game/wordle');
    const start = page.getByRole('button', { name: 'Start playing' });
    await expect(start).toBeVisible();
    await page.evaluate(() => scrollTo(0, 64));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    const startBox = (await start.boundingBox())!;
    await page.touchscreen.tap(
      startBox.x + startBox.width / 2,
      startBox.y + startBox.height / 2,
    );
    const keyboard = page.getByRole('group', { name: 'Letter keyboard' });
    const board = page.getByRole('group', { name: 'Guess board' });
    await expect(board).toBeInViewport({ ratio: 1 });
    await expect(keyboard).toBeInViewport({ ratio: 1 });
    const key = (await keyboard
      .getByRole('button', { name: 'Q', exact: true })
      .boundingBox())!;
    expect(key.width).toBeGreaterThanOrEqual(24);
    expect(key.height).toBeGreaterThanOrEqual(44);
    await expect(
      page.locator('main input, main textarea, main [contenteditable]'),
    ).toHaveCount(0);
    await keyboard.getByRole('button', { name: 'Z', exact: true }).tap();
    await expect(board.getByLabel('Z: unsubmitted')).toHaveCount(1);
    await keyboard.getByRole('button', { name: 'Guess' }).tap();
    await expect(page.getByText('Enter five letters.')).toBeVisible();
    await expect(keyboard).toBeInViewport({ ratio: 1 });
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    for (let i = 0; i < 4; i++)
      await keyboard.getByRole('button', { name: 'Z', exact: true }).tap();
    await keyboard.getByRole('button', { name: 'Guess' }).tap();
    await expect(
      page.getByText(/outside this practice word list/),
    ).toBeVisible();
    await expect(keyboard).toBeInViewport({ ratio: 1 });
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await keyboard.getByRole('button', { name: 'Delete letter' }).tap();
  }
});

test('Wordle accepts desktop typing, Backspace and Enter without a text field', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Exercises desktop hardware keys.');
  await page.goto('/#/game/wordle');
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(page.getByRole('group', { name: 'Guess board' })).toBeVisible();
  await page.keyboard.type('ALLEX');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('Y');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('img', { name: /^Y: (correct|present|absent)$/ }),
  ).toBeVisible();
  const home = page.getByRole('link', { name: 'Arcade home' });
  await home.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/$/);
});
