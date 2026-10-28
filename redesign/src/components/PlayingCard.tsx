import type { Card } from '../lib/playing-cards.ts';
const SUIT_NAMES = {
  '♠': 'spades',
  '♥': 'hearts',
  '♦': 'diamonds',
  '♣': 'clubs',
} as const;
export function PlayingCard({
  card,
  hidden = false,
  label,
}: {
  card?: Card;
  hidden?: boolean;
  label?: string;
}) {
  if (!hidden && !card)
    throw new Error('A face-up playing card needs a rank and suit.');
  return (
    <span
      role="img"
      aria-label={
        label ??
        (hidden
          ? 'Face-down card'
          : `${card!.rank} of ${SUIT_NAMES[card!.suit]}`)
      }
      className={`playing-card ${hidden ? 'card-back' : card!.suit === '♥' || card!.suit === '♦' ? 'card-red' : ''}`}
    >
      {hidden ? (
        <span aria-hidden="true">✦</span>
      ) : (
        <>
          <span className="card-corner" aria-hidden="true">
            {card!.rank}
            <small>{card!.suit}</small>
          </span>
          <span className="card-suit" aria-hidden="true">
            {card!.suit}
          </span>
        </>
      )}
    </span>
  );
}
