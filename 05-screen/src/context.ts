// Context view state: which repo files and memory documents each run touched, and how many tokens it used.
// Fed from TraceModel.apply() (the same reducer for live and replay). Path matching runs once per event
// against a prebuilt index; the view only reads the result.
import type { TraceEvent } from './types';

export interface TreeFile { path: string; bytes: number; tokens: number }
export interface TreeData { root: string; files: TreeFile[]; total_tokens: number }

export interface TreeNode {
  path: string; // repo-relative, '' for the root
  name: string;
  dir: boolean;
  tokens: number; // est. (bytes / 4); folders sum their files
  children: TreeNode[];
}

export type MarkState = 'seen' | 'read';
export interface Mark { state: MarkState; step: number; tool: string; active: number }
export interface MemDoc { id: string; title: string; state: MarkState; step: number; active: number }

export interface RunCtx {
  id: string;
  order: number;
  marks: Map<string, Mark>;
  mem: Map<string, MemDoc>;
  maxIn: number; // largest tokens_in of any llm_end = size of the final prompt
  cumIn: number; // tokens_in summed over the run
  llmCalls: number;
  open: Map<string, { label: string; paths: string[] }[]>; // in-flight tool calls (file side), FIFO per agent:tool
  memOpen: Map<string, string[][]>; // in-flight tool calls (memory side)
}

/** Commands whose arguments are file contents being read (first word of each pipeline segment). */
export const READERS = new Set(['cat', 'sed', 'head', 'tail', 'rg', 'grep', 'bat', 'wc', 'card', 'less', 'awk', 'jq']);
/** Non-shell tools whose whole input counts as "read". */
const READ_TOOLS = new Set(['read', 'read_file', 'cat', 'view', 'open_file']);

const MEM_ID = /\b(?:claude-ai|claude|pi|codex|hermes|opencode|gemini):[A-Za-z0-9_-]{8,}/g;
const SEARCH_LINE = /^\s*(\S+:\S+)\s*\|\s*\d{4}-\d{2}-\d{2}[^|]*\|\s*[^|]*\|\s*(.+?)\s*$/;
const TOKEN = /[\w.@+~/-]+/g;
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v));

export class ContextModel {
  version = 0;
  tree: TreeData | null = null;
  treeSource = '';
  rootNode: TreeNode | null = null;
  index = new Map<string, TreeNode>(); // path -> node (files and folders)
  private firstSegs = new Set<string>(); // top-level names: cheap reject for tokens that cannot be repo paths
  runs = new Map<string, RunCtx>();
  private seq = 0;
  private buffer: TraceEvent[] = []; // events seen before the tree arrived, replayed for file matching

  getVersion = () => this.version;

  setTree(t: TreeData, source: string) {
    this.tree = t;
    this.treeSource = source;
    this.index.clear();
    this.firstSegs.clear();
    const root: TreeNode = { path: '', name: '', dir: true, tokens: 0, children: [] };
    for (const f of t.files) {
      const segs = f.path.split('/').filter(Boolean);
      if (!segs.length) continue;
      this.firstSegs.add(segs[0]);
      let cur = root;
      cur.tokens += f.tokens;
      for (let i = 0; i < segs.length; i++) {
        const p = segs.slice(0, i + 1).join('/');
        let n = this.index.get(p);
        if (!n) {
          n = { path: p, name: segs[i], dir: i < segs.length - 1, tokens: 0, children: [] };
          this.index.set(p, n);
          cur.children.push(n);
        }
        n.tokens += f.tokens;
        cur = n;
      }
    }
    const sort = (n: TreeNode) => {
      n.children.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
      n.children.forEach(sort);
    };
    sort(root);
    this.rootNode = root;
    const buf = this.buffer;
    this.buffer = [];
    for (const e of buf) this.applyFiles(e, this.runs.get(e.run));
    this.version++;
  }

  reset() {
    this.runs.clear();
    this.buffer = [];
    this.version++;
  }

  /** Repo paths mentioned in a text, longest match first, deduplicated. */
  match(text: string): string[] {
    if (!text || !this.tree) return [];
    let t = text;
    const root = this.tree.root.replace(/\/+$/, '');
    if (root && t.includes(root)) t = t.split(root + '/').join(' ').split(root).join(' ');
    const out = new Set<string>();
    for (const m of t.matchAll(TOKEN)) {
      let tok = m[0].replace(/^\.\//, '').replace(/[.,:;]+$/, '');
      if (!tok) continue;
      if (tok.includes('/')) {
        const segs = tok.split('/').filter(Boolean);
        if (!segs.length || !this.firstSegs.has(segs[0])) continue;
        for (let k = segs.length; k >= 1; k--) {
          const p = segs.slice(0, k).join('/');
          if (this.index.has(p)) { out.add(p); break; }
        }
      } else {
        const n = this.index.get(tok);
        if (n && !n.dir && tok.includes('.')) out.add(tok); // bare top-level file names like README.md
      }
    }
    return [...out];
  }

  private ensure(id: string): RunCtx {
    let r = this.runs.get(id);
    if (!r) {
      r = { id, order: this.seq++, marks: new Map(), mem: new Map(), maxIn: 0, cumIn: 0, llmCalls: 0, open: new Map(), memOpen: new Map() };
      this.runs.set(id, r);
    }
    return r;
  }

  private mark(r: RunCtx, path: string, state: MarkState, step: number, tool: string, active = 0) {
    const m = r.marks.get(path);
    if (!m) { r.marks.set(path, { state, step, tool, active }); return; }
    if (state === 'read' && m.state === 'seen') { m.state = 'read'; m.step = step; m.tool = tool; }
    m.active += active;
  }

  private memDoc(r: RunCtx, id: string, state: MarkState, step: number, active = 0, title = '') {
    const d = r.mem.get(id);
    if (!d) { r.mem.set(id, { id, title, state, step, active }); return; }
    if (title && !d.title) d.title = title;
    if (state === 'read' && d.state === 'seen') { d.state = 'read'; d.step = step; }
    d.active += active;
  }

  apply(e: TraceEvent) {
    const k = e.kind;
    if (k !== 'tool_start' && k !== 'tool_end' && k !== 'llm_end' && k !== 'run_end' && k !== 'run_start') return;
    const r = this.ensure(e.run);
    if (k === 'llm_end') {
      const ti = num(e.tokens_in);
      r.maxIn = Math.max(r.maxIn, ti);
      r.cumIn += ti;
      r.llmCalls++;
    } else if (k === 'run_end') {
      r.cumIn = Math.max(r.cumIn, num(e.tokens_in));
    }
    this.applyMem(e, r);
    if (this.tree) this.applyFiles(e, r);
    else if (this.buffer.length < 20000) this.buffer.push(e);
    this.version++;
  }

  private applyMem(e: TraceEvent, r: RunCtx) {
    const step = num(e.step);
    const tool = String(e.tool ?? 'tool');
    const key = `${e.agent || 'main'}:${tool}`;
    if (e.kind === 'tool_start') {
      const input = str(e.input);
      const reads = /\bctxq\s+(show|read)\b/.test(input);
      const ids = [...new Set(input.match(MEM_ID) ?? [])];
      for (const id of ids) this.memDoc(r, id, reads ? 'read' : 'seen', step, reads ? 1 : 0);
      const q = r.memOpen.get(key) ?? [];
      q.push(reads ? ids : []);
      r.memOpen.set(key, q);
    } else if (e.kind === 'tool_end' || e.kind === 'llm_end' || e.kind === 'run_end') {
      if (e.kind === 'tool_end') {
        for (const id of r.memOpen.get(key)?.shift() ?? []) { const d = r.mem.get(id); if (d) d.active = Math.max(0, d.active - 1); }
      }
      if (e.kind === 'run_end') { for (const d of r.mem.values()) d.active = 0; r.memOpen.clear(); }
      if (e.kind === 'tool_end' && tool === 'card') return; // cards are documentation: their example ids are not hits
      const out = str(e.output);
      if (!out) return;
      let showId = '';
      for (const line of out.split('\n')) {
        const m = SEARCH_LINE.exec(line);
        if (m) { this.memDoc(r, m[1], 'seen', step, 0, m[2]); continue; }
        const idm = /^id:\s*(\S+:\S+)/.exec(line);
        if (idm) showId = idm[1];
        const tm = /^title:\s*(.+)$/.exec(line);
        if (tm && showId) this.memDoc(r, showId, 'seen', step, 0, tm[1].trim());
      }
      for (const id of new Set(out.match(MEM_ID) ?? [])) this.memDoc(r, id, 'seen', step);
    }
  }

  private applyFiles(e: TraceEvent, r0: RunCtx | undefined) {
    const r = r0 ?? this.ensure(e.run);
    const step = num(e.step);
    const tool = String(e.tool ?? 'tool');
    const key = `${e.agent || 'main'}:${tool}`;
    if (e.kind === 'tool_start') {
      const input = str(e.input);
      const label = tool === 'bash' || tool === 'shell' ? firstCmd(input) || tool : tool;
      const lit: string[] = [];
      if (tool !== 'bash' && tool !== 'shell') {
        const st: MarkState = READ_TOOLS.has(tool) ? 'read' : 'seen';
        for (const p of this.match(input)) { this.mark(r, p, st, step, label, 1); lit.push(p); }
      } else {
        for (const seg of input.split(/\|\||&&|[|;\n]/)) {
          const st: MarkState = READERS.has(firstCmd(seg)) ? 'read' : 'seen';
          for (const p of this.match(seg)) {
            if (lit.includes(p)) { this.mark(r, p, st, step, label, 0); continue; }
            this.mark(r, p, st, step, label, 1);
            lit.push(p);
          }
        }
      }
      const q = r.open.get(key) ?? [];
      q.push({ label, paths: lit });
      r.open.set(key, q);
    } else if (e.kind === 'tool_end') {
      const call = r.open.get(key)?.shift();
      if (call) {
        for (const p of call.paths) { const m = r.marks.get(p); if (m) m.active = Math.max(0, m.active - 1); }
      }
      const label = call?.label ?? tool;
      for (const p of this.match(str(e.output))) this.mark(r, p, 'seen', step, label);
    } else if (e.kind === 'llm_end') {
      for (const p of this.match(str(e.output))) this.mark(r, p, 'seen', step, 'llm');
    } else if (e.kind === 'run_end') {
      for (const p of this.match(str(e.output))) this.mark(r, p, 'seen', step, 'answer');
      // nothing stays in flight after the run ended
      for (const m of r.marks.values()) m.active = 0;
      r.open.clear();
    }
  }

  /** Sum of est. tokens of files this run read (folders count as their files). */
  readTokens(r: RunCtx): number {
    const files = new Set<string>();
    for (const [p, m] of r.marks) {
      if (m.state !== 'read') continue;
      const n = this.index.get(p);
      if (!n) continue;
      if (!n.dir) files.add(p);
      else walkFiles(n, (f) => files.add(f.path));
    }
    let t = 0;
    for (const p of files) t += this.index.get(p)?.tokens ?? 0;
    return t;
  }
}

function walkFiles(n: TreeNode, fn: (f: TreeNode) => void) {
  if (!n.dir) { fn(n); return; }
  for (const c of n.children) walkFiles(c, fn);
}

/** First command word of a shell segment: skips VAR=x, sudo, time, env, and strips a directory. */
export function firstCmd(seg: string): string {
  const words = seg.trim().split(/\s+/);
  for (const w of words) {
    if (!w || /^\w+=/.test(w) || w === 'sudo' || w === 'time' || w === 'env' || w === '(' || w === '{') continue;
    return w.replace(/^[({]+/, '').split('/').pop() ?? '';
  }
  return '';
}
