function activateSpaceJamTalentChallenge(){
 state.seasonRules.spaceJamRule='talent-steal';state.seasonRules.spaceJamTalentPending=true;state.seasonRules.spaceJamLastOutcome='';
 return 'La sfida di Space Jam vale per la prossima partita: una vittoria trasferirà il miglior giocatore avversario nella tua rosa; una sconfitta ti farà perdere il tuo miglior giocatore.';
}
function activateSpaceJamRandomKickoff(){
 state.seasonRules.spaceJamRule='random-kickoff';state.seasonRules.spaceJamTalentPending=false;state.seasonRules.spaceJamLastOutcome='';
 return 'Bib Bip! attivo fino a fine stagione: ogni partita di campionato verrà caricata da un minuto casuale compreso tra 0 e la durata prevista dal regolamento.';
}
function spaceJamRandomKickoffActive(){return String(state.seasonRules?.spaceJamRule)==='random-kickoff'}
function spaceJamMatchTiming(totalDuration=90){
 const total=Math.max(0,Math.floor(Number(totalDuration)||0));if(!spaceJamRandomKickoffActive())return{active:false,totalMinutes:total,startMinute:0,remainingMinutes:total};
 const startMinute=Math.floor(Math.random()*(total+1));return{active:true,totalMinutes:total,startMinute,remainingMinutes:Math.max(0,total-startMinute)};
}
function normalizeGoalEventsToWindow(events,startMinute=0,endMinute=90){
 const start=clamp(Math.floor(Number(startMinute)||0),0,Math.max(0,Math.floor(Number(endMinute)||90))),end=Math.max(start,Math.floor(Number(endMinute)||90));
 (Array.isArray(events)?events:[]).forEach(event=>{const minute=Math.floor(Number(event?.minute)||start);if(minute<start||minute>end){event.minute=start>=end?end:start+Math.floor(Math.random()*Math.max(1,end-start+1));event.goalValue=Math.max(1,Number(goalValueForMinute(event.minute))||1)}});
 return events;
}
function spaceJamOpponentBestPlayer(team){return [...opponentRosterPlayers(team).filter(player=>player&&!player.isMascot)].sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0)||originalBaseOvr(b)-originalBaseOvr(a)||String(a.name).localeCompare(String(b.name),'it'))[0]||null}
function spaceJamReplacementTarget(incoming){
 const rows=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player),incomingRole=roleOf(incoming);
 const correct=rows.filter(item=>item.entry.bench?roleOf(item.player)===incomingRole:userCompatible(incoming,item.entry.slot));
 const sameRole=rows.filter(item=>roleOf(item.player)===incomingRole),pool=correct.length?correct:sameRole.length?sameRole:rows;
 return [...pool].sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0)||Number(a.entry.bench)-Number(b.entry.bench))[0]||null;
}
function spaceJamStealBestOpponentPlayer(opponent){
 if(playerArrivalIsBlocked())return playerArrivalBlockMessage();
 const incoming=spaceJamOpponentBestPlayer(opponent),target=incoming?spaceJamReplacementTarget(incoming):null;if(!incoming||!target)return 'La distorsione non trova giocatori validi da trasferire.';
 const outgoing=target.player,outgoingId=String(target.entry.playerId||outgoing.id||''),incomingId=String(incoming.id||'');
 target.entry.playerId=incomingId;target.entry.player={...incoming,id:incomingId,club:USER_ID,spaceJamStolen:true,spaceJamFromTeamId:String(opponent?.id||''),spaceJamFromTeamName:String(opponent?.name||'')};
 if(outgoingId){delete state.playInjured[outgoingId];delete state.statuses[outgoingId];clearMandatoryMidseasonPlayer(outgoingId)}
 state.statuses[incomingId]={injury:0,suspension:0,seasonOut:false,seasonOutReason:''};
 if(opponent){opponent.roster=(Array.isArray(opponent.roster)?opponent.roster:[]).filter(id=>String(id)!==incomingId);if(opponent.playerOverrides)delete opponent.playerOverrides[incomingId];if(opponent.statuses)delete opponent.statuses[incomingId]}
 if(state.stats?.playerTeams){state.stats.playerTeams[incomingId]=USER_ID;state.stats.playerTeamNames[incomingId]=state.teamName}
 normalizeTipsterBenchSlots();refreshOpponentClubRosters();
 return `${incoming.name} (${Number(incoming.ovr)||0} OVR) viene rubato a ${opponent?.name||'gli avversari'} e prende il posto di ${outgoing.name} nel ruolo ${target.entry.slot||incoming.Position||roleOf(incoming)}.`;
}
function spaceJamLoseBestPlayer(){
 const entries=rosterPlayers().filter(entry=>entry?.player),best=[...entries].sort((a,b)=>(ductilityEffectiveBaseOvr(b.player)+activeOvrBonus(b.player))-(ductilityEffectiveBaseOvr(a.player)+activeOvrBonus(a.player))||String(a.player.name).localeCompare(String(b.player.name),'it'))[0];
 return best?removeOwnRosterPlayerPermanently(best,'la sconfitta nella sfida di Space Jam'):'Nessun giocatore disponibile da perdere.';
}
function resolveSpaceJamTalentChallenge(result){
 if(!state.seasonRules?.spaceJamTalentPending||String(state.seasonRules?.spaceJamRule)!=='talent-steal'||!result)return'';
 const opponent=teamById(result.opponentId),won=String(result.winnerId||'')===String(USER_ID)||Number(result.gf)>Number(result.ga),lost=String(result.winnerId||'')===String(result.opponentId)||Number(result.gf)<Number(result.ga);let message='La partita termina in pareggio: Space Jam non trasferisce nessun giocatore.';
 if(won)message=spaceJamStealBestOpponentPlayer(opponent);else if(lost)message=spaceJamLoseBestPlayer();
 state.seasonRules.spaceJamTalentPending=false;state.seasonRules.spaceJamLastOutcome=message;result.spaceJamOutcome=message;result.spaceJamWon=won;result.spaceJamLost=lost;return message;
}

function frenchFlyingRuleActive(){return String(state.seasonRules?.frenchEventChoice)==='flying-keeper'&&Boolean(state.seasonRules?.frenchFlyingKeeperId)&&Boolean(state.seasonRules?.frenchFlyingAttackerId)}
function frenchLateTurnRuleActive(){return String(state.seasonRules?.frenchEventChoice)==='late-turn'&&Boolean(state.seasonRules?.frenchLateAttackerBoostActive)}
function frenchRosterLocation(entry){return entry?{bench:Boolean(entry.bench),slot:String(entry.slot||''),slotId:String(entry.slotId||'')}:null}
function assignFrenchRosterLocation(entry,location){if(!entry||!location)return;entry.bench=Boolean(location.bench);entry.slot=String(location.slot||'');entry.slotId=String(location.slotId||'')}
function frenchAttackFormationSlot(){
 const slots=formationSlots(),preferred=String(state.seasonRules?.frenchFlyingAttackSlot||'');
 return slots.find(slot=>String(slot.code)===preferred&&POSITION_ROLE[slot.code]==='A')||slots.find(slot=>String(slot.code)==='ATT')||slots.find(slot=>POSITION_ROLE[slot.code]==='A')||null;
}
function enforceFrenchFlyingPositions(){
 if(!frenchFlyingRuleActive()||!Array.isArray(state?.draft?.roster))return false;
 const keeper=rosterEntry(state.seasonRules.frenchFlyingKeeperId),attacker=rosterEntry(state.seasonRules.frenchFlyingAttackerId),goalSlot=formationSlots().find(slot=>String(slot.code)==='P'),attackSlot=frenchAttackFormationSlot();
 if(!keeper||!attacker||!goalSlot||!attackSlot||keeper===attacker)return false;
 state.seasonRules.frenchFlyingAttackSlot=String(attackSlot.code||'ATT');
 const targetGoal={bench:false,slot:String(goalSlot.code),slotId:String(goalSlot.instanceId)},targetAttack={bench:false,slot:String(attackSlot.code),slotId:String(attackSlot.instanceId)};
 const occupantGoal=state.draft.roster.find(entry=>entry!==keeper&&entry!==attacker&&!entry.bench&&String(entry.slotId)===targetGoal.slotId)||null;
 const occupantAttack=state.draft.roster.find(entry=>entry!==keeper&&entry!==attacker&&!entry.bench&&String(entry.slotId)===targetAttack.slotId)||null;
 const oldKeeper=frenchRosterLocation(keeper),oldAttacker=frenchRosterLocation(attacker),displaced=[occupantGoal,occupantAttack].filter(Boolean),available=[oldKeeper,oldAttacker].filter(location=>location&&![targetGoal.slotId,targetAttack.slotId].includes(String(location.slotId)));
 assignFrenchRosterLocation(attacker,targetGoal);assignFrenchRosterLocation(keeper,targetAttack);
 displaced.forEach((entry,index)=>{const location=available[index];if(location)assignFrenchRosterLocation(entry,location);else{entry.bench=true;entry.slot=`PAN${index+1}`;entry.slotId=`bench-${index+1}`;}});
 normalizeTipsterBenchSlots();return true;
}
function activateFrenchFlyingGoalkeeper(){
 const starters=rosterPlayers().filter(entry=>entry?.player&&!entry.bench),keeper=starters.find(entry=>String(entry.slot)==='P'&&roleOf(entry.player)==='P')||starters.find(entry=>roleOf(entry.player)==='P'),attackers=starters.filter(entry=>roleOf(entry.player)==='A'&&entry!==keeper);
 if(!keeper||!attackers.length)return 'Servono un portiere e almeno un attaccante titolare per applicare Portiere volante.';
 const attacker=pick(attackers.filter(entry=>POSITION_ROLE[String(entry.slot||'')]==='A').length?attackers.filter(entry=>POSITION_ROLE[String(entry.slot||'')]==='A'):attackers),keeperName=keeper.player.name,attackerName=attacker.player.name;
 const keeperLocation=frenchRosterLocation(keeper),attackerLocation=frenchRosterLocation(attacker);assignFrenchRosterLocation(keeper,attackerLocation);assignFrenchRosterLocation(attacker,keeperLocation);
 state.seasonRules.frenchEventChoice='flying-keeper';state.seasonRules.frenchFlyingKeeperId=String(keeper.playerId);state.seasonRules.frenchFlyingAttackerId=String(attacker.playerId);state.seasonRules.frenchFlyingAttackSlot=String(keeper.slot||attackerLocation?.slot||'ATT');state.seasonRules.frenchLateAttackerBoostActive=false;
 const keeperBefore=Number(keeper.player?.ovr)||60,attackerBefore=Number(attacker.player?.ovr)||60,keeperChange=setPermanentRosterOvr(keeper,keeperBefore+10),attackerChange=setPermanentRosterOvr(attacker,attackerBefore+10);enforceFrenchFlyingPositions();
 const keeperGain=keeperChange?keeperChange.after-keeperChange.before:0,attackerGain=attackerChange?attackerChange.after-attackerChange.before:0,blocked=!keeperChange||!attackerChange;
 return `${keeperName} va in attacco e ${attackerName} va in porta. ${blocked?'Il profilo dell’allenatore ha bloccato almeno uno dei bonus OVR.':`${keeperName} ottiene +${keeperGain} OVR e ${attackerName} ottiene +${attackerGain} OVR.`}`;
}
function activateFrenchLateTurn(){
 state.seasonRules.frenchEventChoice='late-turn';state.seasonRules.frenchLateAttackerBoostActive=true;state.seasonRules.frenchLateAttackerBoostCount=0;state.seasonRules.frenchLateAttackerBoosts={};state.seasonRules.frenchFlyingKeeperId='';state.seasonRules.frenchFlyingAttackerId='';state.seasonRules.frenchFlyingAttackSlot='';
 return 'Si è girato è attivo fino a fine stagione: ogni attaccante che segna dopo l’80° minuto riceve +5 OVR permanente.';
}
function applyFrenchLateAttackerBoosts(events=[],lineup=[]){
 if(!frenchLateTurnRuleActive())return[];
 const playerMap=new Map((Array.isArray(lineup)?lineup:[]).filter(entry=>entry?.player).map(entry=>[String(entry.playerId||entry.player.id),entry])),boosts=[];
 (Array.isArray(events)?events:[]).filter(event=>Number(event?.minute)>80).forEach(event=>{
   const id=String(event?.playerId||''),lineupEntry=playerMap.get(id),entry=rosterEntry(id)||lineupEntry;if(!entry?.player||roleOf(entry.player)!=='A')return;
   const before=Number((rosterEntry(id)?.player||entry.player)?.ovr)||60,change=setPermanentRosterOvr(rosterEntry(id)||entry,before+5),after=change?change.after:before,gain=change?after-change.before:0;
   state.seasonRules.frenchLateAttackerBoostCount=Math.max(0,(Number(state.seasonRules.frenchLateAttackerBoostCount)||0)+1);state.seasonRules.frenchLateAttackerBoosts=state.seasonRules.frenchLateAttackerBoosts&&typeof state.seasonRules.frenchLateAttackerBoosts==='object'?state.seasonRules.frenchLateAttackerBoosts:{};state.seasonRules.frenchLateAttackerBoosts[id]=Math.max(0,(Number(state.seasonRules.frenchLateAttackerBoosts[id])||0)+gain);
   boosts.push({playerId:id,playerName:entry.player.name,minute:Number(event.minute)||0,gain,newOvr:after,blocked:!change});
 });
 return boosts;
}

function sixtyShadesSacrifice(){
 const entries=rosterPlayers().filter(entry=>entry?.player);
 const eligible=entries.filter(entry=>{const base=originalBaseOvr(entry.player);return base>=60&&base<=65});
 if(!eligible.length)return 'Non hai un giocatore con OVR base compreso tra 60 e 65.';
 const chosen=pick(eligible);
 const bestPool=entries.filter(entry=>String(entry.playerId)!==String(chosen.playerId));
 const best=[...bestPool].sort((a,b)=>(Number(b.player?.ovr)||originalBaseOvr(b.player))-(Number(a.player?.ovr)||originalBaseOvr(a.player)))[0];
 const base=originalBaseOvr(chosen),change=setPermanentRosterOvr(chosen,base*2);
 let sacrifice='Nessun altro giocatore disponibile da sacrificare.';
 if(best)sacrifice=removeOwnRosterPlayerPermanently(best,'il piccolo sacrificio');
 return change?`${change.player.name}, con ${base} OVR base, raddoppia la propria forza fino a ${change.after} per tutta la stagione. ${sacrifice}`:sacrifice;
}
function activateSixtyPointFear(){
 state.seasonRules.sixtyPointFear=true;
 state.seasonRules.sixtyPointFearTriggered=false;
 return 'Se la tua squadra raggiungerà esattamente 60 punti, il punteggio verrà immediatamente azzerato.';
}
function applySixtyPointFear(){
 const standing=userStanding();
 if(!state.seasonRules.sixtyPointFear||state.seasonRules.sixtyPointFearTriggered||!standing||Number(standing.pts)!==60)return '';
 standing.pts=0;state.seasonRules.sixtyPointFear=false;state.seasonRules.sixtyPointFearTriggered=true;
 return '60 la paura: hai raggiunto esattamente 60 punti e la classifica ti ha azzerato il punteggio.';
}
function doubleCoachNamesakeChemistry(){
 const entry=coachNamedRosterEntry();
 if(!entry)return 'Non hai in rosa un giocatore con lo stesso nome dell’allenatore.';
 pushSeasonEffect('playerChemMultiplier',2,{playerId:String(entry.playerId),source:'Ehi ma ti chiami come me'});
 return `${entry.player.name} avrà Intesa ×2 fino al termine della stagione.`;
}
function doubleTeamChemistryTwoMatches(){
 pushEffect('teamChemMultiplier',2,2,{source:'Che nome del ca***'});
 return 'L’Intesa positiva di tutta la squadra sarà raddoppiata per le prossime 2 partite.';
}
function activateMandatoryDcTopSwap(){
 const entry=centralDefenderRosterEntry();if(!entry)return 'Non è presente alcun difensore centrale da indicare.';
 queueMandatoryMidseasonPlayer(entry.playerId);
 state.seasonRules.topPlayerAfterMandatoryId=String(entry.playerId);
 return `${entry.player.name} dovrà essere scambiato al draft di metà stagione. Dopo questo cambio, il pack successivo conterrà un top player compatibile.`;
}
function activateCoachTopSwap(){
 const entry=coachNamedRosterEntry();if(!entry)return 'Non è presente in rosa un giocatore con lo stesso nome dell’allenatore.';
 state.seasonRules.coachTopSwapPlayerId=String(entry.playerId);
 return `${entry.player.name} potrà essere scambiato al draft di metà stagione con un top player garantito del suo macro-ruolo.`;
}
function boostCoachNamedPlayer(){
 const entry=coachNamedRosterEntry();if(!entry)return 'Non è presente in rosa un giocatore con lo stesso nome dell’allenatore.';
 const player=entry.player||playerById(entry.playerId),before=Number(player.ovr)||60,change=setPermanentRosterOvr(entry,before+10);
 return change?`${change.player.name} riceve +${change.after-change.before} OVR fino al termine della stagione.`:'Il bonus OVR non è stato applicato.';
}

function curvaContestState(source=state){
 const rules=source?.seasonRules||(source.seasonRules={});
 const contest=rules.curvaContest&&typeof rules.curvaContest==='object'?rules.curvaContest:(rules.curvaContest={});
 contest.active=Boolean(contest.active);
 contest.mode=['title','home','away'].includes(String(contest.mode))?String(contest.mode):'';
 contest.status=['idle','active','won','lost','away'].includes(String(contest.status))?String(contest.status):'idle';
 contest.startedMatchday=Number.isFinite(Number(contest.startedMatchday))?Number(contest.startedMatchday):-1;
 contest.deadlineMatchday=Number.isFinite(Number(contest.deadlineMatchday))?Number(contest.deadlineMatchday):-1;
 contest.pendingTeamId=String(contest.pendingTeamId||'');
 contest.lastResult=String(contest.lastResult||'');
 contest.switchedFromTeamName=String(contest.switchedFromTeamName||'');
 contest.switchedToTeamName=String(contest.switchedToTeamName||'');
 if(!contest.mode)contest.active=false;
 rules.curvaContest=contest;
 return contest;
}
function curvaContestCanAppear(){
 const completed=Math.max(0,Number(state.matchday)||0),total=seasonLength(),contest=curvaContestState();
 if(contest.active||contest.pendingTeamId)return false;
 if(completed+5>=total)return false;
 if(completed<19&&completed+5>=19)return false;
 return true;
}
function activateCurvaTitleChallenge(){
 const contest=curvaContestState();
 contest.active=true;contest.mode='title';contest.status='active';contest.startedMatchday=Math.max(0,Number(state.matchday)||0);contest.deadlineMatchday=contest.startedMatchday+5;contest.pendingTeamId='';contest.lastResult='';contest.switchedFromTeamName='';contest.switchedToTeamName='';
 return `Sfida accettata: al termine della giornata ${contest.deadlineMatchday} dovrai essere tra le prime 2. Durante la sfida non riceverai alcun vantaggio speciale; se riuscirai nell’impresa, tutte le partite successive saranno trattate come gare in casa fino a fine stagione.`;
}
function activateCurvaAwayPenalty(){
 const contest=curvaContestState();
 contest.active=true;contest.mode='away';contest.status='away';contest.startedMatchday=Math.max(0,Number(state.matchday)||0);contest.deadlineMatchday=seasonLength();contest.pendingTeamId='';contest.lastResult='Ogni partita sarà trattata come una trasferta fino a fine stagione.';contest.switchedFromTeamName='';contest.switchedToTeamName='';
 return 'Ignori la contestazione: da questo momento ogni partita di campionato avrà lo svantaggio di una gara in trasferta fino a fine stagione.';
}
function curvaContestVenueMode(){const contest=curvaContestState();return contest.active&&['home','away'].includes(contest.mode)?contest.mode:''}
function curvaContestHomeAdvantage(userHome){
 const mode=curvaContestVenueMode(),stadiumBonus=userHome?clamp(Number(state.seasonRules?.stadiumHomeAdvantageBonus)||0,0,.15):0;
 if(mode==='home')return (userHome?.18:-.18)+stadiumBonus;
 if(mode==='away')return userHome?-.18:.18;
 return .18+stadiumBonus;
}
function curvaContestFutureTeamCandidates(){
 const futureIds=new Set();
 (state.schedule||[]).slice(Math.max(0,(Number(state.matchday)||0)+1)).forEach(round=>(round||[]).forEach(match=>{futureIds.add(String(match?.home||''));futureIds.add(String(match?.away||''))}));
 return (state.teams||[]).filter(team=>team&&String(team.id)!==USER_ID&&!isTeamEliminated(team.id)&&(!futureIds.size||futureIds.has(String(team.id))));
}
function resolveCurvaContestAfterRound(result){
 const contest=curvaContestState();if(!contest.active||contest.mode!=='title'||!result)return '';
 const completedMatchday=(Number(state.matchday)||0)+1;if(completedMatchday<contest.deadlineMatchday)return '';
 const rank=sortedTable().findIndex(row=>String(row.id)===USER_ID)+1;
 if(rank>0&&rank<=2){
   contest.active=true;contest.mode='home';contest.status='won';contest.deadlineMatchday=seasonLength();contest.lastResult=`Obiettivo raggiunto: ${state.teamName} è ${rank}ª in classifica dopo 5 giornate. Da ora e fino al termine della stagione ogni partita sarà trattata come una gara in casa.`;
   result.curvaContestNotice=contest.lastResult;result.curvaContestSuccess=true;return contest.lastResult;
 }
 contest.active=false;
 const candidates=curvaContestFutureTeamCandidates(),target=candidates.length?pick(candidates):null;
 contest.status='lost';contest.pendingTeamId=String(target?.id||'');contest.switchedFromTeamName=String(state.teamName||'La tua squadra');contest.switchedToTeamName=String(target?.name||'');
 contest.lastResult=target?`Obiettivo fallito: ${state.teamName} è ${rank>0?`${rank}ª`:'fuori dalle prime 2'}. Dopo il riepilogo perderai la squadra e prenderai il controllo di ${target.name}.`:`Obiettivo fallito: ${state.teamName} non è tra le prime 2, ma non esiste un'altra squadra disponibile da controllare.`;
 result.curvaContestNotice=contest.lastResult;result.curvaContestSuccess=false;result.curvaContestPendingTeamId=contest.pendingTeamId;return contest.lastResult;
}
function plainClone(value,fallback={}){try{return JSON.parse(JSON.stringify(value??fallback))}catch{return fallback}}
function userRosterOverridesForBot(entries){
 const overrides={};(entries||[]).forEach(entry=>{const id=String(entry?.playerId||entry?.player?.id||''),player=entry?.player||playerById(id),base=playerById(id);if(!id||!player)return;const currentOvr=Number(player.ovr),baseOvr=Number(base?.ovr);if(Number.isFinite(currentOvr)&&(!Number.isFinite(baseOvr)||currentOvr!==baseOvr))overrides[id]={ovr:currentOvr}});return overrides;
}
function buildControlledRosterEntries(players){
 const source=(Array.isArray(players)?players:[]).filter(Boolean).slice(0,14),slots=formationSlots(),unused=[...source],entries=[];
 const ordered=slots.map((slot,index)=>({slot,index,count:unused.filter(player=>userCompatible(player,slot.code)).length})).sort((a,b)=>a.count-b.count||a.index-b.index);
 const assigned=new Map();
 ordered.forEach(item=>{const byOvr=(a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0);let candidates=unused.filter(player=>userCompatible(player,item.slot.code)).sort(byOvr);if(!candidates.length)candidates=unused.filter(player=>roleOf(player)===POSITION_ROLE[item.slot.code]).sort(byOvr);if(!candidates.length)candidates=[...unused].sort(byOvr);const selected=candidates[0];if(!selected)return;assigned.set(item.slot.instanceId,selected);unused.splice(unused.indexOf(selected),1)});
 slots.forEach(slot=>{const player=assigned.get(slot.instanceId);if(player)entries.push({playerId:String(player.id),slotId:slot.instanceId,slot:slot.code,bench:false,player:{...player}})});
 unused.sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0)).forEach((player,index)=>entries.push({playerId:String(player.id),slotId:`bench-${index+1}`,slot:`PAN${index+1}`,bench:true,player:{...player}}));
 return entries;
}
function swapFutureScheduleControl(targetId){
 const id=String(targetId||'');if(!id)return;
 for(let index=Math.max(0,Number(state.matchday)||0);index<(state.schedule||[]).length;index++){
   (state.schedule[index]||[]).forEach(match=>{if(String(match.home)===USER_ID)match.home=id;else if(String(match.home)===id)match.home=USER_ID;if(String(match.away)===USER_ID)match.away=id;else if(String(match.away)===id)match.away=USER_ID});
 }
}
function performPendingCurvaTeamSwitch(){
 const contest=curvaContestState(),targetId=String(contest.pendingTeamId||'');if(!targetId)return null;
 const userTeam=teamById(USER_ID),target=teamById(targetId);if(!userTeam||!target){contest.pendingTeamId='';return null}
 const oldUserEntries=rosterPlayers(),oldUserIds=oldUserEntries.map(entry=>String(entry.playerId)),oldUserStatuses=plainClone(state.statuses,{}),oldUserOverrides=userRosterOverridesForBot(oldUserEntries),oldUserStrength=teamPowerBase();
 const oldIdentity={clubId:String(userTeam.clubId||state.userClubId||''),name:String(userTeam.name||state.teamName||'Squadra'),shortName:String(userTeam.shortName||''),colors:plainClone(userTeam.colors||state.teamColors||null,null),externalCompetition:String(userTeam.externalCompetition||''),originalClubId:String(userTeam.originalClubId||'')};
 const targetPlayers=opponentRosterPlayers(target).filter(player=>!player?.isMascot).map(player=>({...player})),targetStatuses=plainClone(target.statuses,{}),targetStrength=Number(target.strength)||avg(targetPlayers.slice(0,11).map(player=>Number(player.ovr)||60));
 const newIdentity={clubId:String(target.clubId||target.id||''),name:String(target.name||'Nuova squadra'),shortName:String(target.shortName||''),colors:plainClone(target.colors||null,null),externalCompetition:String(target.externalCompetition||''),originalClubId:String(target.originalClubId||'')};
 const oldStanding=plainClone(state.standings?.[USER_ID],{id:USER_ID,name:oldIdentity.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}),targetStanding=plainClone(state.standings?.[targetId],{id:targetId,name:newIdentity.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});
 swapFutureScheduleControl(targetId);
 state.standings[USER_ID]={...targetStanding,id:USER_ID,name:newIdentity.name};state.standings[targetId]={...oldStanding,id:targetId,name:oldIdentity.name};
 target.clubId=oldIdentity.clubId;target.name=oldIdentity.name;target.shortName=oldIdentity.shortName;target.colors=oldIdentity.colors;target.strength=oldUserStrength;target.roster=oldUserIds;target.statuses=oldUserStatuses;target.playerOverrides=oldUserOverrides;target.mascot=null;target.externalCompetition=oldIdentity.externalCompetition;target.originalClubId=oldIdentity.originalClubId;target.controlSwapLockedRoster=true;target.chaos={activeEffects:[],seenDecisionEvents:[],decisions:0,midseasonPickDelta:0,matchDuration:90,futureScorerId:'',futureInjuryZeroPoints:false,sixtyPointFear:false,eventChanceMultiplier:1,nonItalianChemZero:false,formation:'',latestDecision:null};
 userTeam.clubId=newIdentity.clubId;userTeam.name=newIdentity.name;userTeam.shortName=newIdentity.shortName;userTeam.colors=newIdentity.colors;userTeam.strength=targetStrength;userTeam.externalCompetition=newIdentity.externalCompetition;userTeam.originalClubId=newIdentity.originalClubId;delete userTeam.roster;delete userTeam.statuses;delete userTeam.playerOverrides;delete userTeam.mascot;delete userTeam.chaos;delete userTeam.controlSwapLockedRoster;
 state.userClubId=newIdentity.clubId;state.teamName=newIdentity.name;if(newIdentity.colors)state.teamColors=normalizeClubColors(newIdentity.colors);state.statuses=targetStatuses;state.playInjured={};state.draft.roster=buildControlledRosterEntries(targetPlayers);state.draft.clubId='';state.draft.candidates=[];state.draft.pendingPlayerId='';
 if(state.stats?.playerTeams){oldUserIds.forEach(id=>{state.stats.playerTeams[id]=targetId;state.stats.playerTeamNames[id]=oldIdentity.name});targetPlayers.forEach(player=>{const id=String(player.id);state.stats.playerTeams[id]=USER_ID;state.stats.playerTeamNames[id]=newIdentity.name})}
 (state.cup?.participants||[]).forEach(participant=>{if(String(participant.teamId)===USER_ID){participant.name=newIdentity.name;participant.clubId=newIdentity.clubId;participant.strength=targetStrength}else if(String(participant.teamId)===targetId){participant.name=oldIdentity.name;participant.clubId=oldIdentity.clubId;participant.strength=oldUserStrength}});
 contest.pendingTeamId='';contest.switchedFromTeamName=oldIdentity.name;contest.switchedToTeamName=newIdentity.name;contest.lastResult=`Hai perso il controllo di ${oldIdentity.name}. Ora alleni ${newIdentity.name}, mantenendo la sua posizione in classifica e il suo calendario.`;
 setAchievementCareerFlag('previousControlledTeamId',targetId);setAchievementCareerFlag('previousControlledTeamName',oldIdentity.name);
 return{from:oldIdentity.name,to:newIdentity.name};
}

