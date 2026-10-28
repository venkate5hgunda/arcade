import test from 'node:test';
import assert from 'node:assert/strict';
import { cardPile, cardBack } from '../js/card-pile.js';

test('piles show the public top, expose counts, and distinguish empty and single cards', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement(tag) {
    return { tag, attributes: {}, children: [], setAttribute(key, value) { this.attributes[key] = value; },
      append(...children) { this.children.push(...children); } };
  } };
  try {
    const top = cardBack('Discovery');
    const stack = cardPile(top, { count: 5, label: 'Discovery draw pile' });
    assert.equal(stack.attributes['aria-label'], 'Discovery draw pile, 5 cards');
    assert.equal(top.attributes['aria-hidden'], 'true');
    assert.equal(stack.children[0], top);
    assert.match(cardPile(cardBack('Draw'), { count: 1 }).className, /--single/);
    const empty = cardPile(cardBack('Draw'), { count: 0, label: 'Draw pile' });
    assert.match(empty.className, /--empty/);
    assert.equal(empty.attributes['aria-label'], 'Draw pile, 0 cards');
    assert.equal(empty.children[0].textContent, 'Empty');
    assert.equal(cardPile(cardBack('Fortune'), { label: 'Fortune draw pile' }).attributes['aria-label'], 'Fortune draw pile');
  } finally { globalThis.document = previous; }
});
