# Ottimizzazione asset e caricamento

## Risultato

- Peso complessivo del progetto: **26.76 MB → 5.90 MB** (**−77.9%**).
- Peso delle risorse grafiche: **23.55 MB → 3.02 MB** (**−87.2%**).
- Riferimenti locali mancanti: **0**.
- Asset oltre 500 KB: **0**.
- Duplicati esatti: **0**.
- Asset grafici inutilizzati rilevati: **0**.

## Conversioni principali

| Prima | Dopo | Peso prima | Peso dopo | Riduzione |
|---|---|---:|---:|---:|
| `assets/coach-profiles/anonymous.png` | `assets/coach-profiles/anonymous.webp` | 3862 KB | 444 KB | −88.5% |
| `assets/coach-profiles/motivator.png` | `assets/coach-profiles/motivator.webp` | 2851 KB | 217 KB | −92.4% |
| `assets/coach-profiles/salvation.png` | `assets/coach-profiles/salvation.webp` | 3288 KB | 330 KB | −89.9% |
| `assets/coach-profiles/talent-scout.png` | `assets/coach-profiles/talent-scout.webp` | 3190 KB | 293 KB | −90.8% |
| `assets/macro-modes/season-bg.png` | `assets/macro-modes/season-bg.webp` | 3294 KB | 285 KB | −91.3% |
| `assets/macro-modes/worldcup-bg.png` | `assets/macro-modes/worldcup-bg.webp` | 2798 KB | 148 KB | −94.7% |

Le conversioni mantengono le dimensioni originali. Per le immagini con trasparenza, il canale alfa è risultato identico nei controlli automatici.

## Modifiche al caricamento

- Gli sfondi principali e i profili allenatore pesanti sono stati convertiti in WebP.
- `season-bg.png` e `season-draft-hero.png`, che erano copie identiche, sono stati sostituiti da un unico `season-bg.webp`.
- Le copie duplicate di favicon e icone PWA nella cartella `assets` sono state eliminate; tutte le pagine usano le copie principali in root.
- Le immagini laterali del carosello allenatori usano caricamento lazy e decodifica asincrona.
- Gli asset visibili nella prima schermata utilizzano preload e priorità alta dove utile.
- Community e REAL mostrano ora le fasi reali di caricamento: database, validazione e ripristino della stagione.
- I JSON del gioco sono cacheabili e versionati con `v=20260722-1`, così gli accessi successivi sono più rapidi senza mantenere dati obsoleti dopo una nuova pubblicazione.
- Gli script statici hanno lo stesso parametro di versione per evitare che il browser riutilizzi moduli precedenti.
- Il riferimento al font locale mancante `MODERNIZ(1).OTF` è stato rimosso; resta il font display web già presente con fallback di sistema.
- Il file obsoleto `world-cup.html.bak` è stato rimosso.

## Verifiche

- Sintassi valida per tutti i JavaScript esterni e per gli script inline.
- Pagine principali caricate in Chromium con **0 richieste locali mancanti** e **0 immagini rotte**.
- Validatore database: **0 errori bloccanti**.
- Validatore eventi: **0 errori e 0 avvisi**.
- Stress test motore: **28/28 Community** e **28/28 REAL**, con quattro stagioni complete per modalità e **304 giornate** simulate.

`classifica.html` usa un feed esterno Google Sheets: durante il test isolato gli asset locali sono stati verificati, mentre il servizio esterno non è stato contattato.

## Pubblicazione

Caricare l’intero progetto aggiornato. Se si sovrascrive una versione già online, eliminare anche i vecchi PNG non più referenziati e `world-cup.html.bak`; altrimenti resterebbero sul server pur non essendo più utilizzati.

Per ripetere l’audit:

```bash
python tools/audit-assets.py
```
