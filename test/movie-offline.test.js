import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('service-worker upgrades preserve all movie partitions and offline index fallback', async () => {
  const origin = 'https://arcade.test/';
  const key = url => new URL(typeof url === 'string' ? url : url.url ?? url.href, origin).href;
  const buckets = new Map();
  const handlers = new Map();
  let index = JSON.parse(await readFile(new URL('../data/movies/index.json', import.meta.url), 'utf8'));
  let offline = false;
  const fetcher = async url => {
    if (offline) throw new Error('Offline test');
    const path = new URL(key(url)).pathname;
    if (path.endsWith('/index.json')) return new Response(JSON.stringify(index));
    return new Response('fixture partition');
  };
  const caches = {
    async open(name) {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const bucket = buckets.get(name);
      return {
        async match(url) { return bucket.get(key(url))?.clone(); },
        async put(url, response) { bucket.set(key(url), response.clone()); },
        async add(url) { bucket.set(key(url), await fetcher(url)); },
        async addAll() {},
        async keys() { return [...bucket.keys()].map(url => ({ url })); },
        async delete(url) { return bucket.delete(key(url)); },
      };
    },
    async match(url) {
      for (const bucket of buckets.values()) {
        if (bucket.has(key(url))) return bucket.get(key(url)).clone();
      }
    },
    async keys() { return [...buckets.keys()]; },
    async delete(name) { buckets.delete(name); },
  };
  const old = await caches.open('arcade:static:previous');
  for (const file of index.files) await old.put(`data/movies/${file.path}`, new Response('prior cached partition'));
  await caches.open('other-app:v1');
  const self = {
    location: new URL('sw.js', origin), clients: { async claim() {} }, async skipWaiting() {},
    addEventListener(type, handler) { handlers.set(type, handler); },
  };
  vm.runInNewContext(await readFile(new URL('../sw.js', import.meta.url), 'utf8'),
    { self, caches, URL, fetch: fetcher, console });
  let completion;
  handlers.get('install')({ waitUntil(promise) { completion = promise; } });
  await completion;
  handlers.get('activate')({ waitUntil(promise) { completion = promise; } });
  await completion;
  assert.ok(!buckets.has('arcade:static:previous'));
  assert.ok(buckets.has('other-app:v1'), 'activation must preserve other apps caches on the origin');
  offline = true;
  let response;
  handlers.get('fetch')({
    request: { url: `${origin}data/movies/index.json`, method: 'GET', mode: 'cors' },
    respondWith(promise) { response = promise; },
  });
  assert.equal((await (await response).json()).records, index.records);
  for (const file of index.files) {
    assert.ok(await caches.match(`data/movies/${file.path}`), 'Upgrade must copy partitions before deleting old cache');
  }

  const refreshedIndex = { ...index, files: [{ path: 'new-catalog-hash.jsonl' }] };
  index = refreshedIndex;
  offline = false;
  handlers.get('fetch')({
    request: { url: `${origin}data/movies/index.json`, method: 'GET', mode: 'cors' },
    respondWith(promise) { response = promise; },
  });
  await response;
  const runtime = buckets.get([...buckets.keys()].find(name => name.startsWith('arcade:runtime:')));
  assert.ok(runtime.has(key('data/movies/new-catalog-hash.jsonl')));
  for (const file of JSON.parse(await (await runtime.get(key('data/movies/index.json'))).clone().text()).files) {
    assert.ok(runtime.has(key(`data/movies/${file.path}`)));
  }
  assert.equal([...runtime.keys()].some(url =>
    new URL(url).pathname.startsWith('/data/movies/') && url.endsWith('.jsonl') &&
    url !== key('data/movies/new-catalog-hash.jsonl')), false,
  'refresh must remove obsolete partitions from the runtime cache');

  offline = true;
  handlers.get('fetch')({
    request: { url: `${origin}data/movies/index.json`, method: 'GET', mode: 'cors' },
    respondWith(promise) { response = promise; },
  });
  assert.deepEqual((await (await response).json()).files, refreshedIndex.files,
    'offline fallback must prefer the refreshed runtime index over the old precache');
});
