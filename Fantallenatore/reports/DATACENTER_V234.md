# V234 — Panoramica visuale DataCenter

Rendimento medio e posizione nella lega, fantapunti/gol/bilancio, grafico statico delle giornate concluse, Top 5 della rosa per fantamedia e Top 5 qualità/prezzo della lega. Faccine cliccabili aprono le schede esistenti. Il grafico non ha pulsanti o azioni.

Confronti per ruolo tramite barre e confronto squadra/media della propria lega. Nessun dato di leghe esterne. Medie dei reparti ponderate per numero di voti; qualità/prezzo = fantamedia / costo attuale d’acquisto, esclusi costo nullo e giocatori senza voti. La classifica media usa i risultati fantasy finali disponibili; i pareggi condividono il rango. Le liste includono al massimo cinque elementi, senza completarle con dati inventati.

Fantamedie, Top 5 e reparti richiedono FantaData Pro. In assenza del servizio compaiono pannelli con “Bloccato: manca FantaData Pro”, senza leggere né inserire le statistiche premium nel markup. Risultati e grafico punti sono gratuiti. Scout e Assistente mantengono i rispettivi vincoli.

Stile viola/oro e pixel, numeri leggibili e faccine reali; due colonne desktop e una mobile, KPI su due colonne mobile. Entrata discreta dei pannelli disabilitata con preferenza movimento ridotto. Nessuna modifica alle formule del gioco, salvataggi o alle schede Giocatori/Evoluzione.

## Verifiche

- Test datacenter-overview: risultati, medie e rango, pareggi, medie ponderate, Top 5, esclusione costi nulli, input non mutati, grafico statico, protezione premium e stati vuoti.
- Runtime reale dell’app: Panoramica premium con dieci schede e faccine SVG; versione bloccata senza schede premium; collegamento del controller ai pulsanti delle schede.
- 62/62 controlli della suite run-tests; module-boundaries (fixture V161 e 144 punteggi CPU), round-trip bonus, produzione e build CSS superati.
- Browser/controllo visivo non eseguiti: Chromium non disponibile. Questi sono controlli statici e headless, non una prova grafica su PC o telefono.

Modulo dedicato `js/datacenter-overview.js`: proiezione in sola lettura e markup, senza dipendenze esterne. Nuovo stile in `css/modules/22-datacenter-overview.css`.
