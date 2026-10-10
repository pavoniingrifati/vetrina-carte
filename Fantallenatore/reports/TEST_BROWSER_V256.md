# Verifica V256 — test browser estesi

Rispetto alla V255 non cambia la grafica né il codice dei flussi di gioco. Aggiornato soltanto il numero versione centrale; aggiunti runner, fixture, controlli geometrici e documentazione dei test.

- Regressioni Node: 62 script passati (`reports/test-latest.json`).
- Fixture: dieci rose legali e uniche, asta e acquisto doppio, isolamento del bridge dal gioco distribuito; verifiche passate.
- Sintassi dei cinque script browser: valida.
- Confronto con ZIP V255: tutti i CSS, HTML e moduli di gioco invariati, salvo versione centrale.
- Browser Chromium: NON ESEGUITO, binario non disponibile. `reports/browser/latest.json` registra 42 combinazioni `not_run`, codice di uscita 3.

La suite prepara carriere deterministiche e usa i pulsanti reali per avvio, chiamata, rilanci, lascia, ripresa dell'asta, formazione, capitano e Diretta Gol fino al Big Match. Controlla anche comandi tagliati, coperti e sovrapposizioni. Non certifica la resa grafica finché non viene eseguita con Chromium. I timer fermati tra le azioni escludono verifiche di concorrenza e durata; gli screenshot non hanno una baseline pixel approvata.

Istruzioni e limiti completi: `tests/browser/README.md`.
