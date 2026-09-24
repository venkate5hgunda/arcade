import { room as defaultRoom } from './multiplayer.js';

export function chooseCardTable(stage, room = defaultRoom, game) {
  const entry = document.createElement('section');
  entry.className = 'card-room-entry';
  entry.innerHTML = `
    <span class="cg-eyebrow">THE TABLE IS OPEN</span>
    <span class="card-room-entry-art" aria-hidden="true">♠ <i>✦</i> ♥</span>
    <h3></h3>
    <p>Play from separate devices. Each player sees only their own cards.</p>
    <button class="cg-button card-room-entry-online" type="button">Play in a room ↗</button>
    <button class="cg-button cg-button--quiet card-room-entry-local" type="button">Pass &amp; play on this device</button>
    <small>Invite friends from the lobby. Direct WebRTC connections require exchanging an invite and answer link; some networks may block them.</small>
    <p class="card-room-entry-error" role="alert"></p>`;
  entry.querySelector('h3').textContent = game.name;
  stage.append(entry);
  return new Promise(resolve => {
    const route = location.hash;
    let offRoom;
    const finish = local => {
      offRoom?.();
      window.removeEventListener('hashchange', onNavigate);
      entry.remove();
      resolve(local);
    };
    const onNavigate = () => {
      if (location.hash !== route) finish(false);
    };
    offRoom = room.on(event => {
      if (event.type === 'game') finish(false);
    });
    window.addEventListener('hashchange', onNavigate);
    entry.querySelector('.card-room-entry-online').addEventListener('click', async () => {
      try { await room.showLobby(game.id); }
      catch (error) {
        entry.querySelector('.card-room-entry-error').textContent = error.message;
        console.error('Could not open multiplayer lobby:', error);
      }
    });
    entry.querySelector('.card-room-entry-local').addEventListener('click', () => {
      if (room.overlay?.isConnected) room.overlay.hidden = true;
      finish(true);
    });
  });
}
