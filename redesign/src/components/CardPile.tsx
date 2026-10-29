import type { ReactNode } from 'react';
import { PlayingCard } from './PlayingCard.tsx';
export function CardPile({
  count,
  label,
  children,
}: {
  count: number | null;
  label: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={`card-pile ${count === 0 ? 'empty' : count === 1 ? 'single' : ''}`}
      role="img"
      aria-label={
        count === null
          ? `${label}, cards face down`
          : `${label}, ${count} ${count === 1 ? 'card' : 'cards'}`
      }
    >
      {count === 0 ? (
        <span className="card-pile-empty" aria-hidden="true">
          Empty
        </span>
      ) : (
        <span className="card-pile-top" aria-hidden="true">
          {children ?? <PlayingCard hidden />}
        </span>
      )}
    </span>
  );
}
