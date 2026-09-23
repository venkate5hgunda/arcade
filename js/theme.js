// Theme manager — light / dark / auto (follows OS).
// Emits `arcade:themechange` so game canvases can repaint palettes.

import { loadJSON, saveJSON, KEYS } from './storage.js';

const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  window.dispatchEvent(new CustomEvent('arcade:themechange', { detail: theme }));
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.dataset.mode = theme;
    const label = theme === 'dark' ? 'Use light theme' : 'Use dark theme';
    toggle.setAttribute('aria-label', label);
    toggle.dataset.tooltip = label;
  }
}

export function initTheme() {
  const stored = loadJSON(KEYS.THEME, null); // 'light' | 'dark' | null (auto)
  apply(stored || (media && media.matches ? 'dark' : 'light'));

  if (media) {
    media.addEventListener('change', (e) => {
      // Only follow the OS if the user never explicitly overrode it.
      if (loadJSON(KEYS.THEME, null) === null) apply(e.matches ? 'dark' : 'light');
    });
  }

  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      saveJSON(KEYS.THEME, next);
      apply(next);
    });
  }
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}
