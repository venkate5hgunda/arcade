import { runInNewContext } from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { buildOfflineAssets } from '../../scripts/pwa.ts';
test('offline graph includes every built asset, verifies content and changes version with assets or worker code', () => {
  const base = 'node_modules/.cache/pwa-unit';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, 'graph-'));
  try {
    mkdirSync(join(dir, 'data', 'movies'), { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<html>Arcade</html>');
    writeFileSync(join(dir, 'data', 'movies', 'index.json'), '{}');
    const worker = 'const BUILD = __ARCADE_BUILD__;';
    const first = buildOfflineAssets(dir, worker);
    assert.deepEqual(
      first.assets.map((a) => a.path),
      ['data/movies/index.json', 'index.html'],
    );
    assert.ok(first.assets.every((a) => /^[a-f0-9]{64}$/.test(a.sha256)));
    assert.equal(buildOfflineAssets(dir, worker).version, first.version);
    writeFileSync(join(dir, 'index.html'), '<html>Arcade updated</html>');
    const second = buildOfflineAssets(dir, worker);
    assert.notEqual(second.version, first.version);
    assert.notEqual(
      buildOfflineAssets(dir, worker + '// fixed worker').version,
      second.version,
    );
    assert.ok(
      readFileSync(join(dir, 'arcade-sw.js'), 'utf8').includes(
        'offline-assets.json',
      ),
    );
    assert.ok(
      !readFileSync(join(dir, 'arcade-sw.js'), 'utf8').includes(
        '__ARCADE_BUILD__',
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a real worker install failure deletes only its incomplete cache and never activates it', async () => {
  const source = readFileSync('scripts/service-worker.js', 'utf8');
  const body = 'verified asset';
  const build = {
    version: 'quota-test',
    assets: [
      {
        path: 'index.html',
        sha256: createHash('sha256').update(body).digest('hex'),
      },
    ],
  };
  const handlers = new Map<
    string,
    (event: { waitUntil: (promise: Promise<unknown>) => void }) => void
  >();
  const deleted: string[] = [];
  let activated = false;
  runInNewContext(source.replace('__ARCADE_BUILD__', JSON.stringify(build)), {
    self: {
      registration: { scope: 'https://arcade.test/preview/' },
      addEventListener: (
        name: string,
        handler: (event: {
          waitUntil: (promise: Promise<unknown>) => void;
        }) => void,
      ) => handlers.set(name, handler),
      skipWaiting: () => {
        activated = true;
      },
    },
    URL,
    Response,
    crypto: webcrypto,
    fetch: async () => new Response(body),
    caches: {
      open: async () => ({
        put: async () => {
          throw new DOMException('Full', 'QuotaExceededError');
        },
      }),
      delete: async (name: string) => {
        deleted.push(name);
        return true;
      },
    },
  });
  let installation: Promise<unknown> | undefined;
  handlers.get('install')!({
    waitUntil: (promise) => {
      installation = promise;
    },
  });
  await assert.rejects(installation!, /Offline download incomplete/);
  assert.deepEqual(deleted, [
    'arcade-redesign:https%3A%2F%2Farcade.test%2Fpreview%2F:quota-test',
  ]);
  assert.equal(activated, false);
});
