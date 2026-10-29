# Migration, decisions and delivery

## Decision trace

- Start from refreshed `origin/main` at `ae1136d6e544784811e5c334ee76d6c54b6921a3`. The existing code, its tests, product documentation and the [source snapshot](source-snapshot.json) anchor the requirements.
- The initial no-build architecture optimized direct static deployment. The user's redesign request supersedes that implementation constraint, while preserving user capabilities and allowing new logic, flows and backend internals.
- The agreed first milestone is requirements, architecture and runnable foundations. The subsequent Phase 2 request implements the first complete game; G19 now has implementation evidence, and the broader shared requirements (A01–A08) are now implemented or partial with all 26 games implemented. Dated checkpoint notes below record each milestone's state at the time; physical-device and cross-network qualification remain explicit release gates.
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

## Per-game artwork and card-port checkpoint — 2026-10-26

The user requires custom artwork for each of the 26 games and consistent theme guidelines for future generation. The [art guide](art-guide.md), linked from repository `AGENTS.md`, supersedes shared family covers. Twenty-five new Adobe Firefly illustrations join the retained bespoke Tic-Tac-Toe hero; the manifest records exact accepted prompts and inspection/provenance. Images remain local and optimized. This decision changes artwork coverage, not native-game parity.

Blackjack follows the puzzle milestone as the first native card game. Its baseline solo rules/checkpoint shape remain intact; the shared frame is extracted for reuse and has an explicit completion predicate for natural initial deals. Other card games still require private-hand/room work. This unit is stacked on `codex/redesign-puzzle-games`; no automatic merge or production deployment is authorized.

## Private-card/group-room checkpoint — 2026-10-26

The authorized card family now includes native Crazy Eights and 2–20-player UNO-inspired. Pure rules are typed equivalents compared against the unchanged original engines; no legacy renderer/iframe is used. Existing local checkpoint/settings/name shapes remain valid. Local cards are covered on handoff and reload, while room guests receive only seat-specific projections.

The earlier one-host/one-guest transport assumption is superseded for UNO. A host maintains independent channels and sequence counters for each guest. Protocol v2 explicitly separates private authoritative state from public snapshots and rejects v1 connection links; existing valid v1 public host backups can be restored with fresh v2 invitations. This is not compatibility with the original JavaScript multiplayer protocol. The UI keeps setup/options expandable and starts group matches only after every admitted seat connects. Cards are now complete native ports; broad A04–A07, PWA and full-release gates remain planned. This milestone is stacked on `codex/redesign-game-art`, with no automatic merge or deployment.

### Race-game protocol update

Public race snapshots extend the room schema, so v3 invitations and messages reject older peers. Valid v1 public and v2 private-card host checkpoints remain recoverable through fresh v3 invitations. Snakes & Ladders and Ludo are native 2–4-player ports, stacked on the private-card milestone.

### Shared cards and piles integration

The user requested importing the original app’s shared-card and pile work, superseding the foundation milestone’s restriction on changing original-app files. Commit `97216b28` is carried into the stacked integration branch; no deployment is implied. The redesign retains its isolated React runtime and reuses one typed standard-deck implementation and shared React card/pile components. Island Charter and Business still require native ports.

### Secret-throw protocol update

Chess adds authoritative legal moves, promotions and result accounting; Rock Paper Scissors adds seat-specific secret throws and host-timed reveals in protocol v4. Invitations reject older peers; valid v1 public, v2 private-card and v3 race host backups remain recoverable using fresh v4 invitations. Local checkpoint shapes and first-to-3/5/7 settings remain compatible. This extends the authorized remaining-game work; no merge or production deployment is implied.

### Mafia private-room protocol update

Mafia adds host-held roles/actions and seat-specific projections in protocol v5. Fresh connections reject older peers; valid v1–v4 host backups restore into fresh v5 invitations. Unlike other games, the host may explicitly mark a disconnected pending Mafia seat absent for the current phase, matching the original game. No merge or production deployment is implied.

### Business room protocol update

Business adds host-held decks and authoritative dice in protocol v6. Fresh connections reject older peers; valid v1–v5 host backups restore into fresh v6 invitations. For this complex ruleset, the native React application uses a local copy of the original pure JavaScript engine through a typed interface, rather than translating its internals to TypeScript as earlier game ports did. This preserves the established rules and checkpoint shapes while retaining the isolated runtime, native controls and strict room authority boundaries. The original renderer is not used. No merge or deployment is implied.

### Island Charter protocol update

Island Charter adds host-held cargo and discovery decks with seat-specific views in protocol v7. Fresh connections reject older peers; valid v1–v6 host backups restore into fresh v7 invitations. As with Business, the native React table uses the original pure rules behind a typed interface rather than translating that engine, preserving its board generation, rule transitions and saved state. The original terrain artwork is reused and the renderer is native. This completes the catalog game ports, not the broader shared-feature or release gates. No merge or deployment is implied.

### Room standings and protocol v8

All eleven room games now record per-player/per-game wins, losses and draws through one host-owned result path, with exactly-once round accounting and baseline ranking order (wins, fewer losses, draws, name, ID). Team Mafia and shared Business wins credit every winner and record losses for other participants. The shared expandable leaderboard supports all-game and per-game views. Protocol v8 rejects older peers and restores valid v1–v7 tab backups; historical aggregate wins survive, while unavailable historical losses/per-game results are not invented. Spectator admission remains the next room task. No merge or deployment is implied.

### Spectator seats and protocol v9

The host can move admitted guests between player/spectator rosters in the lobby and invite new spectators during play. The host remains a player, matching the original selected-seat rule. Spectators receive explicit seat -1 projections: no card hand/actions, own RPS throw, Mafia role/clues/ballots, or Island cargo/discoveries/hidden points. Public boards, counts, outcomes and final Mafia role reveal remain inspectable. Spectator disconnects do not pause players or earn results. Returning to the lobby clears match state after confirmation while retaining roster identities, aggregate wins and per-game standings; a monotonic round counter prevents recounting results after a game/seat change. Protocol v9 rejects older peers and restores valid v1–v8 backups through fresh invitations. No merge or deployment is implied.

### Scoped offline application

The production redesign now registers its own scope-specific service worker, superseding the earlier foundation-only prohibition on registering a worker in the isolated preview. The original root application/worker and deployment remain unchanged. Installation verifies the complete built asset graph; partial or mixed downloads never activate. Updates wait for an explicit reload action, preserve local/host-tab checkpoints and keep other tabs running. Exact-origin/scope cache ownership and foreign-worker detection protect neighboring apps. One previous complete cache supports older assets after an update; physical-device installation and the separate storage migration work remain release gates.

### Saved-data version 1 and competing tabs

A raw, validated backup now precedes the redesign storage marker and React startup. Existing checkpoint/settings/score shapes remain unchanged, so this does not supersede the original persistence contract or require a new per-game serializer. Unsupported schema versions and failed backups protect existing data while play continues in memory. Web Locks coordinate checkpoint maps, recent games and scores across tabs; per-game expectations reject stale replacement/deletion. Preferences and shelf summaries follow successful storage updates. Moves and confirmed resets finish their persistence attempt before revealing the resulting board/setup, preserving immediate-reload behavior. See [saved games and tabs](storage.md) for private exports, rollback and unsupported-browser limits. Host room backups retain their separate tab-scoped protocol. No merge or deployment is implied.

### OpenAI-compatible developer model pipeline

The user's 2026-10-29 instruction supersedes the native-Gemini default and authorizes changing the retained developer tools. Maintenance now defaults to the locally configured OpenAI-compatible Chat Completions API. Each input collects three independently generated candidates that pass the complete schema and domain contract, then a separate model inference selects and critically reviews an exact candidate. The follow-up instruction supersedes the initial one-attempt policy: each candidate slot and the judge now have a configurable generous attempt limit (12 by default), bounded backoff and shared daily accounting. Invalid shapes and transient transport failures retry; the subsequent user instructions add three parallel candidate requests and fresh candidate/judge rounds after rejection or judge confidence below 5 on an explicit 1–10 scale. Twelve attempts per slot and twelve quality rounds bound retries, with shared daily accounting. No rejected/low-confidence result is promoted; all superseded judgments remain in the audit history, and promotion/read consumers recheck the recorded confidence and three candidate receipts. All attempts retain private receipts. Native Gemini and explicitly configured adapters remain optional paths. Browser games still consume approved static data and contain no API credential or runtime inference. No merge or deployment is implied.
