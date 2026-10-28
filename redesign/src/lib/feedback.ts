import { ArcadeAudio } from './audio-core.js';
import { KEYS, loadJSON, saveJSON } from './storage.ts';

const audio = new ArcadeAudio(loadJSON(KEYS.SOUND_ENABLED, true) === true);
let hapticsEnabled = loadJSON(KEYS.HAPTICS_ENABLED, true) === true;
export const feedback = {
  audio,
  hasVibration: () =>
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
  hasNativeSwitch: () =>
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)),
  get hapticsEnabled() {
    return hapticsEnabled;
  },
  setSound(enabled: boolean) {
    audio.setEnabled(enabled);
    saveJSON(KEYS.SOUND_ENABLED, enabled);
  },
  setHaptics(enabled: boolean) {
    hapticsEnabled = enabled;
    saveJSON(KEYS.HAPTICS_ENABLED, enabled);
  },
  vibrate(kind: 'light' | 'selection' | 'success' | 'failure' = 'selection') {
    if (!hapticsEnabled || !this.hasVibration()) return;
    const patterns = {
      light: 10,
      selection: 8,
      success: [30, 40, 50],
      failure: [80, 40, 80],
    };
    try {
      navigator.vibrate(patterns[kind]);
    } catch {
      /* This platform declined vibration. */
    }
  },
  win() {
    audio.chime();
    this.vibrate('success');
  },
};
