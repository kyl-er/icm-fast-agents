# 08-crawl: a wiki crawler as a graph

A fast model walks English Wikipedia towards a goal. Each page is fetched to markdown, its links become candidate
edges, the model writes a one-line note and picks up to 3 links to follow. The traversal is a LangGraph `StateGraph`
with a SQLite checkpointer, so a crawl can be stopped (Ctrl-C or `--stop-after N`) and resumed with the same thread
id, continuing where it stopped. Every run is one trace file (category `crawl`), and every page is a child agent of
the page that linked to it, so the screen draws the walk as a tree.

```
pick -> fetch -> walk -> (pick | report) -> END
pick    next page off the frontier (pages already visited are skipped)
fetch   Wikipedia Action API (action=parse) -> markdown in data/pages/<slug>.md     tool "wiki_fetch"
walk    gpt-oss-120b reads <=1,500 chars + <=60 candidate links -> note, <=3 links, goal_answered
report  one more model call writes the answer from the notes; writes data/<thread>/graph.json and report.md
```

## Script index

| Command | What it does |
|---|---|
| `bin/crawl-demo` | Fresh crawl of the shipped example: start "Enron", thread `enron`, 12 pages max |
| `bin/crawl-demo --resume` | Continue thread `enron` from its last checkpoint |
| `bin/crawl-demo --stop-after 4` | Fresh crawl that stops after 4 pages, prints the checkpoint, then resumes it to the end |
| `bin/crawl-demo --example penicillin` | The second example (see limits: it drifts) |
| `08-crawl/crawl.py --start T --goal G --thread X [--model M] [--max-pages N]` | Any crawl. `--max-pages` default 12, hard cap 30 |
| `08-crawl/crawl.py --list` | Examples and the threads in the checkpoint database |
| `08-crawl/crawl.py --show enron` | What a thread's checkpoint holds: next node, visited, frontier, tokens |
| `bin/replay enron` | Replay the saved trace, no network |

Run with `.venv/bin/python` after `uv sync` (needs `langgraph-checkpoint-sqlite`, added to `pyproject.toml`).
Model key: whatever `01-config/registry.py` resolves for `--model` (default `gpt-oss-120b`, Cerebras route).

## Outputs

- `data/checkpoints.sqlite` LangGraph checkpoints, one thread per crawl (git-ignored)
- `data/pages/<slug>.md` fetched pages (git-ignored)
- `data/<thread>/graph.json` nodes `{title, note, depth}` and edges `{from, to, followed, why}`; kept in git
- `data/<thread>/report.md` the answer and the path walked; kept in git
- `04-traces/live/<run>.jsonl` the trace; one copy is in `04-traces/saved/20261116-023900-langgraph_crawl_enron_gpt_oss_120b.jsonl`

## Expected output (real, 2026-11-16, `bin/crawl-demo --stop-after 4`)

```
== part 1: fresh crawl, stopping after 4 pages ==
02:41:28 main        0 ▶ RUN  langgraph · gpt-oss-120b · crawl/enron: Find how Enron is connected to the invention or spread of weather derivatives: the first d
02:41:28 main        1 + spawn enron (page)
02:41:31 enron       1 ◆ LLM  479 ms · 913→376 tok · Enron’s EnronOnline platform offered weather risk management products, ...
02:41:31 enron       1 + spawn weather_derivative (page)
02:41:34 weather_derivative  1 ◆ LLM  375 ms · 783→353 tok · The page identifies the first weather derivative deal (July 1996, Aquila Energy ...
02:41:37 aquila_inc  1 ◆ LLM  663 ms · 923→737 tok · Aquila Inc. (formerly Aquila Energy) structured the first weather‑derivative transaction ...
02:42:00 enron_scandal  1 ◆ LLM  581 ms · 1069→698 tok · The Enron scandal page shows Enron’s extensive use of derivatives ...
02:42:00 main        1 ■ END  ok=None · 4 steps · 3688→2164 tok · 32058 ms · $0.00291
thread enron: 4 pages in checkpoint (4 fetched this run, 0 before), paused, next node ['pick']
== part 2: resume ==
02:42:03 main        0 ▶ RUN  langgraph · gpt-oss-120b · crawl/enron: RESUME of thread enron (4 pages done, next node ['pick']): ...
02:42:04 enron_scandal  1 + spawn futures_contract (page)
...
02:43:09 main        1 ■ END  ok=True · 8 steps · 11072→5165 tok · 65946 ms · $0.00775
thread enron: 12 pages in checkpoint (8 fetched this run, 4 before), finished: max pages (12) reached
```

Answer in `data/enron/report.md`: the first weather derivative was Aquila Energy's July 1996 hedge for Consolidated
Edison; OTC trading began in 1997; Enron spread it through EnronOnline; CME listed weather futures in 1999. No
individual people are named, because the pages walked do not name any.

## How resume works and how it was checked

The graph is compiled with `SqliteSaver` and streamed with `durability='sync'`, so a checkpoint is on disk after every
node. `--stop-after N` breaks out of the stream after the N-th `walk`; Ctrl-C does the same through
`KeyboardInterrupt` (the node that was running is re-run on resume). `--resume` calls `stream(None, config)` on the
same `thread_id`, which continues from the saved `next` node. Picked links are resolved through redirects
(`action=query&redirects`) before they enter the frontier, so one page is never fetched under two names.

Checked: part 1 stopped with 4 pages and next node `pick`; `--show enron` listed the 4 visited pages and a 6-page
frontier; part 2 fetched 8 more (4 + 8 = 12), and the final checkpoint has 12 visited titles, 12 unique. The resumed
run writes a new trace file whose `run_start` input begins `RESUME of thread enron`. An earlier run also failed
mid-walk on a schema error and was resumed from the `walk` node after the fix, without refetching.

## Decisions taken without the owner

- Goal reworded from "...and name the people involved" to "...the first deal, where they came to be traded, and the
  companies and people involved": the Wikipedia pages on this chain name companies, not people.
- Frontier is depth-first: the newest picks go to the front. Simple, but it drifts (see below).
- The excerpt is the first 700 chars of the lead plus the sentences that match the most goal words, 1,500 chars total.
  Candidate links: titles sharing a goal word first, then page order, at most 60.
- Agents are named by page slug; `steps` in `run_end` is pages fetched in that run, `pages_total` is the thread total.
- `run_end ok` is `null` for a paused run, `true` when the report was written.

## Limits, untested

- The walk drifts once the easy facts are found: after page 4 the Enron crawl wandered through generic finance pages
  until the 12-page cap. `goal_answered` never fired in any run. The penicillin example drifted badly (it ended in
  Springfield, Massachusetts) and its answer misses the lab; it is shipped as-is, not as a good example.
- Wikipedia answered HTTP 429 several times (about 20-45 s waits each); fetches back off and retry, and a page that
  still fails is recorded with `ok=false` and skipped. The saved trace shows 3 such failures.
- Ctrl-C was not tried by hand; only `--stop-after` was. Other models than `gpt-oss-120b` were not tried.
- Not checked on the screen (`bin/serve`); the trace follows `04-traces/SCHEMA.md` and `bin/replay --list` reads it.

## Cost

Six runs in testing (two broken, four complete): about 61k tokens in and 33k out on `gpt-oss-120b`, about $0.05 total
by `registry.cost`. One full 12-page crawl costs about $0.01 and takes 25 s to 2.5 min, mostly Wikipedia rate limits.
