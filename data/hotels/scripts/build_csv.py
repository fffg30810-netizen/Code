#!/usr/bin/env python3
"""Build cheapest_{N}n.csv from parsed/booking_*_{N}n_{A}a.json (8 cheapest non-dorm properties within 1.5 km per check-in date)."""
import json, glob, csv, sys, os
nights = int(sys.argv[1]); adults = int(sys.argv[2]) if len(sys.argv) > 2 else 1
base = os.path.join(os.path.dirname(__file__), '..')
out = os.path.join(base, f'cheapest_{nights}n.csv' if adults == 1 else f'cheapest_{nights}n_{adults}adults.csv')
cols = 'checkin,checkout,nights,adults,rank,property,type,stars,score,reviews,distance_km,room,total_eur,taxes_included,free_cancellation,breakfast,url,source,fetched_at'.split(',')
rows = []
for f in sorted(glob.glob(os.path.join(base, 'parsed', f'booking_*_{nights}n_{adults}a.json'))):
    d = json.load(open(f))
    fetched = {}
    for q in d['queries']:
        for r in q['results']: fetched.setdefault(r['property_id'], q['fetched_at'])
    for i, r in enumerate(d['candidates'][:8], 1):
        if r['city_tax_inclusion'] == 'INCLUDED': taxes = 'yes'
        elif r['city_tax_inclusion'] == 'EXCLUDED': taxes = f"no: city tax {r['city_tax_amount'].replace(chr(160),' ')} per stay paid on site; VAT included"
        else: taxes = 'VAT included; city tax n/a'
        url = f"https://www.booking.com/hotel/it/{r['pageName']}.it.html?checkin={d['checkin']}&checkout={d['checkout']}&group_adults={adults}&no_rooms=1&group_children=0&selected_currency=EUR"
        rows.append(dict(checkin=d['checkin'], checkout=d['checkout'], nights=nights, adults=adults, rank=i, property=r['name'], type=r['type'],
            stars=r['stars'], score=r['score'] if r['score'] is not None else '', reviews=r['reviews'] if r['reviews'] is not None else '', distance_km=r['distance_km'], room=r['room'],
            total_eur=f"{r['total_eur']:.2f}", taxes_included=taxes, free_cancellation='yes' if r['free_cancellation'] else 'no', breakfast='yes' if r['breakfast'] else 'no',
            url=url, source='booking.com', fetched_at=fetched.get(r['property_id'], '')))
with open(out, 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=cols); w.writeheader(); w.writerows(rows)
print(f'wrote {out}: {len(rows)} rows from {len(set(r["checkin"] for r in rows))} dates')
