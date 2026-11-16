#!/usr/bin/env python3
"""The email pipeline as a LangGraph graph. Three routes through it, chosen by `mode`:

  extract+jev   Mercury 3 fills the pydantic schema  ->  Jev decides over the extracted facts   (with the decision model)
  llm           Mercury 3 answers the three questions itself                                    (without it)
  jev           Jev decides over the raw email                                                  (decision model alone)

  pipeline.py run --round 1 --schema v1 --split dev --n 200 [--modes extract+jev,llm,jev] [--ids 1,2,3]
  pipeline.py one 1234 --schema v1          one email, every mode, printed

Every email is one traced run (category "email"). Results go to 04-rounds/round-N/results.jsonl.
"""
import argparse, concurrent.futures as cf, importlib.util, json, pathlib, sqlite3, sys, time, urllib.error, urllib.request
from typing import Optional, TypedDict

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / '03-harness'))
sys.path.insert(0, str(ROOT / '01-config'))
import registry as R  # noqa: E402
from trace import Trace  # noqa: E402
from langchain_openai import ChatOpenAI  # noqa: E402
from langgraph.graph import END, START, StateGraph  # noqa: E402

DB = ROOT / '06-email/data/emails.sqlite'
EXTRACTOR = 'mercury-3'
BODY_CAP = 2500  # every route and the gold labeller see the same first 2,500 characters
MODES = ['extract+jev', 'llm', 'jev']


def load_schema(version):
    sys.path.insert(0, str(HERE.parent / '02-schema'))  # a version may import from an earlier one
    spec = importlib.util.spec_from_file_location(f'schema_{version}', HERE.parent / '02-schema' / f'{version}.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def email_view(row):
    """What any model is shown of an email."""
    return {'from': row['sender'], 'to': (row['recipients'] or '')[:300], 'cc': (row['cc'] or '')[:200], 'date': row['date'],
            'subject': row['subject'], 'body': (row['body'] or '')[:BODY_CAP]}


def email_text(v):
    return f"From: {v['from']}\nTo: {v['to']}\nCc: {v['cc']}\nDate: {v['date']}\nSubject: {v['subject']}\n\n{v['body']}"


def jev(state, questions, decider='jev'):
    d = R.CFG['deciders'][decider]
    key = R.keys()[d['key_env']]
    body = json.dumps({'model': d['model'], 'state': state, 'questions': questions}).encode()
    for i in range(4):
        t = time.time()
        try:
            req = urllib.request.Request(d['url'], data=body, headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'User-Agent': 'icm-demo/0.1'})
            with urllib.request.urlopen(req, timeout=60) as r:
                out = json.load(r)
            return out['answers'], out.get('usage', {}), round((time.time() - t) * 1000)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and i < 3:
                time.sleep(1.5 * (i + 1))
                continue
            raise RuntimeError(f'jev HTTP {e.code}: {e.read()[:200].decode("utf8", "replace")}')
        except (urllib.error.URLError, TimeoutError) as e:
            if i < 3:
                time.sleep(1.5 * (i + 1))
                continue
            raise RuntimeError(f'jev: {e}')


class S(TypedDict, total=False):
    mode: str
    email: dict
    facts: Optional[dict]
    out: dict        # {'triage','needs_reply','urgency','confidence','p_reply'}
    usage: dict      # tokens and ms per model
    tr: object


def build(schema, decider='jev'):
    base, key, mid, o = R.resolve(EXTRACTOR)
    llm = ChatOpenAI(model=mid, base_url=base, api_key=key, temperature=0, max_tokens=1500, timeout=60, max_retries=8)
    extractor = llm.with_structured_output(schema.EmailFacts, method='function_calling', include_raw=True)
    direct = llm.with_structured_output(schema.Direct, method='function_calling', include_raw=True)

    def call_llm(s, chain, prompt, step):
        tr = s['tr']
        tr.ev('llm_start', step=step)
        t = time.time()
        r = chain.invoke([('system', prompt), ('user', email_text(s['email']))])
        ms = round((time.time() - t) * 1000)
        u = r['raw'].usage_metadata or {}
        if r['parsed'] is None and not r.get('parsing_error'):   # the model answered in prose: ask once more
            r = chain.invoke([('system', prompt + '\nAnswer by calling the function. Do not write prose.'), ('user', email_text(s['email']))])
            ms = round((time.time() - t) * 1000)
            u = {k: (u.get(k) or 0) + ((r['raw'].usage_metadata or {}).get(k) or 0) for k in ('input_tokens', 'output_tokens')}
        if r['parsed'] is None:
            raise RuntimeError(f'schema validation failed: {str(r.get("parsing_error"))[:200]}')
        parsed = r['parsed'].model_dump()
        tr.ev('llm_end', step=step, ms=ms, tokens_in=u.get('input_tokens', 0), tokens_out=u.get('output_tokens', 0), output=parsed)
        return parsed, {'llm_ms': ms, 'llm_in': u.get('input_tokens', 0), 'llm_out': u.get('output_tokens', 0)}

    def decide(s, state, questions, step):
        ans, u, ms = jev(state, questions, decider)
        if hasattr(schema, 'compose'):   # several narrow answers, combined by code
            out = schema.compose(ans)
        else:                            # one multi-way choice
            t = ans['triage']
            out = {'triage': t['choice'], 'confidence': t.get('confidence'), 'probabilities': t.get('probabilities')}
        out.update({'p_reply': ans['needs_reply']['noul'], 'needs_reply': ans['needs_reply']['noul'] >= 0.5, 'urgency': round(ans['urgency']['score'], 2)})
        s['tr'].ev('decision', step=step, tool=decider, node='triage', choice=out['triage'], confidence=out['confidence'], ms=ms,
                   tokens_in=u.get('input_tokens', 0), tokens_out=u.get('output_tokens', 0), model=R.CFG['deciders'][decider]['model'],
                   input=state, output={k: out[k] for k in ('triage', 'p_reply', 'urgency')})
        return out, {'jev_ms': ms, 'jev_in': u.get('input_tokens', 0), 'jev_out': u.get('output_tokens', 0)}

    def n_extract(s):
        facts, u = call_llm(s, extractor, schema.EXTRACT_PROMPT, 1)
        return {'facts': facts, 'usage': u}

    def n_decide_facts(s):
        state = {'facts': s['facts']}
        if getattr(schema, 'FACTS_STATE_KEEPS_HEADERS', False):
            state['headers'] = {k: s['email'][k] for k in ('from', 'to', 'subject')}
        out, u = decide(s, state, schema.QUESTIONS_FACTS, 1)
        return {'out': out, 'usage': {**s['usage'], **u}}

    def n_decide_raw(s):
        out, u = decide(s, {'email': s['email']}, schema.QUESTIONS_RAW, 1)
        return {'out': out, 'usage': u}

    def n_llm(s):
        d, u = call_llm(s, direct, schema.DIRECT_PROMPT, 1)
        return {'out': {'triage': d['triage'], 'needs_reply': d['needs_reply'], 'urgency': d['urgency'], 'confidence': None, 'p_reply': None}, 'usage': u}

    g = StateGraph(S)
    g.add_node('extract', n_extract)
    g.add_node('decide_on_facts', n_decide_facts)
    g.add_node('decide_on_raw', n_decide_raw)
    g.add_node('llm_direct', n_llm)
    g.add_conditional_edges(START, lambda s: {'extract+jev': 'extract', 'llm': 'llm_direct', 'jev': 'decide_on_raw'}[s['mode']])
    g.add_edge('extract', 'decide_on_facts')
    for n in ('decide_on_facts', 'decide_on_raw', 'llm_direct'):
        g.add_edge(n, END)
    return g.compile()


def cost(u):
    return R.cost(EXTRACTOR, u.get('llm_in', 0), u.get('llm_out', 0)) + u.get('jev_in', 0) * R.CFG['deciders']['jev']['price'][0] / 1e6


def run_one(graph, row, mode, rnd, schema_version, gold=None, echo=False):
    v = email_view(row)
    rid = f"{time.strftime('%Y%m%d-%H%M%S')}-email-r{rnd}-{mode.replace('+', '_')}-{row['id']}"
    tr = Trace(rid, model=EXTRACTOR if mode != 'jev' else 'jev', echo=echo)
    tr.ev('run_start', harness='langgraph', lang='python', provider='inception' if mode != 'jev' else 'typesafe', category='email',
          task=f'email-{mode}', input=f"#{row['id']} {v['subject']}")
    t0, res, err = time.time(), {}, None
    try:
        res = graph.invoke({'mode': mode, 'email': v, 'tr': tr})
    except Exception as e:
        err = f'{type(e).__name__}: {str(e)[:240]}'
    ms = round((time.time() - t0) * 1000)
    out, u = res.get('out') or {}, res.get('usage') or {}
    ok = None if (gold is None or err) else out.get('triage') == gold.get('triage')
    tr.ev('run_end', step=1, ok=False if err else ok, steps=1, tokens_in=u.get('llm_in', 0) + u.get('jev_in', 0), tokens_out=u.get('llm_out', 0) + u.get('jev_out', 0),
          ms=ms, cost_usd=round(cost(u), 7), output=out.get('triage'), error=err)
    tr.f.close()
    return {'round': rnd, 'schema': schema_version, 'mode': mode, 'email_id': row['id'], 'subject': v['subject'], **{k: out.get(k) for k in ('triage', 'needs_reply', 'urgency', 'confidence', 'p_reply')},
            'facts': res.get('facts'), 'ms': ms, **u, 'cost_usd': round(cost(u), 7), 'error': err, 'run': rid}


def rows(split=None, n=None, ids=None):
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    if ids:
        q = con.execute(f"SELECT * FROM emails WHERE id IN ({','.join('?' * len(ids))}) ORDER BY id", ids)
    else:
        q = con.execute('SELECT * FROM emails WHERE split=? ORDER BY id LIMIT ?', (split, n or 100000))
    return [dict(r) for r in q]


def gold():
    p = ROOT / '06-email/05-gold/gold.jsonl'
    return {g['email_id']: g for g in map(json.loads, p.read_text().splitlines())} if p.exists() else {}


if __name__ == '__main__':
    a = argparse.ArgumentParser()
    a.add_argument('cmd', choices=['run', 'one'])
    a.add_argument('id', nargs='?', type=int)
    a.add_argument('--round', type=int, default=0)
    a.add_argument('--schema', default='v1')
    a.add_argument('--split', default='dev')
    a.add_argument('--n', type=int, default=100)
    a.add_argument('--ids')
    a.add_argument('--gold-only', action='store_true', help='only emails that have a gold label in this split')
    a.add_argument('--modes', default=','.join(MODES))
    a.add_argument('--workers', type=int, default=4)
    a.add_argument('--tag', default='', help='suffix for the results file, e.g. heldout')
    a = a.parse_args()
    schema = load_schema(a.schema)
    graph = build(schema)
    G = gold()
    if a.cmd == 'one':
        for mode in a.modes.split(','):
            r = run_one(graph, rows(ids=[a.id])[0], mode, a.round, a.schema, G.get(a.id), echo=True)
            print(json.dumps({k: r[k] for k in ('mode', 'triage', 'needs_reply', 'urgency', 'confidence', 'ms', 'cost_usd', 'error')}))
            if r.get('facts'):
                print(json.dumps(r['facts'], indent=1))
        sys.exit(0)
    if a.ids:
        ems = rows(ids=[int(x) for x in a.ids.split(',')])
    elif a.gold_only:
        ems = [e for e in rows(ids=sorted(G)) if e['split'] == a.split]
    else:
        ems = rows(a.split, a.n)
    jobs = [(e, m) for e in ems for m in a.modes.split(',')]
    out_dir = HERE.parent / '04-rounds' / f'round-{a.round}'
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"results{'-' + a.tag if a.tag else ''}.jsonl"
    t0 = time.time()
    with cf.ThreadPoolExecutor(a.workers) as ex, open(out, 'w') as f:
        for i, r in enumerate(ex.map(lambda j: run_one(graph, j[0], j[1], a.round, a.schema, G.get(j[0]['id'])), jobs), 1):
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
            if i % 50 == 0:
                print(f'{i}/{len(jobs)}', file=sys.stderr, flush=True)
    print(f'{len(jobs)} runs over {len(ems)} emails in {time.time() - t0:.1f}s -> {out.relative_to(ROOT)}')
