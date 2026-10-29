import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createBusiness,
  actBusiness,
  publicBusiness,
  validBusiness,
} from '../../src/lib/business-core.js';
import type { BusinessAction } from '../../src/lib/business-core.js';
import { validBusinessMove } from '../../src/lib/business.ts';

test('Business preserves the original auction, trade and turn-limit rules while hiding its decks', async () => {
  const original = await import(
    pathToFileURL(resolve('../games/business-engine.js')).href
  );
  let a = createBusiness(3, { turnLimit: 1 }, () => 0.25);
  let b = original.createBusiness(3, { turnLimit: 1 }, () => 0.25);
  assert.deepEqual(a, b);
  const steps: [number, BusinessAction][] = [
    [
      0,
      {
        type: 'offer',
        to: 1,
        offered: [],
        wanted: [],
        cashOut: 10,
        cashIn: 0,
        cardsOut: 0,
        cardsIn: 0,
      },
    ],
    [1, { type: 'accept' }],
    [0, { type: 'roll', dice: [1, 2] }],
    [0, { type: 'decline' }],
    [0, { type: 'bid', amount: 25 }],
    [1, { type: 'bid', amount: 40 }],
    [2, { type: 'pass' }],
    [0, { type: 'pass' }],
    [0, { type: 'end' }],
  ];
  for (const [seat, action] of steps) {
    a = actBusiness(a, action, seat, () => 0.25);
    b = original.actBusiness(b, action, seat, () => 0.25);
    assert.deepEqual(a, b, action.type);
  }
  assert.equal(a.phase, 'win');
  assert.equal(a.deeds[3].owner, 1);
  const view = publicBusiness(a);
  assert.equal('decks' in view, false);
  assert.equal(validBusiness(view, null, { publicView: true }), true);
  assert.equal(validBusiness(view), false);
  assert.equal(validBusinessMove({ type: 'roll', dice: [6, 6] }), false);
  assert.equal(validBusinessMove({ type: 'roll' }), true);
});
