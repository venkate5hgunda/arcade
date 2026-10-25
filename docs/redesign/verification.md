# Verification

## Foundation acceptance

The milestone must pass type checking, production bundling, inventory/source integrity and real browser navigation/filter/detail/recovery checks. Tests inspect the production build and exercise desktop Chromium and mobile WebKit, including no horizontal overflow and reduced motion. Preview isolation checks assert no local/session storage, IndexedDB databases, service-worker registrations or external requests.

The inventory test hashes the actual baseline Git objects, verifies every cited source/test exists, and checks local documentation links. CI fetches complete history so baseline objects are available. The game/exercise catalog coverage check prevents accidentally omitting a known entry. Screenshots are generated from the built preview.

## Execution evidence

Verified on 2026-10-24 against the source baseline recorded in [the inventory](parity.json):

| Check | Result |
| --- | --- |
| Foundation type check and production build | Passed |
| Foundation inventory / source-hash / documentation checks | 4/4 passed |
| Desktop Chromium + mobile WebKit browser checks | 10/10 passed |
| Automated WCAG A/AA checks on catalog and detail routes | No violations in tested pages |
| Root JavaScript baseline suite | 203/203 passed |
| Desktop and mobile captures | Generated from production build and visually inspected |

Browser coverage traverses every requirement route, filters and searches the live inventory, verifies detail criteria, reload/deep-link behavior, Back navigation, empty search, unknown-route recovery, keyboard input, reduced-motion operation, horizontal overflow and absence of storage/worker/external-request side effects. It is foundation evidence, not evidence that migrated gameplay is complete.

Commands: `npm --prefix redesign run build`, `npm --prefix redesign test`, `npm --prefix redesign run check:format`, `npm --prefix redesign run test:browser`, `npm --prefix redesign run capture`. Browser tests use the built preview; baseline JavaScript tests use the existing root runner. Dependencies are exact-pinned with package-local locks.

Arcade's JavaScript baseline passed on Node 22, matching its CI configuration. On local Node 26, the existing lobby progressive-disclosure fixture failed at `test/multiplayer.test.js:1229` (Your name field visibility). No production game source changed; use Node 22 for the baseline runner until its fixture/runtime compatibility is reviewed. The Python movie pipeline passed 80/80, including the HTTP private-file-denial test, with local-server permission.

## Trace findings and fixes

The trace covered source registries and UI entry points, domain transitions, data keys/checkpoints, lifecycle cleanup, multiplayer/private views or reminder/push authority, PWA assets, existing regressions, current remote decisions, new package dependencies, documentation references and CI/test discovery.

A missed trace of Node's automatic root test discovery initially let it execute nested Playwright specs with the wrong runner. The new package now keeps checks under `redesign/checks/` and invokes inventory checks explicitly; original root test discovery passes independently. The browser pipeline also caught persistent empty-search state on Pick's recovery route; home navigation clears transient filters. These corrections were verified before committing.

The React production build reports dependency-level `use client` directive warnings from React Router; these directives do not control this entirely client-rendered application. Builds and both browser engines pass. Svelte's checker currently supports TypeScript 5/6, so Pick pins 6.0.3; the React packages pin 7.0.2. Dependency resolution was verified without force or legacy-peer overrides.


## Remaining release work

All parity entries are planned. No legacy gameplay flow, saved-data migration, offline installation, production push subscription, multiplayer recovery or real-model qualification has been implemented or requalified by this foundation. Existing tests are baseline evidence and remain required during later implementation. Full game/practice flows, keyboard/screen-reader behavior, light/dark palettes and physical device sound/haptics/push need feature-specific sign-off.
