import { migrateStorage } from './lib/migration.ts';
import { PwaControl } from './components/PwaControl.tsx';
import { GameArt } from './components/GameArt.tsx';
import { FeedbackControl } from './components/FeedbackControl.tsx';
import { feedback } from './lib/feedback.ts';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { validCheckpoint } from './lib/checkpoints.ts';
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
  return (
    <>
      <section className="catalog-intro">
        <h1>Pick a game. Press play.</h1>
        <p>Solo challenges, friendly rivalries, and games for everyone.</p>
      </section>
      {visible.length === 0 && (
        <section className="empty">
          <h2>No games found</h2>
          <p>Try a different search or choose another category.</p>
        </section>
      )}
      <section className="collection">
        <div className="section-head">
          <div>
            <h2>
              {resumable.length ? 'Pick up where you left off' : 'Browse games'}
            </h2>
          </div>
          <p className="count" role="status">
            {visible.length} games{' '}
            {category === 'All' ? 'to play' : `in ${category}`}
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
          All {implementedGameIds.size} games are ready. Browse the complete
          collection, then choose solo, pass-and-play, or a supported private
          room.
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
        <GameArt id={game.id} decorative eager={index < 8} />
        <span className="card-category">{game.category}</span>
      </div>
      <div className="card-copy">
        <div className="card-title">
          <h3>{game.name}</h3>
          <Icon name="arrow-right" />
        </div>
        <small className="card-meta">{playerLabel(game)}</small>
        <p>{game.tagline}</p>
      </div>
    </Link>
  );
}
function RequirementRoute() {
  const { id } = useParams();
  const entry = requirements.find((r) => r.id === id);
  return (
    <section className="detail">
      <Link to="/">← All games</Link>
      <h1>{entry?.title ?? 'Feature not found'}</h1>
      {entry && (
        <>
          <p>
            <strong>Migration status: {entry.status}.</strong> See the redesign
            documentation for the exact implemented scope.
          </p>
          {entry.releaseGate && (
            <p className="release-gate" role="note">
              <strong>Release gate.</strong> {entry.releaseGate}
            </p>
          )}
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
  const { pathname } = location;
  const home = pathname === '/';
  const previousPath = useRef<string | null>(null);
  const homeLink = useRef<HTMLAnchorElement>(null);
  const main = useRef<HTMLElement>(null);
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
      if (color) color.content = active === 'dark' ? '#141821' : '#ffffff';
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
  useLayoutEffect(() => {
    // Hash routes share a document. Native history restoration can otherwise
    // override the route's scroll reset after Back or Forward.
    const restoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = restoration;
    };
  }, []);
  useLayoutEffect(() => {
    const previous = previousPath.current;
    if (previous === pathname) return;
    previousPath.current = pathname;
    // Move focus and the viewport independently so mobile browsers only scroll once.
    if (pathname === '/') {
      if (previous !== null) homeLink.current?.focus({ preventScroll: true });
    } else {
      const heading = main.current?.querySelector('h1');
      if (heading) heading.tabIndex = -1;
      (heading ?? main.current)?.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
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
        <Link ref={homeLink} className="brand" to="/" aria-label="Arcade home">
          <img src="./icons/logo.svg" alt="" />
          ARCADE<span aria-hidden="true">✦</span>
        </Link>
        <div className="header-tools">
          <Link className="room-link" to="/room">
            <Icon name="users" />
            Room
          </Link>
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
          <FeedbackControl />
        </div>
      </header>
      <main ref={main} id="main" tabIndex={-1}>
        {home && (
          <div className="browse-tools">
            <label className="search">
              <span className="sr-only">Search games</span>
              <input
                type="search"
                placeholder="Search games"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
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
          </div>
        )}
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
                  All games
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
        <Link to="/requirements/A01">Parity &amp; verification</Link>
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
