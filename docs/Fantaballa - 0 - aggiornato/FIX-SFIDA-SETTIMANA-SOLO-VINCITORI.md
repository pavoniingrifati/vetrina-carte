# Sfida della settimana — invio solo ai vincitori

La modalità **Tricolore col Pisa!** consente ora di inviare il risultato alla classifica **Sfida della settimana** soltanto se il Pisa conclude il campionato al primo posto.

## Protezioni applicate

- Il pulsante di invio non viene mostrato se la stagione termina dal 2° posto in giù.
- Un tentativo manuale di invio viene bloccato dal motore del gioco.
- Il Google Apps Script rifiuta comunque i payload della modalità `sfida_settimana` con `posizione_finale` diversa da `1`.
- Il file di configurazione è versionato nell'HTML per evitare l'uso della copia precedente dalla cache del browser.
