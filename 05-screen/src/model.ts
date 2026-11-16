// One reducer for live and replay. Events go in through ingest(); the graph, totals and terminal
// read from here. Notifications are batched to one per animation frame.
import type { Edge, Node } from '@xyflow/react';
import type { TraceEvent } from './types';
import { pretty, type LineTone } from './pretty';
import { ContextModel } from './context';

export type ItemKind = 'run' | 'llm' | 'tool' | 'decision' | 'spawn' | 'message' | 'end' | 'collapsed';
export type Status = 'active' | 'done' | 'fail';

export interface Item {
  id: string;
  kind: ItemKind;
  run: string;
  agent: string;
  status: Status;
  ver: number;
  title: string;
  lines: string[];
  events: TraceEvent[];
  child?: string; // spawn items: id of the child agent
}

interface Agent {
  id: string;
  parent: string | null;
  items: Item[];
  spawnItem?: Item;
}

export interface Run {
  id: string;
  category: string;
  task: string;
  model: string;
  harness: string;
  input: string;
  done: boolean;
  ok: boolean | null;
  ms: number;
  tin: number;
  tout: number;
  cost: number;
  llmCalls: number;
  toolCalls: number;
  agents: Map<string, Agent>;
  roots: string[];
  runItem: Item;
  endItem?: Item;
  llm: Map<string, Item>;
  openTools: Map<string, Item[]>;
  ver: number;
}

export interface Totals {
  runs: number;
  llmCalls: number;
  toolCalls: number;
  tokens: number;
  cost: number;
  medianLlmMs: number | null;
  active: number;
}

export const LANES = ['web', 'files', 'memory', 'email', 'crawl', 'swarm', 'other'] as const;
const laneOf = (c: string) => ((LANES as readonly string[]).includes(c) ? c : 'other');

const short = (s: unknown, n = 60) => {
  const t = String(s ?? '').split(/\s+/).filter(Boolean).join(' ');
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
export const fmtMs = (ms: number) => (ms >= 10000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
export const fmtTok = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(n));

type LineFn = (lines: { text: string; tone: LineTone }[]) => void;

export class TraceModel {
  runs = new Map<string, Run>();
  order: string[] = [];
  items = new Map<string, Item>();
  version = 0;
  pinned = new Set<string>(); // runs the user expanded by hand
  /** files, memory docs and tokens per run, for the Context view; fed from apply() below */
  ctx = new ContextModel();
  /** run id -> metadata from /api/runs, used when the stream joins a run after its run_start */
  hints = new Map<string, { category: string; task: string; model: string | null; harness: string | null; input: string }>();
  private llmMs: number[] = [];
  private listeners = new Set<() => void>();
  private lineListeners = new Set<LineFn>();
  private pendingLines: { text: string; tone: LineTone }[] = [];
  private raf = 0;
  private seq = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  getVersion = () => this.version;
  onLines(fn: LineFn) {
    this.lineListeners.add(fn);
    return () => { this.lineListeners.delete(fn); };
  }

  private schedule() {
    if (this.raf) return;
    const flush = () => {
      this.raf = 0;
      this.version++;
      const lines = this.pendingLines;
      this.pendingLines = [];
      if (lines.length) this.lineListeners.forEach((f) => f(lines));
      this.listeners.forEach((f) => f());
    };
    // rAF pauses in hidden tabs; a timeout keeps the model moving there.
    this.raf = typeof document !== 'undefined' && document.hidden ? (setTimeout(flush, 100) as unknown as number) : requestAnimationFrame(flush);
  }

  reset() {
    this.runs.clear();
    this.order = [];
    this.items.clear();
    this.llmMs = [];
    this.pinned.clear();
    this.ctx.reset();
    this.pendingLines.push({ text: '— cleared —', tone: 'plain' });
    this.schedule();
  }

  togglePin(run: string) {
    if (this.pinned.has(run)) this.pinned.delete(run);
    else this.pinned.add(run);
    const r = this.runs.get(run);
    if (r) r.ver++;
    this.schedule();
  }

  /** Tell subscribers something outside the event stream changed (e.g. the Context view's file list arrived). */
  notify() { this.schedule(); }

  ingestMany(es: TraceEvent[]) {
    for (const e of es) this.apply(e);
    this.schedule();
  }
  ingest(e: TraceEvent) {
    this.apply(e);
    this.schedule();
  }

  private newItem(run: Run, agent: string, kind: ItemKind, id: string, title: string): Item {
    const it: Item = { id, kind, run: run.id, agent, status: 'active', ver: 0, title, lines: [], events: [] };
    this.items.set(id, it);
    return it;
  }

  private ensureRun(e: TraceEvent): Run {
    let r = this.runs.get(e.run);
    if (r) return r;
    r = {
      id: e.run, category: 'other', task: '', model: String(e.model ?? ''), harness: '', input: '',
      done: false, ok: null, ms: 0, tin: 0, tout: 0, cost: 0, llmCalls: 0, toolCalls: 0,
      agents: new Map(), roots: [], llm: new Map(), openTools: new Map(), ver: 0,
      runItem: undefined as unknown as Item,
    };
    r.runItem = this.newItem(r, e.agent || 'main', 'run', `${e.run}:run`, e.run);
    const h = this.hints.get(e.run);
    if (h && e.kind !== 'run_start') {
      r.category = laneOf(h.category || 'other');
      r.task = h.task;
      r.model = h.model ?? r.model;
      r.harness = h.harness ?? '';
      r.input = h.input;
      r.runItem.title = r.task || r.id;
      r.runItem.lines = [[r.model, r.harness].filter(Boolean).join(' · '), short(r.input, 80)];
    }
    this.runs.set(e.run, r);
    this.order.push(e.run);
    return r;
  }

  private ensureAgent(r: Run, id: string, parent: string | null): Agent {
    let a = r.agents.get(id);
    if (a) return a;
    a = { id, parent, items: [] };
    r.agents.set(id, a);
    if (parent && parent !== id) {
      const p = this.ensureAgent(r, parent, null);
      // A sub-agent seen without an agent_spawn event still hangs under its parent.
      const sp = this.newItem(r, parent, 'spawn', `${r.id}:spawn:${id}`, `sub-agent ${id}`);
      sp.child = id;
      sp.status = 'done';
      p.items.push(sp);
      a.spawnItem = sp;
    } else {
      r.roots.push(id);
    }
    return a;
  }

  private apply(e: TraceEvent) {
    if (!e || typeof e !== 'object' || !e.run || !e.kind) return;
    this.pendingLines.push(pretty(e));
    this.ctx.apply(e);
    if (this.pendingLines.length > 2500) this.pendingLines.splice(0, this.pendingLines.length - 2000);
    const r = this.ensureRun(e);
    r.ver++;
    const agentId = e.agent || 'main';
    const ag = this.ensureAgent(r, agentId, e.parent ?? null);
    const step = num(e.step);
    const touch = (it: Item) => { it.ver++; it.events.push(e); };

    switch (e.kind) {
      case 'run_start': {
        r.category = laneOf(String(e.category ?? 'other'));
        r.task = String(e.task ?? '');
        r.model = String(e.model ?? r.model ?? '');
        r.harness = String(e.harness ?? '');
        r.input = String(e.input ?? '');
        const it = r.runItem;
        it.title = r.task || r.id;
        it.lines = [[r.model, r.harness].filter(Boolean).join(' · '), short(r.input, 80)];
        touch(it);
        break;
      }
      case 'llm_start':
      case 'llm_end': {
        const key = `${agentId}:${step}`;
        let it = r.llm.get(key);
        if (!it) {
          it = this.newItem(r, agentId, 'llm', `${r.id}:llm:${key}:${this.seq++}`, `LLM step ${step}`);
          it.lines = ['thinking…'];
          r.llm.set(key, it);
          ag.items.push(it);
        }
        if (e.kind === 'llm_end') {
          const ms = num(e.ms), ti = num(e.tokens_in), to = num(e.tokens_out);
          it.status = 'done';
          it.lines = [`${fmtMs(ms)} · ${fmtTok(ti)}→${fmtTok(to)} tok`, short(e.output, 64)];
          r.llmCalls++;
          r.tin += ti;
          r.tout += to;
          this.llmMs.push(ms);
        }
        touch(it);
        break;
      }
      case 'tool_start': {
        const tool = String(e.tool ?? 'tool');
        const it = this.newItem(r, agentId, 'tool', `${r.id}:tool:${this.seq++}`, tool);
        it.lines = [short(e.input, 64)];
        const k = `${agentId}:${tool}`;
        const q = r.openTools.get(k) ?? [];
        q.push(it);
        r.openTools.set(k, q);
        ag.items.push(it);
        r.toolCalls++;
        touch(it);
        break;
      }
      case 'tool_end': {
        const tool = String(e.tool ?? 'tool');
        const q = r.openTools.get(`${agentId}:${tool}`);
        let it = q?.shift();
        if (!it) {
          it = this.newItem(r, agentId, 'tool', `${r.id}:tool:${this.seq++}`, tool);
          ag.items.push(it);
          r.toolCalls++;
        }
        it.status = e.ok === false ? 'fail' : 'done';
        it.lines = [`${fmtMs(num(e.ms))} · ${e.ok === false ? 'failed' : 'ok'}`, it.lines[0] ?? ''];
        touch(it);
        break;
      }
      case 'decision': {
        const it = this.newItem(r, agentId, 'decision', `${r.id}:dec:${this.seq++}`, `${String(e.tool ?? 'decide')}${e.node ? ' · ' + String(e.node) : ''}`);
        const conf = typeof e.confidence === 'number' ? ` · conf ${e.confidence.toFixed(2)}` : '';
        it.lines = [`${short(e.choice, 40)}${conf}`, e.ms !== undefined ? fmtMs(num(e.ms)) : ''];
        it.status = 'done';
        ag.items.push(it);
        touch(it);
        break;
      }
      case 'agent_spawn': {
        const child = String(e.child ?? `child-${this.seq}`);
        const existing = r.agents.get(child);
        if (existing?.spawnItem) {
          const sp = existing.spawnItem;
          sp.title = `spawn ${child}`;
          sp.lines = [short(e.role, 40), short(e.input, 64)];
          touch(sp);
          break;
        }
        const sp = this.newItem(r, agentId, 'spawn', `${r.id}:spawn:${child}`, `spawn ${child}`);
        sp.child = child;
        sp.status = 'done';
        sp.lines = [short(e.role, 40), short(e.input, 64)];
        ag.items.push(sp);
        touch(sp);
        if (!existing) {
          const ca: Agent = { id: child, parent: agentId, items: [], spawnItem: sp };
          r.agents.set(child, ca);
        } else {
          existing.spawnItem = sp;
          r.roots = r.roots.filter((x) => x !== child);
        }
        break;
      }
      case 'message': {
        const it = this.newItem(r, agentId, 'message', `${r.id}:msg:${this.seq++}`, `message → ${String(e.to ?? '?')}`);
        it.lines = [short(e.output, 64)];
        it.status = 'done';
        ag.items.push(it);
        touch(it);
        break;
      }
      case 'run_end': {
        r.done = true;
        r.ok = e.ok === true ? true : e.ok === false ? false : null;
        r.ms = num(e.ms);
        r.cost = num(e.cost_usd);
        if (num(e.tokens_in) || num(e.tokens_out)) { r.tin = num(e.tokens_in); r.tout = num(e.tokens_out); }
        const it = r.endItem ?? this.newItem(r, agentId, 'end', `${r.id}:end`, 'end');
        r.endItem = it;
        it.status = r.ok === false ? 'fail' : 'done';
        it.title = r.ok === false ? 'failed' : r.ok === true ? 'done' : 'ended';
        it.lines = [`${fmtMs(r.ms)} · ${fmtTok(r.tin + r.tout)} tok · $${r.cost.toFixed(4)}`, e.error ? short(e.error, 64) : short(e.output, 64)];
        touch(it);
        r.runItem.status = it.status;
        r.runItem.ver++;
        // anything still open when the run ended is closed
        for (const q of r.openTools.values()) for (const t of q) { t.status = 'fail'; t.ver++; }
        r.openTools.clear();
        for (const l of r.llm.values()) if (l.status === 'active') { l.status = 'done'; l.ver++; }
        break;
      }
      default: {
        const it = this.newItem(r, agentId, 'message', `${r.id}:ev:${this.seq++}`, e.kind);
        it.lines = [short(e.output ?? e.input, 64)];
        it.status = 'done';
        ag.items.push(it);
        touch(it);
      }
    }
  }

  totals(): Totals {
    let llm = 0, tools = 0, tok = 0, cost = 0, active = 0;
    for (const r of this.runs.values()) {
      llm += r.llmCalls; tools += r.toolCalls; tok += r.tin + r.tout; cost += r.cost;
      if (!r.done) active++;
    }
    let med: number | null = null;
    if (this.llmMs.length) {
      const s = [...this.llmMs].sort((a, b) => a - b);
      const m = s.length >> 1;
      med = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }
    return { runs: this.runs.size, llmCalls: llm, toolCalls: tools, tokens: tok, cost, medianLlmMs: med, active };
  }

  /* ---------------------------------------------------------------- layout ---- */

  private nodeCache = new Map<string, { ver: number; x: number; y: number; extra: string; node: Node }>();
  private edgeCache = new Map<string, { animated: boolean; fail: boolean; type: string; edge: Edge }>();

  private node(id: string, type: string, x: number, y: number, ver: number, data: Record<string, unknown>, extra = '', style?: Node['style']): Node {
    const c = this.nodeCache.get(id);
    if (c && c.ver === ver && c.x === x && c.y === y && c.extra === extra) return c.node;
    const node: Node = {
      id, type, position: { x, y }, data, draggable: false, connectable: false,
      selectable: type !== 'lane', focusable: type !== 'lane', ...(style ? { style } : {}),
      ...(type === 'lane' ? { zIndex: -1 } : {}),
    };
    this.nodeCache.set(id, { ver, x, y, extra, node });
    return node;
  }

  private edge(s: string, t: string, animated: boolean, fail: boolean, type = 'straight'): Edge {
    const id = `${s}->${t}`;
    const c = this.edgeCache.get(id);
    if (c && c.animated === animated && c.fail === fail && c.type === type) return c.edge;
    const edge: Edge = { id, source: s, target: t, type, animated, className: fail ? 'e-fail' : animated ? 'e-live' : undefined, focusable: false, selectable: false };
    this.edgeCache.set(id, { animated, fail, type, edge });
    return edge;
  }

  /** Which runs are drawn as one compact node. */
  private collapsedSet(): Set<string> {
    const out = new Set<string>();
    let total = 0;
    for (const r of this.runs.values()) total += r.agents.size + [...r.agents.values()].reduce((n, a) => n + a.items.length, 2);
    const byLane = new Map<string, Run[]>();
    for (const id of this.order) {
      const r = this.runs.get(id)!;
      const l = byLane.get(r.category) ?? [];
      l.push(r);
      byLane.set(r.category, l);
    }
    const keep = total > 260 ? 1 : 3; // under heavy load keep only the newest finished run open per lane
    for (const runs of byLane.values()) {
      if (runs.length <= 4 && total <= 260) continue;
      const finished = runs.filter((r) => r.done);
      for (const r of finished.slice(0, Math.max(0, finished.length - keep))) if (!this.pinned.has(r.id)) out.add(r.id);
    }
    return out;
  }

  layout(): { nodes: Node[]; edges: Edge[] } {
    const W = 230, INDENT = 22, HANG = 14, GAP = 10, RUN_GAP = 28, HEAD = 44, LANE_PAD = 14, LANE_GAP = 36, WRAP_H = 1500;
    // must match the fixed heights in styles.css (.tn, .tn-run, .tn-message, .tn-collapsed)
    const H: Record<ItemKind, number> = { run: 62, llm: 58, tool: 58, decision: 58, spawn: 58, message: 42, end: 58, collapsed: 42 };
    const collapsed = this.collapsedSet();
    const laneRuns = new Map<string, Run[]>();
    for (const id of this.order) {
      const r = this.runs.get(id)!;
      const l = laneRuns.get(r.category) ?? [];
      l.push(r);
      laneRuns.set(r.category, l);
    }
    const nodes: Node[] = [];
    const lanes: Node[] = [];
    const edges: Edge[] = [];
    let laneX = 0;
    for (const lane of LANES) {
      const runs = laneRuns.get(lane);
      if (!runs?.length) continue;
      let y = HEAD;
      let maxY = HEAD;
      let colDx = 0; // long lanes wrap into extra sub-columns so the graph keeps a usable shape
      let colRight = W;
      let maxRight = W;
      const place = (it: Item, dx: number, kind: ItemKind = it.kind) => {
        nodes.push(this.node(it.id, 'trace', laneX + colDx + dx, y, it.ver, { item: it }, ''));
        colRight = Math.max(colRight, dx + W);
        maxRight = Math.max(maxRight, colDx + dx + W);
        y += H[kind] + GAP;
        maxY = Math.max(maxY, y);
      };
      for (const r of runs) {
        if (y > WRAP_H) { colDx += colRight + 24; colRight = W; y = HEAD; }
        if (collapsed.has(r.id)) {
          const id = `${r.id}:collapsed`;
          const st = r.ok === false ? 'fail' : 'done';
          let it = this.items.get(id);
          if (!it) {
            it = { id, kind: 'collapsed', run: r.id, agent: 'main', status: st, ver: 0, title: '', lines: [], events: [] };
            this.items.set(id, it);
          }
          if (it.ver !== r.ver) {
            it.ver = r.ver;
            it.status = st;
            it.title = r.task || r.id;
            it.lines = [`${r.ok === false ? 'failed' : r.ok === true ? 'ok' : 'ended'} · ${fmtMs(r.ms)} · ${r.llmCalls} llm · ${r.toolCalls} tools · ${fmtTok(r.tin + r.tout)} tok`];
          }
          place(it, 0, 'collapsed');
          continue;
        }
        place(r.runItem, 0);
        let lastMain = r.runItem.id;
        const walk = (a: Agent, depth: number, prev: string, firstType = 'straight'): string => {
          let p = prev;
          let type = firstType;
          for (const it of a.items) {
            const hang = it.kind === 'tool' || it.kind === 'decision' ? HANG : 0;
            place(it, depth * INDENT + hang);
            edges.push(this.edge(p, it.id, it.status === 'active', it.status === 'fail', type));
            type = 'straight';
            p = it.id;
            if (it.kind === 'spawn' && it.child) {
              const ca = r.agents.get(it.child);
              if (ca) walk(ca, depth + 1, it.id, 'smoothstep');
            }
          }
          return p;
        };
        for (const root of r.roots) {
          const a = r.agents.get(root);
          if (a) lastMain = walk(a, 0, lastMain);
        }
        if (r.endItem) {
          place(r.endItem, 0);
          edges.push(this.edge(lastMain, r.endItem.id, false, r.endItem.status === 'fail'));
        }
        y += RUN_GAP - GAP;
      }
      const laneW = maxRight + LANE_PAD * 2;
      lanes.push(this.node(`lane:${lane}`, 'lane', laneX - LANE_PAD, 0, runs.length, { label: lane, count: runs.length }, `${laneW}x${maxY}`, { width: laneW, height: maxY + LANE_PAD }));
      laneX += laneW + LANE_GAP;
    }
    return { nodes: [...lanes, ...nodes], edges };
  }
}

export const model = new TraceModel();
