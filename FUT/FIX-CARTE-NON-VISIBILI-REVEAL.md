# Fix carte non visibili durante il reveal

## Problema
La classe `is-tease`, che forza la carta a restare invisibile durante la suspense, non veniva rimossa quando iniziava il reveal. Anche aggiungendo `is-revealed`, le regole CSS con `!important` continuavano quindi a nascondere la carta.

## Correzione
- l'immagine viene caricata mentre la carta è ancora nascosta;
- il codice attende il completamento del caricamento o del fallback;
- subito prima del reveal viene rimossa `is-tease`;
- viene quindi aggiunta `is-revealed`, rendendo visibile la carta;
- i callback di immagini precedenti continuano a essere ignorati in sicurezza;
- aggiornato il parametro di versione in `store.html` per evitare la cache del vecchio script.

## Test
- controllo sintattico JavaScript superato;
- `node tools/test-pack-opening.js`: 16/16 test superati.
