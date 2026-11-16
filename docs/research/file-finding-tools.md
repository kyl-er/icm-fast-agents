---
title: File finding tools for a small bash-only agent
type: research
tags: [cli, search, agents, file-finding]
date: 2026-11-16
---

# File finding tools for a small bash-only agent

Goal: find things on disk fast, with small output, using only a bash tool.

Machine: Arch / Omarchy, 2026-11-16. Times are wall clock (`time`) from one run each, on a warm cache
unless marked "cold". **Measured** = I ran it on this machine. **Read** = taken from docs or project
pages, not checked here. Nothing was installed for this note.

Installed versions: fd 10.5.0, ripgrep 15.2.0, plocate 1.1.25 (database 62 MB, last rebuilt
2026-11-16 00:36), fzf 0.74.3, eza 0.23.5, tree 2.3.2, bat 0.26.1, zoxide 0.10.0, jq 1.8.2.
Not installed: fsearch, ast-grep, ripgrep-all, broot, ugrep, television, dust, ncdu, any embedding grep (ck, qmd, mgrep, semtools).

## Ranked table

| # | Tool | Here | Best at | Canonical command | Measured | Caveat |
|---|------|------|---------|-------------------|----------|--------|
| 1 | plocate | yes | Whole-disk filename lookup from an index (Linux "Everything") | `plocate -b -l 20 -e Cargo.toml` | `plocate -c models.toml` 0.010 s; `plocate -c .toml` 0.046 s (3068 hits, whole system) | Index is only as fresh as the last `updatedb` (a file made after 00:36 today was missing). `-r` regex is slow: 3.6 s. `-l` cuts results before any later `grep`. |
| 2 | fd | yes | Live filename search in a tree, by name, extension, age, size, type | `fd -t f -e toml . ~/03-Projects \| head -n 20` | `~/03-Projects` 0.13 s (25 files); with `-HI` 0.41 s (38); all of `~` with `-HI` 1.45 s, without 0.26 s | Skips hidden and gitignored files by default; add `-HI` to see them. |
| 3 | rg (ripgrep) | yes | Content search; `rg --files` also lists files fast | `rg -l -i 'kaneo' DIR -g '*.md' \| head -n 20` | `rg --files ~/02-Agents` 0.022 s (7498 files); `rg -l` over `~/02-Agents` 2.6 s cold, 0.50 s warm | Respects `.gitignore` like fd. Long lines flood context: use `-l`, `-c` or `--max-columns 150`. |
| 4 | fzf `--filter` | yes | Non-interactive fuzzy ranking of a path list | `rg --files DIR \| fzf -f "'icm-fast" \| head -n 5` | `rg --files ~/02-Agents \| fzf -f skillmd` 0.10 s total | Plain fuzzy terms match loosely and rank junk high; use `'exact` terms and `$` anchors. |
| 5 | git ls-files / git grep | yes | Tracked files only, no build junk; fastest inside a repo | `git -C REPO ls-files '*.py' \| head -n 20` | `ls-files` 0.003 s (147 files); `git grep -l` 0.005 s | Only inside a git repo with commits. Many folders here are not repos or have no commits (`ls-files` then prints nothing). |
| 6 | eza | yes | Shape of a folder: tree, sort by time or size, folder totals | `eza -T -L 2 --git-ignore DIR \| head -n 40` | `eza -T -L 2` 0.036 s; `eza -l --total-size -D ~/03-Projects/ai-infra` 0.85 s | Icons/colors off when piped, but use `--no-user --no-permissions` to keep lines short. |
| 7 | ctx (local, this machine) | yes | Meaning-based search over past sessions, notes, project files | `curl -s 'http://127.0.0.1:8978/v1/search?q=WORDS&k=5'` | HTTP API 0.29 s; `ctx search` CLI 1.33 s (hybrid) | Machine-specific service, not a general tool. Searches its own index, not the live disk. |
| 8 | tree | yes | Cheapest directory-only outline | `tree -d -L 2 --noreport DIR \| head -n 20` | `tree -d -L 3 ~/03-Projects` 0.008 s (727 lines) | No gitignore by default (`--gitignore` exists); output grows fast with `-L`. |
| 9 | find (-printf) | yes | Exact metadata filters and custom one-line output | `find DIR -maxdepth 3 -name '*.toml' -mmin -600 -printf '%TY-%Tm-%Td %s %p\n'` | 0.011 s; full `~/03-Projects` name scan 0.32 s | Slower than fd on big trees, but always present and fully scriptable. |
| 10 | du / stat | yes | Where the space is; one file's size and mtime | `du -sh DIR/* \| sort -rh \| head -n 5` | `du -sh ~/03-Projects/ai-infra/*` 0.47 s; `stat -c '%s %y %n' F` 0.001 s | `du` reads every file: slow on huge trees. |
| 11 | bat | yes | Read a line range after finding a file | `bat -r 1:40 --style=plain --paging=never --color=never F` | 0.005 s | Without `--paging=never --color=never` it can page or print escape codes. |
| 12 | zoxide | yes | Jump to folders the user visits often | `zoxide query -l \| head -n 20` | 0.032 s, but only 46 folders known; `zoxide query icm` found nothing | Only knows places the user `cd`'d into. Weak for agents. |
| 13 | ast-grep | no | Structural code search (find calls, functions by syntax tree) | `ast-grep -p 'def $F($$$)' -l py` | read | Needs install (`pacman -S ast-grep`). |
| 14 | ripgrep-all (rga) | no | rg inside PDFs, docx, zip, sqlite | `rga -l 'invoice' ~/Documents` | read | Needs install; first run builds an extraction cache. |
| 15 | fsearch | no | GUI "Everything" clone with its own index | (GUI) | read | Not useful to a bash-only agent; plocate covers the same need. |

Voidtools Everything itself is Windows-only (NTFS journal index). On Linux the equivalent for an agent
is plocate (indexed, whole disk) plus fd (live, one tree).

## Suggested order for a small agent

1. Know the name or part of it: `plocate -b -l 20 NAME`.
2. Not found or too new: `fd -HI NAME DIR | head -n 20`.
3. Know words inside: `rg -l WORDS DIR | head -n 20`.
4. Fuzzy guess: `rg --files DIR | fzf -f "'part other" | head -n 5`.
5. Understand a folder: `eza -T -L 2 --git-ignore DIR | head -n 40`.
6. Only meaning, no words: ctx API.

## Not installed but worth it

- ast-grep: syntax-aware code search and rewrite. https://github.com/ast-grep/ast-grep
- ripgrep-all: rg for PDFs, Office files, archives. https://github.com/phiresky/ripgrep-all
- ck: local semantic + BM25 grep, rg-like flags, has an MCP mode. https://github.com/BeaconBay/ck
- qmd: local hybrid search (BM25 + vectors + rerank) over markdown notes, CLI and MCP. https://github.com/tobi/qmd
- broot: tree browser with fuzzy search, folder sizes. https://github.com/Canop/broot
- television: fast fuzzy finder with "channels" for files, text, git. https://github.com/alexpasmantier/television
- dust: quick "what is big" view, a nicer du. https://github.com/bootandy/dust

## Agent-oriented repos / MCP servers

(Found with web search on 2026-11-16 unless marked "from memory". Not installed or tested here.)

- everything-search-mcp: one MCP over Everything (Windows), Spotlight (macOS), ripgrep/locate (Linux). https://github.com/kanishka-namdeo/everything-search-mcp
- everything-mcp: MCP for voidtools Everything, Windows only. https://github.com/elis132/everything-mcp
- mcp-ripgrep: MCP wrapper around rg. https://github.com/mcollina/mcp-ripgrep
- Serena: symbol-level code retrieval and editing over language servers, MCP. https://github.com/oraios/serena
- probe: code and markdown context engine for agents (rg + tree-sitter), CLI and MCP. https://github.com/probelabs/probe
- claude-context-local: local semantic code search MCP, AST chunking, hybrid search. https://github.com/tazhate/claude-context-local
- claude-context (Zilliz): semantic code search MCP backed by a vector DB (from memory). https://github.com/zilliztech/claude-context
- sgrep: local semantic/hybrid search for code and past agent sessions. https://github.com/XiaoConstantine/sgrep
- mgrep (Mixedbread): semantic grep for code, PDFs, images; uses Mixedbread's hosted index, so not local. https://github.com/mixedbread-ai/mgrep
- ast-grep MCP server (from memory). https://github.com/ast-grep/ast-grep-mcp

CLI cards for the top installed tools: `02-agent/cli-index/cards/`.
