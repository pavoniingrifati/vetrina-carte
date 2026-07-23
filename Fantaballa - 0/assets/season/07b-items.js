/* Fantaballa Season Engine — 07b-items.js
 * Inventario della run, oggetti consumabili, oggetti permanenti e quest dedicate.
 * Il modulo è condiviso dalle modalità Community e REAL.
 */
const SEASON_ITEM_DEFINITIONS=Object.freeze({
 'captain-armband':Object.freeze({id:'captain-armband',name:'Fascia del capitano',icon:'©',rarity:'Comune',type:'Consumabile condizionato',description:'Assegna +5 OVR a un titolare per la prossima partita. Se il capitano segna o viene nominato MVP, la fascia torna nell’inventario; altrimenti viene consumata.'}),
 'collina-whistle':Object.freeze({id:'collina-whistle',name:'Fischietto di Collina',icon:'◉',rarity:'Raro',type:'Consumabile',description:'Durante una decisione casuale compatibile, salta l’evento senza applicare nessuna delle opzioni. Dopo l’utilizzo il fischietto viene consumato.'}),
 'buffon-gloves':Object.freeze({id:'buffon-gloves',name:'Guanti di Buffon',icon:'🧤',rarity:'Raro',type:'Permanente',description:'La tua squadra può subire al massimo 2 gol in ogni partita. L’effetto rimane attivo fino al termine della stagione.'}),
 'var-token':Object.freeze({id:'var-token',name:'Gettone VAR',icon:'VAR',rarity:'Raro',type:'Consumabile post-partita',description:'Nel riepilogo di una partita puoi cancellare un cartellino rosso ricevuto oppure annullare un infortunio causato durante quella gara.'}),
 'blessed-ball':Object.freeze({id:'blessed-ball',name:'Pallone benedetto',icon:'⚽',rarity:'Raro',type:'Consumabile',description:'Usalo prima di una partita. Se dopo l’80° minuto non hai ancora segnato, ottieni un gol garantito tra l’81° e il 90°.'}),
 'panini-pack':Object.freeze({id:'panini-pack',name:'Bustina Panini',icon:'▣',rarity:'Epico',type:'Consumabile mercato',description:'Aprila per ricevere 3 giocatori casuali compatibili. Scegline uno e sostituisci immediatamente un giocatore della tua rosa.'}),
 'red-pill':Object.freeze({id:'red-pill',name:'Pillola rossa',icon:'●',rarity:'Epico',type:'Consumabile permanente',description:'Ringiovanisce un calciatore: perde 5 OVR permanentemente, guarisce dagli infortuni e non potrà più infortunarsi per il resto della stagione.'}),
 'blue-pill':Object.freeze({id:'blue-pill',name:'Pillola blu',icon:'●',rarity:'Epico',type:'Consumabile rischioso',description:'Invecchia un calciatore: guadagna 10 OVR permanentemente, ma dopo ogni partita potrebbe annunciare improvvisamente il ritiro.'})
});
function seasonItemDefinition(id=''){return SEASON_ITEM_DEFINITIONS[String(id)]||null}
const RANDOM_GIFT_ITEM_IDS=Object.freeze(['captain-armband','collina-whistle','buffon-gloves','var-token','blessed-ball','panini-pack','red-pill','blue-pill']);
function grantRandomSeasonItem(source='Regalo casuale'){
 const inventory=seasonInventory();
 if(seasonInventoryUsedSlots()>=inventory.capacity)return null;
 const itemId=pick(RANDOM_GIFT_ITEM_IDS);
 const definition=seasonItemDefinition(itemId);
 if(!definition||!addSeasonItem(itemId,1,{source}))return null;
 return definition;
}
function seasonInventory(){
 state.inventory=state.inventory&&typeof state.inventory==='object'?state.inventory:{capacity:3,items:[],active:null,rokkyStarterGranted:false,pendingPack:null};
 state.inventory.capacity=clamp(Math.floor(Number(state.inventory.capacity)||3),1,10);
 state.inventory.items=Array.isArray(state.inventory.items)?state.inventory.items:[];
 state.inventory.rokkyStarterGranted=Boolean(state.inventory.rokkyStarterGranted);
 state.inventory.pendingPack=state.inventory.pendingPack&&typeof state.inventory.pendingPack==='object'?state.inventory.pendingPack:null;
 if(state.inventory.pendingPack){
  state.inventory.pendingPack.candidateIds=[...new Set((Array.isArray(state.inventory.pendingPack.candidateIds)?state.inventory.pendingPack.candidateIds:[]).map(String).filter(Boolean))].slice(0,3);
  state.inventory.pendingPack.openedMatchday=Number.isFinite(Number(state.inventory.pendingPack.openedMatchday))?Number(state.inventory.pendingPack.openedMatchday):Number(state.matchday)||0;
  if(!state.inventory.pendingPack.candidateIds.length)state.inventory.pendingPack=null;
 }
 if(typeof coachIs==='function'&&coachIs('rokky')&&!state.inventory.rokkyStarterGranted){
  const existing=state.inventory.items.find(item=>String(item?.id||'')==='collina-whistle');
  if(existing)existing.quantity=Math.max(0,Number(existing.quantity)||0)+1;
  else state.inventory.items.push({id:'collina-whistle',quantity:1,acquiredMatchday:Number(state.matchday)||0,source:'Bonus allenatore Rokky'});
  state.inventory.rokkyStarterGranted=true;
 }
 return state.inventory;
}
function seasonInventoryUsedSlots(){const inventory=seasonInventory();return inventory.items.reduce((sum,item)=>sum+Math.max(0,Number(item?.quantity)||0),0)+(inventory.active?1:0)}
function seasonItemQuantity(id){const item=seasonInventory().items.find(entry=>String(entry?.id)===String(id));return Math.max(0,Math.floor(Number(item?.quantity)||0))}
function addSeasonItem(id,quantity=1,extra={}){
 const definition=seasonItemDefinition(id),inventory=seasonInventory(),amount=Math.max(1,Math.floor(Number(quantity)||1));if(!definition)return false;
 if(seasonInventoryUsedSlots()+amount>inventory.capacity)return false;
 const existing=inventory.items.find(item=>String(item.id)===String(id));
 if(existing)existing.quantity=Math.max(0,Number(existing.quantity)||0)+amount;
 else inventory.items.push({id:String(id),quantity:amount,acquiredMatchday:Number(state.matchday)||0,source:String(extra.source||'')});
 return true;
}
function removeSeasonItem(id,quantity=1){
 const inventory=seasonInventory(),item=inventory.items.find(entry=>String(entry.id)===String(id)),amount=Math.max(1,Math.floor(Number(quantity)||1));if(!item||Number(item.quantity)<amount)return false;
 item.quantity-=amount;inventory.items=inventory.items.filter(entry=>Number(entry.quantity)>0);return true;
}
function collinaWhistleRewardReserved(){return seasonItemQuantity('collina-whistle-reserved')>0}
function reserveCollinaWhistleReward(){
 const inventory=seasonInventory();if(collinaWhistleRewardReserved())return true;if(seasonInventoryUsedSlots()>=inventory.capacity)return false;
 inventory.items.push({id:'collina-whistle-reserved',quantity:1,acquiredMatchday:Number(state.matchday)||0,source:'Designazione arbitrale'});return true;
}
function releaseCollinaWhistleRewardReservation(){return removeSeasonItem('collina-whistle-reserved',1)}
function collinaWhistleCanSkipEvent(event=state.pendingEvent){
 if(seasonItemQuantity('collina-whistle')<1||!event||event.resolved||event.kind!=='decision'||event.chained)return false;
 const decision=typeof decisionFromPending==='function'?decisionFromPending(event):null;return Boolean(decision);
}
function useCollinaWhistleToSkipEvent(){
 const event=state.pendingEvent;if(!collinaWhistleCanSkipEvent(event))return'Il Fischietto di Collina non può essere utilizzato su questo evento.';
 if(!removeSeasonItem('collina-whistle',1))return'Non possiedi il Fischietto di Collina.';
 unlockAchievement('utilizza-fischietto-collina');
 const before=analyticsSnapshot(),title=String(event.title||'Evento');
 event.resolved=true;event.skippedWithItem='collina-whistle';event.result=`Il Fischietto di Collina interrompe ${title}: nessuna opzione viene applicata.`;
 recordSeasonEvent({kind:'decision',title,choice:'Fischietto di Collina',effect:'Evento saltato senza applicare alcuna scelta.',result:event.result,automatic:false},before);
 seasonEventMinimized=false;seasonEventUiKey='';return event.result;
}

/* Oggetti permanenti e attivi */
function buffonGlovesActive(){return Boolean(state.seasonRules?.buffonGlovesActive||seasonItemQuantity('buffon-gloves')>0)}
function captainArmbandActive(){const active=seasonInventory().active;return active&&String(active.id)==='captain-armband'?active:null}
function blessedBallActive(){const active=seasonInventory().active;return active&&String(active.id)==='blessed-ball'?active:null}
function captainEligibleEntries(){
 return getStarterEntries().filter(entry=>{const status=statusOf(entry.playerId);return !status.seasonOut&&Number(status.injury)<=0&&Number(status.suspension)<=0&&!temporaryEventBlocksPlayer(entry.playerId)});
}
function itemForcedEntry(){const active=captainArmbandActive();return active?rosterEntry(active.playerId):null}
function swapRosterEntriesKeepingSlots(first,second){
 if(!first||!second)return false;const firstBench=Boolean(first.bench),secondBench=Boolean(second.bench),firstSlot=first.slot,firstSlotId=first.slotId;
 first.bench=Boolean(second.bench);first.slot=second.slot;first.slotId=second.slotId;second.bench=firstBench;second.slot=firstSlot;second.slotId=firstSlotId;return true;
}
function enforceCaptainArmbandStarter(){
 const active=captainArmbandActive();if(!active)return false;const entry=rosterEntry(active.playerId);if(!entry)return false;
 entry.captainForcedMatches=Math.max(1,Number(entry.captainForcedMatches)||1);if(!entry.bench)return true;
 const candidates=rosterPlayers().filter(item=>!item.bench&&String(item.playerId)!==String(entry.playerId)&&Number(item.tipsterForcedMatches)<=0&&Number(item.leaderQuestForcedMatches)<=0&&userCompatible(entry.player,item.slot));
 const target=candidates.sort((a,b)=>(Number(a.player?.ovr)||0)-(Number(b.player?.ovr)||0))[0]||null;return target?swapRosterEntriesKeepingSlots(entry,target):false;
}
function useCaptainArmband(playerId){
 const inventory=seasonInventory();if(inventory.active)return'Hai già un oggetto attivo per la prossima partita.';
 if(seasonItemQuantity('captain-armband')<1)return'Non possiedi la Fascia del capitano.';
 const entry=captainEligibleEntries().find(item=>String(item.playerId)===String(playerId));if(!entry)return'Scegli un titolare disponibile.';
 if(!removeSeasonItem('captain-armband',1))return'La Fascia del capitano non è disponibile.';
 inventory.active={id:'captain-armband',playerId:String(entry.playerId),playerName:String(entry.player?.name||'Capitano'),activatedMatchday:Number(state.matchday)||0,retainedCount:0};
 entry.captainForcedMatches=1;
 state.activeEffects=state.activeEffects.filter(effect=>String(effect?.itemId||'')!=='captain-armband');
 state.activeEffects.push({type:'playerOvr',value:5,rounds:1,playerId:String(entry.playerId),playerName:String(entry.player?.name||''),source:'Fascia del capitano',itemId:'captain-armband'});
 enforceCaptainArmbandStarter();unlockAchievement('capitano-mio-capitano');
 return `${entry.player.name} indossa la Fascia del capitano e riceve +5 OVR nella prossima partita.`;
}
function useBlessedBall(){
 const inventory=seasonInventory();if(inventory.active)return'Hai già un oggetto attivo per la prossima partita.';
 if(seasonItemQuantity('blessed-ball')<1)return'Non possiedi il Pallone benedetto.';
 if(!removeSeasonItem('blessed-ball',1))return'Il Pallone benedetto non è disponibile.';
 inventory.active={id:'blessed-ball',activatedMatchday:Number(state.matchday)||0};
 return 'Pallone benedetto attivato: nella prossima partita, se all’80° non avrai ancora segnato, arriverà un gol tra l’81° e il 90°.';
}
function applyBlessedBallGoal(events,lineup,userTeam,opponent,duration=90){
 if(!blessedBallActive()||Number(duration)<81)return null;
 const source=Array.isArray(events)?events:[];
 if(source.some(event=>Math.max(1,Number(event?.goalValue)||1)>0&&Number(event?.minute)<=80))return{active:true,triggered:false,reason:'Hai già segnato entro l’80° minuto.'};
 const scorer=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry?.player).length?weightedScorer((Array.isArray(lineup)?lineup:[]).filter(entry=>entry?.player)):null;
 if(!scorer)return{active:true,triggered:false,reason:'Nessun giocatore disponibile per segnare.'};
 const minute=81+Math.floor(Math.random()*10),generated=buildTeamGoals(1,[scorer],userTeam,opponent,[],90,80)?.[0]||regulationGoalEvent(userTeam,opponent,90,'Pallone benedetto');
 generated.minute=minute;generated.playerId=String(scorer.playerId||scorer.player?.id||'');generated.player=scorer.player?.name||generated.player||'Marcatore';generated.teamId=String(userTeam?.id||USER_ID);generated.teamName=userTeam?.name||state.teamName;generated.goalValue=1;generated.isBlessedBallGoal=true;generated.description=`Zona Cesarini: il Pallone benedetto regala il gol di ${generated.player}.`;
 source.push(generated);source.sort((a,b)=>(Number(a?.minute)||0)-(Number(b?.minute)||0));return{active:true,triggered:true,minute,playerId:generated.playerId,playerName:generated.player};
}
function resolveCaptainArmbandAfterMatch(result){
 const inventory=seasonInventory(),active=captainArmbandActive();if(!result||!active)return null;
 const playerId=String(active.playerId),playerName=String(active.playerName||playerById(playerId)?.name||'Il capitano'),played=(Array.isArray(result.lineup)?result.lineup:[]).some(entry=>String(entry?.playerId||'')===playerId),walkover=Boolean(result.formulaOneInjuryWalkover?.active),scored=(Array.isArray(result.goals)?result.goals:[]).some(goal=>String(goal?.playerId||'')===playerId),mvp=String(result.mvpId||'')===playerId&&String(result.mvpTeamId||USER_ID)===String(USER_ID),entry=rosterEntry(playerId);
 if(entry)entry.captainForcedMatches=0;
 inventory.active=null;
 let retained=false,message='';
 if(!played||walkover){addSeasonItem('captain-armband',1,{source:'Partita non disputata'});retained=true;message=`${playerName} non ha potuto disputare regolarmente la partita: la Fascia del capitano torna nell’inventario.`}
 else if(scored||mvp){addSeasonItem('captain-armband',1,{source:'Capitano decisivo'});retained=true;message=`${playerName} ${scored&&mvp?'ha segnato ed è stato nominato MVP':scored?'ha segnato':'è stato nominato MVP'}: la Fascia del capitano torna nell’inventario.`}
 else message=`${playerName} non ha segnato e non è stato nominato MVP: la Fascia del capitano è stata consumata.`;
 result.itemUpdates=Array.isArray(result.itemUpdates)?result.itemUpdates:[];const update={id:'captain-armband',title:'Fascia del capitano',success:retained,message};result.itemUpdates.push(update);
 recordSeasonEvent({kind:'item',title:'Fascia del capitano',choice:retained?'Oggetto conservato':'Oggetto consumato',effect:'+5 OVR al capitano',result:message,automatic:true},analyticsSnapshot());return update;
}
function resolveBlessedBallAfterMatch(result){
 const inventory=seasonInventory(),active=blessedBallActive();if(!result||!active)return null;inventory.active=null;
 const notPlayed=Boolean(result.formulaOneInjuryWalkover?.active||result.hungerWalkover||Number(result.matchDuration)<81);if(notPlayed){addSeasonItem('blessed-ball',1,{source:'Partita non valida per Zona Cesarini'});const message='La partita non ha raggiunto l’81° minuto: il Pallone benedetto torna nell’inventario.';result.itemUpdates=Array.isArray(result.itemUpdates)?result.itemUpdates:[];const update={id:'blessed-ball',title:'Pallone benedetto',success:true,message};result.itemUpdates.push(update);return update}
 const triggered=Boolean(result.blessedBall?.triggered),message=triggered?`Gol garantito al ${Number(result.blessedBall.minute)||81}°: ${result.blessedBall.playerName||'la squadra'} ha sfruttato il Pallone benedetto.`:'Il Pallone benedetto è stato consumato, ma la squadra aveva già segnato entro l’80° minuto.';
 result.itemUpdates=Array.isArray(result.itemUpdates)?result.itemUpdates:[];const update={id:'blessed-ball',title:'Pallone benedetto',success:triggered,message};result.itemUpdates.push(update);
 recordSeasonEvent({kind:'item',title:'Pallone benedetto',choice:triggered?'Gol attivato':'Effetto non necessario',effect:'Gol garantito dopo l’80°',result:message,automatic:true},analyticsSnapshot());return update;
}

/* Gettone VAR */
function varTokenTargets(result=state.lastResult){
 if(!result||result.varTokenUsed||seasonItemQuantity('var-token')<1)return[];const targets=[],seen=new Set();
 const add=(type,playerId,playerName,label)=>{const id=String(playerId||'');if(!id)return;const key=`${type}:${id}`;if(seen.has(key))return;seen.add(key);const status=statusOf(id),available=type==='red'?Number(status.suspension)>0:Number(status.injury)>0;if(available)targets.push({type,playerId:id,playerName:String(playerName||playerById(id)?.name||'Giocatore'),label})};
 add('red',result.ownSuspensionId,result.ownSuspensionPlayer,'Cancella il cartellino rosso');
 if(result.longMatchSuspension)add('red',result.longMatchSuspension.playerId,result.longMatchSuspension.name,'Cancella la squalifica');
 (Array.isArray(result.eventInjuries)?result.eventInjuries:[]).forEach(item=>add('injury',item.playerId,item.name,'Annulla l’infortunio'));
 if(result.longMatchInjury)add('injury',result.longMatchInjury.playerId,result.longMatchInjury.name,'Annulla l’infortunio');
 return targets;
}
function useVarTokenAfterMatch(type,playerId){
 const result=state.lastResult,target=varTokenTargets(result).find(item=>item.type===String(type)&&String(item.playerId)===String(playerId));if(!target)return'Il Gettone VAR non può essere utilizzato su questo episodio.';
 if(!removeSeasonItem('var-token',1))return'Non possiedi il Gettone VAR.';
 const status=statusOf(target.playerId);if(target.type==='red')status.suspension=0;else{status.injury=0;status.seasonOut=false;status.seasonOutReason=''}
 const message=target.type==='red'?`Il VAR cancella il cartellino rosso di ${target.playerName}: nessuna squalifica.`:`Il VAR annulla l’infortunio di ${target.playerName}: il giocatore torna disponibile.`;
 result.varTokenUsed={type:target.type,playerId:target.playerId,playerName:target.playerName,message};result.itemUpdates=Array.isArray(result.itemUpdates)?result.itemUpdates:[];result.itemUpdates.push({id:'var-token',title:'Gettone VAR',success:true,message});
 recordSeasonEvent({kind:'item',title:'Gettone VAR',choice:target.type==='red'?'Rosso cancellato':'Infortunio annullato',effect:'Episodio annullato nel riepilogo partita',result:message,automatic:false},analyticsSnapshot());return message;
}
function renderVarTokenResultActions(result=state.lastResult){
 const targets=varTokenTargets(result);if(!targets.length)return'';
 return `<div class="goal-line season-var-token-actions"><b>📺 Gettone VAR disponibile</b><br>Scegli un solo episodio da annullare. Il gettone verrà consumato.<div class="season-var-token-buttons">${targets.map(target=>`<button class="btn gold" type="button" data-use-var-token="${esc(target.type)}" data-var-player="${esc(target.playerId)}">${esc(target.label)} · ${esc(target.playerName)}</button>`).join('')}</div></div>`;
}
function bindVarTokenResultControls(){document.querySelectorAll('[data-use-var-token]').forEach(button=>button.onclick=()=>{const message=useVarTokenAfterMatch(button.dataset.useVarToken,button.dataset.varPlayer);save();showResultModal();toast(message)})}

/* Bustina Panini */
function paniniPackPending(){return seasonInventory().pendingPack}
function paniniProtectedPlayerIds(){const q=questState();return new Set([captainArmbandActive()?.playerId,q.active?q.targetPlayerId:''].map(String).filter(Boolean))}
function paniniEligibleOutgoing(player){
 const protectedIds=paniniProtectedPlayerIds();return rosterPlayers().filter(entry=>!protectedIds.has(String(entry.playerId))&&Number(entry.captainForcedMatches)<=0&&Number(entry.leaderQuestForcedMatches)<=0&&(entry.bench||userCompatible(player,entry.slot)));
}
function paniniCandidatePool(){
 const used=new Set(rosterPlayers().map(entry=>String(entry.playerId)));return PLAYERS.filter(player=>player&&player.club&&youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id))&&paniniEligibleOutgoing(player).length);
}
function openPaniniPack(){
 const inventory=seasonInventory();if(inventory.pendingPack)return'La Bustina Panini è già aperta: completa prima la scelta.';
 if(seasonItemQuantity('panini-pack')<1)return'Non possiedi la Bustina Panini.';
 const candidates=shuffle(paniniCandidatePool()).slice(0,3);if(candidates.length<3)return'Non ci sono almeno 3 giocatori compatibili disponibili: la bustina non viene consumata.';
 if(!removeSeasonItem('panini-pack',1))return'La Bustina Panini non è disponibile.';
 inventory.pendingPack={candidateIds:candidates.map(player=>String(player.id)),openedMatchday:Number(state.matchday)||0};return'Bustina aperta: scegli uno dei 3 giocatori e indica chi deve lasciare la rosa.';
}
function completePaniniPackSwap(candidateId,outgoingId){
 const pending=paniniPackPending();if(!pending||!pending.candidateIds.includes(String(candidateId)))return'Scelta della Bustina Panini non valida.';
 const replacement=playerById(candidateId);if(!replacement||!youngBeautifulAllowsPlayer(replacement))return replacement?youngBeautifulBlockMessage(replacement):'Giocatore non disponibile.';
 const outgoing=paniniEligibleOutgoing(replacement).find(entry=>String(entry.playerId)===String(outgoingId));if(!outgoing)return'Scegli un giocatore compatibile da sostituire.';
 const index=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(outgoing.playerId));if(index<0)return'Giocatore in uscita non trovato.';
 const oldPlayer=outgoing.player||playerById(outgoing.playerId),oldId=String(outgoing.playerId);state.draft.roster[index].playerId=String(replacement.id);state.draft.roster[index].player={...replacement};
 delete state.playInjured[oldId];delete state.statuses[oldId];if(typeof clearMandatoryMidseasonPlayer==='function')clearMandatoryMidseasonPlayer(oldId);if(typeof refreshOpponentClubRosters==='function')refreshOpponentClubRosters();
 seasonInventory().pendingPack=null;const message=`Bustina Panini: ${replacement.name} sostituisce ${oldPlayer?.name||'il giocatore scelto'} nello slot ${outgoing.slot}.`;
 recordSeasonEvent({kind:'item',title:'Bustina Panini',choice:replacement.name,effect:`Sostituito ${oldPlayer?.name||'un giocatore'}`,result:message,automatic:false},analyticsSnapshot());return message;
}
function showPaniniPackModal(){
 const pending=paniniPackPending();if(!pending)return;const candidates=pending.candidateIds.map(playerById).filter(Boolean);
 const cards=candidates.map(player=>{const outgoing=paniniEligibleOutgoing(player),options=outgoing.map(entry=>`<option value="${esc(entry.playerId)}">${esc(entry.player.name)} · ${esc(entry.slot)}${entry.bench?' · Panchina':''}</option>`).join('');return `<article class="season-panini-candidate">${renderMiniAvatar(player,'small')}<div><b>${esc(player.name)}</b><small>${esc(player.Position||roleOf(player))} · ${Number(player.ovr)||0} OVR · ${esc(clubById(player.club)?.name||player.club||'Svincolato')}</small></div><select data-panini-outgoing="${esc(player.id)}">${options}</select><button class="btn gold" type="button" data-choose-panini="${esc(player.id)}" ${outgoing.length?'':'disabled'}>Scegli e sostituisci</button></article>`}).join('');
 modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal result-modal-expanded season-panini-modal" role="dialog" aria-modal="true"><div class="label">Oggetto epico</div><h2>Bustina Panini</h2><p>Scegli uno dei tre giocatori. Verranno mostrati soltanto i componenti della rosa che può sostituire nella posizione attuale.</p><div class="season-panini-grid">${cards}</div><button id="closePaniniPack" class="btn" type="button">Decidi più tardi</button></div></div>`;
 document.getElementById('closePaniniPack').onclick=()=>{modalRoot.innerHTML=''};
 document.querySelectorAll('[data-choose-panini]').forEach(button=>button.onclick=()=>{const id=String(button.dataset.choosePanini),select=[...document.querySelectorAll('[data-panini-outgoing]')].find(node=>String(node.dataset.paniniOutgoing)===id),message=completePaniniPackSwap(id,select?.value||'');save();modalRoot.innerHTML='';render();toast(message)});
}

/* Pillola rossa e Pillola blu */
function pillEffectsState(){
 const rules=state.seasonRules||(state.seasonRules={}),current=rules.pillEffects&&typeof rules.pillEffects==='object'?rules.pillEffects:{};rules.pillEffects=current;
 Object.keys(current).forEach(playerId=>{const effect=current[playerId];if(!effect||typeof effect!=='object'){delete current[playerId];return}effect.type=effect.type==='red'?'red':effect.type==='blue'?'blue':'';effect.playerId=String(effect.playerId||playerId);effect.playerName=String(effect.playerName||playerById(playerId)?.name||'Giocatore');effect.appliedMatchday=Math.max(0,Number(effect.appliedMatchday)||0);effect.matchesPlayed=Math.max(0,Number(effect.matchesPlayed)||0);effect.retireAfterMatches=Math.max(1,Number(effect.retireAfterMatches)||1);effect.retired=Boolean(effect.retired);if(!effect.type)delete current[playerId]});
 return current;
}
function pillEffectForPlayer(playerId){return pillEffectsState()[String(playerId||'')]||null}
function redPillProtectsPlayer(playerId){const effect=pillEffectForPlayer(playerId);return Boolean(effect&&effect.type==='red'&&!effect.retired&&rosterEntry(playerId))}
function pillEligibleEntries(){return rosterPlayers().filter(entry=>!pillEffectForPlayer(entry.playerId))}
function pillInventoryEventAvailable(){return Boolean(seasonInventoryUsedSlots()<seasonInventory().capacity&&seasonItemQuantity('red-pill')<1&&seasonItemQuantity('blue-pill')<1)}
function receivePillItem(itemId){
 const item=seasonItemDefinition(itemId);if(!item)return'Oggetto non valido.';
 const granted=addSeasonItem(itemId,1,{source:'Pillola rossa o pillola blu'});return granted?`${item.name} aggiunta all’inventario. Potrai darla a qualunque calciatore della rosa.`:`Inventario pieno: ${item.name} non può essere raccolta.`;
}
function applyPermanentPillOvr(entry,delta){const player=entry?.player||playerById(entry?.playerId);if(!entry||!player)return null;return setPermanentRosterOvr(entry,(Number(player.ovr)||60)+Number(delta||0))}
function useRedPill(playerId){
 if(seasonItemQuantity('red-pill')<1)return'Non possiedi la Pillola rossa.';
 const entry=rosterEntry(String(playerId||'')),player=entry?.player||playerById(entry?.playerId);if(!entry||!player)return'Scegli un calciatore presente nella rosa.';
 if(pillEffectForPlayer(entry.playerId))return'Questo calciatore ha già assunto una pillola.';
 if(!removeSeasonItem('red-pill',1))return'La Pillola rossa non è disponibile.';
 const change=applyPermanentPillOvr(entry,-5),status=statusOf(entry.playerId);status.injury=0;status.seasonOut=false;status.seasonOutReason='';delete state.playInjured[String(entry.playerId)];
 pillEffectsState()[String(entry.playerId)]={type:'red',playerId:String(entry.playerId),playerName:String(player.name),appliedMatchday:Number(state.matchday)||0,matchesPlayed:0,retireAfterMatches:1,retired:false};
 const message=`${player.name} assume la Pillola rossa: ${change?.before??Number(player.ovr)+5} → ${change?.after??Number(player.ovr)} OVR. È guarito e non potrà più infortunarsi per il resto della stagione.`;
 recordSeasonEvent({kind:'item',title:'Pillola rossa',choice:player.name,effect:'-5 OVR permanente e immunità totale agli infortuni',result:message,automatic:false},analyticsSnapshot());return message;
}
function useBluePill(playerId){
 if(seasonItemQuantity('blue-pill')<1)return'Non possiedi la Pillola blu.';
 const entry=rosterEntry(String(playerId||'')),player=entry?.player||playerById(entry?.playerId);if(!entry||!player)return'Scegli un calciatore presente nella rosa.';
 if(pillEffectForPlayer(entry.playerId))return'Questo calciatore ha già assunto una pillola.';
 if(!removeSeasonItem('blue-pill',1))return'La Pillola blu non è disponibile.';
 const change=applyPermanentPillOvr(entry,10),retireAfterMatches=1+Math.floor(Math.random()*12);
 pillEffectsState()[String(entry.playerId)]={type:'blue',playerId:String(entry.playerId),playerName:String(player.name),appliedMatchday:Number(state.matchday)||0,matchesPlayed:0,retireAfterMatches,retired:false};
 const message=`${player.name} assume la Pillola blu: ${change?.before??Number(player.ovr)-10} → ${change?.after??Number(player.ovr)} OVR. Da ora potrebbe ritirarsi improvvisamente dopo qualsiasi partita.`;
 recordSeasonEvent({kind:'item',title:'Pillola blu',choice:player.name,effect:'+10 OVR permanente con rischio di ritiro improvviso',result:message,automatic:false},analyticsSnapshot());return message;
}
function tickPillEffectsAfterMatch(result){
 if(!result)return null;const effects=pillEffectsState();let retirement=null;
 Object.values(effects).filter(effect=>effect.type==='blue'&&!effect.retired).forEach(effect=>{
  const entry=rosterEntry(effect.playerId);if(!entry){effect.retired=true;return}
  effect.matchesPlayed=Math.max(0,Number(effect.matchesPlayed)||0)+1;
  if(!retirement&&effect.matchesPlayed>=effect.retireAfterMatches){const player=entry.player||playerById(entry.playerId),name=String(player?.name||effect.playerName||'Il calciatore'),exit=removeOwnRosterPlayerPermanently(entry,'il ritiro improvviso causato dalla Pillola blu');effect.retired=true;effect.retiredMatchday=Number(result.matchday)||Number(state.matchday)+1;const message=`${name} annuncia il ritiro senza preavviso. ${exit}`;result.itemUpdates=Array.isArray(result.itemUpdates)?result.itemUpdates:[];result.itemUpdates.push({id:'blue-pill',title:'Pillola blu',success:false,message});recordSeasonEvent({kind:'item',title:'Pillola blu',choice:'Ritiro improvviso',effect:'Il giocatore lascia definitivamente la rosa',result:message,automatic:true},analyticsSnapshot());retirement={playerId:String(effect.playerId),playerName:name,message}}
 });return retirement;
}
function renderPillEffects(){
 const active=Object.values(pillEffectsState()).filter(effect=>!effect.retired&&rosterEntry(effect.playerId));if(!active.length)return'';
 return `<div class="season-pill-effects">${active.map(effect=>effect.type==='red'?`<div class="season-item-active season-pill-effect red"><span>Pillola rossa attiva</span><b>${esc(effect.playerName)}</b><small>-5 OVR · immune a ogni infortunio</small></div>`:`<div class="season-item-active season-pill-effect blue"><span>Pillola blu attiva</span><b>${esc(effect.playerName)}</b><small>+10 OVR · ritiro possibile dopo ogni partita</small></div>`).join('')}</div>`;
}

/* Inventario UI */
function renderSeasonInventory(){
 const inventory=seasonInventory(),used=seasonInventoryUsedSlots(),active=inventory.active,armbandQuantity=seasonItemQuantity('captain-armband'),whistleQuantity=seasonItemQuantity('collina-whistle'),glovesQuantity=seasonItemQuantity('buffon-gloves'),varQuantity=seasonItemQuantity('var-token'),ballQuantity=seasonItemQuantity('blessed-ball'),packQuantity=seasonItemQuantity('panini-pack'),redPillQuantity=seasonItemQuantity('red-pill'),bluePillQuantity=seasonItemQuantity('blue-pill'),reserved=collinaWhistleRewardReserved(),eligible=captainEligibleEntries(),pillEligible=pillEligibleEntries(),pendingPack=paniniPackPending(),pillEffectsHtml=renderPillEffects();
 const activeHtml=active?(String(active.id)==='captain-armband'?`<div class="season-item-active"><span>In uso nella prossima partita</span><b>${esc(active.playerName)}</b><small>Fascia del capitano · +5 OVR</small></div>`:`<div class="season-item-active"><span>In uso nella prossima partita</span><b>Pallone benedetto</b><small>Gol garantito tra 81° e 90° se all’80° non hai segnato</small></div>`):'';
 const reservedHtml=reserved?'<div class="season-item-active season-item-reward-pending"><span>Dono speciale in palio</span><b>Fischietto di Collina</b><small>Non perdere nelle 3 partite della designazione arbitrale.</small></div>':'';
 const pendingHtml=pendingPack?'<div class="season-item-active season-item-pack-pending"><span>Bustina aperta</span><b>Tre giocatori ti aspettano</b><button class="btn gold" type="button" data-continue-panini>Continua la scelta</button></div>':'';
 const options=eligible.map(entry=>`<option value="${esc(entry.playerId)}">${esc(entry.player.name)} · ${esc(entry.slot||entry.player.Position||'')} · ${Number(entry.player.ovr)||0} OVR</option>`).join('');
 const definition=id=>seasonItemDefinition(id),row=(id,quantity,extra='',className='')=>{const item=definition(id);return quantity?`<div class="season-item-row ${className}"><div class="season-item-icon">${item.icon}</div><div class="season-item-copy"><div class="season-item-name"><b>${esc(item.name)}</b><span>${esc(item.rarity)} · x${quantity}</span></div><p>${esc(item.description)}</p>${extra}</div></div>`:''};
 const armbandHtml=row('captain-armband',armbandQuantity,!active?(eligible.length?`<div class="season-item-use"><label for="captainArmbandPlayer">Assegna a un titolare</label><select id="captainArmbandPlayer">${options}</select><button class="btn season-item-use-button" type="button" data-use-season-item="captain-armband">Usa oggetto</button></div>`:'<small class="season-item-warning">Nessun titolare disponibile: l’oggetto non verrà consumato.</small>'):'');
 const whistleHtml=row('collina-whistle',whistleQuantity,'<small class="season-item-event-note">Quando compare un evento compatibile, troverai il pulsante per fischiare e saltarlo.</small>','is-rare');
 const glovesHtml=row('buffon-gloves',glovesQuantity,'<small class="season-item-event-note">Effetto permanente attivo: massimo 2 gol subiti a partita.</small>','is-rare');
 const varHtml=row('var-token',varQuantity,'<small class="season-item-event-note">Il pulsante VAR appare nel riepilogo quando ricevi un rosso o un nuovo infortunio.</small>','is-rare');
 const ballHtml=row('blessed-ball',ballQuantity,!active?'<button class="btn gold season-item-use-button" type="button" data-use-season-item="blessed-ball">Usa nella prossima partita</button>':'','is-rare');
 const packHtml=row('panini-pack',packQuantity,!pendingPack?'<button class="btn gold season-item-use-button" type="button" data-use-season-item="panini-pack">Apri bustina</button>':'','is-epic');
 const pillOptions=pillEligible.map(entry=>`<option value="${esc(entry.playerId)}">${esc(entry.player.name)} · ${esc(entry.slot||entry.player.Position||'')} · ${Number(entry.player.ovr)||0} OVR</option>`).join('');
 const redPillHtml=row('red-pill',redPillQuantity,pillEligible.length?`<div class="season-item-use"><label for="redPillPlayer">Scegli chi ringiovanire</label><select id="redPillPlayer">${pillOptions}</select><button class="btn season-item-use-button" type="button" data-use-season-item="red-pill">Somministra</button></div>`:'<small class="season-item-warning">Nessun calciatore idoneo.</small>','is-red-pill');
 const bluePillHtml=row('blue-pill',bluePillQuantity,pillEligible.length?`<div class="season-item-use"><label for="bluePillPlayer">Scegli chi invecchiare</label><select id="bluePillPlayer">${pillOptions}</select><button class="btn season-item-use-button" type="button" data-use-season-item="blue-pill">Somministra</button></div>`:'<small class="season-item-warning">Nessun calciatore idoneo.</small>','is-blue-pill');
 const empty=!active&&!armbandQuantity&&!whistleQuantity&&!glovesQuantity&&!varQuantity&&!ballQuantity&&!packQuantity&&!redPillQuantity&&!bluePillQuantity&&!reserved&&!pendingPack&&!pillEffectsHtml?'<p class="season-items-empty">Non possiedi ancora oggetti. Alcune quest e situazioni speciali possono aggiungerli alla tua run.</p>':'';
 return `<details class="season-items-card" ${used||reserved||pendingPack||pillEffectsHtml?'open':''}><summary><span>🎒 Oggetti della run</span><b>${used}/${inventory.capacity}</b></summary><div class="season-items-body">${activeHtml}${pillEffectsHtml}${reservedHtml}${pendingHtml}${armbandHtml}${whistleHtml}${glovesHtml}${varHtml}${ballHtml}${packHtml}${redPillHtml}${bluePillHtml}${empty}</div></details>`;
}
function bindSeasonInventoryControls(){
 document.querySelectorAll('[data-use-season-item]').forEach(button=>button.onclick=()=>{const id=String(button.dataset.useSeasonItem||'');let message='Oggetto non disponibile.';if(id==='captain-armband')message=useCaptainArmband(document.getElementById('captainArmbandPlayer')?.value||'');if(id==='blessed-ball')message=useBlessedBall();if(id==='red-pill')message=useRedPill(document.getElementById('redPillPlayer')?.value||'');if(id==='blue-pill')message=useBluePill(document.getElementById('bluePillPlayer')?.value||'');if(id==='panini-pack'){message=openPaniniPack();save();render();toast(message);if(paniniPackPending())showPaniniPackModal();return}save();render();toast(message)});
 const resume=document.querySelector('[data-continue-panini]');if(resume)resume.onclick=showPaniniPackModal;
}

/* Quest oggetti */
function itemQuestInventoryAvailable(){return seasonInventoryUsedSlots()<seasonInventory().capacity}
function itemQuestAvailable(itemId,matches=1,extra=true){return Boolean(extra&&questCanStart(matches)&&itemQuestInventoryAvailable()&&seasonItemQuantity(itemId)<1)}
function saracinescaQuestAvailable(){return itemQuestAvailable('buffon-gloves',4,!buffonGlovesActive())}
function noRigoreQuestAvailable(){return itemQuestAvailable('var-token',3)}
function zonaCesariniQuestAvailable(){return itemQuestAvailable('blessed-ball',3)}
function distinctRosterClubCount(entries=rosterPlayers()){return new Set((entries||[]).map(entry=>String(entry?.player?.club||playerById(entry?.playerId)?.club||'')).filter(Boolean)).size}
function internazionaleQuestAvailable(){return itemQuestAvailable('panini-pack',1,!paniniPackPending()&&distinctRosterClubCount()>=8)}
function acceptSaracinescaQuest(){return startSeasonQuest({id:'saracinesca',title:'Saracinesca',target:3,deadlineMatches:4,objective:'Ottieni 3 clean sheet nell’arco delle prossime 4 partite.',reward:'Ottieni l’oggetto raro permanente Guanti di Buffon.',penalty:'La quest termina senza penalizzazioni.'})}
function acceptNoRigoreQuest(){return startSeasonQuest({id:'non-era-mai-rigore',title:'Non era mai rigore',target:1,deadlineMatches:3,objective:'Subisci almeno un rigore contro o un’espulsione entro le prossime 3 partite.',reward:'Ottieni l’oggetto raro Gettone VAR.',penalty:'La quest termina senza penalizzazioni.'})}
function acceptZonaCesariniQuest(){return startSeasonQuest({id:'zona-cesarini',title:'Zona Cesarini',target:1,deadlineMatches:3,objective:'Segna almeno un gol negli ultimi 10 minuti di una delle prossime 3 partite.',reward:'Ottieni l’oggetto raro Pallone benedetto.',penalty:'La quest termina senza penalizzazioni.'})}
function acceptInternazionaleQuest(){return startSeasonQuest({id:'internazionale',title:'Internazionale',target:8,deadlineMatches:0,objective:'Schiera nella stessa partita giocatori appartenenti ad almeno 8 club differenti.',reward:'Ottieni l’oggetto epico Bustina Panini.',penalty:'La quest resta attiva finché non completi l’obiettivo.'})}
function grantQuestItem(q,itemId,result,successMessage){
 const granted=addSeasonItem(itemId,1,{source:`Quest ${q.title}`});if(granted&&itemId==='buffon-gloves'){state.seasonRules=state.seasonRules||{};state.seasonRules.buffonGlovesActive=true}
 finishSeasonQuest(Boolean(granted),granted?successMessage:`Obiettivo completato, ma l’inventario è pieno: ${seasonItemDefinition(itemId)?.name||'la ricompensa'} non è stato aggiunto.`,result);return granted;
}
function itemQuestProgressText(q=questState()){
 if(q.id==='saracinesca')return `${q.progress}/${q.target} clean sheet · ${q.matchesPlayed}/${q.deadlineMatches} partite`;
 if(q.id==='non-era-mai-rigore')return `${q.matchesPlayed}/${q.deadlineMatches} partite · rigore contro o espulsione ${q.progress?'rilevato':'non ancora rilevato'}`;
 if(q.id==='zona-cesarini')return `${q.matchesPlayed}/${q.deadlineMatches} partite · gol nel finale ${q.progress?'segnato':'non ancora segnato'}`;
 if(q.id==='internazionale')return `${q.progress}/${q.target} club differenti nell’ultima formazione`;
 return'';
}
function tickItemQuestAfterMatch(result){
 const q=questState();if(!result||!q.active)return false;
 if(q.id==='saracinesca'){
  q.matchesPlayed++;if(result.cleanSheet)q.progress++;q.notice=`Clean sheet: ${q.progress}/3 nelle prime ${q.matchesPlayed}/4 partite.`;
  if(q.progress>=q.target)grantQuestItem(q,'buffon-gloves',result,'Quest completata: hai ottenuto i Guanti di Buffon. Da ora puoi subire al massimo 2 gol a partita.');
  else if(q.matchesPlayed>=q.deadlineMatches)finishSeasonQuest(false,`Quest fallita: ${q.progress} clean sheet su 3. Nessuna penalizzazione.`,result);return true;
 }
 if(q.id==='non-era-mai-rigore'){
  q.matchesPlayed++;const penaltyAgainst=String(result.secretRefereePenalty||'')==='against'||(Array.isArray(result.opponentGoals)&&result.opponentGoals.some(goal=>goal?.isSecretRefereePenalty)),red=Boolean(result.ownRedCard||result.ownSuspensionId);q.progress=penaltyAgainst||red?1:0;q.notice=penaltyAgainst?'Hai subito un rigore contro.':red?'Hai ricevuto un’espulsione.':`Nessun rigore contro o rosso: ${q.matchesPlayed}/3 partite.`;
  if(q.progress)grantQuestItem(q,'var-token',result,'Quest completata: hai ottenuto il Gettone VAR.');else if(q.matchesPlayed>=q.deadlineMatches)finishSeasonQuest(false,'Quest fallita: nessun rigore contro e nessuna espulsione nelle 3 partite. Nessuna penalizzazione.',result);return true;
 }
 if(q.id==='zona-cesarini'){
  q.matchesPlayed++;const duration=Math.max(1,Number(result.matchDuration)||90),threshold=Math.max(1,duration-9),lateGoal=(Array.isArray(result.goals)?result.goals:[]).find(goal=>Number(goal?.minute)>=threshold);q.progress=lateGoal?1:0;q.notice=lateGoal?`Gol decisivo al ${Number(lateGoal.minute)}°: obiettivo completato.`:`Nessun gol negli ultimi 10 minuti: ${q.matchesPlayed}/3 partite.`;
  if(q.progress)grantQuestItem(q,'blessed-ball',result,'Quest completata: hai ottenuto il Pallone benedetto.');else if(q.matchesPlayed>=q.deadlineMatches)finishSeasonQuest(false,'Quest fallita: nessun gol negli ultimi 10 minuti delle 3 partite. Nessuna penalizzazione.',result);return true;
 }
 if(q.id==='internazionale'){
  q.matchesPlayed++;const clubIds=new Set((Array.isArray(result.lineup)?result.lineup:[]).map(entry=>String(rosterEntry(entry.playerId)?.player?.club||playerById(entry.playerId)?.club||'')).filter(Boolean));q.progress=clubIds.size;q.notice=`Formazione utilizzata: ${q.progress}/8 club differenti.`;
  if(q.progress>=q.target)grantQuestItem(q,'panini-pack',result,'Quest completata: hai ottenuto la Bustina Panini epica.');return true;
 }
 return false;
}

/* Quest Fascia del capitano */
function leaderQuestEligibleEntries(){return captainEligibleEntries()}
function acceptLeaderQuest(){
 const response=startSeasonQuest({id:'un-leader-per-la-squadra',title:'Un leader per la squadra',target:2,deadlineMatches:2,objective:'Scegli un titolare: dovrà giocare le prossime 2 partite, non ricevere rossi e aiutare la squadra a conquistare almeno 2 punti complessivi.',reward:'Ottieni l’oggetto comune Fascia del capitano.',penalty:'La quest termina senza penalizzazioni.'});
 const q=questState();if(q.active&&q.id==='un-leader-per-la-squadra'){q.awaitingPlayerSelection=true;q.notice='Prima di giocare scegli il leader della quest.'}return response;
}
function chooseLeaderQuestPlayer(playerId){
 const q=questState();if(!q.active||q.id!=='un-leader-per-la-squadra'||!q.awaitingPlayerSelection)return'La selezione del leader non è disponibile.';
 const entry=leaderQuestEligibleEntries().find(item=>String(item.playerId)===String(playerId));if(!entry)return'Scegli un titolare disponibile.';
 q.targetPlayerId=String(entry.playerId);q.targetPlayerName=String(entry.player.name);q.awaitingPlayerSelection=false;q.notice=`${entry.player.name} deve partire titolare nelle prossime 2 partite.`;q.objective=`${entry.player.name} deve partire titolare nelle prossime 2 partite, non ricevere cartellini rossi e aiutare la squadra a conquistare almeno 2 punti complessivi.`;entry.leaderQuestForcedMatches=2;return `${entry.player.name} è stato scelto come leader della squadra.`;
}
function leaderQuestSelectionPending(){const q=questState();return Boolean(q.active&&q.id==='un-leader-per-la-squadra'&&q.awaitingPlayerSelection)}
function renderLeaderQuestSelection(q=questState()){
 if(!q.active||q.id!=='un-leader-per-la-squadra'||!q.awaitingPlayerSelection)return'';const eligible=leaderQuestEligibleEntries(),options=eligible.map(entry=>`<option value="${esc(entry.playerId)}">${esc(entry.player.name)} · ${esc(entry.slot||entry.player.Position||'')} · ${Number(entry.player.ovr)||0} OVR</option>`).join('');
 return `<div class="leader-quest-selection"><label for="leaderQuestPlayer">Scegli il leader titolare</label>${eligible.length?`<div><select id="leaderQuestPlayer">${options}</select><button class="btn" type="button" data-confirm-leader-quest>Conferma leader</button></div>`:'<p>Nessun titolare disponibile: la quest non può iniziare.</p>'}</div>`;
}
function bindLeaderQuestControls(){const button=document.querySelector('[data-confirm-leader-quest]');if(button)button.onclick=()=>{const select=document.getElementById('leaderQuestPlayer'),message=chooseLeaderQuestPlayer(select?.value||'');save();render();toast(message)}}
function clearLeaderQuestForcedPlayer(q=questState()){const entry=rosterEntry(q.targetPlayerId);if(entry)entry.leaderQuestForcedMatches=0}
function tickLeaderQuestAfterMatch(result){
 const q=questState();if(!result||!q.active||q.id!=='un-leader-per-la-squadra')return false;if(q.awaitingPlayerSelection)return true;
 const playerId=String(q.targetPlayerId),playerName=String(q.targetPlayerName||playerById(playerId)?.name||'Il leader'),started=(Array.isArray(result.lineup)?result.lineup:[]).some(entry=>String(entry?.playerId||'')===playerId),red=String(result.ownSuspensionId||'')===playerId;
 q.matchesPlayed++;const entry=rosterEntry(playerId);if(entry)entry.leaderQuestForcedMatches=Math.max(0,Number(entry.leaderQuestForcedMatches||0)-1);
 if(!started){clearLeaderQuestForcedPlayer(q);finishSeasonQuest(false,`${playerName} non è partito titolare: la quest termina senza ricompensa.`,result);return true}
 if(red){clearLeaderQuestForcedPlayer(q);finishSeasonQuest(false,`${playerName} ha ricevuto un cartellino rosso: la quest termina senza ricompensa.`,result);return true}
 q.progress+=Math.max(0,Number(result.pointsAwarded)||0);q.notice=`${playerName}: ${q.matchesPlayed}/2 presenze da titolare · ${q.progress}/2 punti conquistati.`;
 if(q.matchesPlayed>=q.deadlineMatches){clearLeaderQuestForcedPlayer(q);if(q.progress>=q.target){const granted=addSeasonItem('captain-armband',1,{source:'Quest Un leader per la squadra'});finishSeasonQuest(Boolean(granted),granted?'Quest completata: hai ottenuto l’oggetto comune Fascia del capitano.':'Quest completata, ma l’inventario è pieno: libera uno spazio per ricevere la Fascia del capitano.',result)}else finishSeasonQuest(false,`Quest fallita: la squadra ha conquistato ${q.progress} punti su 2. Nessuna penalizzazione.`,result)}
 return true;
}
