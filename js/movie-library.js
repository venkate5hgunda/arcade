import { TELUGU_MOVIES } from './party-prompts.js';

const ROOT = new URL('../data/movies/', import.meta.url);
const DIFFICULTIES = ['Easy', 'Approachable', 'Moderate', 'Hard', 'Very hard'];

export function difficultyLabel(value) {
  return DIFFICULTIES[Number(value) - 1] ? `${value}/5 · ${DIFFICULTIES[Number(value) - 1]}` : 'All difficulties';
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export async function loadApprovedMovies(fetcher = fetch) {
  const indexResponse = await fetcher(new URL('index.json', ROOT));
  if (!indexResponse.ok) throw new Error(`Movie index could not load (HTTP ${indexResponse.status}).`);
  const index = await indexResponse.json();
  if (index.format_version !== 1 || !Array.isArray(index.files)) throw new Error('Invalid movie index.');
  const records = [];
  for (const file of index.files) {
    if (!/^[\w.-]+\.jsonl$/.test(file.path)) throw new Error('Invalid movie partition path.');
    const response = await fetcher(new URL(file.path, ROOT));
    if (!response.ok) throw new Error(`Movie library could not load (HTTP ${response.status}).`);
    const text = await response.text();
    const rows = text.trim() ? text.trim().split('\n').map(line => JSON.parse(line)) : [];
    if (rows.length !== file.records) throw new Error('Incomplete movie partition.');
    records.push(...rows);
  }
  if (records.length !== index.records || !records.length) throw new Error('Incomplete or empty movie library.');
  const ids = new Set();
  for (const movie of records) {
    if (typeof movie.id !== 'string' || !movie.id || ids.has(movie.id) ||
        typeof movie.title !== 'string' || !movie.title.trim() ||
        !(movie.year === null || Number.isInteger(movie.year)) ||
        !Number.isInteger(movie.difficulty) || movie.difficulty < 1 || movie.difficulty > 5 ||
        !['editorial', 'llm_reviewed'].includes(movie.approval)) {
      throw new Error('Invalid approved movie record.');
    }
    ids.add(movie.id);
  }
  return records.map(movie => {
    const starter = TELUGU_MOVIES.find(entry => entry.title === movie.title && entry.year === movie.year);
    return {
      ...starter, ...movie,
      prompt: `${movie.title} (${movie.year ?? 'year unknown'})`,
      clue: movie.genres?.length ? movie.genres.slice(0, 2).join(' / ') : 'Telugu cinema',
    };
  });
}

export async function loadMovieScreen(stage) {
  const notice = document.createElement('p');
  notice.setAttribute('role', 'status');
  notice.textContent = 'Loading approved Telugu movie library…';
  stage.appendChild(notice);
  while (true) {
    try {
      const movies = await loadApprovedMovies();
      notice.remove();
      return movies;
    } catch (error) {
      notice.textContent = `${error.message} Check your connection and retry.`;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'game-ui-action';
      retry.textContent = 'Retry movie library';
      notice.appendChild(retry);
      await new Promise(resolve => retry.addEventListener('click', resolve, { once: true }));
      notice.textContent = 'Loading approved Telugu movie library…';
    }
  }
}

export function filterMovies(movies, settings = {}) {
  return movies.filter(movie => {
    if (settings.difficulty && settings.difficulty !== 'all' && movie.difficulty !== Number(settings.difficulty)) return false;
    if (settings.period === '2000' && !(movie.year >= 2000)) return false;
    if (settings.period === '1990' && !(movie.year >= 1990)) return false;
    if (settings.period === 'older' && !(movie.year !== null && movie.year < 2000)) return false;
    if (settings.period === 'custom' &&
        !(movie.year !== null && movie.year >= Number(settings.fromYear) && movie.year <= Number(settings.toYear))) return false;
    return true;
  });
}

export function uniquePrompts(movies) {
  return [...new Map(movies.map(movie => [movie.prompt ?? movie.title, movie])).values()];
}

export function movieFilterFields(saved = {}) {
  const when = values => values.category === 'telugu-movies';
  return [
    { key: 'period', label: 'Movie years', when,
      options: [{ value: '2000', label: '2000 and newer' }, { value: 'all', label: 'All years' },
        { value: '1990', label: '1990 and newer' }, { value: 'older', label: 'Before 2000' },
        { value: 'custom', label: 'Custom timespan' }],
      default: ['2000', 'all', '1990', 'older', 'custom'].includes(saved.period) ? saved.period : '2000' },
    { key: 'fromYear', label: 'From year', type: 'number', min: 1900, max: 2999,
      when: values => when(values) && values.period === 'custom', default: saved.fromYear ?? '2000' },
    { key: 'toYear', label: 'Through year', type: 'number', min: 1900, max: 2999,
      when: values => when(values) && values.period === 'custom', default: saved.toYear ?? String(new Date().getFullYear()) },
    { key: 'difficulty', label: 'Movie difficulty', when,
      options: [{ value: 'all', label: 'All difficulties' },
        ...DIFFICULTIES.map((label, index) => ({ value: String(index + 1), label: `${index + 1} · ${label}` }))],
      default: ['all', '1', '2', '3', '4', '5'].includes(saved.difficulty) ? saved.difficulty : 'all' },
  ];
}

export function movieSetupError(movies, values) {
  if (values.category !== 'telugu-movies') return '';
  if (values.period === 'custom' && (!/^\d{4}$/.test(values.fromYear) || !/^\d{4}$/.test(values.toYear) ||
      Number(values.fromYear) < 1900 || Number(values.toYear) > 2999 || Number(values.fromYear) > Number(values.toYear))) {
    return 'Choose a valid timespan with the first year no later than the last.';
  }
  return filterMovies(movies, values).length ? '' : 'No approved movies match these filters. Choose other years or difficulty.';
}

export function movieDetails(movie) {
  if (!movie) return '';
  const starter = movie.story ? `<p>${escapeHTML(movie.cast)}</p><p>${escapeHTML(movie.story)}</p>` : '';
  const rating = movie.difficulty ? `<p>Difficulty ${movie.difficulty}/5 · ${DIFFICULTIES[movie.difficulty - 1]} · ${movie.approval === 'editorial' ? 'Editorial' : 'Model approved'}</p>
    <details><summary>Why this rating?</summary><p>${escapeHTML(movie.reason)}</p>
    ${['actability', 'recognition', 'title_complexity'].map(key => {
      const component = movie.components[key];
      return `<p><strong>${key.replaceAll('_', ' ')}: ${component.value}/5.</strong> ${escapeHTML(component.reason)}</p>`;
    }).join('')}</details>` : '';
  return `<p>${movie.year ?? 'Year unknown'}</p>${starter}${rating}
    ${movie.approval ? '<p class="setup-field-help">Movie metadata: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a>. Not endorsed or certified by TMDB.</p>' : ''}`;
}
