(() => {
  'use strict';

  function roleCount(manager,role){
    return (manager?.roster||[]).filter(player=>player.role===role).length;
  }

  function slotsRemaining(manager,totalSlots=25){
    return Math.max(0,totalSlots-(manager?.roster||[]).length);
  }

  function roleSlotsRemaining(manager,role,roleLimits){
    return Math.max(0,Number(roleLimits?.[role]||0)-roleCount(manager,role));
  }

  function canOwn(manager,player,roleLimits,totalSlots=25){
    return !!(manager&&player&&roleSlotsRemaining(manager,player.role,roleLimits)>0&&slotsRemaining(manager,totalSlots)>0);
  }

  function maxLegalBid(manager,player,roleLimits,totalSlots=25){
    if(!canOwn(manager,player,roleLimits,totalSlots)) return 0;
    const reserveAfterPurchase=slotsRemaining(manager,totalSlots)-1;
    return Math.max(0,Math.floor(Number(manager.budget||0)-reserveAfterPurchase));
  }

  function buildMarketValueMap(players,roleLimits,marketAlpha,poolTargets,managerCount=10){
    const values=new Map();
    Object.keys(roleLimits||{}).forEach(role=>{
      const list=(players||[]).filter(player=>player.role===role)
        .slice().sort((a,b)=>Number(b.fvm||0)-Number(a.fvm||0));
      const relevantSlots=Number(roleLimits[role]||0)*managerCount;
      const top=list.slice(0,relevantSlots);
      const alpha=Number(marketAlpha?.[role]||1);
      const weights=top.map(player=>Math.pow(Math.max(.1,Number(player.fvm||1)),alpha));
      const weightSum=weights.reduce((sum,value)=>sum+value,0)||1;
      const distributable=Number(poolTargets?.[role]||0)*managerCount-relevantSlots;
      top.forEach((player,index)=>values.set(player.id,1+distributable*weights[index]/weightSum));
      if(!top.length) return;
      const cutoff=values.get(top[top.length-1].id)||1;
      const cutoffFvm=Math.max(1,Number(top[top.length-1].fvm||1));
      list.slice(relevantSlots).forEach(player=>{
        const ratio=Math.max(0,Number(player.fvm||1)/cutoffFvm);
        values.set(player.id,1+(cutoff-1)*Math.pow(ratio,.8)*.55);
      });
    });
    return values;
  }

  function rosterEntry(player,price){
    return {
      id:player.id,name:player.name,role:player.role,club:player.club,
      ovr:player.ovr,quotation:player.quotation,fvm:player.fvm,price
    };
  }

  function validateAward(state,player,winnerId,price,{roleLimits,totalSlots=25}={}){
    if(!state||!Array.isArray(state.managers)||!player) return {ok:false,reason:'invalid_state'};
    const winner=state.managers.find(manager=>manager.id===winnerId);
    if(!winner) return {ok:false,reason:'winner_missing'};
    if(!(state.availableIds||[]).includes(player.id)) return {ok:false,reason:'player_unavailable'};
    if(state.managers.some(manager=>(manager.roster||[]).some(item=>item.id===player.id))) return {ok:false,reason:'already_owned'};
    if(!canOwn(winner,player,roleLimits,totalSlots)) return {ok:false,reason:'roster_full'};
    const finalPrice=Math.floor(Number(price));
    if(!Number.isFinite(finalPrice)||finalPrice<1) return {ok:false,reason:'invalid_price'};
    if(finalPrice>maxLegalBid(winner,player,roleLimits,totalSlots)) return {ok:false,reason:'illegal_bid'};
    return {ok:true,winner,finalPrice};
  }

  function awardPlayer(state,player,winnerId,price,options={}){
    const validation=validateAward(state,player,winnerId,price,options);
    if(!validation.ok) return validation;
    const {winner,finalPrice}=validation;
    winner.budget=Number(winner.budget||0)-finalPrice;
    winner.roster.push(rosterEntry(player,finalPrice));
    state.availableIds=state.availableIds.filter(id=>id!==player.id);
    state.stats||={purchases:0,totalSpent:0,highest:null};
    state.stats.purchases=Number(state.stats.purchases||0)+1;
    state.stats.totalSpent=Number(state.stats.totalSpent||0)+finalPrice;
    if(!state.stats.highest||finalPrice>Number(state.stats.highest.price||0)){
      state.stats.highest={playerId:player.id,playerName:player.name,managerId:winner.id,team:winner.team,price:finalPrice};
    }
    // Bounded public tape survives save/resume and starts fresh with auction stats.
    // Bundle price splits and forced one-shot awards are not market price signals.
    if(options.recordMarketSale!==false && !state.auction?.adminOneShotForced && !state.auction?.oneShotForced){
      const sales=Array.isArray(state.stats.auctionSales)?state.stats.auctionSales:[];
      state.stats.auctionSales=[...sales,{playerId:player.id,role:player.role,price:finalPrice,
        season:Number(state.career?.seasonNumber||1),winter:state.winterMarketFlow?.stage==='auction'}].slice(-80);
    }
    return {ok:true,winner,player,finalPrice};
  }

  // A bundle is validated completely before any budget/roster mutation.
  function maxBundleBid(manager,players,roleLimits,totalSlots=25){
    if(!manager || !players.length || new Set(players.map(p=>p.id)).size!==players.length) return 0;
    if(slotsRemaining(manager,totalSlots)<players.length) return 0;
    for(const role of new Set(players.map(p=>p.role))){
      if(roleSlotsRemaining(manager,role,roleLimits)<players.filter(p=>p.role===role).length) return 0;
    }
    return Math.max(0,Math.floor(Number(manager.budget||0)-(slotsRemaining(manager,totalSlots)-players.length)));
  }
  function awardBundle(state,players,winnerId,price,options={}){
    const winner=state?.managers?.find(m=>m.id===winnerId), total=Math.floor(Number(price));
    if(!Number.isFinite(total) || total<players.length || total>maxBundleBid(winner,players,options.roleLimits,options.totalSlots)) return {ok:false,reason:'illegal_bundle'};
    if(players.some(p=>!state.availableIds.includes(p.id) || state.managers.some(m=>m.roster.some(x=>x.id===p.id)))) return {ok:false,reason:'player_unavailable'};
    // Separate paid prices preserve resale, confirmation and budget accounting.
    const prices=players.map((p,i)=>i===0?total-players.length+1:1);
    const snapshot={budget:winner.budget,roster:[...winner.roster],available:[...state.availableIds],stats:JSON.parse(JSON.stringify(state.stats||{}))};
    for(let i=0;i<players.length;i++){
      const result=awardPlayer(state,players[i],winnerId,prices[i],{...options,recordMarketSale:false});
      if(!result.ok){winner.budget=snapshot.budget;winner.roster=snapshot.roster;state.availableIds=snapshot.available;state.stats=snapshot.stats;return result;}
    }
    return {ok:true,winner,players,finalPrice:total};
  }

  window.FantaAuctionEngine=Object.freeze({
    roleCount,slotsRemaining,roleSlotsRemaining,canOwn,maxLegalBid,
    buildMarketValueMap,validateAward,awardPlayer,maxBundleBid,awardBundle
  });
})();
