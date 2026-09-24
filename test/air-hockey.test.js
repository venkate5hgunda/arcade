import test from 'node:test';
import assert from 'node:assert/strict';
import { keepPuckMoving, parkPuck, strikeParkedPuck } from '../games/air-hockey.js';

for (const [scorer, receiver, y] of [[0, 1, 290], [1, 0, 610]]) {
  test(`goal by P${scorer + 1} parks puck on receiving side until hit`, () => {
    const puck = { x: 190, y: 22, vx: 430, vy: -600, r: 17 };
    parkPuck(puck, receiver);
    assert.deepEqual([puck.x, puck.y, puck.vx, puck.vy], [300, y, 0, 0]);
    keepPuckMoving(puck, receiver);
    assert.deepEqual([puck.x, puck.y, puck.vx, puck.vy], [300, y, 0, 0]);
    const scorerPaddle = { x: 300, y: scorer === 0 ? 740 : 160, vx: 0, vy: 1000, r: 37 };
    assert.equal(strikeParkedPuck(puck, scorerPaddle, receiver), false);
    assert.equal(puck.vy, 0);
    const receiverPaddle = { x: 300, y: y + (receiver === 0 ? 60 : -60), vx: 0, vy: 400, r: 37 };
    assert.equal(strikeParkedPuck(puck, receiverPaddle, receiver), false);
    receiverPaddle.y = y + (receiver === 0 ? 50 : -50);
    assert.equal(strikeParkedPuck(puck, receiverPaddle, receiver), true);
    assert.ok(receiver === 0 ? puck.vy < 0 : puck.vy > 0);
  });
}
