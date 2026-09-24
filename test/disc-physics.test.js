import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixedStepper, stepDiscs } from '../js/disc-physics.js';

test('equal-mass discs transfer momentum without interpenetrating', () => {
  const a = { x: 20, y: 50, vx: 100, vy: 0, r: 10 };
  const b = { x: 39, y: 50, vx: 0, vy: 0, r: 10 };
  let collisions = 0;
  stepDiscs([a, b], 1 / 120, { restitution: 1, onCollision: () => { collisions++; } });
  assert.ok(collisions >= 1);
  assert.ok(a.vx <= 1);
  assert.ok(b.vx > 90);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r - .01);
});

test('kinematic paddle transfers momentum to puck without moving itself', () => {
  const puck = { x: 29, y: 50, vx: 0, vy: 0, r: 10 };
  const paddle = { x: 10, y: 50, vx: 180, vy: 0, r: 10, invMass: 0 };
  stepDiscs([puck, paddle], 1 / 120, { restitution: .9 });
  assert.ok(puck.vx > 200);
  assert.equal(paddle.x, 10);
});

test('pockets and rails take precedence over wall rebounds', () => {
  const ball = { x: 80, y: 50, vx: 100, vy: 0, r: 10 };
  let pocketed = 0;
  stepDiscs([ball], .12, {
    bounds: { left: 0, right: 100, top: 0, bottom: 100 },
    pockets: [{ x: 92, y: 50, r: 18 }],
    onPocket: () => { pocketed++; },
  });
  assert.equal(ball.pocketed, true);
  assert.equal(pocketed, 1);
  assert.equal(ball.vx, 0);
});

test('fixed stepper bounds simulation after tab suspension', () => {
  let steps = 0;
  const stepper = createFixedStepper(() => { steps++; });
  stepper.tick(0);
  stepper.tick(5000);
  assert.ok(steps <= 12);
});
