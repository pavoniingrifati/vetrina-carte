# Fix classifica generale — Sfida della settimana

## Comportamento richiesto

I risultati di **Tricolore col Pisa! / Sfida della settimana**:

- aumentano il totale **Risultati registrati**;
- aggiungono il capocannoniere della stagione e i suoi gol alla classifica **Gol dei bomber**;
- non entrano nelle classifiche specifiche di **Campionato**, **Fantacampionato**, **Caos** o nella classifica delle vittorie con meno punti.

## Implementazione

In `classifica.html` la pagina continua a creare `standardRows`, che esclude la modalità settimanale per record e classifiche di campionato. Tuttavia:

- `renderScorers()` riceve ora tutte le righe;
- il totale risultati usa tutte le righe con un nome squadra;
- il totale gol dei bomber usa tutte le righe;
- il record punti e le metriche standard continuano a usare soltanto `standardRows`.

La copia `assets/classifica.html` è stata allineata per includere la modalità settimanale nella classifica bomber.

## Test

Aggiunto `tools/test-general-weekly-stats.js` con 6 controlli dedicati.

Esito finale:

- 18 suite JavaScript superate;
- 61 file JavaScript sintatticamente validi;
- 75 JSON validi;
- script inline delle due pagine classifica validi.
