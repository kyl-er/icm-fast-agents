# Round 1 (heldout): where the routes disagree

Schema v1. 60 emails. All routes agree on 58%.

| id | subject | extract+jev | llm | jev | jev conf (facts / raw) | gold |
|---|---|---|---|---|---|---|
| 17 | FW: Eili lilly | action | info | action | 0.94 / 0.75 | (held out) |
| 93 | Start Date: 12/22/01; HourAhead hour: 17; | bulk | bulk | info | 0.82 / 0.52 | (held out) |
| 161 | Request Closed: Access Request for jason.wolfe@enr | info | bulk | info | 0.98 / 0.41 | (held out) |
| 249 | Re: morning | action | personal | personal | 0.54 / 0.61 | (held out) |
| 267 | Start Date: 10/19/01; HourAhead hour: 1; <CODESITE | info | bulk | info | 0.99 / 0.46 | (held out) |
| 353 | Re: Gallup Station - Demand Rebate | meeting | meeting | action | 0.71 / 0.52 | (held out) |
| 384 | Re: Need your approval - Generic ID Request -- 2nd | info | info | action | 0.99 / 0.61 | (held out) |
| 425 | RE: Try Diane Taylor | info | info | action | 0.9 / 0.55 | (held out) |
| 620 | Re: Have you heard? | personal | info | action | 0.94 / 0.36 | (held out) |
| 676 | FW: Thanks and All the Best | info | info | action | 0.98 / 0.51 | (held out) |
| 737 | Start Date: 3/31/01; HourAhead hour: 15; <CODESITE | bulk | bulk | info | 0.77 / 0.39 | (held out) |
| 1000 | Re: Hey | personal | personal | action | 0.89 / 0.87 | (held out) |
| 1180 | Updated: Mtg. to discuss MSA change request for EW | action | meeting | meeting | 0.42 / 1.0 | (held out) |
| 1287 | Start Date: 3/1/01; HourAhead hour: 3; <CODESITE> | info | bulk | info | 0.87 / 0.52 | (held out) |
| 1482 | FW: Move Related Issues | action | bulk | action | 0.99 / 0.94 | (held out) |
| 1513 | Start Date: 2/7/02; HourAhead hour: 5; | meeting | bulk | info | 0.57 / 0.57 | (held out) |
| 1805 | Start Date: 2/28/01; HourAhead hour: 8; <CODESITE> | bulk | info | info | 0.79 / 0.5 | (held out) |
| 1857 | even though this | info | personal | personal | 0.76 / 0.75 | (held out) |
| 1987 | FERC Proposes Major Changes to California's Wholes | bulk | info | bulk | 0.95 / 0.92 | (held out) |
| 2291 | Sta.2 outage | info | bulk | info | 1.0 / 0.51 | (held out) |
| 2536 | daily hoil & unlded cahrts 11/26 | action | bulk | info | 0.71 / 0.54 | (held out) |
| 2570 | RE: fundies website | info | action | info | 0.96 / 0.77 | (held out) |
| 2770 | Employee Meeting Postponed | meeting | bulk | meeting | 0.71 / 0.54 | (held out) |
| 2829 | PIRA's Gas Flash Weekly 08/16/00 | info | bulk | info | 1.0 / 0.98 | (held out) |
| 2917 | Re: I FINISHED! | action | personal | personal | 0.82 / 0.31 | (held out) |

## Which labels get confused

- bulk / info: 9
- action / info: 5
- action / personal: 3
- action / meeting: 2
- action / info / personal: 1
- action / bulk: 1
- bulk / info / meeting: 1
- info / personal: 1
- action / bulk / info: 1
- bulk / meeting: 1

## Failures

none
