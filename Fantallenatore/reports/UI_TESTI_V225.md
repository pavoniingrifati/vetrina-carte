# V225 — descrizioni del negozio

La descrizione `.shop-game-effect` era una riga flex con testo e `<b>` come elementi separati. Gli spazi ai confini dei frammenti non venivano mantenuti nel layout: «Sblocca statistiche avanzate e forma» risultava visivamente attaccato.

Il testo completo è ora contenuto in un singolo span con grassetti inline. Il contenitore continua a centrare la descrizione; il testo mantiene gli spazi e può andare a capo entro la carta. La correzione si applica anche ai servizi attivi e agli altri prodotti.

Verifiche: sintassi del modulo, otto schede generate dalla factory reale (quattro prodotti, attivi/non attivi), build CSS e risorse locali, test shop-economy e produzione. Nessun nuovo !important. Verifica visiva browser non eseguita: Chromium non disponibile. I report V224 sono storico della verifica strutturale precedente.
