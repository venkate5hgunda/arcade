// 2048 — classic slide-and-merge puzzle. Single player, keyboard + swipe.
// Pure DOM; listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const SIZE = 4;
const TILE_COLORS = {
  2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f',
  64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e',
};

function emptyGrid() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(0)); }

function cloneGrid(g) { return g.map((row) => row.slice()); }

function gridsEqual(a, b) {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (a[r][c] !== b[r][c]) return false;
  return true;
}

function randomEmptyCell(grid) {
  const empty = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] === 0) empty.push([r, c]);
  if (!empty.length) return null;
  return empty[Math.floor(Math.random() * empty.length)];
}

function addRandomTile(grid) {
  const cell = randomEmptyCell(grid);
  if (!cell) return false;
  const [r, c] = cell;
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return true;
}

// Slide + merge a single row to the left. Returns { row, gained }.
function slideRowLeft(row) {
  const vals = row.filter((v) => v !== 0);
  const result = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === vals[i + 1]) {
      const merged = vals[i] * 2;
      result.push(merged);
      gained += merged;
      i++;
    } else {
      result.push(vals[i]);
    }
  }
  while (result.length < SIZE) result.push(0);
  return { row: result, gained };
}

function rotateGrid(grid) {
  // Rotate clockwise 90deg.
  const rotated = emptyGrid();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) rotated[c][SIZE - 1 - r] = grid[r][c];
  return rotated;
}

// Move in `dir` (left/right/up/down) by rotating so the move is always "left",
// applying the row-slide, then rotating back.
function move(grid, dir) {
  let g = cloneGrid(grid);
  let rotations = { left: 0, up: 3, right: 2, down: 1 }[dir];
  for (let i = 0; i < rotations; i++) g = rotateGrid(g);
  let gained = 0;
  const moved = g.map((row) => {
    const { row: newRow, gained: g2 } = slideRowLeft(row);
    gained += g2;
    return newRow;
  });
  let result = moved;
  for (let i = 0; i < (4 - rotations) % 4; i++) result = rotateGrid(result);
  return { grid: result, gained };
}

function hasMoves(grid) {
  if (randomEmptyCell(grid)) return true;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (c + 1 < SIZE && grid[r][c + 1] === v) return true;
      if (r + 1 < SIZE && grid[r + 1][c] === v) return true;
    }
  }
  return false;
}

export default {
  async render(el, game, { navigate } = {}) {
    const shell = createShell(el, game, { title: '2048', meta: 'Slide, merge, reach 2048' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('t48-vibe');

    await renderSetup(stage, {
      title: '🔢 2048',
      subtitle: 'Slide tiles with arrow keys or swipe. Merge to reach 2048!',
      themeClass: 't48-theme',
      fields: [{ key: 'ack', label: 'Ready?', options: [{ value: 'yes', label: "Let's Go" }], default: 'yes' }],
      startLabel: 'Start Game',
    });

    let bestScore = loadJSON(KEYS.HIGH_SCORES + ':2048', 0);
    let grid = emptyGrid();
    let score = 0;
    let over = false, won = false, keepPlaying = false;

    const status = document.createElement('div');
    status.className = 't48-status';
    stage.appendChild(status);

    const board = document.createElement('div');
    board.className = 't48-board';
    stage.appendChild(board);

    const message = document.createElement('div');
    message.className = 't48-message';
    stage.appendChild(message);

    function render() {
      status.innerHTML = `<span>Score: <strong>${score}</strong></span><span>Best: <strong>${bestScore}</strong></span>`;
      board.innerHTML = '';
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const v = grid[r][c];
          const cell = document.createElement('div');
          cell.className = 't48-cell' + (v ? ' filled' : '');
          if (v) {
            cell.textContent = v;
            cell.style.background = TILE_COLORS[v] || '#3c3a32';
            cell.style.color = v <= 4 ? '#776e65' : '#f9f6f2';
            cell.style.fontSize = v >= 1024 ? '1.3rem' : v >= 128 ? '1.6rem' : '1.9rem';
          }
          board.appendChild(cell);
        }
      }
      message.innerHTML = '';
      if (over) {
        message.innerHTML = `<div class="t48-overlay"><h3>Game Over</h3><button class="t48-btn" id="retry">Try Again</button></div>`;
        message.querySelector('#retry').addEventListener('click', newGame);
      } else if (won && !keepPlaying) {
        message.innerHTML = `<div class="t48-overlay"><h3>🎉 You reached 2048!</h3><button class="t48-btn" id="continue">Keep Going</button><button class="t48-btn t48-btn-secondary" id="retry2">New Game</button></div>`;
        message.querySelector('#continue').addEventListener('click', () => { keepPlaying = true; render(); });
        message.querySelector('#retry2').addEventListener('click', newGame);
      }
    }

    function doMove(dir) {
      if (over || (won && !keepPlaying)) return;
      const { grid: newGrid, gained } = move(grid, dir);
      if (gridsEqual(grid, newGrid)) return;
      grid = newGrid;
      score += gained;
      if (score > bestScore) { bestScore = score; saveJSON(KEYS.HIGH_SCORES + ':2048', bestScore); }
      addRandomTile(grid);
      const audio = window.arcadeAudio;
      if (audio) { audio.prepare(); gained ? audio.pop() : audio.tap(); }
      window.haptics?.select();
      if (!won && grid.some((row) => row.some((v) => v >= 2048))) {
        won = true;
        if (audio) audio.chime();
        window.haptics?.success();
      } else if (!hasMoves(grid)) {
        over = true;
        if (audio) audio.buzz();
        window.haptics?.failure();
      }
      render();
    }

    function onKeydown(e) {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[e.key]) { e.preventDefault(); doMove(map[e.key]); }
    }
    window.addEventListener('keydown', onKeydown);

    let touchStart = null;
    board.addEventListener('touchstart', (e) => { touchStart = e.touches[0]; }, { passive: true });
    board.addEventListener('touchend', (e) => {
      if (!touchStart) return;
      const dx = e.changedTouches[0].clientX - touchStart.clientX;
      const dy = e.changedTouches[0].clientY - touchStart.clientY;
      touchStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? 'right' : 'left');
      else doMove(dy > 0 ? 'down' : 'up');
    }, { passive: true });

    function newGame() {
      grid = emptyGrid();
      score = 0; over = false; won = false; keepPlaying = false;
      addRandomTile(grid); addRandomTile(grid);
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    newGame();
    return { dispose: () => { window.removeEventListener('keydown', onKeydown); window.removeEventListener('arcade:themechange', onTheme); } };
  },
};
