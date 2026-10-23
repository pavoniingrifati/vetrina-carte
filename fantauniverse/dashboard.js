(() => {
  'use strict';
  const world = new URLSearchParams(location.search).get('universo') === 'gothamcity' ? 'gothamcity' : 'fantaballafc';
  const gothic = world === 'gothamcity';
  document.body.dataset.league = gothic ? 'gotham' : 'fantaballa';
  const dataBase = `${world}/`;
  // Solo dati del mondo attivo: nessuna combinazione di sorgenti o di chiavi player.
  const clubName = gothic ? 'Gotham City' : 'Fantaballa FC';
  const locale = 'it-IT';
  const iconPaths = {
    'layout-dashboard':'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    shirt:'<path d="M16 3h2l4 5-3 3-2-2v12H7V9l-2 2-3-3 4-5h2c.6 2 2 3 4 3s3.4-1 4-3Z"/>',
    'calendar-days':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/>',
    'calendar-clock':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 13v4l2 1"/>',
    'calendar-check':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m5 6 2 2 4-4"/>',
    trophy:'<path d="M8 21h8M12 17v4M7 4h10v7a5 5 0 0 1-10 0V4ZM7 6H4v3a4 4 0 0 0 4 4M17 6h3v3a4 4 0 0 1-4 4"/>',
    database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    'scan-eye':'<path d="M7 3H5a2 2 0 0 0-2 2v2m14-4h2a2 2 0 0 1 2 2v2M3 17v2a2 2 0 0 0 2 2h2m14-4v2a2 2 0 0 1-2 2h-2"/><path d="M4 12s3-4 8-4 8 4 8 4-3 4-8 4-8-4-8-4Z"/><circle cx="12" cy="12" r="2"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    'users-round':'<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M16 3.5a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9.5" cy="7" r="4"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    'arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    'map-pin':'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2"/>'
  };
  function makeIcon(n) {return `<svg class="lucide" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[n] || iconPaths.shield}</svg>`;}
  document.querySelectorAll('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', makeIcon(el.dataset.icon)));
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const prettyNum = n => new Intl.NumberFormat(locale).format(n);
  const dateShort = s => { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—'; const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; };
  const dateTiny = s => {if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—'; const [,m,d] = s.split('-');return `${d}/${m}`;};
  const shortTeam = s => {const x=String(s||'');return x.replace(/^F\.C\. /,'').replace(/^FC /,'').replace(/^A\.S\. /,'').replace(/^U\.S\. /,'').replace(' Club de Fútbol','').replace(' Hotspur','').replace(' Saint-Germain FC',' SG').replace(' Football Club','');};
  const teamColor = (club, colorMap) => {const c=colorMap.get(club);return /^#[0-9a-f]{6}$/i.test(c||'') ? c : '#7198b7';};
  const dot = (club,colorMap) => `<span class="team-dot" style="background:${teamColor(club,colorMap)}" aria-hidden="true"></span>`;
  const empty = (title, detail) => `<div class="empty-data"><b>${esc(title)}</b>${esc(detail)}</div>`;
  const state = {results:[], players:[], clubs:[], standings:[], metadata:null, matchMode:'latest', role:'all', query:'', errors:[]};
  const lastPlayerTotal = 5;
  const assets = {fantacalcio:'fantacalcio.html',results:'campionato.html?tab=results',standings:'campionato.html?tab=standings',stats:'campionato.html?tab=stats',database:'scouting.html',scouting:'scouting.html'};
  // Dashboard unica, navigazione e pagine settoriali separate per salvataggio.
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (/^(fantacalcio\.html|campionato\.html|scouting\.html)(\?|$)/.test(href)) link.setAttribute('href',dataBase+href);
  });
  document.querySelector('.identity .mark').textContent=gothic?'GC':'FB';
  document.querySelector('.identity b').textContent=clubName.toUpperCase();
  document.querySelector('.main-heading span').textContent=clubName;
  document.querySelector('.userpill').textContent=gothic?'GC':'FC';
  document.querySelector('.switchbox .club-option:nth-of-type(1)')?.classList.toggle('current',!gothic);
  document.querySelector('.switchbox .club-option:nth-of-type(2)')?.classList.toggle('current',gothic);
  document.querySelectorAll('.switchbox .club-option').forEach(a=>{
    const selected = a.getAttribute('href')?.includes(world);
    if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
    const tail = a.querySelector('span:last-child');
    tail.className=selected?'mini-indicator':'';
    tail.textContent=selected?'':'↗';
  });
  $('worldDatabaseTitle').textContent=`${clubName.toUpperCase()} · DATABASE INDIPENDENTE`;
  $('worldDatabaseDetail').textContent=gothic?'I dati di Gotham City provengono dal suo salvataggio S2 e non da Fantaballa FC.':'I dati di Fantaballa FC provengono dal suo salvataggio S3 e non da Gotham City.';
  $('worldSourceLink').href=dataBase+'fantacalcio.html';
  document.title=`Dashboard · ${clubName} | Fantaballa Universe`;
  const menuToggle=$('menuToggle'), sidebar=$('sidebar'), scrim=$('menuScrim');
  function closeMenu(){sidebar.classList.remove('open');scrim.classList.remove('visible');menuToggle.setAttribute('aria-expanded','false');}
  menuToggle.addEventListener('click',()=>{const isOpen=sidebar.classList.toggle('open');scrim.classList.toggle('visible',isOpen);menuToggle.setAttribute('aria-expanded',String(isOpen));});
  scrim.addEventListener('click',closeMenu);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
  function disableLink(link, reason){link.removeAttribute('href');link.setAttribute('aria-disabled','true');link.setAttribute('title',reason);if(link.classList.contains('feature')){link.classList.add('disabled');const subtitle=link.querySelector('span:not(.feature-icon)');if(subtitle)subtitle.textContent='Modulo da collegare';}}
  async function checkGothamLinks(){
    if(!gothic)return;
    const neededFiles={fantacalcio:'fantacalcio.html',results:'campionato.html',standings:'campionato.html',stats:'campionato.html',database:'scouting.html',scouting:'scouting.html'};
    const exists={};
    await Promise.all([...new Set(Object.values(neededFiles))].map(async path=>{
      try{const r=await fetch(path,{method:'HEAD',cache:'no-store'});exists[path]=r.ok&&r.headers.get('content-type')?.includes('html');}catch{exists[path]=false;}
    }));
    document.querySelectorAll('[data-dynamic-link]').forEach(link=>{
      const target=neededFiles[link.dataset.dynamicLink];
      if(!exists[target])disableLink(link,'Pagina Gotham City non ancora fornita');
    });
  }
  async function getJSON(path) {try{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${path}`);return await r.json();}catch{return null;}}
  function applyMetadata(){
    const meta=state.metadata;
    const year=meta?.season || (state.results[0]?.season_start_year);
    const season=year ? `${year}/${String(Number(year)+1).slice(-2)}` : '—';
    $('topSeason').textContent=`STAGIONE ${season}`;
    $('savechip').innerHTML=`SAVE DI RIFERIMENTO <b>${esc(dateShort(meta?.saveDate || ''))}</b>`;
    const comp=meta?.competition||'Campionato';
    $('heroVenue').innerHTML=`${makeIcon('map-pin')}${esc(comp)}`;
    $('rankingSub').textContent=comp;
    $('footerSource').textContent = meta?.saveDate ? `Fonte: ${meta.source || 'Salvataggio Football Manager'} · Snapshot del ${dateShort(meta.saveDate)}. Risultati e classifiche non sono dati in tempo reale.` : 'Dati disponibili solo quando sono presenti i file JSON del rispettivo universo.';
    if (!meta) $('savechip').textContent='DATABASE DA COLLEGARE';
  }
  function renderMetrics(){
    $('metricClubs').textContent=state.clubs.length?prettyNum(state.clubs.length):(state.standings.length?prettyNum(state.standings.length):'—');
    $('metricPlayers').textContent=state.players.length?prettyNum(state.players.length):'—';
    $('metricMatches').textContent=state.results.length?`${prettyNum(state.results.filter(m=>m.played).length)} / ${prettyNum(state.results.length)}`:'—';
    const row=state.standings.find(s=>s.club?.toLowerCase()===clubName.toLowerCase());
    $('metricPosition').textContent=row?.position?`${row.position}ª`:row?.rank?`${row.rank}ª`:'—';
  }
  function renderHero(){
    if(!state.results.length){$('heroKicker').textContent='DASHBOARD · UNIVERSO CALCISTICO';$('heroTitle').innerHTML = gothic?'GOTHAM CITY.<br>IL TUO UNIVERSO.':'LA TUA SUPER LEGA.<br>IL TUO CAMPIONATO.';$('heroDescription').textContent=gothic?'Una nuova dashboard per la tua lega. Aggiungi i dati e le pagine Gotham City per attivare tutte le sezioni.':'Aggiungi risultati e dati di campionato per visualizzare gli incontri.';$('heroDate').innerHTML=`${makeIcon('calendar-days')}Dati in attesa`;return;}
    const mine = state.results.filter(f=>f.home_club_name===clubName||f.away_club_name===clubName).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const next=mine.find(f=>!f.played);
    const recent=[...mine].reverse().find(f=>f.played);
    const feature=next||recent;
    if(!feature){$('heroKicker').textContent='CAMPIONATO · CALENDARIO';return;}
    $('heroKicker').textContent=next?'PROSSIMA PARTITA NEL SALVATAGGIO':'ULTIMA PARTITA NEL SALVATAGGIO';
    $('heroTitle').textContent=`${shortTeam(feature.home_club_name)} - ${shortTeam(feature.away_club_name)}`;
    const date=dateShort(feature.date);
    const save=dateShort(state.metadata?.saveDate);
    $('heroDescription').textContent=next?`Incontro previsto il ${date} nel calendario del save del ${save}. Consulta calendario, risultati e classifica della stagione.`:`Risultato salvato del ${date}. Consulta tutte le partite e le statistiche del campionato.`;
    $('heroDate').innerHTML=`${makeIcon('calendar-days')}${esc(date)} · ${feature.round_index != null?'Giornata '+(feature.round_index+1):'Campionato'}`;
    $('heroVenue').innerHTML=`${makeIcon('map-pin')}${esc(state.metadata?.competition||'Campionato')}`;
  }
  function renderStandings(){
    const body=$('standingsBody');
    if(!state.standings.length){body.innerHTML=`<tr><td colspan="4">${empty('Nessuna classifica disponibile','Collega il file league_standings.json del tuo campionato.')}</td></tr>`;return;}
    const rows=[...state.standings].sort((a,b)=>(a.position||a.rank||99)-(b.position||b.rank||99));
    let top=rows.slice(0,6);
    const own=rows.find(r=>r.club===clubName);
    if(own && !top.includes(own)){top=top.slice(0,5).concat(own);}
    const colorMap=new Map(state.clubs.map(c=>[c.name,c.kit?.colors?.[0]]));
    body.innerHTML=top.map(r=>`<tr class="${r.club===clubName?'myteam':''}"><td>${Number(r.position||r.rank)||'—'}°</td><td><div class="standing-team">${dot(r.club,colorMap)}<span title="${esc(r.club)}">${esc(shortTeam(r.club))}</span></div></td><td>${Number(r.played)||0}</td><td>${Number(r.points)||0}</td></tr>`).join('');
    $('rankFoot').textContent=`${rows.length} squadre · Classifica ricostruita dai risultati del salvataggio.`;
  }
  function renderMatches(){
    const body=$('matchFeed');
    if(!state.results.length){body.innerHTML=empty('Nessun risultato disponibile','Collega il file league_results.json della tua lega.');return;}
    const matches=state.results.filter(f=>f.home_club_name===clubName||f.away_club_name===clubName);
    const scoped=matches.length?matches:state.results;
    const selection=scoped.filter(f=>state.matchMode==='latest'?f.played:!f.played).sort((a,b)=>state.matchMode==='latest'?String(b.date).localeCompare(String(a.date)):String(a.date).localeCompare(String(b.date))).slice(0,5);
    const colorMap=new Map(state.clubs.map(c=>[c.name,c.kit?.colors?.[0]]));
    if(!selection.length){body.innerHTML=empty('Nessuna partita trovata',state.matchMode==='latest'?'Nessuna partita ancora disputata.':'Nessuna partita futura nel calendario del save.');return;}
    $('matchesSubtitle').textContent=matches.length?`Incontri di ${clubName}`:'Incontri del campionato';
    body.innerHTML=selection.map(m=>{const score=m.played&&m.home_goals!=null&&m.away_goals!=null?`${m.home_goals} : ${m.away_goals}`:'VS';const home=m.home_club_name||'Casa';const away=m.away_club_name||'Trasferta';return `<div class="match-row"><div class="match-date"><b>${dateTiny(m.date)}</b><span>G ${m.round_index==null?'—':m.round_index+1}</span></div><div class="match-team ${home===clubName?'mine':''}">${dot(home,colorMap)}<span class="label-trunc" title="${esc(home)}">${esc(shortTeam(home))}</span></div><div class="result-tag ${m.played?'':'future'}">${score}</div><div class="match-team away ${away===clubName?'mine':''}"><span class="label-trunc" title="${esc(away)}">${esc(shortTeam(away))}</span>${dot(away,colorMap)}</div></div>`;}).join('');
  }
  function renderTopScorers(){
    const target=$('topPlayers');
    if(!state.players.length){target.innerHTML=empty('Statistiche da collegare','Collega i dati dei giocatori della lega.');return;}
    const top=state.players.filter(p=>Number(p.leagueStats?.goals)>0).sort((a,b)=>Number(b.leagueStats?.goals)-Number(a.leagueStats?.goals)||Number(b.leagueStats?.appearances)-Number(a.leagueStats?.appearances)).slice(0,5);
    if(!top.length){target.innerHTML=empty('Marcatori non disponibili','Nessuna statistica gol valida nel database.');return;}
    target.innerHTML=top.map((p,i)=>`<div class="player-line"><span class="player-rank">${String(i+1).padStart(2,'0')}</span><div class="player-meta"><strong title="${esc(p.name)}">${esc(p.name)}</strong><small title="${esc(p.club)}">${esc(shortTeam(p.club))}</small></div><b class="player-score">${Number(p.leagueStats.goals)}</b></div>`).join('');
  }
  function normalize(v){return String(v||'').toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function playerStats(p) {return p.leagueStats||{};}
  function renderPlayers(){
    const body=$('playersBody');
    if(!state.players.length){body.innerHTML=`<tr><td colspan="6">${empty('Database non disponibile','Aggiungi players_stats.json per popolare la ricerca.')}</td></tr>`;$('playerCount').textContent='0 giocatori';return;}
    const query=normalize(state.query);
    const matches=state.players.filter(p=>(state.role==='all'||p.role===state.role)&&(!query||normalize(`${p.name} ${p.club} ${p.position} ${p.role}`).includes(query)));
    matches.sort((a,b)=>Number(playerStats(b).goals||0)-Number(playerStats(a).goals||0)||Number(b.cost||0)-Number(a.cost||0)||a.name.localeCompare(b.name));
    const shown=matches.slice(0,lastPlayerTotal);
    body.innerHTML=shown.length?shown.map(p=>{const pg=Number(playerStats(p).appearances||0),mv=playerStats(p).averageRating;return `<tr><td><strong>${esc(p.name||'Sconosciuto')}</strong><small>${esc(shortTeam(p.club))}</small></td><td><span class="role-pill">${esc(p.role||'—')}</span></td><td>${pg||'—'}</td><td>${mv==null?'—':Number(mv).toFixed(2)}</td><td>${Number(playerStats(p).goals||0)}</td><td><strong>${Number(p.cost)||0}</strong></td></tr>`;}).join(''):`<tr><td colspan="6">${empty('Nessun giocatore trovato','Modifica ricerca o filtro ruolo.')}</td></tr>`;
    $('playerCount').textContent=`${prettyNum(matches.length)} risultati · ${prettyNum(state.players.length)} giocatori totali`;
    const url=`${dataBase}scouting.html${state.query?'?q='+encodeURIComponent(state.query):''}`;
    $('allPlayersLink').href=url;
  }
  $('tabLatest').addEventListener('click',()=>{state.matchMode='latest';$('tabLatest').classList.add('selected');$('tabUpcoming').classList.remove('selected');renderMatches();});
  $('tabUpcoming').addEventListener('click',()=>{state.matchMode='upcoming';$('tabUpcoming').classList.add('selected');$('tabLatest').classList.remove('selected');renderMatches();});
  $('playerSearch').addEventListener('input',e=>{state.query=e.target.value.trim();renderPlayers();});
  document.querySelectorAll('.role-chip').forEach(chip=>chip.addEventListener('click',()=>{state.role=chip.dataset.role;document.querySelectorAll('.role-chip').forEach(el=>el.classList.toggle('active',el===chip));renderPlayers();}));
  async function load(){
    const [meta,results,standings,players,clubs] = await Promise.all(['database_info.json','league_results.json','league_standings.json','players_stats.json','clubs_data.json'].map(path=>getJSON(dataBase+path)));
    state.metadata=meta&&typeof meta==='object'?meta:null;
    state.results=Array.isArray(results)?results:[];
    state.standings=Array.isArray(standings?.rows)?standings.rows:[];
    state.players=Array.isArray(players)?players:[];
    state.clubs=Array.isArray(clubs)?clubs:[];
    applyMetadata();renderMetrics();renderHero();renderStandings();renderMatches();renderTopScorers();renderPlayers();
  }
  load();
})();
