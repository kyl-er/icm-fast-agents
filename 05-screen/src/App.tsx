import { lazy, Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Mode, RunMeta, TaskMeta } from './types';
import { loadModels, loadRuns, loadTasks, loadTrace, loadTree, openStream, startRun } from './api';
import { model, fmtMs, fmtTok, LANES } from './model';
import { replayer, type ReplayState } from './replay';
import { Graph } from './Graph';
import { Terminal } from './Terminal';
import { Drawer } from './Drawer';
import { Vox } from './Vox';
import { ContextView } from './ContextView';

// three.js is only fetched when the Space view is first opened
const SpaceView = lazy(() => import('./SpaceView'));
type View = 'graph' | 'context' | 'space';
const VIEW_LABEL: Record<View, string> = { graph: 'Graph', context: 'Context', space: 'Space' };

const SPEEDS = [1, 4, 16];

function TotalsStrip() {
  useSyncExternalStore(model.subscribe, model.getVersion);
  const t = model.totals();
  const cells: [string, string][] = [
    ['runs', t.active ? `${t.runs} (${t.active} live)` : String(t.runs)],
    ['model calls', String(t.llmCalls)],
    ['tool calls', String(t.toolCalls)],
    ['tokens', fmtTok(t.tokens)],
    ['cost', `$${t.cost.toFixed(4)}`],
    ['median LLM', t.medianLlmMs == null ? '–' : fmtMs(t.medianLlmMs)],
  ];
  return (
    <div className="totals" role="status">
      {cells.map(([k, v]) => (
        <div key={k} className="tot"><span className="tot-v">{v}</span><span className="tot-k">{k}</span></div>
      ))}
    </div>
  );
}

export function App() {
  const [mode, setMode] = useState<Mode>('checking');
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [tasks, setTasks] = useState<TaskMeta[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [pick, setPick] = useState('');
  const [rs, setRs] = useState<ReplayState>(replayer.state);
  const [speed, setSpeed] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [stream, setStream] = useState('');
  const [task, setTask] = useState('');
  const [mdl, setMdl] = useState('');
  const [harness, setHarness] = useState<'langchain' | 'rig'>('langchain');
  const [prompt, setPrompt] = useState('');
  const [promptCat, setPromptCat] = useState('files');
  const [runMsg, setRunMsg] = useState('');
  const [view, setView] = useState<View>(() => { const v = new URLSearchParams(location.search).get('view'); return v === 'context' || v === 'space' ? v : 'graph'; });

  useEffect(() => {
    replayer.onChange = setRs;
    replayer.speed = speed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshRuns = useCallback(async () => {
    const r = await loadRuns();
    setMode(r.mode);
    setRuns(r.runs);
    for (const m of r.runs) model.hints.set(m.run, { category: m.category, task: m.task, model: m.model, harness: m.harness, input: m.input ?? '' });
    return r;
  }, []);

  useEffect(() => {
    refreshRuns().then(async (r) => {
      void loadTree(r.mode).then((t) => { if (t) { model.ctx.setTree(t.tree, t.source); model.notify(); } });
      if (r.mode === 'server') {
        const [t, m] = await Promise.all([loadTasks(), loadModels()]);
        setTasks(t);
        setModels(m);
        if (t[0]) setTask(t[0].id);
        if (m.length) setMdl(m.includes('mercury-3') ? 'mercury-3' : m[0]);
      }
      // ?replay=<run> or ?replay=all:<category>, optional &speed=16: autoplay for demos and tests
      const q = new URLSearchParams(location.search);
      const sp = Number(q.get('speed'));
      if (SPEEDS.includes(sp)) { setSpeed(sp); replayer.setSpeed(sp); }
      const want = q.get('replay');
      if (want) {
        setPick(want);
        void play(want, r.mode, r.runs);
      } else if (r.runs[0]) setPick(r.runs[0].run);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live stream from bin/serve; the run list is refreshed so new live runs show in the picker
  useEffect(() => {
    if (mode !== 'server') return;
    const t = window.setInterval(() => { void refreshRuns(); }, 15000);
    return () => clearInterval(t);
  }, [mode, refreshRuns]);
  useEffect(() => {
    if (mode !== 'server') return;
    setStream('connecting…');
    return openStream((e) => model.ingest(e), (s) => setStream(s === 'open' ? 'live stream connected' : 'live stream reconnecting…'));
  }, [mode]);

  const categories = useMemo(() => {
    const s = new Set(runs.map((r) => r.category));
    return LANES.filter((l) => s.has(l)).concat([...s].filter((c) => !(LANES as readonly string[]).includes(c)) as never[]);
  }, [runs]);

  async function play(choice: string, m: Mode = mode, list: RunMeta[] = runs) {
    if (!choice) return;
    setSelected(null);
    try {
      if (choice.startsWith('all:')) {
        const cat = choice.slice(4);
        const ids = list.filter((r) => r.category === cat).map((r) => r.run).reverse(); // oldest first
        const groups = await Promise.all(ids.map((id) => loadTrace(id, m)));
        replayer.load(groups, `all ${cat} (${ids.length})`);
      } else {
        const evs = await loadTrace(choice, m);
        replayer.load([evs], choice);
      }
    } catch (e) {
      setRunMsg(`Could not load trace: ${String(e)}`);
    }
  }

  const live = mode === 'server';

  const fire = async (body: Record<string, string>) => {
    setRunMsg('starting…');
    const err = await startRun(body);
    setRunMsg(err ?? 'Run started.');
  };

  return (
    <div className="app">
      <div className="col-left">
        <Vox mode={mode} />
        <Terminal status={mode === 'server' ? stream : mode === 'static' ? 'replay only' : ''} />
      </div>
      <main className="col-right">
        <header className="strip">
          <h1>Fast agents</h1>
          <TotalsStrip />
        </header>
        <div className="controls">
          <fieldset className="grp">
            <legend>Replay</legend>
            <select aria-label="Saved run" value={pick} onChange={(e) => setPick(e.target.value)}>
              {runs.length === 0 && <option value="">no saved runs</option>}
              {categories.length > 0 && (
                <optgroup label="Whole category">
                  {categories.map((c) => <option key={c} value={`all:${c}`}>All {c} runs</option>)}
                </optgroup>
              )}
              <optgroup label="Single run">
                {runs.map((r) => (
                  <option key={r.run} value={r.run}>{r.category} / {r.task || r.run} · {r.model ?? ''}{r.ok === false ? ' · failed' : ''}</option>
                ))}
              </optgroup>
            </select>
            <button className="btn primary" disabled={!pick} onClick={() => void play(pick)}>Replay</button>
            {rs.status === 'playing' && <button className="btn" onClick={() => replayer.pause()}>Pause</button>}
            {rs.status === 'paused' && <button className="btn" onClick={() => replayer.resume()}>Resume</button>}
            <button className="btn" disabled={rs.total === 0} onClick={() => replayer.restart()}>Restart</button>
            <div className="seg" role="group" aria-label="Replay speed">
              {SPEEDS.map((s) => (
                <button key={s} className={`btn ${speed === s ? 'on' : ''}`} aria-pressed={speed === s} onClick={() => { setSpeed(s); replayer.setSpeed(s); }}>{s}x</button>
              ))}
            </div>
            <span className="muted small prog">{rs.total ? `${rs.at}/${rs.total} events${rs.status === 'done' ? ' · done' : rs.status === 'paused' ? ' · paused' : ''}` : ''}</span>
          </fieldset>
          <fieldset className="grp" disabled={!live}>
            <legend>Run live {!live && mode !== 'checking' && <span className="tag">replay only (no server)</span>}</legend>
            <select aria-label="Task" value={task} onChange={(e) => setTask(e.target.value)}>
              {tasks.length === 0 && <option value="">no tasks</option>}
              {tasks.map((t) => <option key={t.id} value={t.id} title={t.prompt}>{t.id}</option>)}
            </select>
            <select aria-label="Model" value={mdl} onChange={(e) => setMdl(e.target.value)}>
              {models.length === 0 && <option value="">model</option>}
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <div className="seg" role="group" aria-label="Harness">
              {(['langchain', 'rig'] as const).map((h) => (
                <button key={h} className={`btn ${harness === h ? 'on' : ''}`} aria-pressed={harness === h} onClick={() => setHarness(h)}>{h}</button>
              ))}
            </div>
            <button className="btn primary" disabled={!task} onClick={() => void fire({ task, ...(mdl ? { model: mdl } : {}), harness })}>Run</button>
            <form className="prompt" onSubmit={(e) => { e.preventDefault(); if (prompt.trim()) void fire({ prompt: prompt.trim(), category: promptCat, ...(mdl ? { model: mdl } : {}), harness }); }}>
              <input aria-label="Prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Or write a prompt…" />
              <select aria-label="Prompt category" value={promptCat} onChange={(e) => setPromptCat(e.target.value)}>
                {['web', 'files', 'memory', 'email', 'crawl', 'swarm'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="btn" type="submit" disabled={!prompt.trim()}>Send</button>
            </form>
            {runMsg && <span className="muted small">{runMsg}</span>}
          </fieldset>
          <fieldset className="grp clear">
            <legend>View</legend>
            <div className="seg" role="group" aria-label="View">
              {(['graph', 'context', 'space'] as const).map((v) => (
                <button key={v} className={`btn ${view === v ? 'on' : ''}`} aria-pressed={view === v} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>
              ))}
            </div>
          </fieldset>
          <button className="btn" onClick={() => { replayer.stop(); model.reset(); setSelected(null); }}>Clear graph</button>
        </div>
        <div className="graph-area">
          <Graph onSelect={setSelected} />
          {selected && view === 'graph' && <Drawer id={selected} onClose={() => setSelected(null)} />}
          {/* the graph stays mounted (and keeps its size) under the Context view, so it keeps up while hidden */}
          {view === 'context' && <ContextView />}
          {view === 'space' && <Suspense fallback={<div className="space space-loading">loading space view…</div>}><SpaceView /></Suspense>}
        </div>
      </main>
    </div>
  );
}
