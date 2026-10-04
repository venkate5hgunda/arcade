import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { playerName } from '../js/player-names.js';
import { createTurnIndicator } from '../js/turn-indicator.js';
import { rollDiceValues, diceMarkup, rollDice, pauseAfterRoll } from '../js/dice.js';
import { celebrate } from '../js/celebration.js';
import { BOARD, DEEDS, GROUPS, DEFAULT_OPTIONS, createBusiness, actBusiness,
  actors, validBusiness, publicBusiness, netWorth } from './business-engine.js';

const format = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const cost = n => format.format(n);
const coords = id => id < 10 ? [11, 11 - id] : id < 20 ?
  [11 - (id - 10), 1] : id < 30 ? [1, id - 19] : [id - 29, 11];
const name = (index, room) => playerName(index, room);
const colors = ['#de7e64', '#50a9cd', '#dab757', '#a790d6', '#6aba99', '#e789ac'];
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
    !request || Object.keys(request).sort().join(',') !== 'move,revision,round' ||
    request.revision !== state.revision || request.round !== round ||
    !Array.isArray(playerIds) || new Set(playerIds).size !== playerIds.length ||
    !validBusinessMove(request.move)) throw new Error('Stale or invalid move. Table refreshed.');
  const actor = playerIds.indexOf(from);
  if (actor < 0) throw new Error('This seat is not playing.');
  const roll = request.move.type === 'roll' ? { dice: dice || rollDiceValues(2) } : {};
  return actBusiness(state, { ...request.move, ...roll }, actor);
}
function button(text, action, quiet = false) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `bs-button${quiet ? ' bs-button--quiet' : ''}`;
  b.textContent = text; b.addEventListener('click', action);
  return b;
}
function details(title, className) {
  const d = document.createElement('details');
  d.className = className;
  d.innerHTML = `<summary>${title}</summary>`;
  return d;
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
        <h3>Make your move.</h3><p>Trade Indian cities, collect rent and build an empire together.</p>
        <button class="bs-button bs-online" type="button">Create or join an online room ↗</button>
        <button class="bs-button bs-button--quiet bs-local" type="button">Pass &amp; play on this phone</button>
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
          { key: 'rollToStart', label: 'Opening roll', default: 'false', help: 'Optional traditional variant: roll a total of 12 to enter; unsuccessful rolls end your turn.',
            options: [['false', 'Start immediately'], ['true', 'Roll 12 to enter']].map(([value, label]) => ({ value, label })) },
          { key: 'auctionOnly', label: 'Unowned deeds', default: 'false',
            options: [['false', 'Buy or auction'], ['true', 'Auction every deed']].map(([value, label]) => ({ value, label })) },
          { key: 'jackpot', label: 'Rest Stop', default: 'false', help: 'House rule: bank fees collect in a pool won on Rest Stop.',
            options: [['false', 'Neutral'], ['true', 'Fines jackpot']].map(([value, label]) => ({ value, label })) },
          { key: 'exactStartBonus', label: 'Exact Start', default: 'false',
            options: [['false', 'Normal salary'], ['true', 'Extra salary']].map(([value, label]) => ({ value, label })) },
          { key: 'incomeTax', label: 'Income tax', default: '200', help: 'Published editions conflict; choose an explicit house amount.',
            options: [['200', '₹200'], ['2000', '₹2,000']].map(([value, label]) => ({ value, label })) },
          { key: 'jailFine', label: 'Jail fine', default: '500', help: '₹500 is this Arcade edition’s default, not an official fixed amount.',
            options: [['200', '₹200'], ['500', '₹500']].map(([value, label]) => ({ value, label })) },
          { key: 'turnLimit', label: 'Game length', default: '0', help: 'Optional total completed-turn cap; compare net worth, ties are shared.',
            options: [['0', 'Play to last solvent'], ['30', '30 turns'], ['60', '60 turns'], ['120', '120 turns']].map(([value, label]) => ({ value, label })) },
        ],
      });
    const options = setting ? { ...DEFAULT_OPTIONS,
      rollToStart: setting.rollToStart === 'true', auctionOnly: setting.auctionOnly === 'true',
      jackpot: setting.jackpot === 'true', exactStartBonus: setting.exactStartBonus === 'true',
      incomeTax: Number(setting.incomeTax), jailFine: Number(setting.jailFine),
      turnLimit: Number(setting.turnLimit) } : null;
    const seats = room ? count : localCheckpoint?.players.length || Number(setting.count);
    let state = room?.role === 'guest' ? null : structuredClone(roomSave?.state || localCheckpoint || createBusiness(seats, options || {}));
    let view = state && publicBusiness(state);
    let round = roomSave?.round ?? 0, revision = state?.revision ?? -1;
    let disposed = false, rolling = false, pending = false, covered = !room, hostDice = null;
    let localViewer = state?.current ?? 0, errorText = '';
    const tradeDrafts = new Map();
    let controller = new AbortController();
    const table = document.createElement('div');
    table.className = 'bs-table';
    shell.stage.append(table);
    shell.root.querySelector('.game-meta').textContent = room ?
      `Private room · ${seats} players · seat ${mySeat + 1}` : `${seats} players · same-phone play`;
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
        const prev = state.phase, oldCurrent = state.current, oldActor = actors(state)[0];
        state = actBusiness(state, move, actor);
        errorText = ''; persist();
        if (state.phase === 'win' && prev !== 'win' && state.winner !== null)
          celebrate(shell.root, `${name(state.winner, room)} wins Business!`);
        const nextActor = state.offer?.to ?? actors(state)[0];
        if (nextActor !== undefined && nextActor !== localViewer &&
          (nextActor !== oldActor || oldCurrent !== state.current)) {
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
      rolling = true;
      try {
        if (node && await rollDice(node, controller.signal, values) &&
          await pauseAfterRoll(controller.signal) && !disposed)
          if (room) { hostDice = values; request({ type: 'roll' }); }
          else request({ type: 'roll', dice: values });
      } catch (e) { errorText = e.message; render(); }
      finally { rolling = false; if (!disposed) render(); }
    }
    function restoreFocus(key, open, scroll) {
      for (const [className, isOpen] of open) {
        const d = table.querySelector(className);
        if (d) d.open = isOpen;
      }
      const viewport = table.querySelector('.bs-board-scroll');
      if (viewport) { viewport.scrollLeft = scroll[0]; viewport.scrollTop = scroll[1]; }
      if (key) (table.querySelector(`[data-focus="${key}"]`) ||
        table.querySelector('.bs-handoff button, .bs-actions button:not(:disabled)'))?.focus({ preventScroll: true });
    }
    function render() {
      if (disposed) return;
      const open = [...table.querySelectorAll('details')].map(d =>
        [`.${d.classList[0]}`, d.open]);
      const key = table.contains(document.activeElement) ? document.activeElement.dataset.focus : null;
      const previousForm = table.querySelector('.bs-trade-form');
      if (previousForm) {
        const values = Object.fromEntries([...previousForm.querySelectorAll('[data-bs-field]')]
          .map(input => [input.dataset.bsField, input.value]));
        values.offered = [...previousForm.querySelectorAll('[data-bs-give]:checked')].map(input => Number(input.value));
        values.wanted = [...previousForm.querySelectorAll('[data-bs-want]:checked')].map(input => Number(input.value));
        tradeDrafts.set(room ? mySeat : localViewer, values);
      }
      const previousBid = table.querySelector('.bs-actions input')?.value;
      const oldScroll = table.querySelector('.bs-board-scroll');
      const scroll = [oldScroll?.scrollLeft || 0, oldScroll?.scrollTop || 0];
      table.replaceChildren();
      const s = view;
      if (!s) { text(table, 'p', 'Waiting for the host to restore the table…'); return; }
      const expected = s.offer?.to ?? actors(s)[0];
      const viewer = room ? mySeat : localViewer;
      const player = s.players[viewer];
      const disconnected = room && room.activeGame.playerIds.some((id, i) =>
        !s.players[i].out && !room.members.find(m => m.id === id)?.connected);
      const can = !covered && !pending && !rolling && !disconnected && !player.out &&
        s.phase !== 'win';
      const canManage = can && (s.phase !== 'debt' || s.debt.from === viewer);
      showTurn(s.current, s.phase !== 'win');
      const top = document.createElement('header'); top.className = 'bs-top';
      text(top, 'p', 'BUSINESS  /  INDIAN CITY EDITION', 'bs-eyebrow');
      text(top, 'h3', s.phase === 'win' ?
        (s.winners.length > 1 ? `${s.winners.map(i => name(i, room)).join(' & ')} share the win` :
          `${name(s.winner, room)} owns the city`) :
        `${name(s.current, room)}’s turn · ${s.phase === 'auction' ? 'Auction' :
          s.phase === 'debt' ? 'Payment due' : s.phase === 'award' ? 'Place building' :
            s.phase === 'buy' ? 'Property offer' : s.phase === 'finish' ? 'Manage or end turn' : 'Roll'}`);
      text(top, 'p', s.message, 'bs-message').setAttribute('role', 'status');
      if (s.dice) text(top, 'p', `Last roll · ${s.dice[0]} + ${s.dice[1]} = ${s.dice[0] + s.dice[1]}`, 'bs-last-roll');
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
            s.phase === 'debt' ? 'Settle your payment or raise cash.' : 'Keep your choices private until you take the phone.');
        veil.append(button(`I am ${name(viewer, room)} · reveal my actions`, () => {
          covered = false; render();
        }));
        table.append(veil);
      }
      const bar = document.createElement('div'); bar.className = 'bs-seats';
      s.players.forEach((person, i) => {
        const seatEl = document.createElement('div');
        seatEl.className = `bs-seat${i === s.current ? ' is-current' : ''}${person.out ? ' is-out' : ''}`;
        seatEl.style.setProperty('--seat-ink', colors[i]);
        const label = text(seatEl, 'strong', `${i + 1} · ${name(i, room)}${person.jailed ? ' 🔒' : ''}`);
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
        const square = document.createElement('div');
        square.className = `bs-space bs-${space.kind}`;
        square.setAttribute('role', 'group');
        square.style.gridRow = coords(space.id)[0]; square.style.gridColumn = coords(space.id)[1];
        if (space.group) square.style.setProperty('--deed-ink', GROUPS[space.group].color);
        const d = s.deeds[space.id];
        text(square, 'span', String(space.id).padStart(2, '0'), 'bs-square-number');
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
          const tokens = document.createElement('span'); tokens.className = 'bs-tokens';
          for (const i of pieces) {
            const token = text(tokens, 'span', String(i + 1), 'bs-token');
            token.style.setProperty('--seat-ink', colors[i]);
            token.title = name(i, room);
          }
          square.append(tokens);
        }
        board.append(square);
      }
      const center = document.createElement('div'); center.className = 'bs-center';
      text(center, 'span', 'भारत  ·  INDIA', 'bs-eyebrow');
      text(center, 'strong', 'BUSINESS');
      text(center, 'p', 'Build your city. Make your fortune.');
      text(center, 'small', `${s.houses}/32 houses · ${s.hotels}/12 hotels available${s.options.jackpot ? ` · jackpot ${cost(s.jackpot)}` : ''}`);
      board.append(center); frame.append(board); layout.append(frame);
      const sidebar = document.createElement('aside'); sidebar.className = 'bs-sidebar';
      const actionPanel = document.createElement('section'); actionPanel.className = 'bs-actions';
      text(actionPanel, 'h4', 'Your next move');
      const add = (label, move, quiet = false, actor = viewer) =>
        actionPanel.append(button(label, () => request(move, actor), quiet));
      if (can && expected === viewer) {
        if (s.phase === 'roll') {
          if (player.jailed) {
            add(`Pay ${cost(s.options.jailFine)} · leave Jail`, { type: 'jail-fine' }, true);
            for (const card of player.cards) add(`Use ${card} jail card`, { type: 'jail-card', card }, true);
          }
          const b = button(player.jailed ? 'Roll for doubles ⚄' : 'Roll two dice ⚄', roll);
          b.classList.add('bs-roll');
          b.innerHTML = diceMarkup([1, 1], player.jailed ? 'Roll for doubles' : 'Roll two dice');
          actionPanel.append(b);
        } else if (s.phase === 'buy') {
          const id = s.players[s.current].position;
          add(`Buy ${BOARD[id].name} · ${cost(BOARD[id].price)}`, { type: 'buy' });
          add('Decline · open auction', { type: 'decline' }, true);
        } else if (s.phase === 'auction') {
          const a = s.auction;
          text(actionPanel, 'p', `${a.kind === 'deed' ? BOARD[a.id].name : `One ${a.kind}`} · highest ${cost(a.bid)}${a.bidder !== null ? ` by ${name(a.bidder, room)}` : ''}`);
          const [wrap, input] = number('Your bid (₹)', player.cash,
            Math.max(a.bid + 1, Number(previousBid) || 0));
          actionPanel.append(wrap);
          actionPanel.append(button('Place bid', () => request({ type: 'bid', amount: Number(input.value) })));
          add('Pass auction', { type: 'pass' }, true);
        } else if (s.phase === 'award') {
          const a = s.auction;
          const choices = DEEDS.filter(id => s.deeds[id].owner === viewer &&
            BOARD[id].group && s.deeds[id].level === (a.kind === 'hotel' ? 4 :
              Math.min(...DEEDS.filter(x => BOARD[x].group === BOARD[id].group).map(x => s.deeds[x].level))) &&
            s.deeds[id].level < (a.kind === 'hotel' ? 5 : 4));
          const [wrap, input] = select('Place the awarded building', choices.map(id => [id, BOARD[id].name]));
          actionPanel.append(wrap);
          actionPanel.append(button(`Build for ${cost(a.bid)}`, () =>
            request({ type: 'place-award', id: Number(input.value) })));
        } else if (s.phase === 'debt') {
          text(actionPanel, 'p', `Owed: ${cost(s.debt.amount)} · available: ${cost(player.cash)}`);
          if (player.cash >= s.debt.amount) add('Settle debt and continue', { type: 'pay-debt' });
          else text(actionPanel, 'p', 'Open Your portfolio below to sell buildings, mortgage, or trade. You can also declare bankruptcy.', 'bs-tip');
          actionPanel.append(button('Declare bankruptcy…', () => {
            if (confirm('Declare bankruptcy? Buildings are liquidated and your deeds and cash transfer to your creditor (or bank auctions). This cannot be undone.'))
              request({ type: 'bankrupt' });
          }, true));
        } else if (s.phase === 'finish') add('End turn →', { type: 'end' });
      } else if (s.phase === 'win') {
        text(actionPanel, 'p', 'The match has ended. Open a new table to play again.');
      } else text(actionPanel, 'p', covered ? 'Reveal your actions after the phone is handed over.' :
        pending ? 'Waiting for the host to accept your move…' : 'Waiting for the highlighted player.', 'bs-tip');
      sidebar.append(actionPanel);
      const portfolio = details('Your portfolio · build, sell & mortgage', 'bs-portfolio');
      const ownIds = DEEDS.filter(id => s.deeds[id].owner === viewer);
      text(portfolio, 'p', `Net worth ${cost(netWorth(s, viewer))} · ${ownIds.length} deeds · ${player.cards.length} jail cards`);
      if (!ownIds.length) text(portfolio, 'p', 'Buy deeds as you travel, or win them at auction.');
      for (const id of ownIds) {
        const d = s.deeds[id], sp = BOARD[id];
        const row = document.createElement('div'); row.className = 'bs-deed';
        row.style.setProperty('--deed-ink', GROUPS[sp.group]?.color || '#8f9ca9');
        text(row, 'strong', `${sp.name} · ${cost(sp.price)}`);
        text(row, 'small', `${d.mortgaged ? 'Mortgaged · no rent' :
          d.level === 5 ? 'Hotel' : d.level ? `${d.level} houses` : 'No buildings'} · ${sp.kind === 'city' ?
            `rent ${cost(sp.rent[d.level] * (d.level ? 1 : DEEDS.filter(x => BOARD[x].group === sp.group).every(x => s.deeds[x].owner === viewer) ? 2 : 1))}` : 'rent varies'}`);
        const buttons = document.createElement('div'); buttons.className = 'bs-deed-actions';
        if (canManage && !s.offer && !['auction', 'award'].includes(s.phase)) {
          const act = (caption, move) => buttons.append(button(caption, () => request(move), true));
          if (d.level > 0) act('Sell building', { type: 'sell', id });
          if (sp.group && d.level < 5) act(d.level === 4 ? 'Build hotel' : 'Build house',
            { type: 'build', id, kind: d.level === 4 ? 'hotel' : 'house' });
          act(d.mortgaged ? `Repay ${cost(Math.ceil(sp.price * .55))}` : `Mortgage +${cost(sp.price / 2)}`,
            { type: d.mortgaged ? 'release' : 'mortgage', id });
        }
        row.append(buttons); portfolio.append(row);
      }
      if (canManage && !s.offer && !['auction', 'award'].includes(s.phase)) {
        for (const group of Object.keys(GROUPS)) {
          if (DEEDS.some(id => BOARD[id].group === group && s.deeds[id].owner === viewer && s.deeds[id].level > 0))
            portfolio.append(button(`Liquidate all ${group} buildings`, () => request({ type: 'liquidate', group }), true));
        }
      }
      sidebar.append(portfolio);
      const trade = details('Trade with another player', 'bs-trade');
      if (s.offer) {
        const o = s.offer;
        text(trade, 'p', `${name(o.from, room)} offers ${o.offered.map(id => BOARD[id].name).join(', ') || 'no deeds'} and ${cost(o.cashOut)}${o.cardsOut ? ` + ${o.cardsOut} jail card(s)` : ''} for ${o.wanted.map(id => BOARD[id].name).join(', ') || 'no deeds'} and ${cost(o.cashIn)}${o.cardsIn ? ` + ${o.cardsIn} jail card(s)` : ''}. Mortgaged deed transfers cost the new owner 10% interest.`);
        if (can && viewer === o.to) {
          trade.append(button('Accept trade', () => request({ type: 'accept' })));
          trade.append(button('Reject trade', () => request({ type: 'reject' }), true));
        }
        if (can && viewer === o.from) trade.append(button('Withdraw offer', () => request({ type: 'cancel' }), true));
      }
      if ((canManage || can && s.offer?.to === viewer) &&
        (s.phase !== 'auction' && s.phase !== 'award') && (!s.offer || s.offer.to === viewer)) {
        const form = document.createElement('form'); form.className = 'bs-trade-form';
        const counter = Boolean(s.offer), targets = s.players.flatMap((other, i) =>
          i !== viewer && !other.out && (!counter || i === s.offer.from) ? [[i, name(i, room)]] : []);
        const draft = tradeDrafts.get(viewer);
        const [toLabel, to] = select('Trade partner', targets); form.append(toLabel);
        if (targets.some(([id]) => String(id) === draft?.to)) to.value = draft.to;
        to.dataset.bsField = 'to';
        const [outLabel, cashOut] = number('Your cash to give (₹)', player.cash, Number(draft?.cashOut || 0)); form.append(outLabel);
        const [inLabel, cashIn] = number('Cash requested (₹)', 1e7, Number(draft?.cashIn || 0)); form.append(inLabel);
        const [cardsOutLabel, cardsOut] = number('Your jail cards to give', player.cards.length, Number(draft?.cardsOut || 0)); form.append(cardsOutLabel);
        const [cardsInLabel, cardsIn] = number('Jail cards requested', 2, Number(draft?.cardsIn || 0)); form.append(cardsInLabel);
        for (const [field, input] of [['cashOut', cashOut], ['cashIn', cashIn],
          ['cardsOut', cardsOut], ['cardsIn', cardsIn]]) input.dataset.bsField = field;
        const giving = document.createElement('fieldset'); const legendGive = document.createElement('legend');
        legendGive.textContent = 'Your deeds to give'; giving.append(legendGive);
        const asking = document.createElement('fieldset'); const legendAsk = document.createElement('legend');
        legendAsk.textContent = 'Deeds to request'; asking.append(legendAsk);
        const check = (id, field) => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'checkbox'; input.value = String(id);
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
        form.append(giving, asking);
        const submit = button(counter ? 'Send counteroffer' : 'Propose trade', () => {
          const selected = field => [...field.querySelectorAll('input:checked')].map(x => Number(x.value));
          request({ type: counter ? 'counter' : 'offer', to: Number(to.value),
            offered: selected(giving), wanted: selected(asking), cashOut: Number(cashOut.value),
            cashIn: Number(cashIn.value), cardsOut: Number(cardsOut.value), cardsIn: Number(cardsIn.value) });
        });
        form.append(submit); trade.append(form);
        form.addEventListener('submit', event => { event.preventDefault(); submit.click(); });
      }
      sidebar.append(trade);
      if (!room) {
        const switcher = details('Pass device · manage another portfolio', 'bs-switch');
        text(switcher, 'p', 'Non-turn players may trade or manage their deeds. Every switch requires a handoff.');
        for (let i = 0; i < seats; i++) {
          if (i !== viewer && !s.players[i].out)
            switcher.append(button(`Hand to ${name(i, room)}`, () => {
              localViewer = i; covered = true; render();
            }, true));
        }
        sidebar.append(switcher);
      }
      const rules = details('Rules, variants & source notes', 'bs-rules');
      text(rules, 'p', 'Arcade house edition: ₹15,000 opening cash, ₹1,500 Start salary, 2d6 and a bonus roll for doubles. Three doubles send you directly to Jail. No rent on mortgaged deeds. Buy unowned deeds or auction to all players; build evenly on complete sets. Jailed players collect rent and may trade. Third failed jail roll costs the fine, then moves. Rest Stop is neutral by default.');
      text(rules, 'p', 'This is an original city board, not a reproduction of a manufacturer board. Cash-based Business sources disagree about taxes, jail, clubs and starting rolls. The current Funskool Gold Quest is a different resource game. See README for full Arcade rules and source links.');
      sidebar.append(rules);
      const journal = details('Recent events', 'bs-history');
      for (const entry of s.log) text(journal, 'p', entry);
      sidebar.append(journal);
      layout.append(sidebar); table.append(layout);
      table.querySelectorAll('button, input, select, summary').forEach((node, i) => {
        node.dataset.focus = String(i);
      });
      restoreFocus(key, open, scroll);
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
            if (room.activeGame.playerIds.some((id, index) =>
              !state.players[index].out && !room.members.find(m => m.id === id)?.connected))
              throw new Error('A remaining player is disconnected; wait for reconnection.');
            const oldPhase = state.phase;
            const dice = a.move?.type === 'roll' && event.from === room.peerId && hostDice ?
              hostDice : null;
            hostDice = null;
            state = applyRemoteBusinessAction(state, a, round, event.from,
              room.activeGame.playerIds, dice);
            pending = false;
            if (oldPhase !== 'win' && state.phase === 'win') {
              room.recordResult(game.id, state.winner, round);
              if (state.winner === mySeat) celebrate(shell.root, `${name(mySeat, room)} wins Business!`);
            }
            errorText = ''; revision = state.revision; publish();
          } catch (e) { rejection = e.message; }
          if (rejection) {
            if (i > 0) room.sendPrivateAction(event.from,
              { type: 'bs-reject', revision, round, message: rejection, view: publicBusiness(state) });
            else { pending = false; errorText = rejection; render(); }
          }
        } else if (a?.type === 'bs-reset' && event.from === room.peerId) {
          state = createBusiness(seats, state.options); round++;
          revision = state.revision; shell.root.querySelector('.arcade-victory')?.remove();
          publish();
        }
      } else if (event.from === room.activeGame.playerIds[0] &&
          ['bs-state', 'bs-reject'].includes(a?.type)) {
        if (!Number.isInteger(a.round) || a.round < round ||
          !validBusiness(a.view, seats, { publicView: true }) ||
          !Number.isInteger(a.view.revision) || a.view.revision < revision) {
          errorText = 'Invalid or stale host snapshot ignored.'; render(); return;
        }
        round = a.round; revision = a.view.revision; view = a.view;
        pending = false; errorText = a.type === 'bs-reject' ? a.message : '';
        render();
      }
    });
    function reset() {
      if (!confirm('Start a new Business table? All current cash, deeds and progress will be lost.')) return;
      if (room) { if (room.role === 'host') requestReset(); return; }
      state = createBusiness(seats, state.options); view = publicBusiness(state);
      localViewer = 0; covered = true; errorText = ''; round++;
      shell.root.querySelector('.arcade-victory')?.remove();
      persist(); render();
    }
    function requestReset() {
      try { room.sendAction({ type: 'bs-reset' }); } catch (e) { errorText = e.message; render(); }
    }
    shell.getResetButton().addEventListener('click', reset);
    if (room && room.role !== 'host') shell.getResetButton().disabled = true;
    if (room) {
      if (room.role === 'host') publish();
      else room.sendAction({ type: 'bs-sync' });
    } else persist();
    render();
    return { dispose: () => {
      disposed = true; controller.abort(); off?.(); session?.stop(); shell.root.remove();
    } };
  },
};
