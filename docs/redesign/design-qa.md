# Living Game Shelf design QA

**Final result: passed** — no open P0/P1/P2 findings for the first-game milestone.

## Visual evidence and normalization

- Source: [approved option 2](../images/redesign-reference.png), 1487 × 1058 pixels. The generation prompt targeted 1440 × 1024; comparison scales the returned raster to that CSS viewport (approximately 0.968×).
- Implementation: [desktop shelf](../images/redesign-desktop.png), 1440 × 1024 pixels at 1×; [mobile shelf](../images/redesign-mobile.png), 1170 × 1992 pixels at 3×, representing a 390 × 664 CSS viewport.
- [Combined full-view comparison](../images/redesign-comparison.png) places the normalized reference and browser-rendered implementation together, both with **Air Hockey selected**. The default implementation uses the ready-to-play Tic-Tac-Toe stage.
- [Focused hero comparison](../images/redesign-detail-comparison.png) compares title, copy, mode information and primary action at the same normalized crop.
- Active gameplay: [desktop](../images/redesign-game-desktop.png) and [mobile](../images/redesign-game-mobile.png). The mobile board ends at CSS y=652 in the 664px viewport; all nine cells are visible.

The in-app browser was also opened and visually inspected at its narrow panel width. The play action is fully visible before the artwork, and room/theme controls stay on one row.

## Findings resolved and comparison history

1. **P1 — mobile primary action below the first viewport.** Initial capture placed the play button at y=651–709 in a 664px viewport. The mobile layout now puts the actionable game summary before the illustration and reduces the illustration to 160px. The recaptured mobile screen shows the complete play button above the artwork. A browser assertion guards its bottom edge.
2. **P2 — distorted wide hero.** The family atlas stretched circular pieces into ovals on the desktop stage. Atlas tiles now preserve their native proportions; Tic-Tac-Toe uses a separately generated wide scene with a verified nine-cell board. The current desktop capture shows circular O pieces and a correctly proportioned board.
3. **P2 — selected game and shelf inset.** The ready game initially sat outside the initial shelf viewport, and scroll snapping consumed its leading padding. Implemented entries sort first on the shelf; scroll padding preserves the inset. The current capture shows the selected Tic-Tac-Toe cover and coral selection ring immediately.
4. **P2 — mobile last row clipped.** The initial active board ended at y=675. Compact game heading/back-link spacing now brings it to y=652. Gameplay was recaptured and the browser test checks the full board bounds.
5. **P2 — Linux desktop header overflow.** The first CI run exposed a missed trace of fallback-font width at the 1280px test viewport. The category row now wraps below 1400px. Overflow assertions include measured regions for diagnosis; the desktop 1440px reference layout stays on one row.

## Fidelity surfaces

- **Typography:** a rounded, heavy display hierarchy, small uppercase category labels, and readable 14–18px copy reflect the source. The reference does not identify a licensed font; the implementation uses local Avenir Next/Trebuchet/system fallbacks. Header wrapping accounts for different platform metrics. Headlines remain live text, with no clipping or faux raster text.
- **Spacing/layout:** a 60/40 illustrated stage, horizontal cover shelf, navy header and cream collection preserve the major regions. Padding and card dimensions are consistent. Mobile reorders the summary before artwork to keep play immediately useful. Secondary configuration/help stays expandable.
- **Color/tokens:** navy/cream/coral/teal map to shared tokens. Coral selection and play actions, mint O and coral X remain distinct. Automated WCAG A/AA checks report no violations on the tested catalog, setup, board and room screens. Reduced-motion mode removes movement.
- **Images/icons:** all 26 games now have individual inspected covers following the [art guide](art-guide.md). The [manifest](artwork-manifest.json) records provenance and prompts; shared family scenes are retired. Desktop/mobile hero selection and image decoding are checked for every cover. Existing branding and icon credits remain intact.
- **Copy/content:** stable catalog IDs/names/player limits are preserved. The reference's invented Block Blast entry, fake recents and incorrect Air Hockey room counts are omitted. Unported games use an explicit original-Arcade handoff; no unfinished game is presented as playable in the redesign.

## Verification and accepted scope differences

The browser suite covers selection/filter/search, route aliases, local/AI matches, player names, win/reset/rematch, resume/reload, storage denial, room admission, real WebRTC turns, result synchronization and host recovery on Chromium and WebKit. Page errors are checked in catalog and room flows. Navigation disposes pending AI timers. The viewport checks guard overflow, the play action and the entire mobile board.

The source is visual direction, while Phase 2 is the agreed implementation scope: Tic-Tac-Toe is the default ready game; empty recent/resume areas reflect real storage; sound is not shown as a nonfunctional control; the other 25 games remain original-app links. No claim is made of physical-device, audio, offline installation or cross-network qualification.

## Follow-up polish

P3: individual illustrations for the remaining game migrations can replace shared family covers when those games are implemented. Those migrations, full sound/auto-theme and release qualification remain in the [backlog](backlog.md).

final result: passed
