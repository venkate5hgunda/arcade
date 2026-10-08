"""Quota-aware all-years ingestion, weekly refresh and local macOS scheduling."""

import argparse
import calendar
from contextlib import contextmanager
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys

from . import catalog, wikidata

LABEL = "org.arcade.movies.maintenance"
STATE_KEY = "maintenance:v1"
LOCAL = catalog.MODULE_DIR / ".local/maintenance"


class DailyBudgetReached(catalog.APIError):
    pass


@contextmanager
def run_lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("Movie maintenance is already running; no second job started.") from None
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def initialize(db):
    db.execute(
        "CREATE TABLE IF NOT EXISTS maintenance_budgets("
        "day TEXT NOT NULL,provider TEXT NOT NULL,reserved_calls INTEGER NOT NULL,"
        "PRIMARY KEY(day,provider))")
    db.commit()


def save_state(db, state):
    db.execute("INSERT INTO metadata VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
               (STATE_KEY, catalog.dump(state)))
    db.commit()


class DailyClient(catalog.Client):
    def __init__(self, db, provider, key, budget, refresh_since=None, delay=0.25):
        super().__init__(db, provider, key, max_calls=budget,
                         refresh=bool(refresh_since) and provider == "omdb", delay=delay)
        self.budget = min(budget, 950) if provider == "omdb" else budget
        self.refresh_since = refresh_since
        self.refresh_prefixes = ()
        self.force_since = None

    def reserve(self):
        day = catalog.now()[:10]
        count = self.db.execute(
            "SELECT count(*) FROM responses WHERE provider=? AND substr(fetched_at,1,10)=?",
            (self.provider, day)).fetchone()[0]
        old = self.db.execute(
            "SELECT reserved_calls FROM maintenance_budgets WHERE day=? AND provider=?",
            (day, self.provider)).fetchone()
        used = max(count, old[0] if old else 0)
        if used >= self.budget:
            raise DailyBudgetReached(f"{self.provider}: local UTC-day budget exhausted ({self.budget}); resume next day.")
        super().reserve()
        self.db.execute("INSERT INTO maintenance_budgets VALUES (?,?,?) "
                        "ON CONFLICT(day,provider) DO UPDATE SET reserved_calls=excluded.reserved_calls",
                        (day, self.provider, used + 1))
        self.db.commit()

    def cached(self, path, params):
        retry = self.db.execute("SELECT value FROM metadata WHERE key=?",
                                ("maintenance:retry:" + self.provider + ":" + path,)).fetchone()
        since = [retry[0]] if retry else []
        if path.startswith(self.refresh_prefixes):
            since.extend(value for value in (self.refresh_since, self.force_since) if value)
        if since:
            # Apply the ordinary credential-parameter guard before custom cache lookup.
            super().cached(path, params)
            key = catalog.digest(catalog.dump([self.provider, path, params]))
            row = self.db.execute(
                "SELECT * FROM responses WHERE request_key=? AND usable=1 AND fetched_at>=? "
                "ORDER BY id DESC LIMIT 1", (key, max(since))).fetchone()
            return (json.loads(row["body"]), row["id"]) if row else None
        return super().cached(path, params)


def scopes(through):
    for year in range(1931, through.year + 1):
        for month in range(1, 13):
            first = dt.date(year, month, 1)
            if first > through:
                return
            last = min(through, dt.date(year, month, calendar.monthrange(year, month)[1]))
            yield year, month, f"tmdb:te:{first}:{last}"


def discover_all(db, client):
    scope = "tmdb:te:all-original-language"
    params = {"with_original_language": "te", "include_adult": "true", "include_video": "true",
              "sort_by": "primary_release_date.asc", "language": "en-US"}
    db.execute("INSERT OR REPLACE INTO coverage VALUES (?,?,?,?)",
               (scope, "in_progress", "{}", catalog.now()))
    db.commit()
    page, pages, total, seen, receipts = 1, 1, None, set(), []
    while page <= pages:
        payload, receipt = client.get("/discover/movie", {**params, "page": page})
        pages = int(payload["total_pages"])
        if pages > 500:
            raise catalog.APIError("All-language-scope scan exceeds TMDB's 500-page cap; "
                                   "undated coverage needs another discovery strategy.")
        if total is not None and total != payload["total_results"]:
            raise catalog.DiscoveryChanged("All-original-language discovery changed during pagination.")
        total = payload["total_results"]
        for result in payload["results"]:
            if result.get("original_language") != "te":
                raise catalog.APIError("All-original-language scan returned a non-Telugu original.")
            if result["id"] in seen:
                raise catalog.DiscoveryChanged("All-original-language discovery returned a duplicate ID.")
            seen.add(result["id"])
            catalog.register_tmdb_movie(db, result, receipt, scope)
        receipts.append(receipt)
        db.commit()
        page += 1
    if len(seen) != total:
        raise catalog.DiscoveryChanged("All-original-language discovery count does not match provider total.")
    db.execute("INSERT OR REPLACE INTO coverage VALUES (?,?,?,?)",
               (scope, "complete", catalog.dump({"count": total, "response_ids": receipts,
                                                "includes_undated_and_future": True}), catalog.now()))
    db.commit()


def hydrate_details(db, client, refresh_since):
    while True:
        identities = db.execute(
            "SELECT i.* FROM identities i WHERE provider='tmdb' AND NOT EXISTS "
            "(SELECT 1 FROM matches m JOIN responses r ON r.id=m.response_id "
            "WHERE m.movie_id=i.movie_id AND m.provider='tmdb' "
            "AND m.status IN ('hydrated','provider_unavailable') AND (? IS NULL OR r.fetched_at>=?)) "
            "ORDER BY external_id LIMIT 8", (refresh_since, refresh_since)).fetchall()
        if not identities:
            return
        try:
            results = client.get_many([catalog.detail_job(row["external_id"]) for row in identities])
        except catalog.APIError as error:
            if error.http_status != 404:
                raise
            response = db.execute("SELECT path FROM responses WHERE id=?", (error.response_id,)).fetchone()
            identity = next((row for row in identities
                             if "/movie/" + row["external_id"] == response["path"]), None)
            if not identity:
                raise
            catalog.record_match(db, identity["movie_id"], "tmdb", error.response_id, "provider_unavailable",
                                 "TMDB returned HTTP 404; movie and raw failure retained, retry next refresh cycle.")
            continue
        for identity, (payload, receipt) in zip(identities, results):
            try:
                catalog.validate_details(db, identity["movie_id"], identity["external_id"], payload, receipt)
            except catalog.APIError:
                db.execute("INSERT INTO metadata VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                           ("maintenance:retry:tmdb:/movie/" + identity["external_id"], catalog.now()))
                db.commit()
                raise
            catalog.record_match(db, identity["movie_id"], "tmdb", receipt, "hydrated",
                                 "Scheduled native-ID full detail snapshot; original responses retained.")


def tmdb_work(db, client, state):
    through = dt.date.fromisoformat(state["through"])
    refresh = state["kind"] == "refresh"
    progress = state["tmdb"]
    if progress["stage"] == "dated":
        client.refresh_prefixes = ("/discover/movie",)
        client.force_since = progress.get("force_since")
        for index, (year, month, scope) in enumerate(scopes(through)):
            if index < progress["month_cursor"]:
                continue
            covered = db.execute("SELECT status FROM coverage WHERE scope=?", (scope,)).fetchone()
            if refresh or not covered or covered[0] != "complete":
                catalog.discover_tmdb(db, client, year, year, months={(year, month)}, through_date=through)
            progress.update(month_cursor=index + 1, force_since=None)
            client.force_since = None
            save_state(db, state)
        progress["stage"] = "all"
        save_state(db, state)
    if progress["stage"] == "all":
        client.refresh_prefixes = ("/discover/movie",)
        client.force_since = progress.get("force_since")
        discover_all(db, client)
        progress.update(stage="details", force_since=None)
        save_state(db, state)
    if progress["stage"] == "details":
        client.refresh_prefixes = ("/movie/",)
        client.force_since = None
        hydrate_details(db, client, state["started_at"] if refresh else None)
        progress["stage"] = "sources"
        save_state(db, state)
    if progress["stage"] == "sources":
        client.refresh_prefixes = ("/search/movie", "/find/")
        catalog.reconcile_tmdb(db, client)
        catalog.hydrate_tmdb_sources(db, client)
        client.refresh_prefixes = ("/movie/",)
        hydrate_details(db, client, state["started_at"] if refresh else None)
        progress["stage"] = "done"
        save_state(db, state)


def eligible_omdb(db, through):
    movies = db.execute("SELECT * FROM movies WHERE year BETWEEN 1931 AND ? ORDER BY year DESC,title,id",
                        (through.year,)).fetchall()
    selected = []
    for movie in movies:
        if movie["year"] == through.year and not movie["id"].startswith("seed:"):
            row = db.execute(
                "SELECT r.body FROM matches m JOIN responses r ON r.id=m.response_id "
                "WHERE movie_id=? AND m.provider='tmdb' AND m.status='hydrated' ORDER BY r.id DESC LIMIT 1",
                (movie["id"],)).fetchone()
            release = json.loads(row[0]).get("release_date") if row else None
            if not release or release > str(through):
                continue
        selected.append(movie)
    return selected


def new_cycle(kind, today, timestamp):
    return {"kind": kind, "mode": "growing" if kind == "backfill" else "refreshing",
            "started_at": timestamp, "through": str(today),
            "tmdb": {"stage": "dated", "month_cursor": 0},
            "providers": {}, "coverage_claim": "Provider-scoped index, not a verified exhaustive filmography."}


def annotation_work(db, state, daily_calls):
    from . import gemini_annotation

    try:
        result = gemini_annotation.annotate_existing(db, daily_calls=daily_calls)
        state["annotations"] = result
        failures = [result["provider_error"]] if result["provider_error"] else []
        if result["singleton_failures"]:
            failures.append(f"{len(result['singleton_failures'])} annotation jobs need schema/identity review.")
        return failures
    except (gemini_annotation.ProviderFailure, ValueError, RuntimeError) as error:
        state["annotations"] = {"error": str(error)}
        return [f"Gemini annotation: {error}"]


def wikidata_work(db, state, tmdb_budget):
    """Weekly Wikidata census + new Wikipedia articles/pageviews; grows the catalog via TMDB IDs."""
    key = os.environ.get("TMDB_API_KEY") or os.environ.get("TMDB_READ_TOKEN")
    tmdb = catalog.Client(db, "tmdb", key, max_calls=min(tmdb_budget, 1000)) if key else None
    try:
        state["wikidata"] = {**wikidata.run(db, tmdb), "finished_at": catalog.now()}
        return []
    except (catalog.APIError, OSError, ValueError, KeyError) as error:
        state["wikidata"] = {"error": str(error), "finished_at": catalog.now()}
        return [f"wikidata: {error}"]


def run(db, export_dir, tmdb_budget=5000, omdb_budget=950, refresh_days=7, gemini_daily_calls=1000):
    initialize(db)
    old = db.execute("SELECT value FROM metadata WHERE key=?", (STATE_KEY,)).fetchone()
    state = json.loads(old[0]) if old else new_cycle("backfill", dt.date.today(), catalog.now())
    if state["mode"] == "idle":
        if catalog.now() < state["next_refresh_at"]:
            catalog.load_env()
            errors = wikidata_work(db, state, tmdb_budget)
            errors += annotation_work(db, state, gemini_daily_calls)
            save_state(db, state)
            catalog.annotate(db, json.loads(catalog.ANNOTATIONS.read_text()))
            manifest = catalog.export(db, export_dir, errors)
            return {"mode": "idle", "next_refresh_at": state["next_refresh_at"],
                    "annotations": state["annotations"], "movies": manifest["movies"],
                    "errors": errors}
        state = new_cycle("refresh", dt.date.today(), catalog.now())
    state["last_run_started_at"] = catalog.now()
    save_state(db, state)
    catalog.load_env()
    seeds = json.loads(catalog.ANNOTATIONS.read_text())
    catalog.import_csv(db, catalog.DEFAULT_CSV)
    catalog.seed_movies(db, [seed for seed in seeds if seed.get("catalog_seed")])
    errors = []
    refresh_since = state["started_at"] if state["kind"] == "refresh" else None
    for provider, budget in (("tmdb", tmdb_budget), ("omdb", omdb_budget)):
        key = os.environ.get(provider.upper() + "_API_KEY")
        if provider == "tmdb" and not key:
            key = os.environ.get("TMDB_READ_TOKEN")
        client = DailyClient(db, provider, key, budget, refresh_since)
        status, error_message = "complete_selected_scope", None
        try:
            if provider == "tmdb":
                tmdb_work(db, client, state)
            else:
                client.refresh_prefixes = ("/",)
                catalog.hydrate_omdb(db, client, eligible_omdb(db, dt.date.fromisoformat(state["through"])))
        except catalog.APIError as error:
            error_message = str(error)
            status = "daily_budget_limited" if isinstance(error, DailyBudgetReached) else "provider_or_coverage_error"
            errors.append(error_message)
            if provider == "tmdb" and isinstance(error, catalog.DiscoveryChanged):
                state["tmdb"]["force_since"] = catalog.now()
        result = {"status": status, "error": error_message, "live_calls": client.calls,
                  "finished_at": catalog.now(), "maintenance_cycle": state["started_at"]}
        state["providers"][provider] = result
        db.execute("INSERT INTO metadata VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                   ("provider_run:" + provider, catalog.dump(result)))
        save_state(db, state)
    if state["tmdb"]["stage"] == "done" and not errors:
        finished = dt.datetime.fromisoformat(catalog.now())
        anchor = finished if state["kind"] == "backfill" else dt.datetime.fromisoformat(state["started_at"])
        state.update(mode="idle", completed_at=catalog.now(),
                     next_refresh_at=max(finished, anchor + dt.timedelta(days=refresh_days)).isoformat())
    errors.extend(wikidata_work(db, state, tmdb_budget))
    state["last_run_finished_at"] = catalog.now()
    errors.extend(annotation_work(db, state, gemini_daily_calls))
    save_state(db, state)
    catalog.reconcile_seed_aliases(db, seeds)
    catalog.annotate(db, seeds)
    manifest = catalog.export(db, export_dir, errors)
    return {"mode": state["mode"], "cycle_kind": state["kind"], "tmdb_stage": state["tmdb"]["stage"],
            "movies": manifest["movies"], "provider_movie_counts": manifest["provider_movie_counts"],
            "providers": state["providers"], "errors": errors, "next_refresh_at": state.get("next_refresh_at")}


def agent_definition(hour, minute, db_path, export_dir, tmdb_budget, omdb_budget, refresh_days,
                     gemini_daily_calls=1000):
    return {
        "Label": LABEL, "WorkingDirectory": str(catalog.ROOT),
        "ProgramArguments": [str(Path(sys.executable).resolve()), "-m", "dev.movies.maintenance", "run",
                             "--db", str(db_path.resolve()), "--export", str(export_dir.resolve()),
                             "--tmdb-budget", str(tmdb_budget), "--omdb-budget", str(omdb_budget),
                             "--refresh-days", str(refresh_days),
                             "--gemini-daily-calls", str(gemini_daily_calls)],
        "StartCalendarInterval": {"Hour": hour, "Minute": minute}, "RunAtLoad": True,
        "StandardOutPath": str(LOCAL / "stdout.log"), "StandardErrorPath": str(LOCAL / "stderr.log"),
        "ProcessType": "Background",
    }


def launchctl(*arguments):
    return subprocess.run(["launchctl", *arguments], capture_output=True, text=True, check=True)


def install(args):
    if sys.platform != "darwin":
        raise RuntimeError("Automatic installation requires macOS; run the module with your platform's scheduler.")
    LOCAL.mkdir(parents=True, exist_ok=True)
    path = Path.home() / "Library/LaunchAgents" / (LABEL + ".plist")
    if path.exists():
        raise RuntimeError(f"Agent already exists at {path}; uninstall explicitly before replacing it.")
    path.parent.mkdir(parents=True, exist_ok=True)
    definition = agent_definition(args.hour, args.minute, args.db, args.export,
                                  args.tmdb_budget, args.omdb_budget, args.refresh_days,
                                  args.gemini_daily_calls)
    with path.open("xb") as output:
        plistlib.dump(definition, output)
    path.chmod(0o600)
    try:
        launchctl("bootstrap", f"gui/{os.getuid()}", str(path))
    except subprocess.CalledProcessError:
        path.unlink()
        raise
    launchctl("print", f"gui/{os.getuid()}/{LABEL}")
    return {"installed": str(path), "daily_local_time": f"{args.hour:02}:{args.minute:02}",
            "refresh_days": args.refresh_days}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("run", "status", "install", "uninstall"))
    parser.add_argument("--db", type=Path, default=catalog.DEFAULT_DB)
    parser.add_argument("--export", type=Path, default=catalog.DEFAULT_EXPORT)
    parser.add_argument("--tmdb-budget", type=int, default=5000)
    parser.add_argument("--omdb-budget", type=int, default=950)
    parser.add_argument("--refresh-days", type=int, default=7)
    parser.add_argument("--gemini-daily-calls", type=int, default=1000)
    parser.add_argument("--hour", type=int, default=11)
    parser.add_argument("--minute", type=int, default=0)
    args = parser.parse_args()
    if min(args.tmdb_budget, args.omdb_budget, args.refresh_days, args.gemini_daily_calls) < 1:
        parser.error("Budgets and refresh interval must be positive.")
    if not 0 <= args.hour < 24 or not 0 <= args.minute < 60:
        parser.error("Invalid local calendar time.")
    try:
        if args.command == "install":
            result = install(args)
        elif args.command == "uninstall":
            path = Path.home() / "Library/LaunchAgents" / (LABEL + ".plist")
            if not path.is_file():
                raise RuntimeError("No installed movie maintenance agent.")
            launchctl("bootout", f"gui/{os.getuid()}", str(path))
            path.unlink()
            result = {"uninstalled": str(path)}
        else:
            with run_lock(args.db.parent / "maintenance.lock"):
                db = catalog.connect(args.db)
                try:
                    if args.command == "status":
                        row = db.execute("SELECT value FROM metadata WHERE key=?", (STATE_KEY,)).fetchone()
                        result = json.loads(row[0]) if row else {"mode": "not_started"}
                    else:
                        result = run(db, args.export, args.tmdb_budget, args.omdb_budget,
                                     args.refresh_days, args.gemini_daily_calls)
                finally:
                    db.close()
        print(catalog.dump(result))
        return 2 if result.get("errors") else 0
    except (catalog.APIError, RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print(f"Movie maintenance: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
