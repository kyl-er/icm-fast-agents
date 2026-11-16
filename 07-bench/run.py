#!/usr/bin/env python3
"""07-bench/run.py: run the task set across models and harnesses; every run appends one row to results.jsonl.

  run.py                       the default matrix (below)
  run.py --models mercury-3 --harness rig --tasks files-1,files-2 --repeat 3
  run.py --dry                 print the matrix and stop

This is our own runner (about 60 lines), not promptfoo: each run is `bin/agent ... --record`, so the benchmark
exercises exactly what the demo runs, and each row links to its trace by run id.
"""
import argparse, concurrent.futures as cf, json, pathlib, subprocess, sys, time, tomllib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TASKS = [t['id'] for t in tomllib.loads((ROOT / '02-agent/tasks/tasks.toml').read_text())['task']]
# (model alias, provider or None, harnesses)
# Groq's free tier answers most agent runs with HTTP 429 (tokens per minute), so gpt-oss goes through Cerebras / OpenRouter.
MATRIX = [
    ('gpt-oss-120b', 'cerebras', ['rig', 'langchain']),
    ('gpt-oss-20b', 'openrouter', ['rig']),
    ('celeris-1', None, ['rig']),
    ('muse-ember', None, ['rig']),
    ('glm-53-flash', None, ['rig']),
    ('mercury-3', None, ['rig', 'langchain']),
]
a = argparse.ArgumentParser()
a.add_argument('--models'); a.add_argument('--via'); a.add_argument('--harness'); a.add_argument('--tasks')
a.add_argument('--repeat', type=int, default=1); a.add_argument('--workers', type=int, default=2); a.add_argument('--dry', action='store_true')
a = a.parse_args()
matrix = [(m, a.via, a.harness.split(',') if a.harness else ['rig']) for m in a.models.split(',')] if a.models else MATRIX
if a.harness and not a.models:
    matrix = [(m, v, [h for h in hs if h in a.harness.split(',')]) for m, v, hs in matrix]
tasks = a.tasks.split(',') if a.tasks else TASKS
jobs = [(m, v, h, t) for m, v, hs in matrix for h in hs for t in tasks for _ in range(a.repeat)]
print(f'{len(jobs)} runs', file=sys.stderr)
if a.dry:
    for j in jobs: print(*j)
    sys.exit(0)


def one(j):
    m, v, h, t = j
    cmd = [str(ROOT / 'bin/agent'), '--harness', h, '--task', t, '--model', m, '--quiet'] + (['--via', v] if v else [])
    sys.path.insert(0, str(ROOT / '03-harness')); import common
    try:
        for attempt in range(4):
            p = subprocess.run(cmd, capture_output=True, text=True, timeout=240)
            row = json.loads(p.stderr.strip().splitlines()[-1])
            if '429' not in str(row.get('error')):
                break
            time.sleep(20 * (attempt + 1))   # a rate limit says nothing about the model or the harness: wait and run it again
        row['rate_limit_retries'] = attempt
        common.record(row)
    except Exception as e:  # a crash or a hang is still a row
        row = {'harness': h, 'model': m, 'provider': v, 'task': t, 'category': t.split('-')[0], 'success': False, 'latency_ms': None,
               'steps': 0, 'tool_calls': 0, 'tokens_in': 0, 'tokens_out': 0, 'cost_usd': 0, 'error': f'runner: {type(e).__name__}: {str(e)[:120]}'}
        common.record(row)
    print(f"{h:<9} {m:<14} {t:<9} {'ok ' if row.get('success') else 'FAIL'} {row.get('latency_ms')} ms {row.get('error') or ''}"[:160], flush=True)


with cf.ThreadPoolExecutor(a.workers) as ex:
    list(ex.map(one, jobs))
