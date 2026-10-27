import { KEYS, saveJSON } from '../lib/storage.ts';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Frame, useRun } from '../components/GameFrame.tsx';
import { CardTable } from '../components/CardTable.tsx';
import {
  applyCards,
  cardView,
  finishedCards,
  newCards,
  validCrazyEightsCheckpoint,
  validUnoCheckpoint,
  wrapCards,
} from '../lib/cards.ts';
import type { CardGameId, EightState, UnoState } from '../lib/cards.ts';
import { names as readNames } from '../lib/profile.ts';
export const CARD_HELP = {
  'crazy-eights':
    'Match the active suit or top rank. Eights are wild: choose the next suit. Draw once, then play any matching card or pass. Two passes with an empty stock end a blocked game; the lowest penalty wins (8 = 50, faces = 10, ace = 1). Local hands are covered between players; private rooms send each player only their own cards.',
  uno: 'Match the active color or top value. Wilds choose a color. Skip, reverse and +2 affect the next player; a two-player reverse gives you another turn. Draw once, then play only that drawn card or pass. A +4 can be challenged: an illegal play costs its owner four; a failed challenge costs you six. Call UNO with two cards before playing, or the next player can catch a missed call for +2. Tables of 11–20 use two decks. Local hands are covered between players.',
};
export function CardsGame({ id }: { id: CardGameId }) {
  const run = useRun<EightState | UnoState>(
    id,
    id === 'uno' ? { count: '2' } : {},
    id === 'uno' ? validUnoCheckpoint : validCrazyEightsCheckpoint,
    (settings) =>
      newCards(
        id,
        id === 'uno'
          ? Math.min(20, Math.max(2, Number(settings.count) || 2))
          : 2,
      ).state,
    (state) => finishedCards(wrapCards(id, state)),
  );
  const [covered, setCovered] = useState(true);
  const [names, setNames] = useState(readNames);
  const game = run.state ? wrapCards(id, run.state) : null;
  const view = game ? cardView(game, game.state.current) : null;
  const over = view?.phase === 'over';
  const actor = view?.current ?? 0;
  const label = names[actor] || `Player ${actor + 1}`;
  function act(action: unknown) {
    if (!game || covered) return;
    const next = applyCards(game, action, game.state.current);
    if (!next) return;
    const hide =
      next.state.current !== game.state.current && !finishedCards(next);
    setCovered(hide);
    if (next.gameId === 'crazy-eights' && hide) next.state.phase = 'handoff';
    run.commit(next.state, finishedCards(next));
  }
  function callDuringHandoff() {
    if (!covered || game?.gameId !== 'uno' || game.state.unoPending === null)
      return;
    const next = applyCards(game, { type: 'uno' }, game.state.unoPending);
    if (next) run.commit(next.state, finishedCards(next));
  }
  function startCovered() {
    setCovered(true);
    run.start();
  }
  return (
    <Frame
      run={{ ...run, start: startCovered }}
      fields={
        id === 'uno'
          ? [
              {
                key: 'count',
                label: 'Players',
                options: Array.from(
                  { length: 19 },
                  (_, i) =>
                    [String(i + 2), `${i + 2} players`] as [string, string],
                ),
              },
            ]
          : []
      }
      setupExtra={
        <>
          <details className="help-card">
            <summary>Player names</summary>
            {Array.from(
              {
                length:
                  id === 'uno'
                    ? Math.min(20, Math.max(2, Number(run.settings.count) || 2))
                    : 2,
              },
              (_, index) => (
                <label key={index}>
                  Player {index + 1} name
                  <input
                    maxLength={24}
                    value={names[index] ?? ''}
                    placeholder={`Player ${index + 1}`}
                    onChange={(event) => {
                      const next = [...names];
                      next[index] = event.target.value;
                      setNames(next);
                      saveJSON(KEYS.PLAYER_NAMES, next);
                    }}
                  />
                </label>
              ),
            )}
          </details>
          <Link className="room-callout" to="/room">
            Different screens? Start a private room →
          </Link>
        </>
      }
      summary={
        id === 'uno'
          ? 'Big colors. Bold moves. One card left.'
          : 'Private hands, wild eights, and a little friendly rivalry.'
      }
      title={
        over
          ? 'Round complete'
          : covered
            ? `Pass to ${label}`
            : `${label}’s turn`
      }
      status={
        over
          ? 'Deal again when everyone is ready.'
          : covered
            ? 'Hands stay hidden until the next player is ready.'
            : 'Match, draw, or make your next wild move.'
      }
      help={CARD_HELP[id]}
      after={
        over ? (
          <button
            className="primary"
            onClick={() => {
              startCovered();
            }}
          >
            Deal again
          </button>
        ) : undefined
      }
    >
      {view && (
        <CardTable
          view={view}
          names={names}
          covered={covered && !over}
          reveal={() => setCovered(false)}
          onLateUno={callDuringHandoff}
          onAction={act}
        />
      )}
      <Link className="room-callout" to="/room">
        Different screens? Start a private room →
      </Link>
    </Frame>
  );
}
