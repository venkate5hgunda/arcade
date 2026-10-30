import { settleStorage } from './storage-helpers.ts';
import { test, expect } from '@playwright/test';
import { newHockey } from '../../src/lib/hockey.ts';
import { RANKS, SUITS } from '../../src/lib/blackjack.ts';

const fakeFeedback = () => {
  const w = window as unknown as {
    AudioContext: typeof AudioContext;
    audioStarts: number;
    vibrations: number;
    impacts: number;
    tones: number[];
  };
  w.audioStarts = 0;
  w.vibrations = 0;
  w.impacts = 0;
  w.tones = [];
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
      const frequency = { value: 0 };
      return {
        frequency,
        connect() {
          return this;
        },
        start() {
          w.audioStarts++;
          w.tones.push(frequency.value);
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
  await page.getByLabel('Sound & feel').click();
  await page.getByRole('button', { name: 'Test sound' }).click();
  await page.keyboard.press('Escape');
  const state = newHockey(5);
  state.openingFaceoff = false;
  state.puck = { x: 300, y: 660, vx: 0, vy: 350 };
  await page.evaluate(
    (value) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ 'air-hockey': { state: value, savedAt: Date.now() } }),
      ),
    state,
  );
  await page.goto('/#/game/air-hockey');
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as unknown as { impacts: number }).impacts),
      { timeout: 10_000 },
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
  await settleStorage(page);
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
    () => (window as unknown as { tones: number[] }).tones.length,
  );
  await page.getByRole('button', { name: 'Stand', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'The house takes this round.' }),
  ).toBeVisible();
  const tones = await page.evaluate(
    (start) => (window as unknown as { tones: number[] }).tones.slice(start),
    before,
  );
  expect(tones).toContain(160);
  expect(tones).not.toContain(880);
});

test('Simon plays distinct sequence notes and mute silences both playback and correct-answer feedback', async ({
  page,
}) => {
  await page.addInitScript(fakeFeedback);
  await page.goto('/#/game/simon');
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await page.getByRole('button', { name: 'Start playing' }).click();
  await settleStorage(page);
  await page.clock.runFor(600);
  const state = await page.evaluate(
    () => JSON.parse(localStorage.getItem('arcade:game.sessions')!).simon.state,
  );
  const note = [261.63, 329.63, 392, 523.25][state.sequence[0]];
  expect(
    await page.evaluate(() => (window as unknown as { tones: number[] }).tones),
  ).toContain(note);
  await page.getByLabel('Sound & feel').click();
  await page.getByLabel('Game sounds').uncheck();
  await page.getByLabel('Sound & feel').click();
  const muted = await page.evaluate(
    () => (window as unknown as { audioStarts: number }).audioStarts,
  );
  await page.clock.runFor(1000);
  await page
    .getByRole('button', {
      name: `Play ${['Red', 'Blue', 'Yellow', 'Green'][state.sequence[0]]} pad`,
    })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Nice! Next round…' }),
  ).toBeVisible();
  await page.clock.runFor(1600);
  expect(
    await page.evaluate(
      () => (window as unknown as { audioStarts: number }).audioStarts,
    ),
  ).toBe(muted);
});

test('a real Tic-Tac-Toe draw has a neutral cue instead of a victory chime', async ({
  page,
}) => {
  await page.addInitScript(fakeFeedback);
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'arcade:game.sessions',
      JSON.stringify({
        tictactoe: {
          state: {
            mode: 'pvp',
            board: [1, 2, 1, 1, 2, 2, 2, 1, 0],
            current: 1,
            over: false,
          },
          savedAt: Date.now(),
        },
      }),
    ),
  );
  await page.goto('/#/game/tictactoe');
  await page.getByRole('button', { name: 'Row 3, column 3: empty' }).click();
  await expect(page.getByRole('heading', { name: /draw/i })).toBeVisible();
  const tones = await page.evaluate(
    () => (window as unknown as { tones: number[] }).tones,
  );
  expect(tones).toContain(600);
  expect(tones).not.toContain(880);
});

test('room guests hear their own victory while the losing host hears a failure cue', async ({
  page: host,
  browser,
}) => {
  test.setTimeout(60000);
  const context = await browser.newContext();
  const guest = await context.newPage();
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
  try {
    for (const page of [host, guest]) {
      await page.addInitScript(fakeFeedback);
      await page.addInitScript(localIce);
    }
    await host.goto('/#/room');
    await host.getByLabel('Your room name').fill('Mira');
    await host
      .getByRole('button', { name: 'Create a room', exact: true })
      .click();
    await expect(host.getByLabel('Invitation to share')).toHaveValue(/invite=/);
    await guest.goto(await host.getByLabel('Invitation to share').inputValue());
    await guest.getByLabel('Your room name').fill('Kai');
    await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(guest.getByLabel('Answer to share')).toHaveValue(/answer=/);
    await host
      .getByLabel('Guest’s answer link')
      .fill(await guest.getByLabel('Answer to share').inputValue());
    await host.getByRole('button', { name: 'Accept answer' }).click();
    await expect(
      host.getByRole('button', { name: 'Start Tic-Tac-Toe' }),
    ).toBeVisible();
    await host.getByRole('button', { name: 'Start Tic-Tac-Toe' }).click();
    for (const [player, cell] of [
      [host, 0],
      [guest, 3],
      [host, 1],
      [guest, 4],
      [host, 8],
      [guest, 5],
    ] as const) {
      await expect(
        player.getByRole('heading', { name: 'Your turn' }),
      ).toBeVisible();
      await player.locator('.square').nth(cell).click();
    }
    await expect(
      host.getByRole('heading', { name: 'Kai wins!' }),
    ).toBeVisible();
    await expect(
      guest.getByRole('heading', { name: 'Kai wins!' }),
    ).toBeVisible();
    const hostTones = await host.evaluate(
      () => (window as unknown as { tones: number[] }).tones,
    );
    const guestTones = await guest.evaluate(
      () => (window as unknown as { tones: number[] }).tones,
    );
    expect(hostTones).toContain(160);
    expect(hostTones).not.toContain(880);
    expect(guestTones).toContain(880);
  } finally {
    await context.close();
  }
});

test('sound control and panel follow the header theme', async ({ page }) => {
  await page.goto('/');
  for (const mode of ['light', 'dark']) {
    const theme = page.getByRole('button', { name: /^Theme:/ });
    while (
      !(await theme.getAttribute('aria-label'))?.startsWith(`Theme: ${mode}.`)
    ) {
      await theme.click();
    }
    await page.getByLabel('Sound & feel', { exact: true }).click();
    const colors = await page.locator('.feedback-panel').evaluate((panel) => {
      const header = document.querySelector('.app-header')!;
      return {
        panel: getComputedStyle(panel).backgroundColor,
        header: getComputedStyle(header).backgroundColor,
        ink: getComputedStyle(panel).color,
        headerInk: getComputedStyle(header).color,
      };
    });
    expect(colors.panel).toBe(colors.header);
    expect(colors.ink).toBe(colors.headerInk);
    await page.getByLabel('Game sounds').uncheck();
    await expect(
      page.getByRole('button', { name: 'Test sound' }),
    ).toBeDisabled();
    await page.getByLabel('Game sounds').check();
    await page.keyboard.press('Escape');
  }
});
