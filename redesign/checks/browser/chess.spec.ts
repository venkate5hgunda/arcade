import { settleStorage } from './storage-helpers.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { newChess } from '../../src/lib/chess.ts';
import type { ChessState } from '../../src/lib/chess.ts';
async function seed(page: Page, s: ChessState) {
  await page.goto('/');
  await page.evaluate(
    (s) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ chess: { state: s, savedAt: Date.now() } }),
      ),
    s,
  );
  await page.goto('/#/game/chess');
}
async function move(page: Page, from: string, to: string) {
  await page.getByRole('button', { name: new RegExp(`^${from},`) }).click();
  await page
    .getByRole('button', { name: new RegExp(`^${to},.*legal move`) })
    .click();
  await settleStorage(page);
}
test('Chess plays checkmate with legal hints, reload, keyboard board and rematch', async ({
  page,
}) => {
  await seed(page, newChess('pvp', 'w'));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'a8, Black rook' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('button', { name: 'b8, Black knight' }),
  ).toBeFocused();
  await move(page, 'f2', 'f3');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Black to move' }),
  ).toBeVisible();
  await move(page, 'e7', 'e5');
  await move(page, 'g2', 'g4');
  await move(page, 'd8', 'h4');
  await expect(
    page.getByRole('heading', { name: 'Checkmate! Black wins!' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}').chess,
    ),
  ).toBeUndefined();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/chess-${test.info().project.name}.png`,
  });
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'White to move' }),
  ).toBeVisible();
});
test('Chess promotion survives reload and AI plays either side', async ({
  page,
}) => {
  const s = newChess('pvp', 'w');
  s.state.board.fill(null);
  s.state.board[4] = { type: 'k', color: 'w' };
  s.state.board[60] = { type: 'k', color: 'b' };
  s.state.board[48] = { type: 'p', color: 'w' };
  s.state.castling = { wK: false, wQ: false, bK: false, bQ: false };
  await seed(page, s);
  await move(page, 'a7', 'a8');
  await page.reload();
  await expect(
    page.getByRole('group', { name: 'Choose promotion' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Promote to knight' }).click();
  await expect(
    page.getByRole('button', { name: 'a8, White knight' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Draw!' })).toBeVisible();
  await seed(page, newChess('ai', 'b'));
  await expect(
    page.getByRole('heading', { name: 'Black to move' }),
  ).toBeVisible();
  const state = await page.evaluate(
    () => JSON.parse(localStorage.getItem('arcade:game.sessions')!).chess.state,
  );
  expect(state.lastMove).not.toBeNull();
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
test('Chess real room preserves a game after host reload and completes with the correct winner', async ({
  page: host,
  browser,
}) => {
  test.setTimeout(120000);
  await host.context().addInitScript(localIce);
  const context = await browser.newContext();
  await context.addInitScript(localIce);
  const guest = await context.newPage();
  async function connect(reconnect = false) {
    if (reconnect)
      await host
        .getByRole('button', {
          name: 'Create reconnect invitation',
          exact: true,
        })
        .click();
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
    await host.goto('/#/room');
    await host.getByLabel('Your room name').fill('Mira');
    await host
      .getByRole('button', { name: 'Create a room', exact: true })
      .click();
    await connect();
    await expect(host.getByLabel('Room game')).toBeVisible({ timeout: 20000 });
    await host.getByLabel('Room game').selectOption('chess');
    await host
      .getByRole('button', { name: 'Start Chess', exact: true })
      .click();
    await move(host, 'f2', 'f3');
    await host.reload();
    await expect(
      host.getByRole('heading', { name: 'Match paused' }),
    ).toBeVisible();
    await connect(true);
    await expect(
      guest.getByText('Your turn. Select a piece, then a highlighted square.'),
    ).toBeVisible({ timeout: 20000 });
    await move(guest, 'e7', 'e5');
    await expect(
      host.getByText('Your turn. Select a piece, then a highlighted square.'),
    ).toBeVisible();
    await move(host, 'g2', 'g4');
    await expect(
      guest.getByText('Your turn. Select a piece, then a highlighted square.'),
    ).toBeVisible();
    await move(guest, 'd8', 'h4');
    await expect(
      host.getByRole('heading', { name: 'Checkmate! Kai wins!' }),
    ).toBeVisible();
    await host.getByRole('button', { name: 'Play again', exact: true }).click();
    await expect(
      guest.getByRole('heading', { name: 'Mira to move' }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
