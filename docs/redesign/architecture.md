# Target architecture

## Decision and scope

Use **React + TypeScript + Vite + React Router**. This supersedes the original no-frontend-build constraint for the redesign, following the framework discussion and explicit redesign request. The existing root app remains the behavior reference during phased migration. The foundation milestone remains the source inventory; Phase 2 implements the selected Living Game Shelf, local Tic-Tac-Toe and a two-browser room duel.

Vite builds static assets; hash navigation keeps preview deep links independent of server rewrites. A production route scheme will preserve existing inbound hashes or supply an explicit alias adapter. Runtime servers are introduced only for features that need them. Dependencies are exact-pinned with a separate lockfile; upgrades receive their own review.

## Ownership

```text
User input → route/view → feature controller → domain transition
                                    ↓                ↓
                             effects adapter ← committed result
                                    ↓
                           persistence / transport
```

- `redesign/src/App.tsx` owns the shelf, header and route composition; `src/features/Game.tsx` and `Room.tsx` own playable flows.
- `redesign/src/lib/catalog.ts` adapts the durable parity inventory for the retained requirements explorer. `games.ts` owns the typed catalog, `tictactoe.ts` pure rules, `profile.ts` the baseline-shaped preferences/scores/recent entries, and `session.ts` expiring checkpoints. Production logic is not imported into this preview.
- `redesign/src/styles.css` owns shared layout; `theme.css` owns this product's tokens. Avoid scattered override stylesheets.
- Add `src/features/<feature>/` for cohesive view/controller code when that feature is implemented, `src/domain/` for pure rules, `src/platform/` for browser persistence/audio/timers/network, and `src/components/` for genuinely shared controls. Do not create empty abstraction layers in advance.
- `docs/redesign/` owns requirements, decisions, migration and evidence. `docs/images/` owns actual browser captures. Existing root source/tests remain the reference during migration.

## State and lifecycle

Local view state controls disclosures, filters and temporary inputs. Durable domain state owns user progress/game outcomes. Components subscribe to committed snapshots and dispatch intentions. Do not mirror durable state into a competing UI store. All timers, animation frames, listeners, network requests and workers have explicit ownership and cleanup. Late results carry session/route identity and cannot mutate a replacement view.

Randomness, time and identifiers are injected into pure rules so tests can replay transitions. Cryptographic randomness remains the production choice where outcomes require it. Animation visualizes a chosen result; frame rate cannot change that result. Persistence adapters distinguish a committed write from an in-memory optimistic update.

## Routes and composition

Target product surfaces: Catalog, game/:id, room lobby, invitation/answer handoff, game setup, settings/help. Routes within the hash are `/`, `/game/:id`, the original `/games/:id` alias, `/room` and `/requirements/:id`. Unknown feature routes provide recovery; route changes focus the heading. Catalog search and category buttons are accessible native controls. The browser tests cover actual built navigation and data rendering.

## React and game boundaries

React owns catalog, lobby, setup, help, dialogs and accessible board/card interfaces. React Router handles routes; feature controllers own games. Keep game rules in plain typed functions with serializable state and validated action/result types. A typed registry maps the 26 stable IDs to lazy feature loaders, player limits, room support and checkpoint versions.

Evaluate Phaser only for physical games where input/scene/physics tooling reduces maintenance. It is not installed at this foundation milestone. Puck/ball/frame positions remain in the renderer's animation loop; React receives score, phase and outcome events. DOM/SVG remains suitable for inspectable boards/cards and accessible controls.

Model multiplayer through a transport interface and an authority controller. Preserve validated host actions, private per-seat views, round/revision checks and reconnect checkpoints. A future signaling/TURN service may improve admission and network reach, but requires its own decision covering operation cost, privacy, failure and abuse. Shared rooms must not accidentally grant guests authority over hidden game state.

## Delivery, PWA and security

The redesign serves on loopback on a dedicated port, imports only its own runtime code and public parity JSON, and never registers a service worker. Local data uses the original `arcade:` formats; room host checkpoints use a tab-scoped redesign-specific key. The first room controller supports exactly two named seats, public Tic-Tac-Toe and Connect Four snapshots, host-owned results, and round/revision validation. It is deliberately independent of the broader legacy room wire protocol. Real WebRTC creates offers/answers and encrypted data channels; a factory permits domain tests to supply a transport. Vite's filesystem allowlist is restricted to the package and `docs/redesign/`. Build output is not deployed by existing production workflows. A new branch-scoped workflow builds and browser-tests the foundation with read-only permissions.

Before product rollout, introduce a dedicated manifest, asset graph and scope-owned service worker, then test install/update/offline behavior. Avoid CDN runtime dependencies. Static hosting must include the correct repository base path and all lazy feature assets. Use a separate preview origin for any later migration experiments so production storage and workers cannot be modified accidentally.

Treat imported content as text and validate serialized input at boundaries. Keep secrets server-side. Preserve content/art licenses. Add dependencies only where they remove a concrete responsibility; TypeScript is shared across UI, domain types and adapter contracts.

## Design direction

Retain the app's identity while improving clarity and movement. The approved option 2, Living Game Shelf, supersedes the temporary geometric foundation. Use navy/coral/cream/teal, a wide illustrated stage and horizontal selected-game shelf. Original Firefly family illustrations and existing Tabler/Arcade assets are local; see artwork.md. Future game/exercise views require task-specific original artwork, visible action/state feedback, compact secondary settings and full keyboard/touch behavior. Visual approval is based on real desktop/mobile flows and captures, including light/dark and reduced motion.

## Test-runner isolation

Foundation checks live under `redesign/checks/`, with an explicitly invoked `inventory.check.mjs` and Playwright specs. The baseline repos use Node automatic test discovery; a nested `test/` directory would cause Node to execute Playwright specs with the wrong runner. Keep the new package checks explicit so root test commands remain independent.

## Puzzle-family boundary

`lib/puzzles.ts` owns pure transitions and validators. `features/Puzzles.tsx`
owns setup/React rendering and cancels all playback, mismatch, AI and movement
timers. `lib/checkpoints.ts` dispatches validation per game and distinguishes
migrated room capability from the baseline registry's eventual room support.
The shared room snapshot carries an optional `gameId`; absent IDs are restored
as Tic-Tac-Toe for compatibility with the first milestone. Both games still
validate seat, round and revision at the host; guests cannot select a new game
or publish state.
