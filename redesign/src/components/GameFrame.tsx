import { GameMenu } from './GameMenu.tsx';
import { GameArt } from './GameArt.tsx';
import { useMemo, useRef, useState } from 'react';
import { localCue } from '../lib/game-feedback.ts';
import { playCue } from '../lib/feedback.ts';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GAMES } from '../lib/games.ts';
import { createGameSession } from '../lib/session.ts';
import { KEYS, loadJSON, saveJSON } from '../lib/storage.ts';
import { markPlayed } from '../lib/profile.ts';

export type Settings = Record<string, string>;
export type Field = { key: string; label: string; options: [string, string][] };
export function useRun<T extends object>(
  id: string,
  defaults: Settings,
  valid: (s: unknown) => boolean,
  make: (settings: Settings) => T,
  done: (state: T) => boolean = (state) => !!(state as { over?: boolean }).over,
  restore: (value: unknown) => T = (value) => value as T,
) {
  const session = useMemo(() => createGameSession(id, { fresh: true }), [id]);
  const [state, view] = useState<T | null>(() => {
    if (valid(session.state)) return restore(session.state);
    if (session.state) session.finish();
    return null;
  });
  const [saving, setSaving] = useState(false);
  const latest = useRef(state);
  latest.current = state;
  const ended = useRef(false);
  if (!state) ended.current = false;
  const [settings, setSettings] = useState<Settings>(() => {
    const raw = loadJSON<unknown>(`${KEYS.SETTINGS}:${id}`, defaults);
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? Object.fromEntries(
          Object.entries(defaults).map(([key, value]) => [
            key,
            typeof (raw as Settings)[key] === 'string'
              ? (raw as Settings)[key]
              : value,
          ]),
        )
      : defaults;
  });
  async function commit(next: T, finished = done(next), display = next) {
    playCue(() =>
      localCue(id, latest.current, next, finished && !ended.current),
    );
    latest.current = display;
    ended.current = finished;
    setSaving(true);
    if (finished) await session.finish();
    else await session.save(next);
    view(display);
    setSaving(false);
  }
  function start() {
    saveJSON(`${KEYS.SETTINGS}:${id}`, settings);
    markPlayed(id);
    latest.current = null;
    ended.current = false;
    return commit(make(settings));
  }
  async function reset() {
    if (
      !state ||
      window.confirm(
        'Start a fresh match? Your current progress will be cleared.',
      )
    ) {
      await session.finish();
      view(null);
    }
  }
  return {
    id,
    state,
    settings,
    setSettings,
    commit,
    view,
    start,
    reset,
    saving,
  };
}
type Run<T extends object> = Omit<ReturnType<typeof useRun<T>>, 'start'> & {
  start(): void | Promise<void>;
};
export function Frame<T extends object>({
  run,
  fields,
  summary,
  help,
  title,
  status,
  children,
  after,
  setupSummary,
  setupExtra,
  optionsExtra,
}: {
  run: Run<T>;
  fields: Field[];
  summary: string;
  help: string;
  title: string;
  status: string;
  children: ReactNode;
  after?: ReactNode;
  setupSummary?: string;
  setupExtra?: ReactNode;
  optionsExtra?: ReactNode;
}) {
  const game = GAMES.find((g) => g.id === run.id)!;
  const selection =
    setupSummary ||
    fields
      .map(
        (field) =>
          field.options.find(
            ([value]) => value === run.settings[field.key],
          )?.[1],
      )
      .filter(Boolean)
      .join(' · ');
  return (
    <section
      className={`play-page puzzle-page puzzle-${run.id} ${run.state ? 'is-playing' : 'is-setup'}`}
    >
      <Link className="back" to="/">
        ← All games
      </Link>
      <div className="game-heading">
        <h1>{game.name}</h1>
        <GameMenu label="Game menu">
          <details>
            <summary>How to play</summary>
            <p>{help}</p>
          </details>
        </GameMenu>
        {run.state && (
          <button className="quiet" onClick={run.reset}>
            New match
          </button>
        )}
      </div>
      {!run.state ? (
        <div className="puzzle-setup">
          <p className="lede setup-description">{summary}</p>
          <div className="setup-card">
            {selection && <p className="setup-selection">{selection}</p>}
            <button className="primary setup-start" onClick={run.start}>
              Start playing →
            </button>
            {fields.length > 0 && (
              <details>
                <summary>Match options</summary>
                {fields.map((field) => (
                  <label key={field.key}>
                    {field.label}
                    <select
                      value={run.settings[field.key]}
                      onChange={(e) =>
                        run.setSettings({
                          ...run.settings,
                          [field.key]: e.target.value,
                        })
                      }
                    >
                      {field.options.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {optionsExtra}
              </details>
            )}
          </div>
          {setupExtra}
          <GameArt id={run.id} className="puzzle-setup-art" />
        </div>
      ) : (
        <div className="puzzle-play">
          <div
            className="board-panel"
            aria-busy={run.saving}
            inert={run.saving}
          >
            <div
              className={`turn-banner ${run.id === 'strands' && title === 'Strands' ? 'sr-only' : ''}`}
              role="status"
            >
              <div>
                <h2>{title}</h2>
                <p
                  className={
                    status ===
                      'Play at your pace. Your progress is saved on this device.' ||
                    status === 'A completed puzzle. Nicely done.'
                      ? 'sr-only'
                      : 'game-status-detail'
                  }
                >
                  {status}
                </p>
              </div>
            </div>
            {children}
            {after}
          </div>
        </div>
      )}
    </section>
  );
}
