# Oltre l’orizzonte

Un buco nero rotante (di Kerr) ray-tracciato in tempo reale nel browser, dal telefono come dal computer. Pizzica per avvicinarti fino ad attraversare l’orizzonte degli eventi e cadere verso l’orizzonte interno.

Apri `index.html` in un browser recente con WebGL 2. È un unico file, senza dipendenze da installare.

## Cosa fa

Per ogni pixel, a ogni fotogramma, lo shader segue all’indietro un raggio di luce lungo una geodetica nulla dello spaziotempo di Kerr. Il colore di ogni pixel è la luce che arriverebbe davvero all’osservatore.

- **Coordinate che attraversano l’orizzonte.** Si usano le coordinate di Kerr entranti, regolari sull’orizzonte, e il tempo di Mino, con le costanti di Carter E, L, Q. Il moto angolare è un vettore sulla sfera, quindi non ci sono singolarità ai poli. Dopo ogni passo il moto viene riproiettato sui vincoli ṙ² = R(r) e |ṅ|² = Q + L² + a²E²n_z², e ogni raggio che sfugge viene completato analiticamente fino all’infinito.
- **L’osservatore è in caduta libera** da fermo dall’infinito (coordinate di Doran, il “fiume” di Hamilton e Lisle). Il tuffo segue la vera traiettoria, compreso il trascinamento dovuto alla rotazione.
- **Il disco** segue il modello di Novikov–Thorne con il flusso di Page–Thorne e uno stress residuo all’ISCO (δ_J ≈ 0,05). Sotto l’ISCO c’è la regione di caduta del modello di Mummery & Balbus (2023), la cui emissione è stata osservata nel 2024. Ogni punto è un corpo nero visto a temperatura g·T, con Doppler relativistico, redshift gravitazionale e oscuramento al bordo. La turbolenza è trasportata dal flusso, compreso il ritardo della luce.
- **Il cielo** ha stelle puntiformi la cui luminosità è moltiplicata dall’ingrandimento della lente, contato come nel cielo reale per magnitudine, e una Via Lattea con polvere. Tutto è spostato in frequenza come un corpo nero.
- **Rendering**: accumulo temporale, bagliore fisico, esposizione adattiva, tone mapping AgX e risoluzione dinamica per mantenere la fluidità sui telefoni.

## Verifiche

`node tests/physics.test.mjs` confronta la fisica con risultati indipendenti. Tutti i controlli passano.
`node tests/gpu-crosscheck.mjs` (serve Playwright) verifica che lo shader GLSL dia gli stessi raggi del riferimento JavaScript: stesso destino per ogni raggio e direzioni entro circa 0,01°.

- Il bordo dell’ombra coincide con i valori analitici di Bardeen: 3√3 per a = 0 e i bordi della forma a “D” per a = 0,9, alla sesta cifra.
- La zona buia vista in caduta libera ha il raggio esatto di Chang & Zhu: 17,32° a r = 10, 42,10° sull’orizzonte e 53,27° dentro il buco nero a r = 1.
- Il redshift del disco, l’efficienza radiativa di Page–Thorne (1 − E_ISCO), il limite newtoniano, la continuità e il minimo in r_I/2 della regione di caduta.
- L’accuratezza dell’integratore rispetto a un riferimento a passo fine: 0,013° in media con circa 44 passi per raggio.

## Struttura

```
src/physics.js     fisica di Kerr: metrica, osservatore, geodetiche, disco, corpo nero
src/shaders.js     GLSL: ray tracer, cielo, accumulo, bagliore, esposizione, composizione
src/app.js         WebGL 2, gesti, strumenti, tuffo, impostazioni
src/template.html  struttura della pagina
src/style.css      aspetto
src/science.html   il pannello “La fisica” con la bibliografia
tools/build.mjs    unisce tutto in index.html
tests/             verifiche della fisica
```

Per ricostruire `index.html` dopo aver modificato i sorgenti:

```
node tools/build.mjs
```
