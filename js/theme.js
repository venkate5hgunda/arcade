// Theme manager — light / dark / auto (follows OS).
// Emits `arcade:themechange` so game canvases can repaint palettes.

import { loadJSON, saveJSON, KEYS } from './storage.js';

const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const MODES = ['auto', 'light', 'dark'];
let mode = 'auto';

function apply() {
  const theme = mode === 'auto' ? (media?.matches ? 'dark' : 'light') : mode;
  document.documentElement.setAttribute('data-theme', theme);
  window.dispatchEvent(new CustomEvent('arcade:themechange', { detail: theme }));
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.dataset.mode = mode;
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    const shown = mode[0].toUpperCase() + mode.slice(1);
    const label = `Theme: ${shown}${mode === 'auto' ? ' (follows your device)' : ''}. Select ${next[0].toUpperCase() + next.slice(1)}`;
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    document.getElementById('themeMode').textContent = shown;
  }
}

export function initTheme() {
  const stored = loadJSON(KEYS.THEME, 'auto');
  mode = MODES.includes(stored) ? stored : 'auto';
  apply();

  if (media) {
    media.addEventListener('change', () => { if (mode === 'auto') apply(); });
  }

  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      saveJSON(KEYS.THEME, mode);
      apply();
    });
  }
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}
