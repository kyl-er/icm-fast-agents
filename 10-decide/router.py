#!/usr/bin/env python3
"""Decision-model use case 2: route a request to a CLI card.

"Which command should handle this request?" asked three ways over the same 40 labelled requests:
  jev            one typed choice over the cards (criteria = each card's use-when line)      ~200 ms
  llm:<alias>    a fast chat model asked to answer with one card name
and then the effect inside the agent:
  router.py eval                       accuracy / latency / cost of each decider
  router.py agent [--tasks ...]        the 9 example tasks, LangChain harness, with and without Jev pre-routing
                                       (with: Jev picks the card first and the card text is put in the prompt,
                                        so the agent does not spend a model turn reading it)
Rows from `agent` go to 07-bench/results.jsonl with harness "langchain+jev" / "langchain".
"""
import concurrent.futures as cf, json, pathlib, re, statistics, sys, time, urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / '03-harness'))
sys.path.insert(0, str(ROOT / '06-email/03-pipeline'))
import common as C  # noqa: E402
from trace import Trace  # noqa: E402
R = C.registry


def options():
    out = {}
    for name, text in C.cards().items():
        use = re.search(r'^use-when:\s*(.+)$', text, re.M)
        no = re.search(r'^not-for:\s*(.+)$', text, re.M)
        out[name] = (use.group(1) if use else name) + (f'. Not for: {no.group(1)}' if no else '')
    return out


def jev_route(q, opts, tr=None):
    from pipeline import jev  # the same Jev client the email pipeline uses
    ans, u, ms = jev({'request': q}, {'card': {'type': 'choice', 'instructions': 'Which command-line tool should handle `request`?', 'criteria': opts}})
    a = ans['card']
    if tr:
        tr.ev('decision', tool='jev', node='card', choice=a['choice'], confidence=a.get('confidence'), ms=ms, model='jev-latest',
              tokens_in=u.get('input_tokens', 0), tokens_out=u.get('output_tokens', 0), input=q, output=a.get('probabilities'))
    return a['choice'], a.get('confidence'), ms, u.get('input_tokens', 0) * R.CFG['deciders']['jev']['price'][0] / 1e6


def llm_route(q, opts, alias):
    base, key, mid, o = R.resolve(alias)
    msg = ('Which command-line tool should handle this request?\n\nTools:\n' + '\n'.join(f'- {k}: {v}' for k, v in opts.items())
           + f'\n\nRequest: {q}\n\nAnswer with exactly one tool name and nothing else.')
    body = json.dumps({'model': mid, 'messages': [{'role': 'user', 'content': msg}], 'max_tokens': 600, 'temperature': 0}).encode()
    for i in range(6):
        t = time.time()
        try:
            req = urllib.request.Request(base + '/chat/completions', data=body, headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'User-Agent': 'icm-demo/0.1'})
            r = json.load(urllib.request.urlopen(req, timeout=60))
            break
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < 5:
                time.sleep(4 * (i + 1))
                continue
            raise
    ms = round((time.time() - t) * 1000)
    text = (r['choices'][0]['message'].get('content') or '').strip().strip('`"\'. ').lower()
    choice = next((k for k in opts if k == text), None) or next((k for k in sorted(opts, key=len, reverse=True) if k in text), 'INVALID')
    u = r.get('usage', {})
    return choice, None, ms, R.cost(alias, u.get('prompt_tokens', 0), u.get('completion_tokens', 0))


def evaluate(deciders):
    cases = [json.loads(l) for l in (HERE / 'router_cases.jsonl').read_text().splitlines() if l.strip()]
    opts = options()
    rows, table = [], []
    for d in deciders:
        f = (lambda q: jev_route(q, opts)) if d == 'jev' else (lambda q, a=d.split(':', 1)[1]: llm_route(q, opts, a))
        with cf.ThreadPoolExecutor(3) as ex:
            res = list(ex.map(lambda c: f(c['q']), cases))
        for c, (choice, conf, ms, usd) in zip(cases, res):
            rows.append({'decider': d, 'q': c['q'], 'want': c['a'], 'got': choice, 'confidence': conf, 'ms': ms, 'cost_usd': round(usd, 7)})
        mine = rows[-len(cases):]
        ok = sum(r['got'] == r['want'] for r in mine)
        table.append((d, f'{ok}/{len(cases)} ({ok / len(cases):.0%})', round(statistics.median(r['ms'] for r in mine)), f"${sum(r['cost_usd'] for r in mine) / len(cases) * 1000:.3f}",
                      '; '.join(f"{r['want']}→{r['got']}" for r in mine if r['got'] != r['want']) or 'none'))
    (HERE / 'router_eval.jsonl').write_text('\n'.join(json.dumps(r) for r in rows) + '\n')
    md = ['| Decider | Correct card | Median latency | Cost per 1,000 | Misses (want→got) |', '|---|---|---|---|---|'] + [f'| {a} | {b} | {c} ms | {d} | {e} |' for a, b, c, d, e in table]
    (HERE / 'router_eval.md').write_text('\n'.join(md) + '\n')
    print('\n'.join(md))


def agent_ab(task_ids, model='mercury-3', repeat=1):
    sys.path.insert(0, str(ROOT / '03-harness/langchain'))
    import agent as A
    opts = options()
    tasks = C.tasks()
    for _ in range(repeat):
        for tid in task_ids:
            t = tasks[tid]
            # without: the plain agent
            _, row = A.run(t['prompt'], model, None, t['category'], tid, record=True, echo=False)
            print(f"plain        {tid:<9} ok={row['success']} {row['latency_ms']} ms {row['steps']} steps {row['tokens_in']} tok in {row['error'] or ''}"[:150], flush=True)
            # with: Jev picks the card, the card goes into the prompt
            t0 = time.time()
            choice, conf, ms, usd = jev_route(t['prompt'], opts)
            prompt = t['prompt'] + (f'\n\nA router already picked the command for this: `{choice}`. Its card:\n\n{C.card(choice)}' if (conf or 0) >= 0.5 else '')
            _, row = A.run(prompt, model, None, t['category'], tid, record=False, echo=False)
            row.update({'harness': 'langchain+jev', 'routed_card': choice, 'route_confidence': conf, 'route_ms': ms,
                        'latency_ms': row['latency_ms'] + ms, 'cost_usd': round(row['cost_usd'] + usd, 6)})
            C.record(row)
            print(f"jev-routed   {tid:<9} ok={row['success']} {row['latency_ms']} ms {row['steps']} steps {row['tokens_in']} tok in  card={choice} conf={conf} {row['error'] or ''}"[:170], flush=True)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'eval'
    if cmd == 'eval':
        evaluate(sys.argv[2:] or ['jev', 'llm:mercury-3', 'llm:gpt-oss-120b', 'llm:glm-53-flash'])
    else:
        ids = sys.argv[sys.argv.index('--tasks') + 1].split(',') if '--tasks' in sys.argv else list(C.tasks())
        rep = int(sys.argv[sys.argv.index('--repeat') + 1]) if '--repeat' in sys.argv else 1
        agent_ab(ids, repeat=rep)
