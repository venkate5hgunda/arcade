# Playing together on separate devices

Serverless WebRTC rooms: invites, answers, reconnects and network limits.

[← Back to the README](../README.md)

1. Tap **Room** in the header and choose **Create a room** or **Join a room**.
   Opening an invite URL selects **Join a room** automatically. Enter your name
   and select **Create room** if hosting; the first guest invite appears immediately.
2. Share the displayed invite QR or URL using **Share link** or **Copy link**.
   After each guest connects, use **Invite another guest** for the next person.
3. The guest opens the invite URL or chooses **Join a room** and uses
   **Scan invite QR** (or pastes the URL), enters a name, and selects
   **Join and create answer**. Their answer QR is shown by default; send its
   URL or show the QR to the host.
4. In the **original host tab**, paste the answer URL or use **Scan answer QR**,
   then select **Accept answer**. Opening it in a new host tab will not work.
   Acceptance admits the guest; wait until the lobby says **connected**.
   Everyone connected is selected to play by default. Uncheck anyone who
   should spectate, then choose one of the games available for that number
   of selected players. Return to the lobby to play another game over the
   same connection.
   If someone disconnects, wait for WebRTC to recover. If it does not,
   the host selects **Reconnect [name]** to generate a new invite for that
   guest; they join with the same name, send a new answer, and reclaim their
   seat. A restored host tab opens the lobby automatically and can resume a
   saved Island Charter after guests reconnect.

**Constraints shown before starting:** This static-hosted PWA has no
signaling or TURN server. Both links must be exchanged manually, and some
messaging apps truncate long SDP links. Direct WebRTC connections usually
need internet for public STUN discovery and can fail behind restrictive
firewalls or symmetric NAT. Rooms live only while tabs remain open; remote
play is not available offline. **Downloaded game assets remain playable
locally offline** after the service worker has completed its first install.
QR codes are generated locally; no invite or answer is sent to a QR service.
Camera scanning uses a locally hosted decoder on browsers without
`BarcodeDetector`, including Safari and Chrome on iOS. On phones, open the
arcade via **HTTPS** (not plain HTTP over a LAN IP) and allow camera access;
`localhost` also works when testing on the same device. If camera access is
denied or a long, dense QR is hard to read, paste the URL instead. QR codes
that exceed capacity also fall back to the URL. The decoder and its worker
are vendored from `qr-scanner` 1.4.2 under the MIT license in
`js/vendor/LICENSE-qr-scanner`. Each device reports a lost or stalled direct
connection; a warning indicates a possible network restriction, not proof
of a particular firewall or NAT. Transient connections can recover when the
underlying WebRTC channel reconnects; blocked networks may still require a
new invite or a different network because there is no TURN relay.

Sound starts on your first tap and can be checked with **Sound & feel → Test
sound**. After switching apps or locking the screen, the next tap unlocks
sound again. On iPhone or iPad, check the device mute setting and audio output
if the test reports ready but you hear nothing. Chrome on iOS uses the system
playback audio session where supported, so game sounds can pause other media
while enabled; turning game sounds off releases that session. Safari and iOS
Chrome do not expose the Web Vibration API, so gameplay haptics are unavailable there;
the directly touched native switch can give a tactile tick on supported iOS
versions, without relying on unreliable programmatic switch clicks.
