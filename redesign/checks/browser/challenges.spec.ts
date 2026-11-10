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

test('Quoridor previews a wall, changes turns, restores it and completes a pawn race', async ({
  page,
}) => {
  test.setTimeout(90000);
  const { newQuoridor } = await import('../../src/lib/quoridor.ts');
  const state = { ...newQuoridor(), seed: 0 };
  await seed(page, 'quoridor', state);
  await page
    .getByRole('button', { name: 'Horizontal wall', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Row 4 column 4, wall anchor', exact: true })
    .click();
  await expect(page.locator('.quoridor-wall.preview')).toHaveCount(1);
  await page.getByRole('button', { name: 'Place wall', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 2’s turn' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('.quoridor-wall:not(.preview)')).toHaveCount(1);
  await seed(page, 'quoridor', { ...state, pawns: [67, 72] });
  await page
    .getByRole('button', { name: 'Row 9 column 5, legal move', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins!' }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/quoridor-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('all seven new games synchronize over real rooms and Sudoku survives a host reload', async ({
  page: host,
  browser,
}) => {
  test.setTimeout(300000);
  const { prepareLocalRoom } = await import('./room-helpers.ts');
  const { CHALLENGE_IDS } = await import('../../src/lib/challenges.ts');
  await prepareLocalRoom(host.context());
  const context = await browser.newContext();
  await prepareLocalRoom(context);
  const guest = await context.newPage();
  async function connect(reconnect = false) {
    if (reconnect) {
      await host.getByText('Room players (2)', { exact: true }).click();
      await host
        .getByRole('button', {
          name: 'Create reconnect invitation',
          exact: true,
        })
        .click();
    }
    await expect(host.getByLabel('Invitation to share')).toHaveValue(/invite=/);
    await guest.goto(await host.getByLabel('Invitation to share').inputValue());
    await guest.getByLabel('Your room name').fill('Kai');
    await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(guest.getByLabel('Answer to share')).toHaveValue(/answer=/);
    await host
      .getByLabel('Guest’s answer link')
      .fill(await guest.getByLabel('Answer to share').inputValue());
    await host
      .getByRole('button', { name: 'Accept answer', exact: true })
      .click();
  }
  async function state() {
    return host.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem('arcade:redesign:room:v11')!).snapshot
          .challengeMatch.game,
    );
  }
  try {
    await host.goto('/#/room?game=strands');
    await host.getByLabel('Your room name').fill('Mira');
    await host
      .getByRole('button', { name: 'Create a room', exact: true })
      .click();
    await connect();
    await expect(host.getByLabel('Room game')).toBeVisible({ timeout: 20000 });
    for (const id of CHALLENGE_IDS) {
      await host.getByLabel('Room game').selectOption(id);
      if (id === 'sudoku')
        await host.getByLabel('Sudoku difficulty').selectOption('medium');
      await host.getByRole('button', { name: /^Start / }).click();
      await expect(guest.locator(`.challenge-${id}`)).toBeVisible({
        timeout: 20000,
      });
      const s = await state();
      if (id === 'strands') {
        const { strandsPuzzle } = await import('../../src/lib/strands.ts');
        for (const cell of strandsPuzzle(s.seed).paths[0])
          await host.locator('.strands-grid button').nth(cell).click();
        await host.getByRole('button', { name: 'Submit word' }).click();
        await expect(guest.locator('.strands-found li')).toHaveCount(1);
      }
      if (id === 'spelling-bee') {
        const { beePuzzle } = await import('../../src/lib/bee.ts');
        const word = beePuzzle(s.seed).words[0];
        await host.getByLabel('Hive word').fill(word);
        await host.getByRole('button', { name: 'Submit word' }).click();
        await expect(guest.locator('.challenge-word-list')).toContainText(word);
      }
      if (id === 'letter-boxed') {
        const { letterPuzzle } = await import('../../src/lib/letter-boxed.ts');
        const word = letterPuzzle(s.seed).solution[0];
        await host.getByLabel('Chain word', { exact: true }).fill(word);
        await host.getByRole('button', { name: 'Submit word' }).click();
        await expect(guest.locator('.letter-chain')).toContainText(word);
      }
      if (id === 'mini-crossword') {
        const { miniPuzzle } = await import('../../src/lib/mini.ts');
        const letter = miniPuzzle(s.seed).answer[0];
        await host.locator('.mini-grid input').first().fill(letter);
        await expect(guest.locator('.mini-grid input').first()).toHaveValue(
          letter,
        );
      }
      if (id === 'tiles') {
        const { tilesProgress } = await import('../../src/lib/tiles.ts');
        const { board } = tilesProgress(s);
        let pair: number[] = [];
        for (let a = 0; a < 12 && !pair.length; a++)
          for (let b = a + 1; b < 12; b++)
            if (
              board[a].some(
                (n: number, i: number) => n >= 0 && n === board[b][i],
              )
            ) {
              pair = [a, b];
              break;
            }
        await host.locator('.pattern-tile').nth(pair[0]).click();
        await host.locator('.pattern-tile').nth(pair[1]).click();
        await expect(
          guest.getByRole('heading', { name: 'Kai’s turn' }),
        ).toBeVisible();
      }
      if (id === 'sudoku') {
        const { sudokuPuzzle } = await import('../../src/lib/sudoku.ts');
        expect(s.difficulty).toBe('medium');
        const p = sudokuPuzzle(s.seed, s.difficulty),
          cell = p.givens.findIndex((n) => !n);
        await host.locator('.sudoku-grid button').nth(cell).click();
        await host
          .getByRole('group', { name: 'Enter a digit' })
          .getByRole('button', { name: String(p.solution[cell]), exact: true })
          .click();
        await expect(guest.locator('.sudoku-grid button').nth(cell)).toHaveText(
          String(p.solution[cell]),
        );
        await host.reload();
        await expect(
          host.getByRole('heading', { name: 'Puzzle paused' }),
        ).toBeVisible();
        await connect(true);
        await expect(guest.locator('.sudoku-grid button').nth(cell)).toHaveText(
          String(p.solution[cell]),
          { timeout: 20000 },
        );
      }
      if (id === 'quoridor') {
        await host
          .getByRole('button', {
            name: 'Row 2 column 5, legal move',
            exact: true,
          })
          .click();
        await expect(
          guest.getByRole('heading', { name: 'Kai’s turn' }),
        ).toBeVisible();
        await guest
          .getByRole('button', {
            name: 'Row 8 column 5, legal move',
            exact: true,
          })
          .click();
        await expect(
          host.getByRole('heading', { name: 'Mira’s turn' }),
        ).toBeVisible();
      }
      expect(
        (await new AxeBuilder({ page: guest }).analyze()).violations,
      ).toEqual([]);
      expect(
        await guest.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (
        !(await host
          .getByRole('button', { name: 'Return to lobby', exact: true })
          .isVisible())
      )
        await host.getByText('Room options', { exact: true }).click();
      host.once('dialog', (d) => d.accept());
      await host
        .getByRole('button', { name: 'Return to lobby', exact: true })
        .click();
      await expect(host.getByLabel('Room game')).toBeVisible();
    }
  } finally {
    await context.close();
  }
});

test('every new cover and game fits a 320px screen and its legacy game alias', async ({
  page,
}) => {
  test.setTimeout(180000);
  const { CHALLENGE_IDS } = await import('../../src/lib/challenges.ts');
  const { GAMES } = await import('../../src/lib/games.ts');
  await page.setViewportSize({ width: 320, height: 740 });
  for (const id of CHALLENGE_IDS) {
    await page.goto(`/#/games/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      GAMES.find((g) => g.id === id)!.name,
    );
    const art = page.locator('.puzzle-setup-art');
    // Compact setups hide decorative covers; explicitly load the source for
    // this asset-integrity assertion instead of waiting on lazy visibility.
    await art.evaluate((img: HTMLImageElement) => {
      img.loading = 'eager';
      return img.decode();
    });
    expect(
      await art.evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBe(1344);
    await page.getByRole('button', { name: 'Start playing' }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      id,
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations, id).toEqual(
      [],
    );
  }
});
