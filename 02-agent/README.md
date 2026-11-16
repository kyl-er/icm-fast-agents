# 02-agent: everything the fast agent knows

This folder is the agent's whole context. Change a file here and the agent behaves differently; no code changes.

| Path | What it is |
|---|---|
| `AGENTS.md` | The system prompt: two tools, seven rules. |
| `cli-index/INDEX.md` | One line per CLI command, grouped by family. Appended to the system prompt. Generated. |
| `cli-index/cards/*.md` | One card per command: when to use it, 3 to 5 copy-paste commands, gotchas. The agent reads a card with its `card` tool only when it needs one. |
| `cli-index/build_index.py` | Regenerates `INDEX.md` from the cards. Run it after adding a card. |
| `tools/` | Three small commands written for this demo: `websearch`, `fetchmd`, `ctxq`. Stdlib Python, on the agent's PATH. |
| `tasks/tasks.toml` | Nine runnable example tasks (3 web, 3 files, 3 session memory) with the regexes that grade them. |

The system prompt is about 750 tokens. That is the "minimum context" point of the demo: an index line costs
about 20 tokens, a card about 150, and the agent pays for a card only when it uses that command.

## Add a command

1. Write `cli-index/cards/<name>.md` in the same shape as the others (`category:` is `web`, `files` or `memory`).
2. Run every command on the card once yourself.
3. `python3 02-agent/cli-index/build_index.py`

## The tools

```bash
02-agent/tools/websearch "rig rust agent" 3     # no key; DuckDuckGo, falls back to Wikipedia search
02-agent/tools/fetchmd https://example.com 800  # page as markdown; uses the local `crawl` command if installed
02-agent/tools/ctxq search "cursor swarm" 3     # session memory; needs the ctx service on 127.0.0.1:8978
```

`ctxq` only works on a machine that runs the ctx service. On any other machine the three memory tasks fail; the
web and files tasks do not depend on it. File cards (`fd`, `rg`, `plocate`, `fzf`, `eza`, `git`) came from the
survey in `docs/research/file-finding-tools.md`.
