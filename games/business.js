import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { playerName } from '../js/player-names.js';
import { createTurnIndicator } from '../js/turn-indicator.js';
import { rollDiceValues, diceMarkup, rollDice, pauseAfterRoll } from '../js/dice.js';
import { celebrate } from '../js/celebration.js';
import { BOARD, DEEDS, GROUPS, CARDS, DEFAULT_OPTIONS, createBusiness, actBusiness,
  actors, rent, validBusiness, publicBusiness, netWorth } from './business-engine.js';

const format = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const cost = n => format.format(n);
const tradeContents = (ids, cash, cards) =>
  `${ids.map(id => BOARD[id].name).join(', ') || 'No deeds'} · ${cost(cash)}${cards ? ` · ${cards} Jail card${cards === 1 ? '' : 's'}` : ''}`;
const coords = id => id < 10 ? [11, 11 - id] : id < 20 ?
  [11 - (id - 10), 1] : id < 30 ? [1, id - 19] : [id - 29, 11];
const name = (index, room) => playerName(index, room);
const colors = ['#ff936a', '#55d5f0', '#ffe052', '#c29aff', '#52e5a3', '#ff8bc5'];
const pieces = [
  '<path d="M5 17 8 8l4 4 4-7 4 7 4-4 3 9-2 5H7zM7 25h18"/>',
  '<circle cx="11" cy="12" r="6"/><path d="M15 16 26 27m-5-5 3-3m-1 5 3-3"/>',
  '<path d="M16 27Q3 22 7 11q7 0 9 5 2-5 9-5 4 11-9 16Zm0 0V6m-6 20h12"/>',
  '<circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="3"/><path d="M16 3v6m0 14v6M3 16h6m14 0h6"/>',
  '<path d="m16 3 3 9 9 4-9 3-3 10-3-10-10-3 10-4z"/>',
  '<path d="M16 4c9 8 11 16 0 23C5 20 7 12 16 4Zm-9 12q-2 8 9 11 11-3 9-11M16 9v18"/>',
];
const pieceMarkup = i => `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none"
  stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${pieces[i]}</svg>`;
const artMarkup = kind => `<svg class="bs-art-icon" viewBox="0 0 48 48" aria-hidden="true">
  <use href="./assets/business/symbols.svg#${kind === 'go-jail' ? 'jail' :
    kind === 'jail' ? 'jail' : [...Object.keys(GROUPS), 'city', 'transport', 'utility', 'fortune', 'fund',
      'start', 'tax', 'rest', 'house', 'hotel'].includes(kind) ? kind : 'city'}"></use></svg>`;

export function businessSpaceDetails(s, id) {
  const space = BOARD[id], d = s.deeds[id];
  if (!space) throw new RangeError('Unknown board space.');
  const details = { space, owner: d?.owner ?? null, mortgaged: d?.mortgaged ?? false,
    level: d?.level ?? 0, group: space.group || null };
  if (space.kind === 'city') {
    const group = DEEDS.filter(x => BOARD[x].group === space.group);
    details.complete = d?.owner !== null && d &&
      group.every(x => s.deeds[x].owner === d.owner);
    details.unmortgaged = details.complete && group.every(x => !s.deeds[x].mortgaged);
    details.tiers = space.rent.map((amount, level) => ({
      level, amount: level === 0 && details.unmortgaged ?
        amount * 2 : amount,
    }));
    details.groupCities = group;
    details.mortgage = space.price / 2;
  } else if (space.kind === 'transport') {
    details.tiers = [25, 50, 100, 200].map((amount, level) => ({ level, amount }));
    details.mortgage = space.price / 2;
  } else if (space.kind === 'utility') {
    details.tiers = [4, 10].map((amount, level) => ({ level, amount }));
    details.mortgage = space.price / 2;
  }
  return details;
}

export function businessDeedActions(s, player, id) {
  const d = s.deeds[id], space = BOARD[id];
  if (!d || d.owner !== player || s.players[player].out) return [];
  const actions = [], group = space.group;
  const peers = group ? DEEDS.filter(x => BOARD[x].group === group) : [];
  const levels = peers.map(x => s.deeds[x].level);
  const clear = peers.every(x => !s.deeds[x].mortgaged);
  const complete = peers.every(x => s.deeds[x].owner === player);
  if (d.level > 0 && d.level === Math.max(...levels) && (d.level < 5 || s.houses >= 4))
    actions.push({ label: 'Sell building', move: { type: 'sell', id } });
  if (group && complete && clear && s.players[player].cash >= space.cost) {
    if (d.level < 4 && d.level === Math.min(...levels) && s.houses > 0)
      actions.push({ label: `Build house · ${cost(space.cost)}`, move: { type: 'build', id, kind: 'house' } });
    if (d.level === 4 && levels.every(level => level >= 4) && s.hotels > 0)
      actions.push({ label: `Build hotel · ${cost(space.cost)}`, move: { type: 'build', id, kind: 'hotel' } });
  }
  if (d.mortgaged) {
    const amount = Math.ceil(space.price * .55);
    if (s.players[player].cash >= amount)
      actions.push({ label: `Repay · ${cost(amount)}`, move: { type: 'release', id } });
  } else if (!group || levels.every(level => level === 0))
    actions.push({ label: `Mortgage · +${cost(space.price / 2)}`, move: { type: 'mortgage', id } });
  return actions;
}
export function businessAwardChoices(s, player) {
  if (s.phase !== 'award' || s.auction?.bidder !== player) return [];
  return DEEDS.filter(id => s.deeds[id].owner === player &&
    BOARD[id].cost <= s.auction.bid &&
    businessDeedActions(s, player, id).some(option =>
      option.move.type === 'build' && option.move.kind === s.auction.kind));
}
export function businessBuildHint(s, player, id) {
  const space = BOARD[id], deed = s.deeds[id];
  if (!space?.group || deed?.owner !== player || deed.level === 5) return '';
  const peers = DEEDS.filter(x => BOARD[x].group === space.group);
  const levels = peers.map(x => s.deeds[x].level);
  if (peers.some(x => s.deeds[x].mortgaged)) return 'Repay all group mortgages before building.';
  if (peers.some(x => s.deeds[x].owner !== player)) return 'Complete the color group to build.';
  if (s.players[player].cash < space.cost) return `You need ${cost(space.cost)} cash to build here.`;
  if (deed.level < 4) {
    if (deed.level > Math.min(...levels)) return 'Develop the lowest city in this group first.';
    if (!s.houses) return 'The bank has no houses left; wait for a return.';
  } else {
    if (levels.some(level => level < 4)) return 'Build four houses in every group city before a hotel.';
    if (!s.hotels) return 'The bank has no hotels left; wait for a return.';
  }
  return '';
}
export function businessResponder(s) {
  return s.offer?.to ?? actors(s)[0] ?? s.current;
}
export function businessHandoffSeat(before, after, viewer) {
  const next = businessResponder(after);
  return after.phase !== 'win' && next !== viewer &&
    (next !== businessResponder(before) || before.current !== after.current ||
      Boolean(after.offer && !before.offer)) ? next : viewer;
}
export function businessActionContext(s, viewer) {
  if (s.phase === 'win') return 'win';
  if (s.offer?.to === viewer) return 'trade-response';
  if (s.offer?.from === viewer) return 'trade-wait';
  return businessResponder(s) === viewer ? s.phase : 'waiting';
}
export function businessTurnFlow(s, viewer) {
  const context = businessActionContext(s, viewer);
  const step = s.phase === 'roll' ? 0 : s.phase === 'finish' || s.phase === 'win' ? 2 : 1;
  const titles = {
    roll: s.players[viewer].jailed ? 'Leave Jail' : s.doubles ? 'Doubles! Roll again' : 'Roll to move',
    buy: 'Buy this property?',
    auction: 'Bid or pass',
    award: 'Place your building',
    debt: 'Settle your payment',
    finish: 'Ready for the next player',
    win: 'Final standings',
    'trade-response': 'Review the trade',
    'trade-wait': 'Waiting for a trade reply',
    waiting: `Waiting for Player ${businessResponder(s) + 1}`,
  };
  const manage = !s.players[viewer].out && !s.offer &&
    !['auction', 'award', 'win'].includes(s.phase) &&
    (s.phase !== 'debt' || s.debt.from === viewer);
  return { context, step, title: titles[context], manage,
    trade: manage || context === 'trade-response' };
}
const moveKeys = {
  roll: [], buy: [], decline: [], end: [], 'jail-fine': [], 'jail-card': ['card'],
  bid: ['amount'], pass: [], build: ['id', 'kind'], sell: ['id'], liquidate: ['group'],
  mortgage: ['id'], release: ['id'], 'pay-debt': [], bankrupt: [], 'place-award': ['id'],
  offer: ['to', 'offered', 'wanted', 'cashOut', 'cashIn', 'cardsOut', 'cardsIn'],
  counter: ['to', 'offered', 'wanted', 'cashOut', 'cashIn', 'cardsOut', 'cardsIn'],
  accept: [], reject: [], cancel: [],
};
export function validBusinessMove(move) {
  return move && typeof move === 'object' && !Array.isArray(move) &&
    Object.hasOwn(moveKeys, move.type) &&
    Object.keys(move).every(k => k === 'type' || moveKeys[move.type].includes(k)) &&
    JSON.stringify(move).length < 2000 &&
    (move.id === undefined || DEEDS.includes(move.id)) &&
    (move.amount === undefined || Number.isSafeInteger(move.amount) && move.amount >= 0 && move.amount <= 1e7) &&
    (move.to === undefined || Number.isInteger(move.to) && move.to >= 0 && move.to < 6) &&
    ['offered', 'wanted'].every(k => move[k] === undefined ||
      Array.isArray(move[k]) && move[k].length <= 28 && move[k].every(id => DEEDS.includes(id))) &&
    ['cashOut', 'cashIn', 'cardsOut', 'cardsIn'].every(k => move[k] === undefined ||
      Number.isSafeInteger(move[k]) && move[k] >= 0 && move[k] < 1e7) &&
    (move.card === undefined || ['fortune', 'fund'].includes(move.card)) &&
    (move.kind === undefined || ['house', 'hotel'].includes(move.kind)) &&
    (move.group === undefined || Object.hasOwn(GROUPS, move.group)) &&
    (!['build', 'place-award', 'sell', 'mortgage', 'release'].includes(move.type) ||
      DEEDS.includes(move.id)) &&
    (move.type !== 'build' || ['house', 'hotel'].includes(move.kind)) &&
    (move.type !== 'liquidate' || Object.hasOwn(GROUPS, move.group)) &&
    (move.type !== 'bid' || Number.isSafeInteger(move.amount) && move.amount > 0) &&
    (!['offer', 'counter'].includes(move.type) || Number.isInteger(move.to) &&
      Array.isArray(move.offered) && Array.isArray(move.wanted) &&
      ['cashOut', 'cashIn', 'cardsOut', 'cardsIn'].every(k => Number.isSafeInteger(move[k]) && move[k] >= 0));
}
export function applyRemoteBusinessAction(state, request, round, from, playerIds, dice = null) {
  if (!validBusiness(state, playerIds?.length) ||
    !request || Object.keys(request).sort().join(',') !== 'move,revision,round,type' ||
    request.type !== 'bs-request' ||
    request.revision !== state.revision || request.round !== round ||
    !Array.isArray(playerIds) || new Set(playerIds).size !== playerIds.length ||
    !validBusinessMove(request.move)) throw new Error('Stale or invalid move. Table refreshed.');
  const actor = playerIds.indexOf(from);
  if (actor < 0) throw new Error('This seat is not playing.');
  const roll = request.move.type === 'roll' ? { dice: dice || rollDiceValues(2) } : {};
  return actBusiness(state, { ...request.move, ...roll }, actor);
}
export function validBusinessSnapshot(action, count, round, revision) {
  return action && ['bs-state', 'bs-reject'].includes(action.type) &&
    Number.isSafeInteger(action.round) && action.round >= round &&
    validBusiness(action.view, count, { publicView: true }) &&
    Number.isSafeInteger(action.view.revision) &&
    (action.round > round || action.view.revision >= revision) &&
    (action.type !== 'bs-reject' || typeof action.message === 'string' && action.message.length <= 200);
}
export function createBusinessRollCycle() {
  let controller = new AbortController();
  return {
    capture(round, revision) { return { controller, round, revision }; },
    allows(token, round, revision) {
      return token.controller === controller && !controller.signal.aborted &&
        token.round === round && token.revision === revision;
    },
    isCurrent(token) { return token.controller === controller; },
    cancel() { controller.abort(); controller = new AbortController(); },
  };
}
function button(text, action, quiet = false) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `bs-button game-ui-action${quiet ? ' bs-button--quiet game-ui-action--secondary' : ''}`;
  b.textContent = text; b.dataset.focus = text; b.addEventListener('click', action);
  return b;
}
function text(node, tag, value, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = value;
  node.append(el); return el;
}
function select(label, values) {
  const wrap = document.createElement('label');
  wrap.textContent = label;
  const node = document.createElement('select');
  for (const [value, caption] of values) {
    const option = document.createElement('option');
    option.value = value; option.textContent = caption; node.append(option);
  }
  wrap.append(node);
  return [wrap, node];
}
function number(label, max, value = 0) {
  const wrap = document.createElement('label');
  wrap.textContent = label;
  const input = document.createElement('input');
  input.type = 'number'; input.min = '0'; input.max = String(max);
  input.step = '1'; input.value = String(value); input.inputMode = 'numeric';
  wrap.append(input); return [wrap, input];
}

export default {
  async render(el, game, { navigate, session, multiplayer } = {}) {
    const shell = createShell(el, game, { title: 'Business', meta: 'Cities · fortunes · rival empires', resetLabel: 'New table' });
    shell.root.classList.add('bs-shell');
    if (navigate) wireBack(shell, navigate);
    const room = multiplayer?.activeGame?.id === 'business' &&
      multiplayer.activeGame.playerIds.includes(multiplayer.peerId) ? multiplayer : null;
    const count = room?.activeGame.playerIds.length;
    const mySeat = room ? room.activeGame.playerIds.indexOf(room.peerId) : null;
    const showTurn = createTurnIndicator(shell.root, room);
    if (room && (count < 2 || count > 6)) {
      text(shell.stage, 'p', 'Business needs 2–6 assigned seats. Return to the lobby.');
      shell.getResetButton().disabled = true;
      return { dispose: () => shell.root.remove() };
    }
    const localCheckpoint = !room && validBusiness(session?.state) ? session.state : null;
    if (!room && !localCheckpoint) {
      const chooser = document.createElement('section');
      chooser.className = 'bs-entry';
      chooser.innerHTML = `<span class="bs-eyebrow">THE CITY IS YOURS</span>
        <h2>Make your move.</h2><p>Trade Indian cities, collect rent and build an empire together.</p>
        <button class="bs-button game-ui-action bs-online" type="button">Create or join an online room ↗</button>
        <button class="bs-button game-ui-action game-ui-action--secondary bs-button--quiet bs-local" type="button">Pass &amp; play on this phone</button>
        <details><summary>How does online play work?</summary>
        <p>The host invites friends using a link; guests send an answer link back. Up to six people get one seat each. Keep tabs open to play.</p></details>
        <p class="bs-entry-error" role="alert"></p>`;
      shell.stage.append(chooser);
      const route = location.hash;
      const mode = await new Promise(resolve => {
        const onNavigate = () => {
          if (location.hash !== route) done(false);
        };
        const off = multiplayer?.on(event => { if (event.type === 'game') done(false); });
        const done = result => {
          off?.(); window.removeEventListener('hashchange', onNavigate);
          chooser.remove(); resolve(result);
        };
        window.addEventListener('hashchange', onNavigate);
        chooser.querySelector('.bs-local').addEventListener('click', () => done(true));
        chooser.querySelector('.bs-online').addEventListener('click', async () => {
          try { await multiplayer.showLobby(game.id); }
          catch (error) { chooser.querySelector('.bs-entry-error').textContent = error.message; }
        });
      });
      if (!mode) return { dispose: () => shell.root.remove() };
    }
    const roomSave = room?.role === 'host' ? room.savedGame : null;
    if (roomSave && (!validBusiness(roomSave.state, count) ||
      !Number.isInteger(roomSave.round) || roomSave.round < 0))
      throw new Error('Saved Business game failed validation. Start a new room game.');
    const setting = room?.role === 'guest' || roomSave || localCheckpoint ? null :
      await renderSetup(shell.stage, {
        title: 'Business · Indian city edition',
        subtitle: room ? 'Your room is ready. The host sets the rules for everyone.' :
          'Gather friends around this phone. Take turns; pass it to the indicated player for auctions, trades and debts.',
        startLabel: 'Open the table',
        fields: [
          ...(!room ? [{ key: 'count', label: 'Players', default: '2',
            options: [2, 3, 4, 5, 6].map(n => ({ value: String(n), label: `${n} players` })) }] : []),
          { key: 'turnLimit', label: 'Game length', default: '0', help: 'A turn cap gives everyone a shorter game; highest net worth wins, ties are shared.',
            options: [['0', 'Last player standing'], ['30', '30 turns'], ['60', '60 turns'], ['120', '120 turns']].map(([value, label]) => ({ value, label })) },
          { key: 'customRules', label: 'House rules', default: 'false',
            options: [['false', 'Use Arcade defaults'], ['true', 'Customize rules']].map(([value, label]) => ({ value, label })) },
          { key: 'rollToStart', label: 'Opening roll', default: 'false', help: 'Optional traditional variant: roll a total of 12 to enter; unsuccessful rolls end your turn.',
            when: values => values.customRules === 'true',
            options: [['false', 'Start immediately'], ['true', 'Roll 12 to enter']].map(([value, label]) => ({ value, label })) },
          { key: 'auctionOnly', label: 'Unowned deeds', default: 'false',
            when: values => values.customRules === 'true',
            options: [['false', 'Buy or auction'], ['true', 'Auction every deed']].map(([value, label]) => ({ value, label })) },
          { key: 'jackpot', label: 'Rest Stop', default: 'false', help: 'House rule: bank fees collect in a pool won on Rest Stop.',
            when: values => values.customRules === 'true',
            options: [['false', 'Neutral'], ['true', 'Fines jackpot']].map(([value, label]) => ({ value, label })) },
          { key: 'exactStartBonus', label: 'Exact Start', default: 'false',
            when: values => values.customRules === 'true',
            options: [['false', 'Normal salary'], ['true', 'Extra salary']].map(([value, label]) => ({ value, label })) },
          { key: 'incomeTax', label: 'Income tax', default: '200', help: 'Published editions conflict; choose an explicit house amount.',
            when: values => values.customRules === 'true',
            options: [['200', '₹200'], ['2000', '₹2,000']].map(([value, label]) => ({ value, label })) },
          { key: 'jailFine', label: 'Jail fine', default: '500', help: '₹500 is this Arcade edition’s default, not an official fixed amount.',
            when: values => values.customRules === 'true',
            options: [['200', '₹200'], ['500', '₹500']].map(([value, label]) => ({ value, label })) },
        ],
      });
    const options = setting?.customRules === 'true' ? { ...DEFAULT_OPTIONS,
      rollToStart: setting.rollToStart === 'true', auctionOnly: setting.auctionOnly === 'true',
      jackpot: setting.jackpot === 'true', exactStartBonus: setting.exactStartBonus === 'true',
      incomeTax: Number(setting.incomeTax), jailFine: Number(setting.jailFine),
      turnLimit: Number(setting.turnLimit) } : setting ?
      { ...DEFAULT_OPTIONS, turnLimit: Number(setting.turnLimit) } : null;
    const seats = room ? count : localCheckpoint?.players.length || Number(setting.count);
    let state = room?.role === 'guest' ? null : structuredClone(roomSave?.state || localCheckpoint || createBusiness(seats, options || {}));
    let view = state && publicBusiness(state);
    let round = roomSave?.round ?? 0, revision = state?.revision ?? -1;
    let disposed = false, rolling = false, pending = false,
      covered = !room && state?.phase !== 'win', hostDice = null;
    let localViewer = state ? businessResponder(state) : 0, errorText = '';
    let inspected = state?.players[state.current].position ?? 0;
    let boardAnchor = inspected, latestCard = null, recentMove = null, cashBefore = null;
    let panel = 'turn', propertyMode = 'all', focusPanel = false;
    const tradeDrafts = new Map();
    const rollCycle = createBusinessRollCycle();
    const table = document.createElement('div');
    table.className = 'bs-table';
    shell.stage.append(table);
    let boardSize = '';
    const boardResize = new ResizeObserver(([entry]) => {
      if (disposed || !entry?.target.isConnected) return;
      const size = `${entry.target.clientWidth},${entry.target.clientHeight}`;
      if (size === boardSize) return;
      boardSize = size; boardAnchor = inspected;
      restoreFocus(null, [0, 0], true);
    });
    shell.root.querySelector('.game-meta').textContent = room ?
      `Private room · ${seats} players · seat ${mySeat + 1}` : `${seats} players · same-phone play`;
    function highlight(before, after) {
      if (!before || !after || after.revision === before.revision) return;
      if (before.phase !== after.phase || businessResponder(before) !== businessResponder(after) ||
        Boolean(before.offer) !== Boolean(after.offer) ||
        after.phase === 'debt' && after.players[businessResponder(after)].cash >= after.debt.amount) {
        panel = 'turn'; focusPanel = true;
      }
      cashBefore = before.players.map(player => player.cash);
      const mover = after.players.findIndex((player, i) => player.position !== before.players[i].position);
      recentMove = mover >= 0 ? {
        seat: mover, from: before.players[mover].position, to: after.players[mover].position,
      } : null;
      if (recentMove) boardAnchor = recentMove.to;
      if (before.current !== after.current) boardAnchor = after.players[after.current].position;
      if (panel !== 'property') inspected = after.players[after.current].position;
      const oldFirst = before.log[0];
      const recentEntries = [];
      for (const entry of after.log) {
        if (entry === oldFirst) break;
        recentEntries.push(entry);
      }
      latestCard = recentEntries.flatMap(entry =>
        Object.entries(CARDS).flatMap(([kind, cards]) =>
          cards.filter(card => entry.startsWith(`${kind === 'fund' ? 'City Fund' : 'Fortune'} · ${card[0]}:`))
            .map(card => ({ kind, title: card[0], description: entry.split(': ').slice(1).join(': ') })))).at(0) || null;
      if (after.phase === 'win') return;
      const audio = window.arcadeAudio;
      if (audio) void audio.prepare().then(() => audio.tap())
        .catch(error => console.warn('Business audio feedback unavailable', error));
      window.haptics?.select();
    }
    function persist() {
      if (room) {
        if (room.role !== 'host') return;
        room.saveGame('business', { state, round });
        view = publicBusiness(state);
        for (let i = 1; i < seats; i++)
          if (room.members.some(m => m.id === room.activeGame.playerIds[i] && m.connected))
            room.sendPrivateAction(room.activeGame.playerIds[i],
              { type: 'bs-state', view, round });
      } else {
        if (state.phase === 'win') session?.finish();
        else session?.save(state);
        view = publicBusiness(state);
      }
    }
    function request(move, actor = room ? mySeat : localViewer) {
      if (rolling && move.type !== 'roll') {
        errorText = 'Wait for the dice to settle before another move.';
        return;
      }
      const { dice, ...networkMove } = move;
      if (!validBusinessMove(networkMove)) { errorText = 'Invalid action fields.'; render(); return; }
      if (room) {
        try {
          pending = true; render();
          room.sendAction({ type: 'bs-request', revision, round, move: networkMove });
        } catch (e) { pending = false; errorText = e.message; render(); }
        return;
      }
      try {
        const before = state, prev = state.phase;
        const next = actBusiness(state, move, actor);
        state = next; highlight(before, next);
        errorText = ''; persist();
        if (state.phase === 'win' && prev !== 'win')
          celebrate(shell.root, state.winners.length > 1 ?
            `${state.winners.map(i => name(i, room)).join(' & ')} share the win!` :
            `${name(state.winner, room)} wins Business!`);
        const nextActor = businessHandoffSeat(before, state, localViewer);
        if (state.phase === 'win') covered = false;
        else if (nextActor !== localViewer) {
          localViewer = nextActor; covered = true;
        }
      } catch (e) { errorText = e.message; }
      render();
    }
    async function roll() {
      if (rolling || pending || disposed) return;
      if (room?.role === 'guest') { request({ type: 'roll' }); return; }
      const values = rollDiceValues(2);
      const node = table.querySelector('.bs-roll');
      const token = rollCycle.capture(round, revision);
      rolling = true;
      table.querySelectorAll('button').forEach(button => {
        if (!button.classList.contains('bs-roll')) button.disabled = true;
      });
      try {
        if (node && await rollDice(node, token.controller.signal, values) &&
          await pauseAfterRoll(token.controller.signal) && !disposed &&
          rollCycle.allows(token, round, revision))
          if (room) { hostDice = values; request({ type: 'roll' }); }
          else request({ type: 'roll', dice: values });
      } catch (e) { errorText = e.message; render(); }
      finally {
        if (rollCycle.isCurrent(token)) { rolling = false; if (!disposed) render(); }
      }
    }
    function cancelRoll() {
      rollCycle.cancel();
      rolling = false; hostDice = null;
    }
    function openPanel(next) {
      if (rolling || pending) return;
      panel = next; focusPanel = true; render();
    }
    function restoreFocus(key, scroll, newBoard) {
      const viewport = table.querySelector('.bs-board-scroll');
      if (viewport) {
        if (newBoard || boardAnchor !== null) {
          const spot = viewport.querySelector(`[data-space="${boardAnchor ?? inspected}"]`);
          if (spot) {
            viewport.scrollLeft = spot.offsetLeft - viewport.clientWidth / 2 + spot.clientWidth / 2;
            viewport.scrollTop = spot.offsetTop - viewport.clientHeight / 2 + spot.clientHeight / 2;
          }
          boardAnchor = null;
        } else { viewport.scrollLeft = scroll[0]; viewport.scrollTop = scroll[1]; }
      }
      const heading = table.querySelector('.bs-task h4');
      if (focusPanel) {
        (table.querySelector('.bs-handoff button') || heading)?.focus({ preventScroll: true });
        focusPanel = false;
      } else if (key) ([...table.querySelectorAll('[data-focus]')].find(node =>
        node.dataset.focus === key) || table.querySelector('.bs-handoff button') ||
        heading)?.focus({ preventScroll: true });
    }
    function render() {
      if (disposed) return;
      const key = table.contains(document.activeElement) ? document.activeElement.dataset.focus : null;
      const previousForm = table.querySelector('.bs-trade-form');
      if (previousForm && Number(previousForm.dataset.round) === round) {
        const values = Object.fromEntries([...previousForm.querySelectorAll('[data-bs-field]')]
          .map(input => [input.dataset.bsField, input.value]));
        values.offered = [...previousForm.querySelectorAll('[data-bs-give]:checked')].map(input => Number(input.value));
        values.wanted = [...previousForm.querySelectorAll('[data-bs-want]:checked')].map(input => Number(input.value));
        tradeDrafts.set(Number(previousForm.dataset.seat), values);
      }
      const previousBid = table.querySelector('.bs-actions input')?.value;
      const oldScroll = table.querySelector('.bs-board-scroll');
      const scroll = [oldScroll?.scrollLeft || 0, oldScroll?.scrollTop || 0];
      boardResize.disconnect();
      table.replaceChildren();
      const s = view;
      if (!s) { text(table, 'p', 'Waiting for the host to restore the table…'); return; }
      const expected = businessResponder(s);
      const viewer = room ? mySeat : localViewer;
      const player = s.players[viewer];
      const flow = businessTurnFlow(s, viewer);
      const context = flow.context;
      if (covered || panel === 'property' && s.deeds[inspected]?.owner !== viewer ||
        ['manage', 'property'].includes(panel) && !flow.manage ||
        ['partner', 'trade', 'review'].includes(panel) && !flow.trade) panel = 'turn';
      const disconnected = room && room.activeGame.playerIds.some((id, i) =>
        !s.players[i].out && !room.members.find(m => m.id === id)?.connected);
      const can = !covered && !pending && !rolling && !disconnected && !player.out &&
        s.phase !== 'win';
      const canManage = can && flow.manage;
      showTurn(expected, s.phase !== 'win');
      const top = document.createElement('header'); top.className = 'bs-top';
      if (s.phase === 'win') text(top, 'h3',
        (s.winners.length > 1 ? `${s.winners.map(i => name(i, room)).join(' & ')} share the win` :
          `${name(s.winner, room)} owns the city`));
      const at = BOARD[s.players[s.current].position];
      const nowAt = document.createElement('div');
      nowAt.className = 'bs-current-spot';
      nowAt.innerHTML = artMarkup(at.kind);
      text(nowAt, 'span', `${name(s.current, room)} · space ${at.id}: ${at.name}`);
      top.append(nowAt);
      const historyButton = button('Recent events', () => openPanel('history'), true);
      historyButton.disabled = rolling || pending || covered;
      top.append(historyButton);
      text(top, 'p', s.message, 'bs-message').setAttribute('role', 'status');
      if (s.offer && s.offer.to !== s.current)
        text(top, 'p', `The game turn remains with ${name(s.current, room)} while ${name(s.offer.to, room)} answers.`, 'bs-wait');
      if (s.dice) text(top, 'p', `Last roll · ${s.dice[0]} + ${s.dice[1]} = ${s.dice[0] + s.dice[1]}`, 'bs-last-roll');
      if (recentMove) text(top, 'p', `${name(recentMove.seat, room)} moved ${BOARD[recentMove.from].name} → ${BOARD[recentMove.to].name}`, 'bs-journey');
      if (latestCard) {
        const notice = document.createElement('p');
        notice.className = `bs-card-flash bs-card-flash--${latestCard.kind}`;
        notice.innerHTML = artMarkup(latestCard.kind);
        text(notice, 'span', `${latestCard.kind === 'fortune' ? 'FORTUNE' : 'CITY FUND'} · ${latestCard.title} — ${latestCard.description}`);
        top.append(notice);
      }
      if (errorText) text(top, 'p', errorText, 'bs-error').setAttribute('role', 'alert');
      if (disconnected) text(top, 'p', 'A remaining player is disconnected. The table is paused until they reconnect.', 'bs-error');
      if (room && expected !== mySeat && s.phase !== 'win')
        text(top, 'p', `Waiting for ${name(expected, room)} to respond. You can inspect your assets.`, 'bs-wait');
      table.append(top);
      if (covered && !room) {
        const veil = document.createElement('section'); veil.className = 'bs-handoff';
        text(veil, 'p', 'PASS THE PHONE', 'bs-eyebrow');
        text(veil, 'h3', `Hand it to ${name(viewer, room)}`);
        text(veil, 'p', s.offer?.to === viewer ? 'A trade needs your response.' :
          s.phase === 'auction' ? 'It is your turn to bid or pass.' :
            s.phase === 'debt' ? 'Settle your payment or raise cash.' :
              'Check the named player has the phone before revealing their controls.');
        veil.append(button(`I am ${name(viewer, room)} · reveal my actions`, () => {
          covered = false; focusPanel = true; render();
        }));
        table.append(veil);
      }
      const bar = document.createElement('div'); bar.className = 'bs-seats';
      s.players.forEach((person, i) => {
        const seatEl = document.createElement('div');
        seatEl.className = `bs-seat${i === expected ? ' is-current' : ''}${person.out ? ' is-out' : ''}` +
          (cashBefore && person.cash > cashBefore[i] ? ' is-gain' :
            cashBefore && person.cash < cashBefore[i] ? ' is-loss' : '');
        seatEl.style.setProperty('--seat-ink', colors[i]);
        const mark = document.createElement('span');
        mark.className = 'bs-seat-piece'; mark.innerHTML = pieceMarkup(i); seatEl.append(mark);
        const label = text(seatEl, 'strong', `${name(i, room)}${person.jailed ? ' · in Jail' : ''}`);
        label.title = name(i, room);
        text(seatEl, 'span', person.out ? 'Bankrupt' : cost(person.cash));
        if (person.cards.length) text(seatEl, 'small', `Jail cards: ${person.cards.length}`);
        bar.append(seatEl);
      });
      table.append(bar);
      const layout = document.createElement('div'); layout.className = 'bs-layout';
      const frame = document.createElement('div'); frame.className = 'bs-board-scroll';
      frame.tabIndex = 0; frame.setAttribute('aria-label', 'Business board, scroll to explore all forty spaces');
      const board = document.createElement('div'); board.className = 'bs-board';
      for (const space of BOARD) {
        const square = document.createElement('button');
        square.type = 'button';
        square.className = `bs-space bs-${space.kind}${inspected === space.id ? ' is-inspected' : ''}` +
          (recentMove?.to === space.id ? ' is-arrival' : '');
        square.dataset.space = String(space.id);
        square.setAttribute('aria-pressed', String(inspected === space.id));
        square.dataset.focus = `space-${space.id}`;
        square.setAttribute('aria-controls', 'bs-task');
        square.disabled = covered || rolling || pending;
        square.addEventListener('click', () => {
          inspected = space.id;
          propertyMode = 'all'; openPanel('inspect');
          table.querySelector('.bs-task')?.scrollIntoView({ block: 'nearest',
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        });
        square.style.gridRow = coords(space.id)[0]; square.style.gridColumn = coords(space.id)[1];
        if (space.group) square.style.setProperty('--deed-ink', GROUPS[space.group].color);
        const d = s.deeds[space.id];
        text(square, 'span', String(space.id).padStart(2, '0'), 'bs-square-number');
        const art = document.createElement('span'); art.className = 'bs-space-art';
        art.innerHTML = artMarkup(space.group || space.kind); square.append(art);
        text(square, 'strong', space.name);
        if (space.price) text(square, 'small', cost(space.price));
        if (d?.owner !== null && d) {
          const flag = text(square, 'span', `${name(d.owner, room)}${d.level === 5 ? ' · HOTEL' :
            d.level ? ` · ${d.level}H` : ''}${d.mortgaged ? ' · M' : ''}`, 'bs-owner');
          flag.style.setProperty('--seat-ink', colors[d.owner]);
        }
        square.setAttribute('aria-label', `${space.id}: ${space.name}${space.price ?
          `, price ${cost(space.price)}` : ''}${d?.owner !== null && d ?
            `, owned by ${name(d.owner, room)}${d.mortgaged ? ', mortgaged' : ''}${d.level ? `, ${d.level === 5 ? 'hotel' : `${d.level} houses`}` : ''}` : ''}`);
        const pieces = s.players.flatMap((person, i) => !person.out && person.position === space.id ? [i] : []);
        if (pieces.length) {
          square.setAttribute('aria-label', `${square.getAttribute('aria-label')}; here: ${pieces.map(i => name(i, room)).join(', ')}`);
          const tokens = document.createElement('span'); tokens.className = 'bs-tokens';
          for (const i of pieces) {
            const token = text(tokens, 'span', String(i + 1), 'bs-token');
            token.style.setProperty('--seat-ink', colors[i]);
            token.title = name(i, room);
            token.innerHTML = pieceMarkup(i);
          }
          square.append(tokens);
        }
        board.append(square);
      }
      const center = document.createElement('div'); center.className = 'bs-center';
      const crest = document.createElement('div'); crest.className = 'bs-center-crest';
      text(crest, 'span', 'भारत  ·  INDIA', 'bs-eyebrow');
      text(crest, 'strong', 'BUSINESS');
      text(crest, 'p', 'A city of opportunities');
      center.append(crest);
      text(center, 'small', `${s.houses}/32 houses · ${s.hotels}/12 hotels${s.options.jackpot ? ` · jackpot ${cost(s.jackpot)}` : ''}`, 'bs-bank-stock');
      board.append(center); frame.append(board);
      const sidebar = document.createElement('div'); sidebar.className = 'bs-priority';
      const task = document.createElement('section');
      task.id = 'bs-task'; task.className = 'bs-task game-ui-panel';
      const steps = document.createElement('ol'); steps.className = 'bs-steps';
      steps.setAttribute('aria-label', 'Turn progress');
      ['Roll', 'Resolve', 'Finish'].forEach((label, i) => {
        const step = text(steps, 'li', `${i + 1} ${label}`);
        if (i === flow.step) step.setAttribute('aria-current', 'step');
        if (i < flow.step) step.className = 'is-done';
      });
      sidebar.append(steps, task);
      if (panel !== 'turn') {
        task.append(button('← Back to turn', () => openPanel('turn'), true));
      }
      const actionPanel = document.createElement('section'); actionPanel.className = 'bs-actions game-ui-panel';
      text(actionPanel, 'span', s.phase === 'win' ? 'MATCH COMPLETE' :
        `TURN ${s.turns + 1}${s.options.turnLimit ? ` / ${s.options.turnLimit}` : ''}`, 'bs-eyebrow');
      text(actionPanel, 'h4', context === 'waiting' ? `Waiting for ${name(expected, room)}` : flow.title);
      if (!player.out && s.phase !== 'win')
        text(actionPanel, 'p', `Available cash · ${cost(player.cash)}`, 'bs-tip');
      const add = (label, move, quiet = false, actor = viewer) =>
        actionPanel.append(button(label, () => request(move, actor), quiet));
      if (can && context === 'trade-response') {
        const o = s.offer;
        text(actionPanel, 'p', `${name(o.from, room)} proposes:`);
        text(actionPanel, 'p', `You receive: ${tradeContents(o.offered, o.cashOut, o.cardsOut)}`);
        text(actionPanel, 'p', `You give: ${tradeContents(o.wanted, o.cashIn, o.cardsIn)}`);
        if (o.interestTo || o.interestFrom)
          text(actionPanel, 'p', `Bank transfer fees: you pay ${cost(o.interestTo)}, ${name(o.from, room)} pays ${cost(o.interestFrom)}.`, 'bs-tip');
        add('Accept trade', { type: 'accept' });
        add('Reject trade', { type: 'reject' }, true);
        actionPanel.append(button('Make a counteroffer', () => openPanel('trade'), true));
      } else if (can && context === 'trade-wait') {
        text(actionPanel, 'p', `Waiting for ${name(s.offer.to, room)} to respond. You may withdraw the offer.`);
        add('Withdraw offer', { type: 'cancel' }, true);
      } else if (can && expected === viewer) {
        if (s.phase === 'roll') {
          if (player.jailed) {
            text(actionPanel, 'p', 'Roll doubles to leave for free, or pay the fine before rolling.', 'bs-tip');
            if (player.cash >= s.options.jailFine)
              add(`Pay ${cost(s.options.jailFine)} · leave Jail`, { type: 'jail-fine' }, true);
            for (const card of player.cards) add(`Use ${card} jail card`, { type: 'jail-card', card }, true);
          }
          const b = button(player.jailed ? 'Roll for doubles ⚄' : 'Roll two dice ⚄', roll);
          b.classList.add('bs-roll');
          b.innerHTML = diceMarkup([1, 1], player.jailed ? 'Roll for doubles' : 'Roll two dice');
          actionPanel.append(b);
        } else if (s.phase === 'buy') {
          const id = s.players[s.current].position;
          text(actionPanel, 'p', `${BOARD[id].name} · ${cost(BOARD[id].price)}. Own it to collect rent when others land here.`, 'bs-tip');
          if (player.cash >= BOARD[id].price)
            add(`Buy ${BOARD[id].name} · ${cost(BOARD[id].price)}`, { type: 'buy' });
          else text(actionPanel, 'p', 'Not enough cash for direct purchase. Open bidding to all players instead.', 'bs-tip');
          add('Decline · open auction', { type: 'decline' }, true);
          actionPanel.append(button('View price & rents', () => {
            inspected = id; openPanel('inspect');
          }, true));
        } else if (s.phase === 'auction') {
          const a = s.auction;
          text(actionPanel, 'p', `${a.kind === 'deed' ? BOARD[a.id].name : `One ${a.kind}`} · highest ${cost(a.bid)}${a.bidder !== null ? ` by ${name(a.bidder, room)}` : ''}`);
          const buildings = a.kind === 'deed' ? [] : DEEDS.filter(id =>
            businessDeedActions(s, viewer, id).some(option =>
              option.move.type === 'build' && option.move.kind === a.kind));
          const minimum = Math.max(a.bid + 1, a.kind === 'deed' ? 1 :
            Math.min(...buildings.map(id => BOARD[id].cost)));
          if (minimum <= player.cash) {
            const [wrap, input] = number('Your bid (₹)', player.cash,
              Math.max(minimum, Number(previousBid) || 0));
            input.min = String(minimum);
            input.dataset.focus = 'auction-bid';
            actionPanel.append(wrap);
            actionPanel.append(button('Place bid', () => request({ type: 'bid', amount: Number(input.value) })));
          } else text(actionPanel, 'p', 'You cannot outbid with your current cash. Pass to continue.', 'bs-tip');
          add('Pass auction', { type: 'pass' }, true);
        } else if (s.phase === 'award') {
          const a = s.auction;
          const choices = businessAwardChoices(s, viewer);
          const [wrap, input] = select('Place the awarded building', choices.map(id => [id, BOARD[id].name]));
          actionPanel.append(wrap);
          actionPanel.append(button(`Build for ${cost(a.bid)}`, () =>
            request({ type: 'place-award', id: Number(input.value) })));
        } else if (s.phase === 'debt') {
          text(actionPanel, 'p', `Owed: ${cost(s.debt.amount)} · available: ${cost(player.cash)}`);
          if (player.cash >= s.debt.amount) add('Settle debt and continue', { type: 'pay-debt' });
          else {
            text(actionPanel, 'p', 'Sell buildings, mortgage, or arrange a trade to raise cash. You can also declare bankruptcy.', 'bs-tip');
            const canRaiseFromDeeds = DEEDS.some(id => s.deeds[id].owner === viewer &&
              (s.deeds[id].level > 0 || !s.deeds[id].mortgaged));
            actionPanel.append(button(canRaiseFromDeeds ? 'Raise cash from properties' :
              'Arrange a trade', () => {
                propertyMode = 'raise'; openPanel(canRaiseFromDeeds ? 'manage' : 'partner');
              }));
          }
          actionPanel.append(button('Declare bankruptcy…', () => {
            if (confirm('Declare bankruptcy? Buildings are liquidated and your deeds and cash transfer to your creditor (or bank auctions). This cannot be undone.'))
              request({ type: 'bankrupt' });
          }, true));
        } else if (s.phase === 'finish') {
          text(actionPanel, 'p', 'Your landing is resolved. End your turn, or optionally manage your properties.', 'bs-tip');
          add('End turn →', { type: 'end' });
        }
      } else if (s.phase === 'win') {
        const standings = document.createElement('dl'); standings.className = 'bs-standings';
        s.players.map((person, i) => ({ seat: i, worth: netWorth(s, i), out: person.out }))
          .sort((a, b) => b.worth - a.worth).forEach(({ seat, worth, out }) => {
            text(standings, 'dt', `${name(seat, room)}${s.winners.includes(seat) ? ' · Winner' : out ? ' · Bankrupt' : ''}`);
            text(standings, 'dd', cost(worth));
          });
        actionPanel.append(standings);
        text(actionPanel, 'p', 'Use New table to play again.', 'bs-tip');
      } else text(actionPanel, 'p', covered ? 'Reveal your actions after the phone is handed over.' :
        pending ? 'Waiting for the host to accept your move…' : 'Waiting for the highlighted player.', 'bs-tip');
      if (can && flow.manage) actionPanel.append(button('More actions', () => openPanel('options'), true));
      if (panel === 'turn') task.append(actionPanel);
      const info = businessSpaceDetails(s, inspected);
      const inspection = document.createElement('section');
      inspection.id = 'bs-inspector'; inspection.className = 'bs-inspector game-ui-panel';
      inspection.style.setProperty('--deed-ink', GROUPS[info.group]?.color ||
        (info.space.kind === 'fortune' ? '#cf8a61' : '#5a8d87'));
      const paper = document.createElement('div'); paper.className = 'bs-inspector-head';
      paper.innerHTML = artMarkup(info.group || info.space.kind);
      const caption = document.createElement('div');
      text(caption, 'span', `SPACE ${String(inspected).padStart(2, '0')}${info.group ? ` · ${info.group.toUpperCase()} DISTRICT` : ''}`, 'bs-eyebrow');
      text(caption, 'h4', info.space.name);
      paper.append(caption); inspection.append(paper);
      if (info.group) {
        const scene = document.createElement('div');
        scene.className = 'bs-deed-scene';
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = `<svg viewBox="0 0 240 112"><use href="./assets/business/districts.svg#${info.group}"></use></svg>`;
        inspection.append(scene);
      }
      if (info.space.price) {
        const highlights = document.createElement('div'); highlights.className = 'bs-deed-facts';
        text(highlights, 'strong', `Price ${cost(info.space.price)}`);
        text(highlights, 'span', `Mortgage ${cost(info.mortgage)}`);
        inspection.append(highlights);
        text(inspection, 'p', info.owner === null ? 'Available from the bank · buy or bid when you land here.' :
          `${name(info.owner, room)} owns this deed${info.mortgaged ? ' · mortgaged, no rent' :
            info.level === 5 ? ' · hotel' : info.level ? ` · ${info.level} house${info.level === 1 ? '' : 's'}` : ''}.`, 'bs-inspector-owner');
        if (info.space.kind === 'city') {
          text(inspection, 'p', `District: ${info.group} · ${info.groupCities.map(id => BOARD[id].name).join(' · ')}. ${info.unmortgaged ? 'Complete unmortgaged set · double undeveloped rent.' :
            info.complete ? 'Group mortgages suspend the undeveloped rent bonus.' :
              'Complete the unmortgaged set to double undeveloped rent.'} Each building ${cost(info.space.cost)}.`, 'bs-inspector-group');
          const rates = document.createElement('dl'); rates.className = 'bs-rent-grid';
          for (const { level, amount } of info.tiers) {
            const cell = document.createElement('div');
            if (info.owner !== null && level === info.level) cell.className = 'is-live';
            text(cell, 'dt', level === 0 ? 'Bare deed' : level === 5 ? 'Hotel' : `${level} house${level === 1 ? '' : 's'}`);
            text(cell, 'dd', cost(amount)); rates.append(cell);
          }
          inspection.append(rates);
        } else if (info.space.kind === 'transport') {
          text(inspection, 'p', 'Rent rises with the number of rail routes owned:', 'bs-tip');
          text(inspection, 'p', info.tiers.map(({ level, amount }) =>
            `${level + 1} route${level ? 's' : ''}: ${cost(amount)}`).join(' · '), 'bs-compact-tiers');
        } else {
          text(inspection, 'p', 'Rent depends on the arriving roll: one utility ×4, both utilities ×10.', 'bs-tip');
          if (info.owner !== null && !info.mortgaged)
            text(inspection, 'p', `Current roll would cost ${cost(rent(s, inspected))}.`, 'bs-compact-tiers');
        }
      } else {
        const details = info.space.kind === 'start' ? `Collect ${cost(s.options.salary)} when passing Start.` :
          info.space.kind === 'jail' ? `Just visiting, unless sent here. Jail fine: ${cost(s.options.jailFine)}.` :
            info.space.kind === 'go-jail' ? 'Move directly to Jail without collecting a salary.' :
              info.space.kind === 'tax' ? `Pay ${cost(info.space.id === 4 ? s.options.incomeTax : s.options.cityLevy)} to the bank.` :
                info.space.kind === 'rest' ? s.options.jackpot ?
                  `Take the fines jackpot: ${cost(s.jackpot)}.` : 'Take a breather. No fee and no bonus.' :
                  `Draw one ${info.space.kind === 'fund' ? 'City Fund' : 'Fortune'} card and resolve its effect.`;
        text(inspection, 'p', details, 'bs-tip');
      }
      const browse = document.createElement('div'); browse.className = 'bs-inspector-nav';
      for (const [label, nextId] of [['← Previous space', (inspected + 39) % 40],
        ['Next space →', (inspected + 1) % 40]]) {
        browse.append(button(label, () => {
          inspected = nextId; boardAnchor = nextId; render();
        }, true));
      }
      inspection.append(browse);
      if (panel === 'property') {
        browse.remove();
        inspection.querySelectorAll('.bs-deed-scene, .bs-rent-grid, .bs-inspector-group, .bs-compact-tiers')
          .forEach(node => node.remove());
        inspection.append(button('← Choose another property', () => openPanel('manage'), true));
      }
      if (panel === 'inspect' || panel === 'property') task.append(inspection);
      const portfolio = document.createElement('section'); portfolio.className = 'bs-portfolio';
      text(portfolio, 'h4', propertyMode === 'raise' ? 'Choose a property to raise cash' : 'Choose a property');
      const ownIds = DEEDS.filter(id => s.deeds[id].owner === viewer);
      text(portfolio, 'p', `Net worth ${cost(netWorth(s, viewer))} · ${ownIds.length} deeds · ${player.cards.length} jail cards`);
      if (!ownIds.length) text(portfolio, 'p', 'Buy deeds as you travel, or win them at auction.');
      for (const id of ownIds) {
        const d = s.deeds[id], sp = BOARD[id];
        const choices = businessDeedActions(s, viewer, id).filter(option =>
          propertyMode !== 'raise' || ['sell', 'mortgage'].includes(option.move.type));
        const canLiquidate = d.level > 0;
        if (propertyMode === 'raise' && !choices.length && !canLiquidate) continue;
        const row = button(`${sp.name} · ${d.mortgaged ? 'Mortgaged' :
          d.level === 5 ? 'Hotel' : d.level ? `${d.level} houses` : 'No buildings'} · ${sp.kind === 'city' ?
            `rent ${cost(rent(s, id))}` : 'rent varies'}`, () => {
          inspected = id; openPanel('property');
        }, true);
        row.style.setProperty('--deed-ink', GROUPS[sp.group]?.color || '#8f9ca9');
        portfolio.append(row);
      }
      if (canManage && info.owner === viewer) {
        if (panel === 'inspect') inspection.append(button('Manage this property', () => {
          propertyMode = 'all'; openPanel('property');
        }, true));
        if (panel === 'property') {
          const choices = businessDeedActions(s, viewer, inspected).filter(option =>
            propertyMode !== 'raise' || ['sell', 'mortgage'].includes(option.move.type));
          for (const option of choices)
            inspection.append(button(option.label, () => request(option.move), option.move.type !== 'build'));
          const hint = businessBuildHint(s, viewer, inspected);
          if (hint && propertyMode !== 'raise') text(inspection, 'p', hint, 'bs-tip');
          if (info.level > 0) inspection.append(button(`Sell all ${info.group} buildings…`, () => {
            if (confirm(`Sell every building in the ${info.group} group for half its building cost?`))
              request({ type: 'liquidate', group: info.group });
          }, true));
          if (!choices.length && !info.level) text(inspection, 'p', 'No property actions are available right now.', 'bs-tip');
        }
      }
      if (panel === 'manage') task.append(portfolio);
      const trade = document.createElement('section'); trade.className = 'bs-trade';
      text(trade, 'h4', panel === 'partner' ? '1 · Choose a trade partner' :
        panel === 'review' ? '3 · Review your offer' : '2 · Set the trade terms');
      if (can && flow.trade &&
        (s.phase !== 'auction' && s.phase !== 'award') && (!s.offer || s.offer.to === viewer)) {
        const form = document.createElement('form'); form.className = 'bs-trade-form';
        form.dataset.seat = String(viewer); form.dataset.round = String(round);
        const counter = Boolean(s.offer), targets = s.players.flatMap((other, i) =>
          i !== viewer && !other.out && (!counter || i === s.offer.from) ? [[i, name(i, room)]] : []);
        const draft = tradeDrafts.get(viewer);
        const [toLabel, to] = select('Trade partner', targets); form.append(toLabel);
        if (targets.some(([id]) => String(id) === draft?.to)) to.value = draft.to;
        to.dataset.bsField = 'to';
        to.dataset.focus = 'trade-partner';
        if (panel === 'partner') {
          trade.append(toLabel);
          trade.append(button('Next · set terms', () => {
            tradeDrafts.set(viewer, { to: to.value, offered: [], wanted: [] });
            openPanel('trade');
          }));
        }
        toLabel.hidden = true;
        if (panel === 'partner') toLabel.hidden = false;
        text(form, 'p', `Trading with ${name(Number(to.value), room)}. Only unimproved deeds can be traded.`, 'bs-tip');
        const [outLabel, cashOut] = number('Your cash to give (₹)', player.cash, Number(draft?.cashOut || 0)); form.append(outLabel);
        const [inLabel, cashIn] = number('Cash requested (₹)', 1e7, Number(draft?.cashIn || 0)); form.append(inLabel);
        const [cardsOutLabel, cardsOut] = number('Your jail cards to give', player.cards.length,
          Math.min(player.cards.length, Number(draft?.cardsOut || 0))); form.append(cardsOutLabel);
        const partnerCards = s.players[Number(to.value)].cards.length;
        const [cardsInLabel, cardsIn] = number('Jail cards requested', partnerCards,
          Math.min(partnerCards, Number(draft?.cardsIn || 0))); form.append(cardsInLabel);
        for (const [field, input] of [['cashOut', cashOut], ['cashIn', cashIn],
          ['cardsOut', cardsOut], ['cardsIn', cardsIn]]) {
          input.dataset.bsField = field; input.dataset.focus = `trade-${field}`;
        }
        cardsOutLabel.hidden = !player.cards.length;
        cardsInLabel.hidden = !s.players[Number(to.value)].cards.length;
        const giving = document.createElement('fieldset'); const legendGive = document.createElement('legend');
        legendGive.textContent = 'Your deeds to give'; giving.append(legendGive);
        const asking = document.createElement('fieldset'); const legendAsk = document.createElement('legend');
        legendAsk.textContent = 'Deeds to request'; asking.append(legendAsk);
        const check = (id, field) => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'checkbox'; input.value = String(id);
          input.dataset.focus = `trade-deed-${id}`;
          input.dataset[field === giving ? 'bsGive' : 'bsWant'] = 'true';
          input.checked = (field === giving ? draft?.offered : draft?.wanted)?.includes(id) || false;
          label.append(input, document.createTextNode(` ${BOARD[id].name}${s.deeds[id].mortgaged ? ' (mortgaged)' : ''}`));
          field.append(label);
        };
        const fill = () => {
          giving.replaceChildren(legendGive); asking.replaceChildren(legendAsk);
          for (const id of DEEDS) {
            const group = BOARD[id].group;
            if (group && DEEDS.some(x => BOARD[x].group === group && s.deeds[x].level)) continue;
            if (s.deeds[id].owner === viewer) check(id, giving);
            else if (s.deeds[id].owner === Number(to.value)) check(id, asking);
          }
        };
        to.addEventListener('change', () => {
          if (draft) draft.wanted = [];
          fill();
        });
        fill();
        if (giving.querySelector('input')) form.append(giving);
        if (asking.querySelector('input')) form.append(asking);
        const submit = button('Next · review offer', () => {
          if (form.reportValidity()) openPanel('review');
        });
        form.append(submit);
        if (panel === 'trade') trade.append(form);
        if (panel === 'review' && draft) {
          text(trade, 'p', `To ${name(Number(draft.to), room)}`);
          text(trade, 'p', `You give: ${tradeContents(draft.offered, Number(draft.cashOut), Number(draft.cardsOut))}`);
          text(trade, 'p', `You receive: ${tradeContents(draft.wanted, Number(draft.cashIn), Number(draft.cardsIn))}`);
          if ([...draft.offered, ...draft.wanted].some(id => s.deeds[id].mortgaged))
            text(trade, 'p', 'The new owner pays 10% of the mortgage principal for each mortgaged deed.', 'bs-tip');
          trade.append(button(counter ? 'Send counteroffer' : 'Send offer', () => {
            request({ type: counter ? 'counter' : 'offer', to: Number(draft.to),
              offered: draft.offered, wanted: draft.wanted, cashOut: Number(draft.cashOut),
              cashIn: Number(draft.cashIn), cardsOut: Number(draft.cardsOut), cardsIn: Number(draft.cardsIn) });
          }));
          trade.append(button('← Edit terms', () => openPanel('trade'), true));
        }
        form.addEventListener('submit', event => { event.preventDefault(); submit.click(); });
      }
      if (['partner', 'trade', 'review'].includes(panel)) task.append(trade);
      if (panel === 'options') {
        text(task, 'h4', 'What would you like to do?');
        if (canManage && ownIds.length) task.append(button('Manage properties', () => {
          propertyMode = s.phase === 'debt' ? 'raise' : 'all'; openPanel('manage');
        }, true));
        if (can && flow.trade) task.append(button('Trade with a player', () => openPanel('partner'), true));
        if (!room && canManage) task.append(button('Pass phone to another player', () => openPanel('players'), true));
        task.append(button('Explore the board', () => {
          inspected = s.players[s.current].position; openPanel('inspect');
        }, true));
      }
      if (!room && panel === 'players') {
        text(task, 'h4', 'Who needs the phone?');
        text(task, 'p', 'The turn stays with the current player. Pass back when property management is done.');
        for (let i = 0; i < seats; i++) {
          if (i !== viewer && !s.players[i].out)
            task.append(button(`Hand to ${name(i, room)}`, () => {
              localViewer = i; covered = true; openPanel('turn');
            }, true));
        }
      }
      if (panel === 'history') {
        text(task, 'h4', 'Recent events');
        for (const entry of s.log) text(task, 'p', entry);
      }
      if (pending && panel !== 'turn')
        text(task, 'p', 'Waiting for the host to accept your move…', 'bs-tip').setAttribute('role', 'status');
      if (pending) task.querySelectorAll('button').forEach(node => { node.disabled = true; });
      task.querySelectorAll('h4').forEach(heading => {
        heading.tabIndex = -1; heading.dataset.focus = 'task-heading';
      });
      layout.append(sidebar, frame); table.append(layout);
      table.querySelectorAll('input, select').forEach(node => {
        node.disabled = !can;
      });
      restoreFocus(key, scroll, !oldScroll);
      boardSize = `${frame.clientWidth},${frame.clientHeight}`;
      boardResize.observe(frame);
    }
    function publish() {
      try { persist(); } catch (e) { errorText = e.message; room?.error(e); }
      render();
    }
    const off = room?.on(event => {
      if (disposed || room.activeGame?.id !== 'business') return;
      if (event.type === 'reconnected' && room.role === 'guest') {
        room.sendAction({ type: 'bs-sync' }); return;
      }
      if (event.type === 'state') { render(); return; }
      if (event.type !== 'action') return;
      const a = event.action;
      if (room.role === 'host') {
        if (a?.type === 'bs-sync') {
          const i = room.activeGame.playerIds.indexOf(event.from);
          if (i > 0) room.sendPrivateAction(event.from, { type: 'bs-state', view: publicBusiness(state), round });
        } else if (a?.type === 'bs-request') {
          const i = room.activeGame.playerIds.indexOf(event.from);
          let rejection = null;
          try {
            if (rolling && a.move?.type !== 'roll')
              throw new Error('Wait for the dice to settle before another move.');
            if (room.activeGame.playerIds.some((id, index) =>
              !state.players[index].out && !room.members.find(m => m.id === id)?.connected))
              throw new Error('A remaining player is disconnected; wait for reconnection.');
            const oldPhase = state.phase;
            const dice = a.move?.type === 'roll' && event.from === room.peerId && hostDice ?
              hostDice : null;
            hostDice = null;
            const before = state;
            state = applyRemoteBusinessAction(state, a, round, event.from,
              room.activeGame.playerIds, dice);
            highlight(before, state);
            pending = false;
            if (oldPhase !== 'win' && state.phase === 'win') {
              room.recordResult(game.id, state.winners.length > 1 ? state.winners : state.winner, round);
              if (state.winners.includes(mySeat)) celebrate(shell.root, state.winners.length > 1 ?
                `${state.winners.map(i => name(i, room)).join(' & ')} share the win!` :
                `${name(mySeat, room)} wins Business!`);
            }
            errorText = ''; revision = state.revision; publish();
          } catch (e) { rejection = e.message; }
          if (rejection) {
            if (i > 0) room.sendPrivateAction(event.from,
              { type: 'bs-reject', revision, round, message: rejection, view: publicBusiness(state) });
            else { pending = false; errorText = rejection; render(); }
          }
        } else if (a?.type === 'bs-reset' && event.from === room.peerId) {
          cancelRoll(); pending = false;
          state = createBusiness(seats, state.options); round++;
          panel = 'turn'; focusPanel = true; tradeDrafts.clear();
          boardAnchor = inspected = 0; recentMove = null; latestCard = null; cashBefore = null;
          revision = state.revision; shell.root.querySelector('.arcade-victory')?.remove();
          publish();
        }
      } else if (event.from === room.activeGame.playerIds[0] &&
          ['bs-state', 'bs-reject'].includes(a?.type)) {
        if (!validBusinessSnapshot(a, seats, round, revision)) {
          errorText = 'Invalid or stale host snapshot ignored.'; render(); return;
        }
        if (a.round > round) {
          cancelRoll(); recentMove = null; latestCard = null;
          panel = 'turn'; focusPanel = true; tradeDrafts.clear();
          boardAnchor = inspected = a.view.players[a.view.current].position;
        } else highlight(view, a.view);
        round = a.round; revision = a.view.revision; view = a.view;
        pending = false; errorText = a.type === 'bs-reject' ? a.message : '';
        render();
      }
    });
    function reset() {
      if (room) { if (room.role === 'host') requestReset(); return; }
      cancelRoll(); pending = false;
      panel = 'turn'; focusPanel = true; tradeDrafts.clear();
      state = createBusiness(seats, state.options); view = publicBusiness(state);
      boardAnchor = inspected = 0; recentMove = null; latestCard = null; cashBefore = null;
      localViewer = 0; covered = true; errorText = ''; round++;
      shell.root.querySelector('.arcade-victory')?.remove();
      persist(); render();
    }
    function requestReset() {
      try { room.sendAction({ type: 'bs-reset' }); } catch (e) { errorText = e.message; render(); }
    }
    shell.getResetButton().addEventListener('click', event => {
      if (!confirm('Start a new Business table? All current cash, deeds and progress will be lost.')) {
        event.stopImmediatePropagation();
        return;
      }
      reset();
    }, { capture: true });
    if (room && room.role !== 'host') shell.getResetButton().disabled = true;
    if (room) {
      if (room.role === 'host') publish();
      else room.sendAction({ type: 'bs-sync' });
    } else persist();
    render();
    return { dispose: () => {
      disposed = true; cancelRoll(); off?.(); boardResize.disconnect();
      session?.stop(); shell.root.remove();
    } };
  },
};
