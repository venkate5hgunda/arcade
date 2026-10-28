# Verification

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

G01–G08 and G11–G26 are implemented; see [game-port evidence](game-ports.md). A01–A07 have scoped first-game progress; their broader criteria remain planned. The other 2 redesigned games, QR admission, spectators/private roles, broader standings, auto theme/audio/haptics, offline installation/update, versioned production data migration, cross-network/physical-device qualification and full parity release remain in [the backlog](backlog.md). The original app remains the complete playable collection.

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
