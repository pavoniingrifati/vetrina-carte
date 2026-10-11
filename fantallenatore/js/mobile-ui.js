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
    const icons={pitch:'<path d="M3 4h18v16H3zM12 4v16"/><circle cx="12" cy="12" r="3"/>',roster:'<circle cx="9" cy="6" r="3"/><path d="M3 21v-6a6 6 0 0 1 12 0v6M18 4v6M15 7h6"/>',bench:'<path d="M3 10h18v6H3zM6 16v5M18 16v5M5 10V5h14v5"/>',home:'<path d="M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10"/>',overview:'<path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7"/>',players:'<circle cx="9" cy="6" r="3"/><path d="M3 21v-6a6 6 0 0 1 12 0v6M18 3v6M15 6h6"/>',evolution:'<path d="M3 19 9 13l4 3 8-12M15 4h6v6"/>'};
    function addIcon(button,key){button.insertAdjacentHTML?.('afterbegin',`<svg data-mobile-tab-icon viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">${icons[key]||icons.overview}</svg>`);}
    let lineupLocation;
    if(lineupTabs){lineupTabs.nav.className+=' mobile-bottom-sections';lineupTabs.nav.setAttribute('aria-label','Navigazione formazione');for(const button of lineupTabs.nav.children)addIcon(button,button.dataset.mobileView);lineupLocation=locations.register(lineupTabs.nav);}
    const dataCenter=document.getElementById('leagueDataCenterScreen');
    const dataTabs=dataCenter?.querySelector('.datacenter-tabs');
    let dataDock,dataLocation;
    if(dataTabs){
      dataDock=document.createElement('nav');dataDock.className='mobile-bottom-sections mobile-datacenter-bottom-nav';dataDock.setAttribute('aria-label','Navigazione DataCenter');
      const home=document.createElement('button');home.type='button';home.textContent='Home';addIcon(home,'home');home.onclick=()=>dataCenter.querySelector('[data-league-nav="dashboard"]')?.click();dataDock.appendChild(home);
      for(const button of dataTabs.children)addIcon(button,button.dataset.datacenterTab);
      dataCenter.appendChild(dataDock);dataLocation=locations.register(dataTabs);
    }
    const onPlayerSelect=event=>{
      if(phone.matches&&event.target.closest('[data-lineup-player], [data-bench-player]')&&!event.target.closest('button:disabled')){
        lineupTabs?.select('pitch');
        // The existing click handler selects the player before this delegated handler.
        lineup?.querySelector('[data-mobile-anchor="lineup-sections"]')?.scrollIntoView({block:'start',behavior:'auto'});
      }
    };
    lineup?.addEventListener('click',onPlayerSelect);
    const live=document.getElementById('serieALiveScreen');
    const liveTabs=tabs(live,live?.querySelector('[data-mobile-anchor="live-sections"]'),[['duel','Voti'],['matches','Campi'],['feed','Cronaca']],'duel');
    if(liveTabs){
      liveTabs.nav.className+=' mobile-live-bottom-nav';
      liveTabs.nav.setAttribute('aria-label','Navigazione Diretta Gol');
      const icons={
        duel:'<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h3M8 18h3"/>',
        matches:'<path d="M3 4h18v16H3zM12 4v16M3 9h4v6H3M21 9h-4v6h4"/><circle cx="12" cy="12" r="3"/>',
        feed:'<path d="M3 3h18v14H8l-5 4zM7 7h10M7 11h10"/>'
      };
      for(const button of liveTabs.nav.children){
        button.insertAdjacentHTML?.('afterbegin',`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">${icons[button.dataset.mobileView]}</svg>`);
      }
    }
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
      if(lineupLocation){if(phone.matches)lineupLocation.moveTo(lineup);else lineupLocation.restore();}
      if(dataLocation){if(phone.matches)dataLocation.moveTo(dataDock);else dataLocation.restore();}
      if(toolbar){
        if(phone.matches){barLocation.moveTo(toolbar);tabsLocation.moveTo(live);}
        else{barLocation.restore();tabsLocation.restore();}
      }
      if(help)help.textContent=phone.matches?'Tocca Rosa o Panchina, scegli un giocatore, poi tocca una posizione illuminata sul campo.':'Trascina un giocatore sul campo oppure selezionalo dalla rosa e clicca una posizione illuminata.';
    }
    let destroyed=false;
    const instance=Object.freeze({adapt,destroy(){if(destroyed)return;destroyed=true;phone.removeEventListener('change',adapt);lineup?.removeEventListener('click',onPlayerSelect);locations.releaseAll();if(help)help.textContent=originalHelp;if(lineup)delete lineup.dataset.mobileView;if(live)delete live.dataset.mobileView;toolbar?.remove();dataTabs?.querySelectorAll('[data-mobile-tab-icon]').forEach(icon=>icon.remove());dataDock?.remove();lineupTabs?.nav.remove();liveTabs?.nav.remove();folders.forEach((fold,i)=>fold.open=originalOpen[i]);instances.delete(document);}});
    instances.set(document,instance);phone.addEventListener('change',adapt);adapt();return instance;
  }
  if(typeof module==='object'&&module.exports)module.exports={initMobileUI};
  else{window.FantaMobileUI=Object.freeze({init:initMobileUI});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>initMobileUI(document,window),{once:true});else initMobileUI(document,window);}
})();
