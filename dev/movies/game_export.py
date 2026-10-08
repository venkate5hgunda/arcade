"""Publish approved movie prompts without exposing private cache/source payloads."""

import argparse
import json
import re
from pathlib import Path

from . import catalog, wikidata
from .partitions import write_partitions

PUBLIC = catalog.ROOT / "data/movies"


def approved_movies(db):
    records = []
    for row in db.execute(
            "SELECT m.*,a.annotation_json FROM movies m JOIN annotations a ON a.movie_id=m.id "
            "WHERE a.id=(SELECT max(b.id) FROM annotations b WHERE b.movie_id=m.id AND b.rubric=?) "
            "ORDER BY m.year,m.title,m.id", (catalog.RUBRIC,)):
        annotation = json.loads(row["annotation_json"])
        if annotation["status"] not in ("editorial", "llm_reviewed") or annotation["difficulty"] is None:
            continue
        automation = annotation.get("automation")
        if automation and automation["review_decision"] != "approve":
            continue
        payload = tmdb_payload(db, row["id"])
        if payload.get("adult") or (row["year"] and row["year"] > catalog.dt.date.today().year):
            continue
        if payload.get("release_date", "") > str(catalog.dt.date.today()):
            continue
        records.append({
            "id": row["id"], "title": annotation["prompt_title"], "year": row["year"],
            "difficulty": annotation["difficulty"], "approval": annotation["status"],
            "confidence": annotation["confidence"], "rubric": annotation["rubric"],
            "reason": annotation["reason"], "components": annotation["components"],
            "genres": [genre["name"] for genre in payload.get("genres", [])],
            **presentation(db, row["id"], payload),
        })
    return borrow_from_twins(db, records)


def tmdb_payload(db, movie_id):
    snapshot = db.execute(
        "SELECT r.body FROM matches m JOIN responses r ON r.id=m.response_id "
        "WHERE m.movie_id=? AND m.provider='tmdb' AND m.status='hydrated' "
        "ORDER BY r.id DESC LIMIT 1", (movie_id,)).fetchone()
    return json.loads(snapshot[0]) if snapshot else {}


def borrow_from_twins(db, records):
    """Unreconciled duplicates (e.g. a CSV row and its TMDB record) share one prompt in game, so they share
    cast/summary too: a missing field comes from another record with the same normalized title and year."""
    twins, loose = {}, {}
    for movie in db.execute("SELECT id,title,year FROM movies WHERE year IS NOT NULL ORDER BY id NOT LIKE 'tmdb:%',id"):
        twins.setdefault((catalog.title_key(movie["title"]), movie["year"]), []).append(movie["id"])
        loose.setdefault((wikidata.loose_key(movie["title"]), movie["year"]), []).append(movie["id"])
    titles = dict(db.execute("SELECT id,title FROM movies"))
    for record in records:
        if "cast" in record and "summary" in record:
            continue
        title = titles[record["id"]]
        exact = twins.get((catalog.title_key(title), record["year"]), [])
        # Transliteration variants of the same year ("Nartanasala"/"Narthanasala") are a fallback only.
        spelled = [twin for twin in loose.get((wikidata.loose_key(title), record["year"]), []) if twin not in exact]
        for twin in exact + spelled:
            if twin == record["id"]:
                continue
            extra = presentation(db, twin, tmdb_payload(db, twin))
            credits = record.setdefault("credits", {})
            for field in ("cast", "summary"):
                if field not in record and field in extra:
                    record[field], credits[field] = extra[field], extra["credits"][field]
                    if credits[field] == "wikipedia":
                        credits["wikipedia"] = extra["credits"]["wikipedia"]
            if "cast" in record and "summary" in record:
                break
        if not record.get("credits"):
            record.pop("credits", None)
    return records


def split_names(value):
    return [name.strip() for name in re.split(r"[,;/]", value or "") if name.strip()]


def presentation(db, movie_id, payload):
    """Top-billed cast and a short summary, from the most authoritative available source."""
    omdb = wikidata.omdb_facts(db, movie_id)
    page = wikidata.article(db, movie_id) or {}
    source_cast = [split_names(json.loads(row[0]).get("Cast")) for row in db.execute(
        "SELECT raw_json FROM source_rows WHERE movie_id=? ORDER BY source_sha,row_number", (movie_id,))]
    billed = sorted(payload.get("credits", {}).get("cast", []), key=lambda person: person.get("order", 999))
    casts = [("tmdb", [person["name"] for person in billed if person.get("name")]),
             ("omdb", split_names(omdb.get("Actors"))), ("wikipedia", page.get("cast", [])),
             ("source", next((names for names in source_cast if names), []))]
    summaries = [("tmdb", payload.get("overview")), ("omdb", omdb.get("Plot")),
                 ("wikipedia", page.get("plot")), ("wikipedia", page.get("intro"))]
    record, credits = {}, {}
    cast_source, cast = next(((source, names) for source, names in casts if names), (None, []))
    if cast:
        record["cast"], credits["cast"] = cast[:3], cast_source
    summary_source, text = next(((source, text) for source, text in summaries if (text or "").strip()), (None, ""))
    if text:
        record["summary"], credits["summary"] = wikidata.snippet(text), summary_source
        if summary_source == "wikipedia":
            credits["wikipedia"] = page["title"]
    if credits:
        record["credits"] = credits
    return record


def publish(db, directory=PUBLIC):
    return write_partitions(approved_movies(db), directory, max_bytes=1024 * 1024)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=catalog.DEFAULT_DB)
    parser.add_argument("--output", type=Path, default=PUBLIC)
    args = parser.parse_args()
    from .maintenance import run_lock
    with run_lock(args.db.parent / "maintenance.lock"):
        db = catalog.connect(args.db)
        try:
            catalog.annotate(db, json.loads(catalog.ANNOTATIONS.read_text()))
            index = publish(db, args.output)
            print(catalog.dump({"approved_movies": index["records"], "files": len(index["files"]),
                                "output": str(args.output)}))
        finally:
            db.close()


if __name__ == "__main__":
    main()
