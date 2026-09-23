# Arcade Changelog

This file tracks every feature request, decision, and assumption made while
building Arcade, so no context is lost between sessions.

## 2026-09-22 — Foundation (v0.1.0)

### Decisions
- **Static PWA, no build step.** Pure HTML/CSS/JS, like the sibling `pick`
  app. Deploys directly; a `sw.js` provides offline caching.
- **Single shared `AudioContext`.** Created lazily on first user gesture and
  resumed for the session. All sound is synthesized (no external assets) so the
  PWA stays lightweight and works offline.
- **Single shared `localStorage` namespace** (`arcade:` prefix) for all
  persisted state. Tolerates private-browsing/quota errors via try/catch.
- **Theme = light / dark / auto.** Auto follows `prefers-color-scheme` but only
  while the user has not explicitly overridden it.
- **Router is hash-based** (`#/games/<id>`). Restores the last active game from
  storage on load; back button and deep links work.
- **Game catalog is the single source of truth.** Adding a game = one entry in
  `js/game-catalog.js` + one `games/<id>.js` module exporting `render(el, game)`.
  Unimplemented games render a friendly "Coming soon" screen.
- **Haptics via the Vibration API**, gated by a persisted toggle and no-op-ing
  gracefully when unsupported.

### Assumptions
- Local multiplayer only (no networking). The brief lists "single or double
  player" and "group games"; all games run on one device with people passing it
  around. Online multiplayer is out of scope for v0.x.
- Player identity is local only. Player names/high scores live in `localStorage`
  and are not synced anywhere.
- Sound is synthesized rather than recorded assets — keeps the app small and
  offline-capable.
- Games are mounted into `#game-stage` by the router; each game module owns its
  own canvas/DOM and is responsible for cleanup on unmount.

### Feature requests tracked (not yet built)
- All 10 catalogued games are placeholders until their `games/<id>.js` module
  is implemented. See `README.md` for the status table.

### Files added
- `index.html`, `manifest.json`, `sw.js`, `package.json`
- `css/styles.css`
- `js/app.js`, `js/storage.js`, `js/theme.js`, `js/audio.js`, `js/haptics.js`,
  `js/game-catalog.js`, `js/router.js`
- `assets/favicon.svg`, `assets/logo.svg`
- `README.md`, `CHANGELOG.md`

## 2026-09-23 — Game Implementations Complete

### Games Implemented (10/10)
All catalogued games are now fully implemented with polished UI, sound, haptics,
and theme-aware rendering:

1. **Tic-Tac-Toe** (`games/tictactoe.js`) — PvP + unbeatable AI (minimax), 3×3 grid
2. **Connect Four** (`games/connect-four.js`) — 6×7 gravity grid, 4-in-a-row win detection
3. **Minesweeper** (`games/minesweeper.js`) — 3 difficulties, flood-fill reveal, right-click flag
4. **Memory Match** (`games/memory.js`) — Configurable grid, 1-2 players, pair matching
5. **Hangman** (`games/hangman.js`) — Word guessing, on-screen keyboard, hangman figure
6. **Air Hockey** (`games/air-hockey.js`) — Canvas physics, touch/keyboard, 2-player
7. **Snakes & Ladders** (`games/snakes-ladders.js`) — 100-square board, animated dice, 2-4 players
8. **Ludo** (`games/ludo.js`) — Cross board, 4 tokens each, capture, home stretch
9. **Imposter** (`games/imposter.js`) — Social deduction, pass-and-play, discussion/vote phases
10. **Dumb Charades** (`games/dumb-charades.js`) — Team charades, timer, 2-8 players

### Core Fixes
- `game-utils.js`: Fixed `lineComplete` to treat 0/empty as falsy (was counting empty rows as wins)
- `game-shell.js`: Back button now uses `data-nav="back"` matching router listener
- All games: Wired `wireBack` for navigation, added aria-labels, sound/haptics on events

### Shared Infrastructure
- `js/game-shell.js`: Consistent chrome (back, title, meta, reset) + stage container
- `js/game-utils.js`: `nextPlayer`, `findWin`, `winLines`, `emptyBoard`
- `js/router.js`: Passes `navigate` to game modules for back-button wiring

### Files Added
- `games/air-hockey.js`, `games/snakes-ladders.js`, `games/ludo.js`,
  `games/imposter.js`, `games/dumb-charades.js`
- `js/game-shell.js`, `js/game-utils.js`
- Extensive CSS in `css/styles.css` for all game components
