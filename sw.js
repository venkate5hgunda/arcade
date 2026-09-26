// Arcade PWA service worker — offline-first with runtime caching.
// KISS: a single static cache plus a generic runtime cache for same-origin
// fetches. Network-first for JSON so preferences always try to stay fresh.

const STATIC_CACHE = 'arcade:static:v44';
const RUNTIME_CACHE = 'arcade:runtime:v44';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './css/board-games.css',
  './css/catan.css',
  './css/physical-games.css',
  './css/card-games.css',
  './css/multiplayer.css',
  './js/app.js',
  './js/storage.js',
  './js/theme.js',
  './js/audio.js',
  './js/haptics.js',
  './js/router.js',
  './js/game-session.js',
  './js/game-catalog.js',
  './js/icons.js',
  './js/game-shell.js',
  './js/game-help.js',
  './js/card-room-entry.js',
  './js/player-names.js',
  './js/turn-indicator.js',
  './js/celebration.js',
  './js/party-prompts.js',
  './js/game-utils.js',
  './js/dice.js',
  './js/board-tokens.js',
  './js/snakes-board.js',
  './js/disc-physics.js',
  './js/remote-match.js',
  './js/multiplayer.js',
  './js/room-qr.js',
  './js/vendor/qrcode.mjs',
  './js/vendor/qr-scanner.min.js',
  './js/vendor/qr-scanner-worker.min.js',
  ...[
    '2048', 'air-hockey', 'blackjack', 'chess', 'connect-four', 'crazy-eights',
    'catan', 'catan-art', 'dumb-charades', 'hangman', 'imposter', 'ludo', 'memory', 'minesweeper', 'uno',
    'pool', 'rps', 'simon', 'snakes-ladders', 'tictactoe', 'whack-a-mole',
    'word-scramble',
  ].map((id) => `./games/${id}.js`),
  './assets/favicon.svg',
  './assets/logo.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  ...[
    'hockey', 'eight-ball', 'mole', 'snake', 'rolling-dice-cup', 'island',
    'chess-knight', 'spy', 'drama-masks', 'card-ace-spades', 'card-8-spades',
    'card-joker', 'tic-tac-toe', 'minefield',
  ].map((name) => `./assets/icons/game-icons/${name}.svg`),
  ...[
    'hand-rock', 'circles-filled', 'cards-filled', 'number-123', 'color-swatch',
    'abc', 'sort-ascending-letters', 'layout-grid', 'bolt', 'chess', 'cards',
    'confetti', 'puzzle', 'history', 'arrow-left', 'arrow-right', 'refresh',
    'info-circle', 'users', 'volume-2', 'device-mobile-vibration', 'pencil',
    'sun', 'moon',
  ].map((name) => `./assets/icons/tabler/${name}.svg`)
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // HTML navigation: network-first so the latest shell loads, fall back offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || !response.ok) return response;
          const clone = response.clone();
          event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)));
          return response;
        })
        .catch((error) => {
          console.error('Offline asset unavailable:', request.url, error);
          throw error;
        });
    })
  );
});
