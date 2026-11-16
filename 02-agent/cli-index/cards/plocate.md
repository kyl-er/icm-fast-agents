# plocate
use-when: you know all or part of a file name and want it anywhere on disk, in milliseconds.
not-for: files made since the last index rebuild, or searching inside files (use rg).
## commands
```bash
plocate -c -b models.toml                                  # count matches by name
plocate -b -l 20 -e Cargo.toml                             # exact basename, existing only
plocate -i readme | grep /03-Projects/ | head -n 20        # case-insensitive, then narrow folder
plocate -b -i -r '^agents\.md$' -l 20                      # regex on basename only
plocate -l 20 '~/02-Agents/*SKILL.md'              # glob on full path
```
## output
One absolute path per line; `-c` prints a single number.
## gotchas
Index is rebuilt by a timer (last: today 00:36); new files are missing, so fall back to `fd -HI`.
`-l N` stops after N hits before any `| grep`; to filter by folder, drop `-l` and use `| head -n 20` at the end.
`-r` regex is slow (3.6 s vs 0.01 s); prefer plain substrings or `-b`.
