import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  newMafia,
  validMafia,
  pending,
  actMafia,
  resolveMafia,
  viewFor,
  validMafiaView,
} from '../../src/lib/mafia.ts';
test('Mafia roles, actions, private views and resolution match the original engine', async () => {
  const old = await import(
    pathToFileURL(resolve('../games/mafia-engine.js')).href
  );
  for (let count = 5; count <= 10; count++) {
    let s = newMafia(count, () => 0.5),
      previous = old.newMafia(count, () => 0.5);
    assert.deepEqual(s, previous);
    assert.equal(validMafia(s, count), old.validMafia(previous, count));
    while (pending(s).length) {
      const actor = pending(s)[0],
        target = (actor + 1) % count,
        request = { type: 'mafia-act', revision: s.revision, target };
      s = actMafia(s, request, actor);
      previous = old.actMafia(previous, request, actor);
      assert.deepEqual(s, previous);
    }
    s = resolveMafia(s, 0);
    previous = old.resolveMafia(previous, 0);
    assert.deepEqual(s, previous);
    for (let seat = 0; seat < count; seat++) {
      const view = viewFor(s, seat);
      assert.deepEqual(view, old.viewFor(previous, seat));
      assert.ok(validMafiaView(view, count, seat));
      assert.equal('roles' in JSON.parse(JSON.stringify(view)), false);
      assert.equal(
        validMafiaView({ ...view, secretRoles: s.roles }, count, seat),
        false,
      );
    }
  }
});
