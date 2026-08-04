/* Fantaballa Season Engine — 10-events.js
 * Catalogo eventi data-driven, caricamento JSON e interfaccia di risoluzione.
 * La logica eseguibile è registrata in event-handlers.js.
 */
let AUTO_EVENTS=[];
let DECISIONS=[];
let SEASON_EVENT_CATALOG_REPORT={errors:[],warnings:[],stats:{autoEvents:0,decisions:0,choices:0}};

function validateSeasonEventCatalog(catalogs){
 const errors=[],warnings=[],auto=[],decisions=[];
 const validCatalogs=Array.isArray(catalogs)?catalogs:[];
 for(const catalog of validCatalogs){
  if(!catalog||Number(catalog.schemaVersion)!==1){errors.push('Catalogo eventi con schemaVersion non supportata.');continue}
  if(Array.isArray(catalog.autoEvents))auto.push(...catalog.autoEvents);else errors.push('Catalogo senza autoEvents valido.');
  if(Array.isArray(catalog.decisions))decisions.push(...catalog.decisions);else errors.push('Catalogo senza decisions valido.');
 }
 const autoIds=new Set(),autoOrders=new Set(),decisionIds=new Set(),orders=new Set();
 for(const item of auto){
  const id=String(item?.id||'').trim();
  if(!id)errors.push('Evento automatico senza id.');else if(autoIds.has(id))errors.push(`ID evento automatico duplicato: ${id}.`);else autoIds.add(id);
  if(!String(item?.title||'').trim())errors.push(`Evento automatico ${id||'?'} senza titolo.`);
  if(!String(item?.text||'').trim())errors.push(`Evento automatico ${id||'?'} senza testo.`);
  const autoOrder=Number(item?.order);if(!Number.isFinite(autoOrder))errors.push(`Evento automatico ${id||'?'} senza ordine numerico.`);else if(autoOrders.has(autoOrder))errors.push(`Ordine evento automatico duplicato: ${autoOrder}.`);else autoOrders.add(autoOrder);
  if(!SEASON_EVENT_HANDLERS.autoApply[item?.applyHandler])errors.push(`Handler automatico mancante: ${item?.applyHandler||'?'} (${id||'?'}).`);
 }
 for(const item of decisions){
  const id=String(item?.id||'').trim();
  if(!id)errors.push('Decisione senza id.');else if(decisionIds.has(id))errors.push(`ID decisione duplicato: ${id}.`);else decisionIds.add(id);
  const order=Number(item?.order);if(!Number.isFinite(order))errors.push(`Decisione ${id||'?'} senza ordine numerico.`);else if(orders.has(order))errors.push(`Ordine decisione duplicato: ${order}.`);else orders.add(order);
  if(!String(item?.title||'').trim()&&!item?.titleHandler)errors.push(`Decisione ${id||'?'} senza titolo.`);
  if(item?.titleHandler&&!SEASON_EVENT_HANDLERS.title[item.titleHandler])errors.push(`Handler titolo mancante: ${item.titleHandler} (${id||'?'}).`);
  if(item?.availableHandler&&!SEASON_EVENT_HANDLERS.available[item.availableHandler])errors.push(`Handler disponibilità mancante: ${item.availableHandler} (${id||'?'}).`);
  if(item?.describeHandler&&!SEASON_EVENT_HANDLERS.describe[item.describeHandler])errors.push(`Handler descrizione mancante: ${item.describeHandler} (${id||'?'}).`);
  if(item?.createContextHandler&&!SEASON_EVENT_HANDLERS.createContext[item.createContextHandler])errors.push(`Handler contesto mancante: ${item.createContextHandler} (${id||'?'}).`);
  if(!Array.isArray(item?.choices)||!item.choices.length)errors.push(`Decisione ${id||'?'} senza opzioni.`);
  for(const [index,choice] of (item?.choices||[]).entries()){
   if(!String(choice?.label||'').trim())errors.push(`Decisione ${id||'?'}: opzione ${index+1} senza etichetta.`);
   if(!String(choice?.effect||'').trim())warnings.push(`Decisione ${id||'?'}: opzione ${index+1} senza descrizione effetto.`);
   if(!SEASON_EVENT_HANDLERS.choiceApply[choice?.applyHandler])errors.push(`Handler scelta mancante: ${choice?.applyHandler||'?'} (${id||'?'} #${index+1}).`);
  }
 }
 return {errors,warnings,stats:{autoEvents:auto.length,decisions:decisions.length,choices:decisions.reduce((sum,item)=>sum+(item.choices?.length||0),0)}};
}
function buildAutoEventFromData(item){
 const apply=SEASON_EVENT_HANDLERS.autoApply[item.applyHandler];
 return {id:item.id,order:Number(item.order)||0,title:item.title,text:item.text,apply};
}
function buildDecisionFromData(item){
 const decision={id:item.id};
 for(const flag of ['questEvent','chainOnly','userOnly'])if(item[flag])decision[flag]=true;
 if(item.titleHandler){const getter=SEASON_EVENT_HANDLERS.title[item.titleHandler];Object.defineProperty(decision,'title',{enumerable:true,configurable:false,get(){return getter.call(decision)}})}else decision.title=item.title;
 if(Object.prototype.hasOwnProperty.call(item,'text'))decision.text=item.text;
 if(item.availableHandler)decision.available=SEASON_EVENT_HANDLERS.available[item.availableHandler];
 if(item.describeHandler)decision.describe=SEASON_EVENT_HANDLERS.describe[item.describeHandler];
 if(item.createContextHandler)decision.createContext=SEASON_EVENT_HANDLERS.createContext[item.createContextHandler];
 decision.visualCategory=item.visualCategory||item.eventCategory||'';
 decision.choices=(item.choices||[]).map(choice=>({label:choice.label,effect:choice.effect,visualCategory:choice.visualCategory||choice.eventCategory||choice.bgType||choice.backgroundType||choice.imageType||'',apply:SEASON_EVENT_HANDLERS.choiceApply[choice.applyHandler]}));
 return decision;
}
async function loadSeasonEventCatalog(){
 const mode=SEASON_CONFIG.mode==='real'?'real':'community';
 const commonBase=SEASON_CONFIG.events?.commonCatalog||'data/events/events-common.json';
 const commonPath=`${commonBase}${String(commonBase).includes('?')?'&':'?'}v=20260804-davide-golia-ovr1`;
 const modePath=SEASON_CONFIG.events?.modeCatalog||`data/events/events-${mode}.json`;
 const catalogs=await Promise.all([fetchJsonResource(commonPath,commonPath),fetchJsonResource(modePath,modePath)]);
 const report=validateSeasonEventCatalog(catalogs);SEASON_EVENT_CATALOG_REPORT=report;
 if(report.errors.length)throw Error(`Catalogo eventi non valido: ${report.errors.slice(0,12).join(' | ')}`);
 const autoData=catalogs.flatMap(catalog=>catalog.autoEvents||[]).filter(item=>item?.disabled!==true).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));
 const decisionData=catalogs.flatMap(catalog=>catalog.decisions||[]).filter(item=>item?.disabled!==true).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));
 AUTO_EVENTS=autoData.map(buildAutoEventFromData).filter(event=>!EXCLUDED_AUTO_EVENT_TITLES.has(String(event?.title||'')));
 DECISIONS=decisionData.map(buildDecisionFromData).filter(decision=>!EXCLUDED_DECISION_IDS.has(String(decision?.id||'')));
 return report;
}
const SEASON_EVENTS_READY=loadSeasonEventCatalog();

function decisionFromPending(event){
 if(!event)return null;
 return DECISIONS.find(decision=>decision.id===event.decisionId)||DECISIONS[event.decisionIndex]||null;
}
function applyDecisionChoice(decisionIndex,choiceIndex,context={},decisionId=''){
 const decision=DECISIONS.find(item=>item.id===decisionId)||DECISIONS[decisionIndex];
 const choice=decision?.choices?.[choiceIndex];
 if(!choice)return 'Scelta non disponibile.';
 const detail=choice.apply(context||{});
 const cyborgRestored=typeof cyborgRestoreProtectedRoster==='function'?cyborgRestoreProtectedRoster():[];
 if(String(decision?.id||'')==='generale-misterioso'){
  setAchievementCareerFlag('generalEventMatchday',Number(state.matchday)||0);
  setAchievementCareerFlag('generalWinStreak',0);
 }
 const cyborgNote=cyborgRestored.length?` Cyborg neutralizza il malus e ripristina l’OVR di ${cyborgRestored.length} ${cyborgRestored.length===1?'giocatore':'giocatori'}.`:'';
 return `Scelta: ${choice.label}. ${detail||choice.effect}${cyborgNote}`;
}
function prepareEvent(){
 if(state.phase!=='season'||state.pendingEvent)return;
 if(prepareError404StoryEvent()||prepareFantaballopoliStoryEvent()||prepareMeritStoryEvent()){save();return}
 questState().notice='';
 if(chaosEnabled())prepareChaosOpponentEvents();
 if(prepareChainedEvent()){save();return;}
 const multiplier=clamp((Number(state.seasonRules.eventChanceMultiplier)||1)*coachEventChanceFactor(),.25,2),normalChance=Math.max(0,1-(.45*multiplier)),autoLimit=normalChance+(.10*multiplier),roll=Math.random();
 if(roll<normalChance){
   state.pendingEvent={kind:'none',resolved:true,title:'Settimana normale',text:'Nessun evento particolare. La squadra pensa solo alla partita.'};
 }else if(roll<autoLimit){
   const event=pick(AUTO_EVENTS),before=analyticsSnapshot();
   const result=event.apply();
   recordSeasonEvent({kind:'auto',title:event.title,choice:'Evento automatico',effect:event.text,result,automatic:true},before);
   state.pendingEvent={kind:'auto',resolved:true,title:event.title,text:event.text,result};
 }else{
   const seen=new Set((state.seenDecisionEvents||[]).map(String));
   const available=DECISIONS.map((decision,index)=>({decision,index})).filter(item=>!item.decision.chainOnly&&!seen.has(item.decision.id)&&(!item.decision.available||item.decision.available()));
   if(!available.length){
     state.pendingEvent={kind:'none',resolved:true,title:'Settimana normale',text:'Gli imprevisti disponibili sono già comparsi: la squadra pensa solo alla partita.'};
   }else{
     const selected=pick(available),decision=selected.decision,decisionIndex=selected.index;
     const context=decision.createContext?decision.createContext():{};
     const eventTitle=typeof decision.title==='function'?decision.title(context):decision.title;
     const eventText=decision.describe?decision.describe(context):decision.text;
     state.seenDecisionEvents=[...seen,decision.id];
     if(state.seasonRules.autoDecisions){
       const choiceIndex=Math.floor(Math.random()*decision.choices.length),choice=decision.choices[choiceIndex],before=analyticsSnapshot();
       const result=applyDecisionChoice(decisionIndex,choiceIndex,context,decision.id);
       recordSeasonEvent({kind:'decision',title:eventTitle,choice:choice?.label||'',effect:choice?.effect||'',result,automatic:true},before);
       state.pendingEvent={kind:'decision',resolved:true,title:eventTitle,text:eventText,decisionId:decision.id,decisionIndex,context,result:`Decisione automatica. ${result}`};
     }else{
       state.pendingEvent={kind:'decision',resolved:false,title:eventTitle,text:eventText,decisionId:decision.id,decisionIndex,context};
     }
   }
 }
 save();
}
function resolveDecision(i){
 if(!state.pendingEvent||state.pendingEvent.resolved)return;
 const pendingDecision=decisionFromPending(state.pendingEvent);
 if(pendingDecision&&!state.seenDecisionEvents.includes(pendingDecision.id))state.seenDecisionEvents.push(pendingDecision.id);
 const choice=pendingDecision?.choices?.[i],before=analyticsSnapshot();
 state.pendingEvent.result=applyDecisionChoice(state.pendingEvent.decisionIndex,i,state.pendingEvent.context||{},state.pendingEvent.decisionId||'');
 recordSeasonEvent({kind:'decision',title:state.pendingEvent.title||pendingDecision?.title||'Decisione',choice:choice?.label||'',effect:choice?.effect||'',result:state.pendingEvent.result,automatic:false},before);
 state.pendingEvent.resolved=true;
 seasonEventMinimized=false;seasonEventUiKey='';
 save();
 render();
}
function setSeasonEventMinimized(minimized,{focus=true}={}){
 seasonEventMinimized=Boolean(minimized);
 const overlay=document.querySelector('.season-event-overlay'),dock=document.querySelector('.season-event-dock');
 if(overlay){
   overlay.hidden=seasonEventMinimized;
   overlay.classList.toggle('is-event-hidden',seasonEventMinimized);
   overlay.setAttribute('aria-hidden',seasonEventMinimized?'true':'false');
   overlay.style.setProperty('display',seasonEventMinimized?'none':'grid','important');
 }
 if(dock){
   dock.hidden=!seasonEventMinimized;
   dock.classList.toggle('is-event-hidden',!seasonEventMinimized);
   dock.classList.toggle('is-event-visible',seasonEventMinimized);
   dock.setAttribute('aria-hidden',seasonEventMinimized?'false':'true');
   dock.style.setProperty('display',seasonEventMinimized?'block':'none','important');
 }
 if(!focus)return;
 const target=seasonEventMinimized?dock?.querySelector('[data-event-expand]'):overlay?.querySelector('[data-event-minimize]');
 try{target?.focus({preventScroll:true})}catch{target?.focus()}
}
function bindSeasonEventControls(){
 const minimize=document.querySelector('[data-event-minimize]'),expand=document.querySelector('[data-event-expand]');
 if(minimize)minimize.onclick=event=>{
   event.preventDefault();
   event.stopPropagation();
   setSeasonEventMinimized(true);
 };
 if(expand)expand.onclick=event=>{
   event.preventDefault();
   event.stopPropagation();
   setSeasonEventMinimized(false);
 };
 const skipWithWhistle=document.querySelector('[data-skip-event-with-whistle]');
 if(skipWithWhistle)skipWithWhistle.onclick=event=>{
   event.preventDefault();event.stopPropagation();
   const message=useCollinaWhistleToSkipEvent();save();render();toast(message);
 };
 /* Allinea sempre DOM e variabile, anche sui browser che ignorano [hidden]. */
 setSeasonEventMinimized(seasonEventMinimized,{focus:false});
}
function renderResolvedSeasonEventCard(e,{label='Settimana',notice=''}={}){
 const title=String(e?.title||'Evento risolto').trim();
 const description=String(e?.text||'').trim();
 const result=String(e?.result||description||'Evento concluso.').trim();
 const descriptionHtml=description&&description!==result?`<p>${esc(description)}</p>`:'';
 const noticeHtml=notice?`<div class="quest-notice">${esc(notice)}</div>`:'';
 return `<details class="season-event-result-card"><summary><span class="season-event-result-main"><span class="season-event-result-kicker">Risultato della scelta</span><strong>${esc(result)}</strong></span><span class="season-event-result-toggle" aria-hidden="true"><span class="season-event-result-toggle-closed">Dettagli +</span><span class="season-event-result-toggle-open">Riduci −</span></span></summary><div class="season-event-result-details"><div class="label">${esc(label)}</div><h3>${esc(title)}</h3>${descriptionHtml}${noticeHtml}</div></details>`;
}
function renderEvent(){
 const e=state.pendingEvent;
 if(!e)return'';
 if(e.kind==='storyError404'&&!e.resolved)return renderError404StoryEvent(e);
 if(e.kind==='storyError404')return renderResolvedSeasonEventCard(e,{label:'Storia'});
 if(e.kind==='storyFantaballopoli'&&!e.resolved)return renderFantaballopoliEvent(e);
 if(e.kind==='storyFantaballopoli')return renderResolvedSeasonEventCard(e,{label:'Storia'});
 if(e.kind==='storyMerit'&&!e.resolved)return renderMeritStoryEvent(e);
 if(e.kind==='storyMerit')return renderResolvedSeasonEventCard(e,{label:'Storia'});
 if(e.kind==='decision'&&!e.resolved){
   const d=decisionFromPending(e);
   if(!d)return'';
   const eventLabel=d.questEvent?'Evento quest':(e.chained?'Evento concatenato':'Decisione casuale · evento unico');
   const eventKey=JSON.stringify([e.decisionId||'',e.decisionIndex??'',e.title||'',e.text||'',state.matchday,e.chained||false,e.context||{}]);
   if(seasonEventUiKey!==eventKey){seasonEventUiKey=eventKey;seasonEventMinimized=false}
   const choices=d.choices.map((c,i)=>{
     const tone=i%2===0?'blue':'red';
     const visual=(globalThis.SEASON_EVENT_VISUALS&&typeof globalThis.SEASON_EVENT_VISUALS.get==='function')
       ? globalThis.SEASON_EVENT_VISUALS.get({event:{title:e.title,text:e.text,visualCategory:d.visualCategory||e.visualCategory||''},choice:c,tone,fallbackCategory:tone==='red'?'rischio':'campo'})
       : {category:tone==='red'?'rischio':'campo',label:tone==='red'?'Rischio':'Campo',asset:''};
     const art=visual?.asset?` style="--event-art:url('${esc(visual.asset)}')"`:'';
     const visualClass=visual?.category?` event-visual-${visual.category}`:'';
     return `<div class="season-event-choice-float"><button class="choice season-event-choice ${tone==='blue'?'tone-blue':'tone-red'}${visualClass}"${art} data-choice="${i}" type="button"><div class="season-event-choice-top"><span class="season-event-option-label">Opzione ${String.fromCharCode(65+i)}</span><span class="season-event-choice-theme">${esc(visual?.label||'Evento')}</span></div><b>${esc(c.label)}</b><small>${esc(c.effect)}</small></button></div>`;
   }).join('');
   const whistleQuantity=typeof seasonItemQuantity==='function'?seasonItemQuantity('collina-whistle'):0,canWhistle=typeof collinaWhistleCanSkipEvent==='function'&&collinaWhistleCanSkipEvent(e);
   const whistleAction=canWhistle?`<button class="season-event-whistle" data-skip-event-with-whistle type="button"><span aria-hidden="true">◉</span><b>Usa il Fischietto di Collina</b><small>Salta questo evento senza applicare nessuna scelta · disponibile x${whistleQuantity}</small></button>`:'';
   return `<div class="season-event-overlay" role="presentation" ${seasonEventMinimized?'hidden':''}><section class="season-event-dialog" role="dialog" aria-modal="true" aria-labelledby="seasonEventTitle" aria-describedby="seasonEventCopy"><button class="season-event-minimize" data-event-minimize type="button" aria-label="Riduci l’evento e consulta la pagina">━ Riduci</button><div class="season-event-head"><div class="season-event-kicker">${esc(eventLabel)}</div><h2 class="season-event-title" id="seasonEventTitle">${esc(e.title)}</h2><p class="season-event-copy" id="seasonEventCopy">${esc(e.text)}</p></div><div class="choice-grid season-event-choice-grid">${choices}</div>${whistleAction}<p class="season-event-hint">Riduci il box per consultare Rosa, Classifica, Calendario e Statistiche; potrai riaprirlo in qualsiasi momento.</p></section></div><aside class="season-event-dock" ${seasonEventMinimized?'':'hidden'} aria-label="Evento in attesa di una decisione"><button class="season-event-dock-button" data-event-expand type="button"><span class="season-event-dock-pulse" aria-hidden="true"></span><span class="season-event-dock-copy"><span>Evento in attesa</span><b>${esc(e.title)}</b></span><span class="season-event-dock-open">Riapri ↑</span></button></aside>`;
 }
 const notice=questState().notice;
 return renderResolvedSeasonEventCard(e,{label:e.chained?'Evento concatenato':(e.kind==='auto'?'Evento casuale':'Settimana'),notice});
}
