import tempfile
import unittest
from pathlib import Path

from dev.movies import catalog, wikidata


def binding(qid, label, year, tmdb=None, article=None):
    row = {"item": {"value": f"http://www.wikidata.org/entity/{qid}"}, "label": {"value": label},
           "date": {"value": f"{year}-01-01T00:00:00Z"}}
    if tmdb:
        row["tmdb"] = {"value": tmdb}
    if article:
        row["article"] = {"value": "https://en.wikipedia.org/wiki/" + article.replace(" ", "_")}
    return row


class TextTests(unittest.TestCase):
    def test_cast_section_handles_glued_and_plain_entries(self):
        parsed = wikidata.parse_extract(
            "Intro sentence.\n\n== Plot ==\nA man returns.\n\n== Cast ==\nMurali MohanasRavi\n"
            "Jayasudha as Jyothi\nKaikala Satya Narayana\n\n== Music ==\nSongs.")
        self.assertEqual(parsed["intro"], "Intro sentence.")
        self.assertEqual(parsed["plot"], "A man returns.")
        self.assertEqual(parsed["cast"][:3], ["Murali Mohan", "Jayasudha", "Kaikala Satya Narayana"])

    def test_snippet_keeps_initials_and_drops_translation_asides(self):
        text = ("Charana Daasi (transl. Wife) is a 1956 film directed by T. Prakash Rao. "
                "It stars N. T. Rama Rao and Savitri, with music by S. Rajeswara Rao and many more words here.")
        self.assertEqual(wikidata.snippet(text, 80),
                         "Charana Daasi is a 1956 film directed by T. Prakash Rao.")
        self.assertLessEqual(len(wikidata.snippet("word " * 200)), wikidata.SUMMARY_CHARS + 1)

    def test_loose_key_tolerates_transliteration(self):
        self.assertEqual(wikidata.loose_key("Sahasam Seyara Dimbhaka"), wikidata.loose_key("Saahasam Seyara Dimbaka"))


class LinkTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = catalog.connect(Path(self.temp.name) / "movies.sqlite")
        for movie_id, title, year in (("tmdb:1", "Eega", 2012), ("src:2", "Missamma", 1955),
                                      ("src:3", "Devadasu", 1953), ("src:4", "Devadasu", 1953)):
            self.db.execute("INSERT INTO movies (id,title,year,language,created_at) VALUES (?,?,?,?,?)",
                            (movie_id, title, year, "te", catalog.now()))
        catalog.link(self.db, "tmdb:1", "tmdb", "1", {})
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def test_native_ids_then_unique_title_year_and_ambiguity_goes_to_review(self):
        items = wikidata.group_items([
            binding("Q1", "Eega", 2012, tmdb="1"), binding("Q2", "Missamma (film)", 1955, article="Missamma (film)"),
            binding("Q3", "Devadasu", 1953), binding("Q4", "Unknown Film", 1960, tmdb="99")])
        receipt = self.db.execute(
            "INSERT INTO responses(request_key,provider,path,params_json,fetched_at,status,body,body_sha256,usable) "
            "VALUES ('sparql','wikidata','/sparql','{}',?,200,'{}','x',1)", (catalog.now(),)).lastrowid
        linked, unlinked, queue = wikidata.link_items(self.db, items, receipt)
        self.assertEqual(linked, 2)
        owners = dict(self.db.execute("SELECT external_id,movie_id FROM identities WHERE provider='wikidata'"))
        self.assertEqual(owners, {"Q1": "tmdb:1", "Q2": "src:2"})
        self.assertEqual(set(unlinked), {"Q4"})
        self.assertEqual([entry["qid"] for entry in queue], ["Q3"])


if __name__ == "__main__":
    unittest.main()
