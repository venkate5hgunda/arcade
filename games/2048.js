// 2048 — classic slide-and-merge puzzle. Single player, keyboard + swipe.
// Pure DOM; listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { celebrate } from '../js/celebration.js';

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
  return { r, c };
}

export function move(grid, dir) {
  const coordinate = {
    left: (line, offset) => [line, offset],
    right: (line, offset) => [line, SIZE - 1 - offset],
    up: (line, offset) => [offset, line],
    down: (line, offset) => [SIZE - 1 - offset, line],
  }[dir];
  if (!coordinate) throw new RangeError(`Unknown direction: ${dir}`);
  const result = emptyGrid();
  const tiles = [];
  const merges = [];
  let gained = 0;
  for (let line = 0; line < SIZE; line++) {
    let target = 0;
    let lastMerged = false;
    for (let offset = 0; offset < SIZE; offset++) {
      const [r, c] = coordinate(line, offset);
      const value = grid[r][c];
      if (!value) continue;
      const [tr, tc] = coordinate(line, target);
      const previous = target > 0 ? coordinate(line, target - 1) : null;
      if (previous && !lastMerged && result[previous[0]][previous[1]] === value) {
        const [pr, pc] = previous;
        result[pr][pc] *= 2;
        gained += result[pr][pc];
        tiles.push({ r, c, tr: pr, tc: pc, value });
        merges.push({ r: pr, c: pc });
        lastMerged = true;
      } else {
        result[tr][tc] = value;
        tiles.push({ r, c, tr, tc, value });
        target++;
        lastMerged = false;
      }
    }
  }
  return { grid: result, gained, tiles, merges };
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

function validState(state) {
  return state && typeof state === 'object' && !Array.isArray(state) &&
    Array.isArray(state.grid) && state.grid.length === SIZE &&
    state.grid.every(row => Array.isArray(row) && row.length === SIZE &&
      row.every(v => Number.isSafeInteger(v) && (v === 0 || (v >= 2 && Number.isInteger(Math.log2(v)))))) &&
    Number.isSafeInteger(state.score) && state.score >= 0 &&
    typeof state.won === 'boolean' && typeof state.keepPlaying === 'boolean' &&
    (!state.keepPlaying || state.won) && !state.grid.every(row => row.every(v => v === 0)) &&
    state.won === state.grid.some(row => row.some(v => v >= 2048)) && hasMoves(state.grid);
}

export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { title: '2048', meta: 'Slide, merge, reach 2048' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('t48-vibe');

    const restored = validState(session?.state) ? session.state : null;
    if (!restored) await renderSetup(stage, {
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
    let animationTimer = null, animationFrame = null, queuedMove = null, disposed = false;

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
        message.querySelector('#continue').addEventListener('click', () => { keepPlaying = true; checkpoint(); render(); });
        message.querySelector('#retry2').addEventListener('click', newGame);
      }
    }

    function checkpoint() {
      session?.save({ grid: cloneGrid(grid), score, won, keepPlaying });
    }

    function cancelAnimation() {
      if (animationTimer !== null) clearTimeout(animationTimer);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationTimer = animationFrame = null;
      queuedMove = null;
      board.classList.remove('t48-moving');
      board.querySelector('.t48-motion')?.remove();
    }

    function animateMove(tiles, merges, spawned, before) {
      const boardRect = board.getBoundingClientRect();
      const after = [...board.querySelectorAll('.t48-cell')].map(cell => cell.getBoundingClientRect());
      const overlay = document.createElement('div');
      overlay.className = 't48-motion';
      for (const { r, c, tr, tc, value } of tiles) {
        const source = before[r * SIZE + c], destination = after[tr * SIZE + tc];
        const tile = document.createElement('div');
        tile.className = 't48-cell filled t48-motion-tile';
        tile.textContent = value;
        tile.style.cssText = `left:${source.left - boardRect.left}px;top:${source.top - boardRect.top}px;width:${source.width}px;height:${source.height}px;background:${TILE_COLORS[value] || '#3c3a32'};color:${value <= 4 ? '#776e65' : '#f9f6f2'};font-size:${value >= 1024 ? '1.3rem' : value >= 128 ? '1.6rem' : '1.9rem'}`;
        overlay.appendChild(tile);
        tile.dataset.dx = destination.left - source.left;
        tile.dataset.dy = destination.top - source.top;
      }
      board.appendChild(overlay);
      board.classList.add('t48-moving');
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        overlay.querySelectorAll('.t48-motion-tile').forEach(tile => {
          tile.style.transform = `translate(${tile.dataset.dx}px, ${tile.dataset.dy}px)`;
        });
      });
      animationTimer = setTimeout(() => {
        animationTimer = null;
        overlay.remove();
        board.classList.remove('t48-moving');
        for (const { r, c } of merges) board.children[r * SIZE + c]?.classList.add('t48-merged');
        board.children[spawned.r * SIZE + spawned.c]?.classList.add('t48-spawned');
        if (!disposed && queuedMove) {
          const next = queuedMove;
          queuedMove = null;
          doMove(next);
        }
      }, 175);
    }

    function doMove(dir) {
      if (over || (won && !keepPlaying)) return;
      if (animationTimer !== null) { queuedMove = dir; return; }
      const { grid: newGrid, gained, tiles, merges } = move(grid, dir);
      if (gridsEqual(grid, newGrid)) return;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const before = reducedMotion ? null : [...board.querySelectorAll('.t48-cell')].map(cell => cell.getBoundingClientRect());
      grid = newGrid;
      score += gained;
      if (score > bestScore) { bestScore = score; saveJSON(KEYS.HIGH_SCORES + ':2048', bestScore); }
      const spawned = addRandomTile(grid);
      const audio = window.arcadeAudio;
      if (audio) { audio.prepare(); gained ? audio.pop() : audio.tap(); }
      window.haptics?.select();
      if (!won && grid.some((row) => row.some((v) => v >= 2048))) {
        won = true;
        celebrate(shell.root, 'You reached 2048!');
      } else if (!hasMoves(grid)) {
        over = true;
        if (audio) audio.buzz();
        window.haptics?.failure();
      }
      if (over || (won && !keepPlaying)) session?.finish();
      else checkpoint();
      render();
      if (before) animateMove(tiles, merges, spawned, before);
    }

    function onKeydown(e) {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[e.key] && !document.querySelector('dialog[open]')) { e.preventDefault(); doMove(map[e.key]); }
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
      cancelAnimation();
      shell.root.querySelector('.arcade-victory')?.remove();
      grid = emptyGrid();
      score = 0; over = false; won = false; keepPlaying = false;
      addRandomTile(grid); addRandomTile(grid);
      checkpoint();
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => { cancelAnimation(); render(); };
    window.addEventListener('arcade:themechange', onTheme);
    if (restored) {
      grid = cloneGrid(restored.grid);
      score = restored.score; won = restored.won; keepPlaying = restored.keepPlaying;
      render();
    } else newGame();
    return { dispose: () => { disposed = true; cancelAnimation(); window.removeEventListener('keydown', onKeydown); window.removeEventListener('arcade:themechange', onTheme); } };
  },
};
