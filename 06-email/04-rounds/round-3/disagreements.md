# Round 3: where the routes disagree

Schema v3. 200 emails. All routes agree on 71%.

| id | subject | extract+jev | llm | jev | jev conf (facts / raw) | gold |
|---|---|---|---|---|---|---|
| 20 | RE: Tuesday Morning | meeting | meeting | personal | 0.92 / 0.38 | meeting |
| 52 | NNG Measurement Log thru 03/22/02 | bulk | bulk | action | 0.56 / 0.08 |  |
| 85 | Re: NUI | info | info | action | 0.82 / 0.22 |  |
| 127 | Final Name Change Report-November 2001 | bulk | info | bulk | 0.7 / 0.0 | bulk |
| 152 | RE: | ERROR | personal | personal | None / 0.84 |  |
| 252 | Fw: The One Dollar Bill | info | bulk | personal | 0.04 / 0.34 |  |
| 261 | MAPP (Cooper) | action | bulk | info | 0.94 / 0.38 | bulk |
| 449 | Bilateral Contracts for SCE, PG&E and SDG&E - Quan | bulk | info | info | 0.06 / 0.66 |  |
| 456 | Forum Christmas Party | bulk | bulk | personal | 0.82 / 0.2 |  |
| 470 | Liquidated Damages Pertaining to May 11 Gas Day | action | action | info | 0.92 / 0.44 |  |
| 481 | RE: Couple of Questions | info | info | meeting | 0.66 / 0.06 |  |
| 488 | RE: Children's Church schedule | personal | personal | meeting | 0.72 / 0.08 |  |
| 496 | RE: Pre BP Meeting | info | info | action | 0.8 / 0.16 |  |
| 520 | RE: Alligator Alley Stock Sale Agreement | info | info | action | 0.5 / 0.06 |  |
| 542 | Telephone Number | personal | info | info | 0.24 / 0.62 |  |
| 645 | CPUC News -- From Press Conference as we Speak | bulk | info | info | 0.48 / 0.08 |  |
| 733 | Re: Access to Dealsheet folders | info | action | action | 0.44 / 0.74 |  |
| 739 | Re: george rustay | personal | info | personal | 0.38 / 0.04 |  |
| 822 | FW: Texas Trading 2002 Expense Budget | action | info | action | 0.42 / 0.5 | action |
| 981 | Fwd: Fw: Friend Test | bulk | personal | personal | 0.0 / 0.22 |  |
| 993 | STORAGE CAPACITY IN CAPACITY IN TEXAS(BROADER AREA | info | info | action | 0.92 / 0.6 |  |
| 1014 | FW: Meeting - Friday, September 21st | bulk | meeting | meeting | 0.76 / 0.08 |  |
| 1068 | RE: Kelly Brant Reves | info | info | action | 0.84 / 0.2 |  |
| 1133 | RE: education | info | info | meeting | 0.76 / 0.22 |  |
| 1199 | FW: Oct 23 Teleconference - Your Availability ? | meeting | info | meeting | 0.66 / 0.9 |  |
| 1221 | FW: Correction to add day for Earth Sat's presenta | meeting | bulk | bulk | 0.38 / 0.42 | bulk |
| 1235 | Sale to L-P | info | info | action | 0.58 / 0.32 |  |
| 1293 | i2 Technologies, Inc. | info | info | action | 0.76 / 0.04 |  |
| 1323 | Congressman Bentsen and the Trade Promotion Author | action | bulk | action | 0.82 / 0.14 |  |
| 1381 | FW: Index Option | info | info | action | 0.92 / 0.5 | info |
| 1532 | option candlesticks (including distillate & unlead | info | bulk | bulk | 0.44 / 0.32 |  |
| 1619 | Torch | info | action | action | 0.68 / 0.72 |  |
| 1650 | Portable PC | action | info | action | 0.52 / 0.74 |  |
| 1851 | RE: Rob Benson Pay Stub | info | info | action | 0.92 / 0.42 |  |
| 1884 | DJ US Northwest Pwr Forwards Higher On Water; SW 3 | bulk | bulk | info | 0.36 / 0.04 |  |
| 1960 | RE: Organizational Announcements | bulk | bulk | info | 0.2 / 0.18 | info |
| 1982 | ALL daily charts and matrices as hot links 10/24 | info | bulk | bulk | 0.28 / 0.46 | bulk |
| 1988 | *DJ Calif. PUC Approves Utilities Buying Pwr Out O | bulk | info | info | 0.56 / 0.54 | info |
| 2007 | RE: Comments needed-Janet Dougherty (101601) Rozyc | info | info | action | 0.58 / 0.28 | info |
| 2045 | FW: | info | bulk | info | 0.88 / 0.42 | info |
| 2084 |  | info | bulk | info | 0.62 / 0.64 |  |
| 2192 |  | bulk | info | bulk | 0.8 / 0.2 |  |
| 2276 | RE: September detail | action | info | action | 0.92 / 0.22 | action |
| 2395 | FW: slut......serves her right haha | ERROR | personal | personal | None / 0.56 |  |
| 2425 | AGA for 7/14/00 is 70 | bulk | bulk | info | 0.5 / 0.2 | bulk |
| 2459 | RE: | personal | meeting | personal | 0.66 / 0.84 |  |
| 2461 | Farewell Drinks | bulk | meeting | personal | 0.5 / 0.14 | personal |
| 2535 | Edison Mission Marketing & Trading - EOL Status | action | info | action | 0.82 / 0.56 |  |
| 2546 | new democratic seal... | personal | personal | info | 0.32 / 0.5 |  |
| 2563 | AGA for 11/24/00 is (146) W/D | bulk | info | action | 0.54 / 0.24 |  |
| 2566 | A website you want to make your favorites - | bulk | info | info | 0.52 / 0.54 |  |
| 2596 | American Heart Walk | bulk | personal | bulk | 0.08 / 0.2 | personal |
| 2615 | EOL and Clickpaper Approvals for 11-26-01 | bulk | bulk | info | 0.58 / 0.34 | bulk |
| 2656 |  | personal | bulk | personal | 0.6 / 0.28 |  |
| 2766 | SDG&E Emergency Motion for Bilateral Authority-Dra | info | info | action | 0.62 / 0.46 |  |
| 2878 | Re: Online Canadian GTC's | info | info | action | 0.92 / 0.1 | info |
| 2918 | Recap of 4 points we are to address | ERROR | action | action | None / 0.86 |  |
| 2964 | SPREADSHEETS FOR SAT, SUNDAY AND MONDAY | info | info | action | 0.26 / 0.36 |  |

## Which labels get confused

- action / info: 20
- bulk / info: 14
- bulk / personal: 4
- meeting / personal: 3
- info / meeting: 3
- info / personal: 3
- action / bulk: 2
- ERROR / personal: 2
- action / bulk / info: 2
- bulk / meeting: 2
- bulk / info / personal: 1
- bulk / meeting / personal: 1
- ERROR / action: 1

## Failures

- extract+jev #152: RuntimeError: schema validation failed: None
- extract+jev #2395: RuntimeError: schema validation failed: None
- extract+jev #2918: RuntimeError: schema validation failed: 2 validation errors for EmailFacts
written_for_recipient
  Field required [type=missing, input_value={'audience': 'many_
