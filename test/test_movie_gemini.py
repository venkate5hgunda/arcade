import json
from pathlib import Path
import threading
import time
import unittest
from unittest.mock import patch

from dev.movies import catalog
from dev.movies import gemini_annotation as gemini
from dev.movies import llm_annotation as llm
import test_movie_llm_annotation as fixtures


class GeminiTests(unittest.TestCase):
    def setUp(self):
        fixtures.LLMAnnotationTests.setUp(self)
        gemini.initialize(self.db)

    def tearDown(self):
        fixtures.LLMAnnotationTests.tearDown(self)

    def add_snapshot(self):
        return fixtures.LLMAnnotationTests.add_snapshot(self)

    def jobs(self, count=1):
        for value in range(43, 42 + count):
            movie = f"tmdb:{value}"
            title = f"Test Movie {value}"
            self.db.execute("INSERT OR IGNORE INTO movies VALUES (?,?,?,?,?)",
                            (movie, title, 2012, "te", catalog.now()))
            payload = {**self.payload, "id": value, "title": title}
            _, receipt = catalog.Client(self.db, "tmdb", "test").save(
                "/movie/" + str(value), {}, (200, catalog.dump(payload)))
            catalog.link(self.db, movie, "tmdb", str(value), {})
            catalog.record_match(self.db, movie, "tmdb", receipt, "hydrated", "Synthetic fixture.")
        return llm.prepare(self.db, [], 100, "test-gemini", "fixture-gemini", retry=True)

    def response(self, model, key, body=None, **kwargs):
        if body is None:
            return 200, json.dumps({"inputTokenLimit": 1048576, "outputTokenLimit": 65536,
                                    "supportedGenerationMethods": ["generateContent"]})
        items = json.loads(body["contents"][0]["parts"][0]["text"])["items"]
        output = []
        for item in items:
            if model == gemini.ANNOTATOR:
                output.append(fixtures.proposal(item))
            else:
                output.append({"job_key": item["job_key"], "proposal_sha256": item["proposal_sha256"],
                               "decision": "approve", "reason": "Test-only review.", "issues": []})
        return 200, json.dumps({
            "modelVersion": model, "candidates": [{"finishReason": "STOP", "content": {
                "parts": [{"text": json.dumps({"items": output})}]}}],
            "usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": len(items) * 100}})

    def test_batch_success_maps_every_movie_and_records_native_usage_once(self):
        jobs = self.jobs(3)
        items = gemini.request_items(self.db, jobs, "annotate")
        limits = {"input": 1048576, "output": 65536}
        with patch.object(gemini, "http_json", side_effect=self.response):
            result = gemini.execute_stage(self.db, [items], "annotate", gemini.ANNOTATOR,
                                          limits, "test-key", 1000, .35)
            self.assertIsNone(result["provider_error"])
            requests = gemini.request_items(self.db, jobs, "review")
            gemini.execute_stage(self.db, [requests], "review", gemini.REVIEWER,
                                 limits, "test-key", 1000, .35)
        for job in jobs:
            llm.promote(self.db, [job["job_key"]])
        catalog.annotate(self.db, [])
        self.assertEqual(self.db.execute("SELECT count(*) FROM llm_promotions").fetchone()[0], 3)
        self.assertEqual(self.db.execute("SELECT count(*) FROM llm_batches").fetchone()[0], 2)
        self.assertEqual(self.db.execute("SELECT count(*) FROM llm_calls").fetchone()[0], 6)
        self.assertEqual(self.db.execute("SELECT reserved_calls FROM llm_daily_budget").fetchone()[0], 2)
        manifest = catalog.export(self.db, self.path / "export")
        self.assertEqual(manifest["difficulty_llm_reviewed"], 3)
        self.assertTrue((self.path / "export/llm_batches.jsonl").is_file())

    def test_schema_failure_recursively_halves_without_losing_receipts(self):
        items = gemini.request_items(self.db, self.jobs(4), "annotate")
        sizes = []

        def response(model, key, body):
            size = len(json.loads(body["contents"][0]["parts"][0]["text"])["items"])
            sizes.append(size)
            if size > 1:
                return 200, '{"candidates":[{"finishReason":"MAX_TOKENS"}]}'
            return self.response(model, key, body)

        with patch.object(gemini, "http_json", side_effect=response):
            result = gemini.execute_stage(self.db, [items], "annotate", gemini.ANNOTATOR,
                                          {"input": 1048576, "output": 65536}, "test", 1000, .35)
        self.assertFalse(result["singleton_failures"])
        self.assertEqual(sorted(sizes), [1, 1, 1, 1, 2, 2, 4])
        self.assertEqual(self.db.execute("SELECT reserved_calls FROM llm_daily_budget").fetchone()[0], 7)
        self.assertEqual(self.db.execute("SELECT count(*) FROM llm_jobs WHERE status='annotated'").fetchone()[0], 4)

    def test_exactly_two_parallel_calls_and_persistent_daily_cap(self):
        items = gemini.request_items(self.db, self.jobs(4), "annotate")
        lock = threading.Lock()
        running, maximum = 0, 0

        def response(*args):
            nonlocal running, maximum
            with lock:
                running += 1
                maximum = max(maximum, running)
            time.sleep(.04)
            result = self.response(*args)
            with lock:
                running -= 1
            return result

        with patch.object(gemini, "http_json", side_effect=response):
            result = gemini.execute_stage(self.db, [[item] for item in items], "annotate",
                                          gemini.ANNOTATOR, {"input": 1048576, "output": 65536},
                                          "test", 2, .35)
        self.assertEqual(maximum, 2)
        self.assertIn("cap", result["provider_error"])
        self.assertEqual(self.db.execute("SELECT reserved_calls FROM llm_daily_budget").fetchone()[0], 2)

    def test_provider_errors_do_not_trigger_schema_retry(self):
        items = gemini.request_items(self.db, self.jobs(2), "annotate")
        for status, text in ((429, '{"error":{"message":"quota"}}'),
                             (400, '{"error":{"status":"INVALID_ARGUMENT"}}')):
            with patch.object(gemini, "http_json", return_value=(status, text)) as request:
                result = gemini.execute_stage(self.db, [items], "annotate", gemini.ANNOTATOR,
                                              {"input": 1048576, "output": 65536}, "test", 1000, .35)
            self.assertEqual(request.call_count, 1)
            self.assertIn(str(status), result["provider_error"])
        self.assertEqual(self.db.execute("SELECT count(*) FROM llm_promotions").fetchone()[0], 0)

    def test_token_sizing_accounts_for_output_and_does_not_truncate_context(self):
        items = gemini.request_items(self.db, self.jobs(4), "annotate")
        groups = list(gemini.sized_groups(items, {"input": 1000000, "output": 10000}, .35, 1500))
        self.assertEqual([len(group) for group in groups], [2, 2])
        with self.assertRaisesRegex(ValueError, "exceeds"):
            list(gemini.sized_groups(items, {"input": 1000, "output": 65536}, .35, 1500))

    def test_google_schema_translation_preserves_nulls_enums_and_required_fields(self):
        schema = gemini.google_schema(llm.ANNOTATION_SCHEMA)
        self.assertEqual(schema["properties"]["tmdb_id"]["type"], "INTEGER")
        self.assertTrue(schema["properties"]["tmdb_id"]["nullable"])
        self.assertEqual(schema["properties"]["confidence"]["type"], "STRING")
        self.assertEqual(schema["required"], llm.ANNOTATION_SCHEMA["required"])
        self.assertNotIn("additionalProperties", schema)

    def test_unknown_network_outcome_is_not_automatically_repeated(self):
        items = gemini.request_items(self.db, self.jobs(), "annotate")
        with patch.object(gemini, "http_json", side_effect=gemini.ProviderFailure("Unknown outcome.")):
            gemini.execute_stage(self.db, [items], "annotate", gemini.ANNOTATOR,
                                 {"input": 1048576, "output": 65536}, "test", 1000, .35)
        self.assertEqual(self.db.execute("SELECT status FROM llm_jobs").fetchone()[0], "in_flight")


if __name__ == "__main__":
    unittest.main()
