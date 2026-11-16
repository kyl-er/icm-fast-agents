# Round 3 (heldout): where the routes disagree

Schema v3. 60 emails. All routes agree on 63%.

| id | subject | extract+jev | llm | jev | jev conf (facts / raw) | gold |
|---|---|---|---|---|---|---|
| 17 | FW: Eili lilly | action | info | action | 0.5 / 0.48 | (held out) |
| 255 | Re: Hartford Ins. premium due | action | personal | action | 0.94 / 0.72 | (held out) |
| 300 | RE: EOL and Clickpaper Approvals for 11-16-01 | info | bulk | info | 0.34 / 0.44 | (held out) |
| 384 | Re: Need your approval - Generic ID Request -- 2nd | info | info | action | 0.86 / 0.68 | (held out) |
| 386 | Air Products Interruptible Proposal | bulk | meeting | meeting | 0.6 / 0.82 | (held out) |
| 425 | RE: Try Diane Taylor | info | info | action | 0.86 / 0.06 | (held out) |
| 451 | Trade Confirmation for Oct 17, 2001 | bulk | bulk | info | 0.86 / 0.58 | (held out) |
| 618 | RE: Recovery of H-1B Visa Fees | action | info | action | 0.7 / 0.68 | (held out) |
| 620 | Re: Have you heard? | info | info | personal | 0.74 / 0.02 | (held out) |
| 676 | FW: Thanks and All the Best | action | info | info | 0.34 / 0.06 | (held out) |
| 1581 | Re: San Francisco/Los Angeles/ Omaha | info | info | action | 0.88 / 0.1 | (held out) |
| 1615 | RE: | action | action | bulk | 0.04 / 0.32 | (held out) |
| 1630 | RE: Power Indices | action | action | bulk | 0.82 / 0.2 | (held out) |
| 1717 | BP Capital Energy Equity International Holdings 1, | info | info | action | 0.54 / 0.02 | (held out) |
| 1857 | even though this | personal | bulk | personal | 0.4 / 0.56 | (held out) |
| 1987 | FERC Proposes Major Changes to California's Wholes | bulk | info | bulk | 0.96 / 0.88 | (held out) |
| 2195 | EEI Master with PP&L Montana... | bulk | info | action | 0.0 / 0.14 | (held out) |
| 2570 | RE: fundies website | info | info | action | 0.78 / 0.14 | (held out) |
| 2599 | RE: People Finder | info | info | action | 0.9 / 0.32 | (held out) |
| 2683 | RE: FP&L | action | info | action | 0.74 / 0.14 | (held out) |
| 2829 | PIRA's Gas Flash Weekly 08/16/00 | info | bulk | bulk | 0.58 / 0.4 | (held out) |
| 2917 | Re: I FINISHED! | action | personal | personal | 0.16 / 0.26 | (held out) |

## Which labels get confused

- action / info: 10
- bulk / info: 4
- action / personal: 2
- action / bulk: 2
- bulk / meeting: 1
- info / personal: 1
- bulk / personal: 1
- action / bulk / info: 1

## Failures

none
