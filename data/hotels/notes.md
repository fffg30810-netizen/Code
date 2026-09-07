Collected on 2026-09-07 (UTC timestamps in every CSV row) for a traveller from Messina who wants 3 days (2 nights, alternatively 3 nights) in Rome near **Roma Tiburtina** station, cheapest hotel / B&B / guesthouse / hostel private room, check-in dates 2026-09-25 .. 2026-11-30, 1 adult, 1 room. All prices below are the real numbers fetched from the sites; nothing is estimated (any estimate would be labelled ESTIMATE).

## Files

| file | content |
|---|---|
| `cheapest_2n.csv` | 8 cheapest non-dormitory properties within 1.5 km of Roma Tiburtina for every check-in date, 2 nights, 1 adult |
| `cheapest_3n.csv` | same for 3 nights |
| `cheapest_2n_2adults.csv`, `cheapest_3n_2adults.csv` | 2-adult re-check (only the dates of the 10 cheapest combos) |
| `direct_check.csv` | official-website (direct booking) check for the 5 cheapest properties |
| `crosscheck/` | second-site (Agoda) check of the 10 cheapest combos: JSON + gzipped HTML |
| `parsed/booking_<checkin>_<N>n_<A>a.json` | every property card parsed from every Booking result page for that date (including dorm beds and properties farther than 1.5 km), plus the filtered candidate list |
| `raw/booking_<checkin>_<N>n_<A>a_<query>.html.gz` | raw HTML snapshot of every Booking result page fetched (one file per query) |
| `hostel_rooms/` | Booking property pages of the two hostels within 1.5 km (room-level prices, private rooms) |
| `scripts/` | the collector scripts (Node/Playwright + Python) |
| `DONE.md` | 10-line summary |

## Method

**Source: Booking.com** (`https://www.booking.com/searchresults.it.html`, Italian site, EUR, sorted by price, landmark search "Stazione Roma Tiburtina", `dest_type=landmark`). Booking prints on every result card the distance to the landmark ("X km da Stazione Ferroviaria di Roma Tiburtina"); that value is what `distance_km` contains (it is Booking's straight-line distance, not walking distance).

Exact URL pattern used (one page load per query; `{nflt}` is the filter set):

```
https://www.booking.com/searchresults.it.html?ss=Stazione+Roma+Tiburtina&dest_type=landmark&checkin={checkin}&checkout={checkout}&group_adults={adults}&no_rooms=1&group_children=0&order=price&selected_currency=EUR&nflt={nflt}
```

For every check-in date four (sometimes five) result pages were fetched, 1.5 s apart:

1. `distance=1000;ht_id=204;ht_id=208;ht_id=216` : hotels + B&Bs + guesthouses within 1 km, 25 cheapest.
2. `distance=3000;ht_id=204;ht_id=208;ht_id=216` : same types within 3 km, 25 cheapest (catches the 1–1.5 km band).
3. `...;price=EUR-{p}-max-1` : a per-night price-band continuation of query 2, repeated while the 8th cheapest candidate could still be undercut by an unseen 1–1.5 km property (Booking renders no pagination in this environment, so price bands are the way to page).
4. `distance=3000;ht_id=203` : all hostels within 3 km (Booking shows each hostel's cheapest unit, i.e. a dorm bed; kept in the parsed data, excluded from the ranking).

Data were read from the JSON that Booking embeds in the page (`data-capla-store-data="apollo"`): property name, type id, star rating (official stars vs. Booking's "tiles" quality rating), review score and count, distance text, address and coordinates, matched room name, total price for the stay, average per night, excluded charges (city tax: included/excluded and amount), free-cancellation flag, breakfast/meal plan.

Ranking rule for `cheapest_*.csv`: `distance_km <= 1.5`, room is not a dormitory bed, cheapest 8 distinct properties by total price for the stay. Properties 1.5–2 km were not included (the brief said to exclude anything farther than ~2 km; the 1.5 km cut-off is the one used here, the parsed JSON still contains everything up to 3 km).

**Technical notes / what failed**

- Plain `curl` to Booking.com returns an AWS WAF JavaScript challenge (HTTP 202, 4 kB, no property cards). Booking therefore had to be loaded in headless Chromium (Playwright 1.56.1 with the pre-installed Chromium 1194). No captcha was shown; the challenge resolved automatically in the browser.
- Chromium could not open a TLS connection through this session's egress proxy (the tunnel was closed right after the ClientHello for every host, including example.com), so all browser network traffic was routed through Playwright's Node-side fetch (`context.route` + `route.fetch`), which does work through the proxy. This is not a TLS-verification bypass; the proxy CA bundle is used as configured.
- Booking's result page renders no pagination controls and ignores `offset=`, so price-band filters were used to page (see above). As a consequence the ranking is exact for the cheapest 8 only up to the point where the price bands stopped (documented per date by the `Q` column / the `queries` array in the parsed JSON).
- Booking shows only one (the cheapest matching) unit per property. For hostels that is always a dormitory bed, so hostel **private rooms** never appear in the search results; they were checked separately on the property pages of the two hostels within 1.5 km (Roma Scout Center, 0.7 km; BEDS&ROOMS TIBURTINA, 0.2 km) for the cheapest dates only, see the hostel section below.
- Trivago returned HTTP 403 "Access Denied" to every request; Kayak redirected every search URL to its landing page; DuckDuckGo (html.duckduckgo.com) was reset by the proxy; Bing served unrelated (bot-poisoned) results to automated queries; Google Hotels answers plain HTTP but ignores date/currency/occupancy parameters and its date picker could not be driven headlessly, so Google Hotels was only used to discover Agoda hotel ids. Agoda property pages load with the correct dates but render room-level prices lazily and they never appeared in this environment; only the property-level "a partire da" per-night price was captured. Hostelworld was reachable but only covers hostels and was not needed.
- Prices are live and move: the same Booking query repeated a few minutes apart returned slightly different totals for some properties (for example Hostel Beautiful dorm bed €44.90 → €46.75). Each row carries its own `fetched_at`.

## Rome tourist tax (contributo di soggiorno) — paid on site, NOT in the Booking totals

Per person per night, first 10 nights, rates in force since 1 October 2023 (Deliberazione Giunta Capitolina 255/2023) and unchanged in 2026: hotel 1★ €4, 2★ €5, 3★ €6, 4★ €7.50, 5★ €10; B&B €6; guesthouses/affittacamere €5–7 depending on classification; holiday apartments/short-term rentals €5–6; hostels €3.50; campsites €3. Under-10s are exempt. Booking's search results expose this as an "excluded charge" (chargeType 22) with the amount for the stay; for nearly every property in these lists the city tax is **excluded** from the total and shown in `taxes_included` as e.g. `no: city tax € 12 per stay paid on site; VAT included` (€12 = 2 nights × €6 for a B&B, €14 = 2 × €7 for a guesthouse, etc.). A handful of properties include it (flagged `yes`). Booking property pages of some listings additionally say "Non include: 10% di IVA" for the displayed room price; the search-result totals used here carry Booking's own `chargeInclusion` flags (VAT flagged INCLUDED for all rows unless stated otherwise).
