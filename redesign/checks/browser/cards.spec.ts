import { test, expect } from '@playwright/test';
import type { Page, BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  newCrazyEightsGame,
  eightDeck,
  newUnoGame,
  unoDeck,
  cardView,
} from '../../src/lib/cards.ts';
import type {
  CardState,
  CardGameId,
  UnoState,
  EightState,
} from '../../src/lib/cards.ts';
function finalEight(): CardState {
  const s = newCrazyEightsGame(() => 0.5),
    deck = eightDeck(() => 0.5);
  s.hands = [
    [deck.find((c) => c.rank === '8' && c.suit === '♥')!],
    [deck.find((c) => c.rank === '3' && c.suit === '♦')!],
  ];
  s.discard = [deck.find((c) => c.rank === '5' && c.suit === '♠')!];
  s.activeSuit = '♠';
  const used = [...s.hands.flat(), ...s.discard];
  s.stock = deck.filter((c) => !used.includes(c));
  return { gameId: 'crazy-eights', state: s };
}
function rigUno(count = 3, challenge = false): CardState {
  const s = newUnoGame(count, () => 0.5),
    deck = unoDeck(count);
  s.discard = [deck[0]];
  s.color = 'red';
  s.current = 0;
  s.direction = 1;
  s.drawnId = null;
  s.winner = null;
  s.challenge = null;
  s.unoPending = null;
  s.unoDeclared = null;
  const give = (color: string, value: string) =>
    deck.find((c) => c.color === color && c.value === value)!;
  s.hands = challenge
    ? [
        [give('wild', 'wild4'), give('red', '5')],
        [give('blue', '3')],
        [give('yellow', '9')],
      ]
    : [
        [give('red', '5')],
        [give('blue', '3')],
        ...(count === 3 ? [[give('yellow', '9')]] : []),
      ];
  const ids = new Set([...s.hands.flat(), ...s.discard].map((c) => c.id));
  s.stock = deck.filter((c) => !ids.has(c.id));
  return { gameId: 'uno', state: s };
}
async function seed(page: Page, game: CardState) {
  await page.goto('/');
  await page.evaluate((game) => {
    localStorage.setItem(
      'arcade:game.sessions',
      JSON.stringify({
        [game.gameId]: { state: game.state, savedAt: Date.now() },
      }),
    );
  }, game);
  await page.goto(`/#/game/${game.gameId}`);
}
async function saved<T>(page: Page, id: string): Promise<T> {
  return page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')[id]
        ?.state,
    id,
  );
}

test('Crazy Eights conceals local hands, restores suit choice, wins and redeals', async ({
  page,
}) => {
  await seed(page, finalEight());
  await expect(page.getByRole('region', { name: 'Your cards' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal my hand' }).click();
  await expect(page.locator('.private-hand h3')).toBeFocused();
  await page
    .getByRole('button', { name: '8 of hearts, play card', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('group', { name: 'Choose a suit' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '♠', exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your cards' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal my hand' }).click();
  await expect(
    page.getByRole('button', { name: '♠', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: '♣', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins!' }),
  ).toBeFocused();
  expect(await saved(page, 'crazy-eights')).toBeUndefined();
  await page.getByRole('button', { name: 'Deal again' }).click();
  await expect(
    page.getByRole('button', { name: 'Reveal my hand' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reveal my hand' }).click();
  await expect(
    page.getByRole('region', { name: 'Your cards' }).getByRole('button'),
  ).toHaveCount(7);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('UNO callout, private handoff, draw-four challenge, drawing and reload follow the real checkpoint', async ({
  page,
}) => {
  await seed(page, rigUno(3, true));
  await page.getByRole('button', { name: 'Reveal my hand' }).click();
  await page.getByRole('button', { name: 'Call UNO', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'UNO called ✓' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'wild wild4, play card' }).click();
  await page.getByRole('button', { name: 'green', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Pass to Player 2', exact: true }),
  ).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Your cards' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal my hand' }).click();
  await page.getByRole('button', { name: 'Challenge +4' }).click();
  const s = await saved<UnoState>(page, 'uno');
  expect(s.current).toBe(1);
  expect(s.challenge).toBeNull();
  expect(s.hands[0]).toHaveLength(5);
  await page.getByRole('button', { name: 'Draw a card', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Draw a card', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your cards' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal my hand' }).click();
  await page.getByRole('button', { name: 'Pass turn', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Reveal my hand' }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test('local handoff permits a late UNO call and a new match covers the next hand', async ({
  page,
}) => {
  await seed(page, rigUno(3, true));
  await page.getByRole('button', { name: 'Reveal my hand' }).click();
  await page.getByRole('button', { name: 'wild wild4, play card' }).click();
  await page.getByRole('button', { name: 'green', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your cards' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'I’m Player 1 · call UNO' }).click();
  await expect(
    page.getByRole('button', { name: 'Reveal my hand' }),
  ).toBeFocused();
  expect((await saved<UnoState>(page, 'uno')).unoPending).toBeNull();
  await expect(page.getByRole('region', { name: 'Your cards' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal my hand' }).click();
  await expect(
    page.getByRole('button', { name: 'Catch missed UNO (+2)' }),
  ).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New match' }).click();
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(
    page.getByRole('button', { name: 'Reveal my hand' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your cards' })).toHaveCount(0);
});
test('UNO supports 20 local players, a 216-card deck, complete wins, names and record-free reset', async ({
  page,
}) => {
  await page.goto('/#/game/uno');
  await page.getByText('Match options', { exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Players', exact: true })
    .selectOption('20');
  await page.getByText('Player names', { exact: true }).click();
  await page.getByLabel('Player 20 name', { exact: true }).fill('Rae');
  await page.getByRole('button', { name: 'Start playing' }).click();
  const s = await saved<UnoState>(page, 'uno');
  expect(s.hands).toHaveLength(20);
  expect(s.stock).toHaveLength(75);
  await expect(page.getByText('Rae', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal my hand' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await seed(page, rigUno(2));
  await page.getByRole('button', { name: 'Reveal my hand' }).click();
  await page
    .getByRole('button', { name: 'red 5, play card', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins!' }),
  ).toBeVisible();
  expect(await saved(page, 'uno')).toBeUndefined();
  await page.getByRole('button', { name: 'Deal again' }).click();
  await expect(
    page.getByRole('button', { name: 'Reveal my hand' }),
  ).toBeVisible();
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
async function join(host: Page, guest: Page, name: string, first = false) {
  if (!first)
    await host
      .getByRole('button', { name: 'Invite another player', exact: true })
      .click();
  await expect(host.getByLabel('Invitation to share')).toHaveValue(/invite=/);
  await guest.goto(await host.getByLabel('Invitation to share').inputValue());
  await guest.getByLabel('Your room name').fill(name);
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(guest.getByLabel('Answer to share')).toHaveValue(/answer=/);
  await host
    .getByLabel('Guest’s answer link')
    .fill(await guest.getByLabel('Answer to share').inputValue());
  await host.getByRole('button', { name: 'Accept answer' }).click();
  await expect(
    host.getByRole('button', { name: 'Invite another player', exact: true }),
  ).toBeVisible({ timeout: 20_000 });
}
for (const gameId of ['crazy-eights', 'uno'] as const) {
  test(`real private ${gameId} room: admission, projections, host reload, same seats, win and replay`, async ({
    page: host,
    browser,
  }) => {
    test.setTimeout(120000);
    const contexts: BrowserContext[] = [];
    await host.context().addInitScript(localIce);
    try {
      const guests: Page[] = [];
      for (let i = 0; i < (gameId === 'uno' ? 2 : 1); i++) {
        const context = await browser.newContext();
        contexts.push(context);
        await context.addInitScript(localIce);
        guests.push(await context.newPage());
      }
      await host.goto('/#/room');
      await host.getByLabel('Your room name').fill('Mira');
      await host
        .getByRole('button', { name: 'Create a room', exact: true })
        .click();
      for (let i = 0; i < guests.length; i++)
        await join(host, guests[i], i === 0 ? 'Kai' : 'Rae', i === 0);
      await host
        .getByRole('combobox', { name: 'Room game' })
        .selectOption(gameId);
      await host
        .getByRole('button', {
          name: `Start ${gameId === 'uno' ? 'UNO-inspired' : 'Crazy Eights'}`,
          exact: true,
        })
        .click();
      for (const guest of guests) {
        await expect(
          guest.getByRole('region', { name: 'Your cards' }).getByRole('button'),
        ).toHaveCount(7);
        expect(
          await guest.evaluate(() =>
            sessionStorage.getItem('arcade:redesign:room:v2'),
          ),
        ).toBeNull();
      }
      const fixture = gameId === 'uno' ? rigUno(3) : finalEight();
      const ownViews = await Promise.all(
        [host, ...guests].map((p) =>
          p
            .getByRole('region', { name: 'Your cards' })
            .getByRole('button')
            .allTextContents(),
        ),
      );
      expect(ownViews).toHaveLength(guests.length + 1);
      await host.evaluate(
        ({ game, view }) => {
          const saved = JSON.parse(
            sessionStorage.getItem('arcade:redesign:room:v2')!,
          );
          saved.privateGame = game;
          saved.snapshot.cardMatch.view = view;
          sessionStorage.setItem(
            'arcade:redesign:room:v2',
            JSON.stringify(saved),
          );
        },
        { game: fixture, view: cardView(fixture, 0) },
      );
      await host.reload();
      await expect(
        host.getByRole('heading', { name: 'Match paused' }),
      ).toBeVisible();
      for (let i = 0; i < guests.length; i++) {
        await expect(
          host.getByRole('button', {
            name: 'Create reconnect invitation',
            exact: true,
          }),
        ).toBeVisible();
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
        await guests[i]
          .getByLabel('Your room name')
          .fill(i === 0 ? 'Kai' : 'Rae');
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
          guests[i]
            .getByRole('region', { name: 'Your cards' })
            .getByRole('button'),
        ).toHaveCount(1, { timeout: 20_000 });
      }
      await expect(
        host.getByRole('heading', { name: 'Your turn', exact: true }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        guests[0].getByRole('button', {
          name:
            gameId === 'uno' ? 'red 5, play card' : '8 of hearts, play card',
        }),
      ).toHaveCount(0);
      if (gameId === 'uno')
        await host
          .getByRole('button', { name: 'red 5, play card', exact: true })
          .click();
      else {
        await host
          .getByRole('button', { name: '8 of hearts, play card', exact: true })
          .click();
        await host.getByRole('button', { name: '♣', exact: true }).click();
      }
      for (const page of [host, ...guests])
        await expect(
          page.getByRole('heading', { name: 'Mira wins!', exact: true }),
        ).toBeVisible();
      await host
        .getByRole('button', { name: 'Play again', exact: true })
        .click();
      for (const guest of guests)
        await expect(
          guest.getByRole('region', { name: 'Your cards' }).getByRole('button'),
        ).toHaveCount(7);
      expect(
        (await new AxeBuilder({ page: host }).analyze()).violations,
      ).toEqual([]);
      expect(
        await host.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    } finally {
      for (const context of contexts) await context.close();
    }
  });
}

test('restored UNO player count survives a fresh deal without saved settings', async ({
  page,
}) => {
  await seed(page, { gameId: 'uno', state: newUnoGame(4, () => 0.5) });
  await expect(
    page.getByRole('button', { name: 'Reveal my hand' }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page.getByRole('button', { name: 'Start playing →' }).click();
  await expect
    .poll(async () => (await saved<UnoState>(page, 'uno'))?.hands.length)
    .toBe(4);
});
