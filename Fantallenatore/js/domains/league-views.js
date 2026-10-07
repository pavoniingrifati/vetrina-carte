/* Responsibility: league-views. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: league-views');
  function sortedStandings() {
    const season = $runtime.ensureSeasonState();
    if (!season) return [];
    return $runtime.sortFantasyLeagueStandings(season.standings,season);
  }

  function sortedFullStandingsForView(){
    const canonical=$runtime.sortedStandings();
    const positions=new Map(canonical.map((row,index)=>[String(row.managerId),index+1]));
    const rows=canonical.map(row=>({...row,_leaguePosition:positions.get(String(row.managerId))||999}));
    const {key,direction}=$runtime.leagueStandingsSort;
    const dir=direction==='asc'?1:-1;
    const value=(row)=>{
      if(key==='position') return Number(row._leaguePosition||999);
      if(key==='team') return String($runtime.managerById(row.managerId)?.team||'').toLocaleLowerCase('it');
      if(key==='gd') return Number(row.gf||0)-Number(row.ga||0);
      if(key==='fantasyPoints') return Number(row.fantasyPoints||0);
      return Number(row[key]||0);
    };
    return rows.slice().sort((a,b)=>{
      const av=value(a),bv=value(b);
      let cmp=0;
      if(typeof av==='string' || typeof bv==='string') cmp=String(av).localeCompare(String(bv),'it',{sensitivity:'base'});
      else cmp=Number(av)-Number(bv);
      if(cmp!==0) return cmp*dir;
      return Number(a._leaguePosition||999)-Number(b._leaguePosition||999);
    });
  }

  function renderFullStandingsSortState(){
    document.querySelectorAll('#leagueStandingsScreen [data-standings-sort]').forEach(btn=>{
      const active=btn.dataset.standingsSort===$runtime.leagueStandingsSort.key;
      btn.classList.toggle('active',active);
      const arrow=btn.querySelector('span');
      if(arrow) arrow.textContent=active?($runtime.leagueStandingsSort.direction==='asc'?'▲':'▼'):'';
      btn.setAttribute('aria-pressed',String(active));
    });
  }

  function setLeagueStandingsSort(key){
    if(!Object.prototype.hasOwnProperty.call($runtime.LEAGUE_STANDINGS_DEFAULT_DIRECTION,key)) return;
    if($runtime.leagueStandingsSort.key===key){
      $runtime.leagueStandingsSort.direction=$runtime.leagueStandingsSort.direction==='asc'?'desc':'asc';
    }else{
      $runtime.leagueStandingsSort={key,direction:$runtime.LEAGUE_STANDINGS_DEFAULT_DIRECTION[key]};
    }
    if($runtime.$('fullStandingsBody')) $runtime.$('fullStandingsBody').innerHTML=$runtime.fullStandingsRowsHtml();
    $runtime.renderFullStandingsSortState();
  }

  function managerById(id) { return $runtime.state?.managers?.find(m=>m.id===id) || null; }

  function currentUserFixture() {
    const season = $runtime.ensureSeasonState();
    if (!season) return null;
    const round = season.schedule[season.currentMatchday-1];
    return round?.matches?.find(m=>m.homeId==='user' || m.awayId==='user') || null;
  }

  function userOpponentIdForDay(day=$runtime.ensureSeasonState()?.currentMatchday){
    const season=$runtime.ensureSeasonState();
    if(!season || !Number(day)) return null;
    const round=season.schedule?.[Number(day)-1];
    const fixture=round?.matches?.find(m=>m.homeId==='user' || m.awayId==='user');
    if(!fixture) return null;
    return fixture.homeId==='user' ? fixture.awayId : fixture.homeId;
  }

  function cpuFormationForDay(manager,day=$runtime.ensureSeasonState()?.currentMatchday){
    const forced=$runtime.forcedFormationRuleForDay(day);
    if(forced && (forced==='5-5-5' || String(manager?.id||'')===String($runtime.userOpponentIdForDay(day)||''))) return forced;
    return $runtime.chooseCpuFormation(manager);
  }

  function pendingBigMatchContext(){
    const season=$runtime.ensureSeasonState();
    const pending=season?.pendingBigMatch;
    if(!pending?.snapshot || pending.day!==season.currentMatchday) return null;
    const snap=pending.snapshot;
    const perfMap=new Map(snap.perfEntries||[]);
    const big=snap.matches?.[pending.bigMatchIndex]||snap.matches?.[snap.bigMatchIndex]||null;
    const bigClubs=new Set(big?[big.homeClub,big.awayClub]:[]);
    return {season,pending,snap,perfMap,big,bigClubs};
  }

  function pendingPartialPerformance(player,ctx){
    if(!player || !ctx) return null;
    if(ctx.bigClubs.has(player.club)){
      return {
        playerId:String(player.id),name:player.name,role:player.role,club:player.club,
        vote:null,fantasy:null,noVote:false,pending:true,minutes:0
      };
    }
    const perf=$runtime.currentFantasyPerformance(player,ctx.perfMap,90);
    return {...perf,pending:false};
  }

  function pendingPartialFantasySnapshot(managerId){
    const ctx=$runtime.pendingBigMatchContext();
    const manager=$runtime.managerById(managerId);
    const saved=ctx?.snap?.lineups?.[managerId] || ctx?.season?.lineups?.[String(ctx?.season?.currentMatchday||1)]?.[managerId];
    if(!ctx || !manager || !saved) return null;

    const players=$runtime.lineupPlayersForManager(manager,saved);
    const performances=players.map(player=>$runtime.pendingPartialPerformance(player,ctx)).filter(Boolean);
    if(managerId==='user') performances.forEach(perf=>{
      if(perf.pending || perf.noVote) return;
      const riskDelta=$runtime.riskAdjustmentForPerformance(perf,ctx.pending.day);
      perf.riskDelta=riskDelta;
      perf.fantasy=$runtime.halfPoint(perf.fantasy+riskDelta);
    });
    const fantasyPoints=$runtime.halfPoint(performances.reduce((sum,p)=>sum+(p.pending?0:Number(p.fantasy||0)),0));
    return {
      managerId,manager,saved,performances,fantasyPoints,
      pendingCount:performances.filter(p=>p.pending).length,
      votedCount:performances.filter(p=>!p.pending&&!p.noVote).length,
      noVoteCount:performances.filter(p=>!p.pending&&p.noVote).length
    };
  }

  function pendingPartialPlayerInfo(player){
    const ctx=$runtime.lineupPartialContext?.ctx || $runtime.pendingBigMatchContext();
    if(!ctx || !player) return null;
    const p=$runtime.pendingPartialPerformance(player,ctx);
    if(!p) return null;
    if(p.pending) return {label:'POSTICIPO',className:'is-pending',fantasy:null,vote:null};
    if(p.noVote) return {label:'SV',className:'is-sv',fantasy:0,vote:null};
    return {
      label:`V ${Number(p.vote).toFixed(1)} · FV ${Number(p.fantasy).toFixed(1)}`,
      className:'has-partial-vote',
      fantasy:Number(p.fantasy),vote:Number(p.vote)
    };
  }

  function seasonPlayerStatCards(stat,premium=false){
    const avg=stat?.voteCount?stat.voteSum/stat.voteCount:null;
    const favg=stat?.voteCount?stat.fantasySum/stat.voteCount:null;
    return [
      ['PRES',stat?.appearances||0,false],
      ['TIT',stat?.starts||0,false],
      ['MIN',stat?.minutes||0,false],
      ['MV',premium?(avg!==null?avg.toFixed(2):'—'):'🔒',!premium],
      ['FM',premium?(favg!==null?favg.toFixed(2):'—'):'🔒',!premium],
      ['GOL',stat?.goals||0,false],
      ['ASSIST',stat?.assists||0,false],
      ['GIALLI',premium?(stat?.yellow||0):'🔒',!premium],
      ['ROSSI',premium?(stat?.red||0):'🔒',!premium],
      ['CLEAN',premium?(stat?.cleanSheets||0):'🔒',!premium]
    ];
  }

  function renderSeasonPlayerModal(playerId){
    const player=$runtime.playerMap.get(String(playerId)) || (window.FANTA_PLAYERS||[]).find(p=>String(p.id)===String(playerId));
    if(!player) return;
    const season=$runtime.ensureSeasonState();
    const stat=$runtime.playerSeasonStat(player.id) || $runtime.emptyPlayerSeasonStat(player);
    const form=$runtime.playerFormMetrics(player.id);
    const availability=$runtime.playerStatusForDay(player.id,season?.currentMatchday||1);
    const owner=$runtime.seasonPlayerOwner(player.id);

    $runtime.$('seasonPlayerName').textContent=player.name;
    $runtime.$('seasonPlayerClub').textContent=$runtime.clubName(player.club);
    if($runtime.$('seasonPlayerAvatar')) $runtime.$('seasonPlayerAvatar').innerHTML=$runtime.playerAvatarMarkup(player,player.name);
    const modalFixture=$runtime.serieAFixtureForPlayer(player,season?.currentMatchday||1);
    const modalDataPro=$runtime.shopItemActive('fantadata_pro',season);
    const modalDifficulty=modalDataPro?$runtime.serieAMatchupDifficulty(player,season?.currentMatchday||1):null;
    $runtime.$('seasonPlayerMeta').textContent=`${$runtime.ROLE_LABELS[player.role]||player.role} · OVR ${$runtime.playerOvrLabel(player)}${owner?` · ${owner.manager.team} · ${Number(owner.item.price||0)} cr`:''}${modalFixture?` · vs ${modalFixture.opponentName} · ${modalFixture.venue}`:''}${modalDifficulty?` · ${modalDifficulty.icon} ${modalDifficulty.label}`:''}`;

    const statusEl=$runtime.$('seasonPlayerStatus');
    statusEl.textContent=availability.label;
    statusEl.className=`season-player-status ${availability.className}`;

    const dataPro=$runtime.shopItemActive('fantadata_pro',season);
    const scoutPlus=$runtime.shopItemActive('scout_plus',season);
    $runtime.$('seasonPlayerStatsGrid').innerHTML=$runtime.seasonPlayerStatCards(stat,dataPro).map(([label,value,locked])=>`
      <div class="season-player-stat ${locked?'is-premium-locked':''}"><strong>${$runtime.escapeHtml(String(value))}</strong><span>${label}</span></div>
    `).join('');

    if(dataPro){
      $runtime.$('seasonPlayerFormBadge').textContent=`${form.arrow} ${form.count?form.avg.toFixed(2):'—'}`;
      $runtime.$('seasonPlayerFormBadge').className=`player-form-badge ${form.className}`;
      $runtime.$('seasonPlayerFormTitle').textContent=form.count?`Ultime ${form.count} prestazioni`:'Nessun voto ancora';
      $runtime.$('seasonPlayerFormRows').innerHTML=form.recent.length
        ? form.recent.slice().reverse().map(x=>`<div class="season-player-form-row"><span>G${x.day}</span><strong>V ${Number(x.vote).toFixed(1)}</strong><b>FV ${Number(x.fantasy).toFixed(1)}</b></div>`).join('')
        : '<div class="season-player-form-empty">Le statistiche inizieranno dopo la prima presenza con voto.</div>';
    } else {
      $runtime.$('seasonPlayerFormBadge').textContent='🔒 PRO';
      $runtime.$('seasonPlayerFormBadge').className='player-form-badge neutral premium-locked';
      $runtime.$('seasonPlayerFormTitle').textContent='Forma dettagliata · FantaData Pro';
      $runtime.$('seasonPlayerFormRows').innerHTML='<div class="season-player-form-empty premium-data-lock">🔒 Media voto, fantamedia e andamento recente sono disponibili con <b>FantaData Pro</b> nel Negozio.</div>';
    }
    if($runtime.$('seasonPlayerStarterEstimate')){
      $runtime.$('seasonPlayerStarterEstimate').innerHTML=scoutPlus
        ? `<span>PROBABILITÀ TITOLARITÀ</span><strong>${$runtime.estimatedStarterProbability(player)}%</strong><small>Stima Scout Plus · non è una certezza</small>`
        : '<span>PROBABILITÀ TITOLARITÀ</span><strong>🔒</strong><small>Sblocca Scout Plus nel Negozio</small>';
      $runtime.$('seasonPlayerStarterEstimate').classList.toggle('is-locked',!scoutPlus);
    }

    if($runtime.$('seasonPlayerEvolutionRows')){
      const evo=$runtime.evolutionPlayerData(player,season);
      const direction=evo.delta>0?'positive':evo.delta<0?'negative':'neutral';
      $runtime.$('seasonPlayerEvolutionTitle').textContent=`OVR ${evo.base} → ${evo.current}`;
      $runtime.$('seasonPlayerEvolutionBadge').textContent=`${evo.delta>0?'+':''}${evo.delta}`;
      $runtime.$('seasonPlayerEvolutionBadge').className=`player-form-badge ${direction}`;
      const history=evo.history.slice(-4).reverse();
      $runtime.$('seasonPlayerEvolutionRows').innerHTML=history.length
        ? history.map(ev=>`<div class="season-player-evolution-row"><span>G${ev.day}</span><strong>${ev.before} → ${ev.after}</strong><b class="${ev.change>0?'positive':'negative'}">${ev.change>0?'+':''}${ev.change}</b><small>${$runtime.escapeHtml(ev.reason)}</small></div>`).join('')
        : '<div class="season-player-form-empty">Nessuna variazione OVR registrata in questa stagione.</div>';
    }

    const modal=$runtime.$('seasonPlayerModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
  }

  function closeSeasonPlayerModal(){
    const modal=$runtime.$('seasonPlayerModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
  }

  function wireSeasonPlayerButtons(root=document){
    root.querySelectorAll('[data-season-player]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(btn.closest?.('#seasonNewsModal')) $runtime.closeSeasonNewsArchive();
        $runtime.renderSeasonPlayerModal(btn.dataset.seasonPlayer);
      });
    });
  }

  function renderLeagueNavActive(active){
    document.querySelectorAll('[data-league-nav]').forEach(btn=>{
      const current=btn.dataset.leagueNav===active;
      btn.classList.toggle('active',current);
      if(current) btn.setAttribute('aria-current','page');
      else btn.removeAttribute('aria-current');
    });
  }

  function standardizeLeagueShells(){
    const headerHtml=`
      <div class="season-title-block">
        <h2>Fantallenatore</h2>
        <p class="dashboard-season-line">STAGIONE <span data-game-season></span></p>
      </div>
      <div class="season-top-actions">
        <div class="career-wallet-chip dashboard-wallet" title="Euro attuali"><span>●</span><small>EURO</small><b data-career-wallet-value>20</b></div>
        <button class="dashboard-inventory-chip" data-open-consumable-inventory type="button" title="Apri inventario consumabili"><span>🎒</span><small>INVENTARIO</small><b data-consumable-inventory-count>0</b></button>
        <div class="dashboard-division-chip"><span>◆</span><small>DIVISIONE</small><b data-current-division></b></div>
        <button class="secondary" data-season-global-save type="button">SALVA</button>
        <button class="ghost" data-season-global-menu type="button">MENU</button>
      </div>`;
    const navHtml=`
      <button data-league-nav="dashboard" type="button"><span>⌂</span>HOME</button>
      <button data-league-nav="rosters" type="button"><span>♟</span>ROSE</button>
      <button data-league-nav="standings" type="button"><span>♛</span>CLASSIFICHE</button>
      <button data-league-nav="datacenter" type="button"><span>▥</span>DATACENTER</button>
      <button data-league-nav="social" type="button"><span>♣</span>SOCIAL</button>
      <button data-league-nav="shop" type="button"><span>▰</span>NEGOZIO</button>`;
    document.querySelectorAll('.league-subscreen').forEach(screen=>{
      const header=screen.querySelector('.season-topbar');
      const nav=screen.querySelector('.league-nav');
      if(header){
        header.classList.add('dashboard-game-header');
        header.innerHTML=headerHtml;
      }
      if(nav) nav.innerHTML=navHtml;
    });
    $runtime.applyGameConfiguration();
  }

  function fullStandingsRowsHtml(){
    const standings=$runtime.sortedFullStandingsForView();
    return standings.map(s=>{
      const m=$runtime.managerById(s.managerId), gd=s.gf-s.ga;
      const rowClasses=[s.managerId==='user'?'is-user-standing':'',Number(s._leaguePosition)===1?'is-promotion-standing':''].filter(Boolean).join(' ');
      return `<tr class="${rowClasses}">
        <td>${s._leaguePosition}</td>
        <td><strong>${$runtime.escapeHtml(m?.team||'—')}</strong><small>${$runtime.escapeHtml(m?.name||'')}</small></td>
        <td>${s.played}</td>
        <td class="pts">${s.points}</td>
        <td class="fantasy-total">${Number(s.fantasyPoints||0).toFixed(1)}</td>
        <td>${s.wins}</td><td>${s.draws}</td><td>${s.losses}</td>
        <td>${s.gf}</td><td>${s.ga}</td><td>${gd>0?'+':''}${gd}</td>
      </tr>`;
    }).join('');
  }

  function fullScheduleHtml(){
    const season=$runtime.ensureSeasonState();
    if(!season) return '';
    const day=season.currentMatchday;
    return season.schedule.map(r => {
      const hasResult=!!season.matchdayResults?.[String(r.number)];
      return `<article class="schedule-round ${r.number===day?'current-round':''} ${hasResult?'played-round':''}">
        <div class="schedule-round-head"><strong>G${r.number}</strong><span>${$runtime.escapeHtml(r.label||'STAGIONE')}</span></div>
        <div class="schedule-round-matches">${r.matches.map(m=>{
          const h=$runtime.managerById(m.homeId),a=$runtime.managerById(m.awayId), user=m.homeId==='user'||m.awayId==='user';
          return `<div class="schedule-mini-match ${user?'user-mini-match':''}">
            <span>${$runtime.escapeHtml(h?.team||'—')}</span>
            <b>${m.played?`${m.homeScore}-${m.awayScore}`:'vs'}</b>
            <span>${$runtime.escapeHtml(a?.team||'—')}</span>
          </div>`;
        }).join('')}</div>
        ${hasResult?`<button type="button" class="calendar-results-open" data-calendar-results="${r.number}">VEDI RISULTATI</button>`:''}
      </article>`;
    }).join('');
  }

  function renderCalendarDayResults(day){
    const season=$runtime.ensureSeasonState();
    const result=season?.matchdayResults?.[String(day)];
    const panel=$runtime.$('calendarResultsPanel');
    if(!panel) return;
    if(!result){
      panel.style.display='none';
      return;
    }
    panel.style.display='';
    $runtime.$('calendarResultsTitle').textContent=`Giornata ${day}`;
    $runtime.$('calendarResultsBadge').textContent='CONCLUSA';
    $runtime.$('calendarResultsList').innerHTML=(result.matches||[]).map(m=>`
      <div class="calendar-result-row ${m.homeId==='user'||m.awayId==='user'?'is-user-result':''}">
        <div><strong>${$runtime.escapeHtml(m.homeTeam)}</strong><small>${Number(m.homeFantasy||0).toFixed(1)} FP</small></div>
        <b>${m.homeScore} - ${m.awayScore}</b>
        <div><strong>${$runtime.escapeHtml(m.awayTeam)}</strong><small>${Number(m.awayFantasy||0).toFixed(1)} FP</small></div>
      </div>
    `).join('');
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function leagueFullRosterHtml(manager){
    if(!manager) return '';
    const roster=Array.isArray(manager.roster)?manager.roster:[];
    const roleBlocks=$runtime.ROLE_ORDER.map(role=>{
      const items=roster.filter(p=>p.role===role).slice().sort((a,b)=>$runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a) || String(a.name).localeCompare(String(b.name),'it'));
      return `<section class="league-modal-role role-${role}">
        <header><strong>${$runtime.escapeHtml(role)}</strong><span>${items.length}/${$runtime.ROLE_LIMITS[role]}</span></header>
        <div class="league-modal-player-list">${items.map(p=>`<button type="button" class="league-modal-player season-player-open" data-season-player="${$runtime.escapeHtml(String(p.id))}"><span class="lineup-role-chip role-${p.role}">${p.role}</span><span><strong>${$runtime.escapeHtml(p.name)}</strong><small>${$runtime.escapeHtml($runtime.clubName(p.club))} · OVR ${$runtime.playerOvrLabel(p)}</small></span><b>${Number(p.price||0)} cr</b></button>`).join('')}</div>
      </section>`;
    }).join('');
    const spent=roster.reduce((sum,p)=>sum+Number(p.price||0),0);
    const avg=roster.length?(roster.reduce((sum,p)=>sum+$runtime.currentPlayerOvr(p),0)/roster.length).toFixed(1):'—';
    return `<div class="league-modal-summary"><div><span>GIOCATORI</span><strong>${roster.length}</strong></div><div><span>SPESA</span><strong>${spent}</strong></div><div><span>OVR MEDIO</span><strong>${avg}</strong></div><div><span>CREDITI</span><strong>${Number(manager.budget||0)}</strong></div></div><div class="league-modal-roles">${roleBlocks}</div>`;
  }

  function openLeagueRosterModal(managerId){
    const modal=$runtime.$('leagueRosterModal');
    const manager=$runtime.managerById(managerId);
    if(!modal || !manager) return;
    $runtime.$('leagueRosterModalTitle').textContent=manager.team||'Squadra';
    $runtime.$('leagueRosterModalSubtitle').textContent=manager.id==='user' ? `${$runtime.state.managerName||'Mister'} · ${manager.roster?.length||0} giocatori` : `${manager.name||'CPU'} · ${manager.profile?.label||'CPU'} · ${manager.roster?.length||0} giocatori`;
    $runtime.$('leagueRosterModalBody').innerHTML=$runtime.leagueFullRosterHtml(manager);
    $runtime.wireSeasonPlayerButtons($runtime.$('leagueRosterModalBody'));
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
  }

  function closeLeagueRosterModal(){
    const modal=$runtime.$('leagueRosterModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
  }

  function buildLeagueTopXICards(){
    if(!$runtime.state?.managers?.length) return '';
    return $runtime.state.managers.map(m=>{
      const personality=m.id==='user' ? `${$runtime.escapeHtml($runtime.state.managerName||'Tu')} · TU` : $runtime.escapeHtml(m.profile?.label||m.name||'CPU');
      return `<article class="league-topxi-card ${m.id==='user'?'is-user':''}">
        <header class="league-topxi-head">
          <div><span class="manager-online-dot"></span><button type="button" class="league-topxi-team-name" data-open-team-roster="${$runtime.escapeHtml(String(m.id))}" title="Apri rosa completa di ${$runtime.escapeHtml(m.team)}">${$runtime.escapeHtml(m.team)}</button><small>${personality}</small></div>
          <span class="league-topxi-open-hint">ROSA ↗</span>
        </header>
        ${$runtime.bestXIHtml(m)}
      </article>`;
    }).join('');
  }

  function wireLeagueTopXICards(root){
    if(!root) return;
    root.querySelectorAll('[data-open-team-roster]').forEach(btn=>btn.addEventListener('click',()=>$runtime.openLeagueRosterModal(btn.dataset.openTeamRoster)));
    $runtime.wireSeasonPlayerButtons(root);
  }

  function renderLeagueRostersScreen(){
    $runtime.stopHubNewsCarousel();
    const season=$runtime.ensureSeasonState();
    if(!season) return $runtime.renderSummary();
    $runtime.showScreen('leagueRostersScreen');
    $runtime.renderLeagueNavActive('rosters');
    $runtime.renderCareerWallets();
    const grid=$runtime.$('leagueRostersGrid');
    if(grid){
      grid.innerHTML=$runtime.buildLeagueTopXICards();
      $runtime.wireLeagueTopXICards(grid);
    }
  }

  function renderLeagueCalendarScreen(){
    $runtime.stopHubNewsCarousel();
    const season=$runtime.ensureSeasonState();
    if(!season) return $runtime.renderSummary();
    $runtime.showScreen('leagueCalendarScreen');
    $runtime.renderLeagueNavActive('dashboard');
    $runtime.renderCareerWallets();
    if($runtime.$('leagueFullSchedule')){
      $runtime.$('leagueFullSchedule').innerHTML=$runtime.fullScheduleHtml();
      $runtime.$('leagueFullSchedule').querySelectorAll('[data-calendar-results]').forEach(btn=>btn.addEventListener('click',()=>$runtime.renderCalendarDayResults(Number(btn.dataset.calendarResults))));
    }
    const latest=Number(season.lastCompletedMatchday||0);
    if(latest>0) $runtime.renderCalendarDayResults(latest);
    else if($runtime.$('calendarResultsPanel')) $runtime.$('calendarResultsPanel').style.display='none';
  }

  function renderCareerHonours(){
    const career=$runtime.ensureCareerEconomy();
    const seasons=[...(career?.seasonHistory||[])];
    const current=$runtime.state?.season;
    const seasonNumber=Number(career?.seasonNumber||1);
    if(current?.completed && !seasons.some(entry=>Number(entry.seasonNumber)===seasonNumber)){
      seasons.push({seasonNumber,divisionLabel:$runtime.careerDivisionLabel(career.division),position:$runtime.completedSeasonUserPosition(current),personalRecap:$runtime.completedUserSeasonRecap(current)});
    }
    const trophies=seasons.filter(entry=>Number(entry.position)===1);
    const categories=[
      {icon:'⚽',label:'MIGLIOR CAPOCANNONIERE',key:'scorer',field:'goals',suffix:'gol'},
      {icon:'👟',label:'MIGLIOR ASSIST MAN',key:'assister',field:'assists',suffix:'assist'},
      {icon:'⭐',label:'MIGLIOR MEDIA VOTO',key:'topVote',field:'avgVote',suffix:'media voto'},
      {icon:'🔥',label:'MIGLIOR FANTAMEDIA',key:'topFantasy',field:'avgFantasy',suffix:'fantamedia'}
    ];
    const card=(icon,label,value,detail)=>`<article class="career-honours-card"><span aria-hidden="true">${icon}</span><small>${label}</small><strong>${$runtime.escapeHtml(value)}</strong><p>${$runtime.escapeHtml(detail)}</p></article>`;
    const trophyDetail=trophies.length?trophies.map(entry=>`${entry.divisionLabel||$runtime.careerDivisionLabel(entry.division)} · stagione ${entry.seasonNumber}`).join(' · '):'Nessun titolo conquistato';
    const records=categories.map(category=>{
      const ranked=seasons.map(entry=>({entry,player:entry.personalRecap?.[category.key]})).filter(row=>row.player && Number.isFinite(Number(row.player[category.field])))
        .sort((a,b)=>Number(b.player[category.field])-Number(a.player[category.field]) || Number(a.entry.seasonNumber)-Number(b.entry.seasonNumber));
      const best=ranked[0];
      const value=best?.player?.[category.field];
      const formatted=value===undefined?'—':category.field.startsWith('avg')?Number(value).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}):String(value);
      return card(category.icon,category.label,formatted,best?`${best.player.name} · ${category.suffix} · stagione ${best.entry.seasonNumber}`:'Nessuna stagione conclusa');
    });
    const picks=new Map();
    (career?.auctionPicks||[]).forEach(pick=>{
      const id=String(pick.id||'');
      if(!id) return;
      const row=picks.get(id)||{name:pick.name||'Giocatore',count:0};
      row.count+=Math.max(1,Number(pick.count||1));
      picks.set(id,row);
    });
    const mostPicked=[...picks.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'it'))[0];
    if($runtime.$('careerHonoursGrid')) $runtime.$('careerHonoursGrid').innerHTML=card('🏆','TROFEI VINTI',String(trophies.length),trophyDetail)+records.join('')+
      card('🔨','PIÙ VOLTE PRESO ALL’ASTA',mostPicked?.name||'—',mostPicked?`${mostPicked.count} acquist${mostPicked.count===1?'o':'i'} all’asta`:'Gli acquisti vengono registrati da questa versione');
  }

  function openCareerHonours(){
    $runtime.renderLeagueStandingsScreen();
    $runtime.$('careerHonoursPanel')?.classList.remove('hidden');
    $runtime.$('openCareerHonoursBtn')?.setAttribute('aria-expanded','true');
    $runtime.$('careerHonoursPanel')?.scrollIntoView({block:'start',behavior:'smooth'});
  }

  function renderLeagueStandingsScreen(){
    $runtime.stopHubNewsCarousel();
    const season=$runtime.ensureSeasonState();
    if(!season) return $runtime.renderSummary();
    $runtime.showScreen('leagueStandingsScreen');
    $runtime.renderLeagueNavActive('standings');
    $runtime.renderCareerWallets();
    const me=$runtime.sortedStandings().find(x=>x.managerId==='user')||season.standings[0];
    if($runtime.$('fullStandingsTitle')) $runtime.$('fullStandingsTitle').textContent=$runtime.fantaclassificaIsActive(season)?`Fantaclassifica · dopo ${me?.played||0} giornate`:`Dopo ${me?.played||0} giornate`;
    if($runtime.$('fullStandingsModeChip')) $runtime.$('fullStandingsModeChip').textContent=$runtime.fantaclassificaIsActive(season)?'🏆 FANTACLASSIFICA ATTIVA · ORDINE PER FPT':'FPT = FANTAPUNTI TOTALI';
    if($runtime.$('fullStandingsBody')) $runtime.$('fullStandingsBody').innerHTML=$runtime.fullStandingsRowsHtml();
    if($runtime.$('fantasyPromotionNote')) $runtime.$('fantasyPromotionNote').textContent=$runtime.careerPromotionNote();
    $runtime.renderCareerHonours();
    document.querySelectorAll('#leagueStandingsScreen [data-standings-sort]').forEach(btn=>{
      btn.onclick=()=>$runtime.setLeagueStandingsSort(btn.dataset.standingsSort);
    });
    $runtime.renderFullStandingsSortState();

    const serieA=$runtime.sortedSerieAStandings();
    const serieADays=serieA[0]?.played||0;
    if($runtime.$('serieAStandingsTitle')) $runtime.$('serieAStandingsTitle').textContent=`Dopo ${serieADays} giornate`;
    if($runtime.$('serieAStandingsBody')) $runtime.$('serieAStandingsBody').innerHTML=serieA.map((s,i)=>{
      const gd=s.gf-s.ga;
      return `<tr><td>${i+1}</td><td><strong>${$runtime.escapeHtml($runtime.clubName(s.clubId))}</strong></td><td>${s.played}</td><td class="pts">${s.points}</td><td>${s.wins}</td><td>${s.draws}</td><td>${s.losses}</td><td>${s.gf}</td><td>${s.ga}</td><td>${gd>0?'+':''}${gd}</td></tr>`;
    }).join('');

    const playerStats=Object.values(season.playerSeasonStats||{});
    const leaderRows=(key)=>{
      const sorted=playerStats.filter(s=>Number(s[key]||0)>0).sort((a,b)=>Number(b[key]||0)-Number(a[key]||0) || Number(b.fantasySum||0)-Number(a.fantasySum||0)).slice(0,10);
      return sorted.length?sorted.map((s,i)=>{
        const player=$runtime.playerMap.get(String(s.playerId)) || (window.FANTA_PLAYERS||[]).find(p=>String(p.id)===String(s.playerId)) || {id:s.playerId,name:s.name,club:s.club};
        return `<button type="button" class="season-leader-row" data-season-player="${$runtime.escapeHtml(s.playerId)}"><span>${i+1}</span><i class="season-leader-face" aria-hidden="true">${$runtime.playerAvatarMarkup(player,s.name)}</i><div><strong>${$runtime.escapeHtml(s.name)}</strong><small>${$runtime.escapeHtml($runtime.clubShort(s.club))} · ${$runtime.escapeHtml($runtime.visibleFormLabel(s.playerId,1,season))}</small></div><b>${Number(s[key]||0)}</b></button>`;
      }).join(''):'<div class="season-leader-empty">Nessun dato ancora.</div>';
    };
    if($runtime.$('topScorersList')) $runtime.$('topScorersList').innerHTML=leaderRows('goals');
    if($runtime.$('topAssistsList')) $runtime.$('topAssistsList').innerHTML=leaderRows('assists');
    $runtime.wireSeasonPlayerButtons($runtime.$('leagueStandingsScreen'));
  }
    return Object.freeze({sortedStandings,sortedFullStandingsForView,renderFullStandingsSortState,setLeagueStandingsSort,managerById,currentUserFixture,userOpponentIdForDay,cpuFormationForDay,pendingBigMatchContext,pendingPartialPerformance,pendingPartialFantasySnapshot,pendingPartialPlayerInfo,seasonPlayerStatCards,renderSeasonPlayerModal,closeSeasonPlayerModal,wireSeasonPlayerButtons,renderLeagueNavActive,standardizeLeagueShells,fullStandingsRowsHtml,fullScheduleHtml,renderCalendarDayResults,leagueFullRosterHtml,openLeagueRosterModal,closeLeagueRosterModal,buildLeagueTopXICards,wireLeagueTopXICards,renderLeagueRostersScreen,renderLeagueCalendarScreen,renderCareerHonours,openCareerHonours,renderLeagueStandingsScreen});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['league-views']=Object.freeze({create});
})();
