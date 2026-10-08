"""Wikidata/Wikipedia enrichment: identity crosswalk, catalog growth, summaries, cast and pageviews.

Every provider response is retained raw in `responses`; links are exact (native
TMDB/IMDb IDs first, then unique normalized title + release year) and anything
ambiguous is queued for review instead of merged or inserted.
"""

import argparse
from collections import defaultdict
import datetime as dt
import json
from pathlib import Path
import re
import sys
import urllib.parse

from . import catalog

TELUGU = "Q8097"
SCOPE = "wikidata:te:films"
SPARQL = """SELECT ?item ?label ?article ?date ?tmdb ?imdb WHERE {
  ?item wdt:P364 wd:%s; wdt:P31/wdt:P279* wd:Q11424.
  OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "en") }
  OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?item wdt:P577 ?date }
  OPTIONAL { ?item wdt:P4947 ?tmdb }
  OPTIONAL { ?item wdt:P345 ?imdb }
}""" % TELUGU
API = "/w/api.php"
IDENTITY_ISSUES = ("Unreliable year", "Repeated normalized title/year")
SUMMARY_CHARS = 220


def strip_film(title):
    return re.sub(r"\s*\((?:[^()]*\bfilm|[^()]*\bmovie)\)\s*$", "", title or "").strip()


def loose_key(title):
    """Transliteration-tolerant key, used only to *block* risky inserts, never to merge."""
    key = catalog.title_key(title)
    for old, new in (("ee", "i"), ("oo", "u"), ("aa", "a"), ("w", "v"), ("z", "j"), ("h", "")):
        key = key.replace(old, new)
    return re.sub(r"(.)\1+", r"\1", key)


def article_title(url):
    return urllib.parse.unquote(url.rsplit("/wiki/", 1)[1]).replace("_", " ")


def group_items(bindings):
    items = defaultdict(lambda: {"labels": set(), "articles": set(), "years": set(),
                                 "tmdb": set(), "imdb": set()})
    for row in bindings:
        item = items[row["item"]["value"].rsplit("/", 1)[1]]
        if "label" in row:
            item["labels"].add(row["label"]["value"])
        if "article" in row:
            item["articles"].add(article_title(row["article"]["value"]))
        if "date" in row and re.match(r"^\d{4}-", row["date"]["value"]):
            item["years"].add(int(row["date"]["value"][:4]))
        if "tmdb" in row and row["tmdb"]["value"].isdigit():
            item["tmdb"].add(row["tmdb"]["value"])
        if "imdb" in row and re.fullmatch(r"tt\d+", row["imdb"]["value"]):
            item["imdb"].add(row["imdb"]["value"])
    return items


def discover(db, client, max_age_days=7):
    latest = db.execute("SELECT fetched_at FROM responses WHERE provider='wikidata' AND usable=1 "
                        "ORDER BY id DESC LIMIT 1").fetchone()
    stale = not latest or dt.datetime.fromisoformat(latest[0]) < (
        dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=max_age_days))
    previous, client.refresh = client.refresh, client.refresh or stale
    try:
        payload, response_id = client.get("/sparql", {"query": SPARQL, "format": "json"})
    finally:
        client.refresh = previous
    items = group_items(payload["results"]["bindings"])
    db.execute("INSERT OR REPLACE INTO coverage VALUES (?,?,?,?)",
               (SCOPE, "complete", catalog.dump({"items": len(items), "response_id": response_id}),
                catalog.now()))
    db.commit()
    return items, response_id


def review(db, entries):
    db.execute("INSERT INTO metadata VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
               ("wikidata:review", catalog.dump(entries)))
    db.commit()


def link_items(db, items, response_id):
    """Exact crosswalk. Returns unlinked items for expansion and a review queue."""
    by_provider = {provider: {row["external_id"]: row["movie_id"] for row in db.execute(
        "SELECT external_id,movie_id FROM identities WHERE provider=?", (provider,))}
        for provider in ("tmdb", "omdb", "wikidata")}
    claims = defaultdict(set)
    for qid, item in items.items():
        for name in item["labels"] | {strip_film(a) for a in item["articles"]}:
            for year in item["years"]:
                claims[(catalog.title_key(name), year)].add(qid)
    titles = defaultdict(set)
    for movie in db.execute("SELECT id,title,year FROM movies WHERE year IS NOT NULL"):
        titles[(catalog.title_key(movie["title"]), movie["year"])].add(movie["id"])
    linked, unlinked, queue = 0, {}, []
    for qid, item in sorted(items.items()):
        if qid in by_provider["wikidata"]:
            continue
        native = ({by_provider["tmdb"][t] for t in item["tmdb"] if t in by_provider["tmdb"]}
                  | {by_provider["omdb"][i] for i in item["imdb"] if i in by_provider["omdb"]})
        method = "native-id"
        if not native and not (item["tmdb"] - by_provider["tmdb"].keys()):
            keys = {(catalog.title_key(name), year)
                    for name in item["labels"] | {strip_film(a) for a in item["articles"]}
                    for year in item["years"]}
            if any(len(claims[key]) > 1 for key in keys if titles.get(key)):
                queue.append({"qid": qid, "reason": "Several Wikidata films share this title/year."})
                continue
            native = set().union(*(titles.get(key, set()) for key in keys)) if keys else set()
            native = {movie for movie in native if movie not in by_provider["wikidata"].values()}
            method = "exact-title-year"
        if len(native) > 1:
            queue.append({"qid": qid, "movies": sorted(native), "reason": "Matches several catalog records."})
            continue
        if not native:
            unlinked[qid] = item
            continue
        movie_id = next(iter(native))
        evidence = {"method": method, "sparql_response_id": response_id, "tmdb": sorted(item["tmdb"]),
                    "imdb": sorted(item["imdb"]), "years": sorted(item["years"]),
                    "articles": sorted(item["articles"])}
        if catalog.link(db, movie_id, "wikidata", qid, evidence):
            by_provider["wikidata"][qid] = movie_id
            catalog.record_match(db, movie_id, "wikidata", response_id, "linked",
                                 "Native TMDB/IMDb ID crosswalk." if method == "native-id" else
                                 "Unique exact normalized title and Wikidata publication year.")
            linked += 1
        else:
            queue.append({"qid": qid, "movie": movie_id, "reason": "Identity collision; not merged."})
    db.commit()
    return linked, unlinked, queue


def blocked_by_near_duplicate(db, title, year):
    key = loose_key(title)
    for movie in db.execute("SELECT id,title FROM movies WHERE year BETWEEN ? AND ?", (year - 1, year + 1)):
        if loose_key(movie["title"]) == key:
            return movie["id"]
    return None


def expand(db, unlinked, response_id, tmdb_client):
    """Add Telugu films Wikidata knows but the catalog lacks; never insert likely duplicates."""
    added, queue = [], []
    with_tmdb = [(qid, item) for qid, item in sorted(unlinked.items()) if len(item["tmdb"]) == 1]
    if tmdb_client and with_tmdb:
        for qid, item in with_tmdb:
            external_id = next(iter(item["tmdb"]))
            try:
                payload, detail_id = tmdb_client.get(*catalog.detail_job(external_id))
            except catalog.APIError as error:
                queue.append({"qid": qid, "tmdb": external_id, "response_id": error.response_id,
                              "reason": f"TMDB detail unavailable (HTTP {error.http_status})."})
                if error.http_status in (None, 401, 429) or "budget" in str(error):
                    break
                continue
            year = int(payload["release_date"][:4]) if payload.get("release_date") else None
            appended = all(name in payload and not (isinstance(payload[name], dict)
                                                    and payload[name].get("success") is False)
                           for name in catalog.APPENDS.split(","))
            if (payload.get("adult") or not payload.get("title") or str(payload.get("id")) != external_id
                    or not appended):
                queue.append({"qid": qid, "tmdb": external_id, "response_id": detail_id,
                              "reason": "Unusable or incomplete TMDB detail."})
                continue
            if year is None or (item["years"] and year not in item["years"]):
                queue.append({"qid": qid, "tmdb": external_id,
                              "reason": "TMDB release year disagrees with Wikidata publication years."})
                continue
            duplicate = blocked_by_near_duplicate(db, payload["title"], year)
            if duplicate:
                queue.append({"qid": qid, "tmdb": external_id, "near_duplicate": duplicate,
                              "reason": "Transliteration-level near duplicate in catalog; not inserted."})
                continue
            movie_id = f"tmdb:{external_id}"
            db.execute("INSERT OR IGNORE INTO movies VALUES (?,?,?,?,?)",
                       (movie_id, payload["title"], year, "te", catalog.now()))
            evidence = {"source": "wikidata", "qid": qid, "sparql_response_id": response_id,
                        "detail_response_id": detail_id,
                        "reason": "Wikidata P364=Telugu with this TMDB ID; release year agrees."}
            if not (catalog.link(db, movie_id, "tmdb", external_id, evidence)
                    and catalog.link(db, movie_id, "wikidata", qid, evidence)):
                queue.append({"qid": qid, "tmdb": external_id, "reason": "Identity collision; not merged."})
                continue
            catalog.record_match(db, movie_id, "tmdb", detail_id, "hydrated",
                                 "Wikidata-sourced native TMDB ID; full detail snapshot retained.")
            catalog.record_match(db, movie_id, "wikidata", response_id, "linked", evidence["reason"])
            added.append(movie_id)
    for qid, item in sorted(unlinked.items()):
        if item["tmdb"] or len(item["articles"]) != 1 or not item["years"]:
            continue
        title = strip_film(next(iter(item["articles"])))
        year = min(item["years"])
        duplicate = blocked_by_near_duplicate(db, title, year)
        if duplicate:
            queue.append({"qid": qid, "near_duplicate": duplicate,
                          "reason": "Transliteration-level near duplicate in catalog; not inserted."})
            continue
        movie_id = f"wikidata:{qid}"
        db.execute("INSERT OR IGNORE INTO movies VALUES (?,?,?,?,?)", (movie_id, title, year, "te", catalog.now()))
        evidence = {"source": "wikidata", "sparql_response_id": response_id, "articles": sorted(item["articles"]),
                    "years": sorted(item["years"]), "imdb": sorted(item["imdb"]),
                    "reason": "Wikidata Telugu film with an English Wikipedia article; earliest publication year."}
        if catalog.link(db, movie_id, "wikidata", qid, evidence):
            catalog.record_match(db, movie_id, "wikidata", response_id, "linked", evidence["reason"])
            added.append(movie_id)
    db.commit()
    return added, queue


def linked_articles(db, items):
    rows = db.execute("SELECT external_id,movie_id FROM identities WHERE provider='wikidata'").fetchall()
    return {row["movie_id"]: sorted(items[row["external_id"]]["articles"])[0]
            for row in rows if row["external_id"] in items and len(items[row["external_id"]]["articles"]) == 1}


def hydrate_articles(db, client, articles, log=sys.stderr):
    """Full plain-text extract (+ Wikidata/page props) for each linked article; raw responses retained."""
    done = {row[0] for row in db.execute(
        "SELECT movie_id FROM matches WHERE provider='wikipedia' AND status='hydrated'")}
    pending = [(movie, title) for movie, title in sorted(articles.items()) if movie not in done]
    for index, (movie_id, title) in enumerate(pending, 1):
        payload, response_id = client.get(API, {
            "action": "query", "prop": "extracts|pageprops|info", "explaintext": 1,
            "exsectionformat": "wiki", "titles": title, "redirects": 1,
            "format": "json", "formatversion": 2})
        page = (payload.get("query", {}).get("pages") or [{}])[0]
        if page.get("missing") or not page.get("extract"):
            catalog.record_match(db, movie_id, "wikipedia", response_id, "not_found",
                                 "Linked article has no extract; raw response retained.")
            continue
        catalog.link(db, movie_id, "wikipedia", page["pageid"], {"response_id": response_id, "title": page["title"]})
        catalog.record_match(db, movie_id, "wikipedia", response_id, "hydrated",
                             "Full plain-text article extract and page properties retained.")
        if index % 100 == 0:
            print(f"Wikipedia articles: {index}/{len(pending)}", file=log)


def hydrate_pageviews(db, client, batch=20):
    """Daily pageviews for the last 60 days, batched; a familiarity signal for Telugu audiences."""
    rows = db.execute("SELECT i.movie_id,i.external_id FROM identities i WHERE i.provider='wikipedia' AND NOT EXISTS "
                      "(SELECT 1 FROM matches m WHERE m.movie_id=i.movie_id AND m.provider='wikipedia-pageviews')"
                      ).fetchall()
    for offset in range(0, len(rows), batch):
        chunk = rows[offset:offset + batch]
        params = {"action": "query", "prop": "pageviews", "pageids": "|".join(r["external_id"] for r in chunk),
                  "pvipdays": 60, "format": "json", "formatversion": 2}
        found, last = {}, None
        while True:
            payload, last = client.get(API, params)
            for page in payload.get("query", {}).get("pages", []):
                if page.get("pageviews"):
                    found[str(page["pageid"])] = last
            if "continue" not in payload:
                break
            params = {**params, **payload["continue"]}
        for row in chunk:
            catalog.record_match(db, row["movie_id"], "wikipedia-pageviews", found.get(row["external_id"], last),
                                 "hydrated", "Batched 60-day pageviews response (with continuations) retained.")


def article(db, movie_id):
    row = db.execute("SELECT r.body FROM matches m JOIN responses r ON r.id=m.response_id WHERE m.movie_id=? "
                     "AND m.provider='wikipedia' AND m.status='hydrated' ORDER BY r.id DESC LIMIT 1",
                     (movie_id,)).fetchone()
    if not row:
        return None
    page = json.loads(row[0])["query"]["pages"][0]
    parsed = parse_extract(page.get("extract", ""))
    views = db.execute("SELECT r.body FROM matches m JOIN responses r ON r.id=m.response_id WHERE m.movie_id=? "
                       "AND m.provider='wikipedia-pageviews' ORDER BY r.id DESC LIMIT 1", (movie_id,)).fetchone()
    if views:
        match = [p for p in json.loads(views[0])["query"]["pages"] if p.get("pageid") == page["pageid"]]
        daily = (match[0].get("pageviews") or {}) if match else {}
        parsed["pageviews_last_60_days"] = sum(v for v in daily.values() if isinstance(v, int)) if daily else None
    parsed.update(title=page["title"], pageid=page["pageid"],
                  wikidata=page.get("pageprops", {}).get("wikibase_item"))
    return parsed


def omdb_facts(db, movie_id):
    row = db.execute("SELECT r.body FROM identities i JOIN matches m ON m.movie_id=i.movie_id AND m.provider='omdb' "
                     "AND m.status='linked' JOIN responses r ON r.id=m.response_id WHERE i.provider='omdb' "
                     "AND i.movie_id=? ORDER BY r.id DESC LIMIT 1", (movie_id,)).fetchone()
    if not row:
        return {}
    payload = json.loads(row[0])
    fields = ("Title", "Year", "Genre", "Director", "Actors", "Plot", "Awards", "imdbRating", "imdbVotes", "Language")
    return {key: payload[key][:1200] for key in fields if payload.get(key) not in (None, "", "N/A")}


def evidence(db, movie_id):
    """Supplementary annotation facts for movies without a native TMDB snapshot."""
    facts = {}
    qid = db.execute("SELECT external_id FROM identities WHERE provider='wikidata' AND movie_id=?",
                     (movie_id,)).fetchone()
    if qid:
        facts["wikidata"] = {"qid": qid[0], "original_language": "Telugu (P364)"}
    page = article(db, movie_id)
    if page:
        facts["wikipedia"] = {"article": page["title"], "intro": page["intro"][:1200], "plot": page["plot"][:1200],
                              "cast": page["cast"][:8],
                              "pageviews_last_60_days": page.get("pageviews_last_60_days")}
    omdb = omdb_facts(db, movie_id)
    if omdb:
        facts["omdb"] = omdb
    return facts


def parse_extract(text):
    sections, name = {"intro": []}, "intro"
    for line in text.splitlines():
        heading = re.fullmatch(r"\s*(=+)\s*(.*?)\s*\1\s*", line)
        if heading:
            name = heading.group(2).casefold() if len(heading.group(1)) == 2 else name
            sections.setdefault(name, [])
            continue
        if line.strip():
            sections.setdefault(name, []).append(line.strip())
    plot_key = next((key for key in sections if key in ("plot", "synopsis", "story", "plot summary", "premise")), None)
    cast_key = next((key for key in sections if key.startswith("cast")), None)
    cast = []
    for line in sections.get(cast_key, []) if cast_key else []:
        name = re.split(r"\s+as\s+|(?<=[a-z.])as(?=[A-Z])|\s+[-–—:]\s+|\s*\(", line, maxsplit=1)[0].strip(" ,;*")
        if 2 < len(name) <= 40 and not re.search(r"\d{3}|[.!?]$", name) and name not in cast:
            cast.append(name)
    return {"intro": " ".join(sections["intro"]), "plot": " ".join(sections.get(plot_key, [])),
            "cast": cast}


SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[\"'A-Z])")


def sentences(text):
    parts, current = [], ""
    for piece in SENTENCE.split(re.sub(r"\s+", " ", text or "").strip()):
        current = f"{current} {piece}".strip()
        # Initials ("N. T. Rama Rao") and common abbreviations do not end a sentence.
        if re.search(r"(?:^|[\s.(\"'])(?:[A-Z]|Dr|Mr|Mrs|Ms|St|Jr|Sr|vs|Sri|Smt)\.$", current):
            continue
        parts.append(current)
        current = ""
    return parts + ([current] if current else [])


def snippet(text, limit=SUMMARY_CHARS):
    text = re.sub(r"\s*\((?:transl\.|lit\.|pronounced|also known as)[^)]*\)", "", text or "")
    out = ""
    for sentence in sentences(text):
        if out and len(out) + 1 + len(sentence) > limit:
            break
        out = f"{out} {sentence}".strip()
        if len(out) >= limit * 0.6:
            break
    if len(out) > limit:
        out = out[:limit].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return out


def run(db, tmdb_client=None, max_age_days=7, expand_catalog=True, log=sys.stderr):
    wikidata = catalog.Client(db, "wikidata", None, max_calls=10, delay=1)
    wikipedia = catalog.Client(db, "wikipedia", None, max_calls=20000, delay=0.2)
    items, response_id = discover(db, wikidata, max_age_days)
    linked, unlinked, queue = link_items(db, items, response_id)
    added, more = expand(db, unlinked, response_id, tmdb_client) if expand_catalog else ([], [])
    review(db, queue + more)
    articles = linked_articles(db, items)
    print(f"Wikidata: {len(items)} items, {linked} newly linked, {len(added)} added, "
          f"{len(queue) + len(more)} for review, {len(articles)} articles.", file=log)
    hydrate_articles(db, wikipedia, articles, log)
    hydrate_pageviews(db, wikipedia)
    return {"items": len(items), "linked": linked, "added": len(added), "review": len(queue) + len(more),
            "articles": len(articles), "wikipedia_calls": wikipedia.calls, "wikidata_calls": wikidata.calls}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=catalog.DEFAULT_DB)
    parser.add_argument("--tmdb-budget", type=int, default=1000)
    args = parser.parse_args()
    from .maintenance import run_lock
    import os
    with run_lock(args.db.parent / "maintenance.lock"):
        db = catalog.connect(args.db)
        catalog.load_env()
        key = os.environ.get("TMDB_API_KEY") or os.environ.get("TMDB_READ_TOKEN")
        tmdb = catalog.Client(db, "tmdb", key, max_calls=args.tmdb_budget) if key else None
        print(catalog.dump(run(db, tmdb)))


if __name__ == "__main__":
    main()
