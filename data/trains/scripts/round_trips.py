#!/usr/bin/env python3
"""Build round_trips.csv from cheapest_per_day.csv (+ italo_cheapest_per_day.csv if present).

For each outbound date D and origin (MessinaC / VillaSG / ReggioC): cheapest outbound to Roma
(Tiburtina or Termini, whichever is cheaper; both recorded) + cheapest return on D+2 and D+3.
"""
import csv, os, datetime, collections
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..")
ORIGINS = ["MessinaC", "VillaSG", "ReggioC"]
ROMA = ["RomaTib", "RomaTer"]


def load():
    best = {}  # (route, date) -> row (cheapest_overall)
    for fn in ["cheapest_per_day.csv", "italo_cheapest_per_day.csv"]:
        p = os.path.join(OUT, fn)
        if not os.path.exists(p):
            continue
        for r in csv.DictReader(open(p)):
            if r["kind"] != "cheapest_overall" or not r["price_eur"]:
                continue
            r["price_eur"] = float(r["price_eur"])
            k = (r["route"], r["date"])
            if k not in best or r["price_eur"] < best[k]["price_eur"]:
                best[k] = r
    return best


def cheapest_leg(best, origin, date, outbound=True):
    cands = []
    for st in ROMA:
        route = f"{origin}-{st}" if outbound else f"{st}-{origin}"
        r = best.get((route, date))
        if r:
            cands.append(r)
    return min(cands, key=lambda r: r["price_eur"]) if cands else None


def main():
    best = load()
    d0, d1 = datetime.date(2026, 9, 25), datetime.date(2026, 11, 30)
    rows = []
    for origin in ORIGINS:
        d = d0
        while d <= d1:
            out = cheapest_leg(best, origin, d.isoformat(), True)
            for nights in (2, 3):
                rd = d + datetime.timedelta(days=nights)
                ret = cheapest_leg(best, origin, rd.isoformat(), False)
                row = {"origin": origin, "out_date": d.isoformat(), "nights": nights, "return_date": rd.isoformat(),
                       "total_eur": round(out["price_eur"] + ret["price_eur"], 2) if out and ret else "",
                       "out_price_eur": out["price_eur"] if out else "", "out_train": out["train"] if out else "MISSING",
                       "out_dep": out["dep_time"] if out else "", "out_arr": out["arr_time"] if out else "",
                       "out_arrival_station": out["arrival_station"] if out else "", "out_offer": out["offer"] if out else "",
                       "ret_price_eur": ret["price_eur"] if ret else "", "ret_train": ret["train"] if ret else "MISSING",
                       "ret_dep": ret["dep_time"] if ret else "", "ret_arr": ret["arr_time"] if ret else "",
                       "ret_from_station": ret["route"].split("-")[0] if ret else "", "ret_offer": ret["offer"] if ret else ""}
                rows.append(row)
            d += datetime.timedelta(days=1)
    with open(os.path.join(OUT, "round_trips.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    ok = [r for r in rows if r["total_eur"] != ""]
    print("rows", len(rows), "complete", len(ok))
    for r in sorted(ok, key=lambda r: r["total_eur"])[:5]:
        print(r["origin"], r["out_date"], r["nights"], r["total_eur"], r["out_train"], "|", r["ret_train"])


if __name__ == "__main__":
    main()
