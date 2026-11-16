# fetchmd
category: web
use-when: you have a URL and need its text as markdown
not-for: finding which URL to read (use websearch)
## commands
fetchmd https://example.com 1500                      # first 1500 chars
fetchmd https://en.wikipedia.org/wiki/Enron 6000 | rg -i -m5 'bankrupt'   # fetch then filter
fetchmd https://example.com 20000 > scratch/page.md && wc -l scratch/page.md   # save as markdown
## output
`# <title>`, `source: <url>`, then the page text. Ends with `...[cut at N of M chars]` when capped.
## gotchas
Second argument is the character cap (default 3000). For a long page, raise the cap and pipe into rg.
To save a whole page use a cap of 200000. After saving, `head -n 5` the file: an error page is a failed scrape.
