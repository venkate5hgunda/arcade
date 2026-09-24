# Arcade Changelog

This file tracks every feature request, decision, and assumption made while
building Arcade, so no context is lost between sessions.

## 2026-09-24 — Room invitations and QR sharing

- Register guests before applying an answer so an early WebRTC hello cannot
  be rejected. Distinguish admission from connection and warn on either device
  when a direct connection fails, drops or remains unestablished.
- Both invite and answer URLs can be shared as locally generated QR codes or
  copied as links. Optional camera scanning fills either link in the lobby;
  the host scans answers in the original tab. QR capacity, camera permission
  and browser support failures retain a copy/paste path. Offline cache v29.

## 2026-09-24 — Live card tables and private rooms

- UNO-inspired and Crazy Eights now open with a private-room invitation
  instead of assuming everyone shares one phone. Local pass-and-play remains
  an explicit offline option. Crazy Eights now supports two remote seats with
  host-validated actions, private per-player hands, wild suit choices,
  reconnect synchronization, and room standings.
- Gave the card tables original, colorful artwork, clearer active seats,
  responsive card faces and richer felt-table styling without copying a
  commercial deck or logo. Blackjack remains a solo dealer game.
- UNO-inspired now handles a missed one-card callout (+2 catch) and challenges
  to a wild +4, with host-verified penalties for bluffs and failed challenges.
- Precached the card-room entry module and refreshed offline styles in v28.

## 2026-09-24 — Board game table and movement

- Snakes & Ladders and Ludo have larger, shape-coded player pieces and named
  roster cards, with square numbers above board artwork. The generated snakes
  and ladders keep their drawn paths apart; snakes have scaled bodies, shaped
  heads, forked tongues and tapered, moving tails. Tokens follow each square
  and animate climbs, slides, and captures. Snakes hiss within three squares;
  ladders wobble nearby. Motion respects reduced-motion settings. Offline
  cache v25 includes the shared token module and final board styling.

## 2026-09-24 — Momentum-based Air Hockey

- Paddle motion now has bounded acceleration, while both faceoffs and
  post-goal serves transfer speed based on the paddle's velocity along the
  contact normal. Gentle and hard strikes produce different puck speeds,
  angled hits deflect accordingly, and low-friction travel decelerates
  naturally rather than receiving a hidden minimum-speed boost. A motion
  trail shows puck momentum. Offline cache v23.

## 2026-09-24 — Stationary opening faceoff

- Air Hockey now parks the opening puck at center until a paddle hits it,
  including after a reset or checkpoint restore. Either player can open play;
  post-goal possession and manual serves remain unchanged. Offline cache v21.

## 2026-09-24 — Help, movement, victories and room standings

- Every game has a shared How to play dialog with illustrated steps, controls,
  options and a goal. 2048 now animates tile movement before revealing merges
  and the new spawn; Tic-Tac-Toe, Connect Four and Memory animate only the
  newly changed piece or card. Motion respects reduced-motion preferences.
- Shared victory confetti, sound and haptics announce solo achievements and
  named local or room winners. Local players can save their names in the game
  header; room seats use the names from the lobby.
- Room standings record completed rounds for all seven remote games and
  display per-player and per-game results and rankings across games for the
  lifetime of the room. The host owns the results; guests receive updates.
- Solo campaigns remain a future enhancement. Updated the offline cache to v20
  for the new shared modules.

## 2026-09-24 — Chess piece clarity on phones

- Replaced platform-dependent chess font glyphs with matching, hand-drawn SVG
  silhouettes for both sides, with sculpted contours, collars, engraved
  details, and a distinct horse-head knight. Consistent ivory/ink fills and contrast
  outlines on both square colors. Captured pieces and promotion choices use
  the same artwork; board buttons announce piece color and type.
- Reduced the chess-only mobile frame and board borders so the board and pieces
  occupy more of a 320px screen, and updated the offline cache to v17.

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

## 2026-09-24 — Arcade room and tabletop pass

- Replaced the flat background with layered ambient lighting, cabinet-like
  game cards and richer surfaces that work in both themes.
- Adapted Pick's fixed-step, bouncing, tumbling six-sided die and 3D pip
  rendering for Ludo and Snakes & Ladders (self-contained, works offline).
- Snakes & Ladders now illustrates colored snake heads, bodies and tails, and
  full ladders, with varying endpoints and lengths for each new board. Every
  number has a high-contrast badge above the artwork, including at phone sizes.
- Ludo now has a full cross-shaped board, a 52-square shared track, four
  colored yards and separate home lanes. Players choose among movable tokens,
  with safe squares, captures, sixes and exact rolls to finish.
- Added a reusable fixed-step disc simulation with friction, elastic
  collision resolution, rail rebounds and pocket callbacks. Air Hockey now
  uses physical paddle–puck collisions and responsive local two-player input.
  Added an 8-Ball Pool table with cue aiming, power, racking and house rules.
- Added a Cards category with Blackjack and two-player Crazy Eights, including
  private pass-the-device handoffs for hidden hands.
- Rock Paper Scissors now plays a countdown and animated opponent-hand throw
  before revealing either side, and Minesweeper has mobile flag mode.
- Reworked the header as an arcade marquee with colored tactile controls,
  legible connected/off states, keyboard-focus rings and a dedicated room icon;
  sound and theme now display only the icon for their actual state.
- Fixed the previously unregistered service worker: `js/app.js` now installs
  it, and all current game modules, styles and helper modules are precached
  so games not yet visited still launch offline after installation.
- Added a persistent WebRTC room with manual invite/answer URLs, Web Share /
  clipboard fallback, per-guest peer connections, host-controlled admission,
  seat selection and game switching without rebuilding the room. Remote play
  currently supports Tic-Tac-Toe, Connect Four, Chess, RPS, Ludo and
  Snakes & Ladders; the lobby explicitly labels remaining games local-only.
  Hosts generate dice outcomes; the board layout is seeded and synchronized.
  Remote networking still needs internet/STUN and may fail without TURN;
  installed assets remain playable offline in local modes.

## 2026-09-24 — Intentional return and game-state memory

- Fresh visits and old game bookmarks open the home screen; only a recent
  unfinished local round automatically resumes. Per-game inactivity limits
  reflect the pace of play, from short reflex games to longer chess matches.
  Expired checkpoints are removed without deleting preferences or high scores.
- Every local game checkpoints its playable state and resumes without replaying
  setup; completed games no longer trigger automatic navigation on next visit.
  Online rooms remain ephemeral rather than pretending a closed WebRTC tab
  can resume its connection.
- Fixed genre filtering: clicking a category previously bubbled into the card
  handler, which mistook the stage container for a game card and replaced the
  filtered grid. Category buttons now update the selected tab and visible games.
- Chess now uses matching silhouettes for both sets, with contrasting enamel
  colors and edging so the sides remain distinguishable.

## 2026-09-24 — Faster physical play, party prompts and cards

- Air Hockey now parks the puck on the side opposite the scorer until that
  player strikes it. The speed floor no longer restarts a parked puck. Touch
  dragging has a faster paddle path while keyboard speed stays predictable.
- Game buttons provide immediate press feedback; collision and goal haptics,
  reused impact audio buffers, and a corrected sound-toggle volume reduce
  latency and keep effects working after unmuting. Ludo automatically moves a
  token when a roll leaves only one legal choice, locally and in rooms.
- Dumb Charades and Imposter now choose between their original prompts and
  Telugu movies. Four sourced post-2000 films provide original short
  storylines, year and cast after the reveal; expanding to all Telugu releases
  needs the provenance, coverage and editorial review described in README.
- Added offline local and host-authoritative room play for UNO-inspired cards.
  Remote guests see only their own hands; the host validates actions and
  distributes private updates. The simplified house rules are documented.
- Bumped the offline cache to v15 for new modules and refreshed game assets.
