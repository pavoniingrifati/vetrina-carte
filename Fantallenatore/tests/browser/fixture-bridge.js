/* Injected ONLY by the localhost test server into the shell's closure.
   This file is never referenced by index.html or shipped as a gameplay script. */
window.__fantaBrowserTest=Object.freeze({
 reset(){stopGameRuntime();state=freshState('Squadra Browser Nome Molto Lungo','Mister Browser');state.marketSeed='browser-fixture-v1';syncSerieATransferWorld(state);refreshMarketValueMap(state);},
 nomination(){this.reset();renderAll();showScreen('auctionScreen');},
 auction({analysis=true,bundle=false}={}){
  this.reset();state.auctionPowers.selected=analysis?['observer','scout','block']:['scout','block','bluff'];
  const role=ROLE_ORDER[state.currentRoleIndex];const pool=state.availableIds.map(id=>playerMap.get(id)).filter(p=>p.role===role);
  state.auction={playerId:pool[0].id,nominatorId:state.managers[1].id,highBidderId:state.managers[1].id,price:12,
   activeIds:state.managers.map(m=>m.id),log:[],commentMoments:[],bidCount:1,deadlineAt:Date.now()+60000,windowMs:60000};
  if(bundle)state.auction.arcade={type:'bundle',secondPlayerId:pool[1].id,awaitingAck:false};
  renderAll();showScreen('auctionScreen');
 },
 season({premium=true}={}){
  this.reset();state.leagueRules.captainBonus='seven';
  for(const role of ROLE_ORDER){
   const pool=state.availableIds.map(id=>playerMap.get(id)).filter(p=>p.role===role).sort((a,b)=>b.ovr-a.ovr||String(a.id).localeCompare(String(b.id)));
   let cursor=0;
   for(const m of state.managers)for(let i=0;i<ROLE_LIMITS[role];i++){
    const result=AuctionEngine.awardPlayer(state,pool[cursor++],m.id,1,{roleLimits:ROLE_LIMITS,totalSlots:TOTAL_SLOTS});
    if(!result.ok)throw Error('Fixture roster: '+result.reason);
   }
  }
  state.completed=true;state.season={started:true,currentMatchday:1,lineups:{},formationChoices:{'1':{triggered:false,resolved:true}},adminRules:{'1':{triggered:false,resolved:true}},opponentMalusEvents:{'1':{triggered:false,resolved:true}},dashboardReadyDays:{'1':true},matchdayFlow:{'1':{day:1,phase:'match_ready'}},shopPurchases:premium?{assistant_coach:{},scout_plus:{},fantadata_pro:{}}:{}};
  ensureSeasonState();renderSeasonDashboard();
 },
 stopTimers(){clearAuctionRuntimeTimers();if(state?.auction)state.auction.deadlineAt=Date.now()+60000;if(serieALive?.timer){clearInterval(serieALive.timer);serieALive.timer=null;}},
 async flush(){if(!saveState())throw Error('Fixture save rejected');if(!await saveManager.flush())throw Error('Fixture storage failed');},
 inspect(){return JSON.parse(JSON.stringify({auction:state?.auction,budget:state?.managers?.[0]?.budget,
  roster:state?.managers?.[0]?.roster,managers:state?.managers?.map(m=>({id:m.id,roster:m.roster})),
  lineupDraft,slots:lineupDraft?lineupSlots(lineupDraft.formation):[],lineups:state?.season?.lineups,live:serieALive?{phase:serieALive.phase,minute:serieALive.minute,eventIndex:serieALive.eventIndex,speed:serieALive.speed,manualPaused:serieALive.manualPaused}:null,
  phase:state?.season?.matchdayFlow?.['1']?.phase,captainRule:state?.leagueRules?.captainBonus}));}
});
