#!/usr/bin/env python3
"""07-bench/spend.py: add up what every traced run cost and write 07-bench/SPEND.md.
Source: the `cost_usd` of every `run_end` line in 04-traces/live/ and 04-traces/saved/ (tokens x listed price).
That covers agent runs, benchmark runs and every email-pipeline call. It is an estimate from listed prices, not a bill."""
import collections, json, pathlib, time
ROOT = pathlib.Path(__file__).resolve().parent.parent
seen, by, n, tin, tout = set(), collections.Counter(), collections.Counter(), 0, 0
for p in list((ROOT / '04-traces/live').glob('*.jsonl')) + list((ROOT / '04-traces/saved').glob('*.jsonl')):
    if p.stem in seen or '-replay-' in p.stem:
        continue
    seen.add(p.stem)
    lines = p.read_text().splitlines()
    if not lines:
        continue
    s, e = json.loads(lines[0]), json.loads(lines[-1])
    if e.get('kind') != 'run_end':
        continue
    k = f"{s.get('category')} / {s.get('harness')} / {s.get('model')}"
    by[k] += e.get('cost_usd') or 0; n[k] += 1; tin += e.get('tokens_in') or 0; tout += e.get('tokens_out') or 0
out = ['# API spend', '', f'Generated {time.strftime("%Y-%m-%d %H:%M")} by `python3 07-bench/spend.py` from every traced run on this machine.',
       'Tokens times the listed price in `01-config/models.toml`. An estimate, not a bill. Budget for the night was $10.', '',
       f'**Total: ${sum(by.values()):.2f}** over {sum(n.values())} runs ({tin:,} tokens in, {tout:,} out).', '',
       '| What (category / harness / model) | Runs | USD |', '|---|---|---|']
out += [f'| {k} | {n[k]} | {v:.4f} |' for k, v in by.most_common()]
out += ['', 'Not in this table: a handful of untraced test calls made while building (model speed checks, three Jev test calls, the router eval) and the 60 larger-model calls of 10-decide/escalate.py: about $0.10 in total;',
        'and the Claude helper agents used to build the repo, which run on the Claude Code subscription, not on these API keys.']
(ROOT / '07-bench/SPEND.md').write_text('\n'.join(out) + '\n')
print(out[5])
