# Deferred device validation

Deferred by the user on 2026-10-29. These checks are **not yet passed**.

## Setup

- Use the same HTTPS URL and build on both devices: the redesigned app from
  `9bb3315` or later. The current GitHub Pages site may still be the original app
  until the release is deployed; confirm the deployed revision first.
- Use iPhone Safari and Android Chrome where available. For network checks, keep
  device A on Wi-Fi; turn Wi-Fi **off** on device B so it uses cellular.
- For a separate preview, build with `npm --prefix redesign run build` and serve
  only `redesign/node_modules/.cache/redesign-dist/` over HTTPS.
  A phone cannot reach the computer's `localhost`; plain LAN HTTP is insufficient
  for installation/camera checks.

## Checks

| Check | Do this | Pass when |
| --- | --- | --- |
| Install | iPhone: Share → Add to Home Screen. Android: **Install Arcade** under **Offline & install**, or the browser install menu. Launch the new icon. | Correct icon; no clipped controls; footer says **Running as an installed app.** |
| Offline/resume | Online, wait for **Offline & install** to report assets ready. Start two-player Tic-Tac-Toe and place X. Enable airplane mode, close/reopen the installed app, then reload. Finish the match. Restore connectivity afterward. | Same board resumes; moves, artwork and result work offline. |
| Camera | A: **Room** → enter name → **Create a room**. B: enter name → **Scan invitation QR** → allow camera → scan A's QR → **Join room**. A: **Scan answer QR** → scan B's QR → **Accept answer**. Separately deny camera once, restore permission in browser site controls, retry, then **Cancel scan**. | Both guests connect; denial offers paste-link recovery; camera indicator turns off after success and cancellation. |
| Sound | Open **Sound & feel** (music-note button). Enable **Game sounds**, tap **Test sound**, then play Simon. Mute/unmute; background/reopen; switch audio output and retest. | Chime and distinct pad notes are audible; mute silences effects; sound recovers. API-ready text alone is not a pass. |
| Haptics | Android with vibration supported: enable **Haptics**, tap the switch, then play a game. Disable and repeat. On iPhone, check the displayed support message/native-switch feedback. | Supported Android vibration follows the toggle. iOS does not promise game vibrations; an unsupported/disabled control is recorded as **N/A**. |
| Two-touch play | Open **Air Hockey** → **Start playing**. Hold one finger on each paddle and move both simultaneously. Lift one finger; keep moving the other. Strike the resting puck; score; rotate the device. | Paddles track independently; the remaining touch still works; the other player serves after a goal; rotation stays usable. |
| Wi-Fi ↔ cellular room | Keep A on Wi-Fi and B on cellular. Use the two-way invitation/answer exchange above. Select **Tic-Tac-Toe**, start, and alternate moves. Briefly disconnect B, then restore it. Reload A's original host tab; use **Reconnect [name]** and repeat the exchange with B's original name. Finish and replay. | Both see matching turns/results; disconnection pauses play; reconnection retains the board and standings; replay works. |
| Private views | In that room, play **UNO-inspired**: inspect both screens during handoffs and after reconnect. With a third device, use **Invite a spectator** and watch a round. | Players see only their own hands; spectator sees no private cards and cannot act; spectator disconnect does not pause players. |
| Update (needs a newer deployed build) | Keep two tabs open with a saved local game. After a newer build is deployed, tap **Check offline updates**. Choose **Later**, then **Update and reload** in one tab. | Update waits for your choice; the save resumes; the other tab does not reload automatically. |

A same-Wi-Fi success does not qualify cellular play. If a cross-network room
cannot connect, record the failure/network pair; the app has no TURN relay.

## Record each result

`Build | device + OS/browser | Wi-Fi/cellular | check | PASS/FAIL/N/A | failing step + actual result`

For failures, include a screenshot or short recording where useful. Keep tests
with unavailable hardware or a missing second build marked **NOT RUN**.
