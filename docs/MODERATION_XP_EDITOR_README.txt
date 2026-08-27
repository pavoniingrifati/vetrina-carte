GESTIONE XP DAL PANNELLO MODERAZIONE

Aggiunto a moderation.html / moderation.js:

- ricerca utente per nickname, email o UID;
- visualizzazione della stagione corrente letta da config/gamepass;
- lettura XP esclusivamente dal nuovo percorso stagionale:
  users/{uid}/seasons/season_N/gamepass/progress
- possibilità di:
  1) impostare un valore XP esatto;
  2) aggiungere o sottrarre XP;
- conferma prima del salvataggio;
- valore XP mai inferiore a 0;
- creazione automatica del progress stagionale se non esiste;
- modifica eseguita in transazione Firestore;
- motivo obbligatorio;
- audit in /xp_adjustments con:
  uid utente, nome, stagione, vecchi XP, nuovi XP, delta,
  motivo, UID/email moderatore e data.

IMPORTANTE:
Pubblicare anche firestore.rules.
Il file delle Rules presente nella cartella del sito NON viene applicato
automaticamente a Firebase solo caricandolo sull'hosting.

NOTA PREMI:
Abbassare manualmente gli XP non elimina i documenti gp_claims già esistenti.
Aumentando gli XP, l'eventuale auto-sblocco dei tier avviene quando l'utente
apre il Game Pass.
