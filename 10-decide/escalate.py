#!/usr/bin/env python3
"""Decision-model use case 3: confidence as an escalation gate.

The decision model answers every email in about 200 ms and says how sure it is. Keep the confident answers,
send only the unsure ones to a larger, slower, dearer model. Measured on the 60 held-out gold emails, using the
answers already recorded in 06-email/04-rounds/round-3/results-heldout.jsonl (no Jev calls are repeated).

  escalate.py [--model terra-61] [--thresholds 0.5,0.7,0.9]

Without the gate: (a) Jev alone on everything, (b) the large model on everything.
With the gate:    Jev alone, and the large model only where Jev's confidence is below the threshold.
"""
import argparse, concurrent.futures as cf, json, pathlib, sys, time

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / '06-email/03-pipeline'))
import pipeline as P  # noqa: E402
from langchain_openai import ChatOpenAI  # noqa: E402

a = argparse.ArgumentParser()
a.add_argument('--model', default='terra-61')
a.add_argument('--thresholds', default='0.5,0.7,0.9')
a = a.parse_args()
schema = P.load_schema('v3')
gold = P.gold()
rows = [json.loads(l) for l in (ROOT / '06-email/04-rounds/round-3/results-heldout.jsonl').read_text().splitlines()]
jev = {r['email_id']: r for r in rows if r['mode'] == 'jev'}
emails = {e['id']: e for e in P.rows(ids=sorted(jev))}

base, key, mid, o = P.R.resolve(a.model)
big = ChatOpenAI(model=mid, base_url=base, api_key=key, temperature=0, max_tokens=2000, timeout=90, max_retries=6).with_structured_output(
    schema.Direct, method='function_calling', include_raw=True)


def ask_big(eid):
    t = time.time()
    try:
        r = big.invoke([('system', schema.DIRECT_PROMPT), ('user', P.email_text(P.email_view(emails[eid])))])
        u = r['raw'].usage_metadata or {}
        return eid, {'triage': r['parsed'].triage if r['parsed'] else None, 'ms': round((time.time() - t) * 1000),
                     'cost_usd': P.R.cost(a.model, u.get('input_tokens', 0), u.get('output_tokens', 0))}
    except Exception as e:
        return eid, {'triage': None, 'ms': round((time.time() - t) * 1000), 'cost_usd': 0, 'error': str(e)[:120]}


with cf.ThreadPoolExecutor(4) as ex:   # ask the large model about all 60 once; every policy below reuses these answers
    bigans = dict(ex.map(ask_big, sorted(jev)))
(HERE / 'escalate_answers.jsonl').write_text('\n'.join(json.dumps({'email_id': i, 'model': a.model, **v}) for i, v in bigans.items()) + '\n')

n = len(jev)
acc = lambda f: sum(f(i) == gold[i]['triage'] for i in jev) / n
med = lambda xs: sorted(xs)[len(xs) // 2]
out = [f'| Policy | Sent to {a.model} | Triage accuracy | Median latency | Cost per 1,000 emails |', '|---|---|---|---|---|']
jc = sum(r['cost_usd'] for r in jev.values()) / n
bc = sum(v['cost_usd'] for v in bigans.values()) / n
out.append(f"| Jev alone (no gate) | 0 of {n} | {acc(lambda i: jev[i]['triage']):.0%} | {med([r['ms'] for r in jev.values()])} ms | ${jc * 1000:.2f} |")
for th in map(float, a.thresholds.split(',')):
    esc = {i for i, r in jev.items() if (r['confidence'] or 0) < th}
    lat = [jev[i]['ms'] + (bigans[i]['ms'] if i in esc else 0) for i in jev]
    c = jc + sum(bigans[i]['cost_usd'] for i in esc) / n
    out.append(f"| Jev, escalate when confidence < {th} | {len(esc)} of {n} | {acc(lambda i: bigans[i]['triage'] if i in esc else jev[i]['triage']):.0%} | {med(lat)} ms | ${c * 1000:.2f} |")
out.append(f"| {a.model} on everything (no gate) | {n} of {n} | {acc(lambda i: bigans[i]['triage']):.0%} | {med([v['ms'] for v in bigans.values()])} ms | ${bc * 1000:.2f} |")
errs = sum(1 for v in bigans.values() if v.get('error') or v['triage'] is None)
out += ['', f'{errs} of {n} calls to {a.model} failed or returned no label (counted as wrong where used).']
(HERE / 'escalate_eval.md').write_text('\n'.join(out) + '\n')
print('\n'.join(out))
