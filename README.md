# Arcade

A polished, responsive **progressive web app (PWA)** hosting a bunch of games —
single player, two player, board games, and group party games. Built with pure
HTML/CSS/JS (no build step), installable on desktop and mobile, with light/dark
mode, sound, and haptics.

## Game catalog

| Game | Players | Category | Status |
| --- | --- | --- | --- |
| Air Hockey | 2 | Action | Coming soon |
| Snakes & Ladders | 2–4 | Board | Coming soon |
| Ludo | 2–4 | Board | Coming soon |
| Imposter | 3–8 | Party | Coming soon |
| Dumb Charades | 2–8 | Party | Coming soon |
| Tic-Tac-Toe | 1–2 | Puzzle | Coming soon |
| Connect Four | 1–2 | Puzzle | Coming soon |
| Minesweeper | 1 | Puzzle | Coming soon |
| Memory Match | 1–2 | Puzzle | Coming soon |
| Hangman | 1–2 | Word | Coming soon |

## Features

- **Responsive** — mobile, tablet, desktop. Flexible grid + fluid game stages.
- **Light / dark mode** — persists in `localStorage` and can follow the OS.
- **Sound** — synthesized Web Audio (no external assets), works offline.
- **Haptics** — uses the Vibration API when available and permitted.
- **Offline-first PWA** — service worker caches the shell and runtime assets.
- **Personalized** — cookies/web storage retain theme, sound, haptics, active
  game, player names, high scores, and per-game settings.

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
  games/
    <game-id>.js        # one module per game: default export { render(el, game) }
  assets/
    favicon.svg, logo.svg
  CHANGELOG.md          # feature + assumption tracker
```

## Adding a new game

1. Add an entry to `GAMES` in `js/game-catalog.js` (one shape, no extras).
2. Create `games/<game-id>.js` exporting `default { render(el, game) }`.
3. Done — the landing grid and deep link `#/games/<game-id>` pick it up.

See `CHANGELOG.md` for the full history of decisions and assumptions.
