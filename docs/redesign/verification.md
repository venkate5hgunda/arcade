# Verification

Verified 2026-10-26 for the Living Game Shelf / first-game milestone. This supersedes the foundation-only evidence from 2026-10-24.

| Check | Result |
| --- | --- |
| Type checking and production bundling | Passed |
| Frozen baseline / catalog / documentation inventory | 4 passed |
| Compiled TypeScript domain, persistence and room checks | 11 passed |
| Chromium desktop + WebKit iPhone browser flows | 18 passed |
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

Only G19 is fully implemented. A01–A07 have scoped first-game progress; their broader criteria remain planned. The other 25 redesigned games, QR admission, spectators/private information, broader standings, auto theme/audio/haptics, offline installation/update, versioned production data migration, cross-network/physical-device qualification and full parity release remain in [the backlog](backlog.md). The original app remains the complete playable collection.
