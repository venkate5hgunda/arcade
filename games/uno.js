import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { remoteMatch, seat } from '../js/remote-match.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

export const COLORS = ['red', 'yellow', 'green', 'blue'];
const INK = { red: '#cd343c', yellow: '#b87a08', green: '#238354', blue: '#3278c6', wild: '#292b45' };
const LABEL = { skip: '⊘', reverse: '↶', draw2: '+2', wild: '★', wild4: '+4' };

export function unoDeck() {
  const cards = [];
  for (const color of COLORS) {
    cards.push({ id: cards.length, color, value: '0' });
    for (const value of [...Array.from({ length: 9 }, (_, i) => String(i + 1)), 'skip', 'reverse', 'draw2'])
      for (let i = 0; i < 2; i++) cards.push({ id: cards.length, color, value });
  }
  for (const value of ['wild', 'wild4']) for (let i = 0; i < 4; i++)
    cards.push({ id: cards.length, color: 'wild', value });
  return cards;
}

export function shuffle(cards, random = Math.random) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function newUnoGame(count, random = Math.random) {
  if (!Number.isInteger(count) || count < 2 || count > 4) throw new RangeError('UNO needs 2–4 players.');
  const stock = shuffle(unoDeck(), random);
  const hands = Array.from({ length: count }, () => []);
  for (let n = 0; n < 7; n++) for (const hand of hands) hand.push(stock.pop());
  const first = stock.findLastIndex(card => /^[0-9]$/.test(card.value));
  const discard = [stock.splice(first, 1)[0]];
  return { stock, discard, hands, color: discard[0].color, current: 0,
    direction: 1, drawnId: null, passes: 0, winner: null, turn: 1 };
}

export function canPlayUno(state, card, player = state.current) {
  if (!card || state.winner !== null || player !== state.current ||
      (state.drawnId !== null && state.drawnId !== card.id)) return false;
  const hand = state.hands[player];
  if (!hand?.some(held => held.id === card.id)) return false;
  if (card.value === 'wild4') return !hand.some(held => held.color === state.color);
  return card.color === 'wild' || card.color === state.color ||
    card.value === state.discard.at(-1).value;
}

function next(state, steps = 1) {
  const count = state.hands.length;
  state.current = (state.current + state.direction * steps % count + count) % count;
  state.drawnId = null;
  state.turn++;
}

export function recycleUno(state, random = Math.random) {
  if (state.stock.length || state.discard.length < 2) return;
  state.stock = shuffle(state.discard.slice(0, -1), random);
  state.discard = [state.discard.at(-1)];
}

function drawCards(state, count, random) {
  let received = 0;
  for (let i = 0; i < count; i++) {
    recycleUno(state, random);
    if (!state.stock.length) break;
    state.hands[state.current].push(state.stock.pop());
    received++;
  }
  return received;
}

// Returns false without mutating state for every invalid action.
export function actUno(state, action, random = Math.random) {
  if (state.winner !== null || !action || typeof action !== 'object') return false;
  const hand = state.hands[state.current];
  if (action.type === 'play') {
    const card = hand.find(held => held.id === action.id);
    if (!canPlayUno(state, card) ||
        (card.color === 'wild' ? !COLORS.includes(action.color) : action.color !== undefined)) return false;
    hand.splice(hand.indexOf(card), 1);
    state.discard.push(card);
    state.color = card.color === 'wild' ? action.color : card.color;
    state.passes = 0;
    if (!hand.length) { state.winner = state.current; state.drawnId = null; return true; }
    if (card.value === 'reverse') {
      state.direction *= -1;
      next(state, state.hands.length === 2 ? 2 : 1);
    } else if (card.value === 'skip') next(state, 2);
    else if (card.value === 'draw2' || card.value === 'wild4') {
      next(state);
      drawCards(state, card.value === 'draw2' ? 2 : 4, random);
      next(state);
    } else next(state);
    return true;
  }
  if (action.type === 'draw') {
    if (state.drawnId !== null || !(state.stock.length || state.discard.length > 1)) return false;
    drawCards(state, 1, random);
    state.drawnId = hand.at(-1).id;
    state.passes = 0;
    return true;
  }
  if (action.type === 'pass') {
    if (state.drawnId === null && (state.stock.length || state.discard.length > 1 ||
        hand.some(card => canPlayUno(state, card)))) return false;
    state.passes = state.drawnId === null ? state.passes + 1 : 0;
    if (state.passes >= state.hands.length) {
      const fewest = Math.min(...state.hands.map(cards => cards.length));
      const leaders = state.hands.flatMap((cards, i) => cards.length === fewest ? [i] : []);
      state.winner = leaders.length === 1 ? leaders[0] : -1;
      state.drawnId = null;
    } else next(state);
    return true;
  }
  return false;
}

export function applyRemoteUnoAction(state, request, revision, from, playerIds) {
  return request?.type === 'uno-request' && request.revision === revision &&
    playerIds[state.current] === from && actUno(state, request.move);
}

export function validUnoCheckpoint(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.hands) ||
      s.hands.length < 2 || s.hands.length > 4 || s.hands.some(hand => !Array.isArray(hand) || !hand.length) ||
      !Array.isArray(s.stock) || !Array.isArray(s.discard) || !s.discard.length ||
      !COLORS.includes(s.color) || !Number.isInteger(s.current) || s.current < 0 || s.current >= s.hands.length ||
      ![-1, 1].includes(s.direction) || s.winner !== null ||
      !Number.isInteger(s.turn) || s.turn < 1 || !Number.isInteger(s.passes) ||
      s.passes < 0 || s.passes >= s.hands.length ||
      (s.discard.at(-1)?.color !== 'wild' && s.color !== s.discard.at(-1)?.color) ||
      !(s.drawnId === null || Number.isInteger(s.drawnId) &&
        s.hands[s.current].some(card => card?.id === s.drawnId))) return false;
  const cards = [...s.stock, ...s.discard, ...s.hands.flat()];
  const reference = unoDeck();
  return cards.length === reference.length &&
    cards.every(card => card && Number.isInteger(card.id) && card.id >= 0 &&
      card.id < reference.length && card.color === reference[card.id].color &&
      card.value === reference[card.id].value) &&
    new Set(cards.map(card => card.id)).size === reference.length;
}

export function unoView(state, player) {
  return { hand: state.hands[player].map(card => ({ ...card })),
    counts: state.hands.map(hand => hand.length), top: { ...state.discard.at(-1) },
    color: state.color, current: state.current, direction: state.direction,
    drawnId: player === state.current ? state.drawnId : null,
    stockCount: state.stock.length, canDraw: !!(state.stock.length || state.discard.length > 1),
    canPass: player === state.current && (state.drawnId !== null ||
      !(state.stock.length || state.discard.length > 1) &&
      !state.hands[state.current].some(card => canPlayUno(state, card))),
    turn: state.turn, winner: state.winner };
}

function cardNode(card, onClick, playable = false) {
  const node = document.createElement(onClick ? 'button' : 'div');
  node.className = 'cg-card uno-card' + (onClick ? ' cg-card--button' : '') +
    (card ? '' : ' cg-card--back');
  if (card) {
    node.style.setProperty('--uno-color', INK[card.color]);
    node.textContent = LABEL[card.value] || card.value;
    node.setAttribute('aria-label', `${card.color} ${card.value}${onClick ? playable ? ', play' : ', cannot play' : ''}`);
  } else {
    node.textContent = '★';
    node.setAttribute('aria-label', 'Face-down card');
  }
  if (onClick) {
    node.type = 'button';
    node.disabled = !playable;
    node.addEventListener('click', onClick);
  }
  return node;
}

function button(text, handler, quiet = false) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `cg-button${quiet ? ' cg-button--quiet' : ''}`;
  node.textContent = text;
  node.addEventListener('click', handler);
  return node;
}

export default {
  async render(el, game, { navigate, session, multiplayer } = {}) {
    const shell = createShell(el, game, { title: 'UNO-inspired', meta: 'Match colors · empty your hand', resetLabel: 'New game' });
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('uno-vibe');
    const room = remoteMatch(multiplayer, game.id);
    const restored = !room && validUnoCheckpoint(session?.state) ? session.state : null;
    const saved = loadJSON(KEYS.SETTINGS + ':uno', { count: '2' });
    const settings = room ? { count: String(room.activeGame.playerIds.length) } :
      restored ? { count: String(restored.hands.length) } : await renderSetup(shell.stage, {
        title: '🌈 UNO-inspired', subtitle: 'Choose your table.',
        fields: [{ key: 'count', label: 'Players', default: saved.count,
          options: [2, 3, 4].map(count => ({ value: String(count), label: `${count} Players` })) }],
        startLabel: 'Deal cards',
      });
    if (!room) saveJSON(KEYS.SETTINGS + ':uno', settings);
    const count = Number(settings.count);
    const mySeat = room ? seat(room) - 1 : null;
    shell.root.querySelector('.game-meta').textContent = room
      ? `Private room · Player ${mySeat + 1} · ${count} players`
      : `${count} players · pass & play`;
    let state = room ? room.role === 'host' ? newUnoGame(count) : null :
      restored || newUnoGame(count);
    let view = room ? room.role === 'host' ? unoView(state, mySeat) : null : null;
    let covered = !room && state.winner === null;
    let pending = null, disposed = false, revision = 0, lastRevision = -1;
    const deckById = unoDeck();
    const table = document.createElement('div');
    table.className = 'cg-table uno-table';
    shell.stage.appendChild(table);
    function checkpoint() {
      if (room) return;
      if (state.winner !== null) session?.finish();
      else session?.save(state);
    }
    function publish() {
      if (!room || room.role !== 'host') return;
      revision++;
      view = unoView(state, mySeat);
      for (let i = 1; i < count; i++)
        room.sendPrivateAction(room.activeGame.playerIds[i], { type: 'uno-state', revision, view: unoView(state, i) });
    }
    function request(action) {
      if (room) room.sendAction({ type: 'uno-request',
        revision: room.role === 'host' ? revision : lastRevision, move: action });
      else {
        if (actUno(state, action)) {
          pending = null;
          covered = state.winner === null && state.current !== previous;
          checkpoint();
          render();
        }
      }
    }
    let previous = state?.current ?? 0;
    function move(action) {
      if (!room) previous = state.current;
      request(action);
    }
    const offRoom = room?.on(event => {
      if (disposed || event.type !== 'action' || room.activeGame?.id !== game.id) return;
      if (room.role === 'host') {
        if (event.action?.type === 'uno-sync') {
          const index = room.activeGame.playerIds.indexOf(event.from);
          if (index > 0) room.sendPrivateAction(event.from,
            { type: 'uno-state', revision, view: unoView(state, index) });
        } else if (event.action?.type === 'uno-request') {
          if (applyRemoteUnoAction(state, event.action, revision, event.from,
            room.activeGame.playerIds)) {
            pending = null;
            publish();
            render();
          } else {
            const index = room.activeGame.playerIds.indexOf(event.from);
            if (index > 0) room.sendPrivateAction(event.from,
              { type: 'uno-state', revision, view: unoView(state, index) });
          }
        } else if (event.action?.type === 'uno-reset' &&
            event.from === room.peerId) {
          state = newUnoGame(count);
          pending = null;
          publish();
          render();
        }
      } else if (event.from === room.activeGame.playerIds[0] &&
          event.action?.type === 'uno-state' &&
          Number.isSafeInteger(event.action.revision) &&
          event.action.revision >= lastRevision) {
        const incoming = event.action.view;
        if (!incoming || !Array.isArray(incoming.hand) || !Array.isArray(incoming.counts) ||
            incoming.counts.length !== count || incoming.counts[mySeat] !== incoming.hand.length ||
            !incoming.counts.every(n => Number.isInteger(n) && n >= 0 && n <= 108) ||
            !Number.isInteger(incoming.current) || incoming.current < 0 || incoming.current >= count ||
            !COLORS.includes(incoming.color) || !incoming.top ||
            !Number.isInteger(incoming.top.id) ||
            incoming.top.color !== deckById[incoming.top.id]?.color ||
            incoming.top.value !== deckById[incoming.top.id]?.value ||
            !Number.isInteger(incoming.stockCount) || incoming.stockCount < 0 ||
            incoming.stockCount > 108 || !Number.isInteger(incoming.turn) || incoming.turn < 1 ||
            ![-1, 1].includes(incoming.direction) ||
            ![null, -1, ...Array.from({ length: count }, (_, i) => i)].includes(incoming.winner) ||
            typeof incoming.canDraw !== 'boolean' || typeof incoming.canPass !== 'boolean' ||
            !(incoming.drawnId === null || Number.isInteger(incoming.drawnId) &&
              incoming.hand.some(card => card?.id === incoming.drawnId)) ||
            incoming.hand.some(card => !Number.isInteger(card?.id) ||
              card.color !== deckById[card.id]?.color ||
              card.value !== deckById[card.id]?.value) ||
            new Set(incoming.hand.map(card => card.id)).size !== incoming.hand.length) return;
        lastRevision = event.action.revision;
        view = incoming;
        pending = null;
        render();
      }
    });
    function play(card) {
      if (card.color === 'wild') { pending = card.id; render(); }
      else move({ type: 'play', id: card.id });
    }
    function render() {
      table.replaceChildren();
      const heading = document.createElement('header');
      heading.className = 'cg-table-heading';
      const label = document.createElement('strong');
      label.textContent = 'UNO-inspired 🌈';
      heading.append(label);
      table.append(heading);
      if (!view && room) {
        const waiting = document.createElement('p');
        waiting.className = 'cg-message';
        waiting.textContent = 'Waiting for the host to deal…';
        table.append(waiting);
        return;
      }
      const data = room ? view : unoView(state, state.current);
      if (covered) {
        const curtain = document.createElement('div');
        curtain.className = 'ce-curtain uno-curtain';
        const title = document.createElement('h3');
        title.textContent = `Pass to Player ${data.current + 1}`;
        curtain.append(title, button(`I'm Player ${data.current + 1} · show hand`, () => {
          covered = false; render();
        }));
        const note = document.createElement('p');
        note.className = 'cg-rules';
        note.textContent = 'Other players, look away. Cards remain hidden until ready.';
        curtain.append(note);
        table.append(curtain);
        return;
      }
      const players = document.createElement('div');
      players.className = 'uno-players';
      data.counts.forEach((cards, i) => {
        const tag = document.createElement('span');
        tag.className = `uno-player${i === data.current ? ' uno-player--current' : ''}`;
        tag.textContent = `P${i + 1} · ${cards} cards${i === data.current ? ' ←' : ''}`;
        players.append(tag);
      });
      table.append(players);
      const middle = document.createElement('div');
      middle.className = 'uno-middle';
      const piles = document.createElement('div');
      piles.className = 'uno-pile';
      piles.append(cardNode(null), cardNode(data.top));
      const active = document.createElement('p');
      active.className = 'cg-message';
      active.textContent = `${data.color.toUpperCase()} · ${data.direction === 1 ? '↻' : '↺'} · Turn ${data.turn} · ${data.stockCount} to draw`;
      middle.append(piles, active);
      table.append(middle);
      const status = document.createElement('p');
      status.className = 'cg-message';
      status.setAttribute('role', 'status');
      status.textContent = data.winner !== null
        ? data.winner === -1 ? 'Blocked game — tie!' : `Player ${data.winner + 1} wins!`
        : room && data.current !== mySeat ? `Waiting for Player ${data.current + 1}`
          : pending !== null ? 'Choose a color for your wild card.'
            : data.drawnId !== null ? 'Play the drawn card or pass.' : 'Match color or value, or draw one.';
      table.append(status);
      const hand = document.createElement('section');
      hand.className = 'uno-hand';
      const title = document.createElement('h3');
      title.textContent = `Player ${room ? mySeat + 1 : data.current + 1} · your hand`;
      const row = document.createElement('div');
      row.className = 'cg-card-row';
      const canAct = data.winner === null && (!room || data.current === mySeat);
      const visibleHand = room ? data.hand : state.hands[state.current];
      const legal = card => canAct && pending === null && (room
        ? (data.drawnId === null || data.drawnId === card.id) &&
          (card.value === 'wild4' ? !visibleHand.some(held => held.color === data.color) :
            card.color === 'wild' || card.color === data.color || card.value === data.top.value)
        : canPlayUno(state, card));
      visibleHand.forEach(card => row.append(cardNode(card, () => play(card), legal(card))));
      hand.append(title, row);
      table.append(hand);
      const actions = document.createElement('div');
      actions.className = 'cg-actions';
      if (canAct) {
        if (pending !== null) {
          COLORS.forEach(color => actions.append(button(color, () => move({ type: 'play', id: pending, color }))));
          actions.append(button('Cancel', () => { pending = null; render(); }, true));
        } else {
          if (data.drawnId === null && data.canDraw)
            actions.append(button('Draw one +', () => move({ type: 'draw' })));
          if (data.canPass)
            actions.append(button('Pass turn →', () => move({ type: 'pass' }), true));
        }
      }
      if (data.winner !== null && (!room || room.role === 'host'))
        actions.append(button('Play again ↗', reset));
      table.append(actions);
      const rules = document.createElement('p');
      rules.className = 'cg-rules';
      rules.textContent = 'Draw one, then play only that card or pass. +2/+4 make the next player draw and lose a turn. +4 requires no card of the active color. No stacking.';
      table.append(rules);
    }
    function reset() {
      if (room) {
        if (room.role === 'host') room.sendAction({ type: 'uno-reset' });
      } else {
        state = newUnoGame(count);
        pending = null;
        covered = true;
        checkpoint();
        render();
      }
    }
    shell.getResetButton().addEventListener('click', reset);
    if (room && room.role !== 'host') shell.getResetButton().disabled = true;
    if (room) {
      if (room.role === 'host') publish();
      else room.sendAction({ type: 'uno-sync' });
    } else checkpoint();
    render();
    return { dispose: () => { disposed = true; offRoom?.(); shell.root.remove(); } };
  },
};
