import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { newCharades } from '../../src/lib/charades.ts';
import type { CharadesState } from '../../src/lib/charades.ts';
async function seed(page: Page, state: CharadesState) {
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ 'dumb-charades': { state, savedAt: Date.now() } }),
      ),
    state,
  );
  await page.goto('/#/game/dumb-charades');
}
test('Charades complete match rotates actors, preserves timer and starts again', async ({
  page,
}) => {
  let s = newCharades(4, 60, 'classic', {});
  s = { ...s, score: [5, 4], team: 1, phase: 'setup' };
  await seed(page, s);
  await expect(
    page.getByRole('heading', { name: 'Team 2 · Player 3' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Show word' }).click();
  await expect(
    page
      .getByText('MOVIE', { exact: true })
      .or(page.locator('.charades-prompt > p').first()),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Act this out!' }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Team guessed it!' }).click();
  await expect(page.getByRole('heading', { name: 'Correct!' })).toBeVisible();
  await page.getByRole('button', { name: 'Next round' }).click();
  await expect(
    page.getByRole('heading', { name: 'A tie game!' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')[
          'dumb-charades'
        ],
    ),
  ).toBeUndefined();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/charades-${test.info().project.name}.png`,
  });
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Team 1 · Player 1' }),
  ).toBeVisible();
});
test('Charades loads movie records, filters them, presents cast and synopsis and restores', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/#/game/dumb-charades');
  await page.getByText('Match options', { exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Category' })
    .selectOption('telugu-movies');
  await expect(page.getByText(/movies match/)).toBeVisible();
  await page.getByLabel('From year').fill('2024');
  await page.getByLabel('To year').fill('2024');
  await page.getByLabel('Turn timer (10–360 seconds)').fill('20');
  await page.getByRole('button', { name: 'Start playing →' }).click();
  await page.getByRole('button', { name: 'Show word' }).click();
  await expect(page.locator('.charades-prompt > p').first()).toContainText(
    '(2024)',
  );
  await expect(page.locator('.charades-prompt')).toContainText('Starring:');
  await expect(page.locator('.charades-prompt')).toContainText(
    'LifeStories is a film',
  );
  const prompt = await page.locator('.charades-prompt > p').first().innerText();
  await page.reload();
  await expect(page.locator('.charades-prompt > p').first()).toHaveText(prompt);
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByText(/Difficulty \d\/5/)).toBeVisible();
  await page.getByText('Why this rating?').click();
  await expect(page.locator('.movie-brief')).toContainText('actability');
  await page.getByRole('button', { name: 'Switch teams' }).click();
  await expect(
    page.getByRole('heading', { name: 'Team 2 · Player 3' }),
  ).toBeVisible();
});
test('expired Charades timer scores once and the movie library can retry', async ({
  page,
}) => {
  const s = newCharades(2, 10, 'classic', {});
  s.phase = 'acting';
  s.word = 'MOVIE';
  s.wordsUsed = ['MOVIE'];
  s.deadline = Date.now() - 100;
  await seed(page, s);
  await expect(page.getByRole('heading', { name: 'Skipped' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Skipped' })).toBeVisible();
  await page.route('**/data/movies/index.json', (route) =>
    route.fulfill({ status: 503, body: 'offline' }),
  );
  await page.reload();
  await expect(page.getByText(/Movie index could not load/)).toBeVisible();
  await page.unroute('**/data/movies/index.json');
  await page.getByRole('button', { name: 'Retry movie library' }).click();
  await expect(page.getByRole('heading', { name: 'Skipped' })).toBeVisible();
});
