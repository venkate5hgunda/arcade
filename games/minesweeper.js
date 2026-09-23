// Minesweeper — logic classic. Single player.
// Pure DOM; listens to arcade:themechange to repaint accents.

import { createShell } from '../js/game-shell.js';
import { loadJSON, KEYS } from '../js/storage.js';

const DIFFICULTIES = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 },
};

const NEIGHBORS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function makeBoard(rows, cols, mines, safeR, safeC) {
  const cells = Array.from({ length: rows * cols }, () => ({ mine: false, revealed: false, flagged: false, count: 0 }));
  // Place mines avoiding safe cell and its neighbors
  const safeSet = new Set();
  safeSet.add(safeR * cols + safeC);
  for (const [dr, dc] of NEIGHBORS) {
    const nr = safeR + dr, nc = safeC + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) safeSet.add(nr * cols + nc);
  }
  const positions = Array.from({ length: rows * cols }, (_, i) => i).filter(i => !safeSet.has(i));
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  for (let i = 0; i < mines; i++) cells[positions[i]].mine = true;
  // Compute counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r * cols + c].mine) continue;
      let cnt = 0;
      for (const [dr, dc] of NEIGHBORS) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && cells[nr * cols + nc].mine) cnt++;
      }
      cells[r * cols + c].count = cnt;
    }
  }
  return cells;
}

function reveal(board, rows, cols, r, c) {
  const i = r * cols + c;
  if (board[i].revealed || board[i].flagged) return;
  board[i].revealed = true;
  if (board[i].count === 0 && !board[i].mine) {
    for (const [dr, dc] of NEIGHBORS) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) reveal(board, rows, cols, nr, nc);
    }
  }
}

function checkWin(board) {
  return board.every(c => c.revealed || c.mine);
}

const COUNT_COLORS = ['', '#38bdf8', '#34d399', '#ff5a3c', '#a855f7', '#fbbf24', '#06b6d4', '#e11d48', '#71717a'];

export default {
  render(el, game) {
    const settings = loadJSON(KEYS.SETTINGS + ':minesweeper', { difficulty: 'easy' });
    const { rows, cols, mines } = DIFFICULTIES[settings.difficulty] || DIFFICULTIES.easy;

    const shell = createShell(el, game, {
      title: 'Minesweeper',
      meta: `${rows}×${cols} · ${mines} mines`,
    });
    const { stage, getResetButton } = shell;

    let board = null, gameOver = false, firstClick = true, flags = 0;

    const grid = document.createElement('div');
    grid.className = 'ms-grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    stage.appendChild(grid);

    const status = document.createElement('div');
    status.className = 'ms-status';
    stage.insertBefore(status, grid);

    function render() {
      grid.innerHTML = '';
      if (!board) return;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = document.createElement('button');
          cell.className = 'ms-cell';
          const b = board[r * cols + c];
          if (b.revealed) {
            cell.classList.add('revealed');
            if (b.mine) {
              cell.textContent = '💣';
              cell.classList.add('mine');
            } else if (b.count > 0) {
              cell.textContent = b.count;
              cell.style.color = COUNT_COLORS[b.count];
            }
          } else if (b.flagged) {
            cell.textContent = '🚩';
          }
          cell.addEventListener('click', (e) => onLeft(r, c));
          cell.addEventListener('contextmenu', (e) => { e.preventDefault(); onRight(r, c); });
          grid.appendChild(cell);
        }
      }
      updateStatus();
    }

    function updateStatus() {
      if (!board) return;
      const remaining = mines - flags;
      if (gameOver) return;
      status.textContent = `Mines left: ${remaining}`;
    }

    function onLeft(r, c) {
      if (gameOver) return;
      if (firstClick) {
        board = makeBoard(rows, cols, mines, r, c);
        firstClick = false;
      }
      const b = board[r * cols + c];
      if (b.flagged) return;
      if (b.mine) {
        gameOver = true;
        board.forEach(c => { if (c.mine) c.revealed = true; });
        const audio = window.arcadeAudio;
        if (audio) { audio.prepare(); audio.buzz(); }
        if (window.haptics) window.haptics.failure();
        status.textContent = '💥 Game Over!';
        return render();
      }
      reveal(board, rows, cols, r, c);
      if (checkWin(board)) {
        gameOver = true;
        board.forEach(c => { if (c.mine) c.flagged = true; });
        const audio = window.arcadeAudio;
        if (audio) { audio.prepare(); audio.chime(); }
        if (window.haptics) window.haptics.success();
        status.textContent = '🎉 You cleared the field!';
      }
      render();
    }

    function onRight(r, c) {
      if (gameOver) return;
      const b = board[r * cols + c];
      if (b.revealed) return;
      b.flagged = !b.flagged;
      flags += b.flagged ? 1 : -1;
      render();
    }

    function newGame() {
      board = null; gameOver = false; firstClick = true; flags = 0; render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    newGame();
    return { dispose: () => window.removeEventListener('arcade:themechange', onTheme) };
  },
};
