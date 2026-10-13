# Development guide

Run the app locally, understand the layout and add a new game.

[← Back to the README](../README.md)

```bash
python3 dev/serve.py
# open http://localhost:8000
```

`npm start` runs the same server. It blocks `.env`, hidden files and `dev/`
data. For intentional LAN access, use `python3 dev/serve.py --bind 0.0.0.0`;
phone camera scanning still requires HTTPS. Avoid generic static servers when
local credentials are present.

## Project layout

```
arcade/
  index.html            # shell: header, theme cycle and sound/feel panel, game stage
  manifest.json         # PWA manifest
  sw.js                 # service worker (offline caching)
  css/styles.css        # theme tokens + component styles
  js/
    app.js              # entry point
    storage.js          # localStorage wrapper + KEYS
    theme.js            # light/dark/auto
    audio.js            # Web Audio synthesis
    haptics.js          # Vibration wrapper and saved preference
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

See [CHANGELOG.md](CHANGELOG.md) for the full history of decisions and assumptions.
