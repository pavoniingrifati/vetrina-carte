function currentMatchDuration(){return [30,90,120].includes(Number(state.seasonRules?.matchDuration))?Number(state.seasonRules.matchDuration):90}
function goalValueForMinute(minute){return state.seasonRules?.lateGoalsDouble&&Number(minute)>=80?2:1}
function scoreGoalEvents(events){return (Array.isArray(events)?events:[]).reduce((sum,event)=>sum+Math.max(1,Number(event?.goalValue)||1),0)}
function regulationGoalEvent(team,opponent,duration=90,label='Regolamento FGCI'){
 const minute=Math.max(2,Math.min(Number(duration)||90,Math.floor(8+Math.random()*Math.max(1,(Number(duration)||90)-12))));
 return {minute,playerId:'',assistId:'',player:label,assist:'',teamId:String(team?.id||''),teamName:team?.name||'',goalValue:1,isRuleGoal:true,description:`Il regolamento assegna un gol a ${team?.name||'questa squadra'}.`};
}
function coachGuaranteedGoalEvent(lineup,team,opponent,duration,reason){
 const generated=buildTeamGoals(1,lineup,team,opponent,[],duration)?.[0]||regulationGoalEvent(team,opponent,duration,'Mister salvezza');
 generated.isCoachGoal=true;generated.description=`${reason} ${generated.description||''}`.trim();return generated;
}
function applyCoachGoalGuarantees(userEvents,opponentEvents,lineup,opponentLineup,userTeam,opponent,duration){
 const result={for:false,against:false,average:coachRosterAverageOvr()};if(!coachIs('salvation'))return result;
 const bonusesDisabled=typeof noMisterCoachBonusesDisabled==='function'&&noMisterCoachBonusesDisabled();
 if(result.average<70&&!bonusesDisabled){userEvents.push(coachGuaranteedGoalEvent(lineup,userTeam,opponent,duration,'Mister salvezza: con una rosa sotto 70 OVR, viene aggiunto un gol alla squadra.'));result.for=true}
 if(result.average>80&&scoreGoalEvents(opponentEvents)<1){opponentEvents.push(coachGuaranteedGoalEvent(opponentLineup,opponent,userTeam,duration,'Mister salvezza: con una rosa sopra 80 OVR, almeno un gol subito è garantito.'));result.against=true}
 return result;
}
function boostAllRosterPlayers(delta){
 const names=[];
 state.draft.roster.forEach(entry=>{const player=entry.player||playerById(entry.playerId);if(!player)return;const before=Number(player.ovr)||60,change=setPermanentRosterOvr(entry,before+delta);if(change)names.push(change.player.name)});
 refreshOpponentClubRosters();
 return names;
}
function ruleOutAllRosterPlayers(reason='Bevanda energetica'){
 const names=[];rosterPlayers().forEach(entry=>{ruleOutForSeason(entry,reason);names.push(entry.player.name)});return names;
}
function coachNamedRosterEntry(){const coach=normalizeName(state.coachName);return coach?rosterPlayers().find(entry=>normalizeName(entry.player?.name)===coach)||null:null}
function centralDefenderRosterEntry(){return rosterPlayers().find(entry=>!entry.bench&&(entry.slot==='DC'||positions(entry.player).includes('DC')))||rosterPlayers().find(entry=>entry.slot==='DC'||positions(entry.player).includes('DC'))||null}
function applyUserFormationLayout(key){
 if(coachIs('three-five-two'))key='3-5-2';
 if(!FORMATION_LAYOUTS[key])return 'Modulo non disponibile.';
 const slots=formationSlots(key),all=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player);
 if(all.length<slots.length)return `Non ci sono abbastanza giocatori per applicare il ${key}.`;
 const unused=[...all],assignments=[];
 const orderedSlots=slots.map((slot,index)=>({slot,index,compatibleCount:unused.filter(item=>userCompatible(item.player,slot.code)).length})).sort((a,b)=>a.compatibleCount-b.compatibleCount||a.index-b.index);
 orderedSlots.forEach(item=>{
   const byOvr=(a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0);
   let candidates=unused.filter(candidate=>userCompatible(candidate.player,item.slot.code)).sort(byOvr);
   if(!candidates.length)candidates=unused.filter(candidate=>roleOf(candidate.player)===POSITION_ROLE[item.slot.code]).sort(byOvr);
   if(!candidates.length)candidates=[...unused].sort(byOvr);
   const selected=candidates[0];if(!selected)return;
   assignments.push({selected,slot:item.slot});
   unused.splice(unused.indexOf(selected),1);
 });
 assignments.forEach(({selected,slot})=>Object.assign(selected.entry,{bench:false,slot:slot.code,slotId:slot.instanceId}));
 unused.sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0)).forEach((item,index)=>Object.assign(item.entry,{bench:true,slot:`PAN${index+1}`,slotId:`bench-${index+1}`}));
 state.formation=key;
 if(state.seasonRules?.autoOptimizeLineup)optimizeLineupWithBench();
 enforceFrenchFlyingPositions();
 const benchCount=Math.max(0,all.length-slots.length);
 return {players:slots.length,bench:benchCount};
}
function forceSeasonFormation(key){
 if(!FORMATION_LAYOUTS[key])return 'Modulo non disponibile.';
 state.seasonRules.leagueFormation=key;
 const userKey=FORMATIONS[state.seasonRules.userFormationOverride]?state.seasonRules.userFormationOverride:key;
 const result=applyUserFormationLayout(userKey);
 if(typeof result==='string')return result;
 const exception=userKey!==key?` La tua squadra mantiene l’eccezione ${userKey}.`:'';
 return `Nuova regola ${key}: le squadre giocano con ${(FORMATION_LAYOUTS[key]||[]).length} giocatori in campo.${exception}`;
}
function forceUserFormation(key){
 if(coachIs('three-five-two')){
   state.seasonRules.userFormationOverride='3-5-2';
   const locked=applyUserFormationLayout('3-5-2');
   return typeof locked==='string'?locked:'3-5-2: il contratto dell’allenatore impedisce qualsiasi cambio di modulo.';
 }
 if(!FORMATION_LAYOUTS[key])return 'Modulo non disponibile.';
 state.seasonRules.userFormationOverride=key;
 const result=applyUserFormationLayout(key);
 if(typeof result==='string')return result;
 return `ATAKARE: solo la tua squadra passa al ${key}, con ${result.players} giocatori in campo e ${result.bench} ${result.bench===1?'panchinaro':'panchinari'}.`;
}
function activateDeathMatchClub(){
 const active=(state.teams||[]).filter(team=>team.id!==USER_ID);
 let target=active.find(team=>normalizeName(team.name).includes('atalanta'))||null;
 const isAtalanta=Boolean(target);
 if(!target)target=active.length?pick(active):null;
 if(!target)return 'Nessun avversario disponibile.';
 state.seasonRules.deathMatchClubId=String(target.id);
 state.seasonRules.deathMatchClubName=String(target.name||'Atalanta');
 state.seasonRules.deathMatchClubBonus=10;
 return isAtalanta?'L’Atalanta riceverà +10 OVR ogni volta che ti affronterà.':`L’Atalanta non partecipa a questa stagione: ${target.name} ne prende il posto e riceverà +10 OVR contro di te.`;
}
function permanentRandomPlayerBoost(delta,source='Magia nera'){
 const entry=randomOwnEntry();if(!entry)return 'Nessun giocatore disponibile.';
 const player=entry.player||playerById(entry.playerId),before=Number(player?.ovr)||60,change=setPermanentRosterOvr(entry,before+delta);
 return change?`${change.player.name}: OVR ${change.before} → ${change.after} per il resto della stagione (${source}).`:'Il bonus OVR non è stato applicato.';
}
function applyBlackMagicBoost(){
 const lukakuEntry=(state.draft?.roster||[]).find(entry=>{const player=entry?.player||playerById(entry?.playerId);return /(?:^|\s)lukaku(?:$|\s)/i.test(String(player?.name||'').trim())});
 if(!lukakuEntry)return permanentRandomPlayerBoost(20,'Magia nera');
 const player=lukakuEntry.player||playerById(lukakuEntry.playerId),before=Number(player?.ovr)||60,change=setPermanentRosterOvr(lukakuEntry,before+60);
 return change?`${change.player.name} è stato riconosciuto dal Mago do Nascimento: OVR ${change.before} → ${change.after} (+60) fino a fine stagione.`:'Il bonus speciale di Lukaku non è stato applicato.';
}
function originalBaseOvr(player){
 const explicit=Number(player?.baseOvr);if(Number.isFinite(explicit)&&explicit>0)return Math.max(1,explicit);
 const original=playerById(player?.id);
 const stored=Number(original?.baseOvr);if(Number.isFinite(stored)&&stored>0)return Math.max(1,stored);
 return Math.max(1,Number(original?.ovr??player?.ovr)||60);
}
function ductilityScorerOvrBonus(player){if(!coachIs('ductility')||!player||(typeof noMisterCoachBonusesDisabled==='function'&&noMisterCoachBonusesDisabled()))return 0;return Math.max(0,Math.floor(Number(state.seasonRules?.ductilityScorerOvr?.[String(player.id||'')])||0))}
function ductilityEffectiveBaseOvr(player){const numeric=Number(player?.ovr),allowNegative=typeof fantaballopoliAllowsNegativeOvr==='function'&&fantaballopoliAllowsNegativeOvr(),current=allowNegative&&Number.isFinite(numeric)?numeric:Math.max(1,numeric||originalBaseOvr(player)),base=originalBaseOvr(player);if(!coachIs('ductility'))return current;const adjusted=Math.min(current,base)+ductilityScorerOvrBonus(player);return allowNegative?adjusted:Math.max(1,adjusted)}
function ductilityEntryIsOutOfRole(entry){return Boolean(coachIs('ductility')&&!(typeof noMisterCoachBonusesDisabled==='function'&&noMisterCoachBonusesDisabled())&&entry?.player&&!isEmergencyYouthEntry(entry)&&entry.slot&&!naturalCompatible(entry.player,entry.slot))}
function addDuctilityScorerOvr(playerId,value=1){if(!coachIs('ductility')||(typeof noMisterCoachBonusesDisabled==='function'&&noMisterCoachBonusesDisabled())||!playerId||Number(value)<=0)return 0;state.seasonRules.ductilityScorerOvr=state.seasonRules.ductilityScorerOvr&&typeof state.seasonRules.ductilityScorerOvr==='object'?state.seasonRules.ductilityScorerOvr:{};const id=String(playerId),next=Math.max(0,(Number(state.seasonRules.ductilityScorerOvr[id])||0)+Math.floor(Number(value)||0));state.seasonRules.ductilityScorerOvr[id]=next;return next}
function rosterEntryIndex(entry){return state.draft.roster.findIndex(item=>String(item.playerId)===String(entry?.playerId||''))}
function setPermanentRosterOvr(entry,value){
 if(!entry)return null;
 const index=rosterEntryIndex(entry),player=entry.player||playerById(entry.playerId);
 if(index<0||!player)return null;
 const before=Number(player.ovr)||60,requested=Math.max(1,Math.round(Number(value)||before)),isPositive=requested>before;
 if(requested<before&&typeof cellCyborgActive==='function'&&cellCyborgActive()){if(typeof recordCyborgBlockedMalus==='function')recordCyborgBlockedMalus();return{player:state.draft.roster[index].player||player,before,after:before,blocked:true}}
 if(isPositive&&coachIs('ductility'))return null;
 const sponsorExtra=isPositive?sponsorOvrExtraFor(requested-before):0,sponsoredRequested=isPositive?requested+sponsorExtra:requested;
 const motivatorBonusActive=isPositive&&coachIs('motivator')&&!(typeof noMisterCoachBonusesDisabled==='function'&&noMisterCoachBonusesDisabled()),after=motivatorBonusActive?sponsoredRequested+2:sponsoredRequested;
 state.draft.roster[index].player={...player,ovr:after};
 if(typeof cellCyborgActive==='function'&&cellCyborgActive()&&typeof cyborgRestoreProtectedRoster==='function')cyborgRestoreProtectedRoster();
 if(sponsorExtra){recordBallariniPlayerBonus(player.id,sponsorExtra);if(after>=100&&after-sponsorExtra<100)unlockAchievement('qualita-ballarini')}
 if(motivatorBonusActive)addMotivatorPermanentChemistry(player.id,2);
 return {player:state.draft.roster[index].player,before,after};
}
function empowerUnderdog(){
 const entries=rosterPlayers().filter(entry=>entry?.player);
 const eligible=entries.filter(entry=>{const base=originalBaseOvr(entry.player);return base>=60&&base<=70});
 if(!eligible.length)return 'Non hai giocatori con OVR base compreso tra 60 e 70.';
 const selected=pick(eligible),highest=Math.max(...entries.map(entry=>originalBaseOvr(entry.player)));
 const change=setPermanentRosterOvr(selected,highest);
 return change?`${change.player.name} passa da ${change.before} a ${change.after} OVR, quanto il tuo giocatore con l’OVR base più alto, fino a fine stagione.`:'Il potenziamento non è stato applicato.';
}
function guaranteeSixNil(){
 pushEffect('forcedScore',1,1,{gf:6,ga:0,source:'Favoriti'});
 return 'La prossima partita terminerà con una tua vittoria per 6-0.';
}
function zeroFiveTeamsIncluding(){
 const standings=state.standings||{},allIds=Object.keys(standings).filter(id=>standings[id]);
 if(!allIds.length)return [];
 const selected=shuffle(allIds).slice(0,Math.min(5,allIds.length));
 selected.forEach(id=>{if(standings[id])standings[id].pts=0});
 return selected.map(id=>standings[id]?.name||teamById(id)?.name||id);
}
function removeOwnRosterPlayerPermanently(entry,reason=''){ 
 if(!entry)return 'Nessun giocatore disponibile.';
 const index=rosterEntryIndex(entry),player=entry.player||playerById(entry.playerId);if(index<0||!player)return 'Nessun giocatore disponibile.';
 if(!entry.bench){
   const bench=state.draft.roster.map((item,itemIndex)=>({entry:item,index:itemIndex,player:item.player||playerById(item.playerId)})).filter(item=>item.player&&item.entry.bench&&item.index!==index);
   let replacement=bench.filter(item=>userCompatible(item.player,entry.slot)).sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
   if(!replacement)replacement=bench.filter(item=>roleOf(item.player)===POSITION_ROLE[entry.slot]).sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
   if(!replacement)replacement=bench.sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
   if(replacement)Object.assign(replacement.entry,{bench:false,slot:entry.slot,slotId:entry.slotId});
 }
 state.draft.roster.splice(index,1);delete state.statuses[String(player.id)];delete state.playInjured[String(player.id)];clearMandatoryMidseasonPlayer(String(player.id));
 const mental=mentalistaChain();if(String(mental.playerId)===String(player.id))Object.assign(mental,{active:false,stage:0,dueMatchday:-1,training:false,nature:false,completed:true});
 if(String(state.seasonRules.futureScorerPlayerId||'')===String(player.id)){state.seasonRules.futureScorerPlayerId='';state.seasonRules.futureScorerPlayerName='';state.seasonRules.futureInjuryZeroPoints=false;}
 normalizeTipsterBenchSlots();refreshOpponentClubRosters();
 return `${player.name} lascia definitivamente la squadra${reason?` per ${reason}`:''}.`;
}

