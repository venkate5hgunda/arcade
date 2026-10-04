// Arcade's original cash-based Indian-city property game. All transitions run on the host.
export const GROUPS = {
  indigo: { color: '#6b56a7', cost: 50, names: ['Pune', 'Nagpur'], prices: [60, 60] },
  sky: { color: '#54a9cc', cost: 50, names: ['Surat', 'Vadodara', 'Ahmedabad'], prices: [100, 100, 120] },
  rose: { color: '#cd5688', cost: 100, names: ['Jaipur', 'Udaipur', 'Jodhpur'], prices: [140, 140, 160] },
  saffron: { color: '#de8c41', cost: 100, names: ['Lucknow', 'Kanpur', 'Varanasi'], prices: [180, 180, 200] },
  crimson: { color: '#cd5a53', cost: 150, names: ['Hyderabad', 'Visakhapatnam', 'Vijayawada'], prices: [220, 220, 240] },
  gold: { color: '#d5af39', cost: 150, names: ['Chennai', 'Coimbatore', 'Madurai'], prices: [260, 260, 280] },
  green: { color: '#4c9a6c', cost: 200, names: ['Bengaluru', 'Mysuru', 'Mangaluru'], prices: [300, 300, 320] },
  navy: { color: '#4071a7', cost: 200, names: ['Mumbai', 'New Delhi'], prices: [350, 400] },
};
const citySlots = [1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37, 39];
export const BOARD = Array.from({ length: 40 }, (_, id) => ({ id, kind: 'rest', name: 'Rest stop' }));
let n = 0;
for (const [group, data] of Object.entries(GROUPS))
  data.names.forEach((name, i) => {
    const price = data.prices[i];
    BOARD[citySlots[n++]] = { id: citySlots[n - 1], kind: 'city', name, group, price,
      cost: data.cost, rent: [Math.round(price / 10), Math.round(price / 2), price * 3,
        price * 9, price * 16, price * 25] };
  });
for (const id of [5, 15, 25, 35]) BOARD[id] = {
  id, kind: 'transport', name: ['Western Rail', 'Southern Rail', 'Eastern Rail', 'Northern Rail'][id / 10 | 0],
  price: 200,
};
for (const id of [12, 28]) BOARD[id] = { id, kind: 'utility', name: id === 12 ? 'Power Grid' : 'Water Works', price: 150 };
for (const id of [2, 17, 33]) BOARD[id] = { id, kind: 'fund', name: 'City Fund' };
for (const id of [7, 22, 36]) BOARD[id] = { id, kind: 'fortune', name: 'Fortune' };
Object.assign(BOARD[0], { kind: 'start', name: 'Start' });
Object.assign(BOARD[4], { kind: 'tax', name: 'Income Tax' });
Object.assign(BOARD[10], { kind: 'jail', name: 'Jail / Visiting' });
Object.assign(BOARD[20], { kind: 'rest', name: 'Rest Stop' });
Object.assign(BOARD[30], { kind: 'go-jail', name: 'Go to Jail' });
Object.assign(BOARD[38], { kind: 'tax', name: 'City Levy' });
export const DEEDS = BOARD.filter(s => s.price !== undefined).map(s => s.id);
export const DEFAULT_OPTIONS = Object.freeze({
  startingCash: 15000, salary: 1500, jailFine: 500, incomeTax: 200, cityLevy: 300,
  rollToStart: false, jackpot: false, exactStartBonus: false, auctionOnly: false, turnLimit: 0,
});
const CARD_SETS = {
  fortune: [
    ['Bank dividend', 'bank', 200], ['Festival shopping', 'bank', -150],
    ['Advance to Start', 'move', 0], ['Travel to New Delhi', 'move', 39],
    ['Go to Jail', 'jail'], ['Get out of Jail Free', 'free'],
    ['Repair your properties', 'repair', 40, 115],
    ['Collect from each player', 'each', 50],
    ['Give each player a gift', 'each', -50],
    ['Travel to Western Rail', 'move', 5],
    ['Consulting fee', 'bank', 100], ['Travel allowance', 'bank', 50],
  ],
  fund: [
    ['Community grant', 'bank', 200], ['Hospital bill', 'bank', -100],
    ['Advance to Start', 'move', 0], ['Go to Jail', 'jail'],
    ['Get out of Jail Free', 'free'], ['Home repairs', 'repair', 25, 100],
    ['Birthday gifts', 'each', 25], ['Support your neighbours', 'each', -25],
    ['Tax rebate', 'bank', 100], ['School fees', 'bank', -50],
    ['Local prize', 'bank', 75], ['Book fair', 'bank', -40],
  ],
};
export const CARDS = CARD_SETS;
const money = n => Number.isSafeInteger(n) && n >= 0 && n < 1e9;
const seat = (s, a) => Number.isInteger(a) && a >= 0 && a < s.players.length && !s.players[a].out;
const deed = id => Number.isInteger(id) && BOARD[id]?.price !== undefined;
const groupIds = group => DEEDS.filter(id => BOARD[id].group === group);
const shuffle = (deck, random) => {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function insist(test, message) { if (!test) throw new Error(message); }
function own(s, id, player) { return s.deeds[id].owner === player; }
function groupOwned(s, id, player) {
  return BOARD[id].kind === 'city' && groupIds(BOARD[id].group).every(x => own(s, x, player));
}
function groupClear(s, id) {
  return groupIds(BOARD[id].group).every(x => !s.deeds[x].mortgaged);
}
export function rent(s, id, dice = s.dice?.reduce((a, b) => a + b, 0) || 7) {
  const space = BOARD[id], record = s.deeds[id], owner = record?.owner;
  if (owner === null || record.mortgaged) return 0;
  if (space.kind === 'city') {
    if (record.level) return space.rent[record.level];
    return space.rent[0] * (groupOwned(s, id, owner) && groupClear(s, id) ? 2 : 1);
  }
  if (space.kind === 'transport')
    return 25 * 2 ** ([5, 15, 25, 35].filter(x => own(s, x, owner)).length - 1);
  return dice * ([12, 28].every(x => own(s, x, owner)) ? 10 : 4);
}
export function netWorth(s, p) {
  return s.players[p].cash + DEEDS.filter(id => own(s, id, p)).reduce((sum, id) =>
    sum + (s.deeds[id].mortgaged ? BOARD[id].price / 2 : BOARD[id].price) +
    s.deeds[id].level * (BOARD[id].cost || 0), 0);
}
export function createBusiness(count = 2, options = {}, random = Math.random) {
  insist(Number.isInteger(count) && count >= 2 && count <= 6, 'Choose 2–6 players.');
  const opts = { ...DEFAULT_OPTIONS, ...options };
  insist(Object.keys(opts).every(k => Object.hasOwn(DEFAULT_OPTIONS, k)) &&
    ['startingCash', 'salary', 'jailFine', 'incomeTax', 'cityLevy'].every(k => money(opts[k]) && opts[k] > 0 && opts[k] <= 20000) &&
    Number.isInteger(opts.turnLimit) && opts.turnLimit >= 0 && opts.turnLimit <= 1000 &&
    ['rollToStart', 'jackpot', 'exactStartBonus', 'auctionOnly'].every(k => typeof opts[k] === 'boolean'), 'Invalid configuration.');
  return { version: 1, options: opts, players: Array.from({ length: count }, () => ({
    cash: opts.startingCash, position: 0, jailed: false, attempts: 0, cards: [], out: false,
    started: !opts.rollToStart,
  })), deeds: Object.fromEntries(DEEDS.map(id => [id, { owner: null, level: 0, mortgaged: false }])),
  decks: Object.fromEntries(Object.entries(CARDS).map(([type, cards]) =>
    [type, { draw: shuffle(cards.map((_, i) => i), random), discard: [] }])),
  houses: 32, hotels: 12, current: 0, phase: 'roll', dice: null,
  doubles: 0, turns: 0, queue: [], auction: null, offer: null, debt: null,
  jackpot: 0, winner: null, winners: null, revision: 0, message: 'Roll two dice to begin.', log: [] };
}
export function publicBusiness(s) {
  const { decks, ...publicState } = s;
  return structuredClone(publicState);
}
export function validBusiness(s, count = null, { publicView = false } = {}) {
  try {
    if (!s || JSON.stringify(s).length > 32000 || s.version !== 1 ||
      !Array.isArray(s.players) || s.players.length < 2 || s.players.length > 6 ||
      count !== null && s.players.length !== count || !Object.keys(DEFAULT_OPTIONS).every(k =>
        typeof s.options?.[k] === typeof DEFAULT_OPTIONS[k]) ||
      !['startingCash', 'salary', 'jailFine', 'incomeTax', 'cityLevy']
        .every(k => money(s.options[k]) && s.options[k] > 0 && s.options[k] <= 20000) ||
      !Number.isInteger(s.options.turnLimit) || s.options.turnLimit < 0 || s.options.turnLimit > 1000 ||
      !['roll', 'buy', 'auction', 'award', 'debt', 'finish', 'win'].includes(s.phase) ||
      !Number.isInteger(s.current) || s.current < 0 || s.current >= s.players.length ||
      !Number.isInteger(s.revision) || s.revision < 0 ||
      !Number.isInteger(s.turns) || s.turns < 0 || !money(s.jackpot) ||
      !Number.isInteger(s.houses) || s.houses < 0 || s.houses > 32 ||
      !Number.isInteger(s.hotels) || s.hotels < 0 || s.hotels > 12 ||
      !Array.isArray(s.queue) || s.queue.length > 64 ||
      !Array.isArray(s.log) || s.log.length > 12 ||
      !s.log.every(item => typeof item === 'string' && item.length < 300) ||
      typeof s.message !== 'string' || s.message.length > 300 ||
      !Number.isInteger(s.doubles) || s.doubles < 0 || s.doubles > 2 ||
      !(s.dice === null || Array.isArray(s.dice) && s.dice.length === 2 &&
        s.dice.every(v => Number.isInteger(v) && v >= 1 && v <= 6)) ||
      !(s.winner === null || seat(s, s.winner)) ||
      !(s.winners === null || Array.isArray(s.winners) && s.winners.length >= 1 &&
        s.winners.length <= s.players.length && new Set(s.winners).size === s.winners.length &&
        s.winners.every(i => seat(s, i) && !s.players[i].out)) ||
      (s.phase === 'win') !== (s.winners !== null) ||
      (s.phase === 'win' && s.winner !==
        (s.winners.length === 1 ? s.winners[0] : null)) ||
      !s.players.every(p => money(p.cash) && Number.isInteger(p.position) && p.position >= 0 &&
        p.position < 40 && typeof p.jailed === 'boolean' && Number.isInteger(p.attempts) &&
        p.attempts >= 0 && p.attempts <= 3 && typeof p.out === 'boolean' &&
        typeof p.started === 'boolean' && Array.isArray(p.cards) && p.cards.length <= 2 &&
        p.cards.every(c => ['fortune', 'fund'].includes(c))) ||
      Object.keys(s.deeds).length !== DEEDS.length ||
      !DEEDS.every(id => {
        const d = s.deeds[id];
        return d && (d.owner === null || seat(s, d.owner)) &&
          Number.isInteger(d.level) && d.level >= 0 && d.level <= (BOARD[id].kind === 'city' ? 5 : 0) &&
          typeof d.mortgaged === 'boolean' && !(d.mortgaged && d.level) &&
          (d.owner !== null || !d.level && !d.mortgaged);
      })) return false;
    if (!s.queue.every(task => task && (
      task.type === 'charge' && seat(s, task.from) &&
        (task.to === null || seat(s, task.to) && task.to !== task.from) &&
        money(task.amount) && task.amount > 0 && task.amount < 1e7 &&
        typeof task.label === 'string' && task.label.length < 150 ||
      task.type === 'land' && seat(s, task.player) ||
      task.type === 'move' && seat(s, task.player) && Number.isInteger(task.target) &&
        task.target >= 0 && task.target < 40 ||
      task.type === 'complete' && typeof task.extra === 'boolean' ||
      task.type === 'next' || task.type === 'resume-roll' ||
      task.type === 'auction' && deed(task.id) && s.deeds[task.id].owner === null
    ))) return false;
    if (s.offer !== null && (!s.offer || !seat(s, s.offer.from) || !seat(s, s.offer.to) ||
      s.offer.from === s.offer.to ||
      !Array.isArray(s.offer.offered) || !Array.isArray(s.offer.wanted) ||
      !s.offer.offered.every(id => deed(id) && own(s, id, s.offer.from)) ||
      !s.offer.wanted.every(id => deed(id) && own(s, id, s.offer.to)) ||
      new Set([...s.offer.offered, ...s.offer.wanted]).size !==
        s.offer.offered.length + s.offer.wanted.length ||
      !money(s.offer.cashOut) || !money(s.offer.cashIn) ||
      !Number.isInteger(s.offer.cardsOut) || !Number.isInteger(s.offer.cardsIn) ||
      s.offer.cardsOut < 0 || s.offer.cardsIn < 0 ||
      s.offer.cardsOut > s.players[s.offer.from].cards.length ||
      s.offer.cardsIn > s.players[s.offer.to].cards.length)) return false;
    let houses = 0, hotels = 0;
    for (const id of DEEDS) {
      const d = s.deeds[id];
      if (d.level === 5) hotels++; else houses += d.level;
      if (d.level && (!groupOwned(s, id, d.owner) || !groupClear(s, id))) return false;
    }
    if (Object.keys(GROUPS).some(group => {
      const levels = groupIds(group).map(id => s.deeds[id].level);
      return Math.max(...levels) - Math.min(...levels) > 1;
    })) return false;
    if (houses + s.houses !== 32 || hotels + s.hotels !== 12) return false;
    if (s.phase === 'debt' && (!s.debt || !seat(s, s.debt.from) ||
      s.queue[0]?.type !== 'charge' || !money(s.queue[0].amount) ||
      s.debt.from !== s.queue[0].from || s.debt.to !== s.queue[0].to ||
      s.debt.amount !== s.queue[0].amount)) return false;
    if (s.phase !== 'debt' && s.debt !== null &&
      !(['auction', 'award'].includes(s.phase) && s.auction?.returnPhase === 'debt')) return false;
    if (s.phase === 'buy' && (!deed(s.players[s.current].position) ||
      s.deeds[s.players[s.current].position].owner !== null)) return false;
    if (['auction', 'award'].includes(s.phase) && (!s.auction ||
      !['deed', 'house', 'hotel'].includes(s.auction.kind) ||
      !Array.isArray(s.auction.active) || s.auction.active.length !== s.players.length ||
      !s.auction.active.every(v => typeof v === 'boolean') ||
      !seat(s, s.auction.next) || !s.auction.active[s.auction.next] ||
      (s.phase === 'award' && s.auction.next !== s.auction.bidder) ||
      !money(s.auction.bid) || !(s.auction.bidder === null ||
        seat(s, s.auction.bidder) && s.auction.active[s.auction.bidder]) ||
      !['roll', 'buy', 'finish', 'debt'].includes(s.auction.returnPhase) ||
      (s.auction.kind === 'deed' ? !deed(s.auction.id) || s.deeds[s.auction.id].owner !== null :
        s.auction.id !== null))) return false;
    if (!['auction', 'award'].includes(s.phase) && s.auction !== null) return false;
    if (s.players.reduce((n, p) => n + p.cards.filter(c => c === 'fortune').length, 0) > 1 ||
      s.players.reduce((n, p) => n + p.cards.filter(c => c === 'fund').length, 0) > 1) return false;
    if (publicView) return !Object.hasOwn(s, 'decks');
    if (!s.decks || !Object.keys(CARDS).every(type => {
      const d = s.decks[type], held = s.players.filter(p => p.cards.includes(type)).length;
      const ids = [...(d?.draw || []), ...(d?.discard || [])];
      return Array.isArray(d?.draw) && Array.isArray(d?.discard) &&
        ids.every(i => Number.isInteger(i) && i >= 0 && i < CARDS[type].length) &&
        new Set(ids).size === ids.length &&
        ids.length + held === CARDS[type].length &&
        (!held || !ids.includes(CARDS[type].findIndex(c => c[1] === 'free')));
    })) return false;
    return true;
  } catch { return false; }
}
const note = (s, text) => { s.message = text; s.log.unshift(text); s.log.length = Math.min(s.log.length, 10); };
function charge(s, from, to, amount, label = 'Payment') {
  if (amount <= 0 || s.players[from].out || to !== null && s.players[to].out) return;
  s.queue.unshift({ type: 'charge', from, to, amount, label });
}
function salary(s, p, amount = s.options.salary) {
  s.players[p].cash += amount;
  note(s, `${s.players[p].name || `Player ${p + 1}`} collected ₹${amount} at Start.`);
}
function move(s, p, target, { salaryOnPass = true } = {}) {
  const old = s.players[p].position;
  if (salaryOnPass && (target < old || target === 0)) salary(s, p);
  s.players[p].position = target;
  if (target === 0 && s.options.exactStartBonus) salary(s, p);
  s.queue.unshift({ type: 'land', player: p });
}
function goJail(s, p) {
  const player = s.players[p];
  player.position = 10; player.jailed = true; player.attempts = 0;
  s.doubles = 0;
  s.queue = [{ type: 'complete', extra: false }];
  note(s, `Player ${p + 1} goes to Jail. No salary is collected.`);
}
function draw(s, type, p, random) {
  const deck = s.decks[type];
  if (!deck.draw.length) {
    deck.draw = shuffle(deck.discard, random); deck.discard = [];
  }
  insist(deck.draw.length, 'The card deck is empty.');
  const id = deck.draw.shift(), card = CARDS[type][id];
  if (card[1] === 'free') s.players[p].cards.push(type);
  else deck.discard.push(id);
  const instruction = card[1] === 'bank' ? card[2] > 0 ?
    `collect ₹${card[2]} from the bank` : `pay ₹${-card[2]} to the bank` :
    card[1] === 'move' ? `travel to ${BOARD[card[2]].name}` :
      card[1] === 'jail' ? 'go directly to Jail' :
        card[1] === 'free' ? 'keep this card until used or traded' :
          card[1] === 'repair' ? `pay ₹${card[2]} per house and ₹${card[3]} per hotel` :
            card[2] > 0 ? `collect ₹${card[2]} from each other player` :
              `pay ₹${-card[2]} to each other player`;
  note(s, `${type === 'fund' ? 'City Fund' : 'Fortune'} · ${card[0]}: ${instruction}.`);
  if (card[1] === 'bank') {
    if (card[2] < 0) charge(s, p, null, -card[2], card[0]);
    else s.players[p].cash += card[2];
  } else if (card[1] === 'move') move(s, p, card[2]);
  else if (card[1] === 'jail') goJail(s, p);
  else if (card[1] === 'repair') {
    const amount = DEEDS.filter(x => own(s, x, p)).reduce((total, x) =>
      total + (s.deeds[x].level === 5 ? card[3] : s.deeds[x].level * card[2]), 0);
    charge(s, p, null, amount, card[0]);
  } else if (card[1] === 'each') {
    const tasks = s.players.flatMap((other, i) => i !== p && !other.out ? [{
      type: 'charge', from: card[2] > 0 ? i : p, to: card[2] > 0 ? p : i,
      amount: Math.abs(card[2]), label: card[0],
    }] : []);
    s.queue.unshift(...tasks);
  }
}
function land(s, p, random) {
  const id = s.players[p].position, space = BOARD[id], d = s.deeds[id];
  if (d) {
    if (d.owner === null) {
      if (s.options.auctionOnly) startAuction(s, 'deed', id);
      else { s.phase = 'buy'; note(s, `${space.name} is unowned. Buy or auction it.`); }
    } else if (d.owner !== p && !d.mortgaged)
      charge(s, p, d.owner, rent(s, id), `Rent at ${space.name}`);
    else note(s, d.owner === p ? `You own ${space.name}.` : `${space.name} is mortgaged: no rent.`);
  } else if (space.kind === 'tax') charge(s, p, null,
    id === 4 ? s.options.incomeTax : s.options.cityLevy, space.name);
  else if (space.kind === 'go-jail') goJail(s, p);
  else if (space.kind === 'fund' || space.kind === 'fortune') draw(s, space.kind, p, random);
  else if (id === 20 && s.options.jackpot) {
    s.players[p].cash += s.jackpot; note(s, `Rest Stop jackpot: ₹${s.jackpot}.`); s.jackpot = 0;
  } else note(s, `Rest at ${space.name}.`);
}
function next(s) {
  let nextSeat = s.current;
  do { nextSeat = (nextSeat + 1) % s.players.length; } while (s.players[nextSeat].out);
  s.current = nextSeat;
  s.turns++;
  s.doubles = 0; s.dice = null;
  if (s.options.turnLimit && s.turns >= s.options.turnLimit) {
    const scores = s.players.map((p, i) => p.out ? -1 : netWorth(s, i));
    const best = Math.max(...scores);
    s.winners = scores.flatMap((score, i) => score === best ? [i] : []);
    s.winner = s.winners.length === 1 ? s.winners[0] : null;
    s.phase = 'win'; note(s, `Turn-limit showdown: ${s.winners.map(i => `Player ${i + 1}`).join(' and ')} lead${s.winners.length === 1 ? 's' : ''} on net worth.`);
  } else { s.phase = 'roll'; note(s, `Player ${s.current + 1}, roll two dice.`); }
}
function advance(s, random) {
  while (s.queue.length && !['buy', 'auction', 'award', 'debt', 'win'].includes(s.phase)) {
    const task = s.queue[0];
    if (task.type === 'charge') {
      if (s.players[task.from].out || task.to !== null && s.players[task.to].out) {
        s.queue.shift(); continue;
      }
      if (s.players[task.from].cash < task.amount) {
        s.phase = 'debt'; s.debt = { from: task.from, to: task.to, amount: task.amount };
        note(s, `Player ${task.from + 1} owes ₹${task.amount} for ${task.label}. Raise cash or declare bankruptcy.`);
        return;
      }
      s.players[task.from].cash -= task.amount;
      if (task.to === null) { if (s.options.jackpot) s.jackpot += task.amount; }
      else s.players[task.to].cash += task.amount;
      note(s, `Player ${task.from + 1} paid ₹${task.amount} ${task.to === null ? 'to the bank' : `to Player ${task.to + 1}`} (${task.label}).`);
      s.queue.shift();
    } else if (task.type === 'land') {
      s.queue.shift(); land(s, task.player, random);
    } else if (task.type === 'move') {
      s.queue.shift(); s.players[task.player].position = task.target;
      s.queue.unshift({ type: 'land', player: task.player });
    } else if (task.type === 'complete') {
      s.queue.shift();
      if (task.extra) { s.phase = 'roll'; note(s, `Player ${s.current + 1} rolled doubles: roll again.`); }
      else { s.phase = 'finish'; note(s, `Player ${s.current + 1} may manage deeds or end the turn.`); }
    } else if (task.type === 'next') {
      s.queue.shift(); next(s);
    } else if (task.type === 'resume-roll') {
      s.queue.shift(); s.phase = 'roll';
      note(s, `Player ${s.current + 1} is free from Jail. Roll to move.`);
    } else if (task.type === 'auction') {
      s.queue.shift(); startAuction(s, 'deed', task.id);
    } else throw new Error('Invalid queued action.');
  }
}
function eligibleBuild(s, p, kind) {
  return DEEDS.filter(id => {
    const d = s.deeds[id], group = BOARD[id].group;
    if (!group || d.owner !== p || d.mortgaged || !groupOwned(s, id, p) || !groupClear(s, id)) return false;
    const levels = groupIds(group).map(x => s.deeds[x].level);
    return kind === 'house' ? d.level < 4 && d.level === Math.min(...levels) :
      d.level === 4 && levels.every(level => level >= 4);
  });
}
function startAuction(s, kind, id = null) {
  const eligible = s.players.map((p, i) => !p.out && p.cash > 0 &&
    (kind === 'deed' || eligibleBuild(s, i, kind).some(x =>
      p.cash >= BOARD[x].cost)) );
  if (!eligible.some(Boolean)) {
    if (s.phase === 'buy') s.phase = 'finish';
    note(s, 'No eligible bidders; the asset remains with the bank.'); return;
  }
  s.auction = { kind, id, active: eligible, bidder: null, bid: 0,
    next: eligible.findIndex(Boolean), returnPhase: kind === 'deed' && s.phase === 'buy' ?
      'finish' : s.phase };
  s.phase = 'auction';
  note(s, `${kind === 'deed' ? BOARD[id].name : `One ${kind}`} is up for auction. Player ${s.auction.next + 1} bids or passes.`);
}
function auctionStep(s, actor, move) {
  const a = s.auction;
  insist(s.phase === 'auction' && a?.next === actor, 'It is not your auction turn.');
  if (move.type === 'bid') {
    insist(money(move.amount) && move.amount > a.bid && move.amount <= s.players[actor].cash,
      'Bid must exceed the current bid and fit your cash.');
    if (a.kind !== 'deed') insist(eligibleBuild(s, actor, a.kind).some(id => BOARD[id].cost <= move.amount),
      'Bid must cover the building cost.');
    a.bid = move.amount; a.bidder = actor;
  } else {
    insist(move.type === 'pass', 'Choose Bid or Pass.');
    a.active[actor] = false;
  }
  const remaining = a.active.flatMap((v, i) => v ? [i] : []);
  if (!remaining.length || remaining.length === 1 && a.bidder === remaining[0]) {
    if (a.bidder !== null) {
      if (a.kind === 'deed') {
        s.players[a.bidder].cash -= a.bid;
        s.deeds[a.id].owner = a.bidder;
        note(s, `Player ${a.bidder + 1} won ${BOARD[a.id].name} for ₹${a.bid}.`);
        s.phase = a.returnPhase; s.auction = null;
      } else {
        s.phase = 'award'; a.next = a.bidder;
        note(s, `Player ${a.bidder + 1} won a ${a.kind} for ₹${a.bid}. Choose where to build.`);
        return;
      }
    } else { s.phase = a.returnPhase; s.auction = null; note(s, 'No bids. The asset stays with the bank.'); }
    return;
  }
  const eligible = remaining.filter(i => i !== a.bidder);
  if (!eligible.length) return;
  let nextSeat = actor;
  do { nextSeat = (nextSeat + 1) % s.players.length; } while (!a.active[nextSeat] || nextSeat === a.bidder);
  a.next = nextSeat;
  note(s, `Player ${nextSeat + 1}, bid above ₹${a.bid} or pass.`);
}
function build(s, p, id, kind, price = null) {
  insist(eligibleBuild(s, p, kind).includes(id), 'Own a complete unmortgaged set and build evenly.');
  insist(kind === 'house' ? s.houses > 0 : s.hotels > 0, 'The bank has no buildings of that type.');
  insist(price === null || price >= BOARD[id].cost,
    'Auction bid does not cover this city’s building cost.');
  const cost = price ?? BOARD[id].cost;
  insist(s.players[p].cash >= cost, 'Not enough cash to build.');
  s.players[p].cash -= cost;
  if (kind === 'hotel') { s.houses += 4; s.hotels--; s.deeds[id].level = 5; }
  else { s.houses--; s.deeds[id].level++; }
  note(s, `Player ${p + 1} built ${kind === 'hotel' ? 'a hotel' : 'a house'} at ${BOARD[id].name} for ₹${cost}.`);
}
function sell(s, p, id) {
  insist(deed(id) && own(s, id, p) && s.deeds[id].level > 0, 'No building to sell here.');
  const d = s.deeds[id], peers = groupIds(BOARD[id].group);
  insist(d.level === Math.max(...peers.map(x => s.deeds[x].level)), 'Sell evenly: highest-developed city first.');
  if (d.level === 5) {
    insist(s.houses >= 4, 'Bank lacks four houses. Liquidate the whole group instead.');
    s.houses -= 4; s.hotels++; d.level = 4;
  } else { s.houses++; d.level--; }
  s.players[p].cash += BOARD[id].cost / 2;
  note(s, `Player ${p + 1} sold a building at ${BOARD[id].name} for ₹${BOARD[id].cost / 2}.`);
}
function liquidateGroup(s, p, group) {
  insist(Object.hasOwn(GROUPS, group) && groupIds(group).every(id => own(s, id, p)), 'Own this group to liquidate it.');
  let returned = 0;
  for (const id of groupIds(group)) {
    const d = s.deeds[id];
    returned += d.level * BOARD[id].cost / 2;
    if (d.level === 5) s.hotels++;
    else s.houses += d.level;
    d.level = 0;
  }
  insist(returned > 0, 'This group has no buildings.');
  s.players[p].cash += returned;
  note(s, `Player ${p + 1} sold all ${group} buildings for ₹${returned}.`);
}
function mortgage(s, p, id) {
  insist(deed(id) && own(s, id, p) && !s.deeds[id].mortgaged, 'Own an unmortgaged deed.');
  insist(BOARD[id].kind !== 'city' ||
    groupIds(BOARD[id].group).every(x => !s.deeds[x].level), 'Sell all buildings in this color group first.');
  s.deeds[id].mortgaged = true; s.players[p].cash += BOARD[id].price / 2;
  note(s, `Player ${p + 1} mortgaged ${BOARD[id].name}.`);
}
function release(s, p, id) {
  insist(deed(id) && own(s, id, p) && s.deeds[id].mortgaged, 'Own a mortgaged deed.');
  const price = Math.ceil(BOARD[id].price * .55);
  insist(s.players[p].cash >= price, `Repayment needs ₹${price}.`);
  s.players[p].cash -= price; s.deeds[id].mortgaged = false;
  note(s, `Player ${p + 1} repaid ${BOARD[id].name}'s mortgage and 10% interest.`);
}
function validateOffer(s, from, to, offered, wanted, cashOut, cashIn, cardsOut, cardsIn) {
  insist(seat(s, from) && seat(s, to) && from !== to, 'Choose two solvent players.');
  insist(Array.isArray(offered) && Array.isArray(wanted) && offered.length <= DEEDS.length &&
    wanted.length <= DEEDS.length && new Set([...offered, ...wanted]).size === offered.length + wanted.length,
  'Choose distinct deeds.');
  insist(offered.every(id => deed(id) && own(s, id, from)) &&
    wanted.every(id => deed(id) && own(s, id, to)), 'Trade deeds must still be owned by their proposer.');
  insist([...offered, ...wanted].every(id => BOARD[id].kind !== 'city' ||
    groupIds(BOARD[id].group).every(x => !s.deeds[x].level)), 'Sell all group buildings before trading a city.');
  insist(money(cashOut) && money(cashIn) && cashOut < 1e7 && cashIn < 1e7 &&
    Number.isInteger(cardsOut) && Number.isInteger(cardsIn) && cardsOut >= 0 && cardsIn >= 0 &&
    cardsOut <= s.players[from].cards.length && cardsIn <= s.players[to].cards.length,
  'Invalid trade cash or jail cards.');
  const interestTo = offered.filter(id => s.deeds[id].mortgaged)
    .reduce((n, id) => n + Math.ceil(BOARD[id].price * .05), 0);
  const interestFrom = wanted.filter(id => s.deeds[id].mortgaged)
    .reduce((n, id) => n + Math.ceil(BOARD[id].price * .05), 0);
  insist(s.players[from].cash >= cashOut + interestFrom &&
    s.players[to].cash >= cashIn + interestTo, 'Cash must cover payment and immediate mortgage-transfer interest.');
  insist(offered.length + wanted.length + cashOut + cashIn + cardsOut + cardsIn > 0, 'Add something to the offer.');
  return { from, to, offered: [...offered], wanted: [...wanted], cashOut, cashIn, cardsOut, cardsIn,
    interestFrom, interestTo };
}
function bankruptcy(s, p) {
  insist(s.phase === 'debt' && s.debt.from === p, 'Only the debtor may declare bankruptcy.');
  const to = s.debt.to;
  s.offer = null;
  for (const group of Object.keys(GROUPS))
    if (groupIds(group).some(id => own(s, id, p) && s.deeds[id].level)) {
      // Liquidation converts all hotels directly to bank stock, even when houses are scarce.
      for (const id of groupIds(group)) {
        const d = s.deeds[id];
        if (!own(s, id, p)) continue;
        if (d.level === 5) s.hotels++; else s.houses += d.level;
        s.players[p].cash += d.level * BOARD[id].cost / 2;
        d.level = 0;
      }
    }
  if (to !== null) {
    s.players[to].cash += s.players[p].cash;
    s.players[to].cards.push(...s.players[p].cards);
  } else for (const type of s.players[p].cards)
    s.decks[type].discard.push(CARDS[type].findIndex(c => c[1] === 'free'));
  s.players[p].cash = 0; s.players[p].cards = []; s.players[p].out = true;
  const banked = [];
  for (const id of DEEDS.filter(x => own(s, x, p))) {
    s.deeds[id].owner = to;
    if (to === null) { s.deeds[id].mortgaged = false; banked.push(id); }
    else if (s.deeds[id].mortgaged)
      s.queue.splice(1, 0, { type: 'charge', from: to, to: null,
        amount: Math.ceil(BOARD[id].price * .05), label: `Transferred ${BOARD[id].name} mortgage interest` });
  }
  s.queue.shift(); s.debt = null; s.phase = 'finish';
  s.queue = s.queue.filter(t =>
    !(t.type === 'charge' && (t.from === p || t.to === p)) &&
    !(['land', 'move'].includes(t.type) && t.player === p) &&
    !(p === s.current && ['complete', 'resume-roll'].includes(t.type)));
  // Bank re-auctions deeds after any already-queued obligations; no lost asset.
  s.queue.push(...banked.map(id => ({ type: 'auction', id })));
  if (s.players.filter(player => !player.out).length === 1) {
    s.winner = s.players.findIndex(player => !player.out); s.winners = [s.winner];
    s.phase = 'win'; s.queue = []; note(s, `Player ${s.winner + 1} wins as the last solvent player.`);
  } else {
    if (p === s.current) s.queue.push({ type: 'next' });
    note(s, `Player ${p + 1} is bankrupt. ${to === null ? 'Bank deeds go to auction.' : `Player ${to + 1} inherits the remaining estate.`}`);
    advance(s, Math.random);
  }
}
export function actors(s) {
  if (s.phase === 'win') return [];
  if (s.phase === 'auction' || s.phase === 'award') return [s.auction.next];
  if (s.phase === 'debt') return [s.debt.from];
  return [s.current];
}
export function actBusiness(state, action, actor, random = Math.random) {
  insist(validBusiness(state), 'Game checkpoint failed validation.');
  insist(seat(state, actor), 'This player cannot act.');
  insist(action && typeof action === 'object' && !Array.isArray(action), 'Invalid action.');
  const s = structuredClone(state), type = action.type, p = s.players[actor];
  const debtActor = s.phase === 'debt' && s.debt.from === actor;
  const mayManage = s.phase !== 'win' && s.phase !== 'award' &&
    (s.phase !== 'debt' || debtActor);
  if (type === 'offer' || type === 'counter') {
    if (type === 'counter') insist(s.offer?.to === actor, 'Only the trade recipient may counter.');
    insist((mayManage || type === 'counter' && s.offer?.to === actor) &&
      (type === 'counter' || !s.offer) && s.phase !== 'auction', 'Trade is not available now.');
    if (type === 'counter') insist(action.to === s.offer.from, 'Counter the original proposer.');
    s.offer = validateOffer(s, actor, action.to, action.offered || [], action.wanted || [],
      action.cashOut ?? 0, action.cashIn ?? 0, action.cardsOut ?? 0, action.cardsIn ?? 0);
    note(s, `Player ${actor + 1} proposed a trade to Player ${action.to + 1}.`);
  } else if (type === 'reject' || type === 'accept') {
    insist(s.offer?.to === actor, 'Only the recipient may reply.');
    if (type === 'accept') {
      const o = validateOffer(s, s.offer.from, actor, s.offer.offered, s.offer.wanted,
        s.offer.cashOut, s.offer.cashIn, s.offer.cardsOut, s.offer.cardsIn);
      const from = s.players[o.from], to = s.players[o.to];
      from.cash += o.cashIn - o.cashOut - o.interestFrom;
      to.cash += o.cashOut - o.cashIn - o.interestTo;
      for (const id of o.offered) s.deeds[id].owner = actor;
      for (const id of o.wanted) s.deeds[id].owner = o.from;
      const a = from.cards.splice(0, o.cardsOut), b = to.cards.splice(0, o.cardsIn);
      from.cards.push(...b); to.cards.push(...a);
      if (s.options.jackpot) s.jackpot += o.interestFrom + o.interestTo;
      note(s, `Players ${o.from + 1} and ${actor + 1} completed their trade.`);
    } else note(s, `Player ${actor + 1} declined the trade.`);
    s.offer = null;
  } else if (type === 'cancel') {
    insist(s.offer?.from === actor, 'Only the proposer may withdraw the offer.');
    s.offer = null; note(s, 'Trade withdrawn.');
  } else if (['build', 'sell', 'liquidate', 'mortgage', 'release'].includes(type)) {
    insist(mayManage && !s.offer && s.phase !== 'auction', 'Resolve the current response first.');
    if (type === 'build') {
      insist(['house', 'hotel'].includes(action.kind), 'Choose a house or hotel.');
      const eligible = s.players.filter((x, i) => !x.out && eligibleBuild(s, i, action.kind)
        .some(id => x.cash >= BOARD[id].cost)).length;
      if ((action.kind === 'house' ? s.houses : s.hotels) === 1 && eligible > 1) {
        insist(eligibleBuild(s, actor, action.kind).includes(action.id), 'This city cannot be developed yet.');
        startAuction(s, action.kind);
      } else build(s, actor, action.id, action.kind);
    } else if (type === 'sell') sell(s, actor, action.id);
    else if (type === 'liquidate') liquidateGroup(s, actor, action.group);
    else if (type === 'mortgage') mortgage(s, actor, action.id);
    else release(s, actor, action.id);
  } else if (type === 'pay-debt') {
    insist(debtActor && p.cash >= s.debt.amount, 'Raise enough cash to settle your debt.');
    s.phase = 'finish'; s.debt = null; advance(s, random);
  } else if (type === 'bankrupt') bankruptcy(s, actor);
  else if (type === 'bid' || type === 'pass') {
    auctionStep(s, actor, action);
    if (s.phase !== 'auction' && s.phase !== 'award') advance(s, random);
  } else if (type === 'place-award') {
    insist(s.phase === 'award' && s.auction.next === actor, 'Only the auction winner may place a building.');
    build(s, actor, action.id, s.auction.kind, s.auction.bid);
    s.phase = s.auction.returnPhase; s.auction = null; advance(s, random);
  } else {
    insist(actor === s.current && !s.offer, 'Wait for the current player or trade response.');
    if (type === 'roll') {
      insist(s.phase === 'roll', 'Not ready to roll.');
      const dice = action.dice ?? [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)];
      insist(Array.isArray(dice) && dice.length === 2 &&
        dice.every(v => Number.isInteger(v) && v >= 1 && v <= 6), 'Invalid dice.');
      const double = dice[0] === dice[1]; s.dice = dice;
      if (!p.started) {
        if (dice[0] + dice[1] === 12) { p.started = true; note(s, `Player ${actor + 1} entered the board.`); }
        else { s.phase = 'finish'; note(s, `Player ${actor + 1} needs 12 to enter. End turn.`); }
      } else if (p.jailed) {
        if (double) {
          p.jailed = false; p.attempts = 0;
          move(s, actor, (p.position + dice[0] + dice[1]) % 40);
          s.queue.push({ type: 'complete', extra: false });
        } else if (++p.attempts === 3) {
          p.jailed = false; p.attempts = 0;
          s.queue.push({ type: 'complete', extra: false });
          s.queue.unshift({ type: 'move', player: actor, target: (p.position + dice[0] + dice[1]) % 40 });
          charge(s, actor, null, s.options.jailFine, 'Third failed jail attempt');
        } else { s.phase = 'finish'; note(s, `No doubles. Jail attempt ${p.attempts}/3; end turn.`); }
      } else if (double && ++s.doubles === 3) goJail(s, actor);
      else {
        if (!double) s.doubles = 0;
        const target = (p.position + dice[0] + dice[1]) % 40;
        if (target < p.position) salary(s, actor);
        if (target === 0 && s.options.exactStartBonus) salary(s, actor);
        p.position = target;
        s.queue.push({ type: 'complete', extra: double });
        s.queue.unshift({ type: 'land', player: actor });
      }
      advance(s, random);
    } else if (type === 'jail-fine' || type === 'jail-card') {
      insist(s.phase === 'roll' && p.jailed, 'You are not waiting in jail.');
      if (type === 'jail-fine') {
        s.queue.push({ type: 'resume-roll' });
        charge(s, actor, null, s.options.jailFine, 'Jail release');
        p.jailed = false; p.attempts = 0;
        advance(s, random);
      } else {
        insist(p.cards.length > 0, 'No jail-release card.');
        const card = action.card || p.cards[0];
        insist(p.cards.includes(card), 'You do not hold that card.');
        p.cards.splice(p.cards.indexOf(card), 1);
        s.decks[card].discard.push(CARDS[card].findIndex(c => c[1] === 'free'));
        p.jailed = false; p.attempts = 0;
        note(s, 'Jail-release card returned to its deck. Roll to move.');
      }
    } else if (type === 'buy' || type === 'decline') {
      insist(s.phase === 'buy', 'No deed offered for purchase.');
      const id = p.position, d = s.deeds[id];
      insist(d?.owner === null, 'This deed is no longer for sale.');
      if (type === 'buy') {
        insist(p.cash >= BOARD[id].price, 'Not enough cash; choose an auction instead.');
        p.cash -= BOARD[id].price; d.owner = actor; s.phase = 'finish';
        note(s, `Player ${actor + 1} bought ${BOARD[id].name} for ₹${BOARD[id].price}.`);
        advance(s, random);
      } else {
        startAuction(s, 'deed', id);
        if (s.phase !== 'auction') advance(s, random);
      }
    } else if (type === 'end') {
      insist(s.phase === 'finish', 'Resolve this turn before ending it.');
      next(s);
    } else throw new Error('Unknown Business action.');
  }
  // A debtor may raise cash between attempted payments; never silently skip a charge.
  if (s.phase === 'debt' && s.debt && s.players[s.debt.from].cash >= s.debt.amount &&
      type === 'pay-debt') advance(s, random);
  s.revision++;
  insist(validBusiness(s), 'Action produced an invalid game state.');
  return s;
}
