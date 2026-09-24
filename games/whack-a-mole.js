// Whack-a-Mole — reflex game. Moles pop up in a 3x3 grid; tap them before
// they vanish. Pure DOM; listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const HOLES = 9;

function validState(s) {
  return s && typeof s === 'object' && !Array.isArray(s) &&
    ['30', '45', '60'].includes(s.duration) &&
    Number.isSafeInteger(s.score) && s.score >= 0 &&
    Number.isSafeInteger(s.misses) && s.misses >= 0 &&
    Number.isSafeInteger(s.deadline) && s.deadline > 0 &&
    s.deadline <= Date.now() + Number(s.duration) * 1000;
}

export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { title: 'Whack-a-Mole', meta: 'Tap fast · beat the clock' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('wam-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':whack-a-mole', { duration: '30' });
    const restored = validState(session?.state) ? session.state : null;
    const expired = restored && restored.deadline <= Date.now();
    if (expired) {
      session?.finish();
      if (navigate) queueMicrotask(() => navigate(null));
    }
    const settings = restored ? { duration: restored.duration } : expired ? { duration: '30' } : await renderSetup(stage, {
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
    let deadline = 0;
    let activeHole = -1;
    let running = false;
    let popTimer = null, tickTimer = null, hideTimer = null, hitTimer = null;
    function checkpoint() { session?.save({ duration: settings.duration, score, misses, deadline }); }
    function clearTimers() {
      clearTimeout(popTimer); clearTimeout(hideTimer); clearTimeout(hitTimer); clearInterval(tickTimer);
    }
    function syncClock() {
      timeLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (timeLeft === 0) endRound();
      else updateStatus();
    }

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
      if (Date.now() >= deadline) { endRound(); return; }
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
      if (Date.now() >= deadline) { endRound(); return; }
      const audio = window.arcadeAudio;
      if (i === activeHole) {
        score++;
        if (score > bestScore) {
          bestScore = score;
          saveJSON(KEYS.HIGH_SCORES + ':whack-a-mole', bestScore);
        }
        holeEls[i].classList.remove('up');
        holeEls[i].classList.add('hit');
        clearTimeout(hitTimer);
        hitTimer = setTimeout(() => holeEls[i].classList.remove('hit'), 200);
        activeHole = -1;
        if (audio) { audio.prepare(); audio.pop(); }
        window.haptics?.select();
      } else {
        misses++;
        if (audio) { audio.prepare(); audio.tap(); }
      }
      checkpoint();
      updateStatus();
    }

    function startRound() {
      clearTimers();
      holeEls.forEach(h => h.classList.remove('up', 'hit'));
      running = true;
      score = 0; misses = 0; timeLeft = roundLength; activeHole = -1;
      deadline = Date.now() + roundLength * 1000;
      message.textContent = '';
      checkpoint();
      updateStatus();
      popMole();
      tickTimer = setInterval(syncClock, 250);
    }

    function endRound() {
      if (!running) return;
      running = false;
      clearTimers();
      timeLeft = 0;
      session?.finish();
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
    if (restored) {
      score = restored.score; misses = restored.misses; deadline = restored.deadline;
      if (expired && score > bestScore) {
        bestScore = score;
        saveJSON(KEYS.HIGH_SCORES + ':whack-a-mole', bestScore);
      }
      if (!expired) {
        running = true;
        syncClock();
        if (running) { popMole(); tickTimer = setInterval(syncClock, 250); }
        else if (navigate) queueMicrotask(() => navigate(null));
      }
    } else if (!expired) startRound();
    return {
      dispose: () => {
        clearTimers();
        window.removeEventListener('arcade:themechange', onTheme);
      },
    };
  },
};
