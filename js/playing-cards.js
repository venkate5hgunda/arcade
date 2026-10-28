// Standard playing cards shared by card games. Game rules remain game-owned.
export const SUITS = Object.freeze(['♠', '♥', '♦', '♣']);
export const RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
export const SUIT_NAMES = Object.freeze({ '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' });

export function shuffle(cards, random = Math.random) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function shuffledDeck(random = Math.random) {
  return shuffle(SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank }))), random);
}

export function playingCardElement(card, { hidden = false, playable = false, onClick } = {}) {
  const el = document.createElement(onClick ? 'button' : 'div');
  el.className = `cg-card${hidden ? ' cg-card--back' : card.suit === '♥' || card.suit === '♦' ? ' cg-card--red' : ''}${onClick ? ' cg-card--button' : ''}`;
  if (onClick) {
    el.type = 'button';
    el.disabled = !playable;
    el.addEventListener('click', onClick);
  } else {
    el.setAttribute('role', 'img');
  }
  el.setAttribute('aria-label', hidden ? 'Face-down card' :
    `${card.rank} of ${SUIT_NAMES[card.suit]}${onClick ? playable ? ', play card' : ', cannot play' : ''}`);
  if (hidden) {
    el.innerHTML = '<span aria-hidden="true" class="cg-card-back-mark">✦</span>';
  } else {
    const corner = document.createElement('span');
    corner.className = 'cg-card-corner';
    corner.textContent = `${card.rank}${card.suit}`;
    const center = document.createElement('span');
    center.className = 'cg-card-center';
    center.setAttribute('aria-hidden', 'true');
    center.textContent = card.suit;
    el.append(corner, center);
  }
  return el;
}
