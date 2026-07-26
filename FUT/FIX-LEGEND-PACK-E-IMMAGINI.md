# Fix definitivo apertura Legend e immagini carte

## Cause individuate

1. La sequenza speciale veniva attivata in base alla **carta** (`rarity`/`series`) e non in base al **pacchetto Legend**. Una carta Tots o Rara trovata nel pacchetto Legend seguiva quindi l'apertura normale e mostrava insieme ruolo, rarità, serie e nome.
2. Nelle aperture normali rimaneva attiva la classe CSS `is-tease`, che aveva `opacity: 0 !important` sul contenitore grafico. L'immagine veniva caricata correttamente, ma restava invisibile fino al recap.
3. La transizione di `visibility` della sequenza Legend ritardava la comparsa dei singoli elementi: clic ravvicinati potevano farli sembrare comparire tutti insieme.

## Correzioni

- Tutte le carte aperte dal pacchetto **Legend** usano la sequenza manuale, anche quando la carta è `Rara`, `Tots` o appartiene a un'altra serie.
- Sequenza Legend confermata:
  1. ruolo;
  2. rarità;
  3. serie;
  4. nome;
  5. immagine completa;
  6. clic successivo verso la carta seguente o il recap.
- Ogni clic sblocca esattamente un solo passaggio.
- Rimossa la transizione ritardata di `visibility`; ogni informazione appare subito al clic con una breve animazione dedicata.
- Nelle aperture non Legend viene rimossa `is-tease` prima di mostrare la carta.
- L'immagine reale o quella default diventa visibile nello spacchettamento, non soltanto nel recap.
- Aggiornato il cache-busting in `store.html` alla versione `opening-legend-pack-image-v9`.

## Test eseguiti

- `node tools/test-pack-opening.js`: **21/21 superati**.
- `node tools/test-legend-click-flow.js`: superato con una carta `Rara / Tots` dentro il pacchetto Legend.
- Test reale con **Chromium headless**:
  - Legend: ruolo, rarità, serie, nome e immagine verificati uno per clic;
  - immagine visibile al quinto clic;
  - pacchetto Silver normale: immagine visibile e stato `is-tease` rimosso.
