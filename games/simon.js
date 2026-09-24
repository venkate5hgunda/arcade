// Simon Says — watch the growing color sequence, then repeat it.
// Pure DOM; listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const PADS = [
  { id: 0, color: '#ef4444', tone: 330 },
  { id: 1, color: '#3b82f6', tone: 415 },
  { id: 2, color: '#eab308', tone: 494 },
  { id: 3, color: '#22c55e', tone: 262 },
];

export default {
  async render(el, game, { navigate } = {}) {
    const shell = createShell(el, game, { title: 'Simon Says', meta: 'Watch, remember, repeat' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('simon-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':simon', { speed: 'normal' });
    const settings = await renderSetup(stage, {
      title: '🔴 Simon Says',
      subtitle: 'Pick a playback speed',
      themeClass: 'simon-theme',
      fields: [{
        key: 'speed', label: 'Speed',
        options: [{ value: 'slow', label: '🐢 Slow' }, { value: 'normal', label: '🚶 Normal' }, { value: 'fast', label: '⚡ Fast' }],
        default: saved.speed,
      }],
      startLabel: 'Start Watching',
    });
    saveJSON(KEYS.SETTINGS + ':simon', settings);
    const stepMs = { slow: 700, normal: 500, fast: 340 }[settings.speed] || 500;
    shell.root.querySelector('.game-meta').textContent = `Speed: ${settings.speed} · watch, remember, repeat`;

    let bestScore = loadJSON(KEYS.HIGH_SCORES + ':simon', 0);
    let sequence = [];
    let playerStep = 0;
    let phase = 'idle'; // idle -> playing -> input -> over
    let locked = true;

    const status = document.createElement('div');
    status.className = 'simon-status';
    stage.appendChild(status);

    const padsWrap = document.createElement('div');
    padsWrap.className = 'simon-pads';
    stage.appendChild(padsWrap);

    const padEls = PADS.map((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'simon-pad';
      btn.style.setProperty('--pad-color', p.color);
      btn.disabled = true;
      btn.addEventListener('click', () => onPadClick(p.id));
      padsWrap.appendChild(btn);
      return btn;
    });

    const message = document.createElement('div');
    message.className = 'simon-message';
    stage.appendChild(message);

    function updateStatus() {
      status.innerHTML = `<span>Round: <strong>${sequence.length}</strong></span><span>Best: <strong>${bestScore}</strong></span>`;
    }

    function flashPad(id, duration = stepMs * 0.6) {
      return new Promise((resolve) => {
        const el = padEls[id];
        el.classList.add('active');
        const audio = window.arcadeAudio;
        if (audio) audio.tone(PADS[id].tone, duration / 1000, 'sine', 0.3);
        setTimeout(() => { el.classList.remove('active'); resolve(); }, duration);
      });
    }

    async function playSequence() {
      locked = true;
      padEls.forEach((b) => (b.disabled = true));
      phase = 'playing';
      updateStatus();
      await new Promise((r) => setTimeout(r, 500));
      for (const id of sequence) {
        await flashPad(id);
        await new Promise((r) => setTimeout(r, stepMs * 0.35));
      }
      phase = 'input';
      playerStep = 0;
      locked = false;
      padEls.forEach((b) => (b.disabled = false));
      updateStatus();
    }

    function nextRound() {
      sequence.push(Math.floor(Math.random() * PADS.length));
      message.textContent = '';
      playSequence();
    }

    function onPadClick(id) {
      if (locked || phase !== 'input') return;
      flashPad(id, stepMs * 0.4);
      window.haptics?.select();
      if (id === sequence[playerStep]) {
        playerStep++;
        if (playerStep === sequence.length) {
          if (sequence.length > bestScore) { bestScore = sequence.length; saveJSON(KEYS.HIGH_SCORES + ':simon', bestScore); }
          const audio = window.arcadeAudio;
          if (audio) audio.chime();
          window.haptics?.success();
          message.textContent = 'Nice! Next round…';
          locked = true;
          setTimeout(nextRound, 900);
        }
      } else {
        gameOver();
      }
    }

    function gameOver() {
      phase = 'over';
      locked = true;
      padEls.forEach((b) => (b.disabled = true));
      const audio = window.arcadeAudio;
      if (audio) audio.buzz();
      window.haptics?.failure();
      message.innerHTML = `<div class="simon-overlay"><h3>Game Over — reached round ${sequence.length}</h3><button class="simon-btn" id="retry">Play Again</button></div>`;
      message.querySelector('#retry').addEventListener('click', newGame);
      updateStatus();
    }

    function newGame() {
      sequence = [];
      playerStep = 0;
      phase = 'idle';
      message.textContent = '';
      updateStatus();
      nextRound();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => {};
    window.addEventListener('arcade:themechange', onTheme);
    newGame();
    return { dispose: () => window.removeEventListener('arcade:themechange', onTheme) };
  },
};
