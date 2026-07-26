# Codice Base + Premium pronto da integrare

La versione è già integrata nel progetto. Per trasferirla manualmente in un’altra copia servono questi passaggi.

## 1. Copiare i nuovi file

```text
assets/css/futtu-pack-opening.css
assets/js/futtu-pack-opening.js
```

## 2. Aggiungere in `store.html`, dentro `<head>`

```html
<link rel="stylesheet" href="assets/css/futtu-pack-opening.css">
```

## 3. Caricare il modulo prima del core

```html
<script src="assets/js/futtu-pack-opening.js"></script>
<script src="assets/js/futtu-core-original-ui.js"></script>
```

## 4. Inserire `openingTheme` nei config

La configurazione completa è già presente in:

```text
config/fantaballa.js
config/gotham.js
```

## 5. Collegare il core

Nel gestore di apertura, dopo aver generato `chosen`, viene eseguito:

```js
await window.FUTTU_PACK_OPENING.play({
  mode: FUTTU_CONFIG.id,
  game,
  packName: game,
  cover: PACK_BACK_BY_GAME[game] || '',
  pack: PACK_CONFIG_BY_GAME[game] || {},
  cards: chosen
});
```

La copia completa del gestore è già presente in `assets/js/futtu-core-original-ui.js`.
