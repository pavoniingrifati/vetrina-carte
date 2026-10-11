'use strict';
const assert=require('node:assert/strict');const locations=require('../js/mobile-locations');const presentation=require('../js/presentation-state');const {initMobileAuction}=require('../js/mobile-auction-app');
class Node{
 constructor(tag='div',className='',id=''){this.tagName=tag.toUpperCase();this.className=className;this.id=id;this.children=[];this.dataset={};this.attrs={};this.listeners={};this.textContent='';this.classList={contains:c=>this.className.split(' ').includes(c),add:c=>{if(!this.classList.contains(c))this.className+=' '+c;},remove:c=>{this.className=this.className.split(' ').filter(x=>x!==c).join(' ');}};}
 get parentNode(){return this.parent;}get previousSibling(){return this.parent?.children[this.parent.children.indexOf(this)-1]||null;}
 remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
 set innerHTML(s){this.children=[];if(s.includes('data-auction-budget')){this.appendChild(new Node('strong','budget'));this.children[0].attrs['data-auction-budget']='';this.appendChild(new Node('strong','slots'));this.children[1].attrs['data-auction-slots']='';this.appendChild(new Node('button'));this.appendChild(new Node('small','mobile-auction-role-need'));}}
 appendChild(n){if(n.parent)n.parent.children.splice(n.parent.children.indexOf(n),1);this.children.push(n);n.parent=this;return n;}
 insert(n,i){if(n.parent)n.parent.children.splice(n.parent.children.indexOf(n),1);this.children.splice(i,0,n);n.parent=this;}
 before(n){this.parent.insert(n,this.parent.children.indexOf(this));}after(n){this.parent.insert(n,this.parent.children.indexOf(this)+1);}
 prepend(...nodes){nodes.reverse().forEach(n=>this.insert(n,0));}
 setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,f){this.listeners[k]=f;}click(){this.listeners.click?.();}
 matches(s){if(s.startsWith('[')){const match=s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);const key=match[1].replace(/^data-/,'').replace(/-([a-z])/g,(_all,c)=>c.toUpperCase());const value=match[1].startsWith('data-')?this.dataset[key]??this.attrs[match[1]]:this.attrs[match[1]];return value!==undefined&&(match[2]===undefined||String(value)===match[2]);}return s.startsWith('.')?this.classList.contains(s.slice(1)):s.startsWith('[')?s.slice(1,-1) in this.attrs:this.tagName===s.toUpperCase();}
 closest(s){return this.matches(s)?this:this.parent?.closest(s)||null;}
 querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}querySelector(s){return this.querySelectorAll(s)[0]||null;}
}
const screen=new Node('section','','auctionScreen'),layout=screen.appendChild(new Node('div','auction-layout')),roster=layout.appendChild(new Node('aside','legacy-roster-panel')),live=layout.appendChild(new Node('div','hidden','liveAuction'));
const leagueFold=screen.appendChild(new Node('details','mobile-auction-fold')),league=leagueFold.appendChild(new Node('section','league-room'));
const roomFold=live.appendChild(new Node('details','mobile-auction-fold'));roomFold.appendChild(new Node('aside','auction-room-side'));
const history=live.appendChild(new Node('details','auction-history')),recent=live.appendChild(new Node('div','recent-bids-wrap'));const tools=screen.appendChild(new Node('div','test-panel'));
const ids={auctionScreen:screen,liveAuction:live};for(const [id,value] of [['myBudget','325'],['mySlots','4 / 25'],['roleNeed','P 1/3 · D 2/8 · C 1/8 · A 0/6']]){const n=roster.appendChild(new Node('span','',id));n.textContent=value;ids[id]=n;}
const bottom=live.appendChild(new Node('div','auction-bottom-row'));
ids.userBidControls=bottom.appendChild(new Node('div','hidden','userBidControls'));ids.passBtn=ids.userBidControls.appendChild(new Node('button','','passBtn'));ids.passBtn.appendChild(new Node('strong')).textContent='PASSA';let passes=0;ids.passBtn.addEventListener('click',()=>passes++);
let saves=0;ids.saveBtn=new Node('button');ids.saveBtn.addEventListener('click',()=>saves++);

for(const [node,region] of [[roster,'roster'],[leagueFold,'league'],[roomFold,'league'],[history,'history'],[recent,'history'],[tools,'history']])node.dataset.mobileAuctionRegion=region;
bottom.dataset.mobileAnchor='auction-controls';ids.passBtn.querySelector('strong').attrs['data-mobile-pass-label']='';
leagueFold.open=roomFold.open=true;history.open=false;
const media={matches:true,addEventListener(type,f){this.change=f;},removeEventListener(){this.change=null;}};
const doc={getElementById:id=>ids[id]||null,createElement:tag=>new Node(tag),createComment:()=>new Node('comment')};
const bus=presentation.create(),window={matchMedia:()=>media,FantaMobileLocations:locations,FantaPresentationState:bus};
const state={managers:[{budget:325,roster:[{role:'P'},{role:'D'},{role:'D'},{role:'C'}]}],auction:null};const rules={totalSlots:25,roleLimits:{P:3,D:8,C:8,A:6}};
bus.publishAuction(state,rules);const instance=initMobileAuction(doc,window);assert.equal(initMobileAuction(doc,window),instance,'Idempotent initialization');
assert.equal(screen.dataset.auctionView,'bid');assert.equal(roster.parent.dataset.auctionPage,'roster');assert.equal(leagueFold.parent.dataset.auctionPage,'league');assert.equal(history.parent.dataset.auctionPage,'history');assert.equal(recent.parent,history.parent);assert.equal(tools.parent,history.parent);
const dock=screen.querySelector('.mobile-auction-dock');assert.equal(dock.parent,screen);assert.equal(bottom.parent,dock);assert.equal(ids.userBidControls.parent,bottom);
const hud=screen.querySelector('.mobile-auction-hud'),nav=screen.querySelector('.mobile-auction-pages');assert.equal(hud.querySelector('[data-auction-budget]').textContent,'325');assert.equal(hud.querySelector('.mobile-auction-role-need').textContent,'P 1/3 · D 2/8 · C 1/8 · A 0/6');hud.querySelector('button').click();assert.equal(saves,1);
nav.children[2].click();bus.publishAuction(state,rules);assert.equal(screen.dataset.auctionView,'league','Same phase preserves chosen page');
state.auction={playerId:'test'};bus.publishAuction(state,{...rules,userCanAct:true});assert.equal(screen.dataset.auctionView,'bid');assert.equal(nav.children[0].textContent,'Asta •');
ids.myBudget.textContent='TESTO LOCALIZZATO';state.managers[0].budget=299;bus.publishAuction(state,rules);assert.equal(hud.querySelector('[data-auction-budget]').textContent,'299','Reads state, not desktop text');
assert.equal(ids.passBtn.querySelector('strong').textContent,'LASCIA');ids.passBtn.click();assert.equal(passes,1);
for(let i=0;i<3;i++){
 media.matches=false;media.change();assert.equal(bottom.parent,live);assert.equal(roster.parent,layout);assert.equal(history.parent,live);assert.equal(leagueFold.parent,screen);assert.equal(ids.passBtn.querySelector('strong').textContent,'PASSA');
 media.matches=true;media.change();assert.equal(roster.parent.dataset.auctionPage,'roster');assert.equal(doc.getElementById('passBtn'),ids.passBtn);assert.equal(bottom.parent,dock);
}
ids.passBtn.click();assert.equal(passes,2);nav.children[1].click();state.auction=null;bus.publishAuction(state,rules);assert.equal(screen.dataset.auctionPhase,'nomination');assert.equal(screen.dataset.auctionView,'bid');
instance.destroy();instance.destroy();assert.equal(bottom.parent,live);assert.equal(roster.parent,layout);assert.equal(history.parent,live);assert.equal(history.open,false);assert.equal(screen.querySelector('.mobile-auction-hud'),null);assert.equal(ids.passBtn.querySelector('strong').textContent,'PASSA');
const second=initMobileAuction(doc,window);assert.notEqual(second,instance);assert.equal(bottom.parent,screen.querySelector('.mobile-auction-dock'));second.destroy();
console.log('OK: declared mobile regions, state-driven HUD, repeated resize, original handlers, teardown and remount.');
