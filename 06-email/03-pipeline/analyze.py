#!/usr/bin/env python3
"""analyze.py --round N [--tag heldout]: turn one round's results into metrics and a disagreement list.

Writes 04-rounds/round-N/metrics[-tag].json and disagreements[-tag].md, prints the table.
Disagreement between routes needs no labels: it is the flywheel's signal for where to look.
Accuracy uses 05-gold/gold.jsonl when it has labels for the emails in the round.
"""
import argparse, collections, json, pathlib, statistics

HERE = pathlib.Path(__file__).resolve().parent
a = argparse.ArgumentParser()
a.add_argument('--round', type=int, required=True)
a.add_argument('--tag', default='')
a = a.parse_args()
D = HERE.parent / '04-rounds' / f'round-{a.round}'
sfx = '-' + a.tag if a.tag else ''
rows = [json.loads(l) for l in (D / f'results{sfx}.jsonl').read_text().splitlines()]
gp = HERE.parent / '05-gold/gold.jsonl'
gold = {g['email_id']: g for g in map(json.loads, gp.read_text().splitlines())} if gp.exists() else {}
modes = list(dict.fromkeys(r['mode'] for r in rows))
by = collections.defaultdict(dict)
for r in rows:
    by[r['email_id']][r['mode']] = r

M = {'round': a.round, 'tag': a.tag, 'schema': rows[0]['schema'], 'emails': len(by), 'modes': {}}
for m in modes:
    rs = [r for r in rows if r['mode'] == m]
    ok = [r for r in rs if not r['error']]
    g = [r for r in ok if r['email_id'] in gold]
    hit = [r for r in g if r['triage'] == gold[r['email_id']]['triage']]
    lenient = [r for r in g if r['triage'] in (gold[r['email_id']]['triage'], gold[r['email_id']].get('alt'))]
    rep = [r for r in g if bool(r['needs_reply']) == gold[r['email_id']]['needs_reply']]
    gn = len([r for r in rs if r['email_id'] in gold])  # errors count as wrong
    M['modes'][m] = {
        'runs': len(rs), 'errors': len(rs) - len(ok),
        'labels': dict(collections.Counter(r['triage'] for r in ok).most_common()),
        'median_ms': round(statistics.median(r['ms'] for r in ok)) if ok else None,
        'p90_ms': round(sorted(r['ms'] for r in ok)[int(len(ok) * .9)]) if ok else None,
        'cost_per_email_usd': round(sum(r['cost_usd'] for r in rs) / len(rs), 6),
        'cost_total_usd': round(sum(r['cost_usd'] for r in rs), 4),
        'gold_n': gn,
        'triage_acc': round(len(hit) / gn, 3) if gn else None,
        'triage_acc_answered': round(len(hit) / len(g), 3) if g else None,   # failures left out instead of counted wrong
        'gold_misses_marked_hard': sum(bool(gold[r['email_id']].get('hard')) for r in g if r not in hit),
        'gold_misses': len(g) - len(hit),
        'triage_acc_lenient': round(len(lenient) / gn, 3) if gn else None,
        'needs_reply_acc': round(len(rep) / gn, 3) if gn else None,
    }
    conf = [r for r in g if r.get('confidence') is not None]
    if conf:  # does confidence separate right from wrong? accuracy on the confident half vs the rest
        cut = statistics.median(r['confidence'] for r in conf)
        hi = [r for r in conf if r['confidence'] >= cut]
        lo = [r for r in conf if r['confidence'] < cut]
        acc = lambda x: round(sum(r['triage'] == gold[r['email_id']]['triage'] for r in x) / len(x), 3) if x else None
        M['modes'][m].update({'conf_median': round(cut, 2), 'acc_conf_high': acc(hi), 'acc_conf_low': acc(lo)})
agree = {}
for i, x in enumerate(modes):
    for y in modes[i + 1:]:
        both = [e for e in by.values() if x in e and y in e and not e[x]['error'] and not e[y]['error']]
        agree[f'{x} vs {y}'] = round(sum(e[x]['triage'] == e[y]['triage'] for e in both) / len(both), 3) if both else None
M['agreement'] = agree
M['all_agree'] = round(sum(len({e[m]['triage'] for m in e}) == 1 for e in by.values()) / len(by), 3)
(D / f'metrics{sfx}.json').write_text(json.dumps(M, indent=1))

out = [f'# Round {a.round}{" (" + a.tag + ")" if a.tag else ""}: where the routes disagree', '',
       f'Schema {M["schema"]}. {len(by)} emails. All routes agree on {M["all_agree"]:.0%}.', '',
       '| id | subject | ' + ' | '.join(modes) + ' | jev conf (facts / raw) | gold |', '|---|---|' + '---|' * (len(modes) + 2)]
conf_pairs = collections.Counter()
for eid, e in sorted(by.items()):
    labs = [e.get(m, {}).get('triage') or 'ERROR' for m in modes]
    if len(set(labs)) > 1:
        conf_pairs[' / '.join(sorted(set(labs)))] += 1
        c = f"{e.get('extract+jev', {}).get('confidence')} / {e.get('jev', {}).get('confidence')}"
        g = gold.get(eid, {}).get('triage', '') if not a.tag else '(held out)'
        out.append(f"| {eid} | {(e[modes[0]]['subject'] or '')[:50].replace('|', '/')} | " + ' | '.join(labs) + f' | {c} | {g} |')
out += ['', '## Which labels get confused', ''] + [f'- {k}: {v}' for k, v in conf_pairs.most_common()]
errs = [r for r in rows if r['error']]
out += ['', '## Failures', ''] + ([f"- {r['mode']} #{r['email_id']}: {r['error'][:160]}" for r in errs] or ['none'])
(D / f'disagreements{sfx}.md').write_text('\n'.join(out) + '\n')

print(f"round {a.round} {a.tag} · schema {M['schema']} · {len(by)} emails · all agree {M['all_agree']:.0%}")
print(f"{'route':<13} {'runs':>4} {'err':>3} {'med ms':>6} {'p90 ms':>6} {'$/email':>9} {'gold n':>6} {'triage':>6} {'answrd':>6} {'lenient':>7} {'reply':>6}  labels")
for m, x in M['modes'].items():
    f = lambda v: '   -' if v is None else f'{v:.0%}'
    print(f"{m:<13} {x['runs']:>4} {x['errors']:>3} {x['median_ms']:>6} {x['p90_ms']:>6} {x['cost_per_email_usd']:>9.6f} {x['gold_n']:>6} {f(x['triage_acc']):>6} {f(x['triage_acc_answered']):>6} {f(x['triage_acc_lenient']):>7} {f(x['needs_reply_acc']):>6}  {x['labels']}")
print('agreement:', agree)
