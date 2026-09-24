// Tic-Tac-Toe — local 1-2 player or vs unbeatable computer (minimax).
// Pure DOM; listens to arcade:themechange to repaint accents.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { nextPlayer, findWin, emptyBoard } from '../js/game-utils.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { remoteMatch, seat, validTurn } from '../js/remote-match.js';

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
  async render(el, game, { navigate, multiplayer } = {}) {
    const shell = createShell(el, game, { title: 'Tic-Tac-Toe', meta: 'Classic 3-in-a-row · neon edition' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('ttt-vibe');

    const match = remoteMatch(multiplayer, game.id);
    const saved = loadJSON(KEYS.SETTINGS + ':tictactoe', { mode: 'pvp' });
    const settings = match ? { mode: 'pvp' } : await renderSetup(stage, {
      title: '⚡ Ready to play?',
      subtitle: 'Choose your opponent',
      themeClass: 'ttt-theme',
      fields: [{
        key: 'mode', label: 'Opponent',
        options: [{ value: 'pvp', label: '👥 Friend' }, { value: 'ai', label: '🤖 Computer' }],
        default: saved.mode,
      }],
      startLabel: 'Drop In',
    });
    if (!match) saveJSON(KEYS.SETTINGS + ':tictactoe', settings);
    shell.root.querySelector('.game-meta').textContent =
      match ? `Online room · you are ${seat(match) === 1 ? 'X' : 'O'}` :
        settings.mode === 'ai' ? 'You (X) vs Computer (O)' : 'Two players · X goes first';

    const board = emptyBoard(N);
    let current = 1, gameOver = false, winLine = null, busy = false, aiTimer = null;

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
        cell.setAttribute('aria-label', `Cell ${Math.floor(i / 3) + 1},${(i % 3) + 1}`);
        const token = board[i];
        if (token) {
          cell.textContent = TOKEN_STYLE[token].label;
          cell.style.color = TOKEN_STYLE[token].color;
          cell.classList.add('filled');
        }
        if (winLine && winLine.includes(i)) cell.classList.add('win');
        cell.disabled = gameOver || board[i] !== 0 || busy || (match && current !== seat(match));
        cell.addEventListener('click', () => {
          if (match) match.sendAction({ type: 'move', cell: i });
          else onMove(i);
        });
        grid.appendChild(cell);
      }
      updateStatus();
    }

    function updateStatus() {
      if (gameOver) return;
      const token = current;
      status.textContent = match
        ? `${TOKEN_STYLE[token].label} to move · ${current === seat(match) ? 'your turn' : 'waiting for opponent'}`
        : `Player ${TOKEN_STYLE[token].label}'s turn`;
      status.style.color = TOKEN_STYLE[token].color;
    }

    async function onMove(i) {
      if (gameOver || board[i] !== 0 || busy || !Number.isInteger(i) || i < 0 || i >= board.length) return;
      busy = true;
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();
      busy = false;
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
        if (window.haptics) window.haptics.failure();
        return render();
      }
      current = nextPlayer(current, 2);
      render();

      // Computer turn
      if (settings.mode === 'ai' && current === 2) {
        status.textContent = 'Computer is thinking…';
        aiTimer = setTimeout(() => {
          if (gameOver) return;
          const m = aiMove(board, 2, 1);
          if (m >= 0) {
            board[m] = 2; current = 1;
            const w = findWin(board, N);
            if (w) { winLine = w; gameOver = true; status.textContent = 'Computer wins!'; if (audio) audio.chime(); if (window.haptics) window.haptics.failure(); }
            else if (board.every((v) => v !== 0)) { gameOver = true; status.textContent = "It's a draw!"; if (audio) audio.buzz(); if (window.haptics) window.haptics.failure(); }
            else status.textContent = "Your turn";
          }
          render();
        }, 400);
      }
    }

    function reset() {
      clearTimeout(aiTimer);
      for (let i = 0; i < board.length; i++) board[i] = 0;
      current = 1; gameOver = false; winLine = null; busy = false; render();
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
      else if (event.action?.type === 'move' && validTurn(match, current, event.from))
        onMove(event.action.cell);
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
