import { test, expect } from '@playwright/test';
import {
  newCatan,
  actCatan,
  canRoad,
  canSettle,
  validCatanCheckpoint,
  catanView,
} from '../../src/lib/catan-core.js';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Island opening placements survive a covered handoff and reload', async ({
  page,
}) => {
  const s = newCatan(3, () => 0.25);
  for (const n of [6, 5, 4])
    expect(actCatan(s, { type: 'setup-roll', dice: [n, n] })).toBe(true);
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ catan: { state, savedAt: Date.now() } }),
      ),
    s,
  );
  await page.goto('/#/game/catan');
  await page
    .getByRole('button', { name: 'I’m ready · reveal my cargo' })
    .click();
  await expect(
    page.getByText('Select a glowing junction for your outpost.'),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Discovery deck, 25 cards' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /forest,/ })
    .first()
    .click();
  await expect(
    page.getByRole('region', { name: 'Inspected land' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '+ Zoom' }).click();
  await expect(page.getByText('125%', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: /Build at junction/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: /Build on path/ })
    .first()
    .click();
  await expect(page.getByText('Pass the device to Player 2.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Pass the device to Player 2.')).toBeVisible();
  await page
    .getByRole('button', { name: 'I’m ready · reveal my cargo' })
    .click();
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/island-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('Island trades private cargo, reaches a win and starts a fresh game', async ({
  page,
}) => {
  const s = newCatan(3, () => 0.25);
  for (const n of [6, 5, 4])
    expect(actCatan(s, { type: 'setup-roll', dice: [n, n] })).toBe(true);
  while (s.phase.startsWith('setup')) {
    if (s.phase === 'setup-settlement')
      expect(
        actCatan(s, {
          type: 'setup-settlement',
          vertex: s.buildings.findIndex((_, i) =>
            canSettle(s, s.current, i, true),
          ),
        }),
      ).toBe(true);
    else
      expect(
        actCatan(s, {
          type: 'setup-road',
          edge: s.roads.findIndex((_, i) => canRoad(s, s.current, i, true)),
        }),
      ).toBe(true);
  }
  expect(actCatan(s, { type: 'roll', dice: [2, 3] })).toBe(true);
  for (const [seat, good] of [
    [0, 'timber'],
    [1, 'ore'],
  ] as const) {
    s.players[seat].goods[good]++;
    s.bank[good]--;
  }
  expect(validCatanCheckpoint(s)).toBe(true);
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ catan: { state, savedAt: Date.now() } }),
      ),
    s,
  );
  await page.goto('/#/game/catan');
  await page
    .getByRole('button', { name: 'I’m ready · reveal my cargo' })
    .click();
  await page.getByText('Trade and build costs').click();
  await page
    .getByRole('group', { name: 'Offer cargo' })
    .getByLabel('Wood')
    .fill('1');
  await page
    .getByRole('group', { name: 'Request cargo' })
    .getByLabel('Ore')
    .fill('1');
  await page.getByRole('button', { name: 'Offer cargo trade' }).click();
  await expect(page.getByText('Pass the device to Player 2.')).toBeVisible();
  await page
    .getByRole('button', { name: 'I’m ready · reveal my cargo' })
    .click();
  await page.getByRole('button', { name: 'Accept trade' }).click();
  await expect(page.getByText('Pass the device to Player 1.')).toBeVisible();
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('arcade:game.sessions')!);
    const state = saved.catan.state;
    state.current = 2;
    state.players[0].dev.push(
      ...Array.from({ length: 8 }, () => ({ type: 'victory', bought: 0 })),
    );
    localStorage.setItem('arcade:game.sessions', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByText('Pass the device to Player 3.')).toBeVisible();
  await page
    .getByRole('button', { name: 'I’m ready · reveal my cargo' })
    .click();
  await page.getByRole('button', { name: 'End turn →' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins!' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByText('Pass the device to Player 1.')).toBeVisible();
});

test('Island resolves a seven through private discard and raider movement', async ({
  page,
}) => {
  const s = newCatan(3, () => 0.25);
  for (const n of [6, 5, 4])
    expect(actCatan(s, { type: 'setup-roll', dice: [n, n] })).toBe(true);
  while (s.phase.startsWith('setup')) {
    if (s.phase === 'setup-settlement')
      expect(
        actCatan(s, {
          type: 'setup-settlement',
          vertex: s.buildings.findIndex((_, i) =>
            canSettle(s, s.current, i, true),
          ),
        }),
      ).toBe(true);
    else
      expect(
        actCatan(s, {
          type: 'setup-road',
          edge: s.roads.findIndex((_, i) => canRoad(s, s.current, i, true)),
        }),
      ).toBe(true);
  }
  s.players[1].goods.timber += 8;
  s.bank.timber -= 8;
  expect(actCatan(s, { type: 'roll', dice: [3, 4] })).toBe(true);
  expect(s.phase).toBe('discard');
  const destination = s.board.tiles.findIndex(
    (t, i) =>
      i !== s.robber &&
      t.vertices.every((v) => !s.buildings[v] || s.buildings[v]?.owner === 0),
  );
  expect(destination).toBeGreaterThanOrEqual(0);
  expect(validCatanCheckpoint(s)).toBe(true);
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ catan: { state, savedAt: Date.now() } }),
      ),
    s,
  );
  await page.goto('/#/game/catan');
  await expect(page.getByText('Pass the device to Player 2.')).toBeVisible();
  await page
    .getByRole('button', { name: 'I’m ready · reveal my cargo' })
    .click();
  await page.getByLabel('Wood', { exact: true }).fill(String(s.discards[1]));
  await page.getByRole('button', { name: 'Return cargo' }).click();
  await expect(page.getByText('Pass the device to Player 1.')).toBeVisible();
  await page
    .getByRole('button', { name: 'I’m ready · reveal my cargo' })
    .click();
  await page.locator('.island-chart polygon').nth(destination).click();
  await page.getByRole('button', { name: 'Move the raider here' }).click();
  await expect(page.getByText('The raider blocks that land.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'End turn →' })).toBeVisible();
});

const localIce = () => {
  Object.defineProperty(navigator, 'onLine', { get: () => false });
  const Native = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends Native {
    setRemoteDescription(d: RTCSessionDescriptionInit) {
      return super.setRemoteDescription({
        ...d,
        sdp: d.sdp?.replace(
          /^(a=candidate:\S+ \d+ \S+ \d+ )\S+/gm,
          (_m, p) => p + '127.0.0.1',
        ),
      });
    }
  };
};
test('three Island navigators connect, roll and recover after the host reloads', async ({
  page: host,
  browser,
}) => {
  test.setTimeout(90000);
  await host.context().addInitScript(localIce);
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const guests: Page[] = [];
  for (const c of contexts) {
    await c.addInitScript(localIce);
    guests.push(await c.newPage());
  }
  async function connect(i: number, reconnect = false) {
    if (reconnect && i === 0)
      await host.getByText('Room players (3)', { exact: true }).click();
    if (reconnect)
      await host
        .getByRole('button', {
          name: 'Create reconnect invitation',
          exact: true,
        })
        .click();
    else if (i)
      await host
        .getByRole('button', { name: 'Invite another player', exact: true })
        .click();
    await expect(host.getByLabel('Invitation to share')).toHaveValue(/invite=/);
    await guests[i].goto(
      await host.getByLabel('Invitation to share').inputValue(),
    );
    await guests[i].getByLabel('Your room name').fill(i ? 'Rae' : 'Kai');
    await guests[i]
      .getByRole('button', { name: 'Join room', exact: true })
      .click();
    await expect(guests[i].getByLabel('Answer to share')).toHaveValue(
      /answer=/,
    );
    await host
      .getByLabel('Guest’s answer link')
      .fill(await guests[i].getByLabel('Answer to share').inputValue());
    await host
      .getByRole('button', { name: 'Accept answer', exact: true })
      .click();
    await expect(
      host.getByLabel('Room players').getByText('Connected', { exact: true }),
    ).toHaveCount(i + (reconnect ? 2 : 2), { timeout: 20000 });
  }
  try {
    await host.goto('/#/game/catan');
    await host
      .getByRole('link', { name: 'Different screens? Open a private room →' })
      .click();
    await host.getByLabel('Your room name').fill('Mira');
    await host
      .getByRole('button', { name: 'Create a room', exact: true })
      .click();
    await connect(0);
    await expect(
      host.getByRole('button', { name: 'Start Island Charter' }),
    ).toBeDisabled();
    await connect(1);
    await host.getByRole('button', { name: 'Start Island Charter' }).click();
    await expect(
      guests[0].getByRole('group', { name: 'Island chart' }),
    ).toBeVisible();
    expect(
      await guests[0].evaluate(() =>
        sessionStorage.getItem('arcade:redesign:room:v7'),
      ),
    ).toBeNull();
    await host.getByRole('button', { name: 'Roll two dice' }).click();
    await expect(
      guests[0].getByRole('button', { name: 'Roll two dice' }),
    ).toBeVisible();
    await host.reload();
    await expect(
      host.getByText('Room restored.', { exact: false }),
    ).toBeVisible();
    await connect(0, true);
    await connect(1, true);
    await guests[0].getByRole('button', { name: 'Roll two dice' }).click();
    await expect(
      guests[1].getByRole('button', { name: 'Roll two dice' }),
    ).toBeVisible();
    const ending = newCatan(3, () => 0.25);
    for (const n of [6, 5, 4])
      expect(actCatan(ending, { type: 'setup-roll', dice: [n, n] })).toBe(true);
    while (ending.phase.startsWith('setup')) {
      if (ending.phase === 'setup-settlement')
        expect(
          actCatan(ending, {
            type: 'setup-settlement',
            vertex: ending.buildings.findIndex((_, i) =>
              canSettle(ending, ending.current, i, true),
            ),
          }),
        ).toBe(true);
      else
        expect(
          actCatan(ending, {
            type: 'setup-road',
            edge: ending.roads.findIndex((_, i) =>
              canRoad(ending, ending.current, i, true),
            ),
          }),
        ).toBe(true);
    }
    expect(actCatan(ending, { type: 'roll', dice: [2, 3] })).toBe(true);
    ending.current = 2;
    ending.players[0].dev.push(
      ...Array.from({ length: 8 }, () => ({
        type: 'victory' as const,
        bought: 0,
      })),
    );
    expect(validCatanCheckpoint(ending)).toBe(true);
    await host.evaluate(
      ({ state, view }) => {
        const saved = JSON.parse(
          sessionStorage.getItem('arcade:redesign:room:v7')!,
        );
        saved.privateIsland = state;
        saved.snapshot.islandMatch.view = view;
        sessionStorage.setItem(
          'arcade:redesign:room:v7',
          JSON.stringify(saved),
        );
      },
      { state: ending, view: catanView(ending, 0) },
    );
    await host.reload();
    await expect(
      host.getByText('Room restored.', { exact: false }),
    ).toBeVisible();
    await connect(0, true);
    await connect(1, true);
    await guests[1].getByRole('button', { name: 'End turn →' }).click();
    await expect(
      host.getByRole('heading', { name: 'Mira wins!' }),
    ).toBeVisible();
    await host.getByRole('button', { name: 'Play again' }).click();
    await expect(
      host.getByRole('button', { name: 'Roll two dice' }),
    ).toBeVisible();
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
