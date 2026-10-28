import { test, expect } from '@playwright/test';
import { GAMES } from '../../src/lib/games.ts';
import baseline from '../../../docs/redesign/parity.json' with { type: 'json' };

test('skip link stays hidden until focused and moves keyboard focus to the main content', async ({
  page,
}) => {
  await page.goto('/');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toHaveCSS('clip-path', 'inset(50%)');
  await skip.focus();
  await expect(skip).toHaveCSS('clip-path', 'none');
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('complete shelf, categories, search and native game handoff', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Arcade · Good games, better together');
  await expect(page.locator('.game-card')).toHaveCount(26);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Tic-Tac-Toe',
  );
  await page.getByRole('button', { name: 'Action', exact: true }).click();
  await expect(page.locator('.game-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await page
    .getByRole('button', { name: 'Island Charter', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Island Charter',
  );
  await page
    .getByRole('link', { name: 'Play Island Charter', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Start playing →' }),
  ).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('searchbox').fill('wordle');
  await expect(page.locator('.game-card')).toHaveCount(1);
  await page.getByRole('searchbox').fill('not-a-game');
  await expect(
    page.getByRole('heading', { name: 'No games found' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('stable legacy game aliases and requirements remain reachable', async ({
  page,
}) => {
  for (const game of GAMES) {
    await page.goto(`/#/games/${game.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(game.name);
  }
  for (const entry of baseline.requirements) {
    await page.goto(`/#/requirements/${entry.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      entry.title,
    );
    await expect(
      page.getByText(entry.acceptance[0], { exact: true }),
    ).toBeVisible();
  }
  await page.goto('/#/game/missing');
  await expect(
    page.getByRole('heading', { name: 'Game not found' }),
  ).toBeVisible();
});

test('local match saves names, resumes from home, announces O win once and rematches', async ({
  page,
}) => {
  await page.goto('/#/game/tictactoe');
  await page.getByText('Match options & player names', { exact: true }).click();
  await page.getByRole('button', { name: '2 players', exact: true }).click();
  await page.getByLabel('Player 1', { exact: true }).fill('Mira');
  await page.getByLabel('Player 2', { exact: true }).fill('Kai');
  await page.getByRole('button', { name: 'Start playing' }).click();
  const cell = (row: number, col: number) =>
    page.getByRole('button', {
      name: `Row ${row}, column ${col}: empty`,
      exact: true,
    });
  await cell(1, 1).click();
  await cell(2, 1).click();
  await page.getByRole('link', { name: 'Back to the shelf' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Tic-Tac-Toe',
  );
  await page.locator('.continue-card').click();
  await expect(
    page.getByRole('button', { name: 'Row 1, column 1: X', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Mira’s turn' }),
  ).toBeVisible();
  await cell(1, 2).click();
  await cell(2, 2).click();
  await cell(3, 3).click();
  await cell(2, 3).click();
  await expect(page.getByRole('heading', { name: 'Kai wins!' })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:scores.highScores')!).tictactoe,
    ),
  ).toEqual({ Kai: 1 });
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('.square')).toHaveCount(9);
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.locator('.square')).toHaveCount(9);
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'New match' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Start playing' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Start playing' }),
  ).toBeVisible();
});

test('AI draw, keyboard board controls, reload and stale timer disposal', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-01-01T10:00:00Z') });
  await page.goto('/#/game/tictactoe');
  await page.getByRole('button', { name: 'Start playing' }).click();
  const first = page.getByRole('button', {
    name: 'Row 1, column 1: empty',
    exact: true,
  });
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('button', { name: 'Row 1, column 2: empty', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Computer is thinking…' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Player 1’s turn' }),
  ).toBeVisible();
  // A deterministic perfect-play line against the real minimax response.
  for (const index of [1, 6, 5, 8]) {
    const target = page.locator('.square').nth(index);
    if ((await target.getAttribute('aria-disabled')) === 'false')
      await target.click();
    await expect(
      page.getByRole('heading', { name: /Computer is thinking/ }),
    ).toHaveCount(0);
  }
  await expect(
    page.getByRole('heading', { name: /draw|Computer wins/ }),
  ).toBeVisible();
  // Keep the pending AI callback frozen until the destination has mounted.
  await page.clock.pauseAt(new Date('2026-01-01T11:00:00Z'));
  await page.getByRole('button', { name: 'Play again' }).click();
  await first.click();
  await page.getByRole('link', { name: 'Back to the shelf' }).click();
  await expect(
    page.getByRole('region', { name: 'Featured game' }),
  ).toBeVisible();
  const before = await page.evaluate(() =>
    localStorage.getItem('arcade:game.sessions'),
  );
  expect(JSON.parse(before!).tictactoe.state.current).toBe(2);
  await page.clock.runFor(500);
  expect(
    await page.evaluate(() => localStorage.getItem('arcade:game.sessions')),
  ).toBe(before);
});

test('corrupt and expired checkpoints recover without erasing settings', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'arcade:game.sessions',
      JSON.stringify({
        tictactoe: {
          state: { mode: 'pvp', board: [1], current: 1 },
          savedAt: Date.now(),
        },
      }),
    );
    localStorage.setItem(
      'arcade:players.names',
      JSON.stringify(['Mira', 'Kai']),
    );
    localStorage.setItem('arcade:ui.recentGames', 'null');
  });
  await page.goto('/');
  await expect(page.locator('.continue-card')).toHaveCount(0);
  await page.goto('/#/game/tictactoe');
  await expect(
    page.getByRole('button', { name: 'Start playing' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('arcade:players.names')!),
    ),
  ).toEqual(['Mira', 'Kai']);
});

test('storage denial warns while local gameplay remains playable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await page.goto('/#/game/tictactoe');
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(
    page.getByText(/Your browser could not save progress/),
  ).toBeVisible();
  await page.locator('.square').first().click();
  await expect(
    page.getByRole('button', { name: 'Row 1, column 1: X' }),
  ).toBeVisible();
});

test('responsive shelf and play screens have no overflow, external assets or service worker', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:')) external.push(r.url());
  });
  await page.goto('/');
  if (isMobile) {
    const play = await page
      .getByRole('link', { name: 'Play Tic-Tac-Toe', exact: true })
      .boundingBox();
    expect(play!.y + play!.height).toBeLessThanOrEqual(
      await page.evaluate(() => innerHeight),
    );
  }
  for (const path of ['/', '/#/game/tictactoe', '/#/room']) {
    await page.goto(path);
    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      overflow: [...document.querySelectorAll('header, header > *, main > *')]
        .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
        .map((el) => ({
          tag: el.tagName,
          class: el.className,
          right: el.getBoundingClientRect().right,
        })),
    }));
    expect(
      layout.width,
      JSON.stringify({ path, ...layout }),
    ).toBeLessThanOrEqual(layout.viewport);
  }
  if (isMobile) {
    await page.goto('/#/game/tictactoe');
    await page.getByRole('button', { name: 'Start playing' }).click();
    const board = await page.locator('.ttt-board').boundingBox();
    expect(board!.y + board!.height).toBeLessThanOrEqual(
      await page.evaluate(() => innerHeight),
    );
  }
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistrations()).length,
    ),
  ).toBe(0);
  expect(external).toEqual([]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Theme: auto. Select light' }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Theme: light. Select dark' }),
  ).toBeVisible();
});

test('catalog, setup, board and room meet automated accessibility checks', async ({
  page,
}) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  for (const path of ['/', '/#/game/tictactoe', '/#/room']) {
    await page.goto(path);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.goto('/#/game/tictactoe');
  await page.getByRole('button', { name: 'Start playing' }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});

for (const roomGame of ['tictactoe', 'connect-four'] as const) {
  test(`real two-browser WebRTC ${roomGame}: invitation, play, win, rematch and host recovery`, async ({
    page: host,
    browser,
  }) => {
    test.setTimeout(90_000);
    const guestContext = await browser.newContext();
    // Real data channels over loopback: headless mDNS/LAN routing is unavailable
    // on this runner. Only candidate addresses are normalized; SDP negotiation,
    // DTLS/SCTP, admission, wire messages and both UIs remain the production path.
    const localIce = () => {
      Object.defineProperty(navigator, 'onLine', { get: () => false });
      const Native = window.RTCPeerConnection;
      window.RTCPeerConnection = class extends Native {
        setRemoteDescription(description: RTCSessionDescriptionInit) {
          return super.setRemoteDescription({
            ...description,
            sdp: description.sdp?.replace(
              /^(a=candidate:\S+ \d+ \S+ \d+ )\S+/gm,
              (_match, prefix) => prefix + '127.0.0.1',
            ),
          });
        }
      };
    };
    await host.context().addInitScript(localIce);
    await guestContext.addInitScript(localIce);
    const guest = await guestContext.newPage();
    const errors: string[] = [];
    host.on('pageerror', (e) => errors.push(e.message));
    guest.on('pageerror', (e) => errors.push(e.message));
    try {
      await host.goto('/#/room');
      await host.getByLabel('Your room name').fill('Mira');
      await host
        .getByRole('button', { name: 'Create a room', exact: true })
        .click();
      const invitation = host.getByLabel('Invitation to share');
      await expect(invitation).toHaveValue(/invite=/);
      await guest.goto(await invitation.inputValue());
      await guest.getByLabel('Your room name').fill('Kai');
      await guest
        .getByRole('button', { name: 'Join room', exact: true })
        .click();
      await expect(guest.getByLabel('Answer to share')).toHaveValue(/answer=/);
      await host
        .getByLabel('Guest’s answer link')
        .fill(await guest.getByLabel('Answer to share').inputValue());
      await host.getByRole('button', { name: 'Accept answer' }).click();
      await expect(
        host.getByRole('button', { name: 'Start Tic-Tac-Toe' }),
      ).toBeVisible({ timeout: 20_000 });
      if (roomGame === 'connect-four')
        await host
          .getByRole('combobox', { name: 'Room game' })
          .selectOption('connect-four');
      await host
        .getByRole('button', {
          name:
            roomGame === 'connect-four'
              ? 'Start Connect Four'
              : 'Start Tic-Tac-Toe',
        })
        .click();
      await expect(
        guest.getByRole('heading', { name: 'Mira’s turn' }),
      ).toBeVisible();
      if (roomGame === 'connect-four')
        await expect(
          guest.getByRole('button', { name: 'Drop in column 1', exact: true }),
        ).toBeDisabled();
      else
        await expect(guest.locator('.square').first()).toHaveAttribute(
          'aria-disabled',
          'true',
        );
      const moves =
        roomGame === 'connect-four'
          ? ([
              [host, 0],
              [guest, 1],
              [host, 0],
              [guest, 1],
              [host, 0],
              [guest, 1],
              [host, 0],
            ] as const)
          : ([
              [host, 0],
              [guest, 3],
              [host, 1],
              [guest, 4],
              [host, 2],
            ] as const);
      const move = async (player: typeof host, index: number) => {
        if (roomGame === 'connect-four')
          await player
            .getByRole('button', {
              name: `Drop in column ${index + 1}`,
              exact: true,
            })
            .click();
        else await player.locator('.square').nth(index).click();
      };
      for (const [player, index] of moves) {
        await expect(
          player.getByRole('heading', { name: 'Your turn' }),
        ).toBeVisible();
        await move(player, index);
      }
      for (const player of [host, guest])
        await expect(
          player.getByRole('heading', { name: 'Mira wins!' }),
        ).toBeVisible();
      await host.getByRole('button', { name: 'Play again' }).click();
      await move(host, roomGame === 'connect-four' ? 3 : 4);
      await expect(
        guest.getByRole('heading', { name: 'Your turn' }),
      ).toBeVisible();
      await host.reload();
      await expect(
        host.getByRole('heading', { name: 'Match paused' }),
      ).toBeVisible();
      await host
        .getByRole('button', { name: 'Create reconnect invitation' })
        .click();
      await expect(host.getByLabel('Invitation to share')).toHaveValue(
        /invite=/,
      );
      const newInvite = await host
        .getByLabel('Invitation to share')
        .inputValue();
      // Opening a new invitation restores the same guest seat on a fresh document.
      await guest.goto(newInvite);
      await guest.getByLabel('Your room name').fill('Kai');
      await guest
        .getByRole('button', { name: 'Join room', exact: true })
        .click();
      await expect(guest.getByLabel('Answer to share')).toHaveValue(/answer=/);
      await host
        .getByLabel('Guest’s answer link')
        .fill(await guest.getByLabel('Answer to share').inputValue());
      await host.getByRole('button', { name: 'Accept answer' }).click();
      await expect(
        guest.getByRole('heading', { name: 'Your turn' }),
      ).toBeVisible({ timeout: 20_000 });
      if (roomGame === 'connect-four')
        await expect(
          guest.getByRole('img', { name: 'Row 6, column 4: red', exact: true }),
        ).toBeVisible();
      else
        await expect(
          guest.getByRole('button', { name: 'Row 2, column 2: X' }),
        ).toBeVisible();
      await move(guest, 0);
      if (roomGame === 'connect-four')
        await expect(
          host.getByRole('img', { name: 'Row 6, column 1: gold', exact: true }),
        ).toBeVisible();
      else
        await expect(
          host.getByRole('button', { name: 'Row 1, column 1: O' }),
        ).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await guestContext.close();
    }
  });
}
