# DEMO: what to type, what you will see, what to say

Six parts, about 12 minutes, plus optional extras in part 7. Every command is run from the repo root:

```bash
cd ~/03-Projects/ai-infra/icm-fast-agents
```

Parts 1, 2 (replay only), 5 and 6 work with no network. Parts 2 (live), 3 and 4 call the model providers.

**Before you present** (one minute):

```bash
python3 01-config/registry.py list | head -5     # each line should end in a provider name, not "NO KEY"
bin/agent --task files-1 --quiet                 # prints one sentence with "01-config/models.toml" and "39"
curl -s http://127.0.0.1:8978/v1/health | head -c 80; echo   # the memory tasks need this service; skip them if it is down
```

If Mercury answers "429 rate limit" (Inception allows few requests per minute), wait a minute or add
`--model gpt-oss-120b` to any `bin/agent` command.

---

## 1. The folder is the program (2 min, no network)

```bash
ls
cat 02-agent/AGENTS.md
cat 02-agent/cli-index/INDEX.md
cat 02-agent/cli-index/cards/fd.md
```

**Expected:** seven numbered folders; a 20-line prompt with two tools and seven rules; an index with one line per
command in three groups (files, memory, web); one card of about 25 lines with copy-paste commands.

**Say:** "This is the whole agent. A 750-token prompt, an index with one line per command, and a card it reads
only when it needs that command. To teach it something new I add a card. No code."

## 2. One fast agent, in the terminal (2 min)

```bash
bin/agent --list
bin/agent --task files-1
bin/agent --task memory-1
bin/agent --task web-2 --harness langchain
```

**Expected:** for each run, one line per event: `▶ RUN rig · mercury-3 · files/files-1`, then `◆ LLM 577 ms ·
919→76 tok · bash({"cmd":"fd ..."})`, `→ bash`, `← bash 16 ms ok`, and `■ END ok=true · 3 steps · ... ms · $0.0005`,
then the answer. `files-1` answers "`01-config/models.toml` ... 39 entries" in 1 to 4 seconds. `memory-1` names
the matching past session by id and date (it needs the ctx service; see Requirements in the README). `web-2` says Enron filed for bankruptcy in 2001 and was based in
Houston; it takes 6 to 40 seconds because fetching the Wikipedia page takes most of it.

**Say:** "Each model call is about half a second. The first two ran on rig, a Rust agent library; the third on
LangChain, the fallback. Same folder, same tools, same trace lines. A run costs about a twentieth of a cent."

No network? Use `bin/replay files_1` or `bin/replay web_2` instead (the saved memory run is not shipped: it held private session titles): the same lines from
saved traces, with the original timing.

## 3. Watch it work: the screen (3 min)

```bash
bin/serve          # leave it running; Ctrl-C stops it
```

Open **http://127.0.0.1:8990**.

1. Under **Replay**, choose "All web runs", press **16x**, then **Replay**.
2. Under **Run live**, choose `files-2`, model `mercury-3`, harness `rig`, press **Run**. Then `memory-2`.
3. Click any node: a drawer shows the full command and its output.
4. Type a request into "Or write a prompt…", for example `which folder in this repo is the biggest?`, pick `files`, press **Send**.

**Expected:** top left, the Vox panel says "Needs DEEPGRAM_API_KEY — voice is off" (true: there is no key).
Bottom left, the same event lines as in the terminal, streaming. Right, one lane per task family; each run grows
downward: a black run node, a node per model step with its milliseconds and tokens, tool calls hanging to the
side (blue dashed while running, solid when done, red if the command failed), then an end node with total time
and cost. The strip on top counts runs, model calls, tool calls, tokens and dollars.

**Say:** "Every box is one JSON line the agent wrote. The page only draws lines; live and replay are the same code."

**Not working, by design:** the microphone. Voice needs a Deepgram key and a token endpoint that is not built;
`05-screen/README.md` says exactly what is missing. The "type instead" box works.

## 4. The email demo (4 min)

Keep the screen open. In a second terminal:

```bash
.venv/bin/python 06-email/03-pipeline/pipeline.py one 2813 --schema v3
```

**Expected:** three runs appear in the Email lane and in the terminal. Route 1: `◆ LLM` with the extracted JSON
(`sender_kind: mailing_list_or_marketing`, `generic_calls_to_action: ["Register for The LDC Forum", ...]`), then
`◈ DECIDE jev triage = bulk (conf 0.9)` in about 200 ms. Route 2: Mercury alone says `bulk`. Route 3: Jev alone
says `bulk` in about 200 ms. Then the extracted facts are printed.

**Say:** "A conference promotion. Mercury reads it into a typed schema; Jev, a decision model that returns
probabilities and no text, answers four yes/no questions over that schema in 200 milliseconds; three lines of
code turn the answers into a label."

Then the flywheel. Show the first schema and what it got wrong:

```bash
sed -n 1,40p 06-email/04-rounds/round-1/NOTES.md
diff <(sed -n '/^class EmailFacts/,/^EXTRACT/p' 06-email/02-schema/v1.py) <(sed -n '/^class EmailFacts/,/^EXTRACT/p' 06-email/02-schema/v2.py) | head -40
sed -n 1,20p 06-email/RESULTS.md
```

**Expected:** the round 1 notes ("the extract-then-decide route was the worst, and the reason is the schema");
a diff where `requests` becomes `personal_requests` plus `generic_calls_to_action` and `written_for_recipient`
appears; then the held-out table:

| On 60 held-out emails | First schema (v1) | Final schema (v3) | Latency | Per 1,000 emails |
|---|---|---|---|---|
| Mercury extracts, Jev decides | 65% | 82% | 1.6 s | $0.36 |
| Mercury alone | 78% | 83% | 0.8 s | $0.19 |
| Jev alone | 60% | 75% | 0.18 s | $0.04 |

**Say:** "Round one, the two-model route was the worst: the schema had a `requests` field, so 'Register now' in a
newsletter became a request and the decision model called it an action item. We split that field, ran again,
then moved the precedence rules out of the prompt into code. On emails it had never seen, the two-model route
went from 65 to 82 percent. With and without the decision model in between is a tie on accuracy, 82 against 83.
What the decision model adds is a confidence number and a reusable record. On its own it is five times faster
and five times cheaper, at 75 percent."

**Say this too, it is true:** "The 120 reference labels were written by an AI model, Claude Opus, reading each
email blind to the pipeline's answers. No person has checked them. With 60 emails, a few points either way is noise."

To show a whole batch flowing through the graph (about 1 minute, about $0.03):

```bash
.venv/bin/python 06-email/03-pipeline/pipeline.py run --round 9 --schema v3 --split heldout --n 40
```

**Expected:** 120 small runs stream down the Email lane; finished ones collapse to one line each. A red one means
the label differs from the gold label (only emails that have one).

## 5. Numbers (1 min, no network)

```bash
python3 07-bench/summary.py
python3 07-bench/summary.py --by task | head -20
cat 07-bench/SPEND.md | head -8
```

**Expected:** one line per harness and model with success rate, median seconds, steps, tokens and cost per run;
then the same split by task family; then the total API spend of the build night (under one dollar).

**Say:** "One row per run, in a file. Same nine tasks, six models, two harnesses."

## 6. No network at all (30 s)

```bash
bin/replay --list
bin/replay email-r0-extract_jev-2813 --speed 0
python3 -m http.server 8000 -d 05-screen/dist     # then open http://127.0.0.1:8000 : replay only, no server needed
```

**Say:** "Saved traces are in git. The page is a static bundle; any file server shows the replays."

---

## 7. Extras, if there is time (each about 1 minute)

Keep `bin/serve` running and the page open for all of these.

**Swarm: one orchestrator plans, N agents each build one component** (Rust, swarms-rs; about 3 seconds, under a cent)

```bash
bin/swarm-demo 3
bin/swarm-demo 6
```

**Expected:** in the Swarm lane, an orchestrator step, then one `spawn agent-N` box per component with its own
model call and a `write_component` box, then `assemble` and `done`. The terminal ends with
`■ END ok=true · ... ms` and the path of the assembled page, `09-swarm/out/<run>/index.html` (open it in a browser).
**Say:** "The orchestrator's plan is structured JSON: each agent gets only the shared contract and its own
component. Six agents take barely longer than three (about 2.8 against 2.1 seconds), because they run at the same time."

**Space view: the same events as cells in deep space.** On the page press **Space**, then run `bin/swarm-demo 6` and a `files` task.

**Expected:** a dark canvas with stars; each run is a translucent cell with a bright nucleus that swells on every
model step; tool calls are small nodes with a pulse travelling out and back; the swarm's six agents bud off the
orchestrator as daughter cells on filaments. Drag to orbit, wheel to zoom.
**Say:** "Same JSON lines, third way of looking at them."
**Know this:** it has only been seen through software rendering in a headless browser. It has not been tried on this machine's GPU or with a 100-plus-run email batch on screen.

**The 40-second film:** `11-video/icm-fast-agents.mp4` (8-bit, silent, captions only; play it with `mpv 11-video/icm-fast-agents.mp4`).

**Context view: how little the agent reads.** On the page press **Context** (next to Graph), then run `files-1` or `files-3`.

**Expected:** a file tree of the repo; the files the agent touches light up with the command and step that touched
them; on top, a meter such as "1,225 tokens in the last prompt · the repo is ~900,000 · 0.14%" (repo size is an estimate, bytes / 4).
**Say:** "It answered from about a thousand tokens of context. It never loaded the repo; it searched it."

**Wiki crawler as a resumable graph** (LangGraph with a checkpoint database). Live it takes 1 to 2 minutes because
Wikipedia rate-limits; for a talk, replay it: on the page choose "All crawl runs", 16x, Replay. Or in a terminal:

```bash
bin/replay enron --speed 16
bin/crawl-demo --stop-after 4      # live: stops after 4 pages, shows the checkpoint, resumes to the end
```

**Expected:** each Wikipedia page is a child agent of the page that linked to it, so the graph is a tree; the run
ends with a paragraph on how Enron connects to weather derivatives.
**Say:** "The traversal is a saved workflow. Stop it, resume it, and it continues from the checkpoint."
**Know this:** after the first four or five useful pages the walk drifts into generic finance pages. The second
shipped example (penicillin) drifts badly. `08-crawl/README.md` says so.

**A second job for the decision model: picking the command** (no screen needed)

```bash
cat 10-decide/router_eval.md
```

**Expected:** a table: on 40 labelled requests, Jev picks the right CLI card 37 times in about 190 ms; Mercury 37
in about 550 ms; gpt-oss-120b 38; GLM Flash 40 but in 1.4 s.
**Say:** "Routing is a decision, not a writing task. The decision model matches the chat models at a third of the latency."
The 40 requests and their expected cards were written by the agent that built this repo, not by a person.

**A third job: its confidence decides what goes to a big model**

```bash
cat 10-decide/escalate_eval.md
```

**Expected:** five rows on the 60 held-out emails: Jev alone 75% at $0.04 per 1,000; Jev with the unsure third
escalated to GPT-6.1 Terra 88% at $0.41; Terra on everything 90% at $0.99.
**Say:** "The decision model handles two thirds of the mail by itself in 200 milliseconds and knows which third it
is unsure about. That gets within two points of the big model for 41 percent of the cost."

---

## Provider setup

Keys are read by name from the shell environment, then `./.env`, then `~/.config/icm-agent-demo/keys.env`.
On this machine they are already in place. On another machine:

```bash
cp .env.example .env      # then edit .env; it is git-ignored
uv sync                   # Python dependencies
cd 03-harness/rig && cargo build --release && cd ../..     # optional: without it bin/agent uses LangChain
python3 01-config/registry.py list
```

| What you want to run | Key needed | Where to get it |
|---|---|---|
| The fast agent on its default model, and email extraction (Mercury 3) | `INCEPTION_API_KEY` | https://platform.inceptionlabs.ai/ |
| The decision model (Jev) | `TYPESAFE_API_KEY` | https://docs.typesafe.ai/ |
| gpt-oss-120b at Cerebras speed | `CEREBRAS_API_KEY` | https://cloud.cerebras.ai/ |
| Most other chat models | `OPENROUTER_API_KEY` | https://openrouter.ai/settings/keys |
| Celeris-1 | `CELERIS_API_KEY` | https://console.celeris.ai/ |
| gpt-oss on Groq (free tier is too rate-limited for agent runs) | `GROQ_API_KEY` | https://console.groq.com/ |
| Voice panel (not wired yet) | `DEEPGRAM_API_KEY` | https://console.deepgram.com/ |

Mercury is listed in the registry as shutting down on 2026-12-28. To move off it, pass `--model <alias>` to
`bin/agent`, and change `EXTRACTOR` at the top of `06-email/03-pipeline/pipeline.py`.

To rebuild the email database on a new machine: `uv run --with pyarrow python 06-email/01-ingest/ingest.py` (12 minutes).
To rebuild the screen: `cd 05-screen && npm install && npm run build`.

## Models

The full table (39 models, prices, routes, which have a key here) is [`docs/MODELS.md`](docs/MODELS.md),
generated from `01-config/models.toml`. The ones this demo uses:

| Alias | What it is | Used for | Price per 1M tokens in / out |
|---|---|---|---|
| `mercury-3` | Inception Mercury 3, a fast chat model | default agent model, email extraction | $0.10 / $0.35 |
| `jev` | TypeSafe Jev, a System One decision model (typed answers, no text) | email decisions | $0.042 / 0 |
| `gpt-oss-120b` | GPT OSS 120B on Cerebras | benchmark, fallback agent model | $0.35 / $0.75 |
| `gpt-oss-20b` | GPT OSS 20B via OpenRouter | benchmark | $0.075 / $0.30 |
| `celeris-1` | Celeris-1 | benchmark | $0.20 / $0.70 |
| `muse-ember` | Meta Muse Ember via OpenRouter | benchmark | $0.10 / $0.50 |
| `glm-53-flash` | GLM-5.3-Flash via OpenRouter | benchmark | $0.04 / $0.078 |

## What is stubbed or untested

- **Voice.** The panel is there; the microphone is off. No Deepgram key on this machine and no token endpoint.
- **Email gold labels** are from an AI model and unaudited.
- **Memory tasks** only work where the ctx service runs.
- **Wiki crawler:** works and resumes, but the walk drifts off topic after a few pages.
- **Decision-model use cases:** email triage, command routing and the confidence gate exist. Routing is not wired into `bin/agent`; the gate is an offline evaluation.
- **The film** is silent (no Deepgram key for a voice-over) and its graph scene is a stock clip. Nobody has watched it end to end.
- **Space view** was only checked through software rendering.
- **Mintlify docs:** not done. Publishing to a hosted site needs your yes.
