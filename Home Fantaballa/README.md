# Fantaballa Home v10

Home page statica in HTML, CSS e JavaScript puro, pronta per GitHub Pages.

## Cosa contiene

- Menu principale in stile videogame: `Gioca`, `Obiettivi`, `World Cup`.
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
- Sezione `World Cup` dopo `Obiettivi`, con box in stile Home, link esterni e bandiere casuali di paesi World Cup come sfondo.

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

## Font World Cup

La sezione `World Cup` usa il font Inlanders Demo, separato dal resto del sito. Home e Obiettivi continuano a usare Moderniz.

Copia manualmente il tuo file:

```text
INLANDERS DEMO.OTF
```

in:

```text
assets/fonts/INLANDERS DEMO.OTF
```


## Sezione World Cup

I box World Cup aprono i link in una nuova scheda:

- Probabili Convocati
- I Convocati
- Fantacalcio
- Live partite
- Seguici

Le bandiere vengono caricate casualmente a ogni refresh da una lista modificabile dentro `js/script.js`, nella costante `worldCupCountries`. Le immagini delle bandiere arrivano da `flagcdn.com`, quindi serve connessione internet per visualizzarle.

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

## Salvataggio

Quando premi `Crea nuovi obiettivi`, il sito salva la generazione nel browser. Se ricarichi la pagina, rimangono gli stessi obiettivi.

Per cancellare il salvataggio e generare di nuovo, premi `Reset salvataggio`.

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


## Aggiornamento v10
- Ridotta la dimensione dei testi nella sezione World Cup per evitare che titoli lunghi escano dai box.
- Home e Obiettivi restano invariati.
