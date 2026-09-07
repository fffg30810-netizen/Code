Scripts used for collection (Node 22 + global playwright 1.56.1, Chromium from /opt/pw-browsers):
- collect_booking.js: per check-in date, runs Booking.com searches (1 km / 3 km distance filters, hotel+B&B+guesthouse types, price-band continuation, hostels) and writes raw gzipped HTML to raw/ and parsed JSON to parsed/.
