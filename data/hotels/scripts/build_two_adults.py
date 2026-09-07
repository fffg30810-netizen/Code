#!/usr/bin/env python3
"""two_adults_check.csv: for the 10 cheapest 1-adult combos (2 nights), the price of the same property for 2 adults in one room."""
import csv, json, os, glob
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
rows = list(csv.DictReader(open(os.path.join(base, 'cheapest_2n.csv'))))
rows.sort(key=lambda r: (float(r['total_eur']), r['checkin']))
out = []
for r in rows[:10]:
    f = os.path.join(base, 'parsed', f"booking_{r['checkin']}_2n_2a.json")
    rec = dict(property=r['property'], checkin=r['checkin'], checkout=r['checkout'], nights=2, distance_km=r['distance_km'], one_adult_total_eur=r['total_eur'], one_adult_room=r['room'], one_adult_fetched_at=r['fetched_at'])
    if not os.path.exists(f):
        rec.update(two_adults_total_eur='', two_adults_room='', two_adults_note='not fetched', two_adults_fetched_at='', two_adults_url=''); out.append(rec); continue
    d = json.load(open(f)); best = None
    for q in d['queries']:
        for x in q['results']:
            if x['name'] == r['property'] and x['total_eur'] and (best is None or x['total_eur'] < best[0]['total_eur']): best = (x, q['fetched_at'])
    url = f"https://www.booking.com/hotel/it/{best[0]['pageName']}.it.html?checkin={r['checkin']}&checkout={r['checkout']}&group_adults=2&no_rooms=1&group_children=0&selected_currency=EUR" if best else ''
    if best:
        x, ts = best
        rec.update(two_adults_total_eur=f"{x['total_eur']:.2f}", two_adults_room=x['room'], two_adults_note=('same price as 1 adult' if abs(x['total_eur'] - float(r['total_eur'])) < 0.01 else f"{x['total_eur'] - float(r['total_eur']):+.2f} vs 1 adult") + f"; city tax {x['city_tax_inclusion'].lower()} {x['city_tax_amount'].replace(chr(160), ' ')}; free cancellation {'yes' if x['free_cancellation'] else 'no'}; breakfast {'yes' if x['breakfast'] else 'no'}", two_adults_fetched_at=ts, two_adults_url=url)
    else:
        rec.update(two_adults_total_eur='', two_adults_room='', two_adults_note='property not listed for 2 adults on these dates in the Booking result pages fetched (no room for 2 available, or outside the 25 cheapest of each query)', two_adults_fetched_at=d['queries'][0]['fetched_at'], two_adults_url='')
    out.append(rec)
p = os.path.join(base, 'two_adults_check.csv')
with open(p, 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
print('wrote', p, len(out), 'rows')
for r in out: print(r['checkin'], r['property'][:30], r['one_adult_total_eur'], '->', r['two_adults_total_eur'], r['two_adults_room'][:40], '|', r['two_adults_note'][:60])
