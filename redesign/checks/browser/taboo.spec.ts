import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { newTaboo } from '../../src/lib/taboo.ts';
test('Taboo covers a restored card, tracks scores, keeps the deadline and finishes', async ({
  page,
}) => {
  const state = {
    ...newTaboo(30, 4),
    turn: 3,
    scores: [0, 0],
    phase: 'playing' as const,
    deadline: Date.now() + 6000,
  };
  state.deck = [...Array(50).keys()];
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ taboo: { state, savedAt: Date.now() } }),
      ),
    state,
  );
  await page.goto('/#/game/taboo');
  await expect(page.getByText('Bicycle', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal card and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Bicycle' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Correct +1' }).click();
  await expect(page.getByText('Team 2 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hide card' }).click();
  await expect(page.getByRole('heading', { name: 'Pizza' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pizza' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal card and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Pizza' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Final scores' })).toBeVisible(
    { timeout: 9000 },
  );
  await expect(page.getByText('Team 2 wins!')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}').taboo,
    ),
  ).toBeUndefined();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Team 1 · turn 1 of 4' }),
  ).toBeVisible();
});

test('Taboo honors legacy numeric setup preferences', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'arcade:game.settings:taboo',
      JSON.stringify({ duration: 90, turns: 8 }),
    ),
  );
  await page.goto('/#/game/taboo');
  await expect(page.getByText('90 seconds · 8 turns')).toBeVisible();
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(
    page.getByRole('heading', { name: 'Team 1 · turn 1 of 8' }),
  ).toBeVisible();
});
