# Fantaballa convertito da abbonato a creator

## Giocatore aggiornato
- ID: `384`
- Nome: `Fantaballa`
- Club: `fantaballa-fc`
- Ruolo: `CC, COC`
- OVR: `79`

## Modifica database
Il record esistente non è stato duplicato.

Valori aggiornati:

```json
{
  "subscriber": "no",
  "abbonato": "no",
  "creator": "si",
  "creatorStyle": "fantaballa"
}
```

Sono stati aggiornati sia:
- `data/giocatori.json`
- `data/normalized/giocatori.json`

## Faccina personalizzata
È stato aggiunto un preset dedicato nel generatore SVG interno del gioco:
- capelli castano scuro;
- capelli orientati lateralmente;
- occhi azzurri più evidenti;
- barba corta;
- volto ovale;
- nessun accessorio.

La faccina non è un'immagine esterna: viene generata dal sistema grafico già usato per gli altri giocatori, quindi compare automaticamente nel draft, nella rosa, nella formazione, nel mercato, nelle statistiche e nei riepiloghi.

## Compatibilità con salvataggi precedenti
Le funzioni `isSubscriber()` e `isCreator()` riconoscono Fantaballa tramite ID `384`, nome e stile creator.

Di conseguenza, anche una vecchia stagione che conserva ancora:

```json
{
  "subscriber": "si",
  "abbonato": "si"
}
```

lo mostra comunque come creator e non come abbonato.

## Gameplay
Fantaballa:
- non riceve più i bonus riservati agli abbonati;
- può ricevere gli effetti e i bonus dedicati ai creator;
- mostra il badge `CR` / `CREATOR` invece della stella abbonato.
