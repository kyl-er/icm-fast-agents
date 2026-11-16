# Round 1 notes (schema v1, 200 dev emails, 2026-11-16 02:18)

Numbers: `metrics.json`. Disagreements: `disagreements.md`. Raw rows: `results.jsonl`.

## What happened

- The three routes gave the same label on only 27% of emails.
- **A quarter of the Mercury calls failed.** 56 of 200 extractions and 52 of 200 direct answers errored, almost all
  HTTP 429 "too many requests per minute" from Inception at 8 parallel workers. A few were "schema validation
  failed": the model answered in prose instead of calling the function. Jev had 0 failures in 200.
- On the 60 gold-labelled dev emails (failures count as wrong): Jev alone 62%, Mercury alone 55%, Mercury extract
  then Jev 40%.
- **The extract-then-decide route was the worst, and the reason is the schema.** Its most common mistake (7 of the
  gold misses) was mass mail labelled `action`. v1 has a `requests` field, so the extractor dutifully listed
  "Register for the LDC Forum" or "Contact Ruby Kyser with questions" as requests; the decision model then saw an
  email with requests and no sign that it was a mailing, and said `action` with 0.9+ confidence. The extraction
  had thrown away the evidence (sender address, recipient list) that marks bulk mail.
- Second pattern: meeting invitations labelled `action` because "attend the meeting" was extracted as a request.
- All three routes confuse `bulk` and `info` for internal reports sent to big distribution lists. The gold
  labeller marked most of those as hard too.
- The label definitions did not say which label wins when two fit. The gold labels follow a written precedence
  (bulk, then personal, then meeting, then action, then info); v1 gave the models no such order.

## Changes for round 2 (schema v2)

1. Operations: 4 workers instead of 8, 8 retries with backoff on the Mercury client, one re-ask when the model
   answers in prose.
2. Label definitions state their precedence, in the labeller's order.
3. `requests` split into `personal_requests` and `generic_calls_to_action`; new `written_for_recipient`;
   `sender_kind` and `audience` descriptions say how to judge them; `meeting.recipient_must_respond`.
4. The decision model's state keeps the from / to / subject headers next to the extracted facts.
