# Ripristino schermata "Gioca con cronaca"

## Intervento
È stata ripristinata la versione precedente della schermata live "Gioca con cronaca".

## File ripristinati
- `assets/season/12-match-simulation.js` riportato alla versione precedente al restyling live.
- `campionato.html` aggiornato rimuovendo il link a `assets/match-restyling.css`.
- `campionato-real.html` aggiornato rimuovendo il link a `assets/match-restyling.css`.

## Conferme
- il restyling degli eventi resta attivo;
- il recap finale resta nella versione precedente;
- nessuna modifica a gameplay, eventi, salvataggi o classifiche;
- tutto continua a usare il `localStorage` esistente.

## Verifiche
- `12-match-simulation.js`: sintassi valida;
- `campionato.html`: OK;
- `campionato-real.html`: OK.
