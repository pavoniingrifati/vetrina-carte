# Implementazione — Tricolore col Pisa!

## Nuova modalità
- Nuovo box **Evento del weekend** nella home, con l’immagine fornita come sfondo.
- Nuova pagina `tricolore-pisa.html`.
- Squadra fissa: **Pisa**.
- Draft speciale senza roll/reroll: la rosa completa del Pisa compare subito.
- Selezione obbligatoria di 14 giocatori: 11 titolari e 3 riserve.
- Dopo il draft parte il normale Fantacampionato condiviso: eventi, mercato, infortuni, squalifiche, oggetti e storie restano attivi.
- Salvataggio completamente separato dalle altre modalità.

## Sfida della settimana
- Nuova pagina dedicata `sfida-settimana.html`.
- Il risultato può essere inviato soltanto se il Pisa conclude il campionato al **1° posto**.
- Ordinamento: punti, differenza reti, vittorie, gol fatti, piazzamento.
- I primi 10 ricevono **+2 OVR al proprio giocatore**. Il premio è soltanto comunicato e verrà gestito manualmente.

## Google Apps Script
Il sorgente incluso nel progetto riconosce `sfida_settimana`. Per registrare il tipo in modo canonico sul foglio online occorre pubblicare nuovamente il Google Apps Script. Anche prima della nuova pubblicazione, il vecchio endpoint può ricevere la modalità come voce personalizzata e la classifica dedicata la riconosce dal nome `Sfida della settimana`.

## Aggiornamento allenatori

- Il profilo **Giovani e belli** è escluso esclusivamente dalla modalità Tricolore col Pisa.
- I vecchi salvataggi della sfida che lo avevano selezionato vengono normalizzati automaticamente su **Anonimo**.
- Le altre modalità continuano a mostrare e utilizzare normalmente Giovani e belli.

