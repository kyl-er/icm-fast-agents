# 07-bench: numbers

One file, `results.jsonl`, one row per agent run. `summary.py` prints the table. `run.py` produces the rows.

This is our own runner, not promptfoo. Reason: each benchmark run is the real `bin/agent` command, so the
numbers describe exactly what the demo runs, and every row links to its trace by run id. promptfoo was not tried.

```bash
python3 07-bench/summary.py            # one line per harness x model
python3 07-bench/summary.py --by task  # split by task family (web, files, memory)
python3 07-bench/summary.py --md       # as a markdown table
python3 07-bench/summary.py --spend    # what the recorded runs cost
python3 07-bench/run.py --dry          # show the default matrix (6 models, 72 runs)
python3 07-bench/run.py --models mercury-3 --harness rig,langchain --repeat 3
bin/agent --task files-1 --record      # any single run can be recorded too
```

## Row format

One real row:

```json
{"date": "2026-11-16T02:23:44", "run": "20261116-022340-rig_web_2_gpt_oss_120b", "harness": "rig", "model": "gpt-oss-120b", "provider": "cerebras", "category": "web", "task": "web-2", "latency_ms": 3537, "steps": 3, "tool_calls": 2, "tokens_in": 3508, "tokens_out": 371, "error": null, "success": true, "cost_usd": 0.001506, "rate_limit_retries": 0}
```

| Field | Meaning |
|---|---|
| `date`, `run` | When, and the run id. The trace is `04-traces/live/<run>.jsonl`. |
| `harness` | `rig` or `langchain`. |
| `model`, `provider` | Registry alias and the route used. |
| `category`, `task` | Task family and id from `02-agent/tasks/tasks.toml`. |
| `success` | Did the final answer match the task's `expect` regexes (and file checks). `null` for free-text prompts. |
| `latency_ms` | Wall time of the whole run, tools included. |
| `steps`, `tool_calls` | Model turns and tool calls. |
| `tokens_in`, `tokens_out` | Summed over the run, as reported by the provider. |
| `cost_usd` | Tokens times the registry's listed price. An estimate, not a bill. |
| `error` | Why the run died, if it did. |
| `rate_limit_retries` | Times the runner re-ran the task after an HTTP 429 (only rows written by `run.py`). |

## Caveats

- One run per cell unless `--repeat` is used. A single run is an anecdote; fast models vary run to run.
- Success is a regex on the answer. It can pass a lucky answer and fail a correct one that is phrased differently.
- Web tasks depend on live sites and a free search endpoint, so their latency is mostly the network.
- A run that hits a provider rate limit is run again after a wait. The first attempt of this benchmark was thrown
  away because Groq's free tier and Inception (while the email batch was running) answered most runs with HTTP 429.
- The email pipeline has its own results in `06-email/RESULTS.md`. Total API spend for the build night, all
  runs included, is in `07-bench/SPEND.md` (`python3 07-bench/spend.py` regenerates it).
- Rows from the earlier `icm-agent-demo` mini harnesses (bare loop, pi) are not included: they ran a different task.
