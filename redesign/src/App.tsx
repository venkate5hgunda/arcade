import { migrateStorage } from './lib/migration.ts';
import { PwaControl } from './components/PwaControl.tsx';
import { GameArt } from './components/GameArt.tsx';
import { FeedbackControl } from './components/FeedbackControl.tsx';
import { feedback } from './lib/feedback.ts';
import { useEffect, useState } from 'react';
import {
  HashRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import type { CSSProperties } from 'react';
import {
  CATEGORIES,
  GAMES,
  implementedGameIds,
  isImplemented,
  playerLabel,
} from './lib/games.ts';
import type { Game } from './lib/games.ts';
import {
  unfinishedGames,
  deleteGameSession,
  createGameSession,
} from './lib/session.ts';
import { validCheckpoint, roomGameIds } from './lib/checkpoints.ts';
import { recentGames } from './lib/profile.ts';
import {
  KEYS,
  loadJSON,
  onStorageFailure,
  saveJSON,
  storageProtectionReason,
  observeStorage,
} from './lib/storage.ts';
import { requirements } from './lib/catalog.ts';
import { Room } from './lib/room/protocol.ts';
import { RoomPage } from './features/Room.tsx';
import { GameRoute } from './features/Game.tsx';

const categoryIcons: Record<string, string> = {
  All: 'layout-grid',
  Action: 'bolt',
  Board: 'chess',
  Cards: 'cards-filled',
  Party: 'confetti',
  Puzzle: 'puzzle',
  Word: 'abc',
};
function Icon({ name }: { name: string }) {
  return <img className="icon" src={`./icons/${name}.svg`} alt="" />;
}
function Catalog({ query, category }: { query: string; category: string }) {
  const [selected, setSelected] = useState('tictactoe');
  const [recent, setRecent] = useState(recentGames);
  const readResumable = () =>
    unfinishedGames().filter((id) => {
      if (!isImplemented(id)) return false;
      const session = createGameSession(id);
      if (validCheckpoint(id, session.state)) return true;
      void deleteGameSession(id);
      return false;
    });
  const [resumable, setResumable] = useState(readResumable);
  useEffect(
    () =>
      observeStorage([KEYS.RECENT_GAMES, KEYS.GAME_SESSIONS], () => {
        setRecent(recentGames());
        setResumable(readResumable());
      }),
    [],
  );
  const visible = GAMES.filter(
    (game) =>
      (category === 'All' || game.category === category) &&
      `${game.name} ${game.tagline} ${game.description}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const game = visible.find((g) => g.id === selected) ?? visible[0];
  return (
    <>
      {game ? (
        <section className="showcase" aria-label="Featured game">
          <div className="showcase-scene">
            <GameArt id={game.id} className="hero-image" eager />
            <div className="scene-caption">
              GOOD GAMES BRING PEOPLE TOGETHER
            </div>
          </div>
          <div className="showcase-copy">
            <p className="eyebrow">
              {game.category} <span> / </span> Your next good time
            </p>
            <h1>{game.name}</h1>
            <p className="lede">{game.description}</p>
            <div className="game-facts">
              <span>
                <Icon name="users" />
                <span>
                  <b>{playerLabel(game)}</b>
                  <small>
                    {isImplemented(game.id)
                      ? game.id === 'mafia'
                        ? 'Private room'
                        : game.players.type === 'single'
                          ? 'Solo challenge'
                          : [
                                'crazy-eights',
                                'uno',
                                'snakes-ladders',
                                'ludo',
                                'catan',
                                'business',
                              ].includes(game.id)
                            ? 'Pass & play'
                            : 'Solo or pass & play'
                      : 'Original Arcade'}
                  </small>
                </span>
              </span>
              {roomGameIds.has(game.id) && (
                <span>
                  <Icon name="confetti" />
                  <span>
                    <b>Private room</b>
                    <small>
                      {game.id === 'catan'
                        ? '3–4 players, private cargo'
                        : game.id === 'business'
                          ? '2–6 players, private decks'
                          : game.id === 'mafia'
                            ? '5–10 players, private roles'
                            : game.id === 'uno'
                              ? '2–20 players, private hands'
                              : ['snakes-ladders', 'ludo'].includes(game.id)
                                ? '2–4 players, 2–4 screens'
                                : game.id === 'crazy-eights'
                                  ? '2 players, private hands'
                                  : '2 players, 2 screens'}
                    </small>
                  </span>
                </span>
              )}
            </div>
            <Link className="primary hero-play" to={`/game/${game.id}`}>
              {resumable.includes(game.id)
                ? 'Continue'
                : isImplemented(game.id)
                  ? 'Play'
                  : 'Explore'}{' '}
              {game.name}
              <Icon name="arrow-right" />
            </Link>
            <p className="availability">
              {isImplemented(game.id)
                ? 'No accounts. No downloads. Just play.'
                : 'The complete game is playable in original Arcade.'}
            </p>
          </div>
          <div className="shelf" aria-label="Choose a game">
            {[...visible]
              .sort(
                (a, b) =>
                  Number(isImplemented(b.id)) - Number(isImplemented(a.id)),
              )
              .map((g, index) => (
                <button
                  key={g.id}
                  className={`shelf-game ${g.id === game.id ? 'selected' : ''}`}
                  aria-pressed={g.id === game.id}
                  onClick={() => setSelected(g.id)}
                >
                  <GameArt
                    id={g.id}
                    className="shelf-image"
                    decorative
                    eager={index < 8}
                  />
                  <span className="shelf-label">{g.name}</span>
                  {resumable.includes(g.id) && (
                    <span className="saved-dot" aria-label="Saved game" />
                  )}
                </button>
              ))}
          </div>
        </section>
      ) : (
        <section className="empty">
          <h1>No games found</h1>
          <p>Try a different search or choose another category.</p>
        </section>
      )}
      <section className="collection">
        <div className="section-head">
          <div>
            <p className="eyebrow">A little more play in your day</p>
            <h2>
              {resumable.length
                ? 'Pick up where you left off'
                : 'Your next favorite is here'}
            </h2>
          </div>
          <p className="count" role="status">
            {visible.length} games{' '}
            {category === 'All' ? 'on the shelf' : `in ${category}`}
          </p>
        </div>
        {resumable.length > 0 && (
          <div className="continue-row">
            {resumable.map((id) => (
              <Link key={id} to={`/game/${id}`} className="continue-card">
                <GameArt id={id} className="continue-art" decorative />
                <span>
                  <b>{GAMES.find((g) => g.id === id)?.name}</b>
                  <small>Your saved match is ready</small>
                </span>
                <Icon name="arrow-right" />
              </Link>
            ))}
          </div>
        )}
        {!resumable.length && !recent.length && (
          <p className="shelf-note">
            Pull up a chair. Start with Tic-Tac-Toe, or explore the full
            collection.
          </p>
        )}
        {recent.length > 0 && (
          <details className="recent">
            <summary>Recently played</summary>
            <div className="recent-links">
              {recent.map((item) => (
                <Link key={item.id} to={`/game/${item.id}`}>
                  {GAMES.find((g) => g.id === item.id)?.name}
                </Link>
              ))}
            </div>
          </details>
        )}
        <div className="collection-grid">
          {visible.map((g, i) => (
            <GameCard game={g} index={i} key={g.id} />
          ))}
        </div>
        <p className="catalog-note">
          The new shelf is taking shape. {implementedGameIds.size} games are
          ready here; all 26 games are available in{' '}
          <a
            href="https://venkate5hgunda.github.io/arcade/"
            target="_blank"
            rel="noreferrer"
          >
            original Arcade ↗
          </a>
          .
        </p>
      </section>
    </>
  );
}
function GameCard({ game, index }: { game: Game; index: number }) {
  return (
    <Link
      className="game-card"
      to={`/game/${game.id}`}
      style={{ '--card-index': index } as CSSProperties}
    >
      <div className="card-image">
        <GameArt id={game.id} decorative />
        <span className="card-category">{game.category}</span>
      </div>
      <div className="card-copy">
        <div className="card-meta">
          <small>{playerLabel(game)}</small>
          {isImplemented(game.id) && (
            <span className="ready">Ready to play</span>
          )}
        </div>
        <h3>{game.name}</h3>
        <p>{game.tagline}</p>
        <span className="card-action">
          {isImplemented(game.id) ? 'Let’s play' : 'Explore game'}{' '}
          <Icon name="arrow-right" />
        </span>
      </div>
    </Link>
  );
}
function RequirementRoute() {
  const { id } = useParams();
  const entry = requirements.find((r) => r.id === id);
  return (
    <section className="detail">
      <Link to="/">← Back to the shelf</Link>
      <h1>{entry?.title ?? 'Feature not found'}</h1>
      {entry && (
        <>
          <p>
            Migration status: {entry.status}. See the redesign documentation for
            the exact implemented scope.
          </p>
          <ul>
            {entry.acceptance.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
function Shell() {
  const [room] = useState(() => new Room());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>(() => {
    const saved = loadJSON<unknown>(KEYS.THEME, 'auto');
    return saved === 'light' || saved === 'dark' ? saved : 'auto';
  });
  const [warning, setWarning] = useState('');
  const location = useLocation();
  const home = location.pathname === '/';
  useEffect(
    () =>
      observeStorage([KEYS.STORAGE_VERSION], () => {
        migrateStorage();
      }),
    [],
  );
  useEffect(
    () =>
      onStorageFailure((operation) =>
        setWarning(
          storageProtectionReason() ??
            (operation === 'conflict'
              ? 'Newer progress is saved in another tab. This tab will not overwrite it. Reload to continue from the saved game.'
              : 'Your browser could not save progress. You can keep playing, but leave this tab open.'),
        ),
      ),
    [],
  );
  useEffect(
    () =>
      observeStorage([KEYS.THEME], () => {
        const saved = loadJSON<unknown>(KEYS.THEME, 'auto');
        setTheme(saved === 'light' || saved === 'dark' ? saved : 'auto');
      }),
    [],
  );
  useEffect(() => {
    const pointer = (event: PointerEvent) => {
      void feedback.audio.prepare();
      if (
        event.target instanceof Element &&
        event.target.closest('main button:not(:disabled), main [role="button"]')
      ) {
        feedback.audio.tone(720, 0.025, 'sine', 0.07);
        if (event.pointerType !== 'mouse') feedback.vibrate('light');
      }
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.repeat || !['Enter', ' '].includes(event.key)) return;
      void feedback.audio.prepare();
      if (
        event.target instanceof Element &&
        event.target.closest('main button:not(:disabled), main [role="button"]')
      )
        feedback.audio.tone(720, 0.025, 'sine', 0.07);
    };
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('keydown', keyboard, true);
    return () => {
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('keydown', keyboard, true);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const active =
        theme === 'auto' ? (media?.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = active;
      document.documentElement.style.colorScheme = active;
      const color = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]',
      );
      if (color) color.content = active === 'dark' ? '#191c35' : '#fff8eb';
      window.dispatchEvent(
        new CustomEvent('arcade:themechange', { detail: active }),
      );
    };
    apply();
    const changed = () => {
      if (theme === 'auto') apply();
    };
    media?.addEventListener('change', changed);
    return () => media?.removeEventListener('change', changed);
  }, [theme]);
  useEffect(() => {
    const heading = document.querySelector('main h1');
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus();
    }
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="app-header">
        <Link className="brand" to="/" aria-label="Arcade home">
          <img src="./icons/logo.svg" alt="" />
          ARCADE<span aria-hidden="true">✦</span>
        </Link>
        {home && (
          <nav className="filters" aria-label="Game categories">
            {CATEGORIES.map((value) => (
              <button
                className="filter"
                key={value}
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
              >
                <Icon name={categoryIcons[value]} />
                {value}
              </button>
            ))}
          </nav>
        )}
        <div className="header-tools">
          {home && (
            <label className="search">
              <span className="sr-only">Search games</span>
              <input
                type="search"
                placeholder="Search 26 games…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          )}
          <Link className="room-link" to="/room">
            <Icon name="users" />
            Room
          </Link>
          <FeedbackControl />
          <button
            className="icon-button"
            aria-label={`Theme: ${theme}. Select ${theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto'}`}
            onClick={() => {
              const next =
                theme === 'auto'
                  ? 'light'
                  : theme === 'light'
                    ? 'dark'
                    : 'auto';
              setTheme(next);
              saveJSON(KEYS.THEME, next);
            }}
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} />
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route
            path="/"
            element={<Catalog query={query} category={category} />}
          />
          <Route path="/game/:id" element={<GameRoute />} />
          <Route path="/games/:id" element={<GameRoute />} />
          <Route path="/room" element={<RoomPage room={room} />} />
          <Route path="/requirements/:id" element={<RequirementRoute />} />
          <Route
            path="*"
            element={
              <section className="detail">
                <h1>Let’s get you back to play.</h1>
                <Link className="primary" to="/">
                  Back to the shelf
                </Link>
              </section>
            }
          />
        </Routes>
      </main>
      {warning && (
        <div className="storage-warning" role="status">
          {warning}
          <button
            onClick={() => setWarning('')}
            aria-label="Dismiss storage message"
          >
            ×
          </button>
        </div>
      )}
      <footer>
        <PwaControl />
        <Link className="brand" to="/">
          ARCADE<span aria-hidden="true">✦</span>
        </Link>
        <p>Good games. Better together.</p>
        <Link to="/requirements/A01">Redesign progress</Link>
      </footer>
    </>
  );
}
export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
