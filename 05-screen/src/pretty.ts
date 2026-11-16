import type { TraceEvent } from './types';

// Port of pretty() in 03-harness/trace.py: one terminal line per event.
const pad2 = (n: number) => String(n).padStart(2, '0');
const clock = (ts: number) => {
  const d = new Date(ts * 1000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};
const one = (s: unknown, n = 110) => String(s ?? '').split(/\s+/).filter(Boolean).join(' ').slice(0, n);
const str = (v: unknown) => (v === undefined || v === null ? 'None' : String(v));

export type LineTone = 'run' | 'fail' | 'end' | 'plain';

export function pretty(e: TraceEvent): { text: string; tone: LineTone } {
  const k = e.kind;
  const head = `${clock(e.ts)} ${String(e.agent ?? '').padEnd(10)} ${String(e.step ?? 0).padStart(2)} `;
  switch (k) {
    case 'run_start':
      return { tone: 'run', text: head + `▶ RUN  ${str(e.harness)} · ${str(e.model)} · ${str(e.category)}/${str(e.task)}: ${one(e.input, 90)}` };
    case 'llm_start':
      return { tone: 'plain', text: head + '… thinking' };
    case 'llm_end':
      return { tone: 'plain', text: head + `◆ LLM  ${str(e.ms)} ms · ${str(e.tokens_in)}→${str(e.tokens_out)} tok · ${one(e.output)}` };
    case 'tool_start':
      return { tone: 'plain', text: head + `→ ${str(e.tool)}  ${one(e.input)}` };
    case 'tool_end':
      return { tone: e.ok ? 'plain' : 'fail', text: head + `← ${str(e.tool)}  ${str(e.ms)} ms ${e.ok ? 'ok' : 'FAIL'} · ${one(e.output)}` };
    case 'decision':
      return { tone: 'plain', text: head + `◈ DECIDE ${str(e.tool)} ${str(e.node)} = ${str(e.choice)} (conf ${str(e.confidence)}) ${str(e.ms)} ms` };
    case 'agent_spawn':
      return { tone: 'plain', text: head + `+ spawn ${str(e.child)} (${str(e.role)})` };
    case 'run_end': {
      const cost = typeof e.cost_usd === 'number' ? e.cost_usd : 0;
      let t = head + `■ END  ok=${e.ok === true ? 'True' : e.ok === false ? 'False' : 'None'} · ${str(e.steps)} steps · ${str(e.tokens_in)}→${str(e.tokens_out)} tok · ${str(e.ms)} ms · $${cost.toFixed(5)}\n    ${one(e.output, 400)}`;
      if (e.error) t += `\n    error: ${String(e.error)}`;
      return { tone: e.ok === false ? 'fail' : 'end', text: t };
    }
    default:
      return { tone: 'plain', text: head + `${k} ${one(e.output)}` };
  }
}
