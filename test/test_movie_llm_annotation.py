import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from dev.movies import catalog
from dev.movies import llm_annotation as llm


def proposal(request, recognition=2):
    return {
        "job_key": request["job_key"], "movie_id": request["input"]["movie"]["id"],
        "tmdb_id": request["input"]["tmdb_id"], "prompt_title": request["input"]["movie"]["title"],
        "confidence": "medium",
        "actability": {"value": 1, "reason": "Illustrative linguistic inference for a test title.",
                       "basis": "linguistic_inference", "evidence": ["movie.title"],
                       "gestures": ["An illustrative, nonverbal test gesture."]},
        "recognition": {"value": recognition, "reason": "A test audience hypothesis, not a global vote measurement.",
                        "basis": "audience_hypothesis" if recognition else "insufficient_evidence",
                        "evidence": ["tmdb.vote_count"]},
        "reason": "Test-only review; no real film is being rated.",
        "uncertainties": [] if recognition else ["Test audience familiarity is unknown."],
    }


def adapter_result(request, recognition=2, decision="approve"):
    output = proposal(request, recognition) if request["stage"] == "annotate" else {
        "job_key": request["job_key"], "proposal_sha256": request["proposal_sha256"],
        "decision": decision, "reason": "Test-only critical review.",
        "issues": [] if decision == "approve" else ["Title interpretation needs revision."],
    }
    return subprocess.CompletedProcess(
        [], 0, json.dumps({"provider": "test-only", "model": request["stage"] + "-fixture",
                           "usage": {"tokens": 1}, "output": output}), "")


class LLMAnnotationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)
        self.db = catalog.connect(self.path / "movies.sqlite")
        llm.initialize(self.db)
        self.db.execute("INSERT INTO movies VALUES (?,?,?,?,?)",
                        ("tmdb:42", "A Test Movie", 2012, "te", catalog.now()))
        self.payload = {"id": 42, "title": "A Test Movie", "original_title": "A Test Movie",
                        "original_language": "te", "release_date": "2012-01-01",
                        "adult": False, "vote_count": 25, "overview": "Synthetic test evidence.",
                        "credits": {"cast": [], "crew": []}, "future_field": {"lossless": True}}
        self.add_snapshot()
        self.db.execute("INSERT INTO identities VALUES (?,?,?,?,?)",
                        ("tmdb", "42", "tmdb:42", "{}", catalog.now()))
        self.db.commit()
        catalog.annotate(self.db, [])
        self.movie = self.db.execute("SELECT * FROM movies").fetchone()

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def add_snapshot(self):
        body = catalog.dump(self.payload)
        receipt = self.db.execute(
            "INSERT INTO responses(request_key,provider,path,params_json,fetched_at,status,"
            "body,body_sha256,usable) VALUES (?,?,?,?,?,?,?,?,?)",
            ("fixture-request", "tmdb", "/movie/42", "{}", catalog.now(), 200, body,
             catalog.digest(body), 1)).lastrowid
        catalog.record_match(self.db, "tmdb:42", "tmdb", receipt, "hydrated", "Synthetic fixture.")

    def jobs(self, **kwargs):
        return llm.prepare(self.db, [], 10, "fixture-v1", "fixture-adapter", **kwargs)

    def run_jobs(self, jobs=None, recognition=2, decision="approve", max_calls=10, retry=False):
        with patch.object(llm.subprocess, "run", side_effect=lambda *a, **kw:
                          adapter_result(json.loads(kw["input"]), recognition, decision)) as runner:
            result = llm.run_jobs(self.db, jobs or self.jobs(), self.path / "adapter.py",
                                  10, max_calls, retry)
            return result, runner.call_count

    def latest_annotation(self):
        return json.loads(self.db.execute(
            "SELECT annotation_json FROM annotations ORDER BY id DESC LIMIT 1").fetchone()[0])

    def test_snapshot_queue_and_fingerprints(self):
        first = self.jobs()[0]
        self.assertEqual(first["job_key"], self.jobs()[0]["job_key"])
        context = json.loads(first["input_json"])
        self.assertEqual(context["tmdb_id"], 42)
        self.assertEqual(context["snapshot"]["body_sha256"], catalog.digest(catalog.dump(self.payload)))
        self.assertEqual(llm.prepare(self.db, [{"tmdb_id": 42}], 10, "fixture-v1"), [])
        self.assertEqual(llm.prepare(self.db, [{"title": "A Test Movie", "year": 2012}],
                                     10, "fixture-v1"), [])
        self.assertNotEqual(first["job_key"], llm.prepare(self.db, [], 10, "fixture-v2")[0]["job_key"])
        self.db.execute("UPDATE matches SET status='needs_review'")
        self.db.commit()
        self.assertEqual(self.jobs(), [])

    def test_candidate_guards(self):
        for field, value in (("adult", True), ("original_language", "ta"),
                             ("release_date", "2999-01-01"), ("release_date", "")):
            original = self.payload.copy()
            self.payload[field] = value
            self.add_snapshot()
            self.assertEqual(self.jobs(), [])
            self.payload = original

    def test_budget_resume_and_no_repeat_calls(self):
        (calls, partial), count = self.run_jobs(max_calls=1)
        self.assertEqual((calls, partial, count), (1, True, 1))
        (calls, partial), count = self.run_jobs()
        self.assertEqual((calls, partial, count), (1, False, 1))
        self.assertEqual(self.jobs(), [])
        self.assertEqual(self.db.execute("SELECT count(*) FROM llm_calls").fetchone()[0], 2)

    def test_promotion_rebuild_editorial_priority_and_raw_exports(self):
        job = self.jobs()[0]
        self.run_jobs([job])
        catalog.annotate(self.db, [])
        self.assertIsNone(self.latest_annotation()["difficulty"])
        llm.promote(self.db, [job["job_key"]])
        catalog.annotate(self.db, [])
        rating = self.latest_annotation()
        self.assertEqual(rating["difficulty"], 2)
        self.assertEqual(rating["status"], "llm_reviewed")
        self.assertFalse(rating["automation"]["human_verified"])
        self.assertTrue(rating["review_required"])
        self.assertEqual(rating["components"]["actability"]["gestures"],
                         ["An illustrative, nonverbal test gesture."])
        revisions = self.db.execute("SELECT count(*) FROM annotations").fetchone()[0]
        catalog.annotate(self.db, [])
        self.assertEqual(self.db.execute("SELECT count(*) FROM annotations").fetchone()[0], revisions)
        seed = {"title": "A Test Movie", "year": 2012, "tmdb_id": 42, "source": "Human fixture",
                "difficulty": {"actability": {"value": 3, "reason": "Human reason", "method": "editorial"},
                               "recognition": {"value": None, "reason": "Unknown", "method": "editorial"},
                               "reason": "Human uncertainty wins."}}
        catalog.annotate(self.db, [seed])
        self.assertIsNone(self.latest_annotation()["difficulty"])
        self.assertNotIn("automation", self.latest_annotation())
        manifest = catalog.export(self.db, self.path / "export")
        self.assertEqual(manifest["llm_job_status_counts"], {"promoted": 1})
        calls = [json.loads(line) for line in (self.path / "export/llm_calls.jsonl").read_text().splitlines()]
        self.assertEqual(len(calls), 2)
        self.assertEqual(json.loads(calls[0]["response_text"])["provider"], "test-only")

    def test_null_values_and_stale_promotion(self):
        job = self.jobs()[0]
        self.run_jobs([job], recognition=None)
        llm.promote(self.db, [job["job_key"]])
        catalog.annotate(self.db, [])
        self.assertIsNone(self.latest_annotation()["difficulty"])
        self.assertEqual(self.latest_annotation()["difficulty_range"], [1.2, 2.4])
        self.payload["overview"] = "Changed trusted snapshot."
        self.add_snapshot()
        with self.assertRaisesRegex(ValueError, "stale"):
            llm.promote(self.db, [job["job_key"]])
        catalog.annotate(self.db, [])
        self.assertNotIn("automation", self.latest_annotation())
        self.assertNotEqual(job["job_key"], self.jobs()[0]["job_key"])

    def test_rejection_requires_explicit_retry(self):
        job = self.jobs()[0]
        self.run_jobs([job], decision="revise")
        with self.assertRaisesRegex(ValueError, "not reviewed"):
            llm.promote(self.db, [job["job_key"]])
        self.assertEqual(self.jobs(), [])
        self.assertEqual(len(self.jobs(retry=True)), 1)
        with patch.object(llm.subprocess, "run", side_effect=lambda *a, **kw:
                          adapter_result(json.loads(kw["input"]))) as runner:
            llm.run_jobs(self.db, self.jobs(retry=True), self.path / "adapter.py", 10, 10, retry=True)
        request = json.loads(runner.call_args_list[0].kwargs["input"])
        self.assertEqual(request["review_feedback"]["decision"], "revise")
        self.assertIn("previous_proposal", request)

    def test_validation_rejects_invalid_scores_identity_and_citations(self):
        request = llm.request_for(self.jobs()[0], "annotate")
        for mutate in (
                lambda p: p.update(tmdb_id=43),
                lambda p: p.update(prompt_title="Wrong title"),
                lambda p: p["actability"].update(value=True),
                lambda p: p["actability"].update(value=6),
                lambda p: p["actability"].update(reason=" "),
                lambda p: p["actability"].update(gestures=[]),
                lambda p: p["recognition"].update(evidence=["tmdb.imagined_field"]),
                lambda p: p["recognition"].update(basis="linguistic_inference"),
                lambda p: p.update(extra="Unexpected")):
            candidate = proposal(request)
            mutate(candidate)
            with self.assertRaises(ValueError):
                llm.validate_output(request, candidate)
        review_request = llm.request_for(self.jobs()[0], "review", proposal(request))
        for update in ({"proposal_sha256": "wrong"}, {"issues": ["Unresolved problem"]}):
            output = json.loads(adapter_result(review_request).stdout)["output"]
            output.update(update)
            with self.assertRaises(ValueError):
                llm.validate_output(review_request, output)
        no_route = proposal(request)
        no_route["actability"].update(value=5, gestures=[])
        llm.validate_output(request, no_route)

    def test_failed_adapter_preserves_receipts_and_resume_skips_annotation(self):
        job = self.jobs()[0]
        self.run_jobs([job], max_calls=1)
        current = self.jobs()[0]
        with patch.object(llm.subprocess, "run", return_value=subprocess.CompletedProcess(
                [], 0, '{"provider":{},"model":"bad","output":{}}', "")):
            with self.assertRaisesRegex(ValueError, "identify its provider"):
                llm.run_jobs(self.db, [current], self.path / "adapter.py", 10, 5)
        failed = llm.latest_call(self.db, job["job_key"], "review")
        self.assertIsNone(failed["output_json"])
        self.assertIn('"provider":{}', failed["response_text"])
        self.assertEqual(self.jobs(), [])
        self.run_jobs(self.jobs(retry=True), retry=True)
        self.assertEqual(self.db.execute(
            "SELECT count(*) FROM llm_calls WHERE stage='annotate'").fetchone()[0], 1)
        self.assertEqual(self.db.execute("SELECT status FROM llm_jobs").fetchone()[0], "reviewed")

    def test_non_object_adapter_response_and_interrupted_call(self):
        job = self.jobs()[0]
        with patch.object(llm.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, "[]", "")):
            with self.assertRaisesRegex(ValueError, "JSON object"):
                llm.run_jobs(self.db, [job], self.path / "adapter.py", 10, 5)
        self.assertEqual(llm.latest_call(self.db, job["job_key"], "annotate")["response_text"], "[]")
        self.db.execute("UPDATE llm_jobs SET status='prepared'")
        self.db.commit()
        job = self.jobs()[0]
        with patch.object(llm.subprocess, "run", side_effect=KeyboardInterrupt):
            with self.assertRaises(KeyboardInterrupt):
                llm.run_jobs(self.db, [job], self.path / "adapter.py", 10, 5)
        self.assertEqual(llm.latest_call(self.db, job["job_key"], "annotate")["error"], "in_flight")
        self.assertEqual(self.jobs(), [])
        self.assertEqual(len(self.jobs(retry=True)), 1)

    def test_cli_adapter_contract_end_to_end(self):
        root = Path(__file__).resolve().parents[1]
        adapter = self.path / "fixture_adapter.py"
        adapter.write_text(
            "import json,sys\n"
            f"sys.path.insert(0,{str(root)!r})\n"
            f"sys.path.insert(0,{str(root / 'test')!r})\n"
            "from test_movie_llm_annotation import adapter_result\n"
            "print(adapter_result(json.load(sys.stdin)).stdout)\n")
        common = ["--db", str(self.path / "movies.sqlite"), "--export", str(self.path / "cli-export")]
        for command, flags in (
                ("prepare", ["--adapter", str(adapter), "--profile", "fixture-cli", "--limit", "1",
                             "--output", str(self.path / "requests.jsonl")]),
                ("run", ["--adapter", str(adapter), "--profile", "fixture-cli", "--limit", "1"]),
                ("promote", ["--all-reviewed"])):
            result = subprocess.run(
                [sys.executable, "-m", "dev.movies.llm_annotation", command, *common, *flags],
                cwd=root, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
        manifest = json.loads((self.path / "cli-export/manifest.json").read_text())
        self.assertEqual(manifest["difficulty_llm_reviewed"], 1)
        self.assertEqual(manifest["difficulty_editorial"], 0)
        self.assertEqual(manifest["llm_job_status_counts"], {"promoted": 1})

    def test_subprocess_failure_and_timeout_are_visible(self):
        for failure in (subprocess.CompletedProcess([], 3, "partial", "secret diagnostic"),
                        subprocess.TimeoutExpired("adapter", 1, output=b"partial")):
            job = self.jobs(retry=True)[0]
            with patch.object(llm.subprocess, "run") as runner:
                if isinstance(failure, Exception):
                    runner.side_effect = failure
                else:
                    runner.return_value = failure
                with self.assertRaises(ValueError):
                    llm.run_jobs(self.db, [job], self.path / "adapter.py", 1, 5, retry=True)
            call = llm.latest_call(self.db, job["job_key"], "annotate")
            self.assertEqual(call["response_text"], "partial")
            self.assertIsNotNone(call["error"])
            self.assertNotIn("secret diagnostic", call["error"])

    def test_batch_promotion_is_all_or_nothing(self):
        job = self.jobs()[0]
        self.run_jobs([job])
        with self.assertRaises(ValueError):
            llm.promote(self.db, [job["job_key"], "missing-job"])
        self.assertEqual(self.db.execute("SELECT count(*) FROM llm_promotions").fetchone()[0], 0)

    def test_stale_runner_cannot_claim_changed_job(self):
        job = self.jobs()[0]
        self.db.execute("UPDATE llm_jobs SET status='annotated'")
        self.db.commit()
        with patch.object(llm.subprocess, "run") as runner:
            with self.assertRaisesRegex(ValueError, "another runner"):
                llm.invoke(self.db, job, llm.request_for(job, "annotate"), self.path / "adapter.py", 10)
        runner.assert_not_called()
        self.db.rollback()
        self.assertEqual(self.db.execute("SELECT count(*) FROM llm_calls").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
