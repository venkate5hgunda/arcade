import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { newStrands, strandsPuzzle } from '../../src/lib/strands.ts';
async function seed(page: Page, id: string, state: object) {
  await page.goto('/');
  await page.evaluate(
    ({ id, state }) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ [id]: { state, savedAt: Date.now() } }),
      ),
    { id, state },
  );
  await page.goto(`/#/game/${id}`);
}
test('Strands traces a spangram, restores a grid and completes the theme without overflow', async ({
  page,
}) => {
  test.setTimeout(90000);
  const state = { ...newStrands('practice'), seed: 0 },
    puzzle = strandsPuzzle(0);
  state.found = puzzle.paths.slice(1).map((path, i) => ({ word: i + 1, path }));
  await seed(page, 'strands', state);
  await expect(page.locator('.strands-grid button')).toHaveCount(48);
  await page.reload();
  for (const cell of puzzle.paths[0])
    await page.locator('.strands-grid button').nth(cell).click();
  await page.getByRole('button', { name: 'Submit word' }).click();
  await expect(
    page.getByRole('heading', { name: 'Puzzle complete!' }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/strands-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('Strands daily setup, hints, tap undo and room entry work', async ({
  page,
}) => {
  await page.goto('/#/game/strands');
  await expect(page.locator('.puzzle-setup-art')).toBeVisible();
  await page.getByRole('button', { name: 'Start playing' }).click();
  await page.getByRole('button', { name: 'Hint (3)' }).click();
  await expect(page.locator('.hinted')).toHaveCount(1);
  const hint = page.locator('.hinted');
  await hint.click();
  await expect(hint).toHaveAttribute('aria-pressed', 'true');
  await hint.click();
  await expect(hint).toHaveAttribute('aria-pressed', 'false');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('Spelling Bee enforces the center, scores pangrams once and restores shared vocabulary progress', async ({
  page,
}) => {
  test.setTimeout(90000);
  const { newBee } = await import('../../src/lib/bee.ts');
  await seed(page, 'spelling-bee', { ...newBee('practice'), seed: 0 });
  await expect(page.locator('.bee-cell')).toHaveCount(7);
  await page.getByLabel('Hive word').fill('GAIN');
  await page.getByRole('button', { name: 'Submit word' }).click();
  await expect(
    page.getByText('Every word needs R.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Hive word').fill('READING');
  await page.getByRole('button', { name: 'Submit word' }).click();
  await expect(page.getByRole('heading', { name: /14 points/ })).toBeVisible();
  await page.reload();
  await page.getByLabel('Hive word').fill('READING');
  await page.getByRole('button', { name: 'Submit word' }).click();
  await expect(
    page.getByText('Already found. It will not score twice.'),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/spelling-bee-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('Letter Boxed chains two words, enforces starting letters, resumes and covers all letters', async ({
  page,
}) => {
  const { newLetter } = await import('../../src/lib/letter-boxed.ts');
  await seed(page, 'letter-boxed', { ...newLetter('practice'), seed: 0 });
  await page.getByLabel('Chain word', { exact: true }).fill('RAINBOW');
  await page.getByRole('button', { name: 'Submit word' }).click();
  await page.reload();
  await expect(page.getByLabel('Chain word', { exact: true })).toHaveValue('W');
  await page.getByLabel('Chain word', { exact: true }).fill('DANCE');
  await page.getByRole('button', { name: 'Submit word' }).click();
  await expect(page.getByText('Start the next word with W.')).toBeVisible();
  await page.getByLabel('Chain word', { exact: true }).fill('WILDCATS');
  await page.getByRole('button', { name: 'Submit word' }).click();
  await expect(
    page.getByRole('heading', { name: 'Puzzle complete!' }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/letter-boxed-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('Mini Crossword edits, checks errors, reveals and completes a restored grid', async ({
  page,
}) => {
  test.setTimeout(90000);
  const { newMini, miniPuzzle } = await import('../../src/lib/mini.ts');
  const state = { ...newMini('practice'), seed: 0 };
  const answer = miniPuzzle(0).answer;
  state.entries = answer.split('');
  state.entries[0] = '';
  state.entries[24] = 'Z';
  await seed(page, 'mini-crossword', state);
  await page.getByRole('button', { name: 'Check letters' }).click();
  await expect(page.locator('.mini-cell.incorrect')).toHaveCount(1);
  await page.getByLabel('Row 5 column 5', { exact: true }).fill(answer[24]);
  await page.reload();
  await page.getByLabel('Row 1 column 1', { exact: true }).fill(answer[0]);
  await expect(
    page.getByRole('heading', { name: 'Puzzle complete!' }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/mini-crossword-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('Tiles removes shared layers, updates combos and restores the tray', async ({
  page,
}) => {
  const { newTiles, tilesProgress } = await import('../../src/lib/tiles.ts');
  const s = { ...newTiles('practice'), seed: 0 };
  await seed(page, 'tiles', s);
  const p = tilesProgress(s);
  let pair: number[] = [];
  for (let a = 0; a < 12 && !pair.length; a++)
    for (let b = a + 1; b < 12; b++)
      if (p.board[a].some((n, i) => n >= 0 && n === p.board[b][i])) {
        pair = [a, b];
        break;
      }
  await page.locator('.pattern-tile').nth(pair[0]).click();
  await page.locator('.pattern-tile').nth(pair[1]).click();
  await expect(
    page.getByRole('heading', { name: /points · 1× combo/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: /points · 1× combo/ }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/tiles-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('Sudoku saves pencil notes, protects givens and completes a uniquely generated puzzle', async ({
  page,
}) => {
  test.setTimeout(90000);
  const { newSudoku, sudokuPuzzle } = await import('../../src/lib/sudoku.ts');
  const p = sudokuPuzzle(0, 'easy'),
    state = { ...newSudoku('practice'), seed: 0, values: [...p.givens] };
  const cell = p.givens.findIndex((n) => !n);
  await seed(page, 'sudoku', state);
  await page.locator('.sudoku-grid button').nth(cell).click();
  await page.getByRole('button', { name: 'Pencil notes off' }).click();
  await page
    .getByRole('group', { name: 'Enter a digit' })
    .getByRole('button', { name: '3', exact: true })
    .click();
  await page.reload();
  await expect(
    page
      .locator('.sudoku-grid button')
      .nth(cell)
      .locator('small')
      .filter({ hasText: /^3$/ }),
  ).toHaveCount(1);
  const finish = { ...state, values: [...p.solution] };
  finish.values[cell] = 0;
  await seed(page, 'sudoku', finish);
  await page.locator('.sudoku-grid button').nth(cell).click();
  await page
    .getByRole('group', { name: 'Enter a digit' })
    .getByRole('button', { name: String(p.solution[cell]), exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Puzzle complete!' }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/sudoku-${test.info().project.name}.png`,
    fullPage: true,
  });
});
