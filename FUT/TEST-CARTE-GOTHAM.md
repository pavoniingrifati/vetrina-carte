# Test caricamento carte Gotham

- `data/cards.json` valido: **1.415 carte**.
- Carte riconosciute per Gotham: **580** (inclusi `Gotham City FC` e il refuso storico `Gotahm City`).
- Carte condivise riconosciute: **81** (inclusi `Svincolato` e `Svicolato`).
- Richiesta HTTP locale `data/cards.json`: **200 OK**, 400.623 byte.
- Pool disponibili:
  - Patatine: 529
  - Dannazione: 9
  - Gotham Tots: 37
  - Legend: 580
  - Fusion2: 11
  - Oggetti: 66
  - Gold: 47 oggetti + 53 carte Gold
  - Silver: 47 oggetti + 49 carte Silver
  - Bronze: 47 oggetti + 51 carte Bronze
  - Strumenti: 11
  - Cosmetic: 53
- Sintassi JavaScript verificata per configurazioni, loader e motore.

Il test grafico completo tramite Chromium è stato impedito dal blocco amministrativo delle connessioni localhost nell'ambiente, ma il file è stato servito correttamente via HTTP e tutti i pool sono stati ricostruiti con la stessa logica dei filtri del motore.
