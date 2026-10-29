import type { GameCue } from './game-feedback.ts';
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

export function playCue(cue: GameCue | null | (() => GameCue | null)) {
  try {
    const next = typeof cue === 'function' ? cue() : cue;
    if (!next) return;
    feedback.audio[next.sound]();
    if (next.haptic) feedback.vibrate(next.haptic);
  } catch {
    // Optional feedback must never prevent an accepted move or room refresh.
  }
}
export function playSimonPad(pad: number, duration = 0.2) {
  const tone = [261.63, 329.63, 392, 523.25][pad];
  if (tone !== undefined) feedback.audio.tone(tone, duration, 'sine', 0.3);
}
