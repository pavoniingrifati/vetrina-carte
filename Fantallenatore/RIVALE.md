# Strategie di Admin e Rivale

La politica avanzata precedentemente assegnata a Rivale appartiene ora ad **Admin**: costruzione del miglior undici, priorità ai reparti deboli, riserve di budget flessibili, chiamate selettive e tempi regolari. Rivale usa la precedente selezione ordinaria di Admin (52% top, 22% valore, 23% obiettivo, 3% caos), con tempi standard.

Identità, coefficienti personali, comparsa nelle divisioni e poteri restano associati ai rispettivi avversari. Il One Shot rimane esclusivo di Admin. Il comportamento viene scelto dall’archetipo anche per le carriere già salvate, senza migrazione.

Verifica: `node tests/admin-expert.js`, `node tests/admin-one-shot.js`, `npm test`. Il browser verifica i rilanci ordinari di Admin in A e di Rivale in C/A.

I report `reports/rivale-expert-after.json` e `reports/rivale-expert-browser.json` descrivono la precedente versione, in cui la politica avanzata apparteneva a Rivale. Non sono misurazioni della nuova assegnazione ad Admin. `tools/audit-rivale.js` continua a diagnosticare Rivale, ora con la strategia ordinaria.
