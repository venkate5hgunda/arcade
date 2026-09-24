// Whack-a-Mole — reflex game. Moles pop up in a 3x3 grid; tap them before
// they vanish. Pure DOM; listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const HOLES = 9;

export default {
  async render(el, game, { navigate } = {}) {
    const shell = createShell(el, game, { title: 'Whack-a-Mole', meta: 'Tap fast · beat the clock' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('wam-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':whack-a-mole', { duration: '30' });
    const settings = await renderSetup(stage, {
      title: '🔨 Whack-a-Mole',
      subtitle: 'How long do you want to play?',
      themeClass: 'wam-theme',
      fields: [{
        key: 'duration', label: 'Round Length',
        options: [30, 45, 60].map((n) => ({ value: String(n), label: `${n}s` })),
        default: saved.duration,
      }],
      startLabel: 'Grab the Mallet',
    });
    saveJSON(KEYS.SETTINGS + ':whack-a-mole', settings);
    const roundLength = parseInt(settings.duration, 10) || 30;
    shell.root.querySelector('.game-meta').textContent = `${roundLength}s round · tap the moles`;

    let bestScore = loadJSON(KEYS.HIGH_SCORES + ':whack-a-mole', 0);
    let score = 0, misses = 0, timeLeft = roundLength;
    let activeHole = -1;
    let running = false;
    let popTimer = null, tickTimer = null, hideTimer = null;

    const status = document.createElement('div');
    status.className = 'wam-status';
    stage.appendChild(status);

    const grid = document.createElement('div');
    grid.className = 'wam-grid';
    stage.appendChild(grid);

    const message = document.createElement('div');
    message.className = 'wam-message';
    stage.appendChild(message);

    const holeEls = Array.from({ length: HOLES }, (_, i) => {
      const hole = document.createElement('button');
      hole.type = 'button';
      hole.className = 'wam-hole';
      hole.innerHTML = '<span class="wam-mole">🐹</span>';
      hole.addEventListener('click', () => whack(i));
      grid.appendChild(hole);
      return hole;
    });

    function updateStatus() {
      status.innerHTML = `<span>Score: <strong>${score}</strong></span><span>Time: <strong>${timeLeft}s</strong></span><span>Best: <strong>${bestScore}</strong></span>`;
    }

    function popMole() {
      if (!running) return;
      if (activeHole !== -1) holeEls[activeHole].classList.remove('up');
      activeHole = Math.floor(Math.random() * HOLES);
      holeEls[activeHole].classList.add('up');
      const upTime = 550 + Math.random() * 450;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (activeHole !== -1) holeEls[activeHole].classList.remove('up');
        activeHole = -1;
      }, upTime);
      popTimer = setTimeout(popMole, upTime + 150 + Math.random() * 250);
    }

    function whack(i) {
      if (!running) return;
      const audio = window.arcadeAudio;
      if (i === activeHole) {
        score++;
        holeEls[i].classList.remove('up');
        holeEls[i].classList.add('hit');
        setTimeout(() => holeEls[i].classList.remove('hit'), 200);
        activeHole = -1;
        if (audio) { audio.prepare(); audio.pop(); }
        window.haptics?.select();
      } else {
        misses++;
        if (audio) { audio.prepare(); audio.tap(); }
      }
      updateStatus();
    }

    function startRound() {
      running = true;
      score = 0; misses = 0; timeLeft = roundLength; activeHole = -1;
      message.textContent = '';
      updateStatus();
      popMole();
      tickTimer = setInterval(() => {
        timeLeft--;
        updateStatus();
        if (timeLeft <= 0) endRound();
      }, 1000);
    }

    function endRound() {
      running = false;
      clearTimeout(popTimer); clearTimeout(hideTimer); clearInterval(tickTimer);
      holeEls.forEach((h) => h.classList.remove('up', 'hit'));
      if (score > bestScore) { bestScore = score; saveJSON(KEYS.HIGH_SCORES + ':whack-a-mole', bestScore); }
      const audio = window.arcadeAudio;
      if (audio) audio.chime();
      window.haptics?.success();
      message.innerHTML = `
        <div class="wam-overlay">
          <h3>Time's Up! Score: ${score}</h3>
          <p>Misses: ${misses}</p>
          <button class="wam-btn" id="retry">Play Again</button>
        </div>`;
      message.querySelector('#retry').addEventListener('click', startRound);
      updateStatus();
    }

    getResetButton().addEventListener('click', startRound);

    const onTheme = () => {};
    window.addEventListener('arcade:themechange', onTheme);
    startRound();
    return {
      dispose: () => {
        clearTimeout(popTimer); clearTimeout(hideTimer); clearInterval(tickTimer);
        window.removeEventListener('arcade:themechange', onTheme);
      },
    };
  },
};
