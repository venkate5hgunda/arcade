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
  const session = useMemo(() => createGameSession(id), [id]);
  const [state, view] = useState<T | null>(() => {
    if (valid(session.state)) return restore(session.state);
    if (session.state) session.finish();
    return null;
  });
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
  function commit(next: T, finished = done(next)) {
    playCue(() =>
      localCue(id, latest.current, next, finished && !ended.current),
    );
    latest.current = next;
    ended.current = finished;
    view(next);
    if (finished) session.finish();
    else session.save(next);
  }
  function start() {
    saveJSON(`${KEYS.SETTINGS}:${id}`, settings);
    markPlayed(id);
    latest.current = null;
    ended.current = false;
    commit(make(settings));
  }
  function reset() {
    if (
      !state ||
      window.confirm(
        'Start a fresh match? Your current progress will be cleared.',
      )
    ) {
      session.finish();
      view(null);
    }
  }
  return { id, state, settings, setSettings, commit, view, start, reset };
}
type Run<T extends object> = ReturnType<typeof useRun<T>>;
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
  return (
    <section className={`play-page puzzle-page puzzle-${run.id}`}>
      <Link className="back" to="/">
        ← Back to the shelf
      </Link>
      <div className="game-heading">
        <div>
          <p className="eyebrow">
            {game.category} · Make a little time to play
          </p>
          <h1>{game.name}</h1>
        </div>
        {run.state && (
          <button className="quiet" onClick={run.reset}>
            New match
          </button>
        )}
      </div>
      {!run.state ? (
        <div className="puzzle-setup">
          <p className="lede">{summary}</p>
          <div className="setup-card">
            <h2>Ready when you are</h2>
            <p>
              {setupSummary ||
                fields
                  .map(
                    (field) =>
                      field.options.find(
                        ([value]) => value === run.settings[field.key],
                      )?.[1],
                  )
                  .filter(Boolean)
                  .join(' · ') ||
                'Your next challenge starts here.'}
            </p>
            <button className="primary" onClick={run.start}>
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
          <details className="help-card">
            <summary>How to play</summary>
            <p>{help}</p>
          </details>
        </div>
      ) : (
        <div className="puzzle-play">
          <div className="board-panel">
            <div className="turn-banner" role="status">
              <div>
                <h2>{title}</h2>
                <p>{status}</p>
              </div>
            </div>
            {children}
            {after}
          </div>
          <details className="help-card">
            <summary>How to play</summary>
            <p>{help}</p>
          </details>
        </div>
      )}
    </section>
  );
}
