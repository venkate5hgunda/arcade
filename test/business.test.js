import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOARD, DEEDS, CARDS, GROUPS, createBusiness, actBusiness, rent,
  netWorth, actors, publicBusiness, validBusiness } from '../games/business-engine.js';
import { validBusinessMove, applyRemoteBusinessAction, validBusinessSnapshot,
  businessDeedActions, businessSpaceDetails, businessResponder,
  businessActionContext, businessBuildHint, createBusinessRollCycle } from '../games/business.js';

const apply = (s, actor, type, fields = {}) => actBusiness(s, { type, ...fields }, actor, () => 0);
const visit = (s, id, dice = [1, id - 1]) => {
  s.players[s.current].position = id - dice[0] - dice[1];
  return apply(s, s.current, 'roll', { dice });
};
const holdings = (s, group, owner) => {
  for (const id of DEEDS.filter(x => BOARD[x].group === group)) s.deeds[id].owner = owner;
  return s;
};

test('original board artwork is bundled for offline play', () => {
  const precache = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const file of ['cityscape.svg', 'symbols.svg']) {
    const path = `assets/business/${file}`;
    const image = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(image, /<svg\b/);
    assert.ok(precache.includes(`'./${path}'`), `${path} must be precached`);
  }
});

test('original forty-space city board has unique deed slots and coherent groups', () => {
  assert.equal(BOARD.length, 40);
  assert.equal(DEEDS.length, 28);
  assert.equal(new Set(BOARD.map(x => x.name)).size, 36);
  assert.equal(Object.values(GROUPS).reduce((n, x) => n + x.names.length, 0), 22);
  assert.equal(BOARD[0].kind, 'start');
  assert.equal(BOARD[30].kind, 'go-jail');
});

test('buy and decline lead to a competitive auction with the decliner eligible', () => {
  let s = visit(createBusiness(3), 3);
  assert.equal(s.phase, 'buy');
  assert.equal(s.players[0].position, 3);
  s = apply(s, 0, 'decline');
  assert.deepEqual(actors(s), [0]);
  s = apply(s, 0, 'bid', { amount: 25 });
  s = apply(s, 1, 'bid', { amount: 40 });
  s = apply(s, 2, 'pass');
  s = apply(s, 0, 'pass');
  assert.equal(s.deeds[3].owner, 1);
  assert.equal(s.players[1].cash, 14960);
  assert.equal(s.phase, 'finish');
  assert.equal(s.auction, null);
  assert.throws(() => apply(s, 0, 'buy'), /No deed offered/);
});

test('no bids leaves deed unowned; a purchased deed charges rent including doubled complete-set rent', () => {
  let s = visit(createBusiness(), 3);
  s = apply(s, 0, 'decline');
  s = apply(s, 0, 'pass');
  s = apply(s, 1, 'pass');
  assert.equal(s.deeds[3].owner, null);
  s.deeds[3].owner = 1; s.players[0].cash = 100;
  s.phase = 'roll'; s.players[0].position = 0;
  s = apply(s, 0, 'roll', { dice: [1, 2] });
  assert.equal(s.players[0].cash, 94);
  s.deeds[1].owner = 1;
  assert.equal(rent(s, 3), BOARD[3].rent[0] * 2);
  s.deeds[3].mortgaged = true;
  assert.equal(rent(s, 3), 0);
});

test('three doubles go straight to jail; release by doubles has no extra turn', () => {
  let s = createBusiness();
  s.players[0].position = 20;
  s = apply(s, 0, 'roll', { dice: [2, 2] });
  assert.equal(s.phase, 'buy');
  s = apply(s, 0, 'buy');
  assert.equal(s.phase, 'roll');
  s = apply(s, 0, 'roll', { dice: [2, 2] });
  s = apply(s, 0, 'buy');
  s = apply(s, 0, 'roll', { dice: [2, 2] });
  assert.equal(s.players[0].position, 10);
  assert.equal(s.players[0].jailed, true);
  assert.equal(s.phase, 'finish');
  s = apply(s, 0, 'end');
  assert.equal(s.current, 1);
  s.current = 0;
  s = apply(s, 0, 'roll', { dice: [3, 3] });
  assert.equal(s.players[0].jailed, false);
  assert.equal(s.phase, 'buy');
  s = apply(s, 0, 'buy');
  assert.equal(s.phase, 'finish');
});

test('third failed jail attempt charges fine before moving and debt interrupts resolution', () => {
  let s = createBusiness();
  s.players[0].position = 28;
  s = apply(s, 0, 'roll', { dice: [1, 1] });
  assert.equal(s.players[0].position, 10);
  assert.equal(s.players[0].jailed, true);
  s = apply(s, 0, 'end');
  s.players[0].cash = 400;
  s.current = 0; s.phase = 'roll'; s.players[0].attempts = 2;
  s = apply(s, 0, 'roll', { dice: [1, 2] });
  assert.equal(s.phase, 'debt');
  assert.equal(s.debt.amount, 500);
  assert.equal(s.players[0].position, 10);
  assert.throws(() => apply(s, 0, 'pay-debt'), /Raise enough cash/);
  s.deeds[39].owner = 0;
  s = apply(s, 0, 'mortgage', { id: 39 });
  s = apply(s, 0, 'pay-debt');
  assert.equal(s.players[0].position, 13);
  assert.equal(s.players[0].cash, 100);
  assert.equal(s.phase, 'buy');
});

test('paying a jail release fine, even after raising cash, still allows the movement roll', () => {
  let s = createBusiness();
  s.players[0].position = 10;
  s.players[0].jailed = true;
  s.players[0].cash = 490;
  s.deeds[39].owner = 0;
  s = apply(s, 0, 'jail-fine');
  assert.equal(s.phase, 'debt');
  s = apply(s, 0, 'mortgage', { id: 39 });
  s = apply(s, 0, 'pay-debt');
  assert.equal(s.phase, 'roll');
  assert.equal(s.players[0].jailed, false);
  s = apply(s, 0, 'roll', { dice: [1, 2] });
  assert.equal(s.players[0].position, 13);
});

test('building parity, hotel supply, mortgaging and net worth are enforced', () => {
  let s = holdings(createBusiness(), 'indigo', 0);
  const [a, b] = DEEDS.filter(id => BOARD[id].group === 'indigo');
  assert.throws(() => apply(s, 0, 'mortgage', { id: 4 }), /Own/);
  s = apply(s, 0, 'build', { id: a, kind: 'house' });
  assert.equal(s.houses, 31);
  assert.throws(() => apply(s, 0, 'build', { id: a, kind: 'house' }), /evenly/);
  assert.throws(() => apply(s, 0, 'mortgage', { id: b }), /Sell all buildings/);
  s = apply(s, 0, 'build', { id: b, kind: 'house' });
  assert.equal(rent(s, a), BOARD[a].rent[1]);
  assert.equal(netWorth(s, 0), 15000 - 100 + 120 + 100);
  s = apply(s, 0, 'sell', { id: a });
  assert.equal(s.houses, 31);
  s = apply(s, 0, 'liquidate', { group: 'indigo' });
  s = apply(s, 0, 'mortgage', { id: a });
  assert.equal(rent(s, a), 0);
  s = apply(s, 0, 'release', { id: a });
  assert.equal(s.deeds[a].mortgaged, false);
});

test('card decks are privately projected, transfers of free cards preserve the finite deck', () => {
  const s = createBusiness();
  assert.equal(validBusiness(s), true);
  const view = publicBusiness(s);
  assert.equal(Object.hasOwn(view, 'decks'), false);
  assert.equal(validBusiness(view, 2, { publicView: true }), true);
  assert.equal(validBusiness(view), false);
  s.decks.fortune.draw = [CARDS.fortune.findIndex(card => card[1] === 'free'),
    ...s.decks.fortune.draw.filter(i => CARDS.fortune[i][1] !== 'free')];
  s.players[0].position = 5;
  const drawn = apply(s, 0, 'roll', { dice: [1, 1] });
  assert.deepEqual(drawn.players[0].cards, ['fortune']);
  assert.equal(validBusiness(drawn), true);
  assert.equal(drawn.decks.fortune.draw.includes(5), false);
});

test('trade settlement is atomic and rejects stale, improved or insolvent deed transfers', () => {
  let s = createBusiness();
  s.deeds[1].owner = 0; s.deeds[3].owner = 1;
  s.deeds[1].mortgaged = true;
  s = apply(s, 0, 'offer', { to: 1, offered: [1], wanted: [3], cashOut: 10, cashIn: 20,
    cardsOut: 0, cardsIn: 0 });
  assert.throws(() => apply(s, 0, 'accept'), /recipient/);
  assert.equal(s.deeds[1].owner, 0);
  s = apply(s, 1, 'accept');
  assert.equal(s.deeds[1].owner, 1);
  assert.equal(s.deeds[3].owner, 0);
  assert.equal(s.players[1].cash, 15000 + 10 - 20 - 3);
  assert.throws(() => apply(s, 1, 'accept'), /recipient/);
});

test('the recipient can counter; a stale or unaffordable offer never transfers anything', () => {
  let s = createBusiness();
  s.deeds[1].owner = 0; s.deeds[3].owner = 1;
  s = apply(s, 0, 'offer', { to: 1, offered: [1], wanted: [],
    cashOut: 0, cashIn: 50, cardsOut: 0, cardsIn: 0 });
  s = apply(s, 1, 'counter', { to: 0, offered: [3], wanted: [1],
    cashOut: 100, cashIn: 10, cardsOut: 0, cardsIn: 0 });
  assert.deepEqual([s.offer.from, s.offer.to], [1, 0]);
  s.players[1].cash = 0;
  assert.throws(() => apply(s, 0, 'accept'), /Cash must cover/);
  assert.equal(s.deeds[1].owner, 0);
  assert.equal(s.deeds[3].owner, 1);
  s.players[1].cash = 15000;
  s.deeds[3].owner = 2;
  assert.throws(() => apply(s, 0, 'accept'), /validation/);
});

test('remote move allowlist excludes injected dice and invalid keys', () => {
  assert.equal(validBusinessMove({ type: 'roll' }), true);
  assert.equal(validBusinessMove({ type: 'roll', dice: [6, 6] }), false);
  assert.equal(validBusinessMove({ type: 'bid', amount: -1 }), false);
  assert.equal(validBusinessMove({ type: 'build', id: 7, kind: 'house' }), false);
  assert.equal(validBusinessMove({ type: 'counter', to: 0, offered: [], wanted: [],
    cashOut: 3, cashIn: 0, cardsOut: 0, cardsIn: 0 }), true);
});

test('host authority rejects stale revision, forged dice, unknown seat and wrong phase without changing state', () => {
  const s = createBusiness();
  const ids = ['host', 'guest'];
  const envelope = (revision, move, round = 0) =>
    ({ type: 'bs-request', revision, round, move });
  assert.throws(() => applyRemoteBusinessAction(s,
    envelope(0, { type: 'roll', dice: [6, 6] }), 0, ids[0], ids), /invalid/);
  assert.throws(() => applyRemoteBusinessAction(s,
    envelope(1, { type: 'roll' }), 0, ids[0], ids), /Stale/);
  assert.throws(() => applyRemoteBusinessAction(s,
    envelope(0, { type: 'roll' }), 0, 'spectator', ids), /not playing/);
  assert.throws(() => applyRemoteBusinessAction(s,
    envelope(0, { type: 'roll' }), 0, ids[1], ids, [1, 2]), /Wait/);
  assert.throws(() => applyRemoteBusinessAction(s,
    { revision: 0, round: 0, move: { type: 'roll' } }, 0, ids[0], ids, [1, 2]), /invalid/);
  assert.equal(s.revision, 0);
  const next = applyRemoteBusinessAction(s,
    envelope(0, { type: 'roll' }), 0, ids[0], ids, [1, 2]);
  assert.equal(next.revision, 1);
  assert.equal(next.players[0].position, 3);
  assert.equal(s.players[0].position, 0);
});

test('room snapshot accepts legitimate new-round revision reset, rejects rollback and leaked decks', () => {
  const previous = apply(createBusiness(), 0, 'roll', { dice: [1, 2] });
  const fresh = createBusiness();
  const msg = (round, view, type = 'bs-state') => ({ type, round, view });
  assert.equal(validBusinessSnapshot(msg(1, publicBusiness(fresh)), 2, 0, previous.revision), true);
  assert.equal(validBusinessSnapshot(msg(0, publicBusiness(fresh)), 2, 0, previous.revision), false);
  assert.equal(validBusinessSnapshot(msg(0, publicBusiness(previous)), 2, 1, 0), false);
  assert.equal(validBusinessSnapshot(msg(1, { ...publicBusiness(fresh), decks: fresh.decks }), 2, 0, 1), false);
  assert.equal(validBusinessSnapshot({ ...msg(1, publicBusiness(fresh), 'bs-reject'),
    message: 'x'.repeat(201) }, 2, 0, 1), false);
});

test('deed inspection exposes the full price and rent ladder before purchase', () => {
  const s = createBusiness();
  const details = businessSpaceDetails(publicBusiness(s), 1);
  assert.equal(details.space.name, 'Pune');
  assert.equal(details.space.price, 60);
  assert.equal(details.mortgage, 30);
  assert.equal(details.tiers.length, 6);
  assert.deepEqual(details.tiers.map(tier => tier.amount), BOARD[1].rent);
  assert.deepEqual(details.groupCities, [1, 3]);
  assert.equal(businessSpaceDetails(publicBusiness(s), 5).tiers.length, 4);
  assert.throws(() => businessSpaceDetails(publicBusiness(s), 99), /Unknown/);
});

test('portfolio displays only executable build, sell and mortgage actions', () => {
  let s = createBusiness();
  s.deeds[1].owner = 0;
  assert.equal(businessDeedActions(s, 0, 1).some(a => a.move.type === 'build'), false);
  assert.match(businessBuildHint(s, 0, 1), /Complete/);
  s.deeds[3].owner = 0;
  assert.equal(businessDeedActions(s, 0, 1).some(a => a.move.type === 'build'), true);
  s.deeds[3].mortgaged = true;
  assert.equal(businessDeedActions(s, 0, 1).some(a => a.move.type === 'build'), false);
  assert.match(businessBuildHint(s, 0, 1), /mortgages/);
  assert.equal(businessDeedActions(s, 0, 3).some(a => a.move.type === 'release'), true);
  s.deeds[3].mortgaged = false;
  s = apply(s, 0, 'build', { id: 1, kind: 'house' });
  assert.equal(businessDeedActions(s, 0, 1).some(a => a.move.type === 'mortgage'), false);
  assert.equal(businessDeedActions(s, 0, 1).some(a => a.move.type === 'sell'), true);
  assert.equal(businessDeedActions(s, 0, 1).some(a => a.move.type === 'build'), false);
});

test('local restore hands the phone to the active trade, auction or debt respondent', () => {
  let s = createBusiness();
  assert.equal(businessResponder(s), 0);
  assert.equal(businessActionContext(s, 0), 'roll');
  s = apply(s, 0, 'offer', { to: 1, offered: [], wanted: [],
    cashOut: 100, cashIn: 0, cardsOut: 0, cardsIn: 0 });
  const restoredTrade = structuredClone(s);
  assert.equal(restoredTrade.current, 0);
  assert.equal(businessResponder(restoredTrade), 1);
  assert.equal(businessActionContext(restoredTrade, 1), 'trade-response',
    'the primary response overrides the underlying roll phase');
  assert.equal(businessActionContext(restoredTrade, 0), 'trade-wait');
  s = apply(s, 1, 'reject');
  s = apply(s, 0, 'roll', { dice: [1, 2] });
  s = apply(s, 0, 'decline');
  s = apply(s, 0, 'pass');
  assert.equal(businessResponder(structuredClone(s)), 1);
  let debt = createBusiness();
  debt.players[0].cash = 0; debt.players[0].position = 1;
  debt = apply(debt, 0, 'roll', { dice: [1, 2] });
  assert.equal(businessResponder(structuredClone(debt)), 0);
  assert.equal(businessActionContext(debt, 0), 'debt');
});

test('Fortune movement title agrees with the destination deed', () => {
  let s = createBusiness();
  const index = CARDS.fortune.findIndex(card => card[0] === 'Travel to New Delhi');
  assert.equal(CARDS.fortune[index][2], BOARD.find(space => space.name === 'New Delhi').id);
  s.decks.fortune.draw = [index, ...s.decks.fortune.draw.filter(id => id !== index)];
  s.players[0].position = 5;
  s = apply(s, 0, 'roll', { dice: [1, 1] });
  assert.equal(s.players[0].position, 39);
  assert.equal(BOARD[s.players[0].position].name, 'New Delhi');
  assert.equal(s.phase, 'buy');
  assert.ok(s.log.some(entry => entry.includes('Fortune · Travel to New Delhi: travel to New Delhi.')));
});

test('reset, host reset and dispose invalidate old animated dice without invalidating new rolls', () => {
  const cycle = createBusinessRollCycle();
  const first = cycle.capture(0, 0);
  assert.equal(cycle.allows(first, 0, 0), true);
  cycle.cancel();
  assert.equal(first.controller.signal.aborted, true);
  assert.equal(cycle.allows(first, 1, 0), false);
  const fresh = cycle.capture(1, 0);
  assert.equal(cycle.allows(fresh, 1, 0), true);
  assert.equal(cycle.allows(fresh, 1, 1), false, 'an intervening accepted move invalidates the roll');
  cycle.cancel();
  assert.equal(cycle.allows(fresh, 1, 0), false);
  assert.equal(cycle.isCurrent(fresh), false);
});

test('decks settle each-player obligations in order; no debt or card is silently skipped', () => {
  let s = createBusiness(3);
  const id = CARDS.fund.findIndex(c => c[0] === 'Birthday gifts');
  s.decks.fund.draw = [id, ...s.decks.fund.draw.filter(x => x !== id)];
  s.players[1].cash = 0;
  s = apply(s, 0, 'roll', { dice: [1, 1] });
  assert.equal(s.phase, 'debt');
  assert.equal(s.debt.from, 1);
  assert.equal(s.queue[0].to, 0);
  s.deeds[39].owner = 1;
  s = apply(s, 1, 'mortgage', { id: 39 });
  s = apply(s, 1, 'pay-debt');
  assert.equal(s.players[0].cash, 15050);
  assert.equal(s.players[1].cash, 175);
  assert.equal(s.players[2].cash, 14975);
  assert.equal(s.phase, 'roll');
});

test('bankruptcy inherits creditor deeds with interest or auctions bank assets', () => {
  let s = createBusiness(3);
  s.players[0].cash = 0;
  s.deeds[1].owner = 0; s.deeds[1].mortgaged = true;
  s.deeds[3].owner = 1;
  s.players[0].position = 0;
  s = apply(s, 0, 'roll', { dice: [1, 2] });
  assert.equal(s.phase, 'debt');
  s = apply(s, 0, 'bankrupt');
  assert.equal(s.players[0].out, true);
  assert.equal(s.deeds[1].owner, 1);
  assert.equal(s.players[1].cash, 15000 - 3);
  assert.equal(s.phase, 'roll');
  assert.equal(s.current, 1, 'an eliminated player cannot be asked to end a turn');

  let bank = createBusiness(3);
  bank.players[0].cash = 0;
  bank.deeds[39].owner = 0;
  bank.players[0].position = 0;
  bank = apply(bank, 0, 'roll', { dice: [2, 2] });
  assert.equal(bank.phase, 'debt');
  bank = apply(bank, 0, 'bankrupt');
  assert.equal(bank.phase, 'auction');
  assert.equal(bank.auction.id, 39);
  bank = apply(bank, 1, 'bid', { amount: 50 });
  bank = apply(bank, 2, 'pass');
  assert.equal(bank.deeds[39].owner, 1);
  assert.equal(bank.current, 1);
  assert.equal(bank.phase, 'roll');
  assert.equal(validBusiness(bank), true);
});

test('inherited mortgage interest becomes a real debt for an insolvent creditor', () => {
  let s = createBusiness(3);
  s.players[0].cash = 0;
  s.players[1].cash = 0;
  s.deeds[1].owner = 0;
  s.deeds[1].mortgaged = true;
  s.deeds[3].owner = 1;
  s = apply(s, 0, 'roll', { dice: [1, 2] });
  s = apply(s, 0, 'bankrupt');
  assert.equal(s.phase, 'debt');
  assert.equal(s.debt.from, 1);
  assert.equal(s.debt.amount, 3);
  s = apply(s, 1, 'mortgage', { id: 3 });
  s = apply(s, 1, 'pay-debt');
  assert.equal(s.phase, 'roll');
  assert.equal(s.current, 1);
  assert.equal(s.players[1].cash, 27);
});

test('the scarce last house is auctioned between eligible developers', () => {
  let s = createBusiness(3);
  for (const group of ['indigo', 'sky', 'rose', 'saffron']) holdings(s, group, group === 'rose' ? 1 : 0);
  for (const id of DEEDS.filter(x => BOARD[x].group === 'indigo' ||
    BOARD[x].group === 'sky')) s.deeds[id].level = 4;
  const rose = DEEDS.filter(id => BOARD[id].group === 'rose');
  rose.forEach((id, i) => { s.deeds[id].level = i === 2 ? 3 : 4; });
  s.houses = 1;
  assert.equal(validBusiness(s), true);
  const saffron = DEEDS.find(id => BOARD[id].group === 'saffron');
  s = apply(s, 0, 'build', { id: saffron, kind: 'house' });
  assert.equal(s.phase, 'auction');
  s = apply(s, 0, 'bid', { amount: 100 });
  s = apply(s, 1, 'bid', { amount: 110 });
  s = apply(s, 0, 'pass');
  assert.equal(s.phase, 'award');
  s = apply(s, 1, 'place-award', { id: rose[2] });
  assert.equal(s.houses, 0);
  assert.equal(s.deeds[rose[2]].level, 4);
  assert.equal(s.players[1].cash, 14890);
  assert.equal(validBusiness(s), true);
});

test('an exhausted house bank still allows full-group hotel liquidation', () => {
  let s = createBusiness();
  for (const group of ['indigo', 'sky', 'rose', 'saffron']) holdings(s, group, 0);
  const indigo = DEEDS.filter(id => BOARD[id].group === 'indigo');
  s.deeds[indigo[0]].level = 5; s.deeds[indigo[1]].level = 4;
  for (const id of DEEDS.filter(id => ['sky', 'rose'].includes(BOARD[id].group))) s.deeds[id].level = 4;
  const saffron = DEEDS.filter(id => BOARD[id].group === 'saffron');
  saffron.forEach((id, i) => { s.deeds[id].level = i === 0 ? 2 : 1; });
  s.houses = 0; s.hotels = 11;
  assert.equal(validBusiness(s), true);
  assert.throws(() => apply(s, 0, 'sell', { id: indigo[0] }), /Liquidate/);
  s = apply(s, 0, 'liquidate', { group: 'indigo' });
  assert.equal(s.houses, 4);
  assert.equal(s.hotels, 12);
  assert.equal(s.deeds[indigo[0]].level, 0);
});

test('malformed public and private checkpoints reject impossible stocks, owners and deck leakage', () => {
  const s = createBusiness();
  const view = publicBusiness(s);
  const bad = structuredClone(s);
  bad.houses = 31;
  assert.equal(validBusiness(bad), false);
  bad.houses = 32; bad.deeds[1].owner = 8;
  assert.equal(validBusiness(bad), false);
  const leaked = { ...view, decks: s.decks };
  assert.equal(validBusiness(leaked, 2, { publicView: true }), false);
  view.queue.push({ type: 'charge', from: 99, to: 0, amount: 100, label: 'forgery' });
  assert.equal(validBusiness(view, 2, { publicView: true }), false);
});

test('salary, optional jackpot, exact Start bonus and turn-limit ties are explicit', () => {
  let s = createBusiness(2, { exactStartBonus: true, jackpot: true, turnLimit: 2 });
  s.players[0].position = 37;
  s = apply(s, 0, 'roll', { dice: [1, 2] });
  assert.equal(s.players[0].cash, 18000);
  assert.equal(s.phase, 'finish');
  s = apply(s, 0, 'end');
  s.players[1].position = 17;
  s = apply(s, 1, 'roll', { dice: [1, 2] });
  assert.equal(s.players[1].position, 20);
  s = apply(s, 1, 'end');
  assert.equal(s.phase, 'win');
  assert.deepEqual(s.winners, [0]);
  assert.equal(s.winner, 0);
  let tie = createBusiness(2, { turnLimit: 1 });
  tie.phase = 'finish';
  tie = apply(tie, 0, 'end');
  assert.deepEqual(tie.winners, [0, 1]);
  assert.equal(tie.winner, null);
});

test('no eligible bidders ends a property offer without leaving a stale completion', () => {
  let s = createBusiness();
  s.players.forEach(p => { p.cash = 0; });
  s = apply(s, 0, 'roll', { dice: [1, 2] });
  assert.equal(s.phase, 'buy');
  s = apply(s, 0, 'decline');
  assert.equal(s.phase, 'finish');
  assert.deepEqual(s.queue, []);
  s = apply(s, 0, 'end');
  assert.equal(s.current, 1);
});
