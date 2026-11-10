import { useEffect, useState } from 'react';
import { tilesProgress } from '../lib/tiles.ts';
import type { TilesState } from '../lib/tiles.ts';
const colors = ['#f15c7d', '#65bfb7', '#e3b447', '#a78ace'];
const labels = [
  ['coral ring', 'teal ring', 'gold ring', 'lavender ring'],
  ['leaf', 'triangle', 'square', 'star'],
  ['diagonal stripes', 'horizontal stripes', 'vertical stripes', 'dots'],
];
export function TilesTable({
  state,
  blocked,
  action,
}: {
  state: TilesState;
  blocked: boolean;
  action: (input: unknown) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null),
    p = tilesProgress(state);
  useEffect(() => setSelected(null), [state.seed, state.moves.length]);
  return (
    <>
      <p className="challenge-edition">
        {state.date ? `Daily · ${state.date}` : 'Practice'} ·{' '}
        {state.players > 1
          ? `Player ${(state.moves.length % state.players) + 1} to match`
          : 'Solo'}
      </p>
      <h3>
        {p.score} points · {p.combo}× combo · {p.remaining} layers left
      </h3>
      <p>
        Match any shared ring, shape or pattern. Reuse a remaining tile to grow
        your combo.
      </p>
      <div
        className="tiles-grid"
        role="group"
        aria-label="Layered pattern tiles"
      >
        {p.board.map((layers, index) => (
          <button
            key={index}
            className={`pattern-tile ${selected === index ? 'selected' : ''}`}
            aria-pressed={selected === index}
            disabled={blocked || p.done || layers.every((n) => n < 0)}
            aria-label={`Tile ${index + 1}: ${
              layers
                .map((n, i) => (n < 0 ? '' : labels[i][n]))
                .filter(Boolean)
                .join(', ') || 'cleared'
            }`}
            onClick={() => {
              if (selected === null) setSelected(index);
              else if (selected === index) setSelected(null);
              else {
                action({ type: 'match', tiles: [selected, index] });
                setSelected(null);
              }
            }}
          >
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <pattern
                  id={`tile-pattern-${index}`}
                  patternUnits="userSpaceOnUse"
                  width="12"
                  height="12"
                  patternTransform={layers[2] === 0 ? 'rotate(45)' : ''}
                >
                  {layers[2] === 3 ? (
                    <circle cx="6" cy="6" r="2" fill="#26354d" />
                  ) : (
                    <path
                      d={layers[2] === 2 ? 'M6 0v12' : 'M0 6h12'}
                      stroke="#26354d"
                      strokeWidth="2"
                    />
                  )}
                </pattern>
              </defs>
              {layers[2] >= 0 && (
                <rect
                  x="7"
                  y="7"
                  width="86"
                  height="86"
                  rx="12"
                  fill={`url(#tile-pattern-${index})`}
                />
              )}{' '}
              {layers[0] >= 0 && (
                <circle
                  cx="50"
                  cy="50"
                  r="33"
                  fill="none"
                  stroke={colors[layers[0]]}
                  strokeWidth="9"
                  strokeDasharray={['', '8 5', '2 5', '12 3 2 3'][layers[0]]}
                />
              )}{' '}
              {layers[1] >= 0 && (
                <path
                  d={
                    [
                      'M28 68Q25 24 72 27Q76 70 28 68M30 66L65 34',
                      'M50 25L75 72H25Z',
                      'M29 29H71V71H29Z',
                      'M50 20L58 40L80 42L63 56L69 78L50 65L31 78L37 56L20 42L42 40Z',
                    ][layers[1]]
                  }
                  fill="#182039"
                  stroke="#fff3df"
                  strokeWidth="3"
                />
              )}
            </svg>
          </button>
        ))}
      </div>
    </>
  );
}
