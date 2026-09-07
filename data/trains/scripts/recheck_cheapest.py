#!/usr/bin/env python3
"""Same-source stability check: re-fetch the legs of the 5 cheapest round trips (2-night table)
and compare the headline price with the value recorded earlier. Writes recheck_cheapest.csv."""
import csv, os, sys, json, time, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import requests
from trenitalia_collect import HEADERS, post_solutions, trim, PAGE
from trenitalia_parse import parse_solution
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..")
IDS = {"MessinaC": 830012301, "VillaSG": 830011774, "ReggioC": 830011781, "RomaTib": 830008217, "RomaTer": 830008409}
rts = [r for r in csv.DictReader(open(os.path.join(OUT, "round_trips.csv"))) if r["nights"] == "2" and r["total_eur"]]
top = sorted(rts, key=lambda r: float(r["total_eur"]))[:5]
sess = requests.Session(); sess.headers.update(HEADERS)
rows = []
for r in top:
    legs = [(f"{r['origin']}-{'RomaTib' if r['out_arrival_station']=='Roma Tiburtina' else 'RomaTer'}", r["out_date"], r["out_train"], r["out_price_eur"]),
            (f"{r['ret_from_station']}-{r['origin']}", r["return_date"], r["ret_train"], r["ret_price_eur"])]
    for route, date, train, old_price in legs:
        dep, arr = route.split("-"); found = None
        for offset in range(0, 60, PAGE):
            d, code = post_solutions(sess, IDS[dep], IDS[arr], date, offset)
            time.sleep(1.0)
            if d is None:
                break
            t = trim(d)
            for s in t["solutions"]:
                p = parse_solution(s)
                if p["train"] == train and p["date"] == date:
                    found = p; break
            if found or len(t["solutions"]) < PAGE:
                break
        rows.append({"route": route, "date": date, "train": train, "price_recorded_eur": old_price,
                     "price_refetched_eur": found["price_eur"] if found else "NOT_FOUND",
                     "offer_refetched": found["offer"] if found else "", "status_refetched": found["status"] if found else "",
                     "refetched_at": datetime.datetime.utcnow().isoformat() + "Z"})
        print(rows[-1])
with open(os.path.join(OUT, "recheck_cheapest.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
