/* Classifica dedicata — Sfida della settimana */
(function(){
 const ENDPOINT='https://script.google.com/macros/s/AKfycbwadjpez_e-IXMLupqpISLEZ3rrHhrtF9gk_E9v9HB_YcgkXUneOnrW7iYAdGjqz3_G/exec';
 const LOCAL_FALLBACK='data/classifica-settimana.json';
 const body=document.getElementById('body'),status=document.getElementById('status'),refresh=document.getElementById('refresh');
 if(!body||!status||!refresh)return;
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
 const valueOf=(row,keys,fallback='')=>{for(const key of keys){if(row&&row[key]!==undefined&&row[key]!==null&&String(row[key]).trim()!=='')return row[key]}return fallback};
 const numberOf=(row,keys,fallback=0)=>{const value=Number(valueOf(row,keys,fallback));return Number.isFinite(value)?value:fallback};
 const normalize=value=>String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
 function isWeekly(row){
  const type=String(valueOf(row,['modalita_tipo','modalitaTipo','modeType'],'')).toLowerCase().replace(/[\s-]+/g,'_');
  const mode=String(valueOf(row,['modalita','gameMode','mode'],'')).toLowerCase();
  return ['sfida_settimana','weekly_pisa','tricolore_pisa'].includes(type)||/sfida della settimana|tricolore col pisa/.test(mode);
 }
 function rowView(row,index){
  return {sourceIndex:index,name:String(valueOf(row,['squadra','nome_squadra','teamName'],'Pisa')),coach:String(valueOf(row,['allenatore','coachName','coach_name'],'')),position:numberOf(row,['posizione_finale','finalPosition'],0),points:numberOf(row,['punti','points','pts'],0),wins:numberOf(row,['vittorie','wins'],0),draws:numberOf(row,['pareggi','draws'],0),losses:numberOf(row,['sconfitte','losses'],0),gf:numberOf(row,['gol_fatti','goalsFor','gf'],0),ga:numberOf(row,['gol_subiti','goalsAgainst','ga'],0),ovr:numberOf(row,['ovr_medio','avgOvr','averageOvr'],0),scorer:String(valueOf(row,['capocannoniere_giocatore','capocannoniere','topScorer'],'—'))};
 }
 function compare(a,b){return b.points-a.points||((b.gf-b.ga)-(a.gf-a.ga))||b.wins-a.wins||b.gf-a.gf||(a.position||99)-(b.position||99)||a.coach.localeCompare(b.coach,'it')}
 function bestPerCoach(rows){
  const map=new Map();
  rows.forEach(row=>{const coachKey=normalize(row.coach),key=coachKey||`anonimo-${row.sourceIndex}`;const current=map.get(key);if(!current||compare(row,current)<0)map.set(key,row)});
  return [...map.values()].sort(compare);
 }
 function render(data,label='online'){
  const raw=Array.isArray(data)?data:Array.isArray(data?.classifica)?data.classifica:[];
  const rows=bestPerCoach(raw.filter(isWeekly).map(rowView));
  if(!rows.length){body.innerHTML='<tr><td colspan="9" class="empty">Non ci sono ancora risultati registrati per Tricolore col Pisa!</td></tr>';status.textContent='In attesa del primo risultato';return}
  body.innerHTML=rows.map((row,index)=>`<tr class="${index<10?'top10':''}"><td><span class="rank">${index+1}</span></td><td class="team"><b>${esc(row.name)}${index<10?'<span class="prize">+2 OVR</span>':''}</b><small>${esc(row.coach||'Allenatore non indicato')}</small></td><td>${row.position?`${row.position}°`:'—'}</td><td><b>${row.points}</b></td><td>${row.wins}-${row.draws}-${row.losses}</td><td>${row.gf}/${row.ga}</td><td>${row.gf-row.ga>=0?'+':''}${row.gf-row.ga}</td><td>${row.ovr||'—'}</td><td>${esc(row.scorer||'—')}</td></tr>`).join('');
  status.textContent=`${rows.length} allenatori in classifica · migliore risultato per ciascuno · fonte ${label}`;
 }
 async function loadFallback(){
  try{const response=await fetch(`${LOCAL_FALLBACK}?v=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error('Fallback non disponibile');render(await response.json(),'backup locale')}catch{body.innerHTML='<tr><td colspan="9" class="empty">Impossibile caricare i dati online. Riprova tra poco.</td></tr>';status.textContent='Classifica non raggiungibile'}
 }
 function load(){
  refresh.disabled=true;status.textContent='Aggiornamento in corso…';
  const callback=`weeklyPisaLeaderboard_${Date.now()}_${Math.floor(Math.random()*1e6)}`,script=document.createElement('script');let settled=false;
  const timer=setTimeout(()=>finish(new Error('Timeout')),16000);
  function cleanup(){clearTimeout(timer);try{delete window[callback]}catch{window[callback]=undefined}script.remove();refresh.disabled=false}
  function finish(error,data){if(settled)return;settled=true;cleanup();if(error){loadFallback();return}render(data,'Google Sheets')}
  window[callback]=data=>finish(null,data);script.onerror=()=>finish(new Error('Errore rete'));
  script.src=`${ENDPOINT}?callback=${encodeURIComponent(callback)}&transport=jsonp&_fb=${Date.now()}`;document.body.appendChild(script);
 }
 refresh.addEventListener('click',load);load();
})();
