# 04-traces: every run as JSON lines

| Path | What it is |
|---|---|
| `SCHEMA.md` | The event format (v2). One JSON object per line. |
| `saved/` | Traces kept in git so the demo replays with no network. |
| `live/` | Where running agents write. Not in git. The screen tails this folder. |

One real line (a tool result from `saved/20261116-020613-langchain_files_1_mercury_3.jsonl`):

```json
{"v": 2, "ts": 1794823574.2222, "run": "20261116-020613-langchain_files_1_mercury_3", "agent": "main", "parent": null, "step": 1, "kind": "tool_end", "model": "mercury-3", "tool": "bash", "ms": 36, "ok": true, "output": "01-config/models.toml\n[exit 0]"}
```

```bash
bin/replay --list              # saved traces
bin/replay files_1             # print one with its original timing
bin/replay files_1 --speed 0   # no waiting
bin/replay web_2 --emit        # re-emit into live/ so the screen draws it as if it were running now
```

To keep a run: `cp 04-traces/live/<run>.jsonl 04-traces/saved/`. Saved traces of the memory tasks contain titles
and summaries of sessions from the machine they were recorded on; look before you share them.
