import { test, expect } from '@playwright/test';
import type {
  MemoryState,
  MineState,
  SimonState,
} from '../../src/lib/puzzles.ts';
async function checkpoint<T>(
  page: import('@playwright/test').Page,
  id: string,
): Promise<T> {
  return page.evaluate(async (id) => {
    const read = () =>
      JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')[id]
        ?.state;
    return navigator.locks
      ? navigator.locks.request('arcade:game.sessions', read)
      : read();
  }, id);
}

test('Connect Four plays a complete gravity match, restores a board, and blocks full columns', async ({
  page,
}) => {
  await page.goto('/#/game/connect-four');
  await page.getByRole('button', { name: 'Start playing' }).click();
  const drop = (column: number) =>
    page.getByRole('button', {
      name: `Drop in column ${column + 1}`,
      exact: true,
    });
  await drop(0).click();
  await expect(
    page.getByRole('heading', { name: 'Player 2’s turn' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Player 2’s turn' }),
  ).toBeVisible();
  for (const column of [1, 0, 1, 0, 1, 0]) await drop(column).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins!' }),
  ).toBeVisible();
  await expect(drop(2)).toBeDisabled();
  await page.getByRole('button', { name: 'Play again' }).click();
  for (let i = 0; i < 6; i++) await drop(2).click();
  await expect(drop(2)).toBeDisabled();
  expect(
    (await checkpoint<{ board: number[] }>(page, 'connect-four')).board.filter(
      Boolean,
    ),
  ).toHaveLength(6);
});

test('2048 restores, reaches a win, continues, accepts controls and retains its record', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'arcade:game.sessions',
      JSON.stringify({
        '2048': {
          state: {
            grid: [
              [1024, 1024, 0, 0],
              [2, 0, 0, 0],
              [0, 0, 0, 0],
              [0, 0, 0, 0],
            ],
            score: 512,
            won: false,
            keepPlaying: false,
          },
          savedAt: Date.now(),
        },
      }),
    ),
  );
  await page.goto('/#/game/2048');
  await page.getByRole('button', { name: 'Move left', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'You reached 2048!' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep going' }).click();
  await page.getByRole('group', { name: '2048 board' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(
      async () =>
        (await checkpoint<{ keepPlaying: boolean }>(page, '2048'))?.keepPlaying,
    )
    .toBe(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Slide. Merge. Repeat.' }),
  ).toBeVisible();
  expect(
    (await checkpoint<{ keepPlaying: boolean }>(page, '2048')).keepPlaying,
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('arcade:scores.highScores:2048')!),
    ),
  ).toBeGreaterThanOrEqual(2560);
});

test('Memory handles mismatches, multiplayer handoff, recovery, every pair and rematch', async ({
  page,
}) => {
  await page.goto('/#/game/memory');
  await page.getByText('Match options', { exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Players', exact: true })
    .selectOption('2');
  await page.getByRole('button', { name: 'Start playing' }).click();
  const deck = await checkpoint<MemoryState>(page, 'memory');
  const other = deck.cards.findIndex((c) => c.symbol !== deck.cards[0].symbol);
  await page.locator('.memory-card').nth(0).click();
  await page.locator('.memory-card').nth(other).click();
  await expect(
    page.getByRole('heading', { name: 'Remember those two…' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Player 2’s turn' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Player 2’s turn' }),
  ).toBeVisible();
  for (const symbol of new Set(deck.cards.map((c) => c.symbol))) {
    const pair = deck.cards.filter((c) => c.symbol === symbol);
    await page.locator('.memory-card').nth(pair[0].index).click();
    await page.locator('.memory-card').nth(pair[1].index).click();
  }
  await expect(
    page.getByRole('heading', { name: 'Player 2 wins!' }),
  ).toBeVisible();
  await expect(page.locator('.memory-card.matched')).toHaveCount(16);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('.memory-card.matched')).toHaveCount(0);
});

test('Minesweeper flag mode, safe opening, full clear and mine loss follow real board state', async ({
  page,
}) => {
  await page.goto('/#/game/minesweeper');
  await page.getByRole('button', { name: 'Start playing' }).click();
  await page.getByRole('button', { name: 'Flag mode: off' }).click();
  await page.locator('.mine-cell').first().click();
  await expect(
    page.getByRole('button', { name: 'Flagged row 1, column 1', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Flag mode: on' }).click();
  await page.locator('.mine-cell').nth(40).click();
  let s = await checkpoint<MineState>(page, 'minesweeper');
  expect(s.board[40].mine).toBe(false);
  await page
    .getByRole('button', { name: 'Flagged row 1, column 1', exact: true })
    .press('f');
  s = await checkpoint<MineState>(page, 'minesweeper');
  for (let i = 0; i < s.board.length; i++) {
    const cell = page.locator('.mine-cell').nth(i);
    if (await cell.isDisabled()) break;
    // Flood reveal can clear other safe cells and finish before this list ends.
    if (
      !s.board[i].mine &&
      !(await cell.getAttribute('aria-label'))?.startsWith('Revealed')
    )
      await cell.click();
  }
  await expect(
    page.getByRole('heading', { name: 'You cleared the field!' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await page.locator('.mine-cell').nth(40).click();
  s = await checkpoint<MineState>(page, 'minesweeper');
  await page
    .locator('.mine-cell')
    .nth(s.board.findIndex((c) => c.mine))
    .click();
  await expect(
    page.getByRole('heading', { name: 'A mine! Try a fresh field.' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Start playing' }),
  ).toBeVisible();
});

test('Simon watches, repeats, extends, records a round and finishes a wrong sequence', async ({
  page,
}) => {
  await page.goto('/#/game/simon');
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(
    page.getByRole('heading', { name: 'Watch the sequence.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Your turn — repeat it.' }),
  ).toBeVisible();
  let s = await checkpoint<SimonState>(page, 'simon');
  await page.locator('.simon-pad').nth(s.sequence[0]).click();
  await expect(
    page.getByRole('heading', { name: 'Nice! Next round…' }),
  ).toBeVisible();
  await expect
    .poll(
      async () => (await checkpoint<SimonState>(page, 'simon')).sequence.length,
    )
    .toBe(2);
  await expect(
    page.getByRole('heading', { name: 'Your turn — repeat it.' }),
  ).toBeVisible();
  s = await checkpoint<SimonState>(page, 'simon');
  await page
    .locator('.simon-pad')
    .nth((s.sequence[0] + 1) % 4)
    .click();
  await expect(
    page.getByRole('heading', { name: 'Game over — reached round 2' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('arcade:scores.highScores:simon')!),
    ),
  ).toBe(1);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Watch the sequence.' }),
  ).toBeVisible();
});

test('all puzzle setups and boards meet accessibility, scroll within the page and expose valid resume links', async ({
  page,
}) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const id of ['connect-four', 'minesweeper', 'memory', '2048', 'simon']) {
    await page.goto(`/#/game/${id}`);
    await page.getByRole('button', { name: 'Start playing' }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('link', { name: 'Back to the shelf' }).click();
    await expect(
      page.locator(`.continue-card[href="#/game/${id}"]`),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('large puzzle options retain their sizes and scroll inside the board', async ({
  page,
}) => {
  for (const [id, label, value, count] of [
    ['memory', 'Grid size', '8', 64],
    ['minesweeper', 'Difficulty', 'hard', 480],
  ] as const) {
    await page.goto(`/#/game/${id}`);
    await page.getByText('Match options', { exact: true }).click();
    await page
      .getByRole('combobox', { name: label, exact: true })
      .selectOption(value);
    await page.getByRole('button', { name: 'Start playing' }).click();
    await expect(
      page.locator(id === 'memory' ? '.memory-card' : '.mine-cell'),
    ).toHaveCount(count);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.reload();
    await expect(
      page.locator(id === 'memory' ? '.memory-card' : '.mine-cell'),
    ).toHaveCount(count);
  }
});
