(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  const world=params.get('universo')==='gothamcity'?'gothamcity':'fantaballafc';
  const gotham=world==='gothamcity';
  const team=gotham?'Gotham City':'Fantaballa FC';
  const prefix=world+'/';
  const $=id=>document.getElementById(id);
  const htmlEsc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const trimClub=s=>String(s||'').replace(/^Futbol Club /,'').replace(/^FC /,'').replace(/^A\.S\. /,'').replace(/^A\.C\. /,'').replace(/^Sport Lisboa e /,'').replace(/ Football Club$/,'').replace(/ Hotspur$/,'').replace(/ Saint-Germain FC$/,' SG');
  const validColor=s=>/^#[0-9a-f]{6}$/i.test(s||'')?s:'#3b7ca5';
  const shortDate=s=>s&&/^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8,10)+'/'+s.slice(5,7):'—';
  const fullDate=s=>{if(!s)return'—';const d=new Date(s+'T12:00:00');return Number.isNaN(d.valueOf())?s:new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);};
  const readableDate=s=>{if(!s)return'—';const d=new Date(s+'T12:00:00');return Number.isNaN(d.valueOf())?s:new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'short',year:'numeric'}).format(d);};
  const matchDayDiff=(a,b)=>a&&b?Math.round((Date.parse(b+'T12:00:00')-Date.parse(a+'T12:00:00'))/86400000):null;
  const defaults={fantacalcio:'fantacalcio.html',results:'campionato.html?tab=results',calendar:'campionato.html?tab=upcoming',standings:'campionato.html?tab=standings',stats:'campionato.html?tab=stats',database:'scouting.html'};
  const links=Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,prefix+v]));
  document.querySelectorAll('[data-link]').forEach(el=>{const to=links[el.dataset.link];if(to)el.href=to;});
  $('worldFc').classList.toggle('selected',!gotham);
  $('worldGc').classList.toggle('selected',gotham);
  $('worldFc').setAttribute('aria-current',gotham?'false':'page');
  $('worldGc').setAttribute('aria-current',gotham?'page':'false');
  document.querySelector('.nav-item.active').href='?universo='+world;
  document.body.dataset.league=gotham?'gotham':'fantaballa';
  $('brandCrest').textContent=gotham?'GC':'FB';
  $('brandLink').href='?universo='+world;
  $('topSubline').textContent=team.toUpperCase()+' · SUPER LEGA';
  $('introWorld').textContent=team.toUpperCase();
  $('mvTeamCaption').textContent='Solo giocatori '+team;
  $('scorerTeamCaption').textContent='Solo giocatori '+team;
  document.title='Dashboard '+team+' · Fantaballa Universe';
  const menu=$('sidebar'),backdrop=$('menuBackdrop'),toggle=$('menuButton');
  function setMenu(open){menu.classList.toggle('open',open);backdrop.hidden=!open;toggle.setAttribute('aria-expanded',String(open));}
  toggle.addEventListener('click',()=>setMenu(!menu.classList.contains('open')));
  backdrop.addEventListener('click',()=>setMenu(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
  let metadata=null,fixtures=[],standings=[],players=[],clubMap=new Map(),ourGames=[],upcoming=[],visibleIndex=0;
  function dot(name){return `<span class="kit-dot" style="--dot:${validColor(clubMap.get(name)?.kit?.colors?.[0])}" aria-hidden="true"></span>`;}
  function lastFixture(m){return String(m.date||'')+' '+String(m.kick_off_time||'');}
  function loadMessage(msg){for(const id of ['standingsRows','resultsRows','ratingRows','scorerRows']) $(id).innerHTML=`<div class="load-placeholder">${htmlEsc(msg)}</div>`;}
  function setHeader(){
    const season=metadata?.season!=null?`${metadata.season}/${String(Number(metadata.season)+1).slice(-2)}`:'—';
    $('seasonPill').textContent=season;
    $('gameDate').textContent=readableDate(metadata?.saveDate);
    $('dataInfo').textContent=`${metadata?.clubs||standings.length} SQUADRE · ${(metadata?.players||players.length).toLocaleString('it-IT')} GIOCATORI`;
    $('competitionLeft').textContent=metadata?.competition||'Campionato';
    $('competitionCenter').textContent=metadata?.competition||'Campionato';
    $('saveReference').textContent='SAVE '+readableDate(metadata?.saveDate);
    $('sourceFooter').textContent=`Fonte: ${metadata?.source||'Salvataggio Football Manager'} · Data nel gioco: ${readableDate(metadata?.saveDate)} · Statistiche non in tempo reale.`;
  }
  function drawStandings(){
    const body=$('standingsRows');
    $('standingsCount').textContent=standings.length+' squadre';
    if(!standings.length){body.innerHTML='<tr><td colspan="5" class="load-placeholder">Classifica non disponibile.</td></tr>';return;}
    body.innerHTML=[...standings].sort((a,b)=>Number(a.position||999)-Number(b.position||999)).map(row=>{
      const mine=row.club===team;
      const gd=Number(row.goalsFor||0)-Number(row.goalsAgainst||0);
      return `<tr class="${mine?'ours':''}"><td>${row.position||'—'}°</td><td><div class="team-cell">${dot(row.club)}<span class="truncate" title="${htmlEsc(row.club)}">${htmlEsc(trimClub(row.club))}</span></div></td><td>${Number(row.played||0)}</td><td>${gd>0?'+':''}${gd}</td><td>${Number(row.points||0)}</td></tr>`;
    }).join('');
    const mineRow=[...body.querySelectorAll('tr')].find(x=>x.classList.contains('ours'));
    // Il club selezionato resta evidenziato ma lo scroll iniziale mostra la prima posizione.
  }
  function resultKind(f){
    const home=f.home_club_name===team;
    const mine=Number(home?f.home_goals:f.away_goals),theirs=Number(home?f.away_goals:f.home_goals);
    return mine>theirs?'win':mine===theirs?'draw':'loss';
  }
  function drawResults(){
    const played=ourGames.filter(f=>f.played).sort((a,b)=>lastFixture(b).localeCompare(lastFixture(a)));
    $('resultsCount').textContent=played.length+' gare';
    $('resultsLabel').textContent='Ultimi incontri di '+team;
    if(!played.length){$('resultsRows').innerHTML='<div class="load-placeholder">Nessuna partita disputata nel salvataggio.</div>';return;}
    $('resultsRows').innerHTML=played.map(f=>{
      const isHome=f.home_club_name===team;
      const opponent=isHome?f.away_club_name:f.home_club_name;
      const kind=resultKind(f);
      // Il punteggio viene mostrato dal punto di vista della squadra selezionata.
      const goals=isHome?f.home_goals:f.away_goals,against=isHome?f.away_goals:f.home_goals;
      return `<div class="result-row" title="${htmlEsc(f.home_club_name)} ${f.home_goals}-${f.away_goals} ${htmlEsc(f.away_club_name)}"><span class="result-date">${shortDate(f.date)}</span><span class="home-away">${isHome?'C':'T'}</span><span class="result-opponent">${dot(opponent)}<span title="${htmlEsc(opponent)}">${htmlEsc(trimClub(opponent))}</span></span><span class="result-pill ${kind}">${goals} - ${against}</span><span class="result-indicator ${kind}" aria-label="${kind==='win'?'Vittoria':kind==='draw'?'Pareggio':'Sconfitta'}"></span></div>`;
    }).join('');
    const form=played.slice(0,5).reverse();
    $('recentForm').innerHTML=form.map(f=>{const kind=resultKind(f);return `<span class="form-dot ${kind}" title="${htmlEsc(f.away_club_name)} / ${htmlEsc(f.home_club_name)}">${kind==='win'?'V':kind==='draw'?'P':'S'}</span>`;}).join('');
  }
  function makeShield(nodeName,name){
    const el=$(nodeName),own=name===team;
    const kit=clubMap.get(name)?.kit?.colors||[];
    const fallback=own?(gotham?['#6c55b3','#22183f']:['#d7353e','#121827']):['#26618e','#0c213c'];
    el.style.setProperty('--badge-a',validColor(kit[0]||fallback[0]));
    el.style.setProperty('--badge-b',validColor(kit[1]||fallback[1]));
    el.classList.toggle('own-team',own);
    const lower=String(name||'').toLowerCase();
    el.textContent=own?(gotham?'GC':'FB'):lower.includes('barcelona')?'BAR':lower.includes('tottenham')?'TOT':String(trimClub(name)||'?').split(/\s+/).filter(x=>!/^(FC|CF|AC|AFC|AS|Club|de|da|e)$/i.test(x)).slice(0,2).map(s=>s[0]).join('').toUpperCase().slice(0,3)||'FC';
  }
  function drawUpcoming(){
    const current=upcoming[visibleIndex];
    $('previousFixture').disabled=visibleIndex<=0;
    $('nextFixture').disabled=visibleIndex>=upcoming.length-1;
    $('fixtureStep').textContent=upcoming.length?String(visibleIndex+1).padStart(2,'0')+' / '+String(upcoming.length).padStart(2,'0'):'—';
    $('fixtureHeading').textContent=visibleIndex===0?'PROSSIMA PARTITA':'PARTITA IN CALENDARIO';
    if(!current){
      $('matchDate').textContent='NESSUNA PARTITA FUTURA';
      $('matchCountdown').textContent='Calendario del salvataggio terminato';
      $('homeLabel').textContent=team; $('awayLabel').textContent='—';
      $('matchTitle').textContent='CALENDARIO COMPLETATO';
      $('matchRound').textContent='CAMPIONATO';$('matchVenue').textContent='NESSUNA GARA DA GIOCARE';
      makeShield('homeShield',team);makeShield('awayShield','—');return;
    }
    $('matchDate').textContent=fullDate(current.date);
    const days=matchDayDiff(metadata?.saveDate,current.date);
    $('matchCountdown').textContent=days!=null?(days===0?'Oggi nel gioco':days>0?`Tra ${days} ${days===1?'giorno':'giorni'} (nel gioco)`:'Partita in calendario'):'Data di gioco';
    $('homeLabel').textContent=trimClub(current.home_club_name);
    $('awayLabel').textContent=trimClub(current.away_club_name);
    $('matchTitle').textContent=trimClub(current.home_club_name)+' — '+trimClub(current.away_club_name);
    $('matchRound').textContent=current.round_index!=null?'GIORNATA '+(Number(current.round_index)+1):'GIORNATA DA DEFINIRE';
    $('matchVenue').textContent=current.home_club_name===team?'IN CASA':'IN TRASFERTA';
    makeShield('homeShield',current.home_club_name);
    makeShield('awayShield',current.away_club_name);
    $('calendarAction').href=prefix+'campionato.html?tab=upcoming&team='+encodeURIComponent(team);
  }
  function getStat(p,key){return p.leagueStats?.[key]??null;}
  function clubPlayers(){return players.filter(p=>p.club===team);}
  function drawRatings(){
    const teamPlayers=clubPlayers();
    // Filtriamo i giocatori con almeno il 25% delle presenze possibili con voto,
    // per non mettere in testa una singola ottima gara. Fonte MV FM, non fantamedia completa.
    const played=ourGames.filter(f=>f.played).length;
    const minRated=Math.max(2,Math.ceil(played*0.25));
    let scored=teamPlayers.filter(p=>Number.isFinite(Number(getStat(p,'averageRating')))&&getStat(p,'averageRating')!=null&&Number(getStat(p,'ratedAppearances')||0)>=minRated);
    scored.sort((a,b)=>Number(getStat(b,'averageRating'))-Number(getStat(a,'averageRating'))||Number(getStat(b,'ratedAppearances'))-Number(getStat(a,'ratedAppearances')));
    const selected=scored.slice(0,5);
    $('ratingNote').textContent=`Media voto FM · almeno ${minRated} ${minRated===1?'partita':'partite'} con voto · solo ${team}.`;
    if(!selected.length){$('ratingRows').innerHTML='<tr><td colspan="6" class="load-placeholder">Nessun voto sufficiente disponibile.</td></tr>';return;}
    $('ratingRows').innerHTML=selected.map((p,i)=>`<tr><td>${i+1}</td><td title="${htmlEsc(p.name)}">${htmlEsc(p.name)}</td><td>${Number(getStat(p,'appearances')||0)}</td><td>${Number(getStat(p,'goals')||0)}</td><td>${Number(getStat(p,'assists')||0)}</td><td><span class="rating-chip">${Number(getStat(p,'averageRating')).toFixed(2)}</span></td></tr>`).join('');
  }
  function drawScorers(){
    const ranked=clubPlayers().filter(p=>Number(getStat(p,'goals')||0)>0).sort((a,b)=>Number(getStat(b,'goals')||0)-Number(getStat(a,'goals')||0)||Number(getStat(b,'appearances')||0)-Number(getStat(a,'appearances')||0));
    const winner=ranked[0];
    if(!winner){$('scorerFeature').textContent='Nessun marcatore disponibile';$('scorerRows').textContent='—';return;}
    $('scorerFeature').innerHTML=`<span class="featured-label">MIGLIOR MARCATORE · ${htmlEsc(team.toUpperCase())}</span><strong>${htmlEsc(winner.name)}</strong><span class="scorer-big-number">${Number(getStat(winner,'goals'))} <span>GOL</span></span><span class="scorer-small">${Number(getStat(winner,'appearances')||0)} presenze · ${Number(getStat(winner,'assists')||0)} assist</span>`;
    $('scorerRows').innerHTML=ranked.slice(0,5).map((p,i)=>`<div class="scorer-item"><span>${i+1}</span><strong title="${htmlEsc(p.name)}">${htmlEsc(p.name)}</strong><b>${Number(getStat(p,'goals'))}</b></div>`).join('');
  }
  async function json(file){const response=await fetch(prefix+file,{cache:'no-store'});if(!response.ok)throw Error(file+' HTTP '+response.status);return response.json();}
  async function load(){
    try{
      const [meta,res,scores,p,clubs]=await Promise.all(['database_info.json','league_results.json','league_standings.json','players_stats.json','clubs_data.json'].map(json));
      metadata=meta;
      fixtures=Array.isArray(res)?res:[];
      standings=Array.isArray(scores?.rows)?scores.rows:[];
      players=Array.isArray(p)?p:[];
      clubMap=new Map((Array.isArray(clubs)?clubs:[]).map(c=>[c.name,c]));
      ourGames=fixtures.filter(f=>f.home_club_name===team||f.away_club_name===team);
      upcoming=ourGames.filter(f=>!f.played).sort((a,b)=>lastFixture(a).localeCompare(lastFixture(b)));
      setHeader();drawStandings();drawResults();drawRatings();drawScorers();drawUpcoming();
    }catch(error){
      console.error('Errore di caricamento dashboard:',error);
      $('gameDate').textContent='Dati non disponibili';
      $('dataInfo').textContent='Controlla le cartelle JSON del sito';
      $('matchTitle').textContent='IMPOSSIBILE CARICARE IL DATABASE';
      $('matchDate').textContent='ERRORE DI CARICAMENTO';
      $('matchCountdown').textContent='Apri il sito su HTTP, non come file locale';
      $('matchVenue').textContent='';
      loadMessage('Non riesco a leggere i file JSON. Apri Avvia_Dashboard.cmd o pubblica il sito su GitHub Pages.');
    }
  }
  $('previousFixture').addEventListener('click',()=>{if(visibleIndex>0){visibleIndex--;drawUpcoming();}});
  $('nextFixture').addEventListener('click',()=>{if(visibleIndex<upcoming.length-1){visibleIndex++;drawUpcoming();}});
  load();
})();
