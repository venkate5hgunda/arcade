import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from functools import partial
from http.server import ThreadingHTTPServer
import urllib.request
import urllib.error

from dev.movies import catalog

ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


server = load("serve", "dev/serve.py")


class Response:
    status = 200

    def __init__(self, payload):
        self.body = json.dumps(payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def read(self):
        return self.body


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)
        self.db = catalog.connect(self.path / "movies.sqlite")
        self.csv = self.path / "movies.csv"
        self.csv.write_text('Title,Year,Cast,Release Date,Extra\n'
                            '"Eega",2012,"Nani, Samantha",2012,"  original\nvalue  "\n')
        catalog.import_csv(self.db, self.csv)
        self.movie = self.db.execute("SELECT * FROM movies").fetchone()

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def client(self, provider="omdb", **kwargs):
        return catalog.Client(self.db, provider, "test-credential", delay=0, **kwargs)

    def test_lossless_idempotent_csv_and_export(self):
        catalog.import_csv(self.db, self.csv)
        self.assertEqual(self.db.execute("SELECT count(*) FROM movies").fetchone()[0], 1)
        self.assertEqual(bytes(self.db.execute("SELECT content FROM source_files").fetchone()[0]),
                         self.csv.read_bytes())
        raw = json.loads(self.db.execute("SELECT raw_json FROM source_rows").fetchone()[0])
        self.assertEqual(raw["Extra"], "  original\nvalue  ")
        self.assertEqual(raw["Release Date"], "2012")
        catalog.annotate(self.db, [])
        manifest = catalog.export(self.db, self.path / "export")
        self.assertEqual(manifest["source_records"], 1)
        exported = json.loads((self.path / "export/movies.jsonl").read_text())
        self.assertEqual(exported["source_rows"][0]["raw"], raw)
        rating = exported["annotations"][-1]
        self.assertIsNone(rating["difficulty"])
        self.assertEqual(rating["difficulty_range"], [1.0, 4.2])
        self.assertIsNone(rating["components"]["recognition"]["value"])

    def test_malformed_csv_fails_before_any_record_is_written(self):
        self.csv.write_text("Title,Year\nValid,2012\nInvalid,2013,extra\n")
        with self.assertRaises(ValueError):
            catalog.import_csv(self.db, self.csv)
        self.assertEqual(self.db.execute("SELECT count(*) FROM source_files").fetchone()[0], 1)
        self.assertEqual(self.db.execute("SELECT count(*) FROM movies").fetchone()[0], 1)

    def test_cache_refresh_history_and_future_fields(self):
        payload = {"Response": "True", "future_field": {"nested": [1, 2, 3]}}
        client = self.client()
        with patch.object(catalog.urllib.request, "urlopen", return_value=Response(payload)) as request:
            first = client.get("/", {"i": "tt123"})
            self.assertEqual(first, client.get("/", {"i": "tt123"}))
            self.assertEqual(request.call_count, 1)
            second = self.client(refresh=True).get("/", {"i": "tt123"})
            self.assertNotEqual(first[1], second[1])
        self.assertEqual(self.db.execute("SELECT count(*) FROM responses").fetchone()[0], 2)
        row = self.db.execute("SELECT * FROM responses LIMIT 1").fetchone()
        self.assertNotIn("test-credential", json.dumps(dict(row)))
        self.assertEqual(json.loads(row["body"]), payload)

    def test_explicit_refresh_fetches_each_request_only_once_per_run(self):
        with patch.object(catalog.urllib.request, "urlopen", return_value=Response({"id": 123})) as request:
            client = self.client(provider="tmdb", refresh=True)
            client.get("/movie/123", {})
            client.get("/movie/123", {})
            self.assertEqual(request.call_count, 1)
            self.client(provider="tmdb", refresh=True).get("/movie/123", {})
            self.assertEqual(request.call_count, 2)

    def test_omdb_exact_match_and_no_repeated_hydration(self):
        payload = {"Response": "True", "Title": "Eega", "Year": "2012",
                   "Language": "Telugu, Tamil", "Type": "movie", "imdbID": "tt2258337"}
        client = self.client()
        with patch.object(catalog.urllib.request, "urlopen", return_value=Response(payload)) as request:
            catalog.hydrate_omdb(self.db, client, [self.movie])
            catalog.hydrate_omdb(self.db, client, [self.movie])
            self.assertEqual(request.call_count, 1)
        self.assertEqual(self.db.execute("SELECT status FROM matches").fetchone()[0], "linked")

    def test_ambiguous_matches_never_linked(self):
        for changes in ({"Year": "2013"}, {"Language": "Hindi"}, {"Title": "Eega 2"},
                        {"Type": "series"}):
            payload = {"Response": "True", "Title": "Eega", "Year": "2012",
                       "Language": "Telugu", "Type": "movie", "imdbID": "tt2258337", **changes}
            with patch.object(catalog.urllib.request, "urlopen", return_value=Response(payload)):
                catalog.hydrate_omdb(self.db, self.client(refresh=True), [self.movie])
        self.assertEqual(self.db.execute("SELECT count(*) FROM identities").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT count(*) FROM matches WHERE status='needs_review'").fetchone()[0], 4)

    def test_not_found_cached_but_quota_error_is_not(self):
        client = self.client()
        with patch.object(catalog.urllib.request, "urlopen",
                          return_value=Response({"Response": "False", "Error": "Movie not found!"})) as request:
            client.get("/", {"t": "Unknown"})
            client.get("/", {"t": "Unknown"})
            self.assertEqual(request.call_count, 1)
        with patch.object(catalog.urllib.request, "urlopen",
                          return_value=Response({"Response": "False", "Error": "Request limit reached!"})) as request:
            for _ in range(2):
                with self.assertRaises(catalog.APIError):
                    client.get("/", {"t": "Other"})
            self.assertEqual(request.call_count, 2)

    def test_omdb_record_error_is_auditable_without_stopping_other_movies(self):
        self.db.execute("INSERT INTO movies VALUES (?,?,?,?,?)",
                        ("test:next", "Next Movie", 2013, "te", catalog.now()))
        self.db.commit()
        movies = [self.movie, self.db.execute("SELECT * FROM movies WHERE id='test:next'").fetchone()]
        payloads = [Response({"Response": "False", "Error": "Error getting data."}),
                    Response({"Response": "True", "Title": "Next Movie", "Year": "2013",
                              "Language": "Telugu", "Type": "movie", "imdbID": "tt123"})]
        with patch.object(catalog.urllib.request, "urlopen", side_effect=payloads) as request:
            catalog.hydrate_omdb(self.db, self.client(), movies)
            catalog.hydrate_omdb(self.db, self.client(), movies)
            self.assertEqual(request.call_count, 2)
        self.assertEqual(self.db.execute("SELECT count(*) FROM matches WHERE status='provider_error'").fetchone()[0], 1)
        self.assertEqual(self.db.execute("SELECT count(*) FROM matches WHERE status='linked'").fetchone()[0], 1)

    def test_request_budget_and_missing_key(self):
        with self.assertRaises(catalog.APIError):
            catalog.Client(self.db, "tmdb", "", delay=0).get("/discover/movie")
        client = self.client(max_calls=1)
        with patch.object(catalog.urllib.request, "urlopen", return_value=Response({"Response": "True"})):
            client.get("/", {"t": "One"})
            with self.assertRaises(catalog.APIError):
                client.get("/", {"t": "Two"})

    def test_parallel_fetch_preserves_receipts_and_resumes_after_budget(self):
        jobs = [("/movie/" + str(index), {}) for index in range(3)]
        client = self.client(provider="tmdb", max_calls=2)
        with patch.object(catalog.urllib.request, "urlopen", return_value=Response({"future_field": 42})):
            with self.assertRaises(catalog.APIError):
                client.get_many(jobs)
            self.assertEqual(self.db.execute("SELECT count(*) FROM responses").fetchone()[0], 2)
            resumed = self.client(provider="tmdb", max_calls=1)
            self.assertEqual(len(resumed.get_many(jobs)), 3)
            self.assertEqual(resumed.calls, 1)

    def test_duplicate_requests_share_one_live_receipt_within_batch(self):
        client = self.client(provider="tmdb", max_calls=1)
        with patch.object(catalog.urllib.request, "urlopen", return_value=Response({"results": []})) as request:
            results = client.get_many([("/search/movie", {"query": "Same"}),
                                       ("/search/movie", {"query": "Same"})])
            self.assertEqual(request.call_count, 1)
            self.assertEqual(results[0], results[1])
            self.assertEqual(client.calls, 1)

    def test_imdb_crosswalk_requires_matching_year_and_language(self):
        catalog.link(self.db, self.movie["id"], "omdb", "tt2258337", {"test": True})
        self.db.commit()
        payload = {"movie_results": [{"id": 13475, "original_language": "te", "release_date": "2012-07-05"}]}
        with patch.object(catalog.urllib.request, "urlopen", return_value=Response(payload)):
            catalog.reconcile_tmdb(self.db, self.client(provider="tmdb"))
        self.assertEqual(self.db.execute("SELECT external_id FROM identities WHERE provider='tmdb'").fetchone()[0],
                         "13475")

    def test_discovery_pagination_and_coverage(self):
        class Fake:
            refresh = False

            def get(inner, path, params):
                if path.startswith("/movie/"):
                    return {"id": int(path.split("/")[-1]), "future": "kept",
                            **{name: {} for name in catalog.APPENDS.split(",")}}, 1
                page = params["page"]
                january = params["primary_release_date.gte"].endswith("-01-01")
                return {"total_pages": 2 if january else 0, "total_results": 2 if january else 0,
                        "results": [{"id": page, "title": f"Film {page}", "release_date": "2000-01-01",
                                     "original_language": "te"}] if january else []}, 1

            def get_many(inner, jobs):
                return [inner.get(path, params) for path, params in jobs]

        # Valid response FK receipt for this fake discovery client.
        with patch.object(catalog.urllib.request, "urlopen", return_value=Response({"id": 1})):
            self.client().get("/", {})
        catalog.discover_tmdb(self.db, Fake(), 2000, 2000)
        self.assertEqual(self.db.execute("SELECT count(*) FROM coverage WHERE status='complete'").fetchone()[0], 12)
        self.assertEqual(self.db.execute("SELECT count(*) FROM identities WHERE provider='tmdb'").fetchone()[0], 2)
        self.assertEqual(self.db.execute("SELECT count(*) FROM matches WHERE status='hydrated'").fetchone()[0], 2)

    def test_discovery_cap_does_not_claim_completion(self):
        class Fake:
            def get(inner, *args):
                return {"total_pages": 501, "total_results": 10001}, 1
        with self.assertRaises(catalog.APIError):
            catalog.discover_tmdb(self.db, Fake(), 2000, 2000)
        self.assertEqual(self.db.execute("SELECT status FROM coverage").fetchone()[0], "in_progress")

    def test_duplicate_pagination_cannot_claim_complete_coverage(self):
        class Fake:
            def get(inner, *args):
                return {"total_pages": 2, "total_results": 2,
                        "results": [{"id": 123, "title": "Film", "release_date": "2000-01-01",
                                     "original_language": "te"}]}, 1
        with self.assertRaises(catalog.APIError):
            catalog.discover_tmdb(self.db, Fake(), 2000, 2000)
        self.assertEqual(self.db.execute("SELECT status FROM coverage").fetchone()[0], "in_progress")

    def test_missing_appended_endpoint_is_explicitly_incomplete(self):
        catalog.link(self.db, self.movie["id"], "tmdb", "123", {"test": True})
        self.db.commit()
        with patch.object(catalog.urllib.request, "urlopen", return_value=Response({"id": 123})):
            with self.assertRaises(catalog.APIError):
                catalog.hydrate_tmdb(self.db, self.client(provider="tmdb"))
        self.assertEqual(self.db.execute("SELECT status FROM matches").fetchone()[0], "hydrated_partial")

    def test_reviewed_seed_alias_reconciliation_keeps_original_receipts(self):
        catalog.seed_movies(self.db, [{"title": "Pushpa: The Rise", "year": 2021}])
        seed = self.db.execute("SELECT id FROM movies WHERE id LIKE 'seed:%'").fetchone()[0]
        self.db.execute("INSERT INTO movies VALUES (?,?,?,?,?)",
                        ("tmdb:99", "Pushpa: The Rise - Part 1", 2021, "te", catalog.now()))
        catalog.link(self.db, "tmdb:99", "tmdb", "99", {"verified": True})
        self.db.commit()
        seeds = json.loads(catalog.ANNOTATIONS.read_text())
        catalog.annotate(self.db, seeds)
        catalog.reconcile_seed_aliases(self.db, seeds)
        self.assertIsNone(self.db.execute("SELECT id FROM movies WHERE id=?", (seed,)).fetchone())
        redirect = self.db.execute("SELECT * FROM redirects").fetchone()
        self.assertEqual(redirect["canonical_id"], "tmdb:99")
        self.assertEqual(json.loads(redirect["evidence_json"])["original_movie"]["title"], "Pushpa: The Rise")
        catalog.annotate(self.db, seeds)
        annotation = json.loads(self.db.execute(
            "SELECT annotation_json FROM annotations WHERE movie_id='tmdb:99' ORDER BY id DESC LIMIT 1").fetchone()[0])
        self.assertEqual(annotation["prompt_title"], "Pushpa: The Rise")

    def test_every_editorial_rating_is_bounded_and_has_dimension_reasoning(self):
        seeds = json.loads(catalog.ANNOTATIONS.read_text())
        catalog.seed_movies(self.db, seeds)
        for seed in seeds:
            if seed.get("tmdb_id"):
                movie = self.db.execute("SELECT id FROM movies WHERE title=? AND year=?",
                                        (seed["title"], seed["year"])).fetchone()
                catalog.link(self.db, movie["id"], "tmdb", seed["tmdb_id"], {"test": True})
        self.db.commit()
        catalog.annotate(self.db, seeds)
        rows = self.db.execute("SELECT annotation_json FROM annotations").fetchall()
        self.assertEqual(len(rows), len(seeds))
        for row in rows:
            annotation = json.loads(row[0])
            for component in annotation["components"].values():
                self.assertTrue(component["value"] is None or component["value"] in range(1, 6))
                self.assertTrue(component["reason"].strip())
                self.assertTrue(component["method"].strip())
            if all(component["value"] is not None for component in annotation["components"].values()):
                weighted = sum(component["value"] * component["weight"]
                               for component in annotation["components"].values())
                self.assertEqual(annotation["difficulty"], int(weighted + 0.5))
            else:
                self.assertIsNone(annotation["difficulty"])
                self.assertEqual(annotation["confidence"], "low")
            self.assertTrue(annotation["reason"])
            self.assertTrue(annotation["sources"])

    def test_native_id_review_cannot_leak_to_same_title_different_movie(self):
        review = {"title": "Eega", "year": 2012, "tmdb_id": 999, "source": "https://www.themoviedb.org/movie/999",
                  "difficulty": {"actability": {"value": 1, "reason": "Concrete noun.", "method": "editorial"},
                                 "recognition": {"value": 1, "reason": "Hypothesis.", "method": "editorial"},
                                 "reason": "Reviewed native identity only."}}
        catalog.link(self.db, self.movie["id"], "tmdb", 123, {"test": True})
        self.db.commit()
        catalog.annotate(self.db, [review])
        value = json.loads(self.db.execute("SELECT annotation_json FROM annotations").fetchone()[0])
        self.assertIsNone(value["difficulty"])

    def test_partial_editorial_review_keeps_uncertainty_instead_of_final_score(self):
        review = {"title": "Eega", "year": 2012, "source": "https://www.themoviedb.org/movie/123",
                  "difficulty": {"actability": {"value": 1, "reason": "Concrete fly cue.", "method": "editorial"},
                                 "recognition": {"value": None, "reason": "Audience evidence unresolved.", "method": "unresolved"},
                                 "reason": "Meaning known; familiarity needs review."}}
        catalog.annotate(self.db, [review])
        value = json.loads(self.db.execute("SELECT annotation_json FROM annotations").fetchone()[0])
        self.assertIsNone(value["difficulty"])
        self.assertEqual(value["difficulty_range"], [1.0, 2.2])
        self.assertEqual(value["status"], "needs_review")
        self.assertEqual(value["confidence"], "low")

    def test_curatorial_receipt_id_on_another_database_is_not_false_snapshot_proof(self):
        with patch.object(catalog.urllib.request, "urlopen", return_value=Response({"id": 999})):
            _, receipt_id = self.client(provider="tmdb").get("/movie/999", {})
        fetched_at = self.db.execute("SELECT fetched_at FROM responses WHERE id=?", (receipt_id,)).fetchone()[0]
        review = {"title": "Eega", "year": 2012, "tmdb_id": 123, "source": "https://www.themoviedb.org/movie/123",
                  "evidence": {"response_id": receipt_id, "fetched_at": fetched_at},
                  "difficulty": {"actability": {"value": 1, "reason": "Concrete fly cue.", "method": "editorial"},
                                 "recognition": {"value": 1, "reason": "Hypothesis.", "method": "editorial"},
                                 "reason": "Original evidence belongs to the curatorial database."}}
        catalog.link(self.db, self.movie["id"], "tmdb", 123, {"test": True})
        self.db.commit()
        catalog.annotate(self.db, [review])
        evidence = json.loads(self.db.execute("SELECT annotation_json FROM annotations").fetchone()[0])["evidence"]
        self.assertFalse(evidence["snapshot_available_locally"])
        self.assertNotIn("body_sha256", evidence)

    def native_details(self, director="S. S. Rajamouli"):
        return {**{name: {} for name in catalog.APPENDS.split(",")},
                "id": 123, "original_language": "te", "release_date": "2012-07-05",
                "credits": {"crew": [{"name": director, "job": "Director"}],
                            "cast": [{"name": "Nani"}]}}

    def source_search(self, title="Eega"):
        return {"total_pages": 1, "total_results": 1, "results": [
            {"id": 123, "title": title, "original_title": title,
             "original_language": "te", "release_date": "2012-07-05"}]}

    def test_source_hydration_requires_credit_corroboration_and_reuses_cache(self):
        client = self.client(provider="tmdb")
        with patch.object(catalog.urllib.request, "urlopen",
                          side_effect=[Response(self.source_search()), Response(self.native_details())]) as request:
            catalog.hydrate_tmdb_sources(self.db, client)
            catalog.hydrate_tmdb_sources(self.db, client)
            self.assertEqual(request.call_count, 2)
        self.assertEqual(self.db.execute("SELECT count(*) FROM movies").fetchone()[0], 1)
        self.assertEqual(self.db.execute("SELECT count(*) FROM identities").fetchone()[0], 1)
        evidence = json.loads(self.db.execute("SELECT evidence_json FROM identities").fetchone()[0])
        self.assertEqual(evidence["matched_cast"], ["Nani"])
        self.assertEqual(evidence["method"], "exact-cast-name-tokens")
        self.assertEqual(self.db.execute("SELECT count(*) FROM matches WHERE status='hydrated'").fetchone()[0], 1)

    def test_source_director_contradiction_is_not_overridden_by_matching_cast(self):
        raw = json.loads(self.db.execute("SELECT raw_json FROM source_rows").fetchone()[0])
        raw["Director"] = "Different Director"
        self.db.execute("UPDATE source_rows SET raw_json=?", (catalog.dump(raw),))
        self.db.commit()
        with patch.object(catalog.urllib.request, "urlopen",
                          side_effect=[Response(self.source_search()), Response(self.native_details())]):
            catalog.hydrate_tmdb_sources(self.db, self.client(provider="tmdb"))
        self.assertEqual(self.db.execute("SELECT count(*) FROM identities").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT status FROM matches").fetchone()[0], "needs_review")

    def test_source_approximate_title_is_retained_but_never_auto_linked(self):
        with patch.object(catalog.urllib.request, "urlopen",
                          return_value=Response(self.source_search("Eega 2"))) as request:
            catalog.hydrate_tmdb_sources(self.db, self.client(provider="tmdb"))
            self.assertEqual(request.call_count, 1)
        self.assertEqual(self.db.execute("SELECT count(*) FROM identities").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT status FROM matches").fetchone()[0], "needs_review")

    def test_incomplete_candidate_details_do_not_become_trusted_export_data(self):
        with patch.object(catalog.urllib.request, "urlopen",
                          side_effect=[Response(self.source_search()), Response({"id": 123})]):
            with self.assertRaises(catalog.APIError):
                catalog.hydrate_tmdb_sources(self.db, self.client(provider="tmdb"))
        catalog.annotate(self.db, [])
        catalog.export(self.db, self.path / "export")
        movie = json.loads((self.path / "export/movies.jsonl").read_text())
        self.assertEqual(movie["provider_data"], {})
        self.assertEqual(movie["matches"][0]["status"], "needs_review")

    def test_person_matching_allows_name_order_but_not_unproven_initial_expansion(self):
        self.assertEqual(catalog.person_key("Akkineni Nagarjuna"), catalog.person_key("Nagarjuna Akkineni"))
        self.assertNotEqual(catalog.person_key("C. Pullaiah"), catalog.person_key("Chittajallu Pullaiah"))

    def test_editorial_annotation_reasoning_and_history(self):
        seeds = json.loads(catalog.ANNOTATIONS.read_text())
        catalog.annotate(self.db, seeds)
        catalog.annotate(self.db, seeds)
        self.assertEqual(self.db.execute("SELECT count(*) FROM annotations").fetchone()[0], 1)
        annotation = json.loads(self.db.execute("SELECT annotation_json FROM annotations").fetchone()[0])
        self.assertEqual(annotation["difficulty"], 1)
        for component in annotation["components"].values():
            self.assertTrue(component["reason"])
        catalog.annotate(self.db, [])
        self.assertEqual(self.db.execute("SELECT count(*) FROM annotations").fetchone()[0], 2)
        catalog.annotate(self.db, seeds)
        self.assertEqual(self.db.execute("SELECT count(*) FROM annotations").fetchone()[0], 3)
        latest = json.loads(self.db.execute("SELECT annotation_json FROM annotations ORDER BY id DESC LIMIT 1").fetchone()[0])
        self.assertEqual(latest["difficulty"], 1)

    def test_early_schema_migration_keeps_annotation_ids_and_content(self):
        seeds = json.loads(catalog.ANNOTATIONS.read_text())
        catalog.annotate(self.db, seeds)
        original = dict(self.db.execute("SELECT * FROM annotations").fetchone())
        self.db.execute("CREATE UNIQUE INDEX early_unique_annotations "
                        "ON annotations(movie_id,rubric,input_sha256)")
        self.db.commit()
        self.db.close()
        self.db = catalog.connect(self.path / "movies.sqlite")
        self.assertEqual(dict(self.db.execute("SELECT * FROM annotations").fetchone()), original)
        catalog.annotate(self.db, [])
        catalog.annotate(self.db, seeds)
        self.assertEqual(self.db.execute("SELECT count(*) FROM annotations").fetchone()[0], 3)

    def test_real_csv_has_one_record_and_annotation_per_row(self):
        count = catalog.import_csv(self.db, catalog.DEFAULT_CSV)
        self.assertEqual(count, 2407)
        catalog.annotate(self.db, [])
        self.assertEqual(self.db.execute("SELECT count(*) FROM source_rows").fetchone()[0], 2408)
        self.assertEqual(self.db.execute("SELECT count(*) FROM annotations").fetchone()[0], 2408)


class ServerTests(unittest.TestCase):
    def test_private_files_denied_and_game_served(self):
        http = ThreadingHTTPServer(("127.0.0.1", 0), partial(server.Handler, directory=str(ROOT)))
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{http.server_port}"
            with urllib.request.urlopen(base + "/index.html") as response:
                self.assertEqual(response.status, 200)
            for path in ("/.env", "/%2eenv", "/.git/config", "/dev/movies/.local/movies.sqlite",
                         "/dev/movies/editorial/annotations.json", "/css/../.env"):
                with self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen(base + path)
                self.assertEqual(error.exception.code, 404)
            with patch.object(server.Handler, "translate_path", return_value="/tmp/private-file"):
                with self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen(base + "/symlink-like-path")
                self.assertEqual(error.exception.code, 404)
        finally:
            http.shutdown()
            http.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
