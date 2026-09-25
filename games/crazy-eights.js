import { createShell, wireBack } from '../js/game-shell.js';
import { playerName } from '../js/player-names.js';
import { celebrate } from '../js/celebration.js';
import { remoteMatch, seat } from '../js/remote-match.js';
import { chooseCardTable } from '../js/card-room-entry.js';
import { createTurnIndicator } from '../js/turn-indicator.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function shuffledDeck(random = Math.random) {
  const cards = SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function canPlay(card, top, activeSuit) {
  return card.rank === '8' || card.rank === top.rank || card.suit === activeSuit;
}

export function penalty(cards) {
  return cards.reduce((sum, card) => sum + (card.rank === '8' ? 50 :
    ['J', 'Q', 'K'].includes(card.rank) ? 10 : card.rank === 'A' ? 1 : Number(card.rank)), 0);
}

export function validCrazyEightsCheckpoint(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.stock) || !Array.isArray(s.discard) ||
      s.discard.length < 1 || !Array.isArray(s.hands) || s.hands.length !== 2 ||
      s.hands.some((hand) => !Array.isArray(hand) || !hand.length) ||
      !SUITS.includes(s.activeSuit) || !Number.isInteger(s.current) || s.current < 0 || s.current > 1 ||
      !['handoff', 'play', 'choose'].includes(s.phase) || typeof s.drawn !== 'boolean' ||
      !Number.isInteger(s.passes) || s.passes < 0 || s.passes > 1 ||
      !Number.isSafeInteger(s.turn) || s.turn < 1 || s.winner !== null ||
      typeof s.ending !== 'string' || s.ending !== '' ||
      !(s.pendingEight === null || (Number.isInteger(s.pendingEight) &&
        s.pendingEight >= 0 && s.pendingEight < s.hands[s.current].length)) ||
      (s.phase === 'choose') !== (s.pendingEight !== null) ||
      s.phase === 'choose' && s.hands[s.current][s.pendingEight].rank !== '8' ||
      s.phase === 'handoff' && s.drawn) return false;
  const cards = [...s.stock, ...s.discard, ...s.hands[0], ...s.hands[1]];
  return cards.length === 52 && cards.every((card) => card && typeof card === 'object' &&
    SUITS.includes(card.suit) && RANKS.includes(card.rank)) &&
    new Set(cards.map((card) => `${card.suit}:${card.rank}`)).size === 52;
}

export function newCrazyEightsGame(random = Math.random) {
  const stock = shuffledDeck(random);
  const hands = [[], []];
  for (let i = 0; i < 7; i++) for (const hand of hands) hand.push(stock.pop());
  const starterIndex = stock.findLastIndex(card => card.rank !== '8');
  const discard = [stock.splice(starterIndex, 1)[0]];
  return { stock, discard, hands, activeSuit: discard[0].suit, current: 0,
    phase: 'play', drawn: false, passes: 0, pendingEight: null, winner: null,
    ending: '', turn: 1 };
}

function shuffle(cards, random) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function replenish(state, random) {
  if (state.stock.length || state.discard.length <= 1) return;
  state.stock = shuffle(state.discard.slice(0, -1), random);
  state.discard = [state.discard.at(-1)];
}

export function actCrazyEights(state, action, random = Math.random) {
  if (!state || !action || typeof action !== 'object' || state.phase === 'over' ||
      state.phase === 'handoff') return false;
  const expected = { play: ['type', 'id'], draw: ['type'], pass: ['type'],
    choose: ['type', 'suit'] }[action.type];
  if (!expected || Object.keys(action).length !== expected.length ||
      !expected.every(key => Object.hasOwn(action, key))) return false;
  const hand = state.hands[state.current];
  if (action.type === 'choose') {
    if (state.phase !== 'choose' || state.pendingEight === null ||
        !SUITS.includes(action.suit) || action.id !== undefined) return false;
    const card = hand.splice(state.pendingEight, 1)[0];
    state.discard.push(card);
    state.activeSuit = action.suit;
    state.pendingEight = null;
    state.passes = 0;
  } else if (action.type === 'play') {
    if (state.phase !== 'play' || typeof action.id !== 'string' ||
        action.suit !== undefined) return false;
    const index = hand.findIndex(card => `${card.suit}:${card.rank}` === action.id);
    if (index < 0 || !canPlay(hand[index], state.discard.at(-1), state.activeSuit)) return false;
    if (hand[index].rank === '8') {
      state.pendingEight = index;
      state.phase = 'choose';
      return true;
    }
    const card = hand.splice(index, 1)[0];
    state.discard.push(card);
    state.activeSuit = card.suit;
    state.passes = 0;
  } else if (action.type === 'draw') {
    if (state.phase !== 'play' || state.drawn ||
        !(state.stock.length || state.discard.length > 1)) return false;
    replenish(state, random);
    hand.push(state.stock.pop());
    state.drawn = true;
    return true;
  } else if (action.type === 'pass') {
    if (state.phase !== 'play' || (!state.drawn &&
        (state.stock.length || state.discard.length > 1 ||
          hand.some(card => canPlay(card, state.discard.at(-1), state.activeSuit))))) return false;
    state.passes++;
  } else return false;

  if (action.type === 'draw') return true;
  if (!hand.length) {
    state.winner = state.current;
    state.phase = 'over';
    state.ending = 'empty';
    return true;
  }
  replenish(state, random);
  if (state.passes === 2 && !state.stock.length) {
    const scores = state.hands.map(penalty);
    state.winner = scores[0] === scores[1] ? null : scores[0] < scores[1] ? 0 : 1;
    state.ending = 'blocked';
    state.phase = 'over';
  } else {
    state.current = 1 - state.current;
    state.turn++;
    state.drawn = false;
    state.pendingEight = null;
    state.phase = 'play';
  }
  return true;
}

export function applyRemoteCrazyEightsAction(state, request, revision, from, playerIds,
  random = Math.random) {
  return request?.type === 'crazy-eights-request' && request.revision === revision &&
    playerIds?.[state.current] === from && actCrazyEights(state, request.move, random);
}

export function crazyEightsView(state, player) {
  return {
    hand: state.hands[player].map(card => ({ ...card })),
    counts: state.hands.map(hand => hand.length),
    top: { ...state.discard.at(-1) },
    activeSuit: state.activeSuit, current: state.current,
    phase: state.phase === 'over' ? 'over' : player === state.current ? state.phase : 'play',
    drawn: player === state.current ? state.drawn : false,
    canDraw: !!(state.stock.length || state.discard.length > 1),
    canPass: player === state.current && (state.drawn ||
      !(state.stock.length || state.discard.length > 1) &&
      !state.hands[player].some(card => canPlay(card, state.discard.at(-1), state.activeSuit))),
    stockCount: state.stock.length, turn: state.turn, winner: state.winner,
    ending: state.ending, scores: state.phase === 'over' && state.ending === 'blocked'
      ? state.hands.map(penalty) : null,
  };
}

function validView(v, player) {
  const keys = ['hand', 'counts', 'top', 'activeSuit', 'current', 'phase', 'drawn',
    'canDraw', 'canPass', 'stockCount', 'turn', 'winner', 'ending', 'scores'];
  const card = c => c && Object.keys(c).length === 2 &&
    SUITS.includes(c.suit) && RANKS.includes(c.rank);
  return v && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key)) &&
    Array.isArray(v.hand) && v.hand.every(card) && card(v.top) &&
    Array.isArray(v.counts) && v.counts.length === 2 &&
    v.counts.every(n => Number.isInteger(n) && n >= 0 && n <= 52) &&
    v.counts[player] === v.hand.length &&
    new Set([...v.hand, v.top].map(c => `${c.suit}:${c.rank}`)).size === v.hand.length + 1 &&
    SUITS.includes(v.activeSuit) && [0, 1].includes(v.current) &&
    ['play', 'choose', 'over'].includes(v.phase) &&
    (v.current === player || v.phase !== 'choose') &&
    (v.phase === 'choose' ? v.hand.some(c => c.rank === '8') : true) &&
    typeof v.drawn === 'boolean' && typeof v.canDraw === 'boolean' &&
    typeof v.canPass === 'boolean' && (!v.canPass || v.current === player) &&
    Number.isInteger(v.stockCount) && v.stockCount >= 0 && v.stockCount <= 52 &&
    Number.isSafeInteger(v.turn) && v.turn >= 1 &&
    [null, 0, 1].includes(v.winner) && ['','empty','blocked'].includes(v.ending) &&
    (v.phase === 'over' ? v.ending !== '' : v.winner === null && v.ending === '') &&
    (v.ending === 'blocked' ? Array.isArray(v.scores) && v.scores.length === 2 &&
      v.scores.every(n => Number.isInteger(n) && n >= 0) : v.scores === null);
}

function sound(kind) {
  const audio = window.arcadeAudio;
  if (audio) void audio.prepare().then(() => audio[kind]()).catch(error =>
    console.warn('Card sound unavailable:', error));
  window.haptics?.select();
}

function cardElement(card, { hidden = false, playable = false, onClick } = {}) {
  const el = document.createElement(onClick ? 'button' : 'div');
  el.className = `cg-card${hidden ? ' cg-card--back' : card.suit === '♥' || card.suit === '♦' ? ' cg-card--red' : ''}${onClick ? ' cg-card--button' : ''}`;
  if (onClick) {
    el.type = 'button';
    el.disabled = !playable;
    el.addEventListener('click', onClick);
  }
  el.setAttribute('aria-label', hidden ? 'Face-down card' :
    `${card.rank} of ${SUIT_NAMES[card.suit]}${onClick ? playable ? ', play card' : ', cannot play' : ''}`);
  if (hidden) {
    el.innerHTML = '<span aria-hidden="true" class="cg-card-back-mark">✦</span>';
  } else {
    const corner = document.createElement('span');
    corner.className = 'cg-card-corner';
    corner.textContent = `${card.rank}${card.suit}`;
    const middle = document.createElement('span');
    middle.className = 'cg-card-center';
    middle.setAttribute('aria-hidden', 'true');
    middle.textContent = card.suit;
    el.append(corner, middle);
  }
  return el;
}

function button(label, handler, quiet = false) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `cg-button${quiet ? ' cg-button--quiet' : ''}`;
  node.textContent = label;
  node.addEventListener('click', handler);
  return node;
}

function paragraph(text, className) {
  const node = document.createElement('p');
  node.className = className;
  node.textContent = text;
  return node;
}

export default {
  async render(el, game, { navigate, session, multiplayer } = {}) {
    const shell = createShell(el, game, {
      title: 'Crazy Eights', meta: 'Two players · pass & play', resetLabel: 'New game',
    });
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('ce-vibe');
    const room = remoteMatch(multiplayer, game.id);
    const showTurn = createTurnIndicator(shell.root, room);
    const saved = !room && validCrazyEightsCheckpoint(session?.state) ? session.state : null;
    if (!room && !saved && !await chooseCardTable(shell.stage, multiplayer, game)) {
      shell.root.remove();
      return { dispose: () => {} };
    }
    const mySeat = room ? seat(room) - 1 : null;
    if (room && room.activeGame.playerIds.length !== 2) return { dispose: () => shell.root.remove() };
    shell.root.querySelector('.game-meta').textContent = room
      ? `Private room · ${playerName(mySeat, room)}` : 'Two players · pass & play';
    const table = document.createElement('div');
    table.className = 'cg-table ce-table';
    shell.stage.appendChild(table);
    let state = room && room.role !== 'host' ? null : saved || newCrazyEightsGame();
    let view = room?.role === 'host' ? crazyEightsView(state, mySeat) : null;
    let covered = !room && !!state && state.phase !== 'over';
    if (saved && saved.phase === 'handoff') state.phase = 'play';
    let revision = 0, lastRevision = -1, round = 0, disposed = false;
    let lastConnection = room?.members.find(member => member.id === room?.activeGame.playerIds[0])?.connected;

    function checkpoint() {
      if (room) return;
      if (state.phase === 'over') session?.finish();
      else session?.save({ ...state, phase: covered && state.phase !== 'choose' ? 'handoff' : state.phase });
    }
    function announce(winner, record = false) {
      if (record && room?.role === 'host') room.recordResult(game.id, winner, round);
      if (winner !== null && (!room || winner === mySeat))
        celebrate(shell.root, `${playerName(winner, room)} wins Crazy Eights!`);
    }
    function publish() {
      if (room?.role !== 'host') return;
      revision++;
      view = crazyEightsView(state, mySeat);
      room.sendPrivateAction(room.activeGame.playerIds[1], {
        type: 'crazy-eights-state', revision, view: crazyEightsView(state, 1),
      });
    }
    function reset() {
      if (room) {
        if (room.role === 'host') room.sendAction({ type: 'crazy-eights-reset' });
        return;
      }
      state = newCrazyEightsGame();
      covered = true;
      shell.root.querySelector('.arcade-victory')?.remove();
      checkpoint();
      render();
    }
    function move(action) {
      if (room) {
        if (!view || view.current !== mySeat || view.phase === 'over') return;
        room.sendAction({ type: 'crazy-eights-request',
          revision: room.role === 'host' ? revision : lastRevision, move: action });
      } else {
        const previous = state.phase, current = state.current;
        if (!actCrazyEights(state, action)) return;
        if (action.type === 'play' && state.phase === 'choose') {
          checkpoint(); render(); return;
        }
        sound('tap');
        if (state.phase === 'over') announce(state.winner);
        else if (state.current !== current && previous !== 'over') covered = true;
        checkpoint();
        render();
      }
    }
    const offRoom = room?.on(event => {
      if (disposed || room.activeGame?.id !== game.id) return;
      if (event.type === 'state') {
        const connected = room.members.find(member => member.id === room.activeGame.playerIds[0])?.connected;
        if (room.role !== 'host' && connected && !lastConnection)
          room.sendAction({ type: 'crazy-eights-sync' });
        lastConnection = connected;
        return;
      }
      if (event.type !== 'action') return;
      if (room.role === 'host') {
        const index = room.activeGame.playerIds.indexOf(event.from);
        if (event.action?.type === 'crazy-eights-sync') {
          if (index === 1) room.sendPrivateAction(event.from,
            { type: 'crazy-eights-state', revision, view: crazyEightsView(state, index) });
        } else if (event.action?.type === 'crazy-eights-request') {
          const wasOver = state.phase === 'over';
          if (applyRemoteCrazyEightsAction(state, event.action, revision, event.from,
            room.activeGame.playerIds)) {
            sound('tap');
            if (!wasOver && state.phase === 'over') announce(state.winner, true);
            publish();
            render();
          } else if (index === 1) room.sendPrivateAction(event.from,
            { type: 'crazy-eights-state', revision, view: crazyEightsView(state, index) });
        } else if (event.action?.type === 'crazy-eights-reset' &&
            event.from === room.peerId) {
          state = newCrazyEightsGame();
          round++;
          shell.root.querySelector('.arcade-victory')?.remove();
          publish();
          render();
        }
      } else if (event.from === room.activeGame.playerIds[0] &&
          event.action?.type === 'crazy-eights-state' &&
          Number.isSafeInteger(event.action.revision) &&
          event.action.revision >= lastRevision) {
        if (!validView(event.action.view, mySeat)) {
          console.warn('Invalid Crazy Eights room state received.');
          return;
        }
        const previous = view?.ending;
        lastRevision = event.action.revision;
        view = event.action.view;
        if (previous !== undefined) sound('tap');
        if (view.ending && !previous) announce(view.winner);
        if (!view.ending && previous) shell.root.querySelector('.arcade-victory')?.remove();
        render();
      }
    });
    function render() {
      table.replaceChildren();
      const heading = document.createElement('header');
      heading.className = 'cg-table-heading';
      heading.innerHTML = `<span class="cg-eyebrow">${room ? 'PRIVATE ROOM · LIVE TABLE' : 'LOCAL TABLE · PASS & PLAY'}</span><strong>EIGHTS AFTER DARK <span aria-hidden="true">✦</span></strong>`;
      table.appendChild(heading);
      if (room && !view) {
        showTurn(null);
        table.appendChild(paragraph('Waiting for the host to deal…', 'cg-message'));
        return;
      }
      const data = room ? view : crazyEightsView(state, state.current);
      showTurn(data.current, data.phase !== 'over' && (!covered || !!room));
      const visibleSeat = room ? mySeat : state.current;
      if (covered) {
        const curtain = document.createElement('div');
        curtain.className = 'ce-curtain';
        curtain.innerHTML = '<div class="ce-curtain-icon" aria-hidden="true">✦</div><h3>Pass the device</h3>';
        curtain.append(
          paragraph(`${playerName(visibleSeat)}, it’s your turn. ${playerName(1 - visibleSeat)}, look away!`, 'ce-curtain-instructions'),
          button(`I'm ${playerName(visibleSeat)} · show my hand`, () => {
            covered = false; checkpoint(); render();
          }),
          paragraph('Your cards stay hidden until you tap the button.', 'cg-rules'),
        );
        table.appendChild(curtain);
        return;
      }
      if (data.phase === 'over') {
        const result = document.createElement('div');
        result.className = 'ce-curtain';
        result.innerHTML = '<div class="ce-curtain-icon" aria-hidden="true">★</div><h3>Game over</h3>';
        const resultText = data.ending === 'empty'
          ? `${playerName(data.winner, room)} played their last card and wins!`
          : data.winner === null
            ? `Blocked game · ${data.scores[0]} points each. It's a tie!`
            : `Blocked game · ${playerName(data.winner, room)} wins with ${data.scores[data.winner]} points against ${data.scores[1 - data.winner]}!`;
        result.appendChild(paragraph(resultText, 'cg-message'));
        if (!room || room.role === 'host') result.appendChild(button('Play again ↗', reset));
        table.appendChild(result);
        return;
      }
      const opponent = document.createElement('section');
      opponent.className = 'ce-opponent';
      const opponentTitle = document.createElement('h3');
      opponentTitle.textContent = `${playerName(1 - visibleSeat, room)} · ${data.counts[1 - visibleSeat]} cards`;
      opponent.appendChild(opponentTitle);
      const backs = document.createElement('div');
      backs.className = 'cg-card-row ce-opponent-backs';
      backs.setAttribute('aria-label', `${data.counts[1 - visibleSeat]} hidden cards`);
      for (let i = 0; i < Math.min(data.counts[1 - visibleSeat], 7); i++) {
        const back = cardElement(null, { hidden: true });
        back.setAttribute('aria-hidden', 'true');
        backs.appendChild(back);
      }
      opponent.appendChild(backs);
      table.appendChild(opponent);
      const middle = document.createElement('div');
      middle.className = 'ce-middle';
      const pile = document.createElement('div');
      pile.className = 'ce-pile';
      pile.append(cardElement(null, { hidden: true }), cardElement(data.top));
      middle.appendChild(pile);
      middle.appendChild(paragraph(`ACTIVE SUIT · ${SUIT_NAMES[data.activeSuit].toUpperCase()} ${data.activeSuit}`, 'ce-active-suit'));
      middle.appendChild(paragraph(`TURN ${data.turn} · ${data.stockCount} in draw pile`, 'cg-eyebrow'));
      table.appendChild(middle);
      const canAct = !room || data.current === mySeat;
      const message = paragraph(!canAct ? `Waiting for ${playerName(data.current, room)}` :
        data.phase === 'choose' ? 'Eight! Choose the next suit.' :
        data.drawn ? 'Play a card, or pass to the other player.' :
          'Match rank or suit. Eights are wild.', 'cg-message');
      message.setAttribute('role', 'status');
      message.setAttribute('aria-live', 'polite');
      table.appendChild(message);
      const hand = document.createElement('section');
      hand.className = 'ce-hand';
      const yourTitle = document.createElement('h3');
      yourTitle.textContent = `${playerName(visibleSeat, room)} · your hand (${data.hand.length})`;
      hand.appendChild(yourTitle);
      const row = document.createElement('div');
      row.className = 'cg-card-row ce-hand-cards';
      data.hand.forEach(card => row.appendChild(cardElement(card, {
        playable: canAct && data.phase === 'play' && canPlay(card, data.top, data.activeSuit),
        onClick: () => move({ type: 'play', id: `${card.suit}:${card.rank}` }),
      })));
      hand.appendChild(row);
      table.appendChild(hand);
      const actions = document.createElement('div');
      actions.className = 'cg-actions';
      if (canAct) {
        if (data.phase === 'choose') {
          for (const suit of SUITS) actions.appendChild(button(`${suit} ${SUIT_NAMES[suit]}`,
            () => move({ type: 'choose', suit })));
        } else {
          if (!data.drawn && data.canDraw) actions.appendChild(button('Draw one +', () => move({ type: 'draw' })));
          if (data.canPass) actions.appendChild(button('Pass turn →', () => move({ type: 'pass' }), true));
        }
      }
      table.appendChild(actions);
      table.appendChild(paragraph('Draw once per turn, then play any card or pass. If no cards can be drawn and both players pass, lowest hand points win.', 'cg-rules'));
      (table.querySelector('.ce-hand-cards .cg-card--button:not(:disabled)') ||
        table.querySelector('.cg-button'))?.focus();
    }
    shell.getResetButton().addEventListener('click', reset);
    if (room?.role === 'guest') shell.getResetButton().disabled = true;
    if (room?.role === 'host') publish();
    else if (room) room.sendAction({ type: 'crazy-eights-sync' });
    else checkpoint();
    render();
    return { dispose: () => { disposed = true; offRoom?.(); shell.root.remove(); } };
  },
};
