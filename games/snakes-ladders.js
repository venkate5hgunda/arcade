// Snakes & Ladders — classic board race. 2-4 players.
// Pure DOM with animated board. Listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { nextPlayer } from '../js/game-utils.js';
import { dieMarkup, pauseAfterRoll, rollDie } from '../js/dice.js';
import { boardArt, createBoardLayout, ladderTravelPoints, snakeTravelPoints, squareCenter } from '../js/snakes-board.js';
import { decorateBoardToken, travelBoardToken } from '../js/board-tokens.js';
import { remoteMatch, seat } from '../js/remote-match.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { playerName } from '../js/player-names.js';
import { celebrate } from '../js/celebration.js';
import { createTurnIndicator } from '../js/turn-indicator.js';

const BOARD_SIZE = 100;
const PLAYER_COLORS = ['#ff5a3c', '#38bdf8', '#34d399', '#fbbf24'];

function validCheckpoint(s) {
  return !!s && typeof s === 'object' && Number.isInteger(s.playerCount) &&
    s.playerCount >= 2 && s.playerCount <= 4 &&
    typeof s.seed === 'string' && s.seed.length > 0 && s.seed.length <= 48 &&
    Array.isArray(s.positions) && s.positions.length === s.playerCount &&
    s.positions.every((n) => Number.isInteger(n) && n >= 0 && n < BOARD_SIZE) &&
    Number.isInteger(s.current) && s.current >= 0 && s.current < s.playerCount &&
    Number.isInteger(s.lastRoll) && s.lastRoll >= 1 && s.lastRoll <= 6 &&
    typeof s.message === 'string' && s.message.length <= 160;
}

export default {
  async render(el, game, { navigate, multiplayer, session } = {}) {
    const shell = createShell(el, game, { title: 'Snakes & Ladders', meta: 'Race to square 100' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('sl-vibe');

    const match = remoteMatch(multiplayer, game.id);
    const showTurn = createTurnIndicator(shell.root, match);
    const resume = !match && validCheckpoint(session?.state) ? session.state : null;
    const saved = loadJSON(KEYS.SETTINGS + ':snakes-ladders', { players: '2' });
    const settings = match ? { players: String(match.activeGame.playerIds.length) } : resume ? { players: String(resume.playerCount) } : await renderSetup(stage, {
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

    const positions = resume ? [...resume.positions] : Array(playerCount).fill(0);
    let boardSeed = resume?.seed ?? Math.random().toString(36).slice(2);
    let layout = createBoardLayout(match ? match.activeGame.seed : boardSeed);
    let current = resume?.current ?? 0, gameOver = false, winner = null, rolling = false,
      lastRoll = resume?.lastRoll ?? 1, message = resume?.message ?? '', queuedRoll = null;
    let generation = 0;
    function checkpoint() {
      if (match) return;
      if (gameOver) session?.finish();
      else session?.save({ playerCount, seed: boardSeed, positions, current, lastRoll, message });
    }
    let rollController = new AbortController();

    const board = document.createElement('div');
    board.className = 'sl-board';
    stage.appendChild(board);

    const dice = document.createElement('div');
    dice.className = 'sl-dice';
    stage.appendChild(dice);

    const status = document.createElement('div');
    status.className = 'sl-status';
    status.setAttribute('role', 'status');
    stage.appendChild(status);

    const playersInfo = document.createElement('div');
    playersInfo.className = 'sl-players';
    stage.insertBefore(playersInfo, board);

    function wakeSnake(start) {
      const snake = board.querySelector(`[data-head="${start}"]`);
      if (!snake || snake.classList.contains('is-near')) return;
      snake.style.setProperty('--tail-time', `${(.55 + Math.random() * .6).toFixed(2)}s`);
      snake.style.setProperty('--tongue-time', `${(.28 + Math.random() * .35).toFixed(2)}s`);
      snake.classList.add('is-near');
    }
    board.addEventListener('animationiteration', (event) => {
      if (!event.target.closest?.('.sl-art-snake.is-near') ||
          !event.target.matches('.sl-art-tail, .sl-art-tongue')) return;
      for (const animation of event.target.getAnimations({ subtree: false }))
        animation.playbackRate = .7 + Math.random() * .65;
    });

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
              const token = decorateBoardToken(document.createElement('span'), p, p + 1);
              token.className = 'sl-token';
              token.dataset.player = p;
              token.style.setProperty('--piece-color', PLAYER_COLORS[p]);
              token.setAttribute('aria-label', `${playerName(p, match)} on square ${num}`);
              playerTokens.appendChild(token);
            }
          }
          cell.appendChild(playerTokens);
          board.appendChild(cell);
        }
      }
      board.insertAdjacentHTML('beforeend', boardArt(layout));
      layout.ladders.forEach(({ start }) => {
        if (positions.some(position => position > 0 && start - position >= 0 && start - position <= 3))
          board.querySelector(`[data-foot="${start}"]`)?.classList.add('is-near');
      });
      layout.snakes.forEach(({ start }) => {
        if (positions.some(position => position > 0 && start - position > 0 && start - position <= 3))
          wakeSnake(start);
      });

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
        const icon = decorateBoardToken(document.createElement('span'), p, p + 1);
        icon.className = 'sl-roster-icon';
        icon.style.setProperty('--piece-color', PLAYER_COLORS[p]);
        const label = document.createElement('span');
        label.className = 'sl-player-label';
        label.textContent = playerName(p, match);
        const square = document.createElement('span');
        square.className = 'sl-ppos';
        square.textContent = positions[p] ? `Square ${positions[p]}` : 'At start';
        pi.append(icon, label, square);
        playersInfo.appendChild(pi);
      }

      // Status
      if (gameOver) {
        status.textContent = `🎉 ${playerName(winner, match)} wins!`;
        status.style.color = PLAYER_COLORS[winner];
      } else {
        status.textContent = message || `${playerName(current, match)}'s turn · ${match && current !== seat(match) - 1 ? 'Waiting for their roll' : 'Tap to roll'}`;
        status.style.color = PLAYER_COLORS[current];
      }
      showTurn(current, !gameOver);
    }

    async function rollDice(predeterminedValue = null) {
      if (rolling || gameOver) return;
      rolling = true;
      const started = generation;
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();
      if (started !== generation) return;
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
      btn.disabled = true;
      if (!await pauseAfterRoll(rollController.signal) || generation !== started) return;
      if (audio) audio.tap();

      const from = positions[current];
      const rolledTo = from + roll;
      if (rolledTo > BOARD_SIZE) {
        message = `Player ${current + 1} rolled ${roll} · Exact roll needed for 100`;
      } else {
        const snake = layout.snakes.find((item) => item.start === rolledTo);
        const ladder = layout.ladders.find((item) => item.start === rolledTo);
        const toPixel = ({ x, y }) => ({
          x: x * board.clientWidth / 1000, y: y * board.clientHeight / 1000,
        });
        const origin = from ? squareCenter(from) : { x: 50, y: 1050 };
        const avatar = from
          ? board.querySelector(`.sl-cell[data-num="${from}"] .sl-token[data-player="${current}"]`)
          : decorateBoardToken(document.createElement('span'), current, current + 1);
        if (!from) {
          avatar.className = 'sl-token';
          avatar.style.setProperty('--piece-color', PLAYER_COLORS[current]);
        }
        const segments = [];
        let previous = origin;
        for (let square = from + 1; square <= rolledTo; square++) {
          const next = squareCenter(square);
          segments.push({ kind: 'step', square, points: [toPixel(previous), toPixel(next)], duration: 125 });
          previous = next;
        }
        if (snake) segments.push({
          kind: 'snake', points: snakeTravelPoints(snake).map(toPixel),
          duration: 1300 + Math.abs(snake.start - snake.end) * 8,
        });
        if (ladder) segments.push({
          kind: 'ladder', points: ladderTravelPoints(ladder).map(toPixel),
          duration: 1000 + Math.abs(ladder.end - ladder.start) * 8,
        });
        const hissed = new Set();
        const completed = await travelBoardToken(board, avatar, segments, rollController.signal, ({ square }) => {
          if (!square) return;
          for (const item of layout.snakes) {
            if (item.start - square < 1 || item.start - square > 3 || hissed.has(item.start)) continue;
            hissed.add(item.start);
            audio?.hiss();
            wakeSnake(item.start);
          }
          for (const item of layout.ladders) {
            if (item.start - square < 0 || item.start - square > 3) continue;
            board.querySelector(`[data-foot="${item.start}"]`)?.classList.add('is-near');
          }
        });
        if (!completed || generation !== started) return;
        positions[current] = snake?.end ?? ladder?.end ?? rolledTo;
        if (snake) {
          message = `Oh no! ${playerName(current, match)} slides from ${rolledTo} to ${snake.end}`;
          audio?.buzz();
          window.haptics?.failure();
        } else if (ladder) {
          message = `Climb! ${playerName(current, match)} rises from ${rolledTo} to ${ladder.end}`;
          audio?.chime();
          window.haptics?.success();
        } else {
          message = `${playerName(current, match)} rolled ${roll} · Now on square ${rolledTo}`;
        }
      }

      // Check win
      if (positions[current] === BOARD_SIZE) {
        gameOver = true; winner = current;
        if (match?.role === 'host') match.recordResult(game.id, winner, generation);
        if (!match || seat(match) === winner + 1)
          celebrate(shell.root, `${playerName(winner, match)} wins!`);
      } else {
        current = nextPlayer(current, playerCount, 0);
      }

      rolling = false;
      render();
      checkpoint();
      if (queuedRoll !== null && !gameOver) {
        const next = queuedRoll;
        queuedRoll = null;
        rollDice(next);
      }
    }

    function reset(seed) {
      generation++;
      shell.root.querySelector('.arcade-victory')?.remove();
      rollController.abort();
      rollController = new AbortController();
      if (!match) boardSeed = Math.random().toString(36).slice(2);
      layout = createBoardLayout(match ? seed : boardSeed);
      positions.fill(0);
      current = 0; gameOver = false; winner = null; rolling = false; lastRoll = 1; message = ''; queuedRoll = null;
      render();
      checkpoint();
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
    if (!resume) checkpoint();
    return { dispose: () => {
      generation++;
      rollController.abort();
      offRoom?.();
      window.removeEventListener('arcade:themechange', onTheme);
    } };
  },
};
