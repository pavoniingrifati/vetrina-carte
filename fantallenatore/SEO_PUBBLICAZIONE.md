# Pubblicazione SEO di Fantallenatore

URL pubblico configurato: **https://fantaballa.it/fantallenatore**.

Titolo: **Fantallenatore – Il videogioco sul fantacalcio**.

Descrizione: **Fai l’asta, usa poteri, batti i rivali e vinci il Fantacalcio! Gioca dal browser o installa Fantallenatore sul telefono.**

Il titolo, la descrizione e i metadati Open Graph/Twitter sono nell’HTML iniziale: non richiedono JavaScript. La presentazione e le cinque FAQ sono sotto il pannello della home. Le risposte sono nell’HTML e possono essere aperte anche senza JavaScript.

L’immagine social dedicata è `assets/social/og-fantallenatore.png` (1733 × 907, PNG). L’URL assoluto nei metadati è **https://fantaballa.it/fantallenatore/assets/social/og-fantallenatore.png**. Pubblica anche questo file e assicurati che risponda pubblicamente senza autenticazione. L’immagine social non viene scaricata dalla home e non viene inclusa nella copia offline del gioco.

Pubblica l’intera cartella sul percorso indicato. Il server deve servire correttamente i percorsi relativi del gioco, normalmente reindirizzando `/fantallenatore` a `/fantallenatore/`. Se cambi dominio o percorso, aggiorna `og:url`, `og:image` e `twitter:image` nell’HTML.

Dopo modifiche ai contenuti esegui `npm run build` e pubblica anche `sw.js`, affinché gli utenti della versione installata ricevano i contenuti aggiornati. I motori di ricerca scelgono autonomamente titolo e descrizione mostrati nei risultati. I social possono mantenere in cache una vecchia anteprima fino a una nuova scansione.

Questa modifica riguarda titolo/descrizione, presentazione/FAQ e anteprima social. Non aggiunge sitemap, dati strutturati o altre pagine.

Verifica locale: `node tests/seo.js` per metadati e immagine; `npm run test:seo` per home e FAQ responsive anche senza JavaScript.
