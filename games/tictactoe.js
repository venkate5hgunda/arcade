// Tic-Tac-Toe. Pure DOM.
import { createShell } from '../js/game-shell.js';
import { nextPlayer, findWin, emptyBoard } from '../js/game-utils.js';
import { loadJSON, KEYS } from '../js/storage.js';

const N = 3;

function minimax(board, isMax, aiToken, humanToken) {
  const win = findWin(board, N);
  if (win) return board[win[0]] === aiToken ? 1 : -1;
  if (board.every((v) => v !== 0)) return 0;
  const cur = isMax ? aiToken : humanToken;
  let best = isMax ? -Infinity : Infinity;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 0) continue;
    board[i] = cur;
    const score = minimax(board, !isMax, aiToken, humanToken);
    board[i] = 0;
    best = isMax ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

function aiMove(board, aiToken, humanToken) {
  const moves = board.map((v, i) => (v === 0 ? i : null)).filter((v) => v !== null);
  if (moves.length === 0) return -1;
  let best = moves[0], bestScore = -Infinity;
  for (const m of moves) {
    const b = board.slice();
    b[m] = aiToken;
    const score = minimax(b, false, aiToken, humanToken);
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

const TOKEN_STYLE = { 1: { color: '#ff5a3c', label: 'X' }, 2: { color: '#38bdf8', label: 'O' } };

export default {
  render(el, game) {
    const settings = loadJSON(KEYS.SETTINGS + ':tictactoe', { mode: 'pvp' });
    const playerCount = settings.mode === 'ai' ? 1 : 2;

    const shell = createShell(el, game, {
      title: 'Tic-Tac-Toe',
      meta: settings.mode === 'ai' ? 'You (X) vs Computer (O)' : 'Two players · X goes first',
    });
    const { stage, getResetButton } = shell;

    const board = emptyBoard(N);
    let current = 1, gameOver = false, winLine = null;

    const grid = document.createElement('div');
    grid.className = 'ttt-grid';
    stage.appendChild(grid);

    const status = document.createElement('div');
    status.className = 'ttt-status';
    stage.appendChild(status);

    function render() {
      grid.innerHTML = '';
      for (let i = 0; i < board.length; i++) {
        const cell = document.createElement('button');
        cell.className = 'ttt-cell';
        const token = board[i] ? board[i] : '';
        if (token) {
          cell.textContent = TOKEN_STYLE[token].label;
          cell.style.color = TOKEN_STYLE[token].color;
          cell.classList.add('filled');
        }
        if (winLine && winLine.includes(i)) cell.classList.add('win');
        cell.addEventListener('click', () => onMove(i));
        grid.appendChild(cell);
      }
      updateStatus();
    }

    function updateStatus() {
      if (gameOver) return;
      const token = current;
      status.textContent = `Player ${TOKEN_STYLE[token].label}'s turn`;
      status.style.color = TOKEN_STYLE[token].color;
    }

    async function onMove(i) {
      if (gameOver || board[i] !== 0) return;
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();
      board[i] = current;
      if (audio) audio.tap();
      const win = findWin(board, N);
      if (win) {
        winLine = win; gameOver = true;
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
      if (settings.mode === 'ai' && current === 2) {
        status.textContent = 'Computer is thinking…';
        setTimeout(() => {
          const m = aiMove(board, 2, 1);
          if (m >= 0) {
            board[m] = 2; current = 1;
            const w = findWin(board, N);
            if (w) { winLine = w; gameOver = true; status.textContent = 'Computer wins!'; if (audio) audio.chime(); }
            else if (board.every((v) => v !== 0)) { gameOver = true; status.textContent = "It's a draw!"; }
            else status.textContent = "Your turn";
          }
          render();
        }, 320);
      }
    }

    getResetButton().addEventListener('click', () => {
      for (let i = 0; i < board.length; i++) board[i] = 0;
      current = 1; gameOver = false; winLine = null; render();
    });

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    render();
    return { dispose: () => window.removeEventListener('arcade:themechange', onTheme) };
  },
};
