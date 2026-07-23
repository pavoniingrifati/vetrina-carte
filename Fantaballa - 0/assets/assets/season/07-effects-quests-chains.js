/* Fantaballa Season Engine — 07-effects-quests-chains.js
 * Intesa, effetti, sponsor, quest e catene di eventi.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
function getStarterEntries(){return rosterPlayers().filter(r=>!r.bench)}function getBenchEntries(){return rosterPlayers().filter(r=>r.bench)}
function motivatorPermanentChemistryBonus(player){return coachIs('motivator')?Math.max(0,Number(state.seasonRules?.motivatorPermanentChemistry?.[String(player?.id||'')])||0):0}
function addMotivatorPermanentChemistry(playerId,value=1){if(!coachIs('motivator')||!playerId||Number(value)<=0)return 0;state.seasonRules.motivatorPermanentChemistry=state.seasonRules.motivatorPermanentChemistry&&typeof state.seasonRules.motivatorPermanentChemistry==='object'?state.seasonRules.motivatorPermanentChemistry:{};const id=String(playerId),next=Math.max(0,(Number(state.seasonRules.motivatorPermanentChemistry[id])||0)+Number(value));state.seasonRules.motivatorPermanentChemistry[id]=next;return next}
function chemistryBaseRaw(player,list){if(coachIs('ductility'))return 0;const players=Array.isArray(list)?list:[];let v=nationChemistryBonus(player,players)+clubChemistryBonus(player,players)+youngBeautifulChemistryBonus(player);if(isSubscriber(player))v+=5;const subs=players.filter(o=>o.nation===player.nation&&isSubscriber(o)).length;if(isSubscriber(player)&&subs>=2)v+=10;if(normalizeName(player.name)===normalizeName(state.coachName))v+=10;v+=motivatorPermanentChemistryBonus(player);return v}
function chemistryBase(player,list){return coachIs('ductility')||closedPortsAffects(player)?0:chemistryBaseRaw(player,list)}
function activeChemistryEventBonus(player){
 if(coachIs('ductility'))return 0;
 let value=0;
 state.activeEffects.forEach(effect=>{
   if(effect.type==='teamChem')value+=Number(effect.value)||0;
   if(effect.type==='subscriberChem'&&isSubscriber(player))value+=Number(effect.value)||0;
   if(effect.type==='playerChem'&&String(effect.playerId)===String(player.id))value+=Number(effect.value)||0;
 });
 return value;
}
function activeOvrBonus(player){
 if(state.activeEffects.some(effect=>effect.type==='baseOvrOnly'))return 0;
 const ductility=coachIs('ductility');let value=0;
 const include=amount=>{const number=Number(amount)||0;if(!ductility||number<0)value+=number};
 state.activeEffects.forEach(effect=>{
   if(effect.type==='teamOvr')include(effect.value);
   if(effect.type==='subscriberOvr'&&isSubscriber(player))include(effect.value);
   if(effect.type==='playerOvr'&&String(effect.playerId)===String(player.id))include(effect.value);
   if(effect.type==='goalkeeperOvr'&&roleOf(player)==='P')include(effect.value);
 });
 include(meritStoryOvrModifier(player));
 const status=state.statuses?.[String(player?.id||'')];
 if(status&&Number(status.injury)>0&&!ductility)value+=Math.max(0,Number(state.seasonRules.injuredOvrBonus)||0);
 return value;
}
function activeChemistryMultiplier(player){
 if(coachIs('ductility'))return 1;
 let multiplier=parallelCupChemistryMultiplier();
 state.activeEffects.forEach(effect=>{
   if(effect.type==='teamChemMultiplier')multiplier*=Math.max(.1,Number(effect.value)||1);
   if(effect.type==='subscriberChemMultiplier'&&isSubscriber(player))multiplier*=Math.max(.1,Number(effect.value)||1);
   if(effect.type==='playerChemMultiplier'&&String(effect.playerId)===String(player?.id||''))multiplier*=Math.max(.1,Number(effect.value)||1);
 });
 return clamp(multiplier,.1,6);
}
function chemistryIsZeroed(){return coachIs('ductility')||parallelCupChemistryZero()||state.activeEffects.some(effect=>effect.type==='teamChemZero')}
function effectiveChemistryFromBase(player,baseChem=0){
 if(coachIs('ductility')||state.activeEffects.some(effect=>effect.type==='baseOvrOnly'))return 0;
 if(chemistryIsZeroed()||closedPortsAffects(player))return 0;
 const raw=(Number(baseChem)||0)+activeChemistryEventBonus(player);
 const multiplier=activeChemistryMultiplier(player);
 return raw>0?raw*multiplier:raw;
}
function effectiveChemistryBonus(player,players){return effectiveChemistryFromBase(player,chemistryBase(player,players||starterEntries().map(entry=>entry.player).filter(Boolean)))}
function activeEffectBonus(player,baseChem=0){return activeOvrBonus(player)+(effectiveChemistryFromBase(player,baseChem)-(Number(baseChem)||0))}
function sponsorBallariniActive(){return String(state.seasonRules?.sponsorChoice||'')==='ballarini'}
function sponsorFootballManagerActive(){return String(state.seasonRules?.sponsorChoice||'')==='football-manager'}
function recordBallariniPlayerBonus(playerId,value=0){
 const id=String(playerId||''),amount=Math.max(0,Number(value)||0);if(!id||!amount)return 0;
 state.seasonRules.ballariniPlayerBonus=state.seasonRules.ballariniPlayerBonus&&typeof state.seasonRules.ballariniPlayerBonus==='object'?state.seasonRules.ballariniPlayerBonus:{};
 const next=Math.max(0,(Number(state.seasonRules.ballariniPlayerBonus[id])||0)+amount);state.seasonRules.ballariniPlayerBonus[id]=next;return next;
}
function recordBallariniBoostApplication(){
 if(!sponsorBallariniActive())return 0;
 const next=Math.max(0,(Number(state.seasonRules.sponsorOvrBoostCount)||0)+1);state.seasonRules.sponsorOvrBoostCount=next;if(next>=5)unlockAchievement('non-si-attacca-niente');return next;
}
function sponsorOvrExtraFor(value=0,extra={}){
 const applies=sponsorBallariniActive()&&Number(value)>0&&!extra?.sponsorExtra&&!extra?.motivatorExtra;if(!applies)return 0;
 const bonus=Math.max(0,Number(state.seasonRules?.sponsorOvrExtra)||5);if(bonus&&!extra?.skipAchievementTracking)recordBallariniBoostApplication();return bonus;
}
function physioAdjustedInjuryChance(chance=0){return clamp((Number(chance)||0)*(sponsorFootballManagerActive()?Math.max(.1,Number(state.seasonRules?.physioInjuryMultiplier)||.5):1),0,1)}
function activateBallariniSponsor(){state.seasonRules.sponsorChoice='ballarini';state.seasonRules.sponsorOvrExtra=5;state.seasonRules.sponsorOvrBoostCount=0;state.seasonRules.ballariniPlayerBonus={};state.seasonRules.physioInjuryMultiplier=1;state.seasonRules.fmTacticianWins=0;state.seasonRules.fmInjuryOccurred=false;return 'Padelle Ballarini è il nuovo sponsor: ogni bonus OVR positivo ottenuto dagli eventi riceverà +5 OVR aggiuntivi.'}
function activateFootballManagerSponsor(){state.seasonRules.sponsorChoice='football-manager';state.seasonRules.sponsorOvrExtra=0;state.seasonRules.sponsorOvrBoostCount=0;state.seasonRules.ballariniPlayerBonus={};state.seasonRules.physioInjuryMultiplier=.5;state.seasonRules.fmTacticianWins=0;state.seasonRules.fmInjuryOccurred=false;const tactician=activatePersistentTactician();return `${tactician} Il fisioterapista dimezza la probabilità degli infortuni casuali fino a fine stagione.`}
function motivatorBonusScope(type){
 const scopes={teamOvr:{ovr:'teamOvr',chem:'teamChem',kind:'ovr'},playerOvr:{ovr:'playerOvr',chem:'playerChem',kind:'ovr'},teamChem:{ovr:'teamOvr',chem:'teamChem',kind:'chem'},subscriberChem:{ovr:'subscriberOvr',chem:'subscriberChem',kind:'chem'},playerChem:{ovr:'playerOvr',chem:'playerChem',kind:'chem'},teamChemMultiplier:{ovr:'teamOvr',chem:'teamChem',kind:'multiplier'},subscriberChemMultiplier:{ovr:'subscriberOvr',chem:'subscriberChem',kind:'multiplier'},playerChemMultiplier:{ovr:'playerOvr',chem:'playerChem',kind:'multiplier'}};
 return scopes[String(type||'')]||null;
}
function pushEffect(type,value,rounds,extra={}){
 const scope=motivatorBonusScope(type),ovrTypes=new Set(['teamOvr','playerOvr','subscriberOvr','goalkeeperOvr']),sponsorExtra=ovrTypes.has(String(type))?sponsorOvrExtraFor(value,extra):0,sponsoredValue=Number(value)+sponsorExtra,enhance=coachIs('motivator')&&!extra?.motivatorExtra&&scope&&sponsoredValue>0;
 const adjusted=enhance&&scope.kind!=='multiplier'?sponsoredValue+1:sponsoredValue,untilSeasonEnd=Boolean(extra?.untilSeasonEnd),duration=Math.max(1,Number(rounds)||(untilSeasonEnd?remainingSeasonMatches():1));
 state.activeEffects.push({type,value:adjusted,rounds:duration,...extra,untilSeasonEnd,sponsorExtra});
 if(!enhance)return;
 const companionBase={rounds:duration,source:'Motivatore',motivatorExtra:true,untilSeasonEnd};
 if(extra?.playerId)companionBase.playerId=String(extra.playerId);
 if(scope.kind==='ovr')state.activeEffects.push({type:scope.chem,value:1,...companionBase});
 else if(scope.kind==='chem')state.activeEffects.push({type:scope.ovr,value:1,...companionBase});
 else{state.activeEffects.push({type:scope.ovr,value:1,...companionBase});state.activeEffects.push({type:scope.chem,value:1,...companionBase})}
}
function pushSeasonEffect(type,value,extra={}){return pushEffect(type,value,remainingSeasonMatches(),{...extra,untilSeasonEnd:true})}
function applyCreatorMvpBoostAfterMatch(result){
 if(!result)return;
 const mvpId=String(result?.mvpId||'').trim();
 if(!mvpId)return;
 const userIds=new Set(rosterPlayers().map(entry=>String(entry.playerId||'')));
 if(!userIds.has(mvpId))return;
 const player=playerById(mvpId)||statPlayerInfo(mvpId);
 if(!player||!isCreator(player))return;
 state.activeEffects=state.activeEffects.filter(effect=>String(effect?.source||'')!=='creator-mvp-boost');
 pushEffect('teamOvr',1,2,{source:'creator-mvp-boost',label:'Uomo immagine'});
 result.creatorMvpBoost={active:true,playerId:mvpId,playerName:String(player.name||'Creator'),value:1};
}
function midseasonTargetFrom(source=state){
 const delta=Number(source?.seasonRules?.midseasonPickDelta)||0;
 const mandatoryCount=[...new Set([...(Array.isArray(source?.seasonRules?.mandatoryMidseasonPlayerIds)?source.seasonRules.mandatoryMidseasonPlayerIds:[]),source?.seasonRules?.mandatoryMidseasonPlayerId].map(String).filter(Boolean))].length;
 return clamp(Math.max(2+delta,mandatoryCount),1,3);
}
function midseasonTarget(){return midseasonTargetFrom(state)}
function changeMidseasonPicks(delta){
 state.seasonRules.midseasonPickDelta=clamp((Number(state.seasonRules.midseasonPickDelta)||0)+delta,-1,1);
 return `Il draft di metà stagione avrà ${midseasonTarget()} ${midseasonTarget()===1?'cambio':'cambi'}.`;
}
function randomOwnEntry(filter=()=>true){
 const entries=rosterPlayers().filter(filter);
 return entries.length?pick(entries):null;
}
function nextOpponentTeam(){
 if(state.phase!=='season')return null;
 const fixture=userFixture();
 if(!fixture)return null;
 return teamById(fixture.home===USER_ID?fixture.away:fixture.home);
}
function applyPlayerEffect(type,value,rounds,filter=()=>true){
 const entry=randomOwnEntry(filter);
 if(!entry)return 'Nessun giocatore disponibile.';
 pushEffect(type,value,rounds,{playerId:entry.playerId});
 return `${entry.player.name} riceve ${value>=0?'+':''}${value} per ${rounds===1?'la prossima partita':`${rounds} giornate`}.`;
}

function temporaryEventBlocksPlayer(playerId){
 const id=String(playerId||'');
 if(!id)return false;
 return state.activeEffects.some(effect=>['playerUnavailable','playerRest'].includes(String(effect.type||''))&&String(effect.playerId||'')===id&&Number(effect.rounds)>0);
}
function realCurrentLineupEntries(){return resolveLineup().filter(entry=>entry?.player&&!isEmergencyYouthEntry(entry))}
function randomRealCurrentLineupEntry(){const entries=realCurrentLineupEntries();return entries.length?pick(entries):null}
function applyWrongShirtSwap(lineup){
 const rows=(Array.isArray(lineup)?lineup:[]).map(entry=>({...entry}));
 const effect=state.activeEffects.find(item=>item.type==='wrongShirts'&&Number(item.rounds)>0);
 if(!effect)return rows;
 const first=rows.find(entry=>String(entry.playerId||entry.player?.id||'')===String(effect.firstPlayerId||''));
 const second=rows.find(entry=>String(entry.playerId||entry.player?.id||'')===String(effect.secondPlayerId||''));
 if(!first||!second)return rows;
 const firstSlot=first.slot,firstSlotId=first.slotId;
 first.slot=second.slot;first.slotId=second.slotId;
 second.slot=firstSlot;second.slotId=firstSlotId;
 first.wrongShirtSwap=true;second.wrongShirtSwap=true;
 if(!userCompatible(first.player,first.slot))first.malus=(Number(first.malus)||0)-5;
 if(!userCompatible(second.player,second.slot))second.malus=(Number(second.malus)||0)-5;
 return rows;
}
function startWrongShirtsEvent(){
 const candidates=realCurrentLineupEntries();
 if(candidates.length<2)return 'Non ci sono almeno due giocatori reali nella formazione effettiva.';
 const selected=shuffle(candidates).slice(0,2),first=selected[0],second=selected[1];
 [first,second].forEach(item=>{const entry=rosterEntry(item.playerId);if(entry){entry.tipsterForced=true;entry.tipsterForcedMatches=Math.max(1,Number(entry.tipsterForcedMatches)||0)}});
 pushEffect('wrongShirts',1,1,{firstPlayerId:String(first.playerId),secondPlayerId:String(second.playerId),firstPlayerName:first.player.name,secondPlayerName:second.player.name,source:'Maglie con i nomi sbagliati'});
 const firstPenalty=userCompatible(first.player,second.slot)?0:-5,secondPenalty=userCompatible(second.player,first.slot)?0:-5;
 const details=[`${first.player.name} va in ${second.slot}${firstPenalty?' e riceve -5 OVR':''}`,`${second.player.name} va in ${first.slot}${secondPenalty?' e riceve -5 OVR':''}`];
 return `${details.join(' · ')} nella prossima partita.`;
}
function printLastMinuteShirts(){
 const entry=randomRealCurrentLineupEntry();
 if(!entry)return 'Non c’è un giocatore reale disponibile da escludere.';
 pushEffect('playerUnavailable',1,1,{playerId:String(entry.playerId),playerName:entry.player.name,source:'Maglie stampate all’ultimo secondo'});
 pushEffect('teamChem',3,1,{source:'Maglie stampate all’ultimo secondo'});
 return `${entry.player.name} salta la prossima partita. Tutti gli altri giocatori schierati ricevono +3 Intesa.`;
}
function acceptSmallGoalMatch(){
 pushEffect('smallGoals',.65,1,{source:'Porta da calcetto'});
 pushEffect('goalkeeperOvr',10,1,{source:'Porta da calcetto'});
 return 'Nella prossima partita la probabilità di segnare è ridotta per entrambe le squadre e il tuo portiere riceve +10 OVR.';
}
function secretRefereeDealState(source=state){
 const rules=source?.seasonRules||(source.seasonRules={});
 const deal=rules.secretRefereeDeal&&typeof rules.secretRefereeDeal==='object'?rules.secretRefereeDeal:(rules.secretRefereeDeal={});
 deal.active=Boolean(deal.active);deal.choice=['accept','refuse'].includes(String(deal.choice))?String(deal.choice):'';
 deal.startedMatchday=Number.isFinite(Number(deal.startedMatchday))?Number(deal.startedMatchday):-1;
 deal.earnedPoints=Math.max(0,Number(deal.earnedPoints)||0);deal.matchesChecked=Math.max(0,Number(deal.matchesChecked)||0);
 deal.discovered=Boolean(deal.discovered);deal.discoveredMatchday=Number.isFinite(Number(deal.discoveredMatchday))?Number(deal.discoveredMatchday):-1;deal.lastAdjustment=Number(deal.lastAdjustment)||0;
 if(!deal.choice)deal.active=false;
 return deal;
}
function startSecretRefereeDeal(choice){
 const selected=choice==='refuse'?'refuse':'accept',deal=secretRefereeDealState();
 Object.assign(deal,{active:true,choice:selected,startedMatchday:Number(state.matchday)||0,earnedPoints:0,matchesChecked:0,discovered:false,discoveredMatchday:-1,lastAdjustment:0});
 return selected==='accept'?'L’accordo è attivo: riceverai un rigore a favore in ogni partita.':'Hai rifiutato: riceverai un rigore contro in ogni partita.';
}
function secretRefereePenaltyEvent(lineup,team,opponent,duration=90,favour=true){
 const safe=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry&&entry.player),scorer=safe.length?weightedScorer(safe):null;
 const total=Math.max(30,Number(duration)||90),minute=Math.max(2,Math.min(total-1,8+Math.floor(Math.random()*Math.max(1,total-12))));
 const playerId=String(scorer?.playerId||scorer?.player?.id||''),playerName=scorer?.player?.name||'Rigore dell’arbitro ecuadoriano';
 return {minute,playerId,assistId:'',player:playerName,assist:'',teamId:String(team?.id||''),teamName:team?.name||'',goalValue:1,isSecretRefereePenalty:true,description:favour?`L’arbitro ecuadoriano concede un rigore molto generoso a ${team?.name||'questa squadra'}.`:`L’arbitro ecuadoriano assegna un rigore contro ${opponent?.name||'la tua squadra'}.`};
}
function applySecretRefereePenalty(userEvents,opponentEvents,lineup,opponentLineup,userTeam,opponent,duration=90){
 const deal=secretRefereeDealState();if(!deal.active)return'';
 if(deal.choice==='accept'){userEvents.push(secretRefereePenaltyEvent(lineup,userTeam,opponent,duration,true));return'for'}
 if(deal.choice==='refuse'){opponentEvents.push(secretRefereePenaltyEvent(opponentLineup,opponent,userTeam,duration,false));return'against'}
 return'';
}
function resolveSecretRefereeAfterMatch(result){
 const deal=secretRefereeDealState();if(!deal.active||!result)return;
 const gained=Math.max(0,Number(result.pointsAwarded)||0);deal.earnedPoints+=gained;deal.matchesChecked++;
 result.secretRefereeDeal={active:true,choice:deal.choice,earnedPoints:deal.earnedPoints,matchesChecked:deal.matchesChecked,discovered:false};
 if(Math.random()>=.10)return;
 const amount=Math.max(0,Number(deal.earnedPoints)||0),standing=userStanding();
 const adjustment=deal.choice==='accept'?-amount:amount;if(standing)standing.pts+=adjustment;
 deal.active=false;deal.discovered=true;deal.discoveredMatchday=(Number(state.matchday)||0)+1;deal.lastAdjustment=adjustment;
 result.secretRefereeDeal={active:false,choice:deal.choice,earnedPoints:amount,matchesChecked:deal.matchesChecked,discovered:true,adjustment};
 result.eventUpdates=Array.isArray(result.eventUpdates)?result.eventUpdates:[];
 if(deal.choice==='accept')result.eventUpdates.push({success:false,title:'Intercettazioni: accordo scoperto',message:`L’accordo con l’arbitro ecuadoriano è stato scoperto. Perdi ${amount} ${amount===1?'punto':'punti'}, cioè tutti quelli conquistati nelle partite giocate dopo l’accordo. Da ora i rigori pilotati terminano.`});
 else result.eventUpdates.push({success:true,title:'Intercettazioni: proposta scoperta',message:`Le intercettazioni confermano che avevi rifiutato l’accordo. Ottieni altri ${amount} ${amount===1?'punto':'punti'}: i punti conquistati da allora vengono raddoppiati. Da ora tutto torna normale.`});
 const note=deal.choice==='accept'?`Intercettazioni: -${amount} punti, annullati tutti i punti conquistati dopo l’accordo.`:`Intercettazioni: +${amount} punti, raddoppiati i punti conquistati dopo il rifiuto.`;
 result.pointsNote=[result.pointsNote,note].filter(Boolean).join(' ');
}
function insomniacContextEntry(context={}){
 const requested=context?.playerId?rosterEntry(context.playerId):null;
 if(requested&&requested.player)return requested;
 return randomRealCurrentLineupEntry();
}
function sendInsomniacOnField(context={}){
 const entry=insomniacContextEntry(context);if(!entry)return 'Nessun titolare reale disponibile.';
 entry.tipsterForced=true;entry.tipsterForcedMatches=Math.max(1,Number(entry.tipsterForcedMatches)||0);
 pushEffect('playerOvr',-12,1,{playerId:String(entry.playerId),playerName:entry.player.name,insomniacRewardChem:15,source:'Giocatore insonne'});
 return `${entry.player.name} riceve -12 OVR nella prossima partita. Se segna, otterrà +15 Intesa fino a fine stagione.`;
}
function restInsomniacPlayer(context={}){
 const entry=insomniacContextEntry(context);if(!entry)return 'Nessun titolare reale disponibile.';
 pushEffect('playerRest',1,1,{playerId:String(entry.playerId),playerName:entry.player.name,afterRestOvr:5,afterRestRounds:2,source:'Giocatore insonne'});
 return `${entry.player.name} salta la prossima partita. Al rientro riceverà +5 OVR per 2 giornate.`;
}
function resolveClassicEventAfterMatch(result){
 const restRewards=state.activeEffects.filter(effect=>effect.type==='playerRest'&&Number(effect.rounds)<=1).map(effect=>({playerId:String(effect.playerId||''),playerName:String(effect.playerName||playerById(effect.playerId)?.name||'Giocatore'),value:Math.max(1,Number(effect.afterRestOvr)||5),rounds:Math.max(1,Number(effect.afterRestRounds)||2)}));
 if(!result)return restRewards;
 result.eventUpdates=Array.isArray(result.eventUpdates)?result.eventUpdates:[];
 state.activeEffects.filter(effect=>effect.type==='playerOvr'&&Number(effect.insomniacRewardChem)>0&&Number(effect.rounds)>0).forEach(effect=>{
   const id=String(effect.playerId||''),name=String(effect.playerName||playerById(id)?.name||'Il giocatore insonne');
   const scored=(result.goals||[]).some(goal=>String(goal.playerId||'')===id);
   if(scored&&rosterEntry(id)){
     pushSeasonEffect('playerChem',Number(effect.insomniacRewardChem)||15,{playerId:id,source:'Giocatore insonne'});
     unlockAchievement('nottata-produttiva');
     result.eventUpdates.push({success:true,title:'Il giocatore insonne',message:`${name} ha segnato e ottiene +15 Intesa fino a fine stagione.`});
   }else result.eventUpdates.push({success:false,title:'Il giocatore insonne',message:`${name} non ha segnato: il bonus permanente non viene assegnato.`});
 });
 return restRewards;
}
function activateRestRewards(restRewards=[],result=null){
 if(result)result.eventUpdates=Array.isArray(result.eventUpdates)?result.eventUpdates:[];
 restRewards.forEach(reward=>{
   if(!reward.playerId||!rosterEntry(reward.playerId))return;
   pushEffect('playerOvr',reward.value,reward.rounds,{playerId:reward.playerId,playerName:reward.playerName,source:'Rientro del giocatore insonne'});
   if(result)result.eventUpdates.push({success:true,title:'Rientro dopo il riposo',message:`${reward.playerName} rientra con +${reward.value} OVR per ${reward.rounds} giornate.`});
 });
}

function hypnotizeRandomAttacker(){
 const entry=randomOwnEntry(item=>roleOf(item.player)==='A');
 if(!entry)return 'Nessun attaccante disponibile da ipnotizzare.';
 if(Math.random()<.25){
   const rosterEntry=state.draft.roster.find(item=>String(item.playerId)===String(entry.playerId));
   if(rosterEntry){const current=rosterEntry.player||entry.player||playerById(entry.playerId),originalOvr=Math.max(1,Number(current?.ovr)||1);rosterEntry.player={...current,ovr:1,isChicken:true,chickenOriginalOvr:originalOvr};beginMentalistaChicken(rosterEntry,originalOvr);}
   return `Il mentalista sbaglia: ${entry.player.name} viene trasformato in un pollo da 1 OVR. Tra alcune giornate inizierà il Richiamo del pollaio.`;
 }
 pushEffect('playerOvr',8,1,{playerId:entry.playerId});
 return `${entry.player.name} viene ipnotizzato correttamente e riceve +8 OVR nella prossima partita.`;
}

function mentalistaChain(){
 state.eventChains=state.eventChains&&typeof state.eventChains==='object'?state.eventChains:{};
 state.eventChains.mentalista=state.eventChains.mentalista&&typeof state.eventChains.mentalista==='object'?state.eventChains.mentalista:{active:false,stage:0,playerId:'',playerName:'',originalOvr:1,dueMatchday:-1,training:false,nature:false,goals:0,completed:false};
 return state.eventChains.mentalista;
}
function generalChain(){
 state.eventChains=state.eventChains&&typeof state.eventChains==='object'?state.eventChains:{};
 state.eventChains.general=state.eventChains.general&&typeof state.eventChains.general==='object'?state.eventChains.general:{active:false,stage:0,dueMatchday:-1,replacements:[],nationalBoostPending:false,completed:false};
 return state.eventChains.general;
}

function penguinChain(){
 state.eventChains=state.eventChains&&typeof state.eventChains==='object'?state.eventChains:{};
 state.eventChains.pinguino=state.eventChains.pinguino&&typeof state.eventChains.pinguino==='object'?state.eventChains.pinguino:{active:false,stage:0,dueMatchday:-1,mode:'',completed:false,wins:0,nonWins:0};
 return state.eventChains.pinguino;
}

function mysteryCharacterChain(){
 state.eventChains=state.eventChains&&typeof state.eventChains==='object'?state.eventChains:{};
 state.eventChains.mysteryCharacter=state.eventChains.mysteryCharacter&&typeof state.eventChains.mysteryCharacter==='object'?state.eventChains.mysteryCharacter:{active:false,stage:0,branch:'',playerId:'',playerName:'',dueMatchday:-1,completed:false,finale:{eligible:false,categories:[],played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0}};
 const chain=state.eventChains.mysteryCharacter;
 chain.finale=chain.finale&&typeof chain.finale==='object'?chain.finale:{eligible:false,categories:[],played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false};
 return chain;
}
function mysteryGeneratedPlayer(source,tag='guest'){
 const stamp=`${Date.now()}-${Math.floor(Math.random()*1000000)}`;
 return registerGeneratedEventPlayer({...source,id:`event-${tag}-${String(source.id||'player')}-${stamp}`,baseOvr:Math.max(1,Number(source.baseOvr??source.ovr)||60),eventPlayer:true,eventUniverse:tag,club:String(source.club||tag)});
}
function replaceRandomRosterWithMysteryPlayer(source,tag){
 if(talentScoutBlocksExternalArrival())return{blocked:true,message:talentScoutBlockMessage()};
 if(!youngBeautifulAllowsPlayer(source))return{blocked:true,message:youngBeautifulBlockMessage(source)};
 const candidates=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player);
 if(!candidates.length)return{blocked:true,message:'Nessun giocatore disponibile da sostituire.'};
 const target=pick(candidates),incoming=mysteryGeneratedPlayer(source,tag),change=replaceUserRosterPlayer(target.index,incoming);
 if(!change||change.blocked)return{blocked:true,message:change?.message||'Il nuovo giocatore non può essere registrato.'};
 refreshOpponentClubRosters();
 return{...change,index:target.index};
}
function randomFutureMysteryMatchday(){
 const first=Math.min(seasonLength()-1,Number(state.matchday)+1),last=Math.max(first,seasonLength()-1);
 return first+Math.floor(Math.random()*Math.max(1,last-first+1));
}
function recruitTearless(){
 const change=replaceRandomRosterWithMysteryPlayer(TEARLESS_EVENT_PLAYER,'tearless');
 if(change.blocked)return change.message;
 const chain=mysteryCharacterChain();
 Object.assign(chain,{active:true,stage:1,branch:'tearless',playerId:String(change.incoming.id),playerName:String(change.incoming.name),dueMatchday:randomFutureMysteryMatchday(),completed:false,finale:{eligible:false,categories:[],played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0}});
 return `${change.outgoing?.name||'Un giocatore casuale'} lascia il posto a Tearless (51 OVR). Il suo futuro nella squadra si deciderà in un momento casuale della stagione.`;
}
function recruitWorldChampion(){
 if(talentScoutBlocksExternalArrival())return talentScoutBlockMessage();
 const available=ITALIA_2006_EVENT_PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player));
 if(!available.length)return 'Nessun campione del mondo è compatibile con le regole del tuo allenatore.';
 const source=pick(available),change=replaceRandomRosterWithMysteryPlayer(source,'italia-2006');
 if(change.blocked)return change.message;
 const chain=mysteryCharacterChain();
 Object.assign(chain,{active:true,stage:2,branch:'champion',playerId:String(change.incoming.id),playerName:String(change.incoming.name),dueMatchday:-1,completed:false,finale:{eligible:false,categories:[],played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0}});
 return `${change.outgoing?.name||'Un giocatore casuale'} lascia la rosa: arriva ${change.incoming.name} (${Number(change.incoming.ovr)||0} OVR), campione del mondo 2006.`;
}
function updateMysteryGeneratedPlayerOvr(playerId,value){
 const id=String(playerId||''),entry=rosterEntry(id),player=entry?.player||playerById(id);if(!entry||!player)return null;
 const before=Math.max(1,Number(player.ovr)||60),requested=Math.max(1,Math.round(Number(value)||before)),sponsorExtra=requested>before?sponsorOvrExtraFor(requested-before):0,after=requested>before?requested+sponsorExtra:requested;entry.player={...player,ovr:after};if(sponsorExtra)recordBallariniPlayerBonus(id,sponsorExtra);
 const generated=(state.seasonRules.generatedEventPlayers||[]).find(item=>String(item.id)===id);if(generated)generated.ovr=after;
 return entry.player;
}
function resolveTearlessSecondAct(){
 const chain=mysteryCharacterChain(),entry=rosterEntry(chain.playerId);
 chain.active=false;chain.stage=3;chain.dueMatchday=-1;chain.completed=true;
 if(!entry)return{title:'Tearless è introvabile',text:'Il misterioso YouTuber non è più presente nella rosa.',result:'Tearless era già uscito dalla squadra: nessun effetto.'};
 if(Math.random()<.5){
   if(coachIs('ductility'))return{title:'Tearless sa giocare molto bene a 0-0-0',text:'Tearless sostiene di essersi potenziato fino a 150 OVR.',result:'Duttilità impedisce qualsiasi potenziamento esterno: Tearless resta a 51 OVR.'};
   const boosted=updateMysteryGeneratedPlayerOvr(chain.playerId,150);
   return{title:'Tearless sa giocare molto bene a 0-0-0',text:'Tearless ha finalmente capito tutti i segreti del gioco.',result:`${boosted?.name||'Tearless'} si potenzia fino a 150 OVR per il resto della stagione!`};
 }
 const neverPlayed=(Number(state.stats?.appearances?.[String(chain.playerId)])||0)===0;
 const result=removeOwnRosterPlayerPermanently(entry,'la sua completa avversione per 0-0-0');
 if(neverPlayed)unlockAchievement('questo-gioco-fa-schifo');
 return{title:'A Tearless fa schifo questo gioco',text:'Tearless non vuole più sentir parlare di 0-0-0.',result};
}
function mysteryPlayerLeadingBuckets(playerId){
 const labels={goals:'Capocannonieri',assists:'Assist',mvpVotes:'MVP',cleanSheets:'Porte inviolate'};
 return Object.keys(labels).filter(bucket=>meritPlayerLeadsBucket(playerId,bucket)).map(bucket=>labels[bucket]);
}
function prepareMysteryCharacterFinale(){
 const chain=mysteryCharacterChain();
 if(isTeamEliminated(USER_ID)||chain.branch!=='champion'||chain.finale?.played||chain.finale?.eligible)return false;
 const categories=mysteryPlayerLeadingBuckets(chain.playerId);
 if(!categories.length){chain.active=false;chain.completed=true;return false}
 if(categories.length>=2)unlockAchievement('eroe-nazionale');
 chain.active=false;chain.stage=3;chain.finale={eligible:true,categories,played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0};
 state.phase='italia-2006-final';return true;
}
function italia2006OpponentPower(){
 const lineup=ITALIA_2006_FINAL_XI.map(name=>ITALIA_2006_EVENT_PLAYERS.find(player=>player.name===name)).filter(Boolean);
 return lineup.length?lineup.reduce((sum,player)=>sum+(Number(player.ovr)||0),0)/lineup.length:96;
}
function italia2006RosterHtml(){
 const groups=[['Portieri','P'],['Difensori','D'],['Centrocampisti','C'],['Attaccanti','A']];
 return `<div class="final-player-stats-grid">${groups.map(([title,role])=>`<div class="season-report-item"><span>${title}</span><small>${ITALIA_2006_EVENT_PLAYERS.filter(player=>player.role===role).map(player=>`${esc(player.name)} <b>${Number(player.ovr)||0}</b>`).join(' · ')}</small></div>`).join('')}</div>`;
}
function playItalia2006Final(){
 const chain=mysteryCharacterChain(),finale=chain.finale;if(!finale?.eligible||finale.played)return;
 const tableBefore=sortedTable();finale.rankBeforeBonus=tableBefore.findIndex(row=>String(row.id)===String(USER_ID))+1;finale.pointsBeforeBonus=Number(userStanding()?.pts)||0;
 let [gf,ga]=simulateScore(Math.max(35,matchPower()),Math.max(35,italia2006OpponentPower()),.03,90);if(gf===ga){if(Math.random()<.5)gf++;else ga++}
 finale.played=true;finale.userGoals=gf;finale.opponentGoals=ga;finale.won=gf>ga;finale.pointsDelta=finale.won?30:0;
 if(finale.won&&!finale.pointsApplied&&userStanding()){userStanding().pts+=30;finale.pointsApplied=true;unlockAchievement('berlino-ancora-azzurra')}
 finale.rankAfterBonus=sortedTable().findIndex(row=>String(row.id)===String(USER_ID))+1;
 save();render();
}
function finishItalia2006Final(){
 const chain=mysteryCharacterChain();chain.completed=true;
 if(!prepareMeritStoryFinale())state.phase='finished';
 save();render();
}
function showItalia2006Final(){
 const chain=mysteryCharacterChain(),finale=chain.finale,categories=(finale.categories||[]).join(', ')||'classifica individuale';
 if(!finale.played){screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Sfida speciale · Italia 2006</div><h2>Campioni del mondo</h2><div class="final-position">VS</div><p>${esc(chain.playerName||'Il giocatore ricevuto')} ha chiuso al primo posto in: <b>${esc(categories)}</b>.</p></div><div class="panel"><h3>Affronta l’Italia del 2006</h3><p>Se vinci, ottieni <b>+30 punti</b> nella classifica del campionato appena concluso. Una sconfitta non assegna penalità.</p>${italia2006RosterHtml()}<button id="playItalia2006Final" type="button" data-single-action data-busy-announcement="Sfida avviata." class="btn primary">Gioca la sfida</button></div></section>`;document.getElementById('playItalia2006Final').onclick=playItalia2006Final;return}
 screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Sfida Italia 2006 conclusa</div><h2>${finale.won?'Hai battuto i campioni del mondo!':'L’Italia 2006 resiste'}</h2><div class="final-position">${finale.userGoals}–${finale.opponentGoals}</div><p>${esc(state.teamName)} contro l’Italia campione del mondo.</p></div><div class="panel"><h3>${finale.won?'+30 punti in campionato':'Nessun punto bonus'}</h3><p>${finale.won?'Il premio è stato aggiunto alla classifica prima del riepilogo finale.':'La classifica del campionato non viene modificata.'}</p><button id="finishItalia2006Final" class="btn primary">Vai al recap finale</button></div></section>`;document.getElementById('finishItalia2006Final').onclick=finishItalia2006Final;
}

function normalizeTipsterBenchSlots(){
 const bench=state.draft.roster.filter(entry=>entry&&entry.bench);
 bench.forEach((entry,index)=>{entry.slot=`PAN${index+1}`;entry.slotId=`bench-${index+1}`});
}
function enforceTipsterStarters(){
 if(!Array.isArray(state?.draft?.roster)||!state.draft.roster.length)return;
 const forced=state.draft.roster.filter(entry=>entry&&entry.bench&&Number(entry.tipsterForcedMatches)>0);
 forced.forEach(entry=>{
   const player=entry.player||playerById(entry.playerId);if(!player)return;
   const used=new Set(state.draft.roster.filter(item=>item&&!item.bench).map(item=>String(item.slotId)));
   const empty=formationSlots().find(slot=>!used.has(String(slot.instanceId))&&userCompatible(player,slot.code));
   if(empty){entry.bench=false;entry.slot=empty.code;entry.slotId=empty.instanceId;return}
   const starters=state.draft.roster.filter(item=>item&&!item.bench&&Number(item.tipsterForcedMatches)<=0).map(item=>({entry:item,player:item.player||playerById(item.playerId)})).filter(item=>item.player);
   let target=starters.filter(item=>userCompatible(player,item.entry.slot)).sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0];
   if(!target)target=starters.filter(item=>roleOf(item.player)===roleOf(player)).sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0];
   if(!target)target=starters.sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0];
   if(!target)return;
   const benchSlot={slot:entry.slot,slotId:entry.slotId},starterSlot={slot:target.entry.slot,slotId:target.entry.slotId};
   Object.assign(entry,{bench:false,...starterSlot});Object.assign(target.entry,{bench:true,...benchSlot});
 });
 normalizeTipsterBenchSlots();
}
function decrementTipsterObligations(){
 state.draft.roster.forEach(entry=>{if(Number(entry.tipsterForcedMatches)>0){entry.tipsterForcedMatches=Math.max(0,Number(entry.tipsterForcedMatches)-1);entry.tipsterForced=entry.tipsterForcedMatches>0;}});
}
function acceptCassaaaBet(){
 const chain=penguinChain();
 Object.assign(chain,{active:true,stage:1,dueMatchday:Number(state.matchday)+chainedDelay(1,3),mode:'',completed:false});
 pushEffect('forcedScore',1,1,{gf:3,ga:2,source:'Cassaaa'});
 return 'Il pinguino sistema la prossima partita sul 3-2 per te. In cambio prometti di iscriverti al suo canale. Il Capitolo 2 comparirà tra 1 e 3 giornate.';
}
function scrollPenguin(){Object.assign(penguinChain(),{active:false,stage:0,dueMatchday:-1,mode:'',completed:true});return'Ignori il pinguino e ti concentri sulla prossima partita. Nessun effetto.'}
function resolvePenguinLudopatia(){
 const chain=penguinChain();chain.active=true;chain.stage=2;chain.dueMatchday=-1;chain.completed=false;
 if(Math.random()<.5){chain.mode='ludopatia';return 'Scatta la ludopatia: da ora, dopo ogni partita non vinta, perdi definitivamente un giocatore casuale della rosa.'}
 chain.mode='tipster';return 'Diventi un esperto Tipster: dopo ogni vittoria arriva un giocatore casuale, obbligato titolare nella partita successiva al posto di un tuo titolare.';
}
function removeGamblingPlayer(){
 const items=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player);
 if(items.length<=1)return{type:'ludopatia',message:'La ludopatia vorrebbe portarti via un altro giocatore, ma in rosa ne è rimasto soltanto uno.'};
 const chosen=pick(items),lost=chosen.player,lostEntry=chosen.entry;
 if(!lostEntry.bench){
   const bench=items.filter(item=>item.entry.bench&&item.index!==chosen.index);
   let replacement=bench.filter(item=>userCompatible(item.player,lostEntry.slot)).sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
   if(!replacement)replacement=bench.filter(item=>roleOf(item.player)===POSITION_ROLE[lostEntry.slot]).sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
   if(!replacement)replacement=bench.sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
   if(replacement)Object.assign(replacement.entry,{bench:false,slot:lostEntry.slot,slotId:lostEntry.slotId});
 }
 state.draft.roster.splice(chosen.index,1);delete state.statuses[String(lost.id)];delete state.playInjured[String(lost.id)];clearMandatoryMidseasonPlayer(String(lost.id));
 const mental=mentalistaChain();if(String(mental.playerId)===String(lost.id))Object.assign(mental,{active:false,stage:0,dueMatchday:-1,training:false,nature:false,completed:true});
 if(String(state.seasonRules.futureScorerPlayerId||'')===String(lost.id)){state.seasonRules.futureScorerPlayerId='';state.seasonRules.futureScorerPlayerName='';state.seasonRules.futureInjuryZeroPoints=false;}
 normalizeTipsterBenchSlots();refreshOpponentClubRosters();
 return{type:'ludopatia',playerName:lost.name,message:`Ludopatia: ${lost.name} lascia definitivamente la rosa perché non hai vinto la partita.`};
}
function tipsterVictoryPlayer(){
 if(talentScoutBlocksExternalArrival())return{type:'tipster',blocked:true,message:talentScoutBlockMessage()};
 const starters=state.draft.roster.filter(entry=>entry&&!entry.bench).map(entry=>({entry,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player);
 if(!starters.length)return{type:'tipster',message:'Il Tipster non trova un titolare da sostituire.'};
 const freeTargets=starters.filter(item=>Number(item.entry.tipsterForcedMatches)<=0),target=pick(freeTargets.length?freeTargets:starters),rosterIds=new Set(state.draft.roster.map(entry=>String(entry.playerId))),rosterNames=new Set(rosterPlayers().map(item=>normalizeName(item.player.name)));
 let candidates=(PLAYERS||[]).filter(player=>player&&player.id&&youngBeautifulAllowsPlayer(player)&&!rosterIds.has(String(player.id))&&!rosterNames.has(normalizeName(player.name))&&userCompatible(player,target.entry.slot));
 if(!candidates.length)candidates=(PLAYERS||[]).filter(player=>player&&player.id&&youngBeautifulAllowsPlayer(player)&&!rosterIds.has(String(player.id))&&!rosterNames.has(normalizeName(player.name))&&roleOf(player)===POSITION_ROLE[target.entry.slot]);
 if(!candidates.length)candidates=(PLAYERS||[]).filter(player=>player&&player.id&&youngBeautifulAllowsPlayer(player)&&!rosterIds.has(String(player.id))&&!rosterNames.has(normalizeName(player.name)));
 if(!candidates.length)return{type:'tipster',message:'Il Tipster non trova nuovi giocatori disponibili nel database.'};
 const source=pick(candidates),incoming=eventPlayerClone(source,'tipster'),outgoing={...target.entry,player:{...target.player},bench:true,tipsterForced:false,tipsterForcedMatches:0};
 state.draft.roster.push(outgoing);target.entry.playerId=String(incoming.id);target.entry.player={...incoming,tipsterPlayer:true};target.entry.bench=false;target.entry.tipsterForced=true;target.entry.tipsterForcedMatches=1;
 state.statuses[String(incoming.id)]={injury:0,suspension:0,seasonOut:false,seasonOutReason:''};normalizeTipsterBenchSlots();enforceTipsterStarters();refreshOpponentClubRosters();
 return{type:'tipster',playerName:incoming.name,replacedName:target.player.name,message:`Tipster: arriva ${incoming.name} (${Number(incoming.ovr)||60} OVR), obbligato titolare nella prossima partita. ${target.player.name} va in panchina.`};
}
function tickPenguinAfterMatch(result){
 decrementTipsterObligations();
 const chain=penguinChain();if(!result||!chain.active||chain.stage!==2||!chain.mode)return;
 const won=Number(result.gf)>Number(result.ga);let update=null;
 if(chain.mode==='ludopatia'&&!won){chain.nonWins=Math.max(0,Number(chain.nonWins)||0)+1;update=removeGamblingPlayer()}
 if(chain.mode==='tipster'&&won){chain.wins=Math.max(0,Number(chain.wins)||0)+1;update=tipsterVictoryPlayer()}
 if(update){result.penguinUpdate=update;recordSeasonEvent({kind:'auto',title:chain.mode==='ludopatia'?'Ludopatia':'Esperto Tipster',choice:won?'Vittoria':'Partita non vinta',effect:update.message,result:update.message,automatic:true},analyticsSnapshot())}
}

function questState(){
 state.quest=state.quest&&typeof state.quest==='object'?state.quest:{active:false,id:'',title:'',status:'idle',acceptedMatchday:-1,matchesPlayed:0,progress:0,target:0,deadlineMatches:0,targetPlayerId:'',targetPlayerName:'',targetTeamIds:[],facedTeamIds:[],rewardActive:false,objective:'',reward:'',penalty:'',summary:'',notice:'',awaitingPlayerSelection:false};
 return state.quest;
}
function questIsActive(id=''){const q=questState();return Boolean(q.active&&(!id||String(q.id)===String(id)))}
function questCanStart(matches=1){return !questState().active&&Number(state.matchday)+Math.max(1,Number(matches)||1)<=seasonLength()}
function questPermanentRounds(){return 9999}
function questBestAttacker(){return [...rosterPlayers()].filter(entry=>roleOf(entry.player)==='A').sort((a,b)=>(Number(b.player?.ovr)||0)-(Number(a.player?.ovr)||0))[0]||null}
function questBestPlayer(){return [...rosterPlayers()].sort((a,b)=>(Number(b.player?.ovr)||0)-(Number(a.player?.ovr)||0))[0]||null}
function questRivalKey(name=''){
 const normalized=normalizeName(name);
 if(normalized.includes('juventus'))return'juventus';
 if(normalized==='milan'||normalized.includes('ac milan'))return'milan';
 if(normalized==='inter'||normalized.includes('internazionale')||normalized.startsWith('inter '))return'inter';
 return'';
}
function questCurveTeams(){const found={};state.teams.filter(team=>team.id!==USER_ID).forEach(team=>{const key=questRivalKey(team.name);if(key&&!found[key])found[key]=team});return['juventus','milan','inter'].map(key=>found[key]).filter(Boolean)}
function questCurveAvailable(){
 if(!questCanStart(1))return false;
 const rivals=questCurveTeams();if(rivals.length!==3)return false;
 const future=(state.schedule||[]).slice(Number(state.matchday)||0).flat();
 return rivals.every(team=>future.some(match=>String(match.home)===String(team.id)||String(match.away)===String(team.id)));
}
function startSeasonQuest(config={}){
 const q=questState();if(q.active)return'Hai già una quest attiva: completala prima di accettarne un’altra.';
 Object.assign(q,{active:true,id:String(config.id||''),title:String(config.title||'Quest'),status:'active',acceptedMatchday:Number(state.matchday),matchesPlayed:0,progress:0,target:Math.max(0,Number(config.target)||0),deadlineMatches:Math.max(0,Number(config.deadlineMatches)||0),targetPlayerId:String(config.targetPlayerId||''),targetPlayerName:String(config.targetPlayerName||''),targetTeamIds:(config.targetTeamIds||[]).map(String),facedTeamIds:[],rewardActive:false,objective:String(config.objective||''),reward:String(config.reward||''),penalty:String(config.penalty||''),summary:'',notice:'',awaitingPlayerSelection:false});
 return `Quest accettata: ${q.title}. ${q.objective}`;
}
function finishSeasonQuest(success,message,result=null){
 const q=questState();q.active=false;q.awaitingPlayerSelection=false;q.status=success?'success':'failure';q.summary=String(message||'');q.completedMatchday=Number(state.matchday)+1;
 const update={success:Boolean(success),title:q.title,message:q.summary};
 if(success){
   const achievementByQuest={
     'like-a-bomber':'like-a-bomber',
     'fair-play-finanziario':'conti-in-ordine',
     'la-curva':'tre-classiche',
     'milanlab':'milanlab-certificato',
     'calcio-champagne':'calcio-champagne'
   };
   const achievementId=achievementByQuest[String(q.id||'')];if(achievementId)unlockAchievement(achievementId);
 }
 const target=result||((state.lastResult&&Number(state.lastResult.matchday)===Number(state.matchday)+1)?state.lastResult:null);
 if(target){target.questUpdates=Array.isArray(target.questUpdates)?target.questUpdates:[];target.questUpdates.push(update)}
 recordSeasonEvent({kind:'quest',title:q.title,choice:success?'Quest completata':'Quest fallita',effect:success?q.reward:q.penalty,result:q.summary,automatic:true},analyticsSnapshot());
 return q.summary;
}
function acceptLikeBomberQuest(){const attacker=questBestAttacker();if(!attacker)return'Nessun attaccante disponibile.';return startSeasonQuest({id:'like-a-bomber',title:'Like a bomber',target:10,deadlineMatches:5,targetPlayerId:attacker.playerId,targetPlayerName:attacker.player.name,objective:'Segna almeno 10 gol nelle prossime 5 partite.',reward:`${attacker.player.name} ottiene +8 OVR fino a fine stagione.`,penalty:`${attacker.player.name} viene portato a 50 OVR fino a fine stagione.`})}
function acceptFairPlayQuest(){return startSeasonQuest({id:'fair-play-finanziario',title:'Fair play finanziario',target:9,deadlineMatches:4,objective:'Conquista almeno 9 punti nelle prossime 4 giornate.',reward:'Sei pulito: nessuna penalizzazione.',penalty:'Penalizzazione di 6 punti.'})}
function rejectFairPlayQuest(){const standing=userStanding();if(standing)standing.pts-=1;return'Patteggi: perdi immediatamente 1 punto e la missione non parte.'}
function acceptCurvaQuest(){const rivals=questCurveTeams();if(rivals.length!==3)return'Juventus, Milan e Inter non sono tutte presenti tra le avversarie disponibili.';return startSeasonQuest({id:'la-curva',title:'La curva',target:3,targetTeamIds:rivals.map(team=>team.id),objective:'Non perdere contro Juventus, Milan e Inter.',reward:'+5 OVR a tutta la squadra finché non perdi una partita.',penalty:'-5 OVR a tutta la squadra fino a fine stagione.'})}
function acceptAmmazzaGrandiQuest(){return startSeasonQuest({id:'ammazza-grandi',title:'Ammazza grandi',target:1,deadlineMatches:6,objective:'Nelle prossime 6 giornate batti almeno una squadra che, prima della partita, si trova nelle prime 3 posizioni.',reward:'+5 OVR fino a fine stagione a tutti i giocatori con OVR base inferiore a 80.',penalty:'Il tuo miglior giocatore perde 6 OVR fino a fine stagione.'})}
function acceptMilanLabQuest(){return startSeasonQuest({id:'milanlab',title:'MilanLab',target:5,deadlineMatches:5,objective:'Completa 5 giornate senza nuovi infortuni.',reward:'Immunità dagli infortuni per le successive 5 giornate.',penalty:'Il primo infortunio dura il doppio del previsto.'})}
function acceptChampagneQuest(){return startSeasonQuest({id:'calcio-champagne',title:'Calcio champagne',target:3,deadlineMatches:3,objective:'Segna almeno 2 gol in ciascuna delle prossime 3 partite.',reward:'Ogni vittoria nelle successive 6 giornate vale 1 punto aggiuntivo.',penalty:'Ogni pareggio nelle successive 6 giornate viene trasformato in sconfitta.'})}
function acceptBaroneSportivoChallenge(){const response=startSeasonQuest({id:'barone-sportivo',title:'La sfida del Barone Sportivo',target:5,deadlineMatches:3,objective:'Fai segnare almeno 5 giocatori diversi nelle prossime 3 partite.',reward:'+5 OVR fino a fine stagione ai primi 5 marcatori diversi.',penalty:'Nessun bonus.'});const q=questState();if(q.id==='barone-sportivo'&&q.active){q.scorerIds=[];q.scorerNames={}}return response}
function questTargetRosterEntry(q=questState(),fallback=questBestAttacker()){return rosterEntry(q.targetPlayerId)||fallback||null}
function questOpponentIsTopThree(opponentId){return questIsActive('ammazza-grandi')&&sortedTable().slice(0,3).some(row=>String(row.id)===String(opponentId))}
function questProgressText(q=questState()){
 if(q.id==='like-a-bomber')return `${q.progress}/${q.target} gol · ${q.matchesPlayed}/${q.deadlineMatches} partite`;
 if(q.id==='fair-play-finanziario')return `${q.progress}/${q.target} punti · ${q.matchesPlayed}/${q.deadlineMatches} giornate`;
 if(q.id==='la-curva')return `${q.facedTeamIds.length}/${q.targetTeamIds.length} grandi rivali affrontate`;
 if(q.id==='ammazza-grandi')return `${q.matchesPlayed}/${q.deadlineMatches} giornate · ${q.progress}/${q.target} vittorie contro una top 3`;
 if(q.id==='milanlab')return `${q.matchesPlayed}/${q.deadlineMatches} giornate senza infortuni`;
 if(q.id==='calcio-champagne')return `${q.progress}/${q.target} partite con almeno 2 gol`;
 if(q.id==='barone-sportivo')return `${q.progress}/${q.target} marcatori diversi · ${q.matchesPlayed}/${q.deadlineMatches} partite`;
 if(q.id==='un-leader-per-la-squadra')return q.awaitingPlayerSelection?'Leader da scegliere':`${q.progress}/${q.target} punti · ${q.matchesPlayed}/${q.deadlineMatches} partite`;
 return `${q.matchesPlayed}/${q.deadlineMatches}`;
}
function renderActiveQuest(){
 const q=questState();if(!q.active)return'';
 const ratio=q.id==='la-curva'?(q.targetTeamIds.length?q.facedTeamIds.length/q.targetTeamIds.length:0):(q.target?Math.min(1,q.progress/q.target):(q.deadlineMatches?Math.min(1,q.matchesPlayed/q.deadlineMatches):0));
 return `<div class="quest-card"><div class="quest-card-head"><span>🎯 Quest attiva</span><b>${esc(q.title)}</b></div><p>${esc(q.objective)}</p><div class="quest-progress"><span style="width:${Math.round(clamp(ratio,0,1)*100)}%"></span></div><div class="quest-progress-copy"><strong>${esc(questProgressText(q))}</strong>${q.deadlineMatches?`<span>${Math.max(0,q.deadlineMatches-q.matchesPlayed)} giornate rimaste</span>`:''}</div><div class="quest-stakes"><small><b>Successo:</b> ${esc(q.reward)}</small><small><b>Fallimento:</b> ${esc(q.penalty)}</small></div>${q.notice?`<div class="quest-notice">${esc(q.notice)}</div>`:''}${typeof renderLeaderQuestSelection==='function'?renderLeaderQuestSelection(q):''}</div>`;
}
function failMilanLabForInjury(entry,rounds){
 const q=questState();if(!questIsActive('milanlab'))return Math.max(1,Number(rounds)||1);
 const doubled=Math.max(2,(Math.max(1,Number(rounds)||1))*2),name=entry?.player?.name||playerById(entry?.playerId)?.name||'Il giocatore';
 finishSeasonQuest(false,`${name} si è infortunato: la durata passa da ${Math.max(1,Number(rounds)||1)} a ${doubled} giornate.`);
 return doubled;
}
function tickSeasonQuestAfterMatch(result){
 if(!result)return;
 if(state.seasonRules.laCurvaRewardActive&&Number(result.gf)<Number(result.ga)){
   state.activeEffects=state.activeEffects.filter(effect=>String(effect.source||'')!=='quest-la-curva-reward');state.seasonRules.laCurvaRewardActive=false;
   result.questUpdates=Array.isArray(result.questUpdates)?result.questUpdates:[];result.questUpdates.push({success:false,title:'La curva',message:'La serie positiva è terminata: rimosso il bonus di +5 OVR.'});
 }
 const q=questState();if(!q.active)return;
 if(q.id==='un-leader-per-la-squadra'){if(typeof tickLeaderQuestAfterMatch==='function')tickLeaderQuestAfterMatch(result);return}
 if(q.id==='barone-sportivo'){
   q.matchesPlayed++;
   q.scorerIds=Array.isArray(q.scorerIds)?q.scorerIds.map(String):[];
   q.scorerNames=q.scorerNames&&typeof q.scorerNames==='object'?q.scorerNames:{};
   (Array.isArray(result.goals)?result.goals:[]).forEach(goal=>{const id=String(goal?.playerId||'');if(!id||q.scorerIds.includes(id))return;q.scorerIds.push(id);q.scorerNames[id]=String(goal?.player||playerById(id)?.name||'Marcatore')});
   q.progress=q.scorerIds.length;
   if(q.progress>=q.target){const rewarded=q.scorerIds.slice(0,5);rewarded.forEach(id=>pushSeasonEffect('playerOvr',5,{playerId:id,source:'Sfida Barone Sportivo'}));const names=rewarded.map(id=>q.scorerNames[id]||playerById(id)?.name||'Giocatore');finishSeasonQuest(true,`Sfida vinta: ${names.join(', ')} ricevono +5 OVR fino a fine stagione.`,result)}
   else if(q.matchesPlayed>=q.deadlineMatches)finishSeasonQuest(false,`Sfida fallita: hanno segnato ${q.progress} giocatori diversi su 5. Nessun bonus assegnato.`,result);
   return;
 }
 if(q.id==='like-a-bomber'){
   q.matchesPlayed++;q.progress+=Math.max(0,Number(result.gf)||0);
   if(q.progress>=q.target){const entry=questTargetRosterEntry(q);if(entry)pushSeasonEffect('playerOvr',8,{playerId:String(entry.playerId),source:'quest-like-a-bomber'});finishSeasonQuest(true,`${entry?.player?.name||q.targetPlayerName||'Il miglior attaccante'} ottiene +8 OVR fino a fine stagione.`,result)}
   else if(q.matchesPlayed>=q.deadlineMatches){const entry=questTargetRosterEntry(q);if(entry)entry.player={...(entry.player||playerById(entry.playerId)),ovr:50,questOvrLock:50};finishSeasonQuest(false,`${entry?.player?.name||q.targetPlayerName||'Il miglior attaccante'} viene portato a 50 OVR fino a fine stagione.`,result)}
   return;
 }
 if(q.id==='fair-play-finanziario'){
   q.matchesPlayed++;q.progress+=Math.max(0,Number(result.pointsAwarded)||0);
   if(q.progress>=q.target)finishSeasonQuest(true,'Sei pulito: il controllo si chiude senza penalizzazioni.',result);
   else if(q.matchesPlayed>=q.deadlineMatches){if(userStanding())userStanding().pts-=6;finishSeasonQuest(false,'Fair play finanziario fallito: penalizzazione di 6 punti.',result)}
   return;
 }
 if(q.id==='la-curva'){
   const opponentId=String(result.opponentId||'');
   if(q.targetTeamIds.includes(opponentId)&&!q.facedTeamIds.includes(opponentId)){
     if(Number(result.gf)<Number(result.ga)){pushSeasonEffect('teamOvr',-5,{source:'quest-la-curva-penalty'});finishSeasonQuest(false,'Hai perso contro una delle tre grandi: -5 OVR a tutta la squadra fino a fine stagione.',result);return}
     q.facedTeamIds.push(opponentId);q.progress=q.facedTeamIds.length;
     if(q.facedTeamIds.length>=q.targetTeamIds.length){pushSeasonEffect('teamOvr',5,{source:'quest-la-curva-reward'});state.seasonRules.laCurvaRewardActive=true;finishSeasonQuest(true,'Fedeltà dimostrata: +5 OVR a tutta la squadra finché non perderai una partita.',result)}
   }
   return;
 }
 if(q.id==='ammazza-grandi'){
   q.matchesPlayed++;
   if(result.questOpponentTop3Before&&Number(result.gf)>Number(result.ga)){
     q.progress=1;rosterPlayers().forEach(entry=>{const base=Number(playerById(entry.playerId)?.ovr??entry.player?.ovr)||0;if(base<80)pushSeasonEffect('playerOvr',5,{playerId:String(entry.playerId),source:'quest-ammazza-grandi'})});finishSeasonQuest(true,'Impresa riuscita: tutti i giocatori con OVR base inferiore a 80 ricevono +5 OVR fino a fine stagione.',result);
   }else if(q.matchesPlayed>=q.deadlineMatches){const entry=questBestPlayer();if(entry)pushSeasonEffect('playerOvr',-6,{playerId:String(entry.playerId),source:'quest-ammazza-grandi-penalty'});finishSeasonQuest(false,`${entry?.player?.name||'Il miglior giocatore'} perde 6 OVR fino a fine stagione.`,result)}
   return;
 }
 if(q.id==='milanlab'){
   q.matchesPlayed++;q.progress=q.matchesPlayed;
   if(q.matchesPlayed>=q.deadlineMatches){pushEffect('injuryImmunity',1,6,{source:'quest-milanlab'});finishSeasonQuest(true,'MilanLab approva il lavoro: immunità dagli infortuni per le prossime 5 giornate.',result)}
   return;
 }
 if(q.id==='calcio-champagne'){
   q.matchesPlayed++;
   if(Number(result.gf)<2){pushEffect('drawBecomesLoss',1,7,{source:'quest-calcio-champagne-penalty'});finishSeasonQuest(false,'Spettacolo insufficiente: per le prossime 6 giornate ogni pareggio verrà trasformato in sconfitta.',result);return}
   q.progress++;
   if(q.progress>=q.target){pushEffect('extraWinPoint',1,7,{source:'quest-calcio-champagne-reward'});finishSeasonQuest(true,'Calcio champagne completato: per le prossime 6 giornate ogni vittoria vale 1 punto aggiuntivo.',result)}
 }
}

function chainedDelay(min=2,max=5){return Math.max(1,Math.floor(min+Math.random()*(Math.max(min,max)-min+1)))}
function chickenRosterEntry(){const chain=mentalistaChain();return state.draft.roster.find(entry=>String(entry.playerId)===String(chain.playerId))||null}
function beginMentalistaChicken(entry,originalOvr){
 const chain=mentalistaChain();
 Object.assign(chain,{active:true,stage:1,playerId:String(entry.playerId),playerName:String(entry.player?.name||''),originalOvr:Math.max(1,Number(originalOvr)||1),dueMatchday:Number(state.matchday)+chainedDelay(2,5),training:false,nature:false,goals:0,completed:false});
}
function trainChicken(){
 const chain=mentalistaChain(),entry=chickenRosterEntry();if(!entry){Object.assign(chain,{active:false,stage:0,dueMatchday:-1,training:false,nature:false,completed:true});return 'Il pollo non è più presente in rosa.';}
 chain.active=true;chain.stage=2;chain.training=true;chain.nature=false;chain.dueMatchday=-1;
 entry.player={...(entry.player||playerById(entry.playerId)),ovr:Math.max(1,Number(entry.player?.ovr)||1),isChicken:true,chickenOriginalOvr:chain.originalOvr};
 return `${chain.playerName||entry.player.name} resta un pollo, ma da ora guadagnerà tra 1 e 5 OVR dopo ogni giornata.`;
}
function veterinarianChicken(){
 const chain=mentalistaChain(),entry=chickenRosterEntry();if(!entry){Object.assign(chain,{active:false,stage:0,dueMatchday:-1,training:false,nature:false,completed:true});return 'Il pollo non è più presente in rosa.';}
 const current=entry.player||playerById(entry.playerId);entry.player={...current,ovr:chain.originalOvr,isChicken:false,isChickenKing:false};
 const injured=setOwnPlayerInjury(entry,5);const status=statusOf(entry.playerId);status.seasonOut=false;status.seasonOutReason='';
 Object.assign(chain,{active:false,stage:0,training:false,nature:false,dueMatchday:-1,completed:true});
 return injured?`${entry.player.name} torna umano e recupera ${chain.originalOvr} OVR, ma salterà le prossime 5 partite.`:`${entry.player.name} torna umano e recupera ${chain.originalOvr} OVR. La protezione della Coppa evita l’infortunio.`;
}
function acceptChickenNature(){
 const chain=mentalistaChain(),entry=chickenRosterEntry();if(!entry){Object.assign(chain,{active:false,stage:0,dueMatchday:-1,training:false,nature:false,completed:true});return 'Il pollo non è più presente in rosa.';}
 chain.active=true;chain.stage=2;chain.training=false;chain.nature=true;chain.dueMatchday=-1;
 entry.player={...(entry.player||playerById(entry.playerId)),ovr:1,isChicken:true,chickenOriginalOvr:chain.originalOvr};
 return `${chain.playerName||entry.player.name} resta a 1 OVR. Da ora ogni suo gol vale doppio.`;
}
function applyChickenGoalRule(events){
 const chain=mentalistaChain();if(!chain.active||chain.stage!==2||!chain.nature)return;
 (events||[]).forEach(event=>{if(String(event.playerId)===String(chain.playerId)){event.goalValue=Math.max(1,Number(event.goalValue)||1)*2;event.isChickenDoubleGoal=true;event.description=`${event.description||''} Il gol del pollo vale doppio.`.trim();}});
}
function crownChickenKing(){
 const chain=mentalistaChain(),entry=chickenRosterEntry();if(!entry){Object.assign(chain,{active:false,completed:true});return 'Il pollo non è più presente in rosa.'}
 const current=entry.player||playerById(entry.playerId),newOvr=Math.max(Number(current?.ovr)||1,chain.originalOvr+10);
 entry.player={...current,ovr:newOvr,isChicken:false,isChickenKing:true,chickenOriginalOvr:chain.originalOvr};
 Object.assign(chain,{active:false,stage:0,training:false,nature:false,dueMatchday:-1,completed:true});
 return `${entry.player.name} torna umano come Re del Pollaio: ${newOvr} OVR, superiore al suo valore originale di ${chain.originalOvr}.`;
}
function collaborateWithGeneral(){
 const chain=generalChain(),italians=rosterPlayers().filter(entry=>isItalianPlayer(entry.player));
 italians.forEach(entry=>pushSeasonEffect('playerChem',3,{playerId:String(entry.playerId),source:'Controllo dei documenti'}));
 chain.active=true;chain.stage=2;chain.dueMatchday=Number(state.matchday)+chainedDelay(3,6);chain.completed=false;
 return `${italians.length} giocatori italiani ricevono +3 Intesa fino a fine stagione. Il generale continuerà a osservare la squadra.`;
}
function findGeneralReplacementEntry(record){
 let index=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(record.replacementId));
 if(index<0&&record.slotId)index=state.draft.roster.findIndex(entry=>String(entry.slotId)===String(record.slotId));
 return index;
}
function hideForeignPlayerFromGeneral(){
 const chain=generalChain(),records=(chain.replacements||[]).filter(record=>record?.originalPlayer&&!record.recovered);
 if(!records.length){chain.active=false;chain.completed=true;return 'Non ci sono giocatori stranieri sostituiti da recuperare.'}
 const record=[...records].sort((a,b)=>(Number(b.originalPlayer?.ovr)||0)-(Number(a.originalPlayer?.ovr)||0))[0],index=findGeneralReplacementEntry(record);
 if(index<0){chain.active=false;chain.completed=true;return `${record.originalPlayer.name} non può più essere reinserito perché il suo posto in rosa è cambiato.`}
 replaceUserRosterPlayer(index,{...record.originalPlayer,id:String(record.originalPlayer.id)});record.recovered=true;
 if(record.originalStatus)state.statuses[String(record.originalPlayer.id)]={...record.originalStatus};
 const discovered=Math.random()<.5;if(discovered&&state.standings?.[USER_ID])state.standings[USER_ID].pts-=3;
 chain.active=false;chain.stage=0;chain.completed=true;chain.dueMatchday=-1;refreshOpponentClubRosters();
 return discovered?`${record.originalPlayer.name} torna in rosa, ma il generale scopre l’inganno: -3 punti in classifica.`:`${record.originalPlayer.name} torna in rosa e il generale non scopre nulla.`;
}
function dismissGeneral(){
 const chain=generalChain();let restored=0;
 (chain.replacements||[]).forEach(record=>{const index=findGeneralReplacementEntry(record);if(index<0||!record.originalPlayer)return;replaceUserRosterPlayer(index,{...record.originalPlayer,id:String(record.originalPlayer.id)});if(record.originalStatus)state.statuses[String(record.originalPlayer.id)]={...record.originalStatus};restored++;});
 pushSeasonEffect('teamChemMultiplier',.5,{source:'Generale cacciato'});
 Object.assign(chain,{active:false,stage:0,dueMatchday:-1,nationalBoostPending:false,completed:true});refreshOpponentClubRosters();
 return `Il generale viene cacciato: ${restored} giocatori originali tornano in rosa, ma l’Intesa della squadra è dimezzata fino a fine stagione.`;
}
function activateNationalFantaballa(){
 const chain=generalChain();
 pushEffect('forcedScore',1,1,{gf:0,ga:3,source:'Nazionale Fantaballa'});
 chain.nationalBoostPending=true;chain.active=false;chain.stage=0;chain.dueMatchday=-1;chain.completed=true;
 return 'La rosa tutta italiana viene convocata dalla Nazionale Fantaballa: salterà la prossima partita di campionato. Dopo il rientro avrà +5 OVR per 3 giornate.';
}
function activatePendingNationalBoost(){
 const chain=generalChain();if(!chain.nationalBoostPending)return;
 chain.nationalBoostPending=false;pushEffect('teamOvr',5,3,{source:'Nazionale Fantaballa'});
}
function allRosterItalian(){const entries=rosterPlayers();return Boolean(entries.length)&&entries.every(entry=>isItalianPlayer(entry.player))}
function queueChainedDecision(decisionId){
 const decision=DECISIONS.find(item=>item.id===decisionId);if(!decision)return false;
 const context=decision.createContext?decision.createContext():{},eventTitle=typeof decision.title==='function'?decision.title(context):decision.title,eventText=decision.describe?decision.describe(context):decision.text,decisionIndex=DECISIONS.indexOf(decision);
 if(state.seasonRules.autoDecisions){const choiceIndex=Math.floor(Math.random()*decision.choices.length),choice=decision.choices[choiceIndex],before=analyticsSnapshot(),result=applyDecisionChoice(decisionIndex,choiceIndex,context,decision.id);recordSeasonEvent({kind:'decision',title:eventTitle,choice:choice?.label||'',effect:choice?.effect||'',result,automatic:true},before);state.pendingEvent={kind:'decision',chained:true,resolved:true,title:eventTitle,text:eventText,decisionId:decision.id,decisionIndex,context,result:`Decisione automatica. ${result}`};}
 else state.pendingEvent={kind:'decision',chained:true,resolved:false,title:eventTitle,text:eventText,decisionId:decision.id,decisionIndex,context};
 return true;
}
function queueChainedAuto(title,text,result){
 const before=analyticsSnapshot();recordSeasonEvent({kind:'auto',title,choice:'Evento concatenato',effect:text,result,automatic:true},before);state.pendingEvent={kind:'auto',chained:true,resolved:true,title,text,result};return true;
}
function prepareChainedEvent(){
 if(typeof prepareCustomUserChainedEvent==='function'&&prepareCustomUserChainedEvent())return true;
 const mental=mentalistaChain(),general=generalChain(),penguin=penguinChain(),mystery=mysteryCharacterChain(),day=Number(state.matchday);
 if(mental.active&&mental.stage===3&&day>=Number(mental.dueMatchday)){return queueChainedAuto('Il re del pollaio','Il pollo ha segnato almeno tre gol e completa la sua trasformazione.',crownChickenKing())}
 if(mystery.active&&mystery.branch==='tearless'&&mystery.stage===1&&day>=Number(mystery.dueMatchday)){const outcome=resolveTearlessSecondAct();return queueChainedAuto(outcome.title,outcome.text,outcome.result)}
 if(mental.active&&mental.stage===1&&day>=Number(mental.dueMatchday)){if(!chickenRosterEntry()){Object.assign(mental,{active:false,stage:0,dueMatchday:-1,completed:true});return false}return queueChainedDecision('mentalista-pollaio')}
 if(penguin.active&&penguin.stage===1&&day>=Number(penguin.dueMatchday))return queueChainedAuto('Ludopatia','Il misterioso pinguino torna per rivelare le conseguenze della scommessa.',resolvePenguinLudopatia());
 if(general.active&&general.stage===1&&day>=Number(general.dueMatchday))return queueChainedDecision('generale-documenti');
 if(general.active&&general.stage===2&&day>=Number(general.dueMatchday)){
   if(allRosterItalian())return queueChainedAuto('La nazionale Fantaballa','La rosa è ancora interamente italiana e riceve una convocazione inattesa.',activateNationalFantaballa());
   Object.assign(general,{active:false,stage:0,dueMatchday:-1,completed:true});
 }
 return false;
}
function tickEventChainsAfterMatch(result){
 const chain=mentalistaChain();
 if(chain.active&&chain.stage===2){
   const goals=(Array.isArray(result?.goals)?result.goals:[]).filter(goal=>String(goal.playerId)===String(chain.playerId)).length;
   if(goals){chain.goals+=goals;if(result)result.chickenGoals={playerName:chain.playerName,count:goals,total:chain.goals,double:Boolean(chain.nature)};}
   const entry=chickenRosterEntry();
   if(!entry){Object.assign(chain,{active:false,stage:0,dueMatchday:-1,training:false,nature:false,completed:true});return}
   if(goals&&entry.player?.isChicken&&Number(entry.player?.ovr)===1)unlockAchievement('il-pollo-d-oro');
   if(chain.training&&entry){const baseGain=1+Math.floor(Math.random()*5),sponsorExtra=sponsorOvrExtraFor(baseGain),gain=baseGain+sponsorExtra,current=entry.player||playerById(entry.playerId);entry.player={...current,ovr:Math.max(1,Number(current?.ovr)||1)+gain,isChicken:true,chickenOriginalOvr:chain.originalOvr};if(sponsorExtra)recordBallariniPlayerBonus(entry.playerId,sponsorExtra);if(result)result.chickenTraining={playerName:entry.player.name,gain,newOvr:entry.player.ovr};}
   if(chain.goals>=3){chain.stage=3;chain.dueMatchday=Number(state.matchday)+1;chain.training=false;chain.nature=false;}
 }
 tickPenguinAfterMatch(result);
}

