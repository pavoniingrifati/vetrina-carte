# Architettura CSS

## Ordine della cascata

Il manifest `styles_v302.css` carica i fogli in questo ordine:

1. `00-design-tokens.css`: valori condivisi, senza componenti.
2. `01-auction-core.css`: setup, selezione e asta.
3. `02-season-foundation.css`: fondamenta della stagione e formazione.
4. `03-auction-events.css`: eventi, rivali e Fantapoteri.
5. `04-career-season.css`: schermate della carriera.
6. `05-live-match.css`: Diretta Gol.
7. `06-season-polish.css`: rifiniture storiche ancora da assorbire.
8. `07-live-review.css`: controlli finali della Diretta Gol.
9. `08-typography-system.css`: sistema tipografico a due font.
10. `09-dashboard-overhaul.css`: contenuto specifico della dashboard.
11. `10-career-shell.css`: componente canonico di header e navigazione.
12. `11-accessibility.css`: focus, leggibilita minima e preferenze assistive.
13. `12-responsive-qa.css`: salvaguardie responsive validate sulle viewport principali.

## Regole di manutenzione

- Un componente deve avere un solo modulo proprietario.
- Colori, ombre, spaziature e altezze condivise vanno aggiunti ai token, non duplicati.
- `styles_v302.css` e un manifest: non deve contenere regole grafiche.
- Le immagini della navigazione appartengono esclusivamente a `10-career-shell.css`.
- Le nuove correzioni vanno integrate nella regola esistente, non aggiunte in fondo come nuovo override.
- `!important` e ammesso nei moduli storici; nei nuovi componenti va usato soltanto quando serve a prevalere sulla cascata legacy.
- Ogni nuovo modulo deve essere incluso nei test di struttura e asset.

## Strategia di migrazione

La riorganizzazione e incrementale per non alterare il look consolidato. Quando un componente viene migrato:

1. si raccolgono tutte le sue regole finali;
2. si trasferiscono in un unico modulo proprietario;
3. si eliminano i duplicati dal modulo precedente;
4. si mantengono valori e breakpoint invariati;
5. si aggiunge un test che impedisca una nuova duplicazione.

Il primo componente migrato e la shell della carriera. I prossimi candidati sono pulsanti condivisi, modali e card informative.
