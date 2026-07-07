# Fantaballa Home v6

Home page statica in HTML, CSS e JavaScript puro, pronta per GitHub Pages.

## Cosa contiene

- Menu principale in stile videogame: `Gioca` e `Obiettivi`.
- Box `Gioca` con immagini visibili tramite tag `<img>`.
- News come slider, non come bottone.
- Sezione `Obiettivi` interna alla stessa pagina.
- Bottone `Crea nuovi obiettivi` che genera 3 obiettivi per ogni categoria:
  - Obiettivi Live
  - Obiettivi Stagionali
  - Obiettivi Match
  - Obiettivi Cursed
- Salvataggio automatico degli obiettivi generati con `localStorage`.
- File JSON modificabile manualmente: `data/obiettivi.json`.

## Come modificare gli obiettivi

Apri:

```text
data/obiettivi.json
```

Ogni categoria ha tre liste:

```json
"bronze": ["Obiettivo facile"],
"silver": ["Obiettivo medio"],
"gold": ["Obiettivo difficile"]
```

Aggiungi o togli frasi dentro le liste. Il sito pesca casualmente un obiettivo bronzo, uno argento e uno oro per ogni categoria.

Gli obiettivi stagionali sono volutamente impostati come placeholder, così puoi sostituirli quando li decidi.

## Salvataggio

Quando premi `Crea nuovi obiettivi`, il sito salva la generazione nel browser. Se ricarichi la pagina, rimangono gli stessi obiettivi.

Per cancellare il salvataggio e generare di nuovo, premi `Reset salvataggio`.

## Font Moderniz

Il CSS è già predisposto per il font Moderniz, ma il file font non è incluso nello ZIP.

Copia manualmente il tuo file:

```text
MODERNIZ.OTF
```

in:

```text
assets/fonts/MODERNIZ.OTF
```

## Pubblicazione su GitHub Pages

Carica l'intera cartella nella repository, mantenendo questa struttura:

```text
index.html
css/style.css
js/script.js
data/obiettivi.json
assets/
```

Poi abilita GitHub Pages da `Settings > Pages`.
