# Test grafici V258 — eseguiti in Chromium

42 combinazioni fase/viewport passate, zero fallimenti e zero casi non eseguiti. Report completo: `reports/browser/latest.json`. Sono presenti 42 screenshot, sei per viewport. Esecuzione reale con Chrome for Testing headless 151.0.7922.34 su Linux, scaricato dalla distribuzione ufficiale Google e verificato con MD5 `792047b3c2625d7d4b0fc7c4fc67d7ad`.

## Correzioni trovate dal browser

1. Asta desktop: la riga dei rilanci era alta 74 px mentre i pulsanti avevano altezza minima 78 px. Quattro pixel invadevano la riga di Lascia. La riga ora rispetta l’altezza minima effettiva e può crescere.
2. Tabellone mobile: una vecchia regola `order:-1` portava il risultato prima delle squadre, lasciando il nome utente nella colonna centrale e comprimendo l’avversario. Ripristinato l’ordine squadra, risultato, avversario; il test verifica anche larghezze equivalenti per le squadre e assenza di sovrapposizioni.
3. Diretta mobile: la scheda evento aveva `pointer-events:auto` anche dopo la scomparsa. La parte invisibile intercettava i tocchi sui comandi nei telefoni più piccoli. Ora riceve tocchi solo quando il riquadro è visibile.

Non modificati motore, regole, salvataggi o modularizzazione della V257.

## Affidabilità del test

Le misure dei comandi dell’asta sono raccolte senza spostare la pagina tra un pulsante e l’altro. Gli altri comandi vengono portati al centro della viewport per evitare la copertura delle barre sticky durante lo scorrimento del test. Le assertion registrano anche l’elemento che copre il punto di click.

La prova negativa del rilevatore sposta deliberatamente un pulsante fuori schermo e disabilita la transizione del solo pulsante di prova, poi ripristina lo stile originale. Il test formazione usa il selettore giocatori reale invece di una sequenza che lasciava aperto il dialogo mobile. In diretta il test attende la fine dell’overlay evento prima dei comandi: il controllo geometrico continuava a rilevare l’intercettazione invisibile fino alla correzione CSS.

## Scope eseguito

Avvio, chiamata, rilanci +1/+5/+10, Lascia, analisi e acquisto doppio, dock durante scroll, salvataggio IndexedDB e ripresa; formazione 4-3-3 e 4-4-2, undici giocatori senza sovrapposizioni, capitano senza sostituzione, hover e conferma; squadre affiancate, tabellone, velocità, pausa, prossimo evento, salta al 90 e avvio Big Match.

Viewport: 1920×1080, 1366×768, 1024×768, 768×1024, 390×844, 369×682, 844×390.

Dieci verifiche Node mirate passate (`reports/targeted-v258.json`); build CSS, consolidamento e contratti responsive ripetuti dopo la correzione finale. La suite core completa di 63 script era già passata nella V257 e non viene presentata come nuova esecuzione completa della V258.

## Limiti

Questi test verificano gli scenari dichiarati, con carriere preparate e timer fermati tra le azioni. Non provano un’asta completa nel browser, ogni animazione, tutti i poteri o una stagione intera. Gli screenshot non hanno una baseline pixel approvata; revisione visiva campionaria di asta mobile, formazione desktop e tabellone mobile. Nessuna certificazione per Safari/iPhone o dispositivi fisici. Le differenze di font ed emoji tra Linux e Windows rimangono possibili.
