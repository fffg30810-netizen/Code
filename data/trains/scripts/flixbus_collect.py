#!/usr/bin/env python3
"""Reference only: FlixBus cheapest fare Messina -> Roma on 4 sample dates (public search API used by flixbus.com)."""
import json, os, time, datetime, csv, requests
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
API = "https://global.api.flixbus.com/search/service/v4/search"
MESSINA = "a61f616b-8ab8-402b-9163-9eb7b2effad4"   # from /search/autocomplete/cities?q=Messina
ROMA = "40de90ff-8646-11e6-9066-549f350fcb0c"      # from /search/autocomplete/cities?q=Roma
DATES = ["2026-10-06", "2026-10-10", "2026-11-10", "2026-11-14"]  # Tue, Sat, Tue, Sat
HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, "..", "raw", "flixbus")
os.makedirs(RAW, exist_ok=True)
rows = []
for d in DATES:
    dd = datetime.date.fromisoformat(d).strftime("%d.%m.%Y")
    params = {"from_city_id": MESSINA, "to_city_id": ROMA, "departure_date": dd, "products": json.dumps({"adult": 1}),
              "currency": "EUR", "locale": "it", "search_by": "cities", "include_after_midnight_rides": 1,
              "disable_distribusion_trips": 0, "disable_global_trips": 0}
    r = requests.get(API, params=params, headers={"User-Agent": UA, "Accept": "application/json"}, timeout=60)
    fetched = datetime.datetime.utcnow().isoformat() + "Z"
    print(d, r.status_code)
    data = r.json(); data["_meta"] = {"date": d, "fetched_at": fetched, "url": r.url}
    json.dump(data, open(os.path.join(RAW, f"flixbus_MessinaRoma_{d}.json"), "w"), ensure_ascii=False)
    st = data.get("stations", {}); stations = {k: v.get("name") for k, v in st.items()} if isinstance(st, dict) else {s["id"]: s["name"] for s in st}
    for t in data.get("trips", []):
        for rid, res in t.get("results", {}).items():
            dep = res.get("departure", {}); arr = res.get("arrival", {})
            if not dep.get("date", "").startswith(d):
                continue
            if res.get("status") != "available":
                continue
            rows.append({"date": d, "price_eur": res.get("price", {}).get("total"), "dep_time": dep.get("date", "")[11:16],
                         "arr_time": arr.get("date", "")[11:16], "arr_date": arr.get("date", "")[:10],
                         "duration": f"{res.get('duration', {}).get('hours')}h {res.get('duration', {}).get('minutes')}min",
                         "changes": max(len(res.get("legs", [])) - 1, 0), "transfer_type": res.get("transfer_type"),
                         "dep_station": stations.get(dep.get("station_id"), dep.get("station_id")),
                         "arr_station": stations.get(arr.get("station_id"), arr.get("station_id")),
                         "provider": res.get("provider"), "fetched_at": fetched, "source_url": API})
    time.sleep(1.0)
with open(os.path.join(HERE, "..", "flixbus_reference.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(sorted(rows, key=lambda r: (r["date"], r["price_eur"] or 0)))
print(len(rows), "rows")
