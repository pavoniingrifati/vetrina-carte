/* Responsive composition uses declared regions; data comes from presentation state. */
(function(){
'use strict';
const instances=new WeakMap();
function initMobileAuction(document,window){
 const screen=document.getElementById('auctionScreen');if(!screen)return null;
 if(instances.has(screen))return instances.get(screen);
 const phone=window.matchMedia('(max-width:780px), (max-width:1024px) and (pointer:coarse)');
 const locations=window.FantaMobileLocations.create(document);
 const regions=Array.from(screen.querySelectorAll('[data-mobile-auction-region]'));
 const bottom=screen.querySelector('[data-mobile-anchor="auction-controls"]');
 const passLabel=screen.querySelector('[data-mobile-pass-label]');
 const header=document.createElement('header');header.className='mobile-auction-hud';
 header.innerHTML='<div><small>I TUOI CREDITI</small><strong data-auction-budget></strong></div><div><small>ROSA</small><strong data-auction-slots></strong></div><button type="button">SALVA</button><small class="mobile-auction-role-need"></small>';
 header.querySelector('button').addEventListener('click',()=>document.getElementById('saveBtn')?.click());
 const budget=header.querySelector('[data-auction-budget]'),slots=header.querySelector('[data-auction-slots]'),roleNeed=header.querySelector('.mobile-auction-role-need');
 const nav=document.createElement('nav');nav.className='mobile-auction-pages';nav.setAttribute('aria-label','Sezioni asta');
 const pages={},buttons={},moves=[];
 function select(view){screen.dataset.auctionView=view;Object.entries(buttons).forEach(([key,b])=>b.setAttribute('aria-pressed',String(key===view)));}
 for(const [key,label] of [['bid','Asta'],['roster','Rosa'],['league','Lega'],['history','Storico']]){
  const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>select(key));nav.appendChild(b);buttons[key]=b;
  if(key!=='bid'){const page=document.createElement('section');page.className='mobile-auction-page';page.dataset.auctionPage=key;page.setAttribute('aria-label',label);screen.appendChild(page);pages[key]=page;}
 }
 screen.prepend(header,nav);screen.classList.add('mobile-auction-app');select('bid');
 for(const node of regions){const page=node.dataset.mobileAuctionRegion;if(pages[page])moves.push({node,page,location:locations.register(node),originalOpen:node.open});}
 const dock=document.createElement('div');dock.className='mobile-auction-dock';screen.appendChild(dock);
 const controls=locations.register(bottom);
 let previousPhase;
 function sync(model){
  budget.textContent=model?String(model.budget):'—';
  slots.textContent=model?`${model.filledSlots} / ${model.totalSlots}`:'0 / 25';
  roleNeed.textContent=model?model.roles.map(r=>`${r.role} ${r.count}/${r.limit}`).join(' · '):'';
  const phase=model?.phase||'nomination';screen.dataset.auctionPhase=phase==='live'?'live':'nomination';
  buttons.bid.textContent=model?.canBid?'Asta •':'Asta';
  if(phone.matches&&previousPhase!==undefined&&phase!==previousPhase)select('bid');
  previousPhase=phase;
 }
 function adapt(){
  if(phone.matches)controls?.moveTo(dock);else controls?.restore();
  if(passLabel)passLabel.textContent=phone.matches?'LASCIA':'PASSA';
  for(const move of moves){
   if(phone.matches){move.location.moveTo(pages[move.page]);if(move.node.tagName==='DETAILS')move.node.open=true;}
   else{move.location.restore();if(move.node.tagName==='DETAILS')move.node.open=move.originalOpen;}
  }
 }
 const unsubscribe=window.FantaPresentationState.subscribeAuction(sync);
 let destroyed=false;
 const instance=Object.freeze({adapt,destroy(){
  if(destroyed)return;destroyed=true;unsubscribe();phone.removeEventListener('change',adapt);locations.releaseAll();
  if(passLabel)passLabel.textContent='PASSA';
  for(const move of moves)if(move.node.tagName==='DETAILS')move.node.open=move.originalOpen;
  header.remove();nav.remove();dock.remove();for(const page of Object.values(pages))page.remove();
  screen.classList.remove('mobile-auction-app');delete screen.dataset.auctionView;delete screen.dataset.auctionPhase;instances.delete(screen);
 }});
 instances.set(screen,instance);phone.addEventListener('change',adapt);adapt();return instance;
}
if(typeof module==='object'&&module.exports)module.exports={initMobileAuction};
else{
 window.FantaMobileAuction=Object.freeze({init:initMobileAuction});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>initMobileAuction(document,window),{once:true});
 else initMobileAuction(document,window);
}
})();
