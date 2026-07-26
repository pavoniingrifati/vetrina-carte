# Apertura pacchetti Base + Premium

## Risultato

Il progetto utilizza un solo motore cinematografico condiviso, ma con due identità distinte:

- **Fantaballa FC:** arena/stadio, fasci di luce, particelle sportive e colori turchese/azzurro.
- **Gotham City FC:** notte, skyline, pioggia, neon viola e atmosfera più oscura.

Il flusso è:

1. clic sul pacchetto o su **Apri pacchetto**;
2. overlay a schermo intero;
3. caricamento energetico del pack;
4. flash di apertura;
5. reveal progressivo delle carte;
6. walkout per le carte speciali;
7. riepilogo finale;
8. **Continua** per tornare allo store e vedere anche la griglia classica.

## Funzioni Base

- overlay fullscreen responsive;
- pacchetto centrale con aura, anelli, vibrazione e flash;
- rivelazione di rarità, ruolo, serie, nome e immagine;
- progressione carta per carta;
- pulsante **Salta**;
- riepilogo finale con tutte le carte;
- pulsante **Continua**;
- rispetto di `prefers-reduced-motion`.

## Funzioni Premium

- tema visivo diverso per ogni modalità;
- particelle e atmosfera generate senza asset aggiuntivi;
- walkout per rarità e serie configurabili;
- carta migliore evidenziata nel riepilogo;
- durata adattiva: pack grandi più rapidi, pack piccoli più cinematografici;
- effetti sonori generati con Web Audio;
- controllo audio con memoria locale;
- fallback grafico quando manca un’immagine;
- fallback all’animazione originale se il modulo premium non viene caricato.

## File aggiunti

```text
assets/css/futtu-pack-opening.css
assets/js/futtu-pack-opening.js
tools/test-pack-opening.js
```

## File modificati

```text
store.html
assets/js/futtu-core-original-ui.js
config/fantaballa.js
config/gotham.js
config/loader.js
README.txt
```

## Personalizzazione del tema

In `config/fantaballa.js` e `config/gotham.js` è presente:

```js
openingTheme: {
  atmosphere: 'stadium',
  primaryColor: '#4ee5d8',
  secondaryColor: '#1f9dff',
  accentColor: '#ffe76a',
  eyebrow: 'FANTABALLA FC • PACK OPENING',
  readyText: 'Clicca per aprire subito',
  walkoutRarities: ['Ultra Rara','Season','Leggendaria'],
  walkoutSeries: ['Legend','Leggendaria','Tots','Dream'],
  sound: true
}
```

Per Gotham `atmosphere` è impostato su `dark-rain`.

### Forzare il walkout su una carta

Nel database JSON puoi aggiungere:

```json
"walkout": true
```

La carta attiverà il reveal premium anche se la sua rarità o serie non è nella configurazione.

## Salvataggio

L’inventario viene aggiornato prima dell’avvio del reveal. In questo modo le carte sono registrate prima della sequenza cinematografica.

## Test eseguiti

- sintassi JavaScript dei file modificati;
- validità di `data/cards.json`;
- validità degli script inline di `store.html`;
- ordine di caricamento CSS/modulo/core;
- presenza del fallback originale;
- separazione dei pacchetti Fantaballa/Gotham;
- riconoscimento dei walkout Fantaballa e Gotham;
- presenza delle fasi pack, reveal, walkout e riepilogo;
- presenza di carte per entrambe le modalità.

Risultato del test dedicato: **12/12 superati**.
