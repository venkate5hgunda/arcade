# Arcade editorial UX review

Status: passed for the original Arcade editorial redesign.

## Target and evidence

The user clarified that the supplied game recording is inspiration for an original Arcade redesign, with minimal visible copy, responsive game feedback and secondary details in pop-up menus. This is an original application implementation, not a reproduction of NYT branding, imagery or puzzle content.

Source visual truth: the user-supplied `ScreenRecording_11-21-2026 10-58-27_1.mp4` attachment. The source has a portrait phone composition at roughly 393 × 852 CSS pixels (1180 × 2556 source pixels). The redesign does not include source imagery.

Implementation evidence: `redesign/node_modules/.cache/editorial-strands.png`, `editorial-wordle.png`, `editorial-blackjack.png`, `editorial-snakes-ladders.png` and `editorial-spelling-bee.png`. Browser viewport: 390 × 844 CSS pixels, device scale factor 1; captures are full-page, so their pixel height includes below-viewport content. Density comparison uses the app-owned content proportions rather than device chrome. Content and puzzle states intentionally differ because Arcade retains its original bundled puzzles. Screenshots are of the original Arcade implementation.

Full-view review: the plain letter field, compact theme banner, restrained navigation, progress row, thin borders and light canvas now establish the requested hierarchy. Focused review covers the Strands banner/grid/controls and Wordle cells/keyboard. Existing distinct game artwork remains local and unchanged.

## Required fidelity surfaces

- Typography: Arial/Helvetica for controls and board letters; regular-weight letter fields and clear numerical state. Georgia provides an original Arcade wordmark and editorial game headings. Long names wrap without document overflow.
- Spacing: decorative table shells are removed; phone layouts prioritize boards and primary actions. The shared Menu button is beside the game heading. Strands and Wordle size their fields against available viewport height; short screens may scroll while preserving useful touch targets.
- Colors: neutral surfaces, black primary buttons, hairline borders, blue found paths, gold spangrams and gray active tracing. Game-specific suits, seats and terrain remain semantic. Dark mode retains legible surfaces and controls.
- Assets: existing inspected Arcade covers and local icons are retained. No NYT branding, headlines or website imagery is used. Game paths are functional geometry, not decorative image substitutes.
- Copy: rules and secondary game/room records open in modal menus; essential scores, turns, errors and results remain visible. Room introduction and room-entry labels are shortened. Technical release links are removed from the product footer.

## Comparison history and fixes

1. P1: heavy dark table panels and ornamental gradients dominated the game. Replaced them with neutral shared surfaces and retained only meaningful board colors. Post-fix evidence is in the listed original Arcade captures.
2. P2: light surfaces exposed pale legacy labels, timers and roster captions. Updated these consumers and retained accessible seat colors. Added an all-game phone-width accessibility check.
3. P2: repeated prose and secondary details distracted from play. Added native modal menus, compact visible labels and a top-level Menu trigger; preserved operational feedback.
4. P2: modal focus and lifecycle needed explicit verification. Added focus wrapping, Escape/backdrop/Close dismissal, focus restoration, propagation guards and action dismissal. Dialog contents mount only while open.
5. P2: tests used inline-disclosure workflows and stateful checkbox methods on controls that disappear when a seat changes. Updated tests to close modal records before returning to play and assert the actual seat-control replacement. Privacy, recovery and complete-game assertions remain intact.

## Checks and remaining limits

Primary interactions checked include tracing, submission, reload recovery, game completion, keyboard navigation, modal help, seat changes, private hands/roles, real rooms and reduced motion. Browser checks record page errors and automated accessibility findings. Existing board/canvas physics and authoritative game rules remain unchanged.

Mobile-width Chromium verification is included. Native WebKit cannot launch in this workspace because system runtime libraries are unavailable; physical touch, audio/haptics and separate-network qualification remain unverified. These are runtime qualification limits, not claims of completed device testing.

Verification: root tests pass (31), redesign inventory checks pass (5), domain checks pass (114), formatting and production build pass. The full desktop browser run identified fourteen issues among 140 scenarios; those cases were corrected and passed targeted reruns. The final eight-case run passes, including all-game phone-width accessibility, popup focus and complete spectator recovery. Reduced-motion and sound checks also pass. Three platform-specific cases in the broad desktop run were skipped by their existing conditions.

No actionable P0/P1/P2 design findings remain. Device qualification limitations above remain explicit.

final result: passed
