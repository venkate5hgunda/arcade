import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
async function admit(host: Page, guest: Page, name: string, invite: string) {
  await guest.goto(invite);
  await guest.getByLabel('Your room name').fill(name);
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(guest.getByLabel('Answer to share')).toHaveValue(/answer=/);
  await host
    .getByLabel('Guest’s answer link')
    .fill(await guest.getByLabel('Answer to share').inputValue());
  await host
    .getByRole('button', { name: 'Accept answer', exact: true })
    .click();
  await expect(host.getByLabel('Invitation to share')).toBeHidden();
}

test('a spectator watches a full win, recovers with the host, and never blocks the players', async ({
  page: host,
  browser,
}, testInfo) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  await host.context().addInitScript(localIce);
  for (const context of contexts) await context.addInitScript(localIce);
  const [guest, viewer] = await Promise.all(contexts.map((c) => c.newPage()));
  try {
    await host.goto('/#/room');
    await host.getByLabel('Your room name').fill('Mira');
    await host
      .getByRole('button', { name: 'Create a room', exact: true })
      .click();
    await expect(host.getByLabel('Invitation to share')).toHaveValue(/invite=/);
    await admit(
      host,
      guest,
      'Kai',
      await host.getByLabel('Invitation to share').inputValue(),
    );
    await expect(
      host.getByRole('button', { name: 'Start Tic-Tac-Toe' }),
    ).toBeVisible();
    await host.getByRole('button', { name: 'Start Tic-Tac-Toe' }).click();
    await host.getByRole('button', { name: 'Invite a spectator' }).click();
    await expect(host.getByLabel('Invitation to share')).toHaveValue(/invite=/);
    await admit(
      host,
      viewer,
      'Rae',
      await host.getByLabel('Invitation to share').inputValue(),
    );
    await expect(
      viewer.getByText('You’re spectating.', { exact: false }),
    ).toBeVisible();
    await expect(viewer.locator('.square')).toHaveCount(9);
    for (const square of await viewer.locator('.square').all())
      await expect(square).toHaveAttribute('aria-disabled', 'true');
    for (const [player, index] of [
      [host, 0],
      [guest, 3],
      [host, 1],
      [guest, 4],
      [host, 2],
    ] as const) {
      await expect(
        player.getByRole('heading', { name: 'Your turn' }),
      ).toBeVisible();
      await player.locator('.square').nth(index).click();
    }
    await expect(
      viewer.getByRole('heading', { name: 'Mira wins!' }),
    ).toBeVisible();
    await viewer.getByText('Room standings', { exact: true }).click();
    await expect(
      viewer.getByRole('list', { name: 'Room leaderboard' }),
    ).not.toContainText('Rae');
    expect(
      (await new AxeBuilder({ page: viewer }).analyze()).violations,
    ).toEqual([]);
    await viewer.screenshot({
      path: testInfo.outputPath('spectator-win.png'),
      fullPage: true,
    });
    await host.reload();
    await expect(
      host.getByRole('button', { name: 'Create reconnect invitation' }),
    ).toBeVisible();
    await host
      .getByRole('button', { name: 'Create reconnect invitation' })
      .click();
    await expect(host.getByLabel('Invitation to share')).toHaveValue(/invite=/);
    await admit(
      host,
      guest,
      'Kai',
      await host.getByLabel('Invitation to share').inputValue(),
    );
    await host.getByText('Room options', { exact: true }).click();
    await host.getByRole('button', { name: 'Reconnect Rae' }).click();
    await expect(host.getByLabel('Invitation to share')).toHaveValue(/invite=/);
    await admit(
      host,
      viewer,
      'Rae',
      await host.getByLabel('Invitation to share').inputValue(),
    );
    await expect(
      viewer.getByText('You’re spectating.', { exact: false }),
    ).toBeVisible();
    host.once('dialog', (dialog) => dialog.accept());
    await host.getByRole('button', { name: 'Return to lobby' }).click();
    await host.getByLabel('Play in next game: Kai').uncheck();
    await host.getByText('Spectators (2)', { exact: true }).click();
    await host.getByLabel('Play in next game: Rae').check();
    await host.getByRole('button', { name: 'Start Tic-Tac-Toe' }).click();
    await contexts[0].close();
    await host.locator('.square').nth(4).click();
    await expect(
      viewer.getByRole('heading', { name: 'Your turn' }),
    ).toBeVisible();
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

for (const game of ['uno', 'rps', 'mafia', 'business', 'catan'] as const) {
  test(`spectator ${game} table renders only public information`, async ({
    page: host,
    browser,
  }) => {
    test.setTimeout(90000);
    await host.context().addInitScript(localIce);
    const count = game === 'mafia' ? 4 : game === 'catan' ? 2 : 1;
    const contexts = await Promise.all(
      Array.from({ length: count + 1 }, () => browser.newContext()),
    );
    try {
      for (const context of contexts) await context.addInitScript(localIce);
      const players = await Promise.all(contexts.map((c) => c.newPage()));
      const viewer = players.pop()!;
      const errors: string[] = [];
      viewer.on('pageerror', (e) => errors.push(e.message));
      await host.goto('/#/room');
      await host.getByLabel('Your room name').fill('Mira');
      await host
        .getByRole('button', { name: 'Create a room', exact: true })
        .click();
      for (const [index, guest] of players.entries()) {
        if (index)
          await host
            .getByRole('button', { name: 'Invite another player', exact: true })
            .click({ timeout: 30000 });
        await expect(host.getByLabel('Invitation to share')).toHaveValue(
          /invite=/,
        );
        await admit(
          host,
          guest,
          `Player ${index + 2}`,
          await host.getByLabel('Invitation to share').inputValue(),
        );
        await expect(
          host.getByRole('button', {
            name: 'Invite another player',
            exact: true,
          }),
        ).toBeVisible({ timeout: 30000 });
      }
      await host
        .getByRole('combobox', { name: 'Room game' })
        .selectOption(game);
      await host.getByRole('button', { name: /^Start / }).click();
      await host.getByRole('button', { name: 'Invite a spectator' }).click();
      await expect(host.getByLabel('Invitation to share')).toHaveValue(
        /invite=/,
      );
      await admit(
        host,
        viewer,
        'Watcher',
        await host.getByLabel('Invitation to share').inputValue(),
      );
      await expect(
        viewer.getByText('You’re spectating.', { exact: false }),
      ).toBeVisible();
      if (game === 'uno') {
        await expect(
          viewer.getByLabel('Your cards', { exact: true }),
        ).toHaveCount(0);
        await expect(
          viewer.getByRole('img', { name: /^Draw pile, \d+ cards?$/ }),
        ).toBeVisible();
        await expect(
          viewer.getByRole('img', { name: /^Discard pile, top card/ }),
        ).toBeVisible();
      } else if (game === 'rps') {
        await expect(viewer.locator('.rps-choices')).toBeHidden();
        await expect(
          viewer.getByRole('heading', { name: 'Watching the secret throws' }),
        ).toBeVisible();
      } else if (game === 'mafia') {
        await expect(
          viewer.getByText('The Balcony', { exact: true }),
        ).toBeVisible();
        await expect(viewer.getByText(/YOUR SECRET CARD/)).toHaveCount(0);
      } else if (game === 'catan') {
        await expect(
          viewer.getByText('Your private cargo and discoveries', {
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(
          viewer.getByRole('group', { name: 'Island chart', exact: true }),
        ).toBeVisible();
      } else await expect(viewer.locator('.business-table')).toBeVisible();
      expect(
        await viewer.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page: viewer }).analyze()).violations,
      ).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
}
