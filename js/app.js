// Arcade app entry point — wires storage, theme, audio, haptics, and router.
// Kept tiny on purpose: each concern lives in its own module.

import { initTheme } from './theme.js';
import { loadJSON, saveJSON, KEYS } from './storage.js';
import { ArcadeAudio } from './audio.js';
import { initHapticsUI } from './haptics.js';
import { initRouter } from './router.js';

initTheme();

const audio = new ArcadeAudio(loadJSON(KEYS.SOUND_ENABLED, true));
window.arcadeAudio = audio; // expose for games to call

initHapticsUI(audio);
initSoundControl(audio);
initRouter();

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
