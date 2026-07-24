LA TUA FANTAROSA IN SERIE A — ISTRUZIONI

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
4. Se aggiungi più squadre, separale con una virgola.
5. Salva il file rispettando la sintassi JSON.

IMPORTANTE: APERTURA IN LOCALE
Il browser non consente sempre di leggere un file JSON aprendo index.html con doppio clic.
Per questo è incluso start-server.bat.

Su Windows:
1. Fai doppio clic su start-server.bat.
2. Si aprirà il sito all'indirizzo http://localhost:8000
3. Lascia aperta la finestra nera mentre lavori.

Il sito pubblicato su un normale hosting, Netlify o Vercel leggerà il JSON senza problemi.

STRUTTURA
- index.html: struttura della pagina
- css/style.css: grafica
- js/app.js: lettura del JSON e funzioni del sito
- data/contenuti.json: unico database dei contenuti
- data/esempio-squadra.json: modello da copiare
- assets/: loghi e immagini
