# Trace format, v2

Every run, in any harness and any language, appends to one JSONL file: `04-traces/live/<run>.jsonl`.
One event per line. The screen, the replayer and the benchmark runner read only this format.
Traces worth keeping are copied to `04-traces/saved/` (committed), so the demo replays with no network.

## Fields on every event

| Field | Type | Meaning |
|---|---|---|
| `v` | int | Schema version, `2` |
| `ts` | float | Unix time in seconds, with fractions |
| `run` | string | Run id, same on every line of the file |
| `agent` | string | Id of the agent that produced the event (`main` for a single agent) |
| `parent` | string or null | Id of the agent that spawned it |
| `step` | int | Model turn within that agent, from 1 (`0` before the first turn) |
| `kind` | string | One of the kinds below |
| `model` | string or null | Registry alias of the model this agent runs on |

## Kinds and their extra fields

| `kind` | Extra fields |
|---|---|
| `run_start` | `harness` (`langchain`, `rig`, `pipeline`, `swarms-rs`, ...), `lang`, `provider`, `category` (`web`, `files`, `memory`, `email`, `crawl`, `swarm`, `bench`), `task` (task id), `input` (the task text) |
| `llm_start` | — |
| `llm_end` | `ms`, `tokens_in`, `tokens_out`, `output` (model text or the tool call it chose) |
| `tool_start` | `tool`, `input` |
| `tool_end` | `tool`, `ms`, `ok` (bool), `output` |
| `decision` | `tool` (decider id, e.g. `jev`), `node`, `choice`, `confidence`, `ms`, `input`, `output` |
| `agent_spawn` | `child`, `role`, `input` |
| `message` | `to`, `output` |
| `run_end` | `ok` (bool or null), `steps`, `tokens_in`, `tokens_out`, `ms` (wall time), `cost_usd`, `output` (final answer), `error` |

Rules

- `input` and `output` are short: cut at 1,500 characters by the emitter.
- Durations are milliseconds. Tokens are what the provider reported; `0` when it reported none.
- Key values are scrubbed before a line is written. Never write one.
- Unknown extra fields are allowed and must be ignored by readers.

Emitters: Python `03-harness/trace.py`; Rust `03-harness/rig/src/trace.rs`. Replay: `bin/replay`.
