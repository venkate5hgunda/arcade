import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const manifest = read('docs/redesign/parity.json');
const snapshot = read('docs/redesign/source-snapshot.json');
test('every feature has unique identity, existing evidence and explicit acceptance', () => {
  assert.equal(
    new Set(manifest.requirements.map((r) => r.id)).size,
    manifest.requirements.length,
  );
  for (const entry of manifest.requirements) {
    assert.equal(entry.status, 'planned');
    assert.ok(entry.acceptance.length);
    assert.ok(entry.sources.length);
    for (const p of [...entry.sources, ...entry.baselineTests])
      assert.ok(existsSync(resolve(root, p)), `${entry.id}: ${p}`);
  }
});
test('frozen source inventory is anchored to the actual baseline commit', () => {
  assert.equal(manifest.baselineCommit, snapshot.baselineCommit);
  for (const file of snapshot.files) {
    const bytes = execFileSync(
      'git',
      ['show', `${snapshot.baselineCommit}:${file.path}`],
      { cwd: root, maxBuffer: 16 * 1024 * 1024 },
    );
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      file.sha256,
      file.path,
    );
  }
});
test('all local documentation links resolve', () => {
  for (const name of [
    'README.md',
    'requirements.md',
    'architecture.md',
    'migration.md',
    'verification.md',
  ]) {
    const path = resolve(root, 'docs/redesign', name);
    const body = readFileSync(path, 'utf8');
    for (const match of body.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      assert.ok(
        existsSync(resolve(dirname(path), target)),
        `${name}: ${target}`,
      );
    }
  }
});

test('every production game is mapped to a dedicated parity requirement', async () => {
  const { GAMES } = await import('../../js/game-catalog.js');
  for (const game of GAMES)
    assert.ok(
      manifest.requirements.some((r) =>
        r.sources.includes(`games/${game.id}.js`),
      ),
      game.id,
    );
  assert.equal(
    manifest.requirements.filter((r) => r.id.startsWith('G')).length,
    GAMES.length,
  );
});
