/* Domain service: auction-state. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: auction-state');
  function ensureAuctionEvents(){
    if(!$runtime.state.auctionEvents) $runtime.state.auctionEvents={count:0,lastPurchaseAt:-99,history:[],activeEffects:[],pending:null,relationships:{}};
    const ae=$runtime.state.auctionEvents; ae.history=ae.history||[]; ae.activeEffects=ae.activeEffects||[]; ae.relationships=ae.relationships||{}; return ae;
  }

  function auctionEffects(type){ return $runtime.state?.auctionEvents?.activeEffects?.filter(e=>e.type===type) || []; }

  function relationship(cpuId){
    const ae=ensureAuctionEvents();
    const r=ae.relationships[cpuId] ||= {trust:50,rivalry:0,agreements:0,betrayals:0,duels:0,respectedPacts:0,duelModelVersion:2,notes:[]};
    if(!Number.isFinite(Number(r.duels))) r.duels=0;
    if(!Number.isFinite(Number(r.respectedPacts))) r.respectedPacts=0;
    // Migrazione V3.2.35.44: i vecchi salvataggi contavano come "duello" anche
    // incroci molto brevi. Non li facciamo diventare automaticamente RIVALI CALDI
    // con le regole nuove: al massimo conserviamo due duelli pregressi.
    if(Number(r.duelModelVersion||0)<2){
      r.duels=Math.min(2,Math.max(0,Number(r.duels||0)));
      r.duelModelVersion=2;
    }
    r.notes=Array.isArray(r.notes)?r.notes:[];
    return r;
  }

  function changeRelationship(cpuId,trustDelta=0,rivalryDelta=0,note=''){
    const r=relationship(cpuId); r.trust=$runtime.clamp(r.trust+trustDelta,0,100); r.rivalry=$runtime.clamp(r.rivalry+rivalryDelta,0,100);
    if(note){r.notes.push(note); if(r.notes.length>12) r.notes=r.notes.slice(-12);} if(note.includes('tradimento')) r.betrayals++;
  }

    return Object.freeze({ensureAuctionEvents,auctionEffects,relationship,changeRelationship});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['auction-state']=Object.freeze({create});
})();
