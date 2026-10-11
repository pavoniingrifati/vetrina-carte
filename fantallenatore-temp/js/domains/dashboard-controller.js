/* Responsibility: dashboard-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: dashboard-controller');
  function hubNewsTypeLabel(type){
    return ({
      injury:'INFORTUNIO',
      suspension:'SQUALIFICA',
      opponent:'AVVERSARIO',
      form:'IN FORMA',
      cold:'MOMENTO NO',
      scorer:'CAPOCANNONIERE',
      assist:'ASSISTMAN',
      result:'RISULTATO',
      table:'CLASSIFICA',
      streak:'SERIE',
      rivalry:'RIVALITÀ',
      rumor:'INDISCREZIONE',
      record:'RECORD',
      spotlight:'PROTAGONISTA',
      growth:'CRESCITA OVR',
      decline:'CALO OVR',
      info:'NEWS'
    })[type]||'NEWS';
  }

  function hubNewsTheme(type){
    return ({
      injury:'infirmary',
      suspension:'discipline',
      form:'locker',
      cold:'locker',
      growth:'locker',
      decline:'locker',
      result:'match',
      spotlight:'match',
      record:'match',
      table:'table',
      streak:'table',
      scorer:'stats',
      assist:'stats',
      rumor:'market',
      opponent:'coaches',
      rivalry:'coaches',
      info:'match'
    })[type]||'match';
  }

  function ensureSeasonNewsState(season=$runtime.ensureSeasonState()){
    if(!season) return null;
    if(!Array.isArray(season.newsFeed)) season.newsFeed=[];
    if(!season.newsGeneratedDays || typeof season.newsGeneratedDays!=='object') season.newsGeneratedDays={};
    if(!season.newsMeta || typeof season.newsMeta!=='object') season.newsMeta={};
    return season;
  }

  function addSeasonNews(item){
    const season=$runtime.ensureSeasonNewsState();
    if(!season || !item) return null;
    const id=String(item.id||`news_${Date.now()}_${season.newsFeed.length}`);
    const existing=season.newsFeed.find(n=>String(n.id)===id);
    if(existing) return existing;
    const entry={
      id,
      day:$runtime.clamp(Number(item.day||season.currentMatchday||1),1,$runtime.FANTASY_SEASON_MATCHDAYS),
      stage:item.stage||'pre',
      priority:Number(item.priority||50),
      type:item.type||'info',
      title:String(item.title||'News dal campionato'),
      detail:String(item.detail||''),
      playerId:item.playerId!=null?String(item.playerId):null,
      managerId:item.managerId!=null?String(item.managerId):null,
      reliable:item.reliable!==false,
      source:item.source||'Redazione Fantallenatore',
      expiresAfter:Number.isFinite(Number(item.expiresAfter))?Number(item.expiresAfter):3,
      createdAt:Number(item.createdAt||Date.now())
    };
    season.newsFeed.push(entry);
    if(season.newsFeed.length>180) season.newsFeed=season.newsFeed.slice(-180);
    return entry;
  }

  function fantasyResultForManager(day,managerId){
    const season=$runtime.ensureSeasonState();
    const result=season?.matchdayResults?.[String(day)];
    const match=(result?.matches||[]).find(m=>m.homeId===managerId||m.awayId===managerId);
    if(!match) return null;
    const home=match.homeId===managerId;
    const gf=home?Number(match.homeScore||0):Number(match.awayScore||0);
    const ga=home?Number(match.awayScore||0):Number(match.homeScore||0);
    const fantasy=home?Number(match.homeFantasy||0):Number(match.awayFantasy||0);
    const opponentId=home?match.awayId:match.homeId;
    return {day,gf,ga,fantasy,opponentId,outcome:gf>ga?'W':gf<ga?'L':'D',match};
  }

  function recentManagerRun(managerId,throughDay,count=5){
    const items=[];
    for(let d=Math.max(1,Number(throughDay||1)-count+1);d<=Number(throughDay||1);d++){
      const r=$runtime.fantasyResultForManager(d,managerId);
      if(r) items.push(r);
    }
    return items;
  }

  function managerStreak(managerId,throughDay){
    const results=$runtime.recentManagerRun(managerId,throughDay,6).slice().reverse();
    if(!results.length) return {type:null,count:0};
    const type=results[0].outcome;
    let count=0;
    for(const r of results){ if(r.outcome!==type) break; count++; }
    return {type,count};
  }

  function newsFixtureForDay(day){
    const season=$runtime.ensureSeasonState();
    const round=season?.schedule?.[Number(day)-1];
    return (round?.matches||[]).find(m=>m.homeId==='user'||m.awayId==='user')||null;
  }

  function generatePreMatchNews(day){
    const season=$runtime.ensureSeasonNewsState();
    if(!season) return;
    const key=`pre:${day}`;
    if(season.newsGeneratedDays[key]) return;
    const user=$runtime.managerById('user');
    const fixture=$runtime.newsFixtureForDay(day);
    const oppId=fixture?.homeId==='user'?fixture?.awayId:fixture?.homeId;
    const opponent=$runtime.managerById(oppId);
    const stamp=Date.now();
    let created=0;
    const add=(suffix,priority,type,title,detail,opts={})=>{
      $runtime.addSeasonNews({id:`pre_${day}_${suffix}`,day,stage:'pre',priority,type,title,detail,createdAt:stamp+created,...opts});
      created++;
    };

    if(day===1){
      add('kickoff',72,'info','La stagione può cominciare',`${$runtime.state.teamName} debutta nella Fantallenatore League. Da oggi risultati, forma e indisponibili alimenteranno il notiziario.`,{expiresAfter:1});
    }

    const userOut=(user?.roster||[]).map(player=>({player,status:$runtime.playerStatusForDay(player.id,day)})).filter(x=>x.status.unavailable);
    userOut.slice(0,2).forEach(({player,status},i)=>{
      add(`user_out_${player.id}`,120-i,status.type==='suspension'?'suspension':'injury',`${player.name} non sarà disponibile`,`${status.label.replace(/^INFORTUNATO · |^SQUALIFICATO · /,'')} · ${$runtime.clubShort(player.club)}`,{playerId:player.id,expiresAfter:1});
    });

    if(opponent){
      const oppOut=(opponent.roster||[]).map(player=>({player,status:$runtime.playerStatusForDay(player.id,day)})).filter(x=>x.status.unavailable);
      if(oppOut.length){
        const names=oppOut.slice(0,3).map(x=>x.player.name).join(', ');
        add('opponent_out',104,'opponent',`${opponent.team} arriva con ${oppOut.length} ${oppOut.length===1?'assenza':'assenze'}`,`${names}${oppOut.length>3?` +${oppOut.length-3}`:''} · situazione confermata prima della sfida`,{managerId:opponent.id,expiresAfter:1});
      }
      const rel=$runtime.state.auctionEvents?.relationships?.[opponent.id];
      if(rel && (Number(rel.betrayals||0)>0 || Number(rel.rivalry||0)>=12)){
        const detail=Number(rel.betrayals||0)>0
          ? `${opponent.name} non ha dimenticato ciò che è successo durante l'asta.`
          : `Tra te e ${opponent.name} la rivalità nata all'asta è ancora accesa.`;
        add('rivalry',90,'rivalry',`Vecchie tensioni prima di ${$runtime.state.teamName} - ${opponent.team}`,detail,{managerId:opponent.id,expiresAfter:1});
      }
    }

    const userForms=(user?.roster||[]).map(player=>({player,form:$runtime.playerFormMetrics(player.id)})).filter(x=>x.form.count>=2);
    const hot=userForms.filter(x=>x.form.avg>=6.5 || x.form.score>=.45).sort((a,b)=>b.form.score-a.form.score || b.form.avg-a.form.avg)[0];
    const cold=userForms.filter(x=>x.form.avg<=5.75 || x.form.score<=-.55).sort((a,b)=>a.form.score-b.form.score || a.form.avg-b.form.avg)[0];
    if(hot) add(`hot_${hot.player.id}`,94,'form',`${hot.player.name} arriva in grande forma`,`Media ${hot.form.avg.toFixed(2)} nelle ultime ${hot.form.count} presenze · ${hot.form.arrow} trend positivo`,{playerId:hot.player.id,expiresAfter:1});
    if(cold) add(`cold_${cold.player.id}`,70,'cold',`${cold.player.name} attraversa un momento delicato`,`Media ${cold.form.avg.toFixed(2)} nelle ultime ${cold.form.count} presenze · scelta da valutare`,{playerId:cold.player.id,expiresAfter:1});

    if(day>1){
      const standings=$runtime.sortedStandings();
      const pos=standings.findIndex(s=>s.managerId==='user')+1;
      const mine=standings.find(s=>s.managerId==='user');
      if(pos>0 && mine){
        const tableDetail=$runtime.fantaclassificaIsActive(season)
          ? `${Number(mine.fantasyPoints||0).toFixed(1)} fantapunti totali dopo ${mine.played} giornate · Fantaclassifica attiva`
          : `${mine.points} punti dopo ${mine.played} giornate · differenza reti ${mine.gf-mine.ga>=0?'+':''}${mine.gf-mine.ga}`;
        add('table',58,'table',`${$runtime.state.teamName} è ${pos}ª in classifica`,tableDetail,{expiresAfter:1});
      }
    }

    // Un'indiscrezione narrativa al giorno: è chiaramente marcata come non confermata.
    if(day>=2 && $runtime.careerHash(`news-rumor|${day}`)<.58){
      const candidates=(window.FANTA_PLAYERS||[]).filter(p=>!user?.roster?.some(x=>String(x.id)===String(p.id)) && !$runtime.playerStatusForDay(p.id,day).unavailable);
      const player=$runtime.hashPick(candidates,`news-rumor-player|${day}`);
      if(player){
        const rumors=[
          'potrebbe essere gestito con più prudenza del previsto',
          'potrebbe partire dalla panchina secondo alcune voci',
          'viene indicato come possibile sorpresa della giornata',
          'sta attirando molta attenzione nelle ultime ore'
        ];
        const copy=$runtime.hashPick(rumors,`news-rumor-copy|${day}|${player.id}`);
        add(`rumor_${player.id}`,46,'rumor',`Voce di giornata su ${player.name}`,`${$runtime.clubShort(player.club)} · ${copy}. Informazione non confermata.`,{playerId:player.id,reliable:false,source:'Voci dal campo',expiresAfter:1});
      }
    }

    if(!created){
      add('quiet',30,'info','Vigilia senza scossoni','Nessuna notizia urgente: rose e disponibilità non mostrano cambiamenti rilevanti.',{expiresAfter:1});
    }
    season.newsGeneratedDays[key]=Date.now();
  }

  function generatePostMatchNews(day,dayResult=null,liveSnapshot=null){
    const season=$runtime.ensureSeasonNewsState();
    if(!season) return;
    const key=`post:${day}`;
    if(season.newsGeneratedDays[key]) return;
    const result=dayResult||season.matchdayResults?.[String(day)];
    if(!result) return;
    const userMatch=(result.matches||[]).find(m=>m.homeId==='user'||m.awayId==='user');
    const stamp=Date.now();
    let created=0;
    const add=(suffix,priority,type,title,detail,opts={})=>{
      $runtime.addSeasonNews({id:`post_${day}_${suffix}`,day,stage:'post',priority,type,title,detail,createdAt:stamp+created,...opts});
      created++;
    };

    if(userMatch){
      const userHome=userMatch.homeId==='user';
      const us=userHome?Number(userMatch.homeScore||0):Number(userMatch.awayScore||0);
      const them=userHome?Number(userMatch.awayScore||0):Number(userMatch.homeScore||0);
      const oppId=userHome?userMatch.awayId:userMatch.homeId;
      const opponent=$runtime.managerById(oppId);
      const fp=userHome?Number(userMatch.homeFantasy||0):Number(userMatch.awayFantasy||0);
      const outcome=us>them?'Vittoria':us<them?'Sconfitta':'Pareggio';
      add('user_result',132,'result',`${outcome}: ${$runtime.state.teamName} ${us}-${them} ${opponent?.team||''}`.trim(),`${fp.toFixed(1)} fantapunti · giornata ${day}`,{expiresAfter:2});

      const performances=(userHome?userMatch.homePerformances:userMatch.awayPerformances)||[];
      const best=performances.filter(p=>!p.noVote).slice().sort((a,b)=>Number(b.fantasy||0)-Number(a.fantasy||0))[0];
      if(best && Number(best.fantasy||0)>=7.5){
        const player=$runtime.playerMap.get(String(best.playerId));
        add(`spotlight_${best.playerId}`,101,'spotlight',`${best.name} è il protagonista della tua giornata`,`${Number(best.fantasy||0).toFixed(1)} fantapunti${Number(best.goals||0)>0?` · ${best.goals} gol`:''}${Number(best.assists||0)>0?` · ${best.assists} assist`:''}`,{playerId:player?.id||best.playerId,expiresAfter:2});
      }

      const streak=$runtime.managerStreak('user',day);
      if(streak.count>=2 && streak.type!=='D'){
        add('user_streak',83,'streak',streak.type==='W'?`${$runtime.state.teamName}: ${streak.count} vittorie consecutive`:`${$runtime.state.teamName}: ${streak.count} sconfitte consecutive`,streak.type==='W'?'La squadra sta costruendo una striscia positiva.':'Serve una reazione nella prossima giornata.',{expiresAfter:2});
      }
    }

    const standings=$runtime.sortedStandings();
    const pos=standings.findIndex(s=>s.managerId==='user')+1;
    const mine=standings.find(s=>s.managerId==='user');
    if(pos>0 && mine){
      const tableDetail=$runtime.fantaclassificaIsActive(season)
        ? `${Number(mine.fantasyPoints||0).toFixed(1)} fantapunti totali · Fantaclassifica attiva`
        : `${mine.points} punti · ${mine.wins} vittorie, ${mine.draws} pareggi, ${mine.losses} sconfitte`;
      add('table_after',78,'table',pos===1?`${$runtime.state.teamName} è in vetta`:`${$runtime.state.teamName} chiude la giornata al ${pos}° posto`,tableDetail,{expiresAfter:2});
    }

    const richest=(result.matches||[]).slice().sort((a,b)=>(Number(b.homeScore||0)+Number(b.awayScore||0))-(Number(a.homeScore||0)+Number(a.awayScore||0)))[0];
    if(richest && Number(richest.homeScore||0)+Number(richest.awayScore||0)>=5){
      add(`goalfest_${richest.homeId}_${richest.awayId}`,56,'record','Pioggia di gol nella lega',`${richest.homeTeam} ${richest.homeScore}-${richest.awayScore} ${richest.awayTeam} · la partita più spettacolare della giornata`,{expiresAfter:2});
    }

    // Infortuni/squalifiche emersi durante la simulazione, con priorità alla rosa utente.
    const userIds=new Set(($runtime.managerById('user')?.roster||[]).map(p=>String(p.id)));
    const liveEvents=liveSnapshot?.events||[];
    const seenStatus=new Set();
    liveEvents.forEach(ev=>{
      const pid=String(ev.playerId||'');
      if(!pid || seenStatus.has(pid) || !userIds.has(pid)) return;
      if(ev.type!=='injury' && ev.type!=='red' && ev.type!=='yellow') return;
      const nextStatus=$runtime.playerStatusForDay(pid,Math.min(18,day+1));
      if(!nextStatus.unavailable) return;
      const player=$runtime.playerMap.get(pid) || (window.FANTA_PLAYERS||[]).find(p=>String(p.id)===pid); if(!player) return;
      seenStatus.add(pid);
      add(`status_${pid}`,116,nextStatus.type==='injury'?'injury':'suspension',nextStatus.type==='injury'?`Stop per ${player.name}`:`${player.name} salterà la prossima`,`${nextStatus.label.replace(/^INFORTUNATO · |^SQUALIFICATO · /,'')} · ${$runtime.clubShort(player.club)}`,{playerId:pid,expiresAfter:2});
    });

    const allStats=Object.values(season.playerSeasonStats||{});
    const topScorer=allStats.filter(st=>Number(st.goals||0)>0).sort((a,b)=>Number(b.goals||0)-Number(a.goals||0)||Number(b.fantasySum||0)-Number(a.fantasySum||0))[0];
    if(topScorer && String(season.newsMeta.topScorerId||'')!==String(topScorer.playerId)){
      season.newsMeta.topScorerId=String(topScorer.playerId);
      add(`scorer_${topScorer.playerId}`,64,'scorer',`${topScorer.name} guida i marcatori`,`${Number(topScorer.goals||0)} gol · ${$runtime.clubShort(topScorer.club)}`,{playerId:topScorer.playerId,expiresAfter:3});
    }
    const topAssist=allStats.filter(st=>Number(st.assists||0)>0).sort((a,b)=>Number(b.assists||0)-Number(a.assists||0)||Number(b.fantasySum||0)-Number(a.fantasySum||0))[0];
    if(topAssist && String(season.newsMeta.topAssistId||'')!==String(topAssist.playerId)){
      season.newsMeta.topAssistId=String(topAssist.playerId);
      add(`assist_${topAssist.playerId}`,61,'assist',`${topAssist.name} sale in testa agli assistman`,`${Number(topAssist.assists||0)} assist · ${$runtime.clubShort(topAssist.club)}`,{playerId:topAssist.playerId,expiresAfter:3});
    }

    // Una CPU in crisi o in striscia positiva rende la lega più viva.
    const cpuRuns=$runtime.state.managers.filter(m=>m.id!=='user').map(m=>({m,streak:$runtime.managerStreak(m.id,day)})).filter(x=>x.streak.count>=3 && x.streak.type!=='D');
    const notable=cpuRuns.sort((a,b)=>b.streak.count-a.streak.count)[0];
    if(notable){
      add(`cpu_streak_${notable.m.id}`,50,'streak',notable.streak.type==='W'?`${notable.m.team} non si ferma più`:`Crisi per ${notable.m.team}`,notable.streak.type==='W'?`${notable.streak.count} vittorie consecutive per ${notable.m.name}.`:`${notable.streak.count} sconfitte consecutive: cresce la pressione su ${notable.m.name}.`,{managerId:notable.m.id,expiresAfter:2});
    }

    season.newsGeneratedDays[key]=Date.now();
  }

  function ensureSeasonNewsForCurrentState(){
    const season=$runtime.ensureSeasonNewsState();
    if(!season) return;
    // I vecchi salvataggi iniziano l'archivio dalla giornata corrente: evitiamo di
    // inventare retroattivamente notizie usando la classifica/stats attuali.
    if(!season.completed) $runtime.generatePreMatchNews(season.currentMatchday||1);
  }

  function buildHubNews(){
    const season=$runtime.ensureSeasonNewsState();
    if(!season) return [];
    $runtime.ensureSeasonNewsForCurrentState();
    const day=season.currentMatchday||18;
    return season.newsFeed
      .filter(item=>{
        const age=Math.max(0,day-Number(item.day||day));
        return age<=Number(item.expiresAfter??3) || Number(item.day)===Number(day);
      })
      .map(item=>{
        const age=Math.max(0,day-Number(item.day||day));
        const currentBoost=Number(item.day)===Number(day)?18:0;
        const stageBoost=item.stage==='pre' && Number(item.day)===Number(day)?10:0;
        return {...item,_score:Number(item.priority||0)-age*13+currentBoost+stageBoost};
      })
      .sort((a,b)=>b._score-a._score || Number(b.createdAt||0)-Number(a.createdAt||0))
      .slice(0,6);
  }

  function newsReliabilityLabel(item){
    if(item?.reliable===false) return 'NON CONFERMATA';
    if(item?.type==='form'||item?.type==='cold'||item?.type==='table'||item?.type==='streak') return 'ANALISI';
    return 'CONFERMATA';
  }

  function seasonNewsPlayerAvatarHtml(item){
    const pid=String(item?.playerId||'');
    if(!pid) return '';
    const player=$runtime.playerMap.get(pid) || (window.FANTA_PLAYERS||[]).find(p=>String(p.id)===pid);
    if(!player) return '';
    return `<span class="season-news-player-avatar">${$runtime.playerAvatarMarkup(player,player.name)}</span>`;
  }

  function renderSeasonNewsArchive(){
    const season=$runtime.ensureSeasonNewsState();
    const list=$runtime.$('seasonNewsArchiveList');
    if(!season || !list) return;
    $runtime.ensureSeasonNewsForCurrentState();
    const news=season.newsFeed.slice().sort((a,b)=>Number(b.day||0)-Number(a.day||0)||Number(b.createdAt||0)-Number(a.createdAt||0));
    list.innerHTML=news.length?news.map(item=>`
      <article class="season-news-archive-item type-${item.type} ${item.playerId?'has-player-avatar':''} ${item.playerId?'is-clickable':''}" ${item.playerId?`data-season-player="${$runtime.escapeHtml(item.playerId)}"`:''}>
        ${item.playerId?$runtime.seasonNewsPlayerAvatarHtml(item):''}
        <div class="season-news-archive-copy">
          <div class="season-news-archive-meta">
            <span>${$runtime.hubNewsTypeLabel(item.type)}</span>
            <b>G${item.day}</b>
            <em class="${item.reliable===false?'rumor':'confirmed'}">${$runtime.newsReliabilityLabel(item)}</em>
          </div>
          <strong>${$runtime.escapeHtml(item.title)}</strong>
          <p>${$runtime.escapeHtml($runtime.visibleNewsDetail(item,season))}</p>
          <small>${$runtime.escapeHtml(item.source||'Redazione Fantallenatore')}</small>
        </div>
      </article>
    `).join(''):'<div class="hub-news-empty">L’archivio è ancora vuoto.</div>';
    if($runtime.$('seasonNewsArchiveCount')) $runtime.$('seasonNewsArchiveCount').textContent=`${news.length} notizi${news.length===1?'a':'e'}`;
    $runtime.wireSeasonPlayerButtons(list);
  }

  function openSeasonNewsArchive(){
    const modal=$runtime.$('seasonNewsModal'); if(!modal) return;
    $runtime.renderSeasonNewsArchive();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
  }

  function closeSeasonNewsArchive(){
    const modal=$runtime.$('seasonNewsModal'); if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
  }

  function stopHubNewsCarousel(){
    if($runtime.hubNewsCarouselTimer){
      clearInterval($runtime.hubNewsCarouselTimer);
      $runtime.hubNewsCarouselTimer=null;
    }
  }

  function setHubNewsSlide(index,restart=false){
    if(!$runtime.hubNewsCarouselCount) return;
    $runtime.hubNewsCarouselIndex=((Number(index)||0)%$runtime.hubNewsCarouselCount+$runtime.hubNewsCarouselCount)%$runtime.hubNewsCarouselCount;

    const track=$runtime.$('hubNewsTrack');
    if(track) track.style.transform=`translateX(-${$runtime.hubNewsCarouselIndex*100}%)`;

    document.querySelectorAll('#hubNewsDots [data-hub-news-dot]').forEach((dot,i)=>{
      dot.classList.toggle('active',i===$runtime.hubNewsCarouselIndex);
      dot.setAttribute('aria-current',i===$runtime.hubNewsCarouselIndex?'true':'false');
    });

    if($runtime.$('hubNewsCounter')) $runtime.$('hubNewsCounter').textContent=`${$runtime.hubNewsCarouselIndex+1} / ${$runtime.hubNewsCarouselCount}`;

    if(restart){
      $runtime.stopHubNewsCarousel();
      $runtime.startHubNewsCarousel();
    }
  }

  function startHubNewsCarousel(){
    $runtime.stopHubNewsCarousel();
    if($runtime.hubNewsCarouselCount<=1) return;
    $runtime.hubNewsCarouselTimer=window.setInterval(()=>{
      $runtime.setHubNewsSlide($runtime.hubNewsCarouselIndex+1,false);
    },5200);
  }

  function renderHubNews(){
    const track=$runtime.$('hubNewsTrack');
    const dots=$runtime.$('hubNewsDots');
    if(!track || !dots) return;

    $runtime.stopHubNewsCarousel();
    const news=$runtime.buildHubNews();
    $runtime.hubNewsCarouselCount=news.length;
    $runtime.hubNewsCarouselIndex=Math.min($runtime.hubNewsCarouselIndex,Math.max(0,news.length-1));

    track.innerHTML=news.length?news.map(item=>`
      <div class="hub-news-slide">
        <button type="button" class="hub-news-item type-${item.type} news-theme-${$runtime.hubNewsTheme(item.type)} ${item.playerId?'has-player-avatar':''} ${item.playerId?'is-clickable':''}" ${item.playerId?`data-season-player="${$runtime.escapeHtml(item.playerId)}"`:''}>
          <div class="hub-news-lead">
            <span class="hub-news-type">${$runtime.hubNewsTypeLabel(item.type)}</span>
            ${item.playerId?$runtime.seasonNewsPlayerAvatarHtml(item):''}
          </div>
          <div class="hub-news-copy">
            <div class="hub-news-meta-line"><em class="${item.reliable===false?'rumor':'confirmed'}">${$runtime.newsReliabilityLabel(item)}</em><span>G${item.day}</span></div>
            <strong>${$runtime.escapeHtml(item.title)}</strong>
            <small>${$runtime.escapeHtml($runtime.visibleNewsDetail(item,$runtime.ensureSeasonState()))}</small>
          </div>
          ${item.playerId?'<span class="hub-news-arrow">→</span>':''}
        </button>
      </div>
    `).join(''):'<div class="hub-news-slide"><div class="hub-news-empty">Nessuna notizia rilevante al momento.</div></div>';

    const miniList=$runtime.$('hubNewsMiniList');
    if(miniList){
      miniList.innerHTML=news.slice(1,4).map(item=>`
        <button type="button" class="dashboard-news-mini type-${item.type} news-theme-${$runtime.hubNewsTheme(item.type)} ${item.playerId?'has-player-avatar':''} ${item.playerId?'is-clickable':''}" ${item.playerId?`data-season-player="${$runtime.escapeHtml(item.playerId)}"`:''}>
          <div class="dashboard-news-mini-lead">
            ${item.playerId?$runtime.seasonNewsPlayerAvatarHtml(item):`<span class="dashboard-news-mini-type">${$runtime.hubNewsTypeLabel(item.type)}</span>`}
            ${item.playerId?`<span class="dashboard-news-mini-tag">${$runtime.hubNewsTypeLabel(item.type)}</span>`:''}
          </div>
          <div><strong>${$runtime.escapeHtml(item.title)}</strong><small>${$runtime.escapeHtml($runtime.visibleNewsDetail(item,$runtime.ensureSeasonState()))}</small></div>
          <b>›</b>
        </button>
      `).join('');
      $runtime.wireSeasonPlayerButtons(miniList);
    }

    $runtime.hubNewsCarouselCount=Math.max(1,news.length);

    dots.innerHTML=Array.from({length:$runtime.hubNewsCarouselCount},(_,i)=>`
      <button type="button" class="hub-news-dot ${i===$runtime.hubNewsCarouselIndex?'active':''}" data-hub-news-dot="${i}" aria-label="Vai alla news ${i+1}" aria-current="${i===$runtime.hubNewsCarouselIndex?'true':'false'}"></button>
    `).join('');

    dots.querySelectorAll('[data-hub-news-dot]').forEach(dot=>{
      dot.addEventListener('click',()=>$runtime.setHubNewsSlide(Number(dot.dataset.hubNewsDot),true));
    });

    $runtime.wireSeasonPlayerButtons(track);
    $runtime.setHubNewsSlide($runtime.hubNewsCarouselIndex,false);
    $runtime.startHubNewsCarousel();
  }

  function managerRecentLeagueResults(managerId,limit=5){
    const season=$runtime.ensureSeasonState();
    if(!season || !managerId) return [];
    const out=[];
    for(let day=Math.max(1,Number(season.currentMatchday||1)-1);day>=1 && out.length<limit;day--){
      const result=season.matchdayResults?.[String(day)];
      const match=(result?.matches||[]).find(m=>m.homeId===managerId||m.awayId===managerId);
      if(!match) continue;
      const home=match.homeId===managerId;
      const gf=Number(home?match.homeScore:match.awayScore)||0;
      const ga=Number(home?match.awayScore:match.homeScore)||0;
      const fp=Number(home?match.homeFantasy:match.awayFantasy)||0;
      out.push({day,gf,ga,fp,result:gf>ga?'W':gf<ga?'L':'D'});
    }
    return out.reverse();
  }

  function deterministicCpuFormation(manager,day=$runtime.ensureSeasonState()?.currentMatchday||1){
    if(!manager) return '4-3-3';
    const type=manager.profile?.archetype||'';
    return $runtime.availableLineupFormations().map(key=>{
      const counts=$runtime.lineupCountsForFormation(key);
      let score=0;
      for(const role of ['P','D','C','A']) score+=$runtime.bestPlayersForRole(manager,role,counts[role]).reduce((s,p)=>s+$runtime.lineupPlayerValue(p),0);
      let bonus=0;
      if(['bomber','collezionista','spendaccione'].includes(type)) bonus+=counts.A===3?180:0;
      if(['ragioniere','tirchio','esperto'].includes(type)) bonus+=counts.D>=4?90:0;
      if(type==='moneyball') bonus+=counts.C>=4?110:0;
      if(type==='pazzo') bonus+=($runtime.careerHash(`match-center-formation|${day}|${manager.id}|${key}`)-.5)*220;
      bonus+=$runtime.cpuLeagueFormationBias(manager,key,day);
      return {key,score:score+bonus};
    }).sort((a,b)=>b.score-a.score)[0]?.key||'4-3-3';
  }

  function managerMostUsedFormation(manager){
    const season=$runtime.ensureSeasonState();
    if(!season || !manager) return '4-3-3';
    const counts={};
    for(let day=1;day<Number(season.currentMatchday||1);day++){
      const formation=season.lineups?.[String(day)]?.[manager.id]?.formation;
      if($runtime.LINEUP_FORMATIONS[formation]) counts[formation]=(counts[formation]||0)+1;
    }
    const historical=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0];
    return historical||$runtime.deterministicCpuFormation(manager,season.currentMatchday||1);
  }

  function matchCenterProbablePlayers(manager,formation){
    if(!manager) return [];
    const counts=$runtime.lineupCountsForFormation(formation);
    const out=[];
    ['P','D','C','A'].forEach(role=>{
      const players=(manager.roster||[]).filter(p=>p.role===role).slice().sort((a,b)=>{
        const au=$runtime.playerStatusForDay(a.id,$runtime.state?.season?.currentMatchday||1).unavailable?1:0;
        const bu=$runtime.playerStatusForDay(b.id,$runtime.state?.season?.currentMatchday||1).unavailable?1:0;
        return au-bu || $runtime.estimatedStarterProbability(b)-$runtime.estimatedStarterProbability(a) || $runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a);
      }).slice(0,counts[role]||0);
      players.forEach(p=>out.push(p));
    });
    return out;
  }

  function managerRoleData(manager){
    return ['P','D','C','A'].map(role=>{
      const players=(manager?.roster||[]).filter(p=>p.role===role);
      const ovr=players.length?players.reduce((s,p)=>s+$runtime.currentPlayerOvr(p),0)/players.length:0;
      const voted=players.map(p=>$runtime.playerSeasonStat(p.id)).filter(st=>Number(st?.voteCount||0)>0);
      const fmVotes=voted.reduce((s,st)=>s+Number(st.voteCount||0),0);
      const fm=fmVotes?voted.reduce((s,st)=>s+Number(st.fantasySum||0),0)/fmVotes:null;
      return {role,ovr,fm,count:players.length};
    });
  }

  function matchCenterKeyPlayer(manager,dataPro=false){
    const available=(manager?.roster||[]).filter(p=>!$runtime.playerStatusForDay(p.id,$runtime.state?.season?.currentMatchday||1).unavailable);
    const pool=available.length?available:(manager?.roster||[]);
    return pool.slice().sort((a,b)=>{
      if(dataPro){
        const av=$runtime.playerSeasonStat(a.id),bv=$runtime.playerSeasonStat(b.id);
        const af=av?.voteCount?Number(av.fantasySum||0)/Number(av.voteCount):0;
        const bf=bv?.voteCount?Number(bv.fantasySum||0)/Number(bv.voteCount):0;
        if(Math.abs(bf-af)>.01) return bf-af;
      }
      return $runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a);
    })[0]||null;
  }

  function matchCenterRecommendedFormation(userManager,opponentFormation){
    if(!userManager) return '4-3-3';
    const oppCounts=$runtime.lineupCountsForFormation(opponentFormation||'4-3-3');
    return $runtime.availableLineupFormations().map(key=>{
      const built=$runtime.buildAdvancedAutoLineup(userManager,key);
      const counts=$runtime.lineupCountsForFormation(key);
      let score=Object.values(built.starters).reduce((sum,id)=>sum+$runtime.advancedAutoLineupValue($runtime.playerMap.get(String(id))||userManager.roster.find(p=>String(p.id)===String(id))),0);
      if(oppCounts.A>=3 && counts.D>=4) score+=95;
      if(oppCounts.C>=4 && counts.C>=4) score+=60;
      if(oppCounts.D>=5 && counts.A>=3) score+=55;
      return {key,score};
    }).sort((a,b)=>b.score-a.score)[0]?.key||'4-3-3';
  }

  function renderMatchCenter(){
    const season=$runtime.ensureSeasonState(),me=$runtime.managerById('user');
    if(!season || !me) return;
    const day=Number(season.currentMatchday||1);
    const dataPro=$runtime.shopItemActive('fantadata_pro',season);
    const scoutPlus=$runtime.shopItemActive('scout_plus',season);
    const assistant=$runtime.shopItemActive('assistant_coach',season);
    const roster=(me.roster||[]).slice();
    const available=roster.filter(p=>!$runtime.playerStatusForDay(p.id,day).unavailable);
    const unavailable=roster.filter(p=>$runtime.playerStatusForDay(p.id,day).unavailable);
    const avgOvr=roster.length?roster.reduce((sum,p)=>sum+$runtime.currentPlayerOvr(p),0)/roster.length:0;
    const totals=roster.reduce((acc,p)=>{
      const st=$runtime.playerSeasonStat(p.id)||$runtime.emptyPlayerSeasonStat(p);
      acc.goals+=Number(st.goals||0); acc.assists+=Number(st.assists||0);
      acc.minutes+=Number(st.minutes||0); acc.apps+=Number(st.appearances||0);
      return acc;
    },{goals:0,assists:0,minutes:0,apps:0});

    let assistantFormation=null,assistantXI=new Set();
    if(assistant){
      assistantFormation=$runtime.bestAdvancedFormation(me);
      const built=$runtime.buildAdvancedAutoLineup(me,assistantFormation);
      assistantXI=new Set(Object.values(built.starters||{}).map(String));
    }

    const rows=roster.slice().sort((a,b)=>{
      const roleOrder={P:0,D:1,C:2,A:3};
      const ar=roleOrder[a.role]??9,br=roleOrder[b.role]??9;
      if(ar!==br) return ar-br;
      return $runtime.currentPlayerOvr(b)-$runtime.currentPlayerOvr(a) || String(a.name).localeCompare(String(b.name),'it');
    });

    const rowHtml=rows.map(p=>{
      const st=$runtime.playerSeasonStat(p.id)||$runtime.emptyPlayerSeasonStat(p);
      const status=$runtime.playerStatusForDay(p.id,day);
      const form=$runtime.playerFormMetrics(p.id);
      const mv=Number(st.voteCount||0)>0?Number(st.voteSum||0)/Number(st.voteCount):null;
      const fm=Number(st.voteCount||0)>0?Number(st.fantasySum||0)/Number(st.voteCount):null;
      const pct=scoutPlus?$runtime.estimatedStarterProbability(p):null;
      const pctClass=pct===null?'':pct>=70?'high':pct>=40?'medium':'low';
      const serieAFixture=$runtime.serieAFixtureForPlayer(p,day);
      const serieADifficulty=dataPro?$runtime.serieAMatchupDifficulty(p,day):null;
      const recent=dataPro&&form.recent.length
        ? form.recent.map(x=>`<span title="G${Number(x.day||0)} · FV ${Number(x.fantasy||0).toFixed(1)}">${Number(x.vote).toFixed(1)}</span>`).join('')
        : '';
      const assistantLabel=assistant
        ? (assistantXI.has(String(p.id))?'<b class="dc-auto-xi starter">✓ AUTO XI</b>':'<b class="dc-auto-xi bench">PANCHINA</b>')
        : '<span class="dc-locked">🔒 Assistente</span>';
      return `<button type="button" class="dc-player-row ${status.unavailable?'is-unavailable':''}" data-season-player="${$runtime.escapeHtml(p.id)}">
        <span class="lineup-role-chip role-${$runtime.escapeHtml(p.role)}">${$runtime.escapeHtml(p.role)}</span>
        <span class="dc-player-name"><strong>${$runtime.escapeHtml(p.name)}</strong><small>${$runtime.escapeHtml(p.club||'')} · OVR ${$runtime.playerOvrLabel(p)}</small><em class="dc-seriea-fixture">${serieAFixture?`vs ${$runtime.escapeHtml(serieAFixture.opponentName)} · ${serieAFixture.home?'Casa':'Trasferta'}`:'Serie A · —'}</em></span>
        <span class="dc-status ${status.className}"><b>${status.unavailable?'OUT':'OK'}</b><small>${$runtime.escapeHtml(status.unavailable?status.label:'Disponibile')}</small></span>
        <span class="dc-base-stats"><b>P ${Number(st.appearances||0)} · T ${Number(st.starts||0)}</b><small>${Number(st.minutes||0)} min · ⚽ ${Number(st.goals||0)} · 🅰 ${Number(st.assists||0)}</small></span>
        <span class="dc-scout-cell ${scoutPlus?pctClass:'locked'}">${scoutPlus?`<b>${pct}%</b><small>Titolarità stimata</small>`:'<b>🔒</b><small>Scout Plus</small>'}</span>
        <span class="dc-data-cell ${dataPro?'active':'locked'}">${dataPro?`<b>MV ${mv===null?'—':mv.toFixed(2)} · FM ${fm===null?'—':fm.toFixed(2)}</b><small>${form.count?`${form.arrow} forma ${form.avg.toFixed(2)}`:'Forma N/D'}</small>${serieADifficulty?$runtime.serieAMatchupBadgeHtml(p,day):''}${recent?`<em class="dc-recent">${recent}</em>`:''}`:`<b>${$runtime.escapeHtml($runtime.qualitativeFormLabel(form))}</b><small>🔒 numeri + difficoltà partita FantaData</small>`}</span>
        <span class="dc-assistant-cell">${assistantLabel}</span>
        <span class="dc-row-arrow">→</span>
      </button>`;
    }).join('');

    let scoutSummary='';
    if(scoutPlus){
      const probs=available.map(p=>({p,pct:$runtime.estimatedStarterProbability(p)}));
      const safe=probs.filter(x=>x.pct>=70).length;
      const risk=probs.filter(x=>x.pct<40).length;
      const best=probs.slice().sort((a,b)=>b.pct-a.pct)[0];
      scoutSummary=`<div class="mc-premium active"><div class="mc-premium-head"><div><span>🎯 SCOUT PLUS</span><h3>Titolarità della tua rosa</h3></div><b>ATTIVO</b></div><div class="dc-premium-kpis"><div><strong>${safe}</strong><span>≥70%</span></div><div><strong>${risk}</strong><span>&lt;40%</span></div><div><strong>${best?`${best.pct}%`:'—'}</strong><span>STIMA PIÙ ALTA</span></div></div></div>`;
    }else{
      scoutSummary=`<div class="mc-premium locked"><div class="mc-premium-head"><div><span>🎯 SCOUT PLUS</span><h3>Titolarità stimata</h3></div><b>🔒 NON ATTIVO</b></div><p>Sblocca la probabilità stimata di titolarità per ogni giocatore della tua rosa.</p></div>`;
    }

    let dataSummary='';
    if(dataPro){
      const withVotes=roster.map(p=>{const st=$runtime.playerSeasonStat(p.id)||$runtime.emptyPlayerSeasonStat(p);return {p,st,fm:st.voteCount?Number(st.fantasySum||0)/Number(st.voteCount):null,mv:st.voteCount?Number(st.voteSum||0)/Number(st.voteCount):null,form:$runtime.playerFormMetrics(p.id)}}).filter(x=>x.fm!==null);
      const bestFm=withVotes.slice().sort((a,b)=>b.fm-a.fm)[0];
      const hot=withVotes.slice().sort((a,b)=>b.form.score-a.form.score)[0];
      const teamFm=withVotes.length?withVotes.reduce((s,x)=>s+x.fm,0)/withVotes.length:null;
      const favorableCount=roster.filter(p=>$runtime.serieAMatchupDifficulty(p,day)?.key==='favorable').length;
      dataSummary=`<div class="mc-premium active"><div class="mc-premium-head"><div><span>📊 FANTADATA PRO</span><h3>Rendimento + calendario Serie A</h3></div><b>ATTIVO</b></div><div class="dc-premium-kpis"><div><strong>${teamFm===null?'—':teamFm.toFixed(2)}</strong><span>FM MEDIA</span></div><div><strong>${bestFm?$runtime.escapeHtml(bestFm.p.name):'—'}</strong><span>MIGLIOR FM</span></div><div><strong>${hot?$runtime.escapeHtml(hot.p.name):'—'}</strong><span>PIÙ IN FORMA</span></div><div><strong>${favorableCount}</strong><span>MATCH FAVOREVOLI</span></div></div></div>`;
    }else{
      dataSummary=`<div class="mc-premium locked"><div class="mc-premium-head"><div><span>📊 FANTADATA PRO</span><h3>Rendimento dettagliato</h3></div><b>🔒 NON ATTIVO</b></div><p>Sblocca media voto, fantamedia, forma numerica, ultime 5 prestazioni e difficoltà dell’avversario Serie A.</p></div>`;
    }

    const assistantSummary=assistant
      ? `<div class="mc-premium assistant active"><div class="mc-premium-head"><div><span>🧠 ASSISTENTE TECNICO</span><h3>Selezione automatica</h3></div><b>ATTIVO</b></div><div class="mc-assistant-advice"><strong>Modulo AUTO XI suggerito: ${assistantFormation}</strong><p>${$runtime.assistantAutoLineupAnalysisHtml(season)}</p><span>I giocatori marcati <b>AUTO XI</b> sono quelli che l'Assistente schiererebbe oggi.</span><button id="matchCenterOpenLineup" class="primary">VAI A SCHIERA FORMAZIONE →</button></div></div>`
      : `<div class="mc-premium assistant locked"><div class="mc-premium-head"><div><span>🧠 ASSISTENTE TECNICO</span><h3>AUTO XI e gestione formazione</h3></div><b>🔒 NON ATTIVO</b></div><p>Sblocca il modulo consigliato e l'indicazione dei giocatori che AUTO XI schiererebbe, usando solo i dati degli abbonamenti che possiedi.</p></div>`;

    const body=$runtime.$('matchCenterBody');
    if(!body) return;
    if($runtime.$('matchCenterTitle')) $runtime.$('matchCenterTitle').textContent=`${$runtime.state.teamName||me.team} · Data Center`;
    if($runtime.$('matchCenterSubtitle')) $runtime.$('matchCenterSubtitle').textContent=`Giornata ${day} · informazioni sulla tua rosa · ${roster.length} giocatori`;
    body.innerHTML=`
      <section class="mc-hero dc-hero">
        <div class="mc-opponent-identity dc-team-identity"><span class="fixture-tag">LA TUA ROSA</span><h3>${$runtime.escapeHtml($runtime.state.teamName||me.team)}</h3><p>Dati aggiornati alla giornata ${day}</p></div>
        <div class="mc-kpis dc-kpis"><div><strong>${roster.length}</strong><span>GIOCATORI</span></div><div><strong>${available.length}</strong><span>DISPONIBILI</span></div><div><strong>${unavailable.length}</strong><span>OUT</span></div><div><strong>${avgOvr.toFixed(1)}</strong><span>OVR MEDIO</span></div></div>
      </section>
      <section class="mc-card dc-free-summary"><div class="mc-card-head"><span>DATI BASE · GRATUITI</span><strong>Presenze, titolarità, minuti, gol e assist</strong></div><div class="dc-free-kpis"><div><b>${totals.goals}</b><small>GOL ROSA</small></div><div><b>${totals.assists}</b><small>ASSIST ROSA</small></div><div><b>${totals.apps}</b><small>PRESENZE TOTALI</small></div><div><b>${totals.minutes}</b><small>MINUTI TOTALI</small></div></div></section>
      <section class="mc-grid two dc-premium-grid">${scoutSummary}${dataSummary}</section>
      ${assistantSummary}
      <section class="mc-card dc-roster-card"><div class="mc-card-head"><span>DATA CENTER GIOCATORI</span><strong>Clicca un giocatore per aprire la scheda completa</strong></div><div class="dc-column-legend"><span>BASE</span><span>SCOUT PLUS</span><span>FANTADATA</span><span>ASSISTENTE</span></div><div class="dc-player-list">${rowHtml}</div></section>`;
    $runtime.wireSeasonPlayerButtons(body);
    body.querySelector('#matchCenterOpenLineup')?.addEventListener('click',()=>{$runtime.closeMatchCenter();$runtime.requestOpenLineup();});
  }

  function openMatchCenter(){
    const modal=$runtime.$('matchCenterModal');
    if(!modal) return;
    $runtime.renderMatchCenter();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('match-center-open');
  }

  function closeMatchCenter(){
    const modal=$runtime.$('matchCenterModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('match-center-open');
  }

  function renderSeasonDashboard() {
    const season = $runtime.ensureSeasonState();
    if (!season) return $runtime.renderSummary();
    $runtime.activateWinterTransferWindowIfNeeded();
    if($runtime.routeWinterMarketFlow()) return;
    $runtime.showScreen('seasonScreen');
    $runtime.renderLeagueNavActive('dashboard');
    $runtime.renderCareerWallets();
    const stadiumCard=document.querySelector('#seasonScreen .season-next-card');
    if(stadiumCard) stadiumCard.dataset.division=String($runtime.state?.career?.division||4);
    const day = season.currentMatchday;
    const round = season.schedule[day-1];
    const fixture = $runtime.currentUserFixture();
    const me = $runtime.managerById('user');
    const opponentId = fixture?.homeId==='user' ? fixture.awayId : fixture?.homeId;
    const opponent = $runtime.managerById(opponentId);
    $runtime.ensureManagerTeamIdentityState();
    const isHome = fixture?.homeId==='user';
    const standings = $runtime.sortedStandings();
    const myStanding = standings.find(x=>x.managerId==='user') || season.standings[0];
    const myPos = Math.max(1, standings.findIndex(x=>x.managerId==='user')+1);

    $runtime.$('seasonSubtitle').textContent = `Giornata ${day} di ${$runtime.FANTASY_SEASON_MATCHDAYS} · stagione regolare`;
    $runtime.$('nextMatchdayLabel').textContent = `GIORNATA ${day} / ${$runtime.FANTASY_SEASON_MATCHDAYS}`;
    $runtime.$('homeAwayBadge').textContent = isHome ? 'CASA' : 'TRASFERTA';
    $runtime.$('seasonUserTeam').textContent = me?.team || $runtime.state.teamName;
    $runtime.$('seasonUserManager').textContent = me?.name || $runtime.state.managerName;
    $runtime.$('nextOpponentName').textContent = opponent?.team || '—';
    $runtime.$('nextOpponentManager').textContent = opponent ? `${opponent.name} · ${opponent.profile?.label||'CPU'}` : '—';
    $runtime.applySeasonFixtureHeroVisuals(me, opponent);

    $runtime.$('matchdayFixturesTitle').textContent = `Giornata ${day}`;

    $runtime.$('matchdayFixtures').innerHTML = (round?.matches||[]).map((m,i) => {
      const home=$runtime.managerById(m.homeId), away=$runtime.managerById(m.awayId);
      const userMatch=m.homeId==='user'||m.awayId==='user';
      return `<div class="season-fixture-row ${userMatch?'is-user-fixture':''}">
        <span class="fixture-index">${String(i+1).padStart(2,'0')}</span>
        <strong class="fixture-home">${$runtime.escapeHtml(home?.team||'—')}</strong>
        <span class="fixture-score">${m.played?`${m.homeScore} - ${m.awayScore}`:'VS'}</span>
        <strong class="fixture-away">${$runtime.escapeHtml(away?.team||'—')}</strong>
      </div>`;
    }).join('');

    if($runtime.$('standingsBodySimple')){
      const myIndex=standings.findIndex(s=>s.managerId==='user');
      const compact=standings.slice(0,5).map((s,i)=>({s,i}));
      if(myIndex>=5) compact.push({separator:true},{s:standings[myIndex],i:myIndex});
      $runtime.$('standingsBodySimple').innerHTML=compact.map(row=>{
        if(row.separator) return `<tr class="standings-separator"><td colspan="4">···</td></tr>`;
        const {s,i}=row, m=$runtime.managerById(s.managerId);
        const relegated=Number($runtime.state?.career?.division||4)<4 && standings.length>1 && i===standings.length-1;
        const rowClasses=[s.managerId==='user'?'is-user-standing':'',i===0?'is-promotion-standing':'',relegated?'is-relegation-standing relegation-boundary':''].filter(Boolean).join(' ');
        return `<tr class="${rowClasses}">
          <td>${i+1}</td>
          <td><strong>${$runtime.escapeHtml(m?.team||'—')}</strong></td>
          <td>${s.played}</td>
          <td class="pts">${$runtime.fantaclassificaIsActive(season)?Number(s.fantasyPoints||0).toFixed(1):s.points}</td>
        </tr>`;
      }).join('');
    }
    if(!season.lineups?.[String(day)]?.user && $runtime.assistantCoachCarryEnabled(season)){
      $runtime.seedAssistantCoachLineupForDay(day,season);
    }
    const savedLineup = season.lineups?.[String(day)]?.user;
    if ($runtime.$('lineupBtn')) {
      $runtime.$('lineupBtn').disabled = false;
      $runtime.$('lineupBtn').textContent = savedLineup?.confirmed ? 'MODIFICA FORMAZIONE · 11/11' : 'SCHIERA FORMAZIONE';
      $runtime.$('lineupBtn').classList.toggle('lineup-ready', !!savedLineup?.confirmed);
    }
    $runtime.renderOpponentMalusBanner(season,day);
    const pendingBigMatch = season.pendingBigMatch?.day===day ? season.pendingBigMatch : null;
    const flow=$runtime.ensureMatchdayFlowEntry(season,day);
    if ($runtime.$('playMatchdayBtn')) {
      const roundPlayed = !!round?.matches?.every(m=>m.played);
      const phase=flow?.phase||'lineup';
      const dashboardReady=phase==='match_ready';
      const eventPending=phase==='event_pending';
      $runtime.$('playMatchdayBtn').disabled = !season.completed && (!!pendingBigMatch || !savedLineup?.confirmed || roundPlayed || phase==='live');
      $runtime.$('playMatchdayBtn').textContent = pendingBigMatch
        ? 'DIRETTA GOL CONCLUSA'
        : (season.completed ? 'FINE STAGIONE' : (roundPlayed ? 'GIORNATA GIOCATA' : (eventPending ? 'SCEGLI CARTA' : (dashboardReady ? 'DIRETTA GOL' : 'CONTINUA'))));
      $runtime.$('playMatchdayBtn').classList.toggle('is-live-ready',dashboardReady && !pendingBigMatch && !roundPlayed && !season.completed);
      $runtime.$('playMatchdayBtn').classList.toggle('is-event-pending',eventPending && !pendingBigMatch && !roundPlayed && !season.completed);
    }
    if ($runtime.$('simulateMatchdayBtn')) {
      const roundPlayed = !!round?.matches?.every(m=>m.played);
      const phase=flow?.phase||'lineup';
      const canSimulate=phase==='match_ready' && !!savedLineup?.confirmed && !pendingBigMatch && !roundPlayed && !season.completed;
      $runtime.$('simulateMatchdayBtn').classList.toggle('hidden',!canSimulate);
      $runtime.$('simulateMatchdayBtn').disabled=!canSimulate;
    }
    if ($runtime.$('lineupBtn')) {
      if (pendingBigMatch) {
        const partial=$runtime.pendingPartialFantasySnapshot('user');
        $runtime.$('lineupBtn').disabled=false;
        $runtime.$('lineupBtn').textContent=partial ? `VEDI ROSA · ${partial.fantasyPoints.toFixed(1)} PT` : 'VEDI ROSA · PARZIALE';
        $runtime.$('lineupBtn').classList.add('lineup-locked-preview');
      } else {
        $runtime.$('lineupBtn').classList.remove('lineup-locked-preview');
      }
    }

    const pendingCard=$runtime.$('pendingBigMatchHubCard');
    const pendingBtn=$runtime.$('startPendingBigMatchBtn');
    if(pendingBigMatch?.snapshot){
      const bm=pendingBigMatch.snapshot.matches?.[pendingBigMatch.bigMatchIndex];
      const bigLabel=bm ? `${$runtime.clubName(bm.homeClub)} vs ${$runtime.clubName(bm.awayClub)}` : 'Big Match';
      if(pendingCard) pendingCard.style.display='';
      if($runtime.$('pendingBigMatchTitle')) $runtime.$('pendingBigMatchTitle').textContent=bigLabel;
      if($runtime.$('pendingBigMatchSubtitle')) $runtime.$('pendingBigMatchSubtitle').textContent='Le altre 9 partite di Serie A sono terminate. Avvia il Big Match per completare la giornata.';
      if(pendingBtn) pendingBtn.textContent=`INIZIA BIG MATCH`;
    }else{
      if(pendingCard) pendingCard.style.display='none';
    }

    if ($runtime.$('standingsTitle')) $runtime.$('standingsTitle').textContent = $runtime.fantaclassificaIsActive(season)?`Fantaclassifica · ${myStanding?.played||0} giornate`:`Dopo ${myStanding?.played||0} giornate`;
    if($runtime.$('compactStandingsMetricHeader')) $runtime.$('compactStandingsMetricHeader').textContent=$runtime.fantaclassificaIsActive(season)?'FPT':'PT';
    $runtime.renderHubNews();
    $runtime.renderExpertAdvice();
    $runtime.saveState();
  }

  function renderOpponentMalusBanner(season,day){
    const banner=$runtime.$('opponentMalusBanner');
    if(!banner) return;
    const entry=$runtime.ensureOpponentMalusRoll(day);
    const round=season.schedule?.[Number(day)-1];
    const visible=!!entry?.triggered && !!entry.selectedOption && !season.completed &&
      !season.matchdayResults?.[String(day)] && !round?.matches?.every(match=>match.played);
    banner.classList.toggle('hidden',!visible);
    banner.textContent=visible ? `⚠ MALUS AVVERSARIO ATTIVO · ${entry.selectedOption.title} · VEDI DETTAGLI` : '';
  }

  function showOpponentMalusNotice(day,force=false){
    const entry=$runtime.ensureOpponentMalusRoll(day);
    if(!entry?.triggered || !entry.selectedOption || (!force && entry.noticeAcknowledgedAt)) return false;
    const modal=$runtime.$('opponentMalusNotice');
    if(!modal) return false;
    $runtime.opponentMalusNoticeDay=day;
    $runtime.opponentMalusNoticeFocus=document.activeElement;
    const option=entry.selectedOption;
    const rival=$runtime.managerById(entry.opponentId);
    $runtime.$('opponentMalusNoticeTitle').textContent=`${String(entry.opponentLabel||'Il rivale').toUpperCase()} TI METTE I BASTONI TRA LE RUOTE!`;
    $runtime.$('opponentMalusNoticeDay').textContent=`GIORNATA ${day}`;
    $runtime.$('opponentMalusName').textContent=option.title;
    $runtime.$('opponentMalusText').textContent=option.text;
    const player=$runtime.playerMap.get(String(option.effect?.targetPlayerId||''));
    $runtime.$('opponentMalusTarget').innerHTML=player ? $runtime.playerAvatarMarkup(player,player.name) : '';
    $runtime.renderFixtureCoachPortrait('opponentMalusPortrait',rival,$runtime.seasonFixtureTheme(rival,false));
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    $runtime.$('opponentMalusAcknowledge').focus();
    return true;
  }

  function closeOpponentMalusNotice(acknowledge=false){
    if($runtime.opponentMalusNoticeDay===null) return;
    if(acknowledge){
      const entry=$runtime.state?.season?.opponentMalusEvents?.[String($runtime.opponentMalusNoticeDay)];
      if(entry){entry.noticeAcknowledgedAt=Date.now();$runtime.saveState();}
    }
    $runtime.$('opponentMalusNotice').classList.add('hidden');
    $runtime.$('opponentMalusNotice').setAttribute('aria-hidden','true');
    $runtime.opponentMalusNoticeDay=null;
    $runtime.opponentMalusNoticeFocus?.focus();
  }

  function showWeekendArrivalLoading(onComplete){
    const loader=$runtime.$('weekendArrivalLoader');
    if(!loader || $runtime.weekendArrivalLoading){
      if(typeof onComplete==='function' && !$runtime.weekendArrivalLoading) onComplete();
      return;
    }
    $runtime.weekendArrivalLoading=true;
    loader.classList.remove('is-leaving');
    loader.classList.add('show');
    loader.setAttribute('aria-hidden','false');
    const btn=$runtime.$('playMatchdayBtn');
    if(btn) btn.disabled=true;

    window.setTimeout(()=>{
      loader.classList.add('is-leaving');
      window.setTimeout(()=>{
        loader.classList.remove('show','is-leaving');
        loader.setAttribute('aria-hidden','true');
        $runtime.weekendArrivalLoading=false;
        if(typeof onComplete==='function') onComplete();
      },180);
    },880);
  }
    return Object.freeze({hubNewsTypeLabel,hubNewsTheme,ensureSeasonNewsState,addSeasonNews,fantasyResultForManager,recentManagerRun,managerStreak,newsFixtureForDay,generatePreMatchNews,generatePostMatchNews,ensureSeasonNewsForCurrentState,buildHubNews,newsReliabilityLabel,seasonNewsPlayerAvatarHtml,renderSeasonNewsArchive,openSeasonNewsArchive,closeSeasonNewsArchive,stopHubNewsCarousel,setHubNewsSlide,startHubNewsCarousel,renderHubNews,managerRecentLeagueResults,deterministicCpuFormation,managerMostUsedFormation,matchCenterProbablePlayers,managerRoleData,matchCenterKeyPlayer,matchCenterRecommendedFormation,renderMatchCenter,openMatchCenter,closeMatchCenter,renderSeasonDashboard,renderOpponentMalusBanner,showOpponentMalusNotice,closeOpponentMalusNotice,showWeekendArrivalLoading});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['dashboard-controller']=Object.freeze({create});
})();
