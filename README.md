# Arcade

A polished, responsive **progressive web app (PWA)** hosting a lot of games —
single player, two player, board games, and group party games. Built with pure
HTML/CSS/JS (no build step), installable on desktop and mobile, with light/dark
mode, sound, and haptics.

## Game catalog

| Game | Players | Category | Status |
| --- | --- | --- | --- |
| Air Hockey | 2 | Action | ✅ Implemented |
| 8-Ball Pool | 2 | Action | ✅ Implemented |
| Whack-a-Mole | 1 | Action | ✅ Implemented |
| Snakes & Ladders | 2–4 | Board | ✅ Implemented |
| Ludo | 2–4 | Board | ✅ Implemented |
| Chess | 1–2 | Board | ✅ Implemented |
| Imposter | 3–8 | Party | ✅ Implemented |
| Dumb Charades | 2–8 | Party | ✅ Implemented |
| Rock Paper Scissors | 1–2 | Party | ✅ Implemented |
| Blackjack | 1 | Cards | ✅ Implemented |
| Crazy Eights | 2 | Cards | ✅ Implemented |
| Tic-Tac-Toe | 1–2 | Puzzle | ✅ Implemented |
| Connect Four | 1–2 | Puzzle | ✅ Implemented |
| Minesweeper | 1 | Puzzle | ✅ Implemented |
| Memory Match | 1–2 | Puzzle | ✅ Implemented |
| 2048 | 1 | Puzzle | ✅ Implemented |
| Simon Says | 1 | Puzzle | ✅ Implemented |
| Hangman | 1–2 | Word | ✅ Implemented |
| Word Scramble | 1 | Word | ✅ Implemented |

## Features

- **Responsive** — mobile, tablet, desktop. Flexible grid + fluid game stages.
- **Light / dark mode** — persists in `localStorage` and can follow the OS.
- **Sound** — synthesized Web Audio (no external assets), works offline.
- **Haptics** — uses the Vibration API when available and permitted.
- **Offline-first PWA** — service worker caches the shell and runtime assets.
- **Personalized** — local storage retains theme, sound, haptics, high scores,
  per-game settings and unfinished local rounds.
- **Setup flow** — every game opens with a lightweight options screen (player
  count, difficulty, mode, timer, etc.) before play starts; choices persist
  per game.
- **Recently played** — the home screen surfaces your last few games (deduped,
  most-recent-first) above the full catalog for quick re-entry.
- **Return to play** — opening the arcade starts at home unless the most
  recently active game has an unfinished saved round. Each game has a
  pace-appropriate inactivity window: 2–5 minutes for quick and timed games,
  8–20 minutes for puzzles, cards and physical games, and up to 45 minutes
  for chess. Once its window expires, its saved round is discarded; setup
  choices and high scores remain. Remote rooms are tab-bound and do not
  auto-resume.

The windows are **2 min** for Whack-a-Mole; **3 min** for RPS; **5 min** for
Blackjack, Dumb Charades and Simon; **8 min** for Tic-Tac-Toe; **10 min** for
Air Hockey, Hangman and Word Scramble; **12 min** for Connect Four and Memory;
**15 min** for Crazy Eights, Imposter, Minesweeper and Pool; **20 min** for
2048 and Snakes & Ladders; **30 min** for Ludo; and **45 min** for Chess.
- **Per-game "vibe"** — each game has its own accent palette/theme layered on
  top of the shared shell, so the arcade doesn't feel like one reskinned game.
- **Arcade-room design** — layered stage lighting, cabinet-like cards and
  physical board surfaces in both themes, a vivid marquee-style header with
  distinct room, sound, vibration and theme controls, and reduced-motion support.
- **Physical play** — 8-Ball Pool and Air Hockey share a fixed-step disc
  simulation. Pool has rack, collisions, pockets, scratches and house-rule
  8-ball play; air hockey has moving paddles, puck impacts and goals.
- **Board-table dice** — Snakes & Ladders and Ludo use tumbling 3D dice
  adapted from Pick's tabletop animation. Snakes & Ladders draws varied
  snakes and ladders on each new board with square numbers above the artwork;
  Ludo uses a full 52-square cross
  track and lets the player select which legal token to move.
- **Room play** — one persistent WebRTC room connects devices for repeated
  games. The host assigns active seats in the lobby; extra guests may watch
  the lobby until selected. Supports Tic-Tac-Toe, Connect Four, Chess,
  Rock Paper Scissors, Snakes & Ladders and Ludo (2–4 players for the board
  games). Other games remain local-only.

## Playing together on separate devices

1. Tap **↗** in the header, enter a name and select **Host room**.
2. Select **Create guest invite** and share its link (Web Share API when
   supported, or copy/paste). Create a new invite for each additional guest.
3. A guest opens that link in the arcade, enters a name and selects
   **Join and create answer**. They share the resulting **answer link back**
   to the host, who pastes it into **Accept answer** in the **original host
   tab**. Opening the answer in a new host tab loses that tab's pending
   connection. Repeat for each guest.
4. The host admits guests and selects the seats in the lobby, then chooses
   a supported game. Return to the lobby at any time to start another game
   over the same connections.

**Constraints shown before starting:** This static-hosted PWA has no
signaling or TURN server. Both links must be exchanged manually, and some
messaging apps truncate long SDP links. Direct WebRTC connections usually
need internet for public STUN discovery and can fail behind restrictive
firewalls or symmetric NAT. Rooms live only while tabs remain open; remote
play is not available offline. **Downloaded game assets remain playable
locally offline** after the service worker has completed its first install.

## Running locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Project layout

```
arcade/
  index.html            # shell: header, theme/sound/haptics toggles, game stage
  manifest.json         # PWA manifest
  sw.js                 # service worker (offline caching)
  css/styles.css        # theme tokens + component styles
  js/
    app.js              # entry point
    storage.js          # localStorage wrapper + KEYS
    theme.js            # light/dark/auto
    audio.js            # Web Audio synthesis
    haptics.js          # Vibration wrapper + toggle UI
    game-catalog.js     # single source of truth for all games
    router.js           # hash-based router + landing grid
    game-session.js     # per-game resume windows and local checkpoints
    game-shell.js       # shared chrome for game views
    game-utils.js       # shared board game helpers
    dice.js             # tabletop die animation
    disc-physics.js     # fixed-step puck / ball dynamics
    multiplayer.js      # shared WebRTC room + two-link signaling
    remote-match.js     # room seat and turn helpers
  games/
    <game-id>.js        # one module per game: default export { render(el, game) }
  assets/
    favicon.svg, logo.svg
  css/board-games.css, css/physical-games.css, css/card-games.css,
    css/multiplayer.css
  CHANGELOG.md          # feature + assumption tracker
```

## Adding a new game

1. Add an entry to `GAMES` in `js/game-catalog.js` (one shape, no extras).
2. Create `games/<game-id>.js` exporting `default { render(el, game) }`.
3. Add `./games/<game-id>.js` to `STATIC_ASSETS` in `sw.js` and bump the
   cache version so the new game works offline immediately after installation.
   Add a resume window in `js/game-session.js` and checkpoint unfinished
   gameplay via the `session` argument passed to `render`. The landing grid
   and in-app route `#/games/<game-id>` now pick it up.

See `CHANGELOG.md` for the full history of decisions and assumptions.

## Scope notes

- A game link opened in a new tab lands at home unless this browser has an
  unexpired unfinished local round. Game routes still work during an active
  visit. This prevents stale bookmarks and completed rounds from dropping
  the player into a new game without choosing it.
- **Chess** implements checkmate, stalemate, and insufficient-material draws,
  but not draw-by-repetition or the 50-move rule — a deliberate scope limit
  for a casual pass-and-play/AI opponent experience.
- **Pool** uses simplified 8-ball house rules; there is no called pocket or
  tournament break requirement.
