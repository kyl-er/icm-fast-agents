# fd
use-when: live search of one folder tree by name, extension, age, size or type.
not-for: whole-disk name lookups (use plocate) or text inside files (use rg).
## commands
```bash
fd -t f -e toml . ~/03-Projects | head -n 20                     # files by extension
fd -HI -t f 'models.toml' ~/03-Projects | head -n 20             # include hidden, ignored files
fd -t f --changed-within 2h . ~/03-Projects/ai-infra | head -n 20  # recently changed files
fd -t f -g 'SKILL.md' ~/02-Agents | wc -l                        # count exact glob matches
fd -t f -S +50M . ~ | head -n 20                                 # find files over 50MB
```
## output
One path per line (directories end with `/`); `wc -l` gives a count.
## gotchas
Pattern is a regex on the file name; use `-g` for a glob, `.` to match everything.
Hidden and gitignored files are skipped unless you add `-HI`.
Argument order is `fd PATTERN DIR`, not `fd DIR`.
