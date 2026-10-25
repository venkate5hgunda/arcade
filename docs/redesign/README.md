# Arcade redesign

A new implementation of the existing product, grounded in its complete observable behavior.

**Milestone 1: requirements, architecture and runnable foundations.** No migrated gameplay is claimed. The original application remains the behavior reference. The foundation is a working, responsive feature explorer with navigation, category filters, search, acceptance details and explicit planned status.

| Document | Purpose |
| --- | --- |
| [Requirements](requirements.md) | Feature groups, acceptance criteria and source/test evidence |
| [Architecture](architecture.md) | Target stack, ownership, state and rendering boundaries |
| [Migration and decisions](migration.md) | Data contracts, prior decisions, phases and rollout |
| [Verification](verification.md) | Checks performed, results and remaining release gates |
| [Parity inventory](parity.json) | Machine-readable requirements consumed by the foundation |
| [Source snapshot](source-snapshot.json) | SHA-256 file inventory at the baseline commit |

Baseline: [`ae1136d6e544`](https://github.com/venkate5hgunda/arcade/commit/ae1136d6e544784811e5c334ee76d6c54b6921a3) from refreshed `origin/main`. Branch: `codex/redesign-foundation`. Stack: **React + TypeScript + Vite + React Router**. Baseline evidence means inspected source and existing regression tests; it does not claim every existing game flow was manually revalidated during this milestone.

## Run the foundation

From the repository root, use Node 22.12+ (or a newer Vite-supported LTS):

```sh
npm --prefix redesign ci
npm --prefix redesign run dev
# http://127.0.0.1:5174
```

```sh
npm --prefix redesign test
npm --prefix redesign run build
npm --prefix redesign exec -- playwright install chromium webkit
npm --prefix redesign run test:browser
```

`npm --prefix redesign run capture` refreshes the documentation screenshots after a successful build.

Browser tests run the production build with Chromium desktop and WebKit mobile. The ports differ across the three repos, so all previews can run together. Dependencies, lockfile and build outputs are local to `redesign/`. Build/test output lives under its already-ignored `node_modules/.cache/`; no ignore-rule changes are required. Root commands continue to run the baseline app.

## Preview

![Desktop foundation](../images/redesign-desktop.png)

![Mobile foundation](../images/redesign-mobile.png)

The preview uses no production storage, service worker, account, notification subscription or remote API. The artwork is original CSS geometry and all resources are local. It is an architectural starting point, not a replacement release.
