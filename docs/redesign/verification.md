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

G03, G07–G08 and G16–G26 are implemented; see [game-port evidence](game-ports.md). A01–A07 have scoped first-game progress; their broader criteria remain planned. The other 12 redesigned games, QR admission, spectators/private roles, broader standings, auto theme/audio/haptics, offline installation/update, versioned production data migration, cross-network/physical-device qualification and full parity release remain in [the backlog](backlog.md). The original app remains the complete playable collection.

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
## PR review correction: restored UNO setup

Restored UNO checkpoints now reconcile the setup player count before a fresh deal,
including when setup preferences are missing or stale. The added cards browser
regression restores four hands, resets the match, and verifies the new deal still
has four players. Validation: TypeScript/production build and all seven desktop
card browser flows passed, including real private-room reload and reconnect.
