#!/usr/bin/env python3
"""Genera REPORT.md (italiano) dai dati raccolti."""
import sys, os, datetime as dt, json, collections, csv
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analyze as A
A.QUIET = True

IT_WD = {"Mon": "lun", "Tue": "mar", "Wed": "mer", "Thu": "gio", "Fri": "ven", "Sat": "sab", "Sun": "dom"}
def itd(s):
    d = dt.date.fromisoformat(s)
    return f"{IT_WD[d.strftime('%a')]} {d.day:02d}/{d.month:02d}"
def eur(x): return f"{x:.2f} €".replace(".", ",")

res = {}
for nights in (2, 3):
    for practical in (False, True):
        res[(nights, practical)] = A.summarize(nights, practical)

def transport_short(desc):
    return desc.split(" = ")[0]

out = []
w = out.append
w("# Roma 3 giorni, hotel zona Tiburtina: il periodo più economico dopo il 24 settembre 2026\n")
w(f"Dati raccolti dal vivo il 7 settembre 2026 (13:00 UTC circa) da Ryanair (API tariffe), Trenitalia (API lefrecce.it) e Booking.com (ricerca per punto di riferimento \"Stazione Roma Tiburtina\", 1 adulto, ordinata per prezzo, EUR). Tutti i prezzi sono quelli mostrati dai siti in quel momento e cambiano di continuo: vanno ricontrollati al momento della prenotazione.\n")
w("## Ipotesi di partenza\n")
w("- Partenza da **Messina** (dalle tue email: Frecciarossa Villa S. Giovanni–Roma di aprile 2026 e carta d'imbarco da Catania). Aeroporti considerati: Catania (CTA) e Reggio Calabria (REG). Stazioni: Messina Centrale (biglietto Trenitalia unico con traghetto) e Villa S. Giovanni.\n- 1 persona, camera singola/doppia uso singola; \"3 giorni\" = 2 notti (mostrata anche l'opzione 3 notti).\n- Alloggio entro circa 1,5 km dalla stazione Tiburtina (quartieri Tiburtino, Pietralata, Nomentano/Piazza Bologna).\n- Costi accessori inclusi nel totale: bus Messina–aeroporto di Catania (~8 € a tratta, Itabus/FlixBus da 5,99 €, SAIS 14 €), treno FL1 Fiumicino–Tiburtina (8 € a tratta), metro Termini–Tiburtina (1,50 €) quando il treno arriva a Termini, bus notturno Cotral (7 €) se il volo atterra dopo le 22:30. Tassa di soggiorno di Roma (6-7 € a notte per B&B/affittacamere, pagata in loco) inclusa.\n")

def table(rows, n, title):
    w(f"### {title}\n")
    w("| # | Check-in | Check-out | Alloggio (2 notti) | Trasporto | Totale |")
    w("|---|---|---|---|---|---|")
    for i, x in enumerate(rows[:n], 1):
        w(f"| {i} | {itd(x['checkin'])} | {itd(x['checkout'])} | {x['hotel']} {eur(x['hotel_price'])} + tassa {eur(x['tax'])} | {x['transport_desc'].split(':')[0]} {eur(x['transport'])} | **{eur(x['total'])}** |")
    w("")

r2a, r2p = res[(2, False)], res[(2, True)]
w("## Risposta breve\n")
if r2a:
    b = r2a[0]
    w(f"**Prezzo minimo assoluto (2 notti): {eur(b['total'])}** con check-in {itd(b['checkin'])} e check-out {itd(b['checkout'])}: {b['hotel']} ({b['hotel_info']}) a {eur(b['hotel_price'])} per 2 notti + tassa di soggiorno {eur(b['tax'])} + {transport_short(b['transport_desc'])}.\n")
if r2p:
    b = r2p[0]
    w(f"**Prezzo minimo con orari comodi (treni diurni con al massimo un cambio, voli non prima delle 6:30 in partenza e non prima delle 7:00 al ritorno): {eur(b['total'])}** con check-in {itd(b['checkin'])} e check-out {itd(b['checkout'])}: {b['hotel']} a {eur(b['hotel_price'])} + tassa {eur(b['tax'])} + {transport_short(b['transport_desc'])}.\n")
w("")
table(r2a, 15, "Le 15 finestre più economiche (2 notti, prezzo assoluto)")
table(r2p, 15, "Le 15 finestre più economiche (2 notti, orari comodi)")
r3a, r3p = res[(3, False)], res[(3, True)]
if r3a:
    table(r3a, 10, "Le 10 finestre più economiche (3 notti, prezzo assoluto)")
if r3p:
    table(r3p, 10, "Le 10 finestre più economiche (3 notti, orari comodi)")

r2q = A.summarize(2, True, 7.0)
table(r2q, 10, "Le 10 finestre più economiche (2 notti, orari comodi, alloggio con voto Booking ≥ 7)")
r2h = A.summarize(2, True, 0.0, "", "hotel")
if r2h:
    table(r2h, 10, "Le 10 finestre più economiche se vuoi un hotel vero e proprio (2 notti, orari comodi, solo tipo 'hotel')")

# dettaglio delle prime 5 finestre (2 notti, orari comodi)
w("## Dettaglio delle migliori 5 finestre (2 notti, orari comodi)\n")
for x in r2p[:5]:
    w(f"### {itd(x['checkin'])} → {itd(x['checkout'])}: totale {eur(x['total'])}\n")
    w(f"- Alloggio: **{x['hotel']}** — {x['hotel_info']} — {eur(x['hotel_price'])} per 2 notti (+ tassa di soggiorno {eur(x['tax'])} in loco). Link: {x['hotel_url']}")
    w(f"- Trasporto scelto: {x['transport_desc']}")
    if x['alt']:
        w(f"- Alternativa: {x['alt'][1]}")
    w("")

# tabella hotel per data
w("## Alloggio più economico per ogni data di check-in (2 notti, 1 adulto, entro ~1,5 km da Tiburtina)\n")
w("| Check-in | Alloggio | Tipo | Voto | Distanza | Prezzo 2 notti |")
w("|---|---|---|---|---|---|")
d = A.START
while d <= A.END:
    h = A.best_hotel(d.isoformat(), 2)
    if h:
        w(f"| {itd(d.isoformat())} | {h['property']} | {h['type']} | {h['score']} ({h['reviews']}) | {h['distance_km']} km | {eur(float(h['total_eur']))} |")
    d += dt.timedelta(days=1)
w("")

# voli per giorno
w("## Ryanair Catania–Fiumicino: volo più economico per giorno (prezzo, orario)\n")
w("Wizz Air non opera Catania–Fiumicino fino al 13 dicembre 2026 (tariffe assenti nel calendario ufficiale); Ryanair non vola più da Reggio Calabria a Roma (nessuna rotta REG–FCO/CIA nel suo sistema) e non opera Catania–Ciampino in questo periodo. Da Reggio Calabria vola solo ITA Airways (tariffe di norma 50–100 € a tratta).\n")
w("| Giorno | CTA→FCO più economico | FCO→CTA più economico |")
w("|---|---|---|")
d = A.START
while d <= A.END + dt.timedelta(days=3):
    ds = d.isoformat()
    fo = A.best_flight("CTA-FCO", ds, False); fr = A.best_flight("FCO-CTA", ds, False)
    w(f"| {itd(ds)} | {eur(fo['price']) + ' (' + fo['dep'] + '→' + fo['arr'] + ')' if fo else '-'} | {eur(fr['price']) + ' (' + fr['dep'] + '→' + fr['arr'] + ')' if fr else '-'} |")
    d += dt.timedelta(days=1)
w("")

# treni per giorno
w("## Trenitalia Messina Centrale ↔ Roma: soluzione diurna più economica per giorno (max 1 cambio, biglietto unico con traghetto)\n")
w("| Giorno | Messina → Roma | Roma → Messina |")
w("|---|---|---|")
d = A.START
while d <= A.END + dt.timedelta(days=3):
    ds = d.isoformat()
    to = A.best_train("out", ds, True); tr = A.best_train("ret", ds, True)
    w(f"| {itd(ds)} | {eur(to[0]) + ' ' + to[1].split(' [')[0] if to else '-'} | {eur(tr[0]) + ' ' + tr[1].split(' [')[0] if tr else '-'} |")
    d += dt.timedelta(days=1)
w("")

w("## Cosa non è stato possibile verificare\n")
w("- Italo (Villa S. Giovanni/Reggio → Roma Tiburtina): il sito è protetto da Akamai e non è stato interrogabile; verificare manualmente su italotreno.com (tariffe Low Cost spesso 20–35 €).\n- ITA Airways e Aeroitalia: nessun prezzo per giorno raccolto (siti protetti); di norma non battono Ryanair su Catania–Roma.\n- Hotel: fonte Booking.com; i prezzi diretti sui siti degli alloggi possono differire di pochi euro. Trivago/Google Hotels non consultabili automaticamente.\n- Bus FlixBus Messina → Roma Tiburtina a 11,99 € a tratta (10 ore) esiste ma non era richiesto.\n")
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "REPORT.md"), "w").write("\n".join(out))
print("REPORT.md written", len("\n".join(out)), "chars")
