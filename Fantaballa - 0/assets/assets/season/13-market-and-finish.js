/* Fantaballa Season Engine — 13-market-and-finish.js
 * Mercato di metà stagione, conclusione campionato, invio ed esportazione risultati.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
function isFlexibleMidseason(){return !state.midseason?.auto&&!state.seasonRules.autoMidseason&&!state.seasonRules.botMidseason&&mandatoryMidseasonPlayerIds().filter(id=>rosterEntry(id)).length===0}
function midseasonMetricsForRoster(entries){
 const starters=(entries||[]).filter(entry=>entry&&!entry.bench&&entry.player);
 const chemistry=draftChemistry(starters),lineup=resolveRosterLineup(entries,{ignoreStatuses:true});
 return {starters,chemistry,lineup,overall:resolvedLineupAverage(lineup)};
}
function midseasonProjection(outgoingId,incomingId){
 const roster=rosterPlayers();
 const outgoing=roster.find(entry=>String(entry.playerId)===String(outgoingId));
 const incoming=playerById(incomingId);
 if(!outgoing||!incoming)return null;
 const current=midseasonMetricsForRoster(roster);
 const projectedRoster=roster.map(entry=>String(entry.playerId)===String(outgoing.playerId)?{...entry,playerId:String(incoming.id),player:incoming}:entry);
 const projected=midseasonMetricsForRoster(projectedRoster);
 const outgoingBonus=outgoing.bench?0:(current.chemistry.playerBonus[String(outgoing.player.id)]||0);
 const incomingBonus=outgoing.bench?0:(projected.chemistry.playerBonus[String(incoming.id)]||0);
 const outgoingOvr=Math.round((Number(outgoing.player.ovr)||0)+effectiveChemistryFromBase(outgoing.player,outgoingBonus)+activeOvrBonus(outgoing.player));
 const incomingOvr=Math.round((Number(incoming.ovr)||0)+effectiveChemistryFromBase(incoming,incomingBonus)+activeOvrBonus(incoming));
 return {
   outgoing,incoming,current,projected,
   outgoingOvr,incomingOvr,
   deltaPlayer:incomingOvr-outgoingOvr,
   deltaOverall:projected.overall-current.overall,
   deltaChemistry:projected.chemistry.score-current.chemistry.score
 };
}
function midseasonDeltaClass(value){const n=Number(value)||0;return n>0?'positive':n<0?'negative':'neutral'}
function midseasonDeltaLabel(value,digits=1){const n=Number(value)||0;const formatted=digits?Math.abs(n).toFixed(digits):String(Math.abs(Math.round(n)));return `${n>0?'+':n<0?'−':''}${formatted}`}
function renderMidseasonComparison(projection){
 if(!projection)return'';
 const {outgoing,incoming,current,projected,outgoingOvr,incomingOvr,deltaPlayer,deltaOverall,deltaChemistry}=projection;
 const sourceClub=clubById(incoming.club);
 const clubStyle=teamCssVars({colors:sourceClub?.colorClub});
 return `<div class="midseason-comparison" style="${clubStyle}"><div class="midseason-comparison-title"><span>Confronto prima della conferma</span><b>${esc(outgoing.slot)}${outgoing.bench?' · Panchina':''}</b></div><div class="midseason-versus-grid"><div class="midseason-versus-player outgoing-player">${renderMiniAvatar(outgoing.player)}<span>IN USCITA</span><b>${esc(outgoing.player.name)}</b><small>${esc(outgoing.player.Position)} · OVR ${outgoingOvr}</small></div><div class="midseason-swap-arrow">→</div><div class="midseason-versus-player incoming-player">${renderMiniAvatar(incoming)}<span>IN ENTRATA</span><b>${esc(incoming.name)}</b><small>${esc(incoming.Position)} · OVR ${incomingOvr}</small><em>${sourceClub?esc(sourceClub.name):'Club non indicato'}</em></div></div><div class="midseason-impact-grid"><div class="midseason-impact"><span>OVR giocatore</span><b>${outgoingOvr} → ${incomingOvr}</b><strong class="${midseasonDeltaClass(deltaPlayer)}">${midseasonDeltaLabel(deltaPlayer,0)}</strong></div><div class="midseason-impact"><span>OVR medio titolari</span><b>${current.overall.toFixed(1)} → ${projected.overall.toFixed(1)}</b><strong class="${midseasonDeltaClass(deltaOverall)}">${midseasonDeltaLabel(deltaOverall,1)}</strong></div><div class="midseason-impact"><span>Intesa squadra</span><b>${current.chemistry.score} → ${projected.chemistry.score}</b><strong class="${midseasonDeltaClass(deltaChemistry)}">${midseasonDeltaLabel(deltaChemistry,0)}</strong></div></div><div class="midseason-confirm-actions"><button id="confirmMarketChange" class="btn primary">Conferma il cambio</button></div></div>`;
}
function renderMidseasonChanges(changes,finalView=false){
 const list=Array.isArray(changes)?changes:[];
 if(!list.length)return `<div class="midseason-no-changes">Nessun cambio effettuato.</div>`;
 return `<div class="midseason-changes ${finalView?'final':''}">${list.map((change,index)=>{const oldPlayer=change.outId?playerById(change.outId):null;const newPlayer=change.incomingId?playerById(change.incomingId):null;const sourceClub=clubById(change.clubId||newPlayer?.club);const clubStyle=teamCssVars({colors:sourceClub?.colorClub});return `<div class="midseason-change-card" style="${clubStyle}"><div class="midseason-change-number">${index+1}</div><div class="midseason-change-person">${oldPlayer?renderMiniAvatar(oldPlayer,'small'):''}<span><small>Uscita · ${esc(change.slot||'')}</small><b>${esc(change.out||oldPlayer?.name||'Giocatore')}</b></span></div><div class="midseason-change-arrow">→</div><div class="midseason-change-person incoming">${newPlayer?renderMiniAvatar(newPlayer,'small'):''}<span><small>${sourceClub?esc(sourceClub.name):'Entrata'}</small><b>${esc(change.incoming||newPlayer?.name||'Giocatore')}</b></span></div><div class="midseason-change-deltas"><span class="${midseasonDeltaClass(change.deltaOverall)}">OVR ${midseasonDeltaLabel(change.deltaOverall,1)}</span><span class="${midseasonDeltaClass(change.deltaChemistry)}">INT ${midseasonDeltaLabel(change.deltaChemistry,0)}</span></div></div>`}).join('')}</div>`;
}
function renderMidseasonFinalSummary(ms,bot=false){
 const changes=Array.isArray(ms.changes)?ms.changes:[];
 const first=changes[0]||null,last=changes[changes.length-1]||null;
 const totalOvr=first&&last?(Number(last.afterOverall)-Number(first.beforeOverall)):0;
 const totalChem=first&&last?(Number(last.afterChemistry)-Number(first.beforeChemistry)):0;
 return `<section class="panel midseason-final-view"><div class="label">Giro di boa</div><h2 class="midseason-title">${bot?'Mercato completato dal bot':'Mercato completato'}</h2><p class="midseason-copy">${changes.length?`${changes.length} ${changes.length===1?'cambio confermato':'cambi confermati'}. Controlla il riepilogo prima di tornare al campionato.`:'Hai scelto di proseguire senza modificare la rosa.'}</p><div class="midseason-final-stats"><div><span>Cambi</span><b>${changes.length}</b></div><div><span>OVR medio</span><b class="${midseasonDeltaClass(totalOvr)}">${midseasonDeltaLabel(totalOvr,1)}</b></div><div><span>Intesa</span><b class="${midseasonDeltaClass(totalChem)}">${midseasonDeltaLabel(totalChem,0)}</b></div></div>${renderMidseasonChanges(changes,true)}<button id="continueMidseasonSummary" class="btn primary midseason-continue-btn">Continua il campionato</button></section>`;
}
function finishMidseasonEarly(){
 const ms=state.midseason;
 const mandatory=mandatoryMidseasonPlayerIds()[0]||'';
 if(mandatory&&rosterEntry(mandatory))return toast('Devi prima completare tutti gli scambi obbligatori indicati dagli eventi.');
 if(!isFlexibleMidseason()&&ms.step<ms.target)return toast(`Devi completare ${ms.target} ${ms.target===1?'cambio':'cambi'}.`);
 ms.outgoingId='';
 ms.clubId='';
 ms.nation='';
 ms.candidates=[];
 ms.pendingCandidateId='';
 ms.drawsUsed=0;
 ms.completed=true;
 save();
 render();
}
function continueAfterMidseasonSummary(){
 state.midseason.completed=false;
 state.midseason.pendingCandidateId='';
 state.phase='season';
 state.seasonRules.botMidseason=false;
 initializeParallelCup();
 resolveFantaballopoliMidseason();
 const meritPostEvent=prepareMeritPostMidseasonEvent();
 const remainingMandatory=mandatoryMidseasonPlayerIds().filter(id=>rosterEntry(id));state.seasonRules.mandatoryMidseasonPlayerIds=remainingMandatory;state.seasonRules.mandatoryMidseasonPlayerId=remainingMandatory[0]||'';
 if(!meritPostEvent)prepareEvent();
 save();
 render();
 toast(state.midseason.step?`Mercato concluso con ${state.midseason.step} ${state.midseason.step===1?'cambio':'cambi'}`:'Nessun cambio effettuato');
}
function runBotMidseason(){
 const ms=state.midseason;
 if(ms.autoCompleted)return;
 const target=clamp(Number(ms.target)||midseasonTarget(),1,3);
 const changedSlots=new Set();
 const changes=[];
 for(let step=0;step<target;step++){
   const possibleIndexes=state.draft.roster.map((entry,index)=>({entry,index})).filter(item=>!changedSlots.has(item.index));
   if(!possibleIndexes.length)break;
   const mandatoryId=mandatoryMidseasonPlayerIds()[0]||'';
   const selected=mandatoryId?(possibleIndexes.find(item=>String(item.entry.playerId)===mandatoryId)||pick(possibleIndexes)):pick(possibleIndexes);
   const outgoing=selected.entry;
   const usedIds=new Set(state.draft.roster.map(entry=>String(entry.playerId)));
   let pool=PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player)&&!usedIds.has(String(player.id))&&(outgoing.bench||userCompatible(player,outgoing.slot)));
   if(requiresEqualOrBetterMidseason(outgoing.playerId)){
     const compatiblePool=[...pool],threshold=Number(outgoing.player?.ovr||playerById(outgoing.playerId)?.ovr)||0;pool=pool.filter(player=>(Number(player.ovr)||0)>=threshold);
     if(!pool.length&&compatiblePool.length){const source=[...compatiblePool].sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0],boosted=registerGeneratedEventPlayer({...source,baseOvr:originalBaseOvr(source),id:`event-alien-auto-${source.id}-${Date.now()}`,ovr:threshold,eventPlayer:true,eventUniverse:'alien-market'});pool=[boosted];}
   }
   if(!pool.length)continue;
   const replacement=coachHighOvrPick(pool);
   const projection=midseasonProjection(outgoing.playerId,replacement.id);
   const oldPlayer=outgoing.player||playerById(outgoing.playerId);
   state.draft.roster[selected.index].playerId=String(replacement.id);
   state.draft.roster[selected.index].player={...replacement};
   changedSlots.add(selected.index);
   changes.push({outId:String(oldPlayer?.id||outgoing.playerId),incomingId:String(replacement.id),out:oldPlayer?.name||'Giocatore',incoming:replacement.name,slot:outgoing.slot,clubId:String(replacement.club||''),beforeOverall:projection?.current.overall||0,afterOverall:projection?.projected.overall||0,deltaOverall:projection?.deltaOverall||0,beforeChemistry:projection?.current.chemistry.score||0,afterChemistry:projection?.projected.chemistry.score||0,deltaChemistry:projection?.deltaChemistry||0});
 }
 refreshOpponentClubRosters();
 ms.step=changes.length;
 ms.changes=changes;
 ms.autoCompleted=true;
 ms.completed=true;
 changes.forEach(change=>clearMandatoryMidseasonPlayer(change.outId));
 save();
}
function continueAfterBotMarket(){continueAfterMidseasonSummary()}
function midseasonDrawLimit(){return 1+Math.max(0,Number(state.seasonRules?.midseasonExtraRerolls)||0)+(coachIs('talent-scout')?1:0)}
function midseasonCanDraw(){return Math.max(0,Number(state.midseason?.drawsUsed)||0)<midseasonDrawLimit()}
function midseasonDisplayedOvr(player,entry=null){
 const base=Math.round(ductilityEffectiveBaseOvr(player));
 const starters=starterEntries().map(item=>item.player).filter(Boolean);
 const baseChem=entry&&!entry.bench?Math.round(chemistryBase(player,starters)||0):0;
 const value=Math.round(base+effectiveChemistryFromBase(player,baseChem)+activeOvrBonus(player));return fantaballopoliAllowsNegativeOvr()?value:Math.max(1,value);
}
function showMidseason(){
 if(coachIs('three-five-two')){state.midseason.completed=true;state.midseason.autoCompleted=true;if(state.matchday>=seasonLength())advanceAfterRegularSeason();else state.phase='season';save();render();return}
 const ms=state.midseason;
 ms.target=clamp(Number(ms.target)||midseasonTarget(),1,3);
 ms.pendingCandidateId=String(ms.pendingCandidateId||'');
 const mandatoryId=mandatoryMidseasonPlayerIds()[0]||'';
 const mandatoryActive=Boolean(mandatoryId&&rosterEntry(mandatoryId));
 if(mandatoryActive)ms.outgoingId=mandatoryId;
 ms.completed=Boolean(ms.completed);
 const flexible=isFlexibleMidseason();
 if(ms.auto){
   runBotMidseason();
   screen.innerHTML=renderMidseasonFinalSummary(ms,true);
   const cont=document.getElementById('continueMidseasonSummary');if(cont)cont.onclick=continueAfterBotMarket;
   return;
 }
 if(ms.completed){
   screen.innerHTML=renderMidseasonFinalSummary(ms,false);
   const cont=document.getElementById('continueMidseasonSummary');if(cont)cont.onclick=continueAfterMidseasonSummary;
   return;
 }
 const selected=ms.outgoingId?rosterEntry(ms.outgoingId):null;
 const pendingPlayer=ms.pendingCandidateId?playerById(ms.pendingCandidateId):null;
 const projection=selected&&pendingPlayer?midseasonProjection(selected.playerId,pendingPlayer.id):null;
 const remaining=Math.max(0,ms.target-ms.step);
 const drawLocked=Boolean(ms.clubId)&&!midseasonCanDraw();
 const outgoingLocked=mandatoryActive||Boolean(ms.outgoingId);
 const extraDrawsRemaining=Math.max(0,midseasonDrawLimit()-Number(ms.drawsUsed||0));
 const confirmedHtml=ms.changes.length?`<div class="midseason-confirmed-box"><div class="midseason-tip">Cambi già confermati</div>${renderMidseasonChanges(ms.changes)}</div>`:'';
 const coachSwapEntry=state.seasonRules.coachTopSwapPlayerId?rosterEntry(state.seasonRules.coachTopSwapPlayerId):null;
 const equalSwapEntry=mandatoryId&&requiresEqualOrBetterMidseason(mandatoryId)?rosterEntry(mandatoryId):null;
 const specialMarketNotice=equalSwapEntry?`<div class="midseason-draw-lock"><b>È un povero pazzo.</b> ${esc(equalSwapEntry.player.name)} può essere sostituito soltanto da un giocatore con OVR pari o superiore al suo.</div>`:coachSwapEntry?`<div class="midseason-draw-lock"><b>Figlio del mister.</b> Se scegli ${esc(coachSwapEntry.player.name)} come giocatore in uscita, il pack conterrà un top player garantito del suo macro-ruolo.</div>`:state.seasonRules.guaranteedTopPlayerNextMidseason?`<div class="midseason-draw-lock"><b>Top player garantito.</b> Il prossimo pack del mercato conterrà almeno un giocatore di alto livello compatibile.</div>`:'';
 screen.innerHTML=`<section class="panel"><div class="label">Giro di boa</div><h2 class="midseason-title">Draft di metà campionato</h2><p class="midseason-copy">${flexible?`Puoi scegliere liberamente se fare <b>da 0 a ${ms.target} ${ms.target===1?'cambio':'cambi'}</b>.`:`In questa stagione devi effettuare <b>${ms.target}</b> ${ms.target===1?'cambio':'cambi'} per effetto degli eventi.`} Prima di confermare vedrai l’impatto previsto su OVR medio e Intesa. <b>${coachIs('talent-scout')?'Con Talent scout hai un re-roll aggiuntivo per ogni cambio.':'Ogni cambio ha una sola estrazione del club.'} Dopo aver scelto il giocatore da cedere, lo scambio diventa obbligatorio.</b></p>${mandatoryActive?`<div class="midseason-draw-lock"><b>Scambio obbligatorio.</b> Devi sostituire ${esc(rosterEntry(mandatoryId)?.player?.name||'il giocatore indicato')} prima di poter chiudere il mercato.</div>`:''}${specialMarketNotice}${confirmedHtml}<div class="midseason-shell ${selected?'has-selection':''}"><div class="midseason-panel midseason-outgoing-panel"><div class="midseason-tip">1. scegli chi lascia la rosa</div><div class="midseason-count"><span class="chip">Fatti: ${ms.step}</span><span class="chip">Disponibili: ${remaining}</span>${flexible?`<span class="chip">Scelta libera 0–${ms.target}</span>`:''}</div><div class="outgoing-list">${sortRosterEntriesByRole(rosterPlayers()).map(entry=>{const currentOvr=midseasonDisplayedOvr(entry.player,entry);const sub=isSubscriber(entry.player),creator=isCreator(entry.player);return `<button class="outgoing midseason-player-row ${ms.outgoingId===entry.playerId?'active':''} ${sub?'subscriber':''} ${creator?'creator':''}" data-out="${esc(entry.playerId)}" ${outgoingLocked?'disabled':''}>${renderMiniAvatar(entry.player,'small')}<span class="midseason-player-copy"><b>${sub?'<span class="midseason-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(entry.player.name)}</b><small>${esc(entry.slot)} · ${esc(entry.player.Position)}${entry.bench?' · Panchina':''}</small></span><span class="midseason-current-ovr"><strong>${currentOvr}</strong><small>OVR attuale</small></span></button>`}).join('')}</div></div><div class="midseason-panel midseason-substitute-panel"><div class="midseason-tip">2. scegli il sostituto ${ms.target>1?`(${Math.min(ms.step+1,ms.target)}/${ms.target})`:''}</div><div class="midseason-choice-note">${selected?`Stai sostituendo <b>${esc(selected.player.name)}</b> nello slot <b>${esc(selected.slot)}</b>. ${coachIs('talent-scout')?'Hai a disposizione anche il re-roll aggiuntivo del Talent scout.':'L’estrazione del club è definitiva.'} Scegli con attenzione uno dei candidati disponibili.`:flexible?`Puoi chiudere il mercato senza cambi oppure fermarti dopo qualsiasi cambio confermato, fino a un massimo di ${ms.target}.`:'Seleziona un giocatore dalla rosa per iniziare il cambio.'}</div>${selected?`<div class="midseason-draw-actions">${!ms.clubId?'<button id="drawMarket" class="btn gold">Estrai club</button>':midseasonCanDraw()?`<button id="drawMarket" class="btn gold">Re-roll imprevisto (${extraDrawsRemaining})</button>`:''}</div>${selected?`<div class="midseason-draw-lock"><b>Scambio avviato.</b> Non puoi più annullare o cambiare il giocatore in uscita: devi scegliere e confermare uno dei candidati proposti.</div>`:''}${ms.clubId?`<div class="midseason-summary-card" style="${teamCssVars({colors:marketClub()?.colorClub})}"><div class="need">Club estratto</div><div class="nation-name">${esc(marketClub()?.name||ms.clubId)}</div></div><div class="candidate-grid midseason-candidate-grid">${sortPlayersByRole(ms.candidates.map(playerById).filter(Boolean)).map(player=>{const id=String(player.id);const currentOvr=midseasonDisplayedOvr(player);const sub=isSubscriber(player),creator=isCreator(player);const rarity=draftRarityMeta(currentOvr);return `<button class="candidate midseason-market-player rarity-${rarity.key} ${sub?'subscriber':''} ${creator?'creator':''} ${ms.pendingCandidateId===String(id)?'active':''}" data-market="${id}" data-ovr="${currentOvr}">${renderMiniAvatar(player,'small')}<span class="midseason-player-copy"><span class="name">${sub?'<span class="midseason-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(player.name)} <span class="season-rarity-badge">${esc(rarity.label)}</span></span><span class="meta"><span class="chip">${esc(player.Position)}</span>${sub?'<span class="chip sub">ABB</span>':''}${creator?'<span class="season-chip creator">CREATOR</span>':''}</span></span><span class="midseason-current-ovr"><strong>${currentOvr}</strong><small>OVR base</small></span></button>`}).join('')}</div>${renderMidseasonComparison(projection)}`:''}`:`<div class="midseason-actions">${flexible&&!mandatoryActive?'<button id="finishMidseasonNow" class="btn secondary-strong">Nessun cambio, continua</button>':''}</div>`}${flexible&&ms.step>0&&ms.step<ms.target?`<div class="midseason-actions"><button id="finishAfterOne" class="btn primary">Concludi con ${ms.step} ${ms.step===1?'cambio':'cambi'}</button></div>`:''}</div></div></section>`;
 document.querySelectorAll('[data-out]').forEach(button=>button.onclick=()=>{
   if(mandatoryActive&&String(button.dataset.out)!==mandatoryId)return toast('Questo mercato richiede lo scambio obbligatorio del giocatore indicato.');
   if(ms.outgoingId)return toast('Hai già avviato questo scambio: devi scegliere e confermare uno dei candidati proposti.');
   ms.outgoingId=button.dataset.out;
   ms.clubId='';
   ms.candidates=[];
   ms.pendingCandidateId='';
   ms.drawsUsed=0;
   save();
   render();
   if(window.matchMedia&&window.matchMedia('(max-width:760px)').matches){
     requestAnimationFrame(()=>document.querySelector('.midseason-substitute-panel')?.scrollIntoView({behavior:'smooth',block:'start'}));
   }
 });
 const draw=document.getElementById('drawMarket');if(draw)draw.onclick=drawMarket;
 const fin=document.getElementById('finishMidseasonNow');if(fin)fin.onclick=finishMidseasonEarly;
 const finOne=document.getElementById('finishAfterOne');if(finOne)finOne.onclick=finishMidseasonEarly;
 document.querySelectorAll('[data-market]').forEach(button=>button.onclick=()=>selectMarketCandidate(button.dataset.market));
 const confirm=document.getElementById('confirmMarketChange');if(confirm)confirm.onclick=()=>completeMarket(ms.pendingCandidateId);
}
function drawMarket(){
 primeDraftAudio();
 const ms=state.midseason,outgoing=rosterEntry(ms.outgoingId);
 if(!outgoing)return toast('Scegli prima il giocatore da sostituire.');
 if(fantaballopoliRequiresGiuda(outgoing.playerId)){
   const giuda=createGiudaForEntry(outgoing);if(!giuda)return toast('Il giocatore misterioso non è disponibile.');
   ms.clubId='Fantaballopoli';ms.candidates=[String(giuda.id)];ms.pendingCandidateId='';ms.drawsUsed=midseasonDrawLimit();playDraftPackSound();save();render();animateMidseasonCandidateReveal();return;
 }
 if(!midseasonCanDraw())return toast(coachIs('talent-scout')?'Hai già utilizzato anche il re-roll aggiuntivo del Talent scout.':'L’estrazione è definitiva: non puoi cambiare club.');
 const used=new Set(state.draft.roster.map(entry=>String(entry.playerId)));
 let base=PLAYERS.filter(player=>player.club&&youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id))&&(outgoing.bench||userCompatible(player,outgoing.slot)));
 const equalStrengthRequired=requiresEqualOrBetterMidseason(outgoing.playerId),outgoingOvr=Number(outgoing.player?.ovr||playerById(outgoing.playerId)?.ovr)||0;
 if(equalStrengthRequired){
   const compatiblePool=[...base];base=base.filter(player=>(Number(player.ovr)||0)>=outgoingOvr);
   if(!base.length&&compatiblePool.length){const source=[...compatiblePool].sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0],boosted=registerGeneratedEventPlayer({...source,baseOvr:originalBaseOvr(source),id:`event-alien-market-${source.id}-${Date.now()}`,ovr:outgoingOvr,eventPlayer:true,eventUniverse:'alien-market'});base=[boosted];}
 }
 const coachSpecial=String(state.seasonRules.coachTopSwapPlayerId||'')===String(outgoing.playerId);
 const oneTimeGuaranteed=Boolean(state.seasonRules.guaranteedTopPlayerNextMidseason||coachSpecial);
 const fantaguruActive=Boolean(state.seasonRules.fantaguruBetterMidseason);
 if(coachSpecial)base=base.filter(player=>roleOf(player)===roleOf(outgoing.player));
 let guaranteedPlayer=null;
 if(oneTimeGuaranteed&&base.length){
   const top=base.filter(player=>(Number(player.ovr)||0)>=80).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0));
   guaranteedPlayer=(top[0]||[...base].sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0])||null;
 }
 if(fantaguruActive&&base.length){
   const guru=fantaguruCandidate(outgoing,base);
   if(guru){
     if(!base.some(player=>String(player.id)===String(guru.id)))base.push(guru);
     const outgoingOvr=Number(outgoing.player?.ovr||playerById(outgoing.playerId)?.ovr)||0;
     if(!guaranteedPlayer||(Number(guaranteedPlayer.ovr)||0)<=outgoingOvr)guaranteedPlayer=guru;
   }
 }
 const groups={};
 base.forEach(player=>(groups[String(player.club)]??=[]).push(player));
 const previousClub=String(ms.clubId||'');
 if(guaranteedPlayer)ms.clubId=String(guaranteedPlayer.club);
 else{
   const preferred=Object.keys(groups).filter(clubId=>groups[clubId].length>=2&&clubById(clubId)&&clubId!==previousClub),fallback=Object.keys(groups).filter(clubId=>clubById(clubId)&&clubId!==previousClub),clubPool=preferred.length?preferred:(fallback.length?fallback:Object.keys(groups).filter(clubId=>clubById(clubId)));
   ms.clubId=(coachIs('talent-scout')?coachHighOvrPick(clubPool.map(clubId=>({id:clubId,ovr:Math.max(...(groups[clubId]||[]).map(player=>Number(player.ovr)||0),0)})))?.id:pick(clubPool))||'';
 }
 const clubPlayers=groups[ms.clubId]||[];
 ms.candidates=guaranteedPlayer?[String(guaranteedPlayer.id),...coachHighOvrSample(clubPlayers.filter(player=>String(player.id)!==String(guaranteedPlayer.id)),3).map(player=>String(player.id))]:coachHighOvrSample(clubPlayers,4).map(player=>String(player.id));
 ms.pendingCandidateId='';
 playDraftPackSound();
 ms.drawsUsed=Math.max(0,Number(ms.drawsUsed)||0)+1;
 if(state.seasonRules.guaranteedTopPlayerNextMidseason)state.seasonRules.guaranteedTopPlayerNextMidseason=false;
 if(coachSpecial)state.seasonRules.coachTopSwapPlayerId='';
 save();render();animateMidseasonCandidateReveal();
 if(fantaguruActive&&guaranteedPlayer)toast(`Fantaguru: ${guaranteedPlayer.name} (${guaranteedPlayer.ovr} OVR) è migliore del giocatore ceduto.`);
 else if(guaranteedPlayer)toast(`Top player garantito nel pack: ${guaranteedPlayer.name}.`);
}
function selectMarketCandidate(id){
 const ms=state.midseason;
 if(!ms.candidates.includes(String(id)))return;
 ms.pendingCandidateId=String(id);
 save();
 render();
}
function completeMarket(id){
 const ms=state.midseason;
 const index=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(ms.outgoingId));
 if(index<0)return;
 const replacement=playerById(id);
 if(!replacement||!ms.candidates.includes(String(id)))return toast('Scegli un candidato valido.');
 if(!youngBeautifulAllowsPlayer(replacement))return toast(youngBeautifulBlockMessage(replacement));
 const oldEntry=rosterEntry(ms.outgoingId);
 const oldPlayer=oldEntry?.player||playerById(ms.outgoingId);
 const projection=midseasonProjection(ms.outgoingId,id);
 if(!projection)return toast('Confronto non disponibile.');
 state.draft.roster[index].playerId=String(id);
 state.draft.roster[index].player={...replacement};
 delete state.playInjured[String(ms.outgoingId)];
 const fulfilledMandatory=mandatoryMidseasonPlayerIds().includes(String(ms.outgoingId));
 if(fulfilledMandatory)clearMandatoryMidseasonPlayer(ms.outgoingId);
 if(String(state.seasonRules.topPlayerAfterMandatoryId||'')===String(ms.outgoingId)){state.seasonRules.guaranteedTopPlayerNextMidseason=true;state.seasonRules.topPlayerAfterMandatoryId='';}
 refreshOpponentClubRosters();
 ms.step++;
 ms.changes.push({outId:String(oldPlayer?.id||ms.outgoingId),incomingId:String(replacement.id),out:oldPlayer?.name||'Giocatore',incoming:replacement.name,slot:oldEntry?.slot||state.draft.roster[index].slot,clubId:String(replacement.club||''),beforeOverall:projection.current.overall,afterOverall:projection.projected.overall,deltaOverall:projection.deltaOverall,beforeChemistry:projection.current.chemistry.score,afterChemistry:projection.projected.chemistry.score,deltaChemistry:projection.deltaChemistry,outgoingOvr:projection.outgoingOvr,incomingOvr:projection.incomingOvr});
 ms.outgoingId=mandatoryMidseasonPlayerIds()[0]||'';
 ms.clubId='';
 ms.candidates=[];
 ms.pendingCandidateId='';
 ms.drawsUsed=0;
 const flexible=isFlexibleMidseason();
 if(ms.step>=ms.target)ms.completed=true;
 save();
 render();
 if(!ms.completed&&flexible)toast(`Cambio ${ms.step} confermato. Puoi fermarti qui oppure farne un altro.`);
}

function rankedGoalStats(){return Object.entries(state.stats?.goals||{}).filter(([,goals])=>Number(goals)>0).sort((a,b)=>Number(b[1]||0)-Number(a[1]||0)||String(statPlayerInfo(a[0]).name).localeCompare(String(statPlayerInfo(b[0]).name),'it'))}
function userTeamGoalStats(){const totals={};(state.history||[]).forEach(match=>(match.goals||[]).forEach(goal=>{const id=String(goal.playerId||'');if(id)totals[id]=(totals[id]||0)+1}));const exact=Object.entries(totals).filter(([,goals])=>Number(goals)>0).sort((a,b)=>Number(b[1])-Number(a[1])||String(statPlayerInfo(a[0]).name).localeCompare(String(statPlayerInfo(b[0]).name),'it'));return exact.length?exact:rankedGoalStats().filter(([id])=>String(statPlayerTeam(id)?.id||'')===USER_ID)}
function teamTopScorer(){return userTeamGoalStats()[0]||null}
function showFinished(){
 const table=sortedTable(),eliminated=isTeamEliminated(USER_ID),regularRank=eliminated?0:table.findIndex(x=>x.id===USER_ID)+1,p=leaguePlayoffState(),playoffTitle=leaguePlayoffTitleWon(),playoffActive=leaguePlayoffsRuleActive()&&p.status==='completed',achievementRank=playoffActive?(playoffTitle?1:Math.max(2,regularRank||2)):regularRank,rankLabel=eliminated?'—':playoffTitle?'🏆':playoffActive?`${regularRank}° REG.`:`${regularRank}°`,s=userStanding(),rankedGoals=rankedGoalStats(),top=rankedGoals[0],topPlayer=top?statPlayerInfo(top[0]):null,userTop=teamTopScorer(),userTopPlayer=userTop?statPlayerInfo(userTop[0]):null,canSubmit=(playoffActive?playoffTitle:regularRank===1)&&!eliminated,summary=buildSeasonSummary(playoffActive?(playoffTitle?1:regularRank):regularRank,eliminated),finalHeadline=playoffActive?(playoffTitle?'Campione dei play off!':!p.userQualified?'Non qualificato ai play off':p.userEliminated?'Eliminato dai play off':'Play off conclusi'):seasonFinalHeadline(regularRank,eliminated),playoffNote=leaguePlayoffFinalNote();
 checkSeasonAchievements(achievementRank,eliminated);
 screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Stagione conclusa</div><h2>${finalHeadline}</h2><div class="final-position">${rankLabel}</div><p>${esc(state.teamName)} chiude la stagione dopo ${state.matchday} giornate.${playoffNote?` ${esc(playoffNote)}`:''}</p></div><div class="final-grid"><div class="stat"><b>${s.pts}</b><span>Punti</span></div><div class="stat"><b>${s.w}-${s.d}-${s.l}</b><span>V-N-P</span></div><div class="stat"><b>${s.gf}</b><span>Gol fatti</span></div><div class="stat"><b>${s.ga}</b><span>Gol subiti</span></div></div>${renderSeasonSummaryCard(summary)}<section class="panel"><h3>Capocannonieri</h3><p><b>Campionato:</b> ${topPlayer?`${esc(topPlayer.name)} — ${Number(top[1])||0} gol`:'Nessun marcatore'}</p><p><b>${esc(state.teamName)}:</b> ${userTopPlayer?`${esc(userTopPlayer.name)} — ${Number(userTop[1])||0} gol`:'Nessun marcatore'}</p>${canSubmit?`<p class="subline">La vittoria del Campionato può essere inviata alla classifica generale. Il miglior marcatore della tua squadra verrà sommato alla tabella Capocannonieri.</p>`:`<p class="subline"><b>Invio non disponibile:</b> può inviare il risultato soltanto chi vince il Campionato o i play off scudetto.</p>`}<div class="top-actions">${canSubmit?`<button id="sendSeason" class="btn primary" ${state.submitted?'disabled':''}>${state.submitted?'Risultati inviati':'Invia vittoria'}</button>`:''}<button id="exportSeason" class="btn gold">Esporta risultati JSON</button></div></section>${renderFinalPlayerStats()}<div class="season-finished-table">${renderTable()}</div></section>`;
 const sendButton=document.getElementById('sendSeason');if(sendButton)sendButton.onclick=sendSeason;document.getElementById('exportSeason').onclick=exportSeason;document.getElementById('shareSeasonCard').onclick=()=>shareSeasonSummary(summary);document.getElementById('downloadSeasonCard').onclick=()=>downloadSeasonSummary(summary);
}

let seasonSendInFlight=false;
function createSeasonSubmissionCode(){
 state.meta=state.meta&&typeof state.meta==='object'?state.meta:{};
 if(state.meta.submissionCode)return String(state.meta.submissionCode);
 const randomPart=(globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function')?globalThis.crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
 const created=String(state.meta.createdAt||new Date().toISOString()).replace(/[^0-9]/g,'').slice(0,17)||Date.now().toString(36);
 state.meta.submissionCode=`${SEASON_CONFIG.submission.prefix}-${created}-${randomPart}`;
 return state.meta.submissionCode;
}
function googleScriptRequestUrl(params={}){
 const url=new URL(VICTORY_ENDPOINT,window.location.href);
 Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,String(value)));
 url.searchParams.set('_fb',`${Date.now()}_${Math.floor(Math.random()*1000000)}`);
 return url.toString();
}
function waitForSeasonSubmissionStatus(submissionCode,timeoutMs=6500){
 return new Promise((resolve,reject)=>{
   if(!submissionCode){reject(new Error('Codice univoco della stagione mancante'));return}
   const callbackName=`fantaballaSubmissionStatus_${Date.now()}_${Math.floor(Math.random()*1000000)}`;
   const script=document.createElement('script');
   let settled=false;
   script.async=true;
   script.referrerPolicy='no-referrer';
   function cleanup(){
     window.clearTimeout(timeout);
     try{delete window[callbackName]}catch(error){window[callbackName]=undefined}
     if(script.parentNode)script.parentNode.removeChild(script);
   }
   function finish(handler,value){if(settled)return;settled=true;cleanup();handler(value)}
   const timeout=window.setTimeout(()=>finish(reject,new Error('Verifica salvataggio scaduta')),timeoutMs);
   window[callbackName]=data=>{
     if(!data||data.ok!==true||typeof data.found!=='boolean'){
       finish(reject,new Error(String(data&&data.error?data.error:'Risposta di verifica non valida')));
       return;
     }
     finish(resolve,data);
   };
   script.onerror=()=>finish(reject,new Error('Verifica Google Apps Script non disponibile'));
   script.src=googleScriptRequestUrl({action:'submission_status',codice_vittoria:submissionCode,callback:callbackName,transport:'jsonp'});
   document.body.appendChild(script);
 });
}
function submitSeasonPayloadVerified(payload,timeoutMs=22000){
 return new Promise((resolve,reject)=>{
   if(!VICTORY_ENDPOINT||!/^https:\/\/script\.google\.com\//i.test(VICTORY_ENDPOINT)){
     reject(new Error('Endpoint Google Apps Script non configurato'));
     return;
   }
   const requestId=`fb_submit_${Date.now()}_${Math.floor(Math.random()*1000000)}`;
   const frameName=`fantaballaSubmitFrame_${requestId}`;
   const iframe=document.createElement('iframe');
   const form=document.createElement('form');
   let settled=false;
   iframe.name=frameName;
   iframe.setAttribute('aria-hidden','true');
   iframe.tabIndex=-1;
   iframe.style.cssText='position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none';
   form.method='POST';
   form.action=VICTORY_ENDPOINT;
   form.target=frameName;
   form.acceptCharset='UTF-8';
   form.style.display='none';
   [['payload',JSON.stringify(payload)],['transport','iframe'],['requestId',requestId]].forEach(([name,value])=>{
     const input=document.createElement('input');
     input.type='hidden';
     input.name=name;
     input.value=value;
     form.appendChild(input);
   });
   function cleanup(){
     window.clearTimeout(timeout);
     window.removeEventListener('message',onMessage);
     if(form.parentNode)form.parentNode.removeChild(form);
     if(iframe.parentNode)iframe.parentNode.removeChild(iframe);
   }
   function finish(handler,value){
     if(settled)return;
     settled=true;
     cleanup();
     handler(value);
   }
   function onMessage(event){
     const message=event&&event.data;
     if(!message||message.type!=='fantaballa-classifica-response-v1'||message.requestId!==requestId)return;
     const origin=String(event.origin||'');
     if(origin!=='null'&&!/^https:\/\/([a-z0-9-]+\.)*(google\.com|googleusercontent\.com)$/i.test(origin))return;
     const result=message.data;
     if(!result||typeof result.ok!=='boolean'){
       finish(reject,new Error('Risposta non valida da Google Apps Script'));
       return;
     }
     if(!result.ok){
       finish(reject,new Error(String(result.error||'Google Apps Script ha rifiutato il risultato')));
       return;
     }
     finish(resolve,result);
   }
   async function verifySavedRow(){
     await new Promise(done=>window.setTimeout(done,1200));
     while(!settled){
       try{
         const status=await waitForSeasonSubmissionStatus(payload.codice_vittoria||payload.victoryCode,5000);
         if(status.found){finish(resolve,{ok:true,duplicate:Boolean(status.duplicate),saved:status.saved||null,verifiedBy:'status'});return}
       }catch(error){}
       if(!settled)await new Promise(done=>window.setTimeout(done,1100));
     }
   }
   const timeout=window.setTimeout(()=>finish(reject,new Error('Google Apps Script non ha confermato il salvataggio. Puoi riprovare senza creare duplicati.')),timeoutMs);
   window.addEventListener('message',onMessage);
   iframe.onerror=()=>finish(reject,new Error('Impossibile raggiungere Google Apps Script'));
   document.body.appendChild(iframe);
   document.body.appendChild(form);
   verifySavedRow();
   try{form.submit()}catch(error){finish(reject,error)}
 });
}
async function sendSeason(){
 const s=userStanding(),regularRank=sortedTable().findIndex(row=>row.id===USER_ID)+1,titleWon=leaguePlayoffsRuleActive()?leaguePlayoffTitleWon():regularRank===1;
 if(!titleWon){toast('Puoi inviare il risultato solo vincendo il Campionato');return}
 if(state.submitted||seasonSendInFlight){toast(state.submitted?'Risultato già inviato':'Invio già in corso');return}
 const sendButton=document.getElementById('sendSeason');
 seasonSendInFlight=true;
 if(sendButton){sendButton.disabled=true;sendButton.textContent='Invio in corso…';sendButton.setAttribute('aria-busy','true')}
 const rankedGoals=rankedGoalStats(),top=rankedGoals[0],topGoals=top?Number(top[1])||0:0,p=top?statPlayerInfo(top[0]):null,userTop=teamTopScorer(),userTopGoals=userTop?Number(userTop[1])||0:0,userTopPlayer=userTop?statPlayerInfo(userTop[0]):null;
 const userScorerText=userTopPlayer?`${userTopPlayer.name} (${userTopGoals})`:'';
 const leagueScorerText=p?`${p.name} (${topGoals})`:'';
 const submissionCode=createSeasonSubmissionCode();
 const payload={codice_vittoria:submissionCode,victoryCode:submissionCode,squadra:state.teamName,allenatore:state.coachName,tipo_allenatore:coachProfile().name,modalita:chaosEnabled()?SEASON_CONFIG.submission.chaosLabel:SEASON_CONFIG.submission.standardLabel,modalita_tipo:chaosEnabled()?SEASON_CONFIG.submission.chaosType:SEASON_CONFIG.submission.standardType,posizione_finale:1,punti:s.pts,giornate:seasonLength(),vittorie:s.w,pareggi:s.d,sconfitte:s.l,gol_fatti:s.gf,gol_subiti:s.ga,modulo:state.formation,ovr_medio:Math.round(teamPowerBase()*10)/10,capocannoniere:userScorerText,capocannoniere_giocatore:userScorerText,capocannoniere_campionato:leagueScorerText};
 state.meta.submissionPendingAt=new Date().toISOString();
 save();
 try{
   const result=await submitSeasonPayloadVerified(payload);
   state.submitted=true;
   state.meta.submittedAt=new Date().toISOString();
   state.meta.submissionPendingAt='';
   state.meta.lastSubmissionError='';
   save();
   render();
   toast(result.duplicate?'Risultato già presente: invio confermato':'Vittoria e miglior marcatore della squadra inviati');
 }catch(error){
   state.submitted=false;
   state.meta.submittedAt='';
   state.meta.submissionPendingAt='';
   state.meta.lastSubmissionError=String(error&&error.message?error.message:error||'Errore sconosciuto');
   save();
   toast(`Invio non riuscito: ${state.meta.lastSubmissionError}`);
 }finally{
   seasonSendInFlight=false;
   const currentButton=document.getElementById('sendSeason');
   if(!state.submitted&&currentButton){currentButton.disabled=false;currentButton.textContent='Invia vittoria';currentButton.removeAttribute('aria-busy')}
 }
}
function exportSeason(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='fantaballa-campionato-risultati.json';a.click();URL.revokeObjectURL(a.href)}
