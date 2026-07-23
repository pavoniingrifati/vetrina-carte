/* Fantaballa Season Engine — 07b-items.js
 * Inventario della run, oggetti consumabili e prima quest dedicata agli oggetti.
 * Il modulo è condiviso dalle modalità Community e REAL.
 */
const SEASON_ITEM_DEFINITIONS=Object.freeze({
 'captain-armband':Object.freeze({id:'captain-armband',name:'Fascia del capitano',icon:'©',rarity:'Comune',type:'Consumabile condizionato',description:'Assegna +5 OVR a un titolare per la prossima partita. Se il capitano segna o viene nominato MVP, la fascia torna nell’inventario; altrimenti viene consumata.'}),
 'collina-whistle':Object.freeze({id:'collina-whistle',name:'Fischietto di Collina',icon:'◉',rarity:'Raro',type:'Consumabile',description:'Durante una decisione casuale compatibile, salta l’evento senza applicare nessuna delle opzioni. Dopo l’utilizzo il fischietto viene consumato.'})
});
function seasonItemDefinition(id=''){return SEASON_ITEM_DEFINITIONS[String(id)]||null}
function seasonInventory(){
 state.inventory=state.inventory&&typeof state.inventory==='object'?state.inventory:{capacity:3,items:[],active:null,rokkyStarterGranted:false};
 state.inventory.capacity=clamp(Math.floor(Number(state.inventory.capacity)||3),1,10);
 state.inventory.items=Array.isArray(state.inventory.items)?state.inventory.items:[];
 state.inventory.rokkyStarterGranted=Boolean(state.inventory.rokkyStarterGranted);
 if(coachIs('rokky')&&!state.inventory.rokkyStarterGranted){
  const alreadyHasWhistle=state.inventory.items.some(item=>String(item?.id||'')==='collina-whistle');
  if(!alreadyHasWhistle){
   const existing=state.inventory.items.find(item=>String(item?.id||'')==='collina-whistle');
   if(existing)existing.quantity=Math.max(0,Number(existing.quantity)||0)+1;
   else state.inventory.items.push({id:'collina-whistle',quantity:1,acquiredMatchday:Number(state.matchday)||0,source:'Bonus allenatore Rokky'});
  }
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
 const before=analyticsSnapshot(),title=String(event.title||'Evento');
 event.resolved=true;event.skippedWithItem='collina-whistle';event.result=`Il Fischietto di Collina interrompe ${title}: nessuna opzione viene applicata.`;
 recordSeasonEvent({kind:'decision',title,choice:'Fischietto di Collina',effect:'Evento saltato senza applicare alcuna scelta.',result:event.result,automatic:false},before);
 seasonEventMinimized=false;seasonEventUiKey='';return event.result;
}
function captainArmbandActive(){const active=seasonInventory().active;return active&&String(active.id)==='captain-armband'?active:null}
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
function renderSeasonInventory(){
 const inventory=seasonInventory(),used=seasonInventoryUsedSlots(),active=captainArmbandActive(),armbandQuantity=seasonItemQuantity('captain-armband'),whistleQuantity=seasonItemQuantity('collina-whistle'),reserved=collinaWhistleRewardReserved(),armband=seasonItemDefinition('captain-armband'),whistle=seasonItemDefinition('collina-whistle'),eligible=captainEligibleEntries();
 const activeHtml=active?`<div class="season-item-active"><span>In uso nella prossima partita</span><b>${esc(active.playerName)}</b><small>+5 OVR · deve partire titolare</small></div>`:'';
 const reservedHtml=reserved?'<div class="season-item-active season-item-reward-pending"><span>Dono speciale in palio</span><b>Fischietto di Collina</b><small>Non perdere nelle 3 partite della designazione arbitrale.</small></div>':'';
 const options=eligible.map(entry=>`<option value="${esc(entry.playerId)}">${esc(entry.player.name)} · ${esc(entry.slot||entry.player.Position||'')} · ${Number(entry.player.ovr)||0} OVR</option>`).join('');
 const armbandHtml=armbandQuantity?`<div class="season-item-row"><div class="season-item-icon">${armband.icon}</div><div class="season-item-copy"><div class="season-item-name"><b>${esc(armband.name)}</b><span>${esc(armband.rarity)} · x${armbandQuantity}</span></div><p>${esc(armband.description)}</p>${!active?(eligible.length?`<div class="season-item-use"><label for="captainArmbandPlayer">Assegna a un titolare</label><select id="captainArmbandPlayer">${options}</select><button class="btn season-item-use-button" type="button" data-use-season-item="captain-armband">Usa oggetto</button></div>`:'<small class="season-item-warning">Nessun titolare disponibile: l’oggetto non verrà consumato.</small>'):''}</div></div>`:'';
 const whistleHtml=whistleQuantity?`<div class="season-item-row is-rare"><div class="season-item-icon">${whistle.icon}</div><div class="season-item-copy"><div class="season-item-name"><b>${esc(whistle.name)}</b><span>${esc(whistle.rarity)} · x${whistleQuantity}</span></div><p>${esc(whistle.description)}</p><small class="season-item-event-note">Quando compare un evento compatibile, troverai il pulsante per fischiare e saltarlo.</small></div></div>`:'';
 const empty=!active&&!armbandQuantity&&!whistleQuantity&&!reserved?'<p class="season-items-empty">Non possiedi ancora oggetti. Alcune quest e situazioni speciali possono aggiungerli alla tua run.</p>':'';
 return `<details class="season-items-card" ${active||armbandQuantity||whistleQuantity||reserved?'open':''}><summary><span>🎒 Oggetti della run</span><b>${used}/${inventory.capacity}</b></summary><div class="season-items-body">${activeHtml}${reservedHtml}${armbandHtml}${whistleHtml}${empty}</div></details>`;
}
function bindSeasonInventoryControls(){
 document.querySelectorAll('[data-use-season-item]').forEach(button=>button.onclick=()=>{const id=String(button.dataset.useSeasonItem||'');if(id!=='captain-armband')return;const select=document.getElementById('captainArmbandPlayer'),message=useCaptainArmband(select?.value||'');save();render();toast(message)});
}
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
