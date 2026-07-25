/* Classifica dedicata — Sfida della settimana */
(function(global){
 'use strict';

 const ENDPOINT='https://script.google.com/macros/s/AKfycbwadjpez_e-IXMLupqpISLEZ3rrHhrtF9gk_E9v9HB_YcgkXUneOnrW7iYAdGjqz3_G/exec';
 const LOCAL_FALLBACK='data/classifica-settimana.json';
 const CACHE_KEY='fantaballa_sfida_settimana_classifica_cache_v2';
 const MESSAGE_TYPE='fantaballa-classifica-response-v1';

 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
 const valueOf=(row,keys,fallback='')=>{for(const key of keys){if(row&&row[key]!==undefined&&row[key]!==null&&String(row[key]).trim()!=='')return row[key]}return fallback};
 const numberOf=(row,keys,fallback=0)=>{const value=Number(valueOf(row,keys,fallback));return Number.isFinite(value)?value:fallback};
 const normalize=value=>String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s-]+/g,'_').replace(/_+/g,'_');
 const extractRows=data=>{
  if(Array.isArray(data))return data;
  if(data&&Array.isArray(data.classifica))return data.classifica;
  if(data&&Array.isArray(data.rows))return data.rows;
  if(data&&Array.isArray(data.results))return data.results;
  if(data&&data.data&&Array.isArray(data.data.classifica))return data.data.classifica;
  if(data&&Array.isArray(data.data))return data.data;
  return [];
 };
 function isWeekly(row){
  const type=normalize(valueOf(row,['modalita_tipo','modalitaTipo','modeType','mode_type'],''));
  const mode=normalize(valueOf(row,['modalita','gameMode','mode','competition'],''));
  const code=normalize(valueOf(row,['codice_vittoria','victoryCode','submissionCode','submission_code'],''));
  if(['sfida_settimana','weekly_pisa','tricolore_pisa','sfida_settimana_pisa'].includes(type))return true;
  if(/(^|_)(sfida_settimana|sfida_della_settimana|weekly_pisa|tricolore_pisa|tricolore_col_pisa)($|_)/.test(mode))return true;
  if(/^sfida_settimana_pisa_/.test(code)||/^sfida_settimana_pisa-/.test(code))return true;
  return false;
 }
 function rowView(row,index){
  return {
   sourceIndex:index,
   name:String(valueOf(row,['squadra','nome_squadra','teamName','team_name'],'Pisa')),
   coach:String(valueOf(row,['allenatore','coachName','coach_name','nome_allenatore','coach'],'')),
   position:numberOf(row,['posizione_finale','piazzamento_finale','finalPosition','final_position'],0),
   points:numberOf(row,['punti','points','pts'],0),
   wins:numberOf(row,['vittorie','wins'],0),
   draws:numberOf(row,['pareggi','draws'],0),
   losses:numberOf(row,['sconfitte','losses'],0),
   gf:numberOf(row,['gol_fatti','golFatti','goalsFor','gf'],0),
   ga:numberOf(row,['gol_subiti','golSubiti','goalsAgainst','ga'],0),
   ovr:numberOf(row,['ovr_medio','avgOvr','averageOvr','overall'],0),
   scorer:String(valueOf(row,['capocannoniere_giocatore','capocannoniereGiocatore','capocannoniere','topScorer','userTopScorer'],'—'))
  };
 }
 function compare(a,b){return b.points-a.points||((b.gf-b.ga)-(a.gf-a.ga))||b.wins-a.wins||b.gf-a.gf||(a.position||99)-(b.position||99)||a.coach.localeCompare(b.coach,'it')}
 function bestPerCoach(rows){
  const map=new Map();
  rows.forEach(row=>{const coachKey=normalize(row.coach),key=coachKey||`anonimo_${row.sourceIndex}`;const current=map.get(key);if(!current||compare(row,current)<0)map.set(key,row)});
  return [...map.values()].sort(compare);
 }
 function validData(data){return extractRows(data).length>=0&&(Array.isArray(data)||Boolean(data&&typeof data==='object'))}

 const api=Object.freeze({extractRows,isWeekly,rowView,compare,bestPerCoach,normalize});
 global.FANTABALLA_WEEKLY_LEADERBOARD=api;
 if(typeof document==='undefined')return;

 const body=document.getElementById('body');
 const status=document.getElementById('status');
 const refresh=document.getElementById('refresh');
 if(!body||!status||!refresh)return;
 let loadInProgress=false;

 function render(data,label='online'){
  const raw=extractRows(data);
  const weeklyRaw=raw.filter(isWeekly);
  const rows=bestPerCoach(weeklyRaw.map(rowView));
  if(!rows.length){
   body.innerHTML='<tr><td colspan="9" class="empty">Non ci sono ancora risultati registrati per Tricolore col Pisa!</td></tr>';
   status.textContent=raw.length
    ? `Google Sheets ha restituito ${raw.length} risultati, ma nessuno è marcato come “Sfida della settimana”. Aggiorna il Google Apps Script incluso nel progetto.`
    : 'In attesa del primo risultato';
   return {rawCount:raw.length,weeklyCount:0};
  }
  body.innerHTML=rows.map((row,index)=>`<tr class="${index<10?'top10':''}"><td><span class="rank">${index+1}</span></td><td class="team"><b>${esc(row.name)}${index<10?'<span class="prize">+2 OVR</span>':''}</b><small>${esc(row.coach||'Allenatore non indicato')}</small></td><td>${row.position?`${row.position}°`:'—'}</td><td><b>${row.points}</b></td><td>${row.wins}-${row.draws}-${row.losses}</td><td>${row.gf}/${row.ga}</td><td>${row.gf-row.ga>=0?'+':''}${row.gf-row.ga}</td><td>${row.ovr||'—'}</td><td>${esc(row.scorer||'—')}</td></tr>`).join('');
  status.textContent=`${rows.length} allenatori in classifica · migliore risultato per ciascuno · fonte ${label}`;
  return {rawCount:raw.length,weeklyCount:rows.length};
 }
 function endpointUrl(params={}){
  const url=new URL(ENDPOINT,window.location.href);
  Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,String(value)));
  url.searchParams.set('_fb',`${Date.now()}_${Math.floor(Math.random()*1000000)}`);
  return url.toString();
 }
 function saveCache(data){
  if(!validData(data))return;
  try{localStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:new Date().toISOString(),data}))}catch(error){console.warn('Cache Sfida della settimana non salvata:',error)}
 }
 function loadCache(){
  try{const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');return cached&&validData(cached.data)?cached:null}catch{return null}
 }
 function googleOrigin(origin){return /^https:\/\/([a-z0-9-]+\.)*(google\.com|googleusercontent\.com)$/i.test(String(origin||''))}
 function loadFetch(timeoutMs=10000){
  return new Promise((resolve,reject)=>{
   const controller=typeof AbortController==='function'?new AbortController():null;
   const timer=setTimeout(()=>{if(controller)controller.abort();reject(new Error('Timeout fetch'))},timeoutMs);
   fetch(endpointUrl({transport:'json',modalita_tipo:'sfida_settimana'}),{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'follow',signal:controller?controller.signal:undefined})
    .then(async response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);const text=await response.text();let data;try{data=JSON.parse(text)}catch{throw new Error('JSON non valido')}if(!validData(data))throw new Error('Risposta non valida');clearTimeout(timer);resolve(data)})
    .catch(error=>{clearTimeout(timer);reject(error&&error.name==='AbortError'?new Error('Timeout fetch'):error)});
  });
 }
 function loadJsonp(timeoutMs=17000){
  return new Promise((resolve,reject)=>{
   const callback=`weeklyPisaLeaderboard_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
   const script=document.createElement('script');
   let settled=false;
   script.async=true;
   script.referrerPolicy='no-referrer';
   script.dataset.weeklyLeaderboard='jsonp';
   function cleanup(){clearTimeout(timer);try{delete window[callback]}catch{window[callback]=undefined}if(script.parentNode)script.parentNode.removeChild(script)}
   function finish(handler,value){if(settled)return;settled=true;cleanup();handler(value)}
   const timer=setTimeout(()=>finish(reject,new Error('Timeout JSONP')),timeoutMs);
   window[callback]=data=>{if(!validData(data)){finish(reject,new Error('Risposta JSONP non valida'));return}finish(resolve,data)};
   script.onerror=()=>finish(reject,new Error('JSONP bloccato'));
   script.src=endpointUrl({callback,transport:'jsonp',modalita_tipo:'sfida_settimana'});
   document.body.appendChild(script);
  });
 }
 function loadIframe(timeoutMs=19000){
  return new Promise((resolve,reject)=>{
   const requestId=`weekly_iframe_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
   const iframe=document.createElement('iframe');
   let settled=false;
   iframe.dataset.weeklyLeaderboard='iframe';
   iframe.setAttribute('aria-hidden','true');
   iframe.tabIndex=-1;
   iframe.style.cssText='position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none';
   function cleanup(){clearTimeout(timer);window.removeEventListener('message',onMessage);if(iframe.parentNode)iframe.parentNode.removeChild(iframe)}
   function finish(handler,value){if(settled)return;settled=true;cleanup();handler(value)}
   function onMessage(event){const payload=event&&event.data;if(!payload||payload.type!==MESSAGE_TYPE||payload.requestId!==requestId)return;if(!googleOrigin(event.origin))return;if(!validData(payload.data)){finish(reject,new Error('Risposta iframe non valida'));return}finish(resolve,payload.data)}
   const timer=setTimeout(()=>finish(reject,new Error('Timeout iframe')),timeoutMs);
   window.addEventListener('message',onMessage);
   iframe.onerror=()=>finish(reject,new Error('Iframe bloccato'));
   iframe.src=endpointUrl({transport:'iframe',requestId,modalita_tipo:'sfida_settimana'});
   document.body.appendChild(iframe);
  });
 }
 function firstSuccessful(promises){
  return new Promise((resolve,reject)=>{
   let pending=promises.length;const errors=[];
   promises.forEach((promise,index)=>Promise.resolve(promise).then(resolve).catch(error=>{errors[index]=error;pending-=1;if(!pending)reject(new Error(errors.map(item=>item&&item.message).filter(Boolean).join(' | ')||'Google Sheets non raggiungibile'))}));
  });
 }
 async function loadFallback(){
  const cached=loadCache();
  if(cached){render(cached.data,'ultima copia online');status.textContent+=` · cache ${new Date(cached.savedAt).toLocaleString('it-IT')}`;return}
  try{const response=await fetch(`${LOCAL_FALLBACK}?v=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error('Fallback non disponibile');render(await response.json(),'backup locale')}catch{body.innerHTML='<tr><td colspan="9" class="empty">Impossibile caricare i dati online. Riprova tra poco.</td></tr>';status.textContent='Classifica non raggiungibile'}
 }
 async function load(){
  if(loadInProgress)return;
  loadInProgress=true;refresh.disabled=true;status.textContent='Aggiornamento in corso…';
  document.querySelectorAll('[data-weekly-leaderboard]').forEach(node=>node.remove());
  try{
   const data=await firstSuccessful([loadFetch(10000),loadJsonp(17000),loadIframe(19000)]);
   saveCache(data);
   render(data,'Google Sheets');
  }catch(error){console.warn('Sfida della settimana non raggiungibile:',error);await loadFallback()}
  finally{loadInProgress=false;refresh.disabled=false}
 }
 refresh.addEventListener('click',load);
 window.addEventListener('online',load);
 load();
})(typeof window!=='undefined'?window:globalThis);
