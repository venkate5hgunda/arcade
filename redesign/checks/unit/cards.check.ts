import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  newCards,
  applyCards,
  cardView,
  validCardState,
  validCardView,
  finishedCards,
  newUnoGame,
  unoDeck,
  actUno,
  validUnoCheckpoint,
  validCrazyEightsCheckpoint,
  newCrazyEightsGame,
  actCrazyEights,
} from '../../src/lib/cards.ts';
import type {
  CardState,
  UnoAction,
  UnoState,
  UnoCard,
  EightAction,
} from '../../src/lib/cards.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
const rng = (seed: number) => () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
};

test('typed private-card deals and complete rounds match original engines, including 20-player tables', async () => {
  const eight = await import(
    pathToFileURL(resolve('../games/crazy-eights.js')).href
  );
  const uno = await import(pathToFileURL(resolve('../games/uno.js')).href);
  for (const gameId of ['crazy-eights', 'uno'] as const)
    for (const count of gameId === 'uno' ? [2, 3, 10, 11, 20] : [2]) {
      const random = rng(count),
        baselineRandom = rng(count);
      let game = newCards(gameId, count, random);
      const expected =
        gameId === 'uno'
          ? uno.newUnoGame(count, baselineRandom)
          : eight.newCrazyEightsGame(baselineRandom);
      assert.deepEqual(game.state, expected);
      for (let step = 0; step < 6000 && !finishedCards(game); step++) {
        const view = cardView(game, game.state.current);
        assert.ok(validCardState(game));
        assert.ok(validCheckpoint(gameId, game.state));
        for (let seat = 0; seat < count; seat++) {
          const privateView = cardView(game, seat);
          assert.ok(validCardView(privateView, count, seat));
          assert.equal(
            validCardView(
              { ...privateView, stock: game.state.stock },
              count,
              seat,
            ),
            false,
          );
          assert.equal(
            validCardView(
              { ...privateView, hands: game.state.hands },
              count,
              seat,
            ),
            false,
          );
        }
        const action =
          gameId === 'crazy-eights'
            ? view.phase === 'choose'
              ? { type: 'choose', suit: '♥' }
              : view.legal.length
                ? { type: 'play', id: view.legal[0] }
                : view.canDraw && !view.drawn
                  ? { type: 'draw' }
                  : { type: 'pass' }
            : view.challenge
              ? { type: step % 2 ? 'accept' : 'challenge' }
              : view.hand.length === 2 && !view.unoDeclared
                ? { type: 'uno' }
                : view.legal.length
                  ? {
                      type: 'play',
                      id: Number(view.legal[0]),
                      ...(unoDeck(count)[Number(view.legal[0])].color === 'wild'
                        ? { color: 'blue' }
                        : {}),
                    }
                  : view.canDraw && !view.drawn
                    ? { type: 'draw' }
                    : { type: 'pass' };
        const actor = game.state.current;
        const next = applyCards(game, action, actor, random);
        assert.ok(next, `${gameId} ${count} step ${step}`);
        const accepted =
          gameId === 'uno'
            ? uno.actUno(expected, action, baselineRandom, actor)
            : eight.actCrazyEights(expected, action, baselineRandom);
        assert.ok(accepted);
        assert.deepEqual(next.state, expected);
        game = next;
      }
      assert.ok(finishedCards(game), `${gameId} ${count} finishes`);
      assert.ok(validCardState(game, true));
      assert.equal(validCheckpoint(gameId, game.state), false);
    }
});
function rigUno(count = 3) {
  const state = newUnoGame(count, () => 0.5);
  state.stock = unoDeck(count).slice(1);
  state.discard = [unoDeck(count)[0]];
  state.hands = Array.from({ length: count }, () => []);
  state.color = 'red';
  state.current = 0;
  state.direction = 1;
  state.drawnId = null;
  state.passes = 0;
  state.winner = null;
  state.turn = 1;
  state.challenge = null;
  state.unoPending = null;
  state.unoDeclared = null;
  const give = (seat: number, color: UnoCard['color'], value: string) => {
    const index = state.stock.findIndex(
      (c) => c.color === color && c.value === value,
    );
    assert.ok(index >= 0);
    const [card] = state.stock.splice(index, 1);
    state.hands[seat].push(card);
    return card;
  };
  return { state, give };
}
test('UNO draw-four challenges, one-card catch, draw restriction and two-player reverse preserve baseline semantics', () => {
  for (const illegal of [true, false]) {
    const { state: s, give } = rigUno();
    const wild = give(0, 'wild', 'wild4');
    give(0, illegal ? 'red' : 'blue', '7');
    give(1, 'green', '3');
    give(2, 'yellow', '6');
    assert.ok(actUno(s, { type: 'play', id: wild.id, color: 'green' }));
    assert.equal(s.winner, null);
    assert.equal(s.challenge?.illegal, illegal);
    assert.ok(actUno(s, { type: 'challenge' }));
    assert.equal(s.hands[illegal ? 0 : 1].length, illegal ? 5 : 7);
    assert.equal(s.current, illegal ? 1 : 2);
  }
  const { state: s, give } = rigUno(2);
  const reverse = give(0, 'red', 'reverse');
  give(0, 'green', '5');
  give(0, 'blue', '2');
  give(1, 'green', '7');
  assert.ok(actUno(s, { type: 'play', id: reverse.id }));
  assert.equal(s.current, 0);
  const { state: t, give: take } = rigUno();
  const red = take(0, 'red', '5');
  take(0, 'blue', '2');
  take(1, 'green', '8');
  take(2, 'blue', '9');
  assert.ok(actUno(t, { type: 'play', id: red.id }));
  assert.equal(t.unoPending, 0);
  assert.ok(actUno(t, { type: 'catch' }, () => 0.5, 1));
  assert.equal(t.hands[0].length, 3);
  const game: CardState = { gameId: 'uno', state: newUnoGame(3, () => 0.5) };
  const before = structuredClone(game);
  assert.equal(applyCards(game, { type: 'draw', stock: [] }, 0), null);
  assert.equal(applyCards(game, { type: 'draw' }, 1), null);
  assert.deepEqual(game, before);
  const draw = applyCards(game, { type: 'draw' }, 0)!;
  assert.equal(applyCards(draw, { type: 'draw' }, 0), null);
  assert.ok(
    cardView(draw, 0).legal.every(
      (id) => id === String((draw.state as UnoState).drawnId),
    ),
  );
});
test('Crazy Eights wild selection stays on the actor, final eight wins only after choosing, validators reject duplicate cards', () => {
  const s = newCrazyEightsGame(() => 0.5),
    deck = [...s.stock, ...s.discard, ...s.hands.flat()];
  const eight = deck.find((c) => c.rank === '8')!,
    top = deck.find((c) => c.rank === '5')!;
  s.hands = [[eight], [deck.find((c) => c !== top && c !== eight)!]];
  s.discard = [top];
  s.stock = deck.filter((c) => ![...s.hands.flat(), top].includes(c));
  s.activeSuit = top.suit;
  assert.ok(validCrazyEightsCheckpoint(s));
  assert.ok(actCrazyEights(s, { type: 'play', id: `${eight.suit}:8` }));
  assert.equal(s.phase, 'choose');
  assert.equal(s.current, 0);
  assert.ok(actCrazyEights(s, { type: 'choose', suit: '♦' }));
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 0);
  assert.ok(validCrazyEightsCheckpoint(s, true));
  const u = newUnoGame(20);
  assert.equal(u.stock.length, 75);
  const broken = structuredClone(u);
  broken.stock[0] = broken.hands[0][0];
  assert.equal(validUnoCheckpoint(broken), false);
});

test('a finished UNO blocked boundary can be inspected but never resumed as an active local checkpoint', () => {
  const s = newUnoGame(2, () => 0.5);
  s.passes = s.hands.length;
  s.winner = -1;
  assert.ok(validUnoCheckpoint(s, true));
  assert.ok(validCardState({ gameId: 'uno', state: s }, true));
  assert.equal(validCheckpoint('uno', s), false);
  assert.ok(validCardView(cardView({ gameId: 'uno', state: s }, 0), 2, 0));
});
