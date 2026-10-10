# Asta mobile V251

Struttura dedicata al telefono con quattro schermate: Asta, Rosa, Lega, Storico. Testata compatta con crediti, rosa, necessità per ruolo e Salva. Durante l’asta la scheda giocatore mantiene nome, club, ruolo, OVR, quotazione, stelle e analisi disponibili con Osservatore. In testa, tempo, prezzo, rilanci +10/+5/+1, Lascia e poteri sono nello stesso blocco. Le informazioni secondarie sono spostate nelle rispettive schermate, riutilizzando i nodi originali e i loro handler. Nessuna modifica al motore o ai vincoli dei poteri. Su desktop i nodi tornano alla posizione originale.

La schermata usa l’altezza dinamica del telefono e le aree sicure. Il blocco comandi resta fuori dallo scorrimento della scheda: su display bassi, nomi lunghi o eventi complessi (ad esempio doppio giocatore) è disponibile uno scorrimento locale della scheda.

Verifica: test mobile-auction-app per navigazione, sincronizzazione crediti, azioni originali, cambio fase e ripristino desktop; mobile-ui, CSS build, edizione di produzione e suite generale 62/62. Browser Chromium non disponibile: nessuna verifica visiva su dispositivo effettuata.
