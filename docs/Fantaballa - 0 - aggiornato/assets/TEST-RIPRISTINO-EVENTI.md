# Ripristino schermata eventi e decisioni

## Intervento
La schermata degli eventi e delle decisioni è stata riportata alla versione precedente al restyling grafico.

## File ripristinati
- `assets/season/10-events.js` riportato alla versione precedente.
- `assets/event-restyling.css` rimosso.
- collegamento a `event-restyling.css` rimosso da `campionato.html`.
- collegamento a `event-restyling.css` rimosso da `campionato-real.html`.

## Conferme
- schermata eventi e decisioni come prima;
- schermata "Gioca con cronaca" già ripristinata;
- recap risultato già ripristinato;
- nessuna modifica a gameplay, probabilità, handler, salvataggi o classifiche;
- tutto continua a usare il `localStorage` esistente.

## Verifiche
- `10-events.js`: identico alla versione precedente;
- validatore eventi: 0 errori, 0 avvisi;
- Community: 69 decisioni, 5 eventi automatici;
- REAL: 65 decisioni, 4 eventi automatici.
