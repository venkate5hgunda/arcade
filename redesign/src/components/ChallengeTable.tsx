import { useEffect, useState } from 'react';
import { actChallenge } from '../lib/challenges.ts';
import type { ChallengeState } from '../lib/challenges.ts';
import { StrandsTable } from './StrandsTable.tsx';
import { BeeTable } from './BeeTable.tsx';
import { LetterTable } from './LetterTable.tsx';
import { MiniTable } from './MiniTable.tsx';
import { TilesTable } from './TilesTable.tsx';
import { SudokuTable } from './SudokuTable.tsx';
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
  }, [state.gameId, state.seed]);
  function action(input: unknown) {
    const result = actChallenge(state, input);
    setMessage(result.message);
    if (result.state !== state) act(input);
  }
  return (
    <div className={`challenge-table challenge-${state.gameId}`}>
      {state.gameId === 'strands' && (
        <StrandsTable state={state} blocked={blocked} action={action} />
      )}
      {state.gameId === 'spelling-bee' && (
        <BeeTable state={state} blocked={blocked} action={action} />
      )}
      {state.gameId === 'letter-boxed' && (
        <LetterTable state={state} blocked={blocked} action={action} />
      )}
      {state.gameId === 'mini-crossword' && (
        <MiniTable state={state} blocked={blocked} action={action} />
      )}
      {state.gameId === 'tiles' && (
        <TilesTable state={state} blocked={blocked} action={action} />
      )}
      {state.gameId === 'sudoku' && (
        <SudokuTable state={state} blocked={blocked} action={action} />
      )}
      <p className="challenge-message" role="status">
        {message}
      </p>
    </div>
  );
}
