// Rock Paper Scissors — best-of match, vs a friend (pass & play, secret pick)
// or the computer. Pure DOM; listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { playerName } from '../js/player-names.js';
import { celebrate } from '../js/celebration.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { remoteMatch, seat } from '../js/remote-match.js';
import { createTurnIndicator } from '../js/turn-indicator.js';

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

function validCheckpoint(s) {
  const pick = (id) => id === null || !!choiceOf(id);
  return s && ['ai', 'pvp'].includes(s.mode) && [3, 5, 7].includes(s.target) &&
    Array.isArray(s.score) && s.score.length === 2 &&
    s.score.every((n) => Number.isInteger(n) && n >= 0 && n <= s.target) &&
    Number.isInteger(s.round) && s.round >= s.score[0] + s.score[1] &&
    ['p1pick', 'handoff', 'p2pick', 'countdown', 'reveal'].includes(s.phase) &&
    pick(s.p1Pick) && pick(s.p2Pick) &&
    Number.isFinite(s.deadline) && s.deadline >= 0 &&
    (s.phase === 'p1pick' && s.p1Pick === null && s.p2Pick === null ||
      s.phase === 'handoff' && s.mode === 'pvp' && s.p1Pick !== null && s.p2Pick === null ||
      s.phase === 'p2pick' && s.mode === 'pvp' && s.p1Pick !== null && s.p2Pick === null ||
      s.phase === 'countdown' && s.p1Pick !== null && s.p2Pick !== null && s.deadline > 0 ||
      s.phase === 'reveal' && s.p1Pick !== null && s.p2Pick !== null && s.round > 0);
}

function validRoomState(s) {
  return s && s.mode === 'pvp' && s.target === 3 &&
    Array.isArray(s.score) && s.score.length === 2 &&
    s.score.every(n => Number.isInteger(n) && n >= 0 && n <= 3) &&
    Number.isSafeInteger(s.round) && s.round >= 0 &&
    Number.isSafeInteger(s.generation) && s.generation >= 0 &&
    ['p1pick', 'p2pick', 'waiting', 'countdown', 'reveal', 'over'].includes(s.phase) &&
    (s.p1Pick === null || !!choiceOf(s.p1Pick)) &&
    (s.p2Pick === null || !!choiceOf(s.p2Pick)) &&
    Number.isFinite(s.deadline) && s.deadline >= 0 &&
    typeof s.nextPending === 'boolean' &&
    (s.phase !== 'countdown' || s.p1Pick !== null && s.p2Pick !== null && s.deadline > 0) &&
    (!['reveal', 'over'].includes(s.phase) ||
      s.p1Pick !== null && s.p2Pick !== null && s.round > 0) &&
    (s.phase !== 'over' || s.score.some(n => n === 3));
}

export default {
  async render(el, game, { navigate, multiplayer, session } = {}) {
    const shell = createShell(el, game, { title: 'Rock Paper Scissors', meta: 'Best of · quick match' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('rps-vibe');

    const match = remoteMatch(multiplayer, game.id);
    const showTurn = createTurnIndicator(shell.root, match);
    const saved = loadJSON(KEYS.SETTINGS + ':rps', { mode: 'ai', target: '3' });
    const checkpoint = !match && validCheckpoint(session?.state) ? session.state : null;
    const roomSave = match?.role === 'host' ? match.savedGame : null;
    if (roomSave && !validRoomState(roomSave))
      throw new Error('Saved Rock Paper Scissors room state is invalid.');
    const settings = match ? { mode: 'pvp', target: '3' } : checkpoint ?
      { mode: checkpoint.mode, target: String(checkpoint.target) } : await renderSetup(stage, {
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
    if (!match) saveJSON(KEYS.SETTINGS + ':rps', settings);
    const aiMode = settings.mode === 'ai';
    const target = parseInt(settings.target, 10) || 3;
    shell.root.querySelector('.game-meta').textContent = match
      ? `Online room · you are Player ${seat(match)} · first to ${target}`
      : aiMode ? `You vs Computer · first to ${target}` : `Two players · first to ${target}`;

    let score = { p1: 0, p2: 0 };
    let round = 0;
    let p1Pick = null, p2Pick = null;
    let phase = match && seat(match) === 2 ? 'p2pick' : 'p1pick';
    let over = false;
    let nextPending = false;
    let countdownController = new AbortController();
    let deadline = 0;
    let matchGeneration = 0;

    function checkpointGame() {
      const snapshot = {
        mode: settings.mode, target, score: [score.p1, score.p2], round,
        p1Pick, p2Pick, phase, deadline,
      };
      if (match?.role === 'host') {
        match.saveGame(game.id, { ...snapshot, generation: matchGeneration, nextPending });
        return;
      }
      if (match || !session) return;
      if (over) { session.finish(); return; }
      session.save(snapshot);
    }

    const card = document.createElement('div');
    card.className = 'rps-card';
    stage.appendChild(card);

    const status = document.createElement('div');
    status.className = 'rps-status';
    stage.appendChild(status);

    function render() {
      if (match || !aiMode) showTurn(phase === 'p1pick' ? 0 : phase === 'p2pick' ? 1 : null, !over);
      status.textContent = over ? '' : `Score — ${aiMode ? 'You' : 'P1'}: ${score.p1} · ${aiMode ? 'Computer' : 'P2'}: ${score.p2}`;
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
      } else if (phase === 'waiting') {
        card.innerHTML = '<h3>Throw locked in!</h3><p class="rps-hint">Waiting for your opponent to choose…</p>';
      } else if (phase === 'handoff') {
        card.innerHTML = `
          <h3>Pass the device</h3>
          <p class="rps-hint">Player 2, get ready to throw.</p>
          <button class="rps-btn" id="ready">I'm Ready</button>`;
        card.querySelector('#ready').addEventListener('click', () => { phase = 'p2pick'; checkpointGame(); render(); });
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
      } else if (phase === 'countdown') {
        card.innerHTML = `<div class="rps-arena" role="status" aria-live="polite">
          <div class="rps-arena-hand rps-hand-player">${choiceOf(p1Pick).icon}<small>${aiMode ? 'YOU' : 'PLAYER 1'}</small></div>
          <span class="rps-countdown">3</span>
          <div class="rps-arena-hand rps-hand-opponent"><span>✊</span><small>${aiMode ? 'COMPUTER' : 'PLAYER 2'}</small></div>
        </div><p class="rps-hint">Rock · paper · scissors · shoot!</p>`;
      } else if (phase === 'reveal') {
        const p1 = choiceOf(p1Pick), p2 = choiceOf(p2Pick);
        const result = decide(p1Pick, p2Pick);
        const label = result === 'draw' ? "It's a draw!" : result === 'p1' ?
          aiMode ? 'You win the round!' : `${playerName(0, match)} wins the round!` :
          `${aiMode ? 'Computer' : playerName(1, match)} wins the round!`;
        card.innerHTML = `
          <div class="rps-reveal">
            <div class="rps-vs"><span>${p1.icon}</span><span class="rps-vs-x">✕</span><span>${p2.icon}</span></div>
            <h3></h3>
            <button class="rps-btn" id="next">${score.p1 >= target || score.p2 >= target ? 'See Result' : 'Next Round'}</button>
          </div>`;
        card.querySelector('.rps-reveal h3').textContent = label;
        const next = card.querySelector('#next');
        if (match && match.role !== 'host') next.disabled = true;
        else next.addEventListener('click', () => match ? match.sendAction({ type: 'next' }) : nextRound());
      } else if (phase === 'over') {
        const winnerIndex = score.p1 > score.p2 ? 0 : 1;
        const winner = aiMode ? winnerIndex === 0 ? 'You' : 'Computer' : playerName(winnerIndex, match);
        card.innerHTML = `
          <div class="rps-gameover">
            <h3></h3>
            <p></p>
            <button class="rps-btn" id="playAgain">Play Again</button>
          </div>`;
        card.querySelector('.rps-gameover h3').textContent =
          aiMode && winnerIndex === 0 ? 'You win the match! 🏆' : `${winner} wins the match! 🏆`;
        card.querySelector('.rps-gameover p').textContent =
          `Final score — ${aiMode ? 'You' : playerName(0, match)}: ${score.p1} · ${aiMode ? 'Computer' : playerName(1, match)}: ${score.p2}`;
        const again = card.querySelector('#playAgain');
        if (match && match.role !== 'host') again.disabled = true;
        else again.addEventListener('click', () => match ? match.sendAction({ type: 'reset' }) : newMatch());
      }
    }

    function pick(who, id) {
      if (match) {
        if (phase !== `${who}pick` || seat(match) !== (who === 'p1' ? 1 : 2)) return;
        match.sendAction({ type: 'pick', choice: id });
        return;
      }
      const audio = window.arcadeAudio;
      if (audio) { audio.prepare(); audio.tap(); }
      window.haptics?.select();
      if (who === 'p1') {
        p1Pick = id;
        if (aiMode) {
          p2Pick = CHOICES[Math.floor(Math.random() * 3)].id;
          startShowdown();
        } else {
          phase = 'handoff';
          checkpointGame();
          render();
        }
      } else {
        p2Pick = id;
        startShowdown();
      }
    }

    async function startShowdown(resuming = false) {
      const signal = countdownController.signal;
      phase = 'countdown';
      if (!resuming) deadline = Date.now() + 2240;
      checkpointGame();
      render();
      const phrases = ['3', '2', '1', 'SHOOT!'];
      while (Date.now() < deadline) {
        if (signal.aborted) return;
        const index = Math.min(3, Math.floor((2240 - (deadline - Date.now())) / 560));
        const label = card.querySelector('.rps-countdown');
        const hand = card.querySelector('.rps-hand-opponent span');
        if (!label || !hand) return;
        const text = phrases[index];
        label.textContent = text;
        hand.textContent = '✊';
        hand.parentElement.classList.remove('rps-swing');
        void hand.parentElement.offsetWidth;
        hand.parentElement.classList.add('rps-swing');
        window.arcadeAudio?.tick();
        window.haptics?.select();
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, Math.min(560, deadline - Date.now()));
          signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
        });
      }
      if (!signal.aborted) finishRound();
    }

    function finishRound() {
      round++;
      const result = decide(p1Pick, p2Pick);
      const audio = window.arcadeAudio;
      if (result === 'p1') { score.p1++; if (audio) audio.chime(); window.haptics?.success(); }
      else if (result === 'p2') { score.p2++; if (audio) audio.buzz(); window.haptics?.failure(); }
      phase = 'reveal';
      deadline = 0;
      checkpointGame();
      render();
      if (nextPending) { nextPending = false; nextRound(); }
    }

    function nextRound() {
      if (score.p1 >= target || score.p2 >= target) {
        over = true; phase = 'over';
        const winnerIndex = score.p1 > score.p2 ? 0 : 1;
        const name = aiMode && winnerIndex === 1 ? 'Computer' : playerName(winnerIndex, match);
        if (match?.role === 'host') match.recordResult(game.id, winnerIndex, `${matchGeneration}:${round}`);
        if ((!match || seat(match) === winnerIndex + 1) && (!aiMode || winnerIndex === 0))
          celebrate(shell.root, `${name} wins the match!`);
      } else {
        p1Pick = null; p2Pick = null;
        phase = match && seat(match) === 2 ? 'p2pick' : 'p1pick';
      }
      checkpointGame();
      render();
    }

    function newMatch() {
      matchGeneration++;
      shell.root.querySelector('.arcade-victory')?.remove();
      countdownController.abort();
      countdownController = new AbortController();
      nextPending = false;
      score = { p1: 0, p2: 0 };
      round = 0; p1Pick = null; p2Pick = null; over = false;
      deadline = 0;
      phase = match && seat(match) === 2 ? 'p2pick' : 'p1pick';
      checkpointGame();
      render();
    }

    getResetButton().addEventListener('click', () => {
      if (match) {
        if (match.role === 'host') match.sendAction({ type: 'reset' });
      } else newMatch();
    });
    if (match && match.role !== 'host') getResetButton().disabled = true;
    const offRoom = match?.on((event) => {
      if (match.activeGame?.id !== game.id) return;
      if (event.type === 'reconnected' && match.role === 'guest') {
        match.sendAction({ type: 'room-sync' }); return;
      }
      if (event.type !== 'action') return;
      const { action, from } = event;
      if (action?.type === 'room-state' && match.role === 'guest') {
        const saved = action.state;
        if (!validRoomState(saved)) {
          match.error(new Error('Invalid Rock Paper Scissors room state.')); return;
        }
        countdownController.abort();
        countdownController = new AbortController();
        score = { p1: saved.score[0], p2: saved.score[1] };
        round = saved.round; p1Pick = saved.p1Pick; p2Pick = saved.p2Pick;
        deadline = saved.deadline; nextPending = saved.nextPending;
        matchGeneration = saved.generation;
        over = saved.phase === 'over';
        phase = saved.phase === 'waiting' || ['p1pick', 'p2pick'].includes(saved.phase)
          ? (seat(match) === 1 ? p1Pick === null ? 'p1pick' : 'waiting' :
            p2Pick === null ? 'p2pick' : 'waiting') : saved.phase;
        if (phase === 'countdown') {
          if (Date.now() >= deadline) finishRound();
          else startShowdown(true);
        } else render();
        return;
      }
      if (action?.type === 'reset' && from === match.activeGame.playerIds[0]) newMatch();
      if (action?.type === 'next' && from === match.activeGame.playerIds[0]) {
        if (phase === 'reveal') nextRound();
        else if (phase === 'countdown') {
          nextPending = true;
          checkpointGame();
        }
      }
      if (action?.type !== 'pick' || !CHOICES.some((c) => c.id === action.choice)) return;
      if (from === match.activeGame.playerIds[0] && p1Pick === null) p1Pick = action.choice;
      else if (from === match.activeGame.playerIds[1] && p2Pick === null) p2Pick = action.choice;
      else return;
      if (p1Pick !== null && p2Pick !== null) startShowdown();
      else if (seat(match) === (from === match.activeGame.playerIds[0] ? 1 : 2)) {
        phase = 'waiting';
        checkpointGame();
        render();
      } else checkpointGame();
    });
    if (checkpoint) {
      score = { p1: checkpoint.score[0], p2: checkpoint.score[1] };
      round = checkpoint.round; p1Pick = checkpoint.p1Pick; p2Pick = checkpoint.p2Pick;
      phase = checkpoint.phase; deadline = checkpoint.deadline;
      if (phase === 'countdown') {
        if (Date.now() >= deadline) finishRound();
        else startShowdown(true);
      } else render();
    } else if (roomSave) {
      score = { p1: roomSave.score[0], p2: roomSave.score[1] };
      round = roomSave.round; p1Pick = roomSave.p1Pick; p2Pick = roomSave.p2Pick;
      phase = roomSave.phase; deadline = roomSave.deadline;
      matchGeneration = roomSave.generation; nextPending = roomSave.nextPending;
      over = phase === 'over';
      if (phase === 'countdown') {
        if (Date.now() >= deadline) finishRound();
        else startShowdown(true);
      } else render();
      checkpointGame();
    } else if (match) {
      render();
      checkpointGame();
    }
    else newMatch();
    if (match?.role === 'guest') match.sendAction({ type: 'room-sync' });
    return { dispose: () => { countdownController.abort(); offRoom?.(); } };
  },
};
