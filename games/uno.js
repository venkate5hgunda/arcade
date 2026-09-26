import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { remoteMatch, seat } from '../js/remote-match.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { playerName } from '../js/player-names.js';
import { celebrate } from '../js/celebration.js';
import { chooseCardTable } from '../js/card-room-entry.js';
import { createTurnIndicator } from '../js/turn-indicator.js';

export const COLORS = ['red', 'yellow', 'green', 'blue'];
const INK = { red: '#e24458', yellow: '#eeb744', green: '#31a77d', blue: '#4385df', wild: '#272a4e' };
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
    direction: 1, drawnId: null, passes: 0, winner: null, turn: 1,
    challenge: null, unoPending: null, unoDeclared: null };
}

export function canPlayUno(state, card, player = state.current) {
  if (!card || state.winner !== null || state.challenge || player !== state.current ||
      (state.drawnId !== null && state.drawnId !== card.id)) return false;
  const hand = state.hands[player];
  if (!hand?.some(held => held.id === card.id)) return false;
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
export function actUno(state, action, random = Math.random, actor = state.current) {
  if (state.winner !== null || !action || typeof action !== 'object') return false;
  if (action.type === 'uno') {
    if (state.unoPending !== actor && (actor !== state.current ||
        state.hands[actor]?.length !== 2)) return false;
    if (state.unoPending === actor) state.unoPending = null;
    else state.unoDeclared = actor;
    return true;
  }
  if (action.type === 'catch') {
    if (state.unoPending === null || state.unoPending === actor ||
        actor !== state.current) return false;
    const current = state.current;
    state.current = state.unoPending;
    drawCards(state, 2, random);
    state.current = current;
    state.unoPending = null;
    return true;
  }
  if (actor !== state.current) return false;
  if (state.challenge) {
    if (action.type !== 'accept' && action.type !== 'challenge') return false;
    const { offender, illegal } = state.challenge;
    state.challenge = null;
    state.unoPending = null;
    if (action.type === 'challenge' && illegal) {
      const current = state.current;
      state.current = offender;
      drawCards(state, 4, random);
      state.current = current;
    } else {
      drawCards(state, action.type === 'challenge' ? 6 : 4, random);
      next(state);
    }
    if (!state.hands[offender].length) state.winner = offender;
    return true;
  }
  const hand = state.hands[state.current];
  if (action.type === 'play') {
    const card = hand.find(held => held.id === action.id);
    if (!canPlayUno(state, card) ||
        (card.color === 'wild' ? !COLORS.includes(action.color) : action.color !== undefined)) return false;
    const illegalDrawFour = card.value === 'wild4' &&
      hand.some(held => held.color === state.color);
    const declared = state.unoDeclared === state.current;
    const offender = state.current;
    if (state.unoPending !== null) state.unoPending = null;
    hand.splice(hand.indexOf(card), 1);
    state.discard.push(card);
    state.color = card.color === 'wild' ? action.color : card.color;
    state.passes = 0;
    state.unoDeclared = null;
    if (hand.length === 1 && !declared) state.unoPending = offender;
    if (card.value === 'wild4') {
      next(state);
      state.challenge = { offender, illegal: illegalDrawFour };
      return true;
    }
    if (!hand.length) { state.winner = offender; state.drawnId = null; return true; }
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
    state.unoPending = null;
    drawCards(state, 1, random);
    state.drawnId = hand.at(-1).id;
    if (hand.length > 2) state.unoDeclared = null;
    state.passes = 0;
    return true;
  }
  if (action.type === 'pass') {
    if (state.drawnId === null && (state.stock.length || state.discard.length > 1 ||
        hand.some(card => canPlayUno(state, card)))) return false;
    state.unoPending = null;
    state.unoDeclared = null;
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
    playerIds.includes(from) &&
    actUno(state, request.move, Math.random, playerIds.indexOf(from));
}

export function validUnoCheckpoint(s, allowFinished = false) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.hands) ||
      s.hands.length < 2 || s.hands.length > 4 || s.hands.some((hand, index) =>
        !Array.isArray(hand) || !hand.length && s.challenge?.offender !== index &&
          !(allowFinished && s.winner === index)) ||
      !Array.isArray(s.stock) || !Array.isArray(s.discard) || !s.discard.length ||
      !COLORS.includes(s.color) || !Number.isInteger(s.current) || s.current < 0 || s.current >= s.hands.length ||
      ![-1, 1].includes(s.direction) ||
      !(s.winner === null || allowFinished && Number.isInteger(s.winner) &&
        s.winner >= -1 && s.winner < s.hands.length) ||
      !Number.isInteger(s.turn) || s.turn < 1 || !Number.isInteger(s.passes) ||
      s.passes < 0 || s.passes >= s.hands.length ||
      (s.discard.at(-1)?.color !== 'wild' && s.color !== s.discard.at(-1)?.color) ||
      !(s.challenge == null || Number.isInteger(s.challenge.offender) &&
        s.challenge.offender >= 0 && s.challenge.offender < s.hands.length &&
        s.challenge.offender !== s.current && typeof s.challenge.illegal === 'boolean') ||
      !(s.unoPending == null || Number.isInteger(s.unoPending) &&
        s.unoPending >= 0 && s.unoPending < s.hands.length &&
        s.hands[s.unoPending].length === 1) ||
      !(s.unoDeclared == null || Number.isInteger(s.unoDeclared) &&
        s.unoDeclared === s.current && s.hands[s.unoDeclared].length === 2) ||
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
    canPass: !state.challenge && player === state.current && (state.drawnId !== null ||
      !(state.stock.length || state.discard.length > 1) &&
      !state.hands[state.current].some(card => canPlayUno(state, card))),
    challenge: !!state.challenge, unoPending: state.unoPending,
    unoDeclared: state.unoDeclared === player,
    turn: state.turn, winner: state.winner };
}

function cardNode(card, onClick, playable = false) {
  const node = document.createElement(onClick ? 'button' : 'div');
  node.className = 'cg-card uno-card' + (onClick ? ' cg-card--button' : '') +
    (card ? ` uno-card--${card.color}` : ' cg-card--back');
  if (card) {
    node.style.setProperty('--uno-color', INK[card.color]);
    const label = LABEL[card.value] || card.value;
    const corner = document.createElement('span');
    corner.className = 'uno-card-corner';
    corner.textContent = label;
    const face = document.createElement('span');
    face.className = 'uno-card-face';
    const symbol = document.createElement('span');
    symbol.className = 'uno-card-symbol';
    symbol.textContent = label;
    face.append(symbol);
    const echo = document.createElement('span');
    echo.className = 'uno-card-corner uno-card-corner--bottom';
    echo.textContent = label;
    node.append(corner, face, echo);
    node.setAttribute('aria-label', `${card.color} ${card.value}${onClick ? playable ? ', play' : ', cannot play' : ''}`);
  } else {
    node.innerHTML = '<span class="uno-card-back-mark" aria-hidden="true">✦</span>';
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
    const showTurn = createTurnIndicator(shell.root, room);
    const restored = !room && validUnoCheckpoint(session?.state) ? session.state : null;
    if (!room && !restored && !await chooseCardTable(shell.stage, multiplayer, game))
      return { dispose: () => shell.root.remove() };
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
    const roomSave = room?.role === 'host' ? room.savedGame : null;
    if (roomSave && (!validUnoCheckpoint(roomSave.state, true) ||
        roomSave.state.hands.length !== count ||
        !Number.isSafeInteger(roomSave.round) || roomSave.round < 0))
      throw new Error('Saved UNO room state is invalid.');
    shell.root.querySelector('.game-meta').textContent = room
      ? `Private room · Player ${mySeat + 1} · ${count} players`
      : `${count} players · local pass & play`;
    let state = room ? room.role === 'host' ? roomSave ?
      structuredClone(roomSave.state) : newUnoGame(count) : null :
      restored ? { ...restored, challenge: restored.challenge ?? null,
        unoPending: restored.unoPending ?? null, unoDeclared: restored.unoDeclared ?? null } : newUnoGame(count);
    let view = room ? room.role === 'host' ? unoView(state, mySeat) : null : null;
    let covered = !room && state.winner === null;
    let pending = null, disposed = false, revision = 0, lastRevision = -1,
      gameRound = roomSave?.round ?? 0;
    const deckById = unoDeck();
    const table = document.createElement('div');
    table.className = 'cg-table uno-table';
    shell.stage.appendChild(table);
    function feedback() {
      const audio = window.arcadeAudio;
      if (audio) void audio.prepare().then(() => audio.tap()).catch(error =>
        console.warn('Card sound unavailable:', error));
      window.haptics?.select();
    }
    function checkpoint() {
      if (room) return;
      if (state.winner !== null) session?.finish();
      else session?.save(state);
    }
    function announceResult(winner, record = false) {
      if (record && room?.role === 'host')
        room.recordResult(game.id, winner === -1 ? null : winner, gameRound);
      if (winner >= 0 && (!room || winner === mySeat))
        celebrate(shell.root, `${playerName(winner, room)} wins UNO!`);
    }
    function publish() {
      if (!room || room.role !== 'host') return;
      room.saveGame(game.id, { state, round: gameRound });
      revision++;
      view = unoView(state, mySeat);
      for (let i = 1; i < count; i++)
        if (room.members.some(member => member.id === room.activeGame.playerIds[i] && member.connected))
          room.sendPrivateAction(room.activeGame.playerIds[i], { type: 'uno-state', revision, view: unoView(state, i) });
    }
    function request(action, actor = state?.current) {
      if (room) room.sendAction({ type: 'uno-request',
        revision: room.role === 'host' ? revision : lastRevision, move: action });
      else {
        const previousWinner = state.winner;
        if (actUno(state, action, Math.random, actor)) {
          feedback();
          if (previousWinner === null && state.winner !== null) announceResult(state.winner);
          pending = null;
          covered = state.winner === null && (covered || state.current !== previous);
          checkpoint();
          render();
        }
      }
    }
    let previous = state?.current ?? 0;
    function move(action, actor) {
      if (!room) previous = state.current;
      request(action, actor);
    }
    const offRoom = room?.on(event => {
      if (disposed || room.activeGame?.id !== game.id) return;
      if (event.type === 'reconnected' && room.role === 'guest') {
        room.sendAction({ type: 'uno-sync' }); return;
      }
      if (event.type !== 'action') return;
      if (room.role === 'host') {
        if (event.action?.type === 'uno-sync') {
          const index = room.activeGame.playerIds.indexOf(event.from);
          if (index > 0) room.sendPrivateAction(event.from,
            { type: 'uno-state', revision, view: unoView(state, index) });
        } else if (event.action?.type === 'uno-request') {
          const previousWinner = state.winner;
          if (applyRemoteUnoAction(state, event.action, revision, event.from,
            room.activeGame.playerIds)) {
            feedback();
            if (previousWinner === null && state.winner !== null) announceResult(state.winner, true);
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
          gameRound++;
          shell.root.querySelector('.arcade-victory')?.remove();
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
            typeof incoming.challenge !== 'boolean' ||
            !(incoming.unoPending === null || Number.isInteger(incoming.unoPending) &&
              incoming.unoPending >= 0 && incoming.unoPending < count &&
              incoming.counts[incoming.unoPending] === 1) ||
            typeof incoming.unoDeclared !== 'boolean' ||
            !(incoming.drawnId === null || Number.isInteger(incoming.drawnId) &&
              incoming.hand.some(card => card?.id === incoming.drawnId)) ||
            incoming.hand.some(card => !Number.isInteger(card?.id) ||
              card.color !== deckById[card.id]?.color ||
              card.value !== deckById[card.id]?.value) ||
            new Set(incoming.hand.map(card => card.id)).size !== incoming.hand.length) {
          console.warn('Invalid UNO room state received.');
          return;
        }
        lastRevision = event.action.revision;
        const previousWinner = view?.winner;
        view = incoming;
        if (previousWinner !== undefined && incoming.turn !== undefined) feedback();
        if (previousWinner === null && incoming.winner !== null) announceResult(incoming.winner);
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
      const eyebrow = document.createElement('span');
      eyebrow.className = 'cg-eyebrow';
      eyebrow.textContent = room ? 'PRIVATE ROOM • LIVE TABLE' : 'LOCAL TABLE • PASS & PLAY';
      const label = document.createElement('strong');
      label.textContent = 'CHROMATIC · UNO-inspired';
      heading.append(eyebrow, label);
      table.append(heading);
      if (!view && room) {
        showTurn(null);
        const waiting = document.createElement('p');
        waiting.className = 'cg-message';
        waiting.textContent = 'Waiting for the host to deal…';
        table.append(waiting);
        return;
      }
      const data = room ? view : unoView(state, state.current);
      showTurn(data.current, data.winner === null && (!covered || !!room));
      if (covered) {
        const curtain = document.createElement('div');
        curtain.className = 'ce-curtain uno-curtain';
        const title = document.createElement('h3');
        title.textContent = `Pass to ${playerName(data.current)}`;
        curtain.append(title);
        if (data.unoPending !== null && data.unoPending !== data.current) {
          const reminder = document.createElement('p');
          reminder.className = 'ce-curtain-instructions';
          reminder.textContent = `${playerName(data.unoPending)}: one card left! Call UNO before handing over, or risk a +2 catch.`;
          curtain.append(reminder, button(`I'm ${playerName(data.unoPending)} · call UNO!`, () =>
            move({ type: 'uno' }, data.unoPending)));
        }
        curtain.append(button(`I'm ${playerName(data.current)} · show hand`, () => {
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
        const name = document.createElement('strong');
        name.textContent = playerName(i, room);
        const count = document.createElement('small');
        count.textContent = `${cards} ${cards === 1 ? 'card' : 'cards'}`;
        tag.append(name, count);
        if (i === data.current) tag.setAttribute('aria-current', 'true');
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
      active.style.setProperty('--active-color', INK[data.color]);
      middle.append(piles, active);
      table.append(middle);
      const status = document.createElement('p');
      status.className = 'cg-message';
      status.setAttribute('role', 'status');
      status.textContent = data.winner !== null
        ? data.winner === -1 ? 'Blocked game — tie!' : `${playerName(data.winner, room)} wins!`
        : room && data.current !== mySeat ? `Waiting for ${playerName(data.current, room)}`
          : data.challenge ? 'Wild +4: accept the draw or challenge the previous player.'
            : pending !== null ? 'Choose a color for your wild card.'
            : data.unoPending !== null ? `${playerName(data.unoPending, room)} is down to one card — call or catch UNO!`
            : data.drawnId !== null ? 'Play the drawn card or pass.' : 'Match color or value, or draw one.';
      table.append(status);
      const hand = document.createElement('section');
      hand.className = 'uno-hand';
      const title = document.createElement('h3');
      title.textContent = `${playerName(room ? mySeat : data.current, room)} · your hand`;
      const row = document.createElement('div');
      row.className = 'cg-card-row';
      const canAct = data.winner === null && (!room || data.current === mySeat);
      const visibleHand = room ? data.hand : state.hands[state.current];
      const legal = card => canAct && pending === null && (room
        ? (data.drawnId === null || data.drawnId === card.id) &&
          (card.color === 'wild' || card.color === data.color || card.value === data.top.value) &&
          !data.challenge
        : canPlayUno(state, card));
      visibleHand.forEach(card => row.append(cardNode(card, () => play(card), legal(card))));
      hand.append(title, row);
      table.append(hand);
      const actions = document.createElement('div');
      actions.className = 'cg-actions';
      if (data.winner === null && data.unoPending !== null &&
          data.unoPending === (room ? mySeat : data.current))
        actions.append(button('Call UNO! ✦', () => move({ type: 'uno' })));
      if (canAct && data.unoPending !== null && data.unoPending !== (room ? mySeat : data.current))
        actions.append(button('Catch missed UNO · +2', () => move({ type: 'catch' }), true));
      if (canAct) {
        if (data.challenge) {
          actions.append(button('Take 4 · continue', () => move({ type: 'accept' })));
          actions.append(button('Challenge +4', () => move({ type: 'challenge' }), true));
        } else if (pending !== null) {
          COLORS.forEach(color => {
            const choice = button(color, () => move({ type: 'play', id: pending, color }));
            choice.classList.add('uno-color-choice');
            choice.style.setProperty('--uno-color', INK[color]);
            actions.append(choice);
          });
          actions.append(button('Cancel', () => { pending = null; render(); }, true));
        } else {
          if (visibleHand.length === 2 && !data.unoDeclared)
            actions.append(button('Call UNO! ✦', () => move({ type: 'uno' }), true));
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
      rules.textContent = 'Draw one, then play only that card or pass. Call UNO at one card or risk a +2 catch. Challenge a +4 bluff: the player draws 4 if caught, otherwise the challenger draws 6. No stacking.';
      table.append(rules);
    }
    function reset() {
      if (room) {
        if (room.role === 'host') room.sendAction({ type: 'uno-reset' });
      } else {
        state = newUnoGame(count);
        gameRound++;
        shell.root.querySelector('.arcade-victory')?.remove();
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
