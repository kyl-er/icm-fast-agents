# ICM fast agents

Small, very fast models in a tiny harness, organised as a folder tree you can read, doing real chores: search and
scrape the web, find files, pull facts out of past agent sessions, triage email. Every model call and tool call is
one JSON line, and a local page draws those lines as a live graph.

**To show the demo, follow [`DEMO.md`](DEMO.md).** It has the exact commands, the expected output and one line to
say for each step.

## The idea in one screen

```
01-config/    which models exist and how to reach them        models.toml + one loader
02-agent/     everything the agent knows                      a 20-line prompt, a CLI index, one card per command
03-harness/   the loop that runs it                           rig (Rust, primary) and LangChain (Python, fallback)
04-traces/    every run as JSON lines                         live/ while running, saved/ for replay
05-screen/    the page that draws the traces                  voice panel, terminal pane, live node graph
06-email/     the in-depth demo                               Enron mail -> extraction schema -> decision model, 3 rounds
07-bench/     numbers                                         one row per run, one script for the table
08-crawl/     a wiki crawler as a resumable graph             LangGraph with a checkpoint database
09-swarm/     one orchestrator, 3 or 6 agents                 Rust, swarms-rs; each agent owns one component
10-decide/    two more jobs for the decision model            routing a request to a card; escalating unsure emails
11-video/     a 40-second 8-bit explainer film                silent, captions only
bin/          the commands you type                           agent, replay, serve, swarm-demo, crawl-demo
docs/         model table, file index, research
```

The agent's whole context is `02-agent/`: a system prompt of about 750 tokens that ends in an index with one line
per CLI command. When the agent needs a command it reads that command's card (about 150 tokens) and nothing else.
To teach it something new you add a card; you do not touch code. That is the ICM point: the folder is the program.

## Quick start

```bash
uv sync                                   # Python side (LangChain fallback, email pipeline)
cp .env.example .env                      # then fill in the keys you have (see DEMO.md, "Provider setup")
bin/agent --list                          # nine example tasks
bin/agent --task files-1                  # run one; prints one line per model call and tool call
bin/replay web_2                          # replay a saved run, no network needed
bin/serve                                 # the screen, http://127.0.0.1:8990
```

The rig harness needs one build: `cd 03-harness/rig && cargo build --release` (about 6 minutes the first time).
Until it is built, `bin/agent` uses the LangChain harness by itself.

## What is in the box

| Piece | State on 2026-11-16 | Where |
|---|---|---|
| Fast agent, rig harness (primary) | Works. 9 of 9 example tasks pass on Mercury 3. | `03-harness/rig/` |
| Fast agent, LangChain harness (fallback) | Works. 9 of 9 on Mercury 3. | `03-harness/langchain/` |
| CLI index: 10 cards, 3 small tools | Works. Every card command was run on this machine. | `02-agent/` |
| Tracing and replay | Works. | `04-traces/`, `bin/replay` |
| The screen | Works: live runs, replay, a Context view (file tree lighting up, token meter) and a Space view (three.js: each run a cell, tool calls as glowing pulses; seen only through software rendering so far). Voice panel shows "needs key": there is no Deepgram key on this machine, and voice is not wired. | `05-screen/`, `bin/serve` |
| Email demo | Works. Three rounds on 200 emails, held-out test on 60. Results and how they were checked: `06-email/RESULTS.md`. | `06-email/` |
| Benchmarks | Works. Our own runner, not promptfoo. | `07-bench/` |
| Swarm | Works. 3 and 6 agents on swarms-rs, about 3 seconds a run. Checks are mechanical; nobody judged how the page looks. | `09-swarm/`, `bin/swarm-demo` |
| Wiki crawler | Works and resumes from its checkpoint. The walk drifts off topic after a few pages. | `08-crawl/`, `bin/crawl-demo` |
| 8-bit explainer film | Rendered: 40 s, 1080x1920, silent (no Deepgram key for a voice-over). The graph scene is a stock clip, not the real trace graph. | `11-video/` |
| Two more decision-model use cases | Command routing and a confidence gate for escalation. Both work as evaluations; neither is wired into `bin/agent`. | `10-decide/` |

Anything not in this table was not built. `IDEAS.md` lists what was left out on purpose.

## Requirements

- Linux with `bubblewrap` (the agent's shell is sandboxed with it), `fd`, `ripgrep`, `plocate`, `jq`, `curl`.
- Python 3.11+ and [uv](https://docs.astral.sh/uv/). Rust 1.97+ for the rig harness. Node 20+ only to rebuild the screen.
- At least one model key. The demo defaults to Mercury 3 (`INCEPTION_API_KEY`); the email demo also needs
  `TYPESAFE_API_KEY` for the Jev decision model.
- The three "session memory" tasks need the ctx service of the machine this was built on (`127.0.0.1:8978`).
  Everything else is self-contained.

## Honest limits

- The email gold labels were written by an AI model reading each email, not by a person. See `06-email/05-gold/README.md`.
- The Mercury API (Inception) is listed in the registry as shutting down on 2026-12-28. Any other chat model in
  `01-config/models.toml` can replace it with `--model`.
- The saved trace of the session-memory task is not included here: it held titles of private sessions from the build machine. The memory tasks themselves need a ctx service of your own.
- This is a cleaned copy of a private working repository, published as a single commit. Internal planning files, the project vault and one private trace were left out.
