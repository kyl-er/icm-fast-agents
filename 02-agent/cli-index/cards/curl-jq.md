# curl-jq
category: web
use-when: a URL returns JSON (an API) and you need a few fields
not-for: HTML pages (use fetchmd)
## commands
curl -s 'https://api.github.com/repos/0xPlaygrounds/rig' | jq '{stars: .stargazers_count, lang: .language}'   # pick fields
curl -s 'https://en.wikipedia.org/api/rest_v1/page/summary/Enron' | jq -r .extract | head -c 600               # page summary
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' https://example.com                                    # status and time
## output
JSON filtered by jq, or the raw text.
## gotchas
Always pass `-s`. Quote the URL. Add `-m 15` to cap the wait.
