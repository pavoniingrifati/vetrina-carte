/* Fantaballa Season Engine — 08-special-rules.js
 * Azioni degli eventi, regolamenti speciali, playoff e modificatori persistenti.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
function injureOwnPlayers(entries,rounds=1){
 const valid=(entries||[]).filter(Boolean);
 valid.forEach(entry=>setOwnPlayerInjury(entry,rounds));
 return valid.map(entry=>entry.player.name);
}
function injureNextOpponentPlayers(count=1){
 const team=nextOpponentTeam();
 if(!team)return 'Nessun avversario disponibile.';
 const candidates=shuffle(opponentRosterPlayers(team).filter(player=>!player.isMascot&&opponentStatusOf(team,player.id).injury<=0)).slice(0,count);
 candidates.forEach(player=>opponentStatusOf(team,player.id).injury=Math.max(opponentStatusOf(team,player.id).injury,1));
 return candidates.length?`${candidates.map(player=>player.name).join(' e ')} salteranno la prossima partita con ${team.name}.`:'Nessun giocatore avversario disponibile.';
}
function addMascotToRandomTeam(){
 const candidates=state.teams.filter(team=>team.id!==USER_ID&&!team.mascot);
 const team=pick(candidates.length?candidates:state.teams.filter(team=>team.id!==USER_ID));
 if(!team)return 'Nessuna squadra avversaria disponibile.';
 team.mascot={id:`mascot-${team.id}`,name:'Mascotte della squadra',ovr:99,Position:'ATT',role:'A',nation:team.name,subscriber:'no',isMascot:true};
 return `La mascotte firma per ${team.name} con 99 OVR.`;
}

function creatorInUserRoster(playerId){return state.draft.roster.some(entry=>String(entry.playerId)===String(playerId)||String(entry.player?.sourceCreatorId||'')===String(playerId))}
function opponentExcludedPlayerIds(){state.seasonRules.opponentExcludedPlayerIds=[...new Set((Array.isArray(state.seasonRules.opponentExcludedPlayerIds)?state.seasonRules.opponentExcludedPlayerIds:[]).map(String).filter(Boolean))];return state.seasonRules.opponentExcludedPlayerIds}
function excludeOpponentPlayer(playerId){const list=opponentExcludedPlayerIds(),id=String(playerId);if(!list.includes(id))list.push(id);return list}
function sendCreatorToRandomOpponent(playerId,tag='creator'){
 const source=playerById(playerId);if(!source)return 'Creator non trovato nel database.';
 excludeOpponentPlayer(playerId);refreshOpponentClubRosters();
 const candidates=(state.teams||[]).filter(team=>team&&team.id!==USER_ID&&!team.externalCompetition);
 const target=pick(candidates);if(!target)return 'Nessuna squadra casuale disponibile.';
 if(!Array.isArray(target.roster)||!target.roster.length)target.roster=target.clubId?buildClubRoster(target.clubId,currentUserPlayerIds()):buildNationRoster(target.name);
 const incoming=registerGeneratedEventPlayer({...source,id:`event-${tag}-${target.id}-${Number(state.matchday)||0}`,club:target.clubId||target.id,eventPlayer:true,creatorTransfer:true,sourceCreatorId:String(playerId)});
 const rosterPlayersForTarget=target.roster.map(id=>playerById(id)).filter(Boolean),sameRole=rosterPlayersForTarget.filter(player=>roleOf(player)===roleOf(source)),outgoing=(sameRole.length?sameRole:rosterPlayersForTarget).sort((a,b)=>(Number(a.ovr)||0)-(Number(b.ovr)||0))[0];
 if(outgoing){const index=target.roster.findIndex(id=>String(id)===String(outgoing.id));if(index>=0)target.roster[index]=String(incoming.id)}else target.roster.push(String(incoming.id));
 target.controlSwapLockedRoster=true;target.playerOverrides=target.playerOverrides&&typeof target.playerOverrides==='object'?target.playerOverrides:{};
 return `${source.name} firma per ${target.name}${outgoing?` al posto di ${outgoing.name}`:''}.`;
}
function sendBaroneSportivoToRandomTeam(){return sendCreatorToRandomOpponent('850','barone-sportivo')}
function stefanoFinariChallengeState(){
 const current=state.seasonRules.stefanoFinariChallenge&&typeof state.seasonRules.stefanoFinariChallenge==='object'?state.seasonRules.stefanoFinariChallenge:{};
 current.active=Boolean(current.active);current.startedMatchday=Number.isFinite(Number(current.startedMatchday))?Number(current.startedMatchday):-1;current.resolved=Boolean(current.resolved);current.result=String(current.result||'');state.seasonRules.stefanoFinariChallenge=current;return current;
}
function acceptStefanoFinariChallenge(){const challenge=stefanoFinariChallengeState();Object.assign(challenge,{active:true,startedMatchday:Number(state.matchday),resolved:false,result:''});return `${state.teamName} diventa ufficialmente la seconda squadra preferita di Stefano Finari. La prossima partita deciderà tutto.`}
function guaranteeNextMatchExpulsion(){pushEffect('refChaos',1,1,{opponentRedChance:0,ownRedChance:1,source:'Rifiuto a Stefano Finari'});return 'Nella prossima partita un tuo giocatore verrà sicuramente espulso.'}
function bringStefanoFinariIntoRoster(){
 if(playerArrivalIsBlocked())return playerArrivalBlockMessage();
 const source=playerById('851');if(!source)return 'Stefano Finari non è disponibile nel database.';
 if(creatorInUserRoster('851'))return 'Stefano Finari è già presente nella tua rosa.';
 excludeOpponentPlayer('851');refreshOpponentClubRosters();
 const candidates=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player),bench=candidates.filter(item=>item.entry.bench),target=(bench.length?bench:candidates).sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0];
 if(!target)return 'Non c’è spazio disponibile in rosa per Stefano Finari.';
 const incoming=registerGeneratedEventPlayer({...source,id:`event-stefano-finari-user-${Number(state.matchday)||0}`,club:USER_ID,eventPlayer:true,creatorTransfer:true,sourceCreatorId:'851'}),outgoingId=String(target.entry.playerId||''),outgoingName=target.player.name;
 target.entry.playerId=String(incoming.id);target.entry.player={...incoming};if(outgoingId){delete state.statuses[outgoingId];delete state.playInjured[outgoingId];clearMandatoryMidseasonPlayer(outgoingId)}state.statuses[String(incoming.id)]={injury:0,suspension:0,seasonOut:false,seasonOutReason:''};refreshOpponentClubRosters();
 return `Stefano Finari entra in rosa al posto di ${outgoingName}.`;
}
function tickCreatorEventsAfterMatch(result){
 if(!result)return;const challenge=stefanoFinariChallengeState();if(!challenge.active||Number(result.matchday)<=Number(challenge.startedMatchday))return;
 challenge.active=false;challenge.resolved=true;result.eventUpdates=Array.isArray(result.eventUpdates)?result.eventUpdates:[];
 if(Number(result.gf)<Number(result.ga)){
   const arrival=bringStefanoFinariIntoRoster();pushSeasonEffect('refChaos',1,{opponentRedChance:0,ownRedChance:.8,source:'Stefano Finari furioso'});challenge.result=`${arrival} Il rischio di espulsione sale drasticamente fino a fine stagione.`;result.eventUpdates.push({success:false,title:'Stefano Finari furioso',message:challenge.result});
 }else if(Number(result.gf)>Number(result.ga)){challenge.result='Hai vinto: nulla accade, hai fatto il tuo dovere.';result.eventUpdates.push({success:true,title:'Stefano Finari',message:challenge.result})}
 else{challenge.result='La partita termina in pareggio: Stefano resta in tribuna e non entra in rosa.';result.eventUpdates.push({success:true,title:'Stefano Finari',message:challenge.result})}
 recordSeasonEvent({kind:'auto',title:'Stefano Finari',choice:Number(result.gf)<Number(result.ga)?'Sconfitta':Number(result.gf)>Number(result.ga)?'Vittoria':'Pareggio',effect:'Esito della prossima partita',result:challenge.result,automatic:true},analyticsSnapshot());
}

function replaceUserRosterPlayer(index,replacement){
 const entry=state.draft.roster[index];
 if(!entry||!replacement)return null;
 const outgoing=entry.player||playerById(entry.playerId);
 if(playerArrivalIsBlocked())return{blocked:true,outgoing,incoming:null,slot:entry.slot,bench:Boolean(entry.bench),message:playerArrivalBlockMessage()};
 if(!youngBeautifulAllowsPlayer(replacement))return{blocked:true,outgoing,incoming:null,slot:entry.slot,bench:Boolean(entry.bench),message:youngBeautifulBlockMessage(replacement)};
 const outgoingId=String(entry.playerId||outgoing?.id||'');
 const incoming={...replacement,id:String(replacement.id)};
 entry.playerId=String(incoming.id);
 entry.player=incoming;
 if(outgoingId){delete state.playInjured[outgoingId];delete state.statuses[outgoingId];clearMandatoryMidseasonPlayer(outgoingId)}
 state.statuses[String(incoming.id)]={injury:0,suspension:0,seasonOut:false,seasonOutReason:''};
 return {outgoing,incoming,slot:entry.slot,bench:Boolean(entry.bench)};
}
function weakestRosterItem(){return state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player).sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0]||null}
function eventPlayerClone(player,universe='multiverso'){
 if(!player)return null;const stamp=`${Date.now()}-${Math.floor(Math.random()*100000)}`;
 return registerGeneratedEventPlayer({...player,baseOvr:originalBaseOvr(player),id:`event-${universe}-${String(player.id||'x')}-${stamp}`,club:USER_ID,eventPlayer:true,eventUniverse:universe});
}
function replaceWeakestWithUniverse(pool,label,universe){
 if(playerArrivalIsBlocked())return playerArrivalBlockMessage();
 const weakest=weakestRosterItem(),candidates=(Array.isArray(pool)?pool:[]).filter(player=>player&&player.id&&player.name&&youngBeautifulAllowsPlayer(player));
 if(!weakest)return 'Nessun giocatore disponibile da sostituire.';if(!candidates.length)return `Il portale verso ${label} non ha trovato giocatori.`;
 const source=pick(candidates),incoming=eventPlayerClone(source,universe),change=replaceUserRosterPlayer(weakest.index,incoming);refreshOpponentClubRosters();
 return `${change?.outgoing?.name||'Il giocatore più scarso'} lascia la rosa: dal ${label} arriva ${incoming.name} (${Number(incoming.ovr)||0} OVR).`;
}
function multiverseClassic(){return replaceWeakestWithUniverse(CLASSIC_PLAYERS,'Campionato del Ca***','classic')}
function multiverseReal(){return replaceWeakestWithUniverse(REAL_PLAYERS,'Fantacampionato del Ca***','real')}
function italianPlayerPools(){const pools=[PLAYERS,PLAYERS===CLASSIC_PLAYERS?REAL_PLAYERS:CLASSIC_PLAYERS,CLASSIC_PLAYERS,REAL_PLAYERS];const seen=new Set();return pools.map(pool=>(Array.isArray(pool)?pool:[]).filter(player=>{const key=`${String(player?.id||'')}|${normalizeName(player?.name||'')}|${normalizeName(player?.nation||'')}`;if(!player||!player.id||!isItalianPlayer(player)||!youngBeautifulAllowsPlayer(player)||seen.has(key))return false;seen.add(key);return true})).filter(pool=>pool.length)}
function italianReplacementForEntry(entry,usedSources=new Set()){
 const pools=italianPlayerPools();
 const chooseFrom=pool=>{let candidates=pool.filter(player=>!usedSources.has(`${String(player.id)}|${normalizeName(player.name)}`));if(!entry?.bench)candidates=candidates.filter(player=>userCompatible(player,entry.slot));if(!candidates.length&&!entry?.bench)candidates=pool.filter(player=>!usedSources.has(`${String(player.id)}|${normalizeName(player.name)}`)&&roleOf(player)===POSITION_ROLE[entry.slot]);return candidates.length?pick(candidates):null};
 for(const pool of pools){const found=chooseFrom(pool);if(found)return found}return null;
}
function replaceNonItalianWithItalians(){
 if(playerArrivalIsBlocked())return playerArrivalBlockMessage();
 const targets=state.draft.roster.map((entry,index)=>({entry,index,player:entry.player||playerById(entry.playerId)})).filter(item=>item.player&&!isItalianPlayer(item.player));
 if(!targets.length)return 'La rosa è già composta soltanto da giocatori italiani.';
 const usedSources=new Set(),changes=[],records=[];
 targets.forEach(item=>{
   const source=italianReplacementForEntry(item.entry,usedSources);if(!source)return;
   usedSources.add(`${String(source.id)}|${normalizeName(source.name)}`);
   const originalStatus=state.statuses?.[String(item.entry.playerId)]?{...state.statuses[String(item.entry.playerId)]}:null;
   const incoming=eventPlayerClone(source,'rimmigrazione'),change=replaceUserRosterPlayer(item.index,incoming);
   if(change){changes.push(`${change.outgoing?.name||'Giocatore'} → ${incoming.name}`);records.push({replacementId:String(incoming.id),slotId:String(item.entry.slotId||''),slot:String(item.entry.slot||''),bench:Boolean(item.entry.bench),originalPlayer:{...change.outgoing,id:String(change.outgoing?.id||item.entry.playerId)},originalStatus});}
 });
 refreshOpponentClubRosters();
 let generalWillReturn=false;
 if(records.length){
   generalWillReturn=Math.random()<.5;
   const chain=generalChain();
   Object.assign(chain,{active:generalWillReturn,stage:generalWillReturn?1:0,dueMatchday:generalWillReturn?Number(state.matchday)+chainedDelay(3,6):-1,replacements:records,nationalBoostPending:false,completed:!generalWillReturn});
 }
 const returnNotice=generalWillReturn?'Il generale tornerà a controllare i documenti tra alcune giornate.':'Il generale se ne va: potrebbe non tornare.';
 return changes.length===targets.length?`Rimmigrazione completata: ${changes.length} giocatori non italiani sono stati sostituiti. ${returnNotice} ${changes.join(' · ')}`:`Sostituiti ${changes.length} giocatori non italiani su ${targets.length}. ${returnNotice} ${changes.join(' · ')}`;
}
function chaosReplaceNonItalianWithItalians(team){
 if(!team||!Array.isArray(team.roster))return 'Nessuna rosa disponibile.';
 const usedSources=new Set(),changes=[];
 [...team.roster].forEach((playerId,index)=>{const outgoing=chaosPlayer(team,playerId);if(!outgoing||isItalianPlayer(outgoing)||outgoing.isMascot)return;const pools=italianPlayerPools();let source=null;for(const pool of pools){let candidates=pool.filter(player=>!usedSources.has(`${String(player.id)}|${normalizeName(player.name)}`)&&roleOf(player)===roleOf(outgoing));if(!candidates.length)candidates=pool.filter(player=>!usedSources.has(`${String(player.id)}|${normalizeName(player.name)}`));if(candidates.length){source=pick(candidates);break}}if(!source)return;usedSources.add(`${String(source.id)}|${normalizeName(source.name)}`);const incoming=chaosRegisterGeneratedPlayer({...source,id:`chaos-rimmigrazione-${team.id}-${state.matchday}-${index}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,club:team.id,eventPlayer:true});team.roster[index]=String(incoming.id);changes.push(`${outgoing.name} → ${incoming.name}`)});
 return changes.length?`Rimmigrazione completata: ${changes.length} sostituzioni. ${changes.join(' · ')}`:'La rosa è già tutta italiana.';
}
