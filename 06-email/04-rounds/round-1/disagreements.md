# Round 1: where the routes disagree

Schema v1. 200 emails. All routes agree on 27%.

| id | subject | extract+jev | llm | jev | jev conf (facts / raw) | gold |
|---|---|---|---|---|---|---|
| 20 | RE: Tuesday Morning | action | meeting | meeting | 0.51 / 0.62 | meeting |
| 52 | NNG Measurement Log thru 03/22/02 | action | info | action | 1.0 / 0.99 |  |
| 56 | CORRECTION: workshop in January, not June | action | info | action | 0.89 / 0.54 |  |
| 61 | good morning | action | personal | personal | 0.71 / 0.56 |  |
| 64 | OneOk Meeting | action | info | meeting | 0.92 / 0.45 | info |
| 74 | Thank you for your Contribution! Together we CAN c | bulk | bulk | info | 0.42 / 0.5 |  |
| 127 | Final Name Change Report-November 2001 | action | info | info | 0.94 / 0.35 | bulk |
| 150 | RE: Let's go to the cirque | personal | personal | meeting | 0.44 / 0.54 | personal |
| 152 | RE: | ERROR | ERROR | personal | None / 0.94 |  |
| 160 | RE: Lead Contact for Power Pool and Transmission S | action | info | info | 0.99 / 0.49 |  |
| 248 | Daily Outage Updates (excluding WSCC) | info | bulk | bulk | 0.99 / 0.65 |  |
| 257 | FW: Sitara Reporting system down time | bulk | info | action | 0.57 / 0.62 |  |
| 315 | WCC/EEI Conference | bulk | bulk | action | 0.6 / 0.61 |  |
| 419 | Failure to deliver power | info | action | action | 1.0 / 1.0 |  |
| 426 | RE: TX SET nominations and elections | action | info | action | 0.94 / 0.96 |  |
| 458 | Start Date: 2/5/02; HourAhead hour: 12; | bulk | bulk | info | 0.75 / 0.6 |  |
| 470 | Liquidated Damages Pertaining to May 11 Gas Day | action | action | info | 1.0 / 0.54 |  |
| 481 | RE: Couple of Questions | action | info | info | 0.6 / 0.54 |  |
| 488 | RE: Children's Church schedule | meeting | action | meeting | 0.37 / 0.54 |  |
| 496 | RE: Pre BP Meeting | info | info | action | 0.95 / 0.49 |  |
| 520 | RE: Alligator Alley Stock Sale Agreement | meeting | info | action | 0.45 / 0.46 |  |
| 588 | Weekend Outage Report for 12-14-01 through 12-16-0 | bulk | info | info | 0.8 / 0.68 |  |
| 630 | FW: Meeting on Wednesday, January 2 - 9:30 am | action | meeting | meeting | 0.59 / 0.74 | meeting |
| 699 | Start Date: 4/11/01; HourAhead hour: 15; <CODESITE | info | bulk | info | 0.89 / 0.5 | bulk |
| 733 | Re: Access to Dealsheet folders | action | info | action | 0.99 / 1.0 |  |
| 739 | Re: george rustay | action | info | info | 0.98 / 0.5 |  |
| 745 | PEP TOYS!!! | action | bulk | action | 0.87 / 0.82 |  |
| 756 | A Plausible Future for Power Generation | action | bulk | meeting | 0.45 / 0.87 |  |
| 819 | Standards Announcement - Determination of Availabl | info | info | bulk | 0.41 / 0.46 |  |
| 837 | Name change | bulk | info | action | 0.52 / 0.94 | bulk |
| 886 | <<Concur Expense Document>> - Anderson, John 1/31/ | action | bulk | action | 1.0 / 0.91 |  |
| 971 | Request Submitted: Access Request joe.stepenovitch | info | bulk | bulk | 0.95 / 0.42 |  |
| 981 | Fwd: Fw: Friend Test | personal | bulk | personal | 0.74 / 0.92 |  |
| 993 | STORAGE CAPACITY IN CAPACITY IN TEXAS(BROADER AREA | info | info | action | 1.0 / 0.44 |  |
| 998 | True Orange Fax/E-Mail #104 | bulk | bulk | info | 1.0 / 0.65 |  |
| 1011 | RE: Final Name Change Report for October 2001 | ERROR | action | action | None / 1.0 | action |
| 1014 | FW: Meeting - Friday, September 21st | action | meeting | action | 0.45 / 0.51 |  |
| 1030 | RE: | ERROR | action | action | None / 0.96 | action |
| 1063 | Re: Raptor | ERROR | action | action | None / 1.0 | action |
| 1068 | RE: Kelly Brant Reves | info | action | info | 0.52 / 0.47 |  |
| 1115 | FW: RTO Workshops | ERROR | info | info | None / 0.96 | info |
| 1133 | RE: education | ERROR | action | action | None / 0.79 |  |
| 1158 | Info Memo, Pictures, Maps | ERROR | info | info | None / 1.0 |  |
| 1185 | Save $10* during the Active Sports Mecca Anniversa | ERROR | ERROR | bulk | None / 0.99 |  |
| 1199 | FW: Oct 23 Teleconference - Your Availability ? | meeting | meeting | info | 0.82 / 0.44 |  |
| 1221 | FW: Correction to add day for Earth Sat's presenta | meeting | ERROR | meeting | 0.61 / 0.31 | bulk |
| 1235 | Sale to L-P | ERROR | info | action | None / 0.55 |  |
| 1259 | Start Date: 4/4/01; HourAhead hour: 9; <CODESITE> | ERROR | bulk | info | None / 0.61 |  |
| 1292 | TW Firm Contracts | ERROR | ERROR | info | None / 0.98 | info |
| 1293 | i2 Technologies, Inc. | ERROR | info | info | None / 0.84 |  |
| 1299 | Re: THE OFFICIAL SNOW REPORT!!!!! | ERROR | personal | action | None / 0.26 |  |
| 1323 | Congressman Bentsen and the Trade Promotion Author | ERROR | info | action | None / 0.96 |  |
| 1332 |  | personal | ERROR | personal | 0.99 / 0.76 | personal |
| 1363 | Nokia Introduces Its Newest Phone | bulk | ERROR | bulk | 0.7 / 1.0 |  |
| 1371 | Price Cap Graphs | info | ERROR | info | 1.0 / 0.98 |  |
| 1381 | FW: Index Option | info | info | action | 1.0 / 0.69 | info |
| 1405 | Re: Happy Birthday! | ERROR | personal | personal | None / 0.84 |  |
| 1430 | Houston Area Car Rental Availability | ERROR | ERROR | bulk | None / 0.69 | bulk |
| 1446 | RE: Pemex Guaranty - Enron | info | ERROR | info | 0.96 / 0.74 |  |
| 1478 | Start Date: 10/6/01; HourAhead hour: 5; <CODESITE> | info | bulk | info | 0.96 / 0.55 |  |
| 1532 | option candlesticks (including distillate & unlead | ERROR | info | info | None / 0.35 |  |
| 1545 | Mtg w/Rob Bradley, Director & Assoc. Jeff Gray | ERROR | meeting | info | None / 0.82 |  |
| 1600 | MANY, MANY THANKS FOR A JOB WELL DONE AND MORE PRO | ERROR | action | action | None / 1.0 |  |
| 1619 | Torch | action | ERROR | action | 1.0 / 0.99 |  |
| 1650 | Portable PC | ERROR | ERROR | action | None / 0.8 |  |
| 1651 | FW: Inspirational Kids | personal | ERROR | personal | 0.74 / 0.68 |  |
| 1654 | Organizational Changes | info | ERROR | info | 0.81 / 0.6 |  |
| 1693 |  | ERROR | ERROR | personal | None / 0.5 |  |
| 1709 | TRV Notification: (Storage P/L - 06/08/2001) | ERROR | bulk | info | None / 0.51 |  |
| 1740 | Master EOL agreements | ERROR | action | action | None / 0.99 | action |
| 1758 | FW: NERC Issues 2001/2002 Winter Reliability Asses | info | info | action | 0.98 / 0.59 |  |
| 1787 | Business Practices | action | ERROR | action | 1.0 / 1.0 | action |
| 1844 | Re: Cal ISO Not Filing CM Proposal at FERC - EPMI  | action | info | action | 1.0 / 0.6 |  |
| 1851 | RE: Rob Benson Pay Stub | info | ERROR | info | 0.92 / 0.5 |  |
| 1859 | Pulpex Bulletin No. 1090 @ October 16, 2001 | bulk | ERROR | bulk | 0.95 / 0.9 |  |
| 1882 | RE: Quote- CGAS | ERROR | action | action | None / 0.91 |  |
| 1884 | DJ US Northwest Pwr Forwards Higher On Water; SW 3 | info | ERROR | info | 0.98 / 1.0 |  |
| 1903 | Re: FW: Saturday Tunnel pics | action | personal | action | 0.89 / 0.92 |  |
| 1925 | Re:Build Out Power Mid Market Group | meeting | ERROR | meeting | 0.61 / 0.65 |  |
| 1934 | GOT GAS? | ERROR | ERROR | info | None / 0.92 | info |
| 1960 | RE: Organizational Announcements | info | ERROR | action | 1.0 / 0.37 | info |
| 1982 | ALL daily charts and matrices as hot links 10/24 | action | ERROR | info | 0.92 / 0.55 | bulk |
| 1985 | FW: FROM BILLY LEMMONS - Chad Garren / Summer Inte | ERROR | bulk | info | None / 0.75 |  |
| 1986 | Re: 449614 Airam Arteaga SAP Security Request Form | ERROR | ERROR | action | None / 1.0 |  |
| 1990 | Invitation to Present Feb. 21, 2002 Keynote Addres | action | ERROR | action | 0.99 / 0.76 |  |
| 2007 | RE: Comments needed-Janet Dougherty (101601) Rozyc | info | ERROR | action | 0.37 / 0.69 | info |
| 2033 | Re: New TW Hotline | ERROR | action | info | None / 0.46 |  |
| 2036 | Consultation for wisdom teeth | ERROR | personal | info | None / 0.32 |  |
| 2038 | FW: SOUTHERN CALIFORNIA LONG-TERM REGIONAL TRANSMI | info | bulk | meeting | 0.4 / 0.54 | bulk |
| 2045 | FW: | info | ERROR | info | 1.0 / 0.98 | info |
| 2055 | SITARA/CPR AVAILABILITY | ERROR | bulk | bulk | None / 0.68 |  |
| 2084 |  | info | ERROR | info | 1.0 / 0.92 |  |
| 2087 | Re: Potential Candidates for Reliable Reserves | ERROR | ERROR | action | None / 0.56 | info |
| 2120 | Re: Live at the Schnitz May 25 | action | personal | personal | 0.71 / 0.36 |  |
| 2158 | Save Big at Our Clearance Event | ERROR | ERROR | bulk | None / 1.0 |  |
| 2191 | Delivered: | info | bulk | bulk | 0.61 / 0.62 | bulk |
| 2203 | I Finally Felt It!. | action | ERROR | bulk | 0.62 / 0.75 |  |
| 2225 | Financial Power Issue | info | ERROR | info | 0.87 / 0.84 |  |
| 2226 | Kase Hedging Class, Early Bird 'til 3/11, Houston | meeting | bulk | bulk | 0.3 / 0.87 | bulk |
| 2242 | Daily Charts 12/27 | ERROR | info | info | None / 0.66 | bulk |
| 2276 | RE: September detail | action | ERROR | action | 0.99 / 0.73 | action |
| 2294 | Re: Mark Haedicke's visit to London | meeting | ERROR | meeting | 0.79 / 0.68 |  |
| 2321 | RE: Wolfe, Jason wants to kick your ass! | info | personal | personal | 0.45 / 0.8 | personal |
| 2330 | Re: GAME TONIGHT @ 7:30 | meeting | ERROR | meeting | 0.49 / 0.49 |  |
| 2369 | Start Date: 4/4/01; HourAhead hour: 17; <CODESITE> | ERROR | bulk | info | None / 0.55 | bulk |
| 2373 | TRV Notification: (FT - Texas P/L - 06/04/2001) | ERROR | bulk | info | None / 0.39 |  |
| 2379 | Environment & Energy Daily - Jan. 28, 2002 | ERROR | bulk | bulk | None / 0.99 |  |
| 2418 | FW: NYS Reliability Council - Reliability Complian | action | ERROR | meeting | 0.62 / 0.71 |  |
| 2425 | AGA for 7/14/00 is 70 | ERROR | bulk | info | None / 0.94 | bulk |
| 2433 | Venture News, Wednesday, December 13, 2000 | ERROR | bulk | bulk | None / 0.9 |  |
| 2440 | RE: NCPA buy/resale deal | action | info | info | 1.0 / 0.66 |  |
| 2448 | Start Date: 1/12/02; HourAhead hour: 7; | ERROR | ERROR | info | None / 0.6 |  |
| 2459 | RE: | action | personal | personal | 0.55 / 0.85 |  |
| 2461 | Farewell Drinks | ERROR | meeting | meeting | None / 0.82 | personal |
| 2463 | Lavorato Mtg Today - @ 2:00 p.m. - ECS 06736 | ERROR | ERROR | meeting | None / 0.95 |  |
| 2493 | Tragic News Update | personal | info | info | 0.91 / 0.66 |  |
| 2502 | SAP ID - Here it is!!!!! | ERROR | bulk | bulk | None / 0.74 |  |
| 2535 | Edison Mission Marketing & Trading - EOL Status | action | ERROR | action | 0.98 / 0.74 |  |
| 2546 | new democratic seal... | ERROR | personal | info | None / 0.69 |  |
| 2563 | AGA for 11/24/00 is (146) W/D | action | info | action | 0.99 / 0.52 |  |
| 2566 | A website you want to make your favorites - | ERROR | bulk | info | None / 0.45 |  |
| 2580 |  | bulk | ERROR | bulk | 0.99 / 0.98 | personal |
| 2596 | American Heart Walk | action | ERROR | action | 0.95 / 0.81 | personal |
| 2610 | If you want your ClickAtHome PC by 12/25 - Read Th | ERROR | ERROR | bulk | None / 0.42 |  |
| 2615 | EOL and Clickpaper Approvals for 11-26-01 | action | info | action | 0.76 / 0.62 | bulk |
| 2634 | NUI Transaction Agreement | info | ERROR | info | 0.99 / 0.84 | info |
| 2641 | OnePass Offers - Fare Sale | ERROR | bulk | bulk | None / 0.99 |  |
| 2647 | Re: RTO West Meeting of January 12 | ERROR | info | info | None / 0.94 |  |
| 2653 | Re: Williams Gas Pipelines Order 637/Order 587-L | info | ERROR | info | 1.0 / 0.99 |  |
| 2656 |  | ERROR | personal | personal | None / 0.39 |  |
| 2695 | P&L responsibility | info | ERROR | info | 1.0 / 0.99 | info |
| 2703 | Re: FW: How many do you know? | ERROR | ERROR | personal | None / 0.62 | personal |
| 2764 | STATIC SCHEDULING FEES | ERROR | ERROR | action | None / 1.0 | action |
| 2766 | SDG&E Emergency Motion for Bilateral Authority-Dra | action | info | action | 0.8 / 0.65 |  |
| 2780 | RE: Credit Suisse First Boston ("CSFB") account wi | ERROR | ERROR | action | None / 1.0 |  |
| 2783 | FW: curve files | ERROR | ERROR | action | None / 0.96 |  |
| 2784 | Demand Ken Lay Donate Proceeds from Enron Stock Sa | action | ERROR | action | 0.99 / 1.0 | bulk |
| 2813 | LDC Forum-Free Golf! | action | bulk | bulk | 0.94 / 0.95 | bulk |
| 2831 | North American Printing & Writing Papers Statistic | ERROR | bulk | bulk | None / 0.55 |  |
| 2855 | Europe flights from $358, Hawaii vacations on sale | ERROR | bulk | bulk | None / 0.99 | bulk |
| 2878 | Re: Online Canadian GTC's | ERROR | ERROR | action | None / 0.73 | info |
| 2886 | St. Mary's Production LLC VPP | action | ERROR | action | 1.0 / 1.0 |  |
| 2910 | Director of Finance and Operations Opportunity wit | action | bulk | bulk | 0.69 / 0.31 | bulk |
| 2918 | Recap of 4 points we are to address | action | ERROR | action | 1.0 / 1.0 |  |
| 2953 | New Newsletter on EnronOnline | ERROR | action | action | None / 0.99 |  |
| 2964 | SPREADSHEETS FOR SAT, SUNDAY AND MONDAY | action | info | action | 0.94 / 0.45 |  |

## Which labels get confused

- ERROR / action: 24
- action / info: 21
- ERROR / info: 20
- ERROR / bulk: 14
- bulk / info: 10
- ERROR / personal: 7
- ERROR / bulk / info: 7
- ERROR / meeting: 6
- ERROR / action / info: 6
- action / bulk: 5
- action / meeting: 4
- action / personal: 4
- action / info / meeting: 2
- action / bulk / info: 2
- ERROR / info / personal: 2
- info / personal: 2
- meeting / personal: 1
- action / bulk / meeting: 1
- bulk / personal: 1
- info / meeting: 1
- ERROR / action / personal: 1
- ERROR / info / meeting: 1
- bulk / info / meeting: 1
- ERROR / action / bulk: 1
- bulk / meeting: 1
- ERROR / action / meeting: 1

## Failures

- extract+jev #152: RuntimeError: schema validation failed: None
- llm #152: RuntimeError: schema validation failed: None
- extract+jev #1011: RuntimeError: schema validation failed: None
- extract+jev #1030: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1063: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1115: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1133: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1158: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1185: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1185: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1221: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1235: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1259: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1292: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1292: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1293: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1299: RuntimeError: schema validation failed: 3 validation errors for EmailFacts
summary
  Field required [type=missing, input_value={'audience': 'small_group', 'meet
- extract+jev #1323: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1332: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1363: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1371: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1405: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1430: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1430: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1446: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1532: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1545: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1600: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1619: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1650: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1650: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1651: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1654: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1693: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1693: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1709: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1740: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1787: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1851: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1859: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1882: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1884: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1925: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1934: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1934: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1960: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1982: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1985: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #1986: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1986: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #1990: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2007: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2033: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2036: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2045: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2055: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2084: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2087: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2087: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2158: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2158: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2203: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2225: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2242: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2276: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2294: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2330: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2369: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2373: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2379: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2418: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2425: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2433: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2448: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2448: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2461: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2463: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2463: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2502: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2535: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2546: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2566: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2580: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2596: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2610: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2610: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2634: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2641: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2647: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2653: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2656: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2695: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2703: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2703: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2764: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2764: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2780: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2780: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2783: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2783: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2784: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2831: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2855: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2878: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2878: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2886: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- llm #2918: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
- extract+jev #2953: OpenAIRateLimitError: Error code: 429 - Rate limit reached: too many requests per minute
