# Round 3 notes (schema v3, the same 200 dev emails, 2026-11-16 02:27)

Same extraction schema as v2. The decision is now four yes/no questions in one Jev request, with the
precedence (bulk, personal, meeting, action, else info) applied in code.

## What happened

- Jev alone on the raw email: 73% to **82%**. This is the route the change was aimed at, and it is the one that moved.
- Mercury extracts, Jev decides: 83%, unchanged. Its reply accuracy went from 93% to 98%.
- Mercury alone: 82% to 85%. **Its prompt did not change between rounds 2 and 3**, so this 3-point move is
  run-to-run noise (two emails). Treat any difference of that size here as noise.
- Confidence became useful. Splitting the gold emails at the median confidence: the confident half is 92% to 94%
  right, the other half about 70%, for both Jev routes. In round 2 a wrong answer could carry confidence 1.0.
- Of the misses, 7 of 10 (extract then Jev), 8 of 9 (Mercury alone) and 8 of 11 (Jev alone) are emails the gold
  labeller itself marked as a close call.

## What is still wrong

- Extract then Jev now over-calls `bulk` on personal mail sent to several friends (3 misses): `bulk` is checked
  first, and "sent to many people" fires before "personal" gets a chance.
- Internal reports to distribution lists are still a coin flip between `bulk` and `info` for every route.
- Email #152 still fails extraction: Mercury answers in prose twice.

## Why stop here

All three routes are within 3 points of each other and most remaining misses are close calls in the labels
themselves. Another round would be tuning to 60 dev labels. The next step is the held-out test.
