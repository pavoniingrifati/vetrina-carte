(() => {
  'use strict';
  const settings = Object.freeze({chance:.10, arcadeChance:.05});
  function contestedMultiplier(effect, managerId) {
    if (!effect) return 1;
    return effect.cpuId === managerId ? 1.12 : 1.035;
  }
  function rollArcade(types, random=Math.random){
    if(random()>=settings.arcadeChance || !types.length) return null;
    return types[Math.min(types.length-1,Math.floor(random()*types.length))];
  }
  function sealedWinner(offers,tieOrder){
    return [...offers].filter(o=>o.amount>0).sort((a,b)=>b.amount-a.amount || tieOrder.indexOf(a.managerId)-tieOrder.indexOf(b.managerId))[0] || null;
  }
  window.FantaAuctionEvents = Object.freeze({settings, contestedMultiplier, rollArcade, sealedWinner});
})();
