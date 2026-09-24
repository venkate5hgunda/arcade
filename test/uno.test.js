import test from 'node:test';
import assert from 'node:assert/strict';
import { unoDeck, newUnoGame, canPlayUno, actUno, applyRemoteUnoAction, recycleUno,
  unoView, validUnoCheckpoint } from '../games/uno.js';

function rig(count = 3) {
  const state = newUnoGame(count, () => 0.5);
  const deck = unoDeck();
  state.hands = Array.from({ length: count }, () => []);
  state.discard = [deck[0]];
  state.color = 'red';
  state.stock = deck.slice(1);
  state.current = 0;
  state.direction = 1;
  state.drawnId = null;
  state.passes = 0;
  state.winner = null;
  state.turn = 1;
  const give = (seat, color, value) => {
    const index = state.stock.findIndex(card => card.color === color && card.value === value);
    const [card] = state.stock.splice(index, 1);
    assert.ok(card, `${color} ${value} available`);
    state.hands[seat].push(card);
    return card;
  };
  return { state, give };
}

test('108-card deal is unique, seven cards per player, and resumable', () => {
  assert.equal(unoDeck().length, 108);
  for (const count of [2, 3, 4]) {
    const s = newUnoGame(count);
    assert.deepEqual(s.hands.map(hand => hand.length), Array(count).fill(7));
    assert.match(s.discard[0].value, /^[0-9]$/);
    assert.equal(validUnoCheckpoint(s), true);
    const corrupt = structuredClone(s);
    corrupt.stock[0] = corrupt.hands[0][0];
    assert.equal(validUnoCheckpoint(corrupt), false);
  }
  assert.throws(() => newUnoGame(5), /2–4/);
});

test('skip, reverse including two-player repeat, and drawing penalties advance correctly', () => {
  for (const count of [2, 3, 4]) {
    const { state: s, give } = rig(count);
    const reverse = give(0, 'red', 'reverse');
    give(0, 'blue', '9');
    assert.equal(actUno(s, { type: 'play', id: reverse.id }), true);
    assert.equal(s.direction, -1);
    assert.equal(s.current, count === 2 ? 0 : count - 1);
  }
  const { state: s, give } = rig(4);
  const skip = give(0, 'red', 'skip');
  give(0, 'blue', '9');
  assert.equal(actUno(s, { type: 'play', id: skip.id }), true);
  assert.equal(s.current, 2);
  const plusTwo = give(2, 'red', 'draw2');
  give(2, 'blue', '9');
  const before = s.hands[3].length;
  assert.equal(actUno(s, { type: 'play', id: plusTwo.id }), true);
  assert.equal(s.hands[3].length, before + 2);
  assert.equal(s.current, 0);
  const wildFour = give(0, 'wild', 'wild4');
  const colored = give(0, 'red', '8');
  assert.equal(canPlayUno(s, wildFour), false);
  assert.equal(actUno(s, { type: 'play', id: wildFour.id, color: 'blue' }), false);
  assert.equal(actUno(s, { type: 'play', id: colored.id }), true);
  s.current = 0;
  assert.equal(actUno(s, { type: 'play', id: wildFour.id, color: 'purple' }), false);
  assert.equal(actUno(s, { type: 'play', id: wildFour.id, color: 'blue' }), true);
  assert.equal(s.color, 'blue');
  assert.equal(s.current, 2);
  assert.equal(s.hands[1].length, before + 4);
});

test('one drawn card may be played or passed; old cards may not be played that turn', () => {
  const { state: s, give } = rig(2);
  const old = give(0, 'red', '5');
  give(1, 'yellow', '4');
  assert.equal(actUno(s, { type: 'pass' }), false);
  assert.equal(actUno(s, { type: 'draw' }), true);
  assert.equal(actUno(s, { type: 'draw' }), false);
  assert.equal(canPlayUno(s, old), false);
  assert.equal(actUno(s, { type: 'play', id: old.id }), false);
  assert.equal(actUno(s, { type: 'pass' }), true);
  assert.equal(s.current, 1);
  assert.equal(s.drawnId, null);
});

test('a drawn playable card can be played, wild color is required, and two-player +4 skips', () => {
  const { state: s, give } = rig(2);
  const wild = give(0, 'wild', 'wild4');
  give(0, 'blue', '8');
  give(1, 'yellow', '4');
  assert.equal(actUno(s, { type: 'play', id: wild.id }), false);
  assert.equal(actUno(s, { type: 'play', id: wild.id, color: 'green' }), true);
  assert.equal(s.current, 0);
  assert.equal(s.hands[1].length, 5);
  assert.equal(s.color, 'green');
  const drawn = s.stock.at(-1);
  s.color = drawn.color === 'wild' ? 'green' : drawn.color;
  assert.equal(actUno(s, { type: 'draw' }), true);
  assert.equal(s.drawnId, drawn.id);
  assert.equal(canPlayUno(s, drawn), true);
  assert.equal(actUno(s, { type: 'play', id: drawn.id,
    ...(drawn.color === 'wild' ? { color: 'yellow' } : {}) }), true);
  assert.equal(s.drawnId, null);
});

test('discard recycling preserves top, blocked games terminate, last card wins', () => {
  const { state: s, give } = rig(2);
  const last = give(0, 'red', '5');
  const other = give(1, 'blue', '6');
  s.stock = [];
  s.discard.push(...unoDeck().filter(card => card.id !== last.id && card.id !== other.id &&
    card.id !== s.discard[0].id));
  recycleUno(s, () => 0.5);
  assert.equal(s.stock.length, 105);
  assert.equal(s.discard.length, 1);
  assert.equal(validUnoCheckpoint(s), true);
  assert.equal(actUno(s, { type: 'play', id: last.id }), true);
  assert.equal(s.winner, 0);
  assert.equal(actUno(s, { type: 'draw' }), false);

  const blocked = rig(2);
  const b = blocked.state;
  blocked.give(0, 'blue', '6');
  blocked.give(1, 'green', '7');
  b.stock = [];
  b.discard = [b.discard[0]];
  assert.equal(actUno(b, { type: 'pass' }), true);
  assert.equal(actUno(b, { type: 'pass' }), true);
  assert.equal(b.winner, -1);
});

test('remote views expose only own hand and public information', () => {
  const s = newUnoGame(4);
  for (let player = 0; player < 4; player++) {
    const v = unoView(s, player);
    assert.deepEqual(v.hand, s.hands[player]);
    assert.deepEqual(v.counts, [7, 7, 7, 7]);
    for (let opponent = 0; opponent < 4; opponent++) if (opponent !== player)
      for (const card of s.hands[opponent]) assert.equal(JSON.stringify(v).includes(`"id":${card.id},`), false);
    assert.equal(JSON.stringify(v).includes('"stock"'), false);
  }
  const blocked = rig(2);
  blocked.give(0, 'blue', '6');
  blocked.give(1, 'green', '7');
  blocked.state.stock = [];
  assert.equal(unoView(blocked.state, 0).canPass, true);
  assert.equal(unoView(blocked.state, 1).canPass, false,
    'an opponent does not learn whether the current hand can play');
});

test('host rejects stale revisions, out-of-turn requests and illegal card IDs', () => {
  const { state: s, give } = rig(2);
  const card = give(0, 'red', '5');
  give(0, 'blue', '9');
  give(1, 'green', '1');
  const seats = ['host', 'guest'];
  const request = { type: 'uno-request', revision: 3, move: { type: 'play', id: card.id } };
  assert.equal(applyRemoteUnoAction(s, request, 4, seats[0], seats), false);
  assert.equal(applyRemoteUnoAction(s, request, 3, seats[1], seats), false);
  assert.equal(applyRemoteUnoAction(s, { ...request, move: { type: 'play', id: 999 } },
    3, seats[0], seats), false);
  assert.equal(s.current, 0);
  assert.equal(s.discard.length, 1);
  assert.equal(applyRemoteUnoAction(s, request, 3, seats[0], seats), true);
  assert.equal(s.current, 1);
  assert.equal(s.discard.at(-1).id, card.id);
  assert.equal(applyRemoteUnoAction(s, request, 4, seats[0], seats), false);
});
