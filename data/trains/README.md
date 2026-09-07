# Train prices Messina / Villa S. Giovanni / Reggio Calabria <-> Roma, 25 Sep - 3 Dec 2026

Collected live on 2026-09-07 between 12:35 and 13:04 UTC (1 adult, no discount cards, prices in EUR as shown by Trenitalia's own booking API). All numbers below are the real values returned by the sources at fetch time; nothing is estimated. Prices change continuously, so treat them as a snapshot.

## Files

| File | Content |
|---|---|
| `cheapest_per_day.csv` | Per route and date: cheapest overall solution and cheapest DIRECT daytime solution (Trenitalia). `kind` column distinguishes the two. |
| `trenitalia_all_solutions.csv` | Every solution returned by Trenitalia for every route/date (train legs, times, headline price, offer). |
| `round_trips.csv` | For each outbound date and origin: cheapest outbound + cheapest return on D+2 and D+3, with total. |
| `flixbus_reference.csv` | Reference only: FlixBus Messina -> Roma Tiburtina bus station fares on 4 sample dates. |
| `raw/trenitalia/*.json` | Raw API responses (trimmed: passenger/parameter blobs and marketing descriptions removed, all prices/offers/times/trains kept). One file per route/date/page. `collect_log.txt` = full request log. |
| `raw/italo/stations.json` | Italo station list (the only Italo endpoint reachable without a session token). |
| `raw/flixbus/*.json` | Raw FlixBus search responses. |
| `scripts/` | The collection/parsing scripts (reproducible). |

## What could NOT be collected, and why

* **Italo (all routes): NOT COLLECTED.** Italo's booking API (`https://api-biglietti.italotreno.com/api/v1/booking`, and the low-fare calendar `api/v1/booking/bestprices/calendar`) requires a Bearer session token. The token is issued only by the Next.js route `POST https://biglietti.italotreno.com/api/login` (anonymous 'technical user' logon), and that path (plus `api-biglietti.../public/api/v1/users/logon`) is protected by Akamai Bot Manager: every non-browser request gets HTTP 403 'Access Denied' (reference IDs 18.54a4c017..., 18.4aa4c017..., 18.14a4c017...). The legacy API host `big.italotreno.it` is refused by this sandbox's egress proxy (502 on CONNECT). The Playwright fallback was impossible: the pre-installed Chromium cannot complete ANY TLS handshake through this sandbox's egress proxy (net::ERR_CONNECTION_RESET even for example.com; proxy log: 'tunnel closed after 6s; ClientHello sent, no reply'), tested with default flags, TLS1.2-only, post-quantum/ECH disabled and the headless-shell build. Only the Italo station list (no token needed) was saved: codes VSG = Villa San Giovanni, RCE = Reggio Calabria, RTB = Roma Tiburtina, RMT = Roma Termini, RM0 = Roma (Tutte).
* **Trainline cross-check: NOT DONE.** `POST https://www.thetrainline.com/api/journey-search/` answers HTTP 403 with a DataDome captcha challenge (geo.captcha-delivery.com). Location search works but is useless without journey search.
* **Omio cross-check: NOT DONE.** `https://www.omio.it/` answers HTTP 403 with a Cloudflare 'Just a moment...' JavaScript challenge, which cannot be solved without a browser.
* **Trainline static timetable pages** (`https://www.thetrainline.com/it/orari-treni/villa-san-giovanni-a-roma`) are reachable but only carry one aggregate 'lowPrice' (in USD) in their structured data, not per-day prices, so they cannot cross-check individual dates.
* Because no independent seller could be queried, the 5 cheapest combinations were instead RE-FETCHED from the same Trenitalia API at the end of the run (see 'Re-fetch consistency check' below). This is a same-source stability check, NOT an independent cross-check.
* **Itabus reference: NOT DONE.** `https://www.itabus.it/it/search` is a Salesforce Commerce single-page app; its search API could not be identified from the served bundles without executing them in a browser (see Chromium note above). FlixBus was collected instead (see below).
* **Trenitalia `bestFare:true` mode** returns a `minimumPrices` calendar with amount 0 for every day and no solutions, so it was not usable; all prices come from the normal solutions search, paged 10 at a time until the day was exhausted.
* Trenitalia: no request failed permanently. Transient Akamai 403s were retried with backoff (see `raw/trenitalia/collect_log.txt`).

## Sources / exact URLs used

* Trenitalia location ids: `GET https://www.lefrecce.it/Channels.Website.BFF.WEB/website/locations/search?name=<name>&limit=10` -> Messina Centrale 830012301, Villa S. Giovanni 830011774, Reggio Di Calabria Centrale 830011781, Roma Tiburtina 830008217, Roma Termini 830008409 (Roma Tutte le Stazioni 830008349, not used).
* Trenitalia solutions: `POST https://www.lefrecce.it/Channels.Website.BFF.WEB/website/ticket/solutions` with body `{departureLocationId, arrivalLocationId, departureTime:"<date>T00:01:00.000", adults:1, children:0, criteria:{frecceOnly:false, regionalOnly:false, intercityOnly:false, tourismOnly:false, noChanges:false, order:"DEPARTURE_DATE", offset:N, limit:10}, advancedSearchRequest:{bestFare:false, bikeFilter:false}}`; paged by offset. Requires Chrome-like headers (User-Agent, sec-ch-ua, Sec-Fetch-*, Origin/Referer lefrecce.it) or Akamai answers 403.
* Italo: `GET https://api-biglietti.italotreno.com/api/v1/stations?culture=it-IT` (works); `POST .../api/v1/booking` (401 Invalid token without session); `POST https://biglietti.italotreno.com/api/login` (403 Akamai).
* Trainline: `GET https://www.thetrainline.com/api/locations-search/v2/search?searchTerm=...` (works; Messina Centrale urn:trainline:generic:loc:19880, Villa San Giovanni 20521, Reggio di Calabria Centrale 8539, Roma Tiburtina 8543, Roma Termini 8544); `POST https://www.thetrainline.com/api/journey-search/` (403 captcha).
* FlixBus: `GET https://global.api.flixbus.com/search/service/v4/search?from_city_id=a61f616b-8ab8-402b-9163-9eb7b2effad4&to_city_id=40de90ff-8646-11e6-9066-549f350fcb0c&departure_date=DD.MM.YYYY&products={"adult":1}&currency=EUR&locale=it&search_by=cities`.

## Price semantics

* `price_eur` = the headline 'from' price Trenitalia shows for the whole solution (sum of the cheapest SALEABLE public offer of each leg: Super Economy / Economy / Base / FrecciaDAYS / Ordinaria for regional legs). Age-restricted YOUNG/SENIOR fares are excluded. Verified: for all solutions the headline price equals the recomputed public minimum.
* `changes` = number of vehicle changes (walk Messina Centrale -> Messina Marittima is not counted as a change but is flagged in `walk_transfers` in the all-solutions file). 'Ferry Mx' = Blu Jet fast ferry Messina Marittima -> Villa S. Giovanni (ticket included in the price). `direct` = single train, no ferry/no change.
* `cheapest_direct_daytime` = single train, departure 05:00-21:59, not an Intercity Notte. For Messina -> Roma **Tiburtina** there is no direct train (see next section), so that row is `NO_DIRECT_DAYTIME_SOLUTION` and the Termini route should be read instead.

## Which trains actually stop at Roma Tiburtina

* Messina Centrale -> Roma Tiburtina: NO direct train in the whole window; Trenitalia always routes via Roma Termini + a regional/urban leg (e.g. RV 4xxx Termini -> Tiburtina, ~7 min), or via a change at Napoli/Villa S. Giovanni.
* Villa S. Giovanni -> Roma Tiburtina: direct trains seen in the window: FR 9588, IC 1588
* Reggio di Calabria Centrale -> Roma Tiburtina: direct trains seen in the window: FR 9588, IC 1588
* Roma Tiburtina -> Messina Centrale: NO direct train in the whole window; Trenitalia always routes via Roma Termini + a regional/urban leg (e.g. RV 4xxx Termini -> Tiburtina, ~7 min), or via a change at Napoli/Villa S. Giovanni.
* Roma Tiburtina -> Villa S. Giovanni: direct trains seen in the window: FR 9583, FR 9587, IC 1589
* Roma Tiburtina -> Reggio di Calabria Centrale: direct trains seen in the window: FR 9583, FR 9587, IC 1589

Caveat: 'direct' above means Trenitalia returned a single-train solution whose last node is Roma Tiburtina. On most days the same FR/IC trains are returned as 'train to Roma Termini + walk/metro/RV leg to Tiburtina' (flagged `walk_transfers`/`changes` in the CSVs), so check `trenitalia_all_solutions.csv` (columns `train_dest`, `direct`) before assuming a train stops at Tiburtina on a given day.
Practical note: Roma Termini and Roma Tiburtina are 2 stops apart on Metro B (about 8 minutes, EUR 1.50 BIT ticket, not included in any price above); many Frecce and all Intercity from Sicily/Calabria terminate at Termini.

## Cheapest price per day, every route (Trenitalia)

Columns: cheapest overall (price / train / dep-arr / changes / offer) and cheapest direct daytime (price / train / dep-arr / offer). Empty = none.

### Messina Centrale -> Roma Tiburtina (`MessinaC-RomaTib`)

| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-25 Fri | 45.9 | Ferry M1 + IC 550 | 05:05-15:10 | 1 | Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-09-26 Sat | 36.9 | IC 724 | 13:20-22:10 | 0 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-09-27 Sun | 40.0 | Ferry M14 + NI 812 + RE 21404 | 20:55-06:24 | 2 | Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-09-28 Mon | 24.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:58 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-09-29 Tue | 24.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:58 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-09-30 Wed | 24.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:58 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-01 Thu | 24.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:58 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-02 Fri | 33.9 | Ferry M7 + FR 8868 | 12:35-20:52 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-03 Sat | 27.9 | Ferry M8 + IC 560 | 14:25-00:16 | 1 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-04 Sun | 32.0 | Ferry M14 + NI 812 + RE 21404 | 20:55-06:24 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-05 Mon | 30.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-06 Tue | 24.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:58 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-07 Wed | 24.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:58 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-08 Thu | 24.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:58 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-09 Fri | 30.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:58 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-10 Sat | 26.9 | Ferry M14 + NI 794 + RE 20573 | 20:55-07:15 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-11 Sun | 32.0 | Ferry M14 + NI 812 + RE 21404 | 20:55-06:24 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-12 Mon | 30.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:58 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-13 Tue | 24.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:58 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-14 Wed | 30.8 | Ferry M3 + IC 552 + IC 596 | 07:25-15:45 | 2 | Super Economy (2ª CLASSE EASY) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-15 Thu | 24.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:58 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-16 Fri | 30.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:58 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-17 Sat | 30.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-18 Sun | 32.0 | Ferry M14 + NI 812 + RE 21404 | 20:55-06:24 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-19 Mon | 29.0 | Ferry M14 + NI 794 + RE 21404 | 20:55-06:21 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-20 Tue | 24.9 | IC 95070 + RV 4108 | 13:20-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-21 Wed | 24.9 | IC 95070 + RV 4108 | 13:20-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-22 Thu | 24.9 | IC 95070 + RV 4108 | 13:20-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-23 Fri | 24.9 | Ferry M14 + NI 794 + RE 20571 | 20:55-06:45 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-24 Sat | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-25 Sun | 32.0 | Ferry M14 + NI 812 + RE 21404 | 20:55-06:24 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-26 Mon | 24.9 | IC 95070 + RV 4108 | 13:20-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-27 Tue | 24.9 | IC 95070 + RV 4108 | 13:20-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-28 Wed | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-29 Thu | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-30 Fri | 29.9 | Ferry M14 + NI 794 + RE 20571 | 20:55-06:45 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-31 Sat | 23.9 | IC 95070 | 13:20-22:10 | 0 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-01 Sun | 32.0 | Ferry M14 + NI 812 + RE 21404 | 20:55-06:24 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-02 Mon | 24.9 | IC 95070 + RV 4108 | 13:20-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-03 Tue | 24.9 | IC 95070 + RV 4108 | 13:20-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-04 Wed | 24.9 | IC 95070 + RV 4108 | 13:20-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-05 Thu | 24.9 | Ferry M8 + RE 5546 + IC 560 + RV 4538 | 14:25-22:55 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-06 Fri | 29.9 | Ferry M14 + NI 794 + RE 20571 | 20:55-06:45 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-07 Sat | 23.9 | IC 95070 | 13:20-22:10 | 0 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-08 Sun | 32.0 | Ferry M14 + NI 812 + RE 21404 | 20:55-06:24 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-09 Mon | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-10 Tue | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-11 Wed | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-12 Thu | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-13 Fri | 26.9 | Ferry M14 + NI 794 + RE 20571 | 20:55-06:45 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-14 Sat | 23.9 | IC 95070 | 13:20-22:10 | 0 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-15 Sun | 29.0 | Ferry M14 + NI 812 + RE 21404 | 20:55-06:24 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-16 Mon | 24.9 | IC 95070 + RV 4108 | 13:20-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-17 Tue | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-18 Wed | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-19 Thu | 24.9 | IC 95070 + RV 4108 | 13:20-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-20 Fri | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-21 Sat | 23.9 | IC 95070 | 13:20-22:10 | 0 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-22 Sun | 29.0 | Ferry M14 + NI 812 + RE 21404 | 20:55-06:24 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-23 Mon | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-24 Tue | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-25 Wed | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-26 Thu | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-27 Fri | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-28 Sat | 23.9 | IC 95070 | 13:20-22:10 | 0 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-29 Sun | 29.0 | Ferry M14 + NI 812 + RE 21404 | 20:55-06:24 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-30 Mon | 24.9 | IC 95072 + RV 4734 | 10:15-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |

### Messina Centrale -> Roma Termini (`MessinaC-RomaTer`)

| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-25 Fri | 33.9 | Ferry M8 + FR 8332 | 14:25-21:20 | 1 | FrecciaDAYS (STANDARD) | 63.5 | IC 734 | 10:15-18:34 | BASE (2ª CLASSE EASY) |
| 2026-09-26 Sat | 33.9 | Ferry M8 + FR 8332 | 14:25-21:20 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 734 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-09-27 Sun | 40.0 | Ferry M14 + NI 812 + RE 21052 | 20:55-06:30 | 2 | Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 48.9 | IC 734 | 10:15-18:34 | Economy (2ª CLASSE EASY) |
| 2026-09-28 Mon | 23.9 | Ferry M8 + RE 5546 + IC 560 | 14:25-22:34 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) | 36.9 | IC 724 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-09-29 Tue | 23.9 | Ferry M8 + RE 5546 + IC 560 | 14:25-22:34 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) | 36.9 | IC 734 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-09-30 Wed | 23.9 | Ferry M8 + RE 5546 + IC 560 | 14:25-22:34 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) | 36.9 | IC 724 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-01 Thu | 23.9 | Ferry M8 + RE 5546 + IC 560 | 14:25-22:34 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) | 34.9 | IC 95072 | 10:15-18:34 | Super Economy (1ª CLASSE PLUS) |
| 2026-10-02 Fri | 33.9 | Ferry M7 + FR 8868 | 12:35-20:16 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-03 Sat | 27.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 34.9 | IC 95072 | 10:15-18:34 | Super Economy (1ª CLASSE PLUS) |
| 2026-10-04 Sun | 32.0 | Ferry M14 + NI 812 + RE 21052 | 20:55-06:30 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 42.9 | IC 95072 | 10:15-18:34 | Economy (2ª CLASSE EASY) |
| 2026-10-05 Mon | 27.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-06 Tue | 23.9 | Ferry M8 + RE 5546 + IC 560 | 14:25-22:34 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) | 29.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-07 Wed | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-08 Thu | 23.9 | Ferry M8 + RE 5546 + IC 560 | 14:25-22:34 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-09 Fri | 29.9 | Ferry M8 + RE 5546 + IC 560 | 14:25-22:34 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) | 36.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-10 Sat | 21.9 | Ferry M7 + IC 95070 | 12:35-21:34 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-11 Sun | 32.0 | Ferry M14 + NI 812 + RE 21052 | 20:55-06:30 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 42.9 | IC 95072 | 10:15-18:34 | Economy (2ª CLASSE EASY) |
| 2026-10-12 Mon | 27.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-13 Tue | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-14 Wed | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-15 Thu | 23.9 | Ferry M8 + RE 5546 + IC 560 | 14:25-22:34 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-16 Fri | 29.9 | Ferry M8 + RE 5546 + IC 560 | 14:25-22:34 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) | 34.9 | IC 95070 | 13:20-21:34 | Super Economy (1ª CLASSE PLUS) |
| 2026-10-17 Sat | 27.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-18 Sun | 32.0 | Ferry M14 + NI 812 + RE 21052 | 20:55-06:30 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 36.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-19 Mon | 26.9 | Ferry M14 + NI 794 + RE 12503 | 20:55-06:25 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-20 Tue | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-21 Wed | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-22 Thu | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-23 Fri | 23.9 | Ferry M8 + RE 5546 + IC 560 | 14:25-22:34 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) | 36.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-24 Sat | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-25 Sun | 32.0 | Ferry M14 + NI 812 + RE 21052 | 20:55-06:30 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 42.9 | IC 95072 | 10:15-18:34 | Economy (2ª CLASSE EASY) |
| 2026-10-26 Mon | 23.9 | IC 95070 | 13:20-21:34 | 0 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-27 Tue | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-28 Wed | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-29 Thu | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-30 Fri | 29.9 | IC 95072 | 10:15-18:34 | 0 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-31 Sat | 21.9 | Ferry M8 + IC 560 | 14:25-22:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-01 Sun | 32.0 | Ferry M14 + NI 812 + RE 21052 | 20:55-06:30 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 34.9 | IC 95072 | 10:15-18:34 | Super Economy (1ª CLASSE PLUS) |
| 2026-11-02 Mon | 23.9 | IC 95070 | 13:20-21:34 | 0 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-03 Tue | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-04 Wed | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-05 Thu | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-06 Fri | 29.9 | IC 95072 | 10:15-18:34 | 0 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-07 Sat | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-08 Sun | 32.0 | Ferry M14 + NI 812 + RE 21052 | 20:55-06:30 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 34.9 | IC 95070 | 13:20-21:34 | Super Economy (1ª CLASSE PLUS) |
| 2026-11-09 Mon | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-10 Tue | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-11 Wed | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-12 Thu | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-13 Fri | 26.9 | Ferry M14 + NI 794 + RE 12503 | 20:55-06:25 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-14 Sat | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-15 Sun | 29.0 | Ferry M14 + NI 812 + RE 21052 | 20:55-06:30 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 34.9 | IC 95072 | 10:15-18:34 | Super Economy (1ª CLASSE PLUS) |
| 2026-11-16 Mon | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-17 Tue | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-18 Wed | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-19 Thu | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-20 Fri | 23.9 | IC 95072 | 10:15-18:34 | 0 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-21 Sat | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-22 Sun | 23.0 | Ferry M4 + IC 1588 + RE 21086 | 08:15-17:24 | 2 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 34.9 | IC 95072 | 10:15-18:34 | Super Economy (1ª CLASSE PLUS) |
| 2026-11-23 Mon | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-24 Tue | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-25 Wed | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-26 Thu | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-27 Fri | 23.9 | IC 95072 | 10:15-18:34 | 0 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-28 Sat | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95070 | 13:20-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-29 Sun | 29.0 | Ferry M14 + NI 812 + RE 21052 | 20:55-06:30 | 2 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 29.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-30 Mon | 21.9 | Ferry M3 + IC 552 | 07:25-15:34 | 1 | Super Economy (2ª CLASSE EASY) | 23.9 | IC 95072 | 10:15-18:34 | Super Economy (2ª CLASSE EASY) |

### Villa S. Giovanni -> Roma Tiburtina (`VillaSG-RomaTib`)

| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-25 Fri | 44.9 | RE 5542 + RE 5338 + RE 21098 | 08:15-21:00 | 2 | ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-09-26 Sat | 39.9 | FR 8868 | 14:34-20:52 | 0 | Super Economy (STANDARD) |  |  | - |  |
| 2026-09-27 Sun | 40.0 | NI 812 + RE 21404 | 22:25-06:24 | 1 | Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 51.9 | IC 1588 | 09:02-16:31 | Economy (2ª CLASSE EASY) |
| 2026-09-28 Mon | 22.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-09-29 Tue | 22.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-09-30 Wed | 22.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-01 Thu | 22.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-02 Fri | 33.9 | FR 8868 | 14:37-20:52 | 0 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-03 Sat | 28.9 | IC 552 + RV 4156 | 08:12-16:01 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) |  |  | - |  |
| 2026-10-04 Sun | 32.0 | NI 812 + RE 21404 | 22:25-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-05 Mon | 28.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-06 Tue | 22.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-07 Wed | 22.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-08 Thu | 22.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-09 Fri | 28.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-10 Sat | 21.9 | IC 95070 | 14:50-22:10 | 0 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-11 Sun | 32.0 | NI 812 + RE 21404 | 22:25-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 37.9 | IC 1588 | 09:02-16:31 | Super Economy (1ª CLASSE PLUS) |
| 2026-10-12 Mon | 28.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-13 Tue | 22.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-14 Wed | 28.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-15 Thu | 22.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-16 Fri | 28.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-17 Sat | 28.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-18 Sun | 32.0 | NI 812 + RE 21404 | 22:25-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 37.9 | IC 1588 | 09:02-16:31 | Super Economy (1ª CLASSE PLUS) |
| 2026-10-19 Mon | 28.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-20 Tue | 22.9 | IC 95070 + RV 4108 | 14:50-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-21 Wed | 22.9 | IC 95070 + RV 4108 | 14:50-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-22 Thu | 22.9 | IC 95070 + RV 4108 | 14:50-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-23 Fri | 22.9 | IC 560 + RV 4538 | 15:32-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-24 Sat | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-25 Sun | 32.0 | NI 812 + RE 21404 | 22:25-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 37.9 | IC 1588 | 09:02-16:31 | Super Economy (1ª CLASSE PLUS) |
| 2026-10-26 Mon | 22.9 | IC 95070 + RV 4108 | 14:50-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-27 Tue | 22.9 | IC 95070 + RV 4108 | 14:50-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-28 Wed | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-29 Thu | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-30 Fri | 28.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-31 Sat | 21.9 | IC 95070 | 14:50-22:10 | 0 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-01 Sun | 32.0 | NI 812 + RE 21404 | 22:25-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 35.9 | IC 1588 | 09:01-16:31 | Super Economy (1ª CLASSE PLUS) |
| 2026-11-02 Mon | 22.9 | IC 95070 + RV 4108 | 14:50-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:25-16:17 | Super Economy (STANDARD) |
| 2026-11-03 Tue | 22.9 | IC 95070 + RV 4108 | 14:50-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-04 Wed | 22.9 | IC 95070 + RV 4108 | 14:50-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-05 Thu | 22.9 | IC 560 + RV 4538 | 15:32-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 42.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (PREMIUM) |
| 2026-11-06 Fri | 28.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:25-16:17 | Super Economy (STANDARD) |
| 2026-11-07 Sat | 21.9 | IC 95070 | 14:50-22:10 | 0 | Super Economy (2ª CLASSE EASY) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-08 Sun | 32.0 | NI 812 + RE 21404 | 22:25-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 66.9 | FR 9588 | 10:25-16:17 | Economy (STANDARD) |
| 2026-11-09 Mon | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:25-16:17 | Super Economy (STANDARD) |
| 2026-11-10 Tue | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-11 Wed | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-12 Thu | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-13 Fri | 26.9 | NI 794 + RE 20571 | 22:03-06:45 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:25-16:17 | Super Economy (STANDARD) |
| 2026-11-14 Sat | 21.9 | IC 95070 | 14:50-22:10 | 0 | Super Economy (2ª CLASSE EASY) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-15 Sun | 27.9 | IC 1588 | 09:01-16:31 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 1588 | 09:01-16:31 | Super Economy (2ª CLASSE EASY) |
| 2026-11-16 Mon | 22.9 | IC 95070 + RV 4108 | 14:50-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:25-16:17 | Super Economy (STANDARD) |
| 2026-11-17 Tue | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-18 Wed | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-19 Thu | 22.9 | IC 95070 + RV 4108 | 14:50-21:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-20 Fri | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:25-16:17 | Super Economy (STANDARD) |
| 2026-11-21 Sat | 21.9 | IC 95070 | 14:50-22:10 | 0 | Super Economy (2ª CLASSE EASY) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-22 Sun | 21.9 | IC 1588 | 09:01-16:31 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 1588 | 09:01-16:31 | Super Economy (2ª CLASSE EASY) |
| 2026-11-23 Mon | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:25-16:17 | Super Economy (STANDARD) |
| 2026-11-24 Tue | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-25 Wed | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-26 Thu | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-27 Fri | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:25-16:17 | Super Economy (STANDARD) |
| 2026-11-28 Sat | 21.9 | IC 95070 | 14:50-22:10 | 0 | Super Economy (2ª CLASSE EASY) | 33.9 | FR 9588 | 10:25-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-29 Sun | 28.9 | IC 95072 + RV 4196 | 11:50-19:04 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) |  |  | - |  |
| 2026-11-30 Mon | 22.9 | IC 95072 + RV 4734 | 11:50-19:10 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 47.9 | FR 9588 | 10:25-16:17 | Super Economy (STANDARD) |

### Villa S. Giovanni -> Roma Termini (`VillaSG-RomaTer`)

| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-25 Fri | 33.9 | FR 8332 | 16:05-21:20 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8332 | 16:05-21:20 | FrecciaDAYS (STANDARD) |
| 2026-09-26 Sat | 27.9 | IC 560 | 14:43-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 560 | 14:43-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-09-27 Sun | 42.3 | NI 812 + RE 21052 | 22:25-06:30 | 1 | Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 47.9 | FR 8418 | 06:14-11:25 | Super Economy (STANDARD) |
| 2026-09-28 Mon | 21.9 | IC 560 | 15:32-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:32-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-09-29 Tue | 21.9 | IC 560 | 15:32-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:32-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-09-30 Wed | 21.9 | IC 560 | 15:32-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:32-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-01 Thu | 21.9 | IC 560 | 15:32-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:32-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-02 Fri | 33.9 | FR 8868 | 14:37-20:16 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8868 | 14:37-20:16 | FrecciaDAYS (STANDARD) |
| 2026-10-03 Sat | 27.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-04 Sun | 35.3 | NI 812 + RE 21052 | 22:25-06:30 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 39.9 | FR 8418 | 06:17-11:25 | Super Economy (STANDARD) |
| 2026-10-05 Mon | 27.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-06 Tue | 21.9 | IC 560 | 15:32-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:32-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-07 Wed | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-08 Thu | 21.9 | IC 560 | 15:32-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:32-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-09 Fri | 27.9 | IC 560 | 15:32-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 560 | 15:32-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-10 Sat | 21.9 | IC 95070 | 14:50-21:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 95070 | 14:50-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-11 Sun | 33.9 | FR 8418 | 06:17-11:25 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8418 | 06:17-11:25 | FrecciaDAYS (STANDARD) |
| 2026-10-12 Mon | 27.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-13 Tue | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-14 Wed | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-15 Thu | 21.9 | IC 560 | 15:32-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:32-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-16 Fri | 27.9 | IC 560 | 15:32-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 560 | 15:32-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-17 Sat | 27.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-18 Sun | 33.9 | FR 8418 | 06:17-11:25 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8418 | 06:17-11:25 | FrecciaDAYS (STANDARD) |
| 2026-10-19 Mon | 26.9 | NI 794 + RE 12503 | 22:03-06:25 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 27.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-20 Tue | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-21 Wed | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-22 Thu | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-23 Fri | 21.9 | IC 560 | 15:32-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:32-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-24 Sat | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-25 Sun | 33.9 | FR 8418 | 06:17-11:25 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8418 | 06:17-11:25 | FrecciaDAYS (STANDARD) |
| 2026-10-26 Mon | 21.9 | IC 95070 | 14:50-21:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 95070 | 14:50-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-27 Tue | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-28 Wed | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-29 Thu | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-30 Fri | 27.9 | IC 95072 | 11:50-18:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 95072 | 11:50-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-31 Sat | 21.9 | IC 95070 | 14:50-21:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 95070 | 14:50-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-01 Sun | 33.9 | FR 8418 | 06:19-11:25 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8418 | 06:19-11:25 | FrecciaDAYS (STANDARD) |
| 2026-11-02 Mon | 21.9 | IC 95070 | 14:50-21:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 95070 | 14:50-21:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-03 Tue | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-04 Wed | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-05 Thu | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-06 Fri | 27.9 | IC 95072 | 11:50-18:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 95072 | 11:50-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-07 Sat | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-08 Sun | 33.9 | FR 8418 | 06:19-11:25 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8418 | 06:19-11:25 | FrecciaDAYS (STANDARD) |
| 2026-11-09 Mon | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-10 Tue | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-11 Wed | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-12 Thu | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-13 Fri | 26.9 | NI 794 + RE 12503 | 22:03-06:25 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 27.9 | IC 95072 | 11:50-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-14 Sat | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-15 Sun | 28.9 | IC 1588 + RV 4105 | 09:01-17:05 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 8418 | 06:19-11:25 | FrecciaDAYS (STANDARD) |
| 2026-11-16 Mon | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-17 Tue | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-18 Wed | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-19 Thu | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-20 Fri | 21.9 | IC 95072 | 11:50-18:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 95072 | 11:50-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-21 Sat | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-22 Sun | 22.9 | IC 1588 + RV 4105 | 09:01-17:05 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 8418 | 06:19-11:25 | FrecciaDAYS (STANDARD) |
| 2026-11-23 Mon | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-24 Tue | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-25 Wed | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-26 Thu | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-27 Fri | 21.9 | IC 95072 | 11:50-18:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 95072 | 11:50-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-28 Sat | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-29 Sun | 27.9 | IC 95072 | 11:50-18:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 95072 | 11:50-18:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-30 Mon | 21.9 | IC 552 | 08:12-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 08:12-15:34 | Super Economy (2ª CLASSE EASY) |

### Reggio di Calabria Centrale -> Roma Tiburtina (`ReggioC-RomaTib`)

| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-25 Fri | 29.9 | NI 37452 + RE 20571 | 21:08-06:45 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-09-26 Sat | 28.9 | IC 560 + RV 4538 | 14:21-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-09-27 Sun | 40.0 | NI 812 + RE 21404 | 22:04-06:24 | 1 | Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 51.9 | IC 1588 | 08:41-16:31 | Economy (2ª CLASSE EASY) |
| 2026-09-28 Mon | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-09-29 Tue | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-09-30 Wed | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-01 Thu | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-02 Fri | 33.9 | FR 8868 | 14:16-20:52 | 0 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-03 Sat | 28.9 | IC 552 + RV 4156 | 07:54-16:01 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) |  |  | - |  |
| 2026-10-04 Sun | 32.0 | NI 812 + RE 21404 | 22:04-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-05 Mon | 28.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-06 Tue | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-07 Wed | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-08 Thu | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-09 Fri | 28.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-10 Sat | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-11 Sun | 32.0 | NI 812 + RE 21404 | 22:04-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 37.9 | IC 1588 | 08:41-16:31 | Super Economy (1ª CLASSE PLUS) |
| 2026-10-12 Mon | 28.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-13 Tue | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-14 Wed | 28.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-15 Thu | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-16 Fri | 28.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-17 Sat | 28.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-18 Sun | 32.0 | NI 812 + RE 21404 | 22:04-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 37.9 | IC 1588 | 08:41-16:31 | Super Economy (1ª CLASSE PLUS) |
| 2026-10-19 Mon | 28.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-20 Tue | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-21 Wed | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-22 Thu | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-23 Fri | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-24 Sat | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-25 Sun | 32.0 | NI 812 + RE 21404 | 22:04-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 37.9 | IC 1588 | 08:41-16:31 | Super Economy (1ª CLASSE PLUS) |
| 2026-10-26 Mon | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-27 Tue | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-28 Wed | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-29 Thu | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-30 Fri | 29.9 | NI 794 + RE 20571 | 21:43-06:45 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-10-31 Sat | 22.9 | IC 560 + RV 4538 | 15:13-22:58 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-01 Sun | 32.0 | NI 812 + RE 21404 | 22:04-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 35.9 | IC 1588 | 08:39-16:31 | Super Economy (1ª CLASSE PLUS) |
| 2026-11-02 Mon | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:07-16:17 | Super Economy (STANDARD) |
| 2026-11-03 Tue | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-04 Wed | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-05 Thu | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 42.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (PREMIUM) |
| 2026-11-06 Fri | 29.9 | NI 794 + RE 20571 | 21:43-06:45 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:07-16:17 | Super Economy (STANDARD) |
| 2026-11-07 Sat | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-08 Sun | 32.0 | NI 812 + RE 21404 | 22:04-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 66.9 | FR 9588 | 10:07-16:17 | Economy (STANDARD) |
| 2026-11-09 Mon | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:07-16:17 | Super Economy (STANDARD) |
| 2026-11-10 Tue | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-11 Wed | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-12 Thu | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-13 Fri | 26.9 | NI 794 + RE 20571 | 21:43-06:45 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:07-16:17 | Super Economy (STANDARD) |
| 2026-11-14 Sat | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-15 Sun | 27.9 | IC 1588 | 08:39-16:31 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 1588 | 08:39-16:31 | Super Economy (2ª CLASSE EASY) |
| 2026-11-16 Mon | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:07-16:17 | Super Economy (STANDARD) |
| 2026-11-17 Tue | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-18 Wed | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-19 Thu | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-20 Fri | 25.0 | RE 5598 + IC 95072 + RV 4734 | 10:30-19:10 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:07-16:17 | Super Economy (STANDARD) |
| 2026-11-21 Sat | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-22 Sun | 21.9 | IC 1588 | 08:39-16:31 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 1588 | 08:39-16:31 | Super Economy (2ª CLASSE EASY) |
| 2026-11-23 Mon | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:07-16:17 | Super Economy (STANDARD) |
| 2026-11-24 Tue | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-25 Wed | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-26 Thu | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-27 Fri | 25.0 | RE 5598 + IC 95072 + RV 4734 | 10:30-19:10 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 39.9 | FR 9588 | 10:07-16:17 | Super Economy (STANDARD) |
| 2026-11-28 Sat | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9588 | 10:07-16:17 | FrecciaDAYS (STANDARD) |
| 2026-11-29 Sun | 29.0 | NI 812 + RE 21404 | 22:04-06:24 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) |  |  | - |  |
| 2026-11-30 Mon | 22.9 | IC 560 + RV 4538 | 15:13-22:55 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 47.9 | FR 9588 | 10:07-16:17 | Super Economy (STANDARD) |

### Reggio di Calabria Centrale -> Roma Termini (`ReggioC-RomaTer`)

| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-25 Fri | 33.9 | FR 8332 | 15:45-21:20 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8332 | 15:45-21:20 | FrecciaDAYS (STANDARD) |
| 2026-09-26 Sat | 27.9 | IC 560 | 14:21-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 560 | 14:21-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-09-27 Sun | 42.3 | NI 812 + RE 21052 | 22:04-06:30 | 1 | Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 47.9 | FR 8418 | 05:55-11:25 | Super Economy (STANDARD) |
| 2026-09-28 Mon | 21.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-09-29 Tue | 21.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-09-30 Wed | 21.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-01 Thu | 21.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-02 Fri | 33.9 | FR 8868 | 14:16-20:16 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8868 | 14:16-20:16 | FrecciaDAYS (STANDARD) |
| 2026-10-03 Sat | 27.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-04 Sun | 35.3 | NI 812 + RE 21052 | 22:04-06:30 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 39.9 | FR 8418 | 05:58-11:25 | Super Economy (STANDARD) |
| 2026-10-05 Mon | 27.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-06 Tue | 21.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-07 Wed | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-08 Thu | 21.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-09 Fri | 27.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-10 Sat | 21.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-11 Sun | 33.9 | FR 8418 | 05:58-11:25 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8418 | 05:58-11:25 | FrecciaDAYS (STANDARD) |
| 2026-10-12 Mon | 27.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-13 Tue | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-14 Wed | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-15 Thu | 21.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-16 Fri | 27.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-17 Sat | 27.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-18 Sun | 33.9 | FR 8418 | 05:58-11:25 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8418 | 05:58-11:25 | FrecciaDAYS (STANDARD) |
| 2026-10-19 Mon | 26.9 | NI 794 + RE 12503 | 21:43-06:25 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 27.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-20 Tue | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-21 Wed | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-22 Thu | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-23 Fri | 21.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-24 Sat | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-25 Sun | 33.9 | FR 8418 | 05:58-11:25 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8418 | 05:58-11:25 | FrecciaDAYS (STANDARD) |
| 2026-10-26 Mon | 21.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-27 Tue | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-28 Wed | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-29 Thu | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-10-30 Fri | 29.9 | NI 794 + RE 12503 | 21:43-06:25 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 8868 | 14:16-20:16 | FrecciaDAYS (STANDARD) |
| 2026-10-31 Sat | 21.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-01 Sun | 33.9 | FR 8418 | 06:01-11:25 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8418 | 06:01-11:25 | FrecciaDAYS (STANDARD) |
| 2026-11-02 Mon | 21.9 | IC 560 | 15:13-22:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 560 | 15:13-22:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-03 Tue | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-04 Wed | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-05 Thu | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-06 Fri | 29.9 | NI 794 + RE 12503 | 21:43-06:25 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 9658 | 12:07-17:40 | FrecciaDAYS (STANDARD) |
| 2026-11-07 Sat | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-08 Sun | 33.9 | FR 8418 | 06:01-11:25 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8418 | 06:01-11:25 | FrecciaDAYS (STANDARD) |
| 2026-11-09 Mon | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-10 Tue | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-11 Wed | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-12 Thu | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-13 Fri | 26.9 | NI 794 + RE 12503 | 21:43-06:25 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 8418 | 06:01-11:25 | FrecciaDAYS (STANDARD) |
| 2026-11-14 Sat | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-15 Sun | 28.9 | IC 1588 + RV 4105 | 08:39-17:05 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 8418 | 06:01-11:25 | FrecciaDAYS (STANDARD) |
| 2026-11-16 Mon | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-17 Tue | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-18 Wed | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-19 Thu | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-20 Fri | 24.0 | RE 5598 + IC 95072 | 10:30-18:34 | 1 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) | 33.9 | FR 8418 | 06:01-11:25 | FrecciaDAYS (STANDARD) |
| 2026-11-21 Sat | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-22 Sun | 22.9 | IC 1588 + RV 4105 | 08:39-17:05 | 1 | Super Economy (2ª CLASSE EASY) + ORDINARIA (2ª CLASSE) | 33.9 | FR 8418 | 06:01-11:25 | FrecciaDAYS (STANDARD) |
| 2026-11-23 Mon | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-24 Tue | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-25 Wed | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-26 Thu | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-27 Fri | 24.0 | RE 5598 + IC 95072 | 10:30-18:34 | 1 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) | 33.9 | FR 8418 | 06:01-11:25 | FrecciaDAYS (STANDARD) |
| 2026-11-28 Sat | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |
| 2026-11-29 Sun | 32.3 | NI 812 + RE 21052 | 22:04-06:30 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) + ORDINARIA (2ª CLASSE PRENOTAZIONE) | 35.9 | IC 560 | 15:13-22:34 | Super Economy (1ª CLASSE PLUS) |
| 2026-11-30 Mon | 21.9 | IC 552 | 07:54-15:34 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 552 | 07:54-15:34 | Super Economy (2ª CLASSE EASY) |

### Roma Tiburtina -> Messina Centrale (`RomaTib-MessinaC`)

| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-27 Sun | 39.9 | FR 8333 + Ferry V7 | 06:48-14:00 | 1 | Super Economy (STANDARD) |  |  | - |  |
| 2026-09-28 Mon | 33.9 | FR 8333 + Ferry V7 | 06:48-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-09-29 Tue | 30.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-09-30 Wed | 33.9 | FR 8333 + Ferry V7 | 06:48-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-01 Thu | 33.9 | FR 8333 + Ferry V7 | 06:48-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-02 Fri | 33.9 | FR 8333 + Ferry V7 | 06:48-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-03 Sat | 33.9 | FR 8333 + Ferry V7 | 06:48-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-04 Sun | 33.9 | FR 8333 + Ferry V7 | 06:48-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-05 Mon | 30.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-06 Tue | 33.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (1ª CLASSE PLUS) |  |  | - |  |
| 2026-10-07 Wed | 30.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-08 Thu | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-09 Fri | 33.9 | FR 8333 + Ferry V7 | 06:48-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-10 Sat | 25.9 | NI 795 + Ferry V5 | 22:32-10:30 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) |  |  | - |  |
| 2026-10-11 Sun | 33.9 | FR 8333 + Ferry V7 | 06:48-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-12 Mon | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-13 Tue | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-14 Wed | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-15 Thu | 27.9 | NI 795 + Ferry V4 | 22:33-09:30 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) |  |  | - |  |
| 2026-10-16 Fri | 33.9 | FR 8333 + Ferry V7 | 06:48-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-17 Sat | 27.9 | IC 1589 + Ferry V16 | 14:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-18 Sun | 45.9 | IC 551 + Ferry V10 | 08:45-17:35 | 1 | Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-19 Mon | 25.9 | NI 795 + Ferry V4 | 22:33-09:30 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) |  |  | - |  |
| 2026-10-20 Tue | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-21 Wed | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-22 Thu | 23.9 | NI 795 + Ferry V4 | 22:33-09:30 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) |  |  | - |  |
| 2026-10-23 Fri | 28.9 | NI 795 + Ferry V4 | 22:33-09:30 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) |  |  | - |  |
| 2026-10-24 Sat | 27.9 | IC 1589 + Ferry V16 | 14:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-25 Sun | 33.9 | FR 8333 + Ferry V7 | 06:48-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-26 Mon | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-27 Tue | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-28 Wed | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-29 Thu | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-10-30 Fri | 33.9 | FR 8333 + Ferry V7 | 06:48-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-31 Sat | 21.9 | IC 1589 + Ferry V16 | 14:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-01 Sun | 33.9 | FR 8333 + Ferry V7 | 06:49-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-11-02 Mon | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-03 Tue | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-04 Wed | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-05 Thu | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-06 Fri | 27.9 | NI 795 + Ferry V4 | 22:33-09:30 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) |  |  | - |  |
| 2026-11-07 Sat | 28.9 | RE 20429 + RE 4505 + IC 551 + Ferry V10 | 08:31-17:35 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-08 Sun | 33.9 | FR 8333 + Ferry V7 | 06:49-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-11-09 Mon | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-10 Tue | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-11 Wed | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-12 Thu | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-13 Fri | 27.9 | NI 795 + Ferry V4 | 22:33-09:30 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) |  |  | - |  |
| 2026-11-14 Sat | 21.9 | IC 1589 + Ferry V16 | 14:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-15 Sun | 33.9 | FR 8333 + Ferry V7 | 06:49-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-11-16 Mon | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-17 Tue | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-18 Wed | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-19 Thu | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-20 Fri | 27.9 | NI 795 + Ferry V4 | 22:33-09:30 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) |  |  | - |  |
| 2026-11-21 Sat | 21.9 | IC 1589 + Ferry V16 | 14:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-22 Sun | 33.9 | FR 8333 + Ferry V7 | 06:49-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-11-23 Mon | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-24 Tue | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-25 Wed | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-26 Thu | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-27 Fri | 27.9 | NI 795 + Ferry V4 | 22:33-09:30 | 1 | Super Economy (Posto a sedere 2ª classe-EASY) |  |  | - |  |
| 2026-11-28 Sat | 28.9 | RE 20429 + RE 4505 + IC 551 + Ferry V10 | 08:31-17:35 | 3 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-29 Sun | 36.9 | IC 723 | 06:45-15:35 | 0 | Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-11-30 Mon | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-12-01 Tue | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-12-02 Wed | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |
| 2026-12-03 Thu | 23.0 | RE 5901 + IC 561 + Ferry V16 | 14:44-00:55 | 2 | ORDINARIA (2ª CLASSE) + Super Economy (2ª CLASSE EASY) |  |  | - |  |

### Roma Termini -> Messina Centrale (`RomaTer-MessinaC`)

| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-27 Sun | 39.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | Super Economy (STANDARD) | 63.5 | IC 723 | 07:26-15:35 | BASE (2ª CLASSE EASY) |
| 2026-09-28 Mon | 33.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | FrecciaDAYS (STANDARD) | 48.9 | IC 723 | 07:26-15:35 | Economy (2ª CLASSE EASY) |
| 2026-09-29 Tue | 27.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 42.9 | IC 727 | 11:26-19:35 | Economy (2ª CLASSE EASY) |
| 2026-09-30 Wed | 33.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-01 Thu | 33.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | FrecciaDAYS (STANDARD) | 42.9 | IC 723 | 07:26-15:35 | Economy (2ª CLASSE EASY) |
| 2026-10-02 Fri | 33.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | FrecciaDAYS (STANDARD) | 48.9 | IC 95057 | 11:26-19:35 | Economy (2ª CLASSE EASY) |
| 2026-10-03 Sat | 27.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 42.9 | IC 95057 | 11:26-19:35 | Economy (2ª CLASSE EASY) |
| 2026-10-04 Sun | 33.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | FrecciaDAYS (STANDARD) | 48.9 | IC 723 | 06:25-15:35 | Economy (2ª CLASSE EASY) |
| 2026-10-05 Mon | 27.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 42.9 | IC 95057 | 11:26-19:35 | Economy (2ª CLASSE EASY) |
| 2026-10-06 Tue | 27.9 | IC 555 + Ferry V15 | 14:26-23:50 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-07 Wed | 27.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 42.9 | IC 723 | 07:26-15:35 | Economy (2ª CLASSE EASY) |
| 2026-10-08 Thu | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-09 Fri | 33.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-10 Sat | 27.9 | IC 555 + Ferry V15 | 14:26-23:50 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-11 Sun | 33.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-10-12 Mon | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-13 Tue | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-14 Wed | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-15 Thu | 27.9 | IC 555 + Ferry V15 | 14:26-23:50 | 1 | Super Economy (2ª CLASSE EASY) | 42.9 | IC 95057 | 11:26-19:35 | Economy (2ª CLASSE EASY) |
| 2026-10-16 Fri | 33.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | FrecciaDAYS (STANDARD) | 42.9 | IC 95057 | 11:26-19:35 | Economy (2ª CLASSE EASY) |
| 2026-10-17 Sat | 27.9 | IC 555 + Ferry V15 | 14:26-23:50 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-18 Sun | 40.9 | IC 555 + Ferry V15 | 14:26-23:50 | 1 | Super Economy (2ª CLASSE EASY) | 48.9 | IC 95057 | 11:26-19:35 | Economy (2ª CLASSE EASY) |
| 2026-10-19 Mon | 33.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-20 Tue | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-21 Wed | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-22 Thu | 27.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-23 Fri | 33.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-24 Sat | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-25 Sun | 33.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | FrecciaDAYS (STANDARD) | 42.9 | IC 723 | 07:26-15:35 | Economy (2ª CLASSE EASY) |
| 2026-10-26 Mon | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-27 Tue | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-28 Wed | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-29 Thu | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-10-30 Fri | 33.9 | FR 8333 + Ferry V7 | 07:29-14:00 | 1 | FrecciaDAYS (STANDARD) | 42.9 | IC 723 | 07:26-15:35 | Economy (2ª CLASSE EASY) |
| 2026-10-31 Sat | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-01 Sun | 33.9 | FR 8333 + Ferry V7 | 07:30-14:00 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-02 Mon | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-03 Tue | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-04 Wed | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-05 Thu | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-06 Fri | 33.9 | FR 8333 + Ferry V7 | 07:30-14:00 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-07 Sat | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-08 Sun | 33.9 | FR 8333 + Ferry V7 | 07:30-14:00 | 1 | FrecciaDAYS (STANDARD) | 42.9 | IC 95057 | 11:26-19:35 | Economy (2ª CLASSE EASY) |
| 2026-11-09 Mon | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-10 Tue | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-11 Wed | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-12 Thu | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-13 Fri | 33.9 | FR 8333 + Ferry V7 | 07:30-14:00 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-14 Sat | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-15 Sun | 33.9 | FR 8333 + Ferry V7 | 07:30-14:00 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-16 Mon | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-17 Tue | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-18 Wed | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-19 Thu | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-20 Fri | 33.9 | FR 8333 + Ferry V7 | 07:30-14:00 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-21 Sat | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-22 Sun | 33.9 | FR 8333 + Ferry V7 | 07:30-14:00 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-23 Mon | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-24 Tue | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-25 Wed | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-26 Thu | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-27 Fri | 33.9 | FR 8333 + Ferry V7 | 07:30-14:00 | 1 | FrecciaDAYS (STANDARD) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-28 Sat | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-29 Sun | 36.9 | IC 723 | 07:26-15:35 | 0 | Super Economy (2ª CLASSE EASY) | 36.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-11-30 Mon | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-12-01 Tue | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-12-02 Wed | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 723 | 07:26-15:35 | Super Economy (2ª CLASSE EASY) |
| 2026-12-03 Thu | 21.9 | IC 561 + Ferry V16 | 16:26-00:55 | 1 | Super Economy (2ª CLASSE EASY) | 29.9 | IC 95057 | 11:26-19:35 | Super Economy (2ª CLASSE EASY) |

### Roma Tiburtina -> Villa S. Giovanni (`RomaTib-VillaSG`)

| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-27 Sun | 39.9 | FR 8333 | 06:48-12:48 | 0 | Super Economy (STANDARD) | 76.9 | FR 9587 | 14:43-21:16 | Economy (STANDARD) |
| 2026-09-28 Mon | 33.9 | FR 8333 | 06:48-12:43 | 0 | FrecciaDAYS (STANDARD) | 66.9 | FR 9587 | 14:43-21:08 | Economy (STANDARD) |
| 2026-09-29 Tue | 27.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 61.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-09-30 Wed | 33.9 | FR 8333 | 06:48-12:43 | 0 | FrecciaDAYS (STANDARD) | 61.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-01 Thu | 33.9 | FR 8333 | 06:48-12:43 | 0 | FrecciaDAYS (STANDARD) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-02 Fri | 33.9 | FR 8333 | 06:48-12:43 | 0 | FrecciaDAYS (STANDARD) | 70.9 | FR 9587 | 14:43-21:08 | Super Economy (BUSINESS) |
| 2026-10-03 Sat | 27.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 71.9 | FR 9587 | 14:43-21:08 | Economy (STANDARD) |
| 2026-10-04 Sun | 33.9 | FR 8333 | 06:48-12:43 | 0 | FrecciaDAYS (STANDARD) | 70.9 | FR 9587 | 14:43-21:08 | Super Economy (BUSINESS) |
| 2026-10-05 Mon | 27.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 61.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-06 Tue | 27.9 | IC 555 | 13:45-22:04 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-07 Wed | 27.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-08 Thu | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-09 Fri | 33.9 | FR 8333 | 06:48-12:43 | 0 | FrecciaDAYS (STANDARD) | 70.9 | FR 9587 | 14:43-21:08 | Super Economy (BUSINESS) |
| 2026-10-10 Sat | 27.9 | IC 555 | 13:45-22:04 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 1589 | 14:26-23:16 | Super Economy (2ª CLASSE EASY) |
| 2026-10-11 Sun | 33.9 | FR 8333 | 06:48-12:43 | 0 | FrecciaDAYS (STANDARD) | 71.9 | FR 9587 | 14:43-21:08 | Economy (STANDARD) |
| 2026-10-12 Mon | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 61.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-13 Tue | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-14 Wed | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-15 Thu | 27.9 | IC 555 | 13:45-22:04 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-16 Fri | 33.9 | FR 8333 | 06:48-12:43 | 0 | FrecciaDAYS (STANDARD) | 66.9 | FR 9587 | 14:43-21:08 | Economy (STANDARD) |
| 2026-10-17 Sat | 27.9 | IC 555 | 13:45-22:04 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 1589 | 14:26-23:16 | Super Economy (2ª CLASSE EASY) |
| 2026-10-18 Sun | 40.9 | IC 555 | 13:45-22:04 | 0 | Super Economy (2ª CLASSE EASY) | 70.9 | FR 9587 | 14:43-21:08 | Super Economy (BUSINESS) |
| 2026-10-19 Mon | 25.9 | NI 795 | 22:33-08:24 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-20 Tue | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-21 Wed | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-22 Thu | 23.9 | NI 795 | 22:33-08:23 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-23 Fri | 28.9 | NI 795 | 22:33-08:23 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 66.9 | FR 9587 | 14:43-21:08 | Economy (STANDARD) |
| 2026-10-24 Sat | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 1589 | 14:26-23:16 | Super Economy (2ª CLASSE EASY) |
| 2026-10-25 Sun | 33.9 | FR 8333 | 06:48-12:43 | 0 | FrecciaDAYS (STANDARD) | 66.9 | FR 9587 | 14:43-21:08 | Economy (STANDARD) |
| 2026-10-26 Mon | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 61.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-27 Tue | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-28 Wed | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-29 Thu | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-10-30 Fri | 33.9 | FR 8333 | 06:48-12:43 | 0 | FrecciaDAYS (STANDARD) | 66.9 | FR 9587 | 14:43-21:08 | Economy (STANDARD) |
| 2026-10-31 Sat | 21.9 | IC 1589 | 14:26-23:16 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 1589 | 14:26-23:16 | Super Economy (2ª CLASSE EASY) |
| 2026-11-01 Sun | 33.9 | FR 8333 | 06:49-12:43 | 0 | FrecciaDAYS (STANDARD) | 66.9 | FR 9583 | 12:43-18:35 | Economy (STANDARD) |
| 2026-11-02 Mon | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-11-03 Tue | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:35 | FrecciaDAYS (BUSINESS) |
| 2026-11-04 Wed | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:35 | FrecciaDAYS (BUSINESS) |
| 2026-11-05 Thu | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9587 | 14:43-21:08 | FrecciaDAYS (BUSINESS) |
| 2026-11-06 Fri | 27.9 | NI 795 | 22:33-08:25 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-11-07 Sat | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 65.9 | FR 9587 | 14:43-21:08 | Super Economy (PREMIUM) |
| 2026-11-08 Sun | 33.9 | FR 8333 | 06:49-12:43 | 0 | FrecciaDAYS (STANDARD) |  |  | - |  |
| 2026-11-09 Mon | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-11-10 Tue | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:35 | FrecciaDAYS (BUSINESS) |
| 2026-11-11 Wed | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:35 | FrecciaDAYS (BUSINESS) |
| 2026-11-12 Thu | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9587 | 14:43-21:08 | FrecciaDAYS (BUSINESS) |
| 2026-11-13 Fri | 27.9 | NI 795 | 22:33-08:25 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-11-14 Sat | 21.9 | IC 1589 | 14:26-23:16 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 1589 | 14:26-23:16 | Super Economy (2ª CLASSE EASY) |
| 2026-11-15 Sun | 33.9 | FR 8333 | 06:49-12:43 | 0 | FrecciaDAYS (STANDARD) | 61.9 | FR 9587 | 14:43-21:08 | Super Economy (STANDARD) |
| 2026-11-16 Mon | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-11-17 Tue | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:35 | FrecciaDAYS (BUSINESS) |
| 2026-11-18 Wed | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:35 | FrecciaDAYS (BUSINESS) |
| 2026-11-19 Thu | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:35 | FrecciaDAYS (BUSINESS) |
| 2026-11-20 Fri | 27.9 | NI 795 | 22:33-08:25 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-11-21 Sat | 21.9 | IC 1589 | 14:26-23:16 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 1589 | 14:26-23:16 | Super Economy (2ª CLASSE EASY) |
| 2026-11-22 Sun | 33.9 | FR 8333 | 06:49-12:43 | 0 | FrecciaDAYS (STANDARD) | 61.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-11-23 Mon | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-11-24 Tue | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:35 | FrecciaDAYS (BUSINESS) |
| 2026-11-25 Wed | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:35 | FrecciaDAYS (BUSINESS) |
| 2026-11-26 Thu | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:35 | FrecciaDAYS (BUSINESS) |
| 2026-11-27 Fri | 27.9 | NI 795 | 22:33-08:25 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-11-28 Sat | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 65.9 | FR 9583 | 12:43-18:35 | Super Economy (PREMIUM) |
| 2026-11-29 Sun | 37.9 | IC 555 | 13:45-22:04 | 0 | Super Economy (1ª CLASSE PLUS) | 61.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-11-30 Mon | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 47.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-12-01 Tue | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 39.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-12-02 Wed | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 51.9 | FR 9583 | 12:43-18:35 | Super Economy (STANDARD) |
| 2026-12-03 Thu | 21.9 | IC 561 | 15:45-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 76.9 | FR 9583 | 12:43-18:35 | Economy (STANDARD) |

### Roma Termini -> Villa S. Giovanni (`RomaTer-VillaSG`)

| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-27 Sun | 39.9 | FR 8333 | 07:29-12:48 | 0 | Super Economy (STANDARD) | 39.9 | FR 8333 | 07:29-12:48 | Super Economy (STANDARD) |
| 2026-09-28 Mon | 33.9 | FR 8333 | 07:29-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-12:43 | FrecciaDAYS (STANDARD) |
| 2026-09-29 Tue | 27.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-09-30 Wed | 33.9 | FR 8333 | 07:29-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-12:43 | FrecciaDAYS (STANDARD) |
| 2026-10-01 Thu | 33.9 | FR 8333 | 07:29-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-12:43 | FrecciaDAYS (STANDARD) |
| 2026-10-02 Fri | 33.9 | FR 8333 | 07:29-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-12:43 | FrecciaDAYS (STANDARD) |
| 2026-10-03 Sat | 27.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-04 Sun | 33.9 | FR 8333 | 07:29-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-12:43 | FrecciaDAYS (STANDARD) |
| 2026-10-05 Mon | 27.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-06 Tue | 27.9 | IC 555 | 14:26-22:04 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 555 | 14:26-22:04 | Super Economy (2ª CLASSE EASY) |
| 2026-10-07 Wed | 27.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-08 Thu | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-09 Fri | 33.9 | FR 8333 | 07:29-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-12:43 | FrecciaDAYS (STANDARD) |
| 2026-10-10 Sat | 27.9 | IC 555 | 14:26-22:04 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 555 | 14:26-22:04 | Super Economy (2ª CLASSE EASY) |
| 2026-10-11 Sun | 33.9 | FR 8333 | 07:29-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-12:43 | FrecciaDAYS (STANDARD) |
| 2026-10-12 Mon | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-13 Tue | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-14 Wed | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-15 Thu | 27.9 | IC 555 | 14:26-22:04 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 555 | 14:26-22:04 | Super Economy (2ª CLASSE EASY) |
| 2026-10-16 Fri | 33.9 | FR 8333 | 07:29-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-12:43 | FrecciaDAYS (STANDARD) |
| 2026-10-17 Sat | 27.9 | IC 555 | 14:26-22:04 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 555 | 14:26-22:04 | Super Economy (2ª CLASSE EASY) |
| 2026-10-18 Sun | 40.9 | IC 555 | 14:26-22:04 | 0 | Super Economy (2ª CLASSE EASY) | 40.9 | IC 555 | 14:26-22:04 | Super Economy (2ª CLASSE EASY) |
| 2026-10-19 Mon | 33.9 | FR 8333 | 07:29-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-12:43 | FrecciaDAYS (STANDARD) |
| 2026-10-20 Tue | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-21 Wed | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-22 Thu | 27.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-23 Fri | 33.9 | FR 8333 | 07:29-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-12:43 | FrecciaDAYS (STANDARD) |
| 2026-10-24 Sat | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-25 Sun | 33.9 | FR 8333 | 07:29-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-12:43 | FrecciaDAYS (STANDARD) |
| 2026-10-26 Mon | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-27 Tue | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-28 Wed | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-29 Thu | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-10-30 Fri | 33.9 | FR 8333 | 07:29-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-12:43 | FrecciaDAYS (STANDARD) |
| 2026-10-31 Sat | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-01 Sun | 33.9 | FR 8333 | 07:30-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-12:43 | FrecciaDAYS (STANDARD) |
| 2026-11-02 Mon | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-03 Tue | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-04 Wed | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-05 Thu | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-06 Fri | 33.9 | FR 8333 | 07:30-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-12:43 | FrecciaDAYS (STANDARD) |
| 2026-11-07 Sat | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-08 Sun | 33.9 | FR 8333 | 07:30-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-12:43 | FrecciaDAYS (STANDARD) |
| 2026-11-09 Mon | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-10 Tue | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-11 Wed | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-12 Thu | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-13 Fri | 33.9 | FR 8333 | 07:30-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-12:43 | FrecciaDAYS (STANDARD) |
| 2026-11-14 Sat | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-15 Sun | 33.9 | FR 8333 | 07:30-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-12:43 | FrecciaDAYS (STANDARD) |
| 2026-11-16 Mon | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-17 Tue | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-18 Wed | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-19 Thu | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-20 Fri | 33.9 | FR 8333 | 07:30-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-12:43 | FrecciaDAYS (STANDARD) |
| 2026-11-21 Sat | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-22 Sun | 33.9 | FR 8333 | 07:30-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-12:43 | FrecciaDAYS (STANDARD) |
| 2026-11-23 Mon | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-24 Tue | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-25 Wed | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-26 Thu | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-27 Fri | 33.9 | FR 8333 | 07:30-12:43 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-12:43 | FrecciaDAYS (STANDARD) |
| 2026-11-28 Sat | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-11-29 Sun | 37.9 | IC 553 | 12:26-19:52 | 0 | Super Economy (1ª CLASSE PLUS) | 37.9 | IC 553 | 12:26-19:52 | Super Economy (1ª CLASSE PLUS) |
| 2026-11-30 Mon | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-12-01 Tue | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-12-02 Wed | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |
| 2026-12-03 Thu | 21.9 | IC 561 | 16:26-23:40 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-23:40 | Super Economy (2ª CLASSE EASY) |

### Roma Tiburtina -> Reggio di Calabria Centrale (`RomaTib-ReggioC`)

| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-27 Sun | 39.9 | FR 8333 | 06:48-13:14 | 0 | Super Economy (STANDARD) | 76.9 | FR 9587 | 14:43-21:38 | Economy (STANDARD) |
| 2026-09-28 Mon | 25.9 | NI 795 | 22:33-08:47 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 66.9 | FR 9587 | 14:43-21:32 | Economy (STANDARD) |
| 2026-09-29 Tue | 27.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 61.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-09-30 Wed | 25.9 | NI 795 | 22:33-08:48 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-01 Thu | 27.9 | NI 795 | 22:33-08:47 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-02 Fri | 32.9 | NI 795 | 22:33-08:47 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 70.9 | FR 9587 | 14:43-21:32 | Super Economy (BUSINESS) |
| 2026-10-03 Sat | 27.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 71.9 | FR 9587 | 14:43-21:32 | Economy (STANDARD) |
| 2026-10-04 Sun | 33.9 | FR 8333 | 06:48-13:08 | 0 | FrecciaDAYS (STANDARD) | 70.9 | FR 9587 | 14:43-21:32 | Super Economy (BUSINESS) |
| 2026-10-05 Mon | 25.9 | NI 795 | 22:35-08:45 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-06 Tue | 27.9 | IC 555 | 13:45-22:27 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-07 Wed | 25.9 | NI 795 | 22:33-08:47 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-08 Thu | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-09 Fri | 33.9 | FR 8333 | 06:48-13:08 | 0 | FrecciaDAYS (STANDARD) | 70.9 | FR 9587 | 14:43-21:32 | Super Economy (BUSINESS) |
| 2026-10-10 Sat | 25.9 | NI 795 | 22:32-09:45 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 27.9 | IC 1589 | 14:26-23:36 | Super Economy (2ª CLASSE EASY) |
| 2026-10-11 Sun | 33.9 | FR 8333 | 06:48-13:08 | 0 | FrecciaDAYS (STANDARD) | 71.9 | FR 9587 | 14:43-21:32 | Economy (STANDARD) |
| 2026-10-12 Mon | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 61.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-13 Tue | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-14 Wed | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-15 Thu | 27.9 | IC 555 | 13:45-22:27 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-16 Fri | 33.9 | FR 8333 | 06:48-13:08 | 0 | FrecciaDAYS (STANDARD) | 66.9 | FR 9587 | 14:43-21:32 | Economy (STANDARD) |
| 2026-10-17 Sat | 27.9 | IC 555 | 13:45-22:27 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 1589 | 14:26-23:36 | Super Economy (2ª CLASSE EASY) |
| 2026-10-18 Sun | 40.9 | IC 555 | 13:45-22:27 | 0 | Super Economy (2ª CLASSE EASY) | 70.9 | FR 9587 | 14:43-21:32 | Super Economy (BUSINESS) |
| 2026-10-19 Mon | 25.9 | NI 795 | 22:33-08:47 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-20 Tue | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-21 Wed | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-22 Thu | 23.9 | NI 795 | 22:33-08:45 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-23 Fri | 28.9 | NI 795 | 22:33-08:45 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 66.9 | FR 9587 | 14:43-21:32 | Economy (STANDARD) |
| 2026-10-24 Sat | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 1589 | 14:26-23:36 | Super Economy (2ª CLASSE EASY) |
| 2026-10-25 Sun | 25.9 | NI 795 | 22:32-09:45 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 66.9 | FR 9587 | 14:43-21:32 | Economy (STANDARD) |
| 2026-10-26 Mon | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 61.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-27 Tue | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-28 Wed | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-29 Thu | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-10-30 Fri | 33.9 | FR 8333 | 06:48-13:08 | 0 | FrecciaDAYS (STANDARD) | 66.9 | FR 9587 | 14:43-21:32 | Economy (STANDARD) |
| 2026-10-31 Sat | 21.9 | IC 1589 | 14:26-23:36 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 1589 | 14:26-23:36 | Super Economy (2ª CLASSE EASY) |
| 2026-11-01 Sun | 28.9 | NI 795 | 22:32-09:45 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 66.9 | FR 9583 | 12:43-18:59 | Economy (STANDARD) |
| 2026-11-02 Mon | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-11-03 Tue | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:59 | FrecciaDAYS (BUSINESS) |
| 2026-11-04 Wed | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:59 | FrecciaDAYS (BUSINESS) |
| 2026-11-05 Thu | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9587 | 14:43-21:32 | FrecciaDAYS (BUSINESS) |
| 2026-11-06 Fri | 27.9 | NI 795 | 22:33-08:48 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-11-07 Sat | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 65.9 | FR 9587 | 14:43-21:32 | Super Economy (PREMIUM) |
| 2026-11-08 Sun | 25.9 | NI 795 | 22:32-09:45 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-11-09 Mon | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-11-10 Tue | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:59 | FrecciaDAYS (BUSINESS) |
| 2026-11-11 Wed | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:59 | FrecciaDAYS (BUSINESS) |
| 2026-11-12 Thu | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9587 | 14:43-21:32 | FrecciaDAYS (BUSINESS) |
| 2026-11-13 Fri | 27.9 | NI 795 | 22:33-08:48 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-11-14 Sat | 21.9 | IC 1589 | 14:26-23:36 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 1589 | 14:26-23:36 | Super Economy (2ª CLASSE EASY) |
| 2026-11-15 Sun | 25.9 | NI 795 | 22:32-09:45 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9587 | 14:43-21:32 | Super Economy (STANDARD) |
| 2026-11-16 Mon | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-11-17 Tue | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:59 | FrecciaDAYS (BUSINESS) |
| 2026-11-18 Wed | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:59 | FrecciaDAYS (BUSINESS) |
| 2026-11-19 Thu | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:59 | FrecciaDAYS (BUSINESS) |
| 2026-11-20 Fri | 27.9 | NI 795 | 22:33-08:48 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-11-21 Sat | 21.9 | IC 1589 | 14:26-23:36 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 1589 | 14:26-23:36 | Super Economy (2ª CLASSE EASY) |
| 2026-11-22 Sun | 25.9 | NI 795 | 22:32-09:45 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-11-23 Mon | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 56.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-11-24 Tue | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:59 | FrecciaDAYS (BUSINESS) |
| 2026-11-25 Wed | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:59 | FrecciaDAYS (BUSINESS) |
| 2026-11-26 Thu | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 50.9 | FR 9583 | 12:43-18:59 | FrecciaDAYS (BUSINESS) |
| 2026-11-27 Fri | 27.9 | NI 795 | 22:33-08:48 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-11-28 Sat | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 65.9 | FR 9583 | 12:43-18:59 | Super Economy (PREMIUM) |
| 2026-11-29 Sun | 25.9 | NI 795 | 22:32-09:45 | 0 | Super Economy (Posto a sedere 2ª classe-EASY) | 61.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-11-30 Mon | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 47.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-12-01 Tue | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 39.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-12-02 Wed | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 51.9 | FR 9583 | 12:43-18:59 | Super Economy (STANDARD) |
| 2026-12-03 Thu | 21.9 | IC 561 | 15:45-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 76.9 | FR 9583 | 12:43-18:59 | Economy (STANDARD) |

### Roma Termini -> Reggio di Calabria Centrale (`RomaTer-ReggioC`)

| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-27 Sun | 39.9 | FR 8333 | 07:29-13:14 | 0 | Super Economy (STANDARD) | 39.9 | FR 8333 | 07:29-13:14 | Super Economy (STANDARD) |
| 2026-09-28 Mon | 33.9 | FR 8333 | 07:29-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-13:08 | FrecciaDAYS (STANDARD) |
| 2026-09-29 Tue | 27.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-09-30 Wed | 33.9 | FR 8333 | 07:29-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-13:08 | FrecciaDAYS (STANDARD) |
| 2026-10-01 Thu | 33.9 | FR 8333 | 07:29-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-13:08 | FrecciaDAYS (STANDARD) |
| 2026-10-02 Fri | 33.9 | FR 8333 | 07:29-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-13:08 | FrecciaDAYS (STANDARD) |
| 2026-10-03 Sat | 27.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-04 Sun | 33.9 | FR 8333 | 07:29-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-13:08 | FrecciaDAYS (STANDARD) |
| 2026-10-05 Mon | 27.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-06 Tue | 27.9 | IC 555 | 14:26-22:27 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 555 | 14:26-22:27 | Super Economy (2ª CLASSE EASY) |
| 2026-10-07 Wed | 27.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-08 Thu | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-09 Fri | 33.9 | FR 8333 | 07:29-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-13:08 | FrecciaDAYS (STANDARD) |
| 2026-10-10 Sat | 27.9 | IC 555 | 14:26-22:27 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 555 | 14:26-22:27 | Super Economy (2ª CLASSE EASY) |
| 2026-10-11 Sun | 33.9 | FR 8333 | 07:29-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-13:08 | FrecciaDAYS (STANDARD) |
| 2026-10-12 Mon | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-13 Tue | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-14 Wed | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-15 Thu | 27.9 | IC 555 | 14:26-22:27 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 555 | 14:26-22:27 | Super Economy (2ª CLASSE EASY) |
| 2026-10-16 Fri | 33.9 | FR 8333 | 07:29-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-13:08 | FrecciaDAYS (STANDARD) |
| 2026-10-17 Sat | 27.9 | IC 555 | 14:26-22:27 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 555 | 14:26-22:27 | Super Economy (2ª CLASSE EASY) |
| 2026-10-18 Sun | 40.9 | IC 555 | 14:26-22:27 | 0 | Super Economy (2ª CLASSE EASY) | 40.9 | IC 555 | 14:26-22:27 | Super Economy (2ª CLASSE EASY) |
| 2026-10-19 Mon | 33.9 | FR 8333 | 07:29-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-13:08 | FrecciaDAYS (STANDARD) |
| 2026-10-20 Tue | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-21 Wed | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-22 Thu | 27.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 27.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-23 Fri | 33.9 | FR 8333 | 07:29-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-13:08 | FrecciaDAYS (STANDARD) |
| 2026-10-24 Sat | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-25 Sun | 33.9 | FR 8333 | 07:29-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-13:08 | FrecciaDAYS (STANDARD) |
| 2026-10-26 Mon | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-27 Tue | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-28 Wed | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-29 Thu | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-10-30 Fri | 33.9 | FR 8333 | 07:29-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:29-13:08 | FrecciaDAYS (STANDARD) |
| 2026-10-31 Sat | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-01 Sun | 33.9 | FR 8333 | 07:30-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-13:08 | FrecciaDAYS (STANDARD) |
| 2026-11-02 Mon | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-03 Tue | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-04 Wed | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-05 Thu | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-06 Fri | 33.9 | FR 8333 | 07:30-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-13:08 | FrecciaDAYS (STANDARD) |
| 2026-11-07 Sat | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-08 Sun | 33.9 | FR 8333 | 07:30-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-13:08 | FrecciaDAYS (STANDARD) |
| 2026-11-09 Mon | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-10 Tue | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-11 Wed | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-12 Thu | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-13 Fri | 33.9 | FR 8333 | 07:30-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-13:08 | FrecciaDAYS (STANDARD) |
| 2026-11-14 Sat | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-15 Sun | 33.9 | FR 8333 | 07:30-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-13:08 | FrecciaDAYS (STANDARD) |
| 2026-11-16 Mon | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-17 Tue | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-18 Wed | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-19 Thu | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-20 Fri | 33.9 | FR 8333 | 07:30-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-13:08 | FrecciaDAYS (STANDARD) |
| 2026-11-21 Sat | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-22 Sun | 33.9 | FR 8333 | 07:30-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-13:08 | FrecciaDAYS (STANDARD) |
| 2026-11-23 Mon | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-24 Tue | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-25 Wed | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-26 Thu | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-27 Fri | 33.9 | FR 8333 | 07:30-13:08 | 0 | FrecciaDAYS (STANDARD) | 33.9 | FR 8333 | 07:30-13:08 | FrecciaDAYS (STANDARD) |
| 2026-11-28 Sat | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-11-29 Sun | 37.9 | IC 553 | 12:26-20:13 | 0 | Super Economy (1ª CLASSE PLUS) | 37.9 | IC 553 | 12:26-20:13 | Super Economy (1ª CLASSE PLUS) |
| 2026-11-30 Mon | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-12-01 Tue | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-12-02 Wed | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |
| 2026-12-03 Thu | 21.9 | IC 561 | 16:26-00:00 | 0 | Super Economy (2ª CLASSE EASY) | 21.9 | IC 561 | 16:26-00:00 | Super Economy (2ª CLASSE EASY) |

## 15 cheapest round-trip combinations (Trenitalia only; Italo not available, see above)

### 2 nights (return on D+2)

| # | Origin | Out date | Total EUR | Outbound (price, train, dep-arr, arrives) | Return (price, train, dep-arr, from) |
|---|---|---|---|---|---|
| 1 | MessinaC | 2026-10-10 Sat | 43.8 | 21.9 Ferry M7 + IC 95070 12:35-21:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-10-12 Mon, from RomaTer) |
| 2 | MessinaC | 2026-10-22 Thu | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-10-24 Sat, from RomaTer) |
| 3 | MessinaC | 2026-10-24 Sat | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-10-26 Mon, from RomaTer) |
| 4 | MessinaC | 2026-10-27 Tue | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-10-29 Thu, from RomaTer) |
| 5 | MessinaC | 2026-10-29 Thu | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 1589 + Ferry V16 14:26-00:55 (2026-10-31 Sat, from RomaTib) |
| 6 | MessinaC | 2026-10-31 Sat | 43.8 | 21.9 Ferry M8 + IC 560 14:25-22:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-02 Mon, from RomaTer) |
| 7 | MessinaC | 2026-11-03 Tue | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-05 Thu, from RomaTer) |
| 8 | MessinaC | 2026-11-05 Thu | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-07 Sat, from RomaTer) |
| 9 | MessinaC | 2026-11-07 Sat | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-09 Mon, from RomaTer) |
| 10 | MessinaC | 2026-11-09 Mon | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-11 Wed, from RomaTer) |
| 11 | MessinaC | 2026-11-10 Tue | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-12 Thu, from RomaTer) |
| 12 | MessinaC | 2026-11-12 Thu | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 1589 + Ferry V16 14:26-00:55 (2026-11-14 Sat, from RomaTib) |
| 13 | MessinaC | 2026-11-14 Sat | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-16 Mon, from RomaTer) |
| 14 | MessinaC | 2026-11-16 Mon | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-18 Wed, from RomaTer) |
| 15 | MessinaC | 2026-11-17 Tue | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-19 Thu, from RomaTer) |

### 3 nights (return on D+3)

| # | Origin | Out date | Total EUR | Outbound (price, train, dep-arr, arrives) | Return (price, train, dep-arr, from) |
|---|---|---|---|---|---|
| 1 | MessinaC | 2026-10-10 Sat | 43.8 | 21.9 Ferry M7 + IC 95070 12:35-21:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-10-13 Tue, from RomaTer) |
| 2 | MessinaC | 2026-10-21 Wed | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-10-24 Sat, from RomaTer) |
| 3 | MessinaC | 2026-10-24 Sat | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-10-27 Tue, from RomaTer) |
| 4 | MessinaC | 2026-10-28 Wed | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 1589 + Ferry V16 14:26-00:55 (2026-10-31 Sat, from RomaTib) |
| 5 | MessinaC | 2026-10-31 Sat | 43.8 | 21.9 Ferry M8 + IC 560 14:25-22:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-03 Tue, from RomaTer) |
| 6 | MessinaC | 2026-11-04 Wed | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-07 Sat, from RomaTer) |
| 7 | MessinaC | 2026-11-07 Sat | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-10 Tue, from RomaTer) |
| 8 | MessinaC | 2026-11-09 Mon | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-12 Thu, from RomaTer) |
| 9 | MessinaC | 2026-11-11 Wed | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 1589 + Ferry V16 14:26-00:55 (2026-11-14 Sat, from RomaTib) |
| 10 | MessinaC | 2026-11-14 Sat | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-17 Tue, from RomaTer) |
| 11 | MessinaC | 2026-11-16 Mon | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-19 Thu, from RomaTer) |
| 12 | MessinaC | 2026-11-18 Wed | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 1589 + Ferry V16 14:26-00:55 (2026-11-21 Sat, from RomaTib) |
| 13 | MessinaC | 2026-11-21 Sat | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-24 Tue, from RomaTer) |
| 14 | MessinaC | 2026-11-23 Mon | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-26 Thu, from RomaTer) |
| 15 | MessinaC | 2026-11-25 Wed | 43.8 | 21.9 Ferry M3 + IC 552 07:25-15:34 Roma Termini | 21.9 IC 561 + Ferry V16 16:26-00:55 (2026-11-28 Sat, from RomaTer) |

## Reference only: FlixBus Messina -> Roma Tiburtina (bus station), cheapest per sample date

| Date | Cheapest EUR | Dep-Arr | Duration | Changes | Fetched (UTC) |
|---|---|---|---|---|---|
| 2026-10-06 Tue | 11.99 | 01:30-11:30 (2026-10-06) | 10h 0min | 0 | 2026-09-07T12:52 |
| 2026-10-10 Sat | 11.99 | 01:30-11:30 (2026-10-10) | 10h 0min | 0 | 2026-09-07T12:52 |
| 2026-11-10 Tue | 11.99 | 01:30-11:30 (2026-11-10) | 10h 0min | 0 | 2026-09-07T12:52 |
| 2026-11-14 Sat | 11.99 | 01:30-11:30 (2026-11-14) | 10h 0min | 0 | 2026-09-07T12:52 |

## Re-fetch consistency check (same source, end of run)

| Route | Date | Train | Price recorded | Price re-fetched | Offer re-fetched | Re-fetched at (UTC) |
|---|---|---|---|---|---|---|
| MessinaC-RomaTer | 2026-10-10 | Ferry M7 + IC 95070 | 21.9 | 21.9 | Super Economy (2ª CLASSE EASY) | 2026-09-07T13:14 |
| RomaTer-MessinaC | 2026-10-12 | IC 561 + Ferry V16 | 21.9 | 21.9 | Super Economy (2ª CLASSE EASY) | 2026-09-07T13:15 |
| MessinaC-RomaTer | 2026-10-22 | Ferry M3 + IC 552 | 21.9 | 21.9 | Super Economy (2ª CLASSE EASY) | 2026-09-07T13:15 |
| RomaTer-MessinaC | 2026-10-24 | IC 561 + Ferry V16 | 21.9 | 21.9 | Super Economy (2ª CLASSE EASY) | 2026-09-07T13:15 |
| MessinaC-RomaTer | 2026-10-24 | Ferry M3 + IC 552 | 21.9 | 21.9 | Super Economy (2ª CLASSE EASY) | 2026-09-07T13:15 |
| RomaTer-MessinaC | 2026-10-26 | IC 561 + Ferry V16 | 21.9 | 21.9 | Super Economy (2ª CLASSE EASY) | 2026-09-07T13:15 |
| MessinaC-RomaTer | 2026-10-27 | Ferry M3 + IC 552 | 21.9 | 21.9 | Super Economy (2ª CLASSE EASY) | 2026-09-07T13:15 |
| RomaTer-MessinaC | 2026-10-29 | IC 561 + Ferry V16 | 21.9 | 21.9 | Super Economy (2ª CLASSE EASY) | 2026-09-07T13:15 |
| MessinaC-RomaTer | 2026-10-29 | Ferry M3 + IC 552 | 21.9 | 21.9 | Super Economy (2ª CLASSE EASY) | 2026-09-07T13:15 |
| RomaTib-MessinaC | 2026-10-31 | IC 1589 + Ferry V16 | 21.9 | 21.9 | Super Economy (2ª CLASSE EASY) | 2026-09-07T13:15 |

