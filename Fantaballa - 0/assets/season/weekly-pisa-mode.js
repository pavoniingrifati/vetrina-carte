/* Tricolore col Pisa! — modalità Evento del weekend
 * Adatta il motore condiviso del Fantacampionato senza duplicarne la logica di stagione.
 */
(function(){
 const WEEKLY=SEASON_CONFIG.weeklyChallenge||{};
 if(!WEEKLY.enabled)return;
 const PISA_ID=String(WEEKLY.clubId||'pisa');
 const PISA_NAME=String(WEEKLY.fixedTeamName||'Pisa');
 const PISA_COLORS=normalizeClubColors(SEASON_CONFIG.user?.fallbackClub?.colorClub||{primary:'#1565C0',secondary:'#111111',accent:'#FFFFFF',text:'#FFFFFF'});
 const WEEKLY_DISABLED_COACHES=new Set(['young-beautiful']);
 // Giovani e belli non è compatibile con la rosa fissa del Pisa: viene escluso
 // soltanto dalla Sfida della settimana, senza modificare le altre modalità.
 for(let index=COACH_PROFILES.length-1;index>=0;index--){
  if(WEEKLY_DISABLED_COACHES.has(String(COACH_PROFILES[index]?.id||'')))COACH_PROFILES.splice(index,1);
 }
 function normalizeWeeklyCoach(){
  if(WEEKLY_DISABLED_COACHES.has(normalizeCoachType(state.coachType)))state.coachType='anonymous';
 }
 function applyFixedIdentity(){
  normalizeWeeklyCoach();
  state.competitionVariant='serie-a';
  state.userClubId=PISA_ID;
  state.teamName=PISA_NAME;
  state.teamPaletteId='weekly-pisa';
  state.teamColors={...PISA_COLORS};
 }
 function weeklyCandidateIds(){
  return PLAYERS.filter(player=>String(player?.club||'')===PISA_ID&&draftPlayerIsValid(player)).map(player=>String(player.id));
 }
 function refreshWeeklyDraft(){
  applyFixedIdentity();
  state.draft=state.draft&&typeof state.draft==='object'?state.draft:freshState().draft;
  state.draft.clubId=PISA_ID;
  state.draft.openingClubShown=true;
  state.draft.rerolls=0;
  state.draft.candidates=weeklyCandidateIds();
 }
 function startWeeklyDraft(){
  applyFixedIdentity();
  state.phase='draft';
  state.setupStep=4;
  state.draft=freshState().draft;
  refreshWeeklyDraft();
  save();
  render();
 }
 const originalNormalize=normalizeCampionatoState;
 normalizeCampionatoState=function(input){
  const next=originalNormalize(input);
  if(WEEKLY_DISABLED_COACHES.has(normalizeCoachType(next.coachType)))next.coachType='anonymous';
  next.competitionVariant='serie-a';
  next.userClubId=PISA_ID;
  next.teamName=PISA_NAME;
  next.teamPaletteId='weekly-pisa';
  next.teamColors={...PISA_COLORS};
  if(next.phase==='draft'){
   next.draft.clubId=PISA_ID;
   next.draft.openingClubShown=true;
   next.draft.rerolls=0;
  }
  return next;
 };
 updateCompetitionChrome=function(){
  document.body?.classList.remove('competition-legend');
  document.body?.classList.add('competition-weekly-pisa');
  const meta=document.getElementById('competitionHeaderMeta');
  if(meta)meta.textContent='Evento del weekend · Pisa · 38 giornate · 14 giocatori iniziali';
  const hero=document.getElementById('competitionHeroText');
  if(hero)hero.textContent='Scegli 11 titolari e 3 riserve dall’intera rosa del Pisa, poi affronta il normale Fantacampionato con eventi, mercato, infortuni e sorprese.';
 };
 showSetup=function(){
  applyFixedIdentity();
  const allFormations=Object.keys(FORMATIONS).filter(form=>!['2-4-4','4-4-4','3-3-3'].includes(form));
  if(coachIs('three-five-two'))state.formation='3-5-2';
  const formations=coachIs('three-five-two')?['3-5-2']:allFormations;
  const coachValue=String((state.phase==='setup'&&isLegacySetupCoachName(state.coachName))?'':(state.coachName||initialSetupCoachName()||''));
  const club=clubById(PISA_ID)||SEASON_CONFIG.user.fallbackClub;
  const pal=clubPalette(club);
  screen.innerHTML=`<div class="season-setup-flow weekly-pisa-setup">
   <section class="panel season-weekly-intro"><div class="season-setup-kicker">Evento del weekend</div><h2>Tricolore col Pisa!</h2><p>La squadra è bloccata sul Pisa. Scegli modalità degli eventi, allenatore e modulo; nel draft troverai immediatamente l’intera rosa nerazzurra.</p><div class="season-weekly-reward"><b>🏁 Sfida della settimana</b><span>${esc(WEEKLY.rewardText||'I primi 10 classificati ricevono un +2 OVR a un giocatore.')}</span></div></section>
   <section class="panel season-setup-step"><div class="season-setup-step-head"><span class="season-setup-step-number">1</span><div><h2>Modalità degli eventi</h2><p>Il campionato rimane identico al Fantacampionato.</p></div></div><div class="season-mode-grid"><button type="button" class="season-mode-btn ${state.gameMode!=='chaos'?'active':''}" data-weekly-game-mode="normal"><b>Normale</b><small>Eventi e decisioni riguardano soltanto il Pisa.</small></button><button type="button" class="season-mode-btn ${state.gameMode==='chaos'?'active':''}" data-weekly-game-mode="chaos"><b>🌀 Caos</b><small>Anche le 19 avversarie ricevono eventi e conseguenze.</small></button></div></section>
   <section class="panel season-setup-step"><div class="season-setup-step-head"><span class="season-setup-step-number">2</span><div><h2>Il tuo Pisa</h2><p>Nome e colori sono fissi; scegli allenatore e profilo.</p></div></div><div class="season-identity-grid"><div><div class="season-identity-fields"><div class="field"><label>Squadra</label><input id="teamName" value="Pisa" readonly aria-readonly="true"></div><div class="field"><label>Nome allenatore</label><input id="coachName" maxlength="32" value="${esc(coachValue)}" placeholder="Nome allenatore" autocomplete="name"></div></div><div class="season-setup-tip">Se il nome dell’allenatore coincide con quello di un calciatore scelto, quel giocatore ottiene +10 OVR di Intesa.</div><div class="season-coach-title">Tipo di allenatore</div><div class="season-coach-selector">${renderCoachCarousel()}</div><div class="season-setup-tip secondary"><b>Regola evento:</b> il draft Pisa sostituisce roll, reroll e generazione automatica del primo pack. Il profilo <b>Giovani e belli</b> non è utilizzabile in questa sfida; tutti gli altri effetti restano attivi.</div></div><aside class="season-identity-preview"><div class="season-club-preview custom-preview" style="--club-primary:${pal.primary};--club-secondary:${pal.secondary};--club-accent:${pal.accent};--club-text:${pal.text}"><span class="season-club-preview-badge">PIS</span><div><small>Squadra dell’evento</small><b>Pisa</b><em id="setupPreviewCoach">Allenatore: ${esc(coachValue||'Nome allenatore')}</em><em class="season-preview-coach-type">Profilo: ${esc(coachProfile().name)}</em></div></div><div class="season-setup-tip secondary">La rosa iniziale sarà composta scegliendo 14 calciatori del Pisa: 11 titolari e 3 riserve.</div></aside></div></section>
   <section class="panel season-setup-step"><div class="season-setup-step-head"><span class="season-setup-step-number">3</span><div><h2>Scegli il modulo</h2><p>Gli undici slot determinano i ruoli da completare con i giocatori del Pisa.</p></div></div><div class="season-formation-grid">${formations.map(form=>`<button type="button" class="season-formation-btn ${state.formation===form?'active':''}" data-weekly-form="${form}"><b>${form}</b><small>${esc(formationPositionSummary(form))}</small></button>`).join('')}</div></section>
   <section class="panel season-setup-step"><div class="season-setup-step-head"><span class="season-setup-step-number">4</span><div><h2>Draft speciale Pisa</h2><p>Nessun roll e nessun reroll: compare subito tutta la rosa. Scegli personalmente 11 titolari e 3 panchinari.</p></div></div><div class="season-selected-summary"><span>🏁 Sfida della settimana</span><span>${state.gameMode==='chaos'?'🌀 Caos':'Normale'}</span><span>${esc(state.formation)}</span><span>Pisa</span><span>${esc(coachProfile().name)}</span></div><div class="season-step-actions"><button id="startWeeklyDraft" class="btn primary" type="button">Apri la rosa del Pisa →</button><a class="btn gold" href="sfida-settimana.html">Vedi la classifica</a></div></section>
  </div>`;
  const coachInput=document.getElementById('coachName');
  const storeCoach=()=>{state.coachName=String(coachInput?.value||'').trim();try{localStorage.setItem(SETUP_COACH_NAME_KEY,state.coachName)}catch{}save();const preview=document.getElementById('setupPreviewCoach');if(preview)preview.textContent=`Allenatore: ${state.coachName||'Nome allenatore'}`};
  coachInput?.addEventListener('input',()=>{clearTimeout(setupIdentitySaveTimer);setupIdentitySaveTimer=setTimeout(storeCoach,180)});
  document.querySelectorAll('[data-weekly-game-mode]').forEach(button=>button.onclick=()=>{state.gameMode=button.dataset.weeklyGameMode==='chaos'?'chaos':'normal';save();showSetup()});
  document.querySelectorAll('[data-weekly-form]').forEach(button=>button.onclick=()=>{state.formation=coachIs('three-five-two')?'3-5-2':String(button.dataset.weeklyForm||'4-3-3');save();showSetup()});
  const selectCoach=id=>{storeCoach();state.coachType=normalizeCoachType(id);syncCoachRestrictions();if(coachIs('three-five-two'))state.formation='3-5-2';try{localStorage.setItem(SETUP_COACH_TYPE_KEY,state.coachType)}catch{}save();showSetup()};
  document.querySelectorAll('[data-coach-type]').forEach(button=>{button.onclick=event=>{event.preventDefault();selectCoach(button.dataset.coachType)};button.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();button.click()}}});
  document.querySelectorAll('[data-coach-nav]').forEach(button=>button.onclick=event=>{event.preventDefault();const direction=Number(button.dataset.coachNav||0)||0,index=coachProfileIndex(),next=COACH_PROFILES[(index+direction+COACH_PROFILES.length)%COACH_PROFILES.length]||COACH_PROFILES[0];selectCoach(next.id)});
  document.getElementById('startWeeklyDraft').onclick=()=>{storeCoach();if(!state.coachName)return toast('Inserisci il nome dell’allenatore.');startWeeklyDraft()};
 };
 finishDraftPlacement=function(showPitchAnimation=false){
  state.draft.pendingPlayerId='';
  refreshWeeklyDraft();
  mobileDraftTab=showPitchAnimation?'field':(draftComplete()?'roster':'players');
  save();render();
  if(showPitchAnimation&&lastPlacedDraftSlotId){const placedId=lastPlacedDraftSlotId;lastPlacedDraftTimer=setTimeout(()=>{document.querySelectorAll('.season-field-slot.just-placed').forEach(element=>element.classList.remove('just-placed'));if(lastPlacedDraftSlotId===placedId)lastPlacedDraftSlotId='';lastPlacedDraftTimer=null},900)}
  if(draftComplete())toast('Rosa del Pisa completa: 11 titolari + 3 riserve.');
 };
 resetSeasonDraft=async function(){
  const confirmed=await openConfirm({title:'Azzera il draft',message:'I 14 giocatori scelti verranno rimossi. Allenatore e modulo resteranno invariati.',confirmText:'Azzera draft',danger:true});
  if(!confirmed)return;
  state.draft=freshState().draft;lastPlacedDraftSlotId='';mobileDraftTab='players';refreshWeeklyDraft();save();render();
 };
 backToSeasonSetup=async function(){
  if(state.draft?.roster?.length){const confirmed=await openConfirm({title:'Torna alla configurazione',message:'Il draft attuale verrà cancellato.',confirmText:'Torna indietro',danger:true});if(!confirmed)return}
  state.phase='setup';state.draft=freshState().draft;applyFixedIdentity();save();render();
 };
 const originalShowDraft=showDraft;
 showDraft=function(){
  refreshWeeklyDraft();
  originalShowDraft();
  const drawMini=document.querySelector('.season-draw-mini');if(drawMini)drawMini.textContent='Pisa';
  const drawNation=document.querySelector('.season-draw-nation');if(drawNation){drawNation.textContent='Rosa completa';drawNation.title='Rosa completa del Pisa'}
  const actions=document.querySelector('.season-roll-actions');if(actions){actions.innerHTML='<div class="season-weekly-draft-note"><b>Nessun roll o reroll</b><span>Scegli i tuoi 14 giocatori direttamente dalla rosa del Pisa.</span></div><button id="resetDraftBtnDesktop" class="season-roll-reset" type="button">↺ Reset draft</button>';document.getElementById('resetDraftBtnDesktop').onclick=resetSeasonDraft}
  const reroll=document.querySelector('.season-reroll-note');if(reroll)reroll.innerHTML='<b>11 titolari + 3 riserve.</b> Durante la stagione la rosa potrà cambiare normalmente tramite mercato, eventi, infortuni e altre regole.';
  const center=document.getElementById('draftRollBtnCenter');if(center){const banner=document.createElement('div');banner.className='season-weekly-draft-banner';banner.innerHTML='<strong>TRICOLORE COL PISA!</strong><span>Seleziona un giocatore dalla lista e assegnalo al campo o alla panchina.</span>';center.replaceWith(banner)}
  const help=document.querySelector('.season-pitch-help');if(help&&!state.draft.pendingPlayerId)help.textContent='Scegli un giocatore dalla rosa del Pisa, poi clicca uno slot compatibile del campo o della panchina.';
  const complete=document.querySelector('.season-draft-complete div');if(complete)complete.textContent='11 titolari e 3 riserve del Pisa pronti per la Sfida della settimana.';
 };
 applyFixedIdentity();
 if(state.phase==='draft')refreshWeeklyDraft();
 updateCompetitionChrome();
})();
