/* Fantaballa Season Engine — 14-runtime.js
 * Router di rendering, avvio applicazione e gestori globali.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
function render(){updateSaveStatus();if(!PLAYERS.length||!CLUBS.length){screen.innerHTML='<section class="panel"><h2>Caricamento database giocatori...</h2></section>';applyError404VisualState();return}if(state.phase==='setup')showSetup();else if(state.phase==='draft')showDraft();else if(state.phase==='season')showSeason();else if(state.phase==='midseason')showMidseason();else if(state.phase==='story-final')showMeritStoryFinale();else if(state.phase==='italia-2006-final')showItalia2006Final();else if(state.phase==='fantaballopoli-final')showFantaballopoliFinal();else if(state.phase==='fantaballopoli-restart')showFantaballopoliRestart();else if(state.phase==='playoffs')showLeaguePlayoffs();else if(state.phase==='finished')showFinished();applyError404VisualState();updateSaveStatus()}
async function boot(){
 try{
   const [primaryPlayers,primaryClubs,commentary,secondaryPlayers,secondaryClubs]=await Promise.all([
     fetchJsonResource(SEASON_CONFIG.data.primaryPlayers,SEASON_CONFIG.data.primaryPlayers),
     fetchJsonResource(SEASON_CONFIG.data.primaryClubs,SEASON_CONFIG.data.primaryClubs),
     fetchJsonResource(SEASON_CONFIG.data.commentary,SEASON_CONFIG.data.commentary,{optional:true}),
     fetchJsonResource(SEASON_CONFIG.data.secondaryPlayers,SEASON_CONFIG.data.secondaryPlayers,{optional:true}),
     fetchJsonResource(SEASON_CONFIG.data.secondaryClubs,SEASON_CONFIG.data.secondaryClubs,{optional:true}),
     SEASON_EVENTS_READY
   ]);
   PLAYERS=primaryPlayers;CLUBS=primaryClubs;COMMENTARY=commentary;OTHER_CLUBS=Array.isArray(secondaryClubs)?secondaryClubs:[];
   if(SEASON_CONFIG.mode==='real'){REAL_PLAYERS=PLAYERS;CLASSIC_PLAYERS=Array.isArray(secondaryPlayers)?secondaryPlayers:[]}
   else{CLASSIC_PLAYERS=PLAYERS;REAL_PLAYERS=Array.isArray(secondaryPlayers)?secondaryPlayers:[]}
   dataDiagnostics=validateGameData(PLAYERS,CLUBS);
   if(dataDiagnostics.fatal.length)throw Error(dataDiagnostics.fatal.slice(0,12).join(' | ')+(dataDiagnostics.fatal.length>12?` | Altri ${dataDiagnostics.fatal.length-12} errori.`:''));
 }catch(error){
   console.error('Errore caricamento database',error);showBootError(error);return;
 }
 try{
   state=normalizeCampionatoState(state);save();cleanupLegacySaveArtifacts();render();
   if(startupNotice)toast(startupNotice);
   else if(dataDiagnostics.warnings.length)toast(`Database caricato con ${dataDiagnostics.warnings.length} avvisi.`);
 }catch(error){
   console.error(`Errore interfaccia ${SEASON_CONFIG.labels.competitionName}`,error);
   screen.innerHTML=`<section class="panel robust-error"><div class="label">Ripristino interfaccia</div><h2>La schermata non si è aperta</h2><p>Il salvataggio automatico è ancora presente e non è stato cancellato.</p><div class="robust-error-detail">${esc(error&&error.message?error.message:error)}</div><div class="top-actions" style="margin-top:14px"><button id="recoverInterfaceBtn" class="btn primary" type="button">Riprova senza cancellare</button><button id="recoverDraftViewBtn" class="btn gold" type="button">Apri il draft in modalità sicura</button></div></section>`;
   const recover=document.getElementById('recoverInterfaceBtn');if(recover)recover.onclick=()=>{state=normalizeCampionatoState(state);render()};
   const safeDraft=document.getElementById('recoverDraftViewBtn');if(safeDraft)safeDraft.onclick=()=>{state=normalizeCampionatoState(state);state.phase='draft';mobileDraftTab='players';save();render()};
 }
}
document.getElementById('resetBtn').onclick=async()=>{
 const confirmed=await openConfirm({title:'Azzera stagione',message:'La stagione corrente, il salvataggio temporaneo e il backup automatico verranno cancellati definitivamente.',confirmText:'Azzera definitivamente',danger:true});
 if(!confirmed)return;
 clearCurrentSaveArtifacts();state=freshState();save();render();toast('Stagione e backup azzerati definitivamente.')
};
window.addEventListener('pagehide',()=>save());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});
window.addEventListener('error',event=>{console.error('Errore JavaScript non gestito',event.error||event.message)});
window.addEventListener('unhandledrejection',event=>{console.error('Promise non gestita',event.reason)});
boot();
