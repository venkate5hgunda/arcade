import { useState } from 'react';
import { BOARD, DEEDS, GROUPS, netWorth, rent } from '../lib/business-core.js';
import type { BusinessAction, BusinessPublic } from '../lib/business-core.js';
import {
  businessResponder,
  deedActions,
  awardChoices,
} from '../lib/business.ts';
import { CardPile } from './CardPile.tsx';
const currency = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const coords = (id: number): [number, number] =>
  id < 10
    ? [11, 11 - id]
    : id < 20
      ? [11 - (id - 10), 1]
      : id < 30
        ? [1, id - 19]
        : [id - 29, 11];
const colors = [
  '#ff936a',
  '#55d5f0',
  '#ffe052',
  '#c29aff',
  '#52e5a3',
  '#ff8bc5',
];
export function BusinessTable({
  view,
  seat,
  names,
  blocked,
  onAction,
  error,
  localSwitch,
}: {
  view: BusinessPublic;
  seat: number;
  names: string[];
  blocked: boolean;
  onAction: (move: BusinessAction) => void;
  error?: string;
  localSwitch?: (seat: number) => void;
}) {
  const [inspected, setInspected] = useState(
      view.players[view.current].position,
    ),
    [bid, setBid] = useState(1),
    [award, setAward] = useState<number | null>(null),
    [tradeOpen, setTradeOpen] = useState(false);
  const responder = businessResponder(view),
    me = view.players[seat],
    offer = view.offer,
    can = !blocked && !me.out && view.phase !== 'win',
    isResponder = seat === responder,
    own = DEEDS.filter((id) => view.deeds[id].owner === seat),
    space = BOARD[inspected],
    deed = view.deeds[inspected],
    manage =
      can &&
      !offer &&
      !['auction', 'award'].includes(view.phase) &&
      (view.phase !== 'debt' || view.debt?.from === seat);
  const send = (move: BusinessAction) => {
    onAction(move);
    setTradeOpen(false);
  };
  const act = (
    label: string,
    move: BusinessAction,
    quiet = false,
    disabled = false,
  ) => (
    <button
      className={quiet ? 'quiet' : 'primary'}
      disabled={!can || disabled}
      onClick={() => send(move)}
    >
      {label}
    </button>
  );
  return (
    <div className="business-table">
      <div className="turn-banner" role="status">
        <div>
          <h2>
            {view.phase === 'win'
              ? view.winners!.map((i) => names[i]).join(' & ') + ' win!'
              : `${names[responder]} ${offer ? 'responds to a trade' : 'acts now'}`}
          </h2>
          <p>{view.message}</p>
          {blocked && <p>Reconnect every active player to continue.</p>}
          {error && <p role="alert">{error}</p>}
        </div>
      </div>
      <section className="business-task" aria-label="Current action">
        <h3>
          {view.phase === 'win'
            ? 'Final standings'
            : offer?.to === seat
              ? 'Review the trade'
              : offer?.from === seat
                ? 'Waiting for a trade reply'
                : isResponder
                  ? view.phase === 'roll'
                    ? me.jailed
                      ? 'Leave jail or roll'
                      : 'Roll to move'
                    : view.phase === 'buy'
                      ? 'Buy this property?'
                      : view.phase === 'auction'
                        ? 'Bid or pass'
                        : view.phase === 'award'
                          ? 'Place your building'
                          : view.phase === 'debt'
                            ? 'Settle your payment'
                            : 'Ready for the next player'
                  : `Waiting for ${names[responder]}`}
        </h3>
        {view.dice && (
          <p>
            Last roll · {view.dice[0]} + {view.dice[1]} ={' '}
            {view.dice[0] + view.dice[1]}
          </p>
        )}
        {offer?.to === seat && (
          <>
            <p>
              {names[offer.from]} offers{' '}
              {offer.offered.map((id) => BOARD[id].name).join(', ') ||
                'no deeds'}{' '}
              and {currency(offer.cashOut)} for{' '}
              {offer.wanted.map((id) => BOARD[id].name).join(', ') ||
                'no deeds'}{' '}
              and {currency(offer.cashIn)}. Jail cards: {offer.cardsOut} offered
              / {offer.cardsIn} requested.
            </p>
            {act('Accept trade', { type: 'accept' })}
            {act('Decline trade', { type: 'reject' }, true)}
            <button
              className="quiet"
              disabled={!can}
              onClick={() => setTradeOpen(!tradeOpen)}
            >
              Make counteroffer
            </button>
          </>
        )}
        {offer?.from === seat && (
          <>{act('Withdraw offer', { type: 'cancel' }, true)}</>
        )}
        {!offer && isResponder && can && view.phase === 'roll' && (
          <>
            {act(view.doubles ? 'Roll again' : 'Roll two dice', {
              type: 'roll',
            })}
            {me.jailed && (
              <>
                {act(
                  `Pay ${currency(view.options.jailFine)} to leave jail`,
                  { type: 'jail-fine' },
                  true,
                )}
                {me.cards.map((card) => (
                  <button
                    key={card}
                    className="quiet"
                    onClick={() => send({ type: 'jail-card', card })}
                  >
                    Use {card} jail card
                  </button>
                ))}
              </>
            )}
          </>
        )}
        {!offer && isResponder && can && view.phase === 'buy' && (
          <>
            <p>
              {BOARD[view.players[view.current].position].name} ·{' '}
              {currency(BOARD[view.players[view.current].position].price!)}
            </p>
            {act(
              'Buy deed',
              { type: 'buy' },
              false,
              me.cash < BOARD[view.players[view.current].position].price!,
            )}
            {act('Decline · open auction', { type: 'decline' }, true)}
          </>
        )}
        {!offer &&
          isResponder &&
          can &&
          view.phase === 'auction' &&
          view.auction && (
            <>
              <p>
                {view.auction.kind === 'deed'
                  ? BOARD[view.auction.id!].name
                  : `One ${view.auction.kind}`}{' '}
                · highest bid {currency(view.auction.bid)}
                {view.auction.bidder !== null
                  ? ` by ${names[view.auction.bidder]}`
                  : ''}
              </p>
              <label>
                Your bid (₹)
                <input
                  type="number"
                  min={view.auction.bid + 1}
                  max={me.cash}
                  value={bid}
                  onChange={(e) => setBid(Number(e.target.value))}
                />
              </label>
              {act(
                'Place bid',
                { type: 'bid', amount: bid },
                false,
                bid <= view.auction.bid || bid > me.cash,
              )}
              {act('Pass auction', { type: 'pass' }, true)}
            </>
          )}
        {!offer &&
          isResponder &&
          can &&
          view.phase === 'award' &&
          view.auction && (
            <>
              <label>
                Place the awarded building
                <select
                  value={award ?? ''}
                  onChange={(e) => setAward(Number(e.target.value))}
                >
                  <option value="">Choose a city</option>
                  {awardChoices(view, seat).map((id) => (
                    <option key={id} value={id}>
                      {BOARD[id].name}
                    </option>
                  ))}
                </select>
              </label>
              {act(
                `Build for ${currency(view.auction.bid)}`,
                { type: 'place-award', id: award ?? undefined },
                false,
                award === null,
              )}
            </>
          )}
        {!offer && isResponder && can && view.phase === 'debt' && view.debt && (
          <>
            <p>
              Owed: {currency(view.debt.amount)} · available:{' '}
              {currency(me.cash)}
            </p>
            {me.cash >= view.debt.amount ? (
              act('Settle debt and continue', { type: 'pay-debt' })
            ) : (
              <p>
                Sell buildings, mortgage properties or arrange a trade to raise
                cash.
              </p>
            )}
            <button
              className="quiet"
              onClick={() => {
                if (
                  window.confirm(
                    'Declare bankruptcy? Your assets transfer to the creditor or bank.',
                  )
                )
                  send({ type: 'bankrupt' });
              }}
            >
              Declare bankruptcy…
            </button>
          </>
        )}
        {!offer &&
          isResponder &&
          can &&
          view.phase === 'finish' &&
          act('End turn →', { type: 'end' })}
        {view.phase === 'win' && (
          <dl>
            {view.players.map((p, i) => (
              <div key={i}>
                <dt>
                  {names[i]}
                  {view.winners?.includes(i)
                    ? ' · Winner'
                    : p.out
                      ? ' · Bankrupt'
                      : ''}
                </dt>
                <dd>{currency(netWorth(view, i))}</dd>
              </div>
            ))}
          </dl>
        )}
        {localSwitch && view.phase !== 'win' && (
          <details>
            <summary>Switch player</summary>
            <p>
              Hand the device to the chosen player to manage their property or
              trade.
            </p>
            {view.players.map(
              (p, i) =>
                !p.out && (
                  <button
                    className="quiet"
                    key={i}
                    onClick={() => localSwitch(i)}
                  >
                    {names[i]}
                  </button>
                ),
            )}
          </details>
        )}
        {(manage || offer?.to === seat) && (
          <details>
            <summary>More actions</summary>
            {manage && (
              <>
                <h4>Your properties</h4>
                {own.length === 0 && <p>No deeds yet.</p>}
                {own.map((id) => (
                  <div className="business-property" key={id}>
                    <b>{BOARD[id].name}</b>
                    <span>
                      {view.deeds[id].mortgaged
                        ? 'Mortgaged'
                        : view.deeds[id].level === 5
                          ? 'Hotel'
                          : `${view.deeds[id].level} houses`}
                    </span>
                    {deedActions(view, seat, id).map((option) => (
                      <button
                        className="quiet"
                        key={option.label}
                        onClick={() => send(option.move)}
                      >
                        {option.label}
                      </button>
                    ))}
                    {view.deeds[id].level > 0 && BOARD[id].group && (
                      <button
                        className="quiet"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Sell all ${BOARD[id].group} buildings?`,
                            )
                          )
                            send({ type: 'liquidate', group: BOARD[id].group });
                        }}
                      >
                        Sell all group buildings…
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
            {view.phase !== 'auction' && view.phase !== 'award' && (
              <button
                className="quiet"
                onClick={() => setTradeOpen(!tradeOpen)}
              >
                {offer ? 'Counteroffer' : 'Arrange a trade'}
              </button>
            )}
          </details>
        )}
        {tradeOpen && (
          <TradeForm
            key={`${seat}-${offer?.from ?? 'new'}`}
            view={view}
            seat={seat}
            names={names}
            counter={!!offer}
            submit={send}
          />
        )}
      </section>
      <div className="business-seats">
        {view.players.map((p, i) => (
          <span key={i} style={{ borderColor: colors[i] }}>
            <b>{names[i]}</b> · {p.out ? 'Bankrupt' : currency(p.cash)}
            {p.jailed ? ' · Jail' : ''}
          </span>
        ))}
      </div>
      <details className="help-card">
        <summary>Explore the board & inspect deeds</summary>
        <div
          className="business-scroll"
          tabIndex={0}
          aria-label="Business board, scroll to explore all forty spaces"
        >
          <div className="business-board">
            {BOARD.map((b) => {
              const [row, col] = coords(b.id),
                d = view.deeds[b.id];
              return (
                <button
                  key={b.id}
                  className="business-space"
                  style={{
                    gridRow: row,
                    gridColumn: col,
                    borderColor: b.group ? GROUPS[b.group].color : undefined,
                  }}
                  aria-pressed={inspected === b.id}
                  onClick={() => setInspected(b.id)}
                >
                  <small>{b.id}</small>
                  <svg aria-hidden="true">
                    <use
                      href={`./business/symbols.svg#${b.group || (['go-jail', 'jail'].includes(b.kind) ? 'jail' : b.kind)}`}
                    />
                  </svg>
                  <b>{b.name}</b>
                  {d && (
                    <small>
                      {d.owner === null ? currency(b.price!) : names[d.owner]}
                    </small>
                  )}
                  <span>
                    {view.players.map((p, i) =>
                      p.position === b.id && !p.out ? (
                        <i
                          key={i}
                          style={{ color: colors[i] }}
                          aria-label={names[i]}
                        >
                          ●
                        </i>
                      ) : null,
                    )}
                  </span>
                </button>
              );
            })}
            <div className="business-center">
              <img src="./business/cityscape.svg" alt="" />
              <h3>Business</h3>
              <div className="business-piles">
                <CardPile count={null} label="Fortune draw pile" />
                <CardPile count={null} label="City Fund draw pile" />
              </div>
            </div>
          </div>
        </div>
        <section className="business-inspect">
          <h3>
            Space {space.id} · {space.name}
          </h3>
          {space.group && (
            <svg aria-hidden="true" viewBox="0 0 240 112">
              <use href={`./business/districts.svg#${space.group}`} />
            </svg>
          )}
          {space.price !== undefined ? (
            <>
              <p>
                Price {currency(space.price)} · Mortgage{' '}
                {currency(space.price / 2)}
              </p>
              <p>
                {deed?.owner === null
                  ? 'Available from the bank'
                  : `${names[deed.owner!]} owns this deed${deed.mortgaged ? ' · mortgaged' : ''}.`}
              </p>
              {space.rent && (
                <p>Rent tiers: {space.rent.map(currency).join(' · ')}</p>
              )}
              {space.kind === 'utility' && (
                <p>Rent: dice ×4, or ×10 when both utilities are owned.</p>
              )}
              {space.kind === 'transport' && (
                <p>Rent rises from ₹25 to ₹200 as routes are collected.</p>
              )}
              {deed?.owner !== null && !deed?.mortgaged && (
                <p>Current rent: {currency(rent(view, inspected))}</p>
              )}
            </>
          ) : (
            <p>
              {space.kind === 'start'
                ? `Collect ${currency(view.options.salary)} when passing Start.`
                : space.kind === 'jail'
                  ? `Jail fine: ${currency(view.options.jailFine)}.`
                  : space.kind === 'tax'
                    ? `Pay ${currency(space.id === 4 ? view.options.incomeTax : view.options.cityLevy)}.`
                    : space.kind === 'go-jail'
                      ? 'Go directly to Jail.'
                      : space.kind === 'rest'
                        ? 'Take a breather.'
                        : 'Draw and resolve a card.'}
            </p>
          )}
          <div className="actions">
            <button
              className="quiet"
              onClick={() => setInspected((inspected + 39) % 40)}
            >
              ← Previous space
            </button>
            <button
              className="quiet"
              onClick={() => setInspected((inspected + 1) % 40)}
            >
              Next space →
            </button>
          </div>
        </section>
      </details>
      <details className="help-card">
        <summary>Recent events</summary>
        <ol>
          {view.log.map((entry, i) => (
            <li key={i}>{entry}</li>
          ))}
        </ol>
      </details>
    </div>
  );
}
function TradeForm({
  view,
  seat,
  names,
  counter,
  submit,
}: {
  view: BusinessPublic;
  seat: number;
  names: string[];
  counter: boolean;
  submit: (a: BusinessAction) => void;
}) {
  const options = view.players
      .map((p, i) => (!p.out && i !== seat ? i : -1))
      .filter((i) => i >= 0),
    [to, setTo] = useState(counter ? view.offer!.from : options[0]),
    [offered, setOffered] = useState<number[]>([]),
    [wanted, setWanted] = useState<number[]>([]),
    [cashOut, setCashOut] = useState(0),
    [cashIn, setCashIn] = useState(0),
    [cardsOut, setCardsOut] = useState(0),
    [cardsIn, setCardsIn] = useState(0);
  const toggle = (list: number[], id: number, set: (v: number[]) => void) =>
    set(list.includes(id) ? list.filter((n) => n !== id) : [...list, id]);
  return (
    <section className="business-trade">
      <h4>{counter ? 'Counteroffer' : 'Arrange a trade'}</h4>
      <label>
        Trade with
        <select
          value={to}
          disabled={counter}
          onChange={(e) => {
            setTo(Number(e.target.value));
            setWanted([]);
          }}
        >
          {options.map((i) => (
            <option key={i} value={i}>
              {names[i]}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Give deeds</legend>
        {DEEDS.filter((id) => view.deeds[id].owner === seat).map((id) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={offered.includes(id)}
              onChange={() => toggle(offered, id, setOffered)}
            />{' '}
            {BOARD[id].name}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Request deeds</legend>
        {DEEDS.filter((id) => view.deeds[id].owner === to).map((id) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={wanted.includes(id)}
              onChange={() => toggle(wanted, id, setWanted)}
            />{' '}
            {BOARD[id].name}
          </label>
        ))}
      </fieldset>
      {(
        [
          ['Cash to give', cashOut, setCashOut],
          ['Cash to request', cashIn, setCashIn],
          ['Jail cards to give', cardsOut, setCardsOut],
          ['Jail cards to request', cardsIn, setCardsIn],
        ] as const
      ).map(([label, value, set]) => (
        <label key={label}>
          {label}
          <input
            type="number"
            min="0"
            value={value}
            onChange={(e) => set(Number(e.target.value))}
          />
        </label>
      ))}
      <button
        className="primary"
        onClick={() =>
          submit({
            type: counter ? 'counter' : 'offer',
            to,
            offered,
            wanted,
            cashOut,
            cashIn,
            cardsOut,
            cardsIn,
          })
        }
      >
        {counter ? 'Send counteroffer' : 'Send offer'}
      </button>
    </section>
  );
}
