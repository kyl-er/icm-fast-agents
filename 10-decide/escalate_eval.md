| Policy | Sent to terra-61 | Triage accuracy | Median latency | Cost per 1,000 emails |
|---|---|---|---|---|
| Jev alone (no gate) | 0 of 60 | 75% | 184 ms | $0.04 |
| Jev, escalate when confidence < 0.5 | 22 of 60 | 88% | 211 ms | $0.41 |
| Jev, escalate when confidence < 0.7 | 35 of 60 | 90% | 1737 ms | $0.62 |
| Jev, escalate when confidence < 0.9 | 50 of 60 | 90% | 2232 ms | $0.89 |
| terra-61 on everything (no gate) | 60 of 60 | 90% | 2613 ms | $0.99 |

0 of 60 calls to terra-61 failed or returned no label (counted as wrong where used).
