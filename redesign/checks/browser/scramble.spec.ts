import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { newScramble } from '../../src/lib/scramble.ts';
async function tapTiles(page: Page, word: string) {
  const tiles = page.getByRole('group', { name: 'Shuffled letters' });
  for (const letter of word)
    await tiles
      .getByRole('button', { name: letter, exact: true })
      .and(tiles.locator(':enabled'))
      .first()
      .click();
}

test('Word Scramble restores hints and progress, solves, skips and completes a round', async ({
  page,
}) => {
  const state = {
    ...newScramble('5'),
    word: 'ARCADE',
    letters: ['C', 'A', 'A', 'R', 'D', 'E'],
    pool: ['PUZZLE'],
    round: 4,
    correctCount: 2,
    hintsUsed: 0,
    hinted: false,
    solved: false,
  };
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ 'word-scramble': { state, savedAt: Date.now() } }),
      ),
    state,
  );
  await page.goto('/#/game/word-scramble');
  await expect(
    page.getByRole('heading', { name: 'Word 4 of 5' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await expect(page.getByText('Starts with A.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Starts with A.')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await tapTiles(page, 'CAARDE');
  await page.getByRole('button', { name: 'Guess', exact: true }).click();
  await expect(page.getByText('Not quite — try again.')).toBeVisible();
  for (let i = 0; i < 6; i++)
    await page.getByRole('button', { name: 'Delete letter' }).click();
  await tapTiles(page, 'ARCADE');
  await page.getByRole('button', { name: 'Guess', exact: true }).click();
  await expect(page.getByText('Correct!')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Word 5 of 5' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Skip word' }).click();
  await expect(page.getByText('You solved 3 of 5 words.')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')[
          'word-scramble'
        ],
    ),
  ).toBeUndefined();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Word 1 of 5' }),
  ).toBeVisible();
});

test('a restored solved word advances once and a new match clears pending input', async ({
  page,
}) => {
  const state = {
    ...newScramble('5'),
    word: 'ARCADE',
    letters: ['C', 'A', 'A', 'R', 'D', 'E'],
    pool: ['PUZZLE'],
    round: 1,
    correctCount: 1,
    hintsUsed: 0,
    hinted: false,
    solved: true,
  };
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ 'word-scramble': { state, savedAt: Date.now() } }),
      ),
    state,
  );
  await page.goto('/#/game/word-scramble');
  await expect(
    page.getByRole('heading', { name: 'Word 2 of 5' }),
  ).toBeVisible();
  await tapTiles(page, 'PUZ');
  await expect(page.getByLabel('Your answer')).toHaveText('PUZ');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New match' }).click();
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(page.getByLabel('Your answer')).toHaveText(
    'Tap the letters below',
  );
});

test('Scramble accepts physical typing and consumes each repeated tile once', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Exercises desktop hardware keys.');
  const state = {
    ...newScramble('5'),
    word: 'ARCADE',
    letters: ['C', 'A', 'A', 'R', 'D', 'E'],
    pool: ['PUZZLE'],
  };
  await page.addInitScript((state) => {
    localStorage.setItem(
      'arcade:game.sessions',
      JSON.stringify({
        'word-scramble': { state, savedAt: Date.now() },
      }),
    );
  }, state);
  await page.goto('/#/game/word-scramble');
  await expect(page.getByLabel('Your answer')).toBeVisible();
  await expect(page.locator('main input, main textarea')).toHaveCount(0);
  await page.keyboard.type('ARCAAD');
  await expect(page.getByLabel('Your answer')).toHaveText('ARCAD');
  await page.keyboard.type('C');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('DE');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Correct!', { exact: true })).toBeVisible();
});
