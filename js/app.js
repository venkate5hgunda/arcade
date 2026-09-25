// Arcade app entry point — wires storage, theme, audio, haptics, and router.
// Kept tiny on purpose: each concern lives in its own module.

import { initTheme } from './theme.js';
import { loadJSON, saveJSON, KEYS } from './storage.js';
import { ArcadeAudio } from './audio.js';
import { haptics, isEnabled, isSupported, setEnabled } from './haptics.js';
import { initRouter } from './router.js';
import { room } from './multiplayer.js';

initTheme();

const audio = new ArcadeAudio(loadJSON(KEYS.SOUND_ENABLED, true));
window.arcadeAudio = audio;
window.haptics = haptics;

initFeedbackControl(audio);
initGameTouchFeedback(audio);
initControlHints();
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
  roomToggle.title = room.role ? `Open room · ${connected} connected` : 'Open multiplayer room';
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

function initFeedbackControl(audio) {
  const trigger = document.getElementById('feedbackToggle');
  const panel = document.getElementById('feedbackPanel');
  const sound = document.getElementById('soundToggle');
  const soundTest = document.getElementById('soundTest');
  const soundStatus = document.getElementById('soundStatus');
  const vibration = document.getElementById('hapticsToggle');
  if (!trigger || !panel || !sound || !soundTest || !soundStatus || !vibration) return;

  const refresh = () => {
    sound.setAttribute('aria-pressed', String(audio.enabled));
    sound.querySelector('.feedback-value').textContent = audio.enabled ? 'On' : 'Off';
    soundTest.disabled = !audio.enabled;
    vibration.disabled = !isSupported();
    vibration.setAttribute('aria-pressed', String(isEnabled()));
    vibration.querySelector('.feedback-value').textContent = !isSupported()
      ? 'Unavailable' : isEnabled() ? 'On' : 'Off';
    vibration.title = isSupported() ? 'Turn vibration on or off' : 'Vibration is unavailable on this device';
  };
  const close = () => {
    if (panel.hidden) return;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };
  trigger.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    trigger.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) sound.focus();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!panel.hidden && !trigger.parentElement.contains(event.target)) close();
  });
  document.addEventListener('focusin', (event) => {
    if (!panel.hidden && !trigger.parentElement.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel.hidden) return;
    close();
    trigger.focus();
  });
  sound.addEventListener('click', async () => {
    const next = !audio.enabled;
    audio.setEnabled(next);
    saveJSON(KEYS.SOUND_ENABLED, next);
    refresh();
    if (next) {
      if (await audio.prepare()) audio.tap();
      else soundStatus.textContent = 'Could not start audio. Try Test sound after interacting with the page.';
    }
  });
  soundTest.addEventListener('click', async () => {
    if (await audio.prepare()) {
      audio.chime();
      soundStatus.textContent = 'Sound played. If you cannot hear it, check your device mute setting and audio output.';
    } else {
      soundStatus.textContent = 'Audio is blocked or unavailable. Try again after tapping the page or check browser audio settings.';
    }
  });
  vibration.addEventListener('click', () => {
    const next = !isEnabled();
    setEnabled(next);
    refresh();
    if (next) haptics.light();
  });
  refresh();
}

function initGameTouchFeedback(audio) {
  const unlock = () => { if (audio.enabled) void audio.prepare(); };
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('touchstart', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', (event) => {
    if (!event.repeat && ['Enter', ' '].includes(event.key)) unlock();
  }, { capture: true });
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

function initControlHints() {
  const selector = 'button[aria-label], [role="button"][aria-label], canvas[aria-label]';
  const update = (node) => {
    if (!(node instanceof Element)) return;
    const label = (element) => {
      if (!element.matches(selector) || (element.title && element.dataset.autoHint !== 'true')) return;
      element.title = element.getAttribute('aria-label');
      element.dataset.autoHint = 'true';
    };
    label(node);
    node.querySelectorAll(selector).forEach(label);
  };
  update(document.body);
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') update(record.target);
      else record.addedNodes.forEach(update);
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label'] });
}
