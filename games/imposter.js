// Imposter — find the spy among you. 3-8 players.
// Pure DOM; listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { celebrate } from '../js/celebration.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { TELUGU_MOVIES } from '../js/party-prompts.js';

const WORD_PAIRS = [
  { word: 'COFFEE', clue: 'Hot drink' },
  { word: 'PIZZA', clue: 'Italian food' },
  { word: 'GUITAR', clue: 'String instrument' },
  { word: 'SOCCER', clue: 'Ball sport' },
  { word: 'LAPTOP', clue: 'Portable computer' },
  { word: 'SUNGLASSES', clue: 'Eye wear' },
  { word: 'BACKPACK', clue: 'Carry bag' },
  { word: 'SMARTPHONE', clue: 'Mobile device' },
  { word: 'BICYCLE', clue: 'Two wheels' },
  { word: 'CAMERA', clue: 'Photo device' },
  { word: 'HEADPHONES', clue: 'Audio gear' },
  { word: 'WALLET', clue: 'Money holder' },
  { word: 'UMBRELLA', clue: 'Rain shield' },
  { word: 'KEYBOARD', clue: 'Typing tool' },
  { word: 'MICROWAVE', clue: 'Kitchen appliance' },
  { word: 'TELESCOPE', clue: 'Star viewer' },
  { word: 'MICROSCOPE', clue: 'Tiny viewer' },
  { word: 'HAMMOCK', clue: 'Outdoor bed' },
  { word: 'LANTERN', clue: 'Light source' },
  { word: 'COMPASS', clue: 'Direction finder' },
];

const CATEGORIES = ['everyday', 'telugu-movies'];
const pairsFor = (category) => category === 'telugu-movies'
  ? TELUGU_MOVIES.map(movie => ({ word: movie.title, clue: movie.clue }))
  : WORD_PAIRS;

export function validCheckpoint(s) {
  if (!s || !CATEGORIES.includes(s.category ?? 'everyday')) return false;
  return Number.isInteger(s.players) && s.players >= 3 && s.players <= 8 &&
    ['setup', 'reveal', 'discuss', 'vote'].includes(s.phase) &&
    Number.isInteger(s.currentPlayer) && s.currentPlayer >= 0 && s.currentPlayer < s.players &&
    Number.isInteger(s.imposterIndex) && s.imposterIndex >= 0 && s.imposterIndex < s.players &&
    pairsFor(s.category ?? 'everyday').some((pair) => pair.word === s.word && pair.clue === s.clue) &&
    Array.isArray(s.votes) && s.votes.length === s.players &&
    s.votes.every((v, i) => v === null || (Number.isInteger(v) && v >= 0 && v < s.players && v !== i)) &&
    (s.phase !== 'vote' || s.votes.slice(s.currentPlayer + 1).every((v) => v === null));
}

export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { title: 'Imposter', meta: 'Pass the device · find the spy' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('imp-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':imposter', { players: '4', category: 'everyday' });
    const checkpoint = validCheckpoint(session?.state) ? session.state : null;
    const settings = checkpoint ? { players: String(checkpoint.players), category: checkpoint.category ?? 'everyday' } : await renderSetup(stage, {
      title: '🕵️ Imposter',
      subtitle: 'How many players are passing the device?',
      themeClass: 'imp-theme',
      fields: [
        {
          key: 'players', label: 'Players',
          options: Array.from({ length: 6 }, (_, i) => ({ value: String(i + 3), label: `${i + 3} Players` })),
          default: saved.players,
        },
        {
          key: 'category', label: 'Category',
          options: [{ value: 'everyday', label: 'Everyday words' }, { value: 'telugu-movies', label: 'Telugu movies' }],
          default: CATEGORIES.includes(saved.category) ? saved.category : 'everyday',
        },
      ],
      startLabel: 'Deal the Cards',
    });
    saveJSON(KEYS.SETTINGS + ':imposter', settings);
    const playerCount = Math.max(3, Math.min(8, parseInt(settings.players, 10) || 4));
    const category = settings.category;
    shell.root.querySelector('.game-meta').textContent = `${playerCount} players · ${category === 'telugu-movies' ? 'Telugu movies' : 'Everyday words'} · One spy`;

    let phase = 'setup'; // setup -> reveal -> discuss -> vote -> result
    let currentPlayer = 0;
    let imposterIndex = -1;
    let word = '', clue = '';
    let votes = [];

    function checkpointGame() {
      if (phase === 'result') { session?.finish(); return; }
      session?.save({
        players: playerCount, category, phase, currentPlayer, imposterIndex, word, clue, votes: [...votes],
      });
    }

    const card = document.createElement('div');
    card.className = 'imp-card';
    stage.appendChild(card);

    const status = document.createElement('div');
    status.className = 'imp-status';
    stage.appendChild(status);

    function render() {
      card.innerHTML = '';
      if (phase === 'setup') {
        card.innerHTML = `
          <div class="imp-setup">
            <h3>Pass the device to Player ${currentPlayer + 1}</h3>
            <p class="imp-hint">Tap "Show My Card" when ready</p>
            <button class="imp-btn" id="showCard">Show My Card</button>
          </div>`;
        card.querySelector('#showCard').addEventListener('click', showCard);
      } else if (phase === 'reveal') {
        const isImposter = currentPlayer === imposterIndex;
        card.innerHTML = `
          <div class="imp-reveal ${isImposter ? 'imposter' : ''}">
            <h3>Player ${currentPlayer + 1}</h3>
            ${isImposter ? `
              <p class="imp-role">🕵️ YOU ARE THE IMPOSTER</p>
              <p class="imp-clue">Clue: ${clue}</p>
              <p class="imp-hint">Blend in! Don't let them catch you.</p>
            ` : `
              <p class="imp-role">👤 YOU ARE A PLAYER</p>
              <p class="imp-word">Word: <strong>${word}</strong></p>
              <p class="imp-hint">Convince others you know the word.</p>
            `}
            <button class="imp-btn" id="nextPlayer">${currentPlayer < playerCount - 1 ? 'Pass to Next Player' : 'Start Discussion'}</button>
          </div>`;
        card.querySelector('#nextPlayer').addEventListener('click', nextPlayerReveal);
      } else if (phase === 'discuss') {
        card.innerHTML = `
          <div class="imp-discuss">
            <h3>Discussion Phase</h3>
            <p>Everyone talks about the word. The imposter must pretend to know it.</p>
            <button class="imp-btn" id="startVote">Start Voting</button>
          </div>`;
        card.querySelector('#startVote').addEventListener('click', startVote);
      } else if (phase === 'vote') {
        card.innerHTML = `
          <div class="imp-vote">
            <h3>Vote for the Imposter</h3>
            <p>Player ${currentPlayer + 1}, select who you think is the imposter:</p>
            <div class="imp-vote-options">
              ${Array.from({ length: playerCount }, (_, i) => `
                <button class="imp-vote-btn ${votes[currentPlayer] === i ? 'selected' : ''}" data-vote="${i}" ${i === currentPlayer ? 'disabled' : ''}>
                  Player ${i + 1}
                </button>
              `).join('')}
            </div>
            <button class="imp-btn" id="submitVote" ${votes[currentPlayer] === null ? 'disabled' : ''}>Submit Vote</button>
          </div>`;
        card.querySelectorAll('.imp-vote-btn').forEach(btn => {
          btn.addEventListener('click', () => selectVote(parseInt(btn.dataset.vote)));
        });
        card.querySelector('#submitVote').addEventListener('click', submitVote);
      } else if (phase === 'result') {
        const movie = category === 'telugu-movies' ? TELUGU_MOVIES.find(entry => entry.title === word) : null;
        const voteCounts = Array(playerCount).fill(0);
        votes.forEach(v => { if (v !== null) voteCounts[v]++; });
        const maxVotes = Math.max(...voteCounts);
        const votedOut = voteCounts.indexOf(maxVotes);
        const imposterCaught = votedOut === imposterIndex;
        const tie = voteCounts.filter(v => v === maxVotes).length > 1;

        card.innerHTML = `
          <div class="imp-result ${imposterCaught ? 'win' : 'lose'}">
            <h3>${imposterCaught && !tie ? '🎉 Imposter Caught!' : tie ? '🤝 Tie - Imposter Escapes!' : '🕵️ Imposter Escapes!'}</h3>
            <p>The imposter was <strong>Player ${imposterIndex + 1}</strong>.</p>
            <p>The word was: <strong>${word}</strong></p>
            ${movie ? `<p>${movie.year} · ${movie.cast}</p><p>${movie.story}</p>` : ''}
            <p>Clue: ${clue}</p>
            <div class="imp-vote-breakdown">
              ${voteCounts.map((c, i) => `<span class="imp-vote-bar" style="--count:${c}; --max:${maxVotes}"><span>P${i + 1}</span><strong>${c}</strong></span>`).join('')}
            </div>
            <button class="imp-btn" id="playAgain">Play Again</button>
          </div>`;
        card.querySelector('#playAgain').addEventListener('click', newGame);
      }
    }

    function newGame() {
      shell.root.querySelector('.arcade-victory')?.remove();
      const pairs = pairsFor(category);
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      word = pair.word; clue = pair.clue;
      imposterIndex = Math.floor(Math.random() * playerCount);
      currentPlayer = 0;
      phase = 'setup';
      votes = Array(playerCount).fill(null);
      checkpointGame();
      render();
    }

    function showCard() {
      phase = 'reveal';
      const audio = window.arcadeAudio;
      if (audio) { audio.prepare(); audio.tap(); }
      if (window.haptics) window.haptics.select();
      // A refresh must always return to the face-down handoff, never expose a role.
      render();
    }

    function nextPlayerReveal() {
      const audio = window.arcadeAudio;
      if (audio) audio.tap();
      if (window.haptics) window.haptics.select();
      if (currentPlayer < playerCount - 1) {
        currentPlayer++;
        phase = 'setup';
      } else {
        phase = 'discuss';
        currentPlayer = 0;
      }
      checkpointGame();
      render();
    }

    function startVote() {
      phase = 'vote';
      currentPlayer = 0;
      const audio = window.arcadeAudio;
      if (audio) audio.tap();
      checkpointGame();
      render();
    }

    function selectVote(vote) {
      votes[currentPlayer] = vote;
      const audio = window.arcadeAudio;
      if (audio) audio.tap();
      if (window.haptics) window.haptics.select();
      checkpointGame();
      render();
    }

    function submitVote() {
      if (!Number.isInteger(votes[currentPlayer])) return;
      const audio = window.arcadeAudio;
      if (currentPlayer < playerCount - 1) {
        currentPlayer++;
        if (audio) audio.tap();
      } else {
        phase = 'result';
        const voteCounts = Array(playerCount).fill(0);
        votes.forEach(v => { if (v !== null) voteCounts[v]++; });
        const maxVotes = Math.max(...voteCounts);
        const votedOut = voteCounts.indexOf(maxVotes);
        const imposterCaught = votedOut === imposterIndex && voteCounts.filter(v => v === maxVotes).length === 1;
        if (imposterCaught) celebrate(shell.root, 'The table caught the imposter!');
        else { audio?.buzz(); window.haptics?.failure(); }
      }
      checkpointGame();
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    if (checkpoint) {
      currentPlayer = checkpoint.currentPlayer; imposterIndex = checkpoint.imposterIndex;
      word = checkpoint.word; clue = checkpoint.clue; votes = [...checkpoint.votes];
      phase = checkpoint.phase === 'reveal' ? 'setup' : checkpoint.phase;
      checkpointGame();
      render();
    } else newGame();
    const onVisibility = () => {
      if (document.hidden && phase === 'reveal') {
        phase = 'setup';
        checkpointGame();
        render();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return { dispose: () => {
      window.removeEventListener('arcade:themechange', onTheme);
      document.removeEventListener('visibilitychange', onVisibility);
    } };
  },
};
