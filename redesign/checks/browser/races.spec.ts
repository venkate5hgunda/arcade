import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { newRace } from '../../src/lib/races.ts';
import type { RaceState } from '../../src/lib/races.ts';

async function seed(page: Page, game: RaceState, sample: number) {
  await page.context().addInitScript((value) => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = ((array: ArrayBufferView) => {
      if (array instanceof Uint32Array && array.length === 1) {
        array[0] = value;
        return array;
      }
      return original(array as Uint8Array);
    }) as typeof crypto.getRandomValues;
  }, sample);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(
    (game) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({
          [game.gameId]: { state: game.state, savedAt: Date.now() },
        }),
      ),
    game,
  );
  await page.goto(`/#/game/${game.gameId}`);
}

test('Snakes restores a legacy checkpoint, navigates the board, slides and finishes with an exact roll', async ({
  page,
}) => {
  const game = newRace('snakes-ladders', 3, 'demo');
  if (game.gameId !== 'snakes-ladders') throw Error('wrong game');
  game.state.positions[0] = 98;
  delete (game.state as Partial<typeof game.state>).winner;
  await seed(page, game, 0);
  const board = page.getByRole('region', { name: 'Snakes and Ladders board' });
  const square = board.getByRole('button', { name: /Square 98/ });
  await square.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(board.getByRole('button', { name: /Square 99/ })).toBeFocused();
  await page.getByRole('button', { name: 'Roll die' }).click();
  await expect(page.getByText(/slides from 99 to 21/).first()).toBeVisible();
  await expect(board.getByLabel('Player 1 on square 21')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('arcade:game.sessions')!);
    saved['snakes-ladders'].state.positions[0] = 99;
    saved['snakes-ladders'].state.current = 0;
    localStorage.setItem('arcade:game.sessions', JSON.stringify(saved));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Roll die' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins!' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')[
          'snakes-ladders'
        ],
    ),
  ).toBeUndefined();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('.race-player')).toHaveCount(3);
});

test('Ludo offers accessible choices, releases a token, restores it and gives another turn on six', async ({
  page,
}) => {
  const game = newRace('ludo', 4);
  if (game.gameId !== 'ludo') throw Error('wrong game');
  await seed(page, game, 0xffffffff);
  await page.getByRole('button', { name: 'Roll die' }).click();
  await expect(
    page.getByRole('group', { name: 'Choose a token' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Move token 3' }).click();
  await expect(
    page.getByRole('button', { name: /Player 1 token 3, progress 0/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Player 1’s turn' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: /Player 1 token 3, progress 0/ }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('Ludo completes a restored four-player match and starts a four-player rematch', async ({
  page,
}) => {
  const game = newRace('ludo', 4);
  if (game.gameId !== 'ludo') throw Error('wrong game');
  game.state.tokens[0] = [57, 58, 58, 58];
  await seed(page, game, 0);
  await page.getByRole('button', { name: 'Roll die' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins!' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('.race-player')).toHaveCount(4);
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

test('three players join a real race room, take turns, and recover the host', async ({
  page: host,
  browser,
}) => {
  test.setTimeout(120000);
  await host.context().addInitScript(localIce);
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  try {
    const guests: Page[] = [];
    for (const context of contexts) {
      await context.addInitScript(localIce);
      guests.push(await context.newPage());
    }
    await host.goto('/#/room');
    await host.getByLabel('Your room name').fill('Mira');
    await host
      .getByRole('button', { name: 'Create a room', exact: true })
      .click();
    for (let i = 0; i < guests.length; i++) {
      if (i)
        await host
          .getByRole('button', { name: 'Invite another player', exact: true })
          .click();
      await expect(host.getByLabel('Invitation to share')).toHaveValue(
        /invite=/,
      );
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
      await host.getByRole('button', { name: 'Accept answer' }).click();
      await expect(
        host.getByRole('button', {
          name: 'Invite another player',
          exact: true,
        }),
      ).toBeVisible({ timeout: 20000 });
    }
    await host
      .getByRole('combobox', { name: 'Room game' })
      .selectOption('snakes-ladders');
    await host
      .getByRole('button', { name: 'Start Snakes & Ladders', exact: true })
      .click();
    for (const guest of guests)
      await expect(
        guest.getByRole('region', { name: 'Snakes and Ladders board' }),
      ).toBeVisible({ timeout: 20000 });
    await expect(
      guests[0].getByRole('button', { name: 'Roll die' }),
    ).toBeDisabled();
    await host.getByRole('button', { name: 'Roll die' }).click();
    await expect(
      guests[0].getByRole('button', { name: 'Roll die' }),
    ).toBeEnabled({ timeout: 20000 });
    await host.reload();
    await expect(
      host.getByRole('heading', { name: 'Match paused' }),
    ).toBeVisible();
    for (let i = 0; i < guests.length; i++) {
      await host
        .getByRole('button', {
          name: 'Create reconnect invitation',
          exact: true,
        })
        .click();
      await expect(host.getByLabel('Invitation to share')).toHaveValue(
        /invite=/,
      );
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
      await host.getByRole('button', { name: 'Accept answer' }).click();
      if (i === 0)
        await expect(
          host.getByRole('button', {
            name: 'Create reconnect invitation',
            exact: true,
          }),
        ).toBeVisible({ timeout: 20000 });
    }
    await expect(
      guests[0].getByRole('button', { name: 'Roll die' }),
    ).toBeEnabled({ timeout: 20000 });
    await guests[0].getByRole('button', { name: 'Roll die' }).click();
    await expect(
      guests[1].getByRole('button', { name: 'Roll die' }),
    ).toBeEnabled({ timeout: 20000 });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('Snakes animates each square and blocks the next roll until travel finishes', async ({
  page,
}) => {
  const game = newRace('snakes-ladders', 2, 'demo');
  if (game.gameId !== 'snakes-ladders') throw Error('wrong game');
  game.state.positions[0] = 40;
  await seed(page, game, 0xffffffff);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Roll die' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 is moving…' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roll die' })).toBeDisabled();
  await expect(page.getByLabel('Player 1 on square 41')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Player 2’s turn' }),
  ).toBeVisible({ timeout: 5000 });
});
