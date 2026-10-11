# CSS V255

Prima pulizia conservativa del CSS della V253, senza la variante grafica V254.

- Dichiarazioni rimosse: 221.
- `!important`: da 6.709 a 6.505 (-204).
- Valori finali per selettore, contesto, proprietà espansa e priorità: 26.572, invariati prima/dopo.
- Condizioni responsive, ordine e fallback conservati.
- Consolidatore esteso alle liste di selettori e ai valori letterali di margin, padding e gap.
- 61 script di regressione superati, inclusi i nuovi test del consolidatore.
- Nessuna verifica visiva browser eseguita: Chromium non disponibile.

Il lavoro non elimina tutta la stratificazione: le priorità residue richiedono un riordino dei proprietari dei componenti, protetto da verifiche browser.
