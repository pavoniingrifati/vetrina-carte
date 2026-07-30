LA TUA FANTAROSA IN SERIE A — ISTRUZIONI

ANTEPRIMA LOCALE SU WINDOWS
1. Estrai la cartella fantarosafm.
2. Fai doppio clic su start-server.bat.
3. Il browser si aprira automaticamente su:
   http://localhost:8000/
4. Non serve installare Python: il server usa PowerShell, gia presente in Windows.
5. Lascia aperta la finestra nera mentre lavori.
6. Dopo una modifica, salva il file e aggiorna la pagina con CTRL+F5.
7. Per fermare il server, premi CTRL+C nella finestra nera.

Il server viene avviato direttamente dentro la cartella del progetto. Per questo
l'anteprima locale usa http://localhost:8000/, mentre su GitHub Pages il sito
continua a funzionare nella cartella /fantarosafm.

CONTENUTI DEL SITO
Tutti i contenuti modificabili si trovano in:

data/contenuti.json

Dentro questo file puoi cambiare:
- nome del progetto
- stagione
- link del profilo TikTok
- nome della competizione
- fasce delle valutazioni
- elenco completo delle squadre

COME AGGIUNGERE UNA SQUADRA
1. Apri data/esempio-squadra.json.
2. Copia tutto l'oggetto della squadra.
3. Incollalo dentro l'array "teams" di data/contenuti.json.
4. Se aggiungi piu squadre, separale con una virgola.
5. Salva il file rispettando la sintassi JSON.

PUBBLICAZIONE SU GITHUB
Carica l'intera cartella fantarosafm nella directory principale del repository.
Il sito pubblico sara disponibile su:
https://fantaballa.it/fantarosafm

STRUTTURA
- index.html: struttura della pagina
- css/style.css: grafica
- js/app.js: lettura del JSON e funzioni del sito
- data/contenuti.json: unico database dei contenuti
- data/esempio-squadra.json: modello da copiare
- assets/: loghi e immagini
- start-server.bat: avvio dell'anteprima locale
- server.ps1: server locale PowerShell senza installazioni

AGGIORNAMENTO MOBILE
Il layout è ottimizzato per smartphone da 320 px in su, tablet e dispositivi touch.
La classifica mobile non richiede scorrimento orizzontale; menu, pulsanti e schede squadra sono adattati al touch.
