import { useEffect, useState } from 'react';
import {
  HashRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { categories, filterRequirements, requirements } from './lib/catalog';
function Catalog() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const visible = filterRequirements(query, category);
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">A new chapter / 01</div>
          <h1 tabIndex={-1}>Good games. Great company.</h1>
          <p className="lede">
            A bright new cabinet for every kind of game night.
          </p>
          <p className="note">
            Foundation preview. Explore the feature plan below; gameplay and
            saved-data migration come in later milestones.
          </p>
        </div>
        <div className="art board" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span className="tile" key={i} />
          ))}
        </div>
      </section>
      <section aria-labelledby="catalog-title">
        <div className="toolbar">
          <div>
            <div className="eyebrow">The complete picture</div>
            <h2 id="catalog-title">Explore the redesign</h2>
          </div>
          <label className="search">
            Search features
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a feature…"
            />
          </label>
        </div>
        <div className="filters" aria-label="Feature categories">
          {categories.map((value) => (
            <button
              className="filter"
              key={value}
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="count" role="status">
          {visible.length} of {requirements.length} feature groups · all
          awaiting migration
        </p>
        <div className="grid">
          {visible.map((item) => (
            <Link
              className="card"
              to={`/requirements/${item.id}`}
              key={item.id}
            >
              <div className="meta">
                <span>{item.category}</span>
                <span>Planned</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.acceptance[0]}</p>
              <span className="link-label">View acceptance criteria →</span>
            </Link>
          ))}
        </div>
        {visible.length === 0 && (
          <p className="empty">
            No features match. Clear the search or choose another category.
          </p>
        )}
      </section>
    </>
  );
}
function Detail() {
  const { id } = useParams();
  const item = requirements.find((value) => value.id === id);
  if (!item)
    return (
      <section className="detail">
        <h1 tabIndex={-1}>Feature not found</h1>
        <p>This feature is not in the baseline inventory.</p>
        <Link to="/">Back to all features</Link>
      </section>
    );
  return (
    <section className="detail">
      <Link className="back" to="/">
        ← All features
      </Link>
      <div className="eyebrow">
        {item.id} / {item.category} / Planned
      </div>
      <h1 tabIndex={-1}>{item.title}</h1>
      <p className="note">
        This is a requirement for the redesign. The migrated feature is not
        implemented in this foundation.
      </p>
      <div className="panel">
        <h2>What must work</h2>
        <ul>
          {item.acceptance.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </div>
      <div className="panel">
        <h2>Baseline evidence</h2>
        <p>Repository paths used to derive this requirement:</p>
        <ul>
          {item.sources.map((path) => (
            <li key={path}>
              <code>{path}</code>
            </li>
          ))}
        </ul>
        <h2>Existing coverage</h2>
        {item.baselineTests.length ? (
          <ul>
            {item.baselineTests.map((path) => (
              <li key={path}>
                <code>{path}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No dedicated test mapped yet. Add a complete behavior test before
            parity sign-off.
          </p>
        )}
      </div>
    </section>
  );
}
function Shell() {
  const location = useLocation();
  useEffect(() => {
    document.querySelector<HTMLElement>('h1')?.focus();
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
      <div className="wrap">
        <header>
          <Link className="brand" to="/">
            Arcade<span>✦</span>
          </Link>
          <span className="label">Redesign foundation</span>
        </header>
        <main id="main" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/requirements/:id" element={<Detail />} />
            <Route path="*" element={<Detail />} />
          </Routes>
        </main>
        <footer>
          <p>
            React + TypeScript + Vite + React Router · Local development preview
          </p>
          <p>
            Scope: requirements, architecture and runnable foundations. Full
            feature parity is a release gate.
          </p>
        </footer>
      </div>
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
