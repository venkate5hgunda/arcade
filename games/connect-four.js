// Connect Four — gravity grid duel. 1-2 players.
// Pure DOM; listens to arcade:themechange to repaint accents.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { nextPlayer, emptyBoard } from '../js/game-utils.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { remoteMatch, seat, validTurn } from '../js/remote-match.js';

const ROWS = 6, COLS = 7;
const TOKEN_STYLE = { 1: { color: '#ff5a3c', label: '●' }, 2: { color: '#fbbf24', label: '●' } };

function idx(r, c) { return r * COLS + c; }

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

// Lightweight heuristic AI (not a full minimax — 42 columns deep is expensive):
// take an immediate win, else block an immediate opponent win, else prefer
// center columns with a little randomness so it isn't perfectly predictable.
function aiColumn(board, aiToken, humanToken) {
  const open = Array.from({ length: COLS }, (_, c) => c).filter((c) => lowestEmptyRow(board, c) !== -1);
  for (const c of open) {
    const r = lowestEmptyRow(board, c);
    board[idx(r, c)] = aiToken;
    const win = checkWin(board, aiToken);
    board[idx(r, c)] = 0;
    if (win) return c;
  }
  for (const c of open) {
    const r = lowestEmptyRow(board, c);
    board[idx(r, c)] = humanToken;
    const win = checkWin(board, humanToken);
    board[idx(r, c)] = 0;
    if (win) return c;
  }
  const weighted = open.flatMap((c) => Array(4 - Math.abs(c - 3)).fill(c));
  return weighted[Math.floor(Math.random() * weighted.length)] ?? open[0];
}

export default {
  async render(el, game, { navigate, multiplayer } = {}) {
    const shell = createShell(el, game, { title: 'Connect Four', meta: 'Drop to win · gravity edition' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('c4-vibe');

    const match = remoteMatch(multiplayer, game.id);
    const saved = loadJSON(KEYS.SETTINGS + ':connect-four', { mode: 'pvp' });
    const settings = match ? { mode: 'pvp' } : await renderSetup(stage, {
      title: '🔴 Drop to Win',
      subtitle: 'Choose your opponent',
      themeClass: 'c4-theme',
      fields: [{
        key: 'mode', label: 'Opponent',
        options: [{ value: 'pvp', label: '👥 Friend' }, { value: 'ai', label: '🤖 Computer' }],
        default: saved.mode,
      }],
      startLabel: 'Drop In',
    });
    if (!match) saveJSON(KEYS.SETTINGS + ':connect-four', settings);
    shell.root.querySelector('.game-meta').textContent =
      match ? `Online room · you are ${seat(match) === 1 ? 'Red' : 'Yellow'}` :
        settings.mode === 'ai' ? 'You (Red) vs Computer (Yellow)' : 'Two players · Red goes first';

    const board = emptyBoard(ROWS * COLS);
    let current = 1, gameOver = false, winCells = null, busy = false, aiTimer = null;

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
          cell.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}`);
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
      colButtons.innerHTML = '';
      for (let c = 0; c < COLS; c++) {
        const btn = document.createElement('button');
        btn.className = 'c4-col-btn';
        btn.setAttribute('aria-label', `Drop in column ${c + 1}`);
        btn.textContent = '↓';
        btn.disabled = gameOver || busy || lowestEmptyRow(board, c) === -1 || (match && current !== seat(match));
        btn.addEventListener('click', () => {
          if (match) match.sendAction({ type: 'drop', column: c });
          else onDrop(c);
        });
        colButtons.appendChild(btn);
      }
      updateStatus();
    }

    function updateStatus() {
      if (gameOver) return;
      status.textContent = match
        ? `${current === 1 ? 'Red' : 'Yellow'} to move · ${current === seat(match) ? 'your turn' : 'waiting for opponent'}`
        : `Player ${TOKEN_STYLE[current].label}'s turn`;
      status.style.color = TOKEN_STYLE[current].color;
    }

    async function onDrop(col) {
      if (gameOver || busy || !Number.isInteger(col) || col < 0 || col >= COLS) return;
      const row = lowestEmptyRow(board, col);
      if (row === -1) return;
      busy = true;
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();
      busy = false;
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
        if (window.haptics) window.haptics.failure();
        return render();
      }
      current = nextPlayer(current, 2);
      render();

      // Computer turn
      if (settings.mode === 'ai' && current === 2 && !gameOver) {
        status.textContent = 'Computer is thinking…';
        aiTimer = setTimeout(async () => {
          if (gameOver) return;
          const c = aiColumn(board, 2, 1);
          const r = lowestEmptyRow(board, c);
          if (r !== -1) {
            board[idx(r, c)] = 2;
            if (audio) audio.tap();
            const w = checkWin(board, 2);
            if (w) {
              winCells = w; gameOver = true; status.textContent = 'Computer wins!';
              if (audio) audio.chime();
              if (window.haptics) window.haptics.failure();
            } else if (board.every((v) => v !== 0)) {
              gameOver = true; status.textContent = "It's a draw!";
              if (audio) audio.buzz();
              if (window.haptics) window.haptics.failure();
            } else {
              current = 1;
              status.textContent = 'Your turn';
            }
          }
          render();
        }, 450);
      }
    }

    function reset() {
      clearTimeout(aiTimer);
      for (let i = 0; i < board.length; i++) board[i] = 0;
      current = 1; gameOver = false; winCells = null; busy = false; render();
    }
    getResetButton().addEventListener('click', () => {
      if (match) {
        if (match.role === 'host') match.sendAction({ type: 'reset' });
      } else reset();
    });
    if (match && match.role !== 'host') getResetButton().disabled = true;
    const offRoom = match?.on((event) => {
      if (event.type !== 'action' || match.activeGame?.id !== game.id) return;
      if (event.action?.type === 'reset' && event.from === match.activeGame.playerIds[0]) reset();
      else if (event.action?.type === 'drop' && validTurn(match, current, event.from))
        onDrop(event.action.column);
    });

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    render();
    return { dispose: () => {
      clearTimeout(aiTimer);
      offRoom?.();
      window.removeEventListener('arcade:themechange', onTheme);
    } };
  },
};
