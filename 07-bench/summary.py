#!/usr/bin/env python3
"""07-bench/summary.py: print the summary table from results.jsonl.
  summary.py            one line per harness x model, agent rows       summary.py --md   as a markdown table
  summary.py --by task  one line per harness x model x task category   summary.py --spend   total recorded spend"""
import collections, json, pathlib, statistics, sys

rows = [json.loads(l) for l in (pathlib.Path(__file__).resolve().parent / 'results.jsonl').read_text().splitlines() if l.strip()]
if '--spend' in sys.argv:
    by = collections.Counter()
    for r in rows: by[r.get('harness')] += r.get('cost_usd') or 0
    for k, v in by.items(): print(f'{k:<12} ${v:.4f}')
    print(f"{'total':<12} ${sum(by.values()):.4f}  ({len(rows)} rows)")
    sys.exit(0)
md = '--md' in sys.argv
by_task = '--by' in sys.argv
key = (lambda r: (r['harness'], r['model'], r.get('category') or '')) if by_task else (lambda r: (r['harness'], r['model'], 'all'))
g = collections.defaultdict(list)
for r in rows: g[key(r)].append(r)
head = ['harness', 'model', 'tasks', 'runs', 'success', 'median s', 'p90 s', 'steps', 'tok in', 'tok out', '$/run', '$ total']
out = []
for (h, m, c), rs in sorted(g.items(), key=lambda kv: (kv[0][2], -sum(bool(r.get('success')) for r in kv[1]) / len(kv[1]), statistics.median([r['latency_ms'] or 9e9 for r in kv[1]]))):
    lat = sorted(r['latency_ms'] for r in rs if r.get('latency_ms'))
    ok = sum(bool(r.get('success')) for r in rs)
    out.append([h, m, c, len(rs), f'{ok}/{len(rs)} ({ok / len(rs):.0%})', f'{statistics.median(lat) / 1000:.1f}' if lat else '-', f'{lat[int(len(lat) * .9)] / 1000:.1f}' if lat else '-',
                f"{statistics.mean(r.get('steps') or 0 for r in rs):.1f}", round(statistics.mean(r.get('tokens_in') or 0 for r in rs)), round(statistics.mean(r.get('tokens_out') or 0 for r in rs)),
                f"{statistics.mean(r.get('cost_usd') or 0 for r in rs):.5f}", f"{sum(r.get('cost_usd') or 0 for r in rs):.4f}"])
if md:
    print('| ' + ' | '.join(head) + ' |'); print('|' + '---|' * len(head))
    for r in out: print('| ' + ' | '.join(map(str, r)) + ' |')
else:
    w = [max(len(str(x)) for x in col) for col in zip(head, *out)]
    for r in [head] + out: print('  '.join(str(x).ljust(n) for x, n in zip(r, w)))
