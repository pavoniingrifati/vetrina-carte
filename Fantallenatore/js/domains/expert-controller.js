/* Responsibility: expert-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: expert-controller');
  function expertStarterLabel(pct){
    if(pct>=82) return 'TITOLARITÀ MOLTO ALTA';
    if(pct>=68) return 'TITOLARITÀ ALTA';
    if(pct>=52) return 'TITOLARITÀ MEDIA';
    if(pct>=35) return 'TITOLARITÀ INCERTA';
    return 'RISCHIO PANCHINA';
  }

  function expertAdviceAnalysis(player,mode,day){
    const season=$runtime.ensureSeasonState();
    const form=$runtime.playerFormMetrics(player.id);
    const stat=$runtime.playerSeasonStat(player.id);
    const status=$runtime.playerStatusForDay(player.id,day);
    if(status.unavailable) return {score:-999999,reasons:['non disponibile'],chips:[]};

    const ovr=$runtime.currentPlayerOvr(player);
    const starterPct=$runtime.estimatedStarterProbability(player,day);
    const matchup=$runtime.serieAMatchupDifficulty(player,day);
    const fixture=$runtime.serieAFixtureForPlayer(player,day);
    const fantasyAvg=stat?.voteCount ? Number(stat.fantasySum||0)/Math.max(1,Number(stat.voteCount||1)) : 6;
    const voteAvg=stat?.voteCount ? Number(stat.voteSum||0)/Math.max(1,Number(stat.voteCount||1)) : 6;
    const appearances=Number(stat?.appearances||0);
    const starts=Number(stat?.starts||0);
    const minutes=Math.max(1,Number(stat?.minutes||0));
    const startRate=appearances ? starts/appearances : starterPct/100;
    const goals=Number(stat?.goals||0);
    const assists=Number(stat?.assists||0);
    const goals90=goals*90/minutes;
    const assists90=assists*90/minutes;

    const matchupScore=matchup
      ? matchup.key==='favorable' ? 1
      : matchup.key==='hard' ? -1
      : 0
      : 0;
    const homeScore=fixture?.home ? 1 : fixture ? -1 : 0;

    let score=0;
    if(mode==='form'){
      // Il Professore: forma recente e continuità sono il cuore della scelta.
      score =
        form.avg*4.2 +
        form.trend*3.3 +
        form.score*4.0 +
        (starterPct/100)*6.0 +
        startRate*2.2 +
        matchupScore*1.7 +
        homeScore*.65 +
        fantasyAvg*.55 +
        ovr*.035;
    } else if(mode==='attack'){
      // Fantabomber: cerca upside offensivo, ma penalizza chi rischia di non partire.
      const roleBonus=player.role==='A'?10.5:player.role==='C'?6.2:player.role==='D'?1.4:-2.5;
      score =
        roleBonus +
        goals90*11.0 +
        assists90*5.0 +
        (starterPct/100)*7.0 +
        matchupScore*4.4 +
        homeScore*1.35 +
        form.score*2.2 +
        fantasyAvg*.7 +
        ovr*.095;
    } else {
      // MoneyStats: il profilo più equilibrato e "statistico".
      score =
        fantasyAvg*4.0 +
        voteAvg*1.7 +
        (starterPct/100)*6.2 +
        startRate*4.0 +
        form.score*2.5 +
        matchupScore*2.2 +
        homeScore*.7 +
        goals90*3.0 +
        assists90*2.0 +
        ovr*.075;
    }

    score += $runtime.expertPrecisionScoreBonus(player,mode,day,season);

    const reasons=[];
    const chips=[];

    const starterText=$runtime.expertStarterLabel(starterPct);
    chips.push(starterText);

    if(matchup){
      chips.push(`${matchup.icon} ${matchup.label}`);
      chips.push(fixture?.home?'🏠 CASA':'✈ TRASFERTA');
    }

    if(mode==='form'){
      if(form.count){
        if(form.avg>=6.55) reasons.push(`arriva da un ottimo momento di forma`);
        else if(form.trend>.22) reasons.push(`il rendimento recente è in crescita`);
        else if(form.avg>=6.15) reasons.push(`sta offrendo continuità nelle ultime gare`);
        else reasons.push(`ha comunque segnali recenti migliori dei concorrenti`);
      } else {
        reasons.push(`ha un profilo affidabile anche senza uno storico ampio`);
      }
      if(starterPct>=68) reasons.push(`ha buone chance di partire titolare`);
      if(matchup?.key==='favorable') reasons.push(`il calendario della giornata è favorevole`);
      else if(fixture?.home) reasons.push(`gioca in casa`);
    } else if(mode==='attack'){
      if(goals>0 || assists>0){
        const bits=[];
        if(goals>0) bits.push(`${goals} gol`);
        if(assists>0) bits.push(`${assists} assist`);
        reasons.push(`ha già prodotto ${bits.join(' e ')}`);
      } else if(player.role==='A' || player.role==='C'){
        reasons.push(`ha uno dei profili offensivi più interessanti della rosa`);
      } else {
        reasons.push(`offre upside offensivo superiore alle alternative disponibili`);
      }
      if(matchup?.key==='favorable') reasons.push(`ha un matchup favorevole contro ${matchup.opponentShort}`);
      else if(matchup?.key==='balanced' && fixture?.home) reasons.push(`ha una gara equilibrata ma giocata in casa`);
      else if(matchup?.key==='hard') reasons.push(`anche con un avversario difficile resta una delle migliori minacce offensive`);
      if(starterPct>=68) reasons.push(`la titolarità prevista è alta`);
      if(form.score>.35) reasons.push(`arriva anche in buona forma`);
    } else {
      if(stat?.voteCount){
        if(fantasyAvg>=6.8) reasons.push(`la fantamedia stagionale è tra le migliori della rosa`);
        else if(fantasyAvg>=6.25) reasons.push(`sta mantenendo un rendimento statistico solido`);
        else reasons.push(`il quadro complessivo resta competitivo rispetto alle alternative`);
      } else {
        reasons.push(`OVR, ruolo e affidabilità lo rendono una scelta statisticamente solida`);
      }
      if(starterPct>=68) reasons.push(`offre una buona affidabilità di titolarità`);
      if(form.score>.3) reasons.push(`i dati recenti sono in crescita`);
      if(matchup?.key==='favorable') reasons.push(`anche il matchup della giornata è favorevole`);
      else if(matchup?.key==='hard') reasons.push(`il matchup è duro, ma i suoi dati compensano il rischio`);
      if(fixture?.home && matchup?.key!=='hard') reasons.push(`ha inoltre il vantaggio del fattore casa`);
    }

    return {
      score,
      form,
      stat,
      ovr,
      starterPct,
      matchup,
      fixture,
      fantasyAvg,
      voteAvg,
      reasons:reasons.slice(0,3),
      chips:chips.slice(0,3)
    };
  }

  function expertAdviceScore(player,mode,day){
    return $runtime.expertAdviceAnalysis(player,mode,day).score;
  }

  function expertAdviceSentence(player,cfg,analysis){
    const reasons=analysis.reasons||[];
    if(!reasons.length) return cfg.copy;
    const first=reasons[0];
    const rest=reasons.slice(1);
    return `${first.charAt(0).toUpperCase()+first.slice(1)}${rest.length?`; ${rest.join('; ')}`:''}.`;
  }

  function expertPrecisionScoreBonus(player,mode,day,season=$runtime.ensureSeasonState()){
    if(!$runtime.expertPrecisionActive(season) || !player) return 0;
    const daily=season?.expertDays?.[String(Math.max(1,Number(day||season.currentMatchday||1)))];
    const boost=daily?.boosts?.find(item=>String(item.playerId)===String(player.id));
    if(!boost) return 0;
    const large=boost.size==='large';
    if(mode==='form' && ['starter','vote'].includes(boost.kind)) return large?11:7;
    if(mode==='attack' && ['goal','assist'].includes(boost.kind)) return large?12:8;
    if(mode==='data') return large?7:4.5;
    return 0;
  }

  function intuitionExpertSentence(cfg,kind,precision=false){
    if(precision){
      const stronger={
        intuitivo:{starter:'Oggi sono più convinto: può trovare spazio. Io gli darei una possibilità.',vote:'Sul suo voto oggi ho più fiducia. Mi convince, anche senza bonus.'},
        visionario:{goal:'Ragazzi, sul suo gol oggi mi espongo. Mi espongo davvero.',assist:'Oggi sul suo assist sono più convinto: può bastare una giocata.'},
        sibilla:{starter:'La mia intuizione è più nitida: oggi può partire dall’inizio.',vote:'Sono molto fiduciosa che oggi porterà un bel voto.'},
        glitch:{goal:'La mia previsione folle è più forte del solito: può segnare proprio lui.',assist:'Sono molto più convinto del solito: oggi può arrivare un suo assist.'}
      };
      return stronger[cfg.mode]?.[kind]||'Sono più convinto del solito che possa sorprendere oggi.';
    }
    const phrases={
      intuitivo:{starter:'Secondo me oggi può trovare più spazio. Una scommessina che ci può stare.',vote:'Mi intriga per il voto, anche senza bonus. Oggi ci può stare, ragazzi.'},
      visionario:{goal:'Ragazzi, qui sento il gol a sorpresa. Un pallone può bastare.',assist:'Occhio al suo assist: oggi può inventarsi la giocata giusta.'},
      sibilla:{starter:'Potrebbe avere un’occasione inattesa per partire dall’inizio.',vote:'Qualcosa mi dice che oggi lascerà un bel voto.'},
      glitch:{goal:'La mia teoria assurda: oggi potrebbe segnare proprio lui.',assist:'Nessun dato me lo spiega, ma lo vedo protagonista di un assist.'}
    };
    return phrases[cfg.mode]?.[kind]||'Potrebbe essere la sorpresa della giornata.';
  }

  function expertReasonParagraphs(cfg,player,analysis,forecast,precision=false){
    if($runtime.INTUITION_EXPERTS[cfg.id]){
      if(cfg.id==='intuitivo'){
        const day=typeof $runtime.state!=='undefined'?($runtime.state?.season?.currentMatchday||1):1;
        const season=typeof $runtime.state!=='undefined'?($runtime.state?.career?.seasonNumber||1):1;
        const seed=`intuitivo-voice|${season}|${day}|${player.id||player.name}|${forecast?.kind}`;
        const index=typeof $runtime.careerHash==='function'?Math.min(2,Math.floor($runtime.careerHash(seed)*3)):0;
        const openings=precision?[
          `Amici fantallenatori, oggi mi soffermo su ${player.name}. Mi intriga e, con gli Esperti Pro, la mia sensazione è più forte. Secondo me ci può stare nella vostra formazione, ok?`,
          `Allora, parliamo di ${player.name}. Oggi sono più convinto di questa scelta. Non lo considero soltanto una copertura: per questa giornata gli darei una possibilità.`,
          `${player.name} è il nome che mi piace oggi, ragazzi. Una scommessina? Sì, ma stavolta la mia intuizione è più nitida. Io lo prenderei in considerazione sul serio.`
        ]:[
          `Amici fantallenatori, oggi mi soffermo su ${player.name}. È un nome che mi intriga per questa giornata. Non vi sto dicendo che sia un top: secondo me ci può stare, ok?`,
          `Allora, ${player.name}. Vi spiego un po’ la mia riflessione: oggi ho una buona sensazione su di lui. È una scelta da valutare insieme al resto della vostra rosa.`,
          `Su ${player.name} farei una piccola scommessa, ragazzi. Magari non è il primo nome che vi viene in mente, però oggi mi intriga. Gli darei una possibilità, ecco.`
        ];
        const episodes=forecast?.kind==='starter'?[
          'Il discorso è lo spazio in campo. Secondo me oggi potrebbe averne più del previsto, magari dall’inizio o da subentrato. È la mia intuizione, però: non una formazione ufficiale.',
          'Qui mi aspetto una possibilità in più di giocare. Non vi sto dicendo titolarissimo, ok? Mi immagino che trovi spazio e abbia il tempo per incidere. Ci può stare.',
          'La sensazione è che oggi possa uscire dalle rotazioni e trovare più minuti. Dall’inizio? Magari. Anche entrando può dire la sua, ma non vi garantisco la presenza.'
        ]:[
          'Il discorso è il voto, anche senza bonus. Mi immagino una prestazione pulita, con poche sbavature. Secondo me oggi può prendere una buona pagella, magari meglio di quanto vi aspettate.',
          'Qui non sto cercando per forza il gol o l’assist. Mi piace l’idea di un giocatore che oggi faccia bene le cose semplici e porti un buon voto. È quella la mia sensazione.',
          'Secondo me può essere una giornata positiva sul piano del rendimento. Non serve la doppietta, ok? Anche una buona prestazione senza bonus può aiutare la vostra squadra.'
        ];
        return [openings[index],episodes[index],precision?'Valutate anche le alternative, ma oggi io lo schiererei con più fiducia. E posso ancora sbagliarmi: la partita va giocata. Però è una scelta che mi convince, va bene?':'Valutate anche gli altri giocatori che avete. Io oggi gli darei spazio, ma posso anche sbagliarmi. È una sensazione sulla giornata: scegliete in base alla formazione che volete fare, va bene?'];
      }
      if(cfg.id==='visionario'){
        const day=typeof $runtime.state!=='undefined'?($runtime.state?.season?.currentMatchday||1):1;
        const season=typeof $runtime.state!=='undefined'?($runtime.state?.career?.seasonNumber||1):1;
        const seed=`visionario-voice|${season}|${day}|${player.id||player.name}|${forecast?.kind}`;
        const index=typeof $runtime.careerHash==='function'?Math.min(2,Math.floor($runtime.careerHash(seed)*3)):0;
        const openings=precision?[
          `Ragazzi, oggi su ${player.name} mi espongo. Mi espongo davvero. La mia intuizione è più forte del solito: io un posto glielo troverei.`,
          `Oggi vi do un nome con più convinzione: ${player.name}. Scelta coraggiosa? Sì. Ma questa volta la sensazione è forte, ragazzi.`,
          `Parliamo di ${player.name}. Oggi sono più convinto: può essere il colpo di giornata. Io gli darei spazio, ve lo dico chiaramente.`
        ]:[
          `Ragazzi, oggi vi faccio un nome: ${player.name}. Vi sembra una scelta azzardata? Ci sta. Ma questa giornata io un posto glielo troverei.`,
          `Occhio a ${player.name}, ragazzi. Qui provo ad anticipare il bonus. Prima che arrivi, prima che tutti ne parlino. È la mia intuizione di oggi.`,
          `${player.name}: questo è il nome che vi lascio oggi. C'è da avere coraggio? C'è da avere coraggio. Io ci vedo una possibile sorpresa.`
        ];
        const episodes=forecast?.kind==='assist'?[
          'Qui può bastare una giocata. Una. Attira un avversario, libera il compagno e arriva il passaggio giusto. Io oggi mi immagino un suo assist.',
          'Non penso soltanto a chi segna, ragazzi. Penso a chi prepara il gol. Un pallone messo bene e cambia la giornata: è questo l’assist che mi immagino.',
          'La mia scommessa è sull’ultimo passaggio. Il compagno parte, lui lo vede e lo serve. Sembra un dettaglio? Al fantacalcio quel dettaglio può diventare un assist.'
        ]:[
          'Qui può bastare un pallone. Uno. Si trova nel posto giusto e arriva il gol che non ti aspettavi. È questa la mia scommessa: vedere il bonus prima che arrivi.',
          'Io mi immagino quell’episodio: il pallone arriva, lui si fa trovare pronto e la mette dentro. Non serve una partita perfetta per trovare un gol, ragazzi.',
          'Il colpo di giornata può arrivare così: una palla vagante, un movimento giusto, una conclusione. Io oggi il possibile gol lo vedo qui. È una sensazione, ma la seguirei.'
        ];
        return [openings[index],episodes[index],precision?'Io oggi lo schiererei con più fiducia. Ve lo dico chiaramente. Non è un gol o un assist garantito: posso ancora sbagliarmi. Ma questa lettura mi convince.':'Io lo schiererei, ve lo dico chiaramente. È una scommessa di giornata: posso anche sbagliarmi. Ma oggi la mia intuizione mi porta su di lui.'];
      }

      const signal={
        starter:'Mi aspetto che trovi più spazio del previsto: potrebbe partire dall’inizio oppure entrare in tempo per incidere.',
        vote:'Ho la sensazione che interpreterà bene questa gara e porterà un voto migliore delle aspettative.',
        goal:'Mi immagino un episodio in cui si ritrova nella posizione giusta per segnare, anche se oggi non è il nome più ovvio.',
        assist:'Vedo la possibilità di una giocata decisiva per un compagno: un passaggio o un’azione che si trasforma in assist.'
      };
      const voice={
        intuitivo:'Mi fido delle sensazioni sulla giornata più che dei numeri delle ultime partite. È un nome che terrei presente quando scegli chi schierare.',
        visionario:'Sto puntando su un episodio offensivo a sorpresa. È una previsione ambiziosa, non una certezza sulla sua forma recente.',
        sibilla:'Vedo una possibilità inattesa per lui oggi. Il mio consiglio nasce da un’intuizione sulla partita, non da una garanzia di titolarità o rendimento.',
        glitch:'Questa è la mia scommessa fuori dagli schemi: immagino che possa succedere proprio l’episodio che nessuno si aspetta.'
      };
      const confident={
        intuitivo:'Oggi la mia intuizione è più forte del solito: punterei su questo nome con maggiore convinzione.',
        visionario:'La visione offensiva è più chiara del solito: credo davvero che possa trovare l’episodio giusto.',
        sibilla:'Questo presagio mi convince più del solito: lo sceglierei con maggiore fiducia.',
        glitch:'Anche per me è una previsione audace, ma questa volta sono più convinto del mio colpo a sorpresa.'
      };
      return [precision?confident[cfg.id]:voice[cfg.id],signal[forecast?.kind]||'Potrebbe essere una sorpresa della giornata.',precision?'Sono più sicuro della mia lettura, ma resta una previsione: posso ancora sbagliarmi.':'È una previsione, non un bonus assicurato: posso anche sbagliarmi.'];
    }
    const matchup=analysis?.matchup,fixture=analysis?.fixture;
    const venue=fixture?`Contro ${fixture.opponentName}, ${fixture.home?'in casa':'in trasferta'}, ${matchup?.key==='favorable'?'la sfida sembra favorevole':matchup?.key==='hard'?'la sfida è impegnativa':'la sfida appare equilibrata'}.`:'Per questa giornata valuto soprattutto le alternative della tua rosa.';
    if(cfg.mode==='form') return [
      `${precision?'Oggi sono più convinto della mia scelta: scelgo ':'Scelgo '}${player.name} perché ${analysis.reasons?.[0]||'mi sembra affidabile in questo momento'}. Mi interessa la continuità con cui può aiutare la squadra, non soltanto il suo valore generale.`,
      `${analysis.starterPct>=68?'Mi aspetto buone possibilità di vederlo in campo.':analysis.starterPct>=52?'La presenza dal primo minuto è meno sicura, ma il rendimento potenziale mi convince.':'Il rischio di partire dalla panchina esiste: lo considero una scelta più coraggiosa.'} ${venue}`,
      'Il consiglio resta una previsione: la formazione reale e la partita possono cambiare il risultato.'
    ];
    if(cfg.mode==='attack') return [
      `${precision?'Questa volta sono più convinto di puntare su':'Punto su'} ${player.name} per il potenziale di gol o assist. ${analysis.reasons?.[0]||'Il suo profilo offensivo mi sembra interessante'}; tra i tuoi giocatori è uno dei nomi che può trasformare una singola azione in un bonus.`,
      `${venue} ${analysis.starterPct>=68?'La possibilità di giocare dall’inizio rafforza la mia scelta.':'La titolarità non è scontata, quindi il bonus resta una scommessa.'}`,
      'Cerco il colpo di giornata: un buon contesto aumenta le occasioni, ma non garantisce un gol o un assist.'
    ];
    return [
      `${precision?'I segnali di oggi mi rendono più sicuro della scelta. ':'Incrocio rendimento, affidabilità e contesto della gara. '}${player.name} emerge perché ${analysis.reasons?.[0]||'ha un profilo equilibrato rispetto alle alternative'}.`,
      `${analysis.starterPct>=68?'La probabilità di giocare è un punto a suo favore.':'La possibilità di giocare va considerata con cautela.'} ${venue}`,
      'È la scelta che mi sembra più solida oggi sulla base delle informazioni disponibili, pur senza certezze sul voto finale.'
    ];
  }

  function renderExpertStory(){
    const modal=$runtime.$('expertReasonModal');
    if(!modal?.classList.contains('show') || !$runtime.expertStoryState) return;
    const {paragraphs,step}=$runtime.expertStoryState;
    $runtime.$('expertStoryCounter').textContent=`${step+1} / ${paragraphs.length}`;
    $runtime.$('expertReasonBody').innerHTML=`<p><small>PARTE ${step+1}</small>${$runtime.escapeHtml(paragraphs[step])}</p>`;
    $runtime.$('expertStoryPrev').disabled=step===0;
    $runtime.$('expertStoryNext').textContent=step===paragraphs.length-1?'HO CAPITO ✓':'CONTINUA →';
  }

  function changeExpertStoryStep(delta){
    if(!$runtime.expertStoryState) return;
    if(delta>0 && $runtime.expertStoryState.step>=$runtime.expertStoryState.paragraphs.length-1){
      $runtime.closeExpertReason();return;
    }
    $runtime.expertStoryState.step=Math.max(0,Math.min($runtime.expertStoryState.paragraphs.length-1,$runtime.expertStoryState.step+delta));
    $runtime.renderExpertStory();
  }

  function closeExpertReason(){
    const modal=$runtime.$('expertReasonModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    $runtime.expertStoryState=null;
    const previous=modal._returnFocus;
    if(previous?.isConnected) previous.focus();
  }

  function openExpertReason(cfg,player,analysis,forecast,trigger){
    const modal=$runtime.$('expertReasonModal');
    if(!modal || !player) return;
    modal._returnFocus=trigger;
    $runtime.$('expertReasonAvatar').src=cfg.avatar;
    $runtime.$('expertReasonAvatar').alt=cfg.name;
    const precision=$runtime.expertPrecisionActive($runtime.ensureSeasonState());
    $runtime.$('expertReasonTag').textContent=`${cfg.tag} · ${precision?'ESPERTI PRO · ':''}GIORNATA ${$runtime.ensureSeasonState()?.currentMatchday||1}`;
    $runtime.$('expertReasonTitle').textContent=cfg.name;
    $runtime.$('expertStoryRole').textContent=precision?'CONSIGLIO PRO':'IL SUO CONSIGLIO';
    $runtime.$('expertReasonPlayer').textContent=player.name;
    $runtime.$('expertStoryPlayerFace').innerHTML=$runtime.playerAvatarMarkup(player,'');
    $runtime.expertStoryState={paragraphs:$runtime.expertReasonParagraphs(cfg,player,analysis,forecast,precision),step:0};
    const socialSeed=`expert-video|${$runtime.state?.career?.seasonNumber||1}|${$runtime.ensureSeasonState()?.currentMatchday||1}|${cfg.id}`;
    [['expertStoryLikes',120,18000],['expertStoryComments',8,900],['expertStoryShares',15,2400]].forEach(([id,min,max])=>{
      $runtime.$(id).textContent=Math.floor(min+$runtime.careerHash(`${socialSeed}|${id}`)*(max-min+1)).toLocaleString('it-IT');
    });
    modal.classList.toggle('is-pro',precision);
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    $runtime.renderExpertStory();
    modal.querySelector('.expert-reason-close')?.focus();
  }

  function renderExpertAdvice(){
    const grid=$runtime.$('expertAdviceGrid');
    const season=$runtime.ensureSeasonState();
    const user=$runtime.managerById('user');
    if(!grid || !season || !user) return;
    const day=season.currentMatchday||1;
    const precisionActive=$runtime.expertPrecisionActive(season);
    if($runtime.$('expertAdviceStatus')) $runtime.$('expertAdviceStatus').textContent=precisionActive?'ESPERTI PRO ATTIVO · previsioni molto più affidabili':'Consigli generati sui dati della tua rosa';
    const available=(user.roster||[]).filter(p=>!$runtime.playerStatusForDay(p.id,day).unavailable);
    const daily=$runtime.expertDayState(day);
    const configs=[
      {id:'professore',name:'Il Professore',tag:'FORMA',mode:'form',avatar:'assets/experts/il_professore.webp',copy:'Premia forma recente, continuità e probabilità di giocare.'},
      {id:'fantabomber',name:'Fantabomber',tag:'ATTACCO',mode:'attack',avatar:'assets/experts/fantabomber.webp',copy:'Cerca upside offensivo, matchup e possibilità concrete di partire titolare.'},
      {id:'moneystats',name:'MoneyStats',tag:'DATI',mode:'data',avatar:'assets/experts/moneystats.webp',copy:'Incrocia rendimento, affidabilità, OVR e contesto della giornata.'},
      {id:'intuitivo',name:'L’Intuitivo',tag:'INTUIZIONE',mode:'intuitivo',avatar:'assets/experts/intuitivo.webp'},
      {id:'visionario',name:'Il Visionario',tag:'INTUIZIONE',mode:'visionario',avatar:'assets/experts/visionario.webp'},
      {id:'sibilla',name:'La Sibilla',tag:'INTUIZIONE',mode:'sibilla',avatar:'assets/experts/sibilla.webp'},
      {id:'glitch',name:'Il Glitch',tag:'INTUIZIONE',mode:'glitch',avatar:'assets/experts/glitch.webp'}
    ];

    // Tre figure su sette, stabili per tutta la giornata della stessa carriera.
    const picks=configs.filter(cfg=>daily?.experts.includes(cfg.id)).map(cfg=>{
      if($runtime.INTUITION_EXPERTS[cfg.id]){
        const forecast=daily.forecasts[cfg.id];
        const player=available.find(p=>String(p.id)===forecast?.playerId)||null;
        return {cfg,player,analysis:null,forecast};
      }
      const ranked=available
        .map(player=>({player,analysis:$runtime.expertAdviceAnalysis(player,cfg.mode,day)}))
        .sort((a,b)=>b.analysis.score-a.analysis.score);
      const best=ranked[0]||null;
      return best?{cfg,player:best.player,analysis:best.analysis}:{cfg,player:null,analysis:null};
    });

    grid.innerHTML=picks.map(({cfg,player,analysis,forecast})=>{
      if(!player) return `<article class="expert-advice-card"><div class="expert-avatar">${cfg.avatar?`<img src="${$runtime.escapeHtml(cfg.avatar)}" alt="${$runtime.escapeHtml(cfg.name)}">`:'?'}</div><div><span>${cfg.tag}</span><strong>${cfg.name}</strong><p>Nessun consiglio disponibile.</p></div></article>`;

      const intuitive=!!$runtime.INTUITION_EXPERTS[cfg.id];
      const form=analysis?.form;
      const headline=intuitive?`POSSIBILE SORPRESA · ${$runtime.INTUITION_KIND_LABEL[forecast.kind]}`:form?.count
        ? `${$runtime.qualitativeFormLabel(form)} · ${$runtime.expertStarterLabel(analysis.starterPct)}`
        : `OVR ${$runtime.playerOvrLabel(player)} · ${$runtime.expertStarterLabel(analysis.starterPct)}`;
      const sentence=intuitive?$runtime.intuitionExpertSentence(cfg,forecast.kind,precisionActive):$runtime.expertAdviceSentence(player,cfg,analysis);
      const chips=intuitive?'':(analysis.chips||[]).map(chip=>`<span>${$runtime.escapeHtml(chip)}</span>`).join('');

      return `<button type="button" class="expert-advice-card expert-advice-button${intuitive?' expert-advice-intuition':''}" data-expert-reason="${$runtime.escapeHtml(cfg.id)}" aria-label="Leggi perché ${$runtime.escapeHtml(cfg.name)} consiglia ${$runtime.escapeHtml(player.name)}">
        <div class="expert-avatar">${cfg.avatar?`<img src="${$runtime.escapeHtml(cfg.avatar)}" alt="${$runtime.escapeHtml(cfg.name)}">`:$runtime.escapeHtml(cfg.name.slice(0,1))}</div>
        <div class="expert-advice-copy">
          <span>${cfg.tag}${precisionActive?' · PRO':''} · ${$runtime.escapeHtml(headline)}</span>
          <strong>${cfg.name}</strong>
          <p>"${precisionActive?'Oggi punterei con più fiducia su':intuitive?'Terrei d’occhio':'Per questa giornata sceglierei'} <b>${$runtime.escapeHtml(player.name)}</b>. ${$runtime.escapeHtml(sentence)}"</p>
          <div class="expert-context-row">${chips}</div>
        </div>
        <div class="expert-player-pill"><small>${$runtime.escapeHtml(player.role||'')}</small><b>${$runtime.escapeHtml(player.name)}</b><em>OVR ${$runtime.playerOvrLabel(player)}</em></div>
      </button>`;
    }).join('');
    grid.querySelectorAll('[data-expert-reason]').forEach(button=>button.addEventListener('click',()=>{
      const chosen=picks.find(item=>item.cfg.id===button.dataset.expertReason);
      if(chosen?.player) $runtime.openExpertReason(chosen.cfg,chosen.player,chosen.analysis,chosen.forecast,button);
    }));
  }
    return Object.freeze({expertStarterLabel,expertAdviceAnalysis,expertAdviceScore,expertAdviceSentence,expertPrecisionScoreBonus,intuitionExpertSentence,expertReasonParagraphs,renderExpertStory,changeExpertStoryStep,closeExpertReason,openExpertReason,renderExpertAdvice});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['expert-controller']=Object.freeze({create});
})();
