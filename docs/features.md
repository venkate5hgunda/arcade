# Features

What the arcade shell and individual games offer.

[← Back to the README](../README.md)

- **Responsive** — mobile, tablet, desktop. Flexible grid + fluid game stages.
- **Theme** — header control cycles Auto → Light → Dark; Auto is the default
  and follows the device. Your choice persists in `localStorage`.
- **Sound** — synthesized Web Audio (no external assets), works offline and
  retries interrupted effects after the next mobile-browser audio unlock.
- **Touch feedback** — immediate light press sounds and haptics on game controls,
  with distinct game sounds for goals, collisions, dice and wins. Buttons
  bypass double-tap delay; Air Hockey pointer targets use a faster, fixed-step
  paddle path. Game vibration requires the browser's Vibration API. On iOS,
  tapping the native switch in **Sound & feel** can provide tactile feedback,
  but browser games cannot reliably trigger arbitrary haptics.
- **Offline-first PWA** — service worker caches the shell and runtime assets.
- **Personalized** — local storage retains theme, sound, haptics, high scores,
  per-game settings and unfinished local rounds.
- **Setup flow** — games with options show a concise selection summary and
  a collapsed **Game configuration** section (player count, difficulty, mode,
  timer, etc.). Start immediately with the current choices or expand to customize;
  choices persist per game. Help and player names live under **Help & player options**.
  Island Charter explains harbor, appearance and neighboring-tile choices.
  The top reset button briefly confirms a restart (or a restart
  request in a room).
- **How to play** — every cabinet has a quick help dialog with three illustrated
  steps, controls, available options and a goal. Moves and impacts are animated
  when motion is enabled; 2048 shows slides before merges and new tile spawns.
- **Victory moments** — earned wins announce the winning player (or team) with
  confetti, sound and haptics; the visual effects respect reduced-motion settings.
  Set local player names from the game header or use names chosen on joining a
  room. Room guests only celebrate their own victories.
- **Recently played** — the home screen surfaces your last few games (deduped,
  most-recent-first) above the full catalog for quick re-entry.
- **Return to play** — refreshing or reopening the arcade preserves the current
  page: an open game stays open, while returning home stays home even with
  unfinished rounds. Home shows a temporary resume banner for every unfinished
  game; it disappears when the rounds end or expire. Each game has a
  pace-appropriate inactivity window: 2–5 minutes for quick and timed games,
  8–20 minutes for puzzles, cards and physical games, and up to 45 minutes
  for chess, two hours for Island Charter, or four hours for Business. Once its window expires, its
  saved round is discarded; setup choices and high scores remain. Remote
  rooms are tab-bound and do not
  auto-resume.
- **Navigation** — browser Back and Forward move between visited games and
  home; Alt+Left/Right or Cmd+[/] work as keyboard shortcuts.
- **Guided rooms** — the lobby highlights the next action: create or join,
  share an invitation, return an answer, then choose seats and a game once
  connected. Sharing includes a friendly message, three concise connection
  steps and the full link; clipboard fallback copies the same message.
  Reconnect invitations name the original seat and explain how paused play
  resumes. Native sharing embeds the link in the text for text-only targets.
  A mismatched reconnect name cancels that invitation without losing the seat
  or game; create a fresh invite and use the original name.
  QR codes, raw-link copying, room management and standings stay in expandable
  sections. Each guest needs a unique invite and must keep their tab open;
  hosts accept answers in the original tab.

The windows are **2 min** for Whack-a-Mole; **3 min** for RPS; **5 min** for
Blackjack, Dumb Charades and Simon; **8 min** for Tic-Tac-Toe; **10 min** for
Air Hockey, Hangman and Word Scramble; **12 min** for Connect Four and Memory;
**15 min** for Crazy Eights, Imposter, Minesweeper and Pool; **20 min** for
2048, Snakes & Ladders and UNO-inspired; **30 min** for Ludo; **45 min** for
Chess; **120 min** for Island Charter; and **240 min** for Business.

- **Business** — an original 2–6-player Indian-city property trading
  game with local handoffs or host-authoritative private WebRTC rooms,
  auctions, rent, even development, mortgages, jail, cards, cash-raising
  and bankruptcy. Its illustrated city table has distinctive player
  pieces; inspect any board space for its full price and rent ladder before
  bidding or buying. The current actor's decisions stay above the
  scrollable board on phones. Configuration and edition differences are in
  [Business rules](rules/business.md).
- **Per-game "vibe"** — each game has its own accent palette/theme layered on
  top of the shared shell, so the arcade doesn't feel like one reskinned game.
- **Arcade-room design** — layered stage lighting, cabinet-like cards and
  physical board surfaces in both themes, a vivid marquee-style header with
  labeled room, Sound & feel and theme controls, and reduced-motion support.
- **Game artwork** — each catalog card and game header has a distinct,
  locally hosted SVG icon. Category filters and shared controls use matching
  UI icons; all artwork remains available offline.

- **Physical play** — 8-Ball Pool and Air Hockey share a fixed-step disc
  simulation. Pool has rack, collisions, pockets, scratches and house-rule
  8-ball play; air hockey has acceleration-limited paddles, impact-dependent
  puck velocity, grippier table drag that checks gentle taps while firm
  strikes carry, collisions, rebounds and goals. After
  the opening faceoff, the puck rests at center until either player strikes it.
  After a goal, it rests on the non-scoring player's half until they strike it.
- **Island Charter** — a 3–4-player hex-settlement strategy game with an
  illustrated SVG island, distinct buildings, recognizable resource and dice artwork,
  production, trading, harbors, discoveries and ten-point victory. Play by
  private handoff or in a room. Choose **Classic positions** for the same nine
  coastal harbors and exchange rates on every island, or **Changing positions**
  to redistribute nine non-overlapping harbors each new island. Harbor choice
  persists across resets, local resumes and room reconnections. Paired piers
  connect each offshore harbor marker to exactly two coastal outpost junctions;
  only an outpost or city on either junction unlocks that harbor's trade rate.
  Setup also offers
  **Illustrated** or **Colorblock** land and four independent adjacency switches:
  whether 6/8, 2/12, identical numbers or identical land types may touch.
  All four default to no; the choices persist across resets and room recovery.
  Brick, Wood, Wheat, Ore and Sheep use richer color-coded cargo cards;
  resource symbols appear on colorblock land, in cargo, building costs and
  their corresponding harbors;
  the original art and wording avoid commercial board-game assets.
- **Board-table dice** — Snakes & Ladders and Ludo use tumbling 3D dice
  adapted from Pick's tabletop animation; Island Charter uses the same shared
  engine for two dice, including host-authoritative room rolls and opening order.
  The final faces remain visible briefly
  before an automatic move or turn change. Snakes & Ladders draws varied
  non-intersecting snakes and ladders on each new board, including a large snake
  from square 99 into the bottom half, with square numbers placed clear of snake
  heads. Larger player emblems travel square by square, climb ladders
  or slide through snakes. Nearby snakes hiss, flick their tongues and sway
  their tails; nearby ladders wobble. Ludo pieces follow the track and return
  captured pieces to their yards. Matching Ludo pieces have no visible numbers,
  and the active player's home glows until the turn ends. Both boards honor
  reduced-motion preferences; Ludo uses a full 52-square cross track and lets
  the player select which legal token to move.
- **Mafia** — a 5–10-player, room-only social deduction game. Each person
  receives a private role; the host coordinates night actions, secret votes
  and recovery without broadcasting hidden information. See [Mafia rules](rules/mafia.md).
- **Island Charter** — original presentation of classic hex-settlement rules
  for 3–4 players: everyone rolls two dice for opening placement order; ties
  reroll, the highest places first and last, and the lowest places twice in
  succession. The whole island fits by default, including on phones. Pinch
  on touchscreens or a trackpad to zoom and swipe to pan; each local player
  keeps their own zoom and pan through private handoffs, and each room player
  keeps their view when returning to the game in the same tab.
  Brighter, larger player buildings and roads stand apart from
  the muted terrain. Resource production,
  blocking raider and seven-card discards, distance and road-building rules,
  bank/harbor and player trading, development cards and ten-point victory.
  Local players pass the device before revealing private cargo; in a room,
  only the host holds the deck and sends each guest a private view. No
  commercial game's illustrations, cards, rulebook text, or branding are used.
- **Cards** — UNO-inspired (2–20 players) and Crazy Eights (2 players) lead
  with private-room play on separate devices. Only the host holds the deck
  and sends each guest their own hand and public table state. Optional local
  pass-and-play uses a covered handoff; Blackjack is solo against the dealer.
  UNO-inspired supports one-card callouts, +2 catches and +4 bluff challenges
  as well as wild colors, skips and reverses; games above 10 players use two
  decks, and drawing penalties do not stack.
  Both card duels also work offline in local mode. The room host owns the
  deck and must be trusted.
- **Room play** — one persistent WebRTC room connects devices for repeated
  games. Connected guests are selected automatically as they join; the host
  can uncheck guests to spectate and the lobby lists games available for the
  selected seats. Supports Tic-Tac-Toe, Connect Four, Chess,
  Rock Paper Scissors, Snakes & Ladders and Ludo (2–4 players for the board
  games), Island Charter (3–4 players), Business (2–6 players),
  UNO-inspired (2–20 players), Crazy Eights (2 players), and Mafia
  (5–10 players), with host-authoritative private game state.
  The room lobby keeps per-player and per-game wins, losses, draws and rankings
  for the lifetime of the room, including across replays and game changes.
  A dropped connection pauses turns without discarding the room or active game.
  The host can re-invite a disconnected guest into the same seat. If the host
  tab reloads, a per-tab host checkpoint restores the roster and the current
  round in every supported room game, including private card hands that remain
  on the host. Guests need fresh invite/answer exchanges to reclaim their
  seats; public boards resynchronize from the host and private games send each
  guest only their own view. Play pauses until every remaining selected
  player reconnects; an eliminated Business seat cannot block the match.
  Rooms use local browser storage, not a server: clearing site data or losing
  the host's browser session cannot be recovered. WebRTC itself does not
  reconnect across a full reload without another invite and answer.
  Other games remain local-only.

**Future enhancement:** Solo campaigns with progressive stages, unlocks and
longer-term goals (distinct from the current single-round/high-score play).
