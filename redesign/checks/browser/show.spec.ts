import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function seed(page: import('@playwright/test').Page, matched: boolean) {
  const state = {
    players: 3,
    rounds: 3,
    round: 3,
    scores: [0, 0, 0],
    hands: matched
      ? [
          [0, 0, 0, 0],
          [1, 1, 1, 1],
          [2, 2, 2, 2],
        ]
      : [
          [0, 0, 1, 2],
          [0, 1, 1, 2],
          [0, 1, 2, 2],
        ],
    picks: [],
    phase: 'passing',
    stack: [],
  };
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ 'show-star': { state, savedAt: Date.now() } }),
      ),
    state,
  );
  await page.goto('/#/game/show-star');
}
test('Show keeps chits covered across handoffs, passes simultaneously and restores', async ({
  page,
}) => {
  await seed(page, false);
  await expect(
    page.getByRole('group', { name: 'Your four chits' }),
  ).toHaveCount(0);
  for (let i = 1; i <= 3; i++) {
    await page.getByRole('button', { name: 'Reveal my four chits' }).click();
    if (i === 1) {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page
      .getByRole('group', { name: 'Your four chits' })
      .getByRole('button')
      .first()
      .click();
    await expect(
      page.getByRole('group', { name: 'Your four chits' }),
    ).toHaveCount(0);
  }
  await expect(
    page.getByText('Pass to Player 1. Everyone else, look away.'),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('group', { name: 'Your four chits' }),
  ).toHaveCount(0);
});
test('Show scores slap order, completes a match and starts again', async ({
  page,
}) => {
  await seed(page, true);
  await page.getByRole('button', { name: 'Reveal my four chits' }).click();
  await page
    .getByRole('button', { name: 'SLAP! I have four matching' })
    .click();
  await page.getByRole('button', { name: 'Player 2 — SLAP!' }).click();
  await page.getByRole('button', { name: 'Player 3 — SLAP!' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins!' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')[
          'show-star'
        ],
    ),
  ).toBeUndefined();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(
    page.getByText('Pass to Player 1. Everyone else, look away.'),
  ).toBeVisible();
});
