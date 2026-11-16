# 01-config: which models exist and how to reach them

| File | What it is |
|---|---|
| `models.toml` | The registry: providers (base URL, key variable), 39 models (alias, price, routes), 2 decision models. Edit this to add a model. |
| `registry.py` | The loader every harness uses. Stdlib only. |

```bash
python3 01-config/registry.py list      # every model and which providers have a key on this machine
python3 01-config/registry.py verify    # checks each route id against the provider's live model list (needs network)
python3 01-config/registry.py docs      # regenerates docs/MODELS.md
```

Keys are read by name from the shell environment, then `./.env`, then `~/.config/icm-agent-demo/keys.env`.
Copy `.env.example` to `.env` to set them. Key values are never printed or written to a trace.

In code: `base_url, key, model_id, opts = registry.resolve('mercury-3')`. All chat providers speak the OpenAI
chat-completions API, so one client works for all of them.
