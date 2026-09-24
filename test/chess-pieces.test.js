import test from 'node:test';
import assert from 'node:assert/strict';
import { chessPieceMarkup } from '../games/chess.js';

test('both sides use the same solid chess silhouettes with distinct palettes', () => {
  for (const type of ['k', 'q', 'r', 'b', 'n', 'p']) {
    const white = chessPieceMarkup(type, 'w');
    const black = chessPieceMarkup(type, 'b');
    assert.equal(white.replace(' cw"', ' cb"'), black);
    assert.match(white, /class="chess-body"/);
    assert.match(white, /class="chess-band"/);
    assert.match(white, /class="chess-detail"|class="chess-glint"/);
    assert.match(white, /viewBox="8 4 48 54"/);
    assert.doesNotMatch(white, /[\u2654-\u265f]/);
  }
  assert.match(chessPieceMarkup('n', 'w'), /class="chess-detail-dot" cx="27" cy="21"/);
  assert.throws(() => chessPieceMarkup('z', 'w'), TypeError);
  assert.throws(() => chessPieceMarkup('k', 'purple'), TypeError);
});
