# fzf
use-when: you have a long list of paths and a fuzzy guess; `-f` ranks it without a UI.
not-for: interactive use (never run plain `fzf`, it waits for a keyboard).
## commands
```bash
rg --files ~/03-Projects/ai-infra | fzf -f 'ctx readme' | head -n 10        # fuzzy rank file list
fd -t d . ~/03-Projects | fzf -f "'icm-fast" | head -n 5                    # exact term, folders only
rg --files ~/02-Agents/Skills | fzf -f "'SKILL.md\$ research" | head -n 5   # anchored suffix plus word
plocate -b -i models.toml | fzf -f 'icm' | head -n 5                        # rank whole-disk hits
```
## output
The input lines that match, best match first, one per line.
## gotchas
`-f` / `--filter` is required for non-interactive use.
Plain terms match very loosely (letters in order); prefix with `'` for exact, end with `$` to anchor.
Space-separated terms must all match (AND).
