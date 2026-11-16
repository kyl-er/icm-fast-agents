# 09-swarm: one plan, N agents, one page

One orchestrator reads a small structured brief and writes a plan with exactly N components. N workers each build
one component at the same time, seeing only the shared contract and their own spec. Code stitches the pieces
together and checks them. Every call is a line in the trace, so the screen draws each worker under the orchestrator.

The point is structure, not size: a precise brief plus a precise plan lets a fast, cheap model (gpt-oss-120b on
Cerebras, about 0.5 s per worker call) build a page in about 2 to 4 seconds for under one cent.

```
brief.toml ─▶ orchestrator (1 call, JSON plan, re-asked once if invalid) ─▶ out/<run>/plan.json
                   │  agent_spawn × N
       governor: max parallel (default 4) + retry with backoff on HTTP 429
     ┌──────────┬──┴───────┬──────────┐
  agent-1    agent-2    agent-3  …  agent-N     swarms-rs agents, no tools, no memory: contract + own spec only
     └── out/<run>/components/<id>.html|md ─┘
                   │
assemble (code) ─▶ index.html or PRD.md ─▶ mechanical checks ─▶ report.json   (failed components redone once)
```

Built on **swarms-rs 0.3.0** (the same crate as `icm-agent-demo/harness-rs/swarm-demo`). Every agent is a
`SwarmsAgent` with no tools, one loop and no task-evaluator tool. The fallback with plain concurrent calls was not needed.

## Run it

```bash
(cd 09-swarm && cargo build --release)     # about 3 minutes the first time, shares 03-harness/rig/target
bin/swarm-demo 3                           # 3 agents, status-page UI brief
bin/swarm-demo 6                           # 6 agents, same brief
bin/swarm-demo 6 prd                       # 6 agents, one PRD section each
bin/swarm-demo 3 ui --model gpt-oss-120b --via groq --parallel 2 --out mytry
```

The binary is `03-harness/rig/target/release/swarm`:
`swarm --agents N [--model ALIAS] [--via PROVIDER] [--brief FILE] [--parallel 4] [--out NAME] [--no-redo] [--quiet]`.
Any chat alias in `01-config/models.toml` works for `--model`. Keys come from the same registry as the rig harness.
Event lines go to stderr; one JSON summary line goes to stdout.

Output, in `09-swarm/out/<run>/`: `plan.json`, `plan.raw1.txt` (the orchestrator's raw reply), `components/<id>.html`
(or `.md`), `index.html` (or `PRD.md`), `report.json`. Trace: `04-traces/live/<run>.jsonl`.

## What you see (real run, `bin/swarm-demo 3`, replayed with `bin/replay 20261116-024305-swarm_status_page_3 --speed 0`)

```
02:43:05 orchestrator  0 ▶ RUN  swarms-rs · gpt-oss-120b · swarm/status-page-3: A one-page status dashboard for the ICM ...
02:43:06 orchestrator  1 ◆ LLM  1190 ms · 1175→2331 tok · { "summary": "Split the page into three sequential fragments: ...
02:43:06 orchestrator  1 + spawn agent-one (header-health)
02:43:06 orchestrator  1 + spawn agent-two (models-runs)
02:43:06 orchestrator  1 + spawn agent-three (cost-footer)
02:43:07 agent-one     1 ◆ LLM  465 ms · 807→751 tok · <section class="fa-component" data-component="header-health"> ...
02:43:07 agent-one     1 ← write_component  0 ms ok · 640 bytes · ...
02:43:07 agent-two     1 ◆ LLM  717 ms · 1067→801 tok · <section class="fa-component" data-component="models-runs"> ...
02:43:07 agent-three   1 ◆ LLM  718 ms · 854→772 tok · <section class="fa-component" data-component="cost-footer"> ...
02:43:07 orchestrator  1 ← assemble  0 ms ok · 09-swarm/out/example-3/index.html
02:43:07 orchestrator  1 ■ END  ok=True · 4 steps · 3903→4655 tok · 1910 ms · $0.00486
```

Kept examples (committed): `out/example-3/`, `out/example-6/` (UI) and `out/example-prd-3/` (PRD). Their traces are
in `04-traces/saved/20261116-024305-swarm_status_page_3_gpt_oss_120b.jsonl` and `...024307-swarm_status_page_6_...jsonl`.

## Input: the brief

`briefs/status-page.toml` (UI) and `briefs/prd.toml` (document) have the same fields: `name`, `kind` (`ui` or `prd`),
`title`, `goal`, `audience`, `tone`, `class_prefix`, `must_show` (the list of things the result must contain, with the
real numbers) and `constraints` (rules every agent follows). Change the brief, not the code.

## The plan (real, from `out/example-3/plan.json`, first of three components)

```json
{
  "summary": "Split the page into three sequential fragments: (1) header with title, description, date and health summary; (2) models table followed by recent runs list; (3) cost panel and footer with trace info.",
  "shared": {
    "style_guide": "Use only black (#000), white (#fff) and grey (#777) colours. All text is system font ...",
    "css_variables": { "--fa-fg": "#000", "--fa-bg": "#fff", "--fa-gray": "#777", "--fa-space": "0.5rem" },
    "heading_levels": "The page title uses <h1>. Section headings inside components use <h2>."
  },
  "components": [
    {
      "id": "header-health",
      "owner": "agent-one",
      "purpose": "Render the page header (title, description, date) and the health summary line.",
      "spec": "A <section class=\"fa-component\" data-component=\"header-health\"> containing a <header> with class \"fa-header\". Inside the header: an <h1 class=\"fa-title\"> with the exact text \"Fast agents status dashboard\"; ...",
      "interfaces": ["Provides heading level h1 via fa-title; provides date string via fa-date; provides health line via fa-health"],
      "acceptance": [
        "Contains the text \"Fast agents status dashboard\"",
        "Contains the text \"2026-11-16\"",
        "Contains the text \"9 of 9 example tasks pass on the rig harness, 9 of 9 on the LangChain fallback\""
      ],
      "budget_bytes": 2500
    }
  ]
}
```

Validated in code before any worker starts: exactly N components, unique ids, non-empty `id`/`purpose`/`spec`,
at least one `interfaces` and `acceptance` entry, and `css_variables` present for a UI brief. Duplicate or empty
owner names are repaired (`agent-K`) instead of re-asked. On invalid JSON or a failed check the orchestrator is
asked once more with the error; this happened once in testing and the second plan was valid.

## Checks (code, no model)

Per component, written to `report.json`:

| Check | UI | PRD |
|---|---|---|
| non-empty, within `budget_bytes` (+25% grace) | yes | yes |
| root is `data-component="<id>"`; every `class` starts with `fa-` | yes | |
| no `<script>`, no external assets (`<link>`, `@import`, http src/href/url), no `<html>/<head>/<body>` | yes | |
| its `<style>` does not restyle the shell's `.fa-component` | yes | |
| starts with one `## ` heading, no `# `, no HTML | | yes |
| each acceptance sentence: every "quoted" string appears in the output (also matched against the visible text with tags removed) | yes | yes |

An acceptance sentence with no quoted string is reported as `not_checkable`. A run is `ok` when no check failed.
Failed components are sent back once to the same worker with the list of failed checks; the better attempt is kept.
There is no second loop and no model review call.

## Measured (2026-11-16, gpt-oss-120b on Cerebras, `--parallel 4`, final binary and brief)

| Run | Agents | Wall | Tokens in → out | Cost | Checks passed | Redo |
|---|---|---|---|---|---|---|
| status-page (example-3) | 3 | 1.9 s | 3,903 → 4,655 | $0.0049 | 47 / 47 | none |
| status-page | 3 | 3.0 s | 5,195 → 7,248 | $0.0073 | 35 / 36 | 1 component, still 1 fail |
| status-page | 3 | 2.1 s | 3,744 → 5,916 | $0.0057 | 42 / 42 | none |
| status-page (example-6) | 6 | 2.2 s | 5,545 → 5,828 | $0.0063 | 78 / 78 | none |
| status-page | 6 | 2.8 s | 6,004 → 7,417 | $0.0077 | 73 / 73 | none |
| status-page | 6 | 3.6 s | 6,672 → 7,181 | $0.0077 | 77 / 78 | 1 component, still 1 fail |
| prd (example-prd-3) | 3 | 2.3 s | 3,059 → 5,113 | $0.0049 | 36 / 36 | none |
| prd | 6 | 3.6 s | 5,387 → 8,192 | $0.0080 | 58 / 59 | 1 component, still 1 fail |

Medians: 3 agents 2.1 s, $0.0057; 6 agents 2.8 s, $0.0077. Six agents cost about a third more than three and take
under a second longer, because the workers run side by side: the orchestrator call (1.2 to 2.0 s, it reasons
before it writes the plan) is most of the wall time, each worker call is 0.5 to 0.9 s. Total test spend for all 25
runs during development: $0.18.

The three failures were real, not checker bugs: a plan quoted a whole five-row list as one acceptance string; a
worker restyled `.fa-component`; a PRD worker wrote HTML instead of Markdown. Earlier checker bugs found during
testing and fixed: `<header>` matched the `<head>` rule, nested quotes in acceptance text, and quoted table rows
that only exist as separate cells.

## Trace

Category `swarm`, harness `swarms-rs`. `run_start` (task = `<brief>-<N>`, input = the brief's goal), the
orchestrator's `llm_start`/`llm_end`, a `message` with the plan summary, one `agent_spawn` per component
(`child` = owner, `role` = component id, `input` = purpose and spec), then per worker its own
`llm_start`/`llm_end` and a `write_component` `tool_start`/`tool_end`, the `assemble` tool pair, and `run_end`
(`ok`, `steps` = model calls, tokens, `ms` wall, `cost_usd` from the price in `01-config/models.toml`, `output` = the
assembled file). Rate-limit waits and plan rejections are `message` events. Every line of every swarm trace written
during testing has `v, ts, run, agent, parent, step, kind, model` (checked with a script, 0 bad lines), and no key
appears in any of them. `bin/replay` plays them back.

## Decisions made (owner asleep)

- **swarms-rs for the agents, own code for scheduling.** swarms-rs `ConcurrentWorkflow` gives every agent the same
  task and has no rate limiting, so workers are run with `SwarmsAgent::prompt` under a small governor (tokio
  semaphore plus 2 s / 4 s / 8 s backoff on 429, as in cursor-swarm). swarms-rs's own retries are set to 1 so every
  retry is visible in the trace.
- **The model is wrapped, not replaced.** A `Traced` type implements swarms-rs's `Model` around its `OpenAI`
  provider and writes `llm_start`/`llm_end` with tokens, the same pattern as the earlier swarm demo.
- **JSON by prompt, not by `response_format`.** The swarms-rs OpenAI provider does not pass `response_format`, so the
  plan is asked for in the prompt, cut out of the reply between the first `{` and the last `}`, and validated.
- **`budget_bytes` added to the plan** so the size check is a number, not a sentence. Clamped to 800 to 12,000.
- **One redo pass driven by the mechanical checks** instead of a model review call: cheaper, deterministic, never loops.
- **Max tokens 8,000 for the plan, 6,000 per worker** (gpt-oss reasons before answering; the 2,000 provider default
  cut plans off). A provider cap below 2,000 (Groq's 900) is kept.
- **Brief data is static and partly illustrative**: the run list and cost figures in `status-page.toml` are sample
  numbers written into the brief so agents do not invent them. Without them the planner made up "$12.34".
- Shares `03-harness/rig/target` and starts from its `Cargo.lock`; depends on `rig-agent-demo` by path for
  `registry::resolve`, `trace::Trace`, `root()`. Nothing in `03-harness/rig/` was changed.

## Not done or not tested

- The 429 backoff path never triggered (no rate limit was hit), so it is untested. `--parallel 2` was run once and works.
- Only gpt-oss-120b on Cerebras was run. Other models and `--via` are untested.
- The live screen (`05-screen`) was not opened; only the trace format and `bin/replay` were checked.
- Checks are mechanical: they do not judge whether a page looks good. Two components may define the same class
  name (for example `fa-section-title`) with different styles; nothing checks for that collision.
- 24 agents (cursor-swarm's size) was not tried; `--agents` accepts 1 to 24.
- Disk: the build added about 560 MB to `03-harness/rig/target` (530 MB to 1,090 MB) and about 50 MB of crate sources.
