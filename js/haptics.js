// Haptics wrapper — prefers the Vibration API, respects the persisted
// `ui.hapticsEnabled` toggle, and no-ops gracefully when unsupported.

import { loadJSON, saveJSON, KEYS } from './storage.js';

const HAS_VIBRATION = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

let enabled = HAS_VIBRATION && loadJSON(KEYS.HAPTICS_ENABLED, true);

export function isSupported() {
  return HAS_VIBRATION;
}

export function isEnabled() {
  return enabled;
}

export function setEnabled(next) {
  enabled = !!next;
  saveJSON(KEYS.HAPTICS_ENABLED, enabled);
}

// Patterns: light / medium / heavy / success / failure / selection
const PATTERNS = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [30, 40, 50],
  failure: [80, 40, 80],
  selection: 8,
};

export function vibrate(pattern = 'medium') {
  if (!enabled || !HAS_VIBRATION) return;
  const p = PATTERNS[pattern] ?? pattern;
  try { navigator.vibrate(p); } catch { /* ignore */ }
}

// Convenience presets.
export const haptics = {
  light: () => vibrate('light'),
  medium: () => vibrate('medium'),
  heavy: () => vibrate('heavy'),
  success: () => vibrate('success'),
  failure: () => vibrate('failure'),
  select: () => vibrate('selection'),
};
