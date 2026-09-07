Collection scripts (run from repo root). Node scripts need `NODE_PATH=/opt/node22/lib/node_modules` (global playwright 1.56) and launch the full Chromium build through the sandbox proxy with `--ssl-version-max=tls1.2` (see browser.js); the `PostQuantumKeyAgreementEnabled=false` policy was placed in /etc/chromium/policies/managed/.
- ryr_fetch.py – Ryanair fare finder, route lists, round-trip finder (plain requests).
- ryr_avail.js – Ryanair booking availability per flight (in-page fetch with client headers).
- wizz_fetch.js / wizz_validate.js – Wizz Air map, farechart, timetable (in-page fetch).
- aeroitalia_collect.js – Aeroitalia Navitaire availability per day; aeroitalia_ita_sched.js – schedule checks (incl. ITA REG-FCO).
- gflights_collect.py – Google Flights one-way pages per day (requests + fast-flights parser, lenient fallback); gf_rt_check.py – round-trip cross-check of the 5 cheapest combos.
- build.py – builds cheapest_per_day.csv, round_trips.csv, *_all_flights.csv; make_readme.py – builds README.md.
