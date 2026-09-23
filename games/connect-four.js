// Connect Four — gravity grid duel. 1-2 players.
// Pure DOM; listens to arcade:themechange to repaint accents.

import { createShell } from '../js/game-shell.js';
import { nextPlayer, findWin, winLines, emptyBoard } from '../js/game-utils.js';
import { loadJSON, KEYS } from '../js/storage.js';

const ROWS = 6, COLS = 7;
const TOKEN_STYLE = { 1: { color: '#ff5a3c', label: '●' }, 2: { color: '#fbbf24', label: '●' } };

function idx(r, c) { return r * COLS + c; }
function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

function checkWin(board, player) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[idx(r, c)] !== player) continue;
      // horizontal
      if (c + 3 < COLS && board[idx(r, c+1)] === player && board[idx(r, c+2)] === player && board[idx(r, c+3)] === player) return [[r,c],[r,c+1],[r,c+2],[r,c+3]];
      // vertical
      if (r + 3 < ROWS && board[idx(r+1, c)] === player && board[idx(r+2, c)] === player && board[idx(r+3, c)] === player) return [[r,c],[r+1,c],[r+2,c],[r+3,c]];
      // diagonal down-right
      if (r + 3 < ROWS && c + 3 < COLS && board[idx(r+1, c+1)] === player && board[idx(r+2, c+2)] === player && board[idx(r+3, c+3)] === player) return [[r,c],[r+1,c+1],[r+2,c+2],[r+3,c+3]];
      // diagonal up-right
      if (r - 3 >= 0 && c + 3 < COLS && board[idx(r-1, c+1)] === player && board[idx(r-2, c+2)] === player && board[idx(r-3, c+3)] === player) return [[r,c],[r-1,c+1],[r-2,c+2],[r-3,c+3]];
    }
  }
  return null;
}

function lowestEmptyRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) if (board[idx(r, col)] === 0) return r;
  return -1;
}

export default {
  render(el, game) {
    const settings = loadJSON(KEYS.SETTINGS + ':connect-four', { mode: 'pvp' });
    const playerCount = settings.mode === 'ai' ? 1 : 2;

    const shell = createShell(el, game, {
      title: 'Connect Four',
      meta: settings.mode === 'ai' ? 'You (Red) vs Computer (Yellow)' : 'Two players · Red goes first',
    });
    const { stage, getResetButton } = shell;

    const board = emptyBoard(ROWS * COLS);
    let current = 1, gameOver = false, winCells = null;

    const grid = document.createElement('div');
    grid.className = 'c4-grid';
    stage.appendChild(grid);

    const status = document.createElement('div');
    status.className = 'c4-status';
    stage.appendChild(status);

    const colButtons = document.createElement('div');
    colButtons.className = 'c4-col-btns';
    stage.insertBefore(colButtons, grid);

    function render() {
      grid.innerHTML = '';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = document.createElement('div');
          cell.className = 'c4-cell';
          const v = board[idx(r, c)];
          if (v) {
            cell.textContent = TOKEN_STYLE[v].label;
            cell.style.color = TOKEN_STYLE[v].color;
            cell.classList.add('filled');
          }
          if (winCells && winCells.some(([wr, wc]) => wr === r && wc === c)) cell.classList.add('win');
          grid.appendChild(cell);
        }
      }
      // Column buttons: enable if not full and game not over
      colButtons.innerHTML = '';
      for (let c = 0; c < COLS; c++) {
        const btn = document.createElement('button');
        btn.className = 'c4-col-btn';
        btn.textContent = '↓';
        btn.disabled = gameOver || lowestEmptyRow(board, c) === -1;
        btn.addEventListener('click', () => onDrop(c));
        colButtons.appendChild(btn);
      }
      updateStatus();
    }

    function updateStatus() {
      if (gameOver) return;
      status.textContent = `Player ${TOKEN_STYLE[current].label}'s turn`;
      status.style.color = TOKEN_STYLE[current].color;
    }

    async function onDrop(col) {
      if (gameOver) return;
      const row = lowestEmptyRow(board, col);
      if (row === -1) return;
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();
      board[idx(row, col)] = current;
      if (audio) audio.tap();
      const win = checkWin(board, current);
      if (win) {
        winCells = win; gameOver = true;
        status.textContent = `Player ${TOKEN_STYLE[current].label} wins!`;
        status.style.color = TOKEN_STYLE[current].color;
        if (audio) audio.chime();
        if (window.haptics) window.haptics.success();
        return render();
      }
      if (board.every((v) => v !== 0)) {
        gameOver = true; status.textContent = "It's a draw!";
        if (audio) audio.buzz();
        return render();
      }
      current = nextPlayer(current, playerCount);
      render();
    }

    getResetButton().addEventListener('click', () => {
      for (let i = 0; i < board.length; i++) board[i] = 0;
      current = 1; gameOver = false; winCells = null; render();
    });

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    render();
    return { dispose: () => window.removeEventListener('arcade:themechange', onTheme) };
  },
};
