# Classic Arcade UI

The November 2026 refresh restores the original application's compact navigation,
neutral surfaces, system typography and coral accent. The current native React
games, all 34 catalog entries, private rooms, checkpoint formats, offline support
and original route aliases remain in place.

The catalog now opens directly to search, categories and a responsive game grid.
Each card opens its game in one action; there is no separate featured selection
step or duplicate horizontal game shelf. Saved matches remain above the catalog.
The first eight covers load eagerly now that the grid is the main entry point.
Existing commissioned artwork is retained without regeneration or modification.

The theme applies to the header, catalog, setup forms, game headings, match
frames, controls, rooms, sound settings, install controls and footer. All back
links say **All games**. Small screens prioritize controls and the board rather
than setup illustrations. Light and dark mode now theme the entire site instead
of only changing the header. Match tables share a neutral dark playing surface;
game-specific colors still identify suits, seats, terrain and puzzle feedback.
The system theme, explicit preference and browser toolbar color stay synchronized.

`src/theme.css` defines shared page colors. `src/classic.css`, loaded after the
base stylesheet, defines the compact layout and common controls. The base game's
navy/cream surface colors are normalized to neutral materials. Game rules,
persistence and room authority are unchanged.

## Revertible checkpoint

Before editing, the latest production `origin/main` was fetched and preserved:

- Commit: `2674c30a73eb32a85a12aa701d7fdf134118bfb8`
- Pushed tag: `checkpoint/arcade-live-before-classic-2026-11-10`
- Repository: <https://github.com/venkate5hgunda/arcade>

To roll back this refresh after it merges, revert the refresh's merge commit on
`main` (use `git revert -m 1 <merge-commit>` for a merge commit, or `git revert
<commit>` for a squash commit), then push through the normal release workflow.
GitHub Pages rebuilds and republishes the prior UI. Do not reset shared history.
The tag also provides an independent source checkpoint for comparison or recovery.

## Verification

The release uses the existing domain, original JavaScript and Python regressions,
production build/type check, formatting, and browser suites. Catalog tests now
exercise direct card navigation and cover decoding rather than the removed hero.
Theme and navigation expectations reflect the new page title, toolbar color and
**All games** label. Accessibility and overflow checks cover catalog, rooms and
active play in both themes at desktop and mobile sizes.

The local environment lacks WebKit's required system libraries and a supported
privileged package installer. Local mobile checks use Chromium device emulation;
the standard GitHub release suite installs the actual Chromium/WebKit runtimes
and is the required browser qualification before merging. Physical-device sound,
haptics, installation, camera and cross-network limitations remain as documented
in release qualification.
