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

## 2026-09-24 — Complete Overhaul: bug fixes, 6 new games, homepage redesign

The UI was broken and no game worked as expected. This pass root-caused every
bug, rebuilt the setup-flow architecture, gave every game its own visual
identity, added 6 new games (including a from-scratch legal-move chess
engine), and redesigned the home screen.

### Root-cause bugs fixed
- **`wireBack()` crashed every game's render.** It referenced a stale
  `document.querySelector` instead of the passed-in container, throwing on
  mount for every single game.
- **Global flexbox layout bug** in the shared shell broke sizing for nearly
  every game's board/canvas — the game stage wasn't constrained, so canvases
  and grids rendered at collapsed or runaway sizes.
- **Router double-render race**: rapid navigation (or a slow dynamic
  `import()`) could mount two game instances into the same stage. Fixed with
  a `navToken` guard so only the latest navigation's render wins.
- **Blank/missing emoji icons** across the catalog grid (encoding issue) and
  **missing PWA icons** (`manifest.json` pointed at files that didn't exist).
- **CSS class collisions** between unrelated games (e.g. two games both using
  `.card` with conflicting rules) caused visual bleed-through.
- **Broken service worker paths** — `sw.js` cached the wrong asset paths,
  so the offline shell silently failed to update.
- **Wrong imports** in several game modules (copy-paste leftovers from a
  different game's helper functions).
- **Dumb Charades' visible countdown never updated** — `startTimer()` was
  mutating a dead, unused element instead of the one actually shown to
  the player.
- **Imposter had no setup screen** — player count was hardcoded and
  unreachable; sound/haptics were never wired into reveal/vote/result.

### Architecture changes
- **Every game now opens with a `renderSetup()` step** (players, difficulty,
  mode, timer, etc.) before play starts, instead of jumping straight into a
  hardcoded configuration. Choices persist per game via
  `loadJSON(KEYS.SETTINGS + ':<id>')`.
- **Per-game "vibe" theming** — each game layers its own accent-color CSS
  class (e.g. `.chess-vibe`, `.imp-vibe`) on the shared shell so the arcade
  doesn't read as one reskinned template.
- **Recently Played** — `js/router.js` now tracks the last 6 distinct games
  played (`KEYS.RECENT_GAMES`, most-recent-first, deduped) and the landing
  page surfaces them in a dedicated row above the full catalog
  (`renderGameList()` shared between both grids).
- **New joystick logo/favicon** — replaced the old placeholder mark with a
  custom badge design.

### Games added (6)
1. **Chess** (`games/chess.js`) — full legal-move engine built from scratch:
   pseudo-legal generation for all pieces, check detection via
   `isSquareAttacked`, full legality filtering (simulate + king-safety),
   castling (with transit-square-safety checks), en passant, pawn promotion
   (interactive picker), checkmate/stalemate detection, insufficient-material
   draws, and a heuristic AI opponent (material/check/center-square scoring +
   randomization). Board flips per-move in pass-and-play so it's always shown
   from the mover's perspective. Does not implement draw-by-repetition or the
   50-move rule (deliberate scope limit).
2. **Rock Paper Scissors** (`games/rps.js`) — vs. computer or 2P pass-and-play,
   best-of-N.
3. **2048** (`games/2048.js`) — slide/merge/rotate logic, keyboard + touch-swipe
   input, score/best-score persistence, win/game-over detection.
4. **Simon Says** (`games/simon.js`) — color-sequence memory game, increasing
   sequence length, speed setting, high-score persistence.
5. **Word Scramble** (`games/word-scramble.js`) — unscramble a typed-input
   word, hint/skip actions, round-based scoring.
6. **Whack-a-Mole** (`games/whack-a-mole.js`) — 3×3 reflex-tap game, timed
   rounds, score/miss tracking, high-score persistence.

### Verification
Every game (10 original + 6 new) was hard-reload-tested end to end in a real
browser: setup flow, at least one full gameplay loop per mode, win/lose/draw
detection, and a zero-console-errors check, at both desktop and 390px mobile
widths and in both themes.

### Scope decisions (see `README.md` "Scope notes")
- "Saving game states" = per-game settings persistence + Recently Played,
  not full mid-game board serialization.
- Chess omits draw-by-repetition/50-move-rule detection.

### Files added
- `games/chess.js`, `games/rps.js`, `games/2048.js`, `games/simon.js`,
  `games/word-scramble.js`, `games/whack-a-mole.js`
- `.gitignore`

### Files modified
- `js/game-catalog.js` (6 new entries), `js/router.js` (recently-played +
  shared `renderGameList()`), `js/storage.js` (`KEYS.RECENT_GAMES`),
  `js/game-shell.js`, `js/game-utils.js`, `css/styles.css` (structural + vibe
  CSS for all 16 games, recent-games section), `assets/favicon.svg`,
  `assets/logo.svg`, `index.html`, `sw.js`, and every original game module
  (setup flows, vibe theming, bug fixes).
