// Connect Four — gravity grid duel. 1-2 players.
// Pure DOM; listens to arcade:themechange to repaint accents.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { nextPlayer } from '../js/game-utils.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { remoteMatch, seat, validTurn } from '../js/remote-match.js';
import { playerName } from '../js/player-names.js';
import { celebrate } from '../js/celebration.js';
import { createTurnIndicator } from '../js/turn-indicator.js';

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

function validState(s, allowFinished = false) {
  if (!s || typeof s !== 'object' || Array.isArray(s) || !['pvp', 'ai'].includes(s.mode) ||
      !Array.isArray(s.board) || s.board.length !== ROWS * COLS ||
      !s.board.every(v => v === 0 || v === 1 || v === 2) || ![1, 2].includes(s.current)) return false;
  const red = s.board.filter(v => v === 1).length, yellow = s.board.filter(v => v === 2).length;
  const winRed = checkWin(s.board, 1), winYellow = checkWin(s.board, 2);
  const finished = !!(winRed || winYellow) || !s.board.includes(0);
  if (red < yellow || red > yellow + 1 ||
      s.current !== (finished ? red === yellow ? 2 : 1 : red === yellow ? 1 : 2) ||
      (finished ? !allowFinished || s.over !== true : s.over === true) ||
      winRed && s.current !== 1 || winYellow && s.current !== 2 ||
      winRed && winYellow) return false;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS - 1; r++)
    if (s.board[idx(r, c)] && !s.board[idx(r + 1, c)]) return false;
  return true;
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
  async render(el, game, { navigate, multiplayer, session } = {}) {
    const shell = createShell(el, game, { title: 'Connect Four', meta: 'Drop to win · gravity edition' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('c4-vibe');

    const match = remoteMatch(multiplayer, game.id);
    const showTurn = createTurnIndicator(shell.root, match);
    const saved = loadJSON(KEYS.SETTINGS + ':connect-four', { mode: 'pvp' });
    const restored = !match && validState(session?.state) ? session.state : null;
    const roomSave = match?.role === 'host' ? match.savedGame : null;
    if (roomSave && (roomSave.mode !== 'pvp' || !validState(roomSave, true) ||
        !Number.isSafeInteger(roomSave.roundId) || roomSave.roundId < 0))
      throw new Error('Saved Connect Four room state is invalid.');
    const settings = match ? { mode: 'pvp' } : restored ? { mode: restored.mode } : await renderSetup(stage, {
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

    const board = Array(ROWS * COLS).fill(0);
    let current = 1, gameOver = false, winCells = null, busy = false, aiTimer = null, recentDrop = -1;
    if (roomSave || restored) {
      (roomSave || restored).board.forEach((v, i) => { board[i] = v; });
      current = (roomSave || restored).current;
    }
    let disposed = false, roundId = roomSave?.roundId ?? 0, stateEpoch = 0;
    if (roomSave?.over) {
      gameOver = true;
      winCells = checkWin(board, 1) || checkWin(board, 2);
    }

    function checkpoint() {
      if (match?.role === 'host')
        match.saveGame(game.id, { mode: 'pvp', board: board.slice(), current, over: gameOver, roundId });
      else if (!match) session?.save({ mode: settings.mode, board: board.slice(), current });
    }

    const boardArea = document.createElement('div');
    boardArea.className = 'c4-board';
    stage.appendChild(boardArea);
    const grid = document.createElement('div');
    grid.className = 'c4-grid';
    boardArea.appendChild(grid);

    const status = document.createElement('div');
    status.className = 'c4-status';
    stage.appendChild(status);

    const colButtons = document.createElement('div');
    colButtons.className = 'c4-col-btns';
    boardArea.insertBefore(colButtons, grid);

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
            if (idx(r, c) === recentDrop) cell.classList.add('just-dropped');
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
        btn.disabled = gameOver || busy || lowestEmptyRow(board, c) === -1 ||
          (!match && settings.mode === 'ai' && current === 2) || (match && current !== seat(match));
        btn.addEventListener('click', () => {
          if (match) match.sendAction({ type: 'drop', column: c });
          else onDrop(c);
        });
        colButtons.appendChild(btn);
      }
      updateStatus();
      if (match || settings.mode === 'pvp') showTurn(current - 1, !gameOver);
      recentDrop = -1;
    }

    function updateStatus() {
      if (gameOver) {
        status.textContent = winCells ? `${playerName(current - 1, match)} (${TOKEN_STYLE[current].label}) wins!` : "It's a draw!";
        status.style.color = winCells ? TOKEN_STYLE[current].color : '';
        return;
      }
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
      const startedRound = roundId, startedEpoch = stateEpoch;
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();
      if (disposed || startedRound !== roundId || startedEpoch !== stateEpoch ||
          gameOver || lowestEmptyRow(board, col) !== row) return;
      busy = false;
      board[idx(row, col)] = current;
      recentDrop = idx(row, col);
      if (audio) audio.tap();
      const win = checkWin(board, current);
      if (win) {
        winCells = win; gameOver = true;
        const name = playerName(current - 1, match);
        status.textContent = `${name} (${TOKEN_STYLE[current].label}) wins!`;
        status.style.color = TOKEN_STYLE[current].color;
        if (match?.role === 'host') match.recordResult(game.id, current - 1, roundId);
        if (!match || seat(match) === current) celebrate(shell.root, `${name} wins!`);
        session?.finish();
        checkpoint();
        return render();
      }
      if (board.every((v) => v !== 0)) {
        gameOver = true; status.textContent = "It's a draw!";
        if (match?.role === 'host') match.recordResult(game.id, null, roundId);
        if (audio) audio.buzz();
        if (window.haptics) window.haptics.failure();
        session?.finish();
        checkpoint();
        return render();
      }
      current = nextPlayer(current, 2);
      checkpoint();
      render();

      // Computer turn
      scheduleAi();
    }

    function scheduleAi() {
      if (settings.mode === 'ai' && current === 2 && !gameOver && !match) {
        status.textContent = 'Computer is thinking…';
        aiTimer = setTimeout(async () => {
          if (gameOver || disposed) return;
          const c = aiColumn(board, 2, 1);
          const r = lowestEmptyRow(board, c);
          if (r !== -1) {
            board[idx(r, c)] = 2;
            recentDrop = idx(r, c);
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
          if (gameOver) session?.finish();
          else checkpoint();
          render();
        }, 450);
      }
    }

    function reset() {
      roundId++;
      stateEpoch++;
      clearTimeout(aiTimer);
      for (let i = 0; i < board.length; i++) board[i] = 0;
      current = 1; gameOver = false; winCells = null; busy = false; recentDrop = -1;
      shell.root.querySelector('.arcade-victory')?.remove();
      checkpoint(); render();
    }
    getResetButton().addEventListener('click', () => {
      if (match) {
        if (match.role === 'host') match.sendAction({ type: 'reset' });
      } else reset();
    });
    if (match && match.role !== 'host') getResetButton().disabled = true;
    const offRoom = match?.on((event) => {
      if (match.activeGame?.id !== game.id) return;
      if (event.type === 'reconnected' && match.role === 'guest') {
        match.sendAction({ type: 'room-sync' }); return;
      }
      if (event.type !== 'action') return;
      if (event.action?.type === 'room-state' && match.role === 'guest') {
        const snapshot = event.action.state;
        if (snapshot?.mode !== 'pvp' || !validState(snapshot, true) ||
            !Number.isSafeInteger(snapshot.roundId) || snapshot.roundId < 0) {
          match.error(new Error('Invalid Connect Four room state.')); return;
        }
        roundId = snapshot.roundId;
        stateEpoch++;
        board.splice(0, board.length, ...snapshot.board);
        current = snapshot.current; gameOver = !!snapshot.over;
        winCells = checkWin(board, 1) || checkWin(board, 2); busy = false;
        render(); return;
      }
      if (event.action?.type === 'reset' && event.from === match.activeGame.playerIds[0]) reset();
      else if (event.action?.type === 'drop' && validTurn(match, current, event.from))
        onDrop(event.action.column);
    });

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    render();
    if (restored) scheduleAi();
    else checkpoint();
    if (match?.role === 'guest') match.sendAction({ type: 'room-sync' });
    return { dispose: () => {
      disposed = true;
      clearTimeout(aiTimer);
      offRoom?.();
      window.removeEventListener('arcade:themechange', onTheme);
    } };
  },
};
