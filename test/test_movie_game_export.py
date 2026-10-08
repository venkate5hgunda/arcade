import json
import unittest

from dev.movies import catalog, game_export, llm_annotation as llm
import test_movie_llm_annotation as fixtures


class GameExportTests(unittest.TestCase):
    setUp = fixtures.LLMAnnotationTests.setUp
    tearDown = fixtures.LLMAnnotationTests.tearDown
    add_snapshot = fixtures.LLMAnnotationTests.add_snapshot
    jobs = fixtures.LLMAnnotationTests.jobs
    run_jobs = fixtures.LLMAnnotationTests.run_jobs

    def test_only_complete_approved_proposals_are_public_without_raw_payloads(self):
        self.assertEqual(game_export.approved_movies(self.db), [])
        job = self.jobs()[0]
        self.run_jobs([job])
        catalog.annotate(self.db, [])
        self.assertEqual(game_export.approved_movies(self.db), [])
        llm.promote(self.db, [job["job_key"]])
        catalog.annotate(self.db, [])
        records = game_export.approved_movies(self.db)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["approval"], "llm_reviewed")
        self.assertEqual(records[0]["difficulty"], 2)
        self.assertEqual(set(records[0]), {
            "id", "title", "year", "difficulty", "approval", "confidence",
            "rubric", "reason", "components", "genres"})
        serialized = catalog.dump(records)
        for private in ("Synthetic test evidence.", "future_field", "source_rows", "body_sha256"):
            self.assertNotIn(private, serialized)
        index = game_export.publish(self.db, self.path / "public")
        self.assertEqual(index["records"], 1)
        self.assertEqual(json.loads((self.path / "public" / index["files"][0]["path"]).read_text()), records[0])

    def test_incomplete_approved_scores_stay_out(self):
        job = self.jobs()[0]
        self.run_jobs([job], recognition=None)
        llm.promote(self.db, [job["job_key"]])
        catalog.annotate(self.db, [])
        self.assertEqual(game_export.approved_movies(self.db), [])

    def test_current_complete_model_approval_is_revoked_after_evidence_changes(self):
        job = self.jobs()[0]
        self.run_jobs([job])
        llm.promote(self.db, [job["job_key"]])
        catalog.annotate(self.db, [])
        self.assertEqual(len(game_export.approved_movies(self.db)), 1)
        self.payload["overview"] = "Changed evidence revokes the prior score."
        self.add_snapshot()
        catalog.annotate(self.db, [])
        self.assertEqual(game_export.approved_movies(self.db), [])


if __name__ == "__main__":
    unittest.main()
