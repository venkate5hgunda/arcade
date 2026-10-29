# Release qualification

All 26 games have native implementations, original artwork and automated
complete-game/recovery evidence. All eleven supported room games have
host-authoritative projections and recovery evidence. This is a migration
branch; merging or deploying is a separate decision.

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

These remain unverified in the automated runner. Record the device, OS/browser,
build revision and actual result for each case; do not substitute API readiness,
emulated permissions or an injected install event for a physical result.

- On iPhone/iPad Safari and Android Chrome, install from the browser, open the
  installed app, complete a local game, close/reopen and reload it offline.
  Verify install icon, safe areas, standalone status and a waiting update.
- Scan a real invitation QR with the camera, exercise denial/cancellation,
  re-enable access and verify the camera indicator stops after closing scanning.
- Hear Test sound and distinct in-game effects after gesture unlock, mute/unmute,
  background/resume and an output-device change. Verify actual Android vibration
  when enabled; confirm the documented iOS native-switch limitation.
- Play Air Hockey with two simultaneous physical touches. Verify canvas controls,
  device rotation, reduced motion and readable local private-hand handoffs.
- Connect room peers on separate Wi-Fi/cellular networks, play turns, interrupt
  transport, reload the host and reconnect with fresh links. Inspect spectator
  privacy and a private-hand game. Record network-dependent failures and the
  disclosed absence of a signaling service/TURN relay.

## Model-path applicability

The production browser app runs deterministic local engines and reads approved
movie files. It contains no model provider client, model credential or runtime
inference. A fresh-browser local/offline play pass therefore does not make a
live-model claim.

The retained developer-only native Gemini annotation/review path lives in
`dev/movies/gemini_annotation.py`; the provider-neutral adapter path lives in
`dev/movies/llm_annotation.py`. They are outside the deployed app and remain
unchanged by this migration. Their offline/schema tests pass, but those tests
are not live provider qualification.

The 2026-10-29 environment audit found neither a configured Gemini credential
nor the ignored local movie SQLite catalog in this checkout. Live inference
cannot be qualified here until that runtime/catalog is supplied. Resolve
credentials locally through the existing runtime configuration; do not paste
secrets into chat, commit them or expose provider payloads in browser assets.
Use an isolated catalog copy and a bounded non-promoting run, retain actual
provider/model receipts, then check approved export rendering in a fresh browser.
Do not activate new annotations or expand the catalog as a side effect of
redesign release verification.
