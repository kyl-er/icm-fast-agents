// Copies ../04-traces/saved/*.jsonl into public/traces/ and writes public/traces/index.json
// in the same shape as GET /api/runs, so the built page can replay with no backend.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '04-traces', 'saved');
const out = join(here, '..', 'public', 'traces');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const runs = [];
const files = existsSync(src) ? readdirSync(src).filter((f) => f.endsWith('.jsonl')) : [];
for (const f of files) {
  const text = readFileSync(join(src, f), 'utf8');
  const events = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { /* skip a torn line */ }
  }
  if (!events.length) continue;
  const run = basename(f, '.jsonl');
  const start = events.find((e) => e.kind === 'run_start') || {};
  const end = [...events].reverse().find((e) => e.kind === 'run_end') || {};
  writeFileSync(join(out, f), text);
  runs.push({
    run,
    category: start.category ?? 'other',
    task: start.task ?? '',
    model: start.model ?? events[0].model ?? null,
    harness: start.harness ?? null,
    ok: end.ok ?? null,
    ms: end.ms ?? null,
    events: events.length,
    saved: true,
    input: start.input ?? '',
    _ts: events[0].ts ?? 0,
  });
}
runs.sort((a, b) => b._ts - a._ts);
for (const r of runs) delete r._ts;
writeFileSync(join(out, 'index.json'), JSON.stringify(runs, null, 1));
console.log(`copy-traces: ${runs.length} saved run(s) -> public/traces/`);

// Repo file list for the Context view, same shape as GET /api/tree in bin/serve (tokens = bytes / 4, an estimate).
const repo = join(here, '..', '..');
const SKIP = ['vault/', '04-traces/', '05-screen/dist/', '05-screen/public/traces/'];
let tree = { root: repo, files: [], total_tokens: 0 };
try {
  const names = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: repo, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n');
  for (const n of names) {
    if (!n || SKIP.some((s) => n.startsWith(s))) continue;
    try {
      const st = statSync(join(repo, n));
      if (st.isFile()) tree.files.push({ path: n, bytes: st.size, tokens: Math.floor(st.size / 4) });
    } catch { /* deleted but still listed */ }
  }
  tree.total_tokens = tree.files.reduce((a, f) => a + f.tokens, 0);
} catch (e) {
  console.warn(`copy-traces: no git file list (${String(e).split('\n')[0]}); tree.json is empty`);
}
writeFileSync(join(out, 'tree.json'), JSON.stringify(tree));
console.log(`copy-traces: tree.json ${tree.files.length} files, ~${tree.total_tokens} tokens est.`);
