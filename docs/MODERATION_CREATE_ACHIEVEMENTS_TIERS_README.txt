CREAZIONE ACHIEVEMENT E TIER DAL PANNELLO MODERAZIONE

Nuove funzioni in moderation.html:

1) CREA ACHIEVEMENT
Campi:
- ID documento
- titolo
- descrizione
- XP
- categoria: FUT / WWE / F1 / LIVE / SOCIAL
- active
- prerequisiti (ID separati da virgola)
- linkRequest + linkUrl opzionale

Il documento creato usa lo schema già letto da gamepass.js:
achievements/{id}
{
  title,
  desc,
  points,
  type,
  active,
  prereq,
  linkRequest,
  linkUrl,
  createdAt,
  createdBy
}

2) CREA TIER
Campi:
- ID documento
- requiredPoints
- active
- reward.type
- reward.rarity
- reward.label
- reward.title
- reward.imgUrl
- reward.overall opzionale

Il documento creato usa lo schema già letto da gamepass.js:
gp_tiers/{id}
{
  active,
  requiredPoints,
  reward: {
    type,
    rarity,
    label,
    title,
    imgUrl,
    overall?
  },
  createdAt,
  createdBy
}

PROTEZIONI:
- solo moderatori;
- controllo ID duplicato prima della creazione;
- le Rules consentono solo CREATE, non UPDATE/DELETE;
- un ID esistente non viene sovrascritto;
- conferma prima della scrittura.

IMPORTANTE:
Pubblicare anche firestore.rules nel progetto Firebase.
Caricare il file sull'hosting non modifica automaticamente le Security Rules.
