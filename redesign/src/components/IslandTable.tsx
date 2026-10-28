import { useEffect, useRef, useState } from 'react';
import {
  GOODS,
  COLORS,
  COSTS,
  canRoad,
  canSettle,
  tradeRate,
} from '../lib/catan-core.js';
import type {
  Good,
  Goods,
  IslandAction,
  IslandView,
} from '../lib/catan-core.js';
import { CardPile } from './CardPile.tsx';

const labels: Record<Good, string> = {
  timber: 'Wood',
  clay: 'Brick',
  grain: 'Wheat',
  wool: 'Sheep',
  ore: 'Ore',
};
const terrain: Record<string, string> = {
  forest: '#61a760',
  hills: '#d97c53',
  fields: '#f4c854',
  pasture: '#b3d677',
  mountains: '#9aabb4',
  desert: '#ead19c',
};
const blank = () => Object.fromEntries(GOODS.map((g) => [g, 0])) as Goods;
export function IslandTable({
  view,
  seat,
  names,
  blocked,
  action,
  error,
  viewKey = 'local',
}: {
  view: IslandView;
  seat: number;
  names: string[];
  blocked: boolean;
  action: (move: IslandAction) => void;
  error?: string;
  viewKey?: string;
}) {
  const [tool, setTool] = useState<'road' | 'settlement' | 'city'>('road');
  const [tile, setTile] = useState<number | null>(null);
  const [give, setGive] = useState<Good>('timber');
  const [receive, setReceive] = useState<Good>('clay');
  const [amount, setAmount] = useState(1);
  const [to, setTo] = useState((seat + 1) % names.length);
  const [discard, setDiscard] = useState<Goods>(blank);
  const [offered, setOffered] = useState<Goods>(blank);
  const [wanted, setWanted] = useState<Goods>(blank);
  const [choice, setChoice] = useState('');
  const chart = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(`arcade:catan:view:${viewKey}:${seat}`) ??
          'null',
      );
      return Number.isFinite(saved?.zoom) && saved.zoom >= 1 && saved.zoom <= 3
        ? saved.zoom
        : 1;
    } catch {
      return 1;
    }
  });
  useEffect(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(`arcade:catan:view:${viewKey}:${seat}`) ??
          'null',
      );
      if (chart.current && Number.isFinite(saved?.left) && saved.left >= 0)
        chart.current.scrollLeft = saved.left;
    } catch {
      /* The chart remains usable without saved viewport settings. */
    }
  }, [seat, viewKey]);
  const saveView = (value: number) => {
    try {
      sessionStorage.setItem(
        `arcade:catan:view:${viewKey}:${seat}`,
        JSON.stringify({ zoom: value, left: chart.current?.scrollLeft ?? 0 }),
      );
    } catch {
      /* Viewport preferences are optional. */
    }
  };
  const current = view.current === seat && !blocked && view.winner === null;
  const canPay = (cost: Partial<Goods>) =>
    GOODS.every((g) => view.goods[g] >= (cost[g] ?? 0));
  const replying = view.offer?.to === seat && !blocked;
  const needsDiscard =
    view.phase === 'discard' && (view.discards[seat] ?? 0) > 0 && !blocked;
  const legalVertex = (id: number) =>
    current &&
    ((view.phase === 'setup-settlement' && canSettle(view, seat, id, true)) ||
      (view.phase === 'main' &&
        !view.freeRoads &&
        ((tool === 'settlement' &&
          view.counts[seat].settlements < 5 &&
          canPay(COSTS.settlement) &&
          canSettle(view, seat, id)) ||
          (tool === 'city' &&
            view.counts[seat].cities < 4 &&
            canPay(COSTS.city) &&
            view.buildings[id]?.owner === seat &&
            !view.buildings[id]?.city))));
  const legalEdge = (id: number) =>
    current &&
    ((view.phase === 'setup-road' && canRoad(view, seat, id, true)) ||
      (((view.phase === 'main' && tool === 'road') ||
        view.phase === 'free-roads') &&
        view.counts[seat].roads < 15 &&
        (view.freeRoads > 0 || canPay(COSTS.road)) &&
        canRoad(view, seat, id)));
  const choosingEdge =
    view.phase === 'setup-road' ||
    view.phase === 'free-roads' ||
    (view.phase === 'main' && tool === 'road');
  const choosingVertex =
    view.phase === 'setup-settlement' ||
    (view.phase === 'main' && !view.freeRoads && tool !== 'road');
  const choices = choosingEdge
    ? view.board.edges.flatMap((_, i) => (legalEdge(i) ? [i] : []))
    : choosingVertex
      ? view.board.vertices.flatMap((_, i) => (legalVertex(i) ? [i] : []))
      : [];
  const victimSeats =
    tile === null
      ? []
      : [
          ...new Set(
            view.board.tiles[tile].vertices
              .map((v) => view.buildings[v]?.owner)
              .filter(
                (v): v is number =>
                  v !== undefined && v !== seat && view.counts[v].goods > 0,
              ),
          ),
        ];
  const numberFields = (values: Goods, set: (x: Goods) => void) =>
    GOODS.map((g) => (
      <label key={g}>
        {labels[g]}{' '}
        <input
          type="number"
          min={0}
          max={view.goods[g]}
          value={values[g]}
          onChange={(e) => set({ ...values, [g]: Number(e.target.value) })}
        />
      </label>
    ));
  const selectGood = (label: string, value: Good, set: (g: Good) => void) => (
    <label>
      {label}
      <select value={value} onChange={(e) => set(e.target.value as Good)}>
        {GOODS.map((g) => (
          <option key={g} value={g}>
            {labels[g]}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="island-table">
      <div className="turn-banner" role="status">
        <div>
          <h2>
            {view.winner !== null
              ? `${names[view.winner]} wins!`
              : needsDiscard
                ? 'Return your excess cargo'
                : replying
                  ? 'Review the trade'
                  : current
                    ? 'Your turn'
                    : `${names[view.current]} is navigating`}
          </h2>
          <p>{view.message}</p>
          {blocked && <p>Reconnect all navigators to continue.</p>}
          {error && <p role="alert">{error}</p>}
        </div>
      </div>
      <section className="island-actions" aria-label="Current action">
        {current && ['setup-roll', 'roll'].includes(view.phase) && (
          <button
            className="primary"
            onClick={() => action({ type: view.phase })}
          >
            Roll two dice
          </button>
        )}
        {view.rolled && <p>Last roll: {view.rolled.join(' + ')}</p>}
        {current && view.phase === 'setup-settlement' && (
          <p>Select a glowing junction for your outpost.</p>
        )}
        {current && view.phase === 'setup-road' && (
          <p>Select a glowing path beside your outpost.</p>
        )}
        {current && (choosingEdge || choosingVertex) && (
          <div>
            <label>
              {choosingEdge ? 'Choose a path' : 'Choose a junction'}
              <select
                value={
                  choices.includes(Number(choice)) && choice !== ''
                    ? choice
                    : ''
                }
                onChange={(e) => setChoice(e.target.value)}
              >
                <option value="">Select a location</option>
                {choices.map((id) => (
                  <option key={id} value={id}>
                    {choosingEdge ? 'Path' : 'Junction'} {id + 1}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="quiet"
              disabled={choice === '' || !choices.includes(Number(choice))}
              onClick={() => {
                const id = Number(choice);
                action(
                  choosingEdge
                    ? {
                        type:
                          view.phase === 'setup-road'
                            ? 'setup-road'
                            : 'build-road',
                        edge: id,
                      }
                    : {
                        type:
                          view.phase === 'setup-settlement'
                            ? 'setup-settlement'
                            : tool === 'city'
                              ? 'build-city'
                              : 'build-settlement',
                        vertex: id,
                      },
                );
                setChoice('');
              }}
            >
              Build here
            </button>
          </div>
        )}
        {needsDiscard && (
          <>
            <p>Return exactly {view.discards[seat]} goods to the bank.</p>
            <div className="island-fields">
              {numberFields(discard, setDiscard)}
            </div>
            <button
              className="primary"
              onClick={() => action({ type: 'discard', goods: discard })}
            >
              Return cargo
            </button>
          </>
        )}
        {current && view.phase === 'robber' && (
          <>
            <p>
              Choose a different land tile, then select a rival if one has cargo
              there.
            </p>
            {tile !== null && tile !== view.robber && (
              <div>
                <strong>Land {tile + 1}</strong>
                {victimSeats.length ? (
                  victimSeats.map((v) => (
                    <button
                      className="quiet"
                      key={v}
                      onClick={() => {
                        action({ type: 'robber', tile, victim: v });
                        setTile(null);
                      }}
                    >
                      Take cargo from {names[v]}
                    </button>
                  ))
                ) : (
                  <button
                    className="primary"
                    onClick={() => {
                      action({ type: 'robber', tile, victim: null });
                      setTile(null);
                    }}
                  >
                    Move the raider here
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {replying && view.offer && (
          <>
            <p>
              {names[view.offer.from]} offers{' '}
              {GOODS.filter((g) => view.offer!.give[g])
                .map((g) => `${view.offer!.give[g]} ${labels[g]}`)
                .join(', ')}{' '}
              for{' '}
              {GOODS.filter((g) => view.offer!.want[g])
                .map((g) => `${view.offer!.want[g]} ${labels[g]}`)
                .join(', ')}
              .
            </p>
            <button
              className="primary"
              onClick={() => action({ type: 'accept' })}
            >
              Accept trade
            </button>
            <button
              className="quiet"
              onClick={() => action({ type: 'decline' })}
            >
              Decline trade
            </button>
          </>
        )}
        {current && ['main', 'free-roads'].includes(view.phase) && (
          <>
            <div className="segmented" role="group" aria-label="Build tool">
              {(['road', 'settlement', 'city'] as const).map((t) => (
                <button
                  key={t}
                  aria-pressed={tool === t}
                  onClick={() => setTool(t)}
                >
                  {t === 'road' ? 'Road' : t === 'city' ? 'City' : 'Outpost'}
                </button>
              ))}
            </div>
            <p>
              Choose a highlighted{' '}
              {view.phase === 'free-roads' || tool === 'road'
                ? 'path'
                : 'junction'}{' '}
              on the island.
            </p>
            {view.freeRoads > 0 && (
              <button
                className="quiet"
                onClick={() => action({ type: 'skip-free-roads' })}
              >
                Skip remaining free roads
              </button>
            )}
            {view.phase === 'main' && !view.freeRoads && (
              <>
                <button
                  className="primary"
                  onClick={() => action({ type: 'end' })}
                >
                  End turn →
                </button>
                <button
                  className="quiet"
                  onClick={() => action({ type: 'buy-dev' })}
                >
                  Buy discovery
                </button>
                {view.offer && (
                  <button
                    className="quiet"
                    onClick={() => action({ type: 'cancel-offer' })}
                  >
                    Withdraw trade
                  </button>
                )}
              </>
            )}
          </>
        )}
      </section>
      <div className="island-seats">
        {view.counts.map((p, i) => (
          <div key={i} style={{ borderColor: COLORS[i] }}>
            <strong>{names[i]}</strong> · {view.scores[i]} points · {p.goods}{' '}
            cargo · {p.dev} discoveries
          </div>
        ))}
      </div>
      <div className="island-discovery">
        <CardPile count={view.deckCount} label="Discovery deck" />
        <span>Discovery deck · {view.deckCount} cards</span>
      </div>
      <details>
        <summary>Your private cargo and discoveries</summary>
        <div className="island-cargo">
          {GOODS.map((g) => (
            <span key={g}>
              <img src={`./catan/resources/${g}.svg`} alt="" />
              {labels[g]} <strong>{view.goods[g]}</strong>
            </span>
          ))}
        </div>
        <p>
          Your score: {view.myScore}. Discovery deck: {view.deckCount} cards.
        </p>
        {view.dev.map((c, i) => (
          <p key={i}>
            {c.type}
            {c.bought >= view.turn ? ' · playable next turn' : ''}
            {current &&
              c.type !== 'victory' &&
              c.bought < view.turn &&
              !view.devPlayed &&
              ['roll', 'main'].includes(view.phase) &&
              (c.type === 'knight' || c.type === 'roads') && (
                <button
                  className="quiet"
                  onClick={() => action({ type: 'play-dev', card: c.type })}
                >
                  Play {c.type}
                </button>
              )}
          </p>
        ))}
        {current &&
          !view.devPlayed &&
          ['roll', 'main'].includes(view.phase) &&
          view.dev.some(
            (c) => c.type === 'monopoly' && c.bought < view.turn,
          ) && (
            <div>
              {selectGood('Choose monopoly cargo', give, setGive)}
              <button
                className="quiet"
                onClick={() =>
                  action({ type: 'play-dev', card: 'monopoly', good: give })
                }
              >
                Play monopoly
              </button>
            </div>
          )}
        {current &&
          !view.devPlayed &&
          ['roll', 'main'].includes(view.phase) &&
          view.dev.some((c) => c.type === 'plenty' && c.bought < view.turn) && (
            <div>
              {selectGood('First supply', give, setGive)}
              {selectGood('Second supply', receive, setReceive)}
              <button
                className="quiet"
                onClick={() =>
                  action({
                    type: 'play-dev',
                    card: 'plenty',
                    goods: {
                      [give]: give === receive ? 2 : 1,
                      ...(give === receive ? {} : { [receive]: 1 }),
                    },
                  })
                }
              >
                Play plenty
              </button>
            </div>
          )}
      </details>
      {current && view.phase === 'main' && !view.freeRoads && (
        <details>
          <summary>Trade and build costs</summary>
          <p>
            Road: wood + brick · Outpost: wood + brick + wheat + sheep · City: 2
            wheat + 3 ore · Discovery: wheat + sheep + ore.
          </p>
          {selectGood('Give', give, setGive)}
          {selectGood('Receive', receive, setReceive)}
          <p>
            Your {labels[give]} exchange rate: {tradeRate(view, seat, give)}:1.
          </p>
          <label>
            Quantity
            <input
              type="number"
              min={1}
              max={19}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <button
            className="quiet"
            onClick={() =>
              action({ type: 'bank-trade', give, receive, quantity: amount })
            }
          >
            Trade with bank or harbor
          </button>
          <label>
            Trade with
            <select value={to} onChange={(e) => setTo(Number(e.target.value))}>
              {names.map(
                (name, i) =>
                  i !== seat && (
                    <option key={i} value={i}>
                      {name}
                    </option>
                  ),
              )}
            </select>
          </label>
          <fieldset>
            <legend>Offer cargo</legend>
            <div className="island-fields">
              {numberFields(offered, setOffered)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Request cargo</legend>
            <div className="island-fields">
              {GOODS.map((g) => (
                <label key={g}>
                  {labels[g]}{' '}
                  <input
                    type="number"
                    min={0}
                    max={19}
                    value={wanted[g]}
                    onChange={(e) =>
                      setWanted({ ...wanted, [g]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <button
            className="quiet"
            onClick={() =>
              action({
                type: 'offer',
                to,
                give: offered,
                want: wanted,
              })
            }
          >
            Offer cargo trade
          </button>
        </details>
      )}
      <div className="island-zoom">
        <button
          className="quiet"
          onClick={() => {
            const value = Math.max(1, zoom - 0.25);
            setZoom(value);
            saveView(value);
          }}
        >
          − Zoom
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          className="quiet"
          onClick={() => {
            const value = Math.min(3, zoom + 0.25);
            setZoom(value);
            saveView(value);
          }}
        >
          + Zoom
        </button>
      </div>
      <div
        className="island-scroll"
        ref={chart}
        onScroll={() => saveView(zoom)}
        tabIndex={0}
        aria-label="Island chart, scroll to explore"
      >
        <svg
          className="island-chart"
          viewBox="0 0 760 700"
          style={{ width: `${zoom * 100}%` }}
          role="group"
          aria-label="Island chart"
        >
          {view.board.tiles.map((t, id) => {
            const v = t.vertices.map((i) => view.board.vertices[i]);
            const x = (v[0].x + v[3].x) / 2,
              y = (v[0].y + v[3].y) / 2;
            return (
              <g key={id}>
                <polygon
                  points={v.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill={terrain[t.terrain]}
                  stroke="#f8ebca"
                  strokeWidth="5"
                  role="button"
                  tabIndex={0}
                  aria-label={`${t.terrain}, ${t.number ?? 'desert'}${view.robber === id ? ', raider' : ''}`}
                  onClick={() => setTile(id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTile(id);
                    }
                  }}
                />
                {view.boardOptions.imageStyle === 'illustrated' ? (
                  <image
                    href={`./catan/${t.terrain}.svg`}
                    x={x - 45}
                    y={y - 48}
                    width="90"
                    height="70"
                    pointerEvents="none"
                  />
                ) : (
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    pointerEvents="none"
                    fontSize="17"
                  >
                    {t.terrain}
                  </text>
                )}
                {t.number && (
                  <>
                    <circle
                      cx={x}
                      cy={y + 20}
                      r="20"
                      fill="#fff4d7"
                      pointerEvents="none"
                    />
                    <text
                      x={x}
                      y={y + 26}
                      textAnchor="middle"
                      fontWeight="bold"
                      fontSize="19"
                      pointerEvents="none"
                    >
                      {t.number}
                    </text>
                  </>
                )}
                {view.robber === id && (
                  <text
                    x={x + 32}
                    y={y - 25}
                    fontSize="25"
                    pointerEvents="none"
                  >
                    ♟
                  </text>
                )}
              </g>
            );
          })}
          {view.board.edges.map((edge, id) => {
            const a = view.board.vertices[edge.a],
              b = view.board.vertices[edge.b],
              legal = legalEdge(id);
            return (
              <g key={id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={
                    view.roads[id] === null
                      ? legal
                        ? '#fff27b'
                        : '#786851'
                      : COLORS[view.roads[id]!]
                  }
                  strokeWidth={view.roads[id] === null ? 6 : 11}
                />
                {legal && (
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth="24"
                    role="button"
                    tabIndex={0}
                    aria-label={`Build on path ${id + 1}`}
                    onClick={() =>
                      action({
                        type:
                          view.phase === 'setup-road'
                            ? 'setup-road'
                            : 'build-road',
                        edge: id,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        action({
                          type:
                            view.phase === 'setup-road'
                              ? 'setup-road'
                              : 'build-road',
                          edge: id,
                        });
                      }
                    }}
                  />
                )}
                {edge.port && (
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 8}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="bold"
                  >
                    {edge.port === 'any' ? '3:1' : `${labels[edge.port]} 2:1`}
                  </text>
                )}
              </g>
            );
          })}
          {view.board.vertices.map((v, id) => {
            const building = view.buildings[id],
              legal = legalVertex(id);
            return (
              <g key={id}>
                <circle
                  cx={v.x}
                  cy={v.y}
                  r={building ? 11 : legal ? 9 : 4}
                  fill={
                    building
                      ? COLORS[building.owner]
                      : legal
                        ? '#fff27b'
                        : '#665643'
                  }
                  stroke="#fff5d9"
                  strokeWidth="2"
                />
                {building?.city && (
                  <text
                    x={v.x}
                    y={v.y + 5}
                    textAnchor="middle"
                    fill="white"
                    fontSize="13"
                  >
                    ★
                  </text>
                )}
                {legal && (
                  <circle
                    cx={v.x}
                    cy={v.y}
                    r="20"
                    fill="transparent"
                    role="button"
                    tabIndex={0}
                    aria-label={`Build at junction ${id + 1}`}
                    onClick={() =>
                      action({
                        type:
                          view.phase === 'setup-settlement'
                            ? 'setup-settlement'
                            : tool === 'city'
                              ? 'build-city'
                              : 'build-settlement',
                        vertex: id,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        action({
                          type:
                            view.phase === 'setup-settlement'
                              ? 'setup-settlement'
                              : tool === 'city'
                                ? 'build-city'
                                : 'build-settlement',
                          vertex: id,
                        });
                      }
                    }}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {tile !== null && (
        <section className="island-inspect" aria-label="Inspected land">
          <h3>
            Land {tile + 1} · {view.board.tiles[tile].terrain}
          </h3>
          <p>
            {view.board.tiles[tile].number
              ? `Produces on ${view.board.tiles[tile].number}.`
              : 'The desert produces no cargo.'}{' '}
            {view.robber === tile ? 'The raider blocks this land.' : ''}
          </p>
          <p>
            Adjacent outposts:{' '}
            {view.board.tiles[tile].vertices
              .filter((v) => view.buildings[v])
              .map((v) => names[view.buildings[v]!.owner])
              .join(', ') || 'none'}
            .
          </p>
        </section>
      )}
    </div>
  );
}
