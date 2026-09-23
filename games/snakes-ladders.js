// Snakes & Ladders — classic board race. 2-4 players.
// Pure DOM with animated board. Listens to arcade:themechange.

import { createShell, wireBack } from '../js/game-shell.js';
import { nextPlayer, loadJSON, KEYS } from '../js/storage.js';

const BOARD_SIZE = 100;
const SNAKES = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
const LADDERS = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };

const PLAYER_COLORS = ['#ff5a3c', '#38bdf8', '#34d399', '#fbbf24'];

export default {
  render(el, game, { navigate } = {}) {
    const settings = loadJSON(KEYS.SETTINGS + ':snakes-ladders', { players: 2 });
    const playerCount = Math.max(2, Math.min(4, settings.players || 2));

    const shell = createShell(el, game, {
      title: 'Snakes & Ladders',
      meta: `${playerCount} players · Roll to move`,
    });
    const { stage, getResetButton, getBackButton } = shell;

    if (navigate) wireBack(shell, navigate);

    const positions = Array(playerCount).fill(1);
    let current = 0, gameOver = false, winner = null, rolling = false;

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
          cell.textContent = num;

          // Snake or ladder
          if (SNAKES[num]) cell.classList.add('snake');
          if (LADDERS[num]) cell.classList.add('ladder');

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

      // Dice
      dice.innerHTML = `
        <button class="sl-roll-btn" ${rolling || gameOver ? 'disabled' : ''} aria-label="Roll dice">
          <span class="sl-die">⚀</span>
        </button>`;
      dice.querySelector('.sl-roll-btn').addEventListener('click', rollDice);

      // Player info
      playersInfo.innerHTML = '';
      for (let p = 0; p < playerCount; p++) {
        const pi = document.createElement('div');
        pi.className = 'sl-player' + (p === current && !gameOver ? ' active' : '');
        pi.style.borderColor = PLAYER_COLORS[p];
        pi.innerHTML = `<span class="sl-pnum">P${p + 1}</span><span class="sl-ppos">Square ${positions[p]}</span>`;
        playersInfo.appendChild(pi);
      }

      // Status
      if (gameOver) {
        status.textContent = `🎉 Player ${winner + 1} wins!`;
        status.style.color = PLAYER_COLORS[winner];
      } else {
        status.textContent = `Player ${current + 1}'s turn · Tap to roll`;
        status.style.color = PLAYER_COLORS[current];
      }
    }

    async function rollDice() {
      if (rolling || gameOver) return;
      rolling = true;
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();

      const btn = dice.querySelector('.sl-roll-btn');
      const die = dice.querySelector('.sl-die');
      const faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];

      // Animate
      for (let i = 0; i < 10; i++) {
        die.textContent = faces[Math.floor(Math.random() * 6)];
        await new Promise(r => setTimeout(r, 60));
      }

      const roll = Math.floor(Math.random() * 6) + 1;
      die.textContent = faces[roll - 1];
      if (audio) audio.tap();

      // Move player
      let newPos = positions[current] + roll;
      if (newPos > BOARD_SIZE) newPos = BOARD_SIZE;
      positions[current] = newPos;

      // Check snake/ladder
      if (SNAKES[newPos]) {
        positions[current] = SNAKES[newPos];
        if (audio) audio.buzz();
        if (window.haptics) window.haptics.failure();
      } else if (LADDERS[newPos]) {
        positions[current] = LADDERS[newPos];
        if (audio) audio.chime();
        if (window.haptics) window.haptics.success();
      }

      // Check win
      if (positions[current] === BOARD_SIZE) {
        gameOver = true; winner = current;
        if (audio) audio.chime();
        if (window.haptics) window.haptics.success();
      } else {
        current = nextPlayer(current, playerCount);
      }

      rolling = false;
      render();
    }

    getResetButton().addEventListener('click', () => {
      positions.fill(1);
      current = 0; gameOver = false; winner = null; rolling = false;
      render();
    });

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    render();
    return { dispose: () => window.removeEventListener('arcade:themechange', onTheme) };
  },
};
