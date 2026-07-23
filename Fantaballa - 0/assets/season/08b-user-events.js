/* Fantaballa Season Engine — 08b-user-events.js
 * Eventi utente aggiuntivi con conseguenze nelle partite successive.
 */
function userEventState(key,defaults={}){
 const rules=state.seasonRules||(state.seasonRules={});
 const current=rules[key]&&typeof rules[key]==='object'?rules[key]:{};
 rules[key]={...defaults,...current};
 return rules[key];
}
function userEventUpdate(result,success,title,message){
 if(!result||!message)return;
 result.eventUpdates=Array.isArray(result.eventUpdates)?result.eventUpdates:[];
 result.eventUpdates.push({success:Boolean(success),title:String(title||'Evento'),message:String(message)});
}
function userEventEntryById(playerId){return rosterEntry(String(playerId||''))||null}
function userEventPlayerByEntry(entry){return entry?.player||playerById(entry?.playerId)||null}
function userEventLowestStarter(){return [...getStarterEntries()].filter(entry=>userEventPlayerByEntry(entry)).sort((a,b)=>(Number(userEventPlayerByEntry(a)?.ovr)||0)-(Number(userEventPlayerByEntry(b)?.ovr)||0))[0]||null}
function userEventRandomRoster(){return pick(rosterPlayers())||null}
function userEventRandomStarter(){return pick(getStarterEntries())||null}
function userEventPermanentDelta(playerId,delta){
 const entry=userEventEntryById(playerId),player=userEventPlayerByEntry(entry);if(!entry||!player)return null;
 return setPermanentRosterOvr(entry,(Number(player.ovr)||60)+Number(delta||0));
}
function userEventGeneratedId(prefix,sourceId='x'){return `event-${prefix}-${String(sourceId)}-${Number(state.matchday)||0}-${Math.floor(Math.random()*1000000)}`}
function userEventBenchSlot(){const count=state.draft.roster.filter(entry=>entry.bench).length+1;return {slot:`R${count}`,slotId:`bench-${count}`} }
function userEventAddBenchPlayer(player){
 const registered=registerGeneratedEventPlayer(player),slot=userEventBenchSlot();
 state.draft.roster.push({playerId:String(registered.id),player:{...registered},slot:slot.slot,slotId:slot.slotId,bench:true,malus:0});
 state.statuses[String(registered.id)]={injury:0,suspension:0,seasonOut:false,seasonOutReason:''};
 refreshOpponentClubRosters();return registered;
}
function userEventAddOpponentPlayer(player,target){
 const registered=registerGeneratedEventPlayer(player);if(!Array.isArray(target.roster))target.roster=[];
 target.roster.push(String(registered.id));target.controlSwapLockedRoster=true;
 target.playerOverrides=target.playerOverrides&&typeof target.playerOverrides==='object'?target.playerOverrides:{};
 return registered;
}
function userEventRemovePlayer(playerId,reason=''){
 const entry=userEventEntryById(playerId);return entry?removeOwnRosterPlayerPermanently(entry,reason):'Il giocatore non è più presente in rosa.';
}
function userEventSwapStarterBench(starter,bench){
 if(!starter||!bench)return false;
 const starterSlot=starter.slot,starterSlotId=starter.slotId,benchSlot=bench.slot,benchSlotId=bench.slotId;
 Object.assign(starter,{bench:true,slot:benchSlot||'R',slotId:benchSlotId||`bench-${starter.playerId}`});
 Object.assign(bench,{bench:false,slot:starterSlot,slotId:starterSlotId});return true;
}
function userEventMoveToBench(playerId){
 const target=userEventEntryById(playerId);if(!target)return false;if(target.bench)return true;
 const bench=state.draft.roster.filter(entry=>entry.bench&&String(entry.playerId)!==String(playerId)).map(entry=>({entry,player:userEventPlayerByEntry(entry)})).filter(item=>item.player);
 let replacement=bench.find(item=>userCompatible(item.player,target.slot));
 if(!replacement)replacement=bench.find(item=>roleOf(item.player)===POSITION_ROLE[target.slot]);
 if(!replacement)replacement=bench.sort((a,b)=>(Number(b.player.ovr)||0)-(Number(a.player.ovr)||0))[0];
 if(replacement)return userEventSwapStarterBench(target,replacement.entry);
 target.bench=true;target.slot='R';target.slotId=`event-bench-${target.playerId}`;return true;
}
function userEventMoveToStarter(playerId){
 const target=userEventEntryById(playerId);if(!target)return false;if(!target.bench)return true;
 const starters=state.draft.roster.filter(entry=>!entry.bench&&String(entry.playerId)!==String(playerId)).map(entry=>({entry,player:userEventPlayerByEntry(entry)})).filter(item=>item.player);
 let outgoing=starters.filter(item=>userCompatible(target.player||playerById(target.playerId),item.entry.slot)).sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0];
 if(!outgoing)outgoing=starters.filter(item=>roleOf(item.player)===roleOf(target.player||playerById(target.playerId))).sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0];
 if(!outgoing)outgoing=starters.sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0))[0];
 return outgoing?userEventSwapStarterBench(outgoing.entry,target):false;
}

/* Il rigorista improvvisato */
function improvisedPenaltyState(){return userEventState('improvisedPenalty',{active:false,playerId:'',playerName:'',startedMatchday:-1,resolved:false,lastOutcome:null})}
function improvisedPenaltyAvailable(){return Boolean(userEventLowestStarter()&&!improvisedPenaltyState().active)}
function improvisedPenaltyContext(){const entry=userEventLowestStarter(),player=userEventPlayerByEntry(entry);return player?{playerId:String(entry.playerId),playerName:player.name}:{} }
function improvisedPenaltyDescription(context){return `${context?.playerName||'Il titolare con l’OVR più basso'} sostiene di essere il miglior rigorista della squadra.`}
function acceptImprovisedPenalty(context){const player=userEventEntryById(context?.playerId);if(!player)return'Il giocatore non è più disponibile.';Object.assign(improvisedPenaltyState(),{active:true,playerId:String(context.playerId),playerName:String(context.playerName||userEventPlayerByEntry(player)?.name||'Giocatore'),startedMatchday:Number(state.matchday),resolved:false,lastOutcome:null});return `${context.playerName} batterà l’eventuale rigore della prossima partita.`}
function rejectImprovisedPenalty(context){const entry=userEventEntryById(context?.playerId),player=userEventPlayerByEntry(entry);if(!entry||!player)return'Il giocatore non è più disponibile.';pushEffect('playerOvr',-2,1,{playerId:String(entry.playerId),source:'Rigorista improvvisato rifiutato'});return `${player.name} perde fiducia: -2 OVR nella prossima partita.`}
function applyImprovisedPenaltyDuringMatch(events,lineup,userTeam,opponent,duration=90){
 const challenge=improvisedPenaltyState();if(!challenge.active)return null;
 const entry=(lineup||[]).find(item=>String(item.playerId)===String(challenge.playerId)),player=entry?.player||playerById(challenge.playerId);
 challenge.active=false;challenge.resolved=true;
 if(!entry||!player){challenge.lastOutcome={awarded:false,missing:true,playerName:challenge.playerName};return challenge.lastOutcome}
 const awarded=Math.random()<.35;if(!awarded){challenge.lastOutcome={awarded:false,playerId:String(entry.playerId),playerName:player.name};return challenge.lastOutcome}
 const scoreChance=clamp(.56+((Number(player.ovr)||60)-60)/100,.56,.86),scored=Math.random()<scoreChance;
 let change=null;
 if(scored){const generated=buildTeamGoals(1,[entry],userTeam,opponent,[],duration)?.[0]||regulationGoalEvent(userTeam,opponent,duration,player.name);generated.playerId=String(entry.playerId);generated.player=player.name;generated.isImprovisedPenalty=true;generated.description=`Rigore calciato da ${player.name}: palla in rete.`;events.push(generated);change=userEventPermanentDelta(entry.playerId,5)}
 else change=userEventPermanentDelta(entry.playerId,-5);
 challenge.lastOutcome={awarded:true,scored,playerId:String(entry.playerId),playerName:player.name,delta:scored?5:-5,newOvr:change?.after||Number(player.ovr)||0};return challenge.lastOutcome;
}

/* Il fratello scarso */
function weakBrotherState(){return userEventState('weakBrother',{active:false,branch:'',originalPlayerId:'',originalPlayerName:'',brotherId:'',brotherName:'',targetTeamId:'',targetTeamName:'',dueMatchday:-1,secondActDone:false,lastOutcome:''})}
function weakBrotherAvailable(){return Boolean(rosterPlayers().length&&!weakBrotherState().active&&Number(state.matchday)<seasonLength()-2)}
function weakBrotherContext(){const entry=userEventRandomRoster(),player=userEventPlayerByEntry(entry);return player?{playerId:String(entry.playerId),playerName:player.name}:{} }
function weakBrotherDescription(context){return `${context?.playerName||'Un giocatore della rosa'} chiede se suo fratello può entrare in squadra.`}
function weakBrotherClone(context,branch='user'){
 const source=userEventPlayerByEntry(userEventEntryById(context?.playerId));if(!source)return null;
 return {id:userEventGeneratedId(`weak-brother-${branch}`,source.id),name:`Fratello di ${source.name}`,role:roleOf(source),Position:String(source.Position||positions(source).join(', ')||'CC'),roleLabel:String(source.roleLabel||''),nation:String(source.nation||'Italia'),ovr:Math.max(1,(Number(source.ovr)||60)-30),baseOvr:Math.max(1,(Number(source.ovr)||60)-30),subscriber:'no',abbonato:'no',club:branch==='user'?USER_ID:'',eventPlayer:true,weakBrother:true,sourceBrotherOfId:String(source.id)};
}
function acceptWeakBrother(context){
 if(talentScoutBlocksExternalArrival())return talentScoutBlockMessage();const source=userEventPlayerByEntry(userEventEntryById(context?.playerId)),clone=weakBrotherClone(context,'user');if(!source||!clone)return'Il giocatore non è più disponibile.';
 const brother=userEventAddBenchPlayer(clone),remaining=Math.max(2,seasonLength()-Number(state.matchday)-1),delay=Math.min(2+Math.floor(Math.random()*5),remaining);
 Object.assign(weakBrotherState(),{active:true,branch:'user',originalPlayerId:String(source.id),originalPlayerName:source.name,brotherId:String(brother.id),brotherName:brother.name,targetTeamId:'',targetTeamName:'',dueMatchday:Number(state.matchday)+delay,secondActDone:false,lastOutcome:''});
 return `${brother.name} entra in rosa con ${brother.ovr} OVR, nello stesso ruolo di ${source.name}.`;
}
function rejectWeakBrother(context){
 const source=userEventPlayerByEntry(userEventEntryById(context?.playerId)),clone=weakBrotherClone(context,'opponent');if(!source||!clone)return'Il giocatore non è più disponibile.';
 const teams=(state.teams||[]).filter(team=>team&&team.id!==USER_ID&&!team.externalCompetition),target=pick(teams);if(!target)return'Nessuna squadra avversaria disponibile.';
 clone.club=target.clubId||target.id;const brother=userEventAddOpponentPlayer(clone,target);
 Object.assign(weakBrotherState(),{active:true,branch:'opponent',originalPlayerId:String(source.id),originalPlayerName:source.name,brotherId:String(brother.id),brotherName:brother.name,targetTeamId:String(target.id),targetTeamName:target.name,dueMatchday:-1,secondActDone:false,lastOutcome:''});
 return `${brother.name} firma per ${target.name} con ${brother.ovr} OVR. Ogni volta che ti affronterà, segnerà sicuramente.`;
}
function resolveWeakBrotherSecondAct(){
 const chain=weakBrotherState();if(!chain.active||chain.branch!=='user'||chain.secondActDone)return'';chain.secondActDone=true;chain.active=false;
 const original=userEventEntryById(chain.originalPlayerId),brother=userEventEntryById(chain.brotherId);let message='';
 if(Math.random()<.5&&original){const change=userEventPermanentDelta(chain.originalPlayerId,20);message=change?`${change.player.name}, felice di avere il fratello in rosa, ottiene +20 OVR e sale a ${change.after}.`:'Il bonus al giocatore non può essere applicato.'}
 else if(brother){const change=setPermanentRosterOvr(brother,1);message=change?`${change.player.name} crolla improvvisamente a 1 OVR.`:'Il fratello non è più presente in rosa.'}
 else message='La situazione dei due fratelli si è risolta senza conseguenze perché uno dei giocatori non è più in rosa.';
 chain.lastOutcome=message;return message;
}
function prepareCustomUserChainedEvent(){const chain=weakBrotherState(),day=Number(state.matchday);if(chain.active&&chain.branch==='user'&&!chain.secondActDone&&day>=Number(chain.dueMatchday))return queueChainedAuto('Il fratello scarso · Parte 2','La convivenza tra i due fratelli produce una conseguenza inattesa.',resolveWeakBrotherSecondAct());return false}
function applyWeakBrotherOpponentGoal(events,opponent,userTeam,duration=90){
 const chain=weakBrotherState();if(!chain.active||chain.branch!=='opponent'||String(chain.targetTeamId)!==String(opponent?.id))return null;
 const brother=playerById(chain.brotherId);if(!brother)return null;
 const minute=Math.max(2,Math.min(Number(duration)||90,8+Math.floor(Math.random()*Math.max(1,(Number(duration)||90)-10))));
 events.push({minute,playerId:String(brother.id),assistId:'',player:brother.name,assist:'',teamId:String(opponent.id),teamName:opponent.name,goalValue:goalValueForMinute(minute),isWeakBrotherGoal:true,description:`${brother.name} segna inevitabilmente contro la squadra di suo fratello.`});
 return {playerId:String(brother.id),playerName:brother.name,teamName:opponent.name};
}

/* Il portiere vuole segnare */
function goalkeeperScorerState(){return userEventState('goalkeeperScorer',{active:false,playerId:'',playerName:'',matchesRemaining:0,rewarded:false,startedMatchday:-1})}
function goalkeeperScorerAvailable(){return Boolean(startingGoalkeeperEntry()&&!goalkeeperScorerState().active)}
function goalkeeperScorerContext(){const entry=startingGoalkeeperEntry(),player=userEventPlayerByEntry(entry);return player?{playerId:String(entry.playerId),playerName:player.name}:{} }
function goalkeeperScorerDescription(context){return `${context?.playerName||'Il portiere titolare'} chiede di battere tutti i rigori e le punizioni.`}
function acceptGoalkeeperScorer(context){const entry=userEventEntryById(context?.playerId),player=userEventPlayerByEntry(entry);if(!entry||!player)return'Il portiere non è più disponibile.';Object.assign(goalkeeperScorerState(),{active:true,playerId:String(entry.playerId),playerName:player.name,matchesRemaining:3,rewarded:false,startedMatchday:Number(state.matchday)});return `${player.name} avrà possibilità di segnare nelle prossime 3 partite. I contropiedi avversari saranno però più pericolosi.`}
function rejectGoalkeeperScorer(context){const entry=userEventEntryById(context?.playerId),player=userEventPlayerByEntry(entry);if(!entry||!player)return'Il portiere non è più disponibile.';pushEffect('playerOvr',-5,1,{playerId:String(entry.playerId),source:'Portiere rifiutato'});return `${player.name} si offende: -5 OVR nella prossima partita.`}
function applyGoalkeeperScorerDuringMatch(userEvents,opponentEvents,lineup,opponentLineup,userTeam,opponent,duration=90){
 const challenge=goalkeeperScorerState();if(!challenge.active||challenge.matchesRemaining<=0)return null;
 const entry=(lineup||[]).find(item=>String(item.playerId)===String(challenge.playerId)),player=entry?.player||playerById(challenge.playerId);const outcome={playerId:challenge.playerId,playerName:challenge.playerName,scored:false,counterattack:false};
 if(entry&&player&&Math.random()<.35){const goal=buildTeamGoals(1,[entry],userTeam,opponent,[],duration)?.[0]||regulationGoalEvent(userTeam,opponent,duration,player.name);goal.playerId=String(entry.playerId);goal.player=player.name;goal.isGoalkeeperEventGoal=true;goal.description=`${player.name} lascia la porta e segna su calcio piazzato.`;userEvents.push(goal);outcome.scored=true}
 if(Math.random()<.35){const counter=buildTeamGoals(1,opponentLineup,opponent,userTeam,[],duration)?.[0]||regulationGoalEvent(opponent,userTeam,duration,'Contropiede');counter.isGoalkeeperCounterattack=true;counter.description=`Contropiede con la porta scoperta: ${counter.description||'gol avversario.'}`;opponentEvents.push(counter);outcome.counterattack=true}
 return outcome;
}

/* Il contratto scritto male */
function badContractState(){return userEventState('badContract',{active:false,playerId:'',playerName:'',matchesRemaining:0,startedMatchday:-1})}
function badContractAvailable(){return Boolean(rosterPlayers().length&&!badContractState().active)}
function badContractContext(){const entry=userEventRandomRoster(),player=userEventPlayerByEntry(entry);return player?{playerId:String(entry.playerId),playerName:player.name}:{} }
function badContractDescription(context){return `Il contratto di ${context?.playerName||'un giocatore'} contiene un errore: ogni suo gol vale doppio.`}
function acceptBadContract(context){const entry=userEventEntryById(context?.playerId),player=userEventPlayerByEntry(entry);if(!entry||!player)return'Il giocatore non è più disponibile.';Object.assign(badContractState(),{active:true,playerId:String(entry.playerId),playerName:player.name,matchesRemaining:3,startedMatchday:Number(state.matchday)});return `Per le prossime 3 partite ogni gol di ${player.name} vale doppio. Dopo la terza partita lascerà la rosa.`}
function rejectBadContract(context){const entry=userEventEntryById(context?.playerId),player=userEventPlayerByEntry(entry);if(!entry||!player)return'Il giocatore non è più disponibile.';pushEffect('playerOvr',-3,3,{playerId:String(entry.playerId),source:'Contratto corretto'});return `${player.name} resta in rosa, ma riceve -3 OVR per 3 partite.`}
function applyBadContractGoalRule(events){const contract=badContractState();if(!contract.active)return null;let doubled=0;(events||[]).forEach(event=>{if(String(event.playerId)!==String(contract.playerId))return;event.goalValue=Math.max(1,Number(event.goalValue)||1)*2;event.isBadContractDouble=true;event.description=`${event.description||''} Per l’errore nel contratto, il gol vale doppio.`.trim();doubled++});return {playerId:contract.playerId,playerName:contract.playerName,doubled}}

/* Il modulo trovato su internet */
function internetFormationState(){return userEventState('internetFormation',{active:false,oldFormation:'',newFormation:'',startedMatchday:-1})}
function internetFormationAvailable(){return Boolean(!coachIs('three-five-two')&&!internetFormationState().active&&Number(state.matchday)<seasonLength())}
function acceptInternetFormation(){const current=String(state.formation||'4-3-3'),pool=['4-3-3','4-4-2','4-2-3-1','4-5-1','3-5-2','5-3-2','3-4-3','4-3-1-2'].filter(item=>item!==current),chosen=pick(pool)||current;Object.assign(internetFormationState(),{active:true,oldFormation:current,newFormation:chosen,startedMatchday:Number(state.matchday)});state.formation=chosen;return `Il forum di Football Manager impone il ${chosen} nella prossima partita. Vittoria: +2 OVR a tutta la rosa; sconfitta: -2 OVR ai titolari.`}
function rejectInternetFormation(){pushEffect('opponentOvr',3,1,{source:'Forum Football Manager ignorato'});return 'Il modulo viene ignorato, ma il prossimo avversario riceve +3 OVR.'}

/* Il giocatore che porta sfortuna */
function badLuckPlayerState(){return userEventState('badLuckPlayer',{active:false,playerId:'',playerName:'',mode:'',startedMatchday:-1,teamOvrEffect:0})}
function badLuckPlayerAvailable(){return Boolean(getStarterEntries().length&&!badLuckPlayerState().active)}
function badLuckPlayerContext(){const entry=userEventRandomStarter(),player=userEventPlayerByEntry(entry);return player?{playerId:String(entry.playerId),playerName:player.name}:{} }
function badLuckPlayerDescription(context){return `Un indovino sostiene che ${context?.playerName||'un membro della rosa'} porti sfortuna.`}
function benchBadLuckPlayer(context){const entry=userEventEntryById(context?.playerId),player=userEventPlayerByEntry(entry);if(!entry||!player)return'Il giocatore non è più disponibile.';Object.assign(badLuckPlayerState(),{active:true,playerId:String(entry.playerId),playerName:player.name,mode:'bench',startedMatchday:Number(state.matchday),teamOvrEffect:0});userEventMoveToBench(entry.playerId);return `${player.name} viene messo automaticamente in panchina per la prossima partita.`}
function startBadLuckPlayer(context){const entry=userEventEntryById(context?.playerId),player=userEventPlayerByEntry(entry);if(!entry||!player)return'Il giocatore non è più disponibile.';const values=[-5,-4,-3,-2,-1,1,2,3,4,5],value=pick(values);Object.assign(badLuckPlayerState(),{active:true,playerId:String(entry.playerId),playerName:player.name,mode:'starter',startedMatchday:Number(state.matchday),teamOvrEffect:value});userEventMoveToStarter(entry.playerId);pushEffect('teamOvr',value,1,{source:'Giocatore che porta sfortuna'});return `${player.name} deve partire titolare. La squadra riceve ${value>0?'+':''}${value} OVR nella prossima partita.`}
function enforceBadLuckPlayerLineup(){const challenge=badLuckPlayerState();if(!challenge.active)return;if(challenge.mode==='bench')userEventMoveToBench(challenge.playerId);if(challenge.mode==='starter')userEventMoveToStarter(challenge.playerId)}

/* Il ricorso permanente */
function permanentAppealState(){return userEventState('permanentAppeal',{active:false,matchesRemaining:0,startedMatchday:-1,totalCompensation:0,totalOpponentPenalty:0,winPointsWaived:0})}
function permanentAppealAvailable(){return Boolean(!permanentAppealState().active&&Number(state.matchday)<seasonLength()-2)}
function acceptPermanentAppeal(){Object.assign(permanentAppealState(),{active:true,matchesRemaining:3,startedMatchday:Number(state.matchday),totalCompensation:0,totalOpponentPenalty:0,winPointsWaived:0});return 'L’avvocato viene assunto per le prossime 3 partite: nelle sconfitte ricevi 1 punto e l’avversario ne perde 3; nelle vittorie non ottieni punti.'}
function rejectPermanentAppeal(){const leader=(typeof sortedTable==='function'?sortedTable()[0]:null)||Object.values(state.standings||{}).sort((a,b)=>(Number(b?.pts)||0)-(Number(a?.pts)||0))[0];if(!leader)return 'Nessuna squadra disponibile in classifica.';leader.pts=(Number(leader.pts)||0)+3;return `${leader.name||'La squadra prima in classifica'} riceve immediatamente +3 punti.`}
function resolvePermanentAppealAfterMatch(result){
 const appeal=permanentAppealState();if(!appeal.active||!result)return;
 const user=userStanding(),opponent=state.standings?.[String(result.opponentId||'')];
 const won=Number(result.gf)>Number(result.ga),lost=Number(result.gf)<Number(result.ga);let message='Pareggio: il ricorso non modifica i punti della partita.';
 if(lost){if(user)user.pts=(Number(user.pts)||0)+1;if(opponent)opponent.pts=(Number(opponent.pts)||0)-3;result.pointsAwarded=(Number(result.pointsAwarded)||0)+1;result.pointsAdjustment=(Number(result.pointsAdjustment)||0)+1;appeal.totalCompensation=(Number(appeal.totalCompensation)||0)+1;appeal.totalOpponentPenalty=(Number(appeal.totalOpponentPenalty)||0)+3;message=`Sconfitta confermata: +1 punto di risarcimento per te${opponent?` e -3 punti a ${opponent.name||'l’avversario'}`:''}.`;}
 else if(won){const removed=Math.max(0,Number(result.pointsAwarded)||0);if(user&&removed)user.pts=(Number(user.pts)||0)-removed;result.pointsAwarded=Math.max(0,(Number(result.pointsAwarded)||0)-removed);result.pointsAdjustment=(Number(result.pointsAdjustment)||0)-removed;appeal.winPointsWaived=(Number(appeal.winPointsWaived)||0)+removed;message=removed?`Hai vinto, ma il ricorso annulla i ${removed} punti ottenuti dalla partita.`:'Hai vinto, ma il ricorso non ti assegna alcun punto.';}
 appeal.matchesRemaining=Math.max(0,(Number(appeal.matchesRemaining)||0)-1);if(appeal.matchesRemaining<=0)appeal.active=false;
 result.pointsNote=[result.pointsNote,message].filter(Boolean).join(' ');userEventUpdate(result,!lost,'Il ricorso permanente',`${message} ${appeal.matchesRemaining>0?`Restano ${appeal.matchesRemaining} partite.`:'L’accordo con l’avvocato termina.'}`);
}

/* Punti per ogni gol subito */
function concededGoalPointsState(){return userEventState('concededGoalPoints',{active:false,matchesRemaining:0,startedMatchday:-1,totalBonus:0})}
function concededGoalPointsAvailable(){return Boolean(!concededGoalPointsState().active&&Number(state.matchday)<seasonLength()-2)}
function acceptConcededGoalPoints(){Object.assign(concededGoalPointsState(),{active:true,matchesRemaining:3,startedMatchday:Number(state.matchday),totalBonus:0});return 'Per le prossime 3 partite ogni gol subito assegna +1 punto, fino a un massimo di 4 punti per gara.'}
function rejectConcededGoalPoints(){const standing=userStanding();if(standing)standing.pts=(Number(standing.pts)||0)-2;return 'Il documento viene corretto, ma ricevi immediatamente una penalizzazione di 2 punti.'}
function resolveConcededGoalPointsAfterMatch(result){
 const rule=concededGoalPointsState();if(!rule.active||!result)return;
 const goals=Math.max(0,Math.floor(Number.isFinite(Number(result.displayGa))?Number(result.displayGa):Number(result.ga)||0)),bonus=Math.min(4,goals),standing=userStanding();
 if(standing&&bonus)standing.pts=(Number(standing.pts)||0)+bonus;result.pointsAwarded=(Number(result.pointsAwarded)||0)+bonus;result.pointsAdjustment=(Number(result.pointsAdjustment)||0)+bonus;rule.totalBonus=(Number(rule.totalBonus)||0)+bonus;rule.matchesRemaining=Math.max(0,(Number(rule.matchesRemaining)||0)-1);if(rule.matchesRemaining<=0)rule.active=false;
 const message=bonus?`Hai subito ${goals} ${goals===1?'gol':'gol'} e ricevi +${bonus} ${bonus===1?'punto':'punti'} aggiuntivi.`:'Non hai subito gol: nessun punto aggiuntivo.';result.pointsNote=[result.pointsNote,message].filter(Boolean).join(' ');userEventUpdate(result,bonus>0,'Punti per ogni gol subito',`${message} ${rule.matchesRemaining>0?`Restano ${rule.matchesRemaining} partite.`:'La regola al contrario termina.'}`);
}

/* Posto fisso! */
function fixedJobRoleCount(player){return new Set(positions(player).map(position=>String(position||'').trim().toUpperCase()).filter(Boolean)).size}
function fixedJobAvailable(){return rosterPlayers().some(entry=>userEventPlayerByEntry(entry))}
function applyFixedJobRoleRule(){
 const entries=[...rosterPlayers()].filter(entry=>userEventPlayerByEntry(entry)),specialists=[],versatile=[],blocked=[];
 entries.forEach(entry=>{
  const player=userEventPlayerByEntry(entry),single=fixedJobRoleCount(player)===1,delta=single?5:-5,change=userEventPermanentDelta(entry.playerId,delta);
  if(change)(single?specialists:versatile).push(change.player.name);else if(single)blocked.push(player.name);
 });
 const parts=[];
 if(specialists.length)parts.push(`${specialists.length} giocatori con un solo ruolo ricevono +5 OVR fino a fine stagione`);
 if(versatile.length)parts.push(`${versatile.length} giocatori con più ruoli perdono 5 OVR fino a fine stagione`);
 if(blocked.length)parts.push(`il bonus positivo non viene applicato a ${blocked.length} giocatori per le regole dell’allenatore`);
 return parts.length?`${parts.join('; ')}.`:'Nessun giocatore disponibile per applicare la direttiva.';
}
function retireSingleRolePlayers(){
 const targets=[...rosterPlayers()].filter(entry=>{const player=userEventPlayerByEntry(entry);return player&&fixedJobRoleCount(player)===1});
 if(!targets.length)return'Nessun giocatore con un singolo ruolo è presente nella rosa.';
 const names=targets.map(entry=>userEventPlayerByEntry(entry)?.name).filter(Boolean);
 targets.forEach(entry=>userEventRemovePlayer(entry.playerId,'la pensione anticipata del Posto fisso'));
 return `${names.length} ${names.length===1?'giocatore con un solo ruolo lascia':'giocatori con un solo ruolo lasciano'} la squadra: ${names.join(', ')}. Gli slot rimasti vuoti saranno coperti dalla Primavera d’emergenza.`;
}

/* Designazione arbitrale */
function refereeDesignationState(){return userEventState('refereeDesignation',{active:false,branch:'',matchesRemaining:0,matchesPlayed:0,startedMatchday:-1,failed:false,rewardGranted:false,lastOutcome:''})}
function refereeDesignationAvailable(){const challenge=refereeDesignationState(),inventory=seasonInventory();return Boolean(!challenge.active&&Number(state.matchday)<seasonLength()-2&&seasonInventoryUsedSlots()<inventory.capacity)}
function acceptMariaSoleDesignation(){
 if(!reserveCollinaWhistleReward())return'L’inventario è pieno: non c’è spazio per riservare il dono speciale.';
 Object.assign(refereeDesignationState(),{active:true,branch:'maria-sole',matchesRemaining:3,matchesPlayed:0,startedMatchday:Number(state.matchday),failed:false,rewardGranted:false,lastOutcome:''});
 pushEffect('refChaos',1,3,{opponentRedChance:0,ownRedChance:1,source:'Designazione arbitrale · Maria Sole'});
 return 'Maria Sole dirigerà le prossime 3 partite: riceverai almeno un’espulsione in ogni gara. Se non perdi mai, otterrai un dono speciale.';
}
function acceptRosarioDesignation(){
 const challenge=refereeDesignationState();Object.assign(challenge,{active:false,branch:'rosario',matchesRemaining:0,matchesPlayed:0,startedMatchday:Number(state.matchday),failed:false,rewardGranted:false,lastOutcome:'Rischio di espulsione aumentato fino a fine stagione.'});
 pushSeasonEffect('refChaos',1,{opponentRedChance:0,ownRedChance:.12,source:'Designazione arbitrale · Rosario'});
 return 'Rosario viene scelto: la probabilità di ricevere cartellini rossi aumenta leggermente fino a fine stagione.';
}
function ensureMariaSoleExpulsion(result){
 if(!result||result.ownRedCard||result.formulaOneInjuryWalkover?.active)return null;
 const lineup=Array.isArray(result.lineup)?result.lineup:[],selected=pick(lineup.filter(entry=>entry&&entry.playerId));if(!selected)return null;
 const playerId=String(selected.playerId),playerName=String(selected.playerName||selected.name||playerById(playerId)?.name||'Un tuo giocatore');
 result.ownRedCard=true;result.ownSuspensionId=playerId;result.ownSuspensionPlayer=playerName;statusOf(playerId).suspension=Math.max(1,Number(statusOf(playerId).suspension)||0);return {playerId,playerName};
}
function resolveRefereeDesignationAfterMatch(result){
 const challenge=refereeDesignationState();if(!result||!challenge.active||challenge.branch!=='maria-sole')return;
 const forced=ensureMariaSoleExpulsion(result),lost=Number(result.gf)<Number(result.ga);challenge.matchesPlayed=Math.max(0,Number(challenge.matchesPlayed)||0)+1;challenge.matchesRemaining=Math.max(0,Number(challenge.matchesRemaining||0)-1);if(lost)challenge.failed=true;
 const redName=String(result.ownSuspensionPlayer||forced?.playerName||'un tuo giocatore'),progress=`Prova: ${challenge.matchesPlayed}/3 partite · ${challenge.failed?'almeno una sconfitta':'ancora imbattuto'}.`;
 if(challenge.matchesRemaining>0){challenge.lastOutcome=`${redName} viene espulso. ${progress}`;userEventUpdate(result,!lost,'Designazione arbitrale',challenge.lastOutcome);return}
 challenge.active=false;releaseCollinaWhistleRewardReservation();
 if(!challenge.failed){const granted=addSeasonItem('collina-whistle',1,{source:'Designazione arbitrale'});challenge.rewardGranted=Boolean(granted);challenge.lastOutcome=granted?'Tre partite, tre espulsioni e nessuna sconfitta: hai ricevuto il Fischietto di Collina.':'Hai superato la prova, ma l’inventario non ha spazio per il Fischietto di Collina.';userEventUpdate(result,Boolean(granted),'Designazione arbitrale',challenge.lastOutcome)}
 else{challenge.lastOutcome='La prova termina: hai perso almeno una delle tre partite e il dono speciale non viene consegnato.';userEventUpdate(result,false,'Designazione arbitrale',challenge.lastOutcome)}
}

function tickAdditionalUserEventsAfterMatch(result){
 if(!result)return;
 if(typeof tickPillEffectsAfterMatch==='function')tickPillEffectsAfterMatch(result);
 resolveRefereeDesignationAfterMatch(result);
 resolvePermanentAppealAfterMatch(result);
 resolveConcededGoalPointsAfterMatch(result);
 const penalty=result.improvisedPenalty;
 if(penalty){if(penalty.missing)userEventUpdate(result,false,'Il rigorista improvvisato',`${penalty.playerName} non era disponibile e la prova viene annullata.`);else if(!penalty.awarded)userEventUpdate(result,true,'Il rigorista improvvisato',`Nessun rigore assegnato: ${penalty.playerName} non ha potuto dimostrare nulla.`);else if(penalty.scored)userEventUpdate(result,true,'Il rigorista improvvisato',`${penalty.playerName} segna il rigore e ottiene +5 OVR permanente: nuovo OVR ${penalty.newOvr}.`);else userEventUpdate(result,false,'Il rigorista improvvisato',`${penalty.playerName} sbaglia il rigore e perde 5 OVR permanente: nuovo OVR ${penalty.newOvr}.`)}
 if(result.weakBrotherGoal)userEventUpdate(result,false,'Il fratello scarso',`${result.weakBrotherGoal.playerName} mantiene la promessa e segna per ${result.weakBrotherGoal.teamName}.`);
 const keeper=goalkeeperScorerState(),keeperOutcome=result.goalkeeperScorer;
 if(keeper.active){keeper.matchesRemaining=Math.max(0,Number(keeper.matchesRemaining)-1);if(keeperOutcome?.scored&&!keeper.rewarded){const change=userEventPermanentDelta(keeper.playerId,10);keeper.rewarded=true;userEventUpdate(result,true,'Il portiere vuole segnare',`${keeper.playerName} segna e ottiene +10 OVR permanente${change?`: nuovo OVR ${change.after}`:''}.${keeperOutcome.counterattack?' La porta scoperta favorisce però anche un contropiede avversario.':''}`)}else if(keeperOutcome?.counterattack)userEventUpdate(result,false,'Il portiere vuole segnare',`${keeper.playerName} non segna e la porta scoperta favorisce un gol in contropiede.`);else if(keeperOutcome)userEventUpdate(result,true,'Il portiere vuole segnare',`${keeper.playerName} non trova il gol in questa partita.`);if(keeper.matchesRemaining<=0)keeper.active=false}
 const contract=badContractState();if(contract.active){contract.matchesRemaining=Math.max(0,Number(contract.matchesRemaining)-1);if(result.badContract?.doubled>0)userEventUpdate(result,true,'Il contratto scritto male',`${contract.playerName} segna ${result.badContract.doubled} ${result.badContract.doubled===1?'gol che vale doppio':'gol che valgono doppio'}.`);if(contract.matchesRemaining<=0){contract.active=false;const exit=userEventRemovePlayer(contract.playerId,'la clausola del contratto scritto male');userEventUpdate(result,false,'Il contratto scritto male',exit)}}
 const internet=internetFormationState();if(internet.active){internet.active=false;state.formation=internet.oldFormation||state.formation;if(Number(result.gf)>Number(result.ga)){const names=boostAllRosterPlayers(2);userEventUpdate(result,true,'Il modulo trovato su internet',`Il ${internet.newFormation} funziona: ${names.length} giocatori ricevono +2 OVR permanente.`)}else if(Number(result.gf)<Number(result.ga)){const changed=[];(result.lineup||[]).forEach(item=>{const change=userEventPermanentDelta(item.playerId,-2);if(change)changed.push(change.player.name)});userEventUpdate(result,false,'Il modulo trovato su internet',`Il ${internet.newFormation} fallisce: ${changed.length} titolari perdono 2 OVR permanente.`)}else userEventUpdate(result,true,'Il modulo trovato su internet',`Pareggio con il ${internet.newFormation}: nessun bonus e nessuna penalità. Il modulo precedente viene ripristinato.`)}
 const luck=badLuckPlayerState();if(luck.active){luck.active=false;if(luck.mode==='bench'){if(Number(result.gf)>Number(result.ga)){const change=userEventPermanentDelta(luck.playerId,5);userEventUpdate(result,true,'Il giocatore che porta sfortuna',`${luck.playerName} era in panchina durante la vittoria e ottiene +5 OVR permanente${change?`: nuovo OVR ${change.after}`:''}.`)}else if(Number(result.gf)<Number(result.ga)){const exit=userEventRemovePlayer(luck.playerId,'la profezia dell’indovino');userEventUpdate(result,false,'Il giocatore che porta sfortuna',exit)}else userEventUpdate(result,true,'Il giocatore che porta sfortuna',`Pareggio: ${luck.playerName} resta in squadra senza modifiche.`)}else userEventUpdate(result,Number(luck.teamOvrEffect)>=0,'Il giocatore che porta sfortuna',`${luck.playerName} ha giocato titolare. Il modificatore casuale era ${Number(luck.teamOvrEffect)>0?'+':''}${Number(luck.teamOvrEffect)} OVR.`)}
}
