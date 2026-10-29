/* Generated with a verified, complete asset graph. Never shares caches across app scopes. */
const BUILD = __ARCADE_BUILD__;
const PREFIX = `arcade-redesign:${encodeURIComponent(self.registration.scope)}:`;
const CACHE = PREFIX + BUILD.version;
const ROOT = new URL(self.registration.scope);
const INDEX = new URL('index.html', ROOT).href;
const COMPLETE = new URL('.arcade-offline-complete', ROOT).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        const results = await Promise.allSettled(
          BUILD.assets.map(async (asset) => {
            const url = new URL(asset.path, ROOT).href;
            const response = await fetch(url, { cache: 'reload' });
            if (!response.ok || response.type === 'opaque')
              throw Error('Offline asset unavailable.');
            const bytes = await response.clone().arrayBuffer();
            const digest = await crypto.subtle.digest('SHA-256', bytes);
            const hash = Array.from(new Uint8Array(digest), (byte) =>
              byte.toString(16).padStart(2, '0'),
            ).join('');
            if (hash !== asset.sha256)
              throw Error('Offline assets changed during download.');
            await cache.put(url, response);
          }),
        );
        if (results.some((result) => result.status === 'rejected'))
          throw Error('Offline download incomplete.');
        await cache.put(COMPLETE, new Response(BUILD.version));
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const previous = (await caches.keys()).filter(
        (key) => key.startsWith(PREFIX) && key !== CACHE,
      );
      const complete = [];
      for (const key of previous)
        if (await (await caches.open(key)).match(COMPLETE)) complete.push(key);
      // A killed installation may leave an orphan cache; retain only a verified previous release.
      const keep = complete.at(-1);
      await Promise.all(
        previous.filter((key) => key !== keep).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE') void self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== ROOT.origin ||
    !url.pathname.startsWith(ROOT.pathname)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (request.mode === 'navigate')
        return (
          (await cache.match(INDEX, { ignoreVary: true })) ?? fetch(request)
        );
      // Only build-hash-verified static assets live here; Origin-varying CORS headers do not change their bytes.
      const cached = await cache.match(request, { ignoreVary: true });
      if (cached) return cached;
      const previous = (await caches.keys()).filter(
        (key) => key.startsWith(PREFIX) && key !== CACHE,
      );
      for (const key of previous.reverse()) {
        const old = await caches.open(key);
        if (!(await old.match(COMPLETE))) continue;
        const response = await old.match(request, { ignoreVary: true });
        if (response) return response;
      }
      return fetch(request);
    })(),
  );
});
