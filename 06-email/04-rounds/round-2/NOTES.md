# Round 2 notes (schema v2, the same 200 dev emails, 2026-11-16 02:21)

## What happened

- Failures went from 108 to 3 (one email, #152, where Mercury answers in prose even when asked twice).
  Fewer workers and more retries fixed the rate limiting. Cost: the batch took about 3 times longer.
- The three routes now agree with each other far more often (pairwise 79% to 84%, up from 60% to 70%).
- On the 60 gold dev emails: extract then Jev 83% (was 40%), Mercury alone 82% (was 55%), Jev alone 73% (was 62%).

## Read these numbers carefully

- Round 1's scores counted failed calls as wrong. On the emails it actually answered in round 1, Mercury alone
  was already at 82% (33 of 40). So for Mercury alone, round 2 fixed the plumbing, not the judgment.
- The extract-then-decide route did improve in judgment: 56% of answered emails in round 1, 83% in round 2. The
  schema change did that. `generic_calls_to_action` and `written_for_recipient` gave the decision model the
  evidence it was missing, and keeping the headers in its state gave it the rest.
- Jev alone went from 62% to 73% from the reworded, ordered label definitions only. Nothing else changed for it.
- All 10 remaining misses of the extract-then-decide route are emails the gold labeller marked as a close call
  between two labels. With the labeller's runner-up label also accepted, it scores 93%.

## What is still wrong

- `bulk` versus `info` for internal reports sent to distribution lists (#127, #2425, #2038). The headers only
  show a list name; nothing says how many people are on it.
- Social mail to many coworkers (#2461 farewell drinks, #2596 charity walk): gold says `personal`, the routes say
  `meeting` or `action`. The precedence is written into option text, and a five-way choice does not reliably
  apply an ordering.
- Confidence is high on some wrong answers (#2784 `action` at 1.0). It reflects how concentrated the choice was,
  not whether the precedence rule was applied.

## Change for round 3 (schema v3)

Same extraction schema. The decision changes shape: four narrow yes/no questions (is it bulk, is it personal, is
it mainly scheduling, is something asked of the recipient) in one Jev request, and the precedence moves into
code (`compose()` in `02-schema/v3.py`). This is the shape the decision model's own guidance recommends: narrow
judgments, policy in code.
