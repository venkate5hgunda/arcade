import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
  await page.getByLabel('Five letter guess').fill('ALLEY');
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
  await page.getByLabel('Five letter guess').fill('APPLE');
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
  await page.getByRole('button', { name: 'Z', exact: true }).click();
  await expect(page.getByLabel('Five letter guess')).toHaveValue('Z');
  await page.getByRole('button', { name: 'Delete letter' }).click();
  await expect(page.getByLabel('Five letter guess')).toHaveValue('');
  await page.getByLabel('Five letter guess').fill('A');
  await page.getByRole('button', { name: 'Guess', exact: true }).click();
  await expect(page.getByText('Enter five letters.')).toBeVisible();
  await page.getByLabel('Five letter guess').fill('ZZZZZ');
  await page.getByRole('button', { name: 'Guess', exact: true }).click();
  await expect(page.getByText(/outside this practice word list/)).toBeVisible();
  await page.getByLabel('Five letter guess').fill('ABOUT');
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
  await page.getByLabel('Five letter guess').fill('APP');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New match' }).click();
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(page.getByLabel('Five letter guess')).toHaveValue('');
});
