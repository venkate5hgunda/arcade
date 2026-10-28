import test from 'node:test';
import assert from 'node:assert/strict';
import { playingCardElement, shuffledDeck } from '../js/playing-cards.js';
import { shuffledDeck as blackjackDeck } from '../games/blackjack.js';
import { shuffledDeck as crazyEightsDeck } from '../games/crazy-eights.js';

test('standard games use the same complete, deterministically shuffled deck', () => {
  const random = () => 0.5;
  const deck = shuffledDeck(random);
  assert.deepEqual(blackjackDeck(random), deck);
  assert.deepEqual(crazyEightsDeck(random), deck);
  assert.equal(new Set(deck.map(({ suit, rank }) => `${suit}:${rank}`)).size, 52);
});

test('standard cards expose consistent faces, hidden backs and playable controls', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement(tag) {
    return { tag, attributes: {}, children: [], setAttribute(key, value) { this.attributes[key] = value; },
      append(...children) { this.children.push(...children); },
      addEventListener(type, listener) { this.listener = listener; } };
  } };
  try {
    const card = { suit: '♥', rank: 'Q' };
    const face = playingCardElement(card);
    assert.equal(face.className, 'cg-card cg-card--red');
    assert.equal(face.attributes['aria-label'], 'Q of hearts');
    assert.deepEqual(face.children.map(child => child.textContent), ['Q♥', '♥']);
    const back = playingCardElement(card, { hidden: true });
    assert.equal(back.attributes['aria-label'], 'Face-down card');
    assert.equal(back.children.length, 0);
    let clicked = false;
    const button = playingCardElement(card, { playable: true, onClick: () => { clicked = true; } });
    assert.equal(button.tag, 'button');
    assert.equal(button.disabled, false);
    button.listener();
    assert.equal(clicked, true);
    assert.equal(playingCardElement(card, { onClick() {} }).disabled, true);
  } finally {
    globalThis.document = previous;
  }
});
