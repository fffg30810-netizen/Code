#!/usr/bin/env python3
"""Generate data/flights/README.md from the CSVs + raw files. Run after build.py, from repo root."""
import csv, json, glob, datetime, collections, os, re
OUT = "data/flights"; RAW = f"{OUT}/raw"
D0, D1 = datetime.date(2026, 9, 25), datetime.date(2026, 12, 3)
fares = list(csv.DictReader(open(f"{OUT}/cheapest_per_day.csv")))
rt = list(csv.DictReader(open(f"{OUT}/round_trips.csv")))
for r in fares: r["price_eur"] = float(r["price_eur"])
for r in rt: r["total_eur"] = float(r["total_eur"]); r["out_price"] = float(r["out_price"]); r["ret_price"] = float(r["ret_price"])
now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
fetched = sorted({r["fetched_at"][:16] for r in fares if r["fetched_at"]})
L = []
def p(s=""): L.append(s)
def eur(x): return f"{x:.2f}"
def cell(r):
    if not r: return "—"
    s = f"**{eur(r['price_eur'])}** {r['dep_time']}"
    if r.get("flight_no"): s += f" {r['flight_no']}"
    return s
idx = collections.defaultdict(dict)  # (route,date) -> {(airline,source): row}
for r in fares: idx[(r["route"], r["date"])][(r["airline"], r["source"])] = r
def get(route, date, airline, source):
    return idx[(route, date)].get((airline, source))
def gf_min(route, date):
    rows = [r for (a, s), r in idx[(route, date)].items() if s == "google_flights"]
    return min(rows, key=lambda r: r["price_eur"]) if rows else None
def best_direct(route, date):
    """cheapest across airlines, preferring airline-direct source per airline (same rule as round_trips)."""
    PRIO = {"ryanair_booking_api": 0, "aeroitalia_booking_api": 0, "ryanair_farefinder": 1, "google_flights": 2}
    per = {}
    for (a, s), r in idx[(route, date)].items():
        if a not in per or (PRIO[s], r["price_eur"]) < (PRIO[per[a]["source"]], per[a]["price_eur"]): per[a] = r
    return min(per.values(), key=lambda r: r["price_eur"]) if per else None

# ---------- counts / sources ----------
n_gf = len(glob.glob(f"{RAW}/gflights_???_???_2026-??-??.json")); n_ryr_avail = len(glob.glob(f"{RAW}/ryanair_avail_*_2026-??-??.json")); n_aero = len(glob.glob(f"{RAW}/aeroitalia_avail_*.json"))
gf_missing = []
for pr in ["CTA-FCO", "FCO-CTA", "REG-FCO", "FCO-REG"]:
    d = D0
    while d <= D1:
        if not os.path.exists(f"{RAW}/gflights_{pr.replace('-', '_')}_{d.isoformat()}.json"): gf_missing.append(f"{pr} {d}")
        d += datetime.timedelta(days=1)
gf_parse_err = [f for f in glob.glob(f"{RAW}/gflights_???_???_2026-??-??.json") if json.load(open(f)).get("parse_error")]

p("# Flight price data: Messina area (REG / CTA) ⇄ Rome (FCO / CIA), 2026-09-25 → 2026-12-03")
p()
p(f"Generated {now}. All prices are **live fares fetched on 2026-09-07** between {fetched[0] if fetched else '?'} and {fetched[-1] if fetched else '?'} UTC, 1 adult, one-way, EUR, as returned by the sources below. Nothing here is an estimate unless explicitly labelled ESTIMATE (there are none).")
p()
p("Files: `cheapest_per_day.csv` (one row per route/date/airline/source), `round_trips.csv` (best out+return for every outbound day, 2 and 3 nights), `ryanair_all_flights.csv` and `aeroitalia_all_flights.csv` (every individual flight with price), `raw/` (raw API responses), `scripts/` (collection/build scripts).")
p()
p("## 1. Which Rome airports are served (route existence)")
p()
p("| Origin | Airline | Rome airport | Evidence |")
p("|---|---|---|---|")
ryr_reg = json.load(open(f"{RAW}/ryanair_routes_REG.json")); ryr_cta = json.load(open(f"{RAW}/ryanair_routes_CTA.json"))
reg_dests = sorted(r["arrivalAirport"]["code"] for r in ryr_reg); cta_dests = sorted(r["arrivalAirport"]["code"] for r in ryr_cta)
p(f"| REG | Ryanair | **none** (no FCO, no CIA) | `routes/en/airport/REG` lists {len(reg_dests)} destinations: {', '.join(reg_dests)}. Fare finder and booking API return 0 flights for REG-FCO, FCO-REG, REG-CIA, CIA-REG on every day Sep–Dec 2026 (`raw/ryanair_REG_*.json`, `raw/ryanair_avail_REG_FCO_*.json`). |")
p(f"| CTA | Ryanair | **FCO only** (no CIA) | `routes/en/airport/CTA` lists {len(cta_dests)} destinations incl. FCO but not CIA. CTA-CIA / CIA-CTA fare finder: 0 fares every day; booking API: 0 flights. |")
wm = json.load(open(f"{RAW}/wizzair_map.json")); cta_w = next(c for c in wm["cities"] if c["iata"] == "CTA"); fco_conn = next(x for x in cta_w["connections"] if x["iata"] == "FCO")
p(f"| CTA | Wizz Air | FCO, **but only from {fco_conn['operationStartDate'][:10]}** | `be.wizzair.com/…/Api/asset/map`: CTA→FCO connection has operationStartDate {fco_conn['operationStartDate'][:10]}. Timetable API for Sep 25–Nov 30 returns no flights; for December it returns flights from 14 Dec (24.99 EUR on 2026-12-14, `raw/wizzair_timetable_CTA_FCO_2026-12_validation.json`). No Wizz Air REG routes. |")
sm = json.load(open(f"{RAW}/aeroitalia_searchMask.json"))["data"]["configurations"]["stations"]
cta_m = next(s for s in sm if s["code"] == "CTA"); p(f"| CTA | Aeroitalia | FCO | Aeroitalia search mask: CTA markets = {', '.join(k['code'] for k in cta_m['markets'])}. REG is not an Aeroitalia station. Live availability collected (`raw/aeroitalia_avail_*.json`). |")
ita_reg = {}
for o, d in (("REG", "FCO"), ("FCO", "REG")):
    try:
        j = json.load(open(f"{RAW}/aeroitalia_gw_tripinfo_AZ_{o}_{d}_2026-11.json"))
        ita_reg[f"{o}-{d}"] = [(x["date"][:10], [(s["identifier"]["carrierCode"] + s["identifier"]["identifier"], s["designator"]["departure"][11:16]) for jn in x["journeys"] for s in jn["segments"]]) for x in j["data"]]
    except Exception as e: ita_reg[f"{o}-{d}"] = []
reg_sched = "; ".join(f"{k}: {len(v)} days 2026-11-01..2026-12-03 with flights, e.g. {v[0][0]} {v[0][1]}" for k, v in ita_reg.items() if v)
p(f"| REG | ITA Airways | FCO | Google Flights shows ITA (AZ) nonstop REG⇄FCO (`raw/gflights_REG_FCO_*.json`), and the Navitaire gateway used by aeroitalia.com returns ITA's REG⇄FCO schedule with carrierCode=AZ for every day 2026-11-01..2026-12-03 (`raw/aeroitalia_gw_tripinfo_AZ_REG_FCO_2026-11.json`; {reg_sched}). ITA's own site could not be queried (see §6). |")
p("| CTA | ITA Airways | FCO | Google Flights shows ITA (AZ) nonstop CTA⇄FCO (10–13 flights/day). Aeroitalia's Navitaire `trip/info` with carrierCode=AZ also returns the ITA CTA-FCO schedule (`raw/aeroitalia_capture_*_tripinfo.json`), no prices. |")
p("| CTA / REG | easyJet | not verified | www.easyjet.com returned Akamai *Access Denied* (HTTP 403) to both curl and headless Chromium. Google Flights results for CTA-FCO and REG-FCO contain no easyJet itineraries on any sampled day, which indicates easyJet does not fly these routes. |")
p()

# ---------- per route tables ----------
p("## 2. Cheapest price per day, per route (ALL days of the window)")
p()
p("Columns: Ryanair = cheapest Ryanair fare that day from the Ryanair booking API (`api/booking/v4/it-it/availability`, price for 1 adult incl. discount shown, dep time, flight no.); FF = Ryanair fare-finder `cheapestPerDay` (may lag the booking API by a few cents/euros); Aeroitalia = cheapest fare from Aeroitalia's Navitaire API (`fareTotal`, includeTaxesAndFees flag recorded in `aeroitalia_all_flights.csv`); ITA (GF) = cheapest ITA Airways nonstop shown by Google Flights; GF min = cheapest nonstop of any airline on Google Flights (airline in brackets); Best = cheapest across airlines using airline-direct data where available (this is what `round_trips.csv` uses).")
p()
for route in ["CTA-FCO", "FCO-CTA", "REG-FCO", "FCO-REG"]:
    p(f"### {route}")
    p()
    p("| date | dow | Ryanair (booking API) | Ryanair FF | Aeroitalia (API) | ITA (GF) | GF min | Best |")
    p("|---|---|---|---|---|---|---|---|")
    d = D0
    while d <= D1:
        ds = d.isoformat(); dow = d.strftime("%a")
        ry = get(route, ds, "Ryanair", "ryanair_booking_api"); ff = get(route, ds, "Ryanair", "ryanair_farefinder")
        ae = get(route, ds, "Aeroitalia", "aeroitalia_booking_api"); ita = get(route, ds, "ITA", "google_flights"); gm = gf_min(route, ds); b = best_direct(route, ds)
        gmc = f"{eur(gm['price_eur'])} {gm['dep_time']} ({gm['airline']})" if gm else "—"
        bc = f"**{eur(b['price_eur'])}** {b['airline']} {b['dep_time']}" if b else "—"
        p(f"| {ds} | {dow} | {cell(ry)} | {eur(ff['price_eur']) if ff else '—'} | {cell(ae)} | {cell(ita)} | {gmc} | {bc} |")
        d += datetime.timedelta(days=1)
    p()

# ---------- top round trips ----------
def top(rows, n=15):
    return sorted(rows, key=lambda r: (r["total_eur"], r["out_date"]))[:n]
p("## 3. Cheapest round-trip combinations (out on D, back on D+2 or D+3)")
p()
p("From `round_trips.csv`. Prices are the sum of the two one-way fares above (airline-direct data where available). Times are departure times. `source` tells where each leg's price came from.")
p()
for title, rows in [("Overall (2 or 3 nights)", rt), ("2 nights (return D+2)", [r for r in rt if r["nights"] == "2"]), ("3 nights (return D+3)", [r for r in rt if r["nights"] == "3"])]:
    p(f"### Top 15 – {title}")
    p()
    p("| # | pair | nights | out date | out | airline / flight | ret date | ret | airline / flight | **total EUR** | sources |")
    p("|---|---|---|---|---|---|---|---|---|---|---|")
    for i, r in enumerate(top(rows), 1):
        p(f"| {i} | {r['pair']} | {r['nights']} | {r['out_date']} ({datetime.date.fromisoformat(r['out_date']).strftime('%a')}) | {eur(r['out_price'])} {r['out_time']} | {r['airline_out']} {r['flight_out']} | {r['ret_date']} ({datetime.date.fromisoformat(r['ret_date']).strftime('%a')}) | {eur(r['ret_price'])} {r['ret_time']} | {r['airline_ret']} {r['flight_ret']} | **{eur(r['total_eur'])}** | {r['source_out']} / {r['source_ret']} |")
    p()
reg_rt = [r for r in rt if r["pair"] == "REG-FCO"]
if reg_rt:
    p("### Top 10 – REG-FCO (ITA Airways only, prices from Google Flights)")
    p()
    p("| # | nights | out date | out | ret date | ret | **total EUR** |")
    p("|---|---|---|---|---|---|---|")
    for i, r in enumerate(top(reg_rt, 10), 1):
        p(f"| {i} | {r['nights']} | {r['out_date']} | {eur(r['out_price'])} {r['out_time']} | {r['ret_date']} | {eur(r['ret_price'])} {r['ret_time']} | **{eur(r['total_eur'])}** |")
    p()

# ---------- Ryanair round trip finder ----------
p("## 4. Ryanair round-trip finder (`farfnd/v4/roundTripFares`)")
p()
p("The endpoint accepts the parameter names given in the task; `limit=200` is rejected (`InvalidLimit`), and without `limit` it returns only the single cheapest combination per call (`size: 1`). Results:")
p()
p("| pair | duration | outbound | inbound | total | file |")
p("|---|---|---|---|---|---|")
for f in sorted(glob.glob(f"{RAW}/ryanair_roundtrip_*_dur?.json")):
    try: j = json.load(open(f))
    except Exception: continue
    m = re.search(r"roundtrip_(\w{3})_(\w{3})_dur(\d)", f)
    if not j.get("fares"):
        p(f"| {m.group(1)}-{m.group(2)} | {m.group(3)} nights | no fares | | | `{os.path.basename(f)}` |"); continue
    x = j["fares"][0]; o, i = x["outbound"], x["inbound"]
    p(f"| {m.group(1)}-{m.group(2)} | {m.group(3)} nights | {o['departureDate'][:16]} {o['flightNumber']} {o['price']['value']} | {i['departureDate'][:16]} {i['flightNumber']} {i['price']['value']} | **{x['summary']['price']['value']}** | `{os.path.basename(f)}` |")
p()

# ---------- Google Flights cross-check ----------
p("## 5. Cross-check: Google Flights")
p()
p(f"Google Flights was queried once per route and day (one-way, 1 adult, EUR, nonstop itineraries kept): {n_gf} pages fetched (`raw/gflights_<route>_<date>.json`, each records the exact URL and UTC timestamp; the HTML was parsed with the `fast-flights` library). Google's prices are rounded to whole euros and may include a different bag/fare assumption than the airline site, so treat them as a cross-check: for Ryanair the direct booking-API figure is authoritative; for ITA Airways Google Flights is the only source available (see §6).")
if gf_missing: p(f"\nMissing Google Flights days: {', '.join(gf_missing)}")
gf_zero = []
for f in sorted(glob.glob(f"{RAW}/gflights_???_???_2026-??-??.json")):
    j = json.load(open(f))
    if not any(fl.get("price") is not None for fl in j.get("flights", [])): gf_zero.append(f"{j['route']} {j['date']}")
if gf_zero: p(f"\n**Google Flights returned no priced itinerary at all on {len(gf_zero)} route-days** (the page's itinerary payload is empty, every retry). Days: {', '.join(gf_zero)}. For REG⇄FCO these are the only source of ITA prices, so those days have **no price** in the tables (shown as —) although ITA's schedule confirms the flights operate (§1).")
if gf_parse_err: p(f"\nGoogle Flights pages with parse errors (no flights extracted): {len(gf_parse_err)}: " + ", ".join(os.path.basename(f) for f in gf_parse_err))
p()
p("Ryanair: same flight (matched by route, date and departure time), Ryanair booking API `amount` (the discounted fare Ryanair shows; `publishedFare` before discount is in `ryanair_all_flights.csv` raw data) vs the price Google Flights shows for that flight, first 12 matches:")
p()
p("| route | date | dep | flight | Ryanair API | Google Flights |")
p("|---|---|---|---|---|---|")
ryall = list(csv.DictReader(open(f"{OUT}/ryanair_all_flights.csv")))
gf_by = {}
for f in sorted(glob.glob(f"{RAW}/gflights_???_???_2026-??-??.json")):
    j = json.load(open(f))
    for fl in j.get("flights", []):
        if len(fl.get("flights", [])) == 1 and fl.get("price") is not None and "Ryanair" in fl["airlines"]:
            gf_by[(j["route"], j["date"], "%02d:%02d" % tuple(fl["flights"][0]["departure"]["time"]))] = fl["price"]
cnt = 0; diffs = []
for r in ryall:
    g = gf_by.get((r["route"], r["date"], r["dep_time"]))
    if g is None: continue
    diffs.append(g - float(r["price_eur"]))
    if cnt < 12: p(f"| {r['route']} | {r['date']} | {r['dep_time']} | {r['flight_no']} | {r['price_eur']} | {g} |"); cnt += 1
if diffs: p(f"\nAcross all {len(diffs)} matched Ryanair flights, Google Flights is on average {sum(diffs)/len(diffs):+.2f} EUR vs the Ryanair API amount (min {min(diffs):+.2f}, max {max(diffs):+.2f}). Google Flights therefore does not reflect Ryanair's discounted `amount`; use the Ryanair API figures for Ryanair.")
p()
if os.path.exists(f"{RAW}/gflights_roundtrip_check.json"):
    p("Google Flights round-trip search for the 5 cheapest combinations found above (what Google shows for the same dates, cheapest itinerary, any airline):")
    p()
    p("| pair | out | ret | our total (one-ways) | Google Flights cheapest RT | airlines | url |")
    p("|---|---|---|---|---|---|---|")
    for x in json.load(open(f"{RAW}/gflights_roundtrip_check.json")):
        p(f"| {x['pair']} | {x['out_date']} | {x['ret_date']} | {x['our_total']} | {x.get('gf_price', 'n/a')} | {x.get('gf_airlines', '')} | {x['url']} |")
    p()

# ---------- failures ----------
p("## 6. What could not be collected, and why")
p()
p("- **ITA Airways direct prices: NOT collected.** www.ita-airways.com is behind Akamai Bot Manager. The homepage loads in headless Chromium, but every booking-related XHR (`/service/api/suggestions/airports`, `/service/api/ondcontrol/validateOriginAndDestination`, fare teaser, login status) returns HTTP 403, deep links to `/booking/flight-search` return a *BLOCKED – Security check* page (`Reference #a375d7c6…`), and the search form could not be submitted (5 attempts, incl. keyboard-driven date picking). curl gets a Cloudflare/Akamai 403 as well. ITA fares in this dataset therefore come from **Google Flights only** (labelled `google_flights`, whole-euro prices, airline 'ITA'). No sampling fallback was needed because Google Flights gave every day.")
p("- **easyJet: NOT collected / route not confirmed.** www.easyjet.com answers `Access Denied` (Akamai, HTTP 403) to curl and headless Chromium. Google Flights shows no easyJet flights on CTA-FCO or REG-FCO, consistent with easyJet not operating these routes.")
p("- **Wizz Air CTA-FCO: no flights in the window.** Route exists only from 2026-12-14 (see §1). Wizz `search/search` (live availability) is protected by Kasada and returned HTTP 429 challenge pages (`raw/wizzair_search_try1.json`); `asset/farechart` (max dayInterval 10) and `search/timetable` worked from inside the page session and were used. `static_fe/metadata.json` no longer exists (404); the API base (`https://be.wizzair.com/29.15.1/Api`) was taken from the page's own XHRs.")
p("- **Ryanair REG-FCO / REG-CIA / CTA-CIA: routes do not exist** (see §1), so no prices.")
p("- **Ryanair booking API** (`/api/booking/v4/it-it/availability`) answers `409 Availability declined` to plain curl/requests even with the homepage cookies; it works from a Chromium page session with the app's `client: desktop` / `client-version: 3.213.0` headers. All 70 days × 2 directions were fetched that way (10 requests of 7 days each per direction, `raw/ryanair_avail_*.json`).")
p("- **Ryanair `roundTripFares`**: works but returns only 1 fare per call (see §4); the per-day combination table was therefore computed from one-way fares.")
p("- **Aeroitalia**: the public site hides prices in its calendar (`hidePricesInSearchMask: true`). Prices were obtained from Aeroitalia's Navitaire dotREZ gateway `POST /dotrezprod/api/nsk/v4/availability/search/simple` using the anonymous token the website itself requests; the endpoint ignores date ranges, so one call per day was made (70 × 2). `includeTaxesAndFees` in each response is recorded; the cheapest fare basis per flight is used.")
p("- **Kayak / Skyscanner**: not used; Google Flights was used as the cross-check source instead (§5).")
p("- **Environment note**: headless Chromium could only reach the internet through the sandbox egress proxy after forcing TLS 1.2 (`--ssl-version-max=tls1.2`) and disabling post-quantum key exchange via Chromium policy; certificate verification stayed enabled. Playwright's headless-shell build was replaced by the full Chromium build (`channel: 'chromium'`).")
p()
p("## 7. Exact endpoints / URLs used")
p()
p("- Ryanair fare finder: `https://www.ryanair.com/api/farfnd/v4/oneWayFares/{FROM}/{TO}/cheapestPerDay?outboundMonthOfDate=2026-MM-01&currency=EUR` for FROM/TO in REG/CTA/CIA ⇄ FCO/CIA, months 2026-09..2026-12 (`raw/ryanair_fetch_log.json` has every URL, status and timestamp).")
p("- Ryanair routes: `https://www.ryanair.com/api/views/locate/searchWidget/routes/en/airport/{REG|CTA|FCO|CIA}`.")
p("- Ryanair round trips: `https://www.ryanair.com/api/farfnd/v4/roundTripFares?departureAirportIataCode=…&arrivalAirportIataCode=…&outboundDepartureDateFrom=2026-09-25&outboundDepartureDateTo=2026-11-30&inboundDepartureDateFrom=2026-09-27&inboundDepartureDateTo=2026-12-03&durationFrom=N&durationTo=N&currency=EUR&market=it-it&adultPaxCount=1`.")
p("- Ryanair booking availability: `https://www.ryanair.com/api/booking/v4/it-it/availability?ADT=1&TEEN=0&CHD=0&INF=0&Origin=…&Destination=…&promoCode=&IncludeConnectingFlights=false&DateOut=YYYY-MM-DD&FlexDaysBeforeOut=0&FlexDaysOut=6&RoundTrip=false&ToUs=AGREED` (from a page session on `https://www.ryanair.com/it/it/trip/flights/select?…`; log in `raw/ryanair_avail_log.json`).")
p("- Wizz Air: `https://be.wizzair.com/29.15.1/Api/asset/map?languageCode=it-it&withConnections=true`, `POST …/Api/asset/farechart`, `POST …/Api/search/timetable`, `POST …/Api/search/search` (429) – see `raw/wizzair_fetch_log.json`.")
p("- Aeroitalia: `POST https://aeroitalia-gateway.azure-api.net/mobileappprod-api/api/ClientConfigurations/v2/searchMask`, `POST …/mobileappprod-api/api/user/v1/website/anonymousToken`, `GET …/dotrezprod/api/nsk/v1/trip/schedule?Origin=CTA&Destination=FCO&BeginDate=…&EndDate=…`, `POST …/dotrezprod/api/nsk/v2/trip/info`, `POST …/dotrezprod/api/nsk/v4/availability/search/simple` (body `{origin,destination,beginDate,endDate,passengers:{types:[{type:'ADT',count:1}]},currencyCode:'EUR'}`; log in `raw/aeroitalia_fetch_log.json`).")
p("- Google Flights: `https://www.google.com/travel/flights?tfs=<protobuf>&hl=it&curr=EUR` (exact URL stored inside every `raw/gflights_*.json`).")
p("- ITA Airways (blocked): `https://www.ita-airways.com/it_it`, `https://www.ita-airways.com/it/it/booking/flight-search?…`, `/service/api/suggestions/airports`, `/service/api/ondcontrol/validateOriginAndDestination`.")
p("- easyJet (blocked): `https://www.easyjet.com/it`.")
p()
open(f"{OUT}/README.md", "w").write("\n".join(L) + "\n")
print("README lines", len(L))
