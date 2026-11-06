# Patch Fantallenatore — listoni storici dalla seconda stagione

Correzioni:
- `catalogSeason` viene trasferito alla nuova stagione insieme a `catalogMode`.
- Le carriere storiche gia passate alla seconda stagione con la vecchia versione (senza `catalogSeason`) vengono riconosciute dagli ID storici presenti in `availableIds` e nelle rose, quando possibile.
- Rigenerata la cache PWA.

Installazione: salva un backup della cartella e dei salvataggi prima di sovrascrivere i file, poi copia i contenuti nella medesima struttura. Non avviare una nuova carriera: usa il salvataggio esistente.

Verifiche: node --check su entrambi gli script; test auction-runtime-check.js, domain-integration.js, save-performance-details.js, build-pwa.js --check. Non eseguito un test browser completo di due stagioni.
