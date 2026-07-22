# Coerenza faccine condivise

## Problema individuato
I dati dei giocatori erano condivisi tramite `data/giocatori.json`, ma il disegno delle faccine non lo era.

Esistevano tre implementazioni separate del renderer:
- Home: codice interno a `index.html`;
- database giocatori: codice interno a `giocatori.html`;
- Campionato: `assets/season/04-setup-and-draft.js`.

Per questo motivo Fantaballa e MisterFM potevano avere dati corretti nel database ma un aspetto differente nella Home.

## Correzione strutturale
È stato creato:

- `assets/creator-avatars.js`

Il file è ora l'unica fonte per le faccine personalizzate di:
- Fantaballa, ID 384;
- MisterFM, ID 852.

Il renderer condiviso viene usato da:
- `index.html`;
- `giocatori.html`;
- `campionato.html`;
- `campionato-real.html` tramite il motore della stagione.

Le vecchie copie speciali presenti in `giocatori.html` e nel modulo del Campionato sono state rimosse, lasciando solo il renderer generico come fallback per gli altri giocatori.

## Fallback della Home
Sono stati aggiornati anche i dati di emergenza inseriti direttamente in `index.html`:
- Fantaballa non compare più tra gli abbonati;
- Fantaballa compare tra i creator;
- MisterFM compare tra i creator;
- i dati dei creator sono allineati a `data/giocatori.json`.

## Aggiornamenti futuri
Per modificare l'aspetto di Fantaballa o MisterFM sarà sufficiente intervenire una sola volta in:

`assets/creator-avatars.js`

La modifica verrà utilizzata automaticamente dalla Home, dal database giocatori e dal Campionato.
