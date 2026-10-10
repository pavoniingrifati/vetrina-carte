(() => {
  'use strict';
  const pages=[
  {
    "icon": "🏆",
    "title": "Inizia la tua carriera",
    "text": "Crea il tuo allenatore, personalizza la faccina e scegli il nome della squadra. Costruisci la rosa con l’asta oppure scegli Rose pronte per iniziare direttamente il campionato. Puoi usare il listone classico o attivare il campionato Pokémon.",
    "tip": "L’obiettivo è guidare la squadra dalla Lega Amatoriale fino alla Serie A."
  },
  {
    "icon": "🔨",
    "title": "Come funziona l’asta",
    "text": "Partecipano la tua squadra e 9 rivali CPU. Parti con 500 crediti e devi acquistare 25 giocatori: 3 portieri, 8 difensori, 8 centrocampisti e 6 attaccanti. Chiama un giocatore, rilancia per provare a comprarlo oppure passa per lasciare l’asta corrente.",
    "tip": "Conserva almeno 1 credito per ogni posto ancora libero. Di norma si procede per reparto; dalla Serie C una regola può consentire chiamate libere."
  },
  {
    "icon": "⚡",
    "title": "Scegli i Fantapoteri",
    "text": "Prima dell’asta hai 3 slot per i poteri. Blocco, Scout e Bluff occupano uno slot ciascuno. Osservatore e One Shot occupano tutti e tre: puoi scegliere uno di questi poteri esclusivi oppure combinare i tre poteri singoli.",
    "tip": "Ogni carta spiega il suo effetto e quanti utilizzi hai a disposizione. Scegli i poteri prima di iniziare l’asta."
  },
  {
    "icon": "🃏",
    "title": "Regole ed eventi della giornata",
    "text": "Prima di schierare la squadra, controlla le regole Admin e gli eventi. Possono cambiare i moduli disponibili, le sostituzioni, le soglie gol o i bonus. Gli eventi possono favorire o penalizzare determinati giocatori.",
    "tip": "Leggi gli effetti attivi ogni giornata: una scelta utile nella partita precedente potrebbe non esserlo oggi."
  },
  {
    "icon": "📋",
    "title": "Schiera la formazione",
    "text": "Scegli il modulo, i titolari e l’ordine della panchina, poi conferma la formazione. Se è attiva la regola del capitano, seleziona il giocatore e nominalo capitano. Mantieni formazione è disponibile gratuitamente e conserva anche il capitano.",
    "tip": "Un giocatore senza voto può essere sostituito secondo ruoli e cambi consentiti. FantaData Pro mostra media voto e difficoltà; Scout Plus mostra la titolarità stimata."
  },
  {
    "icon": "💡",
    "title": "Esperti e DataCenter",
    "text": "Gli esperti ti aiutano a scegliere chi schierare, spiegando le loro previsioni. Il DataCenter raccoglie risultati, statistiche ed evoluzione dei giocatori: puoi confrontare il rendimento della tua rosa e aprire le schede dei calciatori.",
    "tip": "I consigli degli esperti non garantiscono gol o bonus, anche con Esperti Pro. Le analisi avanzate del DataCenter richiedono FantaData Pro."
  },
  {
    "icon": "⚽",
    "title": "Segui la Diretta Gol",
    "text": "Durante le partite confronta i giocatori delle due squadre: il voto base indica la prestazione, il voto totale include bonus e malus. Usa i comandi per cambiare velocità, fermare la diretta, andare al prossimo evento o saltare al 90°. Segui anche il Big Match quando è disponibile.",
    "tip": "La somma dei punteggi della formazione determina i gol fantasy secondo il regolamento. A fine giornata trovi risultati, riepilogo e Fantapoints guadagnati."
  },
  {
    "icon": "💬",
    "title": "Scrivi ai tuoi giocatori",
    "text": "Nei Social puoi inviare messaggi ai calciatori della tua rosa. La loro reazione dipende da personalità, tono, rapporto e forma recente. La prima reazione della giornata può dare un piccolo bonus al voto, nessun effetto oppure un malus.",
    "tip": "Altri messaggi non sommano effetti. Una reazione negativa può portare al blocco immediato; insulti e messaggi ripetuti aumentano il rischio. Il blocco dura fino a fine stagione."
  },
  {
    "icon": "🛒",
    "title": "Valute, negozio e inventario",
    "text": "I crediti servono per acquistare giocatori. Euro e Fantapoints si usano nel negozio secondo la valuta indicata. Puoi comprare abbonamenti o consumabili e trovare nell’inventario ciò che hai a disposizione. Gli sponsor possono aiutarti durante la stagione.",
    "tip": "Prima di acquistare, leggi costo, durata ed effetto. Un abbonamento sblocca solo le funzioni indicate nella sua descrizione."
  },
  {
    "icon": "🔄",
    "title": "Mercato e stagioni successive",
    "text": "A gennaio puoi affrontare mercato, mini-asta e scambi. Le CPU valutano le proposte e possono chiedere un conguaglio. Dopo l’ultima giornata torna alla dashboard e premi Fine stagione per vedere il recap e continuare la carriera.",
    "tip": "Il primo viene promosso dalla Lega Amatoriale, C e B; l’ultimo di C, B e A retrocede. In Serie A ti aspetta Admin. Ricordati di salvare la carriera."
  }
];
  let step=0,origin=null;
  function render(){
    const p=pages[step],root=document.getElementById('gameGuide');
    root.querySelector('[data-guide-count]').textContent=`${step+1} / ${pages.length}`;
    root.querySelector('h2').textContent=`${p.icon} ${p.title}`;
    root.querySelector('[data-guide-text]').textContent=p.text;
    root.querySelector('[data-guide-tip]').textContent=p.tip;
    root.querySelector('[data-guide-prev]').disabled=step===0;
    root.querySelector('[data-guide-next]').textContent=step===pages.length-1?'HO CAPITO · CHIUDI':'HO CAPITO →';
    root.querySelector('[data-guide-content]').scrollTop=0;
  }
  function close(){document.getElementById('gameGuide')?.remove();document.body.classList.remove('game-guide-open');origin?.focus();}
  window.GameGuide={open(){
    if(document.getElementById('gameGuide'))return;
    origin=document.activeElement;step=0;
    const root=document.createElement('div');root.id='gameGuide';
    root.innerHTML=`<div class="game-guide-backdrop" data-guide-close></div><section role="dialog" aria-modal="true" aria-labelledby="gameGuideTitle" class="game-guide-dialog"><header><span>ISTRUZIONI <b data-guide-count></b></span><button type="button" data-guide-close aria-label="Chiudi istruzioni">✕</button></header><div data-guide-content class="game-guide-content"><h2 id="gameGuideTitle" tabindex="-1"></h2><p data-guide-text></p><aside data-guide-tip></aside></div><footer><button type="button" data-guide-prev>← INDIETRO</button><button type="button" data-guide-next>HO CAPITO →</button></footer></section>`;
    document.body.append(root);document.body.classList.add('game-guide-open');render();root.querySelector('h2').focus();
    root.addEventListener('click',e=>{
      const t=e.target.closest('button,[data-guide-close]');if(!t)return;
      if(t.hasAttribute('data-guide-close'))return close();
      if(t.hasAttribute('data-guide-next')&&step===pages.length-1)return close();
      if(t.hasAttribute('data-guide-prev'))step=Math.max(0,step-1);
      else if(t.hasAttribute('data-guide-next'))step++;
      else return;
      render();root.querySelector('h2').focus();
    });
  }};
  document.addEventListener('keydown',e=>{
    const root=document.getElementById('gameGuide');if(!root)return;
    if(e.key==='Escape'){e.preventDefault();close();}
    if(e.key==='Tab'){const items=[...root.querySelectorAll('button:not(:disabled)')],first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement.tagName==='H2')){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
})();
