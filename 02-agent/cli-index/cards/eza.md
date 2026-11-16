# eza
use-when: you need the shape of a folder: tree, newest items, biggest items.
not-for: finding a file by name or content deep in a tree (use fd or rg).
## commands
```bash
eza -T -L 2 --git-ignore ~/03-Projects/ai-infra/icm-fast-agents | head -n 40   # two-level tree, no junk
eza -T -L 3 -D ~/03-Projects/ai-infra/icm-fast-agents | head -n 30            # folders only tree
eza -l -s modified -r --no-user --no-permissions ~/03-Projects/ai-infra | head -n 10  # newest items first
eza -l --total-size -s size -r -D --no-user --no-permissions ~/03-Projects/ai-infra | head -n 5  # biggest folders first
```
## output
Tree: `├──` lines. Long: `size date name` per line (`-` size for folders without `--total-size`).
## gotchas
`--total-size` reads every file below; 0.85 s here, slow on huge trees.
`-r` reverses the sort; without it oldest/smallest come first.
Keep `-L` small; trees grow fast.
