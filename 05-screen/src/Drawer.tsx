import { useSyncExternalStore } from 'react';
import { model, fmtMs, fmtTok } from './model';

const SKIP = new Set(['v', 'run', 'input', 'output']);

export function Drawer({ id, onClose }: { id: string; onClose: () => void }) {
  useSyncExternalStore(model.subscribe, model.getVersion);
  const it = model.items.get(id);
  if (!it) return null;
  const run = model.runs.get(it.run);
  const pinned = model.pinned.has(it.run);
  return (
    <aside className="drawer" aria-label="Node details">
      <header className="panel-h">
        <h2>{it.title}</h2>
        <span className="grow" />
        <button className="btn sm" onClick={onClose} aria-label="Close details">Close</button>
      </header>
      <div className="drawer-body">
        <dl className="kv">
          <dt>run</dt><dd>{it.run}</dd>
          <dt>agent</dt><dd>{it.agent}</dd>
          <dt>status</dt><dd className={`st-txt-${it.status}`}>{it.status === 'active' ? 'in flight' : it.status === 'fail' ? 'failed' : 'done'}</dd>
        </dl>
        {(it.kind === 'collapsed' || it.kind === 'run') && run && (
          <>
            <dl className="kv">
              <dt>category</dt><dd>{run.category}</dd>
              <dt>model</dt><dd>{run.model} · {run.harness}</dd>
              <dt>totals</dt><dd>{run.llmCalls} llm · {run.toolCalls} tools · {fmtTok(run.tin + run.tout)} tok{run.done ? ` · ${fmtMs(run.ms)} · $${run.cost.toFixed(5)}` : ''}</dd>
            </dl>
            {run.input && (<><h3>Task</h3><pre>{run.input}</pre></>)}
            {(it.kind === 'collapsed' || pinned) && (
              <button className="btn" onClick={() => model.togglePin(it.run)}>{pinned ? 'Collapse this run' : 'Expand this run'}</button>
            )}
          </>
        )}
        {it.events.map((e, i) => (
          <div key={i} className="ev">
            <h3>{e.kind}</h3>
            <dl className="kv">
              {Object.entries(e).filter(([k, v]) => !SKIP.has(k) && v !== null && v !== undefined && k !== 'kind').map(([k, v]) => (
                <div key={k} className="kv-row"><dt>{k}</dt><dd>{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd></div>
              ))}
            </dl>
            {e.input != null && e.input !== '' && (<><h4>input</h4><pre>{String(typeof e.input === 'object' ? JSON.stringify(e.input, null, 1) : e.input)}</pre></>)}
            {e.output != null && e.output !== '' && (<><h4>output</h4><pre>{String(typeof e.output === 'object' ? JSON.stringify(e.output, null, 1) : e.output)}</pre></>)}
          </div>
        ))}
      </div>
    </aside>
  );
}
