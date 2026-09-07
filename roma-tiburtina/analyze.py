#!/usr/bin/env python3
"""Merge child-session data (git branches) and compute the cheapest total per check-in date."""
import csv, json, subprocess, datetime as dt, re, collections, os, sys

SCR = os.path.dirname(os.path.abspath(__file__))
REPO = "/home/user/Code"
def show(branch, path):
    r = subprocess.run(["git", "-C", REPO, "show", f"origin/{branch}:{path}"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ""

START, END = dt.date(2026, 9, 25), dt.date(2026, 11, 30)
BUS_MES_CTA = 8.0      # Itabus/FlixBus/SAIS Messina -> Catania aeroporto, per tratta (da 5,99 a 14 €)
FL1 = 8.0              # FL1 Fiumicino Aeroporto <-> Roma Tiburtina, per tratta
METRO = 1.50           # Termini -> Tiburtina metro B
NIGHT_BUS = 7.0        # Cotral notturno FCO <-> Tiburtina (5 € in prevendita, 7 € a bordo)

# ---------- Ryanair per-flight data ----------
fl = json.load(open(os.path.join(SCR, "ryanair_flights_by_day.json")))
flights = collections.defaultdict(list)
for k, v in fl.items():
    route, date = k.split("|")
    for price, dep, arr, fno, left in v:
        flights[(route, date)].append({"price": price, "dep": dep, "arr": arr, "fno": fno})

def tmin(t):
    h, m = t.split(":"); return int(h) * 60 + int(m)

def best_flight(route, date, practical):
    fs = flights.get((route, date), [])
    if practical:
        if route == "CTA-FCO":
            fs = [f for f in fs if tmin(f["dep"]) >= 6*60+30 and (tmin(f["arr"]) <= 22*60+30 and tmin(f["arr"]) > tmin(f["dep"]))]
        else:  # FCO-CTA: partenza non prima delle 7:00 (FL1 da Tiburtina 05:01 -> FCO 05:48)
            fs = [f for f in fs if tmin(f["dep"]) >= 7*60]
    return min(fs, key=lambda f: f["price"]) if fs else None

# ---------- trains (all solutions) ----------
tr_rows = list(csv.DictReader(show("claude/roma-data-trains", "data/trains/trenitalia_all_solutions.csv").splitlines()))
def tmin2(t):
    try:
        h, m = t.split(":"); return int(h) * 60 + int(m)
    except Exception:
        return None
def best_train(direction, date, practical):
    cands = []
    for r in tr_rows:
        if r.get("status") != "SALEABLE" or not r.get("price_eur"): continue
        if r["date"] != date: continue
        route = r["route"]
        if direction == "out" and not route.startswith("MessinaC"): continue
        if direction == "ret" and not route.endswith("MessinaC"): continue
        p = float(r["price_eur"])
        if practical:
            if r.get("night_train") == "True": continue
            if int(r.get("changes") or 0) > 1: continue
            if r.get("arr_date") and r["arr_date"] != date: continue
            dep, arr = tmin2(r["dep_time"]), tmin2(r["arr_time"])
            if dep is None or arr is None or dep < 6*60 or arr > 23*60+30: continue
        other = route.split("-")[1] if direction == "out" else route.split("-")[0]
        extra = METRO if "Ter" in other else 0.0
        cands.append((p + extra, r, extra))
    if not cands: return None
    p, r, extra = min(cands, key=lambda c: c[0])
    desc = f"{r['train']} {r['dep_time']}->{r['arr_time']} ({r['duration']}, cambi {r['changes']}) {r['offer']} {r['price_eur']}€" + (f" + metro Termini-Tiburtina {extra:.2f}€" if extra else "") + f" [{r['route']}]"
    return p, desc

# ---------- hotels ----------
hotels = {2: collections.defaultdict(list), 3: collections.defaultdict(list)}
for n, f in ((2, "cheapest_2n.csv"), (3, "cheapest_3n.csv")):
    txt = show("claude/roma-data-hotels", f"data/hotels/{f}")
    for r in csv.DictReader(txt.splitlines()):
        try:
            if r.get("adults") not in (None, "", "1"): continue
            if float(r["distance_km"] or 0) > 1.6: continue
            hotels[n][r["checkin"]].append(r)
        except Exception:
            pass

def city_tax(r, nights):
    m = re.search(r"city tax\s*€\s*([0-9]+(?:[.,][0-9]+)?)", r.get("taxes_included", ""))
    if m: return float(m.group(1).replace(",", "."))
    return 6.0 * nights   # stima: B&B/affittacamere 6 €/notte a persona

def best_hotel(date, nights, min_score=0.0, only_type=None):
    rs = [r for r in hotels[nights].get(date, []) if float(r["score"] or 0) >= min_score and (only_type is None or r["type"].lower() == only_type)]
    if not rs: return None
    r = min(rs, key=lambda x: float(x["total_eur"]))
    return r

QUIET=False
def summarize(nights, practical, min_score=0.0, label="", only_type=None):
    out = []
    d = START
    while d <= END:
        ret = d + dt.timedelta(days=nights)
        ds, rs = d.isoformat(), ret.isoformat()
        h = best_hotel(ds, nights, min_score, only_type)
        if h:
            hp = float(h["total_eur"]); tax = city_tax(h, nights)
            opts = []
            fo, fr = best_flight("CTA-FCO", ds, practical), best_flight("FCO-CTA", rs, practical)
            if fo and fr:
                night_out = tmin(fo["arr"]) < tmin(fo["dep"]) or tmin(fo["arr"]) > 22*60+30
                t_out = NIGHT_BUS if night_out else FL1
                cost = fo["price"] + fr["price"] + 2*BUS_MES_CTA + t_out + FL1
                opts.append((cost, f"AEREO Ryanair CTA-FCO: andata {ds} {fo['dep']}->{fo['arr']} {fo['price']:.2f}€, ritorno {rs} {fr['dep']}->{fr['arr']} {fr['price']:.2f}€, bus Messina-Catania aeroporto 2x{BUS_MES_CTA:.0f}€, " + ("Cotral notturno FCO-Tiburtina 7€" if night_out else "FL1 FCO-Tiburtina 8€") + f" + FL1 8€ = {cost:.2f}€"))
            to, trr = best_train("out", ds, practical), best_train("ret", rs, practical)
            if to and trr:
                cost = to[0] + trr[0]
                opts.append((cost, f"TRENO Trenitalia: andata {ds} {to[1]}; ritorno {rs} {trr[1]} = {cost:.2f}€"))
            if opts:
                opts.sort(key=lambda o: o[0])
                out.append({"checkin": ds, "wd": d.strftime("%a"), "checkout": rs, "hotel": h["property"], "hotel_price": hp, "tax": tax,
                            "hotel_info": f"{h['type']} {h['score']}/10 ({h['reviews']} rec.), {h['distance_km']} km, {h['room']}, colazione {h['breakfast']}, canc.gratis {h['free_cancellation']}",
                            "hotel_url": h.get("url",""), "transport": opts[0][0], "transport_desc": opts[0][1], "alt": opts[1] if len(opts) > 1 else None,
                            "total": hp + tax + opts[0][0]})
        d += dt.timedelta(days=1)
    out.sort(key=lambda x: x["total"])
    if QUIET: return out
    print(f"\n##### {nights} notti, {'orari comodi' if practical else 'prezzo assoluto'}{label} — {len(out)} date valutate")
    for x in out[:12]:
        print(f"{x['checkin']} ({x['wd']}) -> {x['checkout']}  TOTALE {x['total']:.2f}€ = hotel {x['hotel_price']:.2f} + tassa {x['tax']:.0f} + trasporto {x['transport']:.2f}")
        print(f"    hotel: {x['hotel']} — {x['hotel_info']}")
        print(f"    {x['transport_desc']}")
        if x['alt']: print(f"    alternativa: {x['alt'][1]}")
    return out

if __name__ == "__main__":
    res = {}
    for nights in (2, 3):
        for practical in (False, True):
            res[f"{nights}n_{'pract' if practical else 'abs'}"] = summarize(nights, practical)
        res[f"{nights}n_pract_score7"] = summarize(nights, True, 7.0, ", hotel con punteggio >= 7")
    json.dump(res, open(os.path.join(SCR, "results.json"), "w"), ensure_ascii=False, indent=1)
    print("\ncoverage: hotels2n", len(hotels[2]), "hotels3n", len(hotels[3]), "train rows", len(tr_rows))
