import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { dieMarkup, rollDie } from '../js/dice.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { remoteMatch, seat } from '../js/remote-match.js';

const COLORS = ['#ff6558', '#60baf0', '#56cf9a', '#f2be59'];
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

function buildTrack() {
  const cells = [], add = (row, col) => cells.push([row, col]);
  for (let col = 1; col <= 5; col++) add(6, col);
  for (let row = 5; row >= 0; row--) add(row, 6);
  add(0, 7); add(0, 8);
  for (let row = 1; row <= 5; row++) add(row, 8);
  for (let col = 9; col <= 14; col++) add(6, col);
  add(7, 14); add(8, 14);
  for (let col = 13; col >= 9; col--) add(8, col);
  for (let row = 9; row <= 14; row++) add(row, 8);
  add(14, 7); add(14, 6);
  for (let row = 13; row >= 9; row--) add(row, 6);
  for (let col = 5; col >= 0; col--) add(8, col);
  add(7, 0); add(6, 0);
  return cells;
}

export const TRACK = buildTrack();
const LANES = [
  Array.from({ length: 6 }, (_, i) => [7, 1 + i]),
  Array.from({ length: 6 }, (_, i) => [1 + i, 7]),
  Array.from({ length: 6 }, (_, i) => [7, 13 - i]),
  Array.from({ length: 6 }, (_, i) => [13 - i, 7]),
];
const YARDS = [[1, 1], [1, 10], [10, 10], [10, 1]];

export function legalMoves(positions, roll) {
  return positions.flatMap((position, index) =>
    (position === -1 ? roll === 6 : position < 58 && position + roll <= 58) ? [index] : []);
}

function validCheckpoint(s) {
  if (!s || typeof s !== 'object' || !Number.isInteger(s.count) || s.count < 2 || s.count > 4 ||
      !Array.isArray(s.tokens) || s.tokens.length !== s.count ||
      s.tokens.some((group) => !Array.isArray(group) || group.length !== 4 ||
        group.some((n) => !Number.isInteger(n) || n < -1 || n > 58)) ||
      !Number.isInteger(s.current) || s.current < 0 || s.current >= s.count ||
      !Number.isInteger(s.value) || s.value < 1 || s.value > 6 ||
      typeof s.awaiting !== 'boolean' || !Array.isArray(s.movable) ||
      s.movable.some((n) => !Number.isInteger(n) || n < 0 || n > 3) ||
      s.movable.length !== new Set(s.movable).size ||
      s.tokens.some((group) => group.every((n) => n === 58)) ||
      s.winner !== null || typeof s.message !== 'string' || s.message.length > 160) return false;
  const expected = legalMoves(s.tokens[s.current], s.value);
  return s.awaiting ? expected.length > 0 && expected.length === s.movable.length &&
    expected.every((n) => s.movable.includes(n)) : s.movable.length === 0;
}

export default {
  async render(el, game, { navigate, multiplayer, session } = {}) {
    const shell = createShell(el, game, { title: 'Ludo', meta: 'Bring all four tokens home' });
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('ld-vibe');
    const match = remoteMatch(multiplayer, game.id);
    const resume = !match && validCheckpoint(session?.state) ? session.state : null;
    const saved = loadJSON(KEYS.SETTINGS + ':ludo', { players: '4' });
    const settings = match ? { players: String(match.activeGame.playerIds.length) } : resume ? { players: String(resume.count) } : await renderSetup(shell.stage, {
      title: 'Ludo', subtitle: 'Gather around the board.',
      themeClass: 'ld-theme', startLabel: 'Open the Table',
      fields: [{ key: 'players', label: 'Players', default: saved.players,
        options: [2, 3, 4].map((n) => ({ value: String(n), label: `${n} Players` })) }],
    });
    if (!match) saveJSON(KEYS.SETTINGS + ':ludo', settings);
    const count = Number(settings.players);
    const tokens = Array.from({ length: count }, () => Array(4).fill(-1));
    let current = 0, value = 1, awaiting = false, movable = [], winner = null, message = '', rolling = false, pendingMove = null, queuedRoll = null;
    if (resume) {
      resume.tokens.forEach((group, p) => tokens[p].splice(0, 4, ...group));
      current = resume.current; value = resume.value; awaiting = resume.awaiting;
      movable = resume.movable; message = resume.message;
    }
    function checkpoint() {
      if (match) return;
      if (winner !== null) session?.finish();
      else session?.save({ count, tokens, current, value, awaiting, movable, winner, message });
    }
    let controller = new AbortController();
    const board = document.createElement('div');
    board.className = 'ld-board ld-board-deluxe';
    const info = document.createElement('div');
    info.className = 'ld-players';
    const rollArea = document.createElement('div');
    rollArea.className = 'ld-dice';
    const status = document.createElement('p');
    status.className = 'ld-status';
    status.setAttribute('role', 'status');
    shell.stage.append(info, board, rollArea, status);
    shell.root.querySelector('.game-meta').textContent = match
      ? `Online room · you are Player ${seat(match)} · ${count} players`
      : `${count} players · roll to move your tokens`;

    function tokenButton(player, index) {
      const selected = player === current && movable.includes(index) && (!match || seat(match) === current + 1);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `ld-piece${selected ? ' ld-piece-ready' : ''}`;
      button.style.setProperty('--piece-color', COLORS[player]);
      button.textContent = index + 1;
      button.setAttribute('aria-label', `Player ${player + 1}, token ${index + 1}${selected ? ', move token' : ''}`);
      button.disabled = !selected;
      if (selected) button.addEventListener('click', () => {
        if (match) match.sendAction({ type: 'move', index });
        else move(index);
      });
      return button;
    }

    function render() {
      board.replaceChildren();
      const players = document.createDocumentFragment();
      for (let p = 0; p < 4; p++) {
        const yard = document.createElement('div');
        yard.className = `ld-home-yard ${p >= count ? 'ld-unused-yard' : ''}`;
        yard.style.setProperty('--piece-color', COLORS[p]);
        yard.style.gridArea = `${YARDS[p][0]} / ${YARDS[p][1]} / span 5 / span 5`;
        yard.innerHTML = `<span class="ld-yard-label">PLAYER ${p + 1}</span>`;
        if (p < count) {
          for (let t = 0; t < 4; t++) {
            if (tokens[p][t] === -1) yard.appendChild(tokenButton(p, t));
          }
        }
        players.appendChild(yard);
      }
      board.appendChild(players);
      const at = (row, col, klass, color) => {
        const cell = document.createElement('div');
        cell.className = `ld-square ${klass}`;
        cell.style.gridArea = `${row + 1} / ${col + 1}`;
        if (color) cell.style.setProperty('--piece-color', color);
        board.appendChild(cell);
        return cell;
      };
      TRACK.forEach(([row, col], position) => {
        const starter = position % 13 === 0 ? position / 13 : -1;
        const cell = at(row, col, `ld-track-square${SAFE.has(position) ? ' ld-safe-square' : ''}${starter >= 0 ? ' ld-start-square' : ''}`,
          starter >= 0 ? COLORS[starter] : '');
        if (SAFE.has(position)) cell.insertAdjacentHTML('afterbegin', '<span class="ld-star" aria-hidden="true">✦</span>');
        for (let p = 0; p < count; p++) {
          tokens[p].forEach((progress, t) => {
            if (progress >= 0 && progress <= 51 && (p * 13 + progress) % 52 === position)
              cell.appendChild(tokenButton(p, t));
          });
        }
      });
      LANES.forEach((lane, p) => lane.forEach(([row, col], i) => {
        const cell = at(row, col, 'ld-lane-square', COLORS[p]);
        if (p < count) tokens[p].forEach((progress, t) => {
          if (progress === 52 + i) cell.appendChild(tokenButton(p, t));
        });
      }));
      const center = at(7, 7, 'ld-finish-square');
      center.textContent = '★';
      for (let p = 0; p < count; p++) tokens[p].forEach((progress, t) => {
        if (progress === 58) center.appendChild(tokenButton(p, t));
      });
      info.replaceChildren();
      for (let p = 0; p < count; p++) {
        const item = document.createElement('div');
        item.className = `ld-player${p === current && winner === null ? ' active' : ''}`;
        item.style.setProperty('--piece-color', COLORS[p]);
        item.innerHTML = `<span class="ld-pnum">P${p + 1}</span><span class="ld-pfin">${tokens[p].filter((n) => n === 58).length}/4 home</span>`;
        info.appendChild(item);
      }
      rollArea.innerHTML = `<button class="ld-roll-btn" type="button" aria-label="Player ${current + 1}, roll dice" ${awaiting || rolling || winner !== null || (match && seat(match) !== current + 1) ? 'disabled' : ''}>${dieMarkup(value)}</button>`;
      rollArea.querySelector('button').addEventListener('click', () => {
        if (match) match.sendAction({ type: 'request-roll' });
        else roll();
      });
      status.textContent = winner === null
        ? message || (rolling ? 'Die in motion…' : awaiting ? `Player ${current + 1}: choose a glowing token` :
          match && seat(match) !== current + 1 ? `Waiting for Player ${current + 1} to roll` : `Player ${current + 1}: roll the die`)
        : `Player ${winner + 1} wins the table!`;
      status.style.color = COLORS[winner ?? current];
    }

    function move(index) {
      if (!awaiting || !movable.includes(index)) return;
      const old = tokens[current][index];
      const next = old === -1 ? 0 : old + value;
      tokens[current][index] = next;
      let captured = false;
      if (next < 52) {
        const absolute = (current * 13 + next) % 52;
        if (!SAFE.has(absolute)) {
          for (let p = 0; p < count; p++) if (p !== current) {
            tokens[p].forEach((progress, t) => {
              if (progress >= 0 && progress < 52 && (p * 13 + progress) % 52 === absolute) {
                tokens[p][t] = -1; captured = true;
              }
            });
          }
        }
      }
      if (tokens[current].every((n) => n === 58)) winner = current;
      message = captured ? `Player ${current + 1} captured a token! Roll again.` :
        next === 58 ? `Player ${current + 1} brought a token home!` : '';
      window.arcadeAudio?.[captured || next === 58 ? 'chime' : 'tap']();
      window.haptics?.[captured ? 'success' : 'select']();
      awaiting = false; movable = [];
      if (winner === null && value !== 6 && !captured) current = (current + 1) % count;
      render();
      checkpoint();
      if (queuedRoll !== null && winner === null) {
        const next = queuedRoll;
        queuedRoll = null;
        roll(next);
      }
    }

    async function roll(predeterminedValue = null) {
      if (rolling || awaiting || winner !== null ||
          (!match && rollArea.querySelector('button').disabled)) return;
      rolling = true;
      const result = await rollDie(rollArea.querySelector('button'), controller.signal, predeterminedValue);
      if (result === null) return;
      rolling = false;
      value = result;
      movable = legalMoves(tokens[current], value);
      awaiting = movable.length > 0;
      if (!awaiting) {
        message = `Player ${current + 1} rolled ${value} — no legal moves`;
        if (value !== 6) current = (current + 1) % count;
      } else message = '';
      render();
      checkpoint();
      if (movable.length === 1) {
        pendingMove = null;
        move(movable[0]);
        return;
      }
      if (pendingMove !== null) {
        const index = pendingMove;
        pendingMove = null;
        move(index);
      }
      if (queuedRoll !== null && !awaiting && winner === null) {
        const next = queuedRoll;
        queuedRoll = null;
        roll(next);
      }
    }

    function reset() {
      controller.abort(); controller = new AbortController();
      tokens.forEach((group) => group.fill(-1));
      current = 0; value = 1; awaiting = false; movable = []; winner = null; message = ''; rolling = false; pendingMove = null; queuedRoll = null;
      render();
      if (resume && movable.length === 1) move(movable[0]);
      checkpoint();
    }
    shell.getResetButton().addEventListener('click', () => {
      if (match) {
        if (match.role === 'host') match.sendAction({ type: 'reset' });
      } else reset();
    });
    if (match && match.role !== 'host') shell.getResetButton().disabled = true;
    const offRoom = match?.on((event) => {
      if (event.type !== 'action' || match.activeGame?.id !== game.id) return;
      if (event.action?.type === 'reset' && event.from === match.activeGame.playerIds[0]) reset();
      if (event.action?.type === 'request-roll' && match.role === 'host' &&
          event.from === match.activeGame.playerIds[current] && !rolling && !awaiting && winner === null)
        match.sendAction({ type: 'roll', value: 1 + Math.floor(Math.random() * 6) });
      if (event.action?.type === 'roll' && event.from === match.activeGame.playerIds[0] &&
          Number.isInteger(event.action.value) && event.action.value >= 1 && event.action.value <= 6 &&
          winner === null) {
        if (rolling || awaiting) queuedRoll = event.action.value;
        else roll(event.action.value);
      }
      if (event.action?.type === 'move' && event.from === match.activeGame.playerIds[current] &&
          Number.isInteger(event.action.index) && event.action.index >= 0 && event.action.index < 4) {
        if (rolling) pendingMove = event.action.index;
        else move(event.action.index);
      }
    });
    render();
    if (!resume) checkpoint();
    return { dispose: () => { controller.abort(); offRoom?.(); } };
  },
};
