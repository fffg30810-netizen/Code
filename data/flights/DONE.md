# DONE – flight data collection (branch claude/roma-data-flights), 2026-09-07 12:30–13:20 UTC
1. Cheapest 3-day trip found: CTA⇄FCO Ryanair 2026-10-02 22:45 FR4857 + 2026-10-04 06:00 FR1170 = **29.98 EUR** (2 nights); best 2-night 29.98 EUR (2026-10-02→2026-10-04), best 3-night 29.98 EUR (2026-10-03→2026-10-06); 8 combos at 29.98 EUR in October (see README §3).
2. Ryanair: fare finder for all months + booking API per flight for every day 25 Sep–3 Dec, CTA⇄FCO (data/flights/ryanair_all_flights.csv). Ryanair does NOT fly REG⇄FCO/CIA nor CTA⇄CIA (route lists + 0 fares).
3. Aeroitalia: live fares per flight for every day, CTA⇄FCO, from its Navitaire API (140 responses, cheapest 39.99 one-way). Aeroitalia does not serve REG.
4. Wizz Air: CTA⇄FCO route only starts 14 Dec 2026 (route map + timetable), so nothing in the window; live search endpoint is Kasada-protected (429).
5. ITA Airways: own site blocked (Akamai 403 / BLOCKED page); ITA prices for CTA⇄FCO and REG⇄FCO were taken from Google Flights (280 one-way pages, every day). Cheapest REG⇄FCO round trip seen: 122.0 EUR (2026-10-22→2026-10-25); REG⇄FCO ITA schedule confirmed daily to 3 Dec via the Navitaire gateway.
6. easyJet: site blocked (Akamai Access Denied); no easyJet itineraries appear on Google Flights for these routes.
7. Google Flights had no priced itineraries for 47 REG⇄FCO route-days (mostly 7/14 Nov–3 Dec), so those days have no ITA price; listed in README §5.
8. Cross-check: Google Flights prices match Ryanair's API for the same flight to within ~1 EUR, but Google omits Ryanair's late-evening flight and its round-trip totals (42–54 EUR) are higher than the sum of the one-way API fares (29.98).
9. Deliverables: data/flights/README.md (all-days tables, top-15 combos, URLs, failures), cheapest_per_day.csv (876 rows), round_trips.csv (158 rows), ryanair_all_flights.csv, aeroitalia_all_flights.csv, raw/ (11 MB JSON), scripts/.
10. Nothing was booked, no personal/payment data entered, no PR created, main untouched, TLS verification never disabled.
