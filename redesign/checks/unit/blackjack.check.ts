import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUITS,
  RANKS,
  shuffledDeck,
  handValue,
  newBlackjack,
  actBlackjack,
  validBlackjack,
} from '../../src/lib/blackjack.ts';
import type { Card, BlackjackState } from '../../src/lib/blackjack.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
const card = (rank: Card['rank'], suit: Card['suit'] = '♠'): Card => ({
  rank,
  suit,
});
function hand(
  player: Card[],
  dealer: Card[],
  next: Card[] = [],
): BlackjackState {
  const used = [...player, ...dealer, ...next];
  return {
    player,
    dealer,
    deck: [
      ...SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank }))).filter(
        (c) => !used.some((u) => u.rank === c.rank && u.suit === c.suit),
      ),
      ...[...next].reverse(),
    ],
    result: null,
    doubled: false,
    round: 1,
    record: { wins: 0, losses: 0, pushes: 0, net: 0 },
    message: 'Your move.',
  };
}
test('deck, aces and baseline-compatible checkpoints preserve every card', () => {
  assert.equal(
    new Set(shuffledDeck(() => 0.5).map((c) => c.rank + c.suit)).size,
    52,
  );
  assert.deepEqual(handValue([card('A'), card('A', '♥'), card('9')]), {
    total: 21,
    soft: true,
  });
  assert.deepEqual(handValue([card('A'), card('6'), card('10')]), {
    total: 17,
    soft: false,
  });
  const s = hand([card('10'), card('6')], [card('9'), card('7')]);
  assert.ok(validBlackjack(s));
  assert.ok(validCheckpoint('blackjack', s));
  assert.equal(
    validBlackjack({ ...s, deck: [...s.deck.slice(1), s.player[0]] }),
    false,
  );
  assert.equal(validBlackjack({ ...s, result: 'win' }), false);
  assert.equal(
    validBlackjack({ ...s, record: { ...s.record, wins: 1 } }),
    false,
  );
});
test('hit, stand, soft 17, push, bust and double settle exactly once without mutating the input', () => {
  const s = hand([card('10'), card('8')], [card('A'), card('6')]);
  const won = actBlackjack(s, 'stand');
  assert.equal(won.result, 'win');
  assert.equal(won.dealer.length, 2);
  assert.equal(s.result, null);
  assert.equal(won.record.net, 1);
  assert.equal(actBlackjack(won, 'hit'), won);
  const push = actBlackjack(
    hand([card('10'), card('8')], [card('9'), card('9', '♥')]),
    'stand',
  );
  assert.equal(push.result, 'push');
  assert.equal(push.record.pushes, 1);
  const bust = actBlackjack(
    hand([card('10'), card('8')], [card('9'), card('7')], [card('5')]),
    'hit',
  );
  assert.equal(bust.result, 'loss');
  assert.equal(bust.record.net, -1);
  const doubled = actBlackjack(
    hand([card('5'), card('6')], [card('10'), card('7')], [card('K')]),
    'double',
  );
  assert.equal(doubled.player.length, 3);
  assert.equal(doubled.record.net, 2);
  assert.equal(doubled.result, 'win');
  const hit = actBlackjack(
    hand([card('2'), card('3')], [card('10'), card('7')], [card('4')]),
    'hit',
  );
  assert.equal(hit.result, null);
  assert.ok(validBlackjack(hit));
  assert.equal(actBlackjack(hit, 'double'), hit);
});
test('natural deals pay 3:2, handle dealer naturals and preserve the session record', () => {
  // Search deterministic shuffles through the public deal pipeline; each round has a real 52-card deck.
  let seed = 1;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const outcomes = new Set<string>();
  let previous: BlackjackState | undefined;
  for (let i = 0; i < 5000 && outcomes.size < 3; i++) {
    const s = newBlackjack(previous, random);
    if (s.result) {
      outcomes.add(s.result);
      assert.equal(validBlackjack(s), false);
      if (s.result === 'win')
        assert.equal(s.record.net - (previous?.record.net ?? 0), 1.5);
      previous = s;
    } else assert.ok(validBlackjack(s));
  }
  assert.deepEqual([...outcomes].sort(), ['loss', 'push', 'win']);
  assert.ok(previous);
  const next = newBlackjack(previous, () => 0.5);
  assert.equal(next.round, previous.round + 1);
  assert.ok(next.record.wins >= previous.record.wins);
});
