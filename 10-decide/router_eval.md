| Decider | Correct card | Median latency | Cost per 1,000 | Misses (want→got) |
|---|---|---|---|---|
| jev | 37/40 (92%) | 184 ms | $0.032 | plocate→fd; fd→git; fd→eza |
| llm:mercury-3 | 37/40 (92%) | 548 ms | $0.072 | plocate→fd; eza→INVALID; git→rg |
| llm:gpt-oss-120b | 38/40 (95%) | 395 ms | $0.233 | plocate→fd; fd→eza |
| llm:glm-53-flash | 40/40 (100%) | 1361 ms | $0.023 | none |
