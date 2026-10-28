import { test, expect } from '@playwright/test';
import { newHockey } from '../../src/lib/hockey.ts';
import { RANKS, SUITS } from '../../src/lib/blackjack.ts';

const fakeFeedback = () => {
  const w = window as unknown as {
    AudioContext: typeof AudioContext;
    audioStarts: number;
    vibrations: number;
    impacts: number;
  };
  w.audioStarts = 0;
  w.vibrations = 0;
  w.impacts = 0;
  class FakeContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    sampleRate = 48000;
    createGain() {
      return {
        gain: {
          value: 0,
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {
          return this;
        },
      };
    }
    createOscillator() {
      return {
        frequency: { value: 0 },
        connect() {
          return this;
        },
        start() {
          w.audioStarts++;
        },
        stop() {},
      };
    }
    createBuffer(_channels: number, length: number) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      return {
        buffer: null,
        connect() {
          return this;
        },
        start() {
          w.impacts++;
        },
        stop() {},
      };
    }
    createBiquadFilter() {
      return {
        type: '',
        frequency: { value: 0 },
        connect() {
          return this;
        },
      };
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
  }
  w.AudioContext = FakeContext as unknown as typeof AudioContext;
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    value: () => {
      w.vibrations++;
      return true;
    },
  });
};

test('sound and haptics controls persist and test a gesture-unlocked chime', async ({
  page,
}) => {
  await page.addInitScript(fakeFeedback);
  await page.goto('/');
  await page.getByLabel('Sound & feel').click();
  await expect(page.getByLabel('Game sounds')).toBeChecked();
  await expect(page.getByLabel('Haptics')).toBeChecked();
  const before = await page.evaluate(
    () => (window as unknown as { audioStarts: number }).audioStarts,
  );
  await page.getByRole('button', { name: 'Test sound' }).click();
  await expect(
    page.locator('.feedback-panel').getByRole('status'),
  ).toContainText('If you did not hear the chime');
  expect(
    await page.evaluate(
      () => (window as unknown as { audioStarts: number }).audioStarts,
    ),
  ).toBeGreaterThan(before);
  await page.getByLabel('Game sounds').uncheck();
  await page.getByLabel('Haptics').uncheck();
  await expect(page.getByRole('button', { name: 'Test sound' })).toBeDisabled();
  await page.reload();
  await page.getByLabel('Sound & feel').click();
  await expect(page.getByLabel('Game sounds')).not.toBeChecked();
  await expect(page.getByLabel('Haptics')).not.toBeChecked();
  await page.getByLabel('Game sounds').check();
  await page.getByLabel('Haptics').check();
  expect(
    await page.evaluate(
      () => (window as unknown as { vibrations: number }).vibrations,
    ),
  ).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Test sound' })).toBeHidden();
});

test('a real hockey collision produces an impact sound', async ({ page }) => {
  await page.addInitScript(fakeFeedback);
  await page.goto('/');
  const state = newHockey(5);
  state.openingFaceoff = false;
  state.puck = { x: 300, y: 600, vx: 0, vy: 350 };
  await page.evaluate(
    (value) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ 'air-hockey': { state: value, savedAt: Date.now() } }),
      ),
    state,
  );
  await page.goto('/#/game/air-hockey');
  await page.getByLabel('Sound & feel').click();
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as unknown as { impacts: number }).impacts),
      { timeout: 4000 },
    )
    .toBeGreaterThan(0);
});

test('unsupported haptics are explained without claiming game vibration', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto('/');
  await page.getByLabel('Sound & feel').click();
  const info = page.locator('.feedback-panel');
  if (/iPhone|iPad|iPod/.test(await page.evaluate(() => navigator.userAgent))) {
    await expect(info).toContainText(
      'game vibrations are unavailable in iOS browsers',
    );
  } else {
    await expect(page.getByLabel('Haptics')).toBeDisabled();
    await expect(info).toContainText('This browser has no haptics API');
  }
});

test('gameplay emits a distinct win chime and respects mute', async ({
  page,
}) => {
  await page.addInitScript(fakeFeedback);
  await page.goto('/#/game/tictactoe');
  await page.getByText('Match options & player names').click();
  await page.getByRole('button', { name: '2 players', exact: true }).click();
  await page.getByRole('button', { name: 'Start playing' }).click();
  for (const [row, col] of [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2],
  ])
    await page
      .getByRole('button', { name: `Row ${row}, column ${col}: empty` })
      .click();
  const before = await page.evaluate(
    () => (window as unknown as { audioStarts: number }).audioStarts,
  );
  await page.getByRole('button', { name: 'Row 1, column 3: empty' }).click();
  expect(
    (await page.evaluate(
      () => (window as unknown as { audioStarts: number }).audioStarts,
    )) - before,
  ).toBeGreaterThanOrEqual(3);
  await page.getByLabel('Sound & feel').click();
  await page.getByLabel('Game sounds').uncheck();
  await page.getByLabel('Sound & feel').click();
  const muted = await page.evaluate(
    () => (window as unknown as { audioStarts: number }).audioStarts,
  );
  await page.getByRole('button', { name: 'Play again' }).click();
  await page.getByRole('button', { name: 'Row 1, column 1: empty' }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { audioStarts: number }).audioStarts,
    ),
  ).toBe(muted);
});

test('a losing Blackjack round does not play a win chime', async ({ page }) => {
  await page.addInitScript(fakeFeedback);
  const player = [
      { rank: '10', suit: '♠' },
      { rank: '6', suit: '♠' },
    ],
    dealer = [
      { rank: 'K', suit: '♠' },
      { rank: 'Q', suit: '♠' },
    ];
  const used = [...player, ...dealer];
  const state = {
    player,
    dealer,
    deck: SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank }))).filter(
      (c) => !used.some((u) => u.rank === c.rank && u.suit === c.suit),
    ),
    result: null,
    doubled: false,
    round: 1,
    record: { wins: 0, losses: 0, pushes: 0, net: 0 },
    message: 'Your move.',
  };
  await page.goto('/');
  await page.evaluate(
    (value) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ blackjack: { state: value, savedAt: Date.now() } }),
      ),
    state,
  );
  await page.goto('/#/game/blackjack');
  const before = await page.evaluate(
    () => (window as unknown as { audioStarts: number }).audioStarts,
  );
  await page.getByRole('button', { name: 'Stand', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'The house takes this round.' }),
  ).toBeVisible();
  expect(
    (await page.evaluate(
      () => (window as unknown as { audioStarts: number }).audioStarts,
    )) - before,
  ).toBe(1);
});
