import test from 'node:test';
import assert from 'node:assert/strict';
import { acceleratePaddle, parkOpeningPuck, parkPuck, strikeParkedPuck } from '../games/air-hockey.js';
import { stepDiscs } from '../js/disc-physics.js';

test('opening faceoff stays at rest until either player approaches the puck', () => {
  const puck = { x: 90, y: 300, vx: 200, vy: 340, r: 17 };
  parkOpeningPuck(puck);
  assert.deepEqual([puck.x, puck.y, puck.vx, puck.vy], [300, 450, 0, 0]);
  for (const [paddleY, vy, expectedSign] of [[492, -200, -1], [408, 200, 1]]) {
    const paddle = { x: 300, y: paddleY, vx: 0, vy, r: 37 };
    assert.equal(strikeParkedPuck(puck, { ...paddle, vy: 0 }), false);
    assert.equal(strikeParkedPuck(puck, { ...paddle, vy: -vy }), false);
    assert.equal(strikeParkedPuck(puck, paddle), true);
    assert.equal(Math.sign(puck.vy), expectedSign);
    parkOpeningPuck(puck);
  }
});

test('a harder or angled impact transfers proportionally more momentum', () => {
  const puck = { x: 300, y: 450, vx: 0, vy: 0, r: 17 };
  const paddle = { x: 300, y: 492, vx: 0, vy: -80, r: 37 };
  assert.equal(strikeParkedPuck(puck, paddle), true);
  const gentle = Math.hypot(puck.vx, puck.vy);
  assert.ok(gentle > 100 && gentle < 320, `gentle hit was ${gentle}`);
  parkOpeningPuck(puck);
  paddle.vy = -400;
  strikeParkedPuck(puck, paddle);
  const hard = Math.hypot(puck.vx, puck.vy);
  assert.ok(hard > gentle * 4, `hard hit ${hard} did not exceed gentle hit ${gentle}`);
  parkOpeningPuck(puck);
  paddle.x = 270;
  paddle.vx = 240;
  strikeParkedPuck(puck, paddle);
  assert.ok(puck.vx > 0 && puck.vy < 0, 'angled impact must deflect toward the contact normal');
  parkOpeningPuck(puck);
  paddle.x = 300; paddle.vx = 0; paddle.vy = -1200;
  strikeParkedPuck(puck, paddle);
  assert.ok(Math.hypot(puck.vx, puck.vy) <= 1050, 'extreme inputs remain playable');
});

test('paddles accelerate toward input and stop at their half-table boundary', () => {
  const paddle = { x: 300, y: 740, vx: 0, vy: 0 };
  const bounds = { left: 60, right: 540, top: 492, bottom: 840 };
  const dt = 1 / 120;
  acceleratePaddle(paddle, 0, -690, dt, bounds);
  assert.ok(paddle.vy < 0 && paddle.vy > -690, 'first frame is acceleration-limited');
  const firstSpeed = Math.abs(paddle.vy);
  acceleratePaddle(paddle, 0, -690, dt, bounds);
  assert.ok(Math.abs(paddle.vy) > firstSpeed, 'continued input builds speed');
  for (let i = 0; i < 100; i++) acceleratePaddle(paddle, 0, -690, dt, bounds);
  assert.equal(paddle.y, bounds.top);
  assert.equal(paddle.vy, 0, 'a wall cannot add paddle velocity');
});

for (const [scorer, receiver, y] of [[0, 1, 290], [1, 0, 610]]) {
  test(`goal by P${scorer + 1} parks puck on receiving side until struck`, () => {
    const puck = { x: 190, y: 22, vx: 430, vy: -600, r: 17 };
    parkPuck(puck, receiver);
    assert.deepEqual([puck.x, puck.y, puck.vx, puck.vy], [300, y, 0, 0]);
    const scorerPaddle = { x: 300, y: scorer === 0 ? 740 : 160, vx: 0, vy: 1000, r: 37 };
    assert.equal(strikeParkedPuck(puck, scorerPaddle), false);
    const receiverPaddle = {
      x: 300, y: y + (receiver === 0 ? 60 : -60),
      vx: 0, vy: receiver === 0 ? -400 : 400, r: 37,
    };
    assert.equal(strikeParkedPuck(puck, receiverPaddle), false);
    receiverPaddle.y = y + (receiver === 0 ? 50 : -50);
    assert.equal(strikeParkedPuck(puck, receiverPaddle), true);
    assert.ok(receiver === 0 ? puck.vy < 0 : puck.vy > 0);
    const speed = Math.hypot(puck.vx, puck.vy);
    stepDiscs([puck], 1 / 120, { friction: 40 });
    assert.ok(Math.hypot(puck.vx, puck.vy) < speed, 'surface friction slows the puck');
  });
}
