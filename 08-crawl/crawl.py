#!/usr/bin/env python3
"""Wiki crawler as a graph: a LangGraph StateGraph that walks English Wikipedia towards a goal, with a SQLite
checkpointer so a crawl can be stopped and resumed where it stopped.

  crawl.py --example enron                     the shipped example, fresh (thread "enron")
  crawl.py --example enron --resume            continue thread "enron" from its last checkpoint
  crawl.py --example enron --stop-after 4      stop after 4 pages (the checkpoint keeps the rest)
  crawl.py --start "Penicillin" --goal "..." --thread pen [--model gpt-oss-120b] [--max-pages 12]
  crawl.py --list                              examples and saved threads
  crawl.py --show enron                        what the checkpoint of a thread holds

Graph:  pick -> fetch -> walk -> (pick | report) -> END
  pick    take the next page off the frontier (skips pages already visited)
  fetch   Wikipedia Action API (action=parse) -> markdown, saved to data/pages/<slug>.md
  walk    a fast model reads the page excerpt (<=1,500 chars) and <=60 candidate links, writes a one-line note,
          picks <=3 links to follow and says whether the goal is answered
  report  writes data/<thread>/graph.json and report.md (one more model call writes the answer from the notes)

Every run is one trace file (category "crawl"); each page is a child agent of the page that linked to it.
"""
import argparse, html, json, pathlib, re, sqlite3, sys, time, urllib.error, urllib.parse, urllib.request
from typing import List, Optional, TypedDict

from pydantic import BaseModel, Field

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / '03-harness'))
sys.path.insert(0, str(ROOT / '01-config'))
import registry as R  # noqa: E402
from trace import Trace, new_run_id  # noqa: E402
from langchain_openai import ChatOpenAI  # noqa: E402
from langgraph.checkpoint.sqlite import SqliteSaver  # noqa: E402
from langgraph.graph import END, START, StateGraph  # noqa: E402

DATA = HERE / 'data'
PAGES = DATA / 'pages'
DB = DATA / 'checkpoints.sqlite'
API = 'https://en.wikipedia.org/w/api.php'
UA = 'icm-fast-agents-demo/0.1'
EXCERPT, MAX_LINKS, HARD_CAP, DELAY = 1500, 60, 30, 1.5

EXAMPLES = {
    'enron': ('Enron', 'Find how Enron is connected to the invention or spread of weather derivatives: the first deal, where they came to be '
              'traded, and the companies and people involved.'),
    'penicillin': ('Penicillin', 'Find how penicillin went from a lab discovery to mass production during World War II: '
                                 'which US lab, which city, which mould source, and the people involved.'),
}

STOP = set('a an and the of to in on or for by with how is are was were find name which who what from into its it this that '
           'be as at involved people during went lab'.split())


# ---------------------------------------------------------------- fetch: Wikipedia -> markdown + links in page order

_last = [0.0]


def wiki_get(params):
    """One request at a time, at least DELAY seconds apart; 429/5xx back off (honouring Retry-After)."""
    q = urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2})
    for i in range(6):
        time.sleep(max(0.0, _last[0] + DELAY - time.time()))
        _last[0] = time.time()
        try:
            req = urllib.request.Request(f'{API}?{q}', headers={'User-Agent': UA, 'Accept-Encoding': 'identity'})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and i < 5:
                ra = e.headers.get('Retry-After')
                time.sleep(min(60, float(ra)) if ra and ra.isdigit() else 3 * 2 ** i)
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if i < 5:
                time.sleep(3 * (i + 1))
                continue
            raise


def html_to_md(h):
    h = re.sub(r'(?is)<(style|script|table|sup|figure|math)[^>]*>.*?</\1>', ' ', h)
    h = re.sub(r'(?is)<div[^>]*class="[^"]*(navbox|reflist|thumb|hatnote|metadata|mw-references|shortdescription)[^"]*".*?</div>', ' ', h)
    h = re.sub(r'(?i)<h([2-4])[^>]*>', lambda m: '\n\n' + '#' * int(m.group(1)) + ' ', h)
    h = re.sub(r'(?i)<li[^>]*>', '\n- ', h)
    h = re.sub(r'(?i)<(p|br|/h[2-4]|/ul|/ol)[^>]*>', '\n', h)
    h = re.sub(r'(?i)<span class="mw-editsection.*?</span>\s*</span>', '', h)
    t = html.unescape(re.sub(r'<[^>]+>', '', h))
    t = re.sub(r'\[edit\]', '', t)
    t = re.sub(r'[ \t]+', ' ', t)
    return re.sub(r'\n\s*\n+', '\n\n', t).strip()


def fetch_page(title):
    """-> (canonical title, markdown, links in order of first appearance in the article body)"""
    d = wiki_get({'action': 'parse', 'page': title, 'prop': 'text', 'redirects': 1, 'disableeditsection': 1})
    if 'error' in d:
        raise RuntimeError(d['error'].get('info', 'parse error'))
    p = d['parse']
    body = p['text']
    body = re.split(r'<h2[^>]*id="(?:See_also|References|Notes|External_links|Further_reading|Bibliography)"', body)[0]
    links, seen = [], set()
    for m in re.finditer(r'<a href="/wiki/([^"#?]+)', body):
        t = urllib.parse.unquote(m.group(1)).replace('_', ' ')
        if ':' in t or t in seen or t == p['title']:
            continue
        seen.add(t)
        links.append(t)
    return p['title'], html_to_md(body), links


def slug(title):
    return re.sub(r'[^a-z0-9]+', '_', title.lower()).strip('_')[:48] or 'page'


def goal_words(goal):
    return {w for w in re.findall(r'[a-z]{3,}', goal.lower()) if w not in STOP}


def excerpt(md, goal):
    """The first 700 chars of the lead, then the sentences that match the most goal words, cut at EXCERPT chars."""
    lead = md.split('\n## ')[0].strip()
    head = lead[:700]
    words = goal_words(goal)
    sents = [x.strip() for x in re.split(r'(?<=[.!?])\s+', md[len(head):]) if 30 < len(x.strip()) < 400]
    scored = sorted(((len({w for w in words if w in x.lower()}), i, x) for i, x in enumerate(sents)), key=lambda t: (-t[0], t[1]))
    out = head
    for n, _, x in scored:
        if n < 1 or len(out) + len(x) + 3 > EXCERPT:
            continue
        out += '\n… ' + x
    return out[:EXCERPT]


def resolve_titles(titles):
    """Follow redirects and normalise in one request: {asked: canonical}. Missing pages map to None."""
    if not titles:
        return {}
    d = wiki_get({'action': 'query', 'titles': '|'.join(titles), 'redirects': 1})
    q = d.get('query', {})
    m = {t: t for t in titles}
    for k in ('normalized', 'redirects'):
        for x in q.get(k, []):
            for t, v in m.items():
                if v == x['from']:
                    m[t] = x['to']
    missing = {p['title'] for p in q.get('pages', []) if p.get('missing') or p.get('invalid')}
    return {t: (None if v in missing else v) for t, v in m.items()}


def rank_links(links, goal, visited):
    """<=60 candidates: links whose title shares a word with the goal first, then page order."""
    words = goal_words(goal)
    cand = [t for t in links if t not in visited]
    score = lambda i_t: (-sum(w in i_t[1].lower() for w in words), i_t[0])
    return [t for _, t in sorted(enumerate(cand), key=score)][:MAX_LINKS]


# ---------------------------------------------------------------- the walker's structured output

class Pick(BaseModel):
    title: str = Field(description='exact title from the candidate list')
    why: str = Field(description='a few words: why this link helps the goal')


class Walk(BaseModel):
    note: str = Field(description='what this page adds towards the goal, in one sentence')
    follow: List[Pick] = Field(default_factory=list, description='0 to 3 links to follow next, best first')
    goal_answered: bool = Field(description='true only if the notes so far fully answer the goal')


class Answer(BaseModel):
    answer: str = Field(description='the answer to the goal in 3-6 sentences, citing page titles in [brackets]')


WALK_PROMPT = """You walk Wikipedia towards a goal. You see one page excerpt, the notes from pages already read, and candidate links.
Write a one-line note of what this page adds towards the goal (facts, names, dates). Choose up to 3 candidate links most
likely to answer what is still missing (exact titles from the list). Set goal_answered=true only when the notes together
already answer every part of the goal. Answer by calling the function."""

ANSWER_PROMPT = """Answer the goal using only the notes from the pages walked. Name people, dates and how the pieces connect.
Cite page titles in [brackets]. If something is not in the notes, say so. Answer by calling the function."""


# ---------------------------------------------------------------- graph state

class S(TypedDict, total=False):
    goal: str
    thread: str
    max_pages: int
    frontier: list     # [{title, parent, depth, why}]
    visited: list      # canonical titles fetched, in order
    nodes: dict        # title -> {title, slug, note, depth, parent, chars}
    edges: list        # [{from, to, why}]
    current: Optional[dict]
    page: Optional[dict]  # {title, md_path, excerpt, links}
    done: bool
    stop_reason: str
    answer: str
    tokens_in: int
    tokens_out: int


class Ctx:
    """Per-process things that cannot live in the checkpoint: the trace file and the models."""
    tr: Trace = None
    alias = 'gpt-oss-120b'
    walker = answerer = None
    seg = {'pages': 0, 'tin': 0, 'tout': 0}
    agents = {}

    @classmethod
    def agent(cls, title, parent_title=None):
        s = slug(title)
        if s not in cls.agents:
            par = slug(parent_title) if parent_title else 'main'
            cls.agents[s] = Trace(cls.tr.run, agent=s, parent=par, model=cls.alias, scrub=cls.tr.scrub, echo=cls.tr.echo, path=cls.tr.path)
        return cls.agents[s]


def call(chain, msgs):
    """Structured call. If the model answers in prose or with wrong field names, ask again (up to 2 more times)."""
    t, tin, tout, r = time.time(), 0, 0, None
    for i in range(3):
        m = msgs if i == 0 else msgs[:1] + [('system', 'Call the function with exactly the fields of its schema. Do not write prose.')] + msgs[1:]
        r = chain.invoke(m)
        u = r['raw'].usage_metadata or {}
        tin += u.get('input_tokens', 0) or 0
        tout += u.get('output_tokens', 0) or 0
        if r['parsed'] is not None:
            break
    ms = round((time.time() - t) * 1000)
    Ctx.seg['tin'] += tin
    Ctx.seg['tout'] += tout
    if r['parsed'] is None:
        raise RuntimeError(f'no structured output: {str(r.get("parsing_error"))[:200]}')
    return r['parsed'], ms, tin, tout


# ---------------------------------------------------------------- nodes

def n_pick(s):
    fr, visited = list(s['frontier']), set(s['visited'])
    while fr and fr[0]['title'] in visited:
        fr.pop(0)
    if not fr:
        return {'frontier': [], 'current': None, 'done': True, 'stop_reason': 'frontier empty'}
    cur = fr.pop(0)
    parent = Ctx.tr if not cur['parent'] else Ctx.agent(cur['parent'])
    parent.ev('agent_spawn', step=1, child=slug(cur['title']), role='page', input=cur['title'] + (f" ({cur['why']})" if cur.get('why') else ''))
    return {'frontier': fr, 'current': cur}


def n_fetch(s):
    cur = s['current']
    a = Ctx.agent(cur['title'], cur['parent'])
    a.ev('tool_start', step=1, tool='wiki_fetch', input=cur['title'])
    t = time.time()
    try:
        title, md, links = fetch_page(cur['title'])
        title = cur['title'] if title.lower() == cur['title'].lower() else title
        ok, err = True, None
    except Exception as e:
        title, md, links, ok, err = cur['title'], '', [], False, str(e)[:200]
    ms = round((time.time() - t) * 1000)
    if ok:
        PAGES.mkdir(parents=True, exist_ok=True)
        p = PAGES / f'{slug(title)}.md'
        p.write_text(f'# {title}\nsource: https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(" ", "_"))}\n\n{md}\n')
    a.ev('tool_end', step=1, tool='wiki_fetch', ms=ms, ok=ok, output=(md[:300] if ok else f'fetch failed: {err}'))
    visited = s['visited'] + [cur['title']] + ([title] if title != cur['title'] else [])
    Ctx.seg['pages'] += 1
    node = {'title': title, 'slug': slug(title), 'note': None if ok else f'fetch failed: {err}', 'depth': cur['depth'],
            'parent': cur['parent'], 'chars': len(md)}
    page = {'title': title, 'requested': cur['title'], 'ok': ok,
            'excerpt': excerpt(md, s['goal']) if ok else '', 'links': rank_links(links, s['goal'], set(visited)) if ok else []}
    return {'visited': visited, 'nodes': {**s['nodes'], cur['title']: node}, 'page': page}


def n_walk(s):
    cur, page = s['current'], s['page']
    a = Ctx.agent(cur['title'], cur['parent'])
    nodes = dict(s['nodes'])
    if not page['ok']:
        return {'page': None, 'current': None}
    notes = '\n'.join(f"- {n['title']}: {n['note']}" for n in nodes.values() if n.get('note') and n['title'] != cur['title']) or '(none yet)'
    user = (f"GOAL: {s['goal']}\n\nNOTES SO FAR:\n{notes}\n\nPAGE: {page['title']}\n{page['excerpt']}\n\n"
            f"CANDIDATE LINKS ({len(page['links'])}):\n" + '\n'.join(page['links']))
    a.ev('llm_start', step=1)
    w, ms, tin, tout = call(Ctx.walker, [('system', WALK_PROMPT), ('user', user)])
    lower = {t.lower(): t for t in page['links']}
    raw = [(lower[p.title.strip().lower()], p.why) for p in w.follow[:3] if p.title.strip().lower() in lower]
    try:
        canon = resolve_titles([t for t, _ in raw])
    except Exception:
        canon = {t: t for t, _ in raw}
    known = set(s['visited']) | {f['title'] for f in s['frontier']}
    picks = []
    for t, why in raw:
        c = canon.get(t)
        if c and c not in known and c not in [x['title'] for x in picks]:
            picks.append({'title': c, 'why': why})
    a.ev('llm_end', step=1, ms=ms, tokens_in=tin, tokens_out=tout,
         output=f"{w.note} | follow: " + ('; '.join(f"{p['title']} ({p['why']})" for p in picks) or 'none') + (' | GOAL ANSWERED' if w.goal_answered else ''))
    nodes[cur['title']] = {**nodes[cur['title']], 'note': w.note}
    new = [{'title': p['title'], 'parent': cur['title'], 'depth': cur['depth'] + 1, 'why': p['why']} for p in picks]
    edges = s['edges'] + [{'from': cur['title'], 'to': p['title'], 'why': p['why']} for p in picks]
    out = {'nodes': nodes, 'edges': edges, 'frontier': new + s['frontier'], 'page': None,
           'tokens_in': s.get('tokens_in', 0) + tin, 'tokens_out': s.get('tokens_out', 0) + tout}
    n_ok = sum(1 for n in nodes.values() if n.get('note') is not None)
    if w.goal_answered:
        out.update(done=True, stop_reason='walker says the goal is answered')
    elif n_ok >= s['max_pages']:
        out.update(done=True, stop_reason=f"max pages ({s['max_pages']}) reached")
    return out


def n_report(s):
    notes = '\n'.join(f"- {n['title']} (depth {n['depth']}): {n['note']}" for n in s['nodes'].values() if n.get('note'))
    Ctx.tr.ev('llm_start', step=1)
    r, ms, tin, tout = call(Ctx.answerer, [('system', ANSWER_PROMPT), ('user', f"GOAL: {s['goal']}\n\nNOTES:\n{notes}")])
    Ctx.tr.ev('llm_end', step=1, ms=ms, tokens_in=tin, tokens_out=tout, output=r.answer)
    visited = set(s['nodes'])
    d = DATA / s['thread']
    d.mkdir(parents=True, exist_ok=True)
    nodes = [{'title': n['title'], 'note': n['note'], 'depth': n['depth']} for n in s['nodes'].values()]
    seen = set(visited)
    for e in s['edges']:   # chosen but never fetched: a node with no note
        if e['to'] not in seen:
            seen.add(e['to'])
            nodes.append({'title': e['to'], 'note': None, 'depth': s['nodes'][e['from']]['depth'] + 1})
    edges = [{'from': e['from'], 'to': e['to'], 'followed': e['to'] in visited, 'why': e['why']} for e in s['edges']]
    (d / 'graph.json').write_text(json.dumps({'thread': s['thread'], 'goal': s['goal'], 'nodes': nodes, 'edges': edges}, indent=1, ensure_ascii=False) + '\n')
    path = '\n'.join(f"{i}. **{n['title']}** (depth {n['depth']}{', from ' + n['parent'] if n['parent'] else ''}): {n['note']}"
                     for i, n in enumerate(s['nodes'].values(), 1))
    (d / 'report.md').write_text(f"# Crawl `{s['thread']}`\n\n**Goal:** {s['goal']}\n\n**Stopped because:** {s.get('stop_reason')}\n\n"
                                 f"## Answer\n\n{r.answer}\n\n## Path walked ({len(s['nodes'])} pages, in order)\n\n{path}\n\n"
                                 f"Tokens (walk + answer): {s.get('tokens_in', 0) + tin} in, {s.get('tokens_out', 0) + tout} out.\n")
    return {'answer': r.answer, 'tokens_in': s.get('tokens_in', 0) + tin, 'tokens_out': s.get('tokens_out', 0) + tout}


def build(saver):
    g = StateGraph(S)
    g.add_node('pick', n_pick)
    g.add_node('fetch', n_fetch)
    g.add_node('walk', n_walk)
    g.add_node('report', n_report)
    g.add_edge(START, 'pick')
    g.add_conditional_edges('pick', lambda s: 'report' if s.get('done') else 'fetch', ['fetch', 'report'])
    g.add_edge('fetch', 'walk')
    g.add_conditional_edges('walk', lambda s: 'report' if s.get('done') else 'pick', ['pick', 'report'])
    g.add_edge('report', END)
    return g.compile(checkpointer=saver)


# ---------------------------------------------------------------- CLI

def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('--example', choices=sorted(EXAMPLES))
    a.add_argument('--start')
    a.add_argument('--goal')
    a.add_argument('--thread')
    a.add_argument('--model', default='gpt-oss-120b')
    a.add_argument('--max-pages', type=int, default=12)
    a.add_argument('--stop-after', type=int, help='stop after N pages fetched in this run; resume later with --resume')
    a.add_argument('--resume', action='store_true', help='continue the thread from its last checkpoint')
    a.add_argument('--list', action='store_true')
    a.add_argument('--show', metavar='THREAD')
    a.add_argument('--quiet', action='store_true', help='no trace lines on the terminal')
    o = a.parse_args()
    DATA.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB, check_same_thread=False)
    saver = SqliteSaver(conn)
    app = build(saver)

    if o.list:
        for k, (st, g) in EXAMPLES.items():
            print(f'example {k:<11} start {st!r}: {g}')
        for (t,) in conn.execute('select distinct thread_id from checkpoints order by thread_id') if _has_table(conn) else []:
            v = app.get_state({'configurable': {'thread_id': t}}).values
            print(f"thread  {t:<11} {len(v.get('visited', []))} visited, frontier {len(v.get('frontier', []))}, done={v.get('done')}")
        return
    if o.show:
        snap = app.get_state({'configurable': {'thread_id': o.show}})
        v = snap.values
        print(json.dumps({'next': list(snap.next), 'visited': v.get('visited'), 'frontier': [f['title'] for f in v.get('frontier', [])],
                          'done': v.get('done'), 'stop_reason': v.get('stop_reason'), 'tokens': [v.get('tokens_in'), v.get('tokens_out')]}, indent=1))
        return

    start, goal = EXAMPLES[o.example] if o.example else (o.start, o.goal)
    thread = o.thread or o.example or (slug(start) if start else None)
    if not thread:
        a.error('give --example, or --start and --goal')
    cfg = {'configurable': {'thread_id': thread}, 'recursion_limit': 4 * HARD_CAP + 10}
    snap = app.get_state(cfg)
    if o.resume:
        if not snap.values:
            sys.exit(f'no checkpoint for thread {thread!r}; run it without --resume first')
        if not snap.next:
            sys.exit(f"thread {thread!r} already finished; see {DATA / thread / 'report.md'} (run without --resume to start over)")
        goal = snap.values['goal']
        inp = None
    else:
        if not (start and goal):
            a.error('a fresh crawl needs --start and --goal (or --example)')
        start = resolve_titles([start]).get(start) or start
        if snap.values:   # fresh run: forget the old checkpoint of this thread
            saver.delete_thread(thread)
        inp = {'goal': goal, 'thread': thread, 'max_pages': max(1, min(o.max_pages, HARD_CAP)),
               'frontier': [{'title': start, 'parent': None, 'depth': 0, 'why': 'start'}], 'visited': [], 'nodes': {}, 'edges': [],
               'done': False, 'stop_reason': '', 'answer': '', 'tokens_in': 0, 'tokens_out': 0}

    base, key, mid, opts = R.resolve(o.model)
    Ctx.alias = o.model
    llm = ChatOpenAI(model=mid, base_url=base, api_key=key, temperature=0, max_tokens=1500, timeout=60, max_retries=8)
    Ctx.walker = llm.with_structured_output(Walk, method='function_calling', include_raw=True)
    Ctx.answerer = llm.with_structured_output(Answer, method='function_calling', include_raw=True)
    rid = new_run_id('langgraph', f'crawl-{thread}' + ('-resume' if o.resume else ''), o.model)
    Ctx.tr = Trace(rid, model=o.model, scrub=[key], echo=not o.quiet)
    before = len(snap.values.get('visited', [])) if o.resume else 0
    Ctx.tr.ev('run_start', harness='langgraph', lang='python', provider=opts['provider'], category='crawl', task=thread,
              input=(f"RESUME of thread {thread} ({len(snap.values.get('nodes', {}))} pages done, next node {list(snap.next)}): " if o.resume else '') + goal)
    t0, err, final = time.time(), None, None
    try:
        for upd in app.stream(inp, cfg, stream_mode='updates', durability='sync'):
            if o.stop_after and 'walk' in upd and Ctx.seg['pages'] >= o.stop_after:
                err = f'stopped after {Ctx.seg["pages"]} pages (--stop-after); resume with --resume --thread {thread}'
                break
    except KeyboardInterrupt:
        err = f'interrupted (Ctrl-C); resume with --resume --thread {thread}'
    except Exception as e:
        err = f'{type(e).__name__}: {str(e)[:300]}'
    final = app.get_state(cfg)
    v = final.values
    finished = not final.next
    ms = round((time.time() - t0) * 1000)
    tin, tout = Ctx.seg['tin'], Ctx.seg['tout']
    paused = bool(err) and ('stopped' in err or 'interrupted' in err)
    ok = None if paused else (finished and not err)
    Ctx.tr.ev('run_end', step=1, ok=ok, steps=Ctx.seg['pages'], tokens_in=tin, tokens_out=tout, ms=ms,
              cost_usd=round(R.cost(o.model, tin, tout), 6), pages_total=len(v.get('nodes', {})),
              output=v.get('answer') if finished else f"paused: {len(v.get('nodes', {}))} pages so far, next node {list(final.next)}",
              error=None if (paused or not err) else err)
    print(f"\nthread {thread}: {len(v.get('nodes', {}))} pages in checkpoint ({Ctx.seg['pages']} fetched this run, {before} before), "
          f"{'finished: ' + str(v.get('stop_reason')) if finished else 'paused, next node ' + str(list(final.next))}", file=sys.stderr)
    if err:
        print(err, file=sys.stderr)
    if finished:
        print(f"report: {DATA / thread / 'report.md'}\ngraph:  {DATA / thread / 'graph.json'}\ntrace:  {Ctx.tr.path}", file=sys.stderr)
    conn.close()
    sys.exit(0 if (ok or paused) else 1)


def _has_table(conn):
    return bool(conn.execute("select 1 from sqlite_master where name='checkpoints'").fetchone())


if __name__ == '__main__':
    main()
