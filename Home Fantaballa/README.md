# Fantaballa Home v17

Versione aggiornata del sito Fantaballa in HTML, CSS e JavaScript puro.

## Novità v14

- La card **Altri progetti** nella Home ora apre una sezione interna dedicata.
- Nuova sezione **Altri progetti** nel menu principale.
- Box aggiunti:
  - **Fantaballa-0** — Vinci il mondiale con una squadra casuale composta dagli utenti della World Cup 2026.
  - **Wrestling** — Diventa un wrestling e affronta gli altri utenti per la cintura!
- Nella sezione **Abbonati**, i nomi degli utenti vengono adattati automaticamente in base alla lunghezza, così si leggono meglio nelle formazioni.

## Struttura

```text
index.html
css/style.css
js/script.js
assets/
data/
```

## File modificabili

- `data/abbonati.json`: lista abbonati mostrata nei campi.
- `data/obiettivi.json`: obiettivi generati casualmente.
- `js/script.js`: lista paesi World Cup per le bandiere casuali.

## Font

Inserisci manualmente, se non già presenti:

```text
assets/fonts/MODERNIZ.OTF
assets/fonts/INLANDERS DEMO.OTF
```

## Pubblicazione GitHub Pages

Carica tutti i file nella root della repository, non dentro una sottocartella.


## Aggiornamento v15
- Header/menu reso più compatto per evitare testi tagliati.
- Voce di menu 'Altri progetti' rinominata in 'Minigame'.


## Versione v16
- La voce Obiettivi nel menu è stata sostituita da FUT.
- La sezione FUT contiene Database Carte, Spacchetto, Obiettivi e Prossimamente.
- Il box Obiettivi apre la sezione degli obiettivi random nella stessa pagina.


## Versione v17
- Il box 4 della sezione FUT è diventato **Vetrina Carte**.
- La vetrina mostra 4 carte casuali lette da `data/cards.json`.
- Le immagini relative `img/...` vengono risolte automaticamente sul sito carte.

## FUT - Vetrina Carte

Il quarto box della sezione FUT mostra carte casuali prese da `data/cards.json`.
Le immagini con link completi vengono usate direttamente; quelle relative tipo `img/nome.png` vengono risolte sul sito `https://pavoniingrifati.github.io/vetrina-carte/`.
Cliccando sul box si apre il database carte completo.


## Aggiornamento v18
- Corretto il layout della sezione FUT: i box non si sovrappongono più.
- Ridotta la dimensione dei titoli FUT.
- La Vetrina Carte ora usa una griglia interna più compatta.
- Aggiunto `data/cards.js` come fallback locale per mostrare le carte anche aprendo il sito senza server.

## Aggiornamento v19
- Rimosso il quarto box della sezione FUT.
- Aggiunta una vetrina libera sopra i box FUT con testo: **Diventa una carta!** e **!ruolo + il tuo ruolo in live**.
- Le carte casuali appaiono grandi, non tagliate, affiancate e leggermente sovrapposte.
- I tre box FUT rimasti sono Database Carte, Spacchetto e Obiettivi.

## Aggiornamento v20
- Nella sezione Abbonati l'alert di scadenza viene mostrato solo per le sub Prime.
- Se una Prime scade entro 5 giorni o è già scaduta, il giocatore riceve cornice rossa e simbolo `!`.
- Le sub recurring/gift non vengono evidenziate.
