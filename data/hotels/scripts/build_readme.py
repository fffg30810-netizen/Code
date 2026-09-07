#!/usr/bin/env python3
"""Generate data/hotels/README.md from parsed JSON, CSVs and cross-check files. Static notes live in notes.md (prepended sections)."""
import json, glob, os, csv, statistics, re
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
def load(nights, adults=1):
    out = {}
    for f in sorted(glob.glob(os.path.join(base, 'parsed', f'booking_*_{nights}n_{adults}a.json'))):
        d = json.load(open(f)); out[d['checkin']] = d
    return out
def eur(x): return f"€{x:.2f}"
def fetched_range(dsets):
    ts = [q['fetched_at'] for ds in dsets for d in ds.values() for q in d['queries'] if q.get('fetched_at')]
    return (min(ts), max(ts)) if ts else ('', '')
d2, d3 = load(2), load(3)
lines = []
L = lines.append
L('# Rome hotels near Roma Tiburtina station: live price collection (Booking.com)\n')
notes = os.path.join(base, 'notes.md')
if os.path.exists(notes): L(open(notes).read())
for nights, ds in ((2, d2), (3, d3)):
    L(f'\n## {nights}-night stays, 1 adult, 1 room: cheapest per check-in date (properties within 1.5 km of Roma Tiburtina, no dormitory beds)\n')
    if not ds: L('_Not collected._\n'); continue
    lo, hi = fetched_range([ds]); L(f'Fetched between {lo} and {hi} (UTC). Prices are totals for the stay in EUR as displayed by Booking.com (VAT included, Rome tourist tax excluded unless noted). "Q" = number of Booking result pages fetched for that date.\n')
    L('| check-in | check-out | cheapest | total | 2nd cheapest | total | 3rd cheapest | total | candidates ≤1.5 km | Q |')
    L('|---|---|---|---|---|---|---|---|---|---|')
    for ci, d in sorted(ds.items()):
        c = d['candidates']
        def cell(i): return (f"{c[i]['name']} ({c[i]['type']}, {c[i]['distance_km']} km, {c[i]['room']})", eur(c[i]['total_eur'])) if len(c) > i else ('—', '—')
        a, b, e = cell(0), cell(1), cell(2)
        L(f"| {ci} | {d['checkout']} | {a[0]} | {a[1]} | {b[0]} | {b[1]} | {e[0]} | {e[1]} | {len(c)} | {len(d['queries'])} |")
# 20 cheapest combos overall
L('\n## 20 cheapest date/property combinations overall (2- and 3-night stays, 1 adult)\n')
combos = []
for nights, ds in ((2, d2), (3, d3)):
    for ci, d in ds.items():
        for r in d['candidates'][:8]:
            combos.append((r['total_eur'], nights, ci, d['checkout'], r))
combos.sort(key=lambda x: x[0])
L('| # | total | per night | nights | check-in | check-out | property | type | dist km | room | score (reviews) | free canc. | breakfast | city tax |')
L('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for i, (tot, n, ci, co, r) in enumerate(combos[:20], 1):
    L(f"| {i} | {eur(tot)} | {eur(tot / n)} | {n} | {ci} | {co} | {r['name']} | {r['type']} | {r['distance_km']} | {r['room']} | {r['score']} ({r['reviews']}) | {'yes' if r['free_cancellation'] else 'no'} | {'yes' if r['breakfast'] else 'no'} | {r['city_tax_inclusion'].lower()} {r['city_tax_amount'].replace(chr(160), ' ')} |")
# property profiles
L('\n## Profiles of the properties that appear most often in the top-8 lists\n')
freq = {}
for nights, ds in ((2, d2), (3, d3)):
    for ci, d in ds.items():
        for r in d['candidates'][:8]:
            p = freq.setdefault(r['property_id'], {'r': r, 'n': 0, 'prices2': [], 'prices3': [], 'rooms': set()})
            p['n'] += 1; p['rooms'].add(r['room']); p['prices2' if nights == 2 else 'prices3'].append(r['total_eur'])
top = sorted(freq.values(), key=lambda p: -p['n'])[:8]
L('| property | type | Booking rating | address | distance to Tiburtina (Booking) | score (reviews) | appearances in top-8 | 2-night total min / median | 3-night total min / median | rooms seen | Booking page |')
L('|---|---|---|---|---|---|---|---|---|---|---|')
for p in top:
    r = p['r']; st = r['stars']; st = (st.replace('T', ' tiles (Booking quality rating, not official stars)') if st.endswith('T') else (st + ' stars' if st else 'unrated'))
    p2 = f"{eur(min(p['prices2']))} / {eur(statistics.median(p['prices2']))}" if p['prices2'] else '—'
    p3 = f"{eur(min(p['prices3']))} / {eur(statistics.median(p['prices3']))}" if p['prices3'] else '—'
    L(f"| {r['name']} | {r['type']} | {st} | {r['address']}, {r['area']} | {r['distance_text']} ({r['lat']:.4f}, {r['lon']:.4f}) | {r['score']} ({r['reviews']}) | {p['n']} | {p2} | {p3} | {'; '.join(sorted(p['rooms']))[:120]} | https://www.booking.com/hotel/it/{r['pageName']}.it.html |")
# two adults
ta = os.path.join(base, 'two_adults_check.csv')
if os.path.exists(ta):
    L('\n## Re-check for 2 adults sharing one double room (10 cheapest 1-adult combos, 2 nights)\n')
    L('Same Booking search repeated with `group_adults=2` on the same dates; the row shows the cheapest unit Booking offered for 2 adults at the same property.\n')
    L('| check-in | property | 1 adult: total / room | 2 adults: total / room | note | fetched (2 adults) |'); L('|---|---|---|---|---|---|')
    for r in csv.DictReader(open(ta)):
        L(f"| {r['checkin']} | {r['property']} | €{r['one_adult_total_eur']} / {r['one_adult_room']} | {('€' + r['two_adults_total_eur']) if r['two_adults_total_eur'] else '—'} / {r['two_adults_room']} | {r['two_adults_note']} | {r['two_adults_fetched_at']} |")
# cross-check (Agoda)
cc = sorted(glob.glob(os.path.join(base, 'crosscheck', 'cc_*_agoda.json')))
if cc:
    L('\n## Cross-check of the 10 cheapest combos on a second site (Agoda)\n')
    L('Agoda property pages were loaded with the same dates and occupancy (1 adult, 1 room, EUR). Agoda renders its room grid lazily and it never rendered headlessly here, so the value recorded is the property-level "a partire da" (from) price **per night** that Agoda displays for those dates (Agoda shows per-night prices before taxes by default). Google Hotels, Trivago and Kayak could not be used (see notes above).\n')
    L('| check-in | nights | property | Booking total (VAT incl., city tax excl.) | Booking per night | Agoda from-price per night | Agoda page | fetched |'); L('|---|---|---|---|---|---|---|---|')
    b2 = {(r['checkin'], r['property']): r for r in csv.DictReader(open(os.path.join(base, 'cheapest_2n.csv')))}
    for f in cc:
        j = json.load(open(f)); nm = j.get('hotel_name') or j['key']
        cand = [v for (ci, p), v in b2.items() if ci == j['checkin'] and (p.lower().startswith(nm.lower()[:12]) or nm.lower().startswith(p.lower()[:12]))]
        bt = float(cand[0]['total_eur']) if cand else None; n = 2
        L(f"| {j['checkin']} | {n} | {nm} | {eur(bt) if bt else '—'} | {eur(bt / n) if bt else '—'} | {('€' + j['from_price_per_night_eur']) if j.get('from_price_per_night_eur') else 'no price shown (' + (j.get('title') or '')[:40] + ')'} | {j['url'].split('?')[0]} | {j['fetched_at']} |")
# hostel private rooms
hr = sorted(glob.glob(os.path.join(base, 'hostel_rooms', '*.json')))
if hr:
    L('\n## Hostels within 1.5 km: private rooms (Booking property pages)\n')
    L('Booking search results show only a hostel\'s cheapest unit (a dorm bed), so the two hostels within 1.5 km were opened directly for three of the cheapest dates and every room row was read (1 adult, 2 nights). Dorm beds are listed for reference only.\n')
    L('| hostel | check-in | room | total for 2 nights | conditions |'); L('|---|---|---|---|---|')
    for f in hr:
        j = json.load(open(f))
        for row in j['rows']:
            if row.get('total_eur') is None: continue
            L(f"| {j['pageName']} | {j['checkin']} | {row['room']} | €{row['total_eur']} | {'free cancellation' if row['free_cancellation'] else ('non-refundable' if row['non_refundable'] else '')} {'· breakfast' if row['breakfast'] else ''} · {row['text'][row['text'].find('Non include'):][:60] if 'Non include' in row['text'] else ''} |")
# direct check
dc = os.path.join(base, 'direct_check.csv')
if os.path.exists(dc):
    L('\n## Direct (official website) price check for the 5 cheapest properties\n')
    rows = list(csv.DictReader(open(dc)))
    if rows:
        L('| property | check-in | nights | OTA (Booking) total | direct price | direct URL | note |'); L('|---|---|---|---|---|---|---|')
        for r in rows: L(f"| {r['property']} | {r['checkin']} | {r['nights']} | {r['ota_price']} | {r['direct_price']} | {r['direct_url']} | {r.get('note', '')} |")
tail = os.path.join(base, 'notes_tail.md')
if os.path.exists(tail): L('\n' + open(tail).read())
open(os.path.join(base, 'README.md'), 'w').write('\n'.join(lines) + '\n')
print('README written', len(lines), 'lines; dates 2n:', len(d2), '3n:', len(d3))
