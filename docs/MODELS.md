# Models

Generated from `01-config/models.toml` by `python3 01-config/registry.py docs`. Do not edit by hand.
Prices are USD per 1M tokens (input / output) as listed in the registry on 2026-11-15.
"Key here" says whether this machine had a key for at least one route when the file was generated.

## Chat models (agents)

| Alias | Name | Tier | Tools | Price in / out | Routes (preferred first) | Key here |
|---|---|---|---|---|---|---|
| `muse-ember` | Muse Ember (Meta) | fast | yes | $0.1 / $0.5 | openrouter:`meta/muse-ember`, vercel:`meta/muse-ember` | yes |
| `deepseek-v41-flash-1017` | DeepSeek V4.1 Flash 1017 | fast | yes | $0.15 / $0.6 | openrouter:`deepseek/deepseek-v4.1-flash-1017` | yes |
| `deepseek-v41-flash` | DeepSeek V4.1 Flash | mid-high | yes | $0.051 / $0.203 | openrouter:`deepseek/deepseek-v4.1-flash` | yes |
| `glm-53` | GLM-5.3 | fast | yes | $0.084 / $3.6 | openrouter:`z-ai/glm-5.3` | yes |
| `glm-53-flash` | GLM-5.3-Flash | mid | yes | $0.04 / $0.078 | openrouter:`z-ai/glm-5.3-flash` | yes |
| `glm-47` | GLM-4.7 | fast | yes | $0.4 / $1.75 | openrouter:`z-ai/glm-4.7` | yes |
| `muse-spark-open` | Muse Spark Open | fast | yes | $1.25 / $4.25 | openrouter:`meta/muse-spark-open` | yes |
| `qwen38-27b` | Qwen 3.8 27B | fast | yes | $0.99 / $1.49 | cerebras:`qwen-3.8-27b`, groq:`qwen/qwen3.8-27b`, openrouter:`qwen/qwen3.8-27b` | yes |
| `qwen38-flash` | Qwen 3.8 Flash | mid | yes | $0.15 / $0.47 | openrouter:`qwen/qwen3.8-flash` | yes |
| `gpt-oss-120b` | GPT OSS 120B | fast | yes | $0.35 / $0.75 | cerebras:`gpt-oss-120b`, groq:`openai/gpt-oss-120b`, openrouter:`openai/gpt-oss-120b` | yes |
| `gpt-oss-20b` | GPT OSS 20B | fast | yes | $0.075 / $0.3 | groq:`openai/gpt-oss-20b`, openrouter:`openai/gpt-oss-20b` | yes |
| `minimax-m27` | MiniMax M2.7 | fast | yes | $0.21 / $0.84 | openrouter:`minimax/minimax-m2.7` | yes |
| `llama-33-70b` | Llama 3.3 70B | fast | yes | $0.71 / $0.71 | openrouter:`meta-llama/llama-3.3-70b-instruct` | yes |
| `llama-31-8b` | Llama 3.1 8B | fast | yes | $0.02 / $0.04 | openrouter:`meta-llama/llama-3.1-8b-instruct` | yes |
| `nemotron-3-nano-30b` | Nemotron 3 Nano 30B A3B | fast | yes | $0.06 / $0.24 | openrouter:`nvidia/nemotron-3-nano-30b-a3b` | yes |
| `lfm3-17b` | LFM3-1.7B (Liquid) | small | yes | $0.08 / $0.2 | openrouter:`liquid/lfm-3-1.7b`, openrouter:`liquid/lfm-3-1.7b:free` | yes |
| `lfm25-24b` | LFM 2.5 24B | small | yes | $0.05 / $0.7 | openrouter:`liquid/lfm-2.5-24b-a2b` | yes |
| `mercury-3` | Mercury 3 | fast | yes | $0.1 / $0.35 | inception:`mercury-3`, vercel:`inception/mercury-3` | yes |
| `celeris-1-magnus` | Celeris-1 Magnus | fast | yes | $0.2 / $0.7 | celeris:`celeris-1-magnus` | yes |
| `celeris-1` | Celeris-1 | fast | yes | $0.2 / $0.7 | celeris:`celeris-1` | yes |
| `hydrogen` | Gemini 4 Hydrogen | top | yes | $1.5 / $7.5 | gemini:`gemini-4-hydrogen`, openrouter:`google/gemini-4-hydrogen` | yes |
| `terra-61` | GPT-6.1 Terra | top | yes | $1 / $5 | openrouter:`openai/gpt-6.1-terra` | yes |
| `luna-6` | GPT-6 Luna | top | yes | $0.1 / $0.5 | openrouter:`openai/gpt-6-luna` | yes |
| `luna-56` | GPT-5.6 Luna | top | yes | $0.2 / $1.2 | openrouter:`openai/gpt-5.6-luna` | yes |
| `nex-n26` | Nex N2.6 | small | yes | $0.12 / $0.4 | openrouter:`nex-agi/nex-n2.6` | yes |
| `nex-n25-pro` | Nex N2.5 Pro | small | yes | $0.075 / $0.25 | openrouter:`nex-agi/nex-n2.5-pro` | yes |
| `nex-n25-mini` | Nex N2.5 Mini | small | no | $0.025 / $0.1 | openrouter:`nex-agi/nex-n2.5-mini` | yes |

## Other models (apply, decision, classifier, speech)

| Alias | Name | Kind | Price in / out | Routes | Key here |
|---|---|---|---|---|---|
| `morph-v3-fast` | Morph V3 Fast | apply | $0.8 / $1.2 | openrouter:`morph/morph-v3-fast`, vercel:`morph/morph-v3-fast` | yes |
| `morph-v3-large` | Morph V3 Large | apply | $0.9 / $1.9 | openrouter:`morph/morph-v3-large`, vercel:`morph/morph-v3-large` | yes |
| `relace-apply-3` | Relace Apply 3 | apply | $0.85 / $1.25 | openrouter:`relace/relace-apply-3` | yes |
| `celeris-11-decision` | Celeris-1.1 Decision | decision | $0.004 / $0 | celeris:`celeris-1.1-decision` | yes |
| `mercury-decide` | Mercury Decide | decision | $0.02 / $0 | inception:`mercury-decide` | yes |
| `gpt-oss-safeguard-20b` | Safety GPT OSS 20B | classifier | $0.075 / $0.3 | groq:`openai/gpt-oss-safeguard-20b`, openrouter:`openai/gpt-oss-safeguard-20b` | yes |
| `prompt-guard-86m` | Llama Prompt Guard 2 86M | classifier | $0.04 / $0.04 | groq:`meta-llama/llama-prompt-guard-2-86m` | yes |
| `prompt-guard-22m` | Llama Prompt Guard 2 22M | classifier | $0.03 / $0.03 | groq:`meta-llama/llama-prompt-guard-2-22m` | yes |
| `whisper-large-v3` | Whisper Large V3 | stt | n/a | groq:`whisper-large-v3` | yes |
| `whisper-large-v3-turbo` | Whisper Large V3 Turbo | stt | n/a | groq:`whisper-large-v3-turbo` | yes |
| `orpheus-v1-english` | Orpheus V1 English | tts | n/a | groq:`canopylabs/orpheus-v1-english` | yes |
| `orpheus-arabic-saudi` | Orpheus Arabic Saudi | tts | n/a | groq:`canopylabs/orpheus-arabic-saudi` | yes |

## Decision models (System One API)

| Id | Name | Model | Price per 1M in | Endpoint | Key here |
|---|---|---|---|---|---|
| `jev` | Jev (TypeSafe) | `jev-latest` | $0.042 | https://api.typesafe.ai/v1/systemone | yes |
| `celeris` | Celeris-1.1 Decision | `celeris-1.1-decision` | $0.004 | https://inference.celeris.ai/celeris-1-decision/v1/systemone | yes |

## Providers

| Provider | Base URL | Key variable | Get a key | Docs |
|---|---|---|---|---|
| openrouter | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` | https://openrouter.ai/settings/keys | https://openrouter.ai/docs |
| cerebras | `https://api.cerebras.ai/v1` | `CEREBRAS_API_KEY` | https://cloud.cerebras.ai/ | https://inference-docs.cerebras.ai/ |
| groq | `https://api.groq.com/openai/v1` | `GROQ_API_KEY` | https://console.groq.com/ | https://console.groq.com/docs |
| celeris | `https://inference.celeris.ai/{model}/v1` | `CELERIS_API_KEY` | https://console.celeris.ai/ | https://docs.celeris.ai/ |
| inception | `https://api.inceptionlabs.ai/v1` | `INCEPTION_API_KEY` | https://platform.inceptionlabs.ai/ | https://docs.inceptionlabs.ai/ |
| gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `GEMINI_API_KEY` | https://aistudio.google.com/apikey | https://ai.google.dev/gemini-api/docs/openai |
| vercel | `https://ai-gateway.vercel.sh/v1` | `AI_GATEWAY_API_KEY` | https://vercel.com/dashboard | https://vercel.com/docs/ai-gateway |
| morph | `https://api.morphllm.com/v1` | `MORPH_API_KEY` | https://www.morphllm.com/dashboard | https://docs.morphllm.com/ |
