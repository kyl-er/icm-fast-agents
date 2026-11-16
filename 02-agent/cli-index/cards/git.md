# git (ls-files, grep, log)
use-when: inside a git repo and you want only real source files, no build or vendor junk.
not-for: folders that are not git repos, or repos with no commits yet (output is empty).
## commands
```bash
git -C ~/03-Projects/media/vidpipe rev-parse --show-toplevel                  # is this a repo
git -C ~/03-Projects/media/vidpipe ls-files '*.py' | head -n 20               # tracked files by glob
git -C ~/03-Projects/media/vidpipe grep -n -I 'def main' -- '*.py' | head -n 20  # search tracked files only
git -C ~/03-Projects/media/vidpipe log --name-only --format= -n 5 | sort -u | head -n 20  # recently touched files
git -C ~/03-Projects/media/vidpipe ls-files --others --exclude-standard | head -n 20  # new untracked files
```
## output
Paths relative to the repo root; `git grep -n` gives `path:line:text`.
## gotchas
Run `rev-parse` first: "fatal: not a git repository" means use fd/rg instead.
A repo with no commits makes `ls-files` empty and `log` fail; use `ls-files --others`.
Paths are relative; prefix the repo path before reading them.
