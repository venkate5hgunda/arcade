import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateStorage, validBackup } from '../../src/lib/migration.ts';
import { KEYS, protectStorage, saveJSON } from '../../src/lib/storage.ts';
import { GAMES } from '../../src/lib/games.ts';
const values = new Map<string, string>();
let fail = false;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (fail) throw new DOMException('Full', 'QuotaExceededError');
      values.set(key, value);
    },
    removeItem: (key: string) => values.delete(key),
  },
});
test('version migration backs up all 26 opaque checkpoint values without transforming legacy envelopes, settings or invalid JSON', () => {
  values.clear();
  protectStorage(null);
  fail = false;
  const entries = Object.fromEntries(
    GAMES.map((game, index) => [
      game.id,
      {
        state: { legacyGame: game.id, over: index % 2 === 0 },
        savedAt: 123456,
      },
    ]),
  );
  values.set('arcade:game.sessions', JSON.stringify(entries));
  values.set('arcade:game.settings:uno', '{"count":"20"}');
  values.set('arcade:ui.theme', '"dark"');
  values.set(
    'arcade:scores.highScores:2048',
    'invalid JSON preserved verbatim',
  );
  values.set('other-app:data', 'never copied');
  const before = new Map(values);
  assert.equal(migrateStorage(), 'migrated');
  for (const [key, value] of before) assert.equal(values.get(key), value);
  const backup = JSON.parse(values.get('arcade:' + KEYS.LEGACY_BACKUP)!);
  assert.ok(validBackup(backup));
  assert.equal(backup.values['other-app:data'], undefined);
  assert.equal(backup.values['arcade:game.sessions'], JSON.stringify(entries));
  assert.equal(
    backup.values['arcade:scores.highScores:2048'],
    'invalid JSON preserved verbatim',
  );
  const original = values.get('arcade:' + KEYS.LEGACY_BACKUP);
  assert.equal(migrateStorage(), 'current');
  assert.equal(values.get('arcade:' + KEYS.LEGACY_BACKUP), original);
});
test('future or corrupt versions and failed backup writes protect existing data while allowing an in-memory app', () => {
  values.clear();
  protectStorage(null);
  fail = false;
  values.set('arcade:' + KEYS.STORAGE_VERSION, '999');
  assert.equal(migrateStorage(), 'protected');
  assert.equal(saveJSON(KEYS.THEME, 'light'), false);
  assert.equal(values.get('arcade:' + KEYS.STORAGE_VERSION), '999');
  values.clear();
  fail = true;
  assert.equal(migrateStorage(), 'protected');
  assert.equal(values.has('arcade:' + KEYS.STORAGE_VERSION), false);
  assert.equal(values.has('arcade:' + KEYS.LEGACY_BACKUP), false);
  fail = false;
  assert.equal(migrateStorage(), 'migrated');
  assert.equal(saveJSON(KEYS.THEME, 'light'), true);
  values.set('arcade:' + KEYS.STORAGE_VERSION, 'broken');
  assert.equal(migrateStorage(), 'protected');
  protectStorage(null);
});

test('a corrupt previous backup never authorizes a migration marker', () => {
  values.clear();
  fail = false;
  protectStorage(null);
  values.set(
    'arcade:' + KEYS.LEGACY_BACKUP,
    '{"version":0,"createdAt":1,"values":{"other-app:data":"private"}}',
  );
  const before = new Map(values);
  assert.equal(migrateStorage(), 'protected');
  assert.deepEqual(values, before);
  protectStorage(null);
});
