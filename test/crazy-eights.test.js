import test from 'node:test';
import assert from 'node:assert/strict';
import { shuffledDeck, canPlay, penalty, newCrazyEightsGame, actCrazyEights,
  crazyEightsView, applyRemoteCrazyEightsAction, validCrazyEightsCheckpoint } from '../games/crazy-eights.js';

const id = card => `${card.suit}:${card.rank}`;

function rig() {
  const state = newCrazyEightsGame(() => 0.5);
  state.stock = shuffledDeck(() => 0.5);
  state.discard = [take(state, '♠', '5')];
  state.hands = [[], []];
  state.activeSuit = '♠';
  state.current = 0;
  state.phase = 'play';
  state.drawn = false;
  state.passes = 0;
  state.pendingEight = null;
  state.winner = null;
  state.ending = '';
  state.turn = 1;
  return state;
}

function take(state, suit, rank, player) {
  const index = state.stock.findIndex(card => card.suit === suit && card.rank === rank);
  assert.notEqual(index, -1);
  const [card] = state.stock.splice(index, 1);
  if (player !== undefined) state.hands[player].push(card);
  return card;
}

test('deal, cards, rule matching and penalties', () => {
  const s = newCrazyEightsGame(() => 0.5);
  assert.deepEqual(s.hands.map(hand => hand.length), [7, 7]);
  assert.notEqual(s.discard[0].rank, '8');
  assert.equal(validCrazyEightsCheckpoint(s), true);
  assert.equal(new Set(shuffledDeck().map(id)).size, 52);
  assert.equal(canPlay({ suit: '♥', rank: '8' }, { suit: '♠', rank: '5' }, '♠'), true);
  assert.equal(canPlay({ suit: '♥', rank: '5' }, { suit: '♠', rank: '5' }, '♠'), true);
  assert.equal(canPlay({ suit: '♥', rank: '6' }, { suit: '♠', rank: '5' }, '♥'), true);
  assert.equal(canPlay({ suit: '♥', rank: '6' }, { suit: '♠', rank: '5' }, '♠'), false);
  assert.equal(penalty([{ rank: '8' }, { rank: 'K' }, { rank: 'A' }, { rank: '9' }]), 70);
  const corrupt = structuredClone(s);
  corrupt.hands[1][0] = corrupt.hands[0][0];
  assert.equal(validCrazyEightsCheckpoint(corrupt), false);
  const curtain = { ...s, phase: 'handoff' };
  assert.equal(validCrazyEightsCheckpoint(curtain), true);
});

test('draw once, play an old card or pass, with a valid resumable checkpoint', () => {
  const s = rig();
  const old = take(s, '♠', '2', 0);
  take(s, '♥', '4', 1);
  assert.equal(actCrazyEights(s, { type: 'pass' }), false);
  assert.equal(actCrazyEights(s, { type: 'draw' }), true);
  assert.equal(validCrazyEightsCheckpoint(s), true);
  assert.equal(actCrazyEights(s, { type: 'draw' }), false);
  assert.equal(actCrazyEights(s, { type: 'play', id: id(old) }), true);
  assert.equal(s.current, 1);
  assert.equal(s.drawn, false);
  assert.equal(s.discard.at(-1), old);

  const t = rig();
  take(t, '♥', '4', 0);
  take(t, '♦', '6', 1);
  assert.equal(actCrazyEights(t, { type: 'pass' }), false);
  assert.equal(actCrazyEights(t, { type: 'draw' }), true);
  assert.equal(actCrazyEights(t, { type: 'pass' }), true);
  assert.equal(t.current, 1);
});

test('an eight remains held until its player chooses a valid suit', () => {
  const s = rig();
  const eight = take(s, '♥', '8', 0);
  take(s, '♦', '3', 0);
  take(s, '♣', '4', 1);
  assert.equal(actCrazyEights(s, { type: 'play', id: id(eight) }), true);
  assert.equal(s.phase, 'choose');
  assert.equal(validCrazyEightsCheckpoint(s), true);
  assert.equal(s.hands[0].includes(eight), true);
  assert.equal(actCrazyEights(s, { type: 'choose', suit: 'invalid' }), false);
  assert.equal(actCrazyEights(s, { type: 'draw' }), false);
  assert.equal(actCrazyEights(s, { type: 'choose', suit: '♦' }), true);
  assert.equal(s.discard.at(-1), eight);
  assert.equal(s.activeSuit, '♦');
  assert.equal(s.current, 1);
  assert.equal(validCrazyEightsCheckpoint(s), true);
});

test('drawing recycles only the covered discard, leaving the top card in place', () => {
  const s = rig();
  take(s, '♥', '4', 0);
  take(s, '♦', '6', 1);
  s.discard.push(take(s, '♣', '3'));
  s.activeSuit = '♣';
  s.stock = [];
  const top = s.discard.at(-1);
  assert.equal(actCrazyEights(s, { type: 'draw' }, () => 0.5), true);
  assert.equal(s.discard.length, 1);
  assert.equal(s.discard[0], top);
  assert.equal(s.hands[0].some(card => id(card) === '♠:5'), true);
  assert.equal(actCrazyEights(s, { type: 'draw' }), false);
});

test('last card and blocked lowest penalty or tied result', () => {
  const s = rig();
  take(s, '♠', '2', 0);
  take(s, '♥', '8', 1);
  assert.equal(actCrazyEights(s, { type: 'play', id: '♠:2' }), true);
  assert.equal(s.winner, 0);
  assert.equal(s.phase, 'over');
  assert.equal(actCrazyEights(s, { type: 'draw' }), false);
  assert.equal(crazyEightsView(s, 1).ending, 'empty');
  assert.equal(crazyEightsView(s, 1).phase, 'over', 'the opponent receives the result too');
  for (const [first, second, winner] of [[['♥', '4'], ['♦', '9'], 0],
    [['♥', '4'], ['♦', '4'], null]]) {
    const blocked = rig();
    take(blocked, ...first, 0);
    take(blocked, ...second, 1);
    blocked.stock = [];
    assert.equal(actCrazyEights(blocked, { type: 'pass' }), true);
    assert.equal(actCrazyEights(blocked, { type: 'pass' }), true);
    assert.equal(blocked.winner, winner);
    assert.equal(blocked.ending, 'blocked');
    assert.deepEqual(crazyEightsView(blocked, 0).scores,
      blocked.hands.map(penalty));
  }
});

test('private views expose only own cards and never stock or other hands', () => {
  const s = newCrazyEightsGame(() => 0.5);
  for (let i = 0; i < 2; i++) {
    const view = crazyEightsView(s, i);
    assert.deepEqual(view.hand, s.hands[i]);
    assert.notStrictEqual(view.hand[0], s.hands[i][0]);
    assert.deepEqual(view.counts, [7, 7]);
    const serialized = JSON.stringify(view);
    assert.equal(serialized.includes('"stock"'), false);
    assert.equal(serialized.includes('"hands"'), false);
    for (const card of s.hands[1 - i])
      assert.equal(view.hand.some(held => id(held) === id(card)), false);
  }
  take(s, '♠', '8'); // no information about the other player's options is exported
  assert.equal(crazyEightsView(s, 1).canPass, false);
  s.phase = 'choose';
  s.pendingEight = s.hands[0].findIndex(card => card.rank === '8');
  assert.equal(crazyEightsView(s, 1).phase, 'play');
  assert.equal(crazyEightsView(s, 1).drawn, false);
});

test('host rejects stale, out-of-turn, unknown, duplicate and forged requests', () => {
  const s = rig();
  take(s, '♠', '2', 0);
  take(s, '♥', '4', 0);
  take(s, '♦', '3', 1);
  const seats = ['host', 'guest'];
  const req = (move, revision = 4) => ({ type: 'crazy-eights-request', revision, move });
  const before = structuredClone(s);
  for (const request of [
    [req({ type: 'play', id: '♠:2' }, 3), 'host'],
    [req({ type: 'play', id: '♠:2' }), 'guest'],
    [req({ type: 'play', id: '♥:4' }), 'host'],
    [req({ type: 'play', id: '♠:9' }), 'host'],
    [req({ type: 'play', id: '♠:2', suit: '♣' }), 'host'],
    [req({ type: 'pass' }), 'host'],
    [req({ type: 'choose', suit: '♣' }), 'host'],
    [{ type: 'crazy-eights-reset', revision: 4, move: { type: 'draw' } }, 'host'],
  ]) {
    assert.equal(applyRemoteCrazyEightsAction(s, request[0], 4, request[1], seats), false);
    assert.deepEqual(s, before);
  }
  assert.equal(applyRemoteCrazyEightsAction(s, req({ type: 'play', id: '♠:2' }), 4, 'host', seats), true);
  assert.equal(s.current, 1);
  assert.equal(applyRemoteCrazyEightsAction(s, req({ type: 'draw' }), 4, 'host', seats), false);
  assert.equal(applyRemoteCrazyEightsAction(s, req({ type: 'draw' }, 5), 5, 'guest', seats), true);
  assert.equal(applyRemoteCrazyEightsAction(s, req({ type: 'draw' }, 6), 6, 'guest', seats), false);
  const eight = take(s, '♦', '8', 1);
  assert.equal(applyRemoteCrazyEightsAction(s, req({ type: 'play', id: id(eight) }, 6),
    6, 'guest', seats), true);
  assert.equal(applyRemoteCrazyEightsAction(s, req({ type: 'choose', suit: '♣' }, 7),
    7, 'host', seats), false);
  assert.equal(applyRemoteCrazyEightsAction(s, req({ type: 'choose', suit: '♣', id: id(eight) }, 7),
    7, 'guest', seats), false);
  assert.equal(applyRemoteCrazyEightsAction(s, req({ type: 'choose', suit: '♣' }, 7),
    7, 'guest', seats), true);
});
