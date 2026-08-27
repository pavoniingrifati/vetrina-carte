PROFILO UTENTE - UPGRADE 1

Aggiunte:
1. Header profilo con livello, stagione, XP e barra progresso.
2. Statistiche principali: livello, XP, achievement, premi, carte.
3. Fino a 3 achievement in evidenza, selezionabili dal profilo.
4. Carta preferita, selezionabile direttamente da "Le tue carte".
5. Storico stagioni con XP, livello, achievement e premi.

Firestore:
- profile/main ora può salvare:
  featuredAchievementIds: array max 3
  favoriteCardId: string
- Pubblicare anche le firestore.rules incluse nel pacchetto.

Compatibilità:
- Il sistema stagione introdotto in precedenza resta invariato.
- Stagione 1 legacy continua ad essere letta nello storico.
