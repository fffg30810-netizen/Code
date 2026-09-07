#!/usr/bin/env python3
"""Build cheapest_per_day.csv, round_trips.csv and README tables from data/flights/raw/*.
Run from repo root: python3 data/flights/scripts/build.py
"""
import json, glob, csv, os, re, datetime, collections
RAW = "data/flights/raw"; OUT = "data/flights"
D0, D1 = datetime.date(2026, 9, 25), datetime.date(2026, 12, 3)
fares = []  # dicts: route,date,price_eur,dep_time,arr_time,airline,flight_no,source,source_url,fetched_at

def add(route, date, price, dep, arr, airline, flight_no, source, url, fetched):
    if price is None: return
    fares.append(dict(route=route, date=date, price_eur=round(float(price), 2), dep_time=dep or "", arr_time=arr or "",
                      airline=airline, flight_no=flight_no or "", source=source, source_url=url, fetched_at=fetched))

# ---------- Ryanair fare finder (cheapest per day) ----------
ryr_log = {x["file"]: x for x in json.load(open(f"{RAW}/ryanair_fetch_log.json"))}
for f in sorted(glob.glob(f"{RAW}/ryanair_???_???_2026-??.json")):
    m = re.search(r"ryanair_(\w{3})_(\w{3})_(\d{4}-\d{2})\.json", f); o, d, mon = m.groups()
    j = json.load(open(f)); meta = ryr_log.get(f, {})
    for x in j["outbound"]["fares"]:
        if x.get("price"):
            add(f"{o}-{d}", x["day"], x["price"]["value"], (x.get("departureDate") or "")[11:16], (x.get("arrivalDate") or "")[11:16],
                "Ryanair", "", "ryanair_farefinder", meta.get("url", ""), meta.get("fetched_at", ""))

# ---------- Ryanair booking availability (per flight) ----------
avail_log = {}
try:
    txt = open(f"{RAW}/ryanair_avail_log.json").read()
    for chunk in txt.strip().split("\n]\n"):
        chunk = chunk if chunk.endswith("]") else chunk + "]"
        for x in json.loads(chunk): avail_log[x["file"]] = x
except Exception as e: print("avail log parse issue", e)
ryr_flights = []  # per-flight rows
for f in sorted(glob.glob(f"{RAW}/ryanair_avail_???_???_2026-??-??.json")):
    m = re.search(r"ryanair_avail_(\w{3})_(\w{3})_(\d{4}-\d{2}-\d{2})\.json", f); o, d, _ = m.groups()
    try: j = json.load(open(f))
    except Exception: continue
    meta = avail_log.get(f, {})
    for trip in j.get("trips", []):
        for day in trip.get("dates", []):
            for fl in day.get("flights", []):
                rf = fl.get("regularFare")
                if not rf or not rf.get("fares"): continue
                amt = rf["fares"][0]["amount"]
                ryr_flights.append(dict(route=f"{o}-{d}", date=day["dateOut"][:10], price_eur=amt, dep_time=fl["time"][0][11:16], arr_time=fl["time"][1][11:16],
                                        airline="Ryanair", flight_no=fl["flightNumber"].replace(" ", ""), faresLeft=fl.get("faresLeft"), operatedBy=fl.get("operatedBy"),
                                        source="ryanair_booking_api", source_url=meta.get("url", ""), fetched_at=meta.get("fetched_at", "")))
# dedupe per-flight rows (windows do not overlap, but be safe)
seen = set(); tmp = []
for r in ryr_flights:
    k = (r["route"], r["date"], r["flight_no"], r["dep_time"])
    if k in seen: continue
    seen.add(k); tmp.append(r)
ryr_flights = tmp
for r in ryr_flights:
    add(r["route"], r["date"], r["price_eur"], r["dep_time"], r["arr_time"], "Ryanair", r["flight_no"], "ryanair_booking_api", r["source_url"], r["fetched_at"])

# ---------- Google Flights (per flight, all airlines) ----------
gf_rows = []
for f in sorted(glob.glob(f"{RAW}/gflights_???_???_2026-??-??.json")):
    j = json.load(open(f))
    o, d = j["route"].split("-")
    for fl in j.get("flights", []):
        if not fl.get("flights"): continue
        seg = fl["flights"]
        if len(seg) != 1: continue  # direct flights only
        s = seg[0]
        if s["from_airport"]["code"] != o or s["to_airport"]["code"] != d: continue
        dep = "%02d:%02d" % tuple(s["departure"]["time"]); arr = "%02d:%02d" % tuple(s["arrival"]["time"])
        airline = ", ".join(fl["airlines"])
        if fl.get("price") is None: continue
        gf_rows.append(dict(route=j["route"], date=j["date"], price_eur=fl["price"], dep_time=dep, arr_time=arr, airline=airline,
                            flight_no="", source="google_flights", source_url=j["source_url"], fetched_at=j["fetched_at"]))
for r in gf_rows:
    add(r["route"], r["date"], r["price_eur"], r["dep_time"], r["arr_time"], r["airline"], "", "google_flights", r["source_url"], r["fetched_at"])

# ---------- Aeroitalia direct (Navitaire NSK availability/search/simple) ----------
aero_log = {}
try: aero_log = {x["file"]: x for x in json.load(open(f"{RAW}/aeroitalia_fetch_log.json"))}
except Exception as e: print("aero log issue", e)
aero_flights = []
for f in sorted(glob.glob(f"{RAW}/aeroitalia_avail_???_???_2026-??-??.json")):
    m = re.search(r"aeroitalia_avail_(\w{3})_(\w{3})_(\d{4}-\d{2}-\d{2})\.json", f); o, d, day = m.groups()
    try: j = json.load(open(f)); data = j["data"]
    except Exception: continue
    meta = aero_log.get(f, {}); fa = data.get("faresAvailable", {})
    for res in data.get("results", []):
        for trip in res.get("trips", []):
            if trip["date"][:10] != day: continue
            for jn in trip.get("journeysAvailableByMarket", {}).get(f"{o}|{d}", []):
                if len(jn.get("segments", [])) != 1: continue
                seg = jn["segments"][0]; fno = seg["identifier"]["carrierCode"] + seg["identifier"]["identifier"]
                prices = [fa[x["fareAvailabilityKey"]]["totals"]["fareTotal"] for x in jn.get("fares", []) if x.get("fareAvailabilityKey") in fa]
                if not prices: continue
                aero_flights.append(dict(route=f"{o}-{d}", date=day, price_eur=min(prices), dep_time=jn["designator"]["departure"][11:16], arr_time=jn["designator"]["arrival"][11:16],
                                         airline="Aeroitalia", flight_no=fno, includeTaxesAndFees=data.get("includeTaxesAndFees"), source="aeroitalia_booking_api", source_url=meta.get("url", ""), fetched_at=meta.get("fetched_at", "")))
for r in aero_flights:
    add(r["route"], r["date"], r["price_eur"], r["dep_time"], r["arr_time"], "Aeroitalia", r["flight_no"], "aeroitalia_booking_api", r["source_url"], r["fetched_at"])
if aero_flights:
    with open(f"{OUT}/aeroitalia_all_flights.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(aero_flights[0].keys())); w.writeheader(); [w.writerow(r) for r in sorted(aero_flights, key=lambda r: (r["route"], r["date"], r["dep_time"]))]
print("aeroitalia flights", len(aero_flights))

# ---------- cheapest_per_day.csv ----------
# one row per route/date/airline/source = cheapest fare that day for that airline from that source
best = {}
for r in fares:
    if not (D0 <= datetime.date.fromisoformat(r["date"]) <= D1): continue
    k = (r["route"], r["date"], r["airline"], r["source"])
    if k not in best or r["price_eur"] < best[k]["price_eur"]: best[k] = r
rows = sorted(best.values(), key=lambda r: (r["route"], r["date"], r["price_eur"]))
with open(f"{OUT}/cheapest_per_day.csv", "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=["route", "date", "price_eur", "dep_time", "arr_time", "airline", "flight_no", "source", "source_url", "fetched_at"])
    w.writeheader(); [w.writerow(r) for r in rows]
print("cheapest_per_day rows", len(rows))

# ---------- per-flight table (all Ryanair flights) ----------
with open(f"{OUT}/ryanair_all_flights.csv", "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(ryr_flights[0].keys())); w.writeheader(); [w.writerow(r) for r in sorted(ryr_flights, key=lambda r: (r["route"], r["date"], r["dep_time"]))]

# ---------- round_trips.csv ----------
# Source priority: airline-direct data (Ryanair booking API, Aeroitalia API) beats Google Flights for the same airline.
PRIO = {"ryanair_booking_api": 0, "aeroitalia_booking_api": 0, "ryanair_farefinder": 1, "google_flights": 2}
def day_best(route, date):
    """best fare on route/date across airlines; for each airline prefer direct source."""
    per_airline = {}
    for r in best.values():
        if r["route"] == route and r["date"] == date:
            a = r["airline"]
            cur = per_airline.get(a)
            if cur is None or (PRIO[r["source"]], r["price_eur"]) < (PRIO[cur["source"]], cur["price_eur"]):
                per_airline[a] = r
    if not per_airline: return None
    return min(per_airline.values(), key=lambda r: r["price_eur"])
pairs = sorted({r["route"].split("-")[0] + "-" + r["route"].split("-")[1] for r in best.values() if r["route"].endswith("-FCO") or r["route"].endswith("-CIA")})
rt = []
for pair in pairs:
    o, d = pair.split("-")
    day = D0
    while day <= datetime.date(2026, 11, 30):
        ob = day_best(f"{o}-{d}", day.isoformat())
        for nights in (2, 3):
            rd = day + datetime.timedelta(days=nights)
            if rd > D1: continue
            ib = day_best(f"{d}-{o}", rd.isoformat())
            if ob and ib:
                rt.append(dict(pair=pair, nights=nights, out_date=day.isoformat(), out_price=ob["price_eur"], out_time=ob["dep_time"], ret_date=rd.isoformat(), ret_price=ib["price_eur"], ret_time=ib["dep_time"],
                               total_eur=round(ob["price_eur"] + ib["price_eur"], 2), airline_out=ob["airline"], airline_ret=ib["airline"], source_out=ob["source"], source_ret=ib["source"], flight_out=ob["flight_no"], flight_ret=ib["flight_no"]))
        day += datetime.timedelta(days=1)
with open(f"{OUT}/round_trips.csv", "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rt[0].keys())); w.writeheader(); [w.writerow(r) for r in rt]
print("round_trips rows", len(rt))
json.dump({"fares": rows, "round_trips": rt}, open(f"{SP}/build_out.json" if (SP := os.environ.get("SP")) else "/tmp/build_out.json", "w"))
