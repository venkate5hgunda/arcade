# Verification

Current automated milestone verified **2026-10-29**: all **236** desktop Chromium/mobile WebKit checks, **87** domain/protocol/build/migration checks and **5** inventory checks pass, with production build/type check and formatting. The unchanged original suites pass **206** JavaScript tests on isolated Node 24.22.2 and **100** Python movie tests (80 baseline plus 20 compatible-provider checks). The local compatible-model path has live three-candidate/9-of-10 judge evidence and fresh desktop/mobile export inspection. Physical-device/network gates remain tracked in [release qualification](release-qualification.md). Earlier milestone records below are historical.

## First-game milestone

Verified 2026-10-26 for the Living Game Shelf / first-game milestone. This supersedes the foundation-only evidence from 2026-10-24.

| Check | Result |
| --- | --- |
| Type checking and production bundling | Passed |
| Frozen baseline / catalog / documentation inventory | 4 passed |
| Compiled TypeScript domain, persistence and room checks | 18 passed |
| Chromium desktop + WebKit iPhone browser flows | 34 passed |
| Automated WCAG A/AA checks | No violations on catalog, setup, active board and room |
| Original JavaScript suite, Node 22 | 203 passed |
| Original Python movie suite | 80 passed |
| Real desktop/mobile captures | Generated from production build; see [design QA](design-qa.md) |

## What the tests prove

`redesign/checks/unit/domain.check.ts` traverses actual moves, terminal-state validation, every possible human branch against minimax, baseline session envelopes/expiry, recent-game shapes, names, scores and storage-denial handling. It compares all catalog IDs, player limits, categories and icons with the original registry.

`redesign/checks/unit/room.check.ts` runs admission through an injected transport, tests wrong-seat and stale-revision rejection, win/draw accounting, rematch, host restore, same-seat reconnect, mismatched names and malformed/unrelated signals. The production transport always uses native WebRTC.

`redesign/checks/browser/foundation.spec.ts` exercises the **built application** in Chromium and mobile WebKit: all 26 game routes and 34 requirement routes, browse/filter/search/selection, original-game links, named local play, O victory, resume/reload, AI/keyboard/reset, expired/invalid data, quota denial, responsive layouts, persisted theme choice and automated accessibility. It also exchanges actual invitation/answer URLs between two separate browser contexts, plays a room match, rematches, reloads the host, reconnects the same guest and verifies the retained board.

The native room test uses loopback candidate addresses and disables public STUN in its **test fixture only**. This runner cannot route headless mDNS/LAN candidates: a minimal native WebRTC pair stalled identically, with ICE requests and no responses. Loopback connects real native DTLS/SCTP data channels; application signaling, validation and UI remain the production pipeline. This is evidence of local real-browser transport, not cross-network qualification or TURN coverage. Production continues to gather ordinary candidates and uses Google STUN when online.

## Commands and environment

```sh
npm --prefix redesign run check:format
npm --prefix redesign test
npm --prefix redesign run build
npm --prefix redesign run test:browser
npm --prefix redesign run capture
node --test test/*.test.js # Node 22
npm run test:movies
```

Use `ARCADE_REUSE_PREVIEW=1` for browser checks/captures only when a known production preview is already running. Tests compile TypeScript to ESM in the ignored package cache and execute absolute test paths. They do not require a new runtime dependency. Keep checks outside nested `test/` directories so the original root runner cannot discover them accidentally.

The original JavaScript fixture still fails under Node 26 at `test/multiplayer.test.js:1229`; all 203 tests pass on Node 22, as in CI. The Python private-file-denial test requires permission to run its local HTTP fixture. These are pre-existing environment constraints. React Router produces dependency-level `use client` warnings in this entirely client-rendered build; bundling succeeds.

## Change and decision trace

Traced catalog registry and every stable ID → category/search/selected shelf → game routes and legacy `#/games/:id` aliases → shared setup/turn/board UI → pure game rules and AI → session/settings/name/recent/score readers and writers → room negotiation, admission, authoritative moves, serialized snapshots and recovery → docs, parity, CI and original regressions.

The pending implementation had missed traces: recent games were written as strings instead of `{id, at}`, scores were flattened instead of nested by game, any win was attributed to Player 1, finished-state validation contradicted itself, arrow-key instructions had no handler, and the room used placeholder SDP. The implementation and pipeline tests correct these defects. Earlier claims of nondeterministic test runners were unsupported: the abandoned tests expected an extra X and accepted a finished checkpoint without its required flag.

Additional edits surfaced by tracing: preserve original-game `#/games/` handoff links, retain the requirements explorer, cancel AI timers on navigation, save the initial board and rematches, prune invalid resumable boards, keep the same reconnect name/seat, validate external snapshots, show connection/storage failures, keep the selected playable game visible on the shelf, wrap the header for Linux fallback-font metrics, and replace the stale foundation tab title/theme metadata. The first CI overflow was a missed trace of platform-specific text widths; the final viewport checks guard the corrected layout. Browser-only network restrictions belong in test setup, not production networking.

The user's approved option 2 and Phase 2 review-PR scope supersede the foundation's temporary explorer homepage. The React stack, baseline source freeze, data contracts, isolated preview, no automatic merge/deploy and phased parity decisions remain intact.

## Remaining release gates

All 26 native games and all eleven room-supported games are implemented; see [game-port evidence](game-ports.md). A01–A07 retain partial shared-feature scope. QR admission/sharing, auto theme and shared audio/haptics now have evidence below. Spectators and per-game standings now have evidence below. Game-specific feedback now has evidence below. Offline installation/update, versioned production data migration, cross-network/physical-device qualification and full parity release remain in [the backlog](backlog.md).

## Puzzle-family trace

Traced baseline options/rules → pure typed transitions → React input and turn
state → per-game checkpoint validation → shared catalog/resume capability →
room game identity/authority → browser flows, parity statuses and docs.

The old home assumed every implemented game used Tic-Tac-Toe checkpoints and
had room support. Expanding that flag exposed those assumptions; validation is
now dispatched by game and only migrated room games advertise private rooms.
Connect Four snapshots preserve game identity across rematches and host reload.
The 2048 move function retains the original trajectory/merge metadata and is
compared directly with the baseline engine; React stages movement, merge and
spawn, queues one move, and honors reduced motion. Memory saves normalized
post-mismatch state so navigation cannot resurrect an invalid pair or leave a
stale timer to mutate the next game. Simon replays restored partial sequences
and cancels playback on navigation.

Browser checks caught unlabelled-role tile semantics (fixed with inspectable
image roles) and a test that attempted to click a Minesweeper field after flood
reveal had already won (fixed to observe the actual current board). The latter
was a test assumption error, not a gameplay defect.

## Per-game artwork and Blackjack trace

Traced every catalog ID → manifest → hero/shelf/grid/resume/setup/detail art consumer → responsive styles → capture tooling → provenance/credits/docs and coverage checks. All 26 images are distinct, locally hosted and inspected. The per-game requirement supersedes intentional family-image sharing; the old atlas CSS and asset were removed. The capture script now decodes real images rather than reading a background URL. The guide and exact accepted prompts remain in the repository for future art work.

Traced baseline Blackjack deal/action/settlement rules → typed deck/ace/value transitions → native card table and hidden dealer-card DOM → shared setup/start/redeal hook → checkpoint dispatch/expiry → catalog capability and resume → parity/docs/tests. The extracted shared frame preserves puzzle behavior; its completion predicate handles natural Blackjack on the initial deal, so a completed hand is never saved. Units, records and card uniqueness retain baseline contracts. No global preference or unrelated source-game behavior changed.

Validation: five inventory checks, 21 domain/protocol checks, TypeScript/build/format, 42 desktop Chromium and mobile WebKit flows (including existing two-browser rooms), and refreshed real-app captures. Shared audio/haptics remain explicitly tracked under A07.

Final inspection also caught a capture assumption: waiting only for the hero could record still-loading shelf images. Captures now decode all visible images, and the first eight shelf covers load eagerly. A redeal test incorrectly assumed a random new deal could not produce another natural; a deterministic non-natural fixture now checks record preservation, with a separate natural-deal flow. These were missed traces of image readiness and randomized settlement, corrected before sign-off.

Linux WebKit exposed an older stale-timer test reading storage before React's shelf transition mounted. This was a missed trace of concurrent navigation and image readiness, not evidence that a disposed game callback fired. The test now freezes a real pending AI turn, waits for the destination to mount, advances beyond the timer and proves the checkpoint is unchanged. No production timing was changed. The first CI attempt separately timed out downloading Ubuntu browser dependencies; a retry installed them successfully.

## Private-card and group-room trace

Traced original Crazy Eights/UNO pure rules, checkpoint validators and private projections → typed engines → native card selection/suit or color choice/challenge/callout controls → covered local handoffs → settings/names/recent/checkpoint readers → catalog capabilities/routes/resume → room authority, per-peer transport, projected snapshots and host backup → parity, captures and docs. The engines are compared directly with the originals through complete seeded rounds, including both deck sizes and 20 players. Original source modules/renderers remain unchanged.

The two-peer room premise is explicitly expanded: hosts hold one channel per guest; v2 signals/messages reject mixed peers, while valid v1 public host backups can recover into new v2 connections. Full private state lives only in the host's tab backup. Public snapshot types exclude private decks, opponents' hands and challenge evidence; receivers reject unknown projection fields and wrong-seat snapshots. Each guest receives its own hand, counts and public turn state. Admission during a match is restricted to existing seats, and a disconnected seat pauses every action. Round/revision, per-link sequences, legal action schemas and exactly-once standings remain authoritative.

Capability tracing surfaced two old assumptions: implemented multiplayer games were labelled “Solo or pass & play,” and reconnect controls assumed exactly two room members. Both now reflect native card capabilities and larger tables. Browser checks caught missed traces in card visual-text semantics and the dark-panel round-count contrast; decorative corner echoes now use CSS stamps with one explicit card identity, and the room metadata uses the established readable color. UNO's terminal blocked-state validator also contradicted its own pass-count transition; the typed validator accepts that finished boundary without allowing it as a resumable checkpoint.

Validation: five inventory checks, 28 domain/protocol checks, 56 desktop Chromium/mobile WebKit flows, complete native card wins/replays/challenges/reloads, real two/three-browser private-room recovery, accessibility/overflow and local image checks. Twenty-seat room admission, privacy, invalid actions and selected-seat recovery use the same production protocol with deterministic transports. Public TTT/Connect Four room flows remain green. Full physical-device and cross-network qualification, spectators, other room games, per-game standings and shared audio/PWA work remain in the backlog.

Final capture review exposed a missed screenshot trace: WebKit could include the offscreen fixed skip link in a full-page capture after scrolling. The link is now clipped until focused, with a keyboard test for its visibility and destination. Card handoffs/reveals also focus the relevant heading, suit/color choice focuses its first action, and results focus their heading. Browser assertions cover those keyboard paths. Desktop card tables now fit an ordinary seven-card hand on one row; mobile hands wrap within the table.

The local handoff trace also found that a new match could inherit the previous hand's revealed state, and that the original UNO flow allowed an outgoing player to call UNO before handing over. Both were missed traces. Fresh deals now always cover the hand, and the handoff offers the outgoing player their call without revealing the next hand. A browser flow checks both against the saved game.

CI's three-browser room flow exposed a missed timing assumption: it waited five seconds for native ICE admission, although the product allows 20 seconds before reporting a connection failure. The test now waits for the real connected state and seat projection within that same limit; it still fails if admission or recovery does not complete. Production transport and validation are unchanged.

## Race-game milestone

Traced original rules and seeded board generation through the typed engines, checkpoint validation, local rematches, catalog routing, 2–4-seat room snapshots, host-authoritative actions, protocol versions, reconnects, tests and documentation. This surfaced two missed traces: restored player counts were not carried into rematches, and an interactive board used incomplete grid semantics. Both are corrected. The public snapshot addition advances connections to v3; v1 public and v2 private-card host backups remain recoverable with fresh invitations.

Validation includes original-engine board and move comparisons, exact finishes, captures and safe squares, four-seat protocol recovery and invalid actions, desktop/mobile browser wins and accessibility, and three-browser WebRTC turn and reconnect flows. Full cross-network and physical-device qualification remains outstanding.

## Wordle milestone

Traced original vocabulary and duplicate-letter scoring through the native board, checkpoint validator, catalog and resume links, accessibility and gameplay tests. Browser inspection exposed the guess form below the initial viewport and tile labels without valid roles; both were corrected. Desktop/mobile tests cover keyboard entry, repeated-letter marks, invalid inputs, recovery, wins, losses and replay.

## Hangman milestone

Traced the original word pool, category clues and round transitions through native controls, checkpoint validation, player settings, catalog/resume and complete desktop/mobile flows. Original-engine comparisons cover solo and two-player rounds; browser tests cover repeated letters, turn handoff, clue, reload, win, loss and replay. Visual review exposed a low-contrast clue label; its text color was corrected.

## Word Scramble milestone

Traced word selection, 5/8/12-round settings, hints, solved-round timer, checkpoint recovery, catalog and resume paths. Desktop/mobile tests exercise hints, wrong answers, automatic advance, completion, solved-checkpoint recovery and fresh-match input cleanup. The shuffle guarantees a changed arrangement by swapping distinct letters if the initial shuffle matches the original; this avoids an unbounded retry while preserving a valid scramble.

## Whack-a-Mole milestone

Traced duration options, target timing, scores, best-score storage, absolute-deadline checkpoint and expiry through setup, catalog, resume and desktop/mobile complete-game checks. Browser review showed the initial board extended below the viewport during a timed round; it was resized to keep targets accessible.

## Taboo milestone

Traced the original card deck, scoring, deadline, numeric settings and checkpoint validation through covered clue-giver handoffs, turn transitions, catalog, resume and desktop/mobile gameplay. The replay control now has a distinct label from the header reset; legacy numeric settings are restored. Cards are omitted from the rendered handoff screen, while the timer continues across reload.

## Show milestone

Traced original deals, simultaneous passes, chit conservation, slap ordering, point calculation, settings and checkpoints through covered handoffs, catalog/resume, pointer and keyboard pads, and desktop/mobile gameplay. Chits are removed from the interface during handoff and reload. A synchronous state reference keeps simultaneous pad presses ordered.

A follow-up capability trace caught room introduction copy that still omitted Snakes & Ladders and Ludo. The room now lists both games and their player range. This was a missed consumer in the race-game trace.

## PR review correction: restored UNO setup

Restored UNO checkpoints now reconcile the setup player count before a fresh deal,
including when setup preferences are missing or stale. The added cards browser
regression restores four hands, resets the match, and verifies the new deal still
has four players. Validation: TypeScript/production build and all seven desktop
card browser flows passed, including real private-room reload and reconnect.

## Shared cards and piles integration

The original-app changes from `97216b28` share standard card rendering and deck creation between Blackjack and Crazy Eights, use a common layered pile for Blackjack, Crazy Eights, UNO, Island Charter and Business, and route race-game multiplayer dice through the existing dice utility. The new assets are included in the original service worker cache. The redesign is a separate React runtime: its Blackjack and Crazy Eights use one standard-card component and deck, while UNO keeps its own game-specific faces; all three use a shared pile component. Public discard tops are face up; hidden stock and dealer cards remain face down. No room snapshot fields or checkpoint formats change.

Traced the source card and pile consumers, dice callers, service-worker assets, game-specific card views, seat projections, stock and discard counts, and local/room tests. Original desktop/mobile browser inspection covered Blackjack, Crazy Eights, UNO and Business; Island Charter's discovery pile was inspected in both layouts using a validated saved-game fixture. Island Charter and Business remain unported in the redesign, so their redesigned piles are future port work. The original suite passes 206 Node 22 and 80 Python tests; redesign browser checks include shared card faces, stock depletion, an empty pile, private handoffs, and real room recovery.

## Rock Paper Scissors trace

Traced original setup options, all throws, score/round transitions and absolute countdown through native React controls, baseline checkpoint/settings shape, session expiry, catalog/resume, private projections, host authority, standings, protocol version rejection and host recovery. Protocol v4 adds private showdown snapshots while retaining valid v1–v3 host backups. The room action includes both match and throw-round identity: crossed independent picks can use the immediately preceding revision without allowing a previous throw to replay. Deck/private-hand consumers and existing card tests were updated to the v4 backup key.

Privacy correction: the baseline countdown displayed Player 1's pick before reveal; both throws now remain absent from the rendered showdown until settlement. This intentionally strengthens secret-choice behavior. The host retains authoritative picks only in its tab backup. Countdown settlement is idempotent, timers cancel on navigation/leave, disconnected rooms pause, and only the host advances rounds. No original-app modules were changed.

Validation: five inventory checks and 42 domain/protocol checks; all eight RPS desktop Chromium/mobile WebKit flows pass, including real two-browser wins, rematches and host reload with a locked throw. Inspected mobile result capture. Two initial browser assertions used an invented shelf heading and an overly exact select label; both test assumptions were corrected against the real interface.

## Chess trace

Traced every original engine move flag, castling right, en passant target, promotion choice, captured-piece list, AI heuristic and terminal condition through typed transitions, accessible square controls, orientation, checkpoints/settings, native routes/resume, room seat authority, host backup/reconnection, standings and parity documentation. The native rules are compared with the original source through a complete checkmate; special cases exercise castling, en passant, all promotions, stalemate and insufficient material. Piece SVG paths are retained from the original renderer and visually inspected on mobile.

Six desktop/mobile browser flows pass, including legal move hints, keyboard movement, checkmate/rematch, saved promotion, computer opening as White, real WebRTC turns and host reload/reconnect. The earlier full 108-flow regression run passed after RPS; the final combined duel-port regression is recorded below. No existing game source or production deployment changed.

The combined browser regression passed 112 of 114 on its first run; the two failures were the same missed trace in desktop and mobile artwork checks, which still expected Chess's former placeholder detail page. The assertion now checks Chess's native setup artwork; all 16 affected artwork/Chess checks passed on rerun. The original 206-test JavaScript suite passes under Node 24; Node 26.7.0 fails its pre-existing lobby fixture. All 80 movie tests pass when loopback is allowed.

## Dumb Charades and movie-library trace

Traced original prompt list, team/actor selection, timer and score transitions, ten-success termination, old checkpoints and settings, catalog/resume readers, filters, approved movie index/partitions and actor/result metadata. The Vite build copies only catalog-listed files from the existing publishing output; development serves the same files. No movie-generation or approval rules changed. Missing or invalid data shows retry rather than silently substituting a smaller pool.

The shared setup frame gained an expandable options slot for timer and movie filters. A test initially assumed navigating to the current hash would reload the page before injecting a failure; it now performs a real reload. Six desktop/mobile browser checks pass, including deterministic cast/synopsis and credit display, legacy-shaped recovery, timeout, completion and replay; the rule tests compare real catalog filters and checkpoints with the original. Mobile result view was inspected. Full offline asset-graph, install/update, physical-device and cross-network qualification remain release gates.

## Imposter trace

Traced every original category/word/hint/decoy, count constraint, random selection, classic intel, pair role concealment, movie filters, private cards, saved ballot, tied votes, elimination/win rules and single-imposter legacy migration through native controls, settings/session validators, catalog/resume and tests. Original category data is copied exactly into a typed source catalog and compared to the unchanged source in a unit test. The shared run hook now accepts an optional checkpoint migration function; existing games keep their original behavior.

The original could randomly select a single matching movie in Pair mode while another category was selected, producing an empty decoy. That was a missed choice-pool trace; the native port excludes a movie category that cannot provide a second prompt and adds a regression. Votes remain private during handoff and are saved while selected; the result shows aggregate totals as in the original. Desktop/mobile checks cover a complete win, Pair secrecy, hidden/background/reload handoffs, legacy saves and movie setup. Mobile result was inspected. Physical-device qualification and the remaining platform gates remain open.

The combined party-game build passed all 126 desktop Chromium and mobile WebKit browser checks. The design inventory and 51 domain/protocol tests also pass.

## Air Hockey trace

Traced fixed-step physics, disc collisions, paddle acceleration and limits, opening and receiving serves, target settings, score/finish, saved puck/paddle coordinates, input ownership and teardown through the typed solver, canvas, local session and catalog/resume consumers. Direct comparisons exercise original strikes, acceleration, friction and collisions; state tests cover both goals, valid serving checkpoints and finished-state removal. The reusable typed disc solver is also available to the upcoming Pool port.

Browser inspection found the initial mobile table extended below the viewport; responsive sizing and a viewport assertion correct that missed trace. A separate reset test exposed another missed trace: unmount cleanup could re-save a deliberately cleared checkpoint. Reset now suppresses that cleanup save. All eight desktop/mobile browser checks pass for keyboard and pointer movement, goals, serves, resume, replay, reset and accessibility. Multi-touch on physical devices and shared audio/haptics remain release gates.

## 8-Ball Pool trace

Traced seeded rack placement, fixed-step collisions and pocket callbacks, first contact/rail/foul flags, assignments and remaining-group counts, cue respot, early/legal 8-ball and win states through the typed solver, canvas, keyboard/pointer controls, stable-checkpoint rules, catalog/resume, documentation and tests. The seeded rack and checkpoint validator were compared with the original; complete legal/early 8-ball shots run through the production physics pipeline. An expandable ball inventory exposes number, group and pocketed state without relying on tiny mobile marks.

Eight desktop/mobile Pool flows pass, including a break, legal and early 8-ball, drag, recovery during motion, replay and accessibility. The catalog handoff test had assumed Pool was still unported; it now uses Island Charter. This was a missed capability-consumer trace. The 28 Pool/foundation browser checks passed together. Shared audio/haptics and physical-device qualification remain open.

## Mafia private-room trace

Traced original role distribution, night actions, private detective history, pending/absent seats, secret votes/abstentions, resolution, win conditions and final role reveal through the typed engine, host-only tab backup, strict seat-specific views, round/revision validation, per-seat reconnect, room selection, standings, capability labels and tests. Protocol v5 rejects older links and restores valid v1–v4 host backups; guests receive only their own role, applicable allies, clues and own target. Rejected actions return private recovery guidance. Five-browser desktop/mobile games cover host reload, reconnect, investigation privacy, voting, win and replay; deterministic tests cover 5–10-seat rules, disconnected-seat skips and unauthorized actions.

Mobile inspection exposed a missed shared-room trace: five roster cards squeezed into unreadable columns and displaced the game. Room rosters now wrap legibly and collapse during a match, while remaining expandable. The catalog's previous two-player room label was also corrected for Mafia. Physical-device and cross-network qualification, broader spectators/standings and shared audio/PWA remain open.

The first combined v5 browser run passed 141 of 144 checks. Three failures were missed room-layout traces: Mafia recovery text appeared twice, and the RPS reconnect test expected a now-collapsed roster to be visible. The status is now shown once next to Mafia actions, and the RPS check opens the roster. All 62 affected room/catalog desktop/mobile checks passed on rerun, including real two-, three- and five-browser rooms.

### Business and protocol v6

Traced original board assets, options, actions, auctions, management, trades, debts, bankruptcy, deck privacy, saved sessions, room admission, host recovery, round/revision validation, standings, replay and catalog status. The pure engine is copied into the isolated runtime behind a typed interface; a deterministic auction, trade and completed game match the original engine. Room tests exercise forged-dice rejection, private decks, recovery, trades, exactly-once results, replay and v5 Mafia backup migration. Desktop and mobile browser checks exercise a complete local game, covered trade handoffs, board inspection and a two-browser room with host reload and reconnect. Accessibility checks pass on the inspected board.

The first phone check revealed document overflow when the board was expanded: the grid's intrinsic minimum width had not been traced through the surrounding layout. The container now permits shrinking and the phone check verifies no document overflow. This was a missed layout trace. A further settings trace found malformed stored options could stop a new match; the setup now falls back to valid defaults, with desktop and mobile regression coverage. The complete 150-case browser suite passed after the protocol change; all six focused Business checks passed after the settings fix. Physical-device and cross-network qualification, shared features and full release gates remain open.

A subsequent room-message trace found that Business rejection guidance was sent privately but the guest accepted only Mafia error messages. The guest now accepts both bounded messages, and a room test verifies that the explanation reaches only the acting guest. This was a missed message-consumer trace.

### Island Charter and protocol v7

Traced original seeded island generation, opening order, placements, production, trade, discoveries, raider/discards, scoring, private cargo views, options, local checkpoint migration, room authority, recovery and replay. The isolated native table reuses the original pure engine and terrain/resource artwork. Tests compare seeded three- and four-player games with the original, verify forged-dice rejection and seat-specific views, restore v6 Business backups, and exercise desktop/mobile placement, inspection, viewport preferences, trading, private discard, raider movement, local win and replay, and three-browser recovery, room win and replay. Automated accessibility checks cover the board.

The first desktop raider test found that number tokens intercepted clicks on land underneath. The token is now non-interactive and the desktop and mobile flow is covered. This was a missed input-hit-area trace. Physical-device and cross-network qualification, shared room features, sound/theme work, offline support and release gates remain open.

The first cross-game protocol run passed 158 of 160 browser checks; both failures were the catalog test matching two newly playable Island links. The selector now targets the featured link, and all 30 affected catalog and Island desktop/mobile checks pass together. This was a missed catalog-test consumer trace.

### Theme preference

Traced the original `arcade:ui.theme` value, system color-scheme changes, header control, document color scheme, browser theme color and theme-change event. Auto, Light and Dark now cycle in the original order, invalid stored modes fall back to Auto, and explicit choices survive reload. Desktop and mobile checks cover system changes, persistence and catalog accessibility. Sound, haptics and the remaining A07 criteria remain open.

### Shared sound and feel

Traced the original synthesized audio engine, `arcade:ui.soundEnabled` and `arcade:ui.hapticsEnabled`, user-gesture unlock, interrupted-context recovery, iOS playback routing, native-switch limitations, shared controls, game completion and the Pool/Air Hockey collision callbacks. The isolated runtime reuses the original audio engine, adds persistent expandable controls and truthful test guidance, plays common button feedback and win cues in Tic-Tac-Toe, Business, Island Charter, Pool and Air Hockey, and routes collision force to impact sounds without changing physics. Unit tests check audio recovery and compare collision results with and without callbacks; desktop/mobile browser checks cover settings, support messaging, mute and a real win. Initial tests exposed a shared status selector and Escape handling when mobile taps did not focus the control; the selector is scoped and Escape is handled at document level. The mobile focus behavior was a missed input trace. A review caught that generic completion includes losses and draws, so win cues now follow game-specific outcomes rather than every completed session. Game-specific feedback beyond these shared and action-game events remains open under A07.

All 170 desktop/mobile browser checks passed with the shared feedback layer. After restricting win cues to confirmed outcomes, 40 affected browser checks passed, including a real hockey collision and a Blackjack loss on both layouts.


### QR admission and sharing

Traced original QR generation/scanner/worker assets and MIT licenses → production asset copying and relative module/worker URLs → invitation/answer UI → protocol-v7 validation → clipboard/native sharing → camera cancellation, failure and unmount cleanup → real WebRTC admission and complete play. The libraries are copied unchanged from the original local vendor assets; QR content never goes to an external service. Camera access starts only after an explicit scan action, and raw links remain available on failure. No protocol or host authority contract changed.

`redesign/checks/browser/room-qr.spec.ts` decodes an actual generated invitation with the bundled decoder, scans both sides of a real two-browser connection, completes Tic-Tac-Toe, checks QR accessibility and mobile overflow, and covers camera denial, pending-start cancellation/late callbacks, oversized QR, cancelled sharing and denied clipboard access. Camera callbacks are injected for deterministic admission checks; physical-camera focus/permission UI and cross-network transport remain release gates. Desktop/mobile captures are generated in the ignored test output.

The documentation trace exposed stale nine-game, protocol-v3 and remaining-two-game summaries. Those missed documentation traces are corrected in the redesign landing page, backlog and current release-gate paragraph. Broader A04 acceptance remains planned until spectator admission is implemented.

Validation: production build/type check and formatting pass; five inventory checks, 71 domain/protocol checks and 34 desktop Chromium/mobile WebKit QR/shared-foundation browser checks pass. Existing bundler size and React Router directive warnings remain.

### Reduced motion

Traced every CSS animation, transition and interactive transform, both scripted travel consumers (the shared local/room race table and 2048), timer ownership, queued tile input, keyboard handlers, turn blocking, checkpoint writes and A07's requirements/backlog. The existing global media rule already disables CSS animations/transitions, including pseudo-elements. Tic-Tac-Toe hover, RPS hover and Simon activation still applied immediate transforms; these now retain their color/outline feedback without movement. Static card rotations, token positioning, Whack target timing, Simon sequence timing and Pool/Hockey physics remain meaningful game presentation or mechanics rather than decorative travel.

The scripted consumers previously sampled the preference only when a move began. This was a missed live-preference trace: an in-progress race kept travelling and blocked the next player after reduced motion was enabled. A shared subscribed hook now cancels the travel timer and displays the authoritative result immediately; 2048 also removes its active travel layer, releases queued input and refreshes its keyboard closure. Listeners unsubscribe on navigation. No rules, saved-state shape, room protocol or authority decision changed.

`redesign/checks/browser/motion.spec.ts` passes ten desktop Chromium/mobile WebKit checks: all 26 native game entry/play surfaces have no CSS animations/transitions or page overflow, live race cancellation releases the next turn and survives reload, 2048 wins/continues/restores without travel, Simon retains its timed outline cues through loss/replay, and shelf/Tic-Tac-Toe/RPS controls remain usable without hover movement. Simon desktop/mobile captures were inspected. Mafia's entry remains a room callout; its shared room CSS uses the same global reduction rule, while its complete private-room flows remain covered separately.

The 46 existing puzzle/race/shared-foundation browser checks also pass, including normal travel, complete games, accessibility and real two-/three-browser room recovery. Five inventory and 71 domain/protocol checks, production build/type check and formatting pass. New test corrections included waiting until Simon's actual 500 ms cue start, supplying the screenshot callback argument, awaiting each catalog route, and comparing the saved 2048 state across reload instead of assuming a random spawn could never cause an additional merge. Physical-device qualification and remaining game-specific sound feedback stay open under A07; existing bundler size and React Router directive warnings remain.

### Per-game room standings

Traced all eleven room games' terminal transitions through host-owned outcome recording, per-seat aggregate counters, per-game/player wins/losses/draws, replay round identity, private projections, snapshot validation, host backup/reconnect, protocol links, shared UI and baseline ranking rules. One result path now credits every winning Mafia/Business teammate, records the other participants' losses, and counts draws for every participant. Repeated results for a round are ignored. Rankings match the original order: wins, fewer losses, more draws, name, ID. The expandable leaderboard filters by game and remains available on every table.

Protocol v8 rejects mixed-version peers and migrates valid v1–v7 backups. Old aggregate wins remain visible; historical per-game losses/results are unavailable and are deliberately not fabricated. Unknown players, games, extra fields and inconsistent count totals are rejected. Existing private-hand/role boundaries remain intact. Updating current backup-key fixtures and the README/game-port protocol descriptions were additional consumer edits surfaced by this trace; historical decision notes remain dated evidence.

Validation: all 196 desktop Chromium/mobile WebKit browser checks pass, including real two-browser leaderboard/filter/win/replay/reload flows, three-/five-browser private-room recovery and all games. Five inventory and 73 domain/protocol checks, production build/type check and formatting pass. New checks cover all eleven result categories, shared wins, draw ranking, duplicate rounds, invalid totals and v7 recovery. Spectator admission is still open; this unit does not claim full A04–A06 completion.

### Spectator seats

Traced admitted identities through separate player/spectator rosters, selected player count, invitation/answer role binding, cancellation/reconnect, all eleven rule entry points, private projections/validators, board renderers, host tab backups, standings identities and replay round numbering. The host remains a player. Guest selection changes only in the lobby; new spectators can join during play. Spectators use seat -1, have no action authority or result credit, and do not pause players on disconnect. Cards omit every hand/legal action; RPS omits own/locked throws until reveal; Mafia omits role, allies, clues, ballots and role-identifying pending lists until final public role reveal; Island omits cargo, discoveries and hidden points. Public boards and counts remain inspectable. Validators reject accidentally privileged spectator projections.

Protocol v9 explicitly versions the changed snapshots and invitation role. Valid v1–v8 host backups recover using fresh links. Lobby return confirms clearing unfinished match state while preserving roster identities, historical aggregate wins and per-game standings. A monotonic round counter prevents duplicate result IDs when the game or selected players change. Current backup-key fixtures, shared card/Mafia/RPS/Island/Business renderer assumptions and documentation were additional edits surfaced by the trace.

Browser inspection exposed a missed earlier shared-room trace: Business/Island status text inherited a light color while the table sat outside the local game's dark panel. It now inherits the surrounding readable foreground in both contexts, with automated contrast checks. The active-room introduction is shorter to keep the board prominent. An initial Island test also used an invented board label; it now targets the real accessible group. Desktop/mobile spectator and leaderboard screenshots were inspected.

All 208 desktop Chromium/mobile WebKit browser checks pass, including six new spectator flows per layout with complete win, host/spectator recovery, lobby selection, player-to-viewer and viewer-to-player handoffs, disconnection without pausing, all private game tables, accessibility and overflow. Five inventory and 76 domain/protocol checks, production build/type check and formatting pass. Protocol tests cover spectator privacy/action rejection for all eleven games, invalid privileged views and v8 standings recovery. Physical-camera, physical-device and cross-network transport qualification remain explicit release gates.

### Game-specific feedback

Traced accepted local transitions for every useRun consumer, the custom Tic-Tac-Toe controller, per-recipient room snapshots/results, synthesized audio methods, muted output, haptic availability, timer cleanup, restored state and existing Pool/Hockey solver callbacks. Typed cue classification now distinguishes moves, merges, matches, correct/wrong answers, card plays/draws, dice, captures, phases, countdowns, wins/losses/draws and time expiry. Simon uses distinct pad notes for sequence playback and accepted input. Memory mismatches and rejected Scramble answers have explicit negative cues. Game results are classified from rules, rather than a generic completion flag; room guests celebrate their own outcome and spectator cues never announce another seat's victory. Initial/reloaded snapshots and identical room revisions remain silent. Existing shared controls, audio interruption recovery and action-game physics retain their contracts.

The trace caught an earlier missed completion consumer: the custom local Tic-Tac-Toe controller still celebrated computer wins and draws. These now produce failure and neutral cues, respectively, with a real draw/browser regression. The first combined run passed 204/214; ten local card checks exposed a missed checkpoint-shape trace in the new classifier (raw local Eight/UNO states versus wrapped room states). It now wraps the local state explicitly, and a real-engine card regression protects that boundary. All 34 affected card/feedback desktop/mobile checks pass after the correction, including 20-player UNO, private room recovery, Blackjack loss, Simon notes/mute and a real guest victory with host loss. Remaining sound-method readiness is not a claim of physical audible output; device audio/haptics remain release gates.

Final Island/Mafia/race feedback checks pass all 22 desktop/mobile flows, including legacy race recovery; five inventory and 80 domain/protocol checks, production build/type check and formatting pass. Feedback dispatch also isolates optional effect failures so they cannot block accepted moves or room refresh; a regression covers that boundary. Pool/Hockey impacts remain tested through their real physics callbacks. No game rule, checkpoint serializer or room wire schema changed in this unit.

### Scoped offline application

Traced Vite output and approved-movie copying → deterministic SHA-256 asset graph → runtime response verification and complete-cache marker → scope/origin-owned install/activation/fetch paths → explicit waiting-worker update and old-tab behavior → manifest/install events → footer controls → all game routes, local assets, word/movie data and QR workers. The worker never handles out-of-origin/scope requests, deletes only its own cache namespace, discards partial/corrupt/quota-failed downloads and retains one prior complete release. Original PNG install icons are copied unchanged and were inspected; the original production worker/deployment remain untouched. The earlier no-worker foundation decision is explicitly superseded only for the isolated production preview.

Actual browser checks caught three missed lifecycle traces: Chromium's module/style `Origin` requests did not match Vite's `Vary: Origin` precache entries; the update notice could obstruct footer controls; and a transient first-install waiting state could leave a false update notice after activation. Static assets now match by their verified bytes independent of those headers, the notice stays in footer flow, and only a genuinely waiting replacement is offered. Interrupted-install caches require a complete marker before being retained or used as fallback. Physical OS installation is not inferred from injected install events or emulated standalone display mode.

Ten real-worker desktop Chromium/mobile WebKit checks pass for complete offline asset access, all 26 routes, a complete offline win, cache failure guidance, install accept/cancel/standalone state, waiting updates, preserved checkpoints and other open tabs, neighboring cache scopes, corrupt deployment rejection and foreign production-worker preservation. The 22 shared-foundation browser checks also pass with workers deliberately blocked for their asset-failure fixtures. Five inventory and 82 domain/protocol/build-graph checks, build/type check and formatting pass; offline desktop/mobile screenshots were inspected. Separate unchanged original suites pass all 206 JavaScript tests under isolated Node 24.22.2 and all 80 Python movie tests. Storage migration and competing-tab saves remain the next Phase 4 unit, while physical install/camera/audio/multitouch and cross-network behavior remain release qualification.

## Storage migration and competing-tab trace — 2026-10-29

Traced every namespaced local-storage key and reader/writer through migration startup, session expiry/validation, local game frames, custom Tic-Tac-Toe, Pool/Hockey canvas instances and cleanup, per-game settings, recent games, all four score writers, catalog resume links, theme/audio/haptics singletons, private exports, scoped offline updates and the original unchanged data shapes. Host room checkpoints and Island viewport state retain their separate session-storage contracts. Version 1 backs up raw legacy values before mounting React, validates the backup before its marker, protects failed/unsupported migrations and observes schema advances in other open tabs. Web Locks serialize map/recent/score updates; per-game expectations reject stale writes and deletions. Read-only conflicts retain playable in-memory state.

The consumer trace surfaced additional edits: numeric best-score writers now use coordinated maximums, open shelves/preferences/scores update without write-back loops, canvas/frame sessions share their expectation, and confirmed resets finish deletion before showing setup. Moving saves behind locks also required tracing every dependent UI acknowledgment. Private Island/Business handoffs, Imposter ballot selection and Scramble hints now await the save before announcing the result. Memory explicitly separates its temporary mismatch display from the normalized saved handoff; Simon's repeated-pad replay starts playback only after the new state arrives. These asynchronous UI consumers were missed traces during the initial change. A second concurrency defect used a catalog timestamp captured before another tab's save, causing fresh progress to look invalidly future-dated; cleanup now timestamps after reading and re-reads under its lock. A regression exercises that race.

Browser fixtures now await acknowledged moves or the actual production lock queue before inspecting saved data or reloading; the same-game conflict tests still verify that stale tabs cannot replace the winning save. The full final 236-case suite passes without retries, including 12 new storage flows, complete games, immediate reload after acknowledged moves, private handoffs, accessibility, all offline workers and native room recovery. All 87 domain checks and five inventory checks, type/build and formatting pass. Desktop/mobile protected-storage screenshots were inspected. One intermediate rerun had accidentally used an older build after a return-type compilation error; that error is fixed and the final full run follows a confirmed successful build. See [storage behavior and limits](storage.md).

## Compatible models, parallel retries and confidence — 2026-10-29

Traced default maintenance dispatch and existing schedule flags → runtime credential/base/model settings → structured Chat Completions requests → strict JSON/schema/domain/identity/evidence validation → three concurrent candidate slots with independent retry histories → hash-bound selection/review and explicit 1–10 confidence → fresh candidate rounds after rejection or confidence below 5 → canonical annotation/review receipts → promotion, cached annotation reads, private JSONL exports and standalone public projection → the unchanged browser movie loader, private prompts and rating details. Native Gemini remains explicit opt-in; ordinary builds and browser play do not call a model. The user instruction supersedes the earlier Gemini default, then supersedes the initial fixed-attempt/rejection policy with generous retries, parallel requests, repeated quality rounds and the final 1–10 scale. No threshold is silently coerced or inferred from another scale.

Every slot and judge has 12 attempts by default; up to 12 quality rounds regenerate all three candidates after a valid rejection or confidence below 5, with bounded backoff and a shared atomic daily cap. Accepted data must have three distinct successful source receipts and an approving judgment with confidence at least 5. Promotion, annotation reads and standalone public exports all recheck that proof. The standalone exporter initially depended on previously cached annotations; tracing the new classification exposed that missed consumer, and it now rejects cached data whose source judgment fails the threshold. Tests mutate the source judgment after approval and verify that no public output is written. The command/export trace also found that a missing local catalog could otherwise create an empty database and publish an empty projection; missing/empty catalogs now fail before inference/export, with a real CLI regression. That was a missed startup-to-publication trace. Supplementary Wikipedia/Wikidata/OMDb evidence paths were already offered to models but missing from the validator's allowlist; that missed input/output trace is corrected without permitting invented paths.

A fresh live run against the user's configured local API collected three valid candidates and received an approving **9/10** judgment for the checked-in Mayabazar (1957) source record. Sixteen calls were retained over about 438 seconds: three validated candidates, one validated judge and twelve rejected/failed attempts (including bad identities/evidence/JSON and network failures). The last candidate slot succeeded on attempt 10, demonstrating the need for the requested generous bound. Reported successful models were Gemini Flash Lite and GPT Luna through the compatible service; these are provider-reported IDs, not independent human verification. Earlier failed/obsolete runs remain private and were never promoted. The final trusted-ID instruction explicitly addresses the observed mistake of replacing an opaque job key with a movie title; all acceptance checks remain local and exact.

Only an isolated copy was promoted and exported for fresh-browser inspection. New desktop Chromium/mobile WebKit contexts loaded that real approved projection, filtered its year, kept the prompt covered until reveal, restored it on reload and displayed the computed difficulty, reasons and attribution without page errors or overflow. Screenshot inspection found a missed shared-details contrast trace: global dark text made expanded rating explanations unreadable in the dark result panel. Movie details now inherit their surrounding panel color; Charades/Imposter checks and an accessibility scan with the explanation expanded pass. Corrected screenshots were inspected. The production catalog/public movie files remain unchanged.

All **236** acceptance browser checks pass against the confirmed final build, including offline workers, room recovery, complete games and accessibility. All **100** Python movie tests, **87** redesign domain checks and **5** inventory checks pass, with build/type check, formatting and relative documentation links. The unchanged original JavaScript suite has 206 passing checks under isolated Node 24.22.2. Credential scans found no supplied credential in tracked diffs, built assets, production movie files or the isolated public projection. The credential stays in ignored, mode-0600 runtime configuration. Physical install/camera/audio/haptics, multi-touch and separate-network checks remain unverified; one live movie proves this integration path, not universal provider reliability or catalog-wide score calibration.
