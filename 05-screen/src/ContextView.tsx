// The Context view: repo file tree and session memory lighting up as a run touches them, plus a token
// meter that compares what the run actually sent to the model with the size of the whole repo.
import { memo, useMemo, useState, useSyncExternalStore } from 'react';
import { model } from './model';
import type { Mark, RunCtx, TreeNode } from './context';

const ctx = model.ctx;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (a: number, b: number) => {
  if (!b) return '–';
  const p = (a / b) * 100;
  return p >= 10 ? `${p.toFixed(0)}%` : p >= 1 ? `${p.toFixed(1)}%` : `${p.toFixed(2)}%`;
};

function runLabel(id: string) {
  const r = model.runs.get(id);
  return `${r?.category ?? '?'} / ${r?.task || id}`;
}

export function ContextView() {
  const version = useSyncExternalStore(model.subscribe, ctx.getVersion);
  const [pick, setPick] = useState(''); // '' = follow the most recent run
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const runs = [...ctx.runs.values()].sort((a, b) => b.order - a.order);
  const run: RunCtx | undefined = (pick && ctx.runs.get(pick)) || runs[0];

  // Folders holding a lit path open by themselves; the user's toggles flip that.
  const autoOpen = useMemo(() => {
    const s = new Set<string>();
    if (run) for (const p of run.marks.keys()) {
      const segs = p.split('/');
      for (let i = 1; i < segs.length; i++) s.add(segs.slice(0, i).join('/'));
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, version]);
  const isOpen = (p: string) => autoOpen.has(p) !== open.has(p);
  const toggle = (p: string) => setOpen((o) => { const n = new Set(o); if (n.has(p)) n.delete(p); else n.add(p); return n; });

  const total = ctx.tree?.total_tokens ?? 0;
  const read = run ? ctx.readTokens(run) : 0;
  const nRead = run ? [...run.marks.values()].filter((m) => m.state === 'read').length : 0;
  const nSeen = run ? run.marks.size - nRead : 0;
  const mem = run ? [...run.mem.values()] : [];

  const rows: { node: TreeNode; depth: number }[] = [];
  const walk = (n: TreeNode, depth: number) => {
    for (const c of n.children) {
      rows.push({ node: c, depth });
      if (c.dir && isOpen(c.path)) walk(c, depth + 1);
    }
  };
  if (ctx.rootNode) walk(ctx.rootNode, 0);

  return (
    <div className="ctx">
      <div className="ctx-bar">
        <label className="muted small" htmlFor="ctx-run">Run</label>
        <select id="ctx-run" aria-label="Context run" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Most recent{runs[0] ? ` (${runLabel(runs[0].id)})` : ''}</option>
          {runs.map((r) => <option key={r.id} value={r.id}>{runLabel(r.id)}</option>)}
        </select>
        <span className="ctx-legend small muted">
          <span className="dot dot-act" /> in flight <span className="dot dot-read" /> read <span className="dot dot-seen" /> seen in a listing
        </span>
      </div>

      <Meter run={run} total={total} read={read} />

      <div className="ctx-cols">
        <section className="ctx-tree" aria-label="Repo files">
          <div className="ctx-h">
            <h2>Repo files</h2>
            <span className="muted small mono">
              {ctx.tree ? `${ctx.tree.files.length} files · ~${fmt(total)} tok est. · ${nRead} read · ${nSeen} seen` : 'no file list (needs /api/tree or traces/tree.json)'}
            </span>
          </div>
          <div className="ctx-scroll" role="tree">
            {rows.map(({ node, depth }) => (
              <Row key={node.path} node={node} depth={depth} mark={run?.marks.get(node.path)} lit={autoOpen.has(node.path)} open={node.dir && isOpen(node.path)} onToggle={toggle} />
            ))}
          </div>
          {ctx.treeSource && <div className="ctx-foot muted small mono">source: {ctx.treeSource}</div>}
        </section>

        <section className="ctx-mem" aria-label="Session memory">
          <div className="ctx-h">
            <h2>Session memory</h2>
            <span className="muted small mono">{mem.length} doc{mem.length === 1 ? '' : 's'}</span>
          </div>
          <div className="ctx-scroll">
            {mem.length === 0 && <p className="muted small ctx-empty">No memory documents in this run yet. Memory runs list them from <code>ctxq search</code>; <code>ctxq show</code> marks one read.</p>}
            {mem.map((d) => (
              <div key={d.id} className={`mrow ${d.active ? 'm-act' : ''} m-${d.state}`} title={d.id}>
                <span className={`dot ${d.active ? 'dot-act' : d.state === 'read' ? 'dot-read' : 'dot-seen'}`} />
                <span className="mono mid">{shortId(d.id)}</span>
                <span className="mtitle">{d.title || <span className="muted">no title</span>}</span>
                <span className="mono muted small mstep">{d.state === 'read' ? 'shown' : 'listed'} · step {d.step}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function shortId(id: string) {
  const i = id.indexOf(':');
  const src = id.slice(0, i);
  const rest = id.slice(i + 1);
  return `${src}:${rest.slice(0, 8)}${rest.length > 8 ? '…' : ''}`;
}

const Row = memo(function Row({ node, depth, mark, lit, open, onToggle }: { node: TreeNode; depth: number; mark?: Mark; lit: boolean; open: boolean; onToggle: (p: string) => void }) {
  const cls = ['trow', node.dir ? 'is-dir' : '', mark?.active ? 't-act' : mark ? `t-${mark.state}` : lit ? 't-in' : ''].filter(Boolean).join(' ');
  const body = (
    <>
      <span className="tcaret" aria-hidden>{node.dir ? (open ? '▾' : '▸') : ''}</span>
      <span className={`dot ${mark ? (mark.active ? 'dot-act' : mark.state === 'read' ? 'dot-read' : 'dot-seen') : 'dot-none'}`} />
      <span className="tname">{node.name}{node.dir ? '/' : ''}</span>
      {mark && <span className="tmark">{mark.tool} · step {mark.step}</span>}
      <span className="ttok">{node.tokens.toLocaleString('en-US')}</span>
    </>
  );
  const style = { paddingLeft: 6 + depth * 14 };
  return node.dir ? (
    <button type="button" className={cls} style={style} role="treeitem" aria-expanded={open} data-path={node.path} onClick={() => onToggle(node.path)}>{body}</button>
  ) : (
    <div className={cls} style={style} role="treeitem" data-path={node.path}>{body}</div>
  );
});

function Meter({ run, total, read }: { run?: RunCtx; total: number; read: number }) {
  const last = run?.maxIn ?? 0;
  const cum = run?.cumIn ?? 0;
  const top = Math.max(total, cum, last, 10);
  // log10 scale from 1 token to the largest value: a 1k prompt next to a 700k repo stays visible
  const w = (v: number) => (v <= 0 ? 0 : Math.max(0.5, (Math.log10(v + 1) / Math.log10(top + 1)) * 100));
  const bars: [string, number, string][] = [
    ['last prompt', last, 'accent'],
    ['all prompts this run', cum, 'ink'],
    ['files it read (est.)', read, 'ink'],
    ['whole repo (est.)', total, 'hair'],
  ];
  return (
    <section className="meter" aria-label="Token meter">
      <p className="meter-say">
        {run && last ? (
          <><strong>{fmt(last)}</strong> tokens in the last prompt · the repo is ~<strong>{fmt(total)}</strong> · <strong>{pct(last, total)}</strong></>
        ) : run ? 'waiting for the first model call…' : 'replay or start a run to fill the meter'}
      </p>
      <div className="bars">
        {bars.map(([k, v, tone]) => (
          <div className="bar-row" key={k}>
            <span className="bar-k">{k}</span>
            <span className="bar-track"><span className={`bar bar-${tone}`} style={{ width: `${w(v)}%` }} /></span>
            <span className="bar-v">{v ? fmt(v) : '–'}</span>
          </div>
        ))}
      </div>
      <p className="muted small meter-note">
        Log scale. Last prompt = largest <code>tokens_in</code> of any model call ({run?.llmCalls ?? 0} calls); all prompts = their sum. Repo and file numbers are estimates (bytes / 4).
      </p>
    </section>
  );
}
