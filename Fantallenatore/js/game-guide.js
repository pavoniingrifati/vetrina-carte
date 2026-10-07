(() => {
  'use strict';
  const pages=[
    {icon:'🏆',title:'La tua carriera',text:'Crea il fantallenatore, scegli l’avatar e dai un nome alla squadra. Puoi iniziare con il listone classico oppure attivare il campionato Pokémon.',tip:'Rose pronte genera le squadre e ti permette di saltare l’asta.',choices:['Iniziare dall’asta','Saltare con Rose pronte'],answer:0,question:'Vuoi scegliere personalmente ogni acquisto: quale percorso usi?',feedback:'Inizia dall’asta per costruire personalmente la rosa.'},
    {icon:'🔨',title:'Costruisci la rosa',text:'Affronti 9 CPU con 500 crediti. Devi completare 25 posti: 3 portieri, 8 difensori, 8 centrocampisti e 6 attaccanti. Chiama, rilancia oppure passa. Conserva crediti per i posti ancora liberi.',tip:'Di norma l’asta procede per reparto. Dalla Serie C una regola può permettere chiamate in qualunque ruolo.',choices:['Spendere tutto sul primo top','Tenere crediti per completare la rosa'],answer:1,question:'Come eviti di restare senza crediti per gli ultimi posti?',feedback:'Devi poter pagare almeno 1 credito per ogni posto ancora libero.'},
    {icon:'⚡',title:'I Fantapoteri dell’asta',text:'Prima dell’asta hai 3 slot. Blocco, Scout e Bluff occupano uno slot ciascuno. Osservatore e One Shot occupano tutti e tre: scegli un potere esclusivo oppure la combinazione dei tre poteri singoli.',tip:'Leggi la descrizione di ogni potere nella selezione: slot e utilizzi sono indicati sulla carta.',choices:['Sì, insieme','No, Osservatore occupa 3 slot'],answer:1,question:'Puoi scegliere Osservatore e Bluff insieme?',feedback:'Osservatore occupa tutti i 3 slot disponibili.'},
    {icon:'📋',title:'Prepara la giornata',text:'Consulta le regole Admin e gli eventi, poi scegli modulo, titolari, panchina e capitano. Conferma la formazione prima di giocare. Gli esperti suggeriscono giocatori, ma possono sbagliare anche con Esperti Pro.',tip:'Un SV può essere sostituito dalla panchina secondo ruoli e cambi consentiti. Mantieni formazione conserva anche il capitano.',choices:['È un bonus garantito','È un consiglio fallibile'],answer:1,question:'Il Visionario consiglia un gol: cosa significa?',feedback:'È una previsione: il consiglio non garantisce un gol.'},
    {icon:'⚽',title:'Segui il campionato',text:'In Diretta Gol segui risultati, voti, bonus e malus. I Fantapunti determinano il risultato fantasy secondo le soglie del regolamento. Dopo la giornata trovi il riepilogo e i Fantapoints guadagnati.',tip:'Crediti per il mercato, euro per il negozio e Fantapoints sono tre risorse diverse. Controlla la valuta richiesta prima di acquistare.',choices:['Il risultato fantasy','Il prezzo pagato all’asta'],answer:0,question:'A cosa servono voti, bonus e malus della giornata?',feedback:'Entrano nel calcolo dei Fantapunti e del risultato fantasy.'},
    {icon:'🔄',title:'Mercato e nuove stagioni',text:'A gennaio arrivano mercato, mini-asta e scambi. La CPU valuta i giocatori e può chiedere un conguaglio. Alla fine dell’ultima giornata torna alla dashboard e scegli Fine stagione per il recap.',tip:'La carriera prosegue da Lega Amatoriale a Serie C, B e A. Il primo sale, l’ultimo di C, B e A scende. In Serie A incontrerai Admin. Ricordati di salvare.',choices:['Torno alla dashboard → Fine stagione','Devo iniziare subito un’asta'],answer:0,question:'Dove apri il recap conclusivo del campionato?',feedback:'Il pulsante Fine stagione si trova sulla dashboard.'}
  ];
  let step=0,origin=null;
  function render(){
    const p=pages[step],root=document.getElementById('gameGuide');
    root.querySelector('[data-guide-tabs]').innerHTML=pages.map((x,i)=>`<button type="button" data-guide-page="${i}" aria-current="${i===step?'step':'false'}">${i+1}. ${x.title}</button>`).join('');
    root.querySelector('[data-guide-count]').textContent=`${step+1} / ${pages.length}`;
    root.querySelector('h2').textContent=`${p.icon} ${p.title}`;
    root.querySelector('[data-guide-text]').textContent=p.text;
    root.querySelector('[data-guide-tip]').textContent=p.tip;
    root.querySelector('[data-guide-question]').textContent=p.question;
    root.querySelector('[data-guide-choices]').innerHTML=p.choices.map((x,i)=>`<button type="button" data-guide-answer="${i}">${x}</button>`).join('');
    root.querySelector('[data-guide-feedback]').textContent='';
    root.querySelector('[data-guide-prev]').disabled=step===0;
    root.querySelector('[data-guide-next]').textContent=step===pages.length-1?'HO CAPITO ✓':'CONTINUA →';
    root.querySelector('[data-guide-content]').scrollTop=0;
  }
  function close(){document.getElementById('gameGuide')?.remove();document.body.classList.remove('game-guide-open');origin?.focus();}
  window.GameGuide={open(){
    if(document.getElementById('gameGuide'))return;
    origin=document.activeElement;step=0;
    const root=document.createElement('div');root.id='gameGuide';
    root.innerHTML=`<div class="game-guide-backdrop" data-guide-close></div><section role="dialog" aria-modal="true" aria-labelledby="gameGuideTitle" class="game-guide-dialog"><header><span>GUIDA INTERATTIVA <b data-guide-count></b></span><button type="button" data-guide-close aria-label="Chiudi istruzioni">✕</button></header><nav aria-label="Argomenti" data-guide-tabs></nav><div data-guide-content class="game-guide-content"><h2 id="gameGuideTitle" tabindex="-1"></h2><p data-guide-text></p><aside data-guide-tip></aside><div class="game-guide-practice"><h3>PROVA TU</h3><p data-guide-question></p><div data-guide-choices></div><p role="status" data-guide-feedback></p></div></div><footer><button type="button" data-guide-prev>← INDIETRO</button><button type="button" data-guide-next>CONTINUA →</button></footer></section>`;
    document.body.append(root);document.body.classList.add('game-guide-open');render();root.querySelector('[data-guide-close][aria-label]').focus();
    root.addEventListener('click',e=>{
      const t=e.target.closest('button,[data-guide-close]');if(!t)return;
      if(t.hasAttribute('data-guide-close'))return close();
      if(t.hasAttribute('data-guide-answer')){const correct=Number(t.dataset.guideAnswer)===pages[step].answer;root.querySelector('[data-guide-feedback]').textContent=`${correct?'✓ Esatto!':'Riprova:'} ${pages[step].feedback}`;return;}
      if(t.hasAttribute('data-guide-next')&&step===pages.length-1)return close();
      if(t.hasAttribute('data-guide-page'))step=Number(t.dataset.guidePage);
      else if(t.hasAttribute('data-guide-prev'))step=Math.max(0,step-1);
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
