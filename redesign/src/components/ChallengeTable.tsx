import { useEffect, useState } from 'react';
import { actChallenge } from '../lib/challenges.ts';
import type { ChallengeState } from '../lib/challenges.ts';
import type { StrandsState } from '../lib/strands.ts';
import { strandsDone, strandsPuzzle } from '../lib/strands.ts';
export function ChallengeTable({
  state,
  blocked = false,
  act,
}: {
  state: ChallengeState;
  blocked?: boolean;
  act: (input: unknown) => void;
}) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    setMessage('');
  }, [state]);
  function action(input: unknown) {
    const result = actChallenge(state, input);
    setMessage(result.message);
    if (result.state !== state) act(input);
  }
  return (
    <div className={`challenge-table challenge-${state.gameId}`}>
      <StrandsTable state={state} blocked={blocked} action={action} />
      <p className="challenge-message" role="status">
        {message}
      </p>
    </div>
  );
}
function StrandsTable({
  state,
  blocked,
  action,
}: {
  state: StrandsState;
  blocked: boolean;
  action: (input: unknown) => void;
}) {
  const [path, setPath] = useState<number[]>([]),
    [message, setMessage] = useState('');
  const puzzle = strandsPuzzle(state.seed),
    done = strandsDone(state);
  useEffect(() => {
    setPath([]);
    setMessage('');
  }, [state.seed, state.found.length]);
  const used = state.found.flatMap((f) => f.path),
    spangram = state.found.find((f) => f.word === 0)?.path ?? [];
  function select(cell: number) {
    if (path.at(-1) === cell) {
      setPath(path.slice(0, -1));
      return;
    }
    if (path.includes(cell)) {
      setMessage('Use each letter once. Tap the last letter to undo.');
      return;
    }
    const last = path.at(-1);
    if (
      last !== undefined &&
      (Math.abs(Math.floor(last / 6) - Math.floor(cell / 6)) > 1 ||
        Math.abs((last % 6) - (cell % 6)) > 1)
    ) {
      setMessage('Choose a touching letter.');
      return;
    }
    setPath([...path, cell]);
    setMessage('');
  }
  return (
    <>
      <div className="challenge-edition">
        {state.date ? `Daily · ${state.date}` : 'Practice'} ·{' '}
        {state.found.length} of {puzzle.words.length} words
      </div>
      <h3 className="strands-theme">{puzzle.theme}</h3>
      <div
        className="strands-grid"
        role="group"
        aria-label="Letter grid"
        onKeyDown={(e) => {
          const n = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 6, ArrowUp: -6 }[
            e.key
          ];
          if (n === undefined) return;
          const buttons = [
            ...e.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
          ];
          const i = buttons.indexOf(e.target as HTMLButtonElement);
          if (i < 0) return;
          e.preventDefault();
          for (let step = 1; step <= 48; step++) {
            const button = buttons[(i + n * step + 48 * 48) % 48];
            if (!button.disabled) {
              button.focus();
              break;
            }
          }
        }}
      >
        {puzzle.letters.map((letter, cell) => (
          <button
            className={`${used.includes(cell) ? 'found' : ''} ${spangram.includes(cell) ? 'spangram' : ''} ${state.hints.some((word) => !state.found.some((f) => f.word === word) && puzzle.paths[word][0] === cell) ? 'hinted' : ''}`}
            key={cell}
            aria-label={`${letter}, row ${Math.floor(cell / 6) + 1} column ${(cell % 6) + 1}${used.includes(cell) ? ', found' : ''}`}
            aria-pressed={path.includes(cell)}
            disabled={blocked || done || used.includes(cell)}
            onClick={() => select(cell)}
          >
            {letter}
          </button>
        ))}
      </div>
      {!done && (
        <>
          <p className="challenge-draft" aria-live="polite">
            {path.length
              ? path.map((n) => puzzle.letters[n]).join('')
              : 'Trace a theme word'}
          </p>
          <div className="actions">
            <button
              className="quiet"
              disabled={blocked || !path.length}
              onClick={() => setPath([])}
            >
              Clear path
            </button>
            <button
              className="quiet"
              disabled={blocked || state.hints.length >= 3}
              onClick={() => action({ type: 'hint' })}
            >
              Hint ({3 - state.hints.length})
            </button>
            <button
              className="primary"
              disabled={blocked || path.length < 3}
              onClick={() => action({ type: 'word', path })}
            >
              Submit word
            </button>
          </div>
        </>
      )}
      <p role="status">{message}</p>
      <ul className="strands-found" aria-label="Found words">
        {state.found.map((f) => (
          <li key={f.word}>
            {puzzle.words[f.word]}
            {f.word === 0 ? ' · Spangram' : ''}
          </li>
        ))}
      </ul>
    </>
  );
}
