#!/usr/bin/env python3
"""Collect Trenitalia solutions (lefrecce.it BFF) for a set of routes and dates.

Usage: trenitalia_collect.py <jobfile.json> [delay_seconds]
jobfile: {"routes": {"MessinaC-RomaTib": [depId, arrId], ...}, "dates": ["2026-09-25", ...]}

Raw responses are stored TRIMMED (travellers/parameter lists and long marketing
descriptions removed, everything price/time/train related kept) in
data/trains/raw/trenitalia/<route>_<date>_p<offset>.json
"""
import json, os, sys, time, datetime, random
import requests

BASE = "https://www.lefrecce.it/Channels.Website.BFF.WEB/website"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
    "Referer": "https://www.lefrecce.it/Channels.Website.WEB/",
    "Origin": "https://www.lefrecce.it",
    "sec-ch-ua": '"Chromium";v="128", "Google Chrome";v="128"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Content-Type": "application/json",
}
RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "raw", "trenitalia")
LOG = os.path.join(RAW_DIR, "collect_log.txt")
ERR = os.path.join(RAW_DIR, "errors.jsonl")
PAGE = 10
MAX_OFFSET = 90


def log(msg):
    line = f"{datetime.datetime.utcnow().isoformat()}Z {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def trim(resp):
    """Keep everything needed for pricing, drop bulky traveller/parameter blobs."""
    out = {k: v for k, v in resp.items() if k != "solutions"}
    out["solutions"] = []
    for s in resp.get("solutions", []):
        ns = {"solution": s.get("solution"), "grids": []}
        for g in s.get("grids", []):
            ng = {k: g.get(k) for k in ("id", "summaries", "selectedOfferId", "selectedServiceId", "regional")}
            ng["services"] = []
            for sv in g.get("services", []):
                nsv = {k: sv.get(k) for k in ("id", "name", "shortName", "groupName")}
                nsv["offers"] = []
                for o in sv.get("offers", []):
                    nsv["offers"].append({k: o.get(k) for k in (
                        "offerId", "serviceId", "serviceName", "name", "price",
                        "availableAmount", "status", "canChange", "canRefund", "isCartaFrecciaProgram")})
                ng["services"].append(nsv)
            ns["grids"].append(ng)
        out["solutions"].append(ns)
    return out


def post_solutions(sess, dep, arr, date, offset, best_fare=False):
    body = {
        "departureLocationId": dep, "arrivalLocationId": arr,
        "departureTime": f"{date}T00:01:00.000", "adults": 1, "children": 0,
        "criteria": {"frecceOnly": False, "regionalOnly": False, "intercityOnly": False,
                     "tourismOnly": False, "noChanges": False, "order": "DEPARTURE_DATE",
                     "offset": offset, "limit": PAGE},
        "advancedSearchRequest": {"bestFare": best_fare, "bikeFilter": False},
    }
    backoff = 3
    for attempt in range(7):
        try:
            r = sess.post(BASE + "/ticket/solutions", json=body, timeout=60)
        except Exception as e:  # network
            log(f"EXC {dep}->{arr} {date} off={offset} try={attempt}: {e}")
            time.sleep(backoff); backoff *= 2
            continue
        if r.status_code == 200:
            try:
                return r.json(), r.status_code
            except Exception:
                log(f"BADJSON {dep}->{arr} {date} off={offset}")
                return None, r.status_code
        if r.status_code in (403, 429, 502, 503):
            log(f"HTTP {r.status_code} {dep}->{arr} {date} off={offset} try={attempt}; sleeping {backoff}s")
            time.sleep(backoff + random.random()); backoff = min(backoff * 2, 90)
            continue
        log(f"HTTP {r.status_code} {dep}->{arr} {date} off={offset}: {r.text[:200]}")
        return None, r.status_code
    return None, -1


def main():
    job = json.load(open(sys.argv[1]))
    delay = float(sys.argv[2]) if len(sys.argv) > 2 else 0.8
    os.makedirs(RAW_DIR, exist_ok=True)
    sess = requests.Session(); sess.headers.update(HEADERS)
    for route, (dep, arr) in job["routes"].items():
        for date in job["dates"]:
            offset = 0
            while offset <= MAX_OFFSET:
                fn = os.path.join(RAW_DIR, f"{route}_{date}_p{offset:02d}.json")
                if os.path.exists(fn):
                    d = json.load(open(fn))
                    sols = d.get("solutions", [])
                else:
                    d, code = post_solutions(sess, dep, arr, date, offset)
                    time.sleep(delay + random.random() * 0.4)
                    if d is None:
                        with open(ERR, "a") as f:
                            f.write(json.dumps({"route": route, "date": date, "offset": offset, "http": code,
                                                "ts": datetime.datetime.utcnow().isoformat() + "Z"}) + "\n")
                        log(f"FAILED {route} {date} off={offset}")
                        break
                    t = trim(d)
                    t["_meta"] = {"route": route, "date": date, "offset": offset,
                                  "fetched_at": datetime.datetime.utcnow().isoformat() + "Z",
                                  "url": BASE + "/ticket/solutions", "dep_id": dep, "arr_id": arr}
                    json.dump(t, open(fn, "w"), ensure_ascii=False)
                    sols = t["solutions"]
                    log(f"OK {route} {date} off={offset} n={len(sols)}")
                if len(sols) < PAGE:
                    break
                last_dep = sols[-1]["solution"]["departureTime"][:10]
                if last_dep != date:
                    break
                offset += PAGE


if __name__ == "__main__":
    main()
