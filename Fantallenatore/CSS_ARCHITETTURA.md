# CSS V224

Le sorgenti restano nei 23 file di `css/modules/`, nell'ordine del manifest `styles_v302.css`. L'HTML carica soltanto `css/game.css`, generato in quello stesso ordine: elimina la catena di download degli @import senza riordinare la cascata. I percorsi delle risorse locali sono adattati alla posizione del file generato. `css/manifest.json` esplicita l'ordine; il responsive resta ultimo.

La consolidazione ha eliminato 1.065 dichiarazioni precedenti: 330 duplicati identici e 735 ulteriori dichiarazioni superate da valori letterali riconosciuti. Gli `!important` attivi passano da 6.571 a 5.745. Le 17.590 combinazioni finali di selettore, contesto, proprietà e priorità sono invariate rispetto alla V223. La verifica indipendente con tinycss2 non rileva errori sintattici prima o dopo.

Il criterio di rimozione richiede lo stesso selettore, le stesse condizioni e la stessa priorità. Il valore successivo deve essere identico, oppure appartenere alla whitelist di valori letterali supportati nello script. Le dichiarazioni dinamiche, le variabili, i valori nuovi e i possibili fallback non vengono eliminati indiscriminatamente. Le priorità residue restano numerose: questa consegna non pretende di averle azzerate.

## Modifica e build

Modificare il modulo che contiene la regola; evitare correzioni aggiunte in un nuovo file in fondo alla cascata. Non modificare direttamente `css/game.css`.

```text
python tools/consolidate-css.py
python tools/consolidate-css.py --check
node tests/css-build.js
```

Lo script usa soltanto la libreria standard Python, è idempotente e mantiene l'ordine delle regole superstiti. Il controllo Node verifica che il CSS runtime coincida con le sorgenti e che tutti i percorsi locali esistano. `reports/css-v224.json` registra il confronto con la V223. La verifica visiva su browser non è stata eseguita: Chromium non era disponibile.

## V234 — Panoramica DataCenter

`22-datacenter-overview.css` è il proprietario della nuova panoramica, caricato prima del responsive. Le sorgenti sono ora 24; il CSS runtime resta un file generato. I selettori sono limitati a `leagueDataCenterScreen` e alle classi `dcv-`.

## V255 — Consolidamento conservativo

Il CSS runtime passa da 6.709 a 6.505 `!important`: rimosse 221 dichiarazioni sicuramente superate, di cui 204 con priorità importante. Non sono stati rimossi gli `!important` delle dichiarazioni ancora attive. Non è stata introdotta una nuova variante grafica o un nuovo modulo di override.

Il compilatore ora riconosce i membri delle liste di selettori, anche quando una regola raggruppata è superata da più regole singole. Espande solo i valori letterali supportati di `margin`, `padding` e `gap`. Rimuove una dichiarazione soltanto quando tutti i suoi effetti sono sostituiti nello stesso contesto e con la stessa priorità. Mantiene fallback, condizioni responsive, ordine delle regole e keyframe.

La verifica prima/dopo conserva 26.572 valori finali, distinti per selettore, contesto, proprietà espansa e priorità. Non equivale a una verifica visiva nel browser. I risultati sono in `reports/CSS_CONSOLIDAMENTO_V255.json`. I nuovi casi di regressione sono eseguiti da `node tests/css-consolidation.js` e inclusi in `tests/run-all.js --core`.

Controllo senza scritture: `python3 tools/consolidate-css.py --dry-run`. `--check` verifica che non ci siano dichiarazioni eliminabili e che il runtime sia aggiornato. Il CSS rimane stratificato: le 6.505 priorità residue richiedono un lavoro per componenti con verifiche browser, non una rimozione indiscriminata.
