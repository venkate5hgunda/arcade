import { HANDS, THROWS, rpsWinner } from '../lib/rps.ts';
import type { Throw } from '../lib/rps.ts';
export function RpsTable({
  picks,
  choosing,
  countdown,
  names,
  blocked,
  pick,
}: {
  picks: [Throw, Throw] | null;
  choosing: boolean;
  countdown: number | null;
  names: string[];
  blocked?: boolean;
  pick: (value: Throw) => void;
}) {
  const winner = picks ? rpsWinner(...picks) : null;
  return (
    <div className="rps-table">
      {picks ? (
        <div className="rps-arena" aria-label="Revealed throws">
          {picks.map((value, i) => (
            <div key={i} className={winner === i ? 'rps-winning' : ''}>
              <span role="img" aria-label={`${names[i]}: ${value}`}>
                {HANDS[value]}
              </span>
              <b>{names[i]}</b>
            </div>
          ))}
        </div>
      ) : countdown !== null ? (
        <div className="rps-count" role="status">
          <span aria-hidden="true">✊ ✊</span>
          <strong>{countdown > 0 ? countdown : 'SHOOT!'}</strong>
          <p>Rock · paper · scissors · shoot!</p>
        </div>
      ) : choosing ? (
        <div
          className="rps-choices"
          role="group"
          aria-label="Choose your throw"
        >
          {THROWS.map((value) => (
            <button key={value} disabled={blocked} onClick={() => pick(value)}>
              <span aria-hidden="true">{HANDS[value]}</span>
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      ) : (
        <div className="rps-covered" aria-hidden="true">
          ✦
        </div>
      )}
    </div>
  );
}
