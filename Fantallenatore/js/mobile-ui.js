/* Build 176: mobile navigation keeps the original gameplay controls and IDs. */
(function(){
  'use strict';
  const instances=new WeakMap();
  function initMobileUI(document,window){
    if(instances.has(document))return instances.get(document);
    const locations=window.FantaMobileLocations.create(document);
    const phone=window.matchMedia('(max-width:780px), (max-width:1024px) and (pointer:coarse)');
    const folders=Array.from(document.querySelectorAll('#auctionScreen .mobile-auction-fold'));
    const originalOpen=folders.map(fold=>fold.open);
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
    const lineupTabs=tabs(lineup,lineup?.querySelector('[data-mobile-anchor="lineup-sections"]'),[['pitch','Campo'],['roster','Rosa'],['bench','Panchina']],'pitch');
    const onPlayerSelect=event=>{
      if(phone.matches&&event.target.closest('[data-lineup-player], [data-bench-player]')&&!event.target.closest('button:disabled')){
        lineupTabs?.select('pitch');
        // The existing click handler selects the player before this delegated handler.
        lineupTabs?.nav.scrollIntoView({block:'start',behavior:'auto'});
      }
    };
    lineup?.addEventListener('click',onPlayerSelect);
    const live=document.getElementById('serieALiveScreen');
    const liveTabs=tabs(live,live?.querySelector('[data-mobile-anchor="live-sections"]'),[['duel','Voti'],['matches','Campi'],['feed','Cronaca']],'duel');
    const bar=live?.querySelector('[data-mobile-anchor="live-score"]');
    let toolbar,barLocation,tabsLocation;
    if(bar&&liveTabs){
      toolbar=document.createElement('div');toolbar.className='mobile-live-toolbar';
      barLocation=locations.register(bar);tabsLocation=locations.register(liveTabs.nav);
      live.querySelector('[data-mobile-anchor="live-content"]').before(toolbar);
    }
    const help=lineup?.querySelector('[data-mobile-anchor="lineup-help"]');const originalHelp=help?.textContent;
    function adapt(){
      folders.forEach(fold=>{fold.open=!phone.matches;});
      if(toolbar){
        if(phone.matches){barLocation.moveTo(toolbar);tabsLocation.moveTo(toolbar);}
        else{barLocation.restore();tabsLocation.restore();}
      }
      if(help)help.textContent=phone.matches?'Tocca Rosa o Panchina, scegli un giocatore, poi tocca una posizione illuminata sul campo.':'Trascina un giocatore sul campo oppure selezionalo dalla rosa e clicca una posizione illuminata.';
    }
    let destroyed=false;
    const instance=Object.freeze({adapt,destroy(){if(destroyed)return;destroyed=true;phone.removeEventListener('change',adapt);lineup?.removeEventListener('click',onPlayerSelect);locations.releaseAll();if(help)help.textContent=originalHelp;if(lineup)delete lineup.dataset.mobileView;if(live)delete live.dataset.mobileView;toolbar?.remove();lineupTabs?.nav.remove();liveTabs?.nav.remove();folders.forEach((fold,i)=>fold.open=originalOpen[i]);instances.delete(document);}});
    instances.set(document,instance);phone.addEventListener('change',adapt);adapt();return instance;
  }
  if(typeof module==='object'&&module.exports)module.exports={initMobileUI};
  else{window.FantaMobileUI=Object.freeze({init:initMobileUI});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>initMobileUI(document,window),{once:true});else initMobileUI(document,window);}
})();
