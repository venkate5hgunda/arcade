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

function validState(s) {
  return s && typeof s === 'object' && !Array.isArray(s) &&
    ['slow', 'normal', 'fast'].includes(s.speed) &&
    Array.isArray(s.sequence) && s.sequence.length > 0 && s.sequence.length <= 10000 &&
    s.sequence.every(id => Number.isInteger(id) && id >= 0 && id < PADS.length) &&
    Number.isInteger(s.playerStep) && s.playerStep >= 0 && s.playerStep <= s.sequence.length;
}

export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { title: 'Simon Says', meta: 'Watch, remember, repeat' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('simon-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':simon', { speed: 'normal' });
    const restored = validState(session?.state) ? session.state : null;
    const settings = restored ? { speed: restored.speed } : await renderSetup(stage, {
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
    let controller = new AbortController();
    function checkpoint() {
      session?.save({ speed: settings.speed, sequence: sequence.slice(), playerStep });
    }

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

    function pause(ms, signal) {
      return new Promise((resolve) => {
        if (signal.aborted) { resolve(false); return; }
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', cancel);
          resolve(true);
        }, ms);
        function cancel() { clearTimeout(timer); resolve(false); }
        signal.addEventListener('abort', cancel, { once: true });
      });
    }

    function flashPad(id, duration = stepMs * 0.6) {
      const signal = controller.signal;
      const el = padEls[id];
      el.classList.add('active');
      window.arcadeAudio?.tone(PADS[id].tone, duration / 1000, 'sine', 0.3);
      return pause(duration, signal).then((ok) => { el.classList.remove('active'); return ok; });
    }

    async function playSequence() {
      const signal = controller.signal;
      locked = true;
      padEls.forEach((b) => (b.disabled = true));
      phase = 'playing';
      updateStatus();
      if (!await pause(500, signal)) return;
      for (const id of sequence) {
        if (!await flashPad(id)) return;
        if (!await pause(stepMs * .35, signal)) return;
      }
      if (signal.aborted) return;
      phase = 'input';
      playerStep = 0;
      checkpoint();
      locked = false;
      padEls.forEach((b) => (b.disabled = false));
      updateStatus();
    }

    function nextRound() {
      sequence.push(Math.floor(Math.random() * PADS.length));
      message.textContent = '';
      playerStep = 0;
      checkpoint();
      playSequence();
    }

    function onPadClick(id) {
      if (locked || phase !== 'input') return;
      flashPad(id, stepMs * 0.4);
      window.haptics?.select();
      if (id === sequence[playerStep]) {
        playerStep++;
        checkpoint();
        if (playerStep === sequence.length) {
          if (sequence.length > bestScore) { bestScore = sequence.length; saveJSON(KEYS.HIGH_SCORES + ':simon', bestScore); }
          const audio = window.arcadeAudio;
          if (audio) audio.chime();
          window.haptics?.success();
          message.textContent = 'Nice! Next round…';
          locked = true;
          const signal = controller.signal;
          pause(900, signal).then((ok) => { if (ok) nextRound(); });
        }
      } else {
        gameOver();
      }
    }

    function gameOver() {
      phase = 'over';
      session?.finish();
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
      controller.abort();
      controller = new AbortController();
      padEls.forEach((pad) => pad.classList.remove('active'));
      sequence = [];
      playerStep = 0;
      phase = 'idle';
      message.textContent = '';
      updateStatus();
      nextRound();
    }

    getResetButton().addEventListener('click', newGame);

    if (restored) {
      sequence = restored.sequence.slice();
      playerStep = restored.playerStep;
      if (playerStep === sequence.length) nextRound();
      else playSequence();
    } else newGame();
    return { dispose: () => controller.abort() };
  },
};
