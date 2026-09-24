// Minesweeper — logic classic. Single player.
// Pure DOM; listens to arcade:themechange to repaint accents.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { celebrate } from '../js/celebration.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const DIFFICULTIES = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 },
};

const NEIGHBORS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function makeBoard(rows, cols, mines, safeR, safeC) {
  const cells = Array.from({ length: rows * cols }, () => ({ mine: false, revealed: false, flagged: false, count: 0 }));
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

function emptyBoard(rows, cols) {
  return Array.from({ length: rows * cols }, () => ({ mine: false, revealed: false, flagged: false, count: 0 }));
}

function checkWin(board) {
  return board.every(c => c.revealed || c.mine);
}

const COUNT_COLORS = ['', '#38bdf8', '#34d399', '#ff5a3c', '#a855f7', '#fbbf24', '#06b6d4', '#e11d48', '#71717a'];

function validState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s) || !Object.hasOwn(DIFFICULTIES, s.difficulty) ||
      typeof s.firstClick !== 'boolean' || typeof s.flagMode !== 'boolean' ||
      !Array.isArray(s.board)) return false;
  const { rows, cols, mines } = DIFFICULTIES[s.difficulty];
  if (s.board.length !== rows * cols || !s.board.every(c => c && typeof c === 'object' && !Array.isArray(c) &&
      typeof c.mine === 'boolean' && typeof c.revealed === 'boolean' && typeof c.flagged === 'boolean' &&
      Number.isInteger(c.count) && c.count >= 0 && c.count <= 8 && !(c.revealed && c.flagged)) ||
      s.board.some(c => c.revealed && c.mine) || checkWin(s.board)) return false;
  if (s.firstClick) return s.board.every(c => !c.mine && !c.revealed && c.count === 0);
  if (s.board.filter(c => c.mine).length !== mines || !s.board.some(c => c.revealed)) return false;
  return s.board.every((c, i) => c.mine ? c.count === 0 : c.count === NEIGHBORS.filter(([dr, dc]) => {
    const r = Math.floor(i / cols) + dr, col = i % cols + dc;
    return r >= 0 && r < rows && col >= 0 && col < cols && s.board[r * cols + col].mine;
  }).length);
}

export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { title: 'Minesweeper', meta: 'Clear the field · terminal edition' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('ms-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':minesweeper', { difficulty: 'easy' });
    const restored = validState(session?.state) ? session.state : null;
    const settings = restored ? { difficulty: restored.difficulty } : await renderSetup(stage, {
      title: '💣 Clear the Field',
      subtitle: 'Pick a difficulty',
      themeClass: 'ms-theme',
      fields: [{
        key: 'difficulty', label: 'Difficulty',
        options: [
          { value: 'easy', label: 'Easy · 9×9' },
          { value: 'medium', label: 'Medium · 16×16' },
          { value: 'hard', label: 'Hard · 16×30' },
        ],
        default: saved.difficulty,
      }],
      startLabel: 'Start Clearing',
    });
    saveJSON(KEYS.SETTINGS + ':minesweeper', settings);
    const { rows, cols, mines } = DIFFICULTIES[settings.difficulty] || DIFFICULTIES.easy;
    shell.root.querySelector('.game-meta').textContent = `${rows}×${cols} · ${mines} mines`;

    let board = null, gameOver = false, firstClick = true, flags = 0, flagMode = false;
    function checkpoint() {
      session?.save({ difficulty: settings.difficulty, board: board.map(c => ({ ...c })), firstClick, flagMode });
    }

    const grid = document.createElement('div');
    grid.className = 'ms-grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    stage.appendChild(grid);

    const status = document.createElement('div');
    status.className = 'ms-status';
    stage.insertBefore(status, grid);
    const flagToggle = document.createElement('button');
    flagToggle.type = 'button';
    flagToggle.className = 'ms-flag-toggle';
    flagToggle.textContent = '🚩 Flag mode: off';
    flagToggle.setAttribute('aria-pressed', 'false');
    stage.insertBefore(flagToggle, grid);
    flagToggle.addEventListener('click', () => {
      flagMode = !flagMode;
      flagToggle.textContent = `🚩 Flag mode: ${flagMode ? 'on' : 'off'}`;
      flagToggle.setAttribute('aria-pressed', String(flagMode));
      checkpoint();
      updateStatus();
      window.haptics?.select();
    });

    function render() {
      grid.innerHTML = '';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = document.createElement('button');
          cell.className = 'ms-cell';
          const b = board[r * cols + c];
          cell.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}${b.flagged ? ', flagged' : b.revealed ? b.mine ? ', mine' : `, ${b.count || 'empty'}` : ', hidden'}`);
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
          cell.addEventListener('click', () => flagMode ? onRight(r, c) : onLeft(r, c));
          cell.addEventListener('contextmenu', (e) => { e.preventDefault(); onRight(r, c); });
          cell.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'f') { e.preventDefault(); onRight(r, c); }
          });
          grid.appendChild(cell);
        }
      }
      updateStatus();
    }

    function updateStatus() {
      if (!board) return;
      const remaining = mines - flags;
      if (gameOver) return;
      status.textContent = `Mines left: ${remaining} · Tap to ${flagMode ? 'flag' : 'reveal'} · right-click or F to flag`;
    }

    function onLeft(r, c) {
      if (gameOver) return;
      if (firstClick) {
        if (board[r * cols + c].flagged) return;
        const flagged = board.map((cell, index) => cell.flagged ? index : -1).filter((index) => index !== -1);
        board = makeBoard(rows, cols, mines, r, c);
        flagged.forEach((index) => { board[index].flagged = true; });
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
        session?.finish();
        return render();
      }
      reveal(board, rows, cols, r, c);
      if (checkWin(board)) {
        gameOver = true;
        board.forEach(c => { if (c.mine) c.flagged = true; });
        const audio = window.arcadeAudio;
        celebrate(shell.root, 'You cleared the minefield!');
        status.textContent = '🎉 You cleared the field!';
        session?.finish();
      } else {
        checkpoint();
      }
      render();
    }

    function onRight(r, c) {
      if (gameOver) return;
      const b = board[r * cols + c];
      if (b.revealed) return;
      b.flagged = !b.flagged;
      flags += b.flagged ? 1 : -1;
      checkpoint();
      render();
    }

    function newGame() {
      shell.root.querySelector('.arcade-victory')?.remove();
      board = emptyBoard(rows, cols); gameOver = false; firstClick = true; flags = 0; flagMode = false;
      flagToggle.textContent = '🚩 Flag mode: off';
      flagToggle.setAttribute('aria-pressed', 'false');
      checkpoint();
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    if (restored) {
      board = restored.board.map(c => ({ ...c }));
      firstClick = restored.firstClick; flagMode = restored.flagMode;
      flags = board.filter(c => c.flagged).length;
      flagToggle.textContent = `🚩 Flag mode: ${flagMode ? 'on' : 'off'}`;
      flagToggle.setAttribute('aria-pressed', String(flagMode));
      render();
    } else newGame();
    return { dispose: () => window.removeEventListener('arcade:themechange', onTheme) };
  },
};
