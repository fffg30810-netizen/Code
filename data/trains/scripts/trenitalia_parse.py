#!/usr/bin/env python3
"""Parse trimmed raw Trenitalia responses into CSVs.

Outputs (in data/trains/):
  trenitalia_all_solutions.csv  - every solution returned (one row per solution)
  cheapest_per_day.csv          - cheapest overall + cheapest direct daytime per route/date
Price semantics: `price_eur` is solution.price.amount, i.e. the headline "from" price
shown by lefrecce.it/trenitalia.com for 1 adult (min over public offers; age-restricted
YOUNG/SENIOR fares are NOT used). `offer` lists the offer name(s) making up that price.
"""
import csv, glob, json, os, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "raw", "trenitalia")
OUT = os.path.join(HERE, "..")
SRC_URL = "https://www.lefrecce.it/Channels.Website.BFF.WEB/website/ticket/solutions"
AGE_RESTRICTED = {"YOUNG", "SENIOR", "FRECCIAYOUNG", "FRECCIASENIOR", "BIMBI GRATIS", "FRECCIA YOUNG", "FRECCIA SENIOR"}
DAY_START, DAY_END = 5, 22  # daytime departure window [05:00, 22:00)


def leg_label(t):
    ac = t.get("acronym") or ""
    name = t.get("name") or ""
    if ac == "UB":
        return None  # walking / urban transfer
    if ac == "TR":
        return f"Ferry {name}".strip()
    return f"{ac} {name}".strip()


def public_offer(grid):
    """Return (min_price, offer_name, service_name) over SALEABLE, non age-restricted offers."""
    best = None
    for sv in grid.get("services", []):
        for o in sv.get("offers", []):
            if o.get("status") != "SALEABLE":
                continue
            p = (o.get("price") or {}).get("amount")
            if p is None:
                continue
            if (o.get("name") or "").upper() in AGE_RESTRICTED:
                continue
            if best is None or p < best[0]:
                best = (p, o.get("name"), sv.get("name"))
    return best


def parse_solution(s):
    sol = s["solution"]
    trains = sol.get("trains", [])
    legs = [leg_label(t) for t in trains]
    legs = [l for l in legs if l]
    n_walk = sum(1 for t in trains if t.get("acronym") == "UB")
    # destination actually reached by the last real vehicle (a trailing UB = walk/metro leg means the
    # train itself terminates elsewhere, e.g. Roma Termini, and the passenger continues on foot/metro)
    real_nodes = [n for n in sol.get("nodes", []) if (n.get("train") or {}).get("acronym") != "UB"]
    train_dest = real_nodes[-1]["destination"] if real_nodes else sol.get("destination")
    train_orig = real_nodes[0]["origin"] if real_nodes else sol.get("origin")
    direct = len(legs) == 1 and train_dest == sol.get("destination") and train_orig == sol.get("origin")
    dep = sol["departureTime"]; arr = sol["arrivalTime"]
    dep_h = int(dep[11:13])
    is_night = any(t.get("acronym") == "NI" for t in trains)
    daytime = (DAY_START <= dep_h < DAY_END) and not is_night
    price = (sol.get("price") or {}).get("amount")
    offers = []
    pub_total = 0.0; pub_ok = True
    for g in s.get("grids", []):
        if not g.get("services"):
            continue  # walk / ferry legs carry no fare grid (included in the train fare)
        po = public_offer(g)
        if po is None:
            pub_ok = False; continue
        pub_total += po[0]
        offers.append(f"{po[1]} ({po[2]})")
    return {
        "origin": sol.get("origin"), "destination": sol.get("destination"), "train_dest": train_dest, "train_orig": train_orig,
        "date": dep[:10], "dep_time": dep[11:16], "arr_time": arr[11:16],
        "arr_date": arr[:10], "duration": sol.get("duration"),
        "train": " + ".join(legs), "changes": max(len(legs) - 1, 0), "walk_transfers": n_walk,
        "direct": direct, "daytime": daytime, "night_train": is_night,
        "price_eur": price, "public_min_eur": round(pub_total, 2) if pub_ok and s.get("grids") else None,
        "offer": " + ".join(offers), "status": sol.get("status"), "solution_id": sol.get("id"),
        # complete_fares: every leg has a SALEABLE public offer and their sum equals the headline price
        "complete_fares": bool(pub_ok and s.get("grids") and price is not None and abs(pub_total - price) < 0.011),
    }


def main():
    files = sorted(glob.glob(os.path.join(RAW, "*_p*.json")))
    by_rd = collections.defaultdict(list)
    for fn in files:
        d = json.load(open(fn))
        m = d.get("_meta", {})
        route, date = m.get("route"), m.get("date")
        for s in d.get("solutions", []):
            r = parse_solution(s)
            if r["date"] != date:
                continue  # solution belongs to next day
            r["route"] = route; r["fetched_at"] = m.get("fetched_at"); r["raw_file"] = os.path.basename(fn)
            by_rd[(route, date)].append(r)
    # de-duplicate by solution id
    for k, rows in by_rd.items():
        seen = set(); uniq = []
        for r in rows:
            if r["solution_id"] in seen: continue
            seen.add(r["solution_id"]); uniq.append(r)
        by_rd[k] = uniq
    cols = ["route", "date", "price_eur", "public_min_eur", "train", "dep_time", "arr_time", "arr_date", "duration",
            "changes", "walk_transfers", "direct", "daytime", "night_train", "offer", "origin", "destination", "train_orig", "train_dest", "status", "complete_fares",
            "fetched_at", "raw_file"]
    with open(os.path.join(OUT, "trenitalia_all_solutions.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore"); w.writeheader()
        for k in sorted(by_rd):
            for r in sorted(by_rd[k], key=lambda x: x["dep_time"]):
                w.writerow(r)
    # cheapest per day
    ccols = ["route", "kind", "date", "price_eur", "train", "dep_time", "arr_time", "duration", "changes", "offer",
             "arrival_station", "source_url", "fetched_at"]
    rows_out = []
    for (route, date) in sorted(by_rd):
        rows = [r for r in by_rd[(route, date)] if r["price_eur"] is not None and r["status"] == "SALEABLE" and r["complete_fares"]]
        if not rows:
            rows_out.append({"route": route, "kind": "cheapest_overall", "date": date, "price_eur": "",
                             "train": "NO_SALEABLE_SOLUTION", "source_url": SRC_URL}); continue
        best = min(rows, key=lambda r: (r["price_eur"], r["changes"]))
        rows_out.append(dict(route=route, kind="cheapest_overall", date=date, price_eur=best["price_eur"], train=best["train"],
                             dep_time=best["dep_time"], arr_time=best["arr_time"], duration=best["duration"], changes=best["changes"],
                             offer=best["offer"], arrival_station=best["destination"], source_url=SRC_URL, fetched_at=best["fetched_at"]))
        dd = [r for r in rows if r["direct"] and r["daytime"]]
        if dd:
            b = min(dd, key=lambda r: r["price_eur"])
            rows_out.append(dict(route=route, kind="cheapest_direct_daytime", date=date, price_eur=b["price_eur"], train=b["train"],
                                 dep_time=b["dep_time"], arr_time=b["arr_time"], duration=b["duration"], changes=0,
                                 offer=b["offer"], arrival_station=b["destination"], source_url=SRC_URL, fetched_at=b["fetched_at"]))
        else:
            rows_out.append({"route": route, "kind": "cheapest_direct_daytime", "date": date, "price_eur": "",
                             "train": "NO_DIRECT_DAYTIME_SOLUTION", "source_url": SRC_URL, "fetched_at": best["fetched_at"]})
    with open(os.path.join(OUT, "cheapest_per_day.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=ccols); w.writeheader(); w.writerows(rows_out)
    print("route-days:", len(by_rd), "solutions:", sum(len(v) for v in by_rd.values()), "cheapest rows:", len(rows_out))


if __name__ == "__main__":
    main()
