# Round 2: where the routes disagree

Schema v2. 200 emails. All routes agree on 72%.

| id | subject | extract+jev | llm | jev | jev conf (facts / raw) | gold |
|---|---|---|---|---|---|---|
| 52 | NNG Measurement Log thru 03/22/02 | action | info | action | 0.7 / 0.85 |  |
| 64 | OneOk Meeting | action | meeting | meeting | 0.8 / 0.6 | info |
| 127 | Final Name Change Report-November 2001 | info | bulk | info | 0.96 / 0.73 | bulk |
| 150 | RE: Let's go to the cirque | personal | action | meeting | 0.2 / 0.74 | personal |
| 152 | RE: | ERROR | ERROR | personal | None / 0.96 |  |
| 169 | Nationwide Insurance | info | bulk | info | 0.99 / 0.95 |  |
| 252 | Fw: The One Dollar Bill | info | bulk | info | 0.44 / 0.37 |  |
| 257 | FW: Sitara Reporting system down time | info | bulk | info | 0.61 / 0.76 |  |
| 261 | MAPP (Cooper) | action | bulk | info | 0.84 / 0.87 | bulk |
| 470 | Liquidated Damages Pertaining to May 11 Gas Day | action | info | info | 0.99 / 0.85 |  |
| 481 | RE: Couple of Questions | action | info | info | 0.57 / 0.92 |  |
| 488 | RE: Children's Church schedule | personal | personal | info | 0.5 / 0.79 |  |
| 520 | RE: Alligator Alley Stock Sale Agreement | action | info | info | 0.99 / 0.87 |  |
| 739 | Re: george rustay | personal | info | info | 0.51 / 0.57 |  |
| 756 | A Plausible Future for Power Generation | bulk | bulk | meeting | 0.98 / 0.55 |  |
| 822 | FW: Texas Trading 2002 Expense Budget | info | info | action | 0.92 / 0.65 | action |
| 837 | Name change | bulk | bulk | action | 0.85 / 0.65 | bulk |
| 866 | TW November 2001 Transportation Invoices Outstandi | info | bulk | info | 0.81 / 0.99 |  |
| 971 | Request Submitted: Access Request joe.stepenovitch | info | bulk | bulk | 0.4 / 0.91 |  |
| 981 | Fwd: Fw: Friend Test | personal | bulk | personal | 0.95 / 0.86 |  |
| 1014 | FW: Meeting - Friday, September 21st | meeting | bulk | meeting | 0.41 / 0.61 |  |
| 1199 | FW: Oct 23 Teleconference - Your Availability ? | info | meeting | info | 0.57 / 0.54 |  |
| 1221 | FW: Correction to add day for Earth Sat's presenta | bulk | bulk | meeting | 0.46 / 0.32 | bulk |
| 1235 | Sale to L-P | action | info | info | 0.89 / 0.6 |  |
| 1299 | Re: THE OFFICIAL SNOW REPORT!!!!! | ERROR | personal | personal | None / 0.57 |  |
| 1323 | Congressman Bentsen and the Trade Promotion Author | action | bulk | action | 0.99 / 0.62 |  |
| 1545 | Mtg w/Rob Bradley, Director & Assoc. Jeff Gray | meeting | meeting | info | 0.75 / 0.86 |  |
| 1651 | FW: Inspirational Kids | personal | bulk | personal | 0.82 / 0.73 |  |
| 1654 | Organizational Changes | bulk | info | bulk | 0.98 / 0.71 |  |
| 1882 | RE: Quote- CGAS | action | action | info | 0.95 / 0.39 |  |
| 1903 | Re: FW: Saturday Tunnel pics | action | personal | action | 0.95 / 0.4 |  |
| 1960 | RE: Organizational Announcements | info | bulk | info | 0.95 / 0.55 | info |
| 1985 | FW: FROM BILLY LEMMONS - Chad Garren / Summer Inte | info | bulk | bulk | 0.89 / 0.54 |  |
| 1986 | Re: 449614 Airam Arteaga SAP Security Request Form | action | bulk | action | 0.95 / 0.62 |  |
| 2007 | RE: Comments needed-Janet Dougherty (101601) Rozyc | info | info | action | 1.0 / 0.34 | info |
| 2036 | Consultation for wisdom teeth | personal | personal | info | 0.77 / 0.41 |  |
| 2038 | FW: SOUTHERN CALIFORNIA LONG-TERM REGIONAL TRANSMI | info | bulk | meeting | 0.77 / 0.36 | bulk |
| 2045 | FW: | info | bulk | info | 1.0 / 0.98 | info |
| 2084 |  | info | bulk | info | 1.0 / 0.87 |  |
| 2225 | Financial Power Issue | bulk | info | info | 0.87 / 0.81 |  |
| 2242 | Daily Charts 12/27 | bulk | bulk | info | 0.49 / 0.61 | bulk |
| 2276 | RE: September detail | action | info | info | 0.96 / 0.59 | action |
| 2294 | Re: Mark Haedicke's visit to London | info | meeting | meeting | 0.51 / 0.71 |  |
| 2330 | Re: GAME TONIGHT @ 7:30 | personal | personal | meeting | 0.45 / 0.49 |  |
| 2395 | FW: slut......serves her right haha | personal | personal | info | 0.99 / 0.54 |  |
| 2418 | FW: NYS Reliability Council - Reliability Complian | info | meeting | meeting | 0.61 / 0.49 |  |
| 2493 | Tragic News Update | info | bulk | info | 0.42 / 0.71 |  |
| 2535 | Edison Mission Marketing & Trading - EOL Status | action | info | action | 0.82 / 0.54 |  |
| 2546 | new democratic seal... | info | personal | bulk | 0.92 / 0.37 |  |
| 2563 | AGA for 11/24/00 is (146) W/D | bulk | bulk | info | 0.4 / 0.73 |  |
| 2566 | A website you want to make your favorites - | bulk | bulk | info | 0.99 / 0.69 |  |
| 2596 | American Heart Walk | action | bulk | action | 0.8 / 0.26 | personal |
| 2615 | EOL and Clickpaper Approvals for 11-26-01 | bulk | bulk | action | 0.44 / 0.52 | bulk |
| 2766 | SDG&E Emergency Motion for Bilateral Authority-Dra | info | info | action | 0.45 / 0.4 |  |
| 2784 | Demand Ken Lay Donate Proceeds from Enron Stock Sa | action | personal | action | 1.0 / 0.99 | bulk |
| 2964 | SPREADSHEETS FOR SAT, SUNDAY AND MONDAY | action | info | action | 0.69 / 0.47 |  |

## Which labels get confused

- bulk / info: 16
- action / info: 12
- action / bulk: 5
- info / personal: 4
- info / meeting: 4
- bulk / meeting: 3
- ERROR / personal: 2
- bulk / personal: 2
- action / personal: 2
- action / meeting: 1
- action / meeting / personal: 1
- action / bulk / info: 1
- bulk / info / meeting: 1
- meeting / personal: 1
- bulk / info / personal: 1

## Failures

- extract+jev #152: RuntimeError: schema validation failed: None
- llm #152: RuntimeError: schema validation failed: None
- extract+jev #1299: RuntimeError: schema validation failed: 5 validation errors for EmailFacts
summary
  Field required [type=missing, input_value={}, input_type=dict]
    For furt
