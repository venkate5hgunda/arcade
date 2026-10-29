# Release qualification

All 26 games have native implementations, original artwork and automated
complete-game/recovery evidence. All eleven supported room games have
host-authoritative projections and recovery evidence. The user authorized the
production merge and deployment on 2026-10-29; the public release uses the
verified `redesign/` build artifact.

## Automated evidence

Use the latest dated section of [verification](verification.md), not the older
first-game table, for current suite results. Run the built app's desktop
Chromium/mobile WebKit suite with native WebRTC loopback fixtures, plus the
independent real-worker offline/update fixtures. The original JavaScript and
Python suites remain required. Test emulation does not qualify physical devices.

| Area | Inspectable evidence |
| --- | --- |
| Catalog, deep links, keyboard, local names/scores, expiry and errors | `foundation.spec.ts`, `domain.check.ts` |
| All 26 game rules, options, outcomes and recovery | [Game-port evidence](game-ports.md) and each game browser/domain suite |
| All eleven room games, authority, private views, standings and spectators | `room.check.ts`, `standings.check.ts`, `spectators.spec.ts` and room flows in each game suite |
| Theme, feedback, reduced motion and responsive surfaces | `feedback.spec.ts`, `motion.spec.ts`, per-game accessibility/overflow checks |
| Offline graph, interrupted/corrupt install, waiting updates and neighboring scopes | `pwa.check.ts`, `pwa.spec.ts`, `pwa-lifecycle.spec.ts` |
| Raw migration backup, exports, competing tabs and score coordination | [Saved games and tabs](storage.md) |
| Developer movie ingestion/annotation/export and deployment boundary | Original Python movie suite and original movie browser-library tests |

## Physical devices and networks

The user deferred these checks on 2026-10-29 despite having Wi-Fi/cellular
devices available. They remain unverified and are outside the immediate
implementation-completion gate. Use the concise [device validation guide](device-validation.md)
for exact steps, pass criteria and a result format. Deferral is not a passing
physical-device result.

## Model-path applicability

The production browser app runs deterministic local engines and reads approved
movie files. It contains no model provider client, model credential or runtime
inference. A fresh-browser local/offline play pass therefore does not make a
live-model claim.

The developer pipeline now defaults to the user-configured local OpenAI-compatible
API in `dev/movies/compatible_annotation.py`. It collects three schema/domain-valid
candidates in parallel, retries each slot and the judge, and regenerates candidate
rounds when the judge rejects or gives confidence below 5 on the explicit 1–10
scale. Promotion and later annotation reads recheck the confidence and all three
source receipts. See [provider operation](../movie-model-provider.md).

Native Gemini and the provider-neutral adapter remain explicit optional paths.
Credentials, catalog snapshots and all model receipts remain developer-only.
The missing-runtime audit from earlier on 2026-10-29 was superseded by the user's
local endpoint instruction. A fresh isolated catalog can be reconstructed from
checked-in source CSV facts for qualification, without importing private machine
history or modifying the production catalog. Live service and fresh-browser
qualification evidence is recorded in [verification](verification.md); synthetic
tests alone do not establish those results.
