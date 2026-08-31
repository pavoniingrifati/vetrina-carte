/* SHARED TEMPORARY REGULATIONS 2026-08-03 */
function sharedRegulationStore(){
 state.seasonRules=state.seasonRules&&typeof state.seasonRules==='object'?state.seasonRules:{};
 state.seasonRules.sharedRegulations=Array.isArray(state.seasonRules.sharedRegulations)?state.seasonRules.sharedRegulations:[];
 return state.seasonRules.sharedRegulations;
}
function activeSharedRegulations(){
 return sharedRegulationStore().filter(item=>item&&String(item.rule||'')&&(Number(item.remainingRounds)||0)>0);
}
function sharedRegulationActive(rule){return activeSharedRegulations().some(item=>String(item.rule)===String(rule))}
function sharedRegulationEntry(rule){return activeSharedRegulations().find(item=>String(item.rule)===String(rule))||null}
function activateSharedRegulation({id='',rule='',title='',effect='',rounds=1,data=null}={}){
 const list=sharedRegulationStore(),key=String(id||rule),duration=Math.max(1,Math.round(Number(rounds)||1));
 const existingIndex=list.findIndex(item=>String(item.id||item.rule)===key||String(item.rule)===String(rule));
 const entry={id:key,rule:String(rule),title:String(title||'Regolamento temporaneo'),effect:String(effect||''),remainingRounds:duration,totalRounds:duration,activatedMatchday:(Number(state.matchday)||0)+1};
 if(data&&typeof data==='object')entry.data=JSON.parse(JSON.stringify(data));
 if(existingIndex>=0)list.splice(existingIndex,1,entry);else list.push(entry);
 return `${entry.title} entra in vigore per ${duration} ${duration===1?'giornata':'giornate'} e si applica a tutte le squadre del campionato.`;
}
function sharedRegulationEffectivePower(teamOrId,fallback=60){
 const base=Number(fallback)||60,entry=sharedRegulationEntry('chaoticOvr');if(!entry)return base;
 const id=String(typeof teamOrId==='object'?(teamOrId?.id||teamOrId?.teamId||''):teamOrId||'');if(!id)return base;
 entry.data=entry.data&&typeof entry.data==='object'?entry.data:{};entry.data.values=entry.data.values&&typeof entry.data.values==='object'?entry.data.values:{};
 let value=Number(entry.data.values[id]);if(!Number.isFinite(value)||value<5||value>200){value=Math.floor(5+Math.random()*196);entry.data.values[id]=value}
 return value;
}
function sharedRegulationScoreEffects({homeTeam,awayTeam,homeEvents=[],awayEvents=[],homeScore=null,awayScore=null,homePower=60,awayPower=60,duration=90}={}){
 const homeId=String(homeTeam?.id||''),awayId=String(awayTeam?.id||''),notes=[],beforeHomeEvents=scoreGoalEvents(homeEvents),beforeAwayEvents=scoreGoalEvents(awayEvents);
 const effectiveHome=sharedRegulationEffectivePower(homeId,homePower),effectiveAway=sharedRegulationEffectivePower(awayId,awayPower);
 const weaker=effectiveHome<effectiveAway?homeTeam:effectiveAway<effectiveHome?awayTeam:null,stronger=weaker?(String(weaker.id)===homeId?awayTeam:homeTeam):null;
 const eventsFor=id=>String(id)===homeId?homeEvents:awayEvents,opponentOf=id=>String(id)===homeId?awayTeam:homeTeam;
 if(weaker&&sharedRegulationActive('underdogGoalChance')&&Math.random()<.35){
  const event=regulationGoalEvent(weaker,opponentOf(weaker.id),duration,'La fionda di Davide');event.isDavidSlingGoal=true;event.description=`La fionda di Davide assegna un gol bonus a ${weaker.name}.`;eventsFor(weaker.id).push(event);notes.push(`La fionda di Davide: gol bonus per ${weaker.name}.`);
 }
 if(stronger&&sharedRegulationActive('favoriteFirstGoalSave')&&Math.random()<.30){
  const conceded=eventsFor(weaker.id),first=conceded.map((event,index)=>({event,index})).sort((a,b)=>(Number(a.event?.minute)||0)-(Number(b.event?.minute)||0))[0];
  if(first){conceded.splice(first.index,1);notes.push(`La corazza di Golia: annullato il primo gol subito da ${stronger.name}.`)}
 }
 if(weaker&&stronger&&sharedRegulationActive('underdogDeficitCap75')){
  const ordered=[...homeEvents.map(event=>({event,side:'home'})),...awayEvents.map(event=>({event,side:'away'}))].sort((a,b)=>(Number(a.event?.minute)||0)-(Number(b.event?.minute)||0));
  let hs=0,as=0,removed=0;const discarded=new Set();
  for(const ref of ordered){const event=ref.event,minute=Number(event?.minute)||0,teamId=String(event?.teamId||''),value=Math.max(1,Number(event?.goalValue??event?.value)||1);let accepted=value;
   if(minute<75&&teamId===String(stronger.id)){const strongScore=String(stronger.id)===homeId?hs:as,weakScore=String(weaker.id)===homeId?hs:as,maxAllowed=Math.max(0,2-(strongScore-weakScore));accepted=Math.min(value,maxAllowed);if(accepted<=0){discarded.add(event);removed+=value;continue}if(accepted<value){event.goalValue=accepted;removed+=value-accepted}}
   if(teamId===homeId)hs+=accepted;else if(teamId===awayId)as+=accepted;
  }
  if(discarded.size){for(let i=homeEvents.length-1;i>=0;i--)if(discarded.has(homeEvents[i]))homeEvents.splice(i,1);for(let i=awayEvents.length-1;i>=0;i--)if(discarded.has(awayEvents[i]))awayEvents.splice(i,1)}
  if(removed)notes.push(`Partita sempre aperta: ${removed} ${removed===1?'gol è stato annullato':'gol sono stati annullati'} prima del 75° per proteggere ${weaker.name}.`);
 }
 homeEvents.sort((a,b)=>(Number(a?.minute)||0)-(Number(b?.minute)||0));awayEvents.sort((a,b)=>(Number(a?.minute)||0)-(Number(b?.minute)||0));
 const afterHomeEvents=scoreGoalEvents(homeEvents),afterAwayEvents=scoreGoalEvents(awayEvents),hasHomeScore=homeScore!==null&&homeScore!==undefined&&Number.isFinite(Number(homeScore)),hasAwayScore=awayScore!==null&&awayScore!==undefined&&Number.isFinite(Number(awayScore)),baseHome=hasHomeScore?Number(homeScore):beforeHomeEvents,baseAway=hasAwayScore?Number(awayScore):beforeAwayEvents;
 return{homeScore:baseHome+(afterHomeEvents-beforeHomeEvents),awayScore:baseAway+(afterAwayEvents-beforeAwayEvents),homePower:effectiveHome,awayPower:effectiveAway,weakerId:String(weaker?.id||''),strongerId:String(stronger?.id||''),notes};
}
function sharedRegulationDurationLabel(item){const rounds=Math.max(0,Number(item?.remainingRounds)||0);return `${rounds} ${rounds===1?'giornata rimasta':'giornate rimaste'}`}
function tickSharedRegulationsAfterRound(){
 const list=sharedRegulationStore();
 list.forEach(item=>{item.remainingRounds=Math.max(0,(Number(item.remainingRounds)||0)-1)});
 state.seasonRules.sharedRegulations=list.filter(item=>(Number(item.remainingRounds)||0)>0);
}
function sharedRegulationPreRoundContext(){
 const table=sortedTable(),ranks={},points={};
 table.forEach((row,index)=>{ranks[String(row.id)]=index+1;points[String(row.id)]=Number(row.pts)||0});
 return{leaderId:String(table[0]?.id||''),ranks,points};
}
function sharedRegulationGoalValue(goal){return Math.max(1,Number(goal?.goalValue??goal?.value)||1)}
function sharedRegulationTimeline(homeGoals=[],awayGoals=[]){return [...(homeGoals||[]),...(awayGoals||[])].filter(goal=>!goal?.annulled).sort((a,b)=>(Number(a?.minute)||0)-(Number(b?.minute)||0))}
function sharedRegulationComebackWinner(homeId,awayId,winnerId,homeGoals=[],awayGoals=[]){
 if(!winnerId)return false;
 let home=0,away=0,trailed=false;
 for(const goal of sharedRegulationTimeline(homeGoals,awayGoals)){
  if(String(goal.teamId)===String(homeId))home+=sharedRegulationGoalValue(goal);else if(String(goal.teamId)===String(awayId))away+=sharedRegulationGoalValue(goal);
  if(String(winnerId)===String(homeId)&&home<away)trailed=true;
  if(String(winnerId)===String(awayId)&&away<home)trailed=true;
 }
 return trailed;
}
function sharedRegulationLateWinningGoal(homeId,awayId,winnerId,homeScore,awayScore,homeGoals=[],awayGoals=[]){
 if(!winnerId||Number(homeScore)===Number(awayScore))return null;
 const loserFinal=String(winnerId)===String(homeId)?Number(awayScore)||0:Number(homeScore)||0;
 let winnerRunning=0;
 for(const goal of sharedRegulationTimeline(homeGoals,awayGoals)){
  if(String(goal.teamId)!==String(winnerId))continue;
  winnerRunning+=sharedRegulationGoalValue(goal);
  if(winnerRunning>loserFinal)return Number(goal.minute)>=85?goal:null;
 }
 return null;
}
function applySharedRegulationPointsToMatch({homeId,awayId,homeScore,awayScore,winnerId='',homeGoals=[],awayGoals=[],preRoundContext=null,beforePoints=null}={}){
 const homeKey=String(homeId),awayKey=String(awayId),homeStanding=state.standings?.[homeKey],awayStanding=state.standings?.[awayKey];
 if(!homeStanding||!awayStanding)return{homeAwarded:0,awayAwarded:0,homeAdjustment:0,awayAdjustment:0,notesByTeam:{},notes:[]};
 const context=preRoundContext||sharedRegulationPreRoundContext(),before=beforePoints||{home:Number(homeStanding.pts)||0,away:Number(awayStanding.pts)||0};
 let homeAwarded=(Number(homeStanding.pts)||0)-(Number(before.home)||0),awayAwarded=(Number(awayStanding.pts)||0)-(Number(before.away)||0);
 const homeWon=String(winnerId)===homeKey||(Number(homeScore)>Number(awayScore)&&!winnerId),awayWon=String(winnerId)===awayKey||(Number(awayScore)>Number(homeScore)&&!winnerId),draw=!homeWon&&!awayWon&&Number(homeScore)===Number(awayScore);
 const winner=homeWon?homeKey:awayWon?awayKey:'',loser=homeWon?awayKey:awayWon?homeKey:'';
 const ranks=context.ranks||{},points=context.points||{},notesByTeam={[homeKey]:[],[awayKey]:[]},allNotes=[];
 const addNote=(teamId,text)=>{notesByTeam[String(teamId)]?.push(text);allNotes.push(text)};
 const raiseWinnerTo=value=>{if(homeWon&&homeAwarded<value)homeAwarded=value;if(awayWon&&awayAwarded<value)awayAwarded=value};
 if(sharedRegulationActive('narrowWinFour')&&winner&&Math.abs(Number(homeScore)-Number(awayScore))===1){raiseWinnerTo(4);addNote(winner,'Vittoria di misura: la vittoria assegna 4 punti.');}
 if(sharedRegulationActive('directMatchFour')&&winner&&Math.abs((Number(points[homeKey])||0)-(Number(points[awayKey])||0))<=3){raiseWinnerTo(4);addNote(winner,'Scontro diretto: la vittoria assegna 4 punti.');}
 if(sharedRegulationActive('leaderWinTwo')&&winner&&winner===String(context.leaderId||'')){if(homeWon)homeAwarded=2;else awayAwarded=2;addNote(winner,'Pressione da primato: la vittoria della capolista vale soltanto 2 punti.');}
 if(sharedRegulationActive('underdogTopThreeDrawTwo')&&draw){
  if((Number(ranks[homeKey])||99)>=11&&(Number(ranks[awayKey])||99)<=3&&homeAwarded<2){homeAwarded=2;addNote(homeKey,'Pareggio d’impresa: fermare una delle prime tre vale 2 punti.');}
  if((Number(ranks[awayKey])||99)>=11&&(Number(ranks[homeKey])||99)<=3&&awayAwarded<2){awayAwarded=2;addNote(awayKey,'Pareggio d’impresa: fermare una delle prime tre vale 2 punti.');}
 }
 if(sharedRegulationActive('spectacleBonus')&&(Number(homeScore)||0)+(Number(awayScore)||0)>=4){homeAwarded+=1;awayAwarded+=1;addNote(homeKey,'Calcio spettacolo: +1 punto per una partita con almeno 4 gol.');addNote(awayKey,'Calcio spettacolo: +1 punto per una partita con almeno 4 gol.');}
 if(sharedRegulationActive('lateWinnerBonus')&&winner&&sharedRegulationLateWinningGoal(homeKey,awayKey,winner,homeScore,awayScore,homeGoals,awayGoals)){if(homeWon)homeAwarded+=1;else awayAwarded+=1;addNote(winner,'Finale da brividi: +1 punto per il gol decisivo segnato dall’85° minuto.');}
 if(sharedRegulationActive('comebackBonus')&&winner&&sharedRegulationComebackWinner(homeKey,awayKey,winner,homeGoals,awayGoals)){if(homeWon)homeAwarded+=1;else awayAwarded+=1;addNote(winner,'Rimonta da prima serata: +1 punto per la vittoria in rimonta.');}
 if(sharedRegulationActive('beatLeaderBonus')&&winner&&loser===String(context.leaderId||'')){if(homeWon)homeAwarded+=2;else awayAwarded+=2;addNote(winner,'Caccia alla capolista: +2 punti per aver battuto la prima in classifica.');}
 if(sharedRegulationActive('underdogTopFiveWinBonus')&&winner&&(Number(ranks[winner])||99)>=11&&(Number(ranks[loser])||99)<=5){if(homeWon)homeAwarded+=2;else awayAwarded+=2;addNote(winner,'Davide contro Golia: +2 punti per la vittoria contro una squadra delle prime cinque.');}
 if(sharedRegulationActive('awayWinBonus')&&awayWon){awayAwarded+=1;addNote(awayKey,'Trasferta di lusso: +1 punto per la vittoria fuori casa.');}
 const currentHome=(Number(homeStanding.pts)||0)-(Number(before.home)||0),currentAway=(Number(awayStanding.pts)||0)-(Number(before.away)||0),homeAdjustment=homeAwarded-currentHome,awayAdjustment=awayAwarded-currentAway;
 if(homeAdjustment)homeStanding.pts=(Number(homeStanding.pts)||0)+homeAdjustment;
 if(awayAdjustment)awayStanding.pts=(Number(awayStanding.pts)||0)+awayAdjustment;
 return{homeAwarded,awayAwarded,homeAdjustment,awayAdjustment,notesByTeam,notes:allNotes};
}

