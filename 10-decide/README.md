# 10-decide: two more jobs for the decision model

The email demo (`06-email/`) is the first decision-model use case. Here are the second, **routing a request to a
CLI card**, and the third, **using its confidence to decide which emails go to a larger model**.

| File | What it is |
|---|---|
| `router_cases.jsonl` | 40 requests, each with the card that should handle it. Written by the agent that built this repo, not by a person. |
| `router.py` | `eval`: each decider on the 40 requests. `agent`: the nine example tasks with and without Jev routing in front of the agent. |
| `router_eval.md`, `router_eval.jsonl` | Results of the last `eval`. |
| `escalate.py` | Use case 3: the confidence gate, on the 60 held-out emails. |
| `escalate_eval.md`, `escalate_answers.jsonl` | Its results, and the larger model's answer for each email. |

```bash
.venv/bin/python 10-decide/router.py eval                       # about 1 minute, about $0.02
.venv/bin/python 10-decide/router.py agent --repeat 2           # 36 agent runs, about 6 minutes, about $0.03
.venv/bin/python 10-decide/escalate.py                          # 60 calls to the larger model, about 1 minute, about $0.06
```

## Which card? (40 labelled requests, 10 cards, 2026-11-16)

| Decider | Correct card | Median latency | Cost per 1,000 | Misses (want→got) |
|---|---|---|---|---|
| Jev | 37/40 (92%) | 184 ms | $0.032 | plocate→fd; fd→git; fd→eza |
| Mercury 3 | 37/40 (92%) | 548 ms | $0.072 | plocate→fd; eza→INVALID; git→rg |
| gpt-oss-120b (Cerebras) | 38/40 (95%) | 395 ms | $0.233 | plocate→fd; fd→eza |
| GLM-5.3-Flash | 40/40 (100%) | 1361 ms | $0.023 | none |

Jev gets one typed question: a choice over the cards, with each card's `use-when` and `not-for` lines as the
criteria. It ties Mercury and is one request behind gpt-oss-120b, at a third to a half of the latency. The slowest
model was the only one with a perfect score. Three of 40 is 7.5 points, so none of these gaps is meaningful.

## With and without the decision model in front of the agent

Without: the plain LangChain agent. With: Jev picks the card first (about 200 ms) and the card's text is added to
the prompt, so the agent does not spend a model turn reading it. Nine tasks, two runs each, Mercury 3.

| | Runs | Passed | Median latency | Mean model turns | Mean tokens in | Mean cost |
|---|---|---|---|---|---|---|
| Without Jev | 18 | 18 | 2.8 s | 4.0 | 5,936 | $0.00075 |
| With Jev routing | 18 | 18 | 2.3 s | 3.3 | 5,910 | $0.00076 |

By task family, mean model turns went from 4.0 to 2.3 (web) and 4.5 to 3.3 (memory), and from 3.5 **up** to 4.3
(files). For files the router picked `fd` or `rg` with confidence near 0.6, and the agent sometimes needed the
other one anyway. Latency includes the Jev call.

Read it as: routing in front saves about one model turn where the right command is obvious, costs nothing extra,
and does not help where the choice is a toss-up. Eighteen runs a side is a small sample; fast models vary run to run.

Rows are in `07-bench/results.jsonl` with harness `langchain+jev` (and `langchain` for the plain runs).
The routing is only wired into this comparison script, not into `bin/agent`.

## Use case 3: confidence as an escalation gate (60 held-out emails, 2026-11-16)

Jev answers every email and says how sure it is. Confident answers are kept. Unsure ones go to a larger model
(GPT-6.1 Terra, `terra-61`, the same direct triage prompt Mercury gets). Jev's answers are the ones already recorded
in the held-out test; nothing was re-run for them.

| Policy | Sent to terra-61 | Triage accuracy | Median latency | Cost per 1,000 emails |
|---|---|---|---|---|
| Jev alone (no gate) | 0 of 60 | 75% | 184 ms | $0.04 |
| Jev, escalate when confidence < 0.5 | 22 of 60 | 88% | 211 ms | $0.41 |
| Jev, escalate when confidence < 0.7 | 35 of 60 | 90% | 1737 ms | $0.62 |
| Jev, escalate when confidence < 0.9 | 50 of 60 | 90% | 2232 ms | $0.89 |
| terra-61 on everything (no gate) | 60 of 60 | 90% | 2613 ms | $0.99 |

0 of 60 calls to terra-61 failed or returned no label (counted as wrong where used).

With the gate at 0.5, 22 of 60 emails go to the large model and accuracy is 88%, against 90% for sending all 60,
at 41% of the cost; the median email is still answered in about 200 ms because most never leave Jev. Without the
gate you choose between 75% for $0.04 and 90% for $0.99 per 1,000.

Limits: the three thresholds are all shown and none was tuned on separate data, so treat 0.5 as an example, not a
setting. 60 emails; one email is 1.7 points. Gold labels are from an AI model (see `06-email/05-gold/README.md`).
Latency for escalated emails adds the two calls end to end.
