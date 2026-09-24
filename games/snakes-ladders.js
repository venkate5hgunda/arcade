// Snakes & Ladders — classic board race. 2-4 players.
// Pure DOM with animated board. Listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { nextPlayer } from '../js/game-utils.js';
import { dieMarkup, rollDie } from '../js/dice.js';
import { boardArt, createBoardLayout } from '../js/snakes-board.js';
import { remoteMatch, seat } from '../js/remote-match.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const BOARD_SIZE = 100;
const PLAYER_COLORS = ['#ff5a3c', '#38bdf8', '#34d399', '#fbbf24'];

export default {
  async render(el, game, { navigate, multiplayer } = {}) {
    const shell = createShell(el, game, { title: 'Snakes & Ladders', meta: 'Race to square 100' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('sl-vibe');

    const match = remoteMatch(multiplayer, game.id);
    const saved = loadJSON(KEYS.SETTINGS + ':snakes-ladders', { players: '2' });
    const settings = match ? { players: String(match.activeGame.playerIds.length) } : await renderSetup(stage, {
      title: '🐍 Snakes & Ladders',
      subtitle: 'How many players?',
      themeClass: 'sl-theme',
      fields: [{
        key: 'players', label: 'Players',
        options: [
          { value: '2', label: '2 Players' },
          { value: '3', label: '3 Players' },
          { value: '4', label: '4 Players' },
        ],
        default: saved.players,
      }],
      startLabel: 'Start Rolling',
    });
    if (!match) saveJSON(KEYS.SETTINGS + ':snakes-ladders', settings);
    const playerCount = Math.max(2, Math.min(4, parseInt(settings.players, 10) || 2));
    shell.root.querySelector('.game-meta').textContent = match
      ? `Online room · you are Player ${seat(match)} · ${playerCount} players` : `${playerCount} players · Roll to move`;

    const positions = Array(playerCount).fill(0);
    let layout = createBoardLayout(match?.activeGame.seed);
    let current = 0, gameOver = false, winner = null, rolling = false, lastRoll = 1, message = '', queuedRoll = null;
    let rollController = new AbortController();

    const board = document.createElement('div');
    board.className = 'sl-board';
    stage.appendChild(board);

    const dice = document.createElement('div');
    dice.className = 'sl-dice';
    stage.appendChild(dice);

    const status = document.createElement('div');
    status.className = 'sl-status';
    stage.appendChild(status);

    const playersInfo = document.createElement('div');
    playersInfo.className = 'sl-players';
    stage.insertBefore(playersInfo, board);

    function render() {
      // Board (10x10, boustrophedon)
      board.innerHTML = '';
      for (let row = 9; row >= 0; row--) {
        const cols = row % 2 === 0 ? [...Array(10).keys()] : [...Array(10).keys()].reverse();
        for (const col of cols) {
          const num = row * 10 + col + 1;
          const cell = document.createElement('div');
          cell.className = 'sl-cell';
          cell.dataset.num = num;
          const number = document.createElement('span');
          number.className = 'sl-number';
          number.textContent = num;
          cell.appendChild(number);

          // Snake or ladder
          if (layout.snakes.some((snake) => snake.start === num)) cell.classList.add('snake');
          if (layout.ladders.some((ladder) => ladder.start === num)) cell.classList.add('ladder');

          // Players on this cell
          const playerTokens = document.createElement('div');
          playerTokens.className = 'sl-tokens';
          for (let p = 0; p < playerCount; p++) {
            if (positions[p] === num) {
              const token = document.createElement('span');
              token.className = 'sl-token';
              token.style.background = PLAYER_COLORS[p];
              token.textContent = p + 1;
              playerTokens.appendChild(token);
            }
          }
          cell.appendChild(playerTokens);
          board.appendChild(cell);
        }
      }
      board.insertAdjacentHTML('beforeend', boardArt(layout));

      // Dice
      dice.innerHTML = `
        <button class="sl-roll-btn" ${rolling || gameOver || (match && current !== seat(match) - 1) ? 'disabled' : ''} aria-label="Roll dice">
          ${dieMarkup(lastRoll)}
        </button>`;
      dice.querySelector('.sl-roll-btn').addEventListener('click', () => {
        if (match) match.sendAction({ type: 'request-roll' });
        else rollDice();
      });

      // Player info
      playersInfo.innerHTML = '';
      for (let p = 0; p < playerCount; p++) {
        const pi = document.createElement('div');
        pi.className = 'sl-player' + (p === current && !gameOver ? ' active' : '');
        pi.style.borderColor = PLAYER_COLORS[p];
        pi.innerHTML = `<span class="sl-pnum">P${p + 1}</span><span class="sl-ppos">${positions[p] ? `Square ${positions[p]}` : 'At start'}</span>`;
        playersInfo.appendChild(pi);
      }

      // Status
      if (gameOver) {
        status.textContent = `🎉 Player ${winner + 1} wins!`;
        status.style.color = PLAYER_COLORS[winner];
      } else {
        status.textContent = message || `Player ${current + 1}'s turn · ${match && current !== seat(match) - 1 ? 'Waiting for their roll' : 'Tap to roll'}`;
        status.style.color = PLAYER_COLORS[current];
      }
    }

    async function rollDice(predeterminedValue = null) {
      if (rolling || gameOver) return;
      rolling = true;
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();
      const btn = dice.querySelector('.sl-roll-btn');
      let roll;
      try {
        roll = await rollDie(btn, rollController.signal, predeterminedValue);
      } catch (error) {
        if (rollController.signal.aborted) return;
        throw error;
      }
      if (roll === null) return;
      lastRoll = roll;
      if (audio) audio.tap();

      let newPos = positions[current] + roll;
      if (newPos > BOARD_SIZE) {
        message = `Player ${current + 1} rolled ${roll} · Exact roll needed for 100`;
      } else {
        positions[current] = newPos;
        const snake = layout.snakes.find((item) => item.start === newPos);
        const ladder = layout.ladders.find((item) => item.start === newPos);
        if (snake) {
          positions[current] = snake.end;
          message = `Oh no! Player ${current + 1} slides from ${newPos} to ${snake.end}`;
          audio?.buzz();
          window.haptics?.failure();
        } else if (ladder) {
          positions[current] = ladder.end;
          message = `Climb! Player ${current + 1} leaps from ${newPos} to ${ladder.end}`;
          audio?.chime();
          window.haptics?.success();
        } else {
          message = `Player ${current + 1} rolled ${roll} · Now on square ${newPos}`;
        }
      }

      // Check win
      if (positions[current] === BOARD_SIZE) {
        gameOver = true; winner = current;
        if (audio) audio.chime();
        if (window.haptics) window.haptics.success();
      } else {
        current = nextPlayer(current, playerCount, 0);
      }

      rolling = false;
      render();
      if (queuedRoll !== null && !gameOver) {
        const next = queuedRoll;
        queuedRoll = null;
        rollDice(next);
      }
    }

    function reset(seed) {
      rollController.abort();
      rollController = new AbortController();
      layout = createBoardLayout(seed);
      positions.fill(0);
      current = 0; gameOver = false; winner = null; rolling = false; lastRoll = 1; message = ''; queuedRoll = null;
      render();
    }
    getResetButton().addEventListener('click', () => {
      if (match) {
        if (match.role === 'host') match.sendAction({ type: 'new-board', seed: Math.random().toString(36).slice(2) });
      } else reset();
    });
    if (match && match.role !== 'host') getResetButton().disabled = true;
    const offRoom = match?.on((event) => {
      if (event.type !== 'action' || match.activeGame?.id !== game.id) return;
      if (event.action?.type === 'new-board' && event.from === match.activeGame.playerIds[0] &&
          typeof event.action.seed === 'string' && event.action.seed.length <= 48) reset(event.action.seed);
      if (event.action?.type === 'request-roll' && match.role === 'host' &&
          event.from === match.activeGame.playerIds[current] && !rolling && !gameOver)
        match.sendAction({ type: 'roll', value: 1 + Math.floor(Math.random() * 6) });
      if (event.action?.type === 'roll' && event.from === match.activeGame.playerIds[0] &&
          current < playerCount && Number.isInteger(event.action.value) && event.action.value >= 1 &&
          event.action.value <= 6 && !gameOver) {
        if (rolling) queuedRoll = event.action.value;
        else rollDice(event.action.value);
      }
    });

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    render();
    return { dispose: () => {
      rollController.abort();
      offRoom?.();
      window.removeEventListener('arcade:themechange', onTheme);
    } };
  },
};
