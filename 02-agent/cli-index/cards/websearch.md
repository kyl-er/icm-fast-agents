# websearch
category: web
use-when: you need URLs for a topic and do not know the page yet
not-for: reading a page (use fetchmd)
## commands
websearch "rig rust agent framework" 5        # top 5 results
websearch "site:docs.rs rig-core Tool trait" 3 # limit to one site
## output
One line per result: `<n>. <title> | <url> | <snippet>`
## gotchas
Snippets can be out of date. Read the page with fetchmd before stating details.
