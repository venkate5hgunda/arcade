# Migration, decisions and delivery

## Decision trace

- Start from refreshed `origin/main` at `ae1136d6e544784811e5c334ee76d6c54b6921a3`. The existing code, its tests, product documentation and the [source snapshot](source-snapshot.json) anchor the requirements.
- The initial no-build architecture optimized direct static deployment. The user's redesign request supersedes that implementation constraint, while preserving user capabilities and allowing new logic, flows and backend internals.
- The agreed first milestone is requirements, architecture and runnable foundations. The subsequent Phase 2 request implements the first complete game; G19 now has implementation evidence and broader parity records retain planned status.
- The practical stack chosen in the conversation is Svelte/TypeScript/Vite for Pick and React/TypeScript/Vite/React Router for Arcade and Sharp. Vue was considered for Sharp; common React tooling across the larger apps is the selected tradeoff.
- Maintain product-specific implementations in their own repos. Share conventions first; extract a shared package only after actual duplication and compatible ownership justify it.

## Source-of-truth and discrepancy handling

Inspect behavior in source and tests before trusting an older README or architecture summary. Preserve intentional behavior; record a discovered bug as a correction with a regression case. An unverified baseline test mapping is a starting point, not proof of end-to-end coverage. The source snapshot records hashes rather than copying all old source into the new app.

The actual game catalog contains 26 entries; older architecture passages say 22 or 23. The new inventory uses the code catalog and includes Show, Taboo and Wordle. Show keeps internal ID `show-star`. The old feature document says Dumb Charades expires at five minutes while `game-session.js` uses eight; use the code value as the baseline and verify the actual timer before changing it. The developer movie pipeline is retained as a product dependency, not bundled into the client.

## Persistent and network contracts

Preserve `arcade:` preferences, player names, high scores, per-game settings, recent games and checkpoint maps. Each local session is `{state, savedAt}` with per-game expiry and game-specific validation. Exact keys and lifetimes remain in [storage.js](../../js/storage.js) and [game-session.js](../../js/game-session.js). Archive fixtures for every game, including complete and invalid states, before serializer changes.

Host room checkpoints remain tab-scoped and contain privileged state. Guest storage is not authoritative. Private seat views, round IDs, revisions, seat identity and action validation must survive transport changes. Canvas viewport zoom/pan is UI state and never authoritative game state. If wire formats change, version the protocol and reject incompatible peers with useful recovery guidance; do not join old/new clients into an unsafe mixed room.

A hosted signaling or relay backend is an architectural option, not part of this foundation. Any replacement must retain privacy/authority guarantees and explain reconnection semantics. Test every room-supported game with separate browser contexts, including spectators, wrong-seat requests, stale revisions, host reload and disconnected seats.

## Implementation sequence

1. **Foundation (this branch):** source inventory, acceptance criteria, architecture, isolated package, typed shell, accessible feature explorer, browser checks and screenshots.
2. **First complete feature:** Port catalog and shared setup, then a complete local Tic-Tac-Toe flow and one two-browser room flow before complex private-information games.
3. **Expand in coherent groups:** implement the remaining feature families with current state/serialization fixtures and browser evidence. Maintain old routes through aliases where required. Update parity status and attach exact test paths and evidence commits.
4. **PWA and recovery:** versioned storage migration, offline asset graph, scope-safe update handling, install/standalone testing, quota/private mode and multi-tab behavior.
5. **Parity release:** execute every acceptance case and the full original regression suite; review documented corrections, data migration, artwork and real device behavior. No open blocker may be hidden behind an implemented status.

## Branch and rollout policy

Push this milestone to `codex/redesign-foundation`; do not merge or deploy it automatically. The dedicated workflow validates the new package on that branch and relevant pull requests. Existing app source, root package dependencies, production service workers and release flags are not changed by the foundation. Build output stays in ignored package-local cache; the lockfile is committed.

Use a separate preview origin during later implementation. Before replacing the public app, validate old-to-new storage fixtures, an explicit return/backup path, inbound URLs, service-worker update behavior and full feature parity. An old service worker can intercept new paths on the same origin, so preview isolation must be operational rather than a folder name alone.

## Trace checklist for every migrated feature

Trace UI entry points → controller/actions → domain rules → persistence/transport → projections/rendering → serialized output → docs and tests. Include every consumer of changed roles, phases, flags, IDs and fields. Revisit the original decision when changing its premise. Record newly discovered requirements and additional edits; identify missed traces explicitly if they cause a defect.

## Phase 2 decision checkpoint — 2026-10-26

The user selected visual option 2, **Living Game Shelf**, and authorized completing the first-game feature in a review PR against `codex/redesign-foundation`, with progressive remote pushes. This supersedes the explorer homepage, while retaining its routes and baseline evidence. The local unfinished branch was reviewed against freshly fetched remote refs: both started at `20b5299`; no divergent remote first-game commit existed.

The completed scope is the 26-entry shelf + shared local setup + baseline-shaped persistence + local/room Tic-Tac-Toe. Original game URLs use `#/games/:id`; the redesign accepts that alias and `/game/:id`. Unported entries link to the original app. The two-player room is a scoped typed implementation, not a claim of wire compatibility with the legacy room or private-game/spectator parity.

First-game progress is recorded per requirement. Only G19 is implemented; broader shared criteria remain planned until all their consumers/games are ported. Keep the remaining families, QR/private/spectator breadth, full sound/auto-theme, PWA and production migration in [the backlog](backlog.md). Do not merge or deploy this PR automatically.
