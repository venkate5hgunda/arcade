# Arcade architecture and maintenance map

Last reviewed: 2026-10-04. This is the **current-state reference**,
not a design proposal. Update it when a game's rules, persistence contract,
room protocol, platform support, or an open issue changes. `README.md` explains
how to play; `CHANGELOG.md` records historical decisions. Paths and named
functions below are the sources of truth when this document becomes stale.

## System at a glance

Arcade is a static, offline-capable HTML/CSS/ES-module app with no build step
or application server (`index.html`, `package.json`). One route and game are
mounted at a time:

```text
index.html -> js/app.js -> js/router.js -> js/game-catalog.js
                                 |                 |
                                 |                 -> games/<id>.js
                                 |                        |
                                 -> js/game-session.js      -> js/game-shell.js
                                           |                -> shared UI/engines
                                           -> js/storage.js

header Room -> js/multiplayer.js <-> WebRTC peer(s)
                    |                     |
                    -> host room checkpoint -> game-owned actions/private views

sw.js precaches shell, modules, styles and local artwork for offline local play.
```

`js/app.js` initializes theme, sound, haptics, router and the room, then
registers `sw.js`. `js/game-catalog.js` owns the 22 catalog entries, player
bounds, category metadata and dynamic module lookup. `js/router.js` handles
`#/games/<id>`, browser history, recent games, the landing/resume view and
superseded asynchronous navigations (`navToken`). It disposes the previous
game and stops its session before mounting the next one. A direct game URL
opens that game, even without a saved round; a home URL stays home even
when unfinished local rounds exist (`js/router.js:initialGameFromHash`,
`js/router.js:initRouter`). The older `ACTIVE_GAME` key is removed on startup.

Each `games/<id>.js` default-exports `render(el, game, context)`; `context`
provides navigation, a local session and (where applicable) multiplayer.
`js/game-shell.js` supplies the common header, setup, reset and help affordances;
`js/game-help.js` holds per-game instructions; `js/player-names.js`,
`js/turn-indicator.js` and `js/celebration.js` provide shared presentation.
Game-specific renderers, rules and checkpoint validators remain inside game
modules. `css/styles.css` has the shell/theme; `css/board-games.css`,
`css/card-games.css`, `css/physical-games.css`, `css/catan.css`, `css/business.css` and
`css/multiplayer.css` style their respective tables and lobby. All are linked
from `index.html`, not loaded per route.

## State, restoration and authority

**Local games.** `js/storage.js` namespaces JSON under `arcade:` in
`localStorage` (preferences, names, settings, recent games and sessions).
`js/game-session.js` supplies `session.save`, `finish`, `stop`, inactivity
expiry and `unfinishedGames` for the home resume banner. Expiry ranges from
two minutes (Whack-a-Mole) to 240 minutes (Business); the exact
per-game windows are in `js/game-session.js` and `README.md`. A renderer
validates its own `session.state` before restoring; an expired or malformed
session is discarded. Reset/reload must preserve intended settings while
not resurrecting finished rounds. Whack-a-Mole also uses its actual deadline,
not just the general inactivity window.

**Rooms.** `js/multiplayer.js` is a serverless WebRTC room with one host and
individually connected guests. The two-link offer/answer exchange uses pasted
URLs or local QR generation/scanning (`js/room-qr.js` and a vendored local QR
scanner). The host admits peers, chooses seats, validates incoming messages,
owns the roster, game selection, rounds and standings, and distributes game
updates. Games use `js/remote-match.js` to identify room/seat context. Only
the host persists the authoritative room/game checkpoint in **per-tab
`sessionStorage`**; guests do not restore authoritative hands or decks.
After a host reload the lobby/round can be restored, but **WebRTC channels
cannot**: guests exchange fresh invitations/answers for their previous seats.
Gameplay pauses until selected seats reconnect. Transient WebRTC disconnects
have a recovery window before manual re-invitation is needed
(`js/multiplayer.js`, `test/multiplayer.test.js`).

Ten games support rooms: Business, Chess, Connect Four, Crazy Eights, Island Charter,
Ludo, Rock Paper Scissors, Snakes & Ladders, Tic-Tac-Toe and UNO-inspired.
Public-board games synchronize actions or host snapshots. Island Charter,
Crazy Eights and UNO-inspired keep the deck/hidden hands on the host and send
**per-seat private views**. Their move request revision, actor authorization
and recipient checks are game-specific; never replace a private view with a
broadcast full state. A guest rejoining mid-round needs a host sync, not a
new random board/deck. Game-specific `validCheckpoint`/view validators protect
local restore and room recovery, but saved-state formats are not centrally
versioned (`games/catan.js`, `games/crazy-eights.js`, `games/uno.js`,
`test/multiplayer.test.js`).
Business also uses private host snapshots: `games/business-engine.js` owns
rules, decks and checkpoint validation; `games/business.js` sends **public
views without deck order** to each selected room seat and accepts revision-
and round-checked host-authorized requests, including non-turn auction and
trade responders. Eliminated seats need not remain connected; surviving
disconnections pause the table. Room backup holds only the host checkpoint.
`games/business.js:applyRemoteBusinessAction` validates the actual
`bs-request` transport envelope, including its type, revision and round;
`validBusinessSnapshot` compares revision only *within the same round*.
The board and inspector use original local `assets/business/*.svg` artwork
and CSS in `css/business.css`. The inspector reads the public state only;
tap-to-inspect never mutates game state or reveals future deck order.
The primary action and deed inspector precede the scrolling board in DOM
order so the mobile visual order matches keyboard focus; supplementary
portfolio/trade/rules disclosures follow the board.

**Transport constraints.** No signaling service or TURN relay exists.
Public STUN discovery needs network access, long SDP URLs can be truncated,
and some NAT/firewall pairs will never connect directly. A recovered host
must ready/resume the saved game; neither reload nor app-switch can recreate a
dead peer connection by itself. The host must be trusted with private game
state. URL/QR exchanges stay on device/peer except for whatever channel users
choose to share links through (`js/multiplayer.js`, `README.md:Playing together`).

## Game inventory

All 22 games support local play and game-owned checkpoint validation. "Room"
means a separate-device room, not simply two players sharing a screen.

| Game / module | Room | Important state and boundary |
| --- | --- | --- |
| 2048 (`games/2048.js`) | No | Grid, score, keep-playing mode; staged slide/merge rendering. |
| Air Hockey (`games/air-hockey.js`) | No | Two paddles/puck, score and canvas simulation; stationary faceoff/serve. |
| 8-Ball Pool (`games/pool.js`) | No | Canvas ball positions/velocities, groups and house-rule scoring. |
| Whack-a-Mole (`games/whack-a-mole.js`) | No | Timed round, score/misses and absolute deadline. |
| Snakes & Ladders (`games/snakes-ladders.js`) | Yes | Seeded obstacle layout, turn/positions; large upper-board snake and animated travel. |
| Ludo (`games/ludo.js`) | Yes | Four identical tokens per seat, roll/movable set, captures and turn; active home glows. |
| Island Charter (`games/catan.js`) | Yes, private views | 19-hex board, terrain/number/harbor options, opening order, bank, build/trade/deck and ten-point victory. Its local/room players keep separate chart zoom/pan in per-tab `sessionStorage`, not the authoritative game checkpoint. |
| Business (`games/business.js`, `games/business-engine.js`) | Yes, private public-state views | 40-space original Indian-city board, host card order, auctions, complete-set even building, debt/trades and bankruptcies; validated local/host resume. [Rules](BUSINESS_RULES.md). |
| Chess (`games/chess.js`) | Yes | Board, castling, en passant, promotion, turn/result. |
| Imposter (`games/imposter.js`) | No | Roles, secret reveal, prompt category and round state. |
| Dumb Charades (`games/dumb-charades.js`) | No | Prompt, actor/team, timer and round. |
| Rock Paper Scissors (`games/rps.js`) | Yes | Picks, round, score and winner. |
| Blackjack (`games/blackjack.js`) | No | Deck, player/dealer hands, stake and phase. |
| Crazy Eights (`games/crazy-eights.js`) | Yes, private views | Host deck/hands, wild suit, turn and revisioned actions. |
| UNO-inspired (`games/uno.js`) | Yes, private views | Host deck/hands, color, penalties, callout/challenge and revisioned actions. |
| Tic-Tac-Toe (`games/tictactoe.js`) | Yes | Board, current seat and result. |
| Connect Four (`games/connect-four.js`) | Yes | Grid, current seat and result. |
| Minesweeper (`games/minesweeper.js`) | No | Cell/reveal/flag state and first-click safety. |
| Memory Match (`games/memory.js`) | No | Card layout, matches, pending flips and turn/score. |
| Simon Says (`games/simon.js`) | No | Sequence, level and input progress. |
| Hangman (`games/hangman.js`) | No | Word, guesses and round. |
| Word Scramble (`games/word-scramble.js`) | No | Word pool, letters, hints and solved state. |

Shared mechanics are deliberately narrower than "all games": `js/dice.js`
is the single tumbling dice engine for Ludo, Snakes & Ladders and Island
Charter (including predetermined room outcomes, final-face delay, abort and
reduced motion). `js/board-tokens.js` is shared by Ludo and Snakes &
Ladders; `js/snakes-board.js` generates their obstacles. `js/disc-physics.js`
contains the fixed-step disc/collision primitives for Pool and Air Hockey.
`js/game-utils.js` contains small reusable win/board helpers.
`js/party-prompts.js` is offline prompt data. Island Charter artwork lives
in `games/catan-art.js`. Other game rules remain in their own modules.

## Assets, browser support and tests

`assets/` contains local SVG logos, UI icons, game/resource icons and PNG
PWA icons. Game Icons art is CC BY 3.0 and Tabler icons are MIT; preserve
attribution in `README.md`. The PWA caches vendored QR assets and listed
game/CSS/JS/icon files in `sw.js:STATIC_ASSETS`. Bump both cache names when
changing offline assets; otherwise installed clients can keep stale code.
Navigation is network-first with an offline shell fallback. A first complete
installation is required before local offline play; **remote rooms require
network**. Camera scanning requires HTTPS or local `localhost` plus consent
(`manifest.json`, `sw.js`, `js/room-qr.js`, `README.md`).

Sound is synthesized by one lazy Web Audio context (`js/audio.js`);
`js/app.js` unlocks it from user gestures. On iOS Chrome, playback-session
routing is selected when exposed by the browser; it can interrupt other audio.
An "Audio is ready" status reports API state, **not audible output** on a
physical device. Game vibration uses the Vibration API; iOS browsers do not
offer arbitrary game haptics, though a directly touched native switch may
provide tactile feedback (`js/haptics.js`, `README.md`).

`npm test` runs Node's built-in test runner; there are 22 tracked test files
under `test/`. Focused suites cover Island Charter's generation/checkpoints,
private card rules, chess pieces, room recovery/authorization, session expiry,
dice, board/physics helpers, audio and haptics. Browser/device checks still
matter for touch, sound, canvas, service-worker updates and camera/WebRTC:
there is no automated real-device or end-to-end offline/network suite.
Several local games (including Blackjack, Hangman, Minesweeper, Pool, Simon
and Word Scramble) have no dedicated rules test; shared/category/room tests
do not substitute for full gameplay coverage.

## Known issues, limits and open verification

Keep **confirmed defects**, **product/platform limits** and **unverified
reports** distinct. This list is a backlog, not a claim of exhaustive bugs.

1. **Confirmed diagnostic defect:** `js/game-catalog.js:loadGameModule`
   treats any dynamic-import failure as an absent game module. A syntax or
   initialization error can appear as "coming soon" in the UI rather than
   showing its root cause there (the original error is logged to the console).
   Preserve the genuine missing-module case, but expose other failures when
   refactoring.
2. **Confirmed persistence limitation:** `js/storage.js:saveJSON` returns
   `false` on quota/private-mode failures; many callers do not surface that
   result. Local recovery can therefore be unavailable without a visible
   warning. Host room recovery is only per-tab `sessionStorage`, not durable
   cross-device storage.
3. **Connectivity limit:** serverless, STUN-only rooms cannot guarantee
   connectivity on restrictive networks; re-invitation is required after
   tab reload. Saved rounds cannot survive the host losing its session data.
4. **Rules/scope limits:** Chess omits repetition and 50-move draws; Pool
   deliberately uses simplified 8-ball rules; UNO-inspired is single-round,
   with no draw-card stacking or multi-round points. Telugu movie prompts
   have only a small verified starter set; solo campaigns are not implemented
   (`README.md:Scope notes`, `README.md:Telugu movie catalogue`).
5. **Unverified on-device report:** the user observed silence in iOS Chrome
   after the earlier audio unlock fix. Commit `788bbd4` added gesture-time
   audible scheduling and feature-detected playback routing, but no physical
   iPhone/iPad output test has confirmed the result. Do not mark this closed
   based only on an emulated browser reporting `AudioContext.state=running`.
6. **Coverage gap, not a proven gameplay bug:** rule-level tests and device
   E2E tests are uneven. Rendering in a desktop browser does not prove
   iOS audio/haptics, room NAT traversal or offline update behavior.
7. **Island Charter artwork gap:** the resource SVGs in
   `assets/icons/resources/` are tinted generic pictograms rather than the
   requested representative resource illustrations. Offshore harbor badges
   now connect visibly to their two eligible junctions, but are not illustrated
   ships. Do not use copyrighted game art as a substitute; the icon provider
   must authorize SVG access or the project must supply distributable artwork.

## Refactoring opportunities (not yet implemented)

Prioritize after protecting each behavior with tests; preserve old checkpoint
compatibility, host authorization and per-seat privacy.

1. **Separate room transport from lobby rendering and recovery**
   (`js/multiplayer.js`). Extract the offer/answer codec, peer/channel
   lifecycle and host checkpoint service incrementally. Keep signaling,
   membership checks and private dispatch in one coherent protocol rather
   than rewriting all nine game adapters at once.
2. **Split Island Charter's engine and presentation** (`games/catan.js`):
   keep board generation, game actions/checkpoint validation, private view
   projection and DOM/SVG rendering as distinct tested units. It currently
   combines rules, room sync, animation, and UI in a single large module.
3. **Version the checkpoint envelope**, not game rules (`js/game-session.js`,
   `js/multiplayer.js`, per-game validators). Share expiry, schema version,
   serialization and failure reporting while keeping each game's state
   validator and migration explicit. Test legacy restores before changing
   saved formats.
4. **Standardize room action/revision adapters** for the nine room games
   (`js/remote-match.js`, `games/uno.js`, `games/crazy-eights.js`,
   `games/catan.js`). Consolidate only repeated request/snapshot plumbing;
   actor validation, hidden data and recovery sequencing remain mandatory
   per game.
5. **Expose storage health and test real deployment paths** (`js/storage.js`,
   `sw.js`). First make failed saves visible; consider IndexedDB only if
   measured checkpoint size/quota warrants it. Add a precache/catalog
   consistency check and browser smoke tests for offline install/update,
   room reconnect and touch audio before automating larger refactors.
6. **Sharpen game-level coverage** for local-only rules and timers. Shared
   `js/board-tokens.js`/`js/disc-physics.js` already avoid some duplication;
   do not merge unrelated game rules merely to reduce file count.

## Keeping this document alive

- After adding a game, update `js/game-catalog.js`, `games/<id>.js`,
  `js/game-help.js`, `js/game-session.js` (expiry), `sw.js` (precache and
  cache version), targeted tests, and the inventory above. If room-capable,
  also cover seat bounds, recovery, stale actions and private/public views.
- After changing saved state, test local restore, expiry, reset, host reload,
  guest resync and an older checkpoint. Update the state/limits sections.
- Record a confirmed defect here with a reproduction and close/remove it
  only after a device or test verifies the fix; keep unverified reports
  explicitly labeled. Keep user-facing instructions in `README.md` and
  chronological decisions in `CHANGELOG.md`.
- For the smallest local run use `python3 -m http.server 8000`; run
  `npm test` for the Node suite. There is no bundler or package install
  step (`package.json`).
