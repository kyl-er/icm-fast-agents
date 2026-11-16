# ctxq
category: memory
use-when: the answer is in a past agent session, chat, vault note or Kaneo task on this machine
not-for: the open web, or finding files by name
## commands
ctxq search "cursor swarm" 5            # ranked hits: id | date | kind | title
ctxq search "deepgram voice" 5 session  # only sessions (also: note, file, task)
ctxq show claude:00000000-0000-0000-0000-000000000000 | head -n 40   # short brief of one hit
ctxq read claude:00000000-0000-0000-0000-000000000000 around=12 | head -n 40   # transcript near turn 12
## output
search: one line per hit. show: `key: value` lines: title, date, outcome, `resume:` (the command that resumes the session), summary, intent.
## gotchas
Only three subcommands exist: search, show, read. Use the full id from search. Answer from `show` when you can; `read` is long. Name the id you used.
