# Copilot instructions

## Build, test, and run

This is a static HTML/CSS/JavaScript PWA with no dependency-install, bundling,
or build step. There is no configured linter.

- Run all JavaScript tests: `npm test`
- Run one JavaScript test file: `node --test test/game-session.test.js`
- Run all movie-pipeline tests: `npm run test:movies`
- Run one Python test: `python3 -m unittest test.test_movie_catalog.CatalogTests.test_lossless_idempotent_csv_and_export`
- Serve the app locally: `npm start` (or `python3 dev/serve.py`); open `http://localhost:8000`
- Rebuild the public movie catalog from the local store: `npm run movies:build`

Use the project server rather than a generic static server: it blocks `.env`,
hidden files, and development data from being served.

## Architecture

The browser app is served directly as ES modules. `index.html` loads
`js/app.js`, which initializes shared services and the router. `js/game-catalog.js`
is the registry and dynamic loader; `js/router.js` mounts one game at a time
and disposes the previous game. Each `games/<id>.js` module owns its rules and
rendering, while `js/game-shell.js` and focused modules under `js/` provide
shared UI, persistence, sound, and interaction helpers. CSS is linked globally
from `index.html` and grouped into shared and game/category stylesheets.

Local preferences and round checkpoints use namespaced JSON in `localStorage`
through `js/storage.js` and `js/game-session.js`. Each game validates its own
checkpoint before restoring it; session expiry is configured per game.

Room play is serverless WebRTC, coordinated by `js/multiplayer.js`. The host
owns authoritative room state and recovery checkpoints. Games with hidden
hands or decks must send seat-specific public/private views, not broadcast
their full state. Room messages and snapshots are checked by the shared
transport and game-specific validators.

The separate Python movie tooling in `dev/movies/` ingests and enriches an
authoritative local SQLite catalog, then exports reviewed/public prompt data
under `data/movies/` for the browser games. Development database, exports,
provider responses, and credentials live in `dev/movies/.local/` and must not
be exposed or committed; provider credentials belong in the ignored `.env`.

## Repository-specific conventions

- A game is registered in `js/game-catalog.js` and default-exports an async
  `render(el, game, context)` implementation. When adding one, keep its player
  limits, help text, resume expiry, tests, and offline assets/precache consistent;
  see `ARCHITECTURE.md` for the exact integration points.
- Keep game rules and checkpoint validation with the owning game. Shared
  modules are for genuinely reused mechanics, not a place to centralize
  unrelated game behavior.
- Treat persisted and room state as untrusted input. Preserve restore/reset
  behavior and validate room actor, round/revision, and seat-specific data.
  Room guests must never receive another player's private hand or deck order.
- Keep the game setup and secondary controls compact/collapsible, and keep
  the current player's next action clear. Check text and essential visual
  elements against WCAG 2.2 AA in both light and dark themes: at least 4.5:1
  for normal text, 3:1 for large text, and 3:1 for meaningful control/state
  graphics against adjacent colors. Check gradients and opacity against their
  actual rendered backgrounds. Use the shared theme system so colors switch
  appropriately with the selected mode. Keep controls keyboard-accessible with
  visible focus, and respect reduced motion, touch, and responsive layouts.
- Offline assets are listed in `sw.js`; when changing the precache, update the
  cache version so installed clients do not keep stale files.
- Movie source records are immutable and distinct from provider-enriched data.
  Preserve identity/evidence and annotation history in the catalog pipeline;
  do not publish raw private catalog data as game prompt exports. See
  `dev/movies/README.md` for its ingestion, matching, and export invariants.

For current state boundaries, game-specific recovery behavior, and known
platform constraints, consult `ARCHITECTURE.md`. User-facing behavior and run
instructions belong in `README.md`; historical decisions belong in
`CHANGELOG.md`.
