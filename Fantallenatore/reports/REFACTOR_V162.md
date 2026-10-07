# Refactoring strutturale V162

Estratti storage-snapshot.js e cpu-lineup-policy.js. L'app mantiene chiamate brevi alle API; entrambi i moduli sono caricati prima dell'app, con errori espliciti se mancanti. Le dipendenze di dominio vengono passate nelle chiamate o nella factory. Nessuna modifica intenzionale a formule, pesi, compattazione o formato di salvataggio.

Fixture generate dal codice di produzione V161 prima dell'estrazione: confronto byte per byte degli snapshot JSON su dieci casi e confronto numerico di 144 punteggi CPU tra divisioni, ruoli e regole. Input non mutati. Test separati verificano ordine di caricamento, assenza di logica duplicata e di dipendenze UI/storage nei nuovi moduli.

34 script core superati. La suite include salvataggi delle carriere lunghe, costruzione formazione reale e runtime di simulazione della Serie A. Browser non eseguito: non viene dichiarata verifica visiva o end-to-end dei click.

Il monolite non è completamente risolto: controller UI, asta, costruzione formazioni e molte transizioni sono ancora nell'app. ARCHITETTURA.md definisce responsabilità, test e regole per proseguire le estrazioni senza mischiare refactoring e cambiamenti di gameplay. Fixture di equivalenza non certificano ogni combinazione possibile.
