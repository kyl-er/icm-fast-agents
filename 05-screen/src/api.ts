import type { Mode, RunMeta, TaskMeta, TraceEvent } from './types';
import type { TreeData } from './context';

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  // Vite dev and some static servers answer unknown paths with index.html, so parse strictly.
  return JSON.parse(await r.text()) as T;
}

export async function loadRuns(): Promise<{ mode: Mode; runs: RunMeta[] }> {
  try {
    const runs = await getJSON<RunMeta[]>('/api/runs');
    if (Array.isArray(runs)) return { mode: 'server', runs };
  } catch { /* no backend */ }
  try {
    const runs = await getJSON<RunMeta[]>('./traces/index.json');
    return { mode: 'static', runs: Array.isArray(runs) ? runs : [] };
  } catch {
    return { mode: 'static', runs: [] };
  }
}

export function parseJsonl(text: string): TraceEvent[] {
  const out: TraceEvent[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* torn line */ }
  }
  return out;
}

export async function loadTrace(run: string, mode: Mode): Promise<TraceEvent[]> {
  const url = mode === 'server' ? `/api/trace/${encodeURIComponent(run)}` : `./traces/${encodeURIComponent(run)}.jsonl`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`trace ${run}: ${r.status}`);
  return parseJsonl(await r.text());
}

export const loadTasks = () => getJSON<TaskMeta[]>('/api/tasks').catch(() => [] as TaskMeta[]);
export const loadModels = () => getJSON<string[]>('/api/models').catch(() => [] as string[]);
export const loadVox = () => getJSON<{ hasKey: boolean }>('/api/vox').catch(() => null);

export async function startRun(body: Record<string, string>): Promise<string | null> {
  try {
    const r = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const t = await r.text();
    if (!r.ok) return `server said ${r.status}: ${t.slice(0, 120)}`;
    try {
      const j = JSON.parse(t);
      if (j && j.ok === false) return String(j.error ?? 'server refused the run');
    } catch { /* plain text ok */ }
    return null;
  } catch (e) {
    return `could not reach server: ${String(e)}`;
  }
}

export function openStream(onEvent: (e: TraceEvent) => void, onState: (s: 'open' | 'error') => void): () => void {
  const es = new EventSource('/api/stream');
  es.onopen = () => onState('open');
  es.onerror = () => onState('error');
  es.onmessage = (m) => {
    try { onEvent(JSON.parse(m.data)); } catch { /* keepalive or junk */ }
  };
  return () => es.close();
}

/** Repo file list for the Context view: /api/tree from bin/serve, else the copy written by scripts/copy-traces.mjs. */
export async function loadTree(mode: Mode): Promise<{ tree: TreeData; source: string } | null> {
  const ok = (t: TreeData) => t && Array.isArray(t.files) && typeof t.root === 'string';
  if (mode === 'server') {
    try { const t = await getJSON<TreeData>('/api/tree'); if (ok(t)) return { tree: t, source: '/api/tree' }; } catch { /* fall through */ }
  }
  try { const t = await getJSON<TreeData>('./traces/tree.json'); if (ok(t)) return { tree: t, source: 'traces/tree.json' }; } catch { /* none */ }
  return null;
}
