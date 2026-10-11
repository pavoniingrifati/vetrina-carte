# Verifica responsive

## Matrice principale

| Risoluzione | Profilo | Comportamento atteso | Esito contratto CSS |
|---|---|---|---|
| 1920×1080 | Desktop wide | Dashboard a tre colonne e navigazione completa | Superato |
| 1440×900 | Desktop | Dashboard a tre colonne e navigazione completa | Superato |
| 1366×768 | Desktop compatto | Dashboard a tre colonne entro la viewport | Superato |
| 1024×768 | Compatto | Dashboard a colonna singola, senza overflow strutturale | Corretto e superato |
| 768×1024 | Tablet verticale | Colonna singola e contenuti fluidi | Superato |
| 390×844 | Telefono | Pannelli singoli, navigazione compatta e azioni su due colonne | Superato |

## Correzione applicata

La dashboard manteneva tre colonne fino a 980 px. A 1024 px, le larghezze minime delle colonne e gli spazi intermedi superavano la viewport. Il passaggio alla colonna singola avviene ora a 1100 px; a 620 px anche i due pannelli laterali interni diventano una sola colonna.

Modali e media sono inoltre limitati alla larghezza disponibile. Le tabelle e le rose nate per lo scorrimento orizzontale mantengono intenzionalmente il proprio contenitore scrollabile.

## Tipo di verifica

`tests/responsive-audit.js` controlla automaticamente la presenza, l'ordine e la copertura dei contratti CSS sulle sei viewport. In questo ambiente non era disponibile un browser eseguibile per produrre screenshot affidabili: l'ultimo controllo visuale va quindi eseguito nel browser reale, ridimensionando la finestra sulle sei misure sopra indicate.

Checklist visuale finale:

- nessun taglio orizzontale della pagina;
- navigazione completamente cliccabile;
- modali interamente visibili;
- testi senza sovrapposizioni;
- tabelle larghe scorribili nel proprio contenitore;
- pulsanti principali chiaramente leggibili e azionabili.
