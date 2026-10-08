/* Build 176: mobile navigation keeps the original gameplay controls and IDs. */
(function(){
  'use strict';
  function initMobileUI(document,window){
    const phone=window.matchMedia('(max-width:780px), (max-width:1024px) and (pointer:coarse)');
    const folders=[];
    function tabs(screen,anchor,choices,initial){
      if(!screen||!anchor)return null;
      const nav=document.createElement('nav');
      nav.className='mobile-section-tabs';nav.setAttribute('aria-label','Sezioni della schermata');
      const buttons=choices.map(([view,label])=>{
        const button=document.createElement('button');button.type='button';button.textContent=label;
        button.dataset.mobileView=view;
        button.addEventListener('click',()=>select(view));nav.appendChild(button);return button;
      });
      function select(view){
        screen.dataset.mobileView=view;
        buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mobileView===view)));
      }
      anchor.before(nav);select(initial);return {select,nav};
    }
    const lineup=document.getElementById('lineupScreen');
    const lineupTabs=tabs(lineup,lineup?.querySelector('.lineup-layout'),[['pitch','Campo'],['roster','Rosa'],['bench','Panchina']],'pitch');
    lineup?.addEventListener('click',event=>{
      if(phone.matches&&event.target.closest('[data-lineup-player], [data-bench-player]')&&!event.target.closest('button:disabled')){
        lineupTabs?.select('pitch');
        // The existing click handler selects the player before this delegated handler.
        lineupTabs?.nav.scrollIntoView({block:'start',behavior:'auto'});
      }
    });
    const live=document.getElementById('serieALiveScreen');
    const liveTabs=tabs(live,live?.querySelector('.seriea-dual-lineups'),[['duel','Voti'],['matches','Campi'],['feed','Cronaca']],'duel');
    document.querySelectorAll('#auctionScreen .auction-room-side, #auctionScreen .league-room').forEach(panel=>{
      const fold=document.createElement('details');fold.className='mobile-auction-fold';
      const summary=document.createElement('summary');
      summary.textContent=panel.classList.contains('league-room')?'Rose e crediti della lega':'Rivali e crediti';
      panel.before(fold);fold.appendChild(summary);fold.appendChild(panel);
      folders.push(fold);
    });
    const bar=live?.querySelector('.fantasy-live-compact-bar');
    let toolbar,barMarker,tabsMarker;
    if(bar&&liveTabs){
      toolbar=document.createElement('div');toolbar.className='mobile-live-toolbar';
      barMarker=document.createComment('score original position');bar.before(barMarker);
      tabsMarker=document.createComment('tabs original position');liveTabs.nav.before(tabsMarker);
      live.querySelector('.seriea-live-top-grid').before(toolbar);
    }
    const help=lineup?.querySelector('.lineup-pitch-help');
    function adapt(){
      folders.forEach(fold=>{fold.open=!phone.matches;});
      if(toolbar){
        if(phone.matches){toolbar.appendChild(bar);toolbar.appendChild(liveTabs.nav);}
        else{barMarker.after(bar);tabsMarker.after(liveTabs.nav);}
      }
      if(help)help.textContent=phone.matches?'Tocca Rosa o Panchina, scegli un giocatore, poi tocca una posizione illuminata sul campo.':'Trascina un giocatore sul campo oppure selezionalo dalla rosa e clicca una posizione illuminata.';
    }
    phone.addEventListener('change',adapt);adapt();
  }
  if(typeof module==='object'&&module.exports)module.exports={initMobileUI};
  else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>initMobileUI(document,window),{once:true});
  else initMobileUI(document,window);
})();
