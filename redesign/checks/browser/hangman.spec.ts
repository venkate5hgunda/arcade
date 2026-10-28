import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createHangman } from '../../src/lib/hangman.ts';
async function seed(page: import('@playwright/test').Page, players = '2') {
  const state = createHangman(players, () => 0);
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ hangman: { state, savedAt: Date.now() } }),
      ),
    state,
  );
  await page.goto('/#/game/hangman');
}
test('Hangman restores, alternates players, reveals repeats and finishes a word', async ({
  page,
}) => {
  await seed(page);
  await expect(
    page.getByRole('heading', { name: 'Player 1’s turn' }),
  ).toBeVisible();
  await page.keyboard.press('a');
  await expect(
    page.getByRole('heading', { name: 'Player 2’s turn' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('group', { name: '6-letter word' })
      .getByRole('img', { name: 'A' }),
  ).toHaveCount(2);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Player 2’s turn' }),
  ).toBeVisible();
  await page.getByText('Need a clue?').click();
  await expect(page.getByText('The word belongs to: Games.')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const letter of ['R', 'C', 'D', 'E'])
    await page.getByRole('button', { name: letter, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Word discovered!' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')
          .hangman,
    ),
  ).toBeUndefined();
  await page.getByRole('button', { name: 'Next word' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1’s turn' }),
  ).toBeVisible();
});
test('Hangman ends on six misses and reveals the word', async ({ page }) => {
  await seed(page, '1');
  for (const letter of ['B', 'F', 'G', 'H', 'I', 'J'])
    await page.getByRole('button', { name: letter, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A fresh chance awaits' }),
  ).toBeVisible();
  await expect(page.getByText('The word was ARCADE.')).toBeVisible();
});

test('Hangman clears old feedback when starting a fresh match', async ({
  page,
}) => {
  await seed(page, '1');
  await page.getByRole('button', { name: 'B', exact: true }).click();
  await expect(page.getByText(/B is not in the word/)).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New match' }).click();
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(page.getByText('Pick a letter or type A–Z.')).toBeVisible();
});
