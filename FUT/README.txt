FUTTU UNIFICATO — GRAFICA FUTTUFC ORIGINALE
===========================================

Questa versione conserva il layout, i CSS e le animazioni del file FUTTUFC originale.
È stato separato soltanto il contenuto/logica dei pacchetti.

PAGINE
- fantaballa.html  -> store Fantaballa FC
- gotham.html      -> store Gotham City FC
- store.html       -> unico HTML reale condiviso
- index.html       -> apre Fantaballa come modalità predefinita

FILE DA MODIFICARE
- Grafica o comportamento comune: store.html oppure assets/js/futtu-core-original-ui.js
- Contenuti pacchetti Fantaballa: config/fantaballa.js
- Contenuti pacchetti Gotham: config/gotham.js

CARTE
Il progetto include ora un archivio unico: data/cards.json
Fantaballa e Gotham leggono lo stesso file e filtrano automaticamente le carte in base al campo game.
Restano attivi anche i vecchi nomi file come fallback.

IMMAGINI
Mantieni i percorsi e le cartelle immagini già presenti nel sito.
Le immagini non sono incluse nello ZIP.

IMPORTANTE
Aprire il progetto tramite server web/hosting, non con doppio clic file://,
perché il browser può bloccare fetch dei JSON e Firebase.


CORREZIONE PREVIEW PACCHETTI — 26/07/2026
- Ripristinata l'immagine grande del pacchetto dopo ogni apertura.
- Rimossa correttamente la classe di animazione `opening` al termine, in caso di errore e al cambio pacchetto.
- La correzione vale per Fantaballa FC e Gotham City FC perché usano lo stesso motore.


CORREZIONE CARTE GOTHAM — 26/07/2026
- Inserito data/cards.json con l'archivio fornito.
- Gotham carica data/cards.json come prima sorgente, evitando l'errore HTTP 404.
- Riconosciuti anche i valori storici Gotham City FC e il refuso Gotahm City.
- Riconosciuto il refuso Svicolato tra le carte condivise.
- Migliorato il messaggio diagnostico delle sorgenti JSON.

APERTURA PACCHETTI BASE + PREMIUM — 26/07/2026
- Aggiunto overlay cinematografico a schermo intero condiviso da Fantaballa e Gotham.
- Fantaballa usa atmosfera stadio, luci e particelle sportive.
- Gotham usa atmosfera notturna, skyline, pioggia e neon.
- Reveal progressivo: rarità, ruolo, serie, nome e immagine della carta.
- Walkout automatico per Ultra Rara, Season, Leggendaria e per le serie configurate.
- Pacchetti da 9 carte usano una sequenza più rapida; quelli piccoli mantengono più suspense.
- Pulsanti Salta, Continua e Audio inclusi.
- Riepilogo finale con tutte le carte e carta migliore evidenziata.
- Suoni sintetici Web Audio: non richiedono file MP3 aggiuntivi.
- Le carte vengono salvate prima del reveal cinematografico.

FILE APERTURA
- assets/css/futtu-pack-opening.css  -> grafica e animazioni
- assets/js/futtu-pack-opening.js    -> sequenza Base + Premium
- config/fantaballa.js               -> tema Fantaballa
- config/gotham.js                   -> tema Gotham

PERSONALIZZAZIONE
Nei due file config puoi cambiare openingTheme: colori, atmosfera, testi,
rarità e serie che attivano il walkout. Per forzare il walkout su una singola
carta puoi aggiungere nel JSON: "walkout": true.
