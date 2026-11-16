# API spend

Generated 2026-11-16 05:36 by `python3 07-bench/spend.py` from every traced run on this machine.
Tokens times the listed price in `01-config/models.toml`. An estimate, not a bill. Budget for the night was $10.

**Total: $0.91** over 2569 runs (4,521,246 tokens in, 1,043,241 out).

| What (category / harness / model) | Runs | USD |
|---|---|---|
| email / langgraph / mercury-3 | 1533 | 0.3705 |
| swarm / swarms-rs / gpt-oss-120b | 30 | 0.2088 |
| crawl / langgraph / gpt-oss-120b | 6 | 0.0458 |
| email / langgraph / jev | 767 | 0.0314 |
| files / langchain / mercury-3 | 24 | 0.0223 |
| memory / langchain / mercury-3 | 25 | 0.0219 |
| web / rig / gpt-oss-120b | 7 | 0.0206 |
| web / langchain / mercury-3 | 26 | 0.0181 |
| files / rig / celeris-1 | 6 | 0.0158 |
| files / langchain / gpt-oss-120b | 6 | 0.0154 |
| files / rig / muse-ember | 6 | 0.0151 |
| web / langchain / gpt-oss-120b | 6 | 0.0138 |
| files / rig / gpt-oss-120b | 8 | 0.0133 |
| files / rig / mercury-3 | 16 | 0.0129 |
| web / rig / mercury-3 | 20 | 0.0115 |
| memory / rig / mercury-3 | 12 | 0.0103 |
| memory / langchain / gpt-oss-120b | 6 | 0.0095 |
| memory / rig / celeris-1 | 6 | 0.0094 |
| web / rig / celeris-1 | 6 | 0.0085 |
| web / rig / muse-ember | 6 | 0.0081 |
| memory / rig / muse-ember | 6 | 0.0064 |
| memory / rig / gpt-oss-120b | 6 | 0.0062 |
| files / rig / gpt-oss-20b | 6 | 0.0027 |
| web / rig / gpt-oss-20b | 5 | 0.0026 |
| web / rig / glm-53-flash | 6 | 0.0024 |
| memory / rig / gpt-oss-20b | 6 | 0.0019 |
| memory / rig / glm-53-flash | 6 | 0.0016 |
| files / rig / glm-53-flash | 6 | 0.0013 |

Not in this table: a handful of untraced test calls made while building (model speed checks, three Jev test calls, the router eval) and the 60 larger-model calls of 10-decide/escalate.py: about $0.10 in total;
and the Claude helper agents used to build the repo, which run on the Claude Code subscription, not on these API keys.
