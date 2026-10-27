import { Frame, useRun } from '../components/GameFrame.tsx';
import {
  newBlackjack,
  actBlackjack,
  handValue,
  validBlackjack,
} from '../lib/blackjack.ts';
import type { BlackjackState, Card } from '../lib/blackjack.ts';
const SUIT_NAMES = {
  '♠': 'spades',
  '♥': 'hearts',
  '♦': 'diamonds',
  '♣': 'clubs',
};
export function PlayingCard({
  card,
  hidden = false,
}: {
  card: Card;
  hidden?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={
        hidden
          ? 'Face-down dealer card'
          : `${card.rank} of ${SUIT_NAMES[card.suit]}`
      }
      className={`playing-card ${hidden ? 'card-back' : card.suit === '♥' || card.suit === '♦' ? 'card-red' : ''}`}
    >
      {hidden ? (
        <span aria-hidden="true">✦</span>
      ) : (
        <>
          <span className="card-corner" aria-hidden="true">
            {card.rank}
            <small>{card.suit}</small>
          </span>
          <span className="card-suit" aria-hidden="true">
            {card.suit}
          </span>
        </>
      )}
    </div>
  );
}
export function BlackjackGame() {
  const run = useRun<BlackjackState>(
    'blackjack',
    {},
    validBlackjack,
    () => newBlackjack(),
    (state) => state.result !== null,
  );
  const s = run.state;
  function act(action: 'hit' | 'stand' | 'double') {
    if (!s) return;
    const next = actBlackjack(s, action);
    run.commit(next, next.result !== null);
  }
  function deal() {
    const next = newBlackjack(s);
    run.commit(next, next.result !== null);
  }
  return (
    <Frame
      run={run}
      fields={[]}
      summary="A little luck. A little nerve. Get closer to 21 than the house."
      help="Hit to draw a card or stand to let the dealer play. Aces count as 1 or 11. The dealer stands on every 17, including soft 17. With two cards you may double: draw exactly one card, then settle at twice the stake. A natural blackjack pays 3:2. Results use fictional scoring units, not money."
      title={
        s?.result === 'win'
          ? 'You beat the dealer!'
          : s?.result === 'loss'
            ? 'The house takes this round.'
            : s?.result === 'push'
              ? 'A push. Well played.'
              : 'Your move.'
      }
      status={s?.message ?? ''}
      after={
        s && (
          <>
            <div className="blackjack-actions">
              {s.result ? (
                <button className="primary" onClick={deal}>
                  Deal again
                </button>
              ) : (
                <>
                  <button className="primary" onClick={() => act('hit')}>
                    Hit
                  </button>
                  <button className="quiet" onClick={() => act('stand')}>
                    Stand
                  </button>
                  {s.player.length === 2 && (
                    <button className="quiet" onClick={() => act('double')}>
                      Double
                    </button>
                  )}
                </>
              )}
            </div>
            <p className="blackjack-record" aria-label="Session results">
              {s.record.wins} wins · {s.record.losses} losses ·{' '}
              {s.record.pushes} pushes · {s.record.net >= 0 ? '+' : ''}
              {s.record.net} units
            </p>
          </>
        )
      }
    >
      {s && (
        <div className="blackjack-table">
          <section aria-label="Dealer">
            <div className="hand-heading">
              <h3>Dealer</h3>
              <span>
                {s.result
                  ? handValue(s.dealer).total
                  : `${handValue([s.dealer[0]]).total} + ?`}
              </span>
            </div>
            <div className="playing-hand">
              {s.dealer.map((card, index) => (
                <PlayingCard
                  key={index}
                  card={card}
                  hidden={!s.result && index === 1}
                />
              ))}
            </div>
          </section>
          <p className="round-marker">
            Round {s.round} · Dealer stands on soft 17
          </p>
          <section aria-label="Your hand">
            <div className="hand-heading">
              <h3>Your hand</h3>
              <span>
                {handValue(s.player).total}
                {handValue(s.player).soft ? ' · soft' : ''}
              </span>
            </div>
            <div className="playing-hand">
              {s.player.map((card, index) => (
                <PlayingCard key={index} card={card} />
              ))}
            </div>
          </section>
        </div>
      )}
    </Frame>
  );
}
