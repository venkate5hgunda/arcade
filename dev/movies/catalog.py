"""Lossless, resumable movie system of record. No third-party dependencies."""

import argparse
import calendar
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import csv
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
MODULE_DIR = Path(__file__).resolve().parent
DEFAULT_CSV = MODULE_DIR / "sources/Wiki_Telugu_Movies_1930_1999.csv"
DEFAULT_DB = MODULE_DIR / ".local/movies.sqlite"
DEFAULT_EXPORT = MODULE_DIR / ".local/export"
ANNOTATIONS = MODULE_DIR / "editorial/annotations.json"
RUBRIC = "charades-v1"
APPENDS = (
    "credits,alternative_titles,translations,keywords,release_dates,"
    "external_ids,images,videos,recommendations,similar"
)


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def dump(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def title_key(value):
    return "".join(c for c in unicodedata.normalize("NFKC", value).casefold() if c.isalnum())


def load_env():
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text().splitlines():
            if line.strip() and not line.lstrip().startswith("#"):
                key, separator, value = line.partition("=")
                if separator:
                    os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def connect(path=DEFAULT_DB):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS source_files(
            sha256 TEXT PRIMARY KEY, path TEXT NOT NULL, imported_at TEXT NOT NULL,
            content BLOB NOT NULL, headers_json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS movies(
            id TEXT PRIMARY KEY, title TEXT NOT NULL, year INTEGER,
            language TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS source_rows(
            source_sha TEXT NOT NULL REFERENCES source_files(sha256), row_number INTEGER NOT NULL,
            movie_id TEXT NOT NULL REFERENCES movies(id), raw_json TEXT NOT NULL,
            issues_json TEXT NOT NULL, PRIMARY KEY(source_sha,row_number));
        CREATE TABLE IF NOT EXISTS responses(
            id INTEGER PRIMARY KEY, request_key TEXT NOT NULL, provider TEXT NOT NULL,
            path TEXT NOT NULL, params_json TEXT NOT NULL, fetched_at TEXT NOT NULL,
            status INTEGER NOT NULL, body TEXT NOT NULL, body_sha256 TEXT NOT NULL,
            usable INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS response_cache ON responses(request_key,usable,id);
        CREATE TABLE IF NOT EXISTS identities(
            provider TEXT NOT NULL, external_id TEXT NOT NULL,
            movie_id TEXT NOT NULL REFERENCES movies(id), evidence_json TEXT NOT NULL,
            linked_at TEXT NOT NULL, PRIMARY KEY(provider,external_id),
            UNIQUE(provider,movie_id));
        CREATE TABLE IF NOT EXISTS matches(
            movie_id TEXT NOT NULL REFERENCES movies(id), provider TEXT NOT NULL,
            response_id INTEGER NOT NULL REFERENCES responses(id), status TEXT NOT NULL,
            reasoning TEXT NOT NULL, PRIMARY KEY(movie_id,provider,response_id));
        CREATE TABLE IF NOT EXISTS annotations(
            id INTEGER PRIMARY KEY, movie_id TEXT NOT NULL REFERENCES movies(id),
            rubric TEXT NOT NULL, created_at TEXT NOT NULL, input_sha256 TEXT NOT NULL,
            annotation_json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS coverage(
            scope TEXT PRIMARY KEY, status TEXT NOT NULL, evidence_json TEXT NOT NULL,
            updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS redirects(
            alias_id TEXT PRIMARY KEY, canonical_id TEXT NOT NULL REFERENCES movies(id),
            evidence_json TEXT NOT NULL, created_at TEXT NOT NULL);
    """)
    version = db.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()
    if version and version["value"] != "1":
        raise RuntimeError("Unsupported database schema version; migration required.")
    # Early v1 stores deduplicated against all history, incorrectly hiding A->B->A
    # changes. Preserve their IDs and content while removing that uniqueness rule.
    if any(index["unique"] for index in db.execute("PRAGMA index_list(annotations)")):
        db.executescript("""
            BEGIN;
            CREATE TABLE annotation_revisions(
                id INTEGER PRIMARY KEY, movie_id TEXT NOT NULL REFERENCES movies(id),
                rubric TEXT NOT NULL, created_at TEXT NOT NULL, input_sha256 TEXT NOT NULL,
                annotation_json TEXT NOT NULL);
            INSERT INTO annotation_revisions SELECT * FROM annotations;
            DROP TABLE annotations;
            ALTER TABLE annotation_revisions RENAME TO annotations;
            COMMIT;
        """)
    db.execute("CREATE INDEX IF NOT EXISTS annotation_movie ON annotations(movie_id,rubric,id)")
    db.execute("INSERT OR IGNORE INTO metadata VALUES ('schema_version','1')")
    db.commit()
    return db


def import_csv(db, path):
    content = Path(path).read_bytes()
    sha = hashlib.sha256(content).hexdigest()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig"), newline=""))
    headers = reader.fieldnames
    if not headers or "Title" not in headers or "Year" not in headers:
        raise ValueError("CSV requires Title and Year headers.")
    if len(set(headers)) != len(headers):
        raise ValueError("Duplicate CSV column names would lose fields.")
    rows = list(reader)
    for row_number, row in enumerate(rows, 1):
        if None in row or any(value is None for value in row.values()):
            raise ValueError(f"Malformed CSV record {row_number}; import aborted.")
        if not row["Title"].strip():
            raise ValueError(f"Empty title in record {row_number}; import aborted.")
    occurrences = Counter((title_key(row["Title"]), row["Year"].strip()) for row in rows)
    db.execute("INSERT OR IGNORE INTO source_files VALUES (?,?,?,?,?)",
               (sha, str(Path(path).resolve()), now(), content, dump(headers)))
    count = 0
    for row_number, row in enumerate(rows, 1):
        title = row["Title"].strip()
        raw_year = row["Year"].strip()
        year = int(raw_year) if re.fullmatch(r"\d{4}", raw_year) else None
        issues = []
        if year is None or year < 1931 or year > dt.date.today().year:
            issues.append("Unreliable year: verify against original source before identity matching.")
        if row.get("Release Date", "").strip() == raw_year:
            issues.append("Release Date is year-only; do not fabricate a day/month.")
        if any("\n" in value or value != value.strip() for value in row.values()):
            issues.append("Whitespace retained verbatim in source record.")
        if occurrences[(title_key(title), raw_year)] > 1:
            issues.append("Repeated normalized title/year in source; requires identity review, not automatic merging.")
        movie_id = f"csv:{sha[:16]}:{row_number}"
        db.execute("INSERT OR IGNORE INTO movies VALUES (?,?,?,?,?)",
                   (movie_id, title, year, "te", now()))
        db.execute("INSERT INTO source_rows VALUES (?,?,?,?,?) ON CONFLICT(source_sha,row_number) "
                   "DO UPDATE SET issues_json=excluded.issues_json",
                   (sha, row_number, movie_id, dump(row), dump(issues)))
        count += 1
    db.commit()
    return count


def seed_movies(db, seeds):
    for seed in seeds:
        existing = db.execute("SELECT id,title FROM movies WHERE year=?", (seed["year"],)).fetchall()
        names = {title_key(name) for name in [seed["title"], *seed.get("aliases", [])]}
        if any(title_key(movie["title"]) in names for movie in existing):
            continue
        movie_id = f"seed:{title_key(seed['title'])}:{seed['year']}"
        db.execute("INSERT OR IGNORE INTO movies VALUES (?,?,?,?,?)",
                   (movie_id, seed["title"], seed["year"], "te", now()))
    db.commit()


def reconcile_seed_aliases(db, seeds):
    """Only explicitly reviewed title aliases may reconcile a seed with a native TMDB record."""
    for seed in seeds:
        names = {title_key(name) for name in [seed["title"], *seed.get("aliases", [])]}
        candidates = db.execute("SELECT * FROM movies WHERE year=?", (seed["year"],)).fetchall()
        candidates = [movie for movie in candidates if title_key(movie["title"]) in names]
        native = [movie for movie in candidates if db.execute(
            "SELECT 1 FROM identities WHERE provider='tmdb' AND movie_id=?", (movie["id"],)).fetchone()]
        placeholders = [movie for movie in candidates if movie["id"].startswith("seed:") and movie not in native]
        if len(native) != 1:
            continue
        canonical = native[0]["id"]
        for placeholder in placeholders:
            alias = placeholder["id"]
            conflicts = db.execute(
                "SELECT 1 FROM identities a JOIN identities b ON a.provider=b.provider "
                "WHERE a.movie_id=? AND b.movie_id=? AND a.external_id!=b.external_id",
                (alias, canonical)).fetchone()
            if conflicts:
                continue
            evidence = {"method": "reviewed-title-year-alias", "source": seed["source"],
                        "original_movie": dict(placeholder), "aliases": list(names)}
            db.execute("INSERT OR IGNORE INTO redirects VALUES (?,?,?,?)",
                       (alias, canonical, dump(evidence), now()))
            db.execute("UPDATE source_rows SET movie_id=? WHERE movie_id=?", (canonical, alias))
            db.execute("DELETE FROM identities WHERE movie_id=? AND provider IN "
                       "(SELECT provider FROM identities WHERE movie_id=?)", (alias, canonical))
            db.execute("UPDATE identities SET movie_id=? WHERE movie_id=?", (canonical, alias))
            db.execute("INSERT OR IGNORE INTO matches SELECT ?,provider,response_id,status,reasoning "
                       "FROM matches WHERE movie_id=?", (canonical, alias))
            db.execute("DELETE FROM matches WHERE movie_id=?", (alias,))
            db.execute("UPDATE annotations SET movie_id=? WHERE movie_id=?", (canonical, alias))
            db.execute("DELETE FROM movies WHERE id=?", (alias,))
    db.commit()


class APIError(RuntimeError):
    def __init__(self, message, response_id=None, http_status=None, provider_message=None):
        super().__init__(message)
        self.response_id = response_id
        self.http_status = http_status
        self.provider_message = provider_message


class Client:
    def __init__(self, db, provider, key, max_calls=100, refresh=False, delay=0.25):
        self.db, self.provider, self.key = db, provider, key
        self.max_calls, self.refresh, self.delay = max_calls, refresh, delay
        self.calls = 0
        self.started_at = now()
        self.fetched_keys = set()
        self.daily_start = db.execute("SELECT count(*) FROM responses WHERE provider=? "
                                      "AND substr(fetched_at,1,10)=?", (provider, now()[:10])).fetchone()[0]

    def get(self, path, params=None):
        params = params or {}
        cached = self.cached(path, params)
        if cached:
            return cached
        self.reserve()
        return self.save(path, params, self.fetch(path, params))

    def cached(self, path, params):
        if any(key.lower() in ("api_key", "apikey", "authorization") for key in params):
            raise ValueError("Credentials must not be part of cached request parameters.")
        request_key = digest(dump([self.provider, path, params]))
        if not self.refresh or request_key in self.fetched_keys:
            cached = self.db.execute(
                "SELECT id,body FROM responses WHERE request_key=? AND usable=1 ORDER BY id DESC LIMIT 1",
                (request_key,)).fetchone()
            if cached:
                return json.loads(cached["body"]), cached["id"]

    def reserve(self):
        if not self.key:
            raise APIError(f"Missing {self.provider.upper()}_API_KEY in .env.")
        if self.calls >= self.max_calls:
            raise APIError(f"{self.provider}: request budget reached ({self.max_calls}); rerun to resume.")
        if self.provider == "omdb":
            if self.daily_start + self.calls >= 950:
                raise APIError("omdb: conservative daily safety ceiling reached; resume tomorrow.")
        self.calls += 1

    def fetch(self, path, params):
        query = dict(params)
        headers = {"Accept": "application/json", "User-Agent": "ArcadeMovieCatalog/1"}
        if self.provider == "omdb":
            base = "https://www.omdbapi.com/"
            query["apikey"] = self.key
        else:
            base = "https://api.themoviedb.org/3" + path
            if len(self.key) == 32:
                query["api_key"] = self.key
            else:
                headers["Authorization"] = "Bearer " + self.key
        request = urllib.request.Request(base + "?" + urllib.parse.urlencode(query), headers=headers)
        time.sleep(self.delay)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                status, body = response.status, response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            status, body = error.code, error.read().decode("utf-8")
        except (urllib.error.URLError, TimeoutError):
            # urllib exceptions may contain a credential-bearing URL.
            raise APIError(f"{self.provider}: network request failed; retry later.") from None
        return status, body

    def save(self, path, params, response):
        status, body = response
        request_key = digest(dump([self.provider, path, params]))
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = None
        not_found = (isinstance(payload, dict) and self.provider == "omdb"
                     and payload.get("Error") == "Movie not found!")
        usable = (status == 200 and isinstance(payload, dict)
                  and (payload.get("Response") != "False" or not_found)
                  and payload.get("success") is not False)
        cursor = self.db.execute(
            "INSERT INTO responses(request_key,provider,path,params_json,fetched_at,status,"
            "body,body_sha256,usable) VALUES (?,?,?,?,?,?,?,?,?)",
            (request_key, self.provider, path, dump(params), now(), status,
             body, digest(body), int(usable)))
        self.db.commit()
        if not usable:
            raise APIError(f"{self.provider}: HTTP {status} or provider error; raw response retained; "
                           "check credentials, quota and provider availability.",
                           cursor.lastrowid, status, payload.get("Error") if isinstance(payload, dict) else None)
        self.fetched_keys.add(request_key)
        return payload, cursor.lastrowid

    def get_many(self, jobs, workers=8):
        """Fetch independent requests concurrently; SQLite writes stay on the owner thread."""
        results = [None] * len(jobs)
        pending = []
        failure = None
        for index, (path, params) in enumerate(jobs):
            cached = self.cached(path, params)
            if cached:
                results[index] = cached
                continue
            try:
                self.reserve()
            except APIError as error:
                failure = error
                break
            pending.append((index, path, params))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [(index, path, params, pool.submit(self.fetch, path, params))
                       for index, path, params in pending]
            for index, path, params, future in futures:
                try:
                    results[index] = self.save(path, params, future.result())
                except APIError as error:
                    failure = failure or error
        if failure:
            raise failure
        return results


def link(db, movie_id, provider, external_id, evidence):
    old = db.execute("SELECT movie_id FROM identities WHERE provider=? AND external_id=?",
                     (provider, str(external_id))).fetchone()
    if old and old["movie_id"] != movie_id:
        return False
    movie_identity = db.execute("SELECT external_id FROM identities WHERE provider=? AND movie_id=?",
                                (provider, movie_id)).fetchone()
    if movie_identity and movie_identity["external_id"] != str(external_id):
        return False
    db.execute("INSERT OR IGNORE INTO identities VALUES (?,?,?,?,?)",
               (provider, str(external_id), movie_id, dump(evidence), now()))
    return True


def record_match(db, movie_id, provider, response_id, status, reason):
    db.execute("INSERT OR REPLACE INTO matches VALUES (?,?,?,?,?)",
               (movie_id, provider, response_id, status, reason))
    db.commit()


def reconcile_tmdb(db, client):
    identities = db.execute(
        "SELECT i.*,m.year FROM identities i JOIN movies m ON m.id=i.movie_id "
        "WHERE i.provider='omdb' AND NOT EXISTS "
        "(SELECT 1 FROM identities t WHERE t.provider='tmdb' AND t.movie_id=i.movie_id)").fetchall()
    jobs = [("/find/" + identity["external_id"], {"external_source": "imdb_id"})
            for identity in identities]
    for offset in range(0, len(jobs), 8):
        responses = client.get_many(jobs[offset:offset + 8])
        for identity, (payload, response_id) in zip(identities[offset:offset + 8], responses):
            results = [result for result in payload["movie_results"]
                       if result.get("original_language") == "te"
                       and result.get("release_date", "")[:4] == str(identity["year"])]
            status = "needs_review"
            if len(results) == 1 and link(db, identity["movie_id"], "tmdb", results[0]["id"],
                                         {"response_id": response_id, "imdb_id": identity["external_id"]}):
                status = "linked"
            record_match(db, identity["movie_id"], "tmdb", response_id, status,
                         "IMDb crosswalk; require unique Telugu movie and exact year; collisions not merged.")


def hydrate_omdb(db, client, movies):
    for movie in movies:
        if movie["year"] is None or movie["year"] < 1931:
            continue
        identity = db.execute("SELECT external_id FROM identities WHERE provider='omdb' AND movie_id=?",
                              (movie["id"],)).fetchone()
        if identity and not client.refresh:
            # Linked identities already have a complete raw hydration receipt.
            continue
        failed = db.execute("SELECT 1 FROM matches WHERE movie_id=? AND provider='omdb' "
                            "AND status='provider_error'", (movie["id"],)).fetchone()
        if failed and not client.refresh:
            continue
        tmdb_detail = db.execute(
            "SELECT r.body,r.id FROM matches m JOIN responses r ON r.id=m.response_id "
            "WHERE m.movie_id=? AND m.provider='tmdb' AND m.status='hydrated' ORDER BY r.id DESC LIMIT 1",
            (movie["id"],)).fetchone()
        imdb_id = json.loads(tmdb_detail["body"]).get("imdb_id") if tmdb_detail else None
        params = {"i": identity["external_id"]} if identity else {"i": imdb_id} if imdb_id else {
            "t": movie["title"], "y": movie["year"], "type": "movie"}
        params["plot"] = "full"
        try:
            payload, response_id = client.get("/", params)
        except APIError as error:
            if error.http_status == 200 and error.provider_message == "Error getting data.":
                record_match(db, movie["id"], "omdb", error.response_id, "provider_error",
                             "OMDb could not retrieve this record; retry explicitly with --refresh.")
                print(f"OMDb record unavailable for {movie['title']} ({movie['year']}); queued for review.",
                      file=sys.stderr)
                continue
            raise
        if payload.get("Response") == "False":
            record_match(db, movie["id"], "omdb", response_id, "not_found",
                         "No result for exact title and year; source retained.")
            continue
        language = payload.get("Language", "").split(", ")
        via_imdb = bool(imdb_id and payload.get("imdbID") == imdb_id)
        exact = ((via_imdb or title_key(payload.get("Title", "")) == title_key(movie["title"]))
                 and payload.get("Year") == str(movie["year"])
                 and "Telugu" in language and payload.get("Type") == "movie"
                 and re.fullmatch(r"tt\d+", payload.get("imdbID", "")))
        reason = ("TMDB-provided IMDb ID, exact year, Telugu language and movie type." if via_imdb else
                  "Exact normalized title, year, Telugu language and movie type.")
        status = "linked" if exact and link(db, movie["id"], "omdb", payload["imdbID"],
                                           {"response_id": response_id, "reason": reason}) else "needs_review"
        record_match(db, movie["id"], "omdb", response_id, status,
                     reason if status == "linked" else "Title/year/language/type mismatch or identity collision; not merged.")


def discover_tmdb(db, client, start_year, end_year):
    """Month shards avoid the 500-page cap; incomplete scopes never count as covered."""
    today = dt.date.today()
    for year in range(start_year, end_year + 1):
        for month in range(1, 13):
            first = dt.date(year, month, 1)
            if first > today:
                continue
            last = min(dt.date(year, month, calendar.monthrange(year, month)[1]), today)
            scope = f"tmdb:te:{first}:{last}"
            params = {
                "with_original_language": "te", "primary_release_date.gte": str(first),
                "primary_release_date.lte": str(last), "include_adult": "true",
                "include_video": "true", "sort_by": "primary_release_date.asc", "language": "en-US"}
            page, pages, count, receipts = 1, 1, 0, []
            seen_ids = set()
            expected_results = None
            db.execute("INSERT OR REPLACE INTO coverage VALUES (?,?,?,?)",
                       (scope, "in_progress", dump({"first": str(first), "last": str(last)}), now()))
            db.commit()
            while page <= pages:
                payload, response_id = client.get("/discover/movie", {**params, "page": page})
                pages = int(payload["total_pages"])
                if expected_results is None:
                    expected_results = payload["total_results"]
                elif expected_results != payload["total_results"]:
                    raise APIError(f"{scope}: discovery result count changed during pagination; refresh required.")
                if pages > 500:
                    raise APIError(f"{scope}: exceeds TMDB's page cap; split this interval before proceeding.")
                receipts.append(response_id)
                for result in payload["results"]:
                    if result.get("original_language") != "te":
                        raise APIError(f"{scope}: unexpected language in discovery result.")
                    released = dt.date.fromisoformat(result["release_date"])
                    if not first <= released <= last:
                        raise APIError(f"{scope}: release date outside requested interval.")
                    tmdb_id = str(result["id"])
                    if tmdb_id in seen_ids:
                        raise APIError(f"{scope}: duplicate paginated movie ID; coverage cannot be verified.")
                    seen_ids.add(tmdb_id)
                    existing = db.execute(
                        "SELECT movie_id FROM identities WHERE provider='tmdb' AND external_id=?", (tmdb_id,)).fetchone()
                    seeds = db.execute("SELECT id,title FROM movies WHERE id LIKE 'seed:%' AND year=?",
                                       (released.year,)).fetchall()
                    matching_seeds = [seed for seed in seeds
                                      if title_key(seed["title"]) == title_key(result["title"])]
                    movie_id = (existing["movie_id"] if existing else
                                matching_seeds[0]["id"] if len(matching_seeds) == 1 else f"tmdb:{tmdb_id}")
                    db.execute("INSERT OR IGNORE INTO movies VALUES (?,?,?,?,?)",
                               (movie_id, result["title"], released.year, "te", now()))
                    if movie_id.startswith("tmdb:"):
                        db.execute("UPDATE movies SET title=?,year=? WHERE id=?",
                                   (result["title"], released.year, movie_id))
                    link(db, movie_id, "tmdb", tmdb_id, {"response_id": response_id, "scope": scope})
                    count += 1
                db.commit()
                page += 1
            if count != payload["total_results"]:
                raise APIError(f"{scope}: result count changed; refresh this scope to verify coverage.")
            db.execute("INSERT OR REPLACE INTO coverage VALUES (?,?,?,?)",
                       (scope, "complete", dump({"count": count, "response_ids": receipts,
                                                "requested_through": str(today)}), now()))
            db.commit()
            # Hydrate each completed shard before advancing: progress is useful even
            # when a later shard reaches the per-run request budget.
            hydrate_tmdb(db, client)


def hydrate_tmdb(db, client):
    if client.refresh:
        identities = db.execute(
            "SELECT i.* FROM identities i WHERE i.provider='tmdb' AND NOT EXISTS "
            "(SELECT 1 FROM matches m JOIN responses r ON r.id=m.response_id "
            "WHERE m.movie_id=i.movie_id AND m.provider='tmdb' AND m.status='hydrated' AND r.fetched_at>=?)",
            (client.started_at,)).fetchall()
    else:
        identities = db.execute(
            "SELECT i.* FROM identities i WHERE i.provider='tmdb' AND NOT EXISTS "
            "(SELECT 1 FROM matches m WHERE m.movie_id=i.movie_id AND m.provider='tmdb' AND m.status='hydrated')"
        ).fetchall()
    jobs = [("/movie/" + identity["external_id"],
             {"append_to_response": APPENDS, "language": "en-US",
              "include_image_language": "te,en,null"}) for identity in identities]
    for offset in range(0, len(jobs), 8):
        batch = jobs[offset:offset + 8]
        responses = client.get_many(batch)
        for identity, (payload, response_id) in zip(identities[offset:offset + 8], responses):
            if str(payload.get("id")) != identity["external_id"]:
                raise APIError("TMDB detail identity mismatch.")
            failed = [name for name in APPENDS.split(",") if name not in payload or
                      (isinstance(payload[name], dict) and payload[name].get("success") is False)]
            if failed:
                record_match(db, identity["movie_id"], "tmdb", response_id, "hydrated_partial",
                             "Missing/failed appended endpoints: " + ", ".join(failed))
                raise APIError("TMDB appended endpoint failure; raw details retained, hydration incomplete.")
            record_match(db, identity["movie_id"], "tmdb", response_id, "hydrated",
                         "Native TMDB ID; full details and appended responses retained without field projection.")


def annotate(db, seeds):
    curated = {(title_key(name), seed["year"]): seed for seed in seeds
               for name in [seed["title"], *seed.get("aliases", [])]}
    for movie in db.execute("SELECT * FROM movies").fetchall():
        evidence = curated.get((title_key(movie["title"]), movie["year"]))
        prompt_title = evidence["title"] if evidence else movie["title"]
        words = prompt_title.split()
        length_score = 1 if len(words) <= 2 else 2 if len(words) <= 4 else 4 if len(words) <= 6 else 5
        components = {
            "title_complexity": {
                "value": length_score, "weight": 0.2, "method": "title-token-count",
                "reason": f"{len(words)} whitespace-delimited tokens; measures length only, not Telugu meaning."},
            "actability": {
                "value": None, "weight": 0.5, "method": "unreviewed",
                "reason": "Title meaning, gestures and film-specific cues need Telugu-aware review."},
            "recognition": {
                "value": None, "weight": 0.3, "method": "unreviewed",
                "reason": "No audience familiarity evidence; missing popularity is not evidence of obscurity."},
        }
        if evidence:
            for name in ("actability", "recognition"):
                components[name].update(evidence["difficulty"][name])
            status = "editorial"
        else:
            status = "needs_review"
        # Unknown dimensions span the entire rubric, never a fabricated neutral value.
        low = sum(c["weight"] * (c["value"] if c["value"] is not None else 1) for c in components.values())
        high = sum(c["weight"] * (c["value"] if c["value"] is not None else 5) for c in components.values())
        value = max(1, min(5, int(low + 0.5))) if evidence else None
        annotation = {
            "rubric": RUBRIC, "status": status, "difficulty": value,
            "prompt_title": prompt_title,
            "difficulty_range": [round(low, 2), round(high, 2)],
            "components": components, "confidence": "medium" if evidence else "low",
            "audience": "Telugu-film-aware casual adult players",
            "reason": evidence["difficulty"]["reason"] if evidence else
            "Final rating withheld: title length alone cannot support a defensible charades rating.",
            "sources": [evidence["source"]] if evidence else ["Source title; not independently verified"],
            "review_required": True,
        }
        input_sha = digest(dump(annotation))
        latest = db.execute("SELECT input_sha256 FROM annotations WHERE movie_id=? AND rubric=? "
                            "ORDER BY id DESC LIMIT 1", (movie["id"], RUBRIC)).fetchone()
        if not latest or latest["input_sha256"] != input_sha:
            db.execute("INSERT INTO annotations(movie_id,rubric,created_at,input_sha256,annotation_json)"
                       " VALUES (?,?,?,?,?)", (movie["id"], RUBRIC, now(), input_sha, dump(annotation)))
    db.commit()


def export(db, directory, run_errors=None):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    db.execute("BEGIN")
    catalog = []
    for movie in db.execute("SELECT * FROM movies ORDER BY year,title,id").fetchall():
        record = dict(movie)
        record["source_rows"] = [dict(row) for row in db.execute(
            "SELECT source_sha,row_number,raw_json,issues_json FROM source_rows WHERE movie_id=?", (movie["id"],))]
        for row in record["source_rows"]:
            row["raw"] = json.loads(row.pop("raw_json"))
            row["issues"] = json.loads(row.pop("issues_json"))
        record["identities"] = [dict(row) for row in db.execute(
            "SELECT provider,external_id,evidence_json FROM identities WHERE movie_id=?", (movie["id"],))]
        for identity in record["identities"]:
            identity["evidence"] = json.loads(identity.pop("evidence_json"))
        record["annotations"] = [
            {**json.loads(row["annotation_json"]), "id": row["id"], "created_at": row["created_at"],
             "input_sha256": row["input_sha256"]} for row in db.execute(
                "SELECT id,created_at,input_sha256,annotation_json FROM annotations WHERE movie_id=? ORDER BY id",
                (movie["id"],))]
        record["matches"] = [dict(row) for row in db.execute(
            "SELECT provider,response_id,status,reasoning FROM matches WHERE movie_id=?", (movie["id"],))]
        record["provider_data"] = {}
        for row in db.execute(
                "SELECT r.* FROM matches m JOIN responses r ON r.id=m.response_id "
                "WHERE m.movie_id=? AND m.status IN ('linked','hydrated','hydrated_partial') "
                "ORDER BY r.id", (movie["id"],)):
            # Crosswalk responses identify a movie but are not rich movie details.
            if row["provider"] == "tmdb" and not row["path"].startswith("/movie/"):
                continue
            record["provider_data"][row["provider"]] = {
                "response_id": row["id"], "fetched_at": row["fetched_at"],
                "http_status": row["status"], "data": json.loads(row["body"])}
        catalog.append(record)
    for name, rows in (
        ("movies.jsonl", catalog),
        ("responses.jsonl", (dict(row) for row in db.execute("SELECT * FROM responses ORDER BY id"))),
        ("coverage.jsonl", (dict(row) for row in db.execute("SELECT * FROM coverage ORDER BY scope"))),
        ("redirects.jsonl", (dict(row) for row in db.execute("SELECT * FROM redirects ORDER BY alias_id"))),
    ):
        target = directory / name
        temporary = target.with_suffix(".tmp")
        with temporary.open("w") as output:
            for row in rows:
                output.write(dump(row) + "\n")
        temporary.replace(target)
    manifest = {
        "schema_version": 1, "exported_at": now(), "movies": len(catalog),
        "source_records": db.execute("SELECT count(*) FROM source_rows").fetchone()[0],
        "source_records_with_warnings": db.execute(
            "SELECT count(*) FROM source_rows WHERE issues_json!='[]'").fetchone()[0],
        "linked_identities": db.execute("SELECT count(*) FROM identities").fetchone()[0],
        "provider_responses": {row["provider"]: row["count"] for row in db.execute(
            "SELECT provider,count(*) AS count FROM responses GROUP BY provider")},
        "provider_movie_counts": {row["provider"]: row["count"] for row in db.execute(
            "SELECT provider,count(*) AS count FROM identities GROUP BY provider")},
        "provider_run_status": {row["key"].split(":", 1)[1]: json.loads(row["value"]) for row in db.execute(
            "SELECT key,value FROM metadata WHERE key LIKE 'provider_run:%'")},
        "run_errors": run_errors or [],
        "provider_record_errors": db.execute(
            "SELECT count(*) FROM matches WHERE status='provider_error'").fetchone()[0],
        "coverage_scopes": [dict(row) for row in db.execute("SELECT scope,status FROM coverage ORDER BY scope")],
        "difficulty_reviewed": sum(bool(record["annotations"] and
                                       record["annotations"][-1]["difficulty"] is not None) for record in catalog),
        "difficulty_pending": sum(not record["annotations"] or
                                  record["annotations"][-1]["difficulty"] is None for record in catalog),
        "sources": [dict(row) for row in db.execute("SELECT sha256,path,headers_json FROM source_files")],
        "coverage_claim": "Source import plus explicitly completed TMDB intervals only; not an exhaustive filmography.",
        "attribution": "This product uses the TMDB API but is not endorsed or certified by TMDB. OMDb data: https://www.omdbapi.com/",
    }
    temporary = directory / "manifest.tmp"
    temporary.write_text(json.dumps(manifest, indent=2) + "\n")
    temporary.replace(directory / "manifest.json")
    db.commit()
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--export", type=Path, default=DEFAULT_EXPORT)
    parser.add_argument("--omdb", action="store_true", help="Hydrate known titles using OMDb")
    parser.add_argument("--tmdb", action="store_true", help="Discover and hydrate Telugu originals using TMDB")
    parser.add_argument("--start-year", type=int, default=2000)
    parser.add_argument("--end-year", type=int, default=dt.date.today().year)
    parser.add_argument("--max-calls", type=int, default=100, help="Per-provider live request budget")
    parser.add_argument("--refresh", action="store_true", help="Explicitly fetch new snapshots; keeps history")
    args = parser.parse_args()
    if args.start_year < 1931 or args.end_year < args.start_year or args.end_year > dt.date.today().year:
        parser.error("Year range must be between 1931 and the current year.")
    if args.max_calls < 1:
        parser.error("--max-calls must be positive.")
    load_env()
    seeds = json.loads(ANNOTATIONS.read_text())
    db = connect(args.db)
    errors = []
    try:
        imported = import_csv(db, args.csv)
        seed_movies(db, [seed for seed in seeds if seed.get("catalog_seed")])
        annotate(db, seeds)
        for provider, enabled in (("tmdb", args.tmdb), ("omdb", args.omdb)):
            if not enabled:
                continue
            key = os.environ.get(provider.upper() + "_API_KEY")
            if provider == "tmdb" and not key:
                key = os.environ.get("TMDB_READ_TOKEN")
            client = Client(db, provider, key,
                            args.max_calls, args.refresh)
            provider_error = None
            try:
                if provider == "tmdb":
                    reconcile_tmdb(db, client)
                    discover_tmdb(db, client, args.start_year, args.end_year)
                    hydrate_tmdb(db, client)
                else:
                    # Current-year source lists can include planned releases.
                    movies = db.execute("SELECT * FROM movies WHERE year < ? OR id LIKE 'seed:%' "
                                        "ORDER BY CASE WHEN id LIKE 'seed:%' THEN 0 ELSE 1 END, year DESC,title",
                                        (dt.date.today().year,)).fetchall()
                    hydrate_omdb(db, client, movies)
            except APIError as error:
                provider_error = str(error)
                errors.append(provider_error)
            db.execute("INSERT INTO metadata VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                       ("provider_run:" + provider, dump({
                           "status": "partial" if provider_error else "complete_selected_scope",
                           "finished_at": now(), "live_calls": client.calls, "error": provider_error,
                           "start_year": args.start_year, "end_year": args.end_year})))
            db.commit()
        reconcile_seed_aliases(db, seeds)
        annotate(db, seeds)
        manifest = export(db, args.export, errors)
        print(dump({"imported": imported, **manifest, "errors": errors}))
    finally:
        db.close()
    return 2 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
