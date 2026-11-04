# Fantallenatore — listoni storici 2008/09 e 2015/16

All'avvio di **una nuova carriera**, nel passo Identità, usa il menu **LISTONE CALCIATORI** per selezionare:
- 2026/27 (impostazione predefinita, invariata)
- 2015/16
- 2008/09

La selezione rimane salvata nel campo `catalogSeason` della carriera. I vecchi salvataggi privi del campo usano 2026/27. Gli ID storici hanno prefisso `hist-2008-09-` o `hist-2015-16-`, evitando collisioni con quelli attuali. L'universo Pokémon rimane selezionabile soltanto con il listone 2026/27.

## Conversione

I giocatori storici sono tratti dalle righe marcate `in_serie_a = true` nei listoni forniti; le altre righe non entrano nel mercato iniziale. Le colonne `ACQUISTI` e `ACQUISTABILE` descrivono una vecchia partita e non sono usate come vincolo. Le quotazioni originali vengono mantenute nel campo `quotation`, e le fasce sono conservate in `historicalTier`.

Le quotazioni non contengono OVR e FVM: per permettere ai sistemi di simulazione di funzionare sono stati assegnati valori **indicativi**, ordinando i giocatori per quotazione all'interno del ruolo. Non sono valutazioni storiche ufficiali. I trasferimenti estivi/invernali e il mercato estero continuano a usare il motore esistente, non un database di eventi storici.

## Installazione

Copia i file aggiornati sopra la cartella originale senza cancellare prima la cartella originale. In particolare non rimuovere gli asset/font già presenti. Se il sito usa Cloudflare Pages, pubblica l'intera cartella preservando i percorsi e la struttura attuali. Prima di pubblicare in produzione prova **una nuova carriera** per ciascun listone, asta e simulazione giornate. Conserva un backup dei salvataggi.

## Verifiche automatiche

Passati: `tests/domain-layer-boundaries.js`, `tests/domain-integration.js`, `tests/auction-runtime-check.js`, `tests/save-performance-details.js`, `tools/build-pwa.js --check`. Non è stato eseguito un test completo end-to-end delle due carriere storiche nel browser.
