# CSS per componenti

Le sorgenti sono in `css/modules/`: 15 file al posto dei 29 file organizzati per interventi successivi. L'HTML continua a caricare `css/game.css` e `css/ui-dialogs.css`. Quest'ultimo resta il proprietario dei dialoghi riutilizzabili. `styles_v302.css` è l'ingresso di compatibilità e importa il runtime generato.

| Cosa modificare | Sorgente |
|---|---|
| Colori e dimensioni condivise | `00-design-tokens.css` |
| Tipografia | `08-typography-system.css` |
| Accessibilità e preferenze utente | `11-accessibility.css` |
| Asta, rilanci e assegnazioni | `auction.css` |
| Carriera, classifiche, rose e risultati | `career.css` |
| Dashboard, notizie ed evoluzione | `dashboard.css` |
| DataCenter | `datacenter.css` |
| Eventi, poteri ed esperti | `events.css` |
| Formazione, campo, panchina e ritratti | `lineup.css` |
| Partite, diretta e punteggi | `live.css` |
| Negozio, sponsor e valute | `shop.css` |
| Social | `social.css` |
| Scambi e mercato | `trade.css` |
| Controlli, navigazione condivisa e regole che coinvolgono più schermate | `shared.css` |
| Politiche responsive generali finali | `12-responsive-qa.css` |

## Modificare una regola

Cercare il selettore prima di aggiungere una correzione:

```sh
python3 tools/find-css.py .lineup-slot
```

Il comando stampa file, riga, sezione, condizioni media e posizione nella cascata. Le occorrenze sono ordinate come nel runtime; la specificità e `!important` continuano a partecipare alla scelta dello stile effettivo.

Modificare la regola nella sua sezione, conservando le condizioni responsive. Le nuove regole di un componente possono essere inserite nella sezione pertinente. Evitare nuovi file di hotfix e copie della stessa regola in fondo al progetto. Le regole condivise tra schermate rimangono in `shared.css`.

## Ordine della cascata

Raggruppare fisicamente tutte le regole per schermata e concatenare i file avrebbe cambiato il loro ordine relativo. Per questo i file contengono sezioni identificate da commenti `@section`; `css/manifest.json` definisce l'ordine delle sezioni nel runtime. Una sezione appartiene a un solo file. I commenti non introducono selettori, priorità o layer CSS.

Le normali modifiche avvengono all'interno della sezione e non richiedono modifiche al manifest. Per introdurre una nuova sezione scegliere un identificatore unico e registrarla nel punto desiderato della lista `sections`. Il compilatore rifiuta identificatori duplicati, sezioni non registrate, proprietari errati, regole fuori dalle sezioni e file non registrati.

## Build

```sh
npm run build:css
npm run check:css
node tests/css-build.js
node tests/css-components.js
node tests/css-consolidation.js
```

La build richiede Python 3 e usa la libreria standard. Scrive esclusivamente `css/game.css`, preserva l'ordine dichiarato e adatta i percorsi delle risorse. `--check` non scrive file. La build non elimina dichiarazioni dalle sorgenti e non modifica il manifest. `tools/consolidate-css.py` resta un comando di compatibilità per la nuova build; il suo ottimizzatore storico è conservato per le fixture diagnostiche.

Non modificare direttamente `css/game.css`: il controllo rileva un runtime diverso dalle sorgenti. La build deterministica viene verificata anche con fixture che intercalano sezioni di componenti diversi.

## Verifica della migrazione

Il confronto con il commit `26970706` in Chromium conserva tutte le **5.151 regole CSSOM**, nello stesso ordine e con la stessa rappresentazione di selettori, condizioni e dichiarazioni, compresi keyframe e priorità. Il risultato e il digest della sequenza sono in `reports/CSS_COMPONENTI.json`. La migrazione organizza i proprietari senza introdurre una nuova variante grafica. Passano inoltre i 62 controlli generali, i test CSS e i 42 scenari Chromium su sette viewport. La verifica browser è eseguita su una copia con sorgenti applicativi identici per conservare i report e gli screenshot storici tracciati.

Gli override storici e gli `!important` restano presenti. Ridurre le priorità richiede interventi sul singolo componente: la riorganizzazione rende possibile individuarli e modificarli insieme, senza riordinare indiscriminatamente la cascata. `shared.css` contiene anche le condizioni che coinvolgono più componenti.

I report dei consolidamenti V224 e V255 sono conservati in `reports/` come documentazione storica. Il loro conteggio di file e i vecchi comandi di ottimizzazione non descrivono l'attuale build.
