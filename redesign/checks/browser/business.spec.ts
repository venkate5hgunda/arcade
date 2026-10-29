import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createBusiness, actBusiness } from '../../src/lib/business-core.js';

test('Business handoffs, trading, board inspection and a completed game work across reloads', async ({
  page,
}) => {
  let state = createBusiness(2, { turnLimit: 1 }, () => 0.2);
  state = actBusiness(state, { type: 'roll', dice: [1, 3] }, 0, () => 0.2);
  await page.goto('/');
  await page.evaluate(
    (value) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ business: { state: value, savedAt: Date.now() } }),
      ),
    state,
  );
  await page.goto('/#/game/business');
  await page
    .getByRole('button', { name: 'I’m ready · reveal my actions' })
    .click();
  await page.getByText('More actions', { exact: true }).click();
  await page.getByRole('button', { name: 'Arrange a trade' }).click();
  await page.getByLabel('Cash to give').fill('10');
  await page.getByRole('button', { name: 'Send offer' }).click();
  await expect(page.getByText('Pass the device to Player 2.')).toBeVisible();
  await page.reload();
  await page
    .getByRole('button', { name: 'I’m ready · reveal my actions' })
    .click();
  await page.getByRole('button', { name: 'Accept trade' }).click();
  await page
    .getByRole('button', { name: 'I’m ready · reveal my actions' })
    .click();
  await page.getByText('Explore the board & inspect deeds').click();
  await expect(
    page.getByLabel('Fortune draw pile, cards face down'),
  ).toBeVisible();
  await expect(page.locator('.business-space')).toHaveCount(40);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/business-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'End turn →' }).click();
  await expect(
    page.getByRole('heading', { name: 'Final standings', level: 2 }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByText('Pass the device to Player 1.')).toBeVisible();
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
test('Business ignores malformed saved setup rather than failing to start', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'arcade:game.settings:business',
      JSON.stringify({
        count: '99',
        turnLimit: -1,
        startingCash: 0,
        rollToStart: 'yes',
      }),
    ),
  );
  await page.goto('/#/game/business');
  await page.getByRole('button', { name: 'Start playing →' }).click();
  await expect(page.getByText('Pass the device to Player 1.')).toBeVisible();
});
test('Business room connects two browsers, trades and restores the host without sharing decks', async ({
  page: host,
  browser,
}) => {
  test.setTimeout(90000);
  await host.context().addInitScript(localIce);
  const context = await browser.newContext();
  await context.addInitScript(localIce);
  const guest = await context.newPage();
  try {
    await host.goto('/#/game/business');
    await host
      .getByRole('link', { name: 'Different screens? Start a private room →' })
      .click();
    await host.getByLabel('Your room name').fill('Mira');
    await host
      .getByRole('button', { name: 'Create a room', exact: true })
      .click();
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
      await expect(host.getByLabel('Invitation to share')).toHaveValue(
        /invite=/,
      );
      await guest.goto(
        await host.getByLabel('Invitation to share').inputValue(),
      );
      await guest.getByLabel('Your room name').fill('Kai');
      await guest
        .getByRole('button', { name: 'Join room', exact: true })
        .click();
      await expect(guest.getByLabel('Answer to share')).toHaveValue(/answer=/);
      await host
        .getByLabel('Guest’s answer link')
        .fill(await guest.getByLabel('Answer to share').inputValue());
      await host
        .getByRole('button', { name: 'Accept answer', exact: true })
        .click();
      await expect(
        host.getByLabel('Room players').getByText('Connected', { exact: true }),
      ).toHaveCount(2, { timeout: 20000 });
    }
    await connect();
    await host.getByRole('button', { name: 'Start Business' }).click();
    await expect(
      guest.getByRole('heading', { name: 'Waiting for Mira' }),
    ).toBeVisible();
    expect(
      await guest.evaluate(() =>
        sessionStorage.getItem('arcade:redesign:room:v9'),
      ),
    ).toBeNull();
    await host.reload();
    await expect(
      host.getByText('Room restored.', { exact: false }),
    ).toBeVisible();
    await connect(true);
    await host.getByText('More actions', { exact: true }).click();
    await host.getByRole('button', { name: 'Arrange a trade' }).click();
    await host.getByLabel('Cash to give').fill('10');
    await host.getByRole('button', { name: 'Send offer' }).click();
    await guest.getByRole('button', { name: 'Accept trade' }).click();
    await expect(host.getByText('Mira · ₹14,990')).toBeVisible();
    await expect(guest.getByText('Kai · ₹15,010')).toBeVisible();
  } finally {
    await context.close();
  }
});
