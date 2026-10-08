import { TELUGU_MOVIES } from './party-prompts.js';

const ROOT = new URL('../data/movies/', import.meta.url);
const DIFFICULTIES = ['Easy', 'Approachable', 'Moderate', 'Hard', 'Very hard'];

export function difficultyLabel(value) {
  if (Array.isArray(value)) {
    return value.length === 5 ? 'All difficulties' : value.map(level => DIFFICULTIES[Number(level) - 1]).filter(Boolean).join(' + ') || 'Choose difficulty';
  }
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
        !['editorial', 'llm_reviewed'].includes(movie.approval) ||
        !(movie.cast === undefined || (Array.isArray(movie.cast) && movie.cast.every(name => typeof name === 'string' && name.trim()))) ||
        !(movie.summary === undefined || (typeof movie.summary === 'string' && movie.summary.trim()))) {
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
    if (Array.isArray(settings.difficulties) && !settings.difficulties.includes(String(movie.difficulty))) return false;
    if (Array.isArray(settings.yearRange) &&
        !(movie.year !== null && movie.year >= settings.yearRange[0] && movie.year <= settings.yearRange[1])) return false;
    if (!Array.isArray(settings.difficulties) && settings.difficulty && settings.difficulty !== 'all' && movie.difficulty !== Number(settings.difficulty)) return false;
    if (!Array.isArray(settings.yearRange) && settings.period === '2000' && !(movie.year >= 2000)) return false;
    if (!Array.isArray(settings.yearRange) && settings.period === '1990' && !(movie.year >= 1990)) return false;
    if (!Array.isArray(settings.yearRange) && settings.period === 'older' && !(movie.year !== null && movie.year < 2000)) return false;
    if (!Array.isArray(settings.yearRange) && settings.period === 'custom' &&
        !(movie.year !== null && movie.year >= Number(settings.fromYear) && movie.year <= Number(settings.toYear))) return false;
    return true;
  });
}

export function uniquePrompts(movies) {
  return [...new Map(movies.map(movie => [movie.prompt ?? movie.title, movie])).values()];
}

// `settings` maps the setup values into filterMovies() settings, so games
// that store the movie category differently share the live counts and errors.
export function movieFilterFields(saved = {}, movies = [], when = values => values.category === 'telugu-movies', settings = values => values) {
  const years = movies.map(movie => movie.year).filter(Number.isInteger);
  const min = years.length ? Math.min(...years) : 1931;
  const max = years.length ? Math.max(...years) : new Date().getFullYear();
  const legacyRange = saved.period === 'all' ? [min, max] : saved.period === 'older' ? [min, 1999] :
    saved.period === 'custom' ? [Number(saved.fromYear), Number(saved.toYear)] :
      [saved.period === '1990' ? 1990 : 2000, max];
  const range = Array.isArray(saved.yearRange) ? saved.yearRange : legacyRange;
  const clamp = year => Math.max(min, Math.min(max, Number.isFinite(year) ? year : max));
  const lower = clamp(Number(range[0])), upper = clamp(Number(range[1]));
  const difficulties = Array.isArray(saved.difficulties) ? saved.difficulties :
    ['1', '2', '3', '4', '5'].includes(saved.difficulty) ? [saved.difficulty] : ['1', '2', '3', '4', '5'];
  return [
    { key: 'yearRange', label: 'Movie years', type: 'range', when, min, max,
      default: [Math.min(lower, upper), Math.max(lower, upper)],
      help: 'Drag either end to choose your years. Arrow keys fine-tune one year at a time.' },
    { key: 'difficulties', label: 'Difficulty', type: 'multiple', when,
      options: DIFFICULTIES.map((label, index) => ({ value: String(index + 1), label, badge: String(index + 1) })),
      default: difficulties.filter(value => ['1', '2', '3', '4', '5'].includes(value)),
      optionState: (option, values) => {
        const count = uniquePrompts(filterMovies(movies, { ...settings(values), difficulties: [option.value] })).length;
        return { detail: count ? `${count.toLocaleString()} movie${count === 1 ? '' : 's'}` : 'None in these years', disabled: !count,
          title: count ? '' : 'No movies at this level in the chosen years' };
      },
      error: values => movieSetupError(movies, settings(values)),
      help: 'Pick one or more levels. 1 is easiest; 5 is hardest. Counts follow the chosen years.' },
  ];
}

export function movieSetupError(movies, values) {
  if (values.category !== 'telugu-movies') return '';
  if (values.yearRange !== undefined && (!Array.isArray(values.yearRange) || values.yearRange.length !== 2 ||
      !values.yearRange.every(Number.isInteger) || values.yearRange[0] > values.yearRange[1])) {
    return 'Choose a valid year range.';
  }
  if (values.difficulties !== undefined && (!Array.isArray(values.difficulties) ||
      !values.difficulties.length || values.difficulties.some(value => !['1', '2', '3', '4', '5'].includes(value)))) {
    return 'Select at least one difficulty level.';
  }
  if (!values.yearRange && values.period === 'custom' && (!/^\d{4}$/.test(values.fromYear) || !/^\d{4}$/.test(values.toYear) ||
      Number(values.fromYear) < 1900 || Number(values.toYear) > 2999 || Number(values.fromYear) > Number(values.toYear))) {
    return 'Choose a valid timespan with the first year no later than the last.';
  }
  return filterMovies(movies, values).length ? '' : 'No approved movies match these filters. Choose other years or difficulty.';
}

const CREDIT_LINKS = {
  tmdb: ['TMDB', 'https://www.themoviedb.org/'],
  omdb: ['OMDb', 'https://www.omdbapi.com/'],
  source: ['Telugu movie dataset', null],
};

export function movieCast(movie) {
  const cast = Array.isArray(movie?.cast) ? movie.cast : String(movie?.cast ?? '').split(',');
  return cast.map(name => name.trim()).filter(Boolean).slice(0, 3);
}

function creditLink(source, movie) {
  if (source === 'wikipedia') {
    const title = movie.credits?.wikipedia;
    return title ? `<a href="https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}" target="_blank" rel="noopener noreferrer">Wikipedia</a> (CC BY-SA)` : 'Wikipedia (CC BY-SA)';
  }
  const [label, url] = CREDIT_LINKS[source] ?? [];
  if (!label) return '';
  return url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
}

/** Cast chips, a short summary and the source credit for a movie card. */
export function movieBrief(movie, { compact = false } = {}) {
  if (!movie) return '';
  const cast = movieCast(movie);
  const summary = movie.summary ?? movie.story;
  if (!cast.length && !summary) return '';
  const credits = [...new Set([movie.credits?.cast, movie.credits?.summary].filter(Boolean))]
    .map(source => creditLink(source, movie)).filter(Boolean);
  const source = movie.source ? `<a href="${escapeHTML(movie.source)}" target="_blank" rel="noopener noreferrer">Wikipedia</a>` : '';
  const credit = credits.length ? credits.join(' · ') : source;
  return `<div class="movie-brief${compact ? ' movie-brief-compact' : ''}">
    ${cast.length ? `<div class="movie-brief-cast" aria-label="Starring"><span class="movie-brief-label">Starring</span>${cast.map(name => `<span class="movie-brief-chip">${escapeHTML(name)}</span>`).join('')}</div>` : ''}
    ${summary ? `<p class="movie-brief-summary">${escapeHTML(summary)}</p>` : ''}
    ${credit ? `<p class="movie-brief-credit">via ${credit}</p>` : ''}
  </div>`;
}

export function movieDetails(movie) {
  if (!movie) return '';
  const starter = movieBrief(movie);
  const rating = movie.difficulty ? `<p>Difficulty ${movie.difficulty}/5 · ${DIFFICULTIES[movie.difficulty - 1]} · ${movie.approval === 'editorial' ? 'Editorial' : 'Model approved'}</p>
    <details><summary>Why this rating?</summary><p>${escapeHTML(movie.reason)}</p>
    ${['actability', 'recognition', 'title_complexity'].map(key => {
      const component = movie.components[key];
      return `<p><strong>${key.replaceAll('_', ' ')}: ${component.value}/5.</strong> ${escapeHTML(component.reason)}</p>`;
    }).join('')}</details>` : '';
  return `<p>${movie.year ?? 'Year unknown'}</p>${starter}${rating}
    ${movie.approval ? '<p class="setup-field-help">Movie metadata: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a>. Not endorsed or certified by TMDB.</p>' : ''}`;
}
