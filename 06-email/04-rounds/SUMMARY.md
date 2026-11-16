## What the rounds showed

1. **The first schema made the two-model route the worst one.** v1 had a `requests` field, so the extractor listed
   "Register now" from a marketing email as a request, and the decision model, seeing only the extracted facts,
   called it `action` with high confidence. An extraction schema decides what evidence the decision model gets.
2. **Designing the schema for the decision model fixed it.** v2 split requests into personal requests and generic
   calls to action, added `written_for_recipient`, and passed the headers through. The two-model route went from
   56% of answered emails to 83%.
3. **Narrow questions with the policy in code helped the decision model alone.** v3 replaced one five-way choice
   with four yes/no questions and three lines of precedence code. Jev alone went from 73% to 82% on the dev set
   and its confidence started to separate right from wrong.
4. **Operations mattered as much as prompts.** A quarter of round 1's Mercury calls failed on the provider's
   requests-per-minute limit. Jev never failed a call in any round.

## With and without the decision model in between

On the 60 held-out emails, with the final schema (v3) and no failed calls:

- **With Jev in between (Mercury extracts, Jev decides): 82%. Without it (Mercury alone): 83%.** One email apart, so
  no difference in triage accuracy. The decision model in between did not make triage more accurate.
- What the two-model route costs: about twice the latency (1.6 s against 0.8 s) and twice the price ($0.36 against
  $0.19 per 1,000 emails).
- What it buys: the extracted facts as a reusable record (summary, personal requests, deadlines, meeting), and a
  confidence number per answer. On the dev set the confident half of its answers was 92% right and the other half
  71%, so the number can be used to send uncertain emails to a person or a larger model. Mercury alone gives no
  such number.
- **Jev alone: 75%** (45 of 60, against 50 for Mercury alone), in about 180 ms for about $0.04 per 1,000 emails:
  4 to 5 times faster and about 5 times cheaper than Mercury alone. It scored 82% on the dev emails its questions
  were tuned on, so part of that tuning did not carry over to new emails.
- The schema work carried over. The same held-out emails with the round-1 schema (v1) scored 65% / 78% / 60%
  (two-model / Mercury alone / Jev alone), against 82% / 83% / 75% with v3.

With 60 emails the 95% interval on each of these percentages is roughly plus or minus 10 points. The before/after
differences for the two Jev routes (15 to 17 points) are the only ones large enough to trust.

See each round's `NOTES.md` for the reasoning and `disagreements.md` for the emails.
