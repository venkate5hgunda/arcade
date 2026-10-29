import { useEffect, useState } from 'react';
import { bestScore, recordBest } from './profile.ts';
import { KEYS, observeStorage } from './storage.ts';
export function useBestScore(id: string) {
  const [best, setBest] = useState(() => bestScore(id));
  useEffect(
    () =>
      observeStorage([`${KEYS.HIGH_SCORES}:${id}`], () =>
        setBest(bestScore(id)),
      ),
    [id],
  );
  return [
    best,
    (score: number) => {
      setBest((current) => Math.max(current, score));
      void recordBest(id, score);
    },
  ] as const;
}
