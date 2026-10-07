"""Tests for size-aware, lossless year-partitioned movie exports."""

import hashlib
import json
from pathlib import Path
import shutil
import unittest
from unittest.mock import patch
import uuid

from dev.movies.catalog import dump
from dev.movies.partitions import write_partitions

TEST_DIR = Path(__file__).resolve().parent


class MoviePartitionsTests(unittest.TestCase):
    def setUp(self):
        self.scratch_dir = TEST_DIR / f"_scratch_{uuid.uuid4().hex}"
        self.scratch_dir.mkdir(parents=True, exist_ok=True)
        self.addCleanup(self._cleanup)

    def _cleanup(self):
        if self.scratch_dir.exists():
            shutil.rmtree(self.scratch_dir, ignore_errors=True)

    def test_exact_byte_threshold(self):
        rec1 = {"id": "m1", "title": "A", "year": 1990}
        rec2 = {"id": "m2", "title": "B", "year": 1991}
        len1 = len((dump(rec1) + "\n").encode("utf-8"))
        len2 = len((dump(rec2) + "\n").encode("utf-8"))
        exact_target = len1 + len2

        # When max_bytes == exact_target, both fit in 10-year window 1990-1999
        index = write_partitions([rec1, rec2], self.scratch_dir, max_bytes=exact_target)
        self.assertEqual(len(index["files"]), 1)
        self.assertTrue(index["files"][0]["path"].startswith("1990-1999."))
        self.assertTrue(index["files"][0]["path"].endswith(".jsonl"))
        self.assertEqual(index["files"][0]["bytes"], exact_target)
        self.assertEqual(index["files"][0]["records"], 2)

        # When max_bytes == exact_target - 1, 10-year window is crowded and splits
        index2 = write_partitions([rec1, rec2], self.scratch_dir, max_bytes=exact_target - 1)
        # In decade 1990-1999, splits to 5-year [1990-1994], which has both records and is crowded (len1+len2 > exact_target-1)
        # 5-year [1990-1994] splits to 2+2+1: [1990-1991] which is crowded, then to 1-year: 1990 and 1991
        stems = [f["path"].split(".")[0] for f in index2["files"]]
        self.assertEqual(stems, ["1990", "1991"])

    def test_multi_byte_text(self):
        # Telugu title with multi-byte UTF-8 sequences
        telugu_rec = {
            "id": "te1",
            "title": "మాయాబజార్",  # Mayabazar in Telugu
            "year": 1957,
            "director": "కె. వి. రెడ్డి",
            "nested": {"overview": "తెలుగు సినిమా మైలురాయి"}
        }
        raw_bytes = (dump(telugu_rec) + "\n").encode("utf-8")
        actual_bytes = len(raw_bytes)
        # Verify that UTF-8 bytes > character length
        char_len = len(dump(telugu_rec) + "\n")
        self.assertGreater(actual_bytes, char_len)

        index = write_partitions([telugu_rec], self.scratch_dir, max_bytes=actual_bytes)
        self.assertEqual(len(index["files"]), 1)
        file_info = index["files"][0]
        self.assertEqual(file_info["bytes"], actual_bytes)
        self.assertTrue(file_info["path"].startswith("1950-1959."))

        # Read back and verify exact byte and json equivalence
        content = (self.scratch_dir / file_info["path"]).read_bytes()
        self.assertEqual(content, raw_bytes)
        parsed = json.loads(content.decode("utf-8").strip())
        self.assertEqual(parsed, telugu_rec)

    def test_lossless_union_and_deduplication_preservation(self):
        # Must preserve every record, even duplicates
        records = [
            {"id": "m1", "title": "Film A", "year": 1980, "meta": {"score": 10}},
            {"id": "m1", "title": "Film A", "year": 1980, "meta": {"score": 10}},  # duplicate
            {"id": "m2", "title": "Film B", "year": None},
            {"id": "m3", "title": "Film C", "year": 2005},
        ]
        index = write_partitions(records, self.scratch_dir, max_bytes=1024 * 1024)
        self.assertEqual(index["records"], 4)

        restored = []
        for file_info in index["files"]:
            file_path = self.scratch_dir / file_info["path"]
            with file_path.open("r", encoding="utf-8") as f:
                for line in f:
                    restored.append(json.loads(line))

        self.assertEqual(len(restored), 4)
        self.assertEqual(restored, [records[0], records[1], records[3], records[2]])

    def test_all_period_widths(self):
        # Helper to make record of controlled size
        def make_rec(rec_id, year, pad_size=100):
            return {"id": rec_id, "year": year, "title": "T" + "x" * pad_size}

        # 10-year period: 1960-1969 with small records fitting in 1000 bytes
        r_1960 = make_rec("r60", 1960, 50)  # ~100 bytes

        # 5-year period: 1970-1974 fitting in 500 bytes, but 1970-1979 crowded
        # 1970-1974 has 250 bytes, 1975-1979 has 300 bytes. If max_bytes = 400:
        # 1970-1979 (550 bytes) > 400 -> splits to [1970-1974] (250 <= 400) and [1975-1979] (300 <= 400)
        r_1971 = make_rec("r71", 1971, 150)
        r_1976 = make_rec("r76", 1976, 200)

        # 2-year period and 1-year period:
        # In 1980-1984: crowded (> 400).
        # Subranges: [1980-1981], [1982-1983], [1984].
        # Let [1980-1981] have 150 bytes (fits width 2).
        # Let 1984 have 100 bytes (fits width 1).
        r_1980 = make_rec("r80", 1980, 100)
        r_1984 = make_rec("r84", 1984, 50)

        records = [r_1960, r_1971, r_1976, r_1980, r_1984]
        max_bytes = 400
        index = write_partitions(records, self.scratch_dir, max_bytes=max_bytes)
        stems = [f["path"].split(".")[0] for f in index["files"]]

        # 1960-1969 fits in width 10: "1960-1969.<hash>.jsonl"
        self.assertIn("1960-1969", stems)
        # 1970s split into width 5: "1970-1974.<hash>.jsonl" and "1975-1979.<hash>.jsonl"
        self.assertIn("1970-1974", stems)
        self.assertIn("1975-1979", stems)

        rec_w2_a = make_rec("w2a", 1990, 80)
        rec_w2_b = make_rec("w2b", 1992, 80)
        rec_w2_c = make_rec("w2c", 1994, 80)
        idx_w = write_partitions([rec_w2_a, rec_w2_b, rec_w2_c], self.scratch_dir, max_bytes=200)
        stems_w = [f["path"].split(".")[0] for f in idx_w["files"]]
        self.assertIn("1990-1991", stems_w)
        self.assertIn("1992-1993", stems_w)
        self.assertIn("1994", stems_w)

    def test_unknown_years(self):
        rec_undated1 = {"id": "u1", "title": "Undated 1", "year": None}
        rec_undated2 = {"id": "u2", "title": "Undated 2", "year": None}
        len1 = len((dump(rec_undated1) + "\n").encode("utf-8"))
        len2 = len((dump(rec_undated2) + "\n").encode("utf-8"))

        # Case 1: fits in undated.<hash>.jsonl
        index = write_partitions([rec_undated1, rec_undated2], self.scratch_dir, max_bytes=len1 + len2)
        self.assertEqual(len(index["files"]), 1)
        f0 = index["files"][0]
        self.assertTrue(f0["path"].startswith("undated."))
        self.assertIsNone(f0["start_year"])
        self.assertIsNone(f0["end_year"])
        self.assertEqual(f0["records"], 2)
        self.assertFalse(f0["oversize"])

        # Case 2: crowded undated splits into parts
        index2 = write_partitions([rec_undated1, rec_undated2], self.scratch_dir, max_bytes=max(len1, len2))
        stems2 = [".".join(f["path"].split(".")[:2]) for f in index2["files"]]
        self.assertEqual(stems2, ["undated.part01", "undated.part02"])
        self.assertIsNone(index2["files"][0]["start_year"])
        self.assertIsNone(index2["files"][0]["end_year"])

    def test_crowded_singleton_parts(self):
        rec1 = {"id": "c1", "title": "A", "year": 2023}
        rec2 = {"id": "c2", "title": "B", "year": 2023}
        rec3 = {"id": "c3", "title": "C", "year": 2023}
        len1 = len((dump(rec1) + "\n").encode("utf-8"))
        len2 = len((dump(rec2) + "\n").encode("utf-8"))
        len3 = len((dump(rec3) + "\n").encode("utf-8"))

        # max_bytes allows 1 record per part
        max_bytes = max(len1, len2, len3)
        index = write_partitions([rec1, rec2, rec3], self.scratch_dir, max_bytes=max_bytes)
        stems = [".".join(f["path"].split(".")[:2]) for f in index["files"]]
        self.assertEqual(stems, ["2023.part01", "2023.part02", "2023.part03"])
        for f_info in index["files"]:
            self.assertEqual(f_info["start_year"], 2023)
            self.assertEqual(f_info["end_year"], 2023)
            self.assertEqual(f_info["records"], 1)
            self.assertFalse(f_info["oversize"])

    def test_oversized_individual_record(self):
        # A record that exceeds max_bytes on its own
        small_rec1 = {"id": "s1", "title": "Small 1", "year": 2010}
        oversized_rec = {"id": "big", "title": "Oversized " + ("X" * 1000), "year": 2010}
        small_rec2 = {"id": "s2", "title": "Small 2", "year": 2010}

        len_small1 = len((dump(small_rec1) + "\n").encode("utf-8"))
        len_small2 = len((dump(small_rec2) + "\n").encode("utf-8"))
        max_bytes = len_small1 + len_small2 + 10  # small records fit together, oversized does not

        index = write_partitions([small_rec1, oversized_rec, small_rec2], self.scratch_dir, max_bytes=max_bytes)
        files = index["files"]
        self.assertEqual(len(files), 3)

        # Part 1: small_rec1
        self.assertTrue(files[0]["path"].startswith("2010.part01."))
        self.assertFalse(files[0]["oversize"])
        self.assertEqual(files[0]["records"], 1)

        # Part 2: oversized_rec alone with oversize=True
        self.assertTrue(files[1]["path"].startswith("2010.part02."))
        self.assertTrue(files[1]["oversize"])
        self.assertEqual(files[1]["records"], 1)
        self.assertGreater(files[1]["bytes"], max_bytes)

        # Part 3: small_rec2
        self.assertTrue(files[2]["path"].startswith("2010.part03."))
        self.assertFalse(files[2]["oversize"])
        self.assertEqual(files[2]["records"], 1)

    def test_deterministic_reruns(self):
        records = [
            {"id": "d1", "title": "Movie 1", "year": 2001},
            {"id": "d2", "title": "Movie 2", "year": 2002},
            {"id": "d3", "title": "Movie 3", "year": None},
            {"id": "d4", "title": "Movie 4", "year": 1945},
        ]
        index1 = write_partitions(records, self.scratch_dir, max_bytes=100)
        index1_raw = (self.scratch_dir / "index.json").read_bytes()
        files1_content = {f["path"]: (self.scratch_dir / f["path"]).read_bytes() for f in index1["files"]}

        # Second run with exact same input
        index2 = write_partitions(records, self.scratch_dir, max_bytes=100)
        index2_raw = (self.scratch_dir / "index.json").read_bytes()
        files2_content = {f["path"]: (self.scratch_dir / f["path"]).read_bytes() for f in index2["files"]}

        self.assertEqual(index1, index2)
        self.assertEqual(index1_raw, index2_raw)
        self.assertEqual(files1_content, files2_content)

    def test_safe_stale_cleanup_and_failure_behavior(self):
        # Run 1: 1990-1999 as single file
        rec1 = {"id": "m1", "title": "A", "year": 1990}
        rec2 = {"id": "m2", "title": "B", "year": 1995}
        index1 = write_partitions([rec1, rec2], self.scratch_dir, max_bytes=1000)
        file1 = index1["files"][0]["path"]
        self.assertTrue((self.scratch_dir / file1).is_file())

        # Create an unrelated user file in the directory
        unrelated = self.scratch_dir / "notes.txt"
        unrelated.write_text("do not touch")

        # Run 2: max_bytes=50 so 1990-1999 (74 bytes) splits into 1990-1994 and 1995-1999
        index2 = write_partitions([rec1, rec2], self.scratch_dir, max_bytes=50)
        self.assertFalse((self.scratch_dir / file1).exists())  # stale cleaned
        for f_info in index2["files"]:
            self.assertTrue((self.scratch_dir / f_info["path"]).is_file())
        self.assertTrue(unrelated.is_file())  # unrelated file untouched!
        self.assertEqual(unrelated.read_text(), "do not touch")

        # Failure behavior: simulate failure during record serialization or write
        class BadRecord:
            def get(self, key, default=None):
                if key == "year":
                    return 2020
                return default

            def __iter__(self):
                raise RuntimeError("Simulated failure")

        with self.assertRaises(Exception):
            write_partitions([BadRecord()], self.scratch_dir, max_bytes=50)

        # Previous generation remains intact and valid
        for f_info in index2["files"]:
            self.assertTrue((self.scratch_dir / f_info["path"]).is_file())
        self.assertTrue((self.scratch_dir / "index.json").is_file())
        # No staging files left behind
        stage_files = list(self.scratch_dir.glob(".*stage*"))
        self.assertEqual(stage_files, [])

    def test_empty_records(self):
        index = write_partitions([], self.scratch_dir, max_bytes=1000)
        self.assertEqual(index["records"], 0)
        self.assertEqual(index["files"], [])
        self.assertTrue((self.scratch_dir / "index.json").is_file())
        saved = json.loads((self.scratch_dir / "index.json").read_text(encoding="utf-8"))
        self.assertEqual(saved, index)
        # Ensure no empty .jsonl files were created
        jsonl_files = list(self.scratch_dir.glob("*.jsonl"))
        self.assertEqual(jsonl_files, [])

    def test_fault_injection_at_index_publication(self):
        # Run 1: initial generation
        rec1 = {"id": "m1", "title": "Version 1", "year": 1990}
        index1 = write_partitions([rec1], self.scratch_dir, max_bytes=1000)
        file1_path = self.scratch_dir / index1["files"][0]["path"]
        self.assertTrue(file1_path.is_file())
        file1_bytes = file1_path.read_bytes()
        self.assertEqual(hashlib.sha256(file1_bytes).hexdigest(), index1["files"][0]["sha256"])

        # Run 2: content changes, but stem stays 1990-1999
        rec2 = {"id": "m1", "title": "Version 2 (Modified)", "year": 1990}

        orig_replace = Path.replace

        def failing_replace(self_path, target_path):
            if Path(target_path).name == "index.json":
                raise OSError("Simulated disk error during index.json replacement")
            return orig_replace(self_path, target_path)

        with patch.object(Path, "replace", side_effect=failing_replace, autospec=True):
            with self.assertRaises(OSError):
                write_partitions([rec2], self.scratch_dir, max_bytes=1000)

        # OLD index.json must remain completely intact and valid
        current_index = json.loads((self.scratch_dir / "index.json").read_text(encoding="utf-8"))
        self.assertEqual(current_index, index1)

        # Every file referenced by the OLD index.json must still exist and be valid
        for file_info in current_index["files"]:
            ref_path = self.scratch_dir / file_info["path"]
            self.assertTrue(ref_path.is_file())
            content = ref_path.read_bytes()
            self.assertEqual(len(content), file_info["bytes"])
            self.assertEqual(hashlib.sha256(content).hexdigest(), file_info["sha256"])


if __name__ == "__main__":
    unittest.main()
