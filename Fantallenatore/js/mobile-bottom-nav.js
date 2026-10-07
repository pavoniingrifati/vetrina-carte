/* Mobile career navigation reuses the existing screen actions. */
(function(){
 'use strict';
 function init(){
  const nav=document.createElement('nav');
  nav.className='mobile-bottom-nav';nav.setAttribute('aria-label','Navigazione principale');
  const paths={home:'M2 11 12 2l10 9h-3v11h-5v-7h-4v7H5V11z',rosters:'M9 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8M2 22v-6a7 7 0 0 1 14 0v6M18 4a3 3 0 0 1 0 6m0 3a5 5 0 0 1 4 5v4',standings:'M7 2h10v8a5 5 0 0 1-10 0zM7 4H3v4a4 4 0 0 0 4 4m10-8h4v4a4 4 0 0 1-4 4m-5 3v5m-5 2h10',shop:'M2 3h3l3 12h11l3-9H6m3 14h1m8 0h1',menu:'M3 5h18M3 12h18M3 19h18'};
  const menu=document.createElement('div');menu.className='mobile-bottom-menu';menu.hidden=true;menu.id='mobileCareerMenu';
  function route(target){
   menu.hidden=true;menuButton.setAttribute('aria-expanded','false');
   const active=document.querySelector('.screen.active');
   const source=active?.querySelector('[data-league-nav="'+target+'"]')||document.querySelector('#seasonScreen [data-league-nav="'+target+'"]');
   source?.click();window.scrollTo({top:0,behavior:'auto'});sync();
  }
  let menuButton;
  [['dashboard','Home','home'],['rosters','Rosa','rosters'],['standings','Campionato','standings'],['shop','Negozio','shop'],['menu','Menu','menu']].forEach(([target,label,icon])=>{
   const button=document.createElement('button');button.type='button';button.dataset.bottomNav=target;
   button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[icon]+'"/></svg><span>'+label+'</span>';
   if(target==='menu'){
    menuButton=button;button.setAttribute('aria-controls',menu.id);button.setAttribute('aria-expanded','false');
    button.addEventListener('click',()=>{menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));});
   }else button.addEventListener('click',()=>route(target));
   nav.appendChild(button);
  });
  [['calendar','Calendario'],['datacenter','DataCenter'],['social','Social'],['evolution','Evoluzione']].forEach(([target,label])=>{
   const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>route(target));menu.appendChild(button);
  });
  const main=document.createElement('button');main.type='button';main.textContent='Menu principale';main.addEventListener('click',()=>{menu.hidden=true;menuButton.setAttribute('aria-expanded','false');document.getElementById('backToAuctionSummaryBtn')?.click();});menu.appendChild(main);
  document.body.appendChild(menu);document.body.appendChild(nav);
  function sync(){
   const screen=document.querySelector('.screen.active');
   const enabled=!!screen&&(screen.id==='seasonScreen'||screen.classList.contains('league-subscreen'));
   document.body.classList.toggle('has-mobile-career-nav',enabled);
   if(!enabled){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');}
   const active=screen?.querySelector('.league-nav [aria-current="page"]')?.dataset.leagueNav;
   nav.querySelectorAll('button').forEach(button=>{
    const current=button.dataset.bottomNav===active||(button===menuButton&&['calendar','datacenter','social','evolution'].includes(active));
    button.classList.toggle('active',current);if(current)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
   });
  }
  document.querySelectorAll('.screen').forEach(screen=>new MutationObserver(sync).observe(screen,{attributes:true,attributeFilter:['class']}));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');}});
  document.addEventListener('click',event=>{if(!menu.contains(event.target)&&!nav.contains(event.target)){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');}});
  sync();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
