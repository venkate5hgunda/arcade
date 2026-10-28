import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  newHockey,
  validHockey,
  worldHockey,
  snapshotHockey,
  hockeyStep,
  strikePuck,
  acceleratePaddle,
} from '../../src/lib/hockey.ts';
import { stepDiscs } from '../../src/lib/discs.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
test('disc movement, collisions, puck strikes and acceleration match original functions', async () => {
  const physics = await import(
      pathToFileURL(resolve('../js/disc-physics.js')).href
    ),
    old = await import(pathToFileURL(resolve('../games/air-hockey.js')).href);
  for (const speed of [40, 250, 690]) {
    const puck = { x: 300, y: 450, vx: 0, vy: 0, r: 17 },
      paddle = { x: 300, y: 500, vx: 0, vy: -speed, r: 37 };
    const a = structuredClone(puck),
      b = structuredClone(puck);
    assert.equal(strikePuck(a, paddle), old.strikeParkedPuck(b, paddle));
    assert.deepEqual(a, b);
    for (let i = 0; i < 240; i++) {
      stepDiscs([a], 1 / 120, { friction: 190 });
      physics.stepDiscs([b], 1 / 120, { friction: 190 });
    }
    assert.deepEqual(a, b);
  }
  const collisionA = [
    { x: 200, y: 200, vx: 120, vy: 20, r: 20 },
    { x: 239, y: 200, vx: -30, vy: 0, r: 20 },
  ];
  const collisionB = structuredClone(collisionA);
  stepDiscs(collisionA, 1 / 120, { restitution: 0.93 });
  physics.stepDiscs(collisionB, 1 / 120, { restitution: 0.93 });
  assert.deepEqual(collisionA, collisionB);
  const bounds = { left: 60, right: 540, top: 492, bottom: 840 },
    paddle = { x: 300, y: 740, vx: 0, vy: 0, r: 37 };
  const a = structuredClone(paddle),
    b = structuredClone(paddle);
  for (let i = 0; i < 90; i++) {
    acceleratePaddle(a, 100, -690, 1 / 120, bounds);
    old.acceleratePaddle(b, 100, -690, 1 / 120, bounds);
  }
  assert.deepEqual(a, b);
});
test('opening, both goals, receiving serves and finished session follow the production game state', () => {
  const original = newHockey(5);
  assert.ok(validCheckpoint('air-hockey', original));
  const idle = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ] as [{ x: number; y: number }, { x: number; y: number }];
  let w = worldHockey(original);
  hockeyStep(w, 1 / 120, idle);
  assert.equal(w.openingFaceoff, true);
  assert.equal(w.puck.y, 450);
  w.openingFaceoff = false;
  w.puck.y = 41;
  w.puck.vy = -300;
  assert.equal(hockeyStep(w, 1 / 120, idle), 0);
  assert.equal(w.waitingFor, 1);
  assert.equal(w.puck.y, 290);
  assert.ok(validHockey(snapshotHockey(w)));
  w.waitingFor = null;
  w.puck.y = 859;
  w.puck.vy = 300;
  assert.equal(hockeyStep(w, 1 / 120, idle), 1);
  assert.equal(w.waitingFor, 0);
  assert.equal(w.puck.y, 610);
  w = worldHockey({
    ...newHockey(5),
    paddles: [
      { x: 300, y: 740, score: 4 },
      { x: 300, y: 160, score: 0 },
    ],
    puck: { x: 300, y: 41, vx: 0, vy: -300 },
    openingFaceoff: false,
  });
  assert.equal(hockeyStep(w, 1 / 120, idle), 0);
  assert.equal(w.winner, 0);
  assert.equal(validCheckpoint('air-hockey', snapshotHockey(w)), false);
});
