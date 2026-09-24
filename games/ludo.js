// Ludo — classic race game. 2-4 players.
// Pure DOM with animated tokens. Listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { nextPlayer, diceFaceHTML } from '../js/game-utils.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const PLAYER_COLORS = ['#ff5a3c', '#38bdf8', '#34d399', '#fbbf24'];
const HOME_STRETCH = 6; // steps from entrance to center

export default {
  async render(el, game, { navigate } = {}) {
    const shell = createShell(el, game, { title: 'Ludo', meta: 'Race your tokens home' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('ld-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':ludo', { players: '4' });
    const settings = await renderSetup(stage, {
      title: '🎲 Ludo',
      subtitle: 'How many players?',
      themeClass: 'ld-theme',
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
    saveJSON(KEYS.SETTINGS + ':ludo', settings);
    const playerCount = Math.max(2, Math.min(4, parseInt(settings.players, 10) || 4));
    shell.root.querySelector('.game-meta').textContent = `${playerCount} players · Roll 6 to enter`;

    // Each player has 4 tokens: position -1 = in yard, 0-51 = main track, 52-57 = home stretch, 58 = finished
    const tokens = Array.from({ length: playerCount }, () => Array(4).fill(-1));
    let current = 0, gameOver = false, winner = null, rolling = false, rolledValue = 0, mustRollAgain = false;

    const board = document.createElement('div');
    board.className = 'ld-board';
    stage.appendChild(board);

    const dice = document.createElement('div');
    dice.className = 'ld-dice';
    stage.appendChild(dice);

    const status = document.createElement('div');
    status.className = 'ld-status';
    stage.appendChild(status);

    const playersInfo = document.createElement('div');
    playersInfo.className = 'ld-players';
    stage.insertBefore(playersInfo, board);

    // Board layout: 52 main squares + 4 home stretches (6 each) + 4 yards
    // We'll render a cross-shaped board
    function render() {
      board.innerHTML = '';
      // For simplicity, render a linear track visualization
      // In a full implementation this would be a cross-shaped board
      
      // Player yards
      for (let p = 0; p < playerCount; p++) {
        const yard = document.createElement('div');
        yard.className = 'ld-yard';
        yard.style.borderColor = PLAYER_COLORS[p];
        yard.innerHTML = `<span class="ld-yard-label">P${p + 1}</span>`;
        const yardTokens = document.createElement('div');
        yardTokens.className = 'ld-yard-tokens';
        for (let t = 0; t < 4; t++) {
          if (tokens[p][t] === -1) {
            const tok = document.createElement('span');
            tok.className = 'ld-token';
            tok.style.background = PLAYER_COLORS[p];
            tok.textContent = t + 1;
            yardTokens.appendChild(tok);
          }
        }
        yard.appendChild(yardTokens);
        board.appendChild(yard);
      }

      // Main track (simplified as a ring)
      const track = document.createElement('div');
      track.className = 'ld-track';
      for (let i = 0; i < 52; i++) {
        const cell = document.createElement('div');
        cell.className = 'ld-cell';
        cell.dataset.pos = i;
        // Mark special positions
        if ([0, 13, 26, 39].includes(i)) cell.classList.add('start');
        if ([8, 21, 34, 47].includes(i)) cell.classList.add('safe');
        // Tokens on this cell
        const cellTokens = document.createElement('div');
        cellTokens.className = 'ld-cell-tokens';
        for (let p = 0; p < playerCount; p++) {
          for (let t = 0; t < 4; t++) {
            if (tokens[p][t] === i) {
              const tok = document.createElement('span');
              tok.className = 'ld-token';
              tok.style.background = PLAYER_COLORS[p];
              tok.textContent = t + 1;
              cellTokens.appendChild(tok);
            }
          }
        }
        cell.appendChild(cellTokens);
        track.appendChild(cell);
      }
      board.appendChild(track);

      // Home stretches
      for (let p = 0; p < playerCount; p++) {
        const stretch = document.createElement('div');
        stretch.className = 'ld-stretch';
        stretch.style.borderColor = PLAYER_COLORS[p];
        for (let s = 0; s < HOME_STRETCH; s++) {
          const cell = document.createElement('div');
          cell.className = 'ld-stretch-cell';
          const cellTokens = document.createElement('div');
          cellTokens.className = 'ld-cell-tokens';
          for (let t = 0; t < 4; t++) {
            if (tokens[p][t] === 52 + s) {
              const tok = document.createElement('span');
              tok.className = 'ld-token';
              tok.style.background = PLAYER_COLORS[p];
              tok.textContent = t + 1;
              cellTokens.appendChild(tok);
            }
          }
          cell.appendChild(cellTokens);
          stretch.appendChild(cell);
        }
        // Center
        const center = document.createElement('div');
        center.className = 'ld-center';
        center.style.background = PLAYER_COLORS[p];
        const centerTokens = document.createElement('div');
        centerTokens.className = 'ld-cell-tokens';
        for (let t = 0; t < 4; t++) {
          if (tokens[p][t] === 58) {
            const tok = document.createElement('span');
            tok.className = 'ld-token';
            tok.style.background = '#fff';
            tok.textContent = t + 1;
            centerTokens.appendChild(tok);
          }
        }
        center.appendChild(centerTokens);
        stretch.appendChild(center);
        board.appendChild(stretch);
      }

      // Dice
      dice.innerHTML = `
        <button class="ld-roll-btn" ${rolling || gameOver ? 'disabled' : ''} aria-label="Roll dice">
          <span class="ld-die">${diceFaceHTML(rolledValue || 1)}</span>
        </button>`;
      dice.querySelector('.ld-roll-btn').addEventListener('click', rollDice);

      // Player info
      playersInfo.innerHTML = '';
      for (let p = 0; p < playerCount; p++) {
        const finished = tokens[p].filter(t => t === 58).length;
        const pi = document.createElement('div');
        pi.className = 'ld-player' + (p === current && !gameOver ? ' active' : '');
        pi.style.borderColor = PLAYER_COLORS[p];
        pi.innerHTML = `<span class="ld-pnum">P${p + 1}</span><span class="ld-pfin">${finished}/4 home</span>`;
        playersInfo.appendChild(pi);
      }

      // Status
      if (gameOver) {
        status.textContent = `🎉 Player ${winner + 1} wins!`;
        status.style.color = PLAYER_COLORS[winner];
      } else if (mustRollAgain) {
        status.textContent = `Player ${current + 1} rolled ${rolledValue} · Roll again!`;
        status.style.color = PLAYER_COLORS[current];
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

      const btn = dice.querySelector('.ld-roll-btn');
      const die = dice.querySelector('.ld-die');

      for (let i = 0; i < 10; i++) {
        die.innerHTML = diceFaceHTML(Math.floor(Math.random() * 6) + 1);
        await new Promise(r => setTimeout(r, 60));
      }

      rolledValue = Math.floor(Math.random() * 6) + 1;
      die.innerHTML = diceFaceHTML(rolledValue);
      if (audio) audio.tap();

      // Find movable tokens
      const movable = [];
      for (let t = 0; t < 4; t++) {
        const pos = tokens[current][t];
        if (pos === -1) {
          if (rolledValue === 6) movable.push(t); // Can enter from yard
        } else if (pos < 52) {
          if (pos + rolledValue <= 51) movable.push(t); // On main track
          else if (pos + rolledValue === 52) movable.push(t); // Enter home stretch
        } else if (pos < 58) {
          if (pos + rolledValue <= 58) movable.push(t); // On home stretch
        }
      }

      if (movable.length === 0) {
        // No valid moves
        if (rolledValue !== 6) {
          current = nextPlayer(current, playerCount, 0);
        } else {
          mustRollAgain = true;
        }
        rolling = false;
        render();
        return;
      }

      // Auto-move first valid token (in a real game, player would choose)
      const tokenIdx = movable[0];
      let pos = tokens[current][tokenIdx];

      if (pos === -1) {
        // Enter from yard
        tokens[current][tokenIdx] = (current * 13) % 52; // Start position
        if (audio) audio.chime();
        if (window.haptics) window.haptics.success();
      } else if (pos < 52) {
        const newPos = pos + rolledValue;
        if (newPos <= 51) {
          tokens[current][tokenIdx] = newPos;
          // Check capture
          captureToken(newPos, current);
        } else if (newPos === 52) {
          tokens[current][tokenIdx] = 52; // Enter home stretch
        }
        if (audio) audio.tap();
      } else if (pos < 58) {
        const newPos = pos + rolledValue;
        if (newPos <= 58) tokens[current][tokenIdx] = newPos;
        if (newPos === 58) {
          if (audio) audio.chime();
          if (window.haptics) window.haptics.success();
        }
      }

      // Check win
      if (tokens[current].every(t => t === 58)) {
        gameOver = true; winner = current;
        if (audio) audio.chime();
        if (window.haptics) window.haptics.success();
      }

      mustRollAgain = rolledValue === 6;
      if (!mustRollAgain) current = nextPlayer(current, playerCount, 0);

      rolling = false;
      render();
    }

    function captureToken(pos, byPlayer) {
      for (let p = 0; p < playerCount; p++) {
        if (p === byPlayer) continue;
        for (let t = 0; t < 4; t++) {
          if (tokens[p][t] === pos && ![0, 8, 13, 21, 26, 34, 39, 47].includes(pos)) {
            tokens[p][t] = -1; // Send back to yard
            if (window.arcadeAudio) { window.arcadeAudio.prepare(); window.arcadeAudio.buzz(); }
            if (window.haptics) window.haptics.failure();
          }
        }
      }
    }

    getResetButton().addEventListener('click', () => {
      for (let p = 0; p < playerCount; p++) tokens[p].fill(-1);
      current = 0; gameOver = false; winner = null; rolling = false; mustRollAgain = false;
      render();
    });

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    render();
    return { dispose: () => window.removeEventListener('arcade:themechange', onTheme) };
  },
};
