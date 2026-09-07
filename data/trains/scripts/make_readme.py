#!/usr/bin/env python3
"""Generate data/trains/README.md from the CSVs. Run after trenitalia_parse.py and round_trips.py."""
import csv, os, json, glob, collections, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..")
ROUTE_NAMES = {
    "MessinaC-RomaTib": "Messina Centrale -> Roma Tiburtina", "MessinaC-RomaTer": "Messina Centrale -> Roma Termini",
    "VillaSG-RomaTib": "Villa S. Giovanni -> Roma Tiburtina", "VillaSG-RomaTer": "Villa S. Giovanni -> Roma Termini",
    "ReggioC-RomaTib": "Reggio di Calabria Centrale -> Roma Tiburtina", "ReggioC-RomaTer": "Reggio di Calabria Centrale -> Roma Termini",
    "RomaTib-MessinaC": "Roma Tiburtina -> Messina Centrale", "RomaTer-MessinaC": "Roma Termini -> Messina Centrale",
    "RomaTib-VillaSG": "Roma Tiburtina -> Villa S. Giovanni", "RomaTer-VillaSG": "Roma Termini -> Villa S. Giovanni",
    "RomaTib-ReggioC": "Roma Tiburtina -> Reggio di Calabria Centrale", "RomaTer-ReggioC": "Roma Termini -> Reggio di Calabria Centrale",
}
ORDER = list(ROUTE_NAMES)


def dow(d):
    return datetime.date.fromisoformat(d).strftime("%a")


def main():
    cheap = list(csv.DictReader(open(os.path.join(OUT, "cheapest_per_day.csv"))))
    allsol = list(csv.DictReader(open(os.path.join(OUT, "trenitalia_all_solutions.csv"))))
    rts = list(csv.DictReader(open(os.path.join(OUT, "round_trips.csv"))))
    fetched = sorted(r["fetched_at"] for r in cheap if r.get("fetched_at"))
    errors = []
    ep = os.path.join(OUT, "raw", "trenitalia", "errors.jsonl")
    if os.path.exists(ep):
        errors = [json.loads(l) for l in open(ep) if l.strip()]
    by = collections.defaultdict(dict)
    for r in cheap:
        by[r["route"]].setdefault(r["date"], {})[r["kind"]] = r
    L = []
    A = L.append
    A("# Train prices Messina / Villa S. Giovanni / Reggio Calabria <-> Roma, 25 Sep - 3 Dec 2026\n")
    A(f"Collected live on {fetched[0][:10]} between {fetched[0][11:16]} and {fetched[-1][11:16]} UTC (1 adult, no discount cards, prices in EUR as shown by Trenitalia's own booking API). "
      "All numbers below are the real values returned by the sources at fetch time; nothing is estimated. "
      "Prices change continuously, so treat them as a snapshot.\n")
    A("## Files\n")
    A("| File | Content |\n|---|---|")
    A("| `cheapest_per_day.csv` | Per route and date: cheapest overall solution and cheapest DIRECT daytime solution (Trenitalia). `kind` column distinguishes the two. |")
    A("| `trenitalia_all_solutions.csv` | Every solution returned by Trenitalia for every route/date (train legs, times, headline price, offer). |")
    A("| `round_trips.csv` | For each outbound date and origin: cheapest outbound + cheapest return on D+2 and D+3, with total. |")
    A("| `flixbus_reference.csv` | Reference only: FlixBus Messina -> Roma Tiburtina bus station fares on 4 sample dates. |")
    A("| `raw/trenitalia/*.json` | Raw API responses (trimmed: passenger/parameter blobs and marketing descriptions removed, all prices/offers/times/trains kept). One file per route/date/page. `collect_log.txt` = full request log. |")
    A("| `raw/italo/stations.json` | Italo station list (the only Italo endpoint reachable without a session token). |")
    A("| `raw/flixbus/*.json` | Raw FlixBus search responses. |")
    A("| `scripts/` | The collection/parsing scripts (reproducible). |\n")
    A("## What could NOT be collected, and why\n")
    A("* **Italo (all routes): NOT COLLECTED.** Italo's booking API (`https://api-biglietti.italotreno.com/api/v1/booking`, and the low-fare calendar `api/v1/booking/bestprices/calendar`) requires a Bearer session token. "
      "The token is issued only by the Next.js route `POST https://biglietti.italotreno.com/api/login` (anonymous 'technical user' logon), and that path (plus `api-biglietti.../public/api/v1/users/logon`) is protected by Akamai Bot Manager: every non-browser request gets HTTP 403 'Access Denied' (reference IDs 18.54a4c017..., 18.4aa4c017..., 18.14a4c017...). "
      "The legacy API host `big.italotreno.it` is refused by this sandbox's egress proxy (502 on CONNECT). "
      "The Playwright fallback was impossible: the pre-installed Chromium cannot complete ANY TLS handshake through this sandbox's egress proxy (net::ERR_CONNECTION_RESET even for example.com; proxy log: 'tunnel closed after 6s; ClientHello sent, no reply'), tested with default flags, TLS1.2-only, post-quantum/ECH disabled and the headless-shell build. "
      "Only the Italo station list (no token needed) was saved: codes VSG = Villa San Giovanni, RCE = Reggio Calabria, RTB = Roma Tiburtina, RMT = Roma Termini, RM0 = Roma (Tutte).")
    A("* **Trainline cross-check: NOT DONE.** `POST https://www.thetrainline.com/api/journey-search/` answers HTTP 403 with a DataDome captcha challenge (geo.captcha-delivery.com). Location search works but is useless without journey search.")
    A("* **Omio cross-check: NOT DONE.** `https://www.omio.it/` answers HTTP 403 with a Cloudflare 'Just a moment...' JavaScript challenge, which cannot be solved without a browser.")
    A("* **Trainline static timetable pages** (`https://www.thetrainline.com/it/orari-treni/villa-san-giovanni-a-roma`) are reachable but only carry one aggregate 'lowPrice' (in USD) in their structured data, not per-day prices, so they cannot cross-check individual dates.")
    A("* Because no independent seller could be queried, the 5 cheapest combinations were instead RE-FETCHED from the same Trenitalia API at the end of the run (see 'Re-fetch consistency check' below). This is a same-source stability check, NOT an independent cross-check.")
    A("* **Itabus reference: NOT DONE.** `https://www.itabus.it/it/search` is a Salesforce Commerce single-page app; its search API could not be identified from the served bundles without executing them in a browser (see Chromium note above). FlixBus was collected instead (see below).")
    A("* **Trenitalia `bestFare:true` mode** returns a `minimumPrices` calendar with amount 0 for every day and no solutions, so it was not usable; all prices come from the normal solutions search, paged 10 at a time until the day was exhausted.")
    if errors:
        A(f"* **Trenitalia requests that failed permanently after retries:** {len(errors)} (see `raw/trenitalia/errors.jsonl`): " + ", ".join(f"{e['route']} {e['date']} offset {e['offset']} (HTTP {e['http']})" for e in errors))
    else:
        A("* Trenitalia: no request failed permanently. Transient Akamai 403s were retried with backoff (see `raw/trenitalia/collect_log.txt`).")
    A("")
    A("## Sources / exact URLs used\n")
    A("* Trenitalia location ids: `GET https://www.lefrecce.it/Channels.Website.BFF.WEB/website/locations/search?name=<name>&limit=10` -> Messina Centrale 830012301, Villa S. Giovanni 830011774, Reggio Di Calabria Centrale 830011781, Roma Tiburtina 830008217, Roma Termini 830008409 (Roma Tutte le Stazioni 830008349, not used).")
    A("* Trenitalia solutions: `POST https://www.lefrecce.it/Channels.Website.BFF.WEB/website/ticket/solutions` with body `{departureLocationId, arrivalLocationId, departureTime:\"<date>T00:01:00.000\", adults:1, children:0, criteria:{frecceOnly:false, regionalOnly:false, intercityOnly:false, tourismOnly:false, noChanges:false, order:\"DEPARTURE_DATE\", offset:N, limit:10}, advancedSearchRequest:{bestFare:false, bikeFilter:false}}`; paged by offset. Requires Chrome-like headers (User-Agent, sec-ch-ua, Sec-Fetch-*, Origin/Referer lefrecce.it) or Akamai answers 403.")
    A("* Italo: `GET https://api-biglietti.italotreno.com/api/v1/stations?culture=it-IT` (works); `POST .../api/v1/booking` (401 Invalid token without session); `POST https://biglietti.italotreno.com/api/login` (403 Akamai).")
    A("* Trainline: `GET https://www.thetrainline.com/api/locations-search/v2/search?searchTerm=...` (works; Messina Centrale urn:trainline:generic:loc:19880, Villa San Giovanni 20521, Reggio di Calabria Centrale 8539, Roma Tiburtina 8543, Roma Termini 8544); `POST https://www.thetrainline.com/api/journey-search/` (403 captcha).")
    A("* FlixBus: `GET https://global.api.flixbus.com/search/service/v4/search?from_city_id=a61f616b-8ab8-402b-9163-9eb7b2effad4&to_city_id=40de90ff-8646-11e6-9066-549f350fcb0c&departure_date=DD.MM.YYYY&products={\"adult\":1}&currency=EUR&locale=it&search_by=cities`.\n")
    A("## Price semantics\n")
    A("* `price_eur` = the headline 'from' price Trenitalia shows for the whole solution (sum of the cheapest SALEABLE public offer of each leg: Super Economy / Economy / Base / FrecciaDAYS / Ordinaria for regional legs). Age-restricted YOUNG/SENIOR fares are excluded. Verified: for all solutions the headline price equals the recomputed public minimum.")
    A("* `changes` = number of vehicle changes (walk Messina Centrale -> Messina Marittima is not counted as a change but is flagged in `walk_transfers` in the all-solutions file). 'Ferry Mx' = Blu Jet fast ferry Messina Marittima -> Villa S. Giovanni (ticket included in the price). `direct` = single train, no ferry/no change.")
    A("* `cheapest_direct_daytime` = single train, departure 05:00-21:59, not an Intercity Notte. For Messina -> Roma **Tiburtina** there is no direct train (see next section), so that row is `NO_DIRECT_DAYTIME_SOLUTION` and the Termini route should be read instead.\n")
    # Tiburtina analysis
    A("## Which trains actually stop at Roma Tiburtina\n")
    direct_tib = collections.Counter()
    via_ter = collections.Counter()
    for r in allsol:
        if r["route"].endswith("-RomaTib") and r["direct"] == "True":
            direct_tib[(r["route"], r["train"].split(" ")[0])] += 1
        if r["route"].endswith("-RomaTib") and r["direct"] != "True" and "Roma Termini" in r.get("offer", "") + " ":
            pass
    tib_trains = collections.defaultdict(set)
    for r in allsol:
        if r["route"].endswith("-RomaTib") and r["direct"] == "True":
            tib_trains[r["route"]].add(r["train"])
        if r["route"].startswith("RomaTib-") and r["direct"] == "True":
            tib_trains[r["route"]].add(r["train"])
    for route in ORDER:
        if route in tib_trains:
            A(f"* {ROUTE_NAMES[route]}: direct trains seen in the window: " + ", ".join(sorted(tib_trains[route])[:40]) + (" ..." if len(tib_trains[route]) > 40 else ""))
        elif "Tib" in route:
            A(f"* {ROUTE_NAMES[route]}: NO direct train in the whole window; Trenitalia always routes via Roma Termini + a regional/urban leg (e.g. RV 4xxx Termini -> Tiburtina, ~7 min), or via a change at Napoli/Villa S. Giovanni.")
    A("")
    A("Caveat: 'direct' above means Trenitalia returned a single-train solution whose last node is Roma Tiburtina. On most days the same FR/IC trains are returned as 'train to Roma Termini + walk/metro/RV leg to Tiburtina' (flagged `walk_transfers`/`changes` in the CSVs), so check `trenitalia_all_solutions.csv` (columns `train_dest`, `direct`) before assuming a train stops at Tiburtina on a given day.")
    A("Practical note: Roma Termini and Roma Tiburtina are 2 stops apart on Metro B (about 8 minutes, EUR 1.50 BIT ticket, not included in any price above); many Frecce and all Intercity from Sicily/Calabria terminate at Termini.\n")
    # tables
    A("## Cheapest price per day, every route (Trenitalia)\n")
    A("Columns: cheapest overall (price / train / dep-arr / changes / offer) and cheapest direct daytime (price / train / dep-arr / offer). Empty = none.\n")
    for route in ORDER:
        if route not in by:
            continue
        A(f"### {ROUTE_NAMES[route]} (`{route}`)\n")
        A("| Date | Cheapest EUR | Train(s) | Dep-Arr | Chg | Offer | Direct daytime EUR | Train | Dep-Arr | Offer |")
        A("|---|---|---|---|---|---|---|---|---|---|")
        for d in sorted(by[route]):
            o = by[route][d].get("cheapest_overall", {}); dd = by[route][d].get("cheapest_direct_daytime", {})
            A(f"| {d} {dow(d)} | {o.get('price_eur','')} | {o.get('train','')} | {o.get('dep_time','')}-{o.get('arr_time','')} | {o.get('changes','')} | {o.get('offer','')} | "
              f"{dd.get('price_eur','')} | {dd.get('train','') if dd.get('price_eur') else ''} | {dd.get('dep_time','')}-{dd.get('arr_time','') if dd.get('price_eur') else ''} | {dd.get('offer','') if dd.get('price_eur') else ''} |")
        A("")
    # round trips
    A("## 15 cheapest round-trip combinations (Trenitalia only; Italo not available, see above)\n")
    for nights in ("2", "3"):
        A(f"### {nights} nights (return on D+{nights})\n")
        A("| # | Origin | Out date | Total EUR | Outbound (price, train, dep-arr, arrives) | Return (price, train, dep-arr, from) |")
        A("|---|---|---|---|---|---|")
        ok = [r for r in rts if r["nights"] == nights and r["total_eur"]]
        for i, r in enumerate(sorted(ok, key=lambda r: float(r["total_eur"]))[:15], 1):
            A(f"| {i} | {r['origin']} | {r['out_date']} {dow(r['out_date'])} | {r['total_eur']} | {r['out_price_eur']} {r['out_train']} {r['out_dep']}-{r['out_arr']} {r['out_arrival_station']} | "
              f"{r['ret_price_eur']} {r['ret_train']} {r['ret_dep']}-{r['ret_arr']} ({r['return_date']} {dow(r['return_date'])}, from {r['ret_from_station']}) |")
        A("")
    # flixbus
    fb = list(csv.DictReader(open(os.path.join(OUT, "flixbus_reference.csv")))) if os.path.exists(os.path.join(OUT, "flixbus_reference.csv")) else []
    if fb:
        A("## Reference only: FlixBus Messina -> Roma Tiburtina (bus station), cheapest per sample date\n")
        A("| Date | Cheapest EUR | Dep-Arr | Duration | Changes | Fetched (UTC) |")
        A("|---|---|---|---|---|---|")
        for d in sorted(set(r["date"] for r in fb)):
            rs = [r for r in fb if r["date"] == d]; b = min(rs, key=lambda r: float(r["price_eur"]))
            A(f"| {d} {dow(d)} | {b['price_eur']} | {b['dep_time']}-{b['arr_time']} ({b['arr_date']}) | {b['duration']} | {b['changes']} | {b['fetched_at'][:16]} |")
        A("")
    rc = os.path.join(OUT, "recheck_cheapest.csv")
    if os.path.exists(rc):
        A("## Re-fetch consistency check (same source, end of run)\n")
        A("| Route | Date | Train | Price recorded | Price re-fetched | Offer re-fetched | Re-fetched at (UTC) |")
        A("|---|---|---|---|---|---|---|")
        for r in csv.DictReader(open(rc)):
            A(f"| {r['route']} | {r['date']} | {r['train']} | {r['price_recorded_eur']} | {r['price_refetched_eur']} | {r['offer_refetched']} | {r['refetched_at'][:16]} |")
        A("")
    open(os.path.join(OUT, "README.md"), "w").write("\n".join(L) + "\n")
    print("README written", len(L), "lines")


if __name__ == "__main__":
    main()
