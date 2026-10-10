# V293 — Avversario nella scelta giocatore

Build 3.2.35.56.293.

Nella finestra di scelta del giocatore per una posizione in campo viene mostrato il nome della squadra avversaria della giornata, con casa/trasferta. Dato gratuito dal calendario Serie A; nessun requisito di abbonamento. Restano informazioni di stato e percentuale Scout. Senza partita disponibile non viene mostrato un avversario inventato.

Verifiche: factory reale con DOM simulato per casa/trasferta, giornata corretta, assenza abbonamenti e calendario mancante; run-tests 62/62, css-build e lineup-captain-selection superati. Nessun nuovo test browser.
