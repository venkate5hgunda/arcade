import { useEffect, useRef, useState } from 'react';
import { displayCard } from '../lib/cards.ts';
import type { CardView } from '../lib/cards.ts';
export function GameCardFace({ view, id }: { view: CardView; id: string }) {
  const card = displayCard(view.gameId, id);
  return (
    <span
      className={`table-card-face tone-${card.tone}`}
      role="img"
      aria-label={card.label}
    >
      <span
        className="table-card-corner"
        aria-hidden="true"
        data-mark={card.mark}
      />
      <strong aria-hidden="true" data-mark={card.mark} />
      <small aria-hidden="true" data-detail={card.detail} />
    </span>
  );
}
export function CardTable({
  view,
  names,
  blocked = false,
  covered = false,
  reveal,
  onLateUno,
  onAction,
}: {
  view: CardView;
  names: string[];
  blocked?: boolean;
  covered?: boolean;
  reveal?: () => void;
  onLateUno?: () => void;
  onAction: (action: unknown) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const handHeading = useRef<HTMLHeadingElement>(null),
    coverHeading = useRef<HTMLHeadingElement>(null),
    resultHeading = useRef<HTMLHeadingElement>(null),
    chooser = useRef<HTMLDivElement>(null),
    revealButton = useRef<HTMLButtonElement>(null);
  const wasCovered = useRef(covered);
  const previousUno = useRef(view.unoPending);
  useEffect(() => setPending(null), [view.gameId, view.turn, covered]);
  const ownTurn = view.current === view.seat,
    over = view.phase === 'over';
  const canAct = !blocked && !over && !covered;
  const choose = view.phase === 'choose' || pending !== null;
  useEffect(() => {
    if (over) resultHeading.current?.focus();
    else if (covered) coverHeading.current?.focus();
    else if (wasCovered.current) handHeading.current?.focus();
    wasCovered.current = covered;
  }, [covered, over]);
  useEffect(() => {
    if (choose && !covered && !blocked)
      chooser.current
        ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
        ?.focus();
  }, [choose, covered, blocked]);
  useEffect(() => {
    if (covered && previousUno.current !== null && view.unoPending === null)
      revealButton.current?.focus();
    previousUno.current = view.unoPending;
  }, [covered, view.unoPending]);
  const label = (seat: number) => names[seat] || `Player ${seat + 1}`;
  function play(id: string) {
    if (view.gameId === 'uno' && displayCard(view.gameId, id).wild)
      setPending(id);
    else
      onAction({ type: 'play', id: view.gameId === 'uno' ? Number(id) : id });
  }
  return (
    <div className={`private-card-table ${view.gameId}`}>
      <div className="card-seats" aria-label="Table seats">
        {view.counts.map((count, index) => (
          <div
            key={index}
            className={index === view.current ? 'active-seat' : ''}
          >
            <b>
              {label(index)}
              {index === view.seat ? ' (you)' : ''}
            </b>
            <span>
              {count} cards{index === view.current ? ' · Playing' : ''}
            </span>
          </div>
        ))}
      </div>
      <div className="card-table-center">
        <div
          role="img"
          aria-label={`Top card: ${displayCard(view.gameId, view.top).label}`}
        >
          <GameCardFace view={view} id={view.top} />
        </div>
        <div>
          <p className="eyebrow">
            Match {view.gameId === 'uno' ? 'color or value' : 'suit or rank'}
          </p>
          <p className="active-card-suit">{view.active}</p>
          <small>
            {view.stockCount} in the draw pile
            {view.gameId === 'uno'
              ? ` · ${view.direction === 1 ? 'Clockwise' : 'Counterclockwise'}`
              : ''}
          </small>
        </div>
      </div>
      {over ? (
        <div className="card-result" role="status">
          <h3 ref={resultHeading} tabIndex={-1}>
            {view.winner === null || view.winner === -1
              ? 'A well-played draw.'
              : `${label(view.winner)} wins!`}
          </h3>
          <p>
            {view.ending === 'blocked'
              ? 'The table is blocked. Lowest penalty wins.'
              : 'The last card is down. Time for another round?'}
          </p>
          {view.scores && (
            <p>
              {view.scores
                .map((score, i) => `${label(i)}: ${score} points`)
                .join(' · ')}
            </p>
          )}
        </div>
      ) : covered ? (
        <div className="hand-cover">
          <span aria-hidden="true">✦</span>
          <h3 ref={coverHeading} tabIndex={-1}>
            Pass to {label(view.current)}
          </h3>
          <p>Everyone else, look away. Reveal your hand when you’re ready.</p>
          {view.gameId === 'uno' && view.unoPending !== null && onLateUno && (
            <>
              <p>
                {label(view.unoPending)} has one card left. Call UNO before
                handing over, or the next player can catch it.
              </p>
              <button className="quiet" onClick={onLateUno}>
                I’m {label(view.unoPending)} · call UNO
              </button>
            </>
          )}
          <button ref={revealButton} className="primary" onClick={reveal}>
            Reveal my hand
          </button>
        </div>
      ) : (
        <>
          {choose && (
            <div
              ref={chooser}
              className="suit-chooser"
              role="group"
              aria-label={
                view.gameId === 'uno' ? 'Choose a color' : 'Choose a suit'
              }
            >
              <h3>
                {view.gameId === 'uno'
                  ? 'Choose the next color'
                  : 'Your eight, your suit'}
              </h3>
              <div className="actions">
                {(view.gameId === 'uno'
                  ? ['red', 'yellow', 'green', 'blue']
                  : ['♠', '♥', '♦', '♣']
                ).map((value) => (
                  <button
                    key={value}
                    className={`quiet choice-${value}`}
                    disabled={!canAct || !ownTurn}
                    onClick={() => {
                      onAction(
                        view.gameId === 'uno'
                          ? { type: 'play', id: Number(pending), color: value }
                          : { type: 'choose', suit: value },
                      );
                      setPending(null);
                    }}
                  >
                    {value}
                  </button>
                ))}
                {pending && (
                  <button className="quiet" onClick={() => setPending(null)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
          {view.challenge && (
            <div className="challenge-banner">
              <h3>Wild +4 on the table</h3>
              <p>
                {ownTurn
                  ? 'Accept four and skip your turn, or challenge. If the play was legal, a failed challenge costs six cards.'
                  : 'Waiting for the next player to accept or challenge.'}
              </p>
              {ownTurn && (
                <div className="actions">
                  <button
                    className="primary"
                    disabled={!canAct}
                    onClick={() => onAction({ type: 'accept' })}
                  >
                    Accept +4
                  </button>
                  <button
                    className="quiet"
                    disabled={!canAct}
                    onClick={() => onAction({ type: 'challenge' })}
                  >
                    Challenge +4
                  </button>
                </div>
              )}
            </div>
          )}
          <section className="private-hand" aria-label="Your cards">
            <h3 ref={handHeading} tabIndex={-1}>
              {label(view.seat)}’s hand{' '}
              <small>· {view.hand.length} cards</small>
            </h3>
            <div className="private-hand-cards">
              {view.hand.map((id) => (
                <button
                  key={id}
                  className="table-card-button"
                  aria-label={`${displayCard(view.gameId, id).label}${view.legal.includes(id) ? ', play card' : ', cannot play'}`}
                  disabled={!canAct || choose || !view.legal.includes(id)}
                  onClick={() => play(id)}
                >
                  <GameCardFace view={view} id={id} />
                </button>
              ))}
            </div>
          </section>
          <div className="private-card-actions">
            {view.gameId === 'uno' &&
              ((view.hand.length === 2 && ownTurn) ||
                view.unoPending === view.seat) && (
                <button
                  className="quiet"
                  disabled={!canAct || view.unoDeclared}
                  onClick={() => onAction({ type: 'uno' })}
                >
                  {view.unoDeclared ? 'UNO called ✓' : 'Call UNO'}
                </button>
              )}
            {view.gameId === 'uno' &&
              ownTurn &&
              view.unoPending !== null &&
              view.unoPending !== view.seat && (
                <button
                  className="quiet"
                  disabled={!canAct}
                  onClick={() => onAction({ type: 'catch' })}
                >
                  Catch missed UNO (+2)
                </button>
              )}
            {ownTurn && !choose && !view.challenge && (
              <>
                <button
                  className="primary"
                  disabled={!canAct || !view.canDraw || view.drawn}
                  onClick={() => onAction({ type: 'draw' })}
                >
                  Draw a card
                </button>
                <button
                  className="quiet"
                  disabled={!canAct || !view.canPass}
                  onClick={() => onAction({ type: 'pass' })}
                >
                  Pass turn
                </button>
              </>
            )}
          </div>
          <p className="card-next-action">
            {blocked
              ? 'Play is paused. Reconnect every seat to continue.'
              : choose
                ? 'Choose the suit or color above to finish your play.'
                : ownTurn
                  ? view.drawn
                    ? 'Play a matching card or pass your turn.'
                    : view.legal.length
                      ? 'Choose a highlighted card or draw one.'
                      : 'No matching cards. Draw one to keep going.'
                  : `Waiting for ${label(view.current)} to play.`}
          </p>
        </>
      )}
    </div>
  );
}
