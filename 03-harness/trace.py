"""Trace emitter for 04-traces/SCHEMA.md v2.

  tr = Trace(run_id, model='mercury-3')
  tr.ev('llm_end', step=1, ms=120, tokens_in=10, tokens_out=5, output='...')

Each event is one JSON line appended to 04-traces/live/<run>.jsonl and, with echo=True, a short line on stderr.
"""
import json, os, pathlib, sys, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIVE = pathlib.Path(os.environ.get('TRACE_DIR', ROOT / '04-traces/live'))
CUT = 1500


def new_run_id(harness, task, model):
    import re
    return time.strftime('%Y%m%d-%H%M%S') + '-' + re.sub(r'[^A-Za-z0-9.]+', '_', f'{harness}-{task}-{model}')


class Trace:
    def __init__(self, run, agent='main', parent=None, model=None, scrub=(), echo=False, path=None):
        self.run, self.agent, self.parent, self.model = run, agent, parent, model
        self.scrub = [s for s in scrub if s]
        self.echo = echo
        LIVE.mkdir(parents=True, exist_ok=True)
        self.path = pathlib.Path(path) if path else LIVE / f'{run}.jsonl'
        self.f = open(self.path, 'a')

    def child(self, agent, model=None):
        """An emitter for a sub-agent that writes to the same file."""
        return Trace(self.run, agent=agent, parent=self.agent, model=model or self.model, scrub=self.scrub, echo=self.echo, path=self.path)

    def ev(self, kind, step=0, **kw):
        for k in ('input', 'output'):
            if k in kw and kw[k] is not None:
                s = kw[k] if isinstance(kw[k], str) else json.dumps(kw[k], ensure_ascii=False)
                kw[k] = s if len(s) <= CUT else s[:CUT] + f'…[+{len(s) - CUT}]'
        e = {'v': 2, 'ts': round(time.time(), 4), 'run': self.run, 'agent': self.agent, 'parent': self.parent,
             'step': step, 'kind': kind, 'model': kw.pop('model', self.model), **kw}
        line = json.dumps(e, ensure_ascii=False)
        for s in self.scrub:
            line = line.replace(s, '<key>')
        self.f.write(line + '\n')
        self.f.flush()
        if self.echo:
            print(pretty(e), file=sys.stderr, flush=True)
        return e


def pretty(e):
    """One terminal line per event. Shared by live runs and bin/replay."""
    k = e['kind']
    head = f"{time.strftime('%H:%M:%S', time.localtime(e['ts']))} {e['agent']:<10} {e.get('step', 0):>2} "
    one = lambda s, n=110: ' '.join(str(s or '').split())[:n]
    if k == 'run_start':
        return head + f"▶ RUN  {e.get('harness')} · {e.get('model')} · {e.get('category')}/{e.get('task')}: {one(e.get('input'), 90)}"
    if k == 'llm_start':
        return head + '… thinking'
    if k == 'llm_end':
        return head + f"◆ LLM  {e.get('ms')} ms · {e.get('tokens_in')}→{e.get('tokens_out')} tok · {one(e.get('output'))}"
    if k == 'tool_start':
        return head + f"→ {e.get('tool')}  {one(e.get('input'))}"
    if k == 'tool_end':
        return head + f"← {e.get('tool')}  {e.get('ms')} ms {'ok' if e.get('ok') else 'FAIL'} · {one(e.get('output'))}"
    if k == 'decision':
        return head + f"◈ DECIDE {e.get('tool')} {e.get('node')} = {e.get('choice')} (conf {e.get('confidence')}) {e.get('ms')} ms"
    if k == 'agent_spawn':
        return head + f"+ spawn {e.get('child')} ({e.get('role')})"
    if k == 'run_end':
        return head + (f"■ END  ok={e.get('ok')} · {e.get('steps')} steps · {e.get('tokens_in')}→{e.get('tokens_out')} tok · "
                       f"{e.get('ms')} ms · ${e.get('cost_usd', 0):.5f}\n    {one(e.get('output'), 400)}" + (f"\n    error: {e.get('error')}" if e.get('error') else ''))
    return head + f"{k} {one(e.get('output'))}"
