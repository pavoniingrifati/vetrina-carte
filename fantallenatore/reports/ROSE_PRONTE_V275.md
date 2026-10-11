# Rose pronte e inizio stagione — V275

Corregge e sostituisce il comportamento della V273: Rose pronte non prevede scambi estivi. Al termine della generazione si mostra il riepilogo con la scelta sponsor, da cui iniziare il campionato. La finestra scambi estiva viene contrassegnata come completata senza eseguire scambi.

La stessa regola si applica ai salvataggi precedenti con quickStart e rose complete, prima dell’inizio della stagione. Il percorso asta normale / Simula tutta l’asta mantiene gli scambi estivi. Gli scambi invernali non cambiano. Conservati gli ordinamenti Osservatore della V274.

Verifiche: ready-rosters-season-flow (controller reali, generazione finale, riepilogo sponsor, vecchi salvataggi, fine asta estiva/invernale), auction-observer-sorting, sintassi, production-edition, domain-integration. Nessun nuovo test browser eseguito; i rapporti browser precedenti sono storici.
