import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CONNECTIONS_PUZZLES } from '../../src/data/connections.ts';
import { prepareLocalRoom } from './room-helpers.ts';

test.setTimeout(60000);

const fixture = {
  puzzleId: 'connections-01',
  date: null,
  guesses: [] as number[][],
};
async function seed(page: Page, guesses: number[][] = []) {
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ connections: { state, savedAt: Date.now() } }),
      ),
    { ...fixture, guesses },
  );
  await page.goto('/#/game/connections');
}
async function submit(page: Page, words: string[]) {
  for (const word of words)
    await page.getByRole('button', { name: word, exact: true }).click();
  await page.getByRole('button', { name: 'Submit group', exact: true }).click();
}

test('Connections saves guesses, rejects repeats, shuffles, supports keyboard play, wins and starts practice', async ({
  page,
}) => {
  await seed(page);
  await expect(
    page.getByRole('group', { name: 'Word tiles' }).getByRole('button'),
  ).toHaveCount(16);
  const tiles = page.locator('.connections-grid button');
  await tiles.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tiles.nth(1)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(tiles.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Deselect all' }).click();
  await expect(
    page.getByRole('button', { name: 'Submit group' }),
  ).toBeDisabled();
  await submit(page, ['PIANO', 'ORGAN', 'KEYBOARD', 'KIDNEY']);
  await expect(
    page.getByText('One away! Try a different combination.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/3 mistakes remaining/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/3 mistakes remaining/)).toBeVisible();
  await submit(page, ['KIDNEY', 'KEYBOARD', 'PIANO', 'ORGAN']);
  await expect(
    page.getByText('Already tried. Choose another group.'),
  ).toBeVisible();
  await expect(page.getByText(/3 mistakes remaining/)).toBeVisible();
  await page.getByRole('button', { name: 'Deselect all' }).click();
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const group of CONNECTIONS_PUZZLES[0].groups)
    await submit(page, group.words);
  await expect(
    page.getByRole('heading', { name: 'All connections found!' }),
  ).toBeVisible();
  await expect(page.locator('.connections-group')).toHaveCount(4);
  await expect(page.locator('.connections-grid')).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')
          .connections,
    ),
  ).toBeUndefined();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/connections-win-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'New practice puzzle' }).click();
  await expect(
    page.getByRole('heading', { name: '4 groups to find' }),
  ).toBeVisible();
});

test('Connections reveals answers after four mistakes and discards corrupt checkpoints', async ({
  page,
}) => {
  await seed(page, [
    [0, 1, 2, 4],
    [0, 1, 2, 5],
    [0, 1, 2, 6],
  ]);
  await submit(page, ['PIANO', 'ORGAN', 'KEYBOARD', 'LIMA']);
  await expect(
    page.getByRole('heading', { name: 'Out of mistakes' }),
  ).toBeVisible();
  await expect(page.locator('.connections-group')).toHaveCount(4);
  await expect(page.getByText(' · Not found', { exact: true })).toHaveCount(4);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await seed(page, [[0, 0, 0, 0]]);
  await expect(
    page.getByRole('button', { name: 'Start playing' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(page.getByText(/Daily puzzle/)).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Word tiles' }).getByRole('button'),
  ).toHaveCount(16);
});

test('Connections shelf cover loads, room link selects co-op, and narrow screens remain usable', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  await expect(page.locator('.game-facts')).toContainText(
    '2–20 players · Cooperative',
  );
  await page
    .getByRole('link', { name: 'Play Connections', exact: true })
    .click();
  const art = page.locator('.puzzle-setup-art');
  await expect(art).toBeVisible();
  expect(
    await art.evaluate((img) => (img as HTMLImageElement).naturalWidth),
  ).toBe(1344);
  await page
    .getByRole('link', { name: 'Solve together in a private room' })
    .click();
  await expect(page).toHaveURL(/game=connections/);
  await seed(page);
  await page.screenshot({
    path: `node_modules/.cache/connections-play-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('Connections cooperative room syncs both players, pauses on host reload, reconnects and completes', async ({
  page: host,
  browser,
}) => {
  test.setTimeout(120000);
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
  try {
    await host.goto('/#/room?game=connections');
    await host.getByLabel('Your room name').fill('Mira');
    await host
      .getByRole('button', { name: 'Create a room', exact: true })
      .click();
    await connect();
    await expect(host.getByLabel('Room game')).toHaveValue('connections', {
      timeout: 20000,
    });
    await host
      .getByRole('button', { name: 'Start Connections', exact: true })
      .click();
    await expect(
      guest.getByRole('heading', { name: 'Solve it together' }),
    ).toBeVisible({ timeout: 20000 });
    const id = await host.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem('arcade:redesign:room:v11')!).snapshot
          .connectionsMatch.game.puzzleId,
    );
    const groups = CONNECTIONS_PUZZLES.find((p) => p.id === id)!.groups;
    await guest
      .getByRole('button', { name: groups[0].words[0], exact: true })
      .click();
    await expect(
      host.locator('.connections-word[aria-pressed="true"]'),
    ).toHaveCount(0);
    await guest.getByRole('button', { name: 'Deselect all' }).click();
    await submit(guest, groups[0].words);
    await expect(host.locator('.connections-group')).toHaveCount(1);
    await host.reload();
    await expect(
      host.getByRole('heading', { name: 'Puzzle paused' }),
    ).toBeVisible();
    await expect(host.locator('.connections-word').first()).toBeDisabled();
    await connect(true);
    await expect(
      guest.getByRole('heading', { name: 'Solve it together' }),
    ).toBeVisible({ timeout: 20000 });
    await submit(host, groups[1].words);
    await expect(guest.locator('.connections-group')).toHaveCount(2);
    await submit(guest, groups[2].words);
    await expect(host.locator('.connections-group')).toHaveCount(3);
    await submit(host, groups[3].words);
    for (const page of [host, guest])
      await expect(
        page.getByRole('heading', { name: 'All connections found!' }),
      ).toBeVisible();
    expect(
      (await new AxeBuilder({ page: guest }).analyze()).violations,
    ).toEqual([]);
    await host.screenshot({
      path: `node_modules/.cache/connections-room-${test.info().project.name}.png`,
      fullPage: true,
    });
    await host.getByRole('button', { name: 'New practice puzzle' }).click();
    await expect(guest.locator('.connections-word')).toHaveCount(16);
  } finally {
    await context.close();
  }
});
