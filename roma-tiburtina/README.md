# Roma 3 giorni zona Tiburtina — ricerca del periodo più economico (dopo il 24/09/2026)

- `REPORT.md`: risultato finale in italiano (finestre più economiche, prezzi per giorno di voli/treni/alloggi, ipotesi, cosa non è stato verificabile).
- `analyze.py` / `report.py`: script che uniscono i dati raccolti e generano il report.
- `results.json`: totale per ogni data di check-in (2 e 3 notti, prezzo assoluto e orari comodi).

I dati grezzi (prezzi raccolti dal vivo il 7 settembre 2026) sono nei rami:
- `claude/roma-data-flights` (Ryanair, Aeroitalia, Wizz Air, ITA via Google Flights),
- `claude/roma-data-trains` (Trenitalia, FlixBus di riferimento),
- `claude/roma-data-hotels` (Booking.com, 67 date di check-in, 2 e 3 notti).
