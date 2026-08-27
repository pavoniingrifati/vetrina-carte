AGGIORNAMENTO DATI PER STAGIONE
===============================

Nuova struttura Firestore usata dal sito:

users/{uid}/seasons/season_N/gamepass/progress
users/{uid}/seasons/season_N/earned/{achievementId}
users/{uid}/seasons/season_N/gp_claims/{tierId}

Le richieste restano nella collection globale:
requests/{requestId}
ma ora ogni nuova richiesta contiene il campo numerico `season`.

COMPATIBILITA' STAGIONE 1
-------------------------
I dati già esistenti nei vecchi path:
users/{uid}/gamepass/progress
users/{uid}/earned/{achievementId}
users/{uid}/gp_claims/{tierId}

continuano a essere letti come dati della STAGIONE 1.
Alla prima nuova scrittura del progress di Stagione 1, gli XP legacy vengono
copiati nel nuovo documento stagionale prima di aggiungere nuovi XP.

DALLA STAGIONE 2
----------------
Modificando config/gamepass.season da 1 a 2:
- XP = nuovo progress season_2
- bonus giornaliero = separato per season_2
- earned = separati per season_2
- gp_claims = separati per season_2
- richieste = create con season: 2
- profilo e Game Pass mostrano solo i dati della stagione corrente
- i dati della Stagione 1 non vengono cancellati

IMPORTANTE: FIRESTORE RULES
---------------------------
Le Security Rules non erano presenti nell'archivio originale.
Prima di pubblicare questa versione, verificare che le Rules consentano le
stesse operazioni già autorizzate anche sotto:
users/{uid}/seasons/{seasonId}/gamepass/{docId}
users/{uid}/seasons/{seasonId}/earned/{achievementId}
users/{uid}/seasons/{seasonId}/gp_claims/{tierId}

Non sono state modificate Rules perché non erano incluse nei file ricevuti.
