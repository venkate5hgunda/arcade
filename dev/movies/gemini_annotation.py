"""Auditable, token-sized Gemini movie batches with two concurrent API requests."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request

from . import catalog
from . import llm_annotation as llm

ANNOTATOR = "gemini-3.8-flash"
REVIEWER = "gemini-3.1-pro-preview"
BASE = "https://generativelanguage.googleapis.com/v1beta/models/"
VERSION = "gemini-movie-batches-v1"


class BudgetReached(RuntimeError):
    pass


class ProviderFailure(RuntimeError):
    pass


class SchemaFailure(ValueError):
    pass


def initialize(db):
    llm.initialize(db)
    db.executescript("""
        CREATE TABLE IF NOT EXISTS llm_batches(
            id INTEGER PRIMARY KEY,stage TEXT NOT NULL,model TEXT NOT NULL,
            created_at TEXT NOT NULL,completed_at TEXT,request_json TEXT NOT NULL,
            response_text TEXT,status INTEGER,usage_json TEXT,error TEXT,
            parent_batch_id INTEGER REFERENCES llm_batches(id));
        CREATE TABLE IF NOT EXISTS llm_batch_items(
            batch_id INTEGER NOT NULL REFERENCES llm_batches(id),
            job_key TEXT NOT NULL REFERENCES llm_jobs(job_key),
            call_id INTEGER NOT NULL REFERENCES llm_calls(id),
            PRIMARY KEY(batch_id,job_key));
        CREATE TABLE IF NOT EXISTS llm_daily_budget(
            day TEXT PRIMARY KEY,reserved_calls INTEGER NOT NULL);
    """)


def http_json(model, key, body=None, timeout=600):
    suffix = ":generateContent" if body is not None else ""
    request = urllib.request.Request(
        BASE + model + suffix,
        data=catalog.dump(body).encode() if body is not None else None,
        headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8")
    except (urllib.error.URLError, TimeoutError):
        raise ProviderFailure("Gemini network failure; call outcome/billing is unknown, receipt retained.") from None


def model_limits(model, key):
    status, text = http_json(model, key)
    if status != 200:
        raise ProviderFailure(f"Gemini model metadata HTTP {status}; no silent model fallback.")
    data = json.loads(text)
    if "generateContent" not in data.get("supportedGenerationMethods", []):
        raise ProviderFailure(f"{model} does not support generateContent.")
    return {"input": data["inputTokenLimit"], "output": data["outputTokenLimit"]}


def request_items(db, jobs, stage):
    items = []
    for job in jobs:
        if stage == "annotate":
            request = llm.request_for(job, stage)
            previous = llm.latest_call(db, job["job_key"], "annotate")
            review = llm.latest_call(db, job["job_key"], "review")
            if previous and review and previous["output_json"] and review["output_json"]:
                request.update(previous_proposal=json.loads(previous["output_json"]),
                               review_feedback=json.loads(review["output_json"]))
        else:
            proposal = llm.latest_call(db, job["job_key"], "annotate")
            if not proposal or not proposal["output_json"]:
                raise ValueError("Cannot review a movie without a validated proposal.")
            request = llm.request_for(job, stage, json.loads(proposal["output_json"]))
        items.append(request)
    return items


def sized_groups(items, limits, fraction, tokens_per_item):
    input_cap = int(limits["input"] * fraction)
    output_cap = int(limits["output"] * fraction)
    max_items = max(1, output_cap // tokens_per_item)
    group, size = [], len(llm.INSTRUCTIONS.encode()) + 8192
    for item in items:
        # UTF-8 bytes are a conservative token upper bound, not a word-count proxy.
        item_size = len(catalog.dump(item).encode()) + 128
        if item_size + 8192 > input_cap:
            raise ValueError("One movie exceeds the selected context capacity; no evidence silently truncated.")
        if group and (len(group) >= max_items or size + item_size > input_cap):
            yield group
            group, size = [], len(llm.INSTRUCTIONS.encode()) + 8192
        group.append(item)
        size += item_size
    if group:
        yield group


def google_schema(schema):
    """Translate our strict validator schema to generateContent's supported subset."""
    translated = {}
    kind = schema.get("type", "string" if "enum" in schema else None)
    if isinstance(kind, list):
        translated["nullable"] = "null" in kind
        kind = next(value for value in kind if value != "null")
    if kind:
        translated["type"] = kind.upper()
    for key in ("enum", "required", "minimum", "maximum", "minItems", "maxItems"):
        if key in schema:
            translated[key] = schema[key]
    if "properties" in schema:
        translated["properties"] = {key: google_schema(value) for key, value in schema["properties"].items()}
    if "items" in schema:
        translated["items"] = google_schema(schema["items"])
    return translated


def provider_request(items, output_cap):
    schema = llm.object_schema({"items": {
        "type": "array", "items": items[0]["output_schema"]}})
    instructions = items[0]["instructions"] + """
Process EVERY movie independently. Never mix evidence or identities between movies.
Return one output object for each supplied job_key, in the supplied order, inside
the top-level items array. Native IDs may be null for source-only records.
For recognition_must_be_unknown=true, recognition must be null with an explicit
uncertainty. Source-only facts are not independently verified provider identities.
No tools, web browsing, or speculative additional facts. Preserve all job keys.
Evidence citations must be chosen EXACTLY from that movie's allowed_evidence list."""
    evidence = [{key: value for key, value in item.items()
                 if key not in ("instructions", "output_schema")} for item in items]
    return {
        "systemInstruction": {"parts": [{"text": instructions}]},
        "contents": [{"role": "user", "parts": [{"text": catalog.dump({"items": evidence})}]}],
        "generationConfig": {"responseMimeType": "application/json",
                             "responseSchema": google_schema(schema), "maxOutputTokens": output_cap},
    }


def start_batch(db, items, stage, model, body, daily_calls, parent=None):
    day = catalog.now()[:10]
    used = db.execute("SELECT reserved_calls FROM llm_daily_budget WHERE day=?", (day,)).fetchone()
    if used and used[0] >= daily_calls:
        raise BudgetReached(f"Gemini UTC-day cap of {daily_calls} generateContent calls reached.")
    batch = db.execute(
        "INSERT INTO llm_batches(stage,model,created_at,request_json,error,parent_batch_id)"
        " VALUES (?,?,?,?,?,?)",
        (stage, model, catalog.now(), catalog.dump(body), "in_flight", parent)).lastrowid
    for item in items:
        job = db.execute("SELECT * FROM llm_jobs WHERE job_key=?", (item["job_key"],)).fetchone()
        if job["status"] == "in_flight":
            raise RuntimeError("An interrupted/active movie call requires explicit recovery before retry.")
        call = db.execute(
            "INSERT INTO llm_calls(job_key,stage,created_at,request_json,response_text,error)"
            " VALUES (?,?,?,?,?,?)",
            (item["job_key"], stage, catalog.now(), catalog.dump(item), "", "in_flight")).lastrowid
        db.execute("INSERT INTO llm_batch_items VALUES (?,?,?)", (batch, item["job_key"], call))
        db.execute("UPDATE llm_jobs SET status='in_flight',updated_at=? WHERE job_key=?",
                   (catalog.now(), item["job_key"]))
    db.execute("INSERT INTO llm_daily_budget VALUES (?,1) ON CONFLICT(day) "
               "DO UPDATE SET reserved_calls=reserved_calls+1", (day,))
    db.commit()
    return batch


def finish_batch(db, batch, items, stage, model, result):
    status, text = result
    error, outputs, native = None, None, {}
    try:
        if status != 200:
            raise ProviderFailure(f"Gemini HTTP {status}; raw provider error retained, no model fallback.")
        native = json.loads(text)
        if not isinstance(native, dict):
            native = {}
            raise SchemaFailure("Gemini response envelope is not an object.")
        candidates = native.get("candidates", [])
        if len(candidates) != 1 or candidates[0].get("finishReason") != "STOP":
            raise SchemaFailure("Incomplete/blocked model result; batch requires size reduction.")
        generated = "".join(part.get("text", "") for part in candidates[0]["content"]["parts"]
                            if not part.get("thought"))
        output = json.loads(generated)
        llm.validate_schema(output, llm.object_schema({"items": {
            "type": "array", "items": items[0]["output_schema"], "minItems": len(items)}}))
        outputs = output["items"]
        if len(outputs) != len(items):
            raise SchemaFailure("Batch omitted or added movies.")
        for request, proposal in zip(items, outputs):
            llm.validate_output(request, proposal)
    except ProviderFailure as failure:
        error = failure
    except (ValueError, KeyError, TypeError) as failure:
        error = SchemaFailure(str(failure))
        outputs = None
    db.execute(
        "UPDATE llm_batches SET completed_at=?,response_text=?,status=?,usage_json=?,error=? WHERE id=?",
        (catalog.now(), text, status, catalog.dump(native.get("usageMetadata")),
         str(error) if error else None, batch))
    for index, item in enumerate(items):
        output = outputs[index] if outputs is not None else None
        envelope = {"provider": "google-gemini", "model": native.get("modelVersion", model),
                    "batch_receipt_id": batch, "output": output}
        row = db.execute("SELECT call_id FROM llm_batch_items WHERE batch_id=? AND job_key=?",
                         (batch, item["job_key"])).fetchone()
        db.execute(
            "UPDATE llm_calls SET completed_at=?,response_text=?,provider=?,model=?,output_json=?,error=? WHERE id=?",
            (catalog.now(), catalog.dump(envelope), "google-gemini", native.get("modelVersion", model),
             catalog.dump(output) if output is not None else None,
             str(error) if error else None, row["call_id"]))
        state = ("in_flight" if status == 0 else "failed" if error else "annotated" if stage == "annotate"
                 else "reviewed" if output["decision"] == "approve" else "rejected")
        db.execute("UPDATE llm_jobs SET status=?,updated_at=? WHERE job_key=?",
                   (state, catalog.now(), item["job_key"]))
    db.commit()
    return error


def execute_stage(db, groups, stage, model, limits, key, daily_calls, fraction):
    pending = [(group, None, 0) for group in groups]
    active = {}
    terminal = []
    provider_error = None
    output_cap = int(limits["output"] * fraction)
    with ThreadPoolExecutor(max_workers=2) as pool:
        while pending or active:
            while pending and len(active) < 2 and provider_error is None:
                items, parent, singleton_attempt = pending.pop(0)
                body = provider_request(items, output_cap)
                try:
                    batch = start_batch(db, items, stage, model, body, daily_calls, parent)
                except BudgetReached as failure:
                    provider_error = str(failure)
                    break
                active[pool.submit(http_json, model, key, body)] = (batch, items, singleton_attempt)
            if not active:
                break
            completed = next(as_completed(active))
            batch, items, singleton_attempt = active.pop(completed)
            try:
                result = completed.result()
            except ProviderFailure as failure:
                result = (0, catalog.dump({"error": str(failure)}))
            failure = finish_batch(db, batch, items, stage, model, result)
            if isinstance(failure, SchemaFailure):
                if len(items) > 1:
                    half = math.ceil(len(items) / 2)
                    pending[0:0] = [(items[:half], batch, 0), (items[half:], batch, 0)]
                elif singleton_attempt < 2:
                    pending.insert(0, (items, batch, singleton_attempt + 1))
                else:
                    terminal.append({"job_key": items[0]["job_key"], "error": str(failure)})
            elif isinstance(failure, ProviderFailure):
                provider_error = str(failure)
    return {"provider_error": provider_error, "singleton_failures": terminal}


def completed_output_estimate(db, stage, model, fallback):
    row = db.execute(
        "SELECT b.usage_json,count(i.job_key) AS items FROM llm_batches b "
        "JOIN llm_batch_items i ON i.batch_id=b.id WHERE b.stage=? AND b.model=? AND b.error IS NULL "
        "GROUP BY b.id ORDER BY b.id DESC LIMIT 1", (stage, model)).fetchone()
    if row:
        usage = json.loads(row["usage_json"]) or {}
        tokens = usage.get("candidatesTokenCount", 0) + usage.get("thoughtsTokenCount", 0)
        if tokens:
            return max(100, math.ceil(tokens / row["items"] * 1.2))
    return fallback


def annotate_existing(db, daily_calls=1000, fraction=0.35, limit=10000, promote=True):
    initialize(db)
    catalog.load_env()
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise ProviderFailure("Missing GEMINI_API_KEY; no annotation calls made.")
    limits = {model: model_limits(model, key) for model in (ANNOTATOR, REVIEWER)}
    fingerprint = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    profile = f"{VERSION}:{ANNOTATOR}:{REVIEWER}:{fraction}"
    jobs = llm.prepare(db, json.loads(catalog.ANNOTATIONS.read_text()), limit, profile, fingerprint, retry=True)
    runnable = []
    for job in jobs:
        if job["status"] == "in_flight":
            continue
        if job["status"] == "rejected":
            review = llm.latest_call(db, job["job_key"], "review")
            count = db.execute("SELECT count(*) FROM llm_calls WHERE job_key=? AND stage='annotate' AND error IS NULL",
                               (job["job_key"],)).fetchone()[0]
            if json.loads(review["output_json"])["decision"] == "needs_human_review" or count >= 3:
                continue
        runnable.append(job)
    needs_annotation = [job for job in runnable
                        if job["status"] != "annotated" and
                        not (job["status"] == "failed" and llm.latest_call(db, job["job_key"], "annotate")
                             and llm.latest_call(db, job["job_key"], "annotate")["output_json"])]
    annotation_items = request_items(db, needs_annotation, "annotate")
    result = {"provider_error": None, "singleton_failures": []}

    def review_pending():
        review_jobs = [db.execute("SELECT * FROM llm_jobs WHERE job_key=?", (job["job_key"],)).fetchone()
                       for job in runnable]
        review_jobs = [job for job in review_jobs if job["status"] == "annotated" or
                       (job["status"] == "failed" and llm.latest_call(db, job["job_key"], "annotate")
                        and llm.latest_call(db, job["job_key"], "annotate")["output_json"])]
        review_items = request_items(db, review_jobs, "review")
        review_groups = sized_groups(review_items, limits[REVIEWER], fraction,
                                    completed_output_estimate(db, "review", REVIEWER, 450))
        reviewed = execute_stage(db, list(review_groups), "review", REVIEWER, limits[REVIEWER],
                                 key, daily_calls, fraction)
        result["singleton_failures"].extend(reviewed["singleton_failures"])
        result["provider_error"] = reviewed["provider_error"]

    # Review existing proposals first; test reviewer availability before spending
    # the entire annotator budget. Subsequent waves keep both models progressing.
    review_pending()
    while annotation_items:
        if result["provider_error"]:
            break
        planned = sized_groups(annotation_items, limits[ANNOTATOR], fraction,
                               completed_output_estimate(db, "annotate", ANNOTATOR, 1100))
        wave = []
        for group in planned:
            wave.append(group)
            if len(wave) == 2:
                break
        annotation_items = annotation_items[sum(len(group) for group in wave):]
        annotated = execute_stage(db, wave, "annotate", ANNOTATOR,
                                  limits[ANNOTATOR], key, daily_calls, fraction)
        result["singleton_failures"].extend(annotated["singleton_failures"])
        result["provider_error"] = annotated["provider_error"]
        if not result["provider_error"]:
            review_pending()
    promoted = []
    if promote:
        for job in db.execute("SELECT * FROM llm_jobs WHERE profile=? AND status='reviewed'", (profile,)).fetchall():
            try:
                llm.promote(db, [job["job_key"]])
                promoted.append(job["job_key"])
            except ValueError as failure:
                result["singleton_failures"].append({"job_key": job["job_key"], "error": str(failure)})
                if "stale" in str(failure):
                    db.execute("UPDATE llm_jobs SET status='stale',updated_at=? WHERE job_key=?",
                               (catalog.now(), job["job_key"]))
                    db.commit()
    result.update(promoted=len(promoted), profile=profile, model_limits=limits,
                  concurrency=2, target_fraction=fraction,
                  daily_reserved_calls=db.execute("SELECT reserved_calls FROM llm_daily_budget WHERE day=?",
                                                 (catalog.now()[:10],)).fetchone())
    result["daily_reserved_calls"] = result["daily_reserved_calls"][0] if result["daily_reserved_calls"] else 0
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=catalog.DEFAULT_DB)
    parser.add_argument("--export", type=Path, default=catalog.DEFAULT_EXPORT)
    parser.add_argument("--daily-calls", type=int, default=1000)
    parser.add_argument("--limit", type=int, default=10000)
    parser.add_argument("--target-fraction", type=float, default=0.35)
    parser.add_argument("--no-promote", action="store_true")
    parser.add_argument("--recover-interrupted", action="store_true",
                        help="Explicitly retry unknown-outcome calls; they may already have been billed")
    args = parser.parse_args()
    if min(args.daily_calls, args.limit) < 1 or not 0.2 <= args.target_fraction <= 0.5:
        parser.error("Positive budgets/limits and a target fraction between 0.2 and 0.5 are required.")
    from .maintenance import run_lock
    with run_lock(args.db.parent / "maintenance.lock"):
        db = catalog.connect(args.db)
        try:
            initialize(db)
            if args.recover_interrupted:
                db.execute("UPDATE llm_jobs SET status='failed' WHERE status='in_flight'")
                db.commit()
            result = annotate_existing(db, args.daily_calls, args.target_fraction, args.limit, not args.no_promote)
            catalog.annotate(db, json.loads(catalog.ANNOTATIONS.read_text()))
            catalog.export(db, args.export, [result["provider_error"]] if result["provider_error"] else [])
            print(catalog.dump(result))
            return 2 if result["provider_error"] or result["singleton_failures"] else 0
        except (ProviderFailure, ValueError, RuntimeError) as error:
            db.rollback()
            print(f"Gemini annotation: {error}", file=sys.stderr)
            return 2
        finally:
            db.close()


if __name__ == "__main__":
    sys.exit(main())
