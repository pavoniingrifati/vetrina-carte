# Fantallenatore come app

Pubblica **l’intera cartella Fantallenatore** sul sito HTTPS, mantenendo `sw.js`, `site.webmanifest` e `assets/app/` insieme al gioco. I percorsi sono relativi: funziona anche sotto `/vetrina-carte/Fantallenatore/`, senza controllare gli altri giochi del sito.

Nella home mobile, **Installa Fantallenatore** apre la richiesta del browser quando disponibile. Su iPhone mostra i passaggi da Safari: Condividi → Aggiungi alla schermata Home. Nei browser senza richiesta automatica mostra le istruzioni dal menu. Il pulsante sparisce quando il gioco è aperto come app. L’apertura diretta del file HTML non consente l’installazione.

Dopo il primo caricamento completo, “Gioco pronto anche offline” conferma che codice, dati e risorse sono salvati per giocare senza connessione. I collegamenti esterni (Segnalazioni, Seguimi) richiedono Internet. Se il browser elimina i dati del sito, occorre aprire il gioco online per ricreare la copia offline. I progressi continuano a usare lo storage locale esistente; non sono sincronizzati tra dispositivi o browser. Su iOS il contenitore dell’app può avere dati separati dal browser: non si promette la migrazione automatica della carriera.

## Aggiornamenti

Dopo ogni modifica a HTML, JavaScript, CSS, dati o immagini:

```sh
npm run build
npm run check:pwa
```

Pubblica tutti i file aggiornati, compreso `sw.js`. Il build calcola la versione dai contenuti. Ogni copia offline contiene una versione completa, evitando di combinare script e HTML di versioni diverse. Un aggiornamento scaricato aspetta: dalla home appare **Aggiorna gioco**, che attiva la nuova versione e ricarica. Non ricarica la partita in corso. Chiudere tutte le finestre del gioco permette al browser di attivare l’aggiornamento normalmente.

Per rigenerare le icone dal loro SVG originale: `node tools/render-app-icons.js` (Playwright; `FANTA_CHROMIUM` può indicare un Chromium già installato). Rigenerare poi il build PWA.

## Verifica

`npm run test:pwa` verifica nel browser manifest e scope sotto una sottocartella, istruzioni iPhone, richiesta di installazione simulata, stato già installato, apertura offline con salvataggio, aggiornamento rimandato e conservazione delle cache degli altri giochi. I test non sostituiscono una prova di installazione su un telefono Android o iPhone reale.
