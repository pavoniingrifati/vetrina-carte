function pinkCardMatchDuration(baseDuration=90){const base=Math.max(30,Number(baseDuration)||90);if(!state.seasonRules?.pinkCardEndsMatch)return base;return Math.max(30,Math.min(base,30+Math.floor(Math.random()*Math.max(1,base-29))))}
function coachNamesakePools(){const active=Array.isArray(PLAYERS)?PLAYERS:[],other=PLAYERS===REAL_PLAYERS?CLASSIC_PLAYERS:REAL_PLAYERS;return [active,Array.isArray(other)?other:[]]}
function coachNamesakeSource(){
 const coach=normalizeName(state.coachName);if(!coach)return null;
 const usedNames=new Set(rosterPlayers().map(entry=>normalizeName(entry.player.name)));
 for(const pool of coachNamesakePools()){const available=pool.find(player=>youngBeautifulAllowsPlayer(player)&&normalizeName(player?.name)===coach&&!usedNames.has(normalizeName(player?.name)));if(available)return available}
 for(const pool of coachNamesakePools()){const match=pool.find(player=>youngBeautifulAllowsPlayer(player)&&normalizeName(player?.name)===coach);if(match)return match}
 return null;
}
function bringCoachNamesake(){
 if(playerArrivalIsBlocked())return playerArrivalBlockMessage();
 const weakest=weakestRosterItem(),source=coachNamesakeSource();if(!weakest)return 'Nessun giocatore disponibile da sostituire.';if(!source)return `Non esiste né nel database del campionato attivo né in quello dell’altro campionato un giocatore chiamato ${state.coachName||'come il tuo allenatore'}.`;
 const incoming=eventPlayerClone(source,'te-stesso'),change=replaceUserRosterPlayer(weakest.index,incoming);refreshOpponentClubRosters();return `${change?.outgoing?.name||'Il giocatore più scarso'} lascia la rosa: arriva ${incoming.name}, il tuo omonimo trovato nei database dei due campionati.`;
}
function reverseStandingsPoints(){
 const table=sortedTable();if(table.length<2)return 'Non ci sono abbastanza squadre per capovolgere la classifica.';
 const oldPoints=table.map(row=>Number(row.pts)||0),first=table[0],last=table[table.length-1];
 table.forEach((row,index)=>{row.pts=oldPoints[oldPoints.length-1-index]});
 return `Classifica capovolta: ${first.name} prende ${oldPoints[oldPoints.length-1]} punti, mentre ${last.name} prende ${oldPoints[0]} punti. Tutte le altre squadre ricevono i punti della posizione opposta.`;
}
function doubleEventAppearanceRate(){state.seasonRules.eventChanceMultiplier=2;return 'La probabilità complessiva che compaia un evento passa dal 45% al 90% per tutte le prossime giornate.'}
function activateFutureScorer(){
 const entry=randomOwnEntry();if(!entry)return 'Nessun giocatore disponibile.';
 state.seasonRules.futureScorerPlayerId=String(entry.playerId);state.seasonRules.futureScorerPlayerName=String(entry.player.name);state.seasonRules.futureInjuryZeroPoints=true;state.seasonRules.futureInjuryPenaltyNotice='';
 return `${entry.player.name} arriva dal futuro: segnerà almeno un gol in ogni partita. Ogni nuovo infortunio nella tua rosa azzererà i punti in classifica.`;
}
function futureScorerGoalEvent(team,opponent,duration=90){
 const id=String(state.seasonRules.futureScorerPlayerId||''),entry=rosterEntry(id),player=entry?.player||playerById(id);if(!player)return null;
 const minute=Math.max(2,Math.min(Number(duration)||90,Math.floor(5+Math.random()*Math.max(1,(Number(duration)||90)-8))));
 return {minute,playerId:String(player.id),assistId:'',player:player.name,assist:'',teamId:String(team?.id||USER_ID),teamName:team?.name||state.teamName,goalValue:1,isFutureGoal:true,description:'Conosceva già il risultato: il giocatore dal futuro segna come previsto.'};
}
function extendSeasonTo76(){
 state.seasonRules.marathon=true;state.seasonRules.winPoints=1.5;state.seasonRules.drawPoints=0;state.seasonRules.pointsEqualGoals=false;
 const activeIds=leagueStructureTeamIds(state);if(state.seasonRules.dynamicLeague&&!state.seasonRules.dynamicLeagueTeamIds.length)state.seasonRules.dynamicLeagueTeamIds=[...activeIds];
 const target=desiredLeagueSeasonLength(state,activeIds);rebuildRemainingLeagueSchedule(activeIds,target);
 return `Maratona attivata: con ${activeIds.length} squadre la stagione dura il doppio e arriva a ${state.schedule.length} giornate. Le giornate già disputate e i risultati restano invariati. Ogni vittoria vale 1,5 punti e ogni pareggio vale 0 punti.`;
}
function isTeamEliminated(id){return Boolean((state.seasonRules?.eliminatedTeamIds||[]).map(String).includes(String(id)))}
function activateHungerGames(){state.seasonRules.hungerGames=true;state.seasonRules.eliminatedTeamIds=Array.isArray(state.seasonRules.eliminatedTeamIds)?state.seasonRules.eliminatedTeamIds:[];return 'Da ora chi perde una partita viene eliminato fino al termine della stagione e scompare dalla classifica. Le gare future contro squadre eliminate diventano vittorie a tavolino.'}
function applyHungerGamesResult(homeId,awayId,homeScore,awayScore){
 if(!state.seasonRules.hungerGames||Number(homeScore)===Number(awayScore))return '';
 const loserId=Number(homeScore)<Number(awayScore)?String(homeId):String(awayId);if(isTeamEliminated(loserId))return '';
 state.seasonRules.eliminatedTeamIds=[...new Set([...(state.seasonRules.eliminatedTeamIds||[]).map(String),loserId])];const loser=teamById(loserId);return `${loser?.name||'La squadra sconfitta'} è stata eliminata dagli Hunger Games.`;
}
function addMaradonaEventPlayer(){
 if(playerArrivalIsBlocked())return playerArrivalBlockMessage();
 if(coachIs('young-beautiful'))return youngBeautifulBlockMessage({name:'Diego Armando Maradona',ovr:120,baseOvr:120});
 const attackingIndexes=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player&&roleOf(item.player)==='A');
 if(!attackingIndexes.length)return 'Nessun attaccante disponibile da sostituire.';
 const selected=pick(attackingIndexes);
 const maradona={id:`event-maradona-${state.meta?.createdAt||Date.now()}`,name:'Diego Armando Maradona',nation:'Argentina',Position:'ATT, AS, AD',role:'A',ovr:120,subscriber:'no',club:USER_ID,eventPlayer:true};
 const change=replaceUserRosterPlayer(selected.index,maradona);
 refreshOpponentClubRosters();
 if(state.standings?.[USER_ID])state.standings[USER_ID].pts=0;
 return `${change?.outgoing?.name||'Un attaccante'} lascia il posto a Maradona da 120 OVR. I punti in classifica sono stati azzerati.`;
}
function rebuildWeakestStarters(){
 if(playerArrivalIsBlocked())return playerArrivalBlockMessage();
 const starters=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player&&!item.entry.bench).sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0)).slice(0,3);
 if(!starters.length)return 'Nessun titolare disponibile per il rebuild.';
 const used=new Set(state.draft.roster.map(entry=>String(entry.playerId)));
 const changes=[];
 starters.forEach(item=>{
   let pool=PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id))&&userCompatible(player,item.entry.slot));
   if(!pool.length)pool=PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id))&&roleOf(player)===POSITION_ROLE[item.entry.slot]);
   const replacement=pool.length?pick(pool):null;
   if(!replacement)return;
   const change=replaceUserRosterPlayer(item.index,replacement);
   used.add(String(replacement.id));
   if(change)changes.push(change);
 });
 refreshOpponentClubRosters();
 return changes.length?`Rebuild completato: ${changes.map(change=>`${change.outgoing?.name||'Giocatore'} → ${change.incoming.name}`).join(' · ')}.`:'Non sono stati trovati sostituti compatibili.';
}
function runMisterFmExperiment(){
 const candidates=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player);
 if(!candidates.length)return 'Nessun giocatore disponibile per l’esperimento.';
 const selected=pick(candidates);
 const delta=Math.random()<.5?20:-20;
 const before=Number(selected.player.ovr)||60;
 const change=setPermanentRosterOvr(selected.entry,before+delta),after=change?.after??Math.max(1,before+delta);
 if(!change&&delta<0)selected.entry.player={...selected.player,ovr:after};
 return `${selected.player.name}: OVR ${before} → ${after} (${after-before>=0?'+':''}${after-before}) fino al termine della stagione.`;
}
function tacticianPlayerOvr(player){return Math.max(1,ductilityEffectiveBaseOvr(player)+activeOvrBonus(player))}
function optimizeLineupWithBench(){
 const roster=state.draft.roster;
 const changes=[];
 let guard=0;
 while(guard++<20){
   const benches=roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.entry.bench&&item.player).sort((a,b)=>tacticianPlayerOvr(b.player)-tacticianPlayerOvr(a.player));
   let swap=null;
   for(const bench of benches){
     const benchOvr=tacticianPlayerOvr(bench.player);
     const targets=roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>!item.entry.bench&&Number(item.entry.tipsterForcedMatches)<=0&&Number(item.entry.captainForcedMatches)<=0&&Number(item.entry.leaderQuestForcedMatches)<=0&&item.player&&userCompatible(bench.player,item.entry.slot)&&tacticianPlayerOvr(item.player)<benchOvr).sort((a,b)=>tacticianPlayerOvr(a.player)-tacticianPlayerOvr(b.player));
     if(targets.length){swap={bench,target:targets[0]};break}
   }
   if(!swap)break;
   const benchEntry={...swap.bench.entry},targetEntry={...swap.target.entry};
   roster[swap.target.index]={...benchEntry,bench:false,slot:targetEntry.slot,slotId:targetEntry.slotId};
   roster[swap.bench.index]={...targetEntry,bench:true,slot:benchEntry.slot,slotId:benchEntry.slotId};
   changes.push(`${swap.bench.player.name} entra al posto di ${swap.target.player.name} nello slot ${targetEntry.slot}`);
 }
 return changes.length?`Formazione ottimizzata: ${changes.join(' · ')}.`:'La formazione era già la migliore possibile con i panchinari disponibili.';
}
function activatePersistentTactician(){
 state.seasonRules.autoOptimizeLineup=true;
 const result=optimizeLineupWithBench();
 return `${result} Il tattico controllerà nuovamente la formazione dopo ogni cambiamento di OVR o di giocatori, fino a fine stagione.`;
}
function activateFantaguru(){
 state.seasonRules.fantaguruBetterMidseason=true;
 return 'Al draft di metà stagione ogni pack conterrà almeno un giocatore con OVR superiore a quello che stai cedendo.';
}
function mysteriousLakakaEventAvailable(){
 if(playerArrivalIsBlocked())return false;
 const entries=rosterPlayers().filter(entry=>entry?.player);
 return entries.some(entry=>roleOf(entry.player)==='P')&&entries.some(entry=>roleOf(entry.player)==='A');
}
function mysteriousRoleReplacementTarget(role){
 const rows=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player&&roleOf(item.player)===role);
 const starters=rows.filter(item=>!item.entry.bench),pool=starters.length?starters:rows;
 return [...pool].sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0]||null;
}
function receiveMysteriousLakakaPlayer(kind='lakaka'){
 if(playerArrivalIsBlocked())return playerArrivalBlockMessage();
 const lakaka=String(kind)==='lakaka';
 const target=mysteriousRoleReplacementTarget(lakaka?'P':'A');
 if(!target)return lakaka?'Non hai un portiere da sostituire.':'Non hai un attaccante da sostituire.';
 const base=lakaka
  ?{name:'Lakaka',nation:'Congo',Position:'P',role:'P',roleLabel:'Portiere',ovr:88,baseOvr:88}
  :{name:'Lukaku',nation:'Belgio',Position:'ATT',role:'A',roleLabel:'Attaccante',ovr:78,baseOvr:78};
 if(!youngBeautifulAllowsPlayer(base))return youngBeautifulBlockMessage(base);
 const id=`event-${lakaka?'lakaka':'lukaku'}-${String(state.meta?.seasonId||state.meta?.createdAt||Date.now()).replace(/[^a-z0-9]/gi,'')}-${Number(state.matchday)||0}`;
 const incoming=registerGeneratedEventPlayer({...base,id,club:USER_ID,subscriber:'no',abbonato:'no',eventPlayer:true,mysteriousPlayer:true});
 const change=replaceUserRosterPlayer(target.index,incoming);if(!change||change.blocked)return change?.message||'Il nuovo giocatore non può entrare in rosa.';
 refreshOpponentClubRosters();
 return `${incoming.name} (${incoming.ovr} OVR, ${incoming.nation}) prende il posto di ${change.outgoing?.name||'un giocatore'} nello slot ${change.slot||incoming.Position}.`;
}
function thriftyPresidentEventAvailable(){return rosterPlayers().filter(entry=>entry?.player).length>=3}
function activateThriftyPresidentCuts(){
 const candidates=shuffle(rosterPlayers().filter(entry=>entry?.player)).slice(0,3),removed=[];
 candidates.forEach(entry=>{const name=entry.player?.name||playerById(entry.playerId)?.name||'Giocatore';const message=removeOwnRosterPlayerPermanently(entry,'i tagli del presidente tirchio');if(!message.startsWith('Nessun'))removed.push(name)});
 state.seasonRules.bottomHalfUnbeaten=true;
 state.seasonRules.thriftyPresidentRemovedPlayers=[...new Set([...(state.seasonRules.thriftyPresidentRemovedPlayers||[]),...removed])];
 return `${removed.length?removed.join(', '):'Tre giocatori'} lasciano la squadra. Da ora non puoi perdere contro club che occupano dall’11° posto in giù prima della partita: un’eventuale sconfitta viene trasformata in pareggio.`;
}
function activateThriftyPresidentMarketBlock(){
 state.seasonRules.marketBlocked=true;
 if(typeof seasonInventory==='function'){const inventory=seasonInventory();if(inventory?.pendingPack){inventory.pendingPack=null;if(typeof addSeasonItem==='function')addSeasonItem('panini-pack',1)}}
 state.seasonRules.mandatoryMidseasonPlayerId='';state.seasonRules.mandatoryMidseasonPlayerIds=[];
 state.seasonRules.guaranteedTopPlayerNextMidseason=false;state.seasonRules.coachTopSwapPlayerId='';state.seasonRules.topPlayerAfterMandatoryId='';
 if(state.midseason&&typeof state.midseason==='object'){state.midseason.outgoingId='';state.midseason.mandatoryOutgoingId='';state.midseason.mandatoryOutgoingIds=[];state.midseason.clubId='';state.midseason.candidates=[];state.midseason.pendingCandidateId='';}
 return 'Il mercato viene bloccato fino al termine della stagione: niente draft di metà campionato e nessun nuovo giocatore potrà entrare in rosa tramite eventi o oggetti.';
}
function bottomHalfUnbeatenOpponentRank(opponentId){const table=sortedTable(),index=table.findIndex(row=>String(row.id)===String(opponentId));return index>=0?index+1:0}
function bottomHalfUnbeatenApplies(opponentId){return Boolean(state.seasonRules?.bottomHalfUnbeaten&&bottomHalfUnbeatenOpponentRank(opponentId)>=11)}
function registerGeneratedEventPlayer(player){
 state.seasonRules.generatedEventPlayers=Array.isArray(state.seasonRules.generatedEventPlayers)?state.seasonRules.generatedEventPlayers:[];
 const id=String(player.id),index=state.seasonRules.generatedEventPlayers.findIndex(item=>String(item.id)===id);
 if(index>=0)state.seasonRules.generatedEventPlayers[index]={...player,id};else state.seasonRules.generatedEventPlayers.push({...player,id});
 return state.seasonRules.generatedEventPlayers.find(item=>String(item.id)===id);
}
function fantaguruCandidate(outgoing,pool){
 const list=(pool||[]).filter(Boolean);
 if(!list.length)return null;
 const outgoingPlayer=outgoing?.player||playerById(outgoing?.playerId),outgoingOvr=Number(outgoingPlayer?.ovr)||0;
 const stronger=[...list].filter(player=>(Number(player.ovr)||0)>outgoingOvr).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0];
 if(stronger)return stronger;
 const strongest=[...list].sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0];
 if(!strongest)return null;
 const boosted={...strongest,baseOvr:originalBaseOvr(strongest),id:`event-fantaguru-${state.meta?.createdAt||Date.now()}-${state.midseason?.step||0}-${Date.now()}`,ovr:Math.max(outgoingOvr+1,(Number(strongest.ovr)||0)+1),eventPlayer:true,fantaguru:true};
 return registerGeneratedEventPlayer(boosted);
}
