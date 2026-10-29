# Offline play and installation

The production build includes a manifest, the original Arcade install icons, and a complete local asset graph. `Offline & install` in the footer reports download status, offers installation when the browser supports it, and checks for updates. On iPhone/iPad, use Share → Add to Home Screen. Installation events and standalone display mode are checked in browsers; actual OS installation and physical-device behavior remain release qualification.

## Offline coverage

Every build hashes its HTML, JavaScript, CSS, fonts, 26 game illustrations, boards, QR generator/scanner/worker, word lists and approved movie index/partitions. The worker verifies every response before marking the cache complete. A failed or mixed deployment is discarded; the previous active release stays usable. No remote image, audio or model service is required for local games. Rooms require a connection between players; camera permission and cross-network WebRTC still depend on the device/network.

## Update and scope rules

A new release waits until **Update and reload** is selected. Local checkpoints remain in their original `arcade:` shapes; hosts retain tab-scoped room backups, and guests reconnect after reload. Other open tabs continue without forced navigation and show guidance to reload when ready. One previous complete release is retained for its older hashed assets. Tabs left open across several later updates should be reloaded before relying on offline recovery.

Caches include the exact origin and app scope in their name. Activation cleans only that namespace, removes interrupted-install caches and retains the previous verified release. Requests outside the scope or origin are untouched. Existing production/foreign service workers are preserved; the redesign refuses registration under a conflicting controller and asks for an isolated preview origin. It never unregisters the original worker or changes the original app's deployment.

Serve the contents of `redesign/node_modules/.cache/redesign-dist/` over HTTPS (localhost also works), at the root of an origin or a correctly scoped directory. The existing movie asset pipeline and relative build paths support either layout. Root repository commands still serve the original app for migration comparison. The user authorized production deployment of this artifact on 2026-10-29.

## Evidence and limits

- `redesign/checks/unit/pwa.check.ts`: deterministic graph/content hashes, worker-code versioning and quota-failure cleanup.
- `redesign/checks/browser/pwa.spec.ts`: real offline reload, every cached file, all game routes, complete offline play, install acceptance/cancellation and standalone display state.
- `redesign/checks/browser/pwa-lifecycle.spec.ts`: actual waiting-worker activation, checkpoint retention, old-tab preservation, neighboring scopes, corrupt downloads, interrupted caches and foreign worker preservation.
- Other browser suites block workers because they deliberately intercept asset/movie failures; the dedicated PWA suites explicitly allow real workers.

Storage version migration and competing-tab save coordination are implemented and verified; see [saved games and tabs](storage.md). Browser event injection and display-mode emulation do not prove physical OS installation, camera focus, audible output, vibration or cross-network transport.
