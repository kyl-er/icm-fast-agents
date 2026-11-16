# rg
use-when: you know words that are inside the file, or need a fast file list of a tree.
not-for: searching by file name across the whole disk (use plocate).
## commands
```bash
rg -l -i 'kaneo' ~/03-Projects/ai-infra -g '*.md' | head -n 20               # files containing a word
rg -n --max-columns 150 'def main' ~/03-Projects/ai-infra/ctx -t py | head -n 20  # matching lines, short
rg -c 'import' ~/03-Projects/ai-infra/ctx/src -t py | sort -t: -k2 -rn | head -n 10  # files ranked by hits
rg -n -C 1 --max-columns 150 'class ' ~/03-Projects/ai-infra/icm-fast-agents -t py | head -n 20  # hits with context
rg --files ~/03-Projects/ai-infra -g '*.toml' | head -n 20                  # list files, no search
```
## output
`-l`: paths. `-n`: `path:line:text`. `-c`: `path:count`. Context lines use `-` instead of `:`.
## gotchas
Skips hidden and gitignored files; add `--hidden` or `-uu` to include them.
Always cap with `-l`, `-c` or `--max-columns 150`; minified files can print huge lines.
No match exits with code 1 and prints nothing; that is not an error.
