import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function seed(page: Page, phase = 'p1pick', extra = {}) {
  await page.goto('/');
  await page.evaluate(
    ({ phase, extra }) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({
          rps: {
            state: {
              mode: 'pvp',
              target: 3,
              score: [0, 0],
              round: 0,
              p1Pick: null,
              p2Pick: null,
              phase,
              deadline: 0,
              ...extra,
            },
            savedAt: Date.now(),
          },
        }),
      ),
    { phase, extra },
  );
  await page.goto('/#/game/rps');
}
test('RPS plays a full secret-pick match, draws, restores and replays', async ({
  page,
}) => {
  await seed(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (let round = 0; round < 4; round++) {
    await page.getByRole('button', { name: 'Rock', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Pass the device' }),
    ).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'Choose your throw' }),
    ).toHaveCount(0);
    if (!round) await page.reload();
    await page.getByRole('button', { name: "I'm ready", exact: true }).click();
    await page
      .getByRole('button', { name: round ? 'Scissors' : 'Rock', exact: true })
      .click();
    await expect(page.getByRole('img', { name: /Player 1: rock/ })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('heading', {
        name:
          round === 3
            ? 'Player 1 wins the match!'
            : round
              ? 'Player 1 wins the round!'
              : "It's a draw!",
      }),
    ).toBeVisible();
    if (round < 3)
      await page
        .getByRole('button', { name: 'Next round', exact: true })
        .click();
  }
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}').rps,
    ),
  ).toBeUndefined();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'node_modules/.cache/rps-' + test.info().project.name + '.png',
  });
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1’s throw' }),
  ).toBeVisible();
});
test('RPS restores an expired countdown once, preserves target and cancels timers on navigation', async ({
  page,
}) => {
  await seed(page, 'countdown', {
    target: 7,
    p1Pick: 'paper',
    p2Pick: 'rock',
    deadline: Date.now() - 1000,
  });
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins the round!' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 / 7')).toBeVisible();
  await page.getByRole('button', { name: 'Next round', exact: true }).click();
  await page.getByRole('button', { name: 'Paper', exact: true }).click();
  await page.getByRole('button', { name: "I'm ready", exact: true }).click();
  await page.getByRole('button', { name: 'Rock', exact: true }).click();
  await page.getByRole('link', { name: 'Back to the shelf' }).click();
  await expect(
    page.getByRole('heading', { name: 'Pick up where you left off' }),
  ).toBeVisible();
  await page.waitForTimeout(2400);
  const s = await page.evaluate(
    () => JSON.parse(localStorage.getItem('arcade:game.sessions')!).rps.state,
  );
  expect(s.phase).toBe('countdown');
  expect(s.score).toEqual([1, 0]);
});
test('RPS computer and saved setup options stay playable', async ({ page }) => {
  await page.goto('/#/game/rps');
  await page.getByText('Match options', { exact: true }).click();
  await page.getByRole('combobox', { name: /First to/ }).selectOption('5');
  await page
    .getByRole('button', { name: 'Start playing →', exact: true })
    .click();
  await page.getByRole('button', { name: 'Paper', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Next round', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: /Computer:/ })).toBeVisible();
  await expect(page.getByText('Round 1 · First to 5')).toBeVisible();
});
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
test('RPS private room completes, replays and recovers a locked throw after host reload', async ({
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
      await host.getByText('Room players (2)', { exact: true }).click();
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
    await expect(host.getByText('Kai', { exact: true })).toBeVisible({
      timeout: 20000,
    });
  }
  try {
    await host.goto('/#/room');
    await host.getByLabel('Your room name').fill('Mira');
    await host
      .getByRole('button', { name: 'Create a room', exact: true })
      .click();
    await connect();
    await expect(host.getByLabel('Room game')).toBeVisible({ timeout: 20000 });
    await host.getByLabel('Room game').selectOption('rps');
    await host
      .getByRole('button', { name: 'Start Rock Paper Scissors', exact: true })
      .click();
    await host.getByRole('button', { name: 'Rock', exact: true }).click();
    await expect(
      guest.getByRole('button', { name: 'Paper', exact: true }),
    ).toBeEnabled({ timeout: 20000 });
    await expect(guest.getByRole('img', { name: /Mira:/ })).toHaveCount(0);
    await host.reload();
    await expect(
      host.getByRole('heading', { name: 'Match paused' }),
    ).toBeVisible();
    await connect(true);
    for (let i = 0; i < 3; i++) {
      if (i) {
        await host
          .getByRole('button', { name: 'Next round', exact: true })
          .click();
        await host.getByRole('button', { name: 'Rock', exact: true }).click();
      }
      await guest
        .getByRole('button', { name: 'Scissors', exact: true })
        .click();
      await expect(
        guest.getByRole('heading', {
          name: i === 2 ? 'Mira wins the match!' : 'Mira wins the round!',
        }),
      ).toBeVisible({ timeout: 20000 });
    }
    await host.getByRole('button', { name: 'Play again', exact: true }).click();
    await expect(
      guest.getByRole('heading', { name: 'Choose your secret throw' }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
