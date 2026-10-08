"""Publish approved movie prompts without exposing private cache/source payloads."""

import argparse
import json
from pathlib import Path

from . import catalog
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
        snapshot = db.execute(
            "SELECT r.body FROM matches m JOIN responses r ON r.id=m.response_id "
            "WHERE m.movie_id=? AND m.provider='tmdb' AND m.status='hydrated' "
            "ORDER BY r.id DESC LIMIT 1", (row["id"],)).fetchone()
        payload = json.loads(snapshot[0]) if snapshot else {}
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
        })
    return records


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
