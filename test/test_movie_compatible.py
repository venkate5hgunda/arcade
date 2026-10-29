import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch

from dev.movies import catalog, compatible_annotation as compatible, llm_annotation as llm
from test_movie_llm_annotation import proposal


class CompatibleAnnotationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = catalog.connect(Path(self.temp.name) / 'movies.sqlite')
        compatible.initialize(self.db)
        self.db.execute('INSERT INTO movies VALUES (?,?,?,?,?)',
                        ('tmdb:42', 'A Test Movie', 2012, 'te', catalog.now()))
        payload = {'id': 42, 'title': 'A Test Movie', 'original_title': 'A Test Movie',
                   'original_language': 'te', 'release_date': '2012-01-01', 'adult': False,
                   'vote_count': 25, 'credits': {'cast': [], 'crew': []}}
        body = catalog.dump(payload)
        receipt = self.db.execute(
            'INSERT INTO responses(request_key,provider,path,params_json,fetched_at,status,body,body_sha256,usable) VALUES (?,?,?,?,?,?,?,?,?)',
            ('fixture', 'tmdb', '/movie/42', '{}', catalog.now(), 200, body, catalog.digest(body), 1)).lastrowid
        self.db.execute('INSERT INTO identities VALUES (?,?,?,?,?)', ('tmdb', '42', 'tmdb:42', '{}', catalog.now()))
        catalog.record_match(self.db, 'tmdb:42', 'tmdb', receipt, 'hydrated', 'Synthetic evidence.')
        self.db.commit()
        self.config = compatible.Settings('http://127.0.0.1:31415/v1', 'test-secret', max_attempts=2, retry_delay=0, max_rounds=2, parallelism=1)
        self.requests = []
        self.modify = lambda request, output: output

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def response(self, config, body):
        request = json.loads(body['messages'][1]['content'])
        self.requests.append(body)
        self.assertEqual(body['response_format']['type'], 'json_schema')
        self.assertTrue(body['response_format']['json_schema']['strict'])
        if request['stage'] == 'select_review':
            item = request['candidates'][0]
            output = {'selected_candidate': item['index'], 'reason': 'Fixture comparison, not film evidence.', 'confidence':8,
                      'review': {'job_key': request['job_key'], 'proposal_sha256': item['proposal_sha256'],
                                 'decision': 'approve', 'reason': 'Fixture critical review.', 'issues': []}}
        else:
            self.assertNotIn('candidates', request)
            output = proposal(request)
        output = self.modify(request, output)
        return json.dumps({'model': 'fixture-actual-model', 'usage': {'total_tokens': 7}, 'choices': [
            {'index': 0, 'finish_reason': 'stop', 'message': {'role': 'assistant', 'content': json.dumps(output)}}]})

    def run_pipeline(self, **kwargs):
        with patch.object(compatible, 'http_completion', side_effect=self.response):
            return compatible.annotate_existing(self.db, config=self.config, **kwargs)

    def count(self, table):
        return self.db.execute('SELECT count(*) FROM ' + table).fetchone()[0]

    def test_three_independent_candidates_one_judge_and_real_promotion_pipeline(self):
        result = self.run_pipeline()
        self.assertEqual((result['reviewed'], result['promoted']), (1, 1))
        self.assertEqual(len(self.requests), 4)
        self.assertEqual(self.count('llm_compatible_calls'), 4)
        self.assertEqual(self.count('llm_calls'), 2)
        self.assertEqual(self.count('llm_promotions'), 1)
        catalog.annotate(self.db, [])
        review = llm.promoted_reviews(self.db)['tmdb:42']
        self.assertFalse(review['automation']['human_verified'])
        self.assertEqual(review['automation']['annotation_model']['model'], 'fixture-actual-model')
        self.assertEqual(self.run_pipeline()['promoted'], 0)
        self.assertEqual(len(self.requests), 4)
        rows = self.db.execute('SELECT request_json,response_text FROM llm_compatible_calls').fetchall()
        self.assertNotIn(self.config.api_key, json.dumps([list(row) for row in rows]))
        self.assertNotIn(self.config.api_key, self.config.profile())
        catalog.export(self.db, Path(self.temp.name) / 'export')
        self.assertTrue((Path(self.temp.name) / 'export/llm_compatible_calls.jsonl').is_file())

    def test_candidate_retries_collect_three_valid_independent_outputs_before_judging(self):
        def alter(request, output):
            if request.get('candidate_number') == 1 and request['attempt_number'] == 1:
                output['actability']['value'] = True
            return output
        self.modify = alter
        result = self.run_pipeline(promote=False)
        self.assertEqual(result['reviewed'], 1)
        judge = json.loads(self.requests[-1]['messages'][1]['content'])
        self.assertEqual([item['index'] for item in judge['candidates']], [0, 1, 2])
        self.assertEqual(self.count('llm_compatible_calls'), 5)
        self.assertEqual(self.count('llm_promotions'), 0)

    def test_exhausted_candidate_retries_never_reach_judge_or_activation(self):
        def alter(request, output):
            if request.get('candidate_number') in (1, 2):
                output['movie_id'] = 'forged-identity'
            return output
        self.modify = alter
        result = self.run_pipeline()
        self.assertTrue(result['singleton_failures'])
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(self.count('llm_calls'), 0)
        self.assertEqual(self.count('llm_promotions'), 0)
        self.assertEqual(self.run_pipeline()['promoted'], 0)
        self.assertEqual(len(self.requests), 2)

    def test_forged_judge_hash_extra_fields_or_ineligible_index_fail_closed(self):
        for variant in ('hash', 'extra', 'index', 'issues'):
            with self.subTest(variant=variant):
                self.db.execute('DELETE FROM llm_compatible_calls')
                self.db.execute('DELETE FROM llm_jobs')
                self.db.commit()
                def alter(request, output):
                    if request['stage'] == 'select_review':
                        if variant == 'hash': output['review']['proposal_sha256'] = 'forged'
                        if variant == 'extra': output['review']['extra'] = 'not allowed'
                        if variant == 'index': output['selected_candidate'] = 99
                        if variant == 'issues': output['review']['issues'] = ['Still unsafe']
                    return output
                self.modify = alter
                result = self.run_pipeline()
                self.assertTrue(result['singleton_failures'])
                self.assertEqual(self.count('llm_calls'), 0)
                self.assertEqual(self.count('llm_promotions'), 0)

    def test_budget_and_accounted_transport_retries_preserve_all_attempts(self):
        result = self.run_pipeline(daily_calls=3)
        self.assertTrue(result['provider_error'])
        self.assertEqual(len(self.requests), 0)
        original = self.response
        def unavailable(config, body):
            if len(self.requests) == 0:
                self.requests.append(body)
                raise compatible.TransportFailure('Unknown outcome.')
            return original(config, body)
        with patch.object(compatible, 'http_completion', side_effect=unavailable):
            result = compatible.annotate_existing(self.db, config=self.config, promote=False)
        self.assertEqual(result['reviewed'], 1)
        self.assertEqual(len(self.requests), 5)
        # The timeout and its authorized retry each have an immutable intent/receipt.
        attempts = self.db.execute('SELECT attempt,error FROM llm_compatible_calls ORDER BY id').fetchall()
        self.assertEqual([row['attempt'] for row in attempts], ['round:1:candidate:0:attempt:1','round:1:candidate:0:attempt:2','round:1:candidate:1:attempt:1','round:1:candidate:2:attempt:1','round:1:judge:attempt:1'])
        self.assertIn('TransportFailure', attempts[0]['error'])

    def test_strict_json_rejects_duplicate_keys_nonfinite_trailing_and_fenced_payloads(self):
        for raw in ('{"a":1,"a":2}', '{"a":NaN}', '{"a":Infinity}', '{"a":1e999}', '{} extra', '```json\n{}\n```'):
            with self.assertRaises(compatible.SchemaFailure): compatible.strict_json(raw)

    def test_truncated_refused_and_tool_responses_are_not_candidates(self):
        original = self.response
        for variant in ('length', 'refusal', 'tools'):
            with self.subTest(variant=variant):
                self.db.execute('DELETE FROM llm_compatible_calls')
                self.db.execute('DELETE FROM llm_jobs')
                self.db.commit()
                def malformed(config, body):
                    response = json.loads(original(config, body))
                    choice = response['choices'][0]
                    if variant == 'length': choice['finish_reason'] = 'length'
                    if variant == 'refusal': choice['message']['refusal'] = 'Declined'
                    if variant == 'tools': choice['message']['tool_calls'] = [{'id':'untrusted'}]
                    return json.dumps(response)
                with patch.object(compatible,'http_completion',side_effect=malformed):
                    result = compatible.annotate_existing(self.db, config=self.config)
                self.assertTrue(result['singleton_failures'])
                self.assertEqual(self.count('llm_calls'), 0)

    def test_real_loopback_http_preserves_intents_validates_and_redacts_echoed_credentials(self):
        owner = self
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                owner.assertEqual(self.path, '/v1/chat/completions')
                owner.assertEqual(self.headers['Authorization'], 'Bearer ' + owner.config.api_key)
                body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                native = json.loads(owner.response(owner.config, body))
                native['untrusted_debug'] = owner.config.api_key
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(native).encode())
            def log_message(self,*args): pass
        server = HTTPServer(('127.0.0.1',0),Handler)
        thread = threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        try:
            from dataclasses import replace
            config = replace(self.config,base_url=f'http://127.0.0.1:{server.server_port}/v1')
            result = compatible.annotate_existing(self.db,config=config,promote=False)
            self.assertEqual(result['reviewed'],1)
            raw = '\n'.join(row[0] for row in self.db.execute('SELECT response_text FROM llm_compatible_calls'))
            self.assertNotIn(config.api_key,raw)
            self.assertIn('[redacted]',raw)
        finally:
            server.shutdown(); server.server_close(); thread.join()

    def test_declining_judge_prevents_promotion(self):
        def decline(request, output):
            return {'selected_candidate':None,'reason':'All unsafe.','confidence':8,'review':None} if request['stage']=='select_review' else output
        self.modify = decline
        result = self.run_pipeline()
        self.assertEqual(result['rejected'],1)
        self.assertEqual(self.count('llm_promotions'),0)
        self.assertEqual(len(self.requests),8)

    def test_known_supplementary_fact_paths_are_accepted_but_invented_paths_are_rejected(self):
        job = llm.prepare(self.db,[],1,'fixture')[0]
        context = json.loads(job['input_json'])
        context['wikipedia'] = {'extract':'Test supplied evidence'}
        job = dict(job,input_json=catalog.dump(context))
        request = llm.request_for(job,'annotate')
        output = proposal(request)
        output['recognition']['evidence'] = ['wikipedia.extract']
        llm.validate_output(request,output)
        output['recognition']['evidence'] = ['wikipedia.invented']
        with self.assertRaisesRegex(ValueError,'nonexistent evidence'): llm.validate_output(request,output)


    def test_configuration_keeps_secrets_out_of_identity_and_rejects_insecure_urls(self):
        import os
        self.assertNotIn(self.config.api_key, repr(self.config))
        with patch.object(catalog, 'load_env'), patch.dict(os.environ, {
                'MOVIE_LLM_API_KEY':'test-secret', 'MOVIE_LLM_BASE_URL':'http://127.0.0.1:31415/v1'}, clear=True):
            self.assertEqual(compatible.Settings.environment().model, 'auto')
            for base in ('http://example.org/v1', 'https://user:secret@example.org/v1', 'https://example.org/v1?key=secret'):
                os.environ['MOVIE_LLM_BASE_URL'] = base
                with self.assertRaises(ValueError): compatible.Settings.environment()

    def test_claim_and_budget_are_atomic_and_current_source_is_rechecked_before_activation(self):
        job = llm.prepare(self.db,[],1,'fixture')[0]
        compatible.reserve_job(self.db,job,100)
        with self.assertRaises(compatible.ProviderFailure): compatible.reserve_job(self.db,job,100)
        self.assertEqual(self.db.execute('SELECT reserved_calls FROM llm_daily_budget').fetchone()[0],4)
        self.db.execute("UPDATE llm_jobs SET status='prepared'")
        self.db.commit()
        with patch.object(compatible,'http_completion',side_effect=self.response):
            compatible.run_job(self.db,job,self.config,100)
        self.db.execute("UPDATE movies SET title='Different title'")
        self.db.commit()
        with self.assertRaisesRegex(ValueError,'changed'): llm.promote(self.db,[job['job_key']])
        self.assertEqual(self.count('llm_promotions'),0)


    def test_judge_retries_until_its_exact_hash_bound_contract_succeeds(self):
        def alter(request, output):
            if request['stage'] == 'select_review' and request['attempt_number'] == 1:
                output['review']['proposal_sha256'] = 'forged'
            return output
        self.modify = alter
        result = self.run_pipeline(promote=False)
        self.assertEqual(result['reviewed'],1)
        self.assertEqual(len(self.requests),5)
        judges = self.db.execute("SELECT error FROM llm_compatible_calls WHERE attempt LIKE '%:judge:%' ORDER BY id").fetchall()
        self.assertEqual(len(judges),2)
        self.assertIsNotNone(judges[0]['error'])
        self.assertIsNone(judges[1]['error'])
        self.assertEqual(self.count('llm_calls'),2)

    def test_retry_budget_caps_calls_before_an_additional_attempt(self):
        def malformed(request, output):
            output['movie_id'] = 'forged'
            return output
        self.modify = malformed
        result = self.run_pipeline(daily_calls=4)
        self.assertTrue(result['provider_error'])
        self.assertEqual(len(self.requests),1)
        self.assertEqual(self.count('llm_calls'),0)


    def test_low_confidence_and_rejected_judgments_regenerate_all_three_candidates(self):
        for variant in ('confidence', 'rejection'):
            with self.subTest(variant=variant):
                self.db.execute('DELETE FROM llm_calls')
                self.db.execute('DELETE FROM llm_compatible_calls')
                self.db.execute('DELETE FROM llm_jobs')
                self.db.commit()
                self.requests.clear()
                def alter(request, output):
                    if request['stage']=='select_review':
                        output['confidence']=5
                        if request['quality_round']==1:
                            if variant=='confidence': output['confidence']=4.99
                            else:
                                output['review']['decision']='revise'
                                output['review']['issues']=['Fixture issue; regenerate candidates.']
                    return output
                self.modify=alter
                result=self.run_pipeline(promote=False)
                self.assertEqual(result['reviewed'],1)
                self.assertEqual(len(self.requests),8)
                rounds=[json.loads(body['messages'][1]['content'])['quality_round'] for body in self.requests]
                self.assertEqual(rounds,[1,1,1,1,2,2,2,2])
                job=self.db.execute('SELECT * FROM llm_jobs').fetchone()
                llm.promote(self.db,[job['job_key']])
                self.assertEqual(llm.promoted_reviews(self.db)['tmdb:42']['automation']['selection_confidence'],5)
                # Reset promotion before the next isolated scenario.
                self.db.execute('DELETE FROM llm_promotions')
                self.db.commit()

    def test_exhausted_low_confidence_rounds_never_publish_or_leave_canonical_approvals(self):
        def low(request, output):
            if request['stage']=='select_review': output['confidence']=4.9
            return output
        self.modify=low
        result=self.run_pipeline()
        self.assertEqual(result['rejected'],1)
        self.assertEqual(len(self.requests),8)
        self.assertEqual(self.count('llm_calls'),0)
        self.assertEqual(self.count('llm_promotions'),0)

    def test_promotion_rechecks_confidence_and_candidate_receipts(self):
        self.run_pipeline(promote=False)
        job=self.db.execute('SELECT * FROM llm_jobs').fetchone()
        review=llm.latest_call(self.db,job['job_key'],'review')
        envelope=json.loads(review['response_text'])
        source=envelope['source_call_id']
        judgment=json.loads(self.db.execute('SELECT output_json FROM llm_compatible_calls WHERE id=?',(source,)).fetchone()[0])
        judgment['confidence']=4.9
        self.db.execute('UPDATE llm_compatible_calls SET output_json=? WHERE id=?',(catalog.dump(judgment),source))
        self.db.commit()
        with self.assertRaisesRegex(ValueError,'confidence'):llm.promote(self.db,[job['job_key']])
        self.assertEqual(self.count('llm_promotions'),0)

    def test_parallel_candidates_use_separate_connections_and_overlap_before_judging(self):
        from dataclasses import replace
        original=self.response
        barrier=threading.Barrier(3)
        active=0
        peak=0
        lock=threading.Lock()
        def parallel(config,body):
            nonlocal active,peak
            request=json.loads(body['messages'][1]['content'])
            if request['stage']=='annotate':
                with lock:
                    active+=1
                    peak=max(peak,active)
                barrier.wait(timeout=3)
                result=original(config,body)
                with lock: active-=1
                return result
            with lock:self.assertEqual(active,0)
            return original(config,body)
        with patch.object(compatible,'http_completion',side_effect=parallel):
            result=compatible.annotate_existing(self.db,config=replace(self.config,parallelism=3),promote=False)
        self.assertEqual(result['reviewed'],1)
        self.assertEqual(peak,3)
        self.assertEqual(self.count('llm_compatible_calls'),4)


    def test_cached_annotation_reads_and_standalone_public_exports_recheck_confidence(self):
        from dev.movies import game_export
        self.run_pipeline()
        catalog.annotate(self.db,[])
        self.assertEqual(len(game_export.approved_movies(self.db)),1)
        job=self.db.execute('SELECT * FROM llm_jobs').fetchone()
        envelope=json.loads(llm.latest_call(self.db,job['job_key'],'review')['response_text'])
        source=envelope['source_call_id']
        judgment=json.loads(self.db.execute('SELECT output_json FROM llm_compatible_calls WHERE id=?',(source,)).fetchone()[0])
        judgment['confidence']=4.9
        self.db.execute('UPDATE llm_compatible_calls SET output_json=? WHERE id=?',(catalog.dump(judgment),source))
        self.db.commit()
        with self.assertRaisesRegex(ValueError,'confidence'):llm.promoted_reviews(self.db)
        destination=Path(self.temp.name)/'unacceptable-public'
        with self.assertRaisesRegex(ValueError,'confidence'):game_export.publish(self.db,destination)
        self.assertFalse(destination.exists())


    def test_missing_or_empty_catalog_cannot_report_success_or_overwrite_public_assets(self):
        import subprocess,sys
        missing=Path(self.temp.name)/'missing.sqlite'
        output=Path(self.temp.name)/'never-exported'
        result=subprocess.run([sys.executable,'-m','dev.movies.compatible_annotation','--db',str(missing),'--export',str(output),'--limit','1'],capture_output=True,text=True)
        self.assertEqual(result.returncode,2)
        self.assertIn('catalog',result.stderr)
        self.assertFalse(missing.exists())
        self.assertFalse(output.exists())
        empty=catalog.connect(Path(self.temp.name)/'empty.sqlite')
        try:
            with self.assertRaisesRegex(ValueError,'empty'):
                compatible.annotate_existing(empty,config=self.config)
            self.assertEqual(len(self.requests),0)
        finally:empty.close()


if __name__ == '__main__':
    unittest.main()
