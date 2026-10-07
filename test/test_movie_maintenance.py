import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from dev.movies import catalog
from dev.movies import maintenance


class MaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)
        self.db = catalog.connect(self.path / "movies.sqlite")
        maintenance.initialize(self.db)

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def test_daily_budget_persists_across_process_clients_and_network_failures(self):
        one = maintenance.DailyClient(self.db, "tmdb", "fixture", 2, delay=0)
        one.reserve()
        two = maintenance.DailyClient(self.db, "tmdb", "fixture", 2, delay=0)
        two.reserve()
        with self.assertRaises(maintenance.DailyBudgetReached):
            maintenance.DailyClient(self.db, "tmdb", "fixture", 2).reserve()
        self.assertEqual(self.db.execute("SELECT reserved_calls FROM maintenance_budgets").fetchone()[0], 2)

    def test_refresh_reuses_cycle_snapshots_across_daily_runs(self):
        client = maintenance.DailyClient(self.db, "tmdb", "fixture", 20, refresh_since="2020", delay=0)
        client.refresh_prefixes = ("/discover/movie",)
        self.assertIsNone(client.cached("/discover/movie", {"page": 1}))
        client.save("/discover/movie", {"page": 1}, (200, '{"results":[]}'))
        restarted = maintenance.DailyClient(self.db, "tmdb", "fixture", 20, refresh_since="2020", delay=0)
        restarted.refresh_prefixes = ("/discover/movie",)
        self.assertIsNotNone(restarted.cached("/discover/movie", {"page": 1}))
        restarted.force_since = "2999"
        self.assertIsNone(restarted.cached("/discover/movie", {"page": 1}))

    def test_all_scan_indexes_undated_future_and_existing_id_without_overwriting_source(self):
        client = catalog.Client(self.db, "tmdb", "fixture")
        payload = {"total_pages": 1, "total_results": 3, "results": [
            {"id": 1, "title": "Undated", "release_date": "", "original_language": "te"},
            {"id": 2, "title": "Future", "release_date": "2999-01-01", "original_language": "te"},
            {"id": 3, "title": "Old Film", "release_date": "1932-01-01", "original_language": "te"}]}
        _, receipt = client.save("/discover/movie", {}, (200, catalog.dump(payload)))
        with patch.object(client, "get", return_value=(payload, receipt)):
            maintenance.discover_all(self.db, client)
        self.assertEqual(self.db.execute("SELECT year FROM movies WHERE id='tmdb:1'").fetchone()[0], None)
        self.assertEqual(self.db.execute("SELECT count(*) FROM identities").fetchone()[0], 3)
        self.assertEqual(self.db.execute("SELECT status FROM coverage").fetchone()[0], "complete")

    def test_unbounded_scan_cap_is_not_silently_marked_exhausted(self):
        client = catalog.Client(self.db, "tmdb", "fixture")
        with patch.object(client, "get", return_value=({"total_pages": 501}, 1)):
            with self.assertRaisesRegex(catalog.APIError, "500-page cap"):
                maintenance.discover_all(self.db, client)
        self.assertEqual(self.db.execute("SELECT status FROM coverage").fetchone()[0], "in_progress")

    def test_month_cursor_resumes_after_budget_without_restarting_refresh(self):
        state = maintenance.new_cycle("refresh", dt.date(1931, 2, 28), catalog.now())
        client = maintenance.DailyClient(self.db, "tmdb", "fixture", 10, state["started_at"])
        calls = []

        def discover(db, client, year, end, months, through_date):
            calls.extend(months)
            if (1931, 2) in months:
                raise maintenance.DailyBudgetReached("fixture stop")

        with patch.object(catalog, "discover_tmdb", side_effect=discover):
            with self.assertRaises(maintenance.DailyBudgetReached):
                maintenance.tmdb_work(self.db, client, state)
        self.assertEqual(state["tmdb"]["month_cursor"], 1)
        calls.clear()
        with patch.object(catalog, "discover_tmdb", side_effect=discover):
            with self.assertRaises(maintenance.DailyBudgetReached):
                maintenance.tmdb_work(self.db, client, state)
        self.assertEqual(calls, [(1931, 2)])

    def test_installed_agent_time_and_interpreter_contain_no_secrets(self):
        definition = maintenance.agent_definition(11, 0, self.path / "db", self.path / "export", 5000, 950, 7)
        self.assertEqual(definition["StartCalendarInterval"], {"Hour": 11, "Minute": 0})
        self.assertTrue(definition["RunAtLoad"])
        self.assertIn("dev.movies.maintenance", definition["ProgramArguments"])
        self.assertNotIn("GEMINI_API_KEY", json.dumps(definition))

    def test_lock_prevents_overlapping_runs(self):
        with maintenance.run_lock(self.path / "maintenance.lock"):
            with self.assertRaisesRegex(RuntimeError, "already running"):
                with maintenance.run_lock(self.path / "maintenance.lock"):
                    pass

    def test_idle_ingestion_still_runs_annotation_and_exports(self):
        state = maintenance.new_cycle("backfill", dt.date.today(), catalog.now())
        state.update(mode="idle", next_refresh_at="2999-01-01")
        maintenance.save_state(self.db, state)
        result = {"provider_error": None, "singleton_failures": [], "promoted": 3}
        with patch("dev.movies.gemini_annotation.annotate_existing", return_value=result) as annotate:
            with patch.object(catalog, "import_csv") as ingest:
                output = maintenance.run(self.db, self.path / "export", gemini_daily_calls=17)
        annotate.assert_called_once_with(self.db, daily_calls=17)
        ingest.assert_not_called()
        self.assertEqual(output["annotations"]["promoted"], 3)
        self.assertTrue((self.path / "export/periods/index.json").is_file())


if __name__ == "__main__":
    unittest.main()
