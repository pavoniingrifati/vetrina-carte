'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

class FakeClassList {
  constructor(){ this.values = new Set(); }
  add(...names){ names.forEach(n => this.values.add(n)); }
  remove(...names){ names.forEach(n => this.values.delete(n)); }
  contains(name){ return this.values.has(name); }
  toString(){ return [...this.values].join(' '); }
}

class FakeStyle {
  constructor(){ this.map = new Map(); }
  setProperty(k,v){ this.map.set(k,String(v)); }
  removeProperty(k){ this.map.delete(k); }
  get display(){ return this.map.get('display') || ''; }
  set display(v){ this.map.set('display', String(v)); }
}

class FakeElement {
  constructor(tag='div', ownerDocument=null){
    this.tagName = tag.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.classList = new FakeClassList();
    this.style = new FakeStyle();
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.hidden = false;
    this.textContent = '';
    this._innerHTML = '';
    this._src = '';
    this.onload = null;
    this.onerror = null;
    this.removed = false;
  }
  set className(value){ this.classList = new FakeClassList(); String(value).split(/\s+/).filter(Boolean).forEach(v=>this.classList.add(v)); }
  get className(){ return this.classList.toString(); }
  set innerHTML(value){
    this._innerHTML = String(value);
    if (this.ownerDocument && this._innerHTML.includes('fo-backdrop')) this.ownerDocument.parseOpeningMarkup(this, this._innerHTML);
  }
  get innerHTML(){ return this._innerHTML; }
  set src(value){
    this._src = String(value);
    setTimeout(() => { if (typeof this.onload === 'function') this.onload(); }, 0);
  }
  get src(){ return this._src; }
  setAttribute(k,v){ this.attributes.set(k,String(v)); if(k==='id') this.id=String(v); }
  removeAttribute(k){ this.attributes.delete(k); if(k==='src') this._src=''; }
  appendChild(child){ this.children.push(child); return child; }
  append(...children){ children.forEach(c=>this.appendChild(c)); }
  remove(){ this.removed = true; }
  addEventListener(type, fn){ if(!this.listeners.has(type)) this.listeners.set(type,[]); this.listeners.get(type).push(fn); }
  dispatch(type, event={}){ (this.listeners.get(type)||[]).forEach(fn=>fn(Object.assign({target:this,preventDefault(){}},event))); }
  click(){ this.dispatch('click'); }
  focus(){}
  querySelector(selector){ return this.ownerDocument ? this.ownerDocument.selectorMap.get(selector) || null : null; }
}

class FakeDocument {
  constructor(){
    this.selectorMap = new Map();
    this.body = new FakeElement('body', this);
    this.body.contains = el => this.body.children.includes(el);
  }
  createElement(tag){ return new FakeElement(tag, this); }
  parseOpeningMarkup(root, html){
    const tagRegex = /<([a-z0-9-]+)([^>]*)>/gi;
    let match;
    while((match = tagRegex.exec(html))){
      const [,tag,attrs] = match;
      const el = new FakeElement(tag, this);
      const classMatch = attrs.match(/class="([^"]+)"/i);
      if(classMatch){
        el.className = classMatch[1];
        classMatch[1].split(/\s+/).forEach(c => { if(!this.selectorMap.has('.'+c)) this.selectorMap.set('.'+c, el); });
      }
      const idMatch = attrs.match(/id="([^"]+)"/i);
      if(idMatch){ el.id=idMatch[1]; this.selectorMap.set('#'+idMatch[1], el); }
      if(/ hidden(?:\s|>|$)/i.test(attrs)) el.hidden=true;
      root.children.push(el);
    }
    root.querySelector = selector => this.selectorMap.get(selector) || null;
  }
}

const delay = ms => new Promise(r=>setTimeout(r,ms));
async function waitFor(fn, timeout=1200){
  const start=Date.now();
  while(Date.now()-start < timeout){ if(fn()) return; await delay(5); }
  throw new Error('Timeout in attesa dello stato');
}

(async()=>{
  const document = new FakeDocument();
  const local = new Map([['futtu_opening_muted','1']]);
  const windowObj = {
    FUTTU_CONFIG:{ id:'fantaballa', openingTheme:{ atmosphere:'stadium', walkoutRarities:['Leggendaria'], walkoutSeries:['Legend'], sound:false } },
    matchMedia:()=>({matches:true}),
    setTimeout,
    AudioContext:function(){},
    webkitAudioContext:function(){}
  };
  const context = {
    window:windowObj,
    document,
    localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},
    console,
    setTimeout,
    clearTimeout
  };
  windowObj.window = windowObj;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/js/futtu-pack-opening.js'),'utf8'), context, {filename:'futtu-pack-opening.js'});

  const api = windowObj.FUTTU_PACK_OPENING;
  const playPromise = api.play({
    game:'Legend', packName:'Legend', cover:'cover.webp', pack:{name:'Legend'},
    cards:[{name:'Frank Tots16',rarity:'Rara',series:'Tots',role:'POR',img:'legend.webp'}]
  });
  const pack = document.selectorMap.get('.fo-pack-phase');
  const reveal = document.selectorMap.get('.fo-reveal-phase');
  pack.click();
  await waitFor(()=>reveal.classList.contains('is-legend-sequence'));

  const steps = ['show-role','show-rarity','show-series','show-name','show-image'];
  for(let i=0;i<steps.length;i++){
    reveal.click();
    await waitFor(()=>reveal.classList.contains(steps[i]));
    for(let j=0;j<=i;j++) assert(reveal.classList.contains(steps[j]), `Step perso: ${steps[j]}`);
    if(i+1<steps.length) assert(!reveal.classList.contains(steps[i+1]), `Step anticipato: ${steps[i+1]}`);
  }
  const image = document.selectorMap.get('.fo-card-image');
  assert.equal(image.hidden, false);
  assert.equal(image.style.display, 'block');
  assert(reveal.classList.contains('is-revealed'));

  reveal.click();
  const scene = document.selectorMap.get('.fo-scene');
  await waitFor(()=>scene.dataset.phase === 'summary');
  document.selectorMap.get('.fo-continue').click();
  await playPromise;
  console.log('✓ Pack Legend: anche una carta Rara/Tots usa 5 clic separati, immagine al quinto, recap al sesto');
})().catch(error=>{ console.error(error); process.exit(1); });
