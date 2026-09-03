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

CONTENUTI DEL SITO
Tutti i contenuti modificabili si trovano in:

data/contenuti.json

Dentro questo file puoi cambiare nome del progetto, stagione, link TikTok,
competizione, colori, formazioni, giocatori e risultati stagionali.

VALUTAZIONE AUTOMATICA SU 100
Il campo "rating" non va piu inserito manualmente nelle squadre.
Il sito calcola automaticamente il voto usando questi parametri:

- Punti in campionato: massimo 55 punti di valutazione
- Vittoria campionato: +15
- Vittoria Coppa: +10
- Capocannoniere: +5
- MVP: +5
- Miglior attacco: +5
- Miglior difesa: +5

I pesi sono modificabili dentro:
site > ratingSystem

Il contributo dei punti di campionato usa una curva calibrata per non penalizzare
troppo le stagioni con punteggi realistici. Con la configurazione attuale,
77 punti di campionato valgono 46/55.

ESEMPIO PAVONI INGRIFATI
77 punti + campionato vinto + miglior attacco =
46 + 15 + 5 = 66/100.

PARAMETRI DA INSERIRE PER OGNI SQUADRA
"points": 77,
"goalsFor": 67,
"goalsAgainst": 32,
"vittoriaCampionato": true,
"vittoriaCoppa": false,
"capocannoniere": false,
"mvp": false,
"migliorAttacco": true,
"migliorDifesa": false

COME AGGIUNGERE UNA SQUADRA
1. Apri data/esempio-squadra.json.
2. Copia tutto l'oggetto della squadra.
3. Incollalo dentro l'array "teams" di data/contenuti.json.
4. Se aggiungi piu squadre, separale con una virgola.
5. Modifica i dati e salva rispettando la sintassi JSON.

COLORI DELLA SQUADRA
Per ogni squadra puoi impostare:
- "color": colore principale della maglia e degli elementi grafici
- "secondaryColor": colore dei numeri e delle iniziali nello stemma

FORMAZIONE
L'ordine dei titolari per il 4-3-3 e:
1 portiere, 4 difensori, 3 centrocampisti, 3 attaccanti.

PUBBLICAZIONE SU GITHUB
Carica l'intera cartella fantarosafm nella directory principale del repository.
Il sito pubblico sara disponibile su:
https://fantaballa.it/fantarosafm

STRUTTURA
- index.html: struttura della pagina
- css/style.css: grafica
- js/app.js: lettura del JSON e funzioni del sito
- data/contenuti.json: database dei contenuti e configurazione punteggi
- data/esempio-squadra.json: modello da copiare
- assets/: loghi e immagini
- start-server.bat: avvio dell'anteprima locale
- server.ps1: server locale PowerShell senza installazioni
