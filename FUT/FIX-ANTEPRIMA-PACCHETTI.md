# Correzione anteprima pacchetti

## Problema
Dopo la prima apertura, la zona del pacchetto restava cliccabile ma la sua immagine non era più visibile.

## Causa
L'animazione CSS `packOpen` termina con `opacity: 0` e usa `forwards`. La classe `opening` non veniva rimossa dopo un'apertura riuscita, quindi lo stato finale invisibile rimaneva applicato anche alle anteprime successive.

## Correzione
- aggiunto un reset centralizzato dello stato grafico del pacchetto;
- rimozione delle classi `opening` e `shake`;
- annullamento delle animazioni CSS ancora attive;
- ripristino di opacità, trasformazione, filtro e visibilità;
- reset eseguito al cambio pacchetto, prima di una nuova apertura, dopo un'apertura riuscita e in caso di errore/login annullato;
- aggiunto un fallback CSS che forza la visibilità della nuova anteprima quando non è in corso un'apertura.

La correzione è nel motore condiviso e vale sia per **Fantaballa FC** sia per **Gotham City FC**.

## Verifiche
- tutti i file JavaScript del progetto superano `node --check`;
- tutti i 14 script inline di `store.html` sono sintatticamente validi;
- verificata la presenza dei reset nei quattro punti del flusso;
- nessun riferimento locale imprevisto mancante.

Il test visuale automatico con Chromium non è stato completabile nell'ambiente di esecuzione a causa del blocco del processo headless; la correzione è stata verificata staticamente sul flusso completo.
