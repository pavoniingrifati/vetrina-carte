'use strict';
const assert=require('node:assert');
const {initMobileUI}=require('../js/mobile-ui');
// DOM fixture checks original nodes/listeners survive mobile/desktop transitions.
class Element{
 constructor(tag='div',className=''){this.tag=tag;this.className=className;this.children=[];this.dataset={};this.attrs={};this.events={};this.classList={contains:name=>this.className.split(' ').includes(name)};}
 appendChild(node){if(node.parent)node.parent.children.splice(node.parent.children.indexOf(node),1);this.children.push(node);node.parent=this;return node;}
 insert(node,index){if(node.parent){const old=node.parent;old.children.splice(old.children.indexOf(node),1);}this.children.splice(index,0,node);node.parent=this;}
 before(node){this.parent.insert(node,this.parent.children.indexOf(this));}
 after(node){this.parent.insert(node,this.parent.children.indexOf(this)+1);}
 setAttribute(key,value){this.attrs[key]=value;}
 addEventListener(type,fn){(this.events[type]||=[]).push(fn);}
 click(target=this){for(const fn of this.events.click||[])fn({target});}
 scrollIntoView(){this.scrolled=true;}
 querySelector(selector){for(const node of this.children){if(node.classList.contains(selector.slice(1)))return node;const found=node.querySelector(selector);if(found)return found;}return null;}
 closest(selector){if(selector==='button:disabled')return this.disabled?this:null;if(selector.includes('[data-lineup-player]')&&(this.dataset.lineupPlayer||this.dataset.benchPlayer))return this;return this.parent?.closest(selector)||null;}
}
const root=new Element(),lineup=new Element(),live=new Element(),layout=new Element('div','lineup-layout');
const help=new Element('div','lineup-pitch-help');lineup.appendChild(layout);lineup.appendChild(help);root.appendChild(lineup);root.appendChild(live);
const wrap=new Element(),top=new Element('section','seriea-live-top-grid'),article=new Element(),bar=new Element('div','fantasy-live-compact-bar'),duals=new Element('div','seriea-dual-lineups');
live.appendChild(wrap);wrap.appendChild(top);top.appendChild(article);article.appendChild(bar);article.appendChild(duals);
const side=new Element('aside','auction-room-side');root.appendChild(side);const keeper=new Element('button');side.appendChild(keeper);let calls=0;keeper.addEventListener('click',()=>calls++);
const media={matches:true,addEventListener(type,fn){this.listener=fn;}};
const doc={createElement:tag=>new Element(tag),createComment:()=>new Element('comment'),getElementById:id=>({lineupScreen:lineup,serieALiveScreen:live}[id]),querySelectorAll:()=>[side]};
initMobileUI(doc,{matchMedia:()=>media});
const lineupNav=lineup.querySelector('.mobile-section-tabs'),liveNav=live.querySelector('.mobile-section-tabs'),toolbar=live.querySelector('.mobile-live-toolbar');
assert.equal(lineup.dataset.mobileView,'pitch');lineupNav.children[1].click();assert.equal(lineup.dataset.mobileView,'roster');
const player=new Element('button');player.dataset.lineupPlayer='123';lineup.click(player);assert.equal(lineup.dataset.mobileView,'pitch');assert(lineupNav.scrolled);
lineupNav.children[2].click();player.disabled=true;lineup.click(player);assert.equal(lineup.dataset.mobileView,'bench');
liveNav.children[2].click();assert.equal(live.dataset.mobileView,'matches');assert.equal(liveNav.children[2].attrs['aria-pressed'],'true');
assert.equal(bar.parent,toolbar);assert.equal(liveNav.parent,toolbar);assert.equal(side.parent.open,false);keeper.click();assert.equal(calls,1);
media.matches=false;media.listener();assert.equal(bar.parent,article);assert.equal(liveNav.parent,article);assert.equal(side.parent.open,true);keeper.click();assert.equal(calls,2);
media.matches=true;media.listener();assert.equal(bar.parent,toolbar);assert.equal(side.parent.open,false);assert(help.textContent.includes('Tocca'));
console.log('OK: schede mobile, selezione touch, controlli bloccati, risultato persistente e ritorno desktop senza perdere i controlli.');
