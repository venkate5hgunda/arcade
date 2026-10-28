import { useEffect, useState } from 'react';
import type { MafiaView, Role } from '../lib/mafia.ts';
const ROLES: Record<Role, [string, string, string]> = {
  mafia: [
    'The Shadow',
    'Choose a target after dark. Find your ally, blend in by day.',
    '◆',
  ],
  doctor: [
    'The Guardian',
    'Protect one person each night, including yourself.',
    '✦',
  ],
  detective: [
    'The Oracle',
    'Investigate one person each night. Only you see the result.',
    '◉',
  ],
  town: [
    'The Lantern',
    'Discuss, deduce, and vote out the hidden Mafia.',
    '✳',
  ],
};
export function MafiaTable({
  view,
  seat,
  names,
  online,
  host,
  error,
  action,
  replay,
}: {
  view: MafiaView;
  seat: number;
  names: string[];
  online: boolean[];
  host: boolean;
  error: string;
  action: (a: unknown) => void;
  replay: () => void;
}) {
  const [selected, setSelected] = useState<number | null | undefined>(
    undefined,
  );
  useEffect(() => {
    setSelected(undefined);
  }, [view.phase, view.day]);
  const mine = view.pending.includes(seat),
    disconnected = view.pending.filter((i) => !online[i]);
  const title =
    view.phase === 'night'
      ? 'The city sleeps.'
      : view.phase === 'discussion'
        ? 'Speak your suspicions.'
        : view.phase === 'vote'
          ? 'Cast your secret ballot.'
          : view.winner === 'town'
            ? 'The town prevails.'
            : 'The shadows prevail.';
  const label = (i: number) => `${names[i]} · ${i + 1}`;
  return (
    <div className="mafia-table">
      <div className="mafia-hero">
        <p className="eyebrow">
          {view.phase === 'night'
            ? '☾ AFTER DARK'
            : view.phase === 'over'
              ? '✧ THE FINAL VERDICT'
              : '☀ THE CITY AWAKENS'}{' '}
          · DAY {view.day}
        </p>
        <h2>{title}</h2>
        <p role="status">{view.announcement}</p>
        <div className="mafia-role">
          <span aria-hidden="true">{ROLES[view.role][2]}</span>
          <p>YOUR SECRET CARD · {names[seat]}</p>
          <strong>{ROLES[view.role][0]}</strong>
          <small>{ROLES[view.role][1]}</small>
          {view.allies.length > 0 && (
            <small>Fellow shadow: {view.allies.map(label).join(', ')}</small>
          )}
        </div>
      </div>
      <div className="mafia-panel">
        {error && <p role="alert">{error}</p>}
        <h3>
          {view.phase === 'night'
            ? mine
              ? view.role === 'mafia'
                ? 'Choose a night target'
                : view.role === 'doctor'
                  ? 'Who will you protect?'
                  : 'Who will you investigate?'
              : !view.alive[seat]
                ? 'You are watching from the sidelines'
                : 'Sleep until dawn'
            : view.phase === 'discussion'
              ? 'The floor is yours'
              : view.phase === 'vote'
                ? mine
                  ? 'Who should leave the city?'
                  : 'Ballot sealed'
                : 'The story is complete'}
        </h3>
        <p>
          {view.phase === 'discussion'
            ? 'Talk by voice or in person. Your role stays on this device.'
            : view.phase === 'vote' && mine
              ? 'Choose another living player or abstain. Ballots are private.'
              : view.phase === 'night' && mine
                ? 'Only you and the trusted room host can see your selection.'
                : view.phase === 'over'
                  ? 'All roles are now visible.'
                  : 'Wait for the other players.'}
        </p>
        {mine && ['night', 'vote'].includes(view.phase) && (
          <>
            <div
              className="mafia-targets"
              role="group"
              aria-label="Choose a player"
            >
              {view.alive.map(
                (alive, i) =>
                  alive &&
                  (i !== seat ||
                    (view.role === 'doctor' && view.phase === 'night')) && (
                    <button
                      className="quiet"
                      key={i}
                      aria-pressed={selected === i}
                      onClick={() => setSelected(i)}
                    >
                      ◇ {label(i)}
                    </button>
                  ),
              )}
              {view.phase === 'vote' && (
                <button
                  className="quiet"
                  aria-pressed={selected === null}
                  onClick={() => setSelected(null)}
                >
                  Abstain
                </button>
              )}
            </div>
            {selected !== undefined && (
              <button
                className="primary"
                onClick={() => {
                  action({ type: 'mafia-act', target: selected });
                  setSelected(undefined);
                }}
              >
                Confirm {selected === null ? 'abstention' : names[selected]}
              </button>
            )}
          </>
        )}
        {view.role === 'detective' && view.clues.length > 0 && (
          <details className="help-card">
            <summary>My private case file</summary>
            {view.clues.map((c) => (
              <p key={c.day}>
                Night {c.day}: {names[c.target]} —{' '}
                {c.mafia ? 'Mafia' : 'not Mafia'}.
              </p>
            ))}
          </details>
        )}
        {view.phase === 'discussion' && host && (
          <button
            className="primary"
            onClick={() => action({ type: 'mafia-next' })}
          >
            End discussion · open secret vote
          </button>
        )}
        {['night', 'vote'].includes(view.phase) && (
          <>
            <p>
              {view.pending.length
                ? `Waiting for ${view.pending.filter((i) => online[i]).length} connected seats${disconnected.length ? ` · ${disconnected.length} disconnected` : ''}.`
                : 'All actions are in. The host can reveal what happened.'}
            </p>
            {host &&
              disconnected.map((i) => (
                <button
                  key={i}
                  className="quiet"
                  onClick={() => action({ type: 'mafia-skip', target: i })}
                >
                  Mark {names[i]} absent this phase
                </button>
              ))}
            {host && !view.pending.length && (
              <button
                className="primary"
                onClick={() => action({ type: 'mafia-resolve' })}
              >
                {view.phase === 'night'
                  ? 'Reveal the dawn'
                  : 'Count the ballots'}
              </button>
            )}
          </>
        )}
        {view.phase === 'over' && (
          <>
            <div className="mafia-reveal">
              {view.roles?.map((role, i) => (
                <span key={i}>
                  {names[i]} · {ROLES[role][0]}
                </span>
              ))}
            </div>
            {host && (
              <button
                className="primary"
                onClick={replay}
                disabled={online.some((v) => !v)}
              >
                Deal another round
              </button>
            )}
            {host && online.some((v) => !v) && (
              <p>Reconnect every seat to deal again.</p>
            )}
          </>
        )}
      </div>
      <details className="help-card">
        <summary>People of the city</summary>
        {names.map((name, i) => (
          <p key={i}>
            {name} ·{' '}
            {!view.alive[i]
              ? 'Eliminated · spectating'
              : !online[i]
                ? 'Disconnected'
                : view.pending.includes(i)
                  ? 'Action needed'
                  : view.submitted.includes(i)
                    ? 'Action received'
                    : 'In the city'}
          </p>
        ))}
      </details>
      <details className="help-card">
        <summary>House rules & privacy</summary>
        <p>
          5–10 players. One Mafia at 5–6 players; two at 7–10. Mafia chooses a
          victim, Doctor protects and Detective investigates. Ties spare
          everyone. Town wins when all Mafia are eliminated; Mafia wins at
          parity. Eliminated players observe. The host device knows every role
          and action.
        </p>
      </details>
    </div>
  );
}
