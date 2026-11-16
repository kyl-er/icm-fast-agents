# Gold labels: email triage (120 Enron emails)

`gold.jsonl` is the reference set that model outputs are scored against. It has one JSON line per email, 120 lines, sorted by `email_id`. Fields: `email_id`, `split` (dev/heldout, from `sample.json`), `triage`, `needs_reply`, `hard`, `alt` (runner-up label when `hard`, else null) and `why` (12 words or fewer).

## Who wrote them and how

- An AI model (Claude Opus 5.5, `claude-opus-5-5`) wrote the labels. It read every email itself, as `show.py` prints it: the headers plus the first 2,500 characters of the body, which is exactly what the models see.
- The labeller did not see any pipeline output (nothing under `04-rounds/`, `04-traces/` or `02-schema/`). No script, API or other model produced any label.
- **No human has checked these labels.** Treat them as a strong single-annotator reference, not as ground truth.

## Label definitions

Every label is judged from the point of view of **the recipient (the person in To:, the owner of the mailbox)**.

1. `triage`: exactly one of
   - `action`: the sender asks the recipient to do something or to answer a question (a request, a question needing an answer, a task, an approval, "please review/send/call/confirm")
   - `meeting`: the email is mainly about scheduling or logistics of a meeting, call or event (invitations, time changes, "are you free", dial-in details, calendar notices)
   - `info`: work information with nothing asked of the recipient: a report, status update, FYI, forwarded material, an answer to an earlier question, a thank-you
   - `bulk`: a newsletter, automated notification, system-generated message, or an announcement sent to many people (company-wide memos, mailing lists, marketing)
   - `personal`: not about work: family, friends, jokes, private plans, chit-chat

   Tie-break rules (apply in this order): if it is mass/automated → `bulk` even if it contains a generic call to action; else if not about work → `personal` even if it asks something; else if mainly about arranging a meeting/call/event → `meeting` even though it asks for a confirmation; else if anything is asked of the recipient → `action`; else `info`.
2. `needs_reply`: true if the sender plainly expects the recipient to write back (a question, a request to confirm, RSVP), else false.
3. `hard`: true if the triage label was a genuinely close call between two labels, else false. If hard, the runner-up label is in `alt`.
4. `why`: at most 12 words.

## Distribution

| split | action | meeting | info | bulk | personal | hard | needs_reply |
|---|---|---|---|---|---|---|---|
| dev (60) | 11 | 3 | 17 | 22 | 7 | 25 | 9 |
| heldout (60) | 9 | 3 | 19 | 20 | 9 | 18 | 9 |
| total (120) | 20 | 6 | 36 | 42 | 16 | 43 | 18 |

## Judgement calls worth knowing

- Automated messages that ask the recipient to act (overdue approval reminders 2698 and 2873, the survey 2788) are `bulk` under the first tie-break rule. All three are marked hard, with `alt: action`.
- Internal reports or instructions sent to large distribution lists (127, 837, 2615, 300, 1482, 1973, 2425) are `bulk`, marked hard, with `alt: info` or `alt: action`.
- Emails with almost no usable content, where the label is a guess: 64 (body is only "see attachment"), 369 and 1934 (a bare link), 839 (signature only), 862 (a name fragment), 2045 (empty forward), 2580 (only an MSN footer), 2291 ("1 more time!"). All are marked hard.
