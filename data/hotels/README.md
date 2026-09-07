# Rome (Tiburtina area) hotel price collection — work in progress

Collection started 2026-09-07 12:30 UTC. Files are being added as the passes complete; see DONE.md when finished.

- Source in use: Booking.com (searchresults.it.html, landmark "Stazione Roma Tiburtina", EUR, sorted by price), fetched with headless Chromium via Playwright.
- Plain curl to Booking.com returns an AWS WAF JavaScript challenge (HTTP 202, no property cards), so a real browser is required.
- Chromium could not complete TLS through the session's egress proxy directly (connection reset after ClientHello); all browser traffic is routed through Playwright's Node-side fetch, which works.
