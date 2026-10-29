import { test, expect, type Page } from '@playwright/test';

const checkpoint = {
  mode: 'pvp',
  board: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  current: 1,
  over: false,
};
async function seed(page: Page, version?: number) {
  await page.goto('/');
  await page.evaluate(
    ({ state, version }) => {
      localStorage.clear();
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ tictactoe: { state, savedAt: Date.now() } }),
      );
      localStorage.setItem('other-app:private', 'unrelated');
      if (version !== undefined)
        localStorage.setItem('arcade:redesign.storageVersion', String(version));
    },
    { state: checkpoint, version },
  );
  await page.goto('/#/game/tictactoe');
  await page.reload();
}
const cell = (page: Page, row: number, column: number) =>
  page.getByRole('button', {
    name: `Row ${row}, column ${column}: empty`,
    exact: true,
  });
const savedBoard = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('arcade:game.sessions')!).tictactoe.state
        .board,
  );

test('legacy backup precedes playback and private export excludes unrelated applications', async ({
  page,
}) => {
  await seed(page);
  const backup = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('arcade:redesign.storageBackup:v0')!),
  );
  expect(
    JSON.parse(backup.values['arcade:game.sessions']).tictactoe.state,
  ).toEqual(checkpoint);
  expect(backup.values['other-app:private']).toBeUndefined();
  await cell(page, 1, 1).click();
  await expect
    .poll(() => savedBoard(page))
    .toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
  await page.getByText('Offline & install', { exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download saved games' }).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(
    JSON.parse(exported.values['arcade:game.sessions']).tictactoe.state
      .board[0],
  ).toBe(1);
  expect(exported.values['other-app:private']).toBeUndefined();
});

test('future storage stays protected while the current match remains playable', async ({
  page,
}) => {
  await seed(page, 999);
  await cell(page, 1, 1).click();
  await expect(
    page.getByText(/Saved data belongs to an unsupported Arcade version/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Row 1, column 1: X', exact: true }),
  ).toBeVisible();
  expect(await savedBoard(page)).toEqual(checkpoint.board);
  await page.screenshot({
    path: test.info().outputPath('protected-storage.png'),
    fullPage: true,
  });
});

test('stale same-game tab cannot replace newer progress and reload recovers the winning save', async ({
  page,
  context,
}) => {
  await seed(page);
  const other = await context.newPage();
  await other.goto('/#/game/tictactoe');
  await expect(cell(other, 1, 2)).toBeVisible();
  await cell(page, 1, 1).click();
  await expect
    .poll(() => savedBoard(page))
    .toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
  await cell(other, 1, 2).click();
  await expect(
    other.getByText(/Newer progress is saved in another tab/),
  ).toBeVisible();
  expect(await savedBoard(other)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
  await other.reload();
  await expect(
    other.getByRole('button', { name: 'Row 1, column 1: X', exact: true }),
  ).toBeVisible();
  await cell(other, 1, 2).click();
  await expect
    .poll(() => savedBoard(other))
    .toEqual([1, 2, 0, 0, 0, 0, 0, 0, 0]);
});

test('theme and sound preferences follow other tabs without a write loop', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  await page
    .getByRole('button', { name: 'Theme: auto. Select light', exact: true })
    .click();
  await expect(
    other.getByRole('button', {
      name: 'Theme: light. Select dark',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('Sound & feel').click();
  await other.getByLabel('Sound & feel').click();
  await page.getByLabel('Game sounds', { exact: true }).uncheck();
  await expect(
    other.getByLabel('Game sounds', { exact: true }),
  ).not.toBeChecked();
  await page.evaluate(() => localStorage.removeItem('arcade:ui.soundEnabled'));
  await expect(other.getByLabel('Game sounds', { exact: true })).toBeChecked();
});

test('separate game tabs preserve each other and the open shelf refreshes recent/resume state', async ({
  page,
  context,
}) => {
  await seed(page);
  const shelf = await context.newPage();
  await shelf.goto('/');
  const other = await context.newPage();
  await other.goto('/#/game/connect-four');
  await other.getByRole('button', { name: 'Start playing' }).click();
  await cell(page, 1, 1).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(
          JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}'),
        ).sort(),
      ),
    )
    .toEqual(['connect-four', 'tictactoe']);
  await expect(shelf.locator('.continue-card')).toHaveCount(2);
  await shelf.getByText('Recently played', { exact: true }).click();
  await expect(shelf.locator('.recent-links')).toContainText('Connect Four');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('arcade:game.sessions')!);
    saved.rps = { state: {}, savedAt: 1 };
    localStorage.setItem('arcade:game.sessions', JSON.stringify(saved));
  });
  await cell(page, 1, 2).click();
  await expect
    .poll(() => savedBoard(page))
    .toEqual([1, 2, 0, 0, 0, 0, 0, 0, 0]);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(
          JSON.parse(localStorage.getItem('arcade:game.sessions')!),
        ).sort(),
      ),
    )
    .toEqual(['connect-four', 'tictactoe']);
});

test('an already open tab protects saves when another release advances the storage version', async ({
  page,
  context,
}) => {
  await seed(page);
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(() =>
    localStorage.setItem('arcade:redesign.storageVersion', '999'),
  );
  await expect(
    page.getByText(/Saved data belongs to an unsupported Arcade version/),
  ).toBeVisible();
  await cell(page, 1, 1).click();
  expect(await savedBoard(page)).toEqual(checkpoint.board);
});
