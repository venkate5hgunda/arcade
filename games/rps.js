// Rock Paper Scissors — best-of match, vs a friend (pass & play, secret pick)
// or the computer. Pure DOM; listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const CHOICES = [
  { id: 'rock', label: 'Rock', icon: '✊', beats: 'scissors' },
  { id: 'paper', label: 'Paper', icon: '✋', beats: 'rock' },
  { id: 'scissors', label: 'Scissors', icon: '✌️', beats: 'paper' },
];

function choiceOf(id) { return CHOICES.find((c) => c.id === id); }

function decide(a, b) {
  if (a === b) return 'draw';
  return choiceOf(a).beats === b ? 'p1' : 'p2';
}

export default {
  async render(el, game, { navigate } = {}) {
    const shell = createShell(el, game, { title: 'Rock Paper Scissors', meta: 'Best of · quick match' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('rps-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':rps', { mode: 'ai', target: '3' });
    const settings = await renderSetup(stage, {
      title: '✊✋✌️ Rock Paper Scissors',
      subtitle: 'Pick your opponent and match length',
      themeClass: 'rps-theme',
      fields: [
        {
          key: 'mode', label: 'Opponent',
          options: [{ value: 'ai', label: '🤖 Computer' }, { value: 'pvp', label: '👥 Friend (pass & play)' }],
          default: saved.mode,
        },
        {
          key: 'target', label: 'First To',
          options: [3, 5, 7].map((n) => ({ value: String(n), label: `${n} Wins` })),
          default: saved.target,
        },
      ],
      startLabel: 'Throw Down',
    });
    saveJSON(KEYS.SETTINGS + ':rps', settings);
    const aiMode = settings.mode === 'ai';
    const target = parseInt(settings.target, 10) || 3;
    shell.root.querySelector('.game-meta').textContent = aiMode ? `You vs Computer · first to ${target}` : `Two players · first to ${target}`;

    let score = { p1: 0, p2: 0 };
    let round = 0;
    let p1Pick = null, p2Pick = null;
    let phase = 'p1pick'; // p1pick -> (pvp: handoff -> p2pick) -> reveal -> over
    let over = false;

    const card = document.createElement('div');
    card.className = 'rps-card';
    stage.appendChild(card);

    const status = document.createElement('div');
    status.className = 'rps-status';
    stage.appendChild(status);

    function render() {
      status.textContent = over ? '' : `Score — You: ${score.p1} · ${aiMode ? 'Computer' : 'P2'}: ${score.p2}`;
      card.innerHTML = '';
      if (phase === 'p1pick') {
        card.innerHTML = `<h3>${aiMode ? 'Your' : 'Player 1'} throw</h3><div class="rps-choices"></div>`;
        const wrap = card.querySelector('.rps-choices');
        for (const c of CHOICES) {
          const btn = document.createElement('button');
          btn.className = 'rps-choice-btn';
          btn.innerHTML = `<span>${c.icon}</span>${c.label}`;
          btn.addEventListener('click', () => pick('p1', c.id));
          wrap.appendChild(btn);
        }
      } else if (phase === 'handoff') {
        card.innerHTML = `
          <h3>Pass the device</h3>
          <p class="rps-hint">Player 2, get ready to throw.</p>
          <button class="rps-btn" id="ready">I'm Ready</button>`;
        card.querySelector('#ready').addEventListener('click', () => { phase = 'p2pick'; render(); });
      } else if (phase === 'p2pick') {
        card.innerHTML = `<h3>Player 2 throw</h3><div class="rps-choices"></div>`;
        const wrap = card.querySelector('.rps-choices');
        for (const c of CHOICES) {
          const btn = document.createElement('button');
          btn.className = 'rps-choice-btn';
          btn.innerHTML = `<span>${c.icon}</span>${c.label}`;
          btn.addEventListener('click', () => pick('p2', c.id));
          wrap.appendChild(btn);
        }
      } else if (phase === 'reveal') {
        const p1 = choiceOf(p1Pick), p2 = choiceOf(p2Pick);
        const result = decide(p1Pick, p2Pick);
        const label = result === 'draw' ? "It's a draw!" : result === 'p1' ? `${aiMode ? 'You win' : 'Player 1 wins'} the round!` : `${aiMode ? 'Computer wins' : 'Player 2 wins'} the round!`;
        card.innerHTML = `
          <div class="rps-reveal">
            <div class="rps-vs"><span>${p1.icon}</span><span class="rps-vs-x">✕</span><span>${p2.icon}</span></div>
            <h3>${label}</h3>
            <button class="rps-btn" id="next">${round >= target ? 'See Result' : 'Next Round'}</button>
          </div>`;
        card.querySelector('#next').addEventListener('click', nextRound);
      } else if (phase === 'over') {
        const winner = score.p1 > score.p2 ? (aiMode ? 'You win the match! 🏆' : 'Player 1 wins the match! 🏆') : (aiMode ? 'Computer wins the match!' : 'Player 2 wins the match!');
        card.innerHTML = `
          <div class="rps-gameover">
            <h3>${winner}</h3>
            <p>Final score — ${aiMode ? 'You' : 'P1'}: ${score.p1} · ${aiMode ? 'Computer' : 'P2'}: ${score.p2}</p>
            <button class="rps-btn" id="playAgain">Play Again</button>
          </div>`;
        card.querySelector('#playAgain').addEventListener('click', newMatch);
      }
    }

    function pick(who, id) {
      const audio = window.arcadeAudio;
      if (audio) { audio.prepare(); audio.tap(); }
      window.haptics?.select();
      if (who === 'p1') {
        p1Pick = id;
        if (aiMode) {
          p2Pick = CHOICES[Math.floor(Math.random() * 3)].id;
          finishRound();
        } else {
          phase = 'handoff';
          render();
        }
      } else {
        p2Pick = id;
        finishRound();
      }
    }

    function finishRound() {
      round++;
      const result = decide(p1Pick, p2Pick);
      const audio = window.arcadeAudio;
      if (result === 'p1') { score.p1++; if (audio) audio.chime(); window.haptics?.success(); }
      else if (result === 'p2') { score.p2++; if (audio) audio.buzz(); window.haptics?.failure(); }
      phase = 'reveal';
      render();
    }

    function nextRound() {
      if (score.p1 >= target || score.p2 >= target) {
        over = true; phase = 'over';
        const audio = window.arcadeAudio;
        if (audio) score.p1 > score.p2 ? audio.chime() : audio.buzz();
      } else {
        p1Pick = null; p2Pick = null;
        phase = 'p1pick';
      }
      render();
    }

    function newMatch() {
      score = { p1: 0, p2: 0 };
      round = 0; p1Pick = null; p2Pick = null; over = false;
      phase = 'p1pick';
      render();
    }

    getResetButton().addEventListener('click', newMatch);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    render();
    return { dispose: () => window.removeEventListener('arcade:themechange', onTheme) };
  },
};
