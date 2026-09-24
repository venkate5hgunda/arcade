// Arcade app entry point — wires storage, theme, audio, haptics, and router.
// Kept tiny on purpose: each concern lives in its own module.

import { initTheme } from './theme.js';
import { loadJSON, saveJSON, KEYS } from './storage.js';
import { ArcadeAudio } from './audio.js';
import { initHapticsUI, haptics } from './haptics.js';
import { initRouter } from './router.js';
import { room } from './multiplayer.js';

initTheme();

const audio = new ArcadeAudio(loadJSON(KEYS.SOUND_ENABLED, true));
window.arcadeAudio = audio;
window.haptics = haptics;

initHapticsUI(audio);
initSoundControl(audio);
initGameTouchFeedback(audio);
initRouter();
const roomToggle = document.getElementById('roomToggle');
roomToggle?.addEventListener('click', () => {
  room.showLobby().catch((error) => console.error('Could not open multiplayer lobby:', error));
});
room.on((event) => {
  if (event.type !== 'state' || !roomToggle) return;
  const connected = room.members.filter((member) => member.connected).length;
  roomToggle.classList.toggle('is-connected', connected > 1);
  roomToggle.setAttribute('aria-label', room.role
    ? `Open multiplayer lobby, ${connected} connected` : 'Open multiplayer lobby');
});
if (new URL(location.href).searchParams.has('invite') ||
    new URL(location.href).searchParams.has('answer')) {
  room.showLobby().catch((error) => console.error('Could not open shared invitation:', error));
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .catch((error) => console.error('Arcade offline installation failed:', error));
  });
}

// Sound toggle button wiring (rendered in the header).
function initSoundControl(audio) {
  const toggle = document.getElementById('soundToggle');
  if (!toggle) return;

  const refresh = () => {
    const on = audio.enabled;
    toggle.dataset.on = String(on);
    toggle.setAttribute('aria-label', on ? 'Mute sounds' : 'Unmute sounds');
    toggle.dataset.tooltip = on ? 'Mute sounds' : 'Unmute sounds';
  };

  toggle.addEventListener('click', async () => {
    await audio.prepare();
    const next = !audio.enabled;
    audio.setEnabled(next);
    saveJSON(KEYS.SOUND_ENABLED, next);
    refresh();
    if (next) audio.tap();
  });

  refresh();
}

function initGameTouchFeedback(audio) {
  const control = (target) => target instanceof Element
    ? target.closest('.game-shell button:not(:disabled)') : null;
  document.addEventListener('pointerdown', (event) => {
    const button = control(event.target);
    if (!button || button.closest('.setup-card')) return;
    audio.prepare();
    audio.tone(720, 0.025, 'sine', 0.07);
    if (event.pointerType !== 'mouse') haptics.light();
  }, { passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.repeat || !['Enter', ' '].includes(event.key) || !control(event.target)) return;
    audio.prepare();
    audio.tone(720, 0.025, 'sine', 0.07);
  });
}
