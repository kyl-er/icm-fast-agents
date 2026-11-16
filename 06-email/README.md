# 06-email: the in-depth demo

A fast model reads an email into a typed schema; a small decision model answers narrow questions over that
schema; code turns the answers into a label. Run a batch, look at where the routes disagree, fix the schema, run
again. Three rounds are recorded here, then a held-out test.

**Results: [`RESULTS.md`](RESULTS.md).** How the labels were made: [`05-gold/README.md`](05-gold/README.md).

| Path | What it is |
|---|---|
| `01-ingest/ingest.py` | Builds `data/emails.sqlite`: 3,000 Enron emails (2,800 dev, 200 held out), attachments stripped, with a full-text index. |
| `02-schema/v1.py`, `v2.py`, `v3.py` | One file per round: the pydantic extraction schema, the extraction prompt, the decision questions. Each file's docstring says what changed and why. |
| `03-pipeline/pipeline.py` | The pipeline as a LangGraph graph with three routes (below). Every email is one traced run. |
| `03-pipeline/analyze.py` | One round's results to metrics and a disagreement list. |
| `03-pipeline/report.py` | All rounds to `RESULTS.md`. |
| `04-rounds/round-N/` | `results.jsonl` (every answer, with the extracted facts), `metrics.json`, `disagreements.md`, `NOTES.md` (what was learned and what was changed). |
| `05-gold/` | 120 reference labels and the rules they follow. |
| `data/` | The database (not in git; rebuild with the ingest script) and `SOURCE.md`. |

## The three routes

```
extract+jev   email -> Mercury 3 fills EmailFacts -> Jev answers 4 yes/no questions -> code picks the label   (with the decision model)
llm           email -> Mercury 3 answers directly                                                             (without it)
jev           email -> Jev answers the same questions on the raw email                                        (decision model alone)
```

Mercury 3 is Inception's fast chat model. Jev is TypeSafe's "System One" decision model: it does not write text,
it returns a choice, a yes/no probability or a score for each typed question, in about 200 ms.

## Run it

```bash
# one email through all three routes, printed step by step (about 5 seconds, about $0.0006)
.venv/bin/python 06-email/03-pipeline/pipeline.py one 2813 --schema v3

# a round: 200 dev emails x 3 routes (about 5 minutes, about $0.12)
.venv/bin/python 06-email/03-pipeline/pipeline.py run --round 4 --schema v3 --n 200
python3 06-email/03-pipeline/analyze.py --round 4
python3 06-email/03-pipeline/report.py
```

Expected output of the first command: for each route a `▶ RUN` line, `◆ LLM` with the extracted JSON (routes
with Mercury), `◈ DECIDE jev triage = bulk (conf 0.96)`, `■ END`, then one JSON line with the label, and for the
first route the extracted facts. Email 2813 is a conference promotion; all three routes say `bulk`.

Needs `INCEPTION_API_KEY` and `TYPESAFE_API_KEY`, and the database:

```bash
uv run --with pyarrow python 06-email/01-ingest/ingest.py     # about 12 minutes; downloads one 232 MB shard, then deletes it
```

## Watch it on the screen

Start `bin/serve`, open the page, then run the "one email" command or a round. Each email appears in the Email
lane as a run with an LLM node and a decision node. A red end node means the label differs from the gold label.

## Not done / stubbed

- The gold labels are from an AI model, not a person. Nobody has audited them.
- No Gmail export was found on the machine, so this is the public Enron corpus only.
- Urgency is produced by every route but there are no gold labels for it, so it is not scored.
- The ingest script's own download step was not exercised end to end (the shard was fetched with `curl` first).
- Email #152 fails extraction every time (the model answers in prose). It is counted as a miss.
