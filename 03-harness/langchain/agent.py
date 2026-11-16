#!/usr/bin/env python3
"""The fallback harness: a LangChain ReAct agent (langchain.agents.create_agent, which runs on LangGraph).

Two tools (bash, card), the context from 02-agent/, any model in 01-config/models.toml.
Every model call and tool call becomes one trace line (04-traces/SCHEMA.md).

  agent.py --task web-1 [--model mercury-3] [--via inception] [--record]
  agent.py "free text request" --category files
"""
import argparse, json, pathlib, sys, time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import common as C  # noqa: E402
from trace import Trace, new_run_id  # noqa: E402

from langchain.agents import create_agent  # noqa: E402
from langchain_core.callbacks import BaseCallbackHandler  # noqa: E402
from langchain_core.tools import tool  # noqa: E402
from langchain_openai import ChatOpenAI  # noqa: E402


class Tracer(BaseCallbackHandler):
    """LangChain callbacks -> trace events. Counts steps, tokens and time."""

    def __init__(self, tr):
        self.tr, self.step, self.tin, self.tout, self.t, self.tools = tr, 0, 0, 0, {}, 0

    def on_chat_model_start(self, serialized, messages, *, run_id, **kw):
        self.step += 1
        self.t[run_id] = time.time()
        self.tr.ev('llm_start', step=self.step)

    def on_llm_end(self, response, *, run_id, **kw):
        msg = response.generations[0][0].message
        u = getattr(msg, 'usage_metadata', None) or {}
        self.tin += u.get('input_tokens', 0)
        self.tout += u.get('output_tokens', 0)
        calls = getattr(msg, 'tool_calls', None) or []
        out = msg.content if isinstance(msg.content, str) else json.dumps(msg.content)
        if calls:
            out = (out + ' ' if out else '') + ' ; '.join(f"{c['name']}({json.dumps(c['args'], ensure_ascii=False)})" for c in calls)
        self.tr.ev('llm_end', step=self.step, ms=round((time.time() - self.t.pop(run_id, time.time())) * 1000),
                   tokens_in=u.get('input_tokens', 0), tokens_out=u.get('output_tokens', 0), output=out)

    def on_tool_start(self, serialized, input_str, *, run_id, inputs=None, **kw):
        self.tools += 1
        self.t[run_id] = (time.time(), serialized.get('name'))
        arg = next(iter(inputs.values())) if inputs else input_str
        self.tr.ev('tool_start', step=self.step, tool=serialized.get('name'), input=arg)

    def on_tool_end(self, output, *, run_id, **kw):
        t0, name = self.t.pop(run_id, (time.time(), '?'))
        text = getattr(output, 'content', output)
        text = text if isinstance(text, str) else str(text)
        ok = '[exit 0]' in text[-12:] if name == 'bash' else not text.startswith('no card')
        self.tr.ev('tool_end', step=self.step, tool=name, ms=round((time.time() - t0) * 1000), ok=ok, output=text)

    def on_tool_error(self, error, *, run_id, **kw):
        t0, name = self.t.pop(run_id, (time.time(), '?'))
        self.tr.ev('tool_end', step=self.step, tool=name, ms=round((time.time() - t0) * 1000), ok=False, output=str(error))


@tool
def bash(cmd: str) -> str:
    """Run one shell command and return its output (cut at 3000 characters)."""
    return C.sh(cmd)[0]


@tool
def card(name: str) -> str:
    """Read the card for one CLI command from the CLI index (copy-paste commands and gotchas)."""
    return C.card(name)


def run(prompt, model='mercury-3', via=None, category='adhoc', task_id='adhoc', max_steps=12, record=False, echo=True):
    base, key, mid, o = C.registry.resolve(model, via)
    run_id = new_run_id('langchain', task_id, model)
    tr = Trace(run_id, model=model, scrub=[key], echo=echo)
    tr.ev('run_start', harness='langchain', lang='python', provider=o['provider'], category=category, task=task_id, input=prompt)
    cb = Tracer(tr)
    llm = ChatOpenAI(model=mid, base_url=base, api_key=key, max_tokens=o['max_tokens'], temperature=0, timeout=90, max_retries=2)
    agent = create_agent(llm, [bash, card], system_prompt=C.system_prompt())
    t0, answer, err = time.time(), '', None
    try:
        out = agent.invoke({'messages': [{'role': 'user', 'content': prompt}]},
                           config={'callbacks': [cb], 'recursion_limit': 2 * max_steps + 1})
        answer = out['messages'][-1].content
        answer = answer if isinstance(answer, str) else json.dumps(answer)
    except Exception as e:  # a failed run is still a row and a trace
        err = f'{type(e).__name__}: {str(e)[:300]}'
    ms = round((time.time() - t0) * 1000)
    ok = C.check(C.tasks().get(task_id), answer) if not err else False
    usd = C.registry.cost(model, cb.tin, cb.tout)
    tr.ev('run_end', step=cb.step, ok=ok, steps=cb.step, tokens_in=cb.tin, tokens_out=cb.tout, ms=ms, cost_usd=round(usd, 6), output=answer, error=err)
    row = {'run': run_id, 'harness': 'langchain', 'model': model, 'provider': o['provider'], 'category': category, 'task': task_id,
           'success': ok, 'latency_ms': ms, 'steps': cb.step, 'tool_calls': cb.tools, 'tokens_in': cb.tin, 'tokens_out': cb.tout,
           'cost_usd': round(usd, 6), 'error': err}
    if record:
        C.record(row)
    return answer, row


if __name__ == '__main__':
    a = argparse.ArgumentParser()
    a.add_argument('prompt', nargs='?')
    a.add_argument('--task')
    a.add_argument('--model', default='mercury-3')
    a.add_argument('--via')
    a.add_argument('--category', default='adhoc')
    a.add_argument('--max-steps', type=int, default=12)
    a.add_argument('--record', action='store_true', help='append a row to 07-bench/results.jsonl')
    a.add_argument('--quiet', action='store_true')
    a = a.parse_args()
    if a.task:
        t = C.tasks()[a.task]
        a.prompt, a.category = t['prompt'], t['category']
    if not a.prompt:
        sys.exit('give a prompt or --task ID')
    answer, row = run(a.prompt, a.model, a.via, a.category, a.task or 'adhoc', a.max_steps, a.record, echo=not a.quiet)
    print(answer)
    print(json.dumps(row), file=sys.stderr)
