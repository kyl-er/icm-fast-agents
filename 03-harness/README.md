# 03-harness: the loop that runs the agent

Two harnesses run the same agent: same context (`02-agent/`), same two tools (`bash`, `card`), same sandbox rules,
same tasks, same trace lines. Pick with `bin/agent --harness rig|langchain`; the default is rig when its binary
exists, otherwise LangChain.

| Path | What it is |
|---|---|
| `rig/` | **Primary.** Rust, [rig](https://github.com/0xPlaygrounds/rig) 0.46 (`rig-core` + `rig-agent`). Binary: `rig/target/release/rig-agent` (16 MB). |
| `langchain/agent.py` | **Fallback.** Python, LangChain 1.5 `create_agent` (a ReAct loop on LangGraph). Always works after `uv sync`. |
| `common.py` | Shared by Python code: system prompt, sandboxed shell, cards, tasks, grading, result rows. |
| `check.py` | Grades a run for non-Python harnesses (the rig binary pipes its row into it), so grading and cost live in one place. |
| `trace.py` | Trace emitter (`04-traces/SCHEMA.md`) and the one-line-per-event terminal format. |

## Run

```bash
bin/agent --list                                   # the nine example tasks
bin/agent --task files-1                           # rig, Mercury 3
bin/agent --task web-2 --harness langchain         # the fallback
bin/agent --task memory-1 --model gpt-oss-120b --via groq
bin/agent "which folder here is the biggest?" --category files
```

Expected output: one line per event on stderr (`▶ RUN`, `◆ LLM 528 ms · 760→71 tok`, `→ bash`, `← bash 36 ms ok`,
`■ END ok=true · 3 steps`), the answer on stdout, then one JSON result row on stderr. A files task takes 1 to 4
seconds on Mercury 3. `--record` appends the row to `07-bench/results.jsonl`.

## Build rig

```bash
cd 03-harness/rig && cargo build --release    # Rust >= 1.97; first build about 6 minutes and 530 MB in target/
```

## The sandbox

Every `bash` call runs inside bubblewrap: the whole filesystem is read-only except `./scratch/`, key files and
secret directories (`~/.ssh`, `~/.claude`, `~/.config/icm-agent-demo`, ...) are hidden, the environment is cleared.
The Python harness falls back to a plain subprocess when `bwrap` is missing (or `NO_SANDBOX=1`); the rig harness
has no fallback and reports that the sandbox could not start.

## What happened when rig was wired (2026-11-16)

- Ported from the earlier `icm-agent-demo/harness-rs/rig-ember` crate; compiled first time, 5 min 36 s.
- Mercury 3 sometimes calls a CLI command (`websearch`) as if it were a tool. rig fails the run on an unknown
  tool by default. Fix: an `on_invalid_tool_call` hook that tells the model to use `bash`, plus
  `max_invalid_tool_call_retries(3)`. LangChain returns the error to the model by itself.
- All nine tasks passed on both harnesses with Mercury 3 after that. Numbers are in `07-bench/`.
