(() => {
  'use strict';

  if(!window.FantaGameRules) throw new Error('Modulo js/game-rules.js non caricato');
  if(!window.FantaCoreUtils) throw new Error('Modulo js/core-utils.js non caricato');
  if(!window.FantaSaveCodec) throw new Error('Modulo js/save-codec.js non caricato');
  if(!window.FantaSaveManager) throw new Error('Modulo js/save-manager.js non caricato');
  if(!window.FantaSeasonEngine) throw new Error('Modulo js/season-engine.js non caricato');
  if(!window.FantaTransferEngine) throw new Error('Modulo js/transfer-engine.js non caricato');
  if(!window.FantaCareerEngine) throw new Error('Modulo js/career-engine.js non caricato');
  if(!window.FantaStorageSnapshot) throw new Error('Modulo js/storage-snapshot.js non caricato');
  if(!window.FantaCpuLineupPolicy) throw new Error('Modulo js/cpu-lineup-policy.js non caricato');
  if(!window.FantaAuctionEngine) throw new Error('Modulo js/auction-engine.js non caricato');
  const {
    GAME_CONFIG,ROLE_LIMITS,ROLE_ORDER,ROLE_LABELS,ROLE_PLURALS,
    INITIAL_BUDGET,FANTASY_SEASON_MATCHDAYS,TOTAL_SLOTS,BID_WINDOW_MS,
    MARKET_VALUE_POOL_TARGET,MARKET_ROLE_TARGET,MARKET_ALPHA,ROLE_BID_CORRECTION,
    TOP_VALUE_THRESHOLD,FANTASY_MAX_SUBS,SERIEA_MIN_VOTE_MINUTES,
    FORMATION_EVENT_CHANCE,ADMIN_RULE_EVENT_CHANCE,CAREER_STARTING_EUROS
  }=window.FantaGameRules;
  const {delay,clamp,randomHash,shuffledCopy,playerInitials}=window.FantaCoreUtils;
  const {encode:encodeSavePayload,decode:decodeSavePayload}=window.FantaSaveCodec;
  const {
    buildFantasySeasonSchedule:buildSeasonSchedule,
    freshStandings:buildFreshStandings,
    freshClubStandings,sortStandings,applyFantasyMatch,applyClubMatches,buildDoubleRoundRobin
  }=window.FantaSeasonEngine;
  const TransferEngine=window.FantaTransferEngine;
  const CareerEngine=window.FantaCareerEngine;
  const AuctionEngine=window.FantaAuctionEngine;
  const SAVE_KEY = 'fantallenatore_v330_save'; // legacy localStorage key, usata solo per migrazione/fallback
  // V3.2.35.56 · Evoluzione OVR normalizzata per ruolo: P/D valorizzati, bonus offensivi ridimensionati per A.
  // V3.2.35.55 · Economia asta fantasy: il budget si concentra davvero sull'attacco.
  // MARKET_VALUE_POOL_TARGET conserva la distribuzione FVM di base, mentre
  // MARKET_ROLE_TARGET guida la pianificazione dei 500 crediti delle CPU.
  const SEASON_SPONSORS = {
    win_bonus:{
      id:'win_bonus',
      name:'Vittoria Energia',
      icon:'🏆',
      title:'+1 € per ogni vittoria',
      description:'Ogni vittoria nella lega fantasy accredita immediatamente 1 € nel saldo carriera.'
    },
    free_subscription:{
      id:'free_subscription',
      name:'FantaLab',
      icon:'🎁',
      title:'1 abbonamento gratuito',
      description:'Durante la stagione puoi attivare gratis, a scelta, FantaData Pro, Scout Plus oppure Assistente Tecnico.'
    },
    future_auction:{
      id:'future_auction',
      name:'Progetto Futuro',
      icon:'🚀',
      title:'+30 crediti alla prossima asta',
      description:'Alla fine della stagione vengono messi da parte 30 crediti extra per la prossima asta della carriera.'
    },
    bonus_firma:{
      id:'bonus_firma',
      name:'Amauri',
      icon:'💰',
      title:'+12 € subito · +12 € se sei tra i primi due alla G19',
      description:'Ricevi 12 € all’inizio. Alla fine della giornata 19 ricevi altri 12 € se sei tra i primi due in classifica.'
    },
    big_match:{
      id:'big_match',
      name:'Netoflix',
      icon:'🔥',
      title:'+8 € battendo una Top 3 · massimo 40 €',
      description:'Ogni volta che batti una squadra che, prima della giornata, occupa una delle prime 3 posizioni, ottieni 8 €, fino a 40 € per stagione.'
    },
    streak_bonus:{
      id:'streak_bonus',
      name:'Adibala',
      icon:'📈',
      title:'+10 € ogni 3 vittorie consecutive · massimo 40 €',
      description:'Ogni blocco di 3 vittorie consecutive ti premia con 10 € aggiuntivi, fino a 40 € per stagione.'
    },
    academy:{
      id:'academy',name:'Ala Romelu',icon:'🎓',
      title:'+2 OVR garantiti a un giocatore scelto',
      description:'Prima di iniziare scegli un giocatore della tua rosa: cresce subito di 2 OVR, nel limite massimo di 99.'
    },
    fantasy_bonus:{
      id:'fantasy_bonus',name:'McTominasy’s',icon:'◆',
      title:'+2 FP con almeno 2 gol fantasy',
      description:'Dopo ogni giornata in cui la tua squadra segna almeno 2 gol fantasy ricevi 2 Fantapoints extra.'
    },
    fantacana:{
      id:'fantacana',name:'Haaland Rover',icon:'🃏',
      title:'Un titolare fuori ruolo ogni giornata',
      description:'Puoi schierare un solo titolare fuori ruolo tra difesa, centrocampo e attacco. Il portiere resta nel proprio ruolo.'
    }
  };
  const SPONSOR_FREE_SHOP_IDS = ['fantadata_pro','scout_plus','assistant_coach'];

  const SHOP_ITEMS = {
    fantadata_pro:{
      id:'fantadata_pro',name:'FantaData Pro',icon:'📊',image:'assets/shop/fantadata-pro.webp',category:'DATI',section:'data',cost:20,fpCost:100,
      description:'Sblocca statistiche avanzate e forma dettagliata dei tuoi giocatori per tutta la stagione.',
      features:['Media voto e fantamedia','Forma recente dettagliata','Difficoltà dell’avversario Serie A','Dati disponibili fino a fine stagione']
    },
    scout_plus:{
      id:'scout_plus',name:'Scout Plus',icon:'🎯',image:'assets/shop/scout-plus.webp',category:'SCOUTING',section:'data',cost:20,fpCost:100,
      description:'Aggiunge una stima della probabilità di titolarità per aiutarti nelle scelte di formazione.',
      features:['Probabilità stimata di titolarità','Tiene conto di ruolo, OVR e gerarchie','La previsione non è una certezza','Attivo fino a fine stagione']
    },
    assistant_coach:{
      id:'assistant_coach',name:'Assistente Tecnico',icon:'🧠',image:'assets/shop/assistente-tecnico.webp',category:'STAFF',section:'staff',cost:10,fpCost:50,
      description:'Automatizza la gestione della formazione e interviene quando un titolare diventa indisponibile.',
      features:['Sblocca AUTO XI','Mantiene formazione e panchina','Sostituisce gli indisponibili','Usa Scout Plus e FantaData se posseduti']
    },
    assistant_tactical_pro:{
      id:'assistant_tactical_pro',name:'Assistente Tattico Pro',icon:'📋',image:'assets/shop/assistente-tecnico.webp',category:'STAFF',section:'staff',cost:10,
      description:'Potenzia l’Assistente Tecnico: adatta AUTO XI e Mantieni formazione a regole Admin, eventi e giocatori fuori ruolo.',
      features:['Richiede Assistente Tecnico','Gestisce turnover e moduli obbligatori','Valuta Haaland Rover e i Jolly','Considera effetti conosciuti · fino a fine stagione']
    },
    fortune:{
      id:'fortune',name:'Fortuna',icon:'🍀',image:'assets/shop/fortuna.webp',category:'POWER-UP',section:'powerup',cost:15,fpCost:75,
      description:'Aumenta la frequenza con cui puoi scegliere una carta prima della giornata.',
      features:['Probabilità evento carte dal 35% al 40%','Effetto automatico per tutta la stagione','Si applica quando premi CONTINUA','Compatibile con Eventi Speciali']
    },
    special_events:{
      id:'special_events',name:'Eventi Speciali',icon:'🃏',image:'assets/shop/eventi-speciali.webp',category:'POWER-UP',section:'powerup',cost:22,fpCost:110,
      description:'Sblocca le carte giocatore Rare ed Epiche, comprese le quattro carte speciali più potenti.',
      features:['Sblocca Rare ed Epiche','Abilita Momento di grazia e Occasione della vita','Abilita Rigorista d’eccezione','Abilita Partita ad altissima tensione']
    },
    expert_precision:{
      id:'expert_precision',name:'Esperti Pro',icon:'🔎',image:'assets/shop/esperti-pro.webp',category:'POWER-UP',section:'powerup',cost:18,fpCost:90,
      description:'Rende molto più affidabili i consigli dei tre esperti estratti ogni giornata.',
      features:['Gli esperti intuitivi sbagliano molto meno spesso','Gli analisti intercettano meglio i segnali nascosti della giornata','Le previsioni restano probabilistiche e non diventano infallibili','Attivo fino a fine stagione']
    },
    cons_reroll_rules:{
      id:'cons_reroll_rules',name:'Rimescola Regole',icon:'🎲',image:'assets/shop/consumables/reroll-admin.webp',category:'CONSUMABILE',section:'consumable',cost:25,currency:'fp',consumable:true,
      description:'Risorteggia tutte e tre le regole pre-asta. Acquistabile solo con Fantapunti; si conserva per la prossima stagione.',
      features:['Usabile nella schermata del regolamento prima dell’asta','Consuma 1 oggetto e sostituisce tutte e tre le regole','Puoi ripetere il sorteggio finché hai oggetti','Non utilizzabile ad asta iniziata']
    },
    cons_reroll_admin:{
      id:'cons_reroll_admin',name:'Reroll Admin',icon:'📜',image:'assets/shop/consumables/reroll-admin.webp',category:'CONSUMABILE',section:'consumable',cost:18,currency:'fp',consumable:true,
      description:'Scarta la regola Admin prepartita appena uscita e ne genera subito una diversa.',
      features:['Usabile quando compare la carta Admin','Consuma 1 unità a ogni reroll','Può essere usato più volte se ne possiedi più di uno','La nuova regola resta da confermare']
    },
    cons_starter_report:{
      id:'cons_starter_report',name:'Report Titolarità',icon:'📋',image:'assets/shop/consumables/report-titolarita.webp',category:'CONSUMABILE',section:'consumable',cost:10,currency:'fp',consumable:true,
      description:'Sblocca per una singola giornata la stima di titolarità di tutta la tua rosa.',
      features:['Valido fino alla Diretta Gol della giornata','Mostra la % accanto a titolari e panchina','Non è necessario se possiedi Scout Plus','Consuma 1 unità']
    },
    cons_training:{
      id:'cons_training',name:'Allenamento Speciale',icon:'🏋️',image:'assets/shop/consumables/allenamento-speciale.webp',category:'CONSUMABILE',section:'consumable',cost:14,currency:'fp',consumable:true,
      description:'Scegli un tuo giocatore e gli assegna un boost temporaneo di rendimento per la prossima partita.',
      features:['Scegli il giocatore dalla tua rosa','+0,25 al rendimento atteso','Leggero aumento delle chance di gol e assist','Puoi usarlo più volte nella stessa giornata, ma una sola volta per giocatore']
    },
    cons_reroll_event:{
      id:'cons_reroll_event',name:'Reroll Evento',icon:'🎴',image:'assets/shop/consumables/reroll-evento.webp',category:'CONSUMABILE',section:'consumable',cost:15,currency:'fp',consumable:true,
      description:'Rigenera le tre carte evento prepartita prima di sceglierne una.',
      features:['Sostituisce tutte e 3 le carte','Mantiene rarità e logiche del tuo shop','Consuma 1 unità per reroll','Può essere usato più volte prima della scelta']
    },
    cons_guaranteed_sale:{
      id:'cons_guaranteed_sale',name:'Cessione Garantita',icon:'💼',image:'assets/shop/consumables/cessione-garantita.webp',category:'CONSUMABILE',section:'consumable',cost:50,currency:'fp',consumable:true,
      description:'Nel mercato invernale cedi immediatamente un tuo giocatore recuperando il prezzo pagato all’asta.',
      features:['Usabile nella fase Svincoli di gennaio','Scegli tu il giocatore','Recuperi il prezzo di acquisto invece della sola quotazione','Consuma 1 unità']
    },
    cons_opponent_block:{
      id:'cons_opponent_block',name:'Blocco Avversario',icon:'🚫',image:'assets/shop/consumables/blocco-avversario.webp',category:'CONSUMABILE',section:'consumable',cost:60,currency:'fp',consumable:true,
      description:'Scegli un giocatore della prossima fantasquadra avversaria: non potrà essere schierato in quella giornata.',
      features:['Usabile prima della Diretta Gol','Il giocatore resta fuori da titolari e panchina','La CPU ricostruisce automaticamente il proprio XI','Un solo blocco per giornata']
    }
  };

  const LEAGUE_RULE_DEFAULTS = Object.freeze({
    defenseModifier:'off',
    maxFantasySubs:FANTASY_MAX_SUBS,
    firstGoalThreshold:66,
    cleanSheetBonus:0,
    formation334Allowed:false,
    captainBonus:'off',
    decisiveGoalBonus:false
  });

  const PRE_AUCTION_RULE_DEFS = Object.freeze([
    Object.freeze({id:'packOpening',icon:'📦',title:'Spacchettamento',values:Object.freeze([true]),label:()=> '4 GIOCATORI A 1 CREDITO',detail:()=> 'Ogni allenatore riceve un giocatore casuale per ruolo dal listone, a 1 credito ciascuno. Costi e posti rosa sono scalati prima dell’asta.'}),
    Object.freeze({
      id:'defenseModifier',icon:'🛡️',title:'Modificatore Difesa',
      values:Object.freeze(['off','classic']),
      label:value=>value==='classic'?'CLASSICO':'OFF',
      detail:value=>value==='classic'?'Media di P + 3 migliori D: +1 / +3 / +6 FP.':'Nessun modificatore difesa.'
    }),
    Object.freeze({
      id:'maxFantasySubs',icon:'🔄',title:'Numero sostituzioni',
      values:Object.freeze([1,3,5]),
      label:value=>`${Number(value)} CAMBI`,
      detail:value=>`Massimo ${Number(value)} sostituzion${Number(value)===1?'e':'i'} fantasy per giornata.`
    }),
    Object.freeze({
      id:'firstGoalThreshold',icon:'⚽',title:'Soglia primo gol',
      values:Object.freeze([65,66,67]),
      label:value=>`${Number(value)} FP`,
      detail:value=>`Il primo gol fantasy scatta a ${Number(value)} fantapunti; poi resta una fascia ogni 6 FP.`
    }),
    Object.freeze({
      id:'cleanSheetBonus',icon:'🧤',title:'Porta inviolata',
      values:Object.freeze([0,1,2]),
      label:value=>Number(value)===2?'MEGA · +2 AL PORTIERE':Number(value)===1?'+1 AL PORTIERE':'OFF',
      detail:value=>Number(value)>0?`Il portiere che chiude senza gol subiti riceve +${Number(value)} FP.`:'Nessun bonus per la porta inviolata.'
    }),
    Object.freeze({
      id:'formation334Allowed',icon:'⚔️',title:'Modulo 3-3-4',
      values:Object.freeze([false,true]),
      label:value=>value?'CONSENTITO':'NON CONSENTITO',
      detail:value=>value?'Il modulo offensivo 3-3-4 è disponibile per tutte le fantasquadre.':'Il modulo 3-3-4 non può essere usato in questa stagione.'
    }),
    Object.freeze({
      id:'captainBonus',icon:'©️',title:'Bonus capitano',
      values:Object.freeze(['off','seven','eight']),
      label:value=>value==='seven'?'+1 CON VOTO ≥ 7':value==='eight'?'+2 CON VOTO ≥ 8':'OFF',
      detail:value=>value==='off'?'Nessun bonus capitano.':value==='seven'?'Il capitano titolare riceve +1 FP se il voto base è almeno 7.':'Il capitano titolare riceve +2 FP se il voto base è almeno 8.'
    }),
    Object.freeze({
      id:'decisiveGoalBonus',icon:'🏆',title:'Gol decisivo',
      values:Object.freeze([false,true]),
      label:value=>value?'+1 FP':'OFF',
      detail:value=>value?'Il marcatore del gol della vittoria della propria squadra reale riceve +1 FP.':'Nessun bonus per il gol della vittoria.'
    }),
    Object.freeze({
      id:'alternateCatalog',icon:'🔀',title:'Universo alternativo · Pokémon',
      values:Object.freeze([true]),
      label:()=> 'CAMBIO LISTONE',
      detail:()=> 'Puoi accettare o rifiutare: cambia il listone attivo tra Serie A e Pokémon. I giocatori restano nelle stagioni successive finché non cambi di nuovo.'
    }),
    Object.freeze({
      id:'keeperConfirmation',icon:'🔐',title:'Conferma giocatore',
      values:Object.freeze([true]),label:()=> '1 CONFERMA UTENTE',
      detail:()=> 'A fine stagione puoi confermare un tuo giocatore al prezzo di acquisto: costo e posto rosa scalati dalla prossima asta. Solo per l’utente.'
    }),
    Object.freeze({
      id:'freeRoleAuction',icon:'🎲',title:'Asta senza reparti',
      values:Object.freeze([true]),
      label:()=> 'TUTTI I RUOLI LIBERI',
      detail:()=> 'Durante l’asta puoi chiamare giocatori di qualsiasi ruolo. Non ci sono fasi per reparto; ogni rosa deve comunque rispettare 3 P, 8 D, 8 C e 6 A.'
    })
  ]);

  function defaultLeagueRules(){
    return {
      generated:false,
      selectedCategories:[],
      defenseModifier:LEAGUE_RULE_DEFAULTS.defenseModifier,
      maxFantasySubs:LEAGUE_RULE_DEFAULTS.maxFantasySubs,
      firstGoalThreshold:LEAGUE_RULE_DEFAULTS.firstGoalThreshold,
      cleanSheetBonus:LEAGUE_RULE_DEFAULTS.cleanSheetBonus,
      formation334Allowed:LEAGUE_RULE_DEFAULTS.formation334Allowed,
      captainBonus:LEAGUE_RULE_DEFAULTS.captainBonus,
      decisiveGoalBonus:LEAGUE_RULE_DEFAULTS.decisiveGoalBonus,
      alternateCatalog:false,
      catalogDecision:null,
      keeperConfirmation:false,
      packOpening:false,
      freeRoleAuction:false
    };
  }

  function leagueRulesFor(source=state){
    const raw=source?.leagueRules||{};
    return {
      ...defaultLeagueRules(),
      ...raw,
      selectedCategories:Array.isArray(raw.selectedCategories)?raw.selectedCategories.slice(0,3):[]
    };
  }

  function preAuctionRuleDef(id){
    return PRE_AUCTION_RULE_DEFS.find(rule=>rule.id===id)||null;
  }

  function generatePreAuctionLeagueRules(target){
    if(!target) return defaultLeagueRules();
    const existing=leagueRulesFor(target);
    if(existing.generated && existing.selectedCategories.length===3){
      target.leagueRules=existing;
      return existing;
    }
    const seed=String(target.marketSeed||`${Date.now()}-${Math.random()}`)+(target.leagueRulesRerollCount?`|rules-reroll-${target.leagueRulesRerollCount}`:'');
    const selected=PRE_AUCTION_RULE_DEFS
      .filter(rule=>Number(target.career?.division||GAME_CONFIG.startingDivision)<=3 || (rule.id!=='alternateCatalog' && rule.id!=='freeRoleAuction' && rule.id!=='packOpening'))
      .filter(rule=>rule.id!=='alternateCatalog' || randomHash(`${seed}|alternate-catalog-offer`)<.25)
      .slice()
      .sort((a,b)=>randomHash(`${seed}|league-rule-category|${a.id}`)-randomHash(`${seed}|league-rule-category|${b.id}`))
      .slice(0,3);
    const next=defaultLeagueRules();
    next.generated=true;
    next.selectedCategories=selected.map(rule=>rule.id);
    selected.forEach(rule=>{
      const roll=randomHash(`${seed}|league-rule-value|${rule.id}`);
      const index=Math.min(rule.values.length-1,Math.floor(roll*rule.values.length));
      next[rule.id]=rule.values[index];
    });
    target.leagueRules=next;
    return next;
  }

  function leagueRuleCardData(source=state){
    const rules=leagueRulesFor(source);
    return rules.selectedCategories.map(id=>{
      const def=preAuctionRuleDef(id);
      if(!def) return null;
      const value=rules[id];
      const label=id==='alternateCatalog' && rules.catalogDecision ? (rules.catalogDecision==='accept'?'CAMBIO ACCETTATO':'CAMBIO RIFIUTATO') : def.label(value);
      const rarity=(id==='alternateCatalog'||id==='freeRoleAuction'||id==='packOpening')?'rare':'common';
      return {id,icon:def.icon,title:id==='cleanSheetBonus'&&Number(value)===2?'Porta inviolata mega':def.title,value,label,detail:def.detail(value),rarity};
    }).filter(Boolean);
  }

  function leagueRuleEffectText(id,value){
    switch(String(id||'')){
      case 'defenseModifier':
        return value==='classic'
          ? 'Effetto: a fine giornata si calcola la media di portiere + 3 migliori difensori. Se la media è alta puoi ottenere bonus extra alla squadra.'
          : 'Effetto: la difesa non assegna alcun bonus extra ai fantapunti finali.';
      case 'maxFantasySubs':
        return `Effetto: dalla panchina possono entrare al massimo ${Number(value)} sostituzion${Number(value)===1?'e':'i'} fantasy.`;
      case 'firstGoalThreshold':
        return `Effetto: il primo gol fantasy si sblocca a ${Number(value)} fantapunti. Una soglia più bassa rende i risultati più facili da muovere.`;
      case 'cleanSheetBonus':
        return Number(value)>0
          ? `Effetto: il portiere che chiude la partita senza subire gol riceve +${Number(value)} fantapunt${Number(value)===1?'o':'i'}.`
          : 'Effetto: la porta inviolata non assegna nessun bonus al portiere.';
      case 'formation334Allowed':
        return value?'Effetto: anche il modulo 3-3-4 è disponibile nella scelta della formazione, per te e per le CPU.':'Effetto: il modulo 3-3-4 resta escluso per tutte le fantasquadre.';
      case 'captainBonus':
        return value==='seven'?'Effetto: il capitano titolare con voto base almeno 7 riceve +1 FP.':value==='eight'?'Effetto: il capitano titolare con voto base almeno 8 riceve +2 FP.':'Effetto: il capitano non riceve bonus.';
      case 'decisiveGoalBonus':
        return value?'Effetto: il gol che determina la vittoria nella partita reale assegna +1 FP al suo marcatore.':'Effetto: nessun bonus per il gol della vittoria.';
      case 'alternateCatalog':
        return 'Effetto: se accetti, la prossima asta e la stagione useranno l’altro listone. Il mercato estero resta separato e continua a funzionare.';
      case 'packOpening':
        return 'Effetto: 1 P, 1 D, 1 C e 1 A casuali per ogni squadra. Ogni giocatore costa 1 credito ed è escluso dall’asta.';
      case 'freeRoleAuction':
        return 'Effetto: non ci sono fasi P → D → C → A. Tu e le CPU potete chiamare qualunque ruolo, rispettando sempre i posti disponibili nella rosa.';
      default:
        return 'Effetto: questa regola modifica il regolamento della stagione.';
    }
  }

  function leagueRulesSummary(source=state){
    const rules=leagueRulesFor(source);
    return `Mod. Difesa ${rules.defenseModifier==='classic'?'CLASSICO':'OFF'} · Cambi ${rules.maxFantasySubs} · Primo gol ${rules.firstGoalThreshold} FP · Porta inviolata ${Number(rules.cleanSheetBonus)>0?`+${Number(rules.cleanSheetBonus)}${Number(rules.cleanSheetBonus)===2?' MEGA':''}`:'OFF'} · 3-3-4 ${rules.formation334Allowed?'CONSENTITO':'NON CONSENTITO'} · Capitano ${rules.captainBonus==='seven'?'+1 (voto 7)':rules.captainBonus==='eight'?'+2 (voto 8)':'OFF'} · Gol decisivo ${rules.decisiveGoalBonus?'+1':'OFF'}`;
  }

  const FORMATION_CHOICE_RARITY_BY_TEMPLATE = {
    'boost-vote':'common','boost-goal':'rare','boost-assist':'rare',
    'boost-training':'common','boost-derby':'rare','boost-offensive-freedom':'rare',
    'boost-penalty-specialist':'rare','boost-grace-moment':'epic','boost-life-chance':'epic',
    'malus-vote':'common','malus-goal':'rare','malus-assist':'rare',
    'malus-tough-opponent':'rare','malus-card-risk':'common','malus-negative-form':'common','malus-high-tension':'rare',
    'risk-vote':'common','risk-goal':'rare','risk-double':'epic','risk-injury':'rare'
    ,'locker-reserve':'common','locker-starter':'common','locker-duel':'common',
    'locker-captain':'rare','locker-turnaround':'common',
    'boost-special-training':'epic','boost-birthday':'rare'
  };

  const SPECIAL_FORMATION_EVENT_TEMPLATE_IDS = new Set([
    'boost-penalty-specialist',
    'boost-grace-moment',
    'boost-life-chance',
    'malus-high-tension',
    'locker-captain','boost-special-training','boost-birthday'
  ]);

  const FORMATION_CHOICE_TEMPLATES = [
    {
      id:'boost-vote',category:'boost',icon:'⬆',title:'Fiducia totale',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-vote|${index}`);
        if(!p) return null;
        return {
          id:`boost-vote-${p.id}`,category:'boost',icon:'⬆',
          title:`Fiducia a ${p.name}`,
          text:`${p.name} parte con un vantaggio di +0,5 sul voto di giornata.`,
          effect:{kind:'player_vote',targetPlayerId:String(p.id),delta:.5}
        };
      }
    },
    {
      id:'boost-goal',category:'boost',icon:'⚽',title:'Licenza di segnare',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-goal|${index}`,x=>x.role==='A'||x.role==='C');
        if(!p) return null;
        return {
          id:`boost-goal-${p.id}`,category:'boost',icon:'⚽',
          title:`Licenza di segnare · ${p.name}`,
          text:`${p.name} avrà probabilità molto più alta di essere scelto come marcatore.`,
          effect:{kind:'goal_weight',targetPlayerId:String(p.id),multiplier:1.85}
        };
      }
    },
    {
      id:'boost-assist',category:'boost',icon:'👟',title:'Piede caldo',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-assist|${index}`,x=>x.role==='C'||x.role==='A'||x.role==='D');
        if(!p) return null;
        return {
          id:`boost-assist-${p.id}`,category:'boost',icon:'👟',
          title:`Piede caldo · ${p.name}`,
          text:`${p.name} avrà probabilità molto più alta di servire un assist.`,
          effect:{kind:'assist_weight',targetPlayerId:String(p.id),multiplier:1.9}
        };
      }
    },
    {
      id:'boost-training',category:'boost',icon:'🌟',title:'Allenamento eccellente',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-training|${index}`);
        if(!p) return null;
        return {
          id:`boost-training-${p.id}`,category:'boost',icon:'🌟',
          title:`Allenamento eccellente · ${p.name}`,
          text:`${p.name} ha impressionato in settimana: titolarità più probabile e rendimento atteso leggermente migliore.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),starterScoreDelta:5.5,starterProbabilityDelta:14,voteDelta:.15}
        };
      }
    },
    {
      id:'boost-derby',category:'boost',icon:'🔥',title:'Derby',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`boost-derby|${index}`,x=>x.role!=='P' && isDerbyFixtureForPlayer(x,ctx.day));
        if(!p) return null;
        return {
          id:`boost-derby-${p.id}`,category:'boost',icon:'🔥',
          title:`Derby · ${p.name}`,
          text:`${p.name} vive una partita ad altissima tensione: molte più possibilità di gol o assist, ma cresce anche il rischio cartellino.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),goalMultiplier:1.65,assistMultiplier:1.45,cardMultiplier:1.70}
        };
      }
    },
    {
      id:'boost-offensive-freedom',category:'boost',icon:'🚀',title:'Libertà offensiva',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-offensive-freedom|${index}`,x=>x.role!=='P');
        if(!p) return null;
        return {
          id:`boost-offensive-freedom-${p.id}`,category:'boost',icon:'🚀',
          title:`Libertà offensiva · ${p.name}`,
          text:`Il mister concede a ${p.name} maggiore libertà negli ultimi metri: aumentano le probabilità di bonus.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),goalMultiplier:1.45,assistMultiplier:1.50}
        };
      }
    },
    {
      id:'boost-penalty-specialist',category:'boost',icon:'🎯',title:'Rigorista d’eccezione',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-penalty-specialist|${index}`,x=>x.role==='A'||x.role==='C');
        if(!p) return null;
        return {
          id:`boost-penalty-specialist-${p.id}`,category:'boost',icon:'🎯',
          title:`Rigorista d’eccezione · ${p.name}`,
          text:`${p.name} diventa il primo candidato a battere un eventuale rigore: sale molto il peso offensivo e un po' anche la probabilità di bonus.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),goalMultiplier:1.95,assistMultiplier:1.10,voteDelta:.10}
        };
      }
    },
    {
      id:'boost-grace-moment',category:'boost',icon:'👑',title:'Momento di grazia',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`boost-grace-moment|${index}`,x=>x.role!=='P');
        if(!p) return null;
        return {
          id:`boost-grace-moment-${p.id}`,category:'boost',icon:'👑',
          title:`Momento di grazia · ${p.name}`,
          text:`${p.name} arriva da una settimana speciale: è molto più probabile che parta titolare e che trovi una giocata decisiva.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),starterScoreDelta:8.5,starterProbabilityDelta:20,voteDelta:.25,goalMultiplier:1.55,assistMultiplier:1.55}
        };
      }
    },
    {
      id:'boost-life-chance',category:'boost',icon:'💎',title:'Occasione della vita',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`boost-life-chance|${index}`,x=>x.role!=='P' && estimatedStarterProbability(x,ctx.day)<=60);
        if(!p) return null;
        return {
          id:`boost-life-chance-${p.id}`,category:'boost',icon:'💎',
          title:`Occasione della vita · ${p.name}`,
          text:`${p.name} riceve una chance enorme per mettersi in mostra: cresce tanto la titolarità e, se gioca, può produrre bonus sopra le attese.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),starterScoreDelta:11,starterProbabilityDelta:24,voteDelta:.15,goalMultiplier:1.40,assistMultiplier:1.35}
        };
      }
    },
    {
      id:'malus-vote',category:'malus',icon:'⬇',title:'Pressione addosso',
      build:(ctx,index)=>{
        const p=ctx.pickOpponent(`malus-vote|${index}`);
        if(!p) return null;
        return {
          id:`malus-vote-${p.id}`,category:'malus',icon:'⬇',
          title:`Pressione su ${p.name}`,
          text:`${p.name}, del tuo prossimo avversario, parte con -0,5 sul voto di giornata.`,
          effect:{kind:'player_vote',targetPlayerId:String(p.id),delta:-.5}
        };
      }
    },
    {
      id:'malus-goal',category:'malus',icon:'🔒',title:'Marcatura speciale',
      build:(ctx,index)=>{
        const p=ctx.pickOpponent(`malus-goal|${index}`,x=>x.role==='A'||x.role==='C');
        if(!p) return null;
        return {
          id:`malus-goal-${p.id}`,category:'malus',icon:'🔒',
          title:`Marcatura speciale · ${p.name}`,
          text:`${p.name} avrà molte meno possibilità di essere scelto come marcatore.`,
          effect:{kind:'goal_weight',targetPlayerId:String(p.id),multiplier:.35}
        };
      }
    },
    {
      id:'malus-assist',category:'malus',icon:'✂',title:'Linee di passaggio chiuse',
      build:(ctx,index)=>{
        const p=ctx.pickOpponent(`malus-assist|${index}`,x=>x.role==='C'||x.role==='A'||x.role==='D');
        if(!p) return null;
        return {
          id:`malus-assist-${p.id}`,category:'malus',icon:'✂',
          title:`Blocca ${p.name}`,
          text:`${p.name} avrà molte meno possibilità di servire un assist.`,
          effect:{kind:'assist_weight',targetPlayerId:String(p.id),multiplier:.35}
        };
      }
    },
    {
      id:'malus-tough-opponent',category:'malus',icon:'🧱',title:'Avversario ostico',
      build:(ctx,index)=>{
        const p=ctx.pickOpponentStrict(`malus-tough-opponent|${index}`,x=>x.role!=='P' && serieAMatchupDifficulty(x,ctx.day)?.key==='hard');
        if(!p) return null;
        return {
          id:`malus-tough-opponent-${p.id}`,category:'malus',icon:'🧱',
          title:`Avversario ostico · ${p.name}`,
          text:`${p.name}, schierabile dal tuo avversario fantasy, affronta una gara molto difficile: probabilità di gol e assist ridotte.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),goalMultiplier:.58,assistMultiplier:.58}
        };
      }
    },
    {
      id:'malus-card-risk',category:'malus',icon:'🟨',title:'Rischio cartellino',
      build:(ctx,index)=>{
        const p=ctx.pickOpponent(`malus-card-risk|${index}`,x=>x.role!=='P');
        if(!p) return null;
        return {
          id:`malus-card-risk-${p.id}`,category:'malus',icon:'🟨',
          title:`Rischio cartellino · ${p.name}`,
          text:`${p.name}, del tuo avversario fantasy, arriva a una partita nervosa: aumenta sensibilmente la probabilità di ammonizione o espulsione.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),cardMultiplier:1.90}
        };
      }
    },
    {
      id:'malus-negative-form',category:'malus',icon:'📉',title:'Periodo negativo',
      build:(ctx,index)=>{
        const p=ctx.pickOpponent(`malus-negative-form|${index}`);
        if(!p) return null;
        return {
          id:`malus-negative-form-${p.id}`,category:'malus',icon:'📉',
          title:`Periodo negativo · ${p.name}`,
          text:`${p.name} attraversa un momento complicato: il suo voto base atteso parte leggermente più basso.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),voteDelta:-.20}
        };
      }
    },
    {
      id:'malus-high-tension',category:'malus',icon:'🟥',title:'Partita ad altissima tensione',
      build:(ctx,index)=>{
        const p=ctx.pickOpponent(`malus-high-tension|${index}`,x=>x.role!=='P');
        if(!p) return null;
        return {
          id:`malus-high-tension-${p.id}`,category:'malus',icon:'🟥',
          title:`Partita ad altissima tensione · ${p.name}`,
          text:`${p.name}, del tuo avversario fantasy, arriva a una gara tesissima: aumenta molto il rischio di giallo o rosso e la serenità sotto porta cala.`,
          effect:{kind:'world_player',targetPlayerId:String(p.id),cardMultiplier:2.35,goalMultiplier:.85,assistMultiplier:.85,voteDelta:-.10}
        };
      }
    },
    {
      id:'risk-injury',category:'risk',icon:'🩹',title:'Oltre il limite',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`risk-injury|${index}`,player=>!playerStatusForDay(player.id,ctx.day).unavailable);
        if(!p)return null;
        return {id:`risk-injury-${p.id}`,category:'risk',icon:'🩹',title:`Oltre il limite · ${p.name}`,
          text:`${p.name} parte con +1 al voto base, ma ha il 50% di rischio di infortunarsi durante la partita se scende in campo. L’esito rimane nascosto fino alla Diretta Gol.`,
          effect:{kind:'risk_injury',targetPlayerId:String(p.id),voteDelta:1,injuryChance:.5}};
      }
    },
    {
      id:'risk-vote',category:'risk',icon:'🎲',title:'Scommessa sul voto',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`risk-vote|${index}`);
        if(!p) return null;
        return {
          id:`risk-vote-${p.id}`,category:'risk',icon:'🎲',
          title:`Scommessa su ${p.name}`,
          text:`Se ${p.name} prende almeno 6,5: +2 Fantapunti. Se prende meno di 6,5: -2 Fantapunti.`,
          effect:{kind:'risk_vote',targetPlayerId:String(p.id),threshold:6.5,reward:2,penalty:-2}
        };
      }
    },
    {
      id:'risk-goal',category:'risk',icon:'🎰',title:'Bomber o niente',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`risk-goal|${index}`,x=>x.role==='A'||x.role==='C');
        if(!p) return null;
        return {
          id:`risk-goal-${p.id}`,category:'risk',icon:'🎰',
          title:`Bomber o niente · ${p.name}`,
          text:`Se ${p.name} segna: +3 Fantapunti extra. Se non segna: -1 Fantapunto.`,
          effect:{kind:'risk_goal',targetPlayerId:String(p.id),reward:3,penalty:-1}
        };
      }
    },
    {
      id:'risk-double',category:'risk',icon:'⚡',title:'Tutto o niente',
      build:(ctx,index)=>{
        const p=ctx.pickOwn(`risk-double|${index}`);
        if(!p) return null;
        return {
          id:`risk-double-${p.id}`,category:'risk',icon:'⚡',
          title:`Tutto o niente · ${p.name}`,
          text:`Bonus e malus di ${p.name} valgono x2. Può diventare decisivo... in entrambi i sensi.`,
          effect:{kind:'risk_double_events',targetPlayerId:String(p.id)}
        };
      }
    },
    {
      id:'locker-reserve',category:'locker',icon:'🪑',title:'La riserva scalpita',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`locker-reserve|${index}`,x=>fantasyAppearanceRate(x.id,ctx.day)<=.30 && ctx.day>=5);
        if(!p)return null;
        return {id:`locker-reserve-${p.id}`,category:'locker',icon:'🪑',title:`La riserva scalpita · ${p.name}`,
          text:`${p.name} chiede una chance. Se lo schieri titolare, +0,5 al voto; con voto base almeno 7 può guadagnare +1 OVR.`,
          effect:{kind:'locker_vote',targetPlayerId:String(p.id),delta:.5,requireStarter:true,ovrCondition:'seven'}};
      }
    },
    {
      id:'locker-starter',category:'locker',icon:'💬',title:'Il titolare perde il posto',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`locker-starter|${index}`,x=>fantasyAppearanceRate(x.id,ctx.day)>=.60 && ctx.day>=5);
        if(!p)return null;
        return {id:`locker-starter-${p.id}`,category:'locker',icon:'💬',title:`Il titolare perde il posto · ${p.name}`,
          text:`${p.name} vuole ritrovare spazio. Se lo schieri titolare, +0,5 al voto; se resta fuori, -0,5 al voto nella giornata seguente, se gioca.`,
          effect:{kind:'locker_vote',targetPlayerId:String(p.id),delta:.5,requireStarter:true,nextDayPenalty:-.5}};
      }
    },
    {
      id:'locker-duel',category:'locker',icon:'⚔️',title:'Due giocatori, una maglia',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`locker-duel|${index}`,x=>ctx.user.roster.some(y=>y.id!==x.id && y.role===x.role));
        if(!p)return null;
        return {id:`locker-duel-${p.id}`,category:'locker',icon:'⚔️',title:`Due giocatori, una maglia · ${p.name}`,
          text:`Sostieni ${p.name} nella sfida per il posto: se lo schieri titolare, +0,5 al voto. Con una grande prestazione può ottenere +1 OVR.`,
          effect:{kind:'locker_vote',targetPlayerId:String(p.id),delta:.5,requireStarter:true,ovrCondition:'seven'}};
      }
    },
    {
      id:'locker-captain',category:'locker',icon:'©️',title:'Il capitano interviene',
      build:(ctx,index)=>{
        const ids=ctx.user.roster.map(p=>String(p.id));
        if(ids.length<3)return null;
        return {id:`locker-captain-${ctx.day}`,category:'locker',icon:'©️',title:'Il capitano interviene',
          text:'Il capitano parla al gruppo: fino a tre tuoi titolari ricevono +0,25 al voto base nella prossima giornata.',
          effect:{kind:'locker_team',maxPlayers:3,delta:.25}};
      }
    },
    {
      id:'locker-turnaround',category:'locker',icon:'🌅',title:'Partita della svolta',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`locker-turnaround|${index}`,x=>{
          const recent=state?.season?.playerSeasonStats?.[String(x.id)]?.recent||[];
          return recent.length && Number(recent[recent.length-1].vote)<6;
        });
        if(!p)return null;
        return {id:`locker-turnaround-${p.id}`,category:'locker',icon:'🌅',title:`Partita della svolta · ${p.name}`,
          text:`Dai fiducia a ${p.name}: se lo schieri e prende almeno 7 di voto base, +1 OVR; sotto 6, -1 OVR.`,
          effect:{kind:'locker_turnaround',targetPlayerId:String(p.id),requireStarter:true}};
      }
    },
    {
      id:'boost-special-training',category:'boost',icon:'🏋️',title:'Allenamento speciale',
      build:(ctx,index)=>{
        const role=['P','D','C','A'][Math.floor(careerHash(`special-training|${ctx.day}|${index}`)*4)];
        return {id:`boost-special-training-${role}`,category:'boost',icon:'🏋️',title:`Allenamento speciale · ${ROLE_PLURALS[role]}`,
          text:`I tuoi titolari ${ROLE_PLURALS[role].toLowerCase()} ricevono +0,25 al voto base in questa giornata.`,
          effect:{kind:'locker_team',role,maxPlayers:25,delta:.25}};
      }
    },
    {
      id:'boost-birthday',category:'boost',icon:'🎂',title:'Compleanno del giocatore',
      build:(ctx,index)=>{
        const p=ctx.pickOwnStrict(`boost-birthday|${index}`,x=>x.role!=='P' && estimatedStarterProbability(x,ctx.day)>=55);
        if(!p)return null;
        return {id:`boost-birthday-${p.id}`,category:'boost',icon:'🎂',title:`Compleanno di ${p.name}`,
          text:`Se ${p.name} scende in campo nella sua partita reale: 50% gol certo, 50% autogol certo. L'esito resta nascosto fino alla Diretta Gol.`,
          effect:{kind:'birthday',targetPlayerId:String(p.id)}};
      }
    },
  ];

  const ADMIN_RULE_TEMPLATES = [
    {id:'admin-golden-bench',rarity:'common',build:day=>({id:`admin-golden-bench-${day}`,category:'admin',icon:'🪑',title:'Panchina d’oro',text:'Per tutte le squadre: il primo panchinaro che entra nella formazione fantasy riceve +1 extra se segna. Il bonus si assegna una sola volta, anche se segna più gol.',effect:{kind:'admin_rule',ruleId:'golden_bench'}})},
    {id:'admin-cesarini',rarity:'common',build:day=>({id:`admin-cesarini-${day}`,category:'admin',icon:'⏱️',title:'Zona Cesarini',text:'Per questa giornata, per tutte le squadre, ogni gol segnato dall’85° minuto compreso vale +4 invece di +3. Sono inclusi i rigori segnati; gli autogol mantengono il loro malus.',effect:{kind:'admin_rule',ruleId:'cesarini'}})},
    {id:'admin-underdog',rarity:'rare',build:day=>({id:`admin-underdog-${day}`,category:'admin',icon:'🌟',title:'Underdog',text:'Per tutte le squadre: ogni titolare della formazione fantasy con OVR inferiore a 75 riceve +0,5 fantapunti se prende voto. Il bonus non modifica il voto base e non vale per chi subentra dalla panchina.',effect:{kind:'admin_rule',ruleId:'underdog'}})},
    {
      id:'admin-goal-threshold-76',rarity:'epic',
      build:(day)=>({
        id:`admin-goal-threshold-76-${day}`,
        category:'admin',icon:'🥅',title:'Gol ad alta quota · Soglia 76',
        text:'Solo per questa giornata, tutte le fantasquadre segnano il primo gol a 76 Fantapunti. I successivi scattano ogni 6 punti: 82, 88, 94… Dalla prossima giornata torna la soglia stagionale.',
        effect:{kind:'admin_rule',ruleId:'goal_threshold_76',firstGoalThreshold:76}
      })
    },
    {
      id:'admin-turnover-3',rarity:'common',
      build:(day)=>{
        if(Number(day||0)<=1) return null;
        return {
          id:`admin-turnover-3-${day}`,
          category:'admin',
          icon:'🔁',
          title:'Turnover obbligatorio',
          text:'L\'Admin impone un mini-turnover: devi cambiare almeno 3 titolari rispetto alla giornata precedente prima di poter confermare la formazione.',
          effect:{kind:'admin_rule',ruleId:'forced_turnover_3',minimumChanges:3}
        };
      }
    },
    {
      id:'admin-forced-formation',rarity:'common',
      build:(day)=>{
        const pool=['3-5-2','3-4-3','4-4-2','4-5-1','5-3-2'];
        const forced=hashPick(sortedByChoiceHash(pool.map(key=>({id:key,name:key})),`admin-rule-formation|${day}`),`admin-rule-formation|${day}`)?.id || '4-4-2';
        return {
          id:`admin-forced-formation-${forced}-${day}`,
          category:'admin',
          icon:'📐',
          title:`Modulo imposto dall’Admin · ${forced}`,
          text:`Per questa giornata l'Admin obbliga tutte le fantasquadre a usare il modulo ${forced}. Puoi schierarti liberamente, ma devi confermare la formazione con questo assetto.`,
          effect:{kind:'admin_rule',ruleId:'forced_formation',formation:forced}
        };
      }
    },
    {
      id:'admin-no-subs',rarity:'common',
      build:(day)=>({
        id:`admin-no-subs-${day}`,
        category:'admin',
        icon:'🚫',
        title:'Niente sostituzioni',
        text:'Regola secca dell\'Admin: per questa giornata nessun panchinaro potrà sostituire un titolare senza voto. Si gioca con gli 11 scelti.',
        effect:{kind:'admin_rule',ruleId:'no_substitutions'}
      })
    },
    {
      id:'admin-extra-subs',rarity:'common',
      build:(day)=>({
        id:`admin-extra-subs-${day}`,
        category:'admin',
        icon:'🔄',
        title:'Panchina profonda',
        text:`L'Admin amplia la panchina operativa: per questa giornata puoi effettuare fino a 7 sostituzioni fantasy invece delle ${leagueRulesFor(state).maxFantasySubs} previste dal regolamento.`,
        effect:{kind:'admin_rule',ruleId:'extra_subs_7'}
      })
    },
    {
      id:'admin-wildcard-sub',rarity:'rare',
      build:(day)=>({
        id:`admin-wildcard-sub-${day}`,
        category:'admin',
        icon:'🧩',
        title:'Jolly tattico',
        text:'Regola Admin: una volta, se manca un sostituto dello stesso ruolo, può entrare un panchinaro di qualunque ruolo.',
        effect:{kind:'admin_rule',ruleId:'wildcard_sub'}
      })
    },
    {
      id:'admin-best-bench',rarity:'common',
      build:(day)=>({
        id:`admin-best-bench-${day}`,
        category:'admin',
        icon:'📋',
        title:'Panchina meritocratica',
        text:'Regola Admin: nelle sostituzioni entra il panchinaro compatibile con il Fantavoto migliore, non il primo in ordine.',
        effect:{kind:'admin_rule',ruleId:'best_bench'}
      })
    },
    {
      id:'admin-forced-starter',rarity:'rare',
      build:(day)=>{
        const season=ensureSeasonState();
        const round=season?.schedule?.[Math.max(0,Number(day||1)-1)];
        const fantasyMatch=round?.matches?.find(m=>m.homeId==='user'||m.awayId==='user');
        if(!fantasyMatch) return null;
        const opponentId=fantasyMatch.homeId==='user'?fantasyMatch.awayId:fantasyMatch.homeId;
        const user=managerById('user'), opponent=managerById(opponentId);
        const userPool=(user?.roster||[]).filter(player=>!playerStatusForDay(player.id,day).unavailable);
        const oppPool=(opponent?.roster||[]).filter(player=>!playerStatusForDay(player.id,day).unavailable);
        if(!userPool.length || !oppPool.length) return null;
        const userPlayer=hashPick(sortedByChoiceHash(userPool,`admin-forced-starter-user|${day}`),`admin-forced-starter-user|${day}`);
        const opponentPlayer=hashPick(sortedByChoiceHash(oppPool,`admin-forced-starter-opp|${day}|${opponentId}`),`admin-forced-starter-opp|${day}|${opponentId}`);
        if(!userPlayer || !opponentPlayer) return null;
        return {
          id:`admin-forced-starter-${day}-${userPlayer.id}-${opponentPlayer.id}`,
          category:'admin',
          icon:'📌',
          title:'Titolare imposto',
          text:`L'Admin impone ${userPlayer.name} nel tuo XI. Per equilibrio, anche ${opponent?.team||'il tuo avversario'} dovrà schierare ${opponentPlayer.name}.`,
          effect:{
            kind:'admin_rule',ruleId:'forced_starter_pair',
            userPlayerId:String(userPlayer.id),userPlayerName:userPlayer.name,
            opponentId:String(opponentId),opponentPlayerId:String(opponentPlayer.id),opponentPlayerName:opponentPlayer.name
          }
        };
      }
    },
    {
      id:'admin-revolution-5',rarity:'rare',
      build:(day)=>{
        if(Number(day||0)<=1) return null;
        return {
          id:`admin-revolution-5-${day}`,
          category:'admin',
          icon:'🌪️',
          title:'Formazione rivoluzionata',
          text:'L\'Admin vuole una rivoluzione: devi cambiare almeno 5 titolari rispetto alla giornata precedente prima di poter confermare la formazione.',
          effect:{kind:'admin_rule',ruleId:'forced_turnover_5',minimumChanges:5}
        };
      }
    },
    {
      id:'admin-top-player-bench',rarity:'rare',
      build:(day)=>{
        const season=ensureSeasonState();
        const fixture=currentUserFixture();
        if(!season || !fixture) return null;
        const opponentId=fixture.homeId==='user'?fixture.awayId:fixture.homeId;
        const user=managerById('user'), opponent=managerById(opponentId);
        const topUser=adminBenchableTopPlayer(user,day);
        const topOpponent=adminBenchableTopPlayer(opponent,day);
        if(!topUser || !topOpponent) return null;
        return {
          id:`admin-top-player-bench-${day}-${topUser.id}-${topOpponent.id}`,
          category:'admin',
          icon:'🔒',
          title:'Top Player in panchina',
          text:`L'Admin manda in panchina i due uomini copertina: ${topUser.name} deve essere l’ultima riserva per te e ${topOpponent.name} deve essere l’ultima riserva per ${opponent?.team||'la CPU avversaria'}.`,
          effect:{
            kind:'admin_rule',ruleId:'top_player_bench',
            userPlayerId:String(topUser.id),userPlayerName:topUser.name,
            opponentId:String(opponentId),opponentPlayerId:String(topOpponent.id),opponentPlayerName:topOpponent.name
          }
        };
      }
    },
    {
      id:'admin-faith-reserve',rarity:'rare',
      build:(day)=>{
        const eligibleIds=previousUnusedBenchEligibleIds(day);
        if(!eligibleIds.length) return null;
        return {
          id:`admin-faith-reserve-${day}`,
          category:'admin',
          icon:'🌱',
          title:'Fiducia alla riserva',
          text:'Devi schierare titolare almeno un giocatore che nella giornata precedente era in panchina e non è entrato. Le riserve valide vengono evidenziate nella schermata formazione.',
          effect:{kind:'admin_rule',ruleId:'faith_reserve',eligiblePlayerIds:eligibleIds.slice()}
        };
      }
    },
    {
      id:'admin-wildcard-starter',rarity:'epic',
      build:(day)=>({
        id:`admin-wildcard-starter-${day}`,
        category:'admin',
        icon:'🃏',
        title:'Wildcard dell\'Admin',
        text:'Per questa giornata puoi schierare un solo giocatore fuori ruolo in uno slot compatibile. Portiere escluso: sono ammessi soltanto ruoli adiacenti D↔C e C↔A.',
        effect:{kind:'admin_rule',ruleId:'wildcard_starting_slot',maxOutOfRole:1}
      })
    },
    {
      id:'admin-double-wildcard',rarity:'epic',
      build:(day)=>({
        id:`admin-double-wildcard-${day}`,
        category:'admin',
        icon:'🃏',
        title:'Doppio Jolly',
        text:'Per questa giornata puoi schierare fino a 2 giocatori fuori ruolo. Portiere escluso: restano valide soltanto le compatibilità D↔C e C↔A.',
        effect:{kind:'admin_rule',ruleId:'double_wildcard_starting_slot',maxOutOfRole:2}
      })
    },
    {
      id:'admin-butterfly-555',rarity:'epic',
      build:(day)=>{
        const enough=manager=>['P','D','C','A'].every(role=>(manager?.roster||[]).filter(p=>p.role===role).length>=(role==='P'?1:5));
        if(!state?.managers?.every(enough)) return null;
        return {
          id:`admin-butterfly-555-${day}`,
          category:'admin',icon:'🦋',title:'5-5-5 · Modulo a farfalla',
          text:'Per questa giornata tutte le fantasquadre giocano col 5-5-5: 5 difensori, 5 centrocampisti, 5 attaccanti e un portiere. Tutti e 16 i titolari contribuiscono ai Fantapunti.',
          effect:{kind:'admin_rule',ruleId:'butterfly_555',formation:'5-5-5'}
        };
      }
    },
    {
      id:'admin-fantaclassifica',rarity:'epic',
      build:(day)=>{
        const season=ensureSeasonState();
        if(!season || season.fantaclassificaActive) return null;
        return {
          id:`admin-fantaclassifica-${day}`,
          category:'admin',
          icon:'🏆',
          title:'Fantaclassifica',
          text:'Da questo momento e fino alla fine della stagione la classifica della lega viene ordinata sui Fantapunti totali accumulati, non sui normali punti ottenuti da vittorie e pareggi.',
          effect:{kind:'admin_rule',ruleId:'fantaclassifica',persistent:true,activatedDay:Number(day||1)}
        };
      }
    }
  ];

  const SERIEA_TACTICAL_SHAPES = [
    {key:'4-3-3',req:{P:1,D:4,C:3,A:3}},
    {key:'4-4-2',req:{P:1,D:4,C:4,A:2}},
    {key:'3-5-2',req:{P:1,D:3,C:5,A:2}},
    {key:'3-4-3',req:{P:1,D:3,C:4,A:3}},
    {key:'5-3-2',req:{P:1,D:5,C:3,A:2}},
    {key:'4-5-1',req:{P:1,D:4,C:5,A:1}}
  ];


  // V3.2.35.55 · Identità tattiche Serie A. Sono preferenze, non vincoli:
  // qualità della rosa, forma e indisponibilità possono sempre far cambiare modulo.
  const SERIEA_TACTICAL_IDENTITY = {
    atalanta:['3-4-3','3-5-2'], bologna:['4-3-3','4-5-1'], cagliari:['4-4-2','3-5-2'],
    como:['4-3-3','4-5-1'], fiorentina:['3-4-3','4-3-3'], frosinone:['4-4-2','4-3-3'],
    genoa:['3-5-2','4-4-2'], inter:['3-5-2','3-4-3'], juventus:['4-3-3','3-5-2'],
    lazio:['4-3-3','4-5-1'], lecce:['4-4-2','4-3-3'], milan:['4-3-3','4-4-2'],
    monza:['4-4-2','3-4-3'], napoli:['4-3-3','3-4-3'], parma:['4-4-2','4-3-3'],
    roma:['3-4-3','3-5-2'], sassuolo:['4-3-3','4-5-1'], torino:['5-3-2','3-5-2'],
    udinese:['3-5-2','4-4-2'], venezia:['4-4-2','3-5-2']
  };

  const originalSerieAClubs=(window.FANTA_CLUBS||[]).map(c=>({...c}));
  const serieBClubs=(window.FANTA_SERIE_B?.clubs||[]).filter(c=>!originalSerieAClubs.some(a=>a.id===c.id));
  const clubMap = new Map([...originalSerieAClubs,...serieBClubs].map(c => [c.id, c]));
  const serieBPlayers=(window.FANTA_SERIE_B?.players||[]).map(p=>({...p,id:`serie-b-${p.id}`,originalClub:p.club,marketStatus:'serie_a',hidden:false}));

  function ensureRealLeague(source){
    if(!source.realLeague) source.realLeague={serieA:originalSerieAClubs.map(c=>c.id),serieB:serieBClubs.map(c=>c.id),lastCompletedSeason:0,lastChanges:null};
    return source.realLeague;
  }

  function syncRealLeagueClubs(source){
    const ids=source?ensureRealLeague(source).serieA:originalSerieAClubs.map(c=>c.id);
    window.FANTA_CLUBS.splice(0,window.FANTA_CLUBS.length,...ids.map(id=>clubMap.get(id)).filter(Boolean));
  }

  function advanceRealLeague(source,standings){
    const league=ensureRealLeague(source);
    const seasonNumber=Number(source.career?.seasonNumber||1);
    if(Number(league.lastCompletedSeason)>=seasonNumber || !Array.isArray(standings) || standings.length!==20 || standings.some(s=>Number(s.played||0)<38)) return league.lastChanges;
    const relegated=standings.slice(-3).map(s=>s.clubId);
    const promoted=league.serieB.slice().sort((a,b)=>randomHash(`${source.marketSeed}|real-promotion|${seasonNumber}|${a}`)-randomHash(`${source.marketSeed}|real-promotion|${seasonNumber}|${b}`)).slice(0,3);
    if(promoted.length!==3 || relegated.some(id=>!league.serieA.includes(id))) return null;
    // Pokémon stay Pokémon: carry the three relegated rosters into the new clubs.
    if(source.catalogMode==='pokemon'){
      const market=ensureSerieATransferMarket(source);
      market.playerClubOverrides ||= {};
      (window.FANTA_PLAYERS||[]).forEach(p=>{const index=relegated.indexOf(p.club);if(index>=0)market.playerClubOverrides[String(p.id)]=promoted[index];});
    }
    league.serieA=league.serieA.filter(id=>!relegated.includes(id)).concat(promoted);
    league.serieB=league.serieB.filter(id=>!promoted.includes(id)).concat(relegated);
    league.lastCompletedSeason=seasonNumber;
    league.lastChanges={seasonNumber,relegated,promoted};
    syncSerieATransferWorld(source);
    return league.lastChanges;
  }
  // Snapshot immutabile del database di partenza: il mondo Serie A runtime può
  // cambiare club, perdere giocatori all'estero e ricevere nuovi arrivi.
  const originalSerieAPlayers = (window.FANTA_PLAYERS || []).map(p => ({...p,originalClub:p.club,marketStatus:'serie_a',hidden:false}));
  const baseSerieAPlayers = originalSerieAPlayers.map(p=>({...p}));
  const basePlayerValueReference = new Map(baseSerieAPlayers.map(p => [String(p.id), {...p}]));
  const playerMap = new Map(baseSerieAPlayers.map(p => [String(p.id), p]));
  let activeCatalogKey='base';

  function pokemonBasePlayers(seed){
    const names=window.FANTA_POKEMON_CATALOG||[];
    const clubs=originalSerieAClubs.map(club=>club.id)
      .sort((a,b)=>randomHash(`${seed}|club-order|${a}`)-randomHash(`${seed}|club-order|${b}`));
    // Minimi ben superiori ai 30 P, 80 D, 80 C e 60 A richiesti dalle 10 rose.
    const roles=['P','D','C','A'];
    const distribution=[60,170,170,Math.max(0,names.length-400)];
    const slots=roles.flatMap((role,index)=>Array(distribution[index]).fill(role));
    const ordered=names.map((entry,index)=>({...entry,index,order:randomHash(`${seed}|role|${entry.id}`)}))
      .sort((a,b)=>a.order-b.order||a.index-b.index);
    return ordered.map((entry,index)=>{
      const role=slots[index];
      const ovr=Number(entry.ovr);
      const club=clubs[index%clubs.length]||'roma';
      const quotation=Math.max(1,Math.round(1+Math.pow(Math.max(0,ovr-58)/36,2)*32));
      return {id:entry.id,name:entry.name,role,roleLabel:ROLE_LABELS[role],nation:'Pokémon',ovr,club,originalClub:club,quotation,
        fvm:Math.max(1,Math.round(quotation*(role==='A'?2.1:role==='C'?1.8:role==='D'?1.5:1.3))),marketStatus:'serie_a',hidden:false};
    });
  }

  function activateCatalogBase(source){
    const mode=source?.catalogMode==='pokemon'?'pokemon':'base';
    const seed=String(source?.pokemonCatalogSeed||source?.marketSeed||'pokemon');
    syncRealLeagueClubs(source);
    const league=ensureRealLeague(source);
    if(mode==='pokemon' && !league.pokemonInitialClubs){
      const missing=league.serieA.filter(id=>!originalSerieAClubs.some(c=>c.id===id));
      league.pokemonInitialClubs=originalSerieAClubs.map(c=>league.serieA.includes(c.id)?c.id:missing.shift());
    }
    const key=mode==='pokemon'?`pokemon:${seed}:${league.pokemonInitialClubs.join(',')}`:'base-with-serie-b';
    if(key===activeCatalogKey) return;
    const base=mode==='pokemon'?pokemonBasePlayers(seed).map(p=>({...p,club:league.pokemonInitialClubs[originalSerieAClubs.findIndex(c=>c.id===p.club)],originalClub:league.pokemonInitialClubs[originalSerieAClubs.findIndex(c=>c.id===p.club)]})):[...originalSerieAPlayers,...serieBPlayers];
    baseSerieAPlayers.splice(0,baseSerieAPlayers.length,...base);
    basePlayerValueReference.clear();
    base.forEach(player=>basePlayerValueReference.set(String(player.id),{...player}));
    activeCatalogKey=key;
  }

  function applyCatalogDecision(draft){
    const rules=leagueRulesFor(draft);
    const oldMode=draft.catalogMode==='pokemon'?'pokemon':'base';
    if(!rules.selectedCategories.includes('alternateCatalog') || rules.catalogDecision!=='accept') return;
    draft.catalogWorlds ||= {};
    draft.catalogWorlds[oldMode]={transferMarket:JSON.parse(JSON.stringify(draft.transferMarket)),playerBaseOvr:{...(draft.playerBaseOvr||{})}};
    const nextMode=oldMode==='pokemon'?'base':'pokemon';
    draft.catalogMode=nextMode;
    draft.pokemonCatalogSeed ||= draft.marketSeed;
    const saved=draft.catalogWorlds[nextMode];
    draft.transferMarket=saved?JSON.parse(JSON.stringify(saved.transferMarket)):TransferEngine.createMarketState(`${draft.pokemonCatalogSeed}|${nextMode}`);
    draft.playerBaseOvr={...(saved?.playerBaseOvr||{})};
    activateCatalogBase(draft);
    draft.availableIds=baseSerieAPlayers.map(player=>String(player.id));
    syncSerieATransferWorld(draft);
  }


  // V2.1 · formazione: coordinate adattate dal vecchio motore Fantaballa.
  // Il database corrente espone i macro-ruoli P/D/C/A: qualunque giocatore del
  // reparto può occupare uno degli slot tattici di quel reparto.
  function makeFormationSlots(key, specs) {
    const counts = {P:0,D:0,C:0,A:0};
    return specs.map((s,idx) => {
      const [label,role,x,y] = s;
      counts[role] += 1;
      return { key:label, role, x, y, instanceId:`${key}-${role}-${counts[role]}-${idx}` };
    });
  }

  const LINEUP_FORMATIONS = {
    '4-3-3': makeFormationSlots('4-3-3', [
      ['AS','A',22,18],['PC','A',50,14],['AD','A',78,18],
      ['CC','C',35,49],['MED','C',50,57],['CC','C',65,49],
      ['TS','D',23,79],['DC','D',39,82],['DC','D',61,82],['TD','D',77,79],['P','P',50,93]
    ]),
    '4-4-2': makeFormationSlots('4-4-2', [
      ['PC','A',39,18],['PC','A',61,18],
      ['ES','C',21,48],['CC','C',40,55],['CC','C',60,55],['ED','C',79,48],
      ['TS','D',23,79],['DC','D',39,82],['DC','D',61,82],['TD','D',77,79],['P','P',50,93]
    ]),
    '4-5-1': makeFormationSlots('4-5-1', [
      ['PC','A',50,15],
      ['ES','C',19,43],['CC','C',35,54],['COC','C',50,40],['CC','C',65,54],['ED','C',81,43],
      ['TS','D',23,79],['DC','D',39,82],['DC','D',61,82],['TD','D',77,79],['P','P',50,93]
    ]),
    '3-4-3': makeFormationSlots('3-4-3', [
      ['AS','A',22,18],['PC','A',50,14],['AD','A',78,18],
      ['ES','C',21,50],['CC','C',40,56],['CC','C',60,56],['ED','C',79,50],
      ['DC','D',34,80],['DC','D',50,80],['DC','D',66,80],['P','P',50,93]
    ]),
    '3-3-4': makeFormationSlots('3-3-4', [
      ['AS','A',15,21],['PC','A',38,15],['PC','A',62,15],['AD','A',85,21],
      ['CC','C',27,51],['MED','C',50,57],['CC','C',73,51],
      ['DC','D',34,80],['DC','D',50,80],['DC','D',66,80],['P','P',50,93]
    ]),
    '3-5-2': makeFormationSlots('3-5-2', [
      ['PC','A',39,18],['PC','A',61,18],
      ['ES','C',19,48],['CC','C',36,58],['COC','C',50,40],['CC','C',64,58],['ED','C',81,48],
      ['DC','D',34,80],['DC','D',50,80],['DC','D',66,80],['P','P',50,93]
    ]),
    '5-3-2': makeFormationSlots('5-3-2', [
      ['PC','A',39,18],['PC','A',61,18],
      ['CC','C',35,52],['MED','C',50,59],['CC','C',65,52],
      ['TS','D',15,78],['DC','D',32,80],['DC','D',50,80],['DC','D',68,80],['TD','D',85,78],['P','P',50,93]
    ]),
    '5-4-1': makeFormationSlots('5-4-1', [
      ['PC','A',50,15],
      ['ES','C',21,48],['CC','C',40,55],['CC','C',60,55],['ED','C',79,48],
      ['TS','D',15,78],['DC','D',32,80],['DC','D',50,80],['DC','D',68,80],['TD','D',85,78],['P','P',50,93]
    ]),
    '5-5-5': makeFormationSlots('5-5-5', [
      ['AS','A',12,18],['AS','A',31,14],['PC','A',50,18],['AD','A',69,14],['AD','A',88,18],
      ['ES','C',12,48],['CC','C',31,50],['MED','C',50,54],['CC','C',69,50],['ED','C',88,48],
      ['TS','D',12,78],['DC','D',31,80],['DC','D',50,78],['DC','D',69,80],['TD','D',88,78],['P','P',50,94]
    ])
  };

  function allowedLineupFormation(key,source=state){
    return !!LINEUP_FORMATIONS[key] && (key!=='3-3-4' || !!leagueRulesFor(source).formation334Allowed)
      && (key!=='5-5-5' || activeAdminRuleEffect(source?.season?.currentMatchday)?.ruleId==='butterfly_555');
  }

  function availableLineupFormations(source=state){
    return Object.keys(LINEUP_FORMATIONS).filter(key=>allowedLineupFormation(key,source));
  }

  let lineupDraft = null;
  let lineupSelectedPlayerId = null;
  let lineupReadOnly = false;
  let lineupDragPlayerId = null;
  let lineupPartialContext = null;
  let lineupAssistantAdjustments = [];
  let serieALive = null;
  let hubNewsCarouselTimer = null;
  let hubNewsCarouselIndex = 0;
  let hubNewsCarouselCount = 0;

  const PERSONALITIES = [
    { id:'user', name:'Tu', label:'Fantallenatore', aggression:1.00, volatility:.05, topBias:1.00, heat:.02, targets:{P:30,D:60,C:120,A:290} },
    { id:'bomber', name:'Beppe', team:'Beppe FC', label:'Il Bomberista', aggression:1.01, volatility:.08, topBias:1.02, heat:.05, targets:{P:25,D:50,C:105,A:320} },
    { id:'ragioniere', name:'Marco', team:'Atletico Bilancio', label:'Il Ragioniere', aggression:1.00, volatility:.025, topBias:.99, heat:.005, targets:{P:35,D:75,C:135,A:255} },
    { id:'spendaccione', name:'Fabio', team:'Real Spendaccione', label:'Lo Spendaccione', aggression:1.03, volatility:.10, topBias:1.05, heat:.08, targets:{P:25,D:55,C:110,A:310} },
    { id:'tirchio', name:'Luca', team:'AC Risparmio', label:'Il Tirchio', aggression:1.00, volatility:.05, topBias:.94, heat:.01, valueHunter:true, targets:{P:35,D:70,C:135,A:260} },
    { id:'moneyball', name:'Davide', team:'Data United', label:'Moneyball', aggression:1.00, volatility:.03, topBias:1.00, heat:.01, valueHunter:true, targets:{P:35,D:70,C:145,A:250} },
    { id:'tifoso', name:'Simone', team:'Curva Nord FC', label:'Il Tifoso', aggression:1.01, volatility:.07, topBias:1.00, heat:.03, favoriteClub:'inter', targets:{P:30,D:60,C:120,A:290} },
    { id:'collezionista', name:'Andrea', team:'Galácticos', label:'Collezionista di Top', aggression:1.02, volatility:.06, topBias:1.06, heat:.06, targets:{P:25,D:50,C:105,A:320} },
    { id:'esperto', name:'Stefano', team:'Metodo FC', label:"L'Esperto", aggression:1.01, volatility:.02, topBias:1.01, heat:.01, expert:true, targets:{P:30,D:60,C:120,A:290} },
    { id:'pazzo', name:'Gigi', team:'Caos 11', label:'Il Pazzo', aggression:1.00, volatility:.14, topBias:1.02, heat:.10, targets:{P:25,D:55,C:110,A:310} },
    { id:'gambler', name:'Lorenzo', team:'Risk FC', label:'Il Gambler', aggression:1.05, volatility:.16, topBias:1.02, heat:.12, riskTaker:true, targets:{P:25,D:50,C:105,A:320} },
    { id:'stratega', name:'Riccardo', team:'Mastermind FC', label:'Il DS Stratega', aggression:1.00, volatility:.02, topBias:1.01, heat:.01, expert:true, targets:{P:30,D:65,C:135,A:270} },
    { id:'rivale', name:'Alessio', team:'Nemesis FC', label:'Il Rivale Diretto', aggression:1.04, volatility:.08, topBias:1.04, heat:.10, targets:{P:30,D:55,C:115,A:300} },

    // Rivali speciali per le categorie superiori.
    { id:'squalo', name:'Vittorio', team:'Shark Capital', label:'Lo Squalo', aggression:1.07, volatility:.09, topBias:1.08, heat:.13, riskTaker:true, targets:{P:24,D:50,C:105,A:321} },
    { id:'camaleonte', name:'Nicolò', team:'Adaptive XI', label:'Il Camaleonte', aggression:1.02, volatility:.03, topBias:1.01, heat:.02, expert:true, valueHunter:true, targets:{P:30,D:62,C:132,A:276} },
    { id:'fantadata', name:'Tommaso', team:'Fantadata Lab', label:'Il Fantadata', aggression:1.03, volatility:.02, topBias:1.03, heat:.02, expert:true, valueHunter:true, targets:{P:30,D:60,C:138,A:282} },
    { id:'predatore', name:'Diego', team:'Predators FC', label:'Il Predatore', aggression:1.06, volatility:.07, topBias:1.07, heat:.11, riskTaker:true, targets:{P:24,D:52,C:110,A:314} },
    { id:'broker', name:'Federico', team:'Broker League', label:'Il Broker', aggression:1.08, volatility:.06, topBias:1.09, heat:.10, targets:{P:23,D:48,C:106,A:323} },
    { id:'admin', name:'Admin', team:'Admin FC', label:'Admin', aggression:1.055, volatility:.018, topBias:1.065, heat:.035, expert:true, valueHunter:true, targets:{P:30,D:64,C:132,A:274} },
  ];

  const SPECIAL_RIVAL_IDS = ['squalo','camaleonte','fantadata','predatore','broker'];

  let state = null;
  let marketValueMap = buildMarketValueMap();
  let careerDraft = null;
  let careerPowerSelection = [];
  let careerRulesNextAction = 'auction';
  let careerTeamSubstep = 'identity';
  let nextSeasonSetupMode = false;
  let nextSeasonMarketSimulationRunning = false;
  let toastTimer = null;
  const slotRankingCache = new Map();
  const initializedSeasonSystems = new WeakSet();
  let uiTimer = null;
  let countdownTimer = null;
  let cpuReactionTimers = [];
  let bidFlashTimer = null;
  let bidSpotlightTimer = null;
  let awardAnimationTimer = null;
  let suddenInterestTimer = null;
  let lastBidFlash = null;
  let autocompleteMode = false;
  let roleRemainderAutoSim = false;
  let roleRemainderRestoreTurbo = false;
  let selectedPlayerId = null;
  let nominationUiKey = '';
  let evolutionFilter = 'movers';
  let dataCenterTab = 'overview';
  let socialSelectedPlayerId = null;
  let socialSearchQuery = '';

  const $ = id => document.getElementById(id);
  function careerHash(key) {
    const seed = state?.marketSeed || 'legacy';
    return randomHash(`${seed}|${key}`);
  }

  function profileArchetype(manager) {
    return String(manager?.profile?.archetype || manager?.profile?.id || '').toLowerCase();
  }

  function roleCount(manager, role) {
    return AuctionEngine.roleCount(manager,role);
  }

  function openRoleAuction(){
    return !!state && leagueRulesFor(state).freeRoleAuction===true;
  }

  function managerCanNominate(manager){
    if(!manager || slotsRemaining(manager)<=0) return false;
    return state.availableIds.some(id=>{
      const player=playerMap.get(String(id));
      return player && canOwn(manager,player) && maxLegalBid(manager,player)>=1;
    });
  }

  function slotsRemaining(manager) { return AuctionEngine.slotsRemaining(manager,TOTAL_SLOTS); }
  function roleSlotsRemaining(manager, role) { return AuctionEngine.roleSlotsRemaining(manager,role,ROLE_LIMITS); }

  function currentAuctionRole() {
    if (!state) return ROLE_ORDER[0];
    if(openRoleAuction()){
      const live=state.auction?.playerId && playerMap.get(String(state.auction.playerId));
      if(live) return live.role;
      const picked=$('roleFilter')?.value;
      if(ROLE_ORDER.includes(picked)) return picked;
      const manager=state.managers?.[state.nominationIndex];
      return ROLE_ORDER.find(role=>roleSlotsRemaining(manager,role)>0)||ROLE_ORDER[0];
    }
    return ROLE_ORDER[Math.min(Number(state.currentRoleIndex||0), ROLE_ORDER.length-1)];
  }

  function currentRoleLabel() { return ROLE_LABELS[currentAuctionRole()] || currentAuctionRole(); }

  function userCompletedCurrentRole(role=currentAuctionRole()) {
    const user=state?.managers?.find(m=>m.id==='user');
    return !!user && roleSlotsRemaining(user,role)<=0;
  }

  function showRoleRemainderAutoSim(role){
    const banner=$('roleAutoSimBanner');
    if(!banner) return;
    const title=$('roleAutoSimTitle');
    const copy=$('roleAutoSimText');
    if(title) title.textContent=`Simulazione ${ROLE_PLURALS[role]||role} CPU…`;
    if(copy) copy.textContent=`Hai completato i tuoi ${(ROLE_PLURALS[role]||role).toLowerCase()}. Le aste rimanenti del reparto vengono risolte automaticamente.`;
    banner.classList.remove('hidden');
    banner.setAttribute('aria-hidden','false');
  }

  function hideRoleRemainderAutoSim(){
    const banner=$('roleAutoSimBanner');
    if(!banner) return;
    banner.classList.add('hidden');
    banner.setAttribute('aria-hidden','true');
  }

  function beginRoleRemainderAutoSim(role=currentAuctionRole()){
    if(!state || openRoleAuction() || state.completed || roleRemainderAutoSim || rolePhaseComplete(role) || !userCompletedCurrentRole(role)) return false;
    roleRemainderAutoSim=true;
    roleRemainderRestoreTurbo=!!state.turbo;
    autocompleteMode=true;
    state.turbo=true;
    if($('turboToggle')) $('turboToggle').checked=true;
    showRoleRemainderAutoSim(role);
    showToast(`✓ ${ROLE_LABELS[role]} completati: simulo automaticamente le aste CPU rimanenti.`);
    return true;
  }

  function endRoleRemainderAutoSim(){
    if(!roleRemainderAutoSim) return;
    roleRemainderAutoSim=false;
    autocompleteMode=false;
    state.turbo=roleRemainderRestoreTurbo;
    if($('turboToggle')) $('turboToggle').checked=!!state.turbo;
    hideRoleRemainderAutoSim();
  }

  const PLAYER_AVATAR_CACHE = new Map();
  const COACH_AVATAR_DEFAULT={hair:'0',expression:'smile',skin:'0',shirt:'purple'};
  const COACH_SHIRTS={purple:'#7447c9',blue:'#348bd1',red:'#c64a57',green:'#278e69',yellow:'#d7ab35',black:'#353c52'};
  function normalizedCoachAvatar(value){
    const candidate=value && typeof value==='object' ? value : {};
    return {
      hair:['0','1','2','3'].includes(String(candidate.hair))?String(candidate.hair):COACH_AVATAR_DEFAULT.hair,
      expression:['smile','focused','serious','surprised'].includes(candidate.expression)?candidate.expression:COACH_AVATAR_DEFAULT.expression,
      skin:['0','1','2','3','4'].includes(String(candidate.skin))?String(candidate.skin):COACH_AVATAR_DEFAULT.skin,
      shirt:Object.hasOwn(COACH_SHIRTS,candidate.shirt)?candidate.shirt:COACH_AVATAR_DEFAULT.shirt
    };
  }
  function pixelPlayerAvatarData(player){
    if(!player) return '';
    const custom=player.avatarCustomization?normalizedCoachAvatar(player.avatarCustomization):null;
    const identity=String(player.id||player.name||'player');
    const key=identity+(custom?'|'+Object.values(custom).join('|'):'');
    if(PLAYER_AVATAR_CACHE.has(key)) return PLAYER_AVATAR_CACHE.get(key);
    let seed=2166136261;
    // Le scelte dell'allenatore servono solo alla cache: non devono alterare
    // capelli, occhi o altri dettagli generati dal suo identificativo.
    const seedSource=custom?identity:`${key}|${player.name||''}|${player.club||''}`;
    for(const ch of seedSource){seed^=ch.charCodeAt(0);seed=Math.imul(seed,16777619)>>>0;}
    if(/^pokemon-\d+$/.test(identity)){
      const colors=[
        ['#f0ae54','#ffe0a0','#a45c36'],['#75c58e','#b8e7a5','#3a825f'],
        ['#6da9d9','#b7daf1','#4169a7'],['#a88bd5','#dac9f1','#6c56a4'],
        ['#e78092','#f6bdc9','#a84970'],['#e0cd66','#f5eba9','#9c7d39'],
        ['#8eabae','#d5e3db','#536f7b'],['#c88762','#f3c399','#865645']
      ];
      const variant=(salt,count)=>{
        let value=seed^Math.imul(salt,0x9e3779b9);
        value=Math.imul(value^(value>>>16),0x85ebca6b);
        value=Math.imul(value^(value>>>13),0xc2b2ae35);
        return ((value^(value>>>16))>>>0)%count;
      };
      const [body,light,dark]=colors[variant(13,colors.length)];
      const trim=({P:'#f2c94c',D:'#37c47a',C:'#48a9ff',A:'#ef6273'}[player.role]||'#ffd84d');
      const ears=[
        `<path d="M23 35L16 7l20 13m37 15L80 7 60 20" fill="${body}" stroke="${dark}" stroke-width="5"/>`,
        `<path d="M27 33V10h13v17m16 0V10h13v23" fill="${body}" stroke="${dark}" stroke-width="5"/>`,
        `<path d="M23 34L8 22l9 23m56-11 15-12-9 23" fill="${body}" stroke="${dark}" stroke-width="5"/>`,
        `<path d="M29 30L19 12l20 12m18 0 20-12-10 18" fill="${light}" stroke="${dark}" stroke-width="5"/>`,
        `<path d="M28 29L35 5l9 21m8 0 9-21 7 24" fill="${dark}" stroke="${dark}" stroke-width="4"/>`,
        `<path d="M24 35L8 29l16-5m48 11 16-6-16-5" fill="${light}" stroke="${dark}" stroke-width="5"/>`
      ][variant(29,6)];
      const heads=[
        `<path d="M22 34h8V23h36v11h8v22h-7v10H29V56h-7z"/>`,
        `<path d="M19 36h9V25h40v11h9v23h-9v10H28V59h-9z"/>`,
        `<path d="M26 29h44v9h7v19h-7v10H26V57h-7V38h7z"/>`,
        `<path d="M28 22h40v11h8v23h-9v13H29V56h-9V33h8z"/>`
      ][variant(43,4)];
      const markings=[
        `<rect x="24" y="44" width="9" height="7" fill="${light}"/><rect x="63" y="44" width="9" height="7" fill="${light}"/>`,
        `<path d="M40 25h16v11H40z" fill="${dark}"/><rect x="44" y="29" width="8" height="5" fill="${light}"/>`,
        `<rect x="28" y="25" width="8" height="11" fill="${dark}"/><rect x="60" y="25" width="8" height="11" fill="${dark}"/>`,
        `<path d="M25 53h13v5H25m33-5h13v5H58" fill="${light}"/>`,
        ''
      ][variant(61,5)];
      const eyes=[
        '<rect x="32" y="39" width="8" height="9"/><rect x="56" y="39" width="8" height="9"/>',
        '<path d="M31 41h10v7H31zm24 0h10v7H55z"/>',
        '<rect x="34" y="41" width="6" height="6"/><rect x="56" y="41" width="6" height="6"/>'
      ][variant(79,3)];
      const snout=variant(97,3)===0
        ? `<path d="M35 54h26v11H35z" fill="${light}"/><rect x="44" y="54" width="8" height="6" fill="${dark}"/><path d="M41 63h14" stroke="${dark}" stroke-width="3"/>`
        : variant(97,3)===1
          ? `<path d="M40 54h16v10H40z" fill="${light}"/><rect x="45" y="55" width="6" height="5" fill="${dark}"/>`
          : `<rect x="45" y="54" width="6" height="5" fill="${dark}"/><path d="M39 62h18" stroke="${dark}" stroke-width="3"/>`;
      const number=Number(identity.slice(8))||0;
      const crest=Array.from({length:9},(_,index)=>(number&(1<<index))
        ? `<rect x="${41+(index%3)*5}" y="${83+Math.floor(index/3)*4}" width="4" height="3" fill="${dark}"/>`:'').join('');
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" shape-rendering="crispEdges">
        <path d="M14 96V76l14-12h40l14 12v20z" fill="${dark}" stroke="#101226" stroke-width="4"/>
        ${ears}<g fill="${body}" stroke="${dark}" stroke-width="4" stroke-linejoin="miter">${heads}</g>
        ${markings}<g fill="#17243b">${eyes}</g>${snout}
        <path d="M16 83h64v13H16z" fill="${trim}"/><path d="M30 83h36v13H30z" fill="${body}"/>${crest}
      </svg>`;
      const uri=`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
      PLAYER_AVATAR_CACHE.set(key,uri);
      return uri;
    }
    const pick=(list,shift=0)=>list[(seed>>>shift)%list.length];
    const skins=['#f2c18d','#dfa06d','#c77c4d','#9b5838','#72412d'];
    const hairs=['#17131b','#3b2519','#6c3c1c','#a45d24','#d3a34e','#c8b79e'];
    const eyes=['#18243a','#31553e','#5a3b26','#3f6187'];
    const roleTrim=custom?COACH_SHIRTS[custom.shirt]:({P:'#f2c94c',D:'#37c47a',C:'#48a9ff',A:'#ef6273'}[player.role]||'#ffd84d');
    const skin=custom?skins[Number(custom.skin)]:pick(skins,1),hair=pick(hairs,5),eye=pick(eyes,9),shirt=custom?COACH_SHIRTS[custom.shirt]:(clubColor(player.club)||'#5542a8');
    const hairStyle=custom?Number(custom.hair):(seed>>>12)%4,beard=!custom&&((seed>>>16)%5)>=3,scar=!custom&&((seed>>>19)%11)===0;
    const hairShape=[
      `<path d="M24 30V18h8v-6h32v6h8v12h-8V24H32v6z" fill="${hair}"/>`,
      `<path d="M24 32V18h6v-6h36v6h6v14h-8V23H32v9z" fill="${hair}"/><rect x="32" y="8" width="24" height="6" fill="${hair}"/>`,
      `<path d="M24 30V20h6v-7h10V9h24v6h8v15h-8v-7H32v7z" fill="${hair}"/>`,
      `<path d="M25 28V18h8v-5h30v5h8v10h-7v-5H32v5z" fill="${hair}"/>`
    ][hairStyle];
    const beardShape=beard?`<path d="M31 50h34v10l-9 9H40l-9-9z" fill="${hair}"/><rect x="40" y="50" width="16" height="5" fill="${skin}"/>`:'';
    const scarShape=scar?`<path d="M58 36l-5 9" stroke="#8d4a3b" stroke-width="2"/>`:'';
    const brows=custom?.expression==='focused'?`<path d="M32 35l9 3m22-3l-9 3" stroke="${hair}" stroke-width="3"/>`:
      custom?.expression==='surprised'?`<path d="M32 32h9m14 0h9" stroke="${hair}" stroke-width="3"/>`:'';
    const mouth=custom?.expression==='serious'?'<path d="M40 58h16" stroke="#8b4938" stroke-width="3"/>':
      custom?.expression==='focused'?'<path d="M41 58h14" stroke="#8b4938" stroke-width="3"/>':
      custom?.expression==='surprised'?'<rect x="44" y="55" width="9" height="9" fill="#8b4938"/>':
      '<path d="M38 56h20v4l-6 4H44l-6-4z" fill="#8b4938"/><path d="M42 57h12" stroke="#fff5dc" stroke-width="2"/>';
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" shape-rendering="crispEdges">
      <path d="M12 96V78c0-15 14-25 36-25s36 10 36 25v18z" fill="${shirt}" stroke="#090d19" stroke-width="4"/>
      <path d="M12 83h72v13H12z" fill="${roleTrim}" opacity=".92"/><path d="M20 82h56v14H20z" fill="${shirt}"/>
      <path d="M37 52h22v15L48 74 37 67z" fill="${skin}" stroke="#090d19" stroke-width="3"/>
      <path d="M26 25h44v23c0 14-9 23-22 23s-22-9-22-23z" fill="${skin}" stroke="#090d19" stroke-width="4"/>
      ${hairShape}${brows}<rect x="33" y="37" width="7" height="5" fill="${eye}"/><rect x="56" y="37" width="7" height="5" fill="${eye}"/>
      <rect x="46" y="43" width="5" height="8" fill="#a86445"/>${custom?mouth:'<path d="M39 56h18v4H39z" fill="#8b4938"/>'}${beardShape}${scarShape}
      <path d="M31 73l17 9 17-9 7 23H24z" fill="rgba(7,11,24,.24)"/>
    </svg>`;
    const uri=`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    PLAYER_AVATAR_CACHE.set(key,uri);
    return uri;
  }

  function playerAvatarMarkup(player,alt=''){
    return `<img src="${pixelPlayerAvatarData(player)}" alt="${escapeHtml(alt||player?.name||'Giocatore')}" loading="lazy">`;
  }

  function lineupPlayerFaceMarkup(player,size=''){
    const cls=String(size||'').trim();
    return `<span class="lineup-player-face ${escapeHtml(cls)}">${playerAvatarMarkup(player,player?.name||'Giocatore')}</span>`;
  }

  function playerStars(ovr) {
    const val = Number(ovr||0);
    const full = clamp(Math.round((val - 55) / 7), 1, 5);
    return '★'.repeat(full) + '☆'.repeat(5-full);
  }

  function ensureIntegrityState() {
    if (!state) return null;
    if (!state.integrity || typeof state.integrity !== 'object') {
      state.integrity = { checks:0, repairs:0, warnings:0, lastCheck:null, recent:[] };
    }
    if (!Array.isArray(state.integrity.recent)) state.integrity.recent = [];
    return state.integrity;
  }

  function integrityNote(type, message, context='runtime') {
    const bag = ensureIntegrityState();
    if (!bag) return;
    if (type === 'repair') bag.repairs++;
    else bag.warnings++;
    bag.recent.push({ type, message, context, at:Date.now() });
    if (bag.recent.length > 40) bag.recent = bag.recent.slice(-40);
    console.warn(`[Asta integrity/${context}] ${message}`);
  }

  function auditAndRepairState(context='runtime') {
    if (!state || !Array.isArray(state.managers)) return true;
    const bag = ensureIntegrityState();
    bag.checks++;
    bag.lastCheck = { context, at:Date.now() };
    let clean = true;

    // 1) A player can belong to one roster only. If a duplicate ever appears,
    // keep the first owner and refund/remove all accidental duplicates.
    const owners = new Map();
    state.managers.forEach(m => {
      if (!Array.isArray(m.roster)) m.roster = [];
      const kept = [];
      for (const item of m.roster) {
        if (!item || !playerMap.has(item.id)) { clean=false; integrityNote('repair', `${m.team}: voce rosa non valida rimossa`, context); continue; }
        if (owners.has(item.id)) {
          clean=false;
          integrityNote('repair', `${item.name}: duplicato rimosso da ${m.team}`, context);
          continue;
        }
        owners.set(item.id,m.id);
        kept.push(item);
      }
      m.roster = kept;
    });

    // 2) Enforce hard roster and role limits. This should never fire in normal play,
    // but makes corrupted saves/self-inconsistent states recoverable.
    state.managers.forEach(m => {
      for (const role of ROLE_ORDER) {
        const inRole = m.roster.filter(x=>x.role===role);
        if (inRole.length > ROLE_LIMITS[role]) {
          clean=false;
          const extras = inRole.slice(ROLE_LIMITS[role]);
          const extraIds = new Set(extras.map(x=>x.id));
          m.roster = m.roster.filter(x=>!extraIds.has(x.id));
          extras.forEach(x=>owners.delete(x.id));
          integrityNote('repair', `${m.team}: rimossi ${extras.length} ${ROLE_PLURALS[role].toLowerCase()} oltre il limite`, context);
        }
      }
      if (m.roster.length > TOTAL_SLOTS) {
        clean=false;
        const extras = m.roster.slice(TOTAL_SLOTS);
        m.roster = m.roster.slice(0,TOTAL_SLOTS);
        extras.forEach(x=>owners.delete(x.id));
        integrityNote('repair', `${m.team}: rosa ridotta a ${TOTAL_SLOTS} giocatori`, context);
      }

      // Prima di gennaio vale la contabilità dell'asta iniziale. Dopo l'apertura
      // invernale il ledger include bonus base, rimborsi e spesa della mini asta.
      const spent = m.roster.reduce((s,x)=>s+Math.max(0,Number(x.price||0)),0);
      const winterBudget=state.winterMarketFlow?.ledger?.[m.id]
        ? expectedWinterBudget(m.id)
        : null;
      const auctionBaseBudget=Math.max(0,Number(state.auctionStartingBudgets?.[m.id]??INITIAL_BUDGET));
      const expectedBudget = winterBudget===null ? Math.max(0, auctionBaseBudget-spent+Number(state.tradeBudgetAdjustments?.[m.id]||0)) : winterBudget;
      if (!Number.isFinite(Number(m.budget)) || Number(m.budget)!==expectedBudget) {
        clean=false;
        m.budget = expectedBudget;
        integrityNote('repair', `${m.team}: budget riallineato a ${expectedBudget}`, context);
      }
      const minReserve = slotsRemaining(m);
      if (m.budget < minReserve) {
        clean=false;
        integrityNote('warning', `${m.team}: budget ${m.budget} sotto la riserva minima ${minReserve}`, context);
      }
    });

    // 3) Available list is rebuilt from the authoritative rosters.
    const allIds = (window.FANTA_PLAYERS || []).map(p=>p.id);
    const currentAuctionId = state.auction?.playerId || null;
    const expectedAvailable = allIds.filter(id=>!owners.has(id));
    const currentSet = new Set(state.availableIds || []);
    const mismatch = expectedAvailable.length !== currentSet.size || expectedAvailable.some(id=>!currentSet.has(id));
    if (mismatch) {
      clean=false;
      state.availableIds = expectedAvailable;
      integrityNote('repair', 'Lista svincolati ricostruita dalle rose', context);
    }
    // The current auction player must still be available until awardAuction removes it.
    if (currentAuctionId && !state.availableIds.includes(currentAuctionId) && !owners.has(currentAuctionId)) {
      state.availableIds.push(currentAuctionId);
      clean=false;
      integrityNote('repair', 'Giocatore in asta reinserito tra i disponibili', context);
    }

    // 4) Live-auction legality: unique active IDs, valid leader, legal current price.
    if (state.auction) {
      const a = state.auction;
      const p = playerMap.get(a.playerId);
      const validManagers = new Set(state.managers.map(m=>m.id));
      a.activeIds = [...new Set((a.activeIds||[]).filter(id=>validManagers.has(id)))];
      if (!p || owners.has(a.playerId)) {
        clean=false;
        state.auction = null;
        integrityNote('repair', 'Asta non valida annullata in sicurezza', context);
      } else {
        let leader = state.managers.find(m=>m.id===a.highBidderId);
        if (!leader || !canOwn(leader,p)) {
          clean=false;
          leader = state.managers.find(m=>m.id===a.nominatorId && canOwn(m,p)) || state.managers.find(m=>canOwn(m,p));
          if (leader) { a.highBidderId=leader.id; a.price=1; }
          else { state.auction=null; }
          integrityNote('repair', 'Leader asta non valido corretto', context);
        }
        if (state.auction && leader) {
          const leaderMax = maxLegalBid(leader,p);
          if (!Number.isFinite(Number(a.price)) || a.price < 1 || a.price > leaderMax) {
            clean=false;
            a.price = clamp(Math.round(Number(a.price)||1),1,Math.max(1,leaderMax));
            integrityNote('repair', `Prezzo asta ricondotto al massimo legale (${a.price})`, context);
          }
          if (!a.activeIds.includes(leader.id)) a.activeIds.push(leader.id);
          a.activeIds = a.activeIds.filter(id=>{
            const m=state.managers.find(x=>x.id===id);
            return !!m && (id===leader.id || (id==='user' && !autocompleteMode && canOwn(m,p)) || (canOwn(m,p) && maxLegalBid(m,p)>a.price));
          });
        }
      }
    }

    // 5) Nomination pointer must always reference someone who can still fill the current role.
    if (!state.auction && !state.completed && state.currentRoleIndex < ROLE_ORDER.length) {
      const role=currentAuctionRole();
      const idx=clamp(Number(state.nominationIndex||0),0,state.managers.length-1);
      state.nominationIndex=idx;
      if (openRoleAuction()?!managerCanNominate(state.managers[idx]):roleSlotsRemaining(state.managers[idx],role)<=0) {
        state.nominationIndex=nextNominatorIndex(idx);
        clean=false;
        integrityNote('repair', 'Turno di chiamata riallineato a un manager eleggibile', context);
      }
    }
    return clean;
  }

  function rolePhaseComplete(role=currentAuctionRole()) {
    return !!state && state.managers.every(m => roleSlotsRemaining(m, role) <= 0);
  }

  function advanceRolePhaseIfNeeded() {
    if (!state) return false;
    if(openRoleAuction()) return false;
    let advanced = false;
    while (state.currentRoleIndex < ROLE_ORDER.length && rolePhaseComplete(ROLE_ORDER[state.currentRoleIndex])) {
      state.currentRoleIndex++;
      advanced = true;
    }
    return advanced;
  }


  function roleTransitionCopy(transition=state?.roleTransition) {
    if (!transition) return null;
    const from=transition.fromRole;
    const to=transition.toRole;
    const fromName=ROLE_PLURALS[from] || ROLE_LABELS[from] || from;
    const toName=to ? (ROLE_PLURALS[to] || ROLE_LABELS[to] || to) : null;
    return {
      eyebrow: transition.final ? 'ASTA · ULTIMO REPARTO COMPLETATO' : 'ASTA · REPARTO COMPLETATO',
      title: transition.final ? `${fromName} completati` : `${fromName} completati`,
      message: transition.final
        ? `Tutte le squadre hanno completato anche gli ${String(fromName).toLowerCase()}. L’asta è terminata.`
        : `Tutte le squadre hanno completato i ${String(fromName).toLowerCase()}. Quando sei pronto, si passa ai ${String(toName).toLowerCase()}.`,
      button: transition.final ? 'VAI AL RIEPILOGO' : `CONTINUA · ${String(toName).toUpperCase()}`
    };
  }

  function showRoleTransitionModal(){
    const modal=$('roleTransitionModal');
    const tr=state?.roleTransition;
    if(!modal || !tr) return;
    const copy=roleTransitionCopy(tr);
    $('roleTransitionEyebrow').textContent=copy.eyebrow;
    $('roleTransitionTitle').textContent=copy.title;
    $('roleTransitionMessage').textContent=copy.message;
    $('roleTransitionContinue').textContent=copy.button;
    const from=tr.fromRole;
    const totalNeeded=ROLE_LIMITS[from]*state.managers.length;
    const totalBought=state.managers.reduce((sum,m)=>sum+roleCount(m,from),0);
    $('roleTransitionStats').innerHTML=`<div><span>${escapeHtml(ROLE_PLURALS[from]||from)}</span><strong>${totalBought}/${totalNeeded}</strong><small>posti completati</small></div><div><span>PROSSIMA FASE</span><strong>${tr.final?'FINE ASTA':escapeHtml((ROLE_LABELS[tr.toRole]||tr.toRole).toUpperCase())}</strong><small>${tr.final?'riepilogo rose':'nuovo reparto'}</small></div>`;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
  }

  function hideRoleTransitionModal(){
    const modal=$('roleTransitionModal');
    if(!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
  }

  function beginRoleTransition(fromRole){
    const nextRole=state.currentRoleIndex<ROLE_ORDER.length ? ROLE_ORDER[state.currentRoleIndex] : null;
    state.roleTransition={fromRole,toRole:nextRole,final:!nextRole,createdAt:Date.now()};
    clearAuctionRuntimeTimers();
    saveState();
    renderAll();
    showRoleTransitionModal();
  }

  function continueAfterRoleTransition(){
    if(!state?.roleTransition) return;
    const wasFinal=!!state.roleTransition.final;
    state.roleTransition=null;
    hideRoleTransitionModal();
    if(wasFinal || state.currentRoleIndex>=ROLE_ORDER.length || allRostersComplete()){
      saveState();
      return finishAuction();
    }
    state.nominationIndex=nextNominatorIndex(state.nominationIndex);
    auditAndRepairState('role-transition-continue');
    saveState();
    renderAll();
    if(state.managers[state.nominationIndex].id!=='user') scheduleNomination();
  }

  function canOwn(manager, player) {
    return AuctionEngine.canOwn(manager,player,ROLE_LIMITS,TOTAL_SLOTS);
  }

  function maxLegalBid(manager, player) {
    const bundle=state?.auction?.arcade?.type==='bundle' && state.auction.playerId===player?.id ? playerMap.get(state.auction.arcade.secondPlayerId) : null;
    if(bundle) return Math.max(0,AuctionEngine.maxBundleBid(manager,[player,bundle],ROLE_LIMITS,TOTAL_SLOTS));
    return AuctionEngine.maxLegalBid(manager,player,ROLE_LIMITS,TOTAL_SLOTS);
  }

  // V3.2.35.56.99 · Valori asta dinamici per gennaio e stagioni successive.
  // La prima asta conserva esattamente il FVM originale. Quando un giocatore
  // evolve di OVR o arriva dal pool estero, viene invece confrontato con pari
  // ruolo/OVR del database iniziale per evitare top player valutati 1 credito.
  function comparableAuctionFvm(player){
    if(!player) return 1;
    const role=String(player.role||'');
    const currentOvr=Math.max(50,Math.min(99,Number(currentPlayerOvr(player)||player.ovr||60)));
    const baseFvm=Math.max(1,Number(player.fvm||1));
    const original=basePlayerValueReference.get(String(player.id));

    // Nessuna modifica alla valutazione della stagione iniziale.
    if(original && Number(original.ovr||0)===currentOvr) return baseFvm;

    const peers=baseSerieAPlayers
      .filter(candidate=>String(candidate.role||'')===role)
      .slice()
      .sort((a,b)=>Math.abs(Number(a.ovr||0)-currentOvr)-Math.abs(Number(b.ovr||0)-currentOvr) || Number(b.fvm||0)-Number(a.fvm||0))
      .slice(0,7);
    const peerValues=peers.map(candidate=>Math.max(1,Number(candidate.fvm||1))).sort((a,b)=>a-b);
    const middle=Math.floor(peerValues.length/2);
    const peerMedian=peerValues.length
      ? (peerValues.length%2?peerValues[middle]:(peerValues[middle-1]+peerValues[middle])/2)
      : baseFvm;

    if(!original){
      // Nuovo arrivo: il FVM generato resta valido, ma non può essere molto
      // inferiore a quello di giocatori comparabili già presenti in Serie A.
      return Math.max(baseFvm,peerMedian*.72);
    }

    const originalOvr=Math.max(50,Math.min(99,Number(original.ovr||currentOvr)));
    const delta=Math.max(-12,Math.min(12,currentOvr-originalOvr));
    const evolvedFvm=baseFvm*Math.pow(1.105,delta);
    if(delta>0) return Math.max(evolvedFvm,peerMedian*.68);
    return Math.max(1,evolvedFvm);
  }

  function careerMarketProfiles(source=state){
    const profiles=new Map();
    if(!source || Number(source.career?.seasonNumber||1)<=1) return profiles;
    const groups=new Map();
    for(const player of window.FANTA_PLAYERS||[]){
      if(player.marketStatus==='abroad') continue;
      const key=`${player.club}|${player.role}`;
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(player);
    }
    for(const players of groups.values()){
      const ordered=players.slice().sort((a,b)=>Number(b.ovr)-Number(a.ovr) || String(a.id).localeCompare(String(b.id)));
      const role=ordered[0].role;
      const slots=clubRoleStarterSlots(ordered[0].club,role);
      const entries=ordered.map((p,rank)=>({id:p.id,score:Number(p.ovr)+starterHierarchyBias(role,rank,slots),unavailable:false}));
      for(const player of ordered){
        const pct=normalizedStarterProbability(entries,player.id,slots,role==='P'?2.4:4.4)/100;
        const factor=role==='P' ? .08+.92*pct : .22+.78*pct;
        const peers=baseSerieAPlayers.filter(p=>p.role===role).slice()
          .sort((a,b)=>Math.abs(Number(a.ovr)-Number(player.ovr))-Math.abs(Number(b.ovr)-Number(player.ovr)))
          .slice(0,7);
        const median=values=>{const sorted=values.slice().sort((a,b)=>a-b);const i=Math.floor(sorted.length/2);return sorted.length?(sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2):1;};
        const peerFvm=median(peers.map(p=>Math.max(1,Number(p.fvm||1))));
        const peerQuote=median(peers.map(p=>Math.max(1,Number(p.quotation||1))));
        const peerOvr=median(peers.map(p=>Number(p.ovr||60)));
        const strength=Math.pow(1.08,clamp(Number(player.ovr)-peerOvr,-20,20));
        profiles.set(String(player.id),{
          // Recompute from immutable baseline peers, never last season's price.
          fvm:Math.max(1,peerFvm*strength*factor),
          quotation:Math.max(1,Math.round(peerQuote*strength*factor)),starterPct:Math.round(pct*100)
        });
      }
    }
    return profiles;
  }

  function buildMarketValueMap(profiles=new Map()) {
    const valuationPlayers=(window.FANTA_PLAYERS||[]).map(player=>({
      ...player,
      ovr:currentPlayerOvr(player),
      fvm:profiles.get(String(player.id))?.fvm ?? comparableAuctionFvm(player)
    }));
    return AuctionEngine.buildMarketValueMap(valuationPlayers,ROLE_LIMITS,MARKET_ALPHA,MARKET_VALUE_POOL_TARGET,10);
  }

  function refreshMarketValueMap(source=state){
    const profiles=careerMarketProfiles(source);
    for(const player of window.FANTA_PLAYERS||[]){
      const profile=profiles.get(String(player.id));
      if(profile) player.quotation=profile.quotation;
    }
    marketValueMap=buildMarketValueMap(profiles);
    if(typeof slotRankingCache!=='undefined') slotRankingCache.clear();
    return marketValueMap;
  }

  function baseAuctionValue(player) {
    if(!player) return 1;
    const mapped=marketValueMap.get(player.id) ?? marketValueMap.get(String(player.id));
    if(Number.isFinite(Number(mapped)) && Number(mapped)>0) return Math.max(1,Number(mapped));
    // Fallback di sicurezza per record non ancora sincronizzati: mai più 1 fisso
    // per un giocatore forte soltanto perché il suo ID non era nel listone iniziale.
    const comparable=comparableAuctionFvm(player);
    return Math.max(1,Number(player.quotation||1)*.9,comparable*.12);
  }

  function roleSpend(manager, role) {
    return manager.roster.filter(x => x.role === role).reduce((sum,x)=>sum + Number(x.price||0), 0);
  }

  function targetFor(manager, role) {
    return Number(manager.profile?.targets?.[role] || MARKET_ROLE_TARGET[role]);
  }

  // V3.2.35.56.32 · Le CPU leggono il regolamento stagionale.
  // Il regolamento modifica leggermente le priorità, senza cancellare la personalità del manager.
  function cpuLeagueRuleSensitivity(manager){
    if(!manager || manager.id==='user') return 0;
    const arch=profileArchetype(manager);
    const map={
      admin:1.25,stratega:1.22,esperto:1.18,moneyball:1.15,ragioniere:1.10,tirchio:1.05,
      rivale:.95,tifoso:.82,bomber:.78,spendaccione:.72,collezionista:.72,gambler:.72,pazzo:.55
    };
    return Number(map[arch] ?? 1);
  }

  function cpuLeagueRuleAuctionFactor(manager,player){
    if(!manager || manager.id==='user' || !player) return 1;
    const rules=leagueRulesFor(state);
    const sensitivity=cpuLeagueRuleSensitivity(manager);
    const role=String(player.role||'');
    const analysis=auctionPlayerAnalysis(player);
    const starterPct=Number(analysis?.starterPct||55);
    const market=Math.max(1,baseAuctionValue(player));
    let factor=1;

    // Modificatore classico: P e soprattutto D affidabili acquistano più valore.
    if(rules.defenseModifier==='classic'){
      if(role==='P') factor*=1+.025*sensitivity;
      if(role==='D') factor*=1+.055*sensitivity;
      if((role==='P'||role==='D') && Number(player.ovr||0)>=80) factor*=1+.012*sensitivity;
    }

    // Porta inviolata: il beneficio diretto è del portiere.
    if(Number(rules.cleanSheetBonus||0)>0 && role==='P') factor*=1+.05*sensitivity;

    // Con pochi cambi la CPU paga di più la sicurezza di titolarità e penalizza le scommesse.
    const starterSignal=clamp((starterPct-55)/40,-1,1);
    if(Number(rules.maxFantasySubs)===1) factor*=1+starterSignal*.06*sensitivity;
    else if(Number(rules.maxFantasySubs)===3) factor*=1+starterSignal*.028*sensitivity;
    else if(Number(rules.maxFantasySubs)>=5 && ['C','A'].includes(role) && market>=TOP_VALUE_THRESHOLD[role]*.75) factor*=1+.012*sensitivity;

    // Soglia 65: leggero premio all'upside offensivo. A 67 conta un po' di più l'affidabilità.
    if(Number(rules.firstGoalThreshold)===65){
      if(role==='A') factor*=1+.035*sensitivity;
      else if(role==='C') factor*=1+.018*sensitivity;
    }else if(Number(rules.firstGoalThreshold)===67){
      factor*=1+Math.max(0,starterSignal)*.018*sensitivity;
      if(role==='P'||role==='D') factor*=1+.008*sensitivity;
    }

    return clamp(factor,.88,1.16);
  }

  function scarcityFactor(player) {
    if (!state) return 1;
    const availableCount = state.availableIds.reduce((n,id) => n + (playerMap.get(id)?.role === player.role ? 1 : 0), 0);
    const outstandingSlots = state.managers.reduce((sum,m)=>sum + roleSlotsRemaining(m, player.role), 0);
    if (!outstandingSlots || !availableCount) return 1;
    const ratio = outstandingSlots / availableCount;
    return clamp(.97 + .15 * ratio, .96, 1.12);
  }

  function freePerSlot(manager) {
    const left = slotsRemaining(manager);
    if (left <= 0) return 0;
    return Math.max(0, manager.budget - left) / left;
  }

  function wealthFactor(manager, player) {
    if (!state) return 1;
    const peers = state.managers.filter(m => roleSlotsRemaining(m, player.role) > 0 && slotsRemaining(m) > 0);
    const values = peers.map(freePerSlot).filter(v => v > 0).sort((a,b)=>a-b);
    if (!values.length) return 1;
    const mid = Math.floor(values.length/2);
    const median = values.length%2 ? values[mid] : (values[mid-1]+values[mid])/2;
    if (median <= 0) return 1;
    const ratio = freePerSlot(manager) / median;
    const phase = manager.roster.length / TOTAL_SLOTS;
    const exponent = .10 + .22 * phase;
    return clamp(Math.pow(Math.max(.1,ratio), exponent), .85, 1.40);
  }

  function urgencyFactor(manager) {
    const left = slotsRemaining(manager);
    if (left <= 0) return 1;
    let remainingPlan = 0;
    Object.keys(ROLE_LIMITS).forEach(role => {
      const roleLeft = roleSlotsRemaining(manager, role);
      if (roleLeft > 0) remainingPlan += Math.max(roleLeft, targetFor(manager,role)-roleSpend(manager,role));
    });
    const ratio = manager.budget / Math.max(left, remainingPlan);
    const phase = manager.roster.length / TOTAL_SLOTS;
    const urgency = ratio >= 1
      ? 1 + (ratio-1) * (.18 + .95*phase)
      : 1 - (1-ratio) * .10;
    return clamp(urgency, .86, 2.10);
  }

  // V3.2.35.43 · Urgenza reparto leggibile e più aggressiva.
  function cpuRoleUrgencyState(manager, role=currentAuctionRole()) {
    if (!state || !manager || manager.id==='user' || !role) return {active:false,severity:0,roleLeft:0,validLeft:0};
    const roleLeft=Math.max(0,roleSlotsRemaining(manager,role));
    if(roleLeft<2) return {active:false,severity:0,roleLeft,validLeft:0};
    const cutoff=Math.max(3,TOP_VALUE_THRESHOLD[role]*.52);
    const available=state.availableIds.map(id=>playerMap.get(id)).filter(p=>p&&p.role===role&&canOwn(manager,p)&&maxLegalBid(manager,p)>=1);
    const validLeft=available.filter(p=>baseAuctionValue(p)>=cutoff).length;
    const pressure=roleLeft/Math.max(1,validLeft);
    const supplyTight=available.length<=roleLeft*4;
    const active=supplyTight && validLeft<=roleLeft+2;
    const severity=active?clamp((pressure-.45)*1.25,0,1):0;
    return {active,severity,roleLeft,validLeft};
  }

  function hasGoodRelations(manager){
    if(!manager || manager.id==='user' || !state) return false;
    const r=relationship(manager.id);
    return Number(r.trust||0)>=63 && Number(r.rivalry||0)<=4 && Number(r.agreements||0)>=1 && Number(r.betrayals||0)===0;
  }

  function isHotRival(manager){
    if(!manager || manager.id==='user' || !state) return false;
    const r=relationship(manager.id);
    // V3.2.35.44: RIVALE CALDO è uno stato raro. Servono almeno cinque
    // veri duelli prolungati, non semplici incroci di un singolo rilancio.
    return Number(r.duels||0)>=5 && Number(r.rivalry||0)>=10 && !hasGoodRelations(manager);
  }

  function needFactor(manager, player) {
    const left = roleSlotsRemaining(manager, player.role);
    if (left <= 0) return 0;
    if (left === 1) return 1.07;
    if (left === 2) return 1.025;
    return 1;
  }

  function auctionReputationMultiplier(player,source=state){
    if(Number(source?.career?.seasonNumber||1)<=1) return 1;
    return Number(source?.auctionReputation?.[String(player.id)]?.multiplier||1);
  }

  function buildSeasonAuctionReputation(season){
    const rows=Object.entries(season?.playerSeasonStats||{}).map(([id,stat])=>({id,...stat}));
    const result={};
    const awards=[['capocannoniere',1.15,rows.filter(p=>Number(p.goals||0)>0),p=>Number(p.goals||0)],['assistman',1.12,rows.filter(p=>Number(p.assists||0)>0),p=>Number(p.assists||0)],['mvp',1.18,rows.filter(p=>Number(p.voteCount||0)>=19),p=>Number(p.fantasySum||0)/Number(p.voteCount)]];
    for(const [award,multiplier,pool,value] of awards){
      if(!pool.length)continue;
      const best=Math.max(...pool.map(value));
      for(const player of pool.filter(p=>Math.abs(value(p)-best)<.000001)){
        const entry=result[player.id] ||= {multiplier:1,awards:[]};
        entry.multiplier=Math.max(entry.multiplier,multiplier);entry.awards.push(award);
      }
    }
    return result;
  }

  // V3.2.35.56.159 · Competenza progressiva, a budget e informazioni uguali.
  function cpuAuctionCompetence(manager,division=state?.career?.division||GAME_CONFIG.startingDivision){
    if(!manager || manager.id==='user') return 0;
    return ({4:0,3:.40,2:.75,1:1})[Math.max(1,Math.min(4,Number(division)))]||0;
  }

  function cpuAuctionRoleQuality(role){
    const key=`football-quality|${role}`;
    let cached=slotRankingCache.get(key);
    const day=Number(state?.season?.currentMatchday||0);
    if(!cached || cached.pool!==window.FANTA_PLAYERS || cached.playerCount!==window.FANTA_PLAYERS.length || cached.day!==day || cached.seed!==state?.marketSeed){
      const values=(window.FANTA_PLAYERS||[]).filter(p=>p.role===role).map(p=>currentPlayerOvr(p)).sort((a,b)=>a-b);
      const middle=Math.floor(values.length/2);
      const median=values.length ? (values.length%2?values[middle]:(values[middle-1]+values[middle])/2) : 70;
      cached={pool:window.FANTA_PLAYERS,playerCount:window.FANTA_PLAYERS.length,day,seed:state?.marketSeed,median,starterEstimates:new Map(),footballFactors:new Map()};
      slotRankingCache.set(key,cached);
    }
    return cached;
  }

  function cpuAuctionStarterEstimate(player){
    if(!player) return 0;
    const quality=cpuAuctionRoleQuality(player.role);
    if(!quality.starterEstimates.has(player.id)) quality.starterEstimates.set(player.id,auctionStarterProbability(player));
    return quality.starterEstimates.get(player.id);
  }

  function cpuFootballAuctionFactor(manager,player){
    const skill=cpuAuctionCompetence(manager);
    if(!skill || !player) return 1;
    const quality=cpuAuctionRoleQuality(player.role);
    if(quality.footballFactors.has(player.id)) return 1+(quality.footballFactors.get(player.id)-1)*skill;
    const median=quality.median;
    const starter=cpuAuctionStarterEstimate(player);
    // Prezzo, qualità e probabilità di giocare sono segnali distinti. Nessun
    // accesso all'esito futuro delle partite o al potenziale nascosto stagionale.
    const footballFactor=clamp(1+(currentPlayerOvr(player)-median)*.035+(starter-55)*.0018,.68,1.65);
    quality.footballFactors.set(player.id,footballFactor);
    return 1+(footballFactor-1)*skill;
  }

  function cpuCoverageEnabled(manager){
    return !!manager && manager.id!=='user' && Number(state?.career?.division||GAME_CONFIG.startingDivision)<=2;
  }

  function cpuClubRoleHierarchy(club,role){
    const key=`cover-hierarchy|${club}|${role}`;
    let cached=slotRankingCache.get(key);
    if(!cached || cached.players!==window.FANTA_PLAYERS){
      const players=window.FANTA_PLAYERS.filter(p=>p.club===club && p.role===role && p.marketStatus!=='abroad')
        .slice().sort((a,b)=>Number(b.ovr||0)*100+Number(b.fvm||0)*.22+Number(b.quotation||0)*.4-(Number(a.ovr||0)*100+Number(a.fvm||0)*.22+Number(a.quotation||0)*.4) || String(a.id).localeCompare(String(b.id)));
      cached={players:window.FANTA_PLAYERS,hierarchy:players};slotRankingCache.set(key,cached);
    }
    return cached.hierarchy;
  }

  function cpuMainKeeper(manager){
    return manager.roster.filter(p=>p.role==='P').map(p=>playerMap.get(p.id)||p)
      .filter(p=>cpuClubRoleHierarchy(p.club,'P')[0]?.id===p.id && cpuAuctionStarterEstimate(p)>=55)
      .sort((a,b)=>currentPlayerOvr(b)-currentPlayerOvr(a) || String(a.id).localeCompare(String(b.id)))[0] || null;
  }

  function cpuCoverInfo(manager,player){
    if(!cpuCoverageEnabled(manager) || !player || !canOwn(manager,player))return null;
    // No hidden identity may be used to recognise a mystery backup.
    if(state?.auction?.arcade?.type==='mystery' && state.auction.playerId===player.id)return null;
    const owned=manager.roster.filter(p=>p.role===player.role && p.club===player.club && p.id!==player.id);
    if(!owned.length)return null;
    const peers=cpuClubRoleHierarchy(player.club,player.role),rank=peers.findIndex(p=>p.id===player.id);
    const slots=clubRoleStarterSlots(player.club,player.role);
    if(player.role==='P'){
      const starter=peers[0];
      if(rank!==1 || !starter || cpuMainKeeper(manager)?.id!==starter.id || !owned.some(p=>p.id===starter.id) || cpuAuctionStarterEstimate(starter)<55)return null;
      const ceiling=profileArchetype(manager)==='admin'?7:Number(state.career.division)===1?6:4;
      return {kind:'keeper',starterId:starter.id,ceiling,factor:1.8};
    }
    // Outfield coverage is only a weak preference for the first rotation option
    // behind a probable owned starter, not a guaranteed positional replacement.
    if(rank!==slots || cpuAuctionStarterEstimate(player)>45 || cpuAuctionStarterEstimate(player)<5)return null;
    const starter=owned.map(p=>playerMap.get(p.id)||p).find(p=>peers.findIndex(x=>x.id===p.id)>=0 && peers.findIndex(x=>x.id===p.id)<slots && cpuAuctionStarterEstimate(p)>=55 && currentPlayerOvr(p)-currentPlayerOvr(player)<=10);
    if(!starter || owned.some(p=>peers.findIndex(x=>x.id===p.id)>=slots))return null;
    return {kind:'rotation',starterId:starter.id,ceiling:12,factor:profileArchetype(manager)==='admin'?1.16:1.10};
  }

  function cpuMissingKeeperCover(manager){
    if(!cpuCoverageEnabled(manager) || roleSlotsRemaining(manager,'P')<1)return null;
    for(const owned of manager.roster.filter(p=>p.role==='P')){
      const second=cpuClubRoleHierarchy(owned.club,'P')[1];
      if(second && state.availableIds.includes(second.id) && cpuCoverInfo(manager,second))return second;
    }
    return null;
  }

  function cpuKeeperReserve(manager,player){
    if(!cpuCoverageEnabled(manager))return 0;
    const missing=cpuMissingKeeperCover(manager);
    if(missing && missing.id!==player.id)return Math.min(cpuCoverInfo(manager,missing).ceiling,Math.max(0,manager.budget-slotsRemaining(manager)));
    // Protect a small backup fund when buying a new first-choice goalkeeper.
    if(player.role==='P' && roleSlotsRemaining(manager,'P')>=2){
      const peers=cpuClubRoleHierarchy(player.club,'P');
      if(peers[0]?.id===player.id && peers[1] && state.availableIds.includes(peers[1].id))return Number(state.career.division)===1?5:3;
    }
    return 0;
  }

  function cpuOpenRoleSpendingCap(manager,player,bundlePlayers=null){
    const members=bundlePlayers||[player],left=roleSlotsRemaining(manager,player.role);
    const legal=bundlePlayers?AuctionEngine.maxBundleBid(manager,members,ROLE_LIMITS,TOTAL_SLOTS):maxLegalBid(manager,player);
    if(legal<members.length) return legal;
    const plans={};let total=0;
    for(const role of ROLE_ORDER){
      const missing=roleSlotsRemaining(manager,role);
      plans[role]=missing?Math.max(0,targetFor(manager,role)-roleSpend(manager,role)-missing):0;
      total+=plans[role];
    }
    // Fund every unfinished department before bidding, even in lower divisions.
    // Completed departments release their unused funds. Old overspent saves
    // share the remaining balance proportionally rather than freezing all bids.
    const extra=Math.max(0,manager.budget-slotsRemaining(manager));
    const roleFund=left+(total>0?extra*plans[player.role]/total:extra*left/Math.max(1,slotsRemaining(manager)));
    let room=Math.max(members.length,Math.floor(roleFund)-Math.max(0,left-members.length));
    const desired={P:1,D:4,C:4,A:3}[player.role]||1;
    const median=cpuAuctionRoleQuality(player.role).median;
    const credible=p=>currentPlayerOvr(p)>=median+3 && cpuAuctionStarterEstimate(p)>=45;
    const owned=manager.roster.filter(p=>p.role===player.role && credible(p)).length;
    const need=Math.max(0,Math.min(desired-owned,left));
    if(need>=2){
      const bought=members.filter(credible).length;
      const share=bought>=need?1:bought>=2?.85:need>=4?.42:need>=3?.52:.68;
      room=Math.max(members.length,Math.floor(room*share));
    }
    const depthReserve=ROLE_ORDER.reduce((sum,role)=>sum+
      Math.max(0,roleSlotsRemaining(manager,role)-members.filter(p=>p.role===role).length)*({P:2,D:3,C:4,A:6}[role]||3),0);
    // Keep usable money for the remaining bench too, releasing it as slots fill.
    return Math.max(members.length,Math.min(legal,room,manager.budget-depthReserve));
  }

  function cpuAuctionSpendingCap(manager,player,bundlePlayers=null){
    const legal=bundlePlayers?AuctionEngine.maxBundleBid(manager,bundlePlayers,ROLE_LIMITS,TOTAL_SLOTS):maxLegalBid(manager,player),skill=cpuAuctionCompetence(manager);
    const openCap=openRoleAuction()?cpuOpenRoleSpendingCap(manager,player,bundlePlayers):legal;
    if(!skill || legal<1) return openCap;
    const key=`football-budget|${manager.id}|${player.role}`;
    let plan=slotRankingCache.get(key);
    if(!plan || plan.availableIds!==state.availableIds || plan.budget!==manager.budget || plan.skill!==skill){
      const starters={P:1,D:4,C:4,A:3};
      const weights={};
      let total=0,otherMinimum=0;
      for(const role of ROLE_ORDER){
        const left=roleSlotsRemaining(manager,role);
        if(!left){weights[role]=0;continue;}
        const median=cpuAuctionRoleQuality(role).median;
        const reliable=manager.roster.filter(p=>p.role===role && currentPlayerOvr(p)>=median+3 && cpuAuctionStarterEstimate(p)>=45).length;
        const gap=Math.max(0,starters[role]-reliable)/starters[role];
        weights[role]=Math.max(left,targetFor(manager,role)-roleSpend(manager,role))*(.75+gap*.5);
        total+=weights[role];
        if(role!==player.role) otherMinimum+=left;
      }
      const discretionary=Math.max(0,manager.budget-slotsRemaining(manager));
      const otherShare=total>0?1-weights[player.role]/total:0;
      // A proportional reserve alone shrinks after every purchase, allowing
      // repeated overspending in early departments to consume the attack fund.
      let plannedOtherReserve=0;
      for(const role of ROLE_ORDER){
        if(role===player.role) continue;
        const left=roleSlotsRemaining(manager,role);
        if(!left) continue;
        const remainingTarget=Math.max(left,targetFor(manager,role)-roleSpend(manager,role));
        const protection=role==='A' ? .97 : .90;
        plannedOtherReserve+=Math.max(left,Math.floor(remainingTarget*protection*skill));
      }
      plan={availableIds:state.availableIds,budget:manager.budget,skill,
        protected:Math.max(plannedOtherReserve,otherMinimum+Math.floor(discretionary*otherShare*skill))};
      slotRankingCache.set(key,plan);
    }
    // Il credito protetto copre gli altri reparti; il resto può essere usato
    // per questo acquisto. Con soli slot dello stesso ruolo resta il limite legale.
    const sameRoleReserve=Math.max(0,roleSlotsRemaining(manager,player.role)-(bundlePlayers?.length||1));
    let cap=manager.budget-plan.protected-sameRoleReserve;
    // Build three credible attackers before committing nearly the whole
    // department budget to one name. Once alternatives disappear, release it.
    if(player.role==='A' && skill>=.75){
      const median=cpuAuctionRoleQuality('A').median;
      const credible=p=>currentPlayerOvr(p)>=median+3 && cpuAuctionStarterEstimate(p)>=45;
      const owned=manager.roster.filter(p=>p.role==='A' && credible(p)).length;
      const need=Math.max(0,Math.min(3-owned,roleSlotsRemaining(manager,'A')));
      if(need>=2){
        const alternatives=state.availableIds.map(id=>playerMap.get(id)).filter(p=>
          p && p.role==='A' && !(bundlePlayers||[player]).some(member=>member.id===p.id) && credible(p));
        const purchased=(bundlePlayers||[player]).filter(credible).length;
        if(alternatives.length>=(bundlePlayers?Math.max(0,need-purchased):need-1)){
          const share=purchased>=need?1:purchased>=2?.85:need>=3 ? .55 : .70;
          if(purchased>0) cap=Math.min(cap,Math.floor(Math.max(0,cap)*share));
          else cap=Math.min(cap,Math.max(1,Math.floor(Math.max(0,cap)*.10)));
        }
      }
    }
    const coversKeeper=bundlePlayers?.some(first=>first.role==='P' && cpuClubRoleHierarchy(first.club,'P')[0]?.id===first.id && bundlePlayers.some(second=>cpuClubRoleHierarchy(first.club,'P')[1]?.id===second.id));
    if(!coversKeeper)cap-=cpuKeeperReserve(manager,player);
    return Math.max(1,Math.min(legal,openCap,cap));
  }

  function strategicPlayerScore(manager, player) {
    // A stable, manager-specific football value used only to decide whether an
    // open roster slot is worth spending on this player. It is intentionally
    // independent from the current auction price.
    const profile = manager?.profile || {};
    const market = Math.max(1, baseAuctionValue(player));
    let score = market*cpuFootballAuctionFactor(manager,player);

    if (profile.favoriteClub && profile.favoriteClub === player.club) score *= 1.10;
    if (profile.valueHunter) {
      const quote = Math.max(1, Number(player.quotation||1));
      const efficiency = Number(player.ovr||70) / quote;
      score *= clamp(.94 + efficiency * .018, .96, 1.09);
    }
    if (market >= TOP_VALUE_THRESHOLD[player.role]) score *= Number(profile.topBias||1);
    const rulesFactor=cpuLeagueRuleAuctionFactor(manager,player);
    score *= 1 + (rulesFactor-1)*.55;

    // Personal taste changes from career to career but remains stable inside
    // the same career, so CPUs do not suddenly change opinion mid-auction.
    score *= .94 + careerHash(`slot-taste|${manager.id}|${player.id}`) * .12;
    return score*auctionReputationMultiplier(player)*(cpuCoverInfo(manager,player)?.factor||1);
  }

  function strategicSlotInterest(manager, player) {
    if (!state || manager.id === 'user') return { willing:true, factor:1, passChance:0 };
    if (!canOwn(manager,player)) return { willing:false, factor:0, passChance:1 };

    const cover=cpuCoverInfo(manager,player);
    if(cover?.kind==='keeper')return {willing:true,factor:1,passChance:0};
    const pendingKeeper=player.role==='P'?cpuMissingKeeperCover(manager):null;
    if(pendingKeeper && pendingKeeper.id!==player.id && roleSlotsRemaining(manager,'P')===1 && maxLegalBid(manager,pendingKeeper)>=1)
      return {willing:false,factor:0,passChance:1};
    const role = player.role;
    const ownLeft = roleSlotsRemaining(manager,role);
    const totalOpen = state.managers.reduce((sum,m)=>sum + Math.max(0,roleSlotsRemaining(m,role)),0);
    const otherOpen = Math.max(0,totalOpen-ownLeft);
    const competence=cpuAuctionCompetence(manager);

    // Ranks stay valid until an award replaces availableIds. Gate decisions below
    // still use current budgets, ownership and the current nominator.
    const cacheKey = `${manager.id}|${role}`;
    let ranking = slotRankingCache.get(cacheKey);
    if (!ranking || ranking.availableIds !== state.availableIds || ranking.seed !== state.marketSeed) {
      const available = state.availableIds.map(id=>playerMap.get(id))
        .filter(p=>p && p.role===role)
        .map(p=>({p,score:strategicPlayerScore(manager,p)}))
        .sort((a,b)=>b.score-a.score).map(x=>x.p);
      ranking = {availableIds:state.availableIds,seed:state.marketSeed,available,
        ranks:new Map(available.map((p,i)=>[p.id,i]))};
      slotRankingCache.set(cacheKey,ranking);
    }
    const available = ranking.available;
    const rank = Math.max(0,ranking.ranks.get(player.id) ?? 0);
    const betterAvailable = rank;

    // Key anti-exploit idea:
    // if there are more better players available than all the OTHER managers
    // can possibly consume, at least one better option is mathematically likely
    // to survive for this CPU. Burning a slot now is therefore irrational.
    const guaranteedBetter = Math.max(0, betterAvailable - otherOpen);
    const demandWindow = Math.max(1,totalOpen);
    const rankRatio = (rank+1) / demandWindow;

    // Reserve at least one quality slot until the CPU has secured a credible
    // anchor for the role. This is especially important for 3-GK departments,
    // but works generically for all roles.
    const anchorCutoff = TOP_VALUE_THRESHOLD[role] * .70;
    const ownedRole = manager.roster.filter(x=>x.role===role);
    const hasAnchor = ownedRole.some(x => baseAuctionValue(x) >= anchorCutoff);
    const anchorsAvailable = available.filter(p=>baseAuctionValue(p)>=anchorCutoff).length;
    const candidateIsAnchor = baseAuctionValue(player)>=anchorCutoff;

    let passChance = 0;

    if (guaranteedBetter >= Math.max(1,ownLeft)) {
      passChance = .97;
    } else if (guaranteedBetter > 0) {
      passChance = .82 + Math.min(.13, guaranteedBetter / Math.max(1,ownLeft+2) * .13);
    }

    // Players clearly outside the number of slots still demanded by the league
    // are deep reserves. CPUs mostly leave them alone instead of filling slots
    // just because the opening price is one credit.
    if (rankRatio > 1.45) passChance = Math.max(passChance,.965);
    else if (rankRatio > 1.20) passChance = Math.max(passChance,.93);
    else if (rankRatio > 1.00) passChance = Math.max(passChance,.78);

    if (!hasAnchor && anchorsAvailable > 0 && !candidateIsAnchor) {
      // Strongest when the manager is getting close to its final role slots.
      const reservePressure = ownLeft <= 2 ? .94 : .86;
      passChance = Math.max(passChance,reservePressure);
    }

    // If the player is genuinely among this CPU's best remaining options, do
    // not overthink it: strong names should still attract broad bidding.
    if (rank < Math.max(2,Math.ceil(ownLeft*.75))) passChance *= .12;
    else if (rank < Math.max(4,ownLeft*2)) passChance *= .45;

    const archetype = profileArchetype(manager);
    if (['ragioniere','tirchio','moneyball','esperto'].includes(archetype)) passChance += .025;
    if (['spendaccione','bomber','collezionista'].includes(archetype)) passChance -= .02;
    if (archetype === 'pazzo') passChance -= .11; // sometimes makes a genuinely bad buy
    if (archetype === 'tifoso' && manager.profile?.favoriteClub === player.club) passChance -= .09;

    const liveUrgency=cpuRoleUrgencyState(manager,role);
    if(liveUrgency.active) passChance -= .08 + liveUrgency.severity*.07;
    if(isHotRival(manager) && state?.auction?.activeIds?.includes('user')) passChance -= .07;
    if(hasGoodRelations(manager) && state?.auction?.activeIds?.includes('user')) passChance += .04;

    // Dalla Serie C in su un buon giocatore rimasto tardi nel reparto non va
    // ignorato solo perché la CPU spera in un nome ancora migliore. Lo slot e
    // il credito legale restano obbligatori; la valutazione massima non cambia.
    const division=Number(state?.career?.division||GAME_CONFIG.startingDivision);
    const roleDemand=ROLE_LIMITS[role]*state.managers.length;
    const phaseCompletion=1-totalOpen/Math.max(1,roleDemand);
    const strongValue=baseAuctionValue(player);
    const strongLatePlayer=(Number(player.ovr||0)>=80 && strongValue>=TOP_VALUE_THRESHOLD[role]*.75) ||
      strongValue>=TOP_VALUE_THRESHOLD[role];
    if(division<=3 && phaseCompletion>=.60 && strongLatePlayer &&
       maxLegalBid(manager,player)>Number(state.auction?.price||1)){
      const latePressure=clamp((phaseCompletion-.60)/.20,0,1);
      const maxPass=division<=2 ? .12 : .18;
      passChance=Math.min(passChance,.40-(.40-maxPass)*latePressure);
    }

    // Non chiudere l'ultimo slot con una riserva mentre esistono alternative
    // migliori realmente acquistabili. La prudenza cresce con la categoria.
    if(competence>0 && ownLeft<=2 && rank>=ownLeft){
      const strongerAffordable=available.slice(0,rank).filter(p=>
        cpuFootballAuctionFactor(manager,p)>cpuFootballAuctionFactor(manager,player)+.08 &&
        baseAuctionValue(p)*ROLE_BID_CORRECTION[role]<=cpuAuctionSpendingCap(manager,p)).length;
      if(strongerAffordable>=ownLeft) passChance=Math.max(passChance,.75+competence*.23);
    }
    // I migliori profili restano contendibili già all'inizio del reparto.
    if(competence>0 && rank<Math.max(2,ownLeft) && cpuFootballAuctionFactor(manager,player)>1.08)
      passChance*=1-competence*.85;

    if(cover?.kind==='rotation')passChance=Math.min(passChance,.30);

    // A CPU that itself nominated the player has already made the strategic
    // decision to pursue it, so it must not immediately regret the call.
    const isNominator = (state.auction?.playerId===player.id || (state.auction?.arcade?.type==='bundle' && state.auction.arcade.secondPlayerId===player.id)) && state.auction?.nominatorId===manager.id;
    if (isNominator) passChance = 0;

    passChance = clamp(passChance,0,.992);
    const roll = careerHash(`slot-gate|${manager.id}|${player.id}`);
    const willing = roll >= passChance;

    // Marginal candidates that survive the gate still receive a lower ceiling;
    // CPUs may take them cheaply, but should not start bidding wars for them.
    let factor = 1;
    if (rankRatio > 1.00) factor *= .88;
    if (guaranteedBetter > 0) factor *= .84;
    if (!candidateIsAnchor && !hasAnchor && anchorsAvailable > 0) factor *= .88;
    if (isNominator) factor = Math.max(.94,factor);

    return { willing, factor:clamp(factor,.62,1), passChance, rank, guaranteedBetter };
  }

  function cpuBundleLimit(manager,players){
    const legal=AuctionEngine.maxBundleBid(manager,players,ROLE_LIMITS,TOTAL_SLOTS);
    if(legal<players.length)return 0;
    const values=players.map(player=>cpuLimit(manager,player,{bundleMember:true}));
    const anchor=players.slice().sort((a,b)=>baseAuctionValue(b)-baseAuctionValue(a) || String(a.id).localeCompare(String(b.id)))[0];
    let value=values.reduce((sum,v)=>sum+Math.max(1,v),0);
    if(cpuCoverageEnabled(manager)){
      const keeperPair=players.some(p=>p.role==='P' && cpuClubRoleHierarchy(p.club,'P')[0]?.id===p.id && players.some(q=>cpuClubRoleHierarchy(p.club,'P')[1]?.id===q.id));
      if(keeperPair)value+=Math.min(4,value*.08);
    }
    const cap=cpuAuctionSpendingCap(manager,anchor,players);
    return cap<2?0:Math.max(2,Math.min(legal,cap,Math.round(value)));
  }

  function cpuLimit(manager, player,options={}) {
    const second=!options.bundleMember && state?.auction?.arcade?.type==='bundle' && state.auction.playerId===player.id ? playerMap.get(state.auction.arcade.secondPlayerId):null;
    if(second)return cpuBundleLimit(manager,[player,second]);
    // Hidden identity must not influence CPU offers: only public role/club.
    if(state?.auction?.arcade?.type==='mystery' && state.auction.playerId===player.id){
      const pool=window.FANTA_PLAYERS.filter(p=>p.role===player.role && p.club===player.club);
      const publicValues=pool.map(p=>baseAuctionValue(p)).sort((a,b)=>a-b);
      const publicValue=publicValues[Math.floor(publicValues.length/2)]||1;
      const cap=Math.min(maxLegalBid(manager,player),Math.max(1,Math.floor((targetFor(manager,player.role)-roleSpend(manager,player.role))/Math.max(1,roleSlotsRemaining(manager,player.role)))));
      return Math.max(0,Math.min(cap,Math.round(publicValue*Number(manager.profile?.aggression||1)*(state.auction.bluffActive?1.1:1))));
    }
    const cover=cpuCoverInfo(manager,player);
    if(cover?.kind==='keeper')return Math.max(0,Math.min(cover.ceiling,maxLegalBid(manager,player),options.bundleMember?Infinity:cpuAuctionSpendingCap(manager,player)));
    const profile = manager.profile || PERSONALITIES[0];
    const role = player.role;
    const market = baseAuctionValue(player);
    const legal = options.bundleMember?AuctionEngine.maxLegalBid(manager,player,ROLE_LIMITS,TOTAL_SLOTS):maxLegalBid(manager, player);
    if (legal < 1) return 0;

    const slotInterest = strategicSlotInterest(manager,player);
    if (!slotInterest.willing && !options.bundleMember) return 0;

    const personalTarget = targetFor(manager, role);
    const rolePreference = Math.pow(personalTarget / MARKET_ROLE_TARGET[role], .26);
    const spent = roleSpend(manager, role);
    const roleLeft = roleSlotsRemaining(manager, role);
    const remainingTarget = Math.max(roleLeft, personalTarget-spent);
    const averageRoom = remainingTarget / Math.max(1, roleLeft);
    const targetFactor = spent >= personalTarget
      ? .91
      : clamp(Math.pow(averageRoom / Math.max(1,market), .08), .90, 1.065);

    // Career-to-career perception is deliberately broader than V1.9.0, while
    // remaining mean-neutral so the calibrated league economy does not drift.
    const baseVolatility = Number(profile.volatility||0);
    const personalAmp = Math.min(.18, baseVolatility * 1.22 + .012);
    const stableNoise = (careerHash(`value|${manager.id}|${player.id}`) - .5) * 2 * personalAmp;
    const marketPulse = (careerHash(`market-pulse|${player.id}`) - .5) * .08; // shared ±4% perception this career
    const roleMood = (careerHash(`role-mood|${manager.id}|${role}`) - .5) * .05; // manager/role ±2.5%
    const footballFactor=cpuFootballAuctionFactor(manager,player);
    let value = market * footballFactor * ROLE_BID_CORRECTION[role] * 1.01;
    value *= rolePreference;
    value *= Number(profile.aggression||1);
    value *= targetFactor;
    value *= needFactor(manager, player);
    value *= scarcityFactor(player);
    value *= Math.max(.70, 1 + stableNoise + marketPulse + roleMood);
    value *= urgencyFactor(manager);
    const liveUrgency=cpuRoleUrgencyState(manager,role);
    if(liveUrgency.active) value *= 1.12 + liveUrgency.severity*.10;
    if(isHotRival(manager) && state?.auction?.activeIds?.includes('user')) value *= 1.08;
    if(hasGoodRelations(manager) && state?.auction?.activeIds?.includes('user')) value *= .97;
    value *= wealthFactor(manager, player);
    value *= slotInterest.factor;
    value *= cpuLeagueRuleAuctionFactor(manager,player);

    if (profile.favoriteClub && profile.favoriteClub === player.club) value *= 1.12;
    if (profile.valueHunter) {
      const quote = Math.max(1, Number(player.quotation||1));
      const efficiency = Number(player.ovr||70) / quote;
      value *= clamp(.995 + (efficiency-4)*.012, .96, 1.06);
    }
    if (market >= TOP_VALUE_THRESHOLD[role]) value *= Number(profile.topBias||1);

    const heatRoll = careerHash(`heat|${manager.id}|${player.id}`);
    const heated = heatRoll < Number(profile.heat||0);
    if (heated) value *= 1.04 + careerHash(`heat2|${manager.id}|${player.id}`) * .08;

    const phase = manager.roster.length / TOTAL_SLOTS;
    const cap = market * footballFactor * ROLE_BID_CORRECTION[role] * (1.34 + .35*phase + (heated?.08:0));
    value = Math.min(value, cap);
    // V3.2.5: temporary auction-event modifiers.
    const contested = auctionEffects('contested_player').find(e=>e.playerId===player.id);
    value *= window.FantaAuctionEvents.contestedMultiplier(contested,manager.id);
    const war = auctionEffects('personal_war').find(e=>e.managerId===manager.id && Number(e.remainingCalls||0)>0);
    if (war && state?.auction?.activeIds?.includes('user')) value *= 1.14;

    // V3.2.35.39: nuovi eventi dinamici d'asta.
    const crazyAuction = auctionEffects('crazy_auction').find(e=>e.playerId===player.id);
    if (crazyAuction) {
      if ((crazyAuction.cpuIds||[]).includes(manager.id)) value *= Number(crazyAuction.multiplier||1.16);
      else value *= 1.035; // il rumore del tavolo contagia leggermente anche gli altri.
    }
    const opportunity = auctionEffects('market_opportunity').find(e=>e.playerId===player.id);
    if (opportunity && manager.id!=='user') value *= Number(opportunity.multiplier||.82);
    const untouchable = auctionEffects('untouchable_player').find(e=>e.playerId===player.id && e.cpuId===manager.id);
    if (untouchable) value *= Number(untouchable.multiplier||1.24);
    const pressure = auctionEffects('table_pressure').find(e=>Number(e.remainingCalls||0)>0);
    if (pressure && manager.id!=='user' && state?.auction?.activeIds?.includes('user')) value *= Number(pressure.multiplier||1.10);
    const sudden = auctionEffects('sudden_interest').find(e=>e.playerId===player.id && e.cpuId===manager.id && e.activated);
    if (sudden) value *= Number(sudden.multiplier||1.22);

    // BLUFF: some personalities are much easier to drag into an inflated bidding war.
    if (state?.auction?.bluffActive && manager.id !== 'user') {
      const arch=profileArchetype(manager);
      const vuln={pazzo:1.18,tifoso:1.16,spendaccione:1.15,gambler:1.14,bomber:1.10,collezionista:1.10,rivale:1.09,stratega:1.07,esperto:1.05,moneyball:1.04,ragioniere:1.035,tirchio:1.025}[arch] || 1.07;
      value *= vuln;
    }
    if(manager.id!=='user') value*=auctionReputationMultiplier(player);
    if(cover?.kind==='rotation')value+=Math.min(3,value*(cover.factor-1));
    return Math.max(1, Math.min(legal,options.bundleMember?Infinity:cpuAuctionSpendingCap(manager,player),Math.round(value)));
  }

  function jumpSize(manager, current, limit, player=null) {
    const headroom = Math.max(0, limit - current);
    if (headroom <= 1) return 1;

    const profile = manager.profile || {};
    const archetype = profileArchetype(manager);
    const roomRatio = clamp(headroom / Math.max(8, limit), 0, 1);
    const limitProgress = clamp(current / Math.max(1, limit), 0, 1);
    const topPlayer = player ? baseAuctionValue(player) >= TOP_VALUE_THRESHOLD[player.role] : false;

    // Base personality: conservative managers tend to climb one credit at a time;
    // aggressive / chaotic managers are more likely to make statement raises.
    let p10 = headroom >= 10 ? .08 + roomRatio * .25 : 0;
    let p5  = headroom >= 5  ? .22 + roomRatio * .34 : 0;

    if (['spendaccione','bomber','collezionista'].includes(archetype)) { p10 += .11; p5 += .10; }
    if (archetype === 'pazzo') { p10 += .14; p5 += .08; }
    if (['ragioniere','tirchio','moneyball'].includes(archetype)) { p10 -= .07; p5 -= .08; }
    if (archetype === 'esperto') { p10 -= .02; p5 += .03; }
    if (archetype === 'tifoso' && player && profile.favoriteClub === player.club) { p10 += .10; p5 += .09; }
    if (topPlayer && ['bomber','collezionista','spendaccione'].includes(archetype)) { p10 += .05; p5 += .05; }

    // As the CPU approaches its own valuation, it becomes visibly more cautious.
    if (limitProgress >= .82 || headroom <= 6) { p10 *= .12; p5 *= .48; }
    if (limitProgress >= .92 || headroom <= 3) { p10 = 0; p5 *= .12; }

    // A small "auction fever" effect after several raises makes wars feel less robotic.
    const bidCount = Number(state?.auction?.bidCount || 0);
    const duelHeat = clamp((bidCount - 3) / 10, 0, 1);
    p10 += duelHeat * Number(profile.heat || 0) * .55;
    p5  += duelHeat * Number(profile.heat || 0) * .70;

    p10 = clamp(p10, 0, headroom >= 10 ? .48 : 0);
    p5  = clamp(p5, 0, headroom >= 5 ? .68 : 0);
    // Even the most aggressive CPU sometimes makes the classic +1 raise.
    // Keep at least ~12% probability mass for it while there is plenty of headroom.
    const maxCombined = (limitProgress < .82 && headroom >= 5) ? .88 : .96;
    if (p10 + p5 > maxCombined) p5 = Math.max(0, maxCombined - p10);
    const r = Math.random();
    if (headroom >= 10 && r < p10) return 10;
    if (headroom >= 5 && r < p10 + p5) return 5;
    return 1;
  }

  const RIVAL_TEAM_NAMES = [
    'Real Colizzati',
    'Pochi Maledetti e Subito',
    'Atletico Ma Non Troppo',
    'FC Scarsenal',
    'Real Madrink',
    'Birra e Fantacalcio',
    'Gli Sbronzi di Riace',
    'Longobarda FC',
    'Pippe United',
    'Deportivo La Carogna',
    'Borgorosso FC',
    'Dinamo Bidone',
    'AC Picchia',
    'FC Cazzari',
    'I Senza Voto',
    'Zero Tituli',
    'Gli Ultimi Saranno Primi',
    'Quelli del 6 Politico',
    'Pareggio FC',
    'La Banda del +3',
    'Gli Assistiti',
    'Cartellino Rosso FC',
    'Gli Ammoniti',
    'FC Fuori Forma'
  ];

  const RIVAL_COLOR_BASES = [
    ['#d83d55','#251721'], ['#3d7dff','#101a35'], ['#f0b436','#3b1e17'],
    ['#53b96f','#132d20'], ['#8b68d9','#251840'], ['#2fafd2','#112b35'],
    ['#e553a3','#34152a'], ['#f07a35','#3c1d12'], ['#c7c9d8','#242638'],
    ['#7fc65a','#1d3218'], ['#f2d64b','#403515'], ['#5b71df','#161d48'],
    ['#c85de0','#35183e'], ['#3fc6a0','#12342c'], ['#e85f5f','#3b1717'],
    ['#a7d34d','#2e3d14'], ['#6eb9ff','#17324d'], ['#d9925a','#3b2416'],
    ['#b9a0ff','#2b2342'], ['#f0a7c8','#3c2030'], ['#79d8d0','#163433'],
    ['#efc16b','#3b2c16'], ['#9ed36d','#25361a'], ['#df6f98','#3b1c29']
  ];

  function freshRivalIdentityPool(count=9){
    const names=shuffledCopy(RIVAL_TEAM_NAMES).slice(0,count);
    const colors=shuffledCopy(RIVAL_COLOR_BASES).slice(0,count);
    return names.map((team,i)=>({
      team,
      teamColors:{primary:colors[i][0],secondary:colors[i][1]}
    }));
  }

  function cpuPersonalityPool(division=state?.career?.division||GAME_CONFIG.startingDivision){
    const level=Math.max(1,Math.floor(Number(division||GAME_CONFIG.startingDivision)));
    if(level>=4) return PERSONALITIES.filter(p=>p.id!=='user' && p.id!=='admin' && !SPECIAL_RIVAL_IDS.includes(p.id));
    return PERSONALITIES.filter(p=>p.id!=='user' && (level===1 || p.id!=='admin'));
  }

  function pickCpuPersonalities(count=9, division=state?.career?.division||GAME_CONFIG.startingDivision) {
    const level=Math.max(1,Math.floor(Number(division||GAME_CONFIG.startingDivision)));
    const pool = cpuPersonalityPool(level).slice();
    for (let i=pool.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1));
      [pool[i],pool[j]]=[pool[j],pool[i]];
    }
    const selected=level===1 && count>0
      ? [PERSONALITIES.find(p=>p.id==='admin'),...pool.filter(p=>p.id!=='admin').slice(0,count-1)]
      : pool.slice(0,count);

    // In Serie B e Serie A i rivali speciali devono apparire più spesso, così la
    // categoria si percepisce più dura già dalla composizione della lega.
    if(level<=2){
      const selectedIds=new Set(selected.map(p=>p.id));
      const selectedSpecial=selected.filter(p=>SPECIAL_RIVAL_IDS.includes(p.id));
      const requiredSpecials=Math.min(3, count, SPECIAL_RIVAL_IDS.length);
      if(selectedSpecial.length < requiredSpecials){
        const specialPool=pool.filter(p=>SPECIAL_RIVAL_IDS.includes(p.id) && !selectedIds.has(p.id));
        let replaceIndex=selected.length-1;
        while(selected.filter(p=>SPECIAL_RIVAL_IDS.includes(p.id)).length < requiredSpecials && specialPool.length && replaceIndex>=0){
          while(replaceIndex>=0 && (SPECIAL_RIVAL_IDS.includes(selected[replaceIndex].id) || selected[replaceIndex].id==='admin')) replaceIndex--;
          if(replaceIndex<0) break;
          selectedIds.delete(selected[replaceIndex].id);
          selected[replaceIndex]=specialPool.shift();
          selectedIds.add(selected[replaceIndex].id);
          replaceIndex--;
        }
      }
    }
    return selected.slice(0,count);
  }

  function freshManagers(teamName, managerName, division=state?.career?.division||GAME_CONFIG.startingDivision) {
    const selected = pickCpuPersonalities(9, division);
    const rivalIdentities = freshRivalIdentityPool(9);
    const all = [PERSONALITIES.find(p=>p.id==='user'), ...selected];
    return all.map((p, idx) => {
      const rivalIdentity = idx===0 ? null : rivalIdentities[idx-1];
      return {
        id: idx === 0 ? 'user' : 'cpu'+idx,
        name: idx === 0 ? managerName : p.name,
        team: idx === 0 ? teamName : p.id==='admin' ? p.team : rivalIdentity.team,
        teamColors: idx === 0 ? null : p.id==='admin' ? {primary:'#a648dd',secondary:'#161020'} : {...rivalIdentity.teamColors},
        budget: INITIAL_BUDGET,
        roster: [],
        profile: {...p, archetype:p.id, id: idx===0?'user':'cpu'+idx}
      };
    });
  }

  function freshState(teamName, managerName) {
    activateCatalogBase({catalogMode:'base'});
    const marketSeed=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
    return {
      version: 24,
      marketSeed,
      currentRoleIndex: 0,
      startedAt: Date.now(),
      teamName,
      managerName,
      coachAvatar:{...COACH_AVATAR_DEFAULT},
      tradeWindows:{},tradeBudgetAdjustments:{},
      managers: freshManagers(teamName, managerName, GAME_CONFIG.startingDivision),
      availableIds: baseSerieAPlayers.map(p => p.id),
      nominationIndex: 0,
      nominationCalls:{},
      auction: null,
      roleTransition: null,
      log: [],
      turbo: false,
      completed: false,
      stats: { purchases:0, totalSpent:0, highest:null },
      auctionEvents: { count:0, lastPurchaseAt:-99, history:[], activeEffects:[], pending:null, relationships:{} },
      auctionPowers: { block:false, scout:false, bluff:false, observer:false, oneShot:false, uses:{block:0,scout:0,bluff:0,oneShot:0}, selected:[] },
      leagueRules: defaultLeagueRules(),
      transferMarket: TransferEngine.createMarketState(marketSeed),
      sponsorOfferIds: shuffledCopy(Object.keys(SEASON_SPONSORS)).slice(0,3),
      career: { euros:CAREER_STARTING_EUROS, startingEuros:CAREER_STARTING_EUROS, totalEarned:0, totalSpent:0, fantapoints:0, totalFantapointsEarned:0, totalFantapointsSpent:0, fantapointsHistory:[], seasonNumber:1, division:GAME_CONFIG.startingDivision, divisionScaleVersion:2, prizeHistory:[], nextAuctionBonusCredits:0 },
      integrity: { checks:0, repairs:0, warnings:0, lastCheck:null, recent:[] }
    };
  }

  const {buildStorageSnapshot,compactLongCareerState}=window.FantaStorageSnapshot.create({compactMarketState:TransferEngine.compactMarketState});

  // La persistenza tecnica vive in save-manager.js; qui resta soltanto la
  // serializzazione dello stato specifica di Fantallenatore.
  let saveErrorToastAt=0;

  function showPersistenceError(e){
    console.warn('Salvataggio non disponibile',e);
    const now=Date.now();
    if(now-saveErrorToastAt<5000) return;
    saveErrorToastAt=now;
    const name=String(e?.name||'');
    if(name==='QuotaExceededError' || name==='NS_ERROR_DOM_QUOTA_REACHED'){
      showToast('Spazio dati del browser esaurito. Il nuovo salvataggio usa IndexedDB: libera spazio sul dispositivo e riprova.',true);
    }else if(name==='SecurityError'){
      showToast('Il browser sta bloccando i dati locali del gioco. Aprilo in una finestra normale e consenti i dati del sito.',true);
    }else{
      showToast(`Salvataggio non riuscito${name?` (${name})`:''}.`,true);
    }
  }

  const saveManager=window.FantaSaveManager.createSaveManager({
    env:window,
    legacyKey:SAVE_KEY,
    dbName:'fantallenatore_db',
    dbVersion:1,
    storeName:'saves',
    currentSlot:'current',
    backupSlot:'backup',
    encode:encodeSavePayload,
    onError:showPersistenceError,
    onWarning:(...args)=>console.warn(...args)
  });

  function saveState() {
    if (!state) return false;
    auditAndRepairState('pre-save');
    if (serieALive && !serieALive.finalizing && state.season &&
        ['multilive','bigmatch'].includes(serieALive.phase)) {
      state.season.activeLive = snapshotSerieALive(serieALive);
    }
    try {
      const json=JSON.stringify(buildStorageSnapshot(state));
      saveManager.queue(saveManager.makeRecord(json,state.version));
      console.info(`Save IndexedDB in coda: ${Math.round(json.length/1024)} KB`);
      return true;
    } catch (e) {
      showPersistenceError(e);
      return false;
    }
  }

  function showToast(message, isError=false) {
    let toast = $('gameToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'gameToast';
      toast.setAttribute('role','status');
      toast.setAttribute('aria-live','polite');
      document.body.appendChild(toast);
    }
    clearTimeout(toastTimer);
    toast.setAttribute('role',isError?'alert':'status');
    toast.setAttribute('aria-live',isError?'assertive':'polite');
    toast.textContent = message;
    toast.className = `game-toast show${isError?' error':''}`;
    toastTimer = setTimeout(()=>toast.classList.remove('show'), isError?6000:3200);
  }

  async function saveWithFeedback(buttonId) {
    const button = typeof buttonId==='string' ? $(buttonId) : buttonId;
    if (!state) { showToast('Avvia una partita prima di salvare.'); return; }
    if (!saveState()) return;
    const ok=await saveManager.flush();
    if(!ok) return;
    if (button) {
      const label = button.textContent;
      button.textContent = 'Salvato ✓';
      setTimeout(()=>{ button.textContent=label; },800);
    }
  }

  function stopGameRuntime() {
    clearAuctionRuntimeTimers();
    hideRoleTransitionModal();
    roleRemainderAutoSim=false;
    autocompleteMode=false;
    hideRoleRemainderAutoSim();
    stopHubNewsCarousel();
    if (serieALive?.timer) clearInterval(serieALive.timer);
    hideSerieATvBanner();
    serieALive = null;
    hideAwardAnimation();
    closeAuctionEventModal();
    $('arcadeAuctionModal')?.classList.add('hidden');
    hideFormationChoiceModal();
    hideAdminRuleModal();
    lineupDraft=null;
    lineupReadOnly=false;
    lineupPartialContext=null;
    lineupAssistantAdjustments=[];
  }

  function migrateRarityHunterPurchase(source){
    const purchases=source?.season?.shopPurchases;
    const old=purchases?.rarity_hunter;
    if(!old) return false;
    if(!purchases.special_events){
      purchases.special_events={...old,id:'special_events',migratedFrom:'rarity_hunter'};
      if(source.season.sponsor?.freeSubscriptionId==='rarity_hunter') source.season.sponsor.freeSubscriptionId='special_events';
    }else if(source.career){
      // Se erano stati acquistati entrambi, il doppione rimosso viene rimborsato una sola volta.
      const amount=Math.max(0,Number(old.cost||0));
      if(old.currency==='fp'){
        source.career.fantapoints=Number(source.career.fantapoints||0)+amount;
        source.career.totalFantapointsSpent=Math.max(0,Number(source.career.totalFantapointsSpent||0)-amount);
      }else if(old.currency==='eur'){
        source.career.euros=Number(source.career.euros||0)+amount;
        source.career.totalSpent=Math.max(0,Number(source.career.totalSpent||0)-amount);
      }
    }
    delete purchases.rarity_hunter;
    return true;
  }

  function migrateCareerDivisionScale(parsed){
    // Vecchi salvataggi: Amatori=3, C=2, B=1. Aggiungi la A senza cambiare
    // la categoria raggiunta né ripetere la migrazione ai caricamenti futuri.
    if(!parsed?.career || parsed.career.divisionScaleVersion===2) return;
    parsed.career.division=Math.min(4,Math.max(1,Number(parsed.career.division||3)+1));
    for(const item of parsed.career.seasonHistory||[]){
      if(Number.isFinite(Number(item.division))) item.division=Number(item.division)+1;
      if(Number.isFinite(Number(item.nextDivision))) item.nextDivision=Number(item.nextDivision)+1;
    }
    for(const item of parsed.career.prizeHistory||[]){
      if(Number.isFinite(Number(item.division))) item.division=Number(item.division)+1;
    }
    if(parsed.nextSeasonMeta){
      for(const key of ['fromDivision','toDivision']){
        if(Number.isFinite(Number(parsed.nextSeasonMeta[key]))) parsed.nextSeasonMeta[key]=Number(parsed.nextSeasonMeta[key])+1;
      }
    }
    if(parsed.nextSeasonFlow){
      for(const key of ['currentDivision','nextDivision']){
        if(Number.isFinite(Number(parsed.nextSeasonFlow[key]))) parsed.nextSeasonFlow[key]=Number(parsed.nextSeasonFlow[key])+1;
      }
      if(parsed.nextSeasonFlow.champion && Number(parsed.nextSeasonFlow.currentDivision)===2){
        parsed.nextSeasonFlow.champion=false;
        parsed.nextSeasonFlow.promoted=true;
        parsed.nextSeasonFlow.nextDivision=1;
      }
    }
    parsed.career.divisionScaleVersion=2;
  }

  function normalizeSavedState(parsed){
    if (!parsed || ![8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24].includes(parsed.version) || !Array.isArray(parsed.managers)) return null;
    parsed=compactLongCareerState(parsed);
    if (parsed.version === 8) { parsed.version=9; parsed.auctionEvents={count:0,lastPurchaseAt:-99,history:[],activeEffects:[],pending:null,relationships:{}}; }
    if (parsed.version === 9) { parsed.version=10; parsed.auctionPowers={block:false,scout:false,bluff:false}; }
    if (parsed.version === 10) parsed.version=11;
    if (parsed.version === 11) parsed.version=12;
    if (parsed.version === 12) parsed.version=13;
    if (parsed.version === 13) parsed.version=14;
    if (parsed.version === 14) {
      // V3.2.13: Assistente Tecnico scende da 15 € a 10 €. Se era già stato acquistato, rimborsa la differenza una sola volta.
      const oldAssistant=parsed.season?.shopPurchases?.assistant_coach;
      if(oldAssistant && Number(oldAssistant.cost||0)>10){
        const refund=Math.max(0,Number(oldAssistant.cost||0)-10);
        parsed.career ||= {euros:CAREER_STARTING_EUROS,startingEuros:CAREER_STARTING_EUROS,totalEarned:0,totalSpent:0,seasonNumber:1,prizeHistory:[]};
        parsed.career.euros=Number(parsed.career.euros||0)+refund;
        parsed.career.totalSpent=Math.max(0,Number(parsed.career.totalSpent||0)-refund);
        oldAssistant.cost=10;
        oldAssistant.priceAdjustmentRefund=refund;
      }
      parsed.version=15;
    }
    if (parsed.version === 15) {
      // V3.2.14: la formazione persistente include anche l'ordine della panchina.
      if(parsed.season?.assistantCoachLineup && !Array.isArray(parsed.season.assistantCoachLineup.bench)) parsed.season.assistantCoachLineup.bench=[];
      parsed.version=16;
    }
    if (parsed.version === 16) parsed.version=17;
    if (parsed.version === 17) parsed.version=18;
    if (parsed.version === 18) parsed.version=19;
    if (parsed.version === 19) parsed.version=20;
    if (parsed.version === 20) parsed.version=21;
    if (parsed.version === 21) parsed.version=22;
    if (parsed.version === 22) parsed.version=23;
    if (parsed.version === 23) {
      // V3.2.35.56.29: regolamento stagionale sorteggiato pre-asta.
      parsed.leagueRules=defaultLeagueRules();
      parsed.version=24;
    }
    if(!parsed.leagueRules || typeof parsed.leagueRules!=='object') parsed.leagueRules=defaultLeagueRules();
    if(!parsed.transferMarket || typeof parsed.transferMarket!=='object') parsed.transferMarket=TransferEngine.createMarketState(parsed.marketSeed||'career');
    parsed.auctionPowers ||= {block:false,scout:false,bluff:false,observer:false,oneShot:false,uses:{block:0,scout:0,bluff:0,oneShot:0},selected:[]};
    if(parsed.auctionPowers.observer===undefined) parsed.auctionPowers.observer=false;
    if(parsed.auctionPowers.oneShot===undefined) parsed.auctionPowers.oneShot=false;
    if(!parsed.auctionPowers.uses || typeof parsed.auctionPowers.uses!=='object'){
      parsed.auctionPowers.uses={
        block:parsed.auctionPowers.block?1:0,
        scout:parsed.auctionPowers.scout?1:0,
        bluff:parsed.auctionPowers.bluff?1:0,
        oneShot:parsed.auctionPowers.oneShot?1:0
      };
    }
    ['block','scout','bluff','oneShot'].forEach(k=>{
      const max=k==='oneShot'?1:5;
      parsed.auctionPowers.uses[k]=Math.max(0,Math.min(max,Number(parsed.auctionPowers.uses[k]||0)));
    });
    parsed.career=CareerEngine.normalizeCareer(parsed.career,CAREER_STARTING_EUROS,GAME_CONFIG.startingDivision);
    migrateCareerDivisionScale(parsed);
    migrateRarityHunterPurchase(parsed);
    if(!Array.isArray(parsed.sponsorOfferIds) || parsed.sponsorOfferIds.length<3){
      parsed.sponsorOfferIds = shuffledCopy(Object.keys(SEASON_SPONSORS)).slice(0,3);
    } else {
      parsed.sponsorOfferIds = parsed.sponsorOfferIds.map(id=>String(id)).filter((id,index,list)=>SEASON_SPONSORS[id] && list.indexOf(id)===index).slice(0,3);
      if(parsed.sponsorOfferIds.length<3){
        shuffledCopy(Object.keys(SEASON_SPONSORS)).forEach(id=>{
          if(parsed.sponsorOfferIds.length<3 && !parsed.sponsorOfferIds.includes(id)) parsed.sponsorOfferIds.push(id);
        });
      }
    }
    if(parsed.season?.started && (!parsed.season.dashboardReadyDays || typeof parsed.season.dashboardReadyDays!=='object')) parsed.season.dashboardReadyDays={};
    if(parsed.season?.started && (!parsed.season.matchdayFlow || typeof parsed.season.matchdayFlow!=='object')) parsed.season.matchdayFlow={};
    if(parsed.season?.started && (!parsed.season.consumables || typeof parsed.season.consumables!=='object')) parsed.season.consumables={inventory:{},effects:{},usageHistory:[],purchaseHistory:[]};
    if(parsed.season?.started){
      parsed.season.consumables.inventory ||= {};
      parsed.season.consumables.effects ||= {};
      if(!Array.isArray(parsed.season.consumables.usageHistory)) parsed.season.consumables.usageHistory=[];
      if(!Array.isArray(parsed.season.consumables.purchaseHistory)) parsed.season.consumables.purchaseHistory=[];
    }
    if(parsed.season?.started && !Array.isArray(parsed.season.newsFeed)) parsed.season.newsFeed=[];
    if(parsed.season?.started && (!parsed.season.newsGeneratedDays || typeof parsed.season.newsGeneratedDays!=='object')) parsed.season.newsGeneratedDays={};
    if(parsed.season?.started && (!parsed.season.newsMeta || typeof parsed.season.newsMeta!=='object')) parsed.season.newsMeta={};
    if(parsed.season?.started && (!parsed.season.assistantCoachLineup || typeof parsed.season.assistantCoachLineup!=='object')) parsed.season.assistantCoachLineup={enabled:false,formation:null,starters:{},bench:[],updatedAt:0,lastSourceDay:0};
    // Recover a persisted live phase only when there is no match to resume
    // and no result or partially played fantasy round to preserve.
    const savedSeason=parsed.season;
    const savedDay=Number(savedSeason?.currentMatchday||0);
    const savedKey=String(savedDay);
    const savedFlow=savedSeason?.matchdayFlow?.[savedKey];
    const savedRound=savedSeason?.schedule?.[savedDay-1];
    if(savedFlow?.phase==='live' && savedRound?.matches?.length &&
       savedRound.matches.every(match=>!match.played) &&
       !savedSeason.matchdayResults?.[savedKey] &&
       !savedSeason.activeLive && !savedSeason.pendingBigMatch){
      savedFlow.phase='match_ready';
      savedFlow.updatedAt=Date.now();
      savedFlow.recoveredInterruptedLive=true;
      savedSeason.dashboardReadyDays[savedKey]=true;
    }
    return parsed;
  }

  function parseStoredPayload(payload){
    if(!payload) return null;
    try{ return normalizeSavedState(JSON.parse(decodeSavePayload(payload))); }
    catch(e){ console.warn('Salvataggio non leggibile',e); return null; }
  }

  async function loadSaved() {
    const result=await saveManager.load({
      parsePayload:parseStoredPayload,
      serializeState:savedState=>JSON.stringify(buildStorageSnapshot(savedState))
    });
    if(result.source==='backup') showToast('Recuperato automaticamente il backup precedente del salvataggio.');
    if(result.source==='legacy'&&result.migrated){
      console.info('Salvataggio precedente migrato automaticamente da localStorage a IndexedDB.');
      showToast('Salvataggio aggiornato al nuovo sistema IndexedDB ✓');
    }
    return result.state;
  }

  async function clearSaved() {
    await saveManager.clear();
  }

  async function initializeSaveSystem(){
    const info=await saveManager.initialize();
    if(info.backend==='legacy' && location.protocol==='file:'){
      setTimeout(()=>showToast('Per usare il nuovo salvataggio IndexedDB in locale, avvia il gioco con AVVIA_GIOCO.bat invece di aprire index.html direttamente.',true),700);
    }
    if(info.persistent!==null) console.info(`Storage persistente browser: ${info.persistent?'concesso':'non concesso'}`);
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(el => {
      const active=el.id===id;
      el.classList.toggle('active',active);
      el.setAttribute('aria-hidden',String(!active));
    });
    const activeScreen=$(id);
    if(activeScreen){
      activeScreen.setAttribute('tabindex','-1');
      requestAnimationFrame(()=>activeScreen.focus({preventScroll:true}));
    }
    document.body.classList.toggle('is-main-menu',id==='setupScreen');
  }

  function managerName(m) { return m.id === 'user' ? m.team : m.team; }
  function clubName(id) { return clubMap.get(id)?.name || id; }
  function clubShort(id) { return clubMap.get(id)?.shortName || String(id||'').slice(0,3).toUpperCase(); }
  function clubColor(id) { return clubMap.get(id)?.colorClub?.primary || '#34445e'; }
  function maxBidNow(manager) {
    const left = slotsRemaining(manager);
    if (left <= 0) return 0;
    return Math.max(0, manager.budget - Math.max(0,left-1));
  }
  function roleSpendPct(manager, role) { return Math.round(roleSpend(manager,role) / INITIAL_BUDGET * 100); }

  function renderAll() {
    if (!state) return;
    renderVisibleRivals();
    renderRoster();
    renderManagers();
    renderPhaseBanner();
    renderTurn();
    if (state.auction) renderAuction();
  }

  function renderPhaseBanner() {
    const el = $('phaseBanner');
    if (!el || !state || state.completed) return;
    if(openRoleAuction()){
      const bought=state.managers.reduce((sum,manager)=>sum+manager.roster.length,0);
      el.innerHTML=`<div><span>REGOLA ADMIN</span><strong>ASTA SENZA REPARTI</strong></div><small>${bought}/${TOTAL_SLOTS*state.managers.length} posti occupati · chiama qualsiasi ruolo, rispettando i limiti della rosa</small>`;
      return;
    }
    const role = currentAuctionRole();
    const idx = Math.min(Number(state.currentRoleIndex||0), ROLE_ORDER.length-1);
    const totalBought = state.managers.reduce((sum,m)=>sum+roleCount(m,role),0);
    const totalNeeded = ROLE_LIMITS[role] * state.managers.length;
    el.innerHTML = `<div><span>FASE ${idx+1}/4</span><strong>${ROLE_LABELS[role].toUpperCase()}</strong></div><small>${totalBought}/${totalNeeded} ${ROLE_PLURALS[role].toLowerCase()} acquistati · si passa al reparto successivo solo quando tutte le rose hanno completato questo ruolo</small>`;
  }

  function renderRoster() {
    const me = state.managers[0];
    $('myTeamName').textContent = me.team;
    $('myBudget').textContent = me.budget;
    $('mySlots').textContent = `${me.roster.length} / ${TOTAL_SLOTS}`;
    $('roleNeed').textContent = `P ${roleCount(me,'P')}/3 · D ${roleCount(me,'D')}/8 · C ${roleCount(me,'C')}/8 · A ${roleCount(me,'A')}/6`;
    $('myRoster').innerHTML = Object.keys(ROLE_LIMITS).map(role => {
      const items = me.roster.filter(x => x.role === role);
      const empties = Math.max(0, ROLE_LIMITS[role]-items.length);
      return `<div class="roster-role">
        <div class="roster-role-head"><strong>${ROLE_LABELS[role]}</strong><span>${items.length}/${ROLE_LIMITS[role]}</span></div>
        ${items.map(x=>`<div class="roster-item"><strong>${escapeHtml(x.name)}</strong><span class="paid">${x.price}</span></div>`).join('')}
        ${Array.from({length:Math.min(empties, role==='P'?3:2)},()=>'<div class="empty-slot"></div>').join('')}
      </div>`;
    }).join('');
  }

  function managerLiveAuctionBadges(manager, role=currentAuctionRole()){
    if(!manager || manager.id==='user' || state?.completed) return '';
    const badges=[];
    const urgency=cpuRoleUrgencyState(manager,role);
    if(urgency.active) badges.push('<span class="manager-live-badge urgency" title="Ha ancora diversi slot da riempire e poche opzioni valide: tenderà a essere più aggressivo.">URGENZA</span>');
    if(isHotRival(manager)) badges.push('<span class="manager-live-badge hot" title="Avete accumulato diversi duelli prolungati: tenderà a sfidarti più spesso.">RIVALE CALDO</span>');
    else if(hasGoodRelations(manager)) badges.push('<span class="manager-live-badge good-relations" title="Avete costruito fiducia e rispettato gli accordi: tenderà a essere leggermente meno aggressivo contro di te.">BUONI RAPPORTI</span>');
    return badges.length?`<div class="manager-live-badges">${badges.join('')}</div>`:'';
  }

  function buildLeagueManagerCards(summaryMode=false) {
    const currentRole = summaryMode ? null : currentAuctionRole();
    const auctionLeader = summaryMode ? null : (state.auction?.highBidderId || null);
    const auctionActiveIds = summaryMode ? [] : (state.auction?.activeIds || []);

    return state.managers.map((m,i) => {
      const isNominator = !summaryMode && !state.auction && state.nominationIndex===i && (openRoleAuction()?managerCanNominate(m):roleSlotsRemaining(m,currentRole)>0);
      const isLeader = !summaryMode && auctionLeader === m.id;
      const isInactive = !summaryMode && !!state.auction && !auctionActiveIds.includes(m.id) && !isLeader;
      const hasPassed = isInactive && m.id==='user';
      const isBlocked = isInactive && Array.isArray(state.auction?.blockedCpuIds) && state.auction.blockedCpuIds.includes(m.id);
      const livePact = state.auction ? activePactForPlayer(state.auction.playerId) : null;
      const isPactOut = isInactive && m.id!=='user' && livePact?.cpuId===m.id && !livePact?.cpuBetrayed;
      const classes = [
        'manager-card',
        m.id === 'user' ? 'is-user' : '',
        isNominator ? 'active' : '',
        isLeader ? 'leading' : '',
        isInactive ? 'has-passed' : '',
        summaryMode ? 'summary-manager-card' : ''
      ].filter(Boolean).join(' ');

      let status = summaryMode ? 'COMPLETA' : 'ATTESA';
      let statusClass = summaryMode ? 'complete' : 'waiting';
      if (!summaryMode) {
        if (isNominator) { status = 'CHIAMA'; statusClass = 'turn'; }
        if (state.auction) {
          if (isLeader) { status = 'IN TESTA'; statusClass = 'leader'; }
          else if (hasPassed) { status = 'PASS'; statusClass = 'passed'; }
          else if (isBlocked) { status = 'BLOCCATO'; statusClass = 'passed'; }
          else if (isPactOut) { status = 'PATTO'; statusClass = 'passed'; }
          else if (isInactive) { status = 'FUORI'; statusClass = 'passed'; }
          else { status = 'IN ASTA'; statusClass = 'bidding'; }
        }
      }

      const roleSections = ROLE_ORDER.map(role => {
        const items = m.roster.filter(x => x.role === role);
        const isCurrent = !summaryMode && role === currentRole && !state.completed;
        const spend = roleSpend(m,role);
        const pct = roleSpendPct(m,role);
        const rows = Array.from({length: ROLE_LIMITS[role]}, (_,idx) => {
          const x = items[idx];
          if (!x) return `<div class="league-player-row role-player-${role} is-empty"><span>—</span><em></em><b></b></div>`;
          return `<div class="league-player-row role-player-${role} ${summaryMode?'summary-player-row':''}" title="${escapeHtml(x.name)} · ${escapeHtml(clubName(x.club))} · ${x.price} crediti">
            <span>${escapeHtml(x.name)}</span>${summaryMode?'':`<em>${escapeHtml(clubShort(x.club))}</em>`}<b>${x.price}</b>
          </div>`;
        }).join('');
        return `<div class="league-role-block role-block-${role} ${isCurrent?'current-role':''}">
          <div class="league-role-strip role-strip-${role}">
            <span><strong>${role}</strong><small>${items.length}/${ROLE_LIMITS[role]}</small></span>
            <span class="role-spend"><b>${pct}%</b><small>${spend} cr</small></span>
          </div>
          <div class="league-role-players">${rows}</div>
        </div>`;
      }).join('');

      const progress = Math.round(m.roster.length / TOTAL_SLOTS * 100);
      return `<div class="${classes}">
        <div class="league-manager-head">
          <div class="manager-title-line">
            <span class="manager-online-dot"></span>
            <div class="manager-identity">
              <div class="manager-name" title="${escapeHtml(m.team)}">${escapeHtml(m.team)}</div>
              <div class="manager-personality">${m.id==='user' ? escapeHtml(state.managerName || 'Tu')+' · TU' : escapeHtml(m.profile.label)}</div>
              ${summaryMode?'':managerLiveAuctionBadges(m,currentRole)}
            </div>
            <span class="manager-status ${statusClass}">${status}</span>
          </div>
          <div class="manager-credit-line">
            <div class="credit-main"><span class="coin">●</span><strong>${m.budget}</strong><small>crediti</small></div>
          </div>
          <div class="manager-progress"><i style="width:${progress}%"></i></div>
          <div class="manager-substats">
            ${summaryMode ? `<span><strong>${TOTAL_BUDGET-m.budget}</strong><small>SPESA</small></span>` : `<span><strong>${maxBidNow(m)}</strong><small>MAX</small></span>`}
            <span class="slots"><strong>${m.roster.length}/${TOTAL_SLOTS}</strong><small>ROSA</small></span>
            <span><strong>${averageRosterValue(m)}</strong><small>OVR</small></span>
          </div>
        </div>
        <div class="league-roster">${roleSections}</div>
      </div>`;
    }).join('');
  }

  function renderManagers() {
    $('managerList').innerHTML = buildLeagueManagerCards(false);
  }

  function averageRosterValue(m) {
    if (!m.roster.length) return '—';
    return (m.roster.reduce((s,x)=>s+Number(x.ovr||0),0)/m.roster.length).toFixed(1);
  }

  function renderTurn() {
    if (state.completed) return;
    const auction = state.auction;
    if (auction) {
      $('nominationBox').classList.add('hidden');
      $('liveAuction').classList.remove('hidden');
      return;
    }
    $('liveAuction').classList.add('hidden');
    $('nominationBox').classList.remove('hidden');
    renderAuctionRoomList('nominationRoomList');
    if(openRoleAuction()){
      if(allRostersComplete()) return finishAuction();
      const nominator=state.managers[state.nominationIndex];
      const userTurn=nominator.id==='user';
      const filter=$('roleFilter');
      filter?.classList.toggle('hidden',!userTurn||autocompleteMode);
      if(filter && !ROLE_ORDER.includes(filter.value) && filter.value!=='ALL') filter.value='ALL';
      if($('availableRoleCaption')) $('availableRoleCaption').textContent='GIOCATORI CHIAMABILI';
      if($('nominationCalloutCopy')) $('nominationCalloutCopy').textContent='Scegli un giocatore di qualsiasi ruolo e chiamalo all’asta a 1 credito.';
      $('turnLabel').textContent=userTurn?'Tocca a te: chiama un giocatore di qualsiasi ruolo.':`${nominator.team} sta scegliendo un giocatore…`;
      if($('nominationTitle')) $('nominationTitle').textContent=userTurn?'Scegli un giocatore':'Chiamata CPU in corso';
      $('playerSearchArea').classList.toggle('hidden',!userTurn||autocompleteMode);
      $('cpuThinking').classList.toggle('hidden',userTurn&&!autocompleteMode);
      if(!userTurn||autocompleteMode) $('cpuThinkingText').textContent=autocompleteMode?'Autocompletamento dell’asta…':`${nominator.team} sta scegliendo un giocatore…`;
      if(userTurn&&!autocompleteMode){
        const uiKey=`libera:${state.availableIds.length}`;
        if(uiKey!==nominationUiKey){nominationUiKey=uiKey;$('playerSearch').value='';$('clubFilter').value='';$('sortFilter').value='recommended';}
        renderPlayerResults();
      }else{
        if($('availableRoleCount')) $('availableRoleCount').textContent=state.availableIds.length;
        if($('nominationRoleLabel')) $('nominationRoleLabel').textContent='Tutti i ruoli';
      }
      return;
    }
    $('roleFilter')?.classList.add('hidden');
    if($('availableRoleCaption')) $('availableRoleCaption').textContent='SVINCOLATI NEL REPARTO';
    if($('nominationCalloutCopy')) $('nominationCalloutCopy').textContent='Scegli un giocatore del reparto e chiamalo all’asta a 1 credito.';
    advanceRolePhaseIfNeeded();
    if (state.currentRoleIndex >= ROLE_ORDER.length) return finishAuction();
    const role = currentAuctionRole();
    const nominator = state.managers[state.nominationIndex];
    const userTurn = nominator.id === 'user';
    $('roleFilter').value = role;
    $('turnLabel').textContent = userTurn
      ? `Tocca a te: scegli un ${ROLE_LABELS[role].toLowerCase()} da mettere all'asta a 1 credito.`
      : `${nominator.team} sta scegliendo un ${ROLE_LABELS[role].toLowerCase()}…`;
    if ($('nominationTitle')) $('nominationTitle').textContent = userTurn ? `Chiama un ${ROLE_LABELS[role]}` : 'Chiamata CPU in corso';
    if ($('nominationRoleLabel')) $('nominationRoleLabel').textContent = ROLE_PLURALS[role];
    $('playerSearchArea').classList.toggle('hidden', !userTurn || autocompleteMode);
    $('cpuThinking').classList.toggle('hidden', userTurn && !autocompleteMode);
    if (!userTurn || autocompleteMode) $('cpuThinkingText').textContent = autocompleteMode ? `Autocompletamento · fase ${ROLE_LABELS[role]}…` : `${nominator.team} sta scegliendo un ${ROLE_LABELS[role].toLowerCase()}…`;
    if (userTurn && !autocompleteMode) {
      const uiKey = `${role}:${state.availableIds.length}`;
      if (uiKey !== nominationUiKey) {
        nominationUiKey = uiKey;
        $('playerSearch').value = '';
        $('clubFilter').value = '';
        $('sortFilter').value = 'recommended';
      }
      renderPlayerResults();
    }
  }

  function nominationSort(list, mode) {
    const out = list.slice();
    if (mode === 'ovr') return out.sort((a,b) => Number(b.ovr||0)-Number(a.ovr||0) || baseAuctionValue(b)-baseAuctionValue(a));
    if (mode === 'quotation') return out.sort((a,b) => Number(b.quotation||0)-Number(a.quotation||0) || Number(b.ovr||0)-Number(a.ovr||0));
    if (mode === 'name') return out.sort((a,b) => String(a.name).localeCompare(String(b.name),'it'));
    return out.sort((a,b) => baseAuctionValue(b)-baseAuctionValue(a) || Number(b.ovr||0)-Number(a.ovr||0));
  }

  function openNominationModal() {
    const modal = $('nominationModal');
    if (!modal || !state || state.auction) return;
    const isUserTurn = state.managers[state.nominationIndex]?.id === 'user';
    if (!isUserTurn) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    renderPlayerResults();
    setTimeout(() => $('playerSearch')?.focus(), 20);
  }

  function closeNominationModal() {
    const modal = $('nominationModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
  }

  function renderNominationClubFilter(rolePlayers) {
    const select = $('clubFilter');
    if (!select) return;
    const current = select.value;
    const clubs = [...new Set(rolePlayers.map(p=>p.club))]
      .map(id=>clubMap.get(id)).filter(Boolean)
      .sort((a,b)=>a.name.localeCompare(b.name,'it'));
    select.innerHTML = '<option value="">Tutti i club</option>' + clubs.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    if ([...select.options].some(o=>o.value===current)) select.value=current;
  }

  function nominationCard(p, rank=0, featured=false) {
    const club = clubMap.get(p.club);
    const short = clubShort(p.club);
    const color = clubColor(p.club);
    const analysis = auctionPlayerAnalysis(p);
    const observerActive=auctionObserverActive();
    const potentialChip=observerActive?`<em>Pot. ${escapeHtml(analysis.label)}</em>`:'';
    const starterChip=observerActive?`<em>Tit. ${analysis.starterPct}%</em>`:'';
    const observerAnalysis=observerActive?`<div class="nomination-player-analysis">${potentialChip}${starterChip}</div>`:'';
    const roleTag=openRoleAuction()?`<span class="nomination-role-tag role-${p.role}">${p.role} · ${escapeHtml(ROLE_LABELS[p.role]||p.role)}</span>`:'';
    if (featured) return `
      <article class="top-player-card role-accent-${p.role}" style="--club-color:${escapeHtml(color)}">
        <div class="top-player-rank">#${rank}</div>
        <div class="club-marker">${escapeHtml(short)}</div>
        <div class="top-player-copy">
          <span>${escapeHtml(club?.name || p.club)}</span>
          <h3>${escapeHtml(p.name)}</h3>${roleTag}
          ${observerAnalysis}
        </div>
        <div class="top-player-stats"><span>OVR <strong>${Number(p.ovr||0)}</strong></span><span>QUOT <strong>${Number(p.quotation||0)}</strong></span></div>
        <button class="call-player top-call" data-player="${p.id}">CHIAMA A 1</button>
      </article>`;
    return `
      <article class="free-player-card" style="--club-color:${escapeHtml(color)}">
        <div class="free-player-club">${escapeHtml(short)}</div>
        <div class="free-player-copy"><strong>${escapeHtml(p.name)}</strong>${roleTag}<span>${escapeHtml(club?.name || p.club)}</span>${observerAnalysis}</div>
        <div class="free-player-stat"><small>OVR</small><strong>${Number(p.ovr||0)}</strong></div>
        <div class="free-player-stat"><small>QUOT</small><strong>${Number(p.quotation||0)}</strong></div>
        <button class="call-player compact-call" data-player="${p.id}">Chiama 1</button>
      </article>`;
  }

  function auctionObserverActive(){
    const selected=Array.isArray(state?.auctionPowers?.selected)?state.auctionPowers.selected:[];
    return selected.includes('observer');
  }

  function playerSeasonPotentialProfile(player){
    if(!player) return {label:'NORMALE',trend:0,potential:55,tier:'normal'};
    const seasonNo=Math.max(1,Number(state?.career?.seasonNumber||1));
    const roll=careerHash(`season-potential-tier|${seasonNo}|${player.id}`);
    const strength=careerHash(`season-potential-strength|${seasonNo}|${player.id}`);
    if(roll<.03){
      return {label:'ELITE',trend:8+Math.floor(strength*3),potential:94+Math.floor(strength*5),tier:'elite'};
    }
    if(roll<.14){
      return {label:'ALTO',trend:4+Math.floor(strength*4),potential:78+Math.floor(strength*10),tier:'high'};
    }
    if(roll>=.97){
      return {label:'RISCHIO CALO',trend:-(8+Math.floor(strength*3)),potential:12+Math.floor(strength*10),tier:'collapse'};
    }
    if(roll>=.84){
      return {label:'BASSO',trend:-(3+Math.floor(strength*4)),potential:28+Math.floor(strength*14),tier:'low'};
    }
    const neutralTrend=-1+Math.floor(strength*5); // da -1 a +3: giocatore normalmente stabile.
    return {label:'NORMALE',trend:neutralTrend,potential:50+Math.floor(strength*17),tier:'normal'};
  }

  function clubRoleStarterSlots(clubId,role){
    const formation=String(clubMap.get(clubId)?.defaultFormation||'4-3-3').split('-').map(Number);
    return Math.max(1,Number({P:1,D:formation[0]||4,C:formation[1]||3,A:formation[2]||3}[role]||3));
  }

  function starterHierarchyBias(role,rank,slots){
    if(role==='P'){
      if(rank<=0) return 8;
      if(rank===1) return 0;
      return -5-Math.max(0,rank-2)*2;
    }
    return clamp((Number(slots||1)-Number(rank)-.5)*1.45,-5.5,5.5);
  }

  function normalizedStarterProbability(entries,targetId,slots,temperature){
    const engine=window.FantaSeasonEngine;
    if(engine?.normalizeStarterProbabilities){
      const probabilities=engine.normalizeStarterProbabilities(entries,slots,{cap:96,floor:1,temperature});
      return Number(probabilities[String(targetId)]||0);
    }
    const row=(entries||[]).find(entry=>String(entry.id)===String(targetId));
    return row?.unavailable?0:50;
  }

  function auctionStarterProbability(player){
    if(!player) return 0;
    const slots=clubRoleStarterSlots(player.club,player.role);
    const peers=(window.FANTA_PLAYERS||[])
      .filter(p=>p.club===player.club&&p.role===player.role&&p.marketStatus!=='abroad')
      .slice()
      .sort((a,b)=>{
        const av=Number(a.ovr||0)*100+Number(a.fvm||0)*.22+Number(a.quotation||0)*.4;
        const bv=Number(b.ovr||0)*100+Number(b.fvm||0)*.22+Number(b.quotation||0)*.4;
        return bv-av;
      });
    const entries=peers.map((candidate,rank)=>({
      id:candidate.id,
      score:Number(candidate.ovr||0)+Number(candidate.fvm||0)*.008+Number(candidate.quotation||0)*.025+starterHierarchyBias(candidate.role,rank,slots),
      unavailable:false
    }));
    return normalizedStarterProbability(entries,player.id,slots,player.role==='P'?2.4:4.4);
  }

  function auctionPlayerAnalysis(player){
    if(!player) return {potential:0,label:'—',starterPct:0,trend:0,tier:'normal'};
    const profile=playerSeasonPotentialProfile(player);

    const starterPct=auctionStarterProbability(player);
    return {potential:profile.potential,label:profile.label,starterPct,trend:profile.trend,tier:profile.tier};
  }

  function renderPlayerResults() {
    if (!state || state.auction) return;
    const me = state.managers[0];
    const q = $('playerSearch').value.trim().toLowerCase();
    const rf = openRoleAuction()?($('roleFilter')?.value||'ALL'):currentAuctionRole();
    const clubFilter = $('clubFilter')?.value || '';
    const sortMode = $('sortFilter')?.value || 'recommended';

    const rolePlayers = state.availableIds.map(id => playerMap.get(id)).filter(Boolean)
      .filter(p => canOwn(me,p) && (!openRoleAuction() || maxLegalBid(me,p)>=1) && (rf==='ALL'||p.role===rf));
    renderNominationClubFilter(rolePlayers);

    const currentClub = $('clubFilter')?.value || clubFilter;
    const filtered = rolePlayers.filter(p => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || clubName(p.club).toLowerCase().includes(q) || clubShort(p.club).toLowerCase().includes(q);
      const matchesClub = !currentClub || p.club===currentClub;
      return matchesQuery && matchesClub;
    });

    const list = nominationSort(filtered, sortMode).slice(0,120);

    if ($('availableRoleCount')) $('availableRoleCount').textContent = rolePlayers.length;
    if ($('filteredPlayerCount')) $('filteredPlayerCount').textContent = `${filtered.length} ${filtered.length===1?'giocatore':'giocatori'}`;
    if ($('freeListTitle')) $('freeListTitle').textContent = q || currentClub ? 'Risultati della ricerca' : rf==='ALL'?'Tutti i ruoli disponibili':`Tutti i ${ROLE_PLURALS[rf].toLowerCase()} liberi`;
    if($('nominationRoleLabel')) $('nominationRoleLabel').textContent=rf==='ALL'?'Tutti i ruoli':ROLE_PLURALS[rf];

    $('playerResults').innerHTML = list.length
      ? list.map(p=>nominationCard(p,0,false)).join('')
      : '<div class="nomination-empty">Nessun giocatore disponibile con questi filtri.</div>';

    document.querySelectorAll('.call-player').forEach(btn => btn.addEventListener('click', () => nominate(btn.dataset.player, 0)));
  }

  function renderAuctionRoomList(targetId='auctionRoomList') {
    const box = $(targetId);
    if (!box) return;
    const a = state?.auction;
    const leaderId = a?.arcade?.type==='sealed'&&!a.arcade.resolved?null:a?.highBidderId || null;
    const activeIds = a?.activeIds || [];
    const nominatorId = a?.nominatorId || state?.managers?.[state.nominationIndex]?.id;
    const rows = state.managers.slice().sort((x,y) => y.budget - x.budget).map(m => {
      const classes = ['auction-room-item'];
      if (m.id === 'user') classes.push('is-user');
      if (m.id === nominatorId && !a) classes.push('is-turn');
      if (m.id === leaderId) classes.push('is-leading');
      const inactive = !!a && !activeIds.includes(m.id) && leaderId !== m.id;
      if (inactive) classes.push('is-passed');
      const flashed = lastBidFlash && lastBidFlash.managerId===m.id && Date.now() < lastBidFlash.until;
      if (flashed) classes.push('just-bid');
      let sub = m.id==='user' ? (state.managerName || 'Tu') : m.profile.label;
      if (a) {
        const pact=activePactForPlayer(a.playerId);
        const blocked=inactive && Array.isArray(a.blockedCpuIds) && a.blockedCpuIds.includes(m.id);
        const pactOut=inactive && m.id!=='user' && pact?.cpuId===m.id && !pact?.cpuBetrayed;
        if (flashed) sub = `+${lastBidFlash.increment} → ${lastBidFlash.target}`;
        else if (m.id === leaderId) sub = 'In testa';
        else if (inactive && m.id==='user') sub = 'Pass';
        else if (blocked) sub = 'Bloccato';
        else if (pactOut) sub = 'Patto';
        else if (inactive) sub = 'Fuori';
        else sub = 'In asta';
      } else if (m.id === nominatorId) sub = 'Sta chiamando';
      const liveBadges=managerLiveAuctionBadges(m,currentAuctionRole());
      return `<div class="${classes.join(' ')}"><div class="name" title="${escapeHtml(m.team)}">${escapeHtml(m.team)}</div><div class="credits">${m.budget}</div><div class="sub">${escapeHtml(sub)}</div>${liveBadges}</div>`;
    }).join('');
    box.innerHTML = rows;
  }

  function auctionBundlePlayerMarkup(player){
    const analysis=auctionPlayerAnalysis(player);
    const details=auctionObserverActive()?`<div class="bundle-player-analysis"><div><span>POTENZIALE STAGIONE</span><strong>${escapeHtml(analysis.label)}</strong><div class="bundle-analysis-track"><i style="width:${clamp(analysis.potential,0,100)}%"></i></div></div><div><span>PROB. TITOLARE</span><strong>${analysis.starterPct}%</strong><div class="bundle-analysis-track starter"><i style="width:${clamp(analysis.starterPct,0,100)}%"></i></div></div></div>`:'';
    return `<article class="bundle-player-card" aria-label="${escapeHtml(player.name)}"><div class="bundle-player-top"><div class="bundle-player-avatar">${playerAvatarMarkup(player,player.name)}</div><div class="bundle-player-identity"><span class="bundle-player-role">${escapeHtml(ROLE_LABELS[player.role])}</span><h3>${escapeHtml(player.name)}</h3><span>${escapeHtml(clubName(player.club))}</span></div></div><div class="bundle-player-meta"><strong>OVR ${player.ovr}</strong><span>Quot. ${Number(player.quotation||0)}</span><span class="bundle-player-stars">${playerStars(player.ovr)}</span></div>${details}</article>`;
  }

  function renderAuction() {
    const a = state.auction;
    if (!a) return;
    const p = playerMap.get(a.playerId);
    $('auctionClub').textContent = clubName(p.club);
    const mystery=a.arcade?.type==='mystery' && !a.awarding;
    const second=a.arcade?.type==='bundle'?playerMap.get(a.arcade.secondPlayerId):null;
    $('auctionAvatar')?.closest('.auction-player-card')?.classList.toggle('has-bundle-players',!!second);
    if($('auctionBundlePlayers')){
      $('auctionBundlePlayers').hidden=!second;
      $('auctionBundlePlayers').innerHTML=second?`<div class="bundle-auction-heading"><span>DUE AL PREZZO DI UNO</span><small>2 giocatori · un’unica offerta</small></div><div class="bundle-player-grid">${auctionBundlePlayerMarkup(p)}${auctionBundlePlayerMarkup(second)}</div>`:'';
    }
    $('auctionName').textContent = mystery?'PACCO SORPRESA':second?`${p.name} + ${second.name}`:p.name;
    $('auctionOvr').textContent = mystery?'OVR ???':second?`OVR ${p.ovr} + ${second.ovr}`:`OVR ${p.ovr}`;
    $('auctionQuote').textContent = mystery?'Quot. ???':`Quot. ${Number(p.quotation||0)}`;
    if ($('auctionClubShort')) $('auctionClubShort').textContent = clubShort(p.club);
    if ($('auctionRoleLabel')) $('auctionRoleLabel').textContent = ROLE_LABELS[p.role];
    if ($('auctionAvatar')) { $('auctionAvatar').innerHTML = mystery?'<span class="arcade-silhouette" role="img" aria-label="Giocatore misterioso"><svg viewBox="0 0 64 72" aria-hidden="true" focusable="false"><path d="M20 10H44V16H50V30H44V36H38V42H26V32H32V26H38V20H26V26H14V16H20Z M26 48H38V60H26Z"/></svg></span>':playerAvatarMarkup(p,p.name); $('auctionAvatar').style.boxShadow = `0 10px 30px ${clubColor(p.club)}55`; }
    if ($('auctionStars')) $('auctionStars').textContent = mystery?'★ ? ★':playerStars(p.ovr);
    const analysis=auctionPlayerAnalysis(p);
    const observerActive=auctionObserverActive();
    const potentialItem=$('auctionPotentialLabel')?.closest('.auction-analysis-item');
    const starterItem=$('auctionStarterPct')?.closest('.auction-analysis-item');
    const analysisWrap=potentialItem?.parentElement || starterItem?.parentElement;
    if(potentialItem) potentialItem.hidden=!observerActive;
    if(starterItem) starterItem.hidden=!observerActive;
    if(analysisWrap) analysisWrap.style.display=observerActive?'':'none';
    if($('auctionPotentialLabel')) $('auctionPotentialLabel').textContent=observerActive?analysis.label:'—';
    if($('auctionStarterPct')) $('auctionStarterPct').textContent=observerActive?`${analysis.starterPct}%`:'—';
    if($('auctionPotentialBar')) $('auctionPotentialBar').style.width=observerActive?`${analysis.potential}%`:'0%';
    if($('auctionStarterBar')) $('auctionStarterBar').style.width=observerActive?`${analysis.starterPct}%`:'0%';
    $('currentPrice').textContent = a.arcade?.type==='sealed'&&!a.arcade.resolved?'???':a.price;
    renderArcadeBanner();
    const leader = state.managers.find(m => m.id===a.highBidderId);
    $('currentLeader').textContent = a.arcade?.type==='sealed'&&!a.arcade.resolved?'OFFERTE SEGRETE':leader ? leader.team : '—';
    const leaderImage = $('currentLeaderImage');
    const leaderInitials = $('currentLeaderInitials');
    const leaderArt = leader && leader.id !== 'user' ? RIVAL_ART[profileArchetype(leader)] : null;
    if (leaderImage && leaderInitials) {
      if (leaderArt) {
        leaderImage.src = `assets/rivals/${leaderArt}.webp`;
        leaderImage.alt = leader?.profile?.label || leader?.name || 'Allenatore in testa';
        leaderImage.classList.remove('hidden');
        leaderInitials.classList.add('hidden');
      } else {
        leaderImage.classList.add('hidden');
        leaderInitials.classList.remove('hidden');
        leaderInitials.textContent = leader ? playerInitials(leader.name || leader.team) : '—';
      }
    }
    const nominator = state.managers.find(m => m.id===a.nominatorId);
    if ($('auctionNominator')) $('auctionNominator').textContent = `Chiamato da ${nominator ? nominator.team : '—'}`;
    if ($('auctionActiveCount')) {
      const activeCount = a.activeIds.length;
      const pact = activePactForPlayer(p.id);
      $('auctionActiveCount').textContent = pact ? `PATTO ATTIVO · ${activeCount} ancora in asta` : `${activeCount} ${activeCount===1 ? 'fantallenatore' : 'fantallenatori'} ancora in asta`;
    }
    const me = state.managers[0];
    const myMax = maxLegalBid(me,p);

    // In V1.3 the countdown is global: the user can raise at any moment
    // while still active and not already leading.
    const userCanAct = a.arcade?.type!=='sealed' && !a.arcade?.awaitingAck && !a.awarding && !a.awaitingAuctionEvent && !autocompleteMode && a.activeIds.includes('user') && a.highBidderId !== 'user';
    $('userBidControls').classList.toggle('hidden', !userCanAct);
    $('waitingBid').classList.toggle('hidden', userCanAct || !!a.awarding);
    if (userCanAct) {
      const max = myMax;
      document.querySelectorAll('[data-inc]').forEach(btn => {
        const inc = Number(btn.dataset.inc);
        const target = a.price + inc;
        btn.disabled = target > max;
        if (btn.classList.contains('live-bid-btn')) {
          btn.innerHTML = `<span>RILANCIA</span><strong>+${inc}</strong><small>${target<=max ? `vai a ${target}` : 'oltre il max'}</small>`;
        } else {
          btn.textContent = `+${inc}${target<=max?` → ${target}`:''}`;
        }
      });
    }
    renderAuctionPowers();
    if ($('waitingBid')) {
      $('waitingBid').textContent = a.awaitingAuctionEvent
        ? 'Evento asta in corso…'
        : (a.highBidderId==='user'
          ? `Sei in testa. Se nessuno rilancia entro ${a.arcade?.type==='hammer'?2:5} secondi, è tuo.`
          : (a.activeIds.includes('user') ? 'Asta in corso…' : 'Hai passato. Attendi l’aggiudicazione…'));
    }
    renderAuctionRoomList();
    renderCountdown();
    const visibleLog = a.log.slice(-60);
    $('auctionLog').innerHTML = visibleLog.map(line => `<div class="log-line"><span>${escapeHtml(line.text)}</span><span class="${line.kind||''}">${escapeHtml(line.side||'')}</span></div>`).join('');
    $('auctionLog').scrollTop = $('auctionLog').scrollHeight;
    if ($('recentBidStrip')) {
      const recent = a.log.slice(-7).reverse();
      $('recentBidStrip').innerHTML = recent.length ? recent.map(line => {
        const cls = line.kind==='pass' ? 'pass' : (line.kind==='win' ? 'win' : (line.kind==='status' ? 'status' : 'bid'));
        const label = line.kind==='pass' ? 'PASS' : (line.kind==='win' ? 'AGGIUDICATO' : (line.side || (line.kind==='status' ? 'STATO' : '1')));
        const detail = line.kind==='bid' ? 'rilancio' : line.kind==='pass' ? 'fuori dall’asta' : line.kind==='status' ? 'stato asta' : 'chiusura';
        return `<div class="recent-bid-chip ${cls}"><span>${escapeHtml(line.text)}</span><b>${escapeHtml(label)}</b><small>${detail}</small></div>`;
      }).join('') : '<div class="recent-bids-empty">Nessun rilancio ancora.</div>';
    }
  }

  function addAuctionLog(text, side='', kind='') {
    if (!state.auction) return;
    state.auction.log.push({text,side,kind});
    if (state.auction.log.length > 120) state.auction.log = state.auction.log.slice(-120);
    renderAuction();
  }

  function auctionWindowMs() {
    // Autocomplete is a diagnostic shortcut. Manual play always uses the full 5 seconds.
    return autocompleteMode ? 180 : state?.auction?.arcade?.type==='hammer'?2000:BID_WINDOW_MS;
  }

  function clearAuctionRuntimeTimers() {
    clearTimeout(uiTimer);
    uiTimer = null;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null;
    cpuReactionTimers.forEach(t => clearTimeout(t));
    cpuReactionTimers = [];
    if (bidFlashTimer) clearTimeout(bidFlashTimer);
    bidFlashTimer = null;
    if (bidSpotlightTimer) clearTimeout(bidSpotlightTimer);
    bidSpotlightTimer = null;
    $('bidSpotlight')?.classList.add('hidden');
    if (awardAnimationTimer) clearTimeout(awardAnimationTimer);
    awardAnimationTimer = null;
    if (suddenInterestTimer) clearTimeout(suddenInterestTimer);
    suddenInterestTimer = null;
  }

  function renderCountdown() {
    if (!$('bidCountdown')) return;
    const a = state?.auction;
    if (!a) {
      $('bidCountdown').textContent = '5';
      $('countdownBar').style.width = '100%';
      return;
    }
    if (a.arcade?.awaitingAck || (a.arcade?.type==='sealed'&&!a.arcade.resolved)) {
      $('bidCountdown').textContent='—';$('countdownBar').style.width='100%';return;
    }
    if (a.awaitingAuctionEvent) {
      $('bidCountdown').textContent = '5';
      $('countdownBar').style.width = '100%';
      $('countdownBox').style.setProperty('--timer-progress','360deg');
      $('countdownBox').classList.remove('warning','urgent');
      return;
    }
    const windowMs = Math.max(1, Number(a.windowMs || auctionWindowMs()));
    const left = Math.max(0, Number(a.deadlineAt||0) - Date.now());
    const sec = left <= 0 ? 0 : Math.ceil(left / 1000);
    $('bidCountdown').textContent = String(sec);
    const progress = clamp(left/windowMs*100,0,100);
    $('countdownBar').style.width = `${progress}%`;
    $('countdownBox').style.setProperty('--timer-progress', `${progress * 3.6}deg`);
    $('countdownBox').classList.toggle('warning', !autocompleteMode && left <= 3000 && left > 1500);
    $('countdownBox').classList.toggle('urgent', !autocompleteMode && left <= 1500);
  }

  function startCountdownTicker() {
    if (countdownTimer) clearInterval(countdownTimer);
    renderAuctionRoomList();
    renderCountdown();
    countdownTimer = setInterval(() => {
      if (!state?.auction) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        return;
      }
      renderAuctionRoomList();
    renderCountdown();
      if (Date.now() >= Number(state.auction.deadlineAt||0)) {
        clearAuctionRuntimeTimers();
        awardAuction();
      }
    }, autocompleteMode ? 25 : 50);
  }

  function resetBidClock({logReset=false}={}) {
    if (!state?.auction) return;
    const a = state.auction;
    a.windowMs = auctionWindowMs();
    a.deadlineAt = Date.now() + a.windowMs;
    if (logReset && !autocompleteMode) {
      // No extra log line: the visual timer itself communicates the reset.
    }
    startCountdownTicker();
  }

  function nextDelay() { return state?.turbo || autocompleteMode ? 35 : 420; }

  function cpuNominationDelay(manager) {
    if (autocompleteMode) return 25 + Math.floor(Math.random()*65);
    if (state?.turbo) return 100 + Math.floor(Math.random()*260);
    const archetype = profileArchetype(manager);
    let min=520,max=1250;
    if (['spendaccione','bomber','collezionista'].includes(archetype)) { min=330; max=900; }
    if (['ragioniere','moneyball','esperto'].includes(archetype)) { min=700; max=1550; }
    if (archetype==='tirchio') { min=900; max=1800; }
    if (archetype==='pazzo') { min=280; max=1650; }
    return Math.round(min + Math.random()*(max-min));
  }

  function cpuReactionDelay(manager) {
    if (autocompleteMode) return 20 + Math.floor(Math.random()*80);
    if (state?.turbo) return 110 + Math.floor(Math.random()*420);

    const a = state?.auction;
    const p = a ? playerMap.get(a.playerId) : null;
    const profile = manager.profile || {};
    const archetype = profileArchetype(manager);
    const limit = p ? cpuLimit(manager,p) : 1;
    const headroom = a ? Math.max(0, limit - a.price) : limit;
    const roomRatio = clamp(headroom / Math.max(8,limit),0,1);

    // Each archetype has a recognisable rhythm, while still varying every bid.
    let min = 700, max = 2700, sniperChance = .08;
    if (archetype === 'bomber')       { min=380; max=1550; sniperChance=.04; }
    if (archetype === 'spendaccione') { min=300; max=1450; sniperChance=.03; }
    if (archetype === 'collezionista'){ min=420; max=1650; sniperChance=.04; }
    if (archetype === 'ragioniere')   { min=1150; max=3000; sniperChance=.13; }
    if (archetype === 'tirchio')      { min=1500; max=3500; sniperChance=.18; }
    if (archetype === 'moneyball')    { min=950; max=2800; sniperChance=.12; }
    if (archetype === 'esperto')      { min=800; max=2600; sniperChance=.20; }
    if (archetype === 'pazzo')        { min=250; max=3600; sniperChance=.16; }
    if (archetype === 'tifoso') {
      const fav = p && profile.favoriteClub === p.club;
      min = fav ? 280 : 850; max = fav ? 1350 : 2750; sniperChance = fav ? .03 : .10;
    }

    if(isHotRival(manager) && a?.activeIds?.includes('user')) { min*=.88; max*=.90; sniperChance+=.03; }
    if(hasGoodRelations(manager) && a?.activeIds?.includes('user')) { min*=1.06; max*=1.08; sniperChance=Math.max(0,sniperChance-.02); }
    if(cpuRoleUrgencyState(manager,p?.role).active) { min*=.86; max*=.88; }

    // Lots of headroom -> instinctive fast raise. Close to the ceiling -> hesitation.
    if (roomRatio > .55) { min *= .72; max *= .78; }
    if (roomRatio < .18) { min *= 1.18; max *= 1.20; sniperChance += .08; }

    // Occasionally hold the bid until the last second. This is bounded below the 5s deadline.
    if(a?.arcade?.type==='hammer'){
      if(Math.random()<sniperChance)return Math.round(1500+Math.random()*300);
      return Math.round(clamp((min+Math.random()*(max-min))*.40,180,1650));
    }
    if (Math.random() < sniperChance) return Math.round(3650 + Math.random()*900);
    return Math.round(clamp(min + Math.random()*(max-min), 280, 4550));
  }

  const ARCADE_AUCTION_LABELS={sealed:'RILANCIO AL BUIO',mystery:'PACCO SORPRESA',bundle:'DUE AL PREZZO DI UNO',hammer:'MARTELLO LAMPO',switch:'CAMBIO DI PROGRAMMA'};

  function prepareArcadeAuction(nom,calledPlayer){
    const a=state.auction;
    const types=['sealed','mystery'];
    const reserves=state.availableIds.map(id=>playerMap.get(id)).filter(p=>p && p.id!==calledPlayer.id && p.role===calledPlayer.role).sort((x,y)=>x.ovr-y.ovr);
    const second=reserves.slice(0,Math.max(1,Math.ceil(reserves.length/2)))[Math.floor(Math.random()*Math.max(1,Math.ceil(reserves.length/2)))];
    const bundleEligible=second?state.managers.filter(m=>AuctionEngine.maxBundleBid(m,[calledPlayer,second],ROLE_LIMITS,TOTAL_SLOTS)>=2):[];
    if(second && bundleEligible.length>=3 && bundleEligible.some(m=>m.id===nom.id)) types.push('bundle');
    if(a.activeIds.length<3) types.splice(types.indexOf('sealed'),1);
    types.push('hammer');
    const crossRolePool=!openRoleAuction()?state.availableIds.map(id=>playerMap.get(id)).filter(p=>p && p.role!==calledPlayer.role && canOwn(nom,p) && maxLegalBid(nom,p)>=1):[];
    if(crossRolePool.length)types.push('switch');
    const type=window.FantaAuctionEvents.rollArcade(types);
    if(!type)return;
    a.arcade={type,awaitingAck:true};
    if(type==='mystery'){
      const pool=state.availableIds.map(id=>playerMap.get(id)).filter(p=>p && p.role===calledPlayer.role && canOwn(nom,p));
      const chosen=pool[Math.floor(Math.random()*pool.length)];
      a.playerId=chosen.id;
      a.log=[{text:`${nom.team} chiama il Pacco sorpresa · ${ROLE_LABELS[chosen.role]} · ${clubName(chosen.club)}`,side:'1',kind:'status'}];
    } else if(type==='bundle'){
      a.arcade.secondPlayerId=second.id;
      a.activeIds=bundleEligible.map(m=>m.id);
      a.price=2;
      a.log=[{text:`${nom.team} chiama ${calledPlayer.name} + ${second.name}`,side:'2',kind:'status'}];
    } else if(type==='hammer'){
      a.arcade.windowMs=2000;
      a.log.push({text:'MARTELLO LAMPO · 2 secondi dopo ogni rilancio',side:'',kind:'status'});
    } else if(type==='switch'){
      a.arcade.originalRole=calledPlayer.role;
      a.arcade.crossRoleIds=crossRolePool.map(p=>p.id);
      const chosen=crossRolePool.slice().sort((x,y)=>strategicPlayerScore(nom,y)-strategicPlayerScore(nom,x) || String(x.id).localeCompare(String(y.id)))[0];
      a.playerId=chosen.id;
      a.activeIds=state.managers.filter(m=>canOwn(m,chosen)&&maxLegalBid(m,chosen)>=1).map(m=>m.id);
      a.log=[{text:`Cambio di programma · ${nom.team} chiama ${chosen.name}`,side:'1',kind:'bid'}];
    } else {
      a.arcade.tieOrder=Array.from({length:state.managers.length},(_,i)=>state.managers[(state.nominationIndex+i)%state.managers.length].id).filter(id=>a.activeIds.includes(id));
      // Generate each private offer once and persist it before displaying the form.
      a.arcade.offers=a.activeIds.filter(id=>id!=='user').map(id=>{
        const manager=state.managers.find(m=>m.id===id);
        const limit=cpuLimit(manager,calledPlayer);
        return {managerId:id,amount:Math.max(1,Math.min(maxLegalBid(manager,calledPlayer),Math.floor(limit*(.80+Math.random()*.20))))};
      });
      a.log=[{text:'Una sola offerta segreta a testa. Parità: precedenza al primo nell’ordine di chiamata.',side:'',kind:'status'}];
    }
  }

  function renderArcadeBanner(){
    let banner=$('arcadeAuctionBanner');
    if(!banner){
      banner=document.createElement('div');banner.id='arcadeAuctionBanner';banner.className='arcade-auction-banner';
      $('auctionName')?.parentElement?.appendChild(banner);
    }
    if(!banner)return;
    banner.hidden=!state?.auction?.arcade;
    if(state?.auction?.arcade) banner.textContent=ARCADE_AUCTION_LABELS[state.auction.arcade.type];
  }

  function showArcadeModal(){
    const a=state?.auction, ev=a?.arcade;
    if(!ev)return;
    clearAuctionRuntimeTimers();
    if(autocompleteMode){
      ev.awaitingAck=false;
      if(ev.type==='sealed'){
        if(!ev.resolved){
          const user=state.managers.find(m=>m.id==='user'),p=playerMap.get(a.playerId);
          if(ev.tieOrder.includes('user'))ev.offers.push({managerId:'user',amount:Math.max(1,Math.min(maxLegalBid(user,p),autoUserLimit(user,p)))});
          resolveSealedAuction();
        }
        return awardAuction();
      }
      saveState();return beginBidRound();
    }
    const modal=$('arcadeAuctionModal'),p=playerMap.get(a.playerId);
    modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
    $('arcadeAuctionTitle').textContent=ARCADE_AUCTION_LABELS[ev.type];
    let body='',buttons='';
    if(ev.type==='sealed' && ev.resolved){
      body='<p>OFFERTE SVELATE</p>'+ev.offers.map(o=>`<p>${escapeHtml(state.managers.find(m=>m.id===o.managerId)?.team||o.managerId)}: <strong>${o.amount?`${o.amount} crediti`:'PASS'}</strong></p>`).join('');
      buttons='<button type="button" class="primary" data-arcade-action="award">CONTINUA</button>';
    } else if(ev.type==='sealed'){
      const user=state.managers.find(m=>m.id==='user'),max=maxLegalBid(user,p);
      const participates=ev.tieOrder.includes('user') && max>=1;
      body='<p>Una sola offerta segreta per squadra. Chi offre di più prende il giocatore e paga la propria offerta. Le CPU hanno già preparato le loro: nessuno vede quelle degli altri.</p><p>In parità ha precedenza chi è prima nell’ordine di chiamata, a partire da chi ha chiamato.</p>';
      if(participates){
        body+=`<label for="arcadeSealedAmount">La tua offerta · da 1 a ${max} crediti</label><input id="arcadeSealedAmount" type="number" min="1" max="${max}" step="1" value="1" inputmode="numeric"><p id="arcadeSealedError" role="alert"></p>`;
        buttons='<button type="button" class="primary" data-arcade-action="submit">INVIA OFFERTA</button><button type="button" class="secondary" data-arcade-action="pass">PASSO</button>';
      } else {body+='<p>Non hai posti o crediti per partecipare a questa chiamata.</p>';buttons='<button type="button" class="primary" data-arcade-action="pass">SVELA OFFERTE</button>';}
    } else if(ev.type==='mystery'){
      body=`<p>L’admin ha estratto un giocatore: <strong>${escapeHtml(ROLE_LABELS[p.role])} · ${escapeHtml(clubName(p.club))}</strong>.</p><p>Nome, volto, OVR e quotazione verranno svelati all’aggiudicazione. Anche le CPU valutano solo ruolo e club.</p><p>${auctionObserverActive()?'Il tuo Osservatore continua a mostrarti potenziale e probabilità di titolarità.':'Potenziale e probabilità di titolarità sono visibili con Osservatore.'} Scout non è utilizzabile su questa chiamata.</p>`;
      buttons='<button type="button" class="primary" data-arcade-action="start">INIZIA ASTA</button>';
    } else if(ev.type==='hammer'){
      body='<div class="arcade-lamp-clock">2<span>SECONDI</span></div><p>Il martello batte più in fretta! Hai <strong>2 secondi dopo ogni rilancio</strong>, invece di 5. Ogni nuova offerta riavvia i 2 secondi.</p><p>Le CPU reagiscono più velocemente. Il timer parte soltanto quando premi INIZIA ASTA; dalla prossima chiamata torna normale.</p>';
      buttons='<button type="button" class="primary" data-arcade-action="start">INIZIA ASTA</button>';
    } else if(ev.type==='switch'){
      const nom=state.managers.find(m=>m.id===a.nominatorId);
      body=`<p>Per questa chiamata puoi uscire dal reparto <strong>${escapeHtml(ROLE_LABELS[ev.originalRole])}</strong>. Dopo l’aggiudicazione si torna allo stesso reparto.</p>`;
      if(nom.id==='user'){
        body+=`<label for="arcadeCrossRolePlayer">Scegli un giocatore di un altro ruolo</label><select id="arcadeCrossRolePlayer">${ev.crossRoleIds.map(id=>playerMap.get(id)).filter(p=>p&&state.availableIds.includes(p.id)&&canOwn(nom,p)&&maxLegalBid(nom,p)>=1).map(candidate=>`<option value="${escapeHtml(candidate.id)}" ${candidate.id===p.id?'selected':''}>${escapeHtml(ROLE_LABELS[candidate.role])} · ${escapeHtml(candidate.name)} · ${escapeHtml(clubName(candidate.club))} · OVR ${candidate.ovr}</option>`).join('')}</select><p id="arcadeCrossRoleError" role="alert"></p>`;
      } else {body+=`<p><strong>${escapeHtml(nom.team)}</strong> chiama:</p>${auctionBundlePlayerMarkup(p)}`;}
      body+='<p>Partecipano solo le squadre con un posto libero nel ruolo scelto e crediti sufficienti.</p>';
      buttons='<button type="button" class="primary" data-arcade-action="start">INIZIA ASTA</button>';
    } else {
      const second=playerMap.get(ev.secondPlayerId);
      body=`<div class="bundle-player-grid bundle-modal-preview">${auctionBundlePlayerMarkup(p)}${auctionBundlePlayerMarkup(second)}</div><p>Un’unica offerta acquista entrambi. Occorrono due posti liberi nel ruolo; partecipano solo le squadre che possono accoglierli e pagarli.</p><p>Base d’asta: 2 crediti. Per il costo individuale, 1 credito va alla riserva e il resto al primo giocatore. One Shot non è utilizzabile su questa chiamata.</p>`;
      buttons='<button type="button" class="primary" data-arcade-action="start">INIZIA ASTA</button>';
    }
    if(p && ['sealed','hammer'].includes(ev.type)){
      body=`<div class="arcade-called-player"><span>GIOCATORE IN ASTA</span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(ROLE_LABELS[p.role])} · ${escapeHtml(clubName(p.club))}</small></div>`+body;
    }
    $('arcadeAuctionBody').innerHTML=body;
    $('arcadeAuctionActions').innerHTML=buttons;
    (modal.querySelector('input,select')||modal.querySelector('button'))?.focus();
  }

  function resolveSealedAuction(){
    const a=state.auction,ev=a.arcade;
    if(ev.resolved)return;
    const winner=window.FantaAuctionEvents.sealedWinner(ev.offers,ev.tieOrder);
    if(!winner)return;
    a.highBidderId=winner.managerId;a.price=winner.amount;ev.resolved=true;ev.awaitingAck=false;
    a.log=ev.offers.map(o=>({text:state.managers.find(m=>m.id===o.managerId)?.team||o.managerId,side:o.amount?String(o.amount):'PASS',kind:'bid'}));
    saveState();
  }

  function handleArcadeAction(action){
    const a=state?.auction,ev=a?.arcade;
    if(!ev || a.awarding)return;
    if(ev.type==='sealed' && !ev.resolved && ['submit','pass'].includes(action)){
      const p=playerMap.get(a.playerId),user=state.managers.find(m=>m.id==='user');
      const amount=action==='pass'?0:Number($('arcadeSealedAmount')?.value);
      if(action==='submit' && (!ev.tieOrder.includes('user') || !Number.isInteger(amount) || amount<1 || amount>maxLegalBid(user,p))){
        if($('arcadeSealedError'))$('arcadeSealedError').textContent='Inserisci un’offerta intera entro il massimo consentito.';
        return;
      }
      if(ev.tieOrder.includes('user'))ev.offers.push({managerId:'user',amount});
      resolveSealedAuction();renderAuction();return showArcadeModal();
    }
    if(action==='start' && ev.type!=='sealed'){
      if(ev.type==='switch' && a.nominatorId==='user' && !autocompleteMode){
        const chosen=playerMap.get($('arcadeCrossRolePlayer')?.value),nom=state.managers.find(m=>m.id===a.nominatorId);
        if(!chosen || !ev.crossRoleIds.includes(chosen.id) || chosen.role===ev.originalRole || !state.availableIds.includes(chosen.id) || !canOwn(nom,chosen) || maxLegalBid(nom,chosen)<1){
          if($('arcadeCrossRoleError'))$('arcadeCrossRoleError').textContent='Scegli un giocatore disponibile con un posto libero nel suo ruolo.';return;
        }
        a.playerId=chosen.id;a.price=1;a.highBidderId=nom.id;
        a.activeIds=state.managers.filter(m=>canOwn(m,chosen)&&maxLegalBid(m,chosen)>=1).map(m=>m.id);
        a.log=[{text:`Cambio di programma · ${nom.team} chiama ${chosen.name}`,side:'1',kind:'bid'}];
      }
      ev.awaitingAck=false;saveState();$('arcadeAuctionModal').classList.add('hidden');$('arcadeAuctionModal').setAttribute('aria-hidden','true');return beginBidRound();
    }
    if(action==='award' && ev.resolved){
      $('arcadeAuctionModal').classList.add('hidden');$('arcadeAuctionModal').setAttribute('aria-hidden','true');awardAuction();
    }
  }

  function nominate(playerId, managerIndex) {
    if (!state || state.auction || state.completed) return;
    auditAndRepairState('pre-nomination');
    if (state.nominationIndex !== managerIndex) return;
    const p = playerMap.get(playerId);
    const nom = state.managers[managerIndex];
    if (!p || (!openRoleAuction() && p.role !== currentAuctionRole()) || !state.availableIds.includes(playerId) || !canOwn(nom,p) || maxLegalBid(nom,p)<1) return;
    const activeIds = state.managers.filter(m => canOwn(m,p) && maxLegalBid(m,p)>=1).map(m=>m.id);
    if (!activeIds.includes(nom.id)) return;
    closeNominationModal();
    state.auction = {
      playerId,
      nominatorId: nom.id,
      price: 1,
      highBidderId: nom.id,
      activeIds,
      awaitingUser:false,
      log:[{text:`${nom.team} chiama ${p.name}`,side:'1',kind:'bid'}],
      deadlineAt:0,
      windowMs:BID_WINDOW_MS,
      bidCount: 1,
      commentMoments:[],
      commentCount:0,
      lastCommentAt:0,
      userDuelCpuIds:[],
      lastDirectCpuId:null
    };
    prepareArcadeAuction(nom,p);
    registerNominationCall(nom.id,p.role);
    tickAuctionEventEffectsOnNomination(state.auction.playerId);
    const pact = state.auction.arcade?null:activePactForPlayer(playerId);
    if (pact) state.auction.pactActive = {cpuId:pact.cpuId, playerId};
    saveState();
    renderAll();
    if(state.auction.arcade){beginBidRound();return;}
    if(!autocompleteMode && maybeTriggerAuctionEvent()) return;
    beginBidRound();
  }

  function scheduleAdvance() {
    // Compatibility wrapper used by older flow/resume paths.
    beginBidRound();
  }

  function adminOneShotScore(manager,player){
    if(!canOwn(manager,player) || maxLegalBid(manager,player)<1) return 0;
    const desired={P:1,D:4,C:4,A:3}[player.role]||1;
    const owned=(manager.roster||[]).filter(p=>p.role===player.role).map(currentPlayerOvr).sort((a,b)=>b-a);
    const ovr=currentPlayerOvr(player);
    if(owned.length>=desired && ovr<=owned[desired-1]+2) return 0;
    return Math.max(1,baseAuctionValue(player))*({P:.85,D:1,C:1.2,A:1.65}[player.role]||1)*Math.max(.5,1+(ovr-75)/100);
  }

  function tryAdminOneShot(){
    const a=state?.auction;
    if(!a || a.awarding || a.powerPaused || a.awaitingAuctionEvent || a.arcade?.awaitingAck || state.adminOneShot?.used || Number(state.career?.division)!==1 || state.winterMarketFlow?.stage==='auction') return false;
    // Hidden identity, sealed offers and two-player packages retain their own rules.
    if(['mystery','sealed','bundle'].includes(a.arcade?.type)) return false;
    const admin=state.managers.find(m=>m.id!=='user' && profileArchetype(m)==='admin');
    const player=playerMap.get(String(a.playerId));
    if(!admin || !player || !a.activeIds?.includes(admin.id) || a.blockedCpuIds?.includes(admin.id) || (a.highBidderId===admin.id && Number(a.price)===1)) return false;
    const score=adminOneShotScore(admin,player);
    if(score<=0) return false;
    let best=score;
    for(const id of state.availableIds||[]){
      const candidate=playerMap.get(String(id));
      if(candidate) best=Math.max(best,adminOneShotScore(admin,candidate));
    }
    if(score<best*.97) return false;
    clearAuctionRuntimeTimers();
    state.adminOneShot={used:true,managerId:admin.id,playerId:player.id,usedAt:Date.now()};
    a.price=1;a.highBidderId=admin.id;a.activeIds=[admin.id];
    a.awaitingUser=false;a.powerPaused=false;a.adminOneShotForced=true;
    a.log.push({text:'ADMIN USA ONE SHOT!',side:`${player.name} → 1 cr`,kind:'win'});
    if(a.log.length>120) a.log=a.log.slice(-120);
    saveState();renderAuction();awardAuction();
    return true;
  }

  function beginBidRound() {
    if (!state?.auction || state.auction.awarding) return;
    if(state.auction.arcade?.awaitingAck || state.auction.arcade?.type==='sealed') return showArcadeModal();
    state.auction.presenting=false; // Compatibilità con salvataggi creati prima della rimozione della micro-presentazione.
    state.auction.awaitingAuctionEvent=false;
    if(tryAdminOneShot()) return;
    if(autoSkipUserIfCannotBid()) return;
    cpuReactionTimers.forEach(t => clearTimeout(t));
    cpuReactionTimers = [];
    resetBidClock();
    scheduleSuddenInterestEntry();
    scheduleCpuReactions();
    renderAuction();
  }

  function currentSuddenInterestEffect(){
    const a=state?.auction;
    if(!a)return null;
    return auctionEffects('sudden_interest').find(e=>e.playerId===a.playerId && !e.activated) || null;
  }

  function activateSuddenInterest(effect,{silent=false}={}){
    const a=state?.auction;
    if(!a||!effect||effect.playerId!==a.playerId)return false;
    const cpu=state.managers.find(m=>m.id===effect.cpuId), p=playerMap.get(a.playerId);
    if(!cpu||!p||!a.activeIds.includes(cpu.id))return false;
    effect.activated=true;
    a.suddenInterestActivated=true;
    if(!silent) showToast(`⚡ INTERESSE IMPROVVISO: ${cpu.profile?.label||cpu.team} entra forte su ${p.name}!`);
    saveState();
    renderAuction();
    return true;
  }

  function scheduleSuddenInterestEntry(){
    const a=state?.auction, effect=currentSuddenInterestEffect();
    if(!a||!effect||a.suddenInterestScheduled)return false;
    const cpu=state.managers.find(m=>m.id===effect.cpuId);
    if(!cpu||!a.activeIds.includes(cpu.id))return false;
    if(a.highBidderId===cpu.id){
      activateSuddenInterest(effect,{silent:true});
      return false;
    }
    a.suddenInterestScheduled=true;
    const delay=autocompleteMode?35:(state?.turbo?420:1250+Math.floor(Math.random()*750));
    if(suddenInterestTimer) clearTimeout(suddenInterestTimer);
    suddenInterestTimer=setTimeout(()=>{
      suddenInterestTimer=null;
      const live=state?.auction;
      if(!live||live.playerId!==effect.playerId||live.awarding)return;
      if(!activateSuddenInterest(effect))return;
      if(live.highBidderId!==cpu.id && live.activeIds.includes(cpu.id)){
        const timer=setTimeout(()=>cpuReact(cpu.id), autocompleteMode?20:180+Math.floor(Math.random()*260));
        cpuReactionTimers.push(timer);
      }
    },delay);
    return true;
  }

  function scheduleCpuReactions() {
    const a = state?.auction;
    if (!a) return;
    const p = playerMap.get(a.playerId);
    if (!p) return;

    // V3.2.35.41: nessuna chiusura anticipata perché le CPU sembrano aver finito.
    // Tutte le CPU ancora formalmente nella chiamata possono avere il loro momento
    // di reazione; quelle che non rilanciano semplicemente fanno scorrere il tempo.
    // L'aggiudicazione normale avviene solo allo scadere del countdown.
    const challengers = a.activeIds.filter(id=>id!==a.highBidderId);

    const pendingSudden=currentSuddenInterestEffect();
    challengers.forEach(id => {
      const m = state.managers.find(x=>x.id===id);
      if (!m) return;
      if (m.id==='user' && !autocompleteMode) return; // Human can bid at any time inside the 5-second window.
      if (pendingSudden && pendingSudden.cpuId===m.id) return; // entrerà più tardi come evento INTERESSE IMPROVVISO.
      const timer = setTimeout(() => cpuReact(m.id), cpuReactionDelay(m));
      cpuReactionTimers.push(timer);
    });
  }

  function flashBidder(managerId, increment, target) {
    if(!autocompleteMode && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){
      $('currentPrice')?.animate?.([{transform:'translateY(4px) scale(.9)',color:'#ffffff'},{transform:'translateY(-3px) scale(1.1)',color:'#ffd84d'},{transform:'translateY(0) scale(1)'}],{duration:260,easing:'ease-out'});
    }
    lastBidFlash = {managerId, increment, target, until: Date.now() + 1250};
    if (bidFlashTimer) clearTimeout(bidFlashTimer);
    renderAuctionRoomList();
    bidFlashTimer = setTimeout(() => {
      lastBidFlash = null;
      bidFlashTimer = null;
      if (state?.auction) renderAuctionRoomList();
    }, 1280);
  }

  const RIVAL_BID_REACTIONS = {
    bomber:['Per un bomber si può osare!','I gol costano, e io rilancio!'],
    ragioniere:['I conti tornano. Rilancio.','Il prezzo è ancora sostenibile.'],
    spendaccione:['Questo lo prendo io!','Il prezzo non mi spaventa!'],
    tirchio:['Solo al prezzo giusto.','Un credito in più, non uno spreco.'],
    moneyball:['I numeri dicono sì.','Il valore è ancora dalla mia parte.'],
    tifoso:['Ci credo fino in fondo!','Per i miei beniamini non mollo!'],
    collezionista:['Un top così deve essere mio.','Aggiungo un altro campione!'],
    esperto:['Mossa calcolata.','So esattamente quanto vale.'],
    pazzo:['Alziamo ancora!','Adesso facciamo sul serio!'],
    gambler:['Rischio tutto!','Vediamo chi ha più coraggio!'],
    stratega:['Era tutto previsto.','Questo rilancio fa parte del piano.'],
    rivale:['Non te lo lascio.','Se lo vuoi, dovrai sudartelo.']
  };

  function bidReaction(manager, player) {
    if (manager?.id === 'user') return 'Hai rilanciato. Ora tocca agli avversari.';
    const archetype = profileArchetype(manager);
    if (archetype === 'tifoso' && manager?.profile?.favoriteClub === player?.club) return 'È uno dei miei: non posso lasciarlo!';
    const lines = RIVAL_BID_REACTIONS[archetype] || ['Non mi tiro indietro.'];
    return lines[Number(state?.auction?.bidCount || 0) % lines.length];
  }

  function bidCommentMoment(manager, increment, previousLeaderId) {
    const a = state?.auction;
    if (!a || autocompleteMode || manager?.id === 'user') return null;
    a.commentMoments = Array.isArray(a.commentMoments) ? a.commentMoments : [];
    a.commentCount = Number(a.commentCount || 0);
    a.lastCommentAt = Number(a.lastCommentAt || 0);
    if (a.commentCount >= 2 || Date.now() - a.lastCommentAt < 4000) return null;

    const archetype = profileArchetype(manager);
    let moment = null;
    if (archetype === 'rivale' && previousLeaderId === 'user') moment = 'rivalry';
    else if (a.activeIds.length <= 2 && Number(a.bidCount||0) >= 4) moment = 'duel';
    else if (increment >= 10 && Number(a.bidCount||0) >= 3) moment = 'big';
    else if (Number(a.bidCount||0) === 2) moment = 'opening';

    if (!moment || a.commentMoments.includes(moment)) return null;
    a.commentMoments.push(moment);
    a.commentCount += 1;
    a.lastCommentAt = Date.now();
    return moment;
  }

  function showBidSpotlight(manager, player, target, increment, previousLeaderId) {
    const box = $('bidSpotlight');
    if (!box || autocompleteMode || state?.auction?.arcade?.type==='mystery') return;
    const moment = bidCommentMoment(manager, increment, previousLeaderId);
    if (!moment) return;
    const archetype = profileArchetype(manager);
    const art = manager?.id === 'user' ? null : RIVAL_ART[archetype];
    const image = $('bidSpotlightImage');
    const initials = $('bidSpotlightInitials');
    if (art) {
      image.src = `assets/rivals/${art}.webp`;
      image.alt = manager?.profile?.label || manager?.name || 'Allenatore';
      image.classList.remove('hidden');
      initials.classList.add('hidden');
    } else {
      image.classList.add('hidden');
      initials.classList.remove('hidden');
      initials.textContent = playerInitials(manager?.name || 'Tu');
    }
    const momentLabels = {opening:'PRIMO RILANCIO',big:'RILANCIO PESANTE',duel:'DUELLO FINALE',rivalry:'SFIDA DIRETTA'};
    $('bidSpotlightLabel').textContent = momentLabels[moment] || 'MOMENTO DELL’ASTA';
    $('bidSpotlightName').textContent = manager?.profile?.label || manager?.team || 'Allenatore';
    $('bidSpotlightReaction').textContent = bidReaction(manager, player);
    const priceCaption=box.querySelector('.bid-spotlight-price small'); if(priceCaption) priceCaption.textContent='NUOVA OFFERTA';
    box.classList.remove('loss-reaction');
    $('bidSpotlightPrice').textContent = String(target);
    $('bidSpotlightIncrement').textContent = `+${increment}`;
    box.classList.remove('hidden','show');
    void box.offsetWidth;
    box.classList.add('show');
    if (bidSpotlightTimer) clearTimeout(bidSpotlightTimer);
    bidSpotlightTimer = setTimeout(() => {
      box.classList.remove('show');
      bidSpotlightTimer = setTimeout(() => { box.classList.add('hidden'); bidSpotlightTimer=null; }, 220);
    }, 1450);
  }

  function showAwardAnimation(player, winner, price) {
    const overlay = $('awardOverlay');
    if (!overlay) return;
    if($('awardPlayerAvatar')) $('awardPlayerAvatar').innerHTML=playerAvatarMarkup(player,player?.name||'Giocatore');
    if($('awardTransferTeam')) $('awardTransferTeam').textContent=winner?.team||'Squadra';
    const adminPower=!!state?.auction?.adminOneShotForced;
    if($('awardBannerTitle')) $('awardBannerTitle').textContent=adminPower?'ADMIN USA ONE SHOT!':'AGGIUDICATO!';
    if($('awardAdminPortrait')) $('awardAdminPortrait').hidden=!adminPower;
    overlay.classList.toggle('is-admin-one-shot',adminPower);
    if ($('awardPlayerName')) $('awardPlayerName').textContent = player?.name || 'Giocatore';
    if ($('awardWinnerName')) $('awardWinnerName').textContent = winner?.team || 'Squadra';
    if ($('awardPrice')) $('awardPrice').textContent = String(price ?? '');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  function hideAwardAnimation() {
    const overlay = $('awardOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    overlay.classList.add('hidden');
  }

  const RIVAL_LOSS_REACTIONS = {
    bomber:['Dannazione, quello mi serviva.','Hai vinto questo duello.'],
    ragioniere:['Troppo caro. Te lo lascio.','A quel prezzo hai avuto più coraggio.'],
    spendaccione:['Me lo ricorderò.','La prossima non te la lascio.'],
    tirchio:['A quel prezzo è tutto tuo.','Troppo caro per i miei gusti.'],
    moneyball:['I numeri dicevano stop.','Hai spinto oltre il mio valore.'],
    tifoso:['Questa brucia.','Non volevo lasciartelo.'],
    collezionista:['Mi hai tolto un pezzo importante.','Bel colpo. Ma non è finita.'],
    esperto:['Duello perso. Si va avanti.','Hai letto bene l’asta.'],
    pazzo:['No! Lo volevo io!','Va bene, questa l’hai vinta tu.'],
    gambler:['Hai avuto più coraggio.','Stavolta il rischio ha pagato te.'],
    stratega:['Cambio piano.','Segnato. Adesso mi adatto.'],
    rivale:['Me lo ricorderò.','Uno a te. La prossima è mia.'],
    admin:['Valutazione aggiornata.','Hai vinto la chiamata. Il campionato è lungo.']
  };

  function awardLossReactionData(auction,player,winner,price){
    if(autocompleteMode || winner?.id!=='user' || !auction || !player) return null;
    const duelIds=Array.isArray(auction.userDuelCpuIds)?auction.userDuelCpuIds:[];
    if(!duelIds.length || Number(auction.bidCount||0)<5) return null;
    const cpuId=auction.lastDirectCpuId && duelIds.includes(auction.lastDirectCpuId)?auction.lastDirectCpuId:duelIds[duelIds.length-1];
    const cpu=state.managers.find(m=>m.id===cpuId);
    if(!cpu) return null;
    const market=baseAuctionValue(player), top=TOP_VALUE_THRESHOLD[player.role]||20;
    const important=market>=top*.65 || Number(price||0)>=Math.max(12,Math.round(market*.85));
    if(!important) return null;
    let chance=.48;
    if(isHotRival(cpu)) chance+=.18;
    if(hasGoodRelations(cpu)) chance-=.22;
    if(Number(auction.bidCount||0)>=8) chance+=.10;
    if(careerHash(`loss-reaction|${cpu.id}|${player.id}`)>=clamp(chance,.12,.82)) return null;
    const lines=hasGoodRelations(cpu)
      ? ['Ci sta. Affare tuo.','Nessun problema, si va avanti.','Questa te la lascio.']
      : (RIVAL_LOSS_REACTIONS[profileArchetype(cpu)]||['Me lo ricorderò.','Te lo lascio, stavolta.']);
    return {cpu,text:lines[Math.floor(careerHash(`loss-reaction-line|${cpu.id}|${player.id}`)*lines.length)%lines.length]};
  }

  function showAwardLossReaction(cpu,player,price){
    const box=$('bidSpotlight'); if(!box || !cpu || !player || autocompleteMode) return false;
    const art=RIVAL_ART[profileArchetype(cpu)], image=$('bidSpotlightImage'), initials=$('bidSpotlightInitials');
    if(art){ image.src=`assets/rivals/${art}.webp`; image.alt=cpu.profile?.label||cpu.name||'Allenatore'; image.classList.remove('hidden'); initials.classList.add('hidden'); }
    else { image.classList.add('hidden'); initials.classList.remove('hidden'); initials.textContent=playerInitials(cpu.name||cpu.team); }
    const data=awardLossReactionData(state?.auction,player,state.managers.find(m=>m.id==='user'),price);
    if(!data) return false;
    $('bidSpotlightLabel').textContent='REAZIONE DOPO IL DUELLO';
    $('bidSpotlightName').textContent=cpu.profile?.label||cpu.team;
    $('bidSpotlightReaction').textContent=data.text;
    const priceCaption=box.querySelector('.bid-spotlight-price small'); if(priceCaption) priceCaption.textContent='AGGIUDICATO';
    $('bidSpotlightPrice').textContent=String(price);
    $('bidSpotlightIncrement').textContent='DUELLO PERSO';
    box.classList.add('loss-reaction');
    box.classList.remove('hidden','show'); void box.offsetWidth; box.classList.add('show');
    if(bidSpotlightTimer) clearTimeout(bidSpotlightTimer);
    bidSpotlightTimer=setTimeout(()=>{box.classList.remove('show'); bidSpotlightTimer=setTimeout(()=>{box.classList.add('hidden');box.classList.remove('loss-reaction');bidSpotlightTimer=null;},180);},980);
    return true;
  }

  function cpuReact(managerId) {
    auditAndRepairState('pre-cpu-bid');
    const a = state?.auction;
    if (!a || a.arcade?.awaitingAck || a.arcade?.type==='sealed' || Date.now() >= Number(a.deadlineAt||0)) return;
    if (!a.activeIds.includes(managerId) || a.highBidderId===managerId) return;
    const m = state.managers.find(x=>x.id===managerId);
    const p = playerMap.get(a.playerId);
    if (!m || !p) return;
    if (Array.isArray(a.blockedCpuIds) && a.blockedCpuIds.includes(m.id)) {
      a.activeIds = a.activeIds.filter(id=>id!==m.id);
      addAuctionLog(m.team, 'BLOCCATO', 'status'); saveState(); renderManagers(); renderAuction();
      // Anche quando una CPU viene esclusa, il countdown resta vivo: niente chiusure anticipate.
      return;
    }

    const pact = activePactForPlayer(p.id);
    if (pact && pact.cpuId===m.id && a.highBidderId==='user' && !pact.cpuBetrayed) {
      if (cpuKeepsPact(m,pact)) {
        a.activeIds = a.activeIds.filter(id=>id!==m.id);
        addAuctionLog(m.team, 'PATTO', 'status'); saveState(); renderManagers();
        // Il patto toglie la CPU dalla chiamata, ma non accelera la chiusura dell'asta.
        return;
      }
      pact.cpuBetrayed=true; changeRelationship(m.id,-18,18,'tradimento_cpu');
      showToast(`${m.profile?.label||m.team} ha tradito il patto su ${p.name}!`, true);
    }

    const limit = m.id==='user' ? autoUserLimit(m,p) : cpuLimit(m,p);
    if (limit <= a.price || maxLegalBid(m,p) <= a.price) {
      // V3.2.35.41: le CPU non dichiarano più PASS durante la chiamata.
      // Se non vogliono/possono rilanciare, restano silenziose e lasciano scorrere
      // il timer fino alla fine. In questo modo un'altra CPU può ancora entrare
      // con un rilancio tardivo e la chiamata non si chiude in anticipo.
      return;
    }

    const oldPrice = a.price;
    const previousLeaderId = a.highBidderId;
    if(previousLeaderId==='user') registerDirectAuctionDuel(m.id);
    const inc = Math.min(jumpSize(m,a.price,limit,p), limit-a.price);
    const target = Math.min(limit, a.price + Math.max(1,inc));
    a.price = target;
    a.highBidderId = m.id;
    a.bidCount = Number(a.bidCount||0) + 1;
    flashBidder(m.id, target-oldPrice, target);
    showBidSpotlight(m, p, target, target-oldPrice, previousLeaderId);
    addAuctionLog(m.team, String(target), 'bid');
    if(autoSkipUserIfCannotBid()) return;
    renderManagers();
    saveState();
    // Fundamental V1.3 rule: every valid raise restarts the full countdown.
    beginBidRound();
  }

  function advanceAuction() {
    // Kept for compatibility with any saved/event path; the live auction is now clock-driven.
    if (state?.auction) beginBidRound();
  }

  function ensureManagerTeamIdentityState(){
    if(!state?.managers) return;
    state.managers.forEach(m=>{
      if(m.id==='user') return;
      if(!m.teamColors){
        const fallback=FIXTURE_TEAM_COLORS?.[profileArchetype(m)] || {primary:'#3d7dff',secondary:'#1b2238'};
        m.teamColors={primary:fallback.primary,secondary:fallback.secondary};
      }
    });
  }

  function ensureAuctionPowers(){
    if(!state.auctionPowers) state.auctionPowers={block:false,scout:false,bluff:false,observer:false,oneShot:false,uses:{block:0,scout:0,bluff:0,oneShot:0},selected:[]};
    // I vecchi salvataggi avevano automaticamente tutti e tre i poteri.
    if(!Array.isArray(state.auctionPowers.selected)) state.auctionPowers.selected=['block','scout','bluff'];
    if(state.auctionPowers.oneShot===undefined) state.auctionPowers.oneShot=false;
    if(!state.auctionPowers.uses || typeof state.auctionPowers.uses!=='object'){
      state.auctionPowers.uses={
        block:state.auctionPowers.block?1:0,
        scout:state.auctionPowers.scout?1:0,
        bluff:state.auctionPowers.bluff?1:0,
        oneShot:state.auctionPowers.oneShot?1:0
      };
    }
    ['block','scout','bluff','oneShot'].forEach(k=>{
      const max=k==='oneShot'?1:5;
      state.auctionPowers.uses[k]=Math.max(0,Math.min(max,Number(state.auctionPowers.uses[k]||0)));
    });
    return state.auctionPowers;
  }

  function auctionPowerMaxUses(power){ return power==='oneShot'?1:5; }
  function auctionPowerUses(power){ return Number(ensureAuctionPowers().uses?.[power]||0); }
  function consumeAuctionPower(power){
    const powers=ensureAuctionPowers();
    powers.uses[power]=Math.min(auctionPowerMaxUses(power),auctionPowerUses(power)+1);
    if(power in powers) powers[power]=powers.uses[power]>0; // compatibilità salvataggi precedenti
  }
  function canUseOneShot(){
    const a=state?.auction, user=state?.managers?.find(m=>m.id==='user'), p=a&&playerMap.get(a.playerId);
    return !!(a && user && p && canOwn(user,p) && maxLegalBid(user,p)>=1);
  }

  function renderAuctionPowers(){
    if(!$('auctionPowers')) return;
    const powers=ensureAuctionPowers(), a=state?.auction;
    const defs=[['block','powerBlockBtn','powerBlockCount'],['scout','powerScoutBtn','powerScoutCount'],['bluff','powerBluffBtn','powerBluffCount'],['observer','powerObserverBtn','powerObserverCount'],['oneShot','powerOneShotBtn','powerOneShotCount']];
    defs.forEach(([key,bid,cid])=>{
      const btn=$(bid), count=$(cid); if(!btn)return;
      const selected=powers.selected.includes(key);
      const passive=key==='observer';
      const maxUses=passive?0:auctionPowerMaxUses(key);
      const usedCount=passive?0:auctionPowerUses(key);
      const exhausted=!passive && usedCount>=maxUses;
      const alreadyActive=(key==='bluff' && !!a?.bluffActive) || (key==='scout' && !!a?.scoutUsedThisCall);
      const unavailableOneShot=key==='oneShot' && !canUseOneShot();
      btn.disabled=!!a?.arcade?.awaitingAck || a?.arcade?.type==='sealed' || (a?.arcade?.type==='mystery'&&key==='scout') || (a?.arcade?.type==='bundle'&&key==='oneShot') || passive || !selected || exhausted || alreadyActive || unavailableOneShot || !a || !!a.awarding || autocompleteMode;
      btn.classList.toggle('used',exhausted);
      btn.classList.toggle('power-not-selected',!selected);
      btn.classList.toggle('passive-power',passive&&selected);
      btn.classList.toggle('active-power', (key==='bluff' && !!a?.bluffActive) || (passive&&selected));
      if(count) count.textContent=!selected?'NON SCELTO':(passive?'ATTIVO':`${Math.max(0,maxUses-usedCount)}/${maxUses}`);
    });
  }

  function auctionPowerTargets(){
    const a=state?.auction; if(!a)return [];
    return state.managers.filter(m=>m.id!=='user' && a.activeIds.includes(m.id));
  }

  function pauseForAuctionPower(){
    if(!state?.auction)return;
    clearAuctionRuntimeTimers();
    state.auction.powerPaused=true;
    state.auction.deadlineAt=0;
    renderCountdown();
  }
  function resumeAfterAuctionPower(){
    if(!state?.auction)return;
    state.auction.powerPaused=false;
    saveState(); renderAuction(); beginBidRound();
  }

  function openAuctionPower(power){
    const powers=ensureAuctionPowers(),a=state?.auction;
    if(!powers.selected.includes(power)){showToast('Questo Fantapotere non fa parte della tua selezione.',true);return;}
    if(!a || a.awarding || autocompleteMode)return;
    if(power!=='observer' && auctionPowerUses(power)>=auctionPowerMaxUses(power)){showToast('Hai esaurito gli utilizzi di questo Fantapotere.',true);return;}
    if(power==='oneShot') return useOneShotPower();
    if(power==='bluff') return useBluffPower();
    if(power==='scout') return useScoutPower();
    const targets=auctionPowerTargets();
    if(!targets.length){showToast('Non ci sono CPU disponibili per questo potere.',true);return;}
    pauseForAuctionPower();
    const modal=$('auctionPowerModal'), p=playerMap.get(a.playerId);
    modal.dataset.power=power;
    $('auctionPowerIcon').textContent='🔒';
    $('auctionPowerTitle').textContent='BLOCCO — scegli l’avversario';
    $('auctionPowerDescription').textContent=`Scegli una CPU: non potrà più rilanciare su ${a.arcade?.type==='mystery'?'il Pacco sorpresa':p.name}. Se è in testa, il suo rilancio resta valido ma non potrà contro-rilanciare dopo essere stata superata.`;
    $('auctionPowerBody').innerHTML=`<div class="auction-power-targets">${targets.map(m=>{const art=RIVAL_ART[profileArchetype(m)];return `<button class="auction-power-target" data-power-target="${m.id}">${art?`<img src="assets/rivals/${art}.webp" alt="">`:'<span></span>'}<span><b>${escapeHtml(m.profile?.label||m.team)}</b><small>${escapeHtml(m.team)} · ${m.budget} cr</small></span><strong>${m.id===a.highBidderId?'IN TESTA':'IN ASTA'}</strong></button>`}).join('')}</div>`;
    modal.querySelectorAll('[data-power-target]').forEach(b=>b.onclick=()=>resolveAuctionPowerTarget(power,b.dataset.powerTarget));
    modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
  }

  function useScoutPower(){
    const a=state?.auction,powers=ensureAuctionPowers(); if(!a||auctionPowerUses('scout')>=5||a.scoutUsedThisCall)return;
    const p=playerMap.get(a.playerId); if(!p)return;
    const cpus=(state.managers||[]).filter(m=>m.id!=='user');
    if(!cpus.length){showToast('Non ci sono avversari da analizzare.',true);return;}

    pauseForAuctionPower();
    consumeAuctionPower('scout');
    a.scoutUsedThisCall=true;

    const modal=$('auctionPowerModal');
    modal.dataset.power='scout';
    $('auctionPowerIcon').textContent='👁️';
    $('auctionPowerTitle').textContent='SCOUT — analisi completa';
    $('auctionPowerDescription').textContent=`Stima del limite di spesa di tutti gli avversari su ${p.name}. Gli intervalli sono indicativi e possono cambiare durante il duello.`;

    $('auctionPowerBody').innerHTML=`<div class="auction-scout-all">${cpus.map(m=>{
      const exact=cpuLimit(m,p);
      const low=exact<=0?0:Math.max(1,Math.floor((exact-3)/5)*5);
      const high=exact<=0?0:Math.max(low+2,Math.ceil((exact+3)/5)*5);
      const active=a.activeIds.includes(m.id);
      const status=m.id===a.highBidderId?'IN TESTA':(active?'IN ASTA':'FUORI');
      const limitText=exact<=0?'NON INTERESSATO':`${low}–${high} cr`;
      const art=RIVAL_ART[profileArchetype(m)];
      return `<div class="auction-scout-row ${active?'is-active':'is-out'}">
        <div class="auction-scout-avatar">${art?`<img src="assets/rivals/${art}.webp" alt="">`:`<span>${escapeHtml(playerInitials(m.name||'?'))}</span>`}</div>
        <div class="auction-scout-copy"><b>${escapeHtml(m.profile?.label||m.team)}</b><small>${escapeHtml(m.team)} · ${m.budget} cr</small></div>
        <div class="auction-scout-limit"><strong>${limitText}</strong><small>${status}</small></div>
      </div>`;
    }).join('')}</div>`;

    saveState();
    renderAuctionPowers();
    const old=$('auctionPowerCancel');
    old.textContent='Continua l’asta';
    old.onclick=()=>closeAuctionPowerModal(true);
    modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
  }

  function closeAuctionPowerModal(resume=true){
    const modal=$('auctionPowerModal'); if(modal){modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');modal.dataset.power='';}
    if(resume && state?.auction?.powerPaused) resumeAfterAuctionPower();
  }

  function resolveAuctionPowerTarget(power,cpuId){
    const a=state?.auction,m=state?.managers?.find(x=>x.id===cpuId),p=a&&playerMap.get(a.playerId); if(!a||!m||!p)return;
    const powers=ensureAuctionPowers();
    if(power==='block'){
      if(auctionPowerUses('block')>=5){showToast('Hai esaurito i 5 BLOCCO disponibili.',true);return closeAuctionPowerModal(true);}
      consumeAuctionPower('block'); a.blockedCpuIds=Array.isArray(a.blockedCpuIds)?a.blockedCpuIds:[]; if(!a.blockedCpuIds.includes(cpuId))a.blockedCpuIds.push(cpuId);
      if(a.highBidderId!==cpuId) a.activeIds=a.activeIds.filter(id=>id!==cpuId);
      addAuctionLog('POTERE', `BLOCCO su ${m.profile?.label||m.team}`, 'status');
      showToast(`${m.profile?.label||m.team} è stato bloccato su ${a.arcade?.type==='mystery'?'il Pacco sorpresa':p.name}.`);
      closeAuctionPowerModal(false); saveState(); renderAuction();
      if(!a.activeIds.filter(id=>id!==a.highBidderId).length){clearAuctionRuntimeTimers();return awardAuction();}
      return resumeAfterAuctionPower();
    }
  }

  function useBluffPower(){
    const a=state?.auction; if(!a||auctionPowerUses('bluff')>=5||a.bluffActive)return;
    consumeAuctionPower('bluff');
    a.bluffActive=true;
    addAuctionLog('POTERE','BLUFF ATTIVO','bid');
    showToast(`BLUFF attivo: le CPU rivaluteranno al rialzo questo giocatore. Te ne restano ${5-auctionPowerUses('bluff')}.`);
    saveState(); renderAuction(); beginBidRound();
  }

  function useOneShotPower(){
    const a=state?.auction, powers=ensureAuctionPowers();
    if(!a || !powers.selected.includes('oneShot') || auctionPowerUses('oneShot')>=1 || a.awarding || autocompleteMode)return;
    const p=playerMap.get(a.playerId), user=state.managers.find(m=>m.id==='user');
    if(!p || !user || !canOwn(user,p) || maxLegalBid(user,p)<1){
      showToast('ONE SHOT non è utilizzabile su questo giocatore: non hai uno slot rosa valido o credito legale sufficiente.',true);
      return;
    }
    clearAuctionRuntimeTimers();
    consumeAuctionPower('oneShot');
    a.price=1;
    a.highBidderId='user';
    a.activeIds=['user'];
    a.awaitingUser=false;
    a.powerPaused=false;
    a.oneShotForced=true;
    a.log.push({text:'ONE SHOT',side:`${p.name} → 1 cr`,kind:'win'});
    if(a.log.length>120) a.log=a.log.slice(-120);
    showToast(`ONE SHOT! ${p.name} è tuo per 1 credito.`);
    saveState();
    renderAuction();
    awardAuction();
  }

  function autoUserLimit(manager,p) {
    const synthetic = {...manager, profile:{...PERSONALITIES[0], id:'autouser', label:'CPU neutrale'}};
    let limit = cpuLimit(synthetic,p);
    const info = auctionEffects('reserved_info').find(e=>e.playerId===p.id);
    if (info && info.trusted) limit = Math.max(1, Math.floor(limit * .72));
    return limit;
  }

  function userBid(increment) {
    auditAndRepairState('pre-user-bid');
    const a = state?.auction;
    if (!a || a.arcade?.awaitingAck || a.arcade?.type==='sealed' || autocompleteMode || !a.activeIds.includes('user') || a.highBidderId==='user') return;
    if (Date.now() >= Number(a.deadlineAt||0)) return;
    const me = state.managers[0];
    const p = playerMap.get(a.playerId);
    const pact = activePactForPlayer(p.id);
    if (pact && a.highBidderId===pact.cpuId && !pact.userBetrayed) {
      return showPactBetrayPrompt(pact, increment);
    }
    const target = a.price + increment;
    if (target > maxLegalBid(me,p)) return;
    a.awaitingUser = false;
    const oldPrice = a.price;
    const previousLeaderId = a.highBidderId;
    if(previousLeaderId && previousLeaderId!=='user') registerDirectAuctionDuel(previousLeaderId);
    a.price = target;
    a.highBidderId = 'user';
    a.bidCount = Number(a.bidCount||0) + 1;
    flashBidder('user', target-oldPrice, target);
    showBidSpotlight(me, p, target, target-oldPrice, previousLeaderId);
    addAuctionLog(me.team, String(target), 'bid');
    saveState();
    // Every human raise also restarts the full five seconds.
    beginBidRound();
  }

  function fastForwardCpuAuctionAfterUserPass() {
    if(tryAdminOneShot()) return;
    const a = state?.auction;
    if (!a) return;
    const p = playerMap.get(a.playerId);
    if (!p) return;

    // The human has left this player permanently: from here on we resolve the
    // CPU-only auction synchronously using the same limits, jump sizes and
    // reaction-priority logic as the timed auction. This preserves the result
    // without forcing the player to watch every CPU-vs-CPU raise.
    const pendingSudden=currentSuddenInterestEffect();
    if(pendingSudden) activateSuddenInterest(pendingSudden,{silent:true});
    clearAuctionRuntimeTimers();
    auditAndRepairState('pre-fast-forward-after-user-pass');

    const pushLog = (text, side='', kind='') => {
      a.log.push({text,side,kind});
      if (a.log.length > 120) a.log = a.log.slice(-120);
    };

    let guard = 0;
    const MAX_STEPS = 600;
    while (state?.auction === a && guard++ < MAX_STEPS) {
      // Drop CPUs that can no longer legally or strategically beat the price.
      const stillActive = [];
      for (const id of a.activeIds) {
        if (id === a.highBidderId) {
          stillActive.push(id);
          continue;
        }
        const m = state.managers.find(x => x.id === id);
        if (!m || id === 'user') continue;
        const limit = cpuLimit(m,p);
        if (limit <= a.price || maxLegalBid(m,p) <= a.price) {
          // Eliminazione interna e silenziosa: le CPU non mostrano più PASS.
          continue;
        }
        stillActive.push(id);
      }
      a.activeIds = stillActive;

      const challengers = a.activeIds
        .filter(id => id !== a.highBidderId && id !== 'user')
        .map(id => {
          const m = state.managers.find(x => x.id === id);
          return m ? {m, limit:cpuLimit(m,p), delay:cpuReactionDelay(m)} : null;
        })
        .filter(Boolean)
        .filter(x => x.limit > a.price && maxLegalBid(x.m,p) > a.price);

      if (!challengers.length) break;

      // In the live auction, the first CPU timer to fire gets the next action.
      // Reproduce that priority instantly rather than waiting in real time.
      challengers.sort((x,y) => x.delay - y.delay);
      const {m,limit} = challengers[0];
      const oldPrice = a.price;
      const inc = Math.min(jumpSize(m,a.price,limit,p), limit-a.price);
      const target = Math.min(limit, a.price + Math.max(1,inc));

      if (target <= oldPrice) {
        a.activeIds = a.activeIds.filter(id => id !== m.id);
        // Nessun PASS visibile: in fast-forward la CPU viene solo esclusa internamente.
        continue;
      }

      a.price = target;
      a.highBidderId = m.id;
      a.bidCount = Number(a.bidCount||0) + 1;
      pushLog(m.team, String(target), 'bid');
    }

    if (guard >= MAX_STEPS) {
      console.warn('Fast-forward asta interrotto dal safety guard', {player:p.name, price:a.price});
    }

    saveState();
    renderAuction();
    awardAuction();
  }

  function userPass() {
    const a = state?.auction;
    if (!a || a.arcade?.awaitingAck || a.arcade?.type==='sealed' || autocompleteMode || !a.activeIds.includes('user') || a.highBidderId==='user') return;
    a.awaitingUser = false;
    a.activeIds = a.activeIds.filter(id=>id!=='user');
    addAuctionLog(state.managers[0].team, 'PASS', 'pass');

    // Once the user passes, skip all remaining CPU-vs-CPU waiting for this player.
    // The internal auction is still fully simulated, then we jump straight to the
    // final AGGIUDICATO animation.
    fastForwardCpuAuctionAfterUserPass();
  }

  function userCannotBeatCurrentAuction(){
    const a=state?.auction,player=a&&playerMap.get(String(a.playerId));
    const user=state?.managers?.find(manager=>manager.id==='user');
    return !!(a && player && user && !autocompleteMode && !a.awarding &&
      a.highBidderId!=='user' && a.activeIds?.includes('user') && maxLegalBid(user,player)<=a.price);
  }

  function autoSkipUserIfCannotBid(){
    if(!userCannotBeatCurrentAuction())return false;
    const a=state.auction;
    a.awaitingUser=false;
    a.activeIds=a.activeIds.filter(id=>id!=='user');
    addAuctionLog(state.managers.find(manager=>manager.id==='user')?.team||'Tu','SKIP · CREDITO INSUFFICIENTE','pass');
    fastForwardCpuAuctionAfterUserPass();
    return true;
  }

  function awardAuction() {
    clearAuctionRuntimeTimers();
    auditAndRepairState('pre-award');
    const a = state?.auction;
    if (!a || a.awarding || a.arcade?.awaitingAck || (a.arcade?.type==='sealed'&&!a.arcade.resolved)) return;
    const p = playerMap.get(a.playerId);
    const winner = state.managers.find(m=>m.id===a.highBidderId);
    if (!p || !winner) return;

    a.awarding = true;
    renderAuction();
    const bundlePlayer=a.arcade?.type==='bundle'?playerMap.get(a.arcade.secondPlayerId):null;
    showAwardAnimation(bundlePlayer?{...p,name:`${p.name} + ${bundlePlayer.name}`} :p, winner, a.price);

    const capturedAuction = a;
    awardAnimationTimer = setTimeout(() => {
      awardAnimationTimer = null;
      if (!state?.auction || state.auction !== capturedAuction || !capturedAuction.awarding) return;

      const finalPrice = capturedAuction.price;
      const finalWinner = state.managers.find(m=>m.id===capturedAuction.highBidderId);
      const finalPlayer = playerMap.get(capturedAuction.playerId);
      if (!finalPlayer || !finalWinner) { hideAwardAnimation(); return; }

      const reactionData=awardLossReactionData(capturedAuction,finalPlayer,finalWinner,finalPrice);
      resolveRespectedAuctionPact(finalPlayer.id);
      const untouchableEffect=auctionEffects('untouchable_player').find(e=>e.playerId===finalPlayer.id);
      if(untouchableEffect && finalWinner.id==='user'){
        const rival=state.managers.find(m=>m.id===untouchableEffect.cpuId);
        if(rival){
          changeRelationship(rival.id,-3,16,'intoccabile_soffiato');
          showToast(`🔥 Hai soffiato ${finalPlayer.name} a ${rival.profile?.label||rival.team}: rivalità in aumento!`);
        }
      }

      const bundlePlayer=capturedAuction.arcade?.type==='bundle'?playerMap.get(capturedAuction.arcade.secondPlayerId):null;
      const awardedPlayers=bundlePlayer?[finalPlayer,bundlePlayer]:[finalPlayer];
      const awardResult=bundlePlayer
        ? AuctionEngine.awardBundle(state,awardedPlayers,finalWinner.id,finalPrice,{roleLimits:ROLE_LIMITS,totalSlots:TOTAL_SLOTS})
        : AuctionEngine.awardPlayer(state,finalPlayer,finalWinner.id,finalPrice,{roleLimits:ROLE_LIMITS,totalSlots:TOTAL_SLOTS});
      if(!awardResult.ok){
        hideAwardAnimation();
        state.auction=null;
        integrityNote('warning',`Aggiudicazione annullata: ${awardResult.reason}`,'award');
        showToast('Aggiudicazione non valida annullata in sicurezza.',true);
        saveState();renderAll();
        return;
      }
      awardedPlayers.forEach(player=>recordUserAuctionPick(player,finalWinner.id));
      if(state.winterMarketFlow?.stage==='auction'){
        const ledger=winterLedgerFor(finalWinner.id);
        ledger.winterSpent=Number(ledger.winterSpent||0)+Number(finalPrice||0);
        for(const player of awardedPlayers){
          const acquired=(finalWinner.roster||[]).find(item=>String(item.id)===String(player.id));
          if(acquired){ acquired.acquisitionWindow='winter'; acquired.acquisitionSeason=state.winterMarketFlow.seasonNumber; }
        }
      }

      hideAwardAnimation();
      renderRoster(); renderManagers();

      const finishAwardFlow=()=>{
        if(state?.auction!==capturedAuction) return;
        state.auction = null;
        if(openRoleAuction()){
          if(allRostersComplete()){saveState();return finishAuction();}
          state.nominationIndex=nextNominatorIndex(state.nominationIndex);
          auditAndRepairState('post-award-open-role');
          saveState();renderAll();
          if(autocompleteMode||state.managers[state.nominationIndex].id!=='user') scheduleNomination();
          return;
        }
        const previousRole = currentAuctionRole();
        const phaseFinished = rolePhaseComplete(previousRole);
        if (phaseFinished) state.currentRoleIndex++;

        // Se il giocatore aveva già completato il reparto, le aste CPU residue
        // vengono accelerate automaticamente. Appena anche le CPU terminano,
        // torniamo al normale flusso con la schermata di passaggio reparto.
        if (phaseFinished && roleRemainderAutoSim) {
          endRoleRemainderAutoSim();
          auditAndRepairState('post-role-autosim');
          saveState();
          return beginRoleTransition(previousRole);
        }

        // Fine reparto: in modalità normale l'asta si ferma qui.
        if (phaseFinished && !autocompleteMode) {
          return beginRoleTransition(previousRole);
        }

        if (state.currentRoleIndex >= ROLE_ORDER.length || allRostersComplete()) {
          saveState();
          return finishAuction();
        }

        state.nominationIndex = nextNominatorIndex(state.nominationIndex);

        // Il giocatore ha riempito il proprio reparto ma alcune CPU no:
        // da questo momento non deve più assistere a chiamate che non può fare.
        // Attiviamo il motore veloce solo fino alla chiusura di questo reparto.
        if (!roleRemainderAutoSim && userCompletedCurrentRole(previousRole) && !rolePhaseComplete(previousRole)) {
          beginRoleRemainderAutoSim(previousRole);
        }

        auditAndRepairState('post-award');
        saveState();
        renderAll();
        if (autocompleteMode || state.managers[state.nominationIndex].id!=='user') scheduleNomination();
      };

      if(reactionData && !autocompleteMode){
        showAwardLossReaction(reactionData.cpu,finalPlayer,finalPrice);
        awardAnimationTimer=setTimeout(()=>{awardAnimationTimer=null;finishAwardFlow();},1120);
        return;
      }
      finishAwardFlow();
    }, autocompleteMode ? 120 : capturedAuction.adminOneShotForced ? 2400 : 1050);
  }

  function nominationCallCount(managerId,role){
    const key=openRoleAuction()?'ALL':role;
    return Math.max(0,Number(state?.nominationCalls?.[key]?.[managerId]||0));
  }

  function registerNominationCall(managerId,role){
    if(!state || !managerId)return;
    state.nominationCalls ||= {};
    const key=openRoleAuction()?'ALL':role;
    state.nominationCalls[key] ||= {};
    state.nominationCalls[key][managerId]=nominationCallCount(managerId,role)+1;
  }

  function nextNominatorIndex(from) {
    const role=currentAuctionRole();
    const length=state.managers.length;
    const candidates=[];
    for(let step=1;step<=length;step++){
      const idx=(Number(from||0)+step)%length;
      const manager=state.managers[idx];
      if(openRoleAuction()?managerCanNominate(manager):roleSlotsRemaining(manager,role)>0)
        candidates.push({idx,count:nominationCallCount(manager.id,role)});
    }
    if(!candidates.length)return 0;
    const minimum=Math.min(...candidates.map(candidate=>candidate.count));
    return candidates.find(candidate=>candidate.count===minimum).idx;
  }

  function allRostersComplete() { return state.managers.every(m=>m.roster.length>=TOTAL_SLOTS); }

  function scheduleNomination() {
    if (state?.roleTransition) return;
    clearTimeout(uiTimer);
    renderTurn();
    const manager = state?.managers?.[state.nominationIndex];
    uiTimer = setTimeout(()=>cpuNominateCurrent(), manager ? cpuNominationDelay(manager) : 650);
  }

  function cpuNominateCurrent() {
    if (!state || state.auction || state.completed || state.roleTransition) return;
    const idx = state.nominationIndex;
    const m = state.managers[idx];
    if (m.id==='user' && !autocompleteMode) { renderTurn(); return; }
    const player = chooseNomination(m);
    if (!player) {
      // Defensive fallback: any legal player.
      const role = currentAuctionRole();
      const fallback = state.availableIds.map(id=>playerMap.get(id)).find(p=>p && (openRoleAuction()||p.role===role) && canOwn(m,p) && maxLegalBid(m,p)>=1);
      if (!fallback) return finishAuction(true);
      nominate(fallback.id, idx);
      return;
    }
    nominate(player.id, idx);
  }

  function freeRoleNominationWeights(manager,roles){
    return roles.map(role=>{
      const left=roleSlotsRemaining(manager,role);
      const pool=state.availableIds.map(id=>playerMap.get(id)).filter(p=>p?.role===role && canOwn(manager,p) && maxLegalBid(manager,p)>=1);
      const values=pool.map(p=>Math.max(1,baseAuctionValue(p))).sort((a,b)=>b-a);
      const threshold=TOP_VALUE_THRESHOLD[role]||30;
      const strong=values.filter(value=>value>=threshold*.75).length;
      const demand=state.managers.reduce((sum,m)=>sum+roleSlotsRemaining(m,role),0);
      const scarcity=strong?clamp(demand/Math.max(1,strong),.7,2):.65;
      const quality=clamp((values[0]||1)/threshold,.5,1.6);
      const room=Math.max(left,Math.min(targetFor(manager,role)-roleSpend(manager,role),Number(manager.budget||0)-Math.max(0,slotsRemaining(manager)-left)));
      const affordability=clamp(room/Math.max(left,(values[0]||1)),.4,1.25);
      // Every unfinished role keeps a positive chance; strategy biases the draw.
      const weight=left*(.55+quality*.25+scarcity*.25)*(.65+affordability*.35);
      return {role,weight};
    });
  }

  function chooseNomination(manager) {
    const open=openRoleAuction();
    const keeperCover=cpuMissingKeeperCover(manager);
    if(keeperCover && (open || currentAuctionRole()==='P') && maxLegalBid(manager,keeperCover)>=1 &&
       Math.random()<(profileArchetype(manager)==='admin'?1:Number(state.career.division)===1?.90:.75))return keeperCover;
    const availableRoles=ROLE_ORDER.filter(role=>roleSlotsRemaining(manager,role)>0 && state.availableIds.some(id=>{
      const player=playerMap.get(id);
      return player?.role===role && canOwn(manager,player) && maxLegalBid(manager,player)>=1;
    }));
    let role=currentAuctionRole();
    if(open && availableRoles.length){
      const weighted=freeRoleNominationWeights(manager,availableRoles);
      let roll=Math.random()*weighted.reduce((sum,item)=>sum+item.weight,0);
      role=(weighted.find(item=>(roll-=item.weight)<0)||weighted[0]).role;
    }
    const candidates = state.availableIds.map(id=>playerMap.get(id))
      .filter(p=>p && p.role===role && canOwn(manager,p) && maxLegalBid(manager,p)>=1);
    if (!candidates.length) return null;

    const archetype = profileArchetype(manager);
    const profile = manager.profile || {};
    const me = state.managers[0];
    const roleSlots = Math.max(1, roleSlotsRemaining(manager,role));
    const spent = roleSpend(manager,role);
    const budgetRoom = Math.max(roleSlots, targetFor(manager,role)-spent);
    const avgRoom = budgetRoom / roleSlots;

    // Build role-relative ranks once. These are used differently by each nomination style.
    const rankedByMarket = candidates.slice().sort((a,b)=>baseAuctionValue(b)-baseAuctionValue(a));
    const rankMap = new Map(rankedByMarket.map((p,i)=>[p.id,i]));
    const n = Math.max(1, rankedByMarket.length-1);

    let topChance=.38, valueChance=.30, targetChance=.22, chaosChance=.10;
    if (archetype==='bomber')        { topChance=.56; valueChance=.15; targetChance=.24; chaosChance=.05; }
    if (archetype==='spendaccione')  { topChance=.60; valueChance=.12; targetChance=.20; chaosChance=.08; }
    if (archetype==='collezionista') { topChance=.68; valueChance=.08; targetChance=.19; chaosChance=.05; }
    if (archetype==='ragioniere')    { topChance=.22; valueChance=.48; targetChance=.26; chaosChance=.04; }
    if (archetype==='tirchio')       { topChance=.13; valueChance=.58; targetChance=.23; chaosChance=.06; }
    if (archetype==='moneyball')     { topChance=.16; valueChance=.58; targetChance=.23; chaosChance=.03; }
    if (archetype==='esperto')       { topChance=.34; valueChance=.36; targetChance=.27; chaosChance=.03; }
    if (archetype==='pazzo')         { topChance=.30; valueChance=.18; targetChance=.18; chaosChance=.34; }
    if (archetype==='tifoso')        { topChance=.30; valueChance=.23; targetChance=.39; chaosChance=.08; }
    if (archetype==='admin')         { topChance=.52; valueChance=.22; targetChance=.23; chaosChance=.03; }

    const competence=cpuAuctionCompetence(manager);
    const competitiveDivision=competence>0;
    chaosChance*=1-competence*.70;
    // Later in the role phase, CPUs become more need-driven and less obsessed with the top name.
    const phaseCompletion = 1 - (state.managers.reduce((s,m)=>s+roleSlotsRemaining(m,role),0) / (ROLE_LIMITS[role]*state.managers.length));
    if (phaseCompletion > .55 && !competitiveDivision) { topChance *= .78; valueChance += .08; targetChance += .10; }
    // From Serie C onward the caller should expose strong players while the
    // league can still compete for them, even when its own budget is modest.
    if (competitiveDivision && phaseCompletion > .55) { topChance += .16; valueChance *= .75; }

    const total = topChance+valueChance+targetChance+chaosChance;
    let roll = Math.random()*total;
    let mode='top';
    if ((roll-=topChance) <= 0) mode='top';
    else if ((roll-=valueChance) <= 0) mode='value';
    else if ((roll-=targetChance) <= 0) mode='target';
    else mode='chaos';

    const scored = candidates.map(p => {
      const market = baseAuctionValue(p);
      const rankNorm = 1 - (rankMap.get(p.id)||0)/n; // 1 top, 0 bottom
      const limit = Math.max(1,cpuLimit(manager,p));
      const ovr = Number(p.ovr||70);
      const quote = Math.max(1,Number(p.quotation||1));
      const legacyEfficiency=ovr/Math.max(1,market);
      const footballEfficiency=Math.max(1,currentPlayerOvr(p)-55)*Math.max(.15,cpuAuctionStarterEstimate(p)/100)/Math.sqrt(Math.max(1,market));
      const efficiency=competence>0 ? Math.min(12,legacyEfficiency)*(1-competence)+footballEfficiency*competence : legacyEfficiency;
      const affordableFit = 1 / (1 + Math.abs(market-avgRoom)/Math.max(5,avgRoom));
      const favorite = profile.favoriteClub===p.club ? 1 : 0;
      const personalTaste = .82 + careerHash(`nom|${manager.id}|${p.id}`)*.36;
      const slotInterest = strategicSlotInterest(manager,p);
      const rankIndex = rankMap.get(p.id)||0;
      const outstanding = state.managers.reduce((sum,m)=>sum+roleSlotsRemaining(m,role),0);
      const viableCut = Math.min(candidates.length, Math.max(12, outstanding + 8));
      let score = 0;

      if (mode==='top') {
        score = 20 + rankNorm*72 + Math.min(18,limit/5) + favorite*16;
      } else if (mode==='value') {
        score = 18 + efficiency*9 + affordableFit*42 + (ovr/100)*15 + favorite*8;
        if (market > avgRoom*1.65) score *= .72;
      } else if (mode==='target') {
        score = 18 + (limit/Math.max(1,market))*28 + affordableFit*28 + favorite*34 + rankNorm*18;
      } else {
        score = 15 + Math.random()*58 + rankNorm*12 + favorite*10;
      }

      // User-pressure calls exist, but are rare and contextual rather than a permanent cheat.
      if (manager.id!=='user' && roleSlotsRemaining(me,role)<=2 && me.budget > manager.budget*.72 && rankNorm>.65) {
        if (Math.random()<.08) score += 12;
      }

      // Deep reserves should not become routine opening calls. They remain possible
      // in Chaos mode and naturally enter the viable pool later in the role phase.
      if (rankIndex >= viableCut) score *= mode==='chaos' ? .62 : .20;
      if (competitiveDivision && mode!=='chaos' && rankedByMarket.length>1) {
        const bestMarket=baseAuctionValue(rankedByMarket[0]);
        const strongCutoff=Math.max(TOP_VALUE_THRESHOLD[role]*.75,bestMarket*.70);
        const strongStillAvailable=bestMarket>=TOP_VALUE_THRESHOLD[role]*.75;
        if (strongStillAvailable && market<strongCutoff) score*=.32;
      }
      if (!slotInterest.willing) score *= mode==='chaos' ? .34 : .08;
      else score *= .90 + slotInterest.factor*.10;
      if(manager.id!=='user') score *= auctionReputationMultiplier(p);
      score *= personalTaste;
      score *= cpuFootballAuctionFactor(manager,p);
      score *= .90 + Math.random()*.20;
      return {p,score,mode,willing:slotInterest.willing};
    }).sort((a,b)=>b.score-a.score);

    // Broader shortlist than before: the best candidate is favoured, never guaranteed.
    const willingCandidates=scored.filter(item=>item.willing);
    const selection=competence>=.75 && willingCandidates.length ? willingCandidates : scored;
    const shortlist=Math.max(5,Math.round(14-competence*9));
    const poolSize=mode==='chaos' ? Math.min(Math.round(22-competence*12),selection.length) : Math.min(shortlist,selection.length);
    const pool = selection.slice(0,poolSize);
    const exponent = mode==='top' ? 1.20 : mode==='value' ? .92 : mode==='target' ? 1.02 : .60;
    const weights = pool.map((_,i)=>1/Math.pow(i+1,exponent));
    let weightedRoll = Math.random()*weights.reduce((a,b)=>a+b,0);
    for (let i=0;i<pool.length;i++) {
      weightedRoll -= weights[i];
      if (weightedRoll<=0) return pool[i].p;
    }
    return pool[0].p;
  }

  function finishAuction(forced=false) {
    clearAuctionRuntimeTimers();
    hideRoleTransitionModal();
    state.roleTransition = null;
    state.completed = true;
    state.auction = null;
    roleRemainderAutoSim = false;
    autocompleteMode = false;
    hideRoleRemainderAutoSim();
    if(state.winterMarketFlow?.stage==='auction'){
      state.winterMarketFlow.stage='trades';
      state.winterMarketFlow.completedAt=Date.now();
      state.winterMarketFlow.finalBudgets=Object.fromEntries(state.managers.map(manager=>[manager.id,Number(manager.budget||0)]));
      saveState();
      return renderTradeWindow('winter');
    }
    saveState();
    renderTradeWindow('summer');
  }

  function currentTradeWindow(kind){
    const seasonNumber=Math.max(1,Number(state?.career?.seasonNumber||1));
    const key=`${kind}|S${seasonNumber}`;
    state.tradeWindows ||= {};
    return state.tradeWindows[key] ||= {kind,seasonNumber,stage:'open',completed:0,attempts:0,history:[],pending:null,notice:''};
  }

  function tradeOfferSelection(){
    const me=managerById('user'),rival=managerById($('tradeOpponent')?.value);
    const outgoing=me?.roster?.find(p=>String(p.id)===$('tradeOutgoing')?.value);
    const incoming=rival?.roster?.find(p=>String(p.id)===$('tradeIncoming')?.value);
    const raw=String($('tradeCredits')?.value??'0').trim();
    const credits=/^\d+$/.test(raw)?Number(raw):NaN;
    return {me,rival,outgoing,incoming,credits};
  }

  function tradeOfferValid(offer){
    return !!(offer?.me && offer.rival && offer.outgoing && offer.incoming &&
      offer.me.id==='user' && offer.rival.id!=='user' && offer.me.id!==offer.rival.id &&
      offer.me.roster.includes(offer.outgoing) && offer.rival.roster.includes(offer.incoming) &&
      offer.outgoing.role===offer.incoming.role && Number.isSafeInteger(offer.credits) &&
      offer.credits>=0 && offer.credits<=Number(offer.me.budget||0));
  }

  function tradeAvailabilityFactor(player,kind){
    if(kind!=='winter') return 1;
    const day=Number(state?.season?.currentMatchday||20);
    const status=playerStatusForDay(player.id,day);
    if(!status.unavailable) return 1;
    if(status.type==='abroad') return 0;
    const record=playerSeasonStatus(player.id);
    const remaining=Math.max(1,39-day);
    const missed=Math.max(1,Math.min(remaining,Math.max(Number(record.injuryUntil||0),Number(record.suspensionUntil||0))-day+1));
    return Math.max(0,1-missed/remaining);
  }

  function tradeLineupStrength(roster,role,kind){
    // Protect the best usable players plus one cover, not just the first name.
    const counts={P:1,D:4,C:4,A:3};
    const values=roster.filter(p=>p.role===role).map(p=>tradePlayerWorth(p,kind)).sort((a,b)=>b-a);
    const starters=counts[role]||3;
    return values.slice(0,starters).reduce((sum,value)=>sum+value,0)+(values[starters]||0)*.35;
  }

  function tradePlayerWorth(player,kind){
    const ovr=currentPlayerOvr(player);
    // Il valore di mercato riflette anche il ruolo e la rarità dei migliori,
    // mentre il costo pagato all'asta non determina il valore di uno scambio.
    const base=Math.max(1,baseAuctionValue(player))*.90+Math.max(0,ovr-60)*.55;
    if(kind!=='winter') return base;
    const form=playerFormMetrics(player.id);
    const stat=playerSeasonStat(player.id);
    const healthy=Math.max(1,base+form.score*7+Math.min(14,Number(stat?.goals||0)*1.5+Number(stat?.assists||0)*.8));
    return healthy*tradeAvailabilityFactor(player,kind);
  }

  function tradeCpuDecision(offer,windowState){
    const ours=tradePlayerWorth(offer.outgoing,windowState.kind);
    const theirs=tradePlayerWorth(offer.incoming,windowState.kind);
    const role=offer.outgoing.role;
    const rivalAlternatives=offer.rival.roster.filter(p=>p.role===role);
    const otherValues=rivalAlternatives.filter(p=>p!==offer.incoming).map(p=>tradePlayerWorth(p,windowState.kind));
    const bestInRole=!otherValues.length || theirs>=Math.max(...otherValues);
    const starPremium=bestInRole?Math.max(3,Math.ceil(theirs*.12)):0;
    const before=tradeLineupStrength(offer.rival.roster,role,windowState.kind);
    const after=tradeLineupStrength(offer.rival.roster.map(p=>p===offer.incoming?offer.outgoing:p),role,windowState.kind);
    const loss=Math.max(0,before-after);
    const archetype=String(offer.rival.profile?.archetype||'');
    const firmness={squalo:.12,camaleonte:.06,fantadata:.15,predatore:.12,broker:.18,admin:.22,ragioniere:.07,tirchio:.10,moneyball:.08,pazzo:-.04}[archetype]||0;
    // Cash cannot compensate for an unusable replacement or a gutted starting unit.
    if(windowState.kind==='winter' && tradeAvailabilityFactor(offer.outgoing,windowState.kind)===0 && theirs>0) return {type:'reject'};
    if(loss>before*.25 && ours<theirs*.65) return {type:'reject'};
    const request=Math.max(0,Math.ceil((theirs-ours)*(1.15+firmness)+starPremium+loss*.15));
    const disposition=careerHash(`trade|${windowState.seasonNumber}|${windowState.kind}|${offer.rival.id}|${offer.outgoing.id}|${offer.incoming.id}`);
    const willingness=Math.max(.35,(theirs>ours? .62 : bestInRole? .68 : .76)-firmness);
    if(offer.credits>=request) return disposition<willingness?{type:'accept',credits:offer.credits}:{type:'reject'};
    const counter=request+Math.ceil(disposition*3);
    if(counter<=Number(offer.me.budget||0) && counter-offer.credits<=Math.max(6,Math.ceil(theirs*.20)) && disposition<willingness){
      const reason=bestInRole
        ? `È uno dei migliori ${ROLE_PLURALS[role]?.toLowerCase()||'giocatori'} della sua rosa: vuole un conguaglio per cederlo.`
        : theirs>ours+5
          ? 'Il giocatore che chiedi ha una valutazione maggiore di quello che offri.'
          : 'Le valutazioni sono vicine, ma il rivale vuole un conguaglio per chiudere.';
      return {type:'counter',credits:counter,reason};
    }
    return {type:'reject'};
  }

  function completeTrade(offer,windowState){
    if(!tradeOfferValid(offer) || windowState.stage!=='open' || windowState.completed>=(windowState.kind==='winter'?3:2)) return false;
    const {me,rival,outgoing,incoming,credits}=offer;
    me.roster.splice(me.roster.indexOf(outgoing),1,incoming);
    rival.roster.splice(rival.roster.indexOf(incoming),1,outgoing);
    me.budget=Number(me.budget)-credits;
    rival.budget=Number(rival.budget)+credits;
    state.tradeBudgetAdjustments ||= {};
    const priceDelta=Number(incoming.price||0)-Number(outgoing.price||0);
    state.tradeBudgetAdjustments[me.id]=Number(state.tradeBudgetAdjustments[me.id]||0)+priceDelta-credits;
    state.tradeBudgetAdjustments[rival.id]=Number(state.tradeBudgetAdjustments[rival.id]||0)-priceDelta+credits;
    if(windowState.kind==='winter'){
      winterLedgerFor(me.id).tradeCashDelta=Number(winterLedgerFor(me.id).tradeCashDelta||0)-credits;
      winterLedgerFor(rival.id).tradeCashDelta=Number(winterLedgerFor(rival.id).tradeCashDelta||0)+credits;
      state.winterMarketFlow.finalBudgets[me.id]=me.budget;
      state.winterMarketFlow.finalBudgets[rival.id]=rival.budget;
      if(state.season?.lineups) delete state.season.lineups[String(state.season.currentMatchday||20)];
      if(state.season?.assistantCoachLineup) state.season.assistantCoachLineup={enabled:!!state.season.assistantCoachLineup.enabled,formation:null,starters:{},bench:[],updatedAt:Date.now(),lastSourceDay:0};
    }
    windowState.completed++;
    windowState.pending=null;
    windowState.history.unshift(`${outgoing.name} → ${rival.team} · ${incoming.name} → ${me.team}${credits?` · ${credits} cr`:''}`);
    windowState.notice=`Scambio concluso: ${incoming.name} entra nella tua rosa.`;
    saveState();
    return true;
  }

  function tradeActiveKind(){
    return state?.winterMarketFlow?.stage==='trades'?'winter':'summer';
  }

  function tradeCreditsValue(){
    const raw=String($('tradeCredits')?.value??'0').trim();
    return /^\d+$/.test(raw)?Number(raw):0;
  }

  function tradeSetSelection(field,value){
    const el=$(field);
    if(!el) return;
    el.value=value?String(value):'';
    const trade=currentTradeWindow(tradeActiveKind());
    trade.notice='Proposta modificata.';
    renderTradeWindow(trade.kind);
  }

  function adjustTradeCredits(delta){
    const input=$('tradeCredits');
    if(!input) return;
    const max=Math.max(0,Number(input.max||0));
    const next=clamp(tradeCreditsValue()+Number(delta||0),0,max);
    input.value=String(next);
    const trade=currentTradeWindow(tradeActiveKind());
    trade.notice='Proposta modificata.';
    renderTradeWindow(trade.kind);
  }

  function tradeRosterPlayerMarkup(player,{selected=false,disabled=false,action='outgoing'}={}){
    const price=Number(player?.price||player?.quotation||0);
    return `<button type="button" class="trade-roster-row ${selected?'is-selected':''} ${disabled?'is-disabled':''}" data-trade-${escapeHtml(action)}="${escapeHtml(String(player.id))}" ${disabled?'disabled':''}>
      <span class="trade-roster-face">${playerAvatarMarkup(player,player.name)}</span>
      <span class="trade-roster-copy"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(clubName(player.club))}</small></span>
      <span class="trade-roster-meta"><i class="lineup-role-chip role-${player.role}">${escapeHtml(player.role)}</i><b>OVR ${escapeHtml(playerOvrLabel(player))}</b><em>${price} cr</em></span>
    </button>`;
  }

  function tradePlayerCardMarkup(player,{emptyText='Seleziona un giocatore dalla lista.'}={}){
    if(!player) return `<div class="trade-player-card is-empty"><div class="trade-player-empty-icon">+</div><div class="trade-player-copy"><strong>Nessun giocatore selezionato</strong><small>${escapeHtml(emptyText)}</small></div></div>`;
    const price=Number(player?.price||player?.quotation||0);
    return `<article class="trade-player-card">
      <div class="trade-player-avatar">${playerAvatarMarkup(player,player.name)}</div>
      <div class="trade-player-copy"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(clubName(player.club))}</small></div>
      <div class="trade-player-stats"><i class="lineup-role-chip role-${player.role}">${escapeHtml(player.role)}</i><span><small>OVR</small><b>${escapeHtml(playerOvrLabel(player))}</b></span><span><small>Quota</small><b>${price}</b></span></div>
    </article>`;
  }

  function tradeFilteredRoster(roster,role='all',sort='ovr',compatibleRole=''){
    const price=p=>Number(p?.price||p?.quotation||0);
    const selectedRole=role==='compatible'?compatibleRole:role;
    return (roster||[]).filter(p=>!selectedRole||selectedRole==='all'||p.role===selectedRole).slice().sort((a,b)=>{
      if(sort==='price') return price(b)-price(a)||currentPlayerOvr(b)-currentPlayerOvr(a);
      if(sort==='price-low') return price(a)-price(b)||currentPlayerOvr(b)-currentPlayerOvr(a);
      if(sort==='name') return String(a.name||'').localeCompare(String(b.name||''),'it');
      return currentPlayerOvr(b)-currentPlayerOvr(a)||price(b)-price(a);
    });
  }

  function renderTradeRosterChoices(offer=tradeOfferSelection()){
    const mine=tradeFilteredRoster(offer.me?.roster,$('tradeMyRole')?.value||'all',$('tradeMySort')?.value||'ovr');
    const theirs=tradeFilteredRoster(offer.rival?.roster,$('tradeRivalRole')?.value||'compatible',$('tradeRivalSort')?.value||'ovr',offer.outgoing?.role||'');
    if($('tradeMyRosterCount')) $('tradeMyRosterCount').textContent=`${mine.length} / ${(offer.me?.roster||[]).length} giocatori`;
    if($('tradeRivalRosterCount')) $('tradeRivalRosterCount').textContent=`${theirs.length} / ${(offer.rival?.roster||[]).length} giocatori`;
    if($('tradeMyRosterList')) $('tradeMyRosterList').innerHTML=mine.map(player=>tradeRosterPlayerMarkup(player,{selected:String(player.id)===String(offer.outgoing?.id||''),disabled:!!offer.incoming&&offer.incoming.role!==player.role,action:'outgoing'})).join('')||'<p class="trade-roster-empty">Nessun giocatore per questo ruolo.</p>';
    if($('tradeRivalRosterList')) $('tradeRivalRosterList').innerHTML=theirs.map(player=>tradeRosterPlayerMarkup(player,{selected:String(player.id)===String(offer.incoming?.id||''),disabled:!!offer.outgoing&&offer.outgoing.role!==player.role,action:'incoming'})).join('')||'<p class="trade-roster-empty">Nessun giocatore per questo ruolo.</p>';
  }

  function renderTradeWindow(kind){
    if(!state?.completed || (kind==='winter' && state.winterMarketFlow?.stage!=='trades')) return;
    const trade=currentTradeWindow(kind);
    if(trade.stage==='completed') return kind==='winter'?renderSeasonDashboard():renderSummary();
    const limit=kind==='winter'?3:2,maxAttempts=limit*3;
    showScreen('tradeWindowScreen');
    $('tradeWindowEyebrow').textContent=kind==='winter'?'FINE ASTA DI GENNAIO · TRATTATIVE':'FINE ASTA INIZIALE · TRATTATIVE';
    $('tradeWindowProgress').textContent=`${trade.completed} / ${limit} SCAMBI · ${trade.attempts} / ${maxAttempts} PROPOSTE`;
    const me=managerById('user');
    const previousOutgoing=$('tradeOutgoing').value,previousRival=$('tradeOpponent').value,previousIncoming=$('tradeIncoming').value;
    $('tradeOutgoing').innerHTML=`<option value="">Seleziona un tuo giocatore</option>`+(me?.roster||[]).map(p=>`<option value="${escapeHtml(String(p.id))}">${escapeHtml(p.role)} · ${escapeHtml(p.name)} · OVR ${playerOvrLabel(p)}</option>`).join('');
    if((me?.roster||[]).some(p=>String(p.id)===previousOutgoing)) $('tradeOutgoing').value=previousOutgoing;
    $('tradeOpponent').innerHTML=state.managers.filter(m=>m.id!=='user').map(m=>`<option value="${escapeHtml(String(m.id))}">${escapeHtml(m.team)} · ${escapeHtml(m.name||m.profile?.label||'Rivale')}</option>`).join('');
    if(state.managers.some(m=>m.id===previousRival && m.id!=='user')) $('tradeOpponent').value=previousRival;
    if(!$('tradeOpponent').value && $('tradeOpponent').options.length) $('tradeOpponent').selectedIndex=0;
    const preIncomingOffer=tradeOfferSelection();
    $('tradeIncoming').innerHTML=`<option value="">Seleziona il giocatore richiesto</option>`+(preIncomingOffer.rival?.roster||[]).filter(p=>!preIncomingOffer.outgoing || p.role===preIncomingOffer.outgoing.role).map(p=>`<option value="${escapeHtml(String(p.id))}">${escapeHtml(p.role)} · ${escapeHtml(p.name)} · OVR ${playerOvrLabel(p)}</option>`).join('');
    if((preIncomingOffer.rival?.roster||[]).some(p=>String(p.id)===previousIncoming && (!preIncomingOffer.outgoing || p.role===preIncomingOffer.outgoing.role))) $('tradeIncoming').value=previousIncoming;
    $('tradeCredits').max=String(Math.max(0,Number(me?.budget||0)));
    if(tradeCreditsValue()>Number($('tradeCredits').max||0)) $('tradeCredits').value=$('tradeCredits').max;

    const offer=tradeOfferSelection();
    const rival=offer.rival;
    const userTheme=seasonFixtureTheme(me,true);
    const rivalTheme=seasonFixtureTheme(rival,false);
    renderFixtureCoachPortrait('tradeUserAvatar', me||{id:'user',name:state?.managerName||'Mister'}, userTheme);
    renderFixtureCoachPortrait('tradeRivalAvatar', rival, rivalTheme);
    if($('tradeUserTeamName')) $('tradeUserTeamName').textContent=me?.team||state?.teamName||'La tua squadra';
    if($('tradeUserManagerName')) $('tradeUserManagerName').textContent=me?.name||state?.managerName||'Il tuo fantallenatore';
    if($('tradeRivalManagerName')) $('tradeRivalManagerName').textContent=rival?.name||rival?.profile?.label||'Allenatore rivale';
    if($('tradeMyRosterTitle')) $('tradeMyRosterTitle').textContent=`I tuoi giocatori (${me?.team||'Tu'})`;
    if($('tradeRivalRosterTitle')) $('tradeRivalRosterTitle').textContent=`I suoi giocatori (${rival?.team||'Rivale'})`;
    if($('tradeBudgetHint')) $('tradeBudgetHint').textContent=`${Number(me?.budget||0)} crediti disponibili`;
    if($('tradeOutgoingCard')) $('tradeOutgoingCard').innerHTML=tradePlayerCardMarkup(offer.outgoing,{emptyText:'Scegli il giocatore che vuoi offrire.'});
    if($('tradeIncomingCard')) $('tradeIncomingCard').innerHTML=tradePlayerCardMarkup(offer.incoming,{emptyText:offer.outgoing?'Scegli il giocatore avversario dello stesso ruolo.':'Seleziona prima il giocatore che vuoi offrire.'});
    renderTradeRosterChoices(offer);

    $('tradeResponse').textContent=trade.notice||'Scegli due giocatori per preparare lo scambio.';
    $('tradeHistory').innerHTML=trade.history.length?`<h4>Scambi conclusi</h4><div class="trade-history-list">${trade.history.map(line=>`<p>${escapeHtml(line)}</p>`).join('')}</div>`:'';
    const exhausted=trade.completed>=limit||trade.attempts>=maxAttempts;
    $('tradeOfferBtn').disabled=exhausted||!tradeOfferValid(offer);
    $('tradeCounterBtn').classList.toggle('hidden',!trade.pending);
    $('tradeCounterBtn').disabled=!trade.pending||Number(me?.budget||0)<Number(trade.pending?.credits||0);
    $('tradeCounterBtn').textContent=trade.pending?`ACCETTA CONTROPROPOSTA · ${trade.pending.credits} CR`:'ACCETTA CONTROPROPOSTA';
    $('tradeFinishBtn').textContent=kind==='winter'?'TERMINA E RIPRENDI IL CAMPIONATO':'TERMINA E VAI AL RIEPILOGO';
  }

  function submitTradeOffer(){
    const kind=state?.winterMarketFlow?.stage==='trades'?'winter':'summer',trade=currentTradeWindow(kind);
    const offer=tradeOfferSelection(),limit=kind==='winter'?3:2;
    if(trade.stage!=='open'||trade.completed>=limit||trade.attempts>=limit*3||!tradeOfferValid(offer)) return;
    const pending=trade.pending;
    const agreed=pending && pending.rivalId===offer.rival.id && pending.outgoingId===String(offer.outgoing.id) && pending.incomingId===String(offer.incoming.id) && offer.credits>=Number(pending.credits);
    trade.attempts++;
    const decision=agreed?{type:'accept',credits:offer.credits}:tradeCpuDecision(offer,trade);
    trade.pending=null;
    if(decision.type==='accept') completeTrade(offer,trade);
    else if(decision.type==='counter'){
      trade.pending={rivalId:offer.rival.id,outgoingId:String(offer.outgoing.id),incomingId:String(offer.incoming.id),credits:decision.credits,reason:decision.reason};
      trade.notice=`${offer.rival.team} chiede ${decision.credits} crediti per accettare lo scambio. ${decision.reason}`;
      saveState();
    } else {trade.notice=`${offer.rival.team} rifiuta la proposta.`;saveState();}
    renderTradeWindow(kind);
  }

  function acceptTradeCounter(){
    const kind=state?.winterMarketFlow?.stage==='trades'?'winter':'summer',trade=currentTradeWindow(kind),pending=trade.pending;
    if(!pending || trade.stage!=='open') return;
    const me=managerById('user'),rival=managerById(pending.rivalId);
    const offer={me,rival,outgoing:me?.roster?.find(p=>String(p.id)===pending.outgoingId),incoming:rival?.roster?.find(p=>String(p.id)===pending.incomingId),credits:pending.credits};
    if(!completeTrade(offer,trade)){trade.pending=null;trade.notice='Controproposta non più disponibile.';saveState();}
    renderTradeWindow(kind);
  }

  function finishTradeWindow(){
    const kind=state?.winterMarketFlow?.stage==='trades'?'winter':'summer',trade=currentTradeWindow(kind);
    trade.stage='completed';trade.pending=null;
    if(kind==='winter') state.winterMarketFlow.stage='completed';
    saveState();
    if(kind==='winter') renderSeasonDashboard(); else renderSummary();
  }

  function leagueRoleAverage(role) {
    if (!state?.managers?.length) return 0;
    return state.managers.reduce((sum,m)=>sum+roleSpend(m,role),0) / state.managers.length;
  }

  function calibrationStatus(actual,target) {
    const delta = actual-target;
    const abs = Math.abs(delta);
    if (abs <= 8) return {label:'IN TARGET', cls:'good'};
    if (abs <= 18) return {label:'ACCETTABILE', cls:'warn'};
    return {label: delta>0?'ALTO':'BASSO', cls:'bad'};
  }



  function compactLineupPlayerName(name) {
    const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
    return parts[0]||'—';
  }

  function bestTheoreticalLineup(manager) {
    if(!manager?.roster?.length) return null;
    let best=null;
    availableLineupFormations().forEach(formation=>{
      const lineup=buildAutoLineup(manager,formation);
      const starters=Object.values(lineup.starters||{}).map(id=>(manager.roster||[]).find(p=>String(p.id)===String(id))).filter(Boolean);
      const score=starters.reduce((sum,p)=>sum+lineupPlayerValue(p),0);
      const ovr=starters.reduce((sum,p)=>sum+currentPlayerOvr(p),0);
      const unavailable=starters.filter(p=>playerStatusForDay(p.id,state?.season?.currentMatchday||1).unavailable).length;
      const candidate={formation,lineup,starters,score,ovr,unavailable};
      if(!best || candidate.score>best.score || (candidate.score===best.score && candidate.ovr>best.ovr) || (candidate.score===best.score && candidate.ovr===best.ovr && formation.localeCompare(best.formation)<0)) best=candidate;
    });
    return best;
  }

  function bestXIHtml(manager) {
    const best=bestTheoreticalLineup(manager);
    if(!best) return '<div class="best-xi-empty">Formazione non disponibile.</div>';
    const day=Number(state?.season?.currentMatchday||1);
    const playersById=new Map((manager.roster||[]).map(p=>[String(p.id),p]));
    const avg=best.starters.length ? (best.ovr/best.starters.length).toFixed(1) : '—';
    const slots=lineupSlots(best.formation).map(slot=>{
      const p=playersById.get(String(best.lineup.starters?.[slot.instanceId]||''));
      if(!p) return '';
      const form=playerFormMetrics(p.id);
      const status=playerStatusForDay(p.id,day);
      const formText=visibleFormLabel(p.id,1);
      return `<button type="button" class="best-xi-player role-${p.role} ${status.unavailable?'is-unavailable':''}" style="left:${slot.x}%;top:${slot.y}%" data-season-player="${escapeHtml(String(p.id))}" title="${escapeHtml(p.name)} · ${escapeHtml(clubName(p.club))} · OVR ${playerOvrLabel(p)}${status.unavailable?` · ${escapeHtml(status.label||'Indisponibile')}`:''}">
        <span>${escapeHtml(slot.key)}</span><strong>${escapeHtml(compactLineupPlayerName(p.name))}</strong><small>OVR ${playerOvrLabel(p)} · ${escapeHtml(formText)}</small>
      </button>`;
    }).join('');
    return `<section class="manager-best-xi">
      <div class="best-xi-summary">
        <div><span>MODULO</span><strong>${escapeHtml(best.formation)}</strong></div>
        <div><span>OVR XI</span><strong>${avg}</strong></div>
        <div><span>GIORNATA</span><strong>${day}</strong></div>
      </div>
      <div class="best-xi-note">Miglior XI teorico calcolato su qualità, forma e disponibilità attuale.</div>
      <div class="best-xi-pitch" aria-label="Miglior formazione di ${escapeHtml(manager.team)}">
        <i class="best-xi-half"></i><i class="best-xi-circle"></i><i class="best-xi-box best-xi-box-top"></i><i class="best-xi-box best-xi-box-bottom"></i>
        ${slots}
      </div>
      ${best.unavailable?`<div class="best-xi-warning">⚠ ${best.unavailable} titolare${best.unavailable===1?'':'i'} attualmente indisponibile${best.unavailable===1?'':'i'}: il sistema ha scelto la miglior alternativa possibile per ruolo.</div>`:''}
    </section>`;
  }

  function wireLeagueRosterViewToggles(root) {
    if(!root) return;
    root.querySelectorAll('[data-roster-view]').forEach(btn=>btn.addEventListener('click',()=>{
      const card=btn.closest('[data-roster-manager]');
      if(!card) return;
      const target=btn.dataset.rosterView;
      card.querySelectorAll('[data-roster-view]').forEach(x=>x.classList.toggle('active',x===btn));
      card.querySelector('.manager-roster-view')?.classList.toggle('hidden',target!=='roster');
      card.querySelector('.manager-bestxi-view')?.classList.toggle('hidden',target!=='bestxi');
    }));
  }

  function buildFinalLeagueRosterCards(options={}) {
    if (!state?.managers?.length) return '';
    const withBestXI=!!options.withBestXI;
    return state.managers.map((m) => {
      const roleSections = ROLE_ORDER.map(role => {
        const items = Array.isArray(m.roster) ? m.roster.filter(x => x.role === role) : [];
        const spend = items.reduce((sum,x)=>sum + Number(x.price||0),0);
        const pct = Math.round(spend / INITIAL_BUDGET * 100);
        const rows = Array.from({length: ROLE_LIMITS[role]}, (_,idx) => {
          const x = items[idx];
          if (!x) return `<div class="league-player-row role-player-${role} is-empty"><span>—</span><em></em><b></b></div>`;
          return `<button type="button" class="league-player-row role-player-${role} season-player-open summary-player-row" data-season-player="${escapeHtml(String(x.id))}" title="${escapeHtml(x.name)} · ${escapeHtml(clubName(x.club))} · ${Number(x.price||0)} crediti">
            <span>${escapeHtml(x.name)}</span><b>${Number(x.price||0)}</b>
          </button>`;
        }).join('');
        return `<div class="league-role-block role-block-${role}">
          <div class="league-role-strip role-strip-${role}">
            <span><strong>${role}</strong><small>${items.length}/${ROLE_LIMITS[role]}</small></span>
            <span class="role-spend"><b>${pct}%</b><small>${spend} cr</small></span>
          </div>
          <div class="league-role-players">${rows}</div>
        </div>`;
      }).join('');

      const roster = Array.isArray(m.roster) ? m.roster : [];
      const spent = roster.reduce((sum,x)=>sum+Number(x.price||0),0);
      const progress = Math.round(roster.length / TOTAL_SLOTS * 100);
      const avgOvr = roster.length ? (roster.reduce((s,x)=>s+Number(x.ovr||0),0)/roster.length).toFixed(1) : '—';
      const personality = m.id==='user'
        ? `${escapeHtml(state.managerName || 'Tu')} · TU`
        : escapeHtml(m.profile?.label || m.name || 'CPU');

      return `<div class="manager-card summary-manager-card ${m.id==='user'?'is-user':''}" data-roster-manager="${escapeHtml(String(m.id))}">
        <div class="league-manager-head">
          <div class="manager-title-line">
            <span class="manager-online-dot"></span>
            <div class="manager-identity">
              <div class="manager-name" title="${escapeHtml(m.team)}">${escapeHtml(m.team)}</div>
              <div class="manager-personality">${personality}</div>
            </div>
            <span class="manager-status complete">COMPLETA</span>
          </div>
          <div class="manager-credit-line">
            <div class="credit-main"><span class="coin">●</span><strong>${Number(m.budget||0)}</strong><small>crediti</small></div>
          </div>
          <div class="manager-progress"><i style="width:${progress}%"></i></div>
          <div class="manager-substats">
            <span><strong>${spent}</strong><small>SPESA</small></span>
            <span class="slots"><strong>${roster.length}/${TOTAL_SLOTS}</strong><small>ROSA</small></span>
            <span><strong>${avgOvr}</strong><small>OVR</small></span>
          </div>
        </div>
        ${withBestXI?`<div class="manager-roster-tabs" role="tablist" aria-label="Vista ${escapeHtml(m.team)}">
          <button type="button" class="active" data-roster-view="roster">ROSA COMPLETA</button>
          <button type="button" data-roster-view="bestxi">MIGLIOR XI</button>
        </div>`:''}
        <div class="manager-roster-view"><div class="league-roster">${roleSections}</div></div>
        ${withBestXI?`<div class="manager-bestxi-view hidden">${bestXIHtml(m)}</div>`:''}
      </div>`;
    }).join('');
  }

  function renderSummary(forced=false) {
    showScreen('summaryScreen');
    $('summaryTitle').textContent = forced ? 'Asta terminata con un controllo di sicurezza.' : 'Le 10 rose sono pronte.';
    const highest = state.stats.highest;
    const avgSpend = state.stats.purchases ? (state.stats.totalSpent/state.stats.purchases).toFixed(1) : '0';
    $('summaryStats').innerHTML = `
      <div class="summary-stat"><strong>${state.stats.purchases}</strong><span>acquisti</span></div>
      <div class="summary-stat"><strong>${avgSpend}</strong><span>prezzo medio</span></div>
      <div class="summary-stat"><strong>${highest?highest.price:'—'}</strong><span>acquisto più caro</span></div>
      <div class="summary-stat"><strong>${highest?escapeHtml(highest.playerName):'—'}</strong><span>${highest?escapeHtml(highest.team):'top acquisto'}</span></div>
      <div class="summary-stat"><strong>${state.integrity?.repairs||0}</strong><span>correzioni integrità</span></div>`;
    const roleCards = Object.keys(ROLE_LIMITS).map(role => {
      const actual = leagueRoleAverage(role);
      const target = MARKET_ROLE_TARGET[role];
      const status = calibrationStatus(actual,target);
      const diff = actual-target;
      return `<div class="calibration-role">
        <div class="calibration-role-head"><strong>${role}</strong><span class="cal-${status.cls}">${status.label}</span></div>
        <div class="calibration-values"><b>${actual.toFixed(1)}</b><span>benchmark ${target}</span></div>
        <small>${diff>=0?'+':''}${diff.toFixed(1)} crediti</small>
      </div>`;
    }).join('');
    $('calibrationPanel').innerHTML = `<div class="calibration-title"><div><span class="muted">DIAGNOSTICA ECONOMIA</span><h3>Spesa media della lega per reparto</h3></div><div class="benchmark-chip">P30 · D60 · C120 · A290</div></div><div class="calibration-grid">${roleCards}</div><p class="calibration-copy">Non è un vincolo: le singole CPU possono sbilanciarsi molto. Serve a verificare che, nel complesso, il mercato resti dentro fasce credibili.</p>`;
    const summaryGrid = $('summaryTeams');
    renderSponsorSelection();
    if (summaryGrid) {
      summaryGrid.innerHTML = buildFinalLeagueRosterCards();
      // Defensive fallback: a completed league with managers should never show an empty recap.
      if (!summaryGrid.children.length && state?.managers?.length) {
        summaryGrid.innerHTML = state.managers.map(m => `<div class="manager-card summary-manager-card"><div class="league-manager-head"><div class="manager-name">${escapeHtml(m.team)}</div></div></div>`).join('');
      }
    }
  }

  function teamPreviewScore(m) {
    if (!m.roster.length) return 0;
    const values = m.roster.map(x=>baseAuctionValue(x));
    const quality = values.reduce((a,b)=>a+b,0) / Math.max(1,values.length);
    const ovr = m.roster.reduce((s,x)=>s+Number(x.ovr||0),0)/m.roster.length;
    return Math.round((quality*.42 + ovr*.58)*10)/10;
  }


  function buildFantasySeasonSchedule(managers,totalRounds=FANTASY_SEASON_MATCHDAYS,existingRounds=[]){
    return buildSeasonSchedule(managers,totalRounds,existingRounds,careerHash);
  }

  function freshStandings(managers) {
    return buildFreshStandings(managers);
  }

  function freshSerieAStandings(){
    return freshClubStandings(window.FANTA_CLUBS||[]);
  }

  function emptyPlayerSeasonStat(player){
    return {
      playerId:String(player.id),name:player.name,club:player.club,role:player.role,
      appearances:0,starts:0,subApps:0,minutes:0,voteCount:0,voteSum:0,fantasySum:0,
      goals:0,assists:0,yellow:0,red:0,missedPenalty:0,savedPenalty:0,cleanSheets:0,
      bestVote:null,worstVote:null,recent:[],lastDay:0
    };
  }

  function ensurePlayerSeasonSystems(season){
    if(!season || initializedSeasonSystems.has(season)) return;
    if(!season.playerSeasonStats || typeof season.playerSeasonStats!=='object') season.playerSeasonStats={};
    if(!season.playerStatus || typeof season.playerStatus!=='object') season.playerStatus={};
    if(!season.simDataUpdatedDays || typeof season.simDataUpdatedDays!=='object') season.simDataUpdatedDays={};

    (window.FANTA_PLAYERS||[]).forEach(player=>{
      const id=String(player.id);
      if(!season.playerSeasonStats[id]) season.playerSeasonStats[id]=emptyPlayerSeasonStat(player);
      if(!season.playerStatus[id]) season.playerStatus[id]={injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
    });

    if(!Array.isArray(season.serieAStandings) || season.serieAStandings.length!==(window.FANTA_CLUBS||[]).length){
      season.serieAStandings=freshSerieAStandings();
      Object.values(season.serieAResults||{}).sort((a,b)=>Number(a.day||0)-Number(b.day||0)).forEach(result=>{
        updateSerieAStandingsFromStoredMatches(season,result.matches||[]);
      });
    }
    initializedSeasonSystems.add(season);
  }

  function playerSeasonStat(playerId){
    const season=state?.season;
    if(!season) return null;
    ensurePlayerSeasonSystems(season);
    return season.playerSeasonStats[String(playerId)]||null;
  }


  // V3.2.35.56.37 · Motore calciomercato Serie A.
  // La finestra viene pianificata dal motore puro; UI, listone fantasy e mercato
  // di riparazione verranno collegati nei passaggi successivi.
  function ensureSerieATransferMarket(source=state){
    if(!source) return TransferEngine.createMarketState('career');
    if(!source.transferMarket || typeof source.transferMarket!=='object'){
      source.transferMarket=TransferEngine.createMarketState(source.marketSeed||'career');
    }
    const market=source.transferMarket;
    market.seed=String(market.seed||source.marketSeed||'career');
    market.version=Math.max(3,Number(market.version||1));
    if(!Array.isArray(market.foreignPool) || !market.foreignPool.length){
      market.foreignPool=TransferEngine.generateForeignPool(market.seed,TransferEngine.FOREIGN_POOL_SIZE||300);
    }
    if(!Array.isArray(market.specialPlayers)) market.specialPlayers=[];
    return market;
  }

  function syncSerieATransferWorld(source=state){
    if(!source) return null;
    activateCatalogBase(source);
    const market=ensureSerieATransferMarket(source);
    const world=TransferEngine.materializeWorldPlayers(baseSerieAPlayers,market);
    const baseOvr=source.playerBaseOvr&&typeof source.playerBaseOvr==='object'?source.playerBaseOvr:{};
    const applyBaseOvr=(player)=>{
      const override=Number(baseOvr[String(player?.id)]);
      if(!player || !Number.isFinite(override)) return {...player};
      return {...player,ovr:override,overall:override};
    };
    const activeClubIds=new Set(ensureRealLeague(source).serieA);
    const serieBWorldPlayers=world.activePlayers.filter(p=>!activeClubIds.has(p.club)).map(p=>({...applyBaseOvr(p),marketStatus:'serie_b',hidden:true}));
    const activePlayers=world.activePlayers.filter(p=>activeClubIds.has(p.club)).map(applyBaseOvr);
    world.activePlayers=activePlayers;
    world.abroadPlayers=(world.abroadPlayers||[]).map(applyBaseOvr);
    world.incomingPlayers=(world.incomingPlayers||[]).map(applyBaseOvr);

    // Il listone runtime contiene soltanto calciatori attualmente in Serie A.
    // Gli espatriati restano nel playerMap/storico, ma spariscono dal listone e
    // dalle rose reali usate dalla simulazione.
    if(!Array.isArray(window.FANTA_PLAYERS)) window.FANTA_PLAYERS=[];
    window.FANTA_PLAYERS.splice(0,window.FANTA_PLAYERS.length,...activePlayers);

    playerMap.clear();
    activePlayers.forEach(player=>playerMap.set(String(player.id),player));
    serieBWorldPlayers.forEach(player=>playerMap.set(String(player.id),player));
    world.abroadPlayers.forEach(player=>playerMap.set(String(player.id),{...player}));
    refreshMarketValueMap(source);

    // Aggiorna le copie dei giocatori presenti nelle fantasquadre senza toccare
    // prezzo d'asta o altri dati propri della rosa fantasy.
    (source.managers||[]).forEach(manager=>{
      (manager.roster||[]).forEach(item=>{
        const canonical=playerMap.get(String(item.id));
        if(!canonical) return;
        const fantasyPrice=item.price;
        Object.assign(item,canonical);
        if(fantasyPrice!==undefined) item.price=fantasyPrice;
      });
    });

    // I nuovi arrivi devono poter produrre statistiche e status già dalla
    // giornata successiva, anche se i sistemi stagione erano già inizializzati.
    const season=source.season;
    if(season?.started){
      season.playerSeasonStats ||= {};
      season.playerStatus ||= {};
      [...activePlayers,...world.abroadPlayers].forEach(player=>{
        const id=String(player.id);
        if(!season.playerSeasonStats[id]) season.playerSeasonStats[id]=emptyPlayerSeasonStat(player);
        else {
          season.playerSeasonStats[id].name=player.name;
          season.playerSeasonStats[id].club=player.club;
          season.playerSeasonStats[id].role=player.role;
        }
        if(!season.playerStatus[id]) season.playerStatus[id]={injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
      });
    }

    // Anche il listone svincolati segue il nuovo mondo Serie A.
    const owned=new Set((source.managers||[]).flatMap(manager=>(manager.roster||[]).map(player=>String(player.id))));
    source.availableIds=activePlayers.map(player=>String(player.id)).filter(id=>!owned.has(id));

    market.worldClubMetrics=TransferEngine.buildClubWorldMetrics(activePlayers,window.FANTA_CLUBS||[]);
    market.worldRevision=(market.history||[]).length;
    market.worldSummary={
      activePlayers:activePlayers.length,
      abroadPlayers:world.abroadPlayers.length,
      incomingPlayers:world.incomingPlayers.length,
      revision:market.worldRevision
    };
    if(typeof serieAStrengthCache!=='undefined') serieAStrengthCache={key:null,rows:null};
    return {...world,clubMetrics:market.worldClubMetrics};
  }

  function serieATransferStatsSnapshot(){
    const season=state?.season;
    if(!season?.playerSeasonStats) return {};
    const out={};
    Object.entries(season.playerSeasonStats).forEach(([playerId,stat])=>{
      const voteCount=Math.max(0,Number(stat?.voteCount||0));
      out[playerId]={
        appearances:Number(stat?.appearances||0),
        starts:Number(stat?.starts||0),
        goals:Number(stat?.goals||0),
        assists:Number(stat?.assists||0),
        avgVote:voteCount>0?Number(stat?.voteSum||0)/voteCount:0,
        fantasyAverage:voteCount>0?Number(stat?.fantasySum||0)/voteCount:0
      };
    });
    return out;
  }

  function ensureMisterJunior(seasonNumber){
    const market=ensureSerieATransferMarket(state);
    const id=`mister-junior-S${seasonNumber}`;
    const existing=market.specialPlayers.find(player=>player.isMisterJunior || String(player.id).startsWith('mister-junior-'));
    if(existing) return existing;
    const key=`mister-junior|S${seasonNumber}`;
    const role=ROLE_ORDER[Math.floor(careerHash(`${key}|role`)*ROLE_ORDER.length)]||'C';
    const ovr=65+Math.floor(careerHash(`${key}|ovr`)*26);
    const age=17+Math.floor(careerHash(`${key}|age`)*4);
    const potentialOvr=Math.min(94,ovr+2+Math.floor(careerHash(`${key}|potential`)*Math.max(3,95-ovr)));
    const clubs=(window.FANTA_CLUBS||[]).filter(club=>club?.id);
    if(!clubs.length) return null;
    const club=String(clubs[Math.floor(careerHash(`${key}|club`)*clubs.length)].id);
    const name=`${String(state.managerName||'Fantallenatore').trim()||'Fantallenatore'} Junior`;
    const roleFactor={P:.82,D:.92,C:1.02,A:1.12}[role]||1;
    const base=Math.max(1,(ovr-58)*1.05*roleFactor*1.16*(1+Math.max(0,potentialOvr-ovr)*.018));
    const player={id,name,role,roleLabel:ROLE_LABELS[role]||role,nation:'Italia',age,ovr,overall:ovr,potentialOvr,
      quotation:Math.max(1,Math.round(base*.72)),fvm:Math.max(2,Math.round(base*2.05)),
      sourceLeague:'Settore giovanile',sourceNation:'Italia',originClub:'Settore giovanile',
      marketStatus:'pending',hidden:true,club:'',isMisterJunior:true,juniorSeason:seasonNumber};
    market.specialPlayers.push(player);
    return player;
  }

  function addMisterJuniorToWinterPlan(plan,seasonNumber){
    if(!plan || plan.windowType!=='winter') return plan;
    const junior=ensureMisterJunior(seasonNumber);
    if(!junior || Number(junior.juniorSeason)!==Number(seasonNumber) || junior.marketStatus!=='pending' || (plan.operations||[]).some(op=>String(op.playerId)===String(junior.id))) return plan;
    const clubs=(window.FANTA_CLUBS||[]).filter(club=>club?.id);
    const destination=String(clubs[Math.floor(careerHash(`mister-junior|S${seasonNumber}|club`)*clubs.length)].id);
    const operation={id:`arrival-winter-junior-S${seasonNumber}`,type:'arrival',playerId:junior.id,playerName:junior.name,
      role:junior.role,fromClub:null,toClub:destination,destination:null,ovr:junior.ovr,targetOvr:junior.ovr,
      reason:'mister_junior',replacementSource:'special',score:999,externalPlayer:{...junior},specialArrival:true};
    const operations=Array.isArray(plan.operations)?plan.operations.slice():[];
    const replaceIndex=operations.findIndex(op=>op?.type==='arrival');
    if(replaceIndex>=0) operations[replaceIndex]=operation;
    else operations.push(operation);
    plan.operations=operations;
    plan.counts={...(plan.counts||{}),internal:operations.filter(op=>op.type==='internal').length,
      abroad:operations.filter(op=>op.type==='abroad').length,arrivals:operations.filter(op=>op.type==='arrival').length,
      arrivalRequests:operations.filter(op=>op.type==='arrival_request').length,total:operations.length};
    return plan;
  }

  function generateSerieATransferWindowPlan(windowType='winter',externalPool=null){
    if(!state) return null;
    const market=ensureSerieATransferMarket(state);
    const seasonNumber=Math.max(1,Number(state.career?.seasonNumber||1));
    const normalizedType=windowType==='summer'?'summer':'winter';
    const seed=`${market.seed||state.marketSeed||'career'}|S${seasonNumber}|${normalizedType}`;
    const hiddenForeignPool=Array.isArray(externalPool)
      ? externalPool
      : (market.foreignPool||[]).filter(player=>player?.marketStatus==='foreign_pool');
    const plan=TransferEngine.planWindow({
      windowType:normalizedType,
      seed,
      generatedAt:Date.now(),
      players:window.FANTA_PLAYERS||[],
      clubs:window.FANTA_CLUBS||[],
      statsByPlayer:serieATransferStatsSnapshot(),
      externalPool:hiddenForeignPool
    });
    return normalizedType==='winter'?addMisterJuniorToWinterPlan(plan,seasonNumber):plan;
  }

  function registerSerieATransferWindowPlan(plan){
    if(!state || !plan) return null;
    state.transferMarket=TransferEngine.applyPlan(ensureSerieATransferMarket(state),plan);
    syncSerieATransferWorld(state);
    return state.transferMarket;
  }

  function completedSeasonUserPosition(season=state?.season){
    if(!season) return 10;
    if(Number.isFinite(Number(season?.careerPrize?.position))) return Number(season.careerPrize.position);
    const rows=sortFantasyLeagueStandings(season.standings||[],season);
    const index=rows.findIndex(row=>String(row.managerId)==='user');
    return index>=0?index+1:10;
  }

  function careerSeasonOutcome(position,currentDivision,teamCount){
    const promoted=position===1 && currentDivision>1;
    const champion=position===1 && currentDivision===1;
    const relegated=currentDivision<4 && teamCount>1 && position===teamCount;
    const nextDivision=promoted?currentDivision-1:relegated?currentDivision+1:currentDivision;
    return {promoted,champion,relegated,nextDivision};
  }

  function completedUserSeasonRecap(season=state?.season){
    if(!season?.completed) return null;
    if(season.userSeasonRecap) return season.userSeasonRecap;
    const user=managerById('user');
    season.userSeasonRecap=window.FantaSeasonRecap.build({
      results:season.matchdayResults||{},
      roster:user?.roster||[],
      development:season.playerOvrDevelopment||season.archivedPlayerOvrDevelopment||{},
      position:completedSeasonUserPosition(season)
    });
    saveState();
    return season.userSeasonRecap;
  }

  function recordUserAuctionPick(player,winnerId){
    if(!state || winnerId!=='user' || !player) return;
    const career=ensureCareerEconomy();
    career.auctionPicks ||= [];
    const existing=career.auctionPicks.find(pick=>String(pick.id)===String(player.id));
    if(existing){existing.count=Math.max(1,Number(existing.count||1))+1;existing.seasonNumber=Number(career.seasonNumber||1);}
    else career.auctionPicks.push({id:String(player.id),name:player.name,count:1,seasonNumber:Number(career.seasonNumber||1)});
  }

  function finalizeCompletedSeasonOvrBases(){
    const season=state?.season;
    if(!state || !season?.completed) return false;
    if(season.ovrBasesFinalized) return true;
    state.playerBaseOvr ||= {};
    const snapshot={};
    for(const [id,player] of playerMap.entries()){
      if(!player) continue;
      const finalOvr=currentPlayerOvr(player);
      snapshot[String(id)]=finalOvr;
      state.playerBaseOvr[String(id)]=finalOvr;
    }
    season.finalOvrSnapshot=snapshot;
    season.archivedPlayerOvrDevelopment=JSON.parse(JSON.stringify(season.playerOvrDevelopment||{}));
    season.playerOvrDevelopment={};
    season.ovrBasesFinalized=true;
    season.ovrBasesFinalizedAt=Date.now();
    syncSerieATransferWorld(state);
    saveState();
    return true;
  }

  function ensureNextSeasonFlow(){
    const season=state?.season;
    if(!state || !season?.completed) return null;
    completedUserSeasonRecap(season);
    const career=ensureCareerEconomy();
    if(!state.nextSeasonFlow || Number(state.nextSeasonFlow.sourceSeasonNumber)!==Number(career.seasonNumber||1)){
      const position=completedSeasonUserPosition(season);
      const currentDivision=Math.max(1,Math.floor(Number(career.division||GAME_CONFIG.startingDivision)));
      const {promoted,champion,relegated,nextDivision}=careerSeasonOutcome(position,currentDivision,state.managers.length);
      state.nextSeasonFlow={
        version:3,
        sourceSeasonNumber:Number(career.seasonNumber||1),
        stage:'recap',
        position,
        promoted,
        champion,
        relegated,
        currentDivision,
        nextDivision,
        createdAt:Date.now(),
        summerPlanId:null
      };
      saveState();
    }else if(Number(state.nextSeasonFlow.version||0)<3){
      // Recap già aperto in un salvataggio precedente: applica la retrocessione
      // prima di costruire la nuova asta, senza riavviare il mercato estivo.
      const flow=state.nextSeasonFlow;
      const outcome=careerSeasonOutcome(Number(flow.position||completedSeasonUserPosition(season)),Number(flow.currentDivision||career.division),state.managers.length);
      Object.assign(flow,outcome,{version:3});
      saveState();
    }
    return state.nextSeasonFlow;
  }

  function nextSeasonSummerPlan(){
    const flow=state?.nextSeasonFlow;
    if(!flow?.summerPlanId) return null;
    return (state?.transferMarket?.windows||[]).find(item=>item?.id===flow.summerPlanId)||null;
  }

  function archiveCompletedSeasonIfNeeded(){
    const season=state?.season;
    if(!state || !season?.completed) return null;
    const career=ensureCareerEconomy();
    career.seasonHistory ||= [];
    const seasonNumber=Math.max(1,Number(career.seasonNumber||1));
    const existing=career.seasonHistory.find(item=>Number(item.seasonNumber)===seasonNumber);
    if(existing) return existing;
    const standings=sortFantasyLeagueStandings(season.standings||[],season);
    const position=completedSeasonUserPosition(season);
    const row=standings.find(item=>String(item.managerId)==='user')||{};
    const flow=ensureNextSeasonFlow();
    const archive={
      seasonNumber,
      seasonLabel:careerSeasonLabel(seasonNumber),
      division:Number(career.division||GAME_CONFIG.startingDivision),
      divisionLabel:careerDivisionLabel(career.division),
      position,
      promoted:!!flow?.promoted,
      champion:!!flow?.champion,
      relegated:!!flow?.relegated,
      nextDivision:Number(flow?.nextDivision||career.division||GAME_CONFIG.startingDivision),
      nextDivisionLabel:careerDivisionLabel(flow?.nextDivision||career.division),
      played:Number(row.played||0),wins:Number(row.wins||0),draws:Number(row.draws||0),losses:Number(row.losses||0),
      gf:Number(row.gf||0),ga:Number(row.ga||0),points:Number(row.points||0),fantasyPoints:Number(row.fantasyPoints||0),
      finalEuros:careerEuros(),finalFantapoints:careerFantapoints(),
      completedAt:Date.now()
    };
    archive.personalRecap=completedUserSeasonRecap(season);
    career.seasonHistory.push(archive);
    saveState();
    return archive;
  }

  function renderNextSeasonFlow(){
    const flow=ensureNextSeasonFlow();
    const season=state?.season;
    if(!flow || !season) return renderSeasonDashboard();
    showScreen('nextSeasonScreen');
    renderCareerWallets();
    const position=Number(flow.position||completedSeasonUserPosition(season));
    const nextLabel=careerDivisionLabel(flow.nextDivision);
    const currentLabel=careerDivisionLabel(flow.currentDivision);
    const promoted=!!flow.promoted;
    const champion=!!flow.champion;
    const relegated=!!flow.relegated;
    const nextNo=Number(flow.sourceSeasonNumber||1)+1;
    const title=$('nextSeasonTitle'),subtitle=$('nextSeasonSubtitle'),kicker=$('nextSeasonKicker');
    if(flow.stage==='market_summary'){
      if(kicker) kicker.textContent=`STAGIONE ${flow.sourceSeasonNumber} CONCLUSA · MERCATO ESTIVO`;
      if(title) title.textContent='Il nuovo mondo Serie A è pronto';
      if(subtitle) subtitle.textContent=`Ora prepara la stagione ${nextNo}: nuovi avversari, nuova asta, nuovi Fantapoteri e nuove regole Admin.`;
    }else{
      if(kicker) kicker.textContent=promoted?'PROMOZIONE!':champion?'CAMPIONE DI SERIE A!':relegated?'RETROCESSIONE':'FINE STAGIONE';
      if(title) title.textContent=promoted?`Destinazione ${nextLabel}`:champion?'Hai vinto la Serie A':relegated?`Si riparte dalla ${nextLabel}`:`Stagione conclusa · ${currentLabel}`;
      if(subtitle) subtitle.textContent=promoted
        ? `Hai chiuso al ${position}° posto e sali di categoria. Prima della nuova asta si apre il mercato estivo della Serie A.`
        : champion
          ? `Hai chiuso al 1° posto e conquistato la Serie A. Ripartirai dalla Serie A con una nuova lega, 9 nuovi avversari e una nuova asta.`
          : relegated
            ? `Hai chiuso all'ultimo posto in ${currentLabel} e retrocedi in ${nextLabel}. Ti aspettano una nuova lega, 9 nuovi avversari e una nuova asta.`
          : `Hai chiuso al ${position}° posto. Ripartirai nella stessa categoria con una nuova lega e nuovi avversari.`;
    }
    const userRow=sortFantasyLeagueStandings(season.standings||[],season).find(item=>String(item.managerId)==='user')||{};
    const prize=season.careerPrize||{};
    if($('nextSeasonRecapGrid')) $('nextSeasonRecapGrid').innerHTML=`
      <article class="panel next-season-stat"><small>POSIZIONE FINALE</small><strong>${position}°</strong><span>${promoted?'PROMOSSO':champion?'CAMPIONE':relegated?'RETROCESSO':'STAGIONE CONCLUSA'}</span></article>
      <article class="panel next-season-stat"><small>CATEGORIA</small><strong>${escapeHtml(currentLabel)}</strong><span>${promoted||relegated?`→ ${escapeHtml(nextLabel)}`:champion?'TITOLO SERIE A':'PERMANENZA'}</span></article>
      <article class="panel next-season-stat"><small>${fantaclassificaIsActive(season)?'FANTACLASSIFICA':'RECORD'}</small><strong>${Number(userRow.wins||0)}V · ${Number(userRow.draws||0)}N · ${Number(userRow.losses||0)}P</strong><span>${fantaclassificaIsActive(season)?`${Number(userRow.fantasyPoints||0).toFixed(1)} FANTAPUNTI`:`${Number(userRow.points||0)} PUNTI`}</span></article>
      <article class="panel next-season-stat"><small>PREMIO STAGIONE</small><strong>${Number(prize.amount||0)>0?`+${Number(prize.amount||0)} €`:'—'}</strong><span>FP ${careerFantapoints()} · € ${careerEuros()}</span></article>`;
    if(flow.stage==='market_summary' && state.realLeague?.lastChanges){
      const changes=state.realLeague.lastChanges;
      $('nextSeasonRecapGrid')?.insertAdjacentHTML('beforeend',`<article class="panel next-season-stat"><small>SERIE A REALE · PROMOSSE</small><p>${changes.promoted.map(id=>escapeHtml(clubName(id))).join(' · ')}</p><small>RETROCESSE IN SERIE B</small><p>${changes.relegated.map(id=>escapeHtml(clubName(id))).join(' · ')}</p></article>`);
    }
    renderSeasonKeeperChoice();
    const personal=completedUserSeasonRecap(season);
    const formatAverage=value=>Number(value||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
    const award=(icon,title,item,value,detail)=>{
      const player=item?.id?managerById('user')?.roster?.find(p=>String(p.id)===String(item.id)):null;
      return `<article class="next-season-personal-award"><div class="next-season-personal-head"><span aria-hidden="true">${icon}</span><small>${escapeHtml(title)}</small></div><div class="next-season-personal-player">${player?`<span class="next-season-personal-face">${playerAvatarMarkup(player,player.name)}</span>`:''}<strong>${escapeHtml(item?.name||'—')}</strong></div><b>${item?escapeHtml(value):'—'}</b><span class="next-season-personal-detail">${item?escapeHtml(detail):'Nessun giocatore idoneo'}</span></article>`;
    };
    if($('nextSeasonPersonalGrid') && personal){
      const appearances=item=>`${item.appearances} presenze nella tua fantasquadra`;
      $('nextSeasonPersonalGrid').innerHTML=
        award('⚽','CAPOCANNONIERE',personal.scorer,`${personal.scorer?.goals||0} gol`,appearances(personal.scorer||{appearances:0}))+
        award('👟','ASSIST MAN',personal.assister,`${personal.assister?.assists||0} assist`,appearances(personal.assister||{appearances:0}))+
        award('⭐','MIGLIOR MEDIA VOTO',personal.topVote,formatAverage(personal.topVote?.avgVote),`Minimo 5 voti · ${appearances(personal.topVote||{appearances:0})}`)+
        award('🔥','MIGLIOR FANTAMEDIA',personal.topFantasy,formatAverage(personal.topFantasy?.avgFantasy),`Minimo 5 voti · ${appearances(personal.topFantasy||{appearances:0})}`)+
        award('💎','MIGLIOR ACQUISTO',personal.bestPurchase,`${formatAverage(personal.bestPurchase?.avgFantasy)} FM`,`Costo d’asta ${personal.bestPurchase?.cost||0} crediti · ${appearances(personal.bestPurchase||{appearances:0})}`)+
        award('📈','PIÙ MIGLIORATO',personal.improved,`+${personal.improved?.delta||0} OVR`,`Da ${personal.improved?.start||0} a ${personal.improved?.end||0} OVR`)+
        award('📉','PIÙ PEGGIORATO',personal.declined,`${personal.declined?.delta||0} OVR`,`Da ${personal.declined?.start||0} a ${personal.declined?.end||0} OVR`);
    }
    const marketCard=$('nextSeasonMarketCard');
    const primary=$('nextSeasonPrimaryBtn');
    if(flow.stage==='market_summary'){
      marketCard?.classList.remove('hidden');
      const plan=nextSeasonSummerPlan();
      const counts=plan?.counts||{};
      if($('nextSeasonMarketStats')) $('nextSeasonMarketStats').innerHTML=`<div class="winter-transfer-stat"><strong>${Number(counts.internal||0)}</strong><span>TRASFERIMENTI</span></div><div class="winter-transfer-stat"><strong>${Number(counts.abroad||0)}</strong><span>PARTENZE</span></div><div class="winter-transfer-stat"><strong>${Number(counts.arrivals||0)}</strong><span>NUOVI ARRIVI</span></div>`;
      if($('nextSeasonTransferList')) $('nextSeasonTransferList').innerHTML=(plan?.operations||[]).map(winterTransferOperationMarkup).join('') || '<div class="next-season-empty">Nessuna operazione registrata.</div>';
      wireSeasonPlayerButtons($('nextSeasonTransferList'));
      if(primary) primary.textContent='SCEGLI I FANTAPOTERI';
    }else{
      marketCard?.classList.add('hidden');
      if(primary) primary.textContent='SIMULA MERCATO ESTIVO';
    }
  }

  async function simulateNextSeasonSummerMarket(){
    const flow=ensureNextSeasonFlow();
    if(!flow || flow.stage!=='recap' || nextSeasonMarketSimulationRunning) return;
    nextSeasonMarketSimulationRunning=true;
    const loading=$('nextSeasonLoading'),button=$('nextSeasonPrimaryBtn');
    if(button){button.disabled=true;button.textContent='MERCATO IN CORSO...';}
    if(loading){loading.classList.remove('hidden');loading.setAttribute('aria-hidden','false');}
    const steps=[
      ['Consolidamento OVR...','I valori finali della stagione diventano la nuova base dei giocatori.'],
      ['Mercato estivo in corso...','I club stanno valutando cessioni, acquisti e nuovi arrivi.'],
      ['Aggiornamento Serie A...','Rose, gerarchie e listone della nuova stagione stanno venendo ricostruiti.']
    ];
    for(const [title,description] of steps){
      if($('nextSeasonLoadingTitle')) $('nextSeasonLoadingTitle').textContent=title;
      if($('nextSeasonLoadingText')) $('nextSeasonLoadingText').textContent=description;
      await new Promise(resolve=>setTimeout(resolve,620));
      if(title.startsWith('Consolidamento')) finalizeCompletedSeasonOvrBases();
    }
    advanceRealLeague(state,sortedSerieAStandings());
    const plan=generateSerieATransferWindowPlan('summer');
    registerSerieATransferWindowPlan(plan);
    flow.summerPlanId=plan?.id||null;
    flow.stage='market_summary';
    flow.summerCompletedAt=Date.now();
    saveState();
    if(loading){loading.classList.add('hidden');loading.setAttribute('aria-hidden','true');}
    if(button) button.disabled=false;
    nextSeasonMarketSimulationRunning=false;
    renderNextSeasonFlow();
  }

  function renderSeasonKeeperChoice(){
    const grid=$('nextSeasonRecapGrid');
    if(!grid || !leagueRulesFor(state).keeperConfirmation)return;
    const selected=String(state.season?.keeperPlayerId||'');
    const roster=managerById('user')?.roster||[];
    const panel=document.createElement('article');panel.className='panel next-season-stat';
    panel.innerHTML=`<small>CONFERMA PER LA PROSSIMA ASTA</small><p>Scegli un giocatore al prezzo pagato. Puoi anche non confermare nessuno.</p><select id="seasonKeeperSelect" aria-label="Giocatore da confermare"><option value="">Nessuna conferma</option>${roster.map(p=>`<option value="${escapeHtml(String(p.id))}" ${String(p.id)===selected?'selected':''}>${escapeHtml(p.name)} · ${p.role} · ${Number(p.price||1)} crediti</option>`).join('')}</select><p>Se il giocatore lascia il listone o cambi universo, la conferma viene annullata senza costi.</p>`;
    grid.append(panel);
    panel.querySelector('select').addEventListener('change',event=>{state.season.keeperPlayerId=event.target.value;saveState();});
  }

  function applySeasonKeeper(draft){
    const keeper=draft?.pendingKeeper;
    if(!keeper)return;
    const manager=draft.managers?.find(m=>m.id==='user');
    const player=(window.FANTA_PLAYERS||[]).find(p=>String(p.id)===String(keeper.id));
    const price=Math.max(1,Number(keeper.price||1));
    if(!manager || !player || player.marketStatus==='abroad' || price>manager.budget){draft.pendingKeeper=null;showToast('Conferma annullata: giocatore non disponibile nel nuovo listone.',true);return;}
    if(!manager.roster.some(p=>String(p.id)===String(player.id))){
      manager.roster.push({...player,price});manager.budget-=price;
      draft.availableIds=draft.availableIds.filter(id=>String(id)!==String(player.id));
      draft.log.unshift(`CONFERMATO · ${player.name} · ${price} cr`);
    }
    draft.pendingKeeper=null;
  }

  function buildNextSeasonCareerDraft(){
    const flow=ensureNextSeasonFlow();
    const season=state?.season;
    if(!flow || flow.stage!=='market_summary' || !season?.completed) return null;
    archiveCompletedSeasonIfNeeded();
    finalizeCompletedSeasonOvrBases();
    const oldCareer=ensureCareerEconomy();
    const nextCareer=JSON.parse(JSON.stringify(compactLongCareerState(state).career));
    nextCareer.seasonNumber=Math.max(1,Number(oldCareer.seasonNumber||1))+1;
    nextCareer.division=Number(flow.nextDivision||oldCareer.division||GAME_CONFIG.startingDivision);
    const auctionBonus=Math.max(0,Number(oldCareer.nextAuctionBonusCredits||0));
    nextCareer.nextAuctionBonusCredits=0;
    const managers=freshManagers(state.teamName||'Team JHZ',state.managerName||'Mister',nextCareer.division);
    if(managers[0]) managers[0].budget=INITIAL_BUDGET+auctionBonus;
    const seasonalSeed=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}-S${nextCareer.seasonNumber}`;
    const inventory={...(season.consumables?.inventory||{})};
    return {
      version:24,
      marketSeed:seasonalSeed,
      currentRoleIndex:0,
      startedAt:Date.now(),
      teamName:state.teamName||'Team JHZ',
      managerName:state.managerName||'Mister',
      coachAvatar:normalizedCoachAvatar(state.coachAvatar),
      tradeWindows:{},tradeBudgetAdjustments:{},
      managers,
      auctionStartingBudgets:Object.fromEntries(managers.map(manager=>[manager.id,Number(manager.budget||INITIAL_BUDGET)])),
      availableIds:(window.FANTA_PLAYERS||[]).map(player=>String(player.id)),
      nominationIndex:0,
      nominationCalls:{},
      auction:null,
      roleTransition:null,
      log:[],
      turbo:false,
      completed:false,
      stats:{purchases:0,totalSpent:0,highest:null},
      auctionEvents:{count:0,lastPurchaseAt:-99,history:[],activeEffects:[],pending:null,relationships:{}},
      auctionPowers:{block:false,scout:false,bluff:false,observer:false,oneShot:false,uses:{block:0,scout:0,bluff:0,oneShot:0},selected:[]},
      leagueRules:flow.preAuctionRules ? JSON.parse(JSON.stringify(flow.preAuctionRules)) : defaultLeagueRules(),
      leagueRulesRerollCount:Number(flow.preAuctionRulesRerollCount||0),
      transferMarket:JSON.parse(JSON.stringify(ensureSerieATransferMarket(state))),
      playerBaseOvr:{...(state.playerBaseOvr||{})},
      realLeague:JSON.parse(JSON.stringify(ensureRealLeague(state))),
      catalogMode:state.catalogMode||'base',
      pokemonCatalogSeed:state.pokemonCatalogSeed||null,
      catalogWorlds:JSON.parse(JSON.stringify(state.catalogWorlds||{})),
      pendingKeeper:leagueRulesFor(state).keeperConfirmation ? (()=>{const p=managerById('user')?.roster?.find(p=>String(p.id)===String(season.keeperPlayerId||''));return p?{id:String(p.id),price:Number(p.price||1)}:null;})():null,
      auctionReputation:buildSeasonAuctionReputation(season),
      carryoverConsumables:inventory,
      sponsorOfferIds:shuffledCopy(Object.keys(SEASON_SPONSORS)).slice(0,3),
      career:nextCareer,
      integrity:{checks:0,repairs:0,warnings:0,lastCheck:null,recent:[]},
      nextSeasonMeta:{fromSeason:Number(flow.sourceSeasonNumber||1),promotion:!!flow.promoted,champion:!!flow.champion,relegation:!!flow.relegated,fromDivision:Number(flow.currentDivision),toDivision:Number(flow.nextDivision),auctionBonusCredits:auctionBonus}
    };
  }

  function openNextSeasonAuctionSetup(){
    const draft=buildNextSeasonCareerDraft();
    if(!draft) return;
    careerDraft=draft;
    careerPowerSelection=[];
    careerRulesNextAction='auction';
    nextSeasonSetupMode=true;
    $('careerTeamNameInput').value=careerDraft.teamName;
    $('coachNameInput').value=careerDraft.managerName;
    updateCareerIdentityControls();
    const title=document.querySelector('#careerSetupScreen .career-title h2');
    const subtitle=document.querySelector('#careerSetupScreen .career-title p');
    if(title) title.textContent=`Stagione ${careerDraft.career.seasonNumber} · ${careerDivisionLabel(careerDraft.career.division)}`;
    if(subtitle) subtitle.innerHTML=`${escapeHtml(careerSeasonLabel(careerDraft.career.seasonNumber))} · NUOVA ASTA · 9 NUOVI AVVERSARI`;
    if($('careerPowersBackBtn')) $('careerPowersBackBtn').textContent='← MERCATO ESTIVO';
    showCareerSetupStep('powers');
    renderCareerPowerSelection();
    $('careerSetupScreen').classList.remove('hidden');
  }

  function handleNextSeasonPrimaryAction(){
    const flow=ensureNextSeasonFlow();
    if(!flow) return;
    if(flow.stage==='market_summary') openNextSeasonAuctionSetup();
    else simulateNextSeasonSummerMarket();
  }

  const WINTER_TRANSFER_TRIGGER_MATCHDAY=19;
  const WINTER_AUCTION_BASE_CREDITS=50;
  let winterMarketSimulationRunning=false;
  let winterGuaranteedSaleMode=false;

  function winterExpectedWindowId(){
    const market=ensureSerieATransferMarket(state);
    const seasonNumber=Math.max(1,Number(state?.career?.seasonNumber||1));
    return `winter-${market.seed||state?.marketSeed||'career'}|S${seasonNumber}|winter`;
  }

  function winterMarketPlan(){
    const id=state?.winterMarketFlow?.planId||winterExpectedWindowId();
    return (state?.transferMarket?.windows||[]).find(item=>item?.id===id)||null;
  }

  function createWinterBudgetLedger(){
    return Object.fromEntries((state?.managers||[]).map(manager=>[manager.id,{
      initialLeftover:Math.max(0,Number(manager.budget||0)),baseGrant:0,foreignRefund:0,releaseRefund:0,winterSpent:0
    }]));
  }

  function winterLedgerFor(managerId){
    const flow=state?.winterMarketFlow;
    if(!flow) return null;
    flow.ledger ||= createWinterBudgetLedger();
    return flow.ledger[managerId] ||= {initialLeftover:0,baseGrant:0,foreignRefund:0,releaseRefund:0,winterSpent:0};
  }

  function expectedWinterBudget(managerId){
    const row=winterLedgerFor(managerId);
    if(!row) return null;
    return Math.max(0,Number(row.initialLeftover||0)+Number(row.baseGrant||0)+Number(row.foreignRefund||0)+Number(row.releaseRefund||0)-Number(row.winterSpent||0)+Number(row.tradeCashDelta||0));
  }

  function ensureWinterMarketFlow(){
    const season=state?.season;
    if(!season?.started || Number(season.lastCompletedMatchday||0)<WINTER_TRANSFER_TRIGGER_MATCHDAY) return null;
    if(state.winterMarketFlow?.stage==='completed') return state.winterMarketFlow;
    if(!state.winterMarketFlow){
      const existing=(state.transferMarket?.windows||[]).find(item=>item?.id===winterExpectedWindowId());
      state.winterMarketFlow={
        version:1,seasonNumber:Math.max(1,Number(state.career?.seasonNumber||1)),
        stage:existing?'summary':'intro',planId:existing?.id||null,ledger:createWinterBudgetLedger(),
        userReleaseIds:[],foreignDepartures:[],userForeignRefunds:[],cpuReleases:[],userReleases:[],createdAt:Date.now()
      };
      if(existing) settleWinterMarketFinances(existing);
      saveState();
    }
    return state.winterMarketFlow;
  }

  function activateWinterTransferWindowIfNeeded(){
    return ensureWinterMarketFlow();
  }

  function winterTransferOperationMarkup(operation){
    const player=playerMap.get(String(operation.playerId))||(window.FANTA_PLAYERS||[]).find(item=>String(item.id)===String(operation.playerId));
    const name=escapeHtml(operation.playerName||player?.name||'Giocatore');
    const type=operation.reason==='mister_junior'?'ARRIVO · JUNIOR':operation.type==='internal'?'SERIE A':operation.type==='abroad'?'ESTERO':operation.reason==='replacement'?'ARRIVO · SOSTITUTO':'ARRIVO';
    const from=operation.reason==='mister_junior'?'Settore giovanile':operation.type==='arrival'?'Estero':clubName(operation.fromClub);
    const to=operation.type==='abroad'?'Estero':clubName(operation.toClub);
    const stat=playerSeasonStat(operation.playerId)||{};
    const dataPro=shopItemActive('fantadata_pro',state?.season);
    const scoutPlus=shopItemActive('scout_plus',state?.season);
    const avg=Number(stat.voteCount||0)?(Number(stat.voteSum||0)/Number(stat.voteCount)).toFixed(2):'—';
    const favg=Number(stat.voteCount||0)?(Number(stat.fantasySum||0)/Number(stat.voteCount)).toFixed(2):'—';
    const starter=player?estimatedStarterProbability(player):0;
    return `<button type="button" class="winter-transfer-player-card is-${operation.type}" data-season-player="${escapeHtml(String(operation.playerId||''))}">
      <span class="winter-transfer-avatar">${player?playerAvatarMarkup(player,name):''}</span>
      <span class="winter-transfer-player-main"><small class="winter-transfer-type">${type}</small><strong>${name}</strong><em>${escapeHtml(from)} <b>→</b> ${escapeHtml(to)}</em></span>
      <span class="winter-transfer-overall"><small>OVR</small><strong>${player?playerOvrLabel(player):'—'}</strong></span>
      <span class="winter-transfer-role role-${escapeHtml(player?.role||'')}"><small>RUOLO</small><strong>${escapeHtml(player?.role||'—')}</strong></span>
      <span class="winter-transfer-insights">
        <span class="${scoutPlus?'is-unlocked':'is-locked'}"><small>TITOLARE</small><b>${scoutPlus?`${starter}%`:'🔒 Scout Plus'}</b></span>
        <span class="${dataPro?'is-unlocked':'is-locked'}"><small>MV</small><b>${dataPro?avg:'🔒'}</b></span>
        <span class="${dataPro?'is-unlocked':'is-locked'}"><small>FM</small><b>${dataPro?favg:'🔒'}</b></span>
        <span><small>G / A</small><b>${Number(stat.goals||0)} / ${Number(stat.assists||0)}</b></span>
      </span>
    </button>`;
  }

  function settleWinterMarketFinances(plan){
    const flow=state?.winterMarketFlow;
    if(!flow || flow.financesSettled) return;
    (state.managers||[]).forEach(manager=>{
      const ledger=winterLedgerFor(manager.id);
      ledger.baseGrant=WINTER_AUCTION_BASE_CREDITS;
      manager.budget=Number(manager.budget||0)+WINTER_AUCTION_BASE_CREDITS;
    });
    (plan?.operations||[]).filter(operation=>operation.type==='abroad'&&operation.playerId).forEach(operation=>{
      for(const manager of state.managers||[]){
        const index=(manager.roster||[]).findIndex(item=>String(item.id)===String(operation.playerId));
        if(index<0) continue;
        const [item]=manager.roster.splice(index,1);
        const refund=Math.max(0,Number(item.price||0));
        manager.budget+=refund;
        winterLedgerFor(manager.id).foreignRefund+=refund;
        const record={managerId:manager.id,playerId:String(item.id),playerName:item.name,refund,paid:Number(item.price||0)};
        flow.foreignDepartures.push(record);
        if(manager.id==='user') flow.userForeignRefunds.push(record);
        break;
      }
    });
    flow.financesSettled=true;
    delete state.transferMarket.pendingWindowSummaryId;
    delete state.transferMarket.pendingWindowSummarySeason;
    syncSerieATransferWorld(state);
  }

  async function simulateWinterMarket(){
    const flow=ensureWinterMarketFlow();
    if(!flow || flow.stage!=='intro' || winterMarketSimulationRunning) return;
    winterMarketSimulationRunning=true;
    const overlay=$('winterMarketLoading'),button=$('simulateWinterMarketBtn');
    const loadingSteps=[
      ['Analisi delle trattative...','I club stanno valutando acquisti e cessioni.'],
      ['Registrazione dei trasferimenti...','Contratti e destinazioni vengono confermati.'],
      ['Aggiornamento delle rose...','Gerarchie, titolarità e listone stanno cambiando.']
    ];
    if(button){button.disabled=true;button.textContent='MERCATO IN CORSO...';}
    if(overlay){overlay.classList.add('show');overlay.setAttribute('aria-hidden','false');}
    for(const [title,description] of loadingSteps){
      if($('winterMarketLoadingTitle')) $('winterMarketLoadingTitle').textContent=title;
      if($('winterMarketLoadingText')) $('winterMarketLoadingText').textContent=description;
      await new Promise(resolve=>setTimeout(resolve,700));
    }
    const plan=generateSerieATransferWindowPlan('winter');
    registerSerieATransferWindowPlan(plan);
    flow.planId=plan.id;
    settleWinterMarketFinances(plan);
    flow.stage='summary';
    flow.simulatedAt=Date.now();
    saveState();
    if(overlay){overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');}
    if(button){button.disabled=false;button.textContent='SIMULA MERCATO';}
    winterMarketSimulationRunning=false;
    renderWinterMarketSummary();
  }

  function renderWinterMarketIntro(){ showScreen('winterMarketIntroScreen'); }

  function renderWinterMarketSummary(){
    const flow=ensureWinterMarketFlow();
    const plan=winterMarketPlan();
    if(!flow||!plan) return renderWinterMarketIntro();
    showScreen('winterMarketSummaryScreen');
    const counts=plan.counts||{};
    $('winterFlowStats').innerHTML=`<div class="winter-transfer-stat"><strong>${Number(counts.internal||0)}</strong><span>TRASFERIMENTI</span></div><div class="winter-transfer-stat"><strong>${Number(counts.abroad||0)}</strong><span>PARTENZE</span></div><div class="winter-transfer-stat"><strong>${Number(counts.arrivals||0)}</strong><span>NUOVI ARRIVI</span></div>`;
    $('winterFlowTransferList').innerHTML=(plan.operations||[]).map(winterTransferOperationMarkup).join('');
    wireSeasonPlayerButtons($('winterFlowTransferList'));
    const me=managerById('user'),ledger=winterLedgerFor('user');
    const refunds=flow.userForeignRefunds||[];
    $('winterUserRefunds').innerHTML=`<h3>Il tuo budget di gennaio: ${Number(me?.budget||0)} crediti</h3><div class="winter-refund-row"><strong>Bonus base mercato invernale</strong><b>+${Number(ledger?.baseGrant||0)}</b></div><div class="winter-refund-row"><strong>Crediti avanzati dall'asta iniziale</strong><b>${Number(ledger?.initialLeftover||0)}</b></div>${refunds.length?refunds.map(row=>`<div class="winter-refund-row"><strong>${escapeHtml(row.playerName)} · trasferito all'estero</strong><b>+${row.refund}</b></div>`).join(''):'<div class="winter-refund-row"><strong>Nessun tuo giocatore trasferito all’estero</strong><b>+0</b></div>'}`;
  }

  function cpuWinterReleaseScore(player,manager){
    const form=playerFormMetrics(player.id);
    const starter=estimatedStarterProbability(player);
    const roleDepth=roleCount(manager,player.role);
    return Number(player.ovr||60)*1.3+Number(player.quotation||1)*.7+starter*.12+Number(form.avg||6)*2+(roleDepth<=ROLE_LIMITS[player.role]?-2:0);
  }

  function releaseWinterPlayer(manager,player,source='voluntary'){
    const index=(manager?.roster||[]).findIndex(item=>String(item.id)===String(player.id));
    if(index<0) return null;
    const [item]=manager.roster.splice(index,1);
    const refund=Math.max(0,Math.round(Number(item.quotation||player.quotation||0)));
    manager.budget=Number(manager.budget||0)+refund;
    winterLedgerFor(manager.id).releaseRefund+=refund;
    if(!state.availableIds.includes(String(item.id))) state.availableIds.push(String(item.id));
    return {managerId:manager.id,playerId:String(item.id),playerName:item.name,role:item.role,refund,source};
  }

  function processCpuWinterReleases(){
    const flow=state?.winterMarketFlow;
    if(!flow || flow.cpuReleasesProcessed) return;
    state.managers.filter(manager=>manager.id!=='user').forEach(manager=>{
      const roll=careerHash(`winter-releases|S${flow.seasonNumber}|${manager.id}`);
      const count=roll<.12?0:roll<.55?1:roll<.86?2:3;
      const candidates=(manager.roster||[]).slice().sort((a,b)=>cpuWinterReleaseScore(a,manager)-cpuWinterReleaseScore(b,manager));
      candidates.slice(0,count).forEach(player=>{
        const record=releaseWinterPlayer(manager,player,'cpu');
        if(record) flow.cpuReleases.push(record);
      });
    });
    flow.cpuReleasesProcessed=true;
  }

  function openWinterReleases(){
    const flow=ensureWinterMarketFlow();
    if(!flow||flow.stage!=='summary') return;
    flow.stage='releases';
    processCpuWinterReleases();
    saveState();
    renderWinterReleaseScreen();
  }

  function useGuaranteedWinterSale(playerId){
    const flow=state?.winterMarketFlow,season=ensureSeasonState(),me=managerById('user');
    if(!flow||flow.stage!=='releases'||!season||consumableQuantity('cons_guaranteed_sale',season)<=0) return false;
    const index=(me?.roster||[]).findIndex(item=>String(item.id)===String(playerId));
    if(index<0) return false;
    const [item]=me.roster.splice(index,1);
    const refund=Math.max(0,Math.round(Number(item.price||item.quotation||0)));
    me.budget=Number(me.budget||0)+refund;
    winterLedgerFor('user').releaseRefund+=refund;
    if(!state.availableIds.includes(String(item.id))) state.availableIds.push(String(item.id));
    if(!consumeConsumable('cons_guaranteed_sale',{day:season.currentMatchday,note:'guaranteed_winter_sale',targetPlayerId:item.id})) return false;
    flow.userReleases.push({managerId:'user',playerId:String(item.id),playerName:item.name,role:item.role,refund,source:'guaranteed_sale',paid:Number(item.price||0)});
    flow.userReleaseIds=(flow.userReleaseIds||[]).map(String).filter(id=>id!==String(item.id));
    winterGuaranteedSaleMode=false;
    saveState();
    showToast(`Cessione Garantita: ${item.name} ceduto · +${refund} crediti.`);
    renderWinterReleaseScreen();
    return true;
  }

  function toggleGuaranteedWinterSaleMode(){
    const season=ensureSeasonState();
    if(!season||consumableQuantity('cons_guaranteed_sale',season)<=0) return;
    winterGuaranteedSaleMode=!winterGuaranteedSaleMode;
    renderWinterReleaseScreen();
  }

  function renderWinterReleaseScreen(){
    const flow=ensureWinterMarketFlow();
    if(!flow) return;
    processCpuWinterReleases();
    showScreen('winterReleaseScreen');
    const me=managerById('user');
    const selected=new Set(flow.userReleaseIds||[]);
    $('winterReleaseList').innerHTML=(me?.roster||[]).slice().sort((a,b)=>ROLE_ORDER.indexOf(a.role)-ROLE_ORDER.indexOf(b.role)||Number(b.ovr||0)-Number(a.ovr||0)).map(player=>{
      const isSelected=selected.has(String(player.id));
      const stat=playerSeasonStat(player.id)||{};
      return `<button class="winter-release-player ${isSelected?'selected':''}" data-winter-release-player="${escapeHtml(String(player.id))}" type="button" aria-pressed="${isSelected}">
        <span class="lineup-role-chip role-${player.role}">${player.role}</span>
        <span class="winter-release-identity"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(clubShort(player.club))} · OVR ${playerOvrLabel(player)}</small></span>
        <span class="winter-release-value"><b>+${Math.max(0,Math.round(Number(player.quotation||0)))} cr</b><em>${isSelected?'✓ SELEZIONATO':'SVINCOLA'}</em></span>
        <span class="winter-release-stats"><span><small>PRES</small><b>${Number(stat.appearances||0)}</b></span><span><small>TIT</small><b>${Number(stat.starts||0)}</b></span><span><small>MIN</small><b>${Number(stat.minutes||0)}</b></span><span><small>GOL</small><b>${Number(stat.goals||0)}</b></span><span><small>ASSIST</small><b>${Number(stat.assists||0)}</b></span></span>
      </button>`
    }).join('');
    document.querySelectorAll('[data-winter-release-player]').forEach(button=>button.addEventListener('click',()=>{
      if(winterGuaranteedSaleMode) useGuaranteedWinterSale(button.dataset.winterReleasePlayer);
      else toggleWinterRelease(button.dataset.winterReleasePlayer);
    }));
    const refund=(me?.roster||[]).filter(player=>selected.has(String(player.id))).reduce((sum,player)=>sum+Math.max(0,Math.round(Number(player.quotation||0))),0);
    $('winterReleaseBudget').textContent=Number(me?.budget||0);
    $('winterReleaseCount').textContent=selected.size;
    $('winterReleaseRefund').textContent=`+${refund}`;
    $('winterReleaseSlots').textContent=Math.max(0,TOTAL_SLOTS-Number(me?.roster?.length||0)+selected.size);
    const guaranteedBtn=$('winterGuaranteedSaleBtn'),guaranteedQty=consumableQuantity('cons_guaranteed_sale');
    if(guaranteedBtn){
      guaranteedBtn.textContent=`💼 CESSIONE GARANTITA · ×${guaranteedQty}${winterGuaranteedSaleMode?' · SCEGLI':''}`;
      guaranteedBtn.disabled=guaranteedQty<=0;
      guaranteedBtn.classList.toggle('active',winterGuaranteedSaleMode);
    }
    if($('winterGuaranteedSaleHint')) $('winterGuaranteedSaleHint').textContent=winterGuaranteedSaleMode?'Clicca il giocatore da cedere: recupererai il prezzo pagato all’asta.':'Recupera il prezzo pagato all’asta invece della quotazione base.';
  }

  function toggleWinterRelease(playerId){
    const flow=state?.winterMarketFlow;
    if(!flow||flow.stage!=='releases') return;
    const ids=new Set(flow.userReleaseIds||[]),id=String(playerId);
    if(ids.has(id)) ids.delete(id); else ids.add(id);
    flow.userReleaseIds=[...ids];
    saveState();
    renderWinterReleaseScreen();
  }

  function confirmWinterReleases(){
    const flow=state?.winterMarketFlow;
    if(!flow||flow.stage!=='releases') return;
    const me=managerById('user');
    (flow.userReleaseIds||[]).forEach(id=>{
      const player=(me?.roster||[]).find(item=>String(item.id)===String(id));
      if(!player) return;
      const record=releaseWinterPlayer(me,player,'user');
      if(record) flow.userReleases.push(record);
    });
    flow.userReleaseIds=[];
    if(state.season?.lineups) delete state.season.lineups[String(state.season.currentMatchday||20)];
    if(state.season) state.season.assistantCoachLineup={enabled:!!state.season.assistantCoachLineup?.enabled,formation:null,starters:{},bench:[],updatedAt:Date.now(),lastSourceDay:0};
    startWinterRepairAuction();
  }

  function startWinterRepairAuction(){
    const flow=state?.winterMarketFlow;
    if(!flow) return;
    syncSerieATransferWorld(state);
    flow.stage='auction';
    flow.auctionStartedAt=Date.now();
    state.completed=false;
    state.auction=null;
    state.roleTransition=null;
    state.currentRoleIndex=0;
    if(openRoleAuction() && $('roleFilter')) $('roleFilter').value='ALL';
    state.nominationIndex=0;
    state.nominationCalls={};
    state.auctionEvents={count:0,lastPurchaseAt:-99,history:[],activeEffects:[],pending:null,relationships:state.auctionEvents?.relationships||{}};
    advanceRolePhaseIfNeeded();
    if(state.currentRoleIndex<ROLE_ORDER.length && roleSlotsRemaining(state.managers[state.nominationIndex],currentAuctionRole())<=0){
      state.nominationIndex=nextNominatorIndex(state.nominationIndex);
    }
    saveState();
    showScreen('auctionScreen');
    renderAll();
    if(state.currentRoleIndex>=ROLE_ORDER.length) return finishAuction();
    if(userCompletedCurrentRole(currentAuctionRole())) beginRoleRemainderAutoSim(currentAuctionRole());
    if(state.managers[state.nominationIndex]?.id!=='user'||autocompleteMode) scheduleNomination();
  }

  function routeWinterMarketFlow(){
    const flow=ensureWinterMarketFlow();
    if(!flow||flow.stage==='completed') return false;
    if(flow.stage==='intro') renderWinterMarketIntro();
    else if(flow.stage==='summary') renderWinterMarketSummary();
    else if(flow.stage==='releases') renderWinterReleaseScreen();
    else if(flow.stage==='trades') renderTradeWindow('winter');
    else if(flow.stage==='auction'){
      showScreen('auctionScreen');renderAll();
      if(!state.auction && state.managers[state.nominationIndex]?.id!=='user') scheduleNomination();
    }
    return true;
  }

  function showPendingWinterTransferSummary(){ return false; }
  function closeWinterTransferSummary(){ $('winterTransferModal')?.classList.add('hidden'); }

  function playerSeasonStatus(playerId){
    const season=state?.season;
    if(!season) return {injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
    ensurePlayerSeasonSystems(season);
    return season.playerStatus[String(playerId)]||{injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
  }

  function playerStatusForDay(playerId,day){
    const canonical=playerMap.get(String(playerId));
    if(canonical?.marketStatus==='abroad' || canonical?.club==='estero'){
      return {unavailable:true,type:'abroad',label:'FUORI SERIE A',className:'abroad'};
    }
    const status=playerSeasonStatus(playerId);
    const d=Number(day||state?.season?.currentMatchday||1);
    if(Number(status.injuryUntil||0)>=d){
      return {unavailable:true,type:'injury',label:`INFORTUNATO · rientro G${Number(status.injuryUntil)+1}`,className:'injured'};
    }
    if(Number(status.suspensionUntil||0)>=d){
      return {unavailable:true,type:'suspension',label:`SQUALIFICATO · rientro G${Number(status.suspensionUntil)+1}`,className:'suspended'};
    }
    return {unavailable:false,type:'available',label:'DISPONIBILE',className:'available'};
  }

  function playerFormMetrics(playerId){
    const stat=playerSeasonStat(playerId);
    const recent=(stat?.recent||[]).filter(x=>Number.isFinite(Number(x.vote))).slice(-5);
    if(!recent.length) return {count:0,avg:6,trend:0,arrow:'→',className:'neutral',score:0,recent:[]};
    const avg=recent.reduce((s,x)=>s+Number(x.vote),0)/recent.length;
    const previous=recent.length>1?recent.slice(0,-1).reduce((s,x)=>s+Number(x.vote),0)/(recent.length-1):avg;
    const trend=Number(recent[recent.length-1].vote)-previous;
    const arrow=trend>.22?'↑':trend<-.22?'↓':'→';
    const className=trend>.22?'up':trend<-.22?'down':'neutral';
    const score=clamp((avg-6)*1.45 + trend*.42,-1.6,1.6);
    return {count:recent.length,avg,trend,arrow,className,score,recent};
  }

  function qualitativeFormLabel(form){
    if(!form?.count) return 'FORMA N/D';
    if(Number(form.avg)>=6.5 || Number(form.score)>=.45) return '🔥 IN FORMA';
    if(Number(form.avg)<=5.75 || Number(form.score)<=-.55) return '⚠ IN CALO';
    if(Number(form.trend)>.22) return '↗ IN CRESCITA';
    if(Number(form.trend)<-.22) return '↘ IN CALO';
    return '→ STABILE';
  }

  function visibleFormLabel(playerId,precision=1,season=ensureSeasonState()){
    const form=playerFormMetrics(playerId);
    if(shopItemActive('fantadata_pro',season)) return form.count?`${form.arrow} ${form.avg.toFixed(precision)}`:'—';
    return qualitativeFormLabel(form);
  }

  function visibleNewsDetail(item,season=ensureSeasonState()){
    if(!item) return '';
    if(shopItemActive('fantadata_pro',season)) return String(item.detail||'');
    if((item.type==='form'||item.type==='cold') && item.playerId){
      const form=playerFormMetrics(item.playerId);
      if(item.type==='form') return `${qualitativeFormLabel(form)} · rendimento recente positivo. Dati numerici con FantaData Pro.`;
      return `${qualitativeFormLabel(form)} · rendimento recente da monitorare. Dati numerici con FantaData Pro.`;
    }
    return String(item.detail||'');
  }

  function playerAvailabilityText(playerId,day){
    return playerStatusForDay(playerId,day);
  }

  function sortedSerieAStandings(){
    const season=ensureSeasonState();
    if(!season) return [];
    ensurePlayerSeasonSystems(season);
    return sortStandings(season.serieAStandings);
  }

  function updateSerieAStandingsFromStoredMatches(season,matches){
    if(!season?.serieAStandings) return;
    applyClubMatches(season.serieAStandings,matches);
  }

  function seasonPlayerOwner(playerId){
    for(const manager of state?.managers||[]){
      const item=(manager.roster||[]).find(p=>String(p.id)===String(playerId));
      if(item) return {manager,item};
    }
    return null;
  }

  function ensureSeasonState() {
    if (!state) return null;
    if (!state.season || !state.season.started) return null;
    if (!Array.isArray(state.season.schedule) || state.season.schedule.length===0) {
      state.season.schedule = buildFantasySeasonSchedule(state.managers);
    } else if (state.season.schedule.length!==FANTASY_SEASON_MATCHDAYS) {
      // Migrazione: conserva tutte le giornate già presenti/giocate e completa il calendario fino a 38.
      state.season.schedule = buildFantasySeasonSchedule(state.managers,FANTASY_SEASON_MATCHDAYS,state.season.schedule);
    }
    if (!Array.isArray(state.season.standings) || state.season.standings.length!==state.managers.length) {
      state.season.standings = freshStandings(state.managers);
    }
    state.season.currentMatchday = clamp(Number(state.season.currentMatchday||1),1,FANTASY_SEASON_MATCHDAYS);
    if (!state.season.matchdayResults || typeof state.season.matchdayResults !== 'object') state.season.matchdayResults = {};

    // V2.7.2 migration: ricostruisce i Fantapunti totali dai risultati già giocati
    // per rendere compatibili anche i salvataggi delle versioni precedenti.
    const missingFantasyTotals = state.season.standings.some(s=>!Number.isFinite(Number(s.fantasyPoints)));
    if (missingFantasyTotals) {
      state.season.standings.forEach(s=>{ s.fantasyPoints=0; });
      Object.values(state.season.matchdayResults).forEach(dayResult=>{
        (dayResult?.matches||[]).forEach(m=>{
          const h=state.season.standings.find(s=>s.managerId===m.homeId);
          const a=state.season.standings.find(s=>s.managerId===m.awayId);
          if(h) h.fantasyPoints+=Number(m.homeFantasy||0);
          if(a) a.fantasyPoints+=Number(m.awayFantasy||0);
        });
      });
    }

    if (!state.season.lineups || typeof state.season.lineups !== 'object') state.season.lineups = {};
    if (!state.season.dashboardReadyDays || typeof state.season.dashboardReadyDays !== 'object') state.season.dashboardReadyDays = {};
    if (!state.season.matchdayFlow || typeof state.season.matchdayFlow !== 'object') state.season.matchdayFlow = {};
    if (!Array.isArray(state.season.newsFeed)) state.season.newsFeed = [];
    if (!state.season.newsGeneratedDays || typeof state.season.newsGeneratedDays !== 'object') state.season.newsGeneratedDays = {};
    if (!state.season.newsMeta || typeof state.season.newsMeta !== 'object') state.season.newsMeta = {};
    if (!Array.isArray(state.season.serieASchedule) || state.season.serieASchedule.length !== 38) state.season.serieASchedule = buildSerieASchedule();
    if (!state.season.serieAResults || typeof state.season.serieAResults !== 'object') state.season.serieAResults = {};
    if (state.season.pendingBigMatch === undefined) state.season.pendingBigMatch = null;
    if (!state.season.dayPhase) state.season.dayPhase = 'ready';
    if (!state.season.formationChoices || typeof state.season.formationChoices !== 'object') state.season.formationChoices = {};
    if (!state.season.adminRules || typeof state.season.adminRules !== 'object') state.season.adminRules = {};
    if (!state.season.opponentMalusEvents || typeof state.season.opponentMalusEvents !== 'object') state.season.opponentMalusEvents = {};
    if(!state.season.fantaclassificaActive){
      const activatedEntry=Object.values(state.season.adminRules).find(entry=>entry?.resolved && entry?.selectedOption?.effect?.ruleId==='fantaclassifica');
      if(activatedEntry){
        state.season.fantaclassificaActive=true;
        state.season.fantaclassificaActivatedDay=Number(activatedEntry.day||activatedEntry.selectedOption?.effect?.activatedDay||1);
      }
    }
    if (!state.season.shopPurchases || typeof state.season.shopPurchases !== 'object') state.season.shopPurchases = {};
    if (!state.season.consumables || typeof state.season.consumables !== 'object') state.season.consumables = {inventory:{},effects:{},usageHistory:[],purchaseHistory:[]};
    if (!state.season.consumables.inventory || typeof state.season.consumables.inventory !== 'object') state.season.consumables.inventory={};
    if (!state.season.consumables.effects || typeof state.season.consumables.effects !== 'object') state.season.consumables.effects={};
    if (!Array.isArray(state.season.consumables.usageHistory)) state.season.consumables.usageHistory=[];
    if (!Array.isArray(state.season.consumables.purchaseHistory)) state.season.consumables.purchaseHistory=[];
    if(state.season.sponsor && !state.season.sponsor.winRewards) state.season.sponsor.winRewards={};
    if (!state.season.playerOvrDevelopment || typeof state.season.playerOvrDevelopment !== 'object') state.season.playerOvrDevelopment = {};
    if (!Array.isArray(state.season.playerDevelopmentEvents)) state.season.playerDevelopmentEvents = [];
    ensureSocialState(state.season);
    if (!state.season.assistantCoachLineup || typeof state.season.assistantCoachLineup !== 'object') state.season.assistantCoachLineup = {enabled:false,formation:null,starters:{},bench:[],updatedAt:0,lastSourceDay:0};
    ensureCareerEconomy();
    ensurePlayerSeasonSystems(state.season);
    return state.season;
  }

  function startLeague() {
    if (!state || !state.completed) return;
    if(currentTradeWindow('summer').stage!=='completed') return renderTradeWindow('summer');
    const sponsorChoice=currentSponsorChoice();
    if(!state.season?.started && !sponsorChoice){
      const sponsorPanel=$('sponsorSelectionPanel');
      sponsorPanel?.scrollIntoView({behavior:'smooth',block:'start'});
      window.setTimeout(()=>{
        const firstCard=document.querySelector('#sponsorCards [data-sponsor-card]');
        firstCard?.focus({preventScroll:true});
      },420);
      return;
    }
    if(!state.season?.started && sponsorChoice?.id==='academy'){
      const chosenId=String(state.sponsorChoice?.playerId||'');
      const player=state.managers?.[0]?.roster?.find(p=>String(p.id)===chosenId && Number(p.ovr||0)<=97);
      if(!player){showToast('Ala Romelu: scegli un giocatore prima di iniziare il campionato.',true);return;}
    }
    if (!state.season?.started) {
      state.season = {
        started:true,
        createdAt:Date.now(),
        currentMatchday:1,
        schedule:buildFantasySeasonSchedule(state.managers),
        standings:freshStandings(state.managers),
        lineups:{},
        dashboardReadyDays:{},
        matchdayFlow:{},
        newsFeed:[],
        newsGeneratedDays:{},
        newsMeta:{},
        matchdayResults:{},
        serieASchedule:buildSerieASchedule(),
        serieAResults:{},
        serieAStandings:freshSerieAStandings(),
        playerSeasonStats:{},
        playerStatus:{},
        simDataUpdatedDays:{},
        formationChoices:{},
        adminRules:{},
        opponentMalusEvents:{},
        fantaclassificaActive:false,
        fantaclassificaActivatedDay:0,
        shopPurchases:{},
        consumables:{inventory:{...(state.carryoverConsumables||{})},effects:{},usageHistory:[],purchaseHistory:[]},
        sponsor:seasonSponsorFromChoice(sponsorChoice),
        playerOvrDevelopment:{},
        playerDevelopmentEvents:[],
        social:{conversations:{},motivationByDay:{},activity:[]},
        assistantCoachLineup:{enabled:false,formation:null,starters:{},bench:[],updatedAt:0,lastSourceDay:0},
        pendingBigMatch:null,
        dayPhase:'ready'
      };
      const immediateSponsorBonus=grantImmediateSponsorBonus(state.season);
      if(state.season.sponsor?.id==='academy'){
        const player=state.managers[0].roster.find(p=>String(p.id)===String(state.season.sponsor.playerId));
        if(player){
          const growth=applyPlayerOvrChange(player,2,1,'Ala Romelu: crescita garantita','sponsor_academy');
          state.season.sponsor.academyGrowthGranted=!!growth;
          state.season.sponsor.academyPlayerName=player.name;
        }
      }
      delete state.carryoverConsumables;
      saveState();
      if(immediateSponsorBonus) showToast(`Sponsor ${state.season.sponsor?.name||''}: +${immediateSponsorBonus} € immediati.`);
    }
    renderSeasonDashboard();
  }


  function ensureMatchdayFlowEntry(season,day){
    if(!season || !day) return null;
    if(!season.matchdayFlow || typeof season.matchdayFlow!=='object') season.matchdayFlow={};
    const key=String(day);
    let entry=season.matchdayFlow[key];
    if(!entry || typeof entry!=='object'){
      let phase='lineup';
      if(season.matchdayResults?.[key]) phase='completed';
      else if(season.pendingBigMatch?.day===day || season.activeLive?.day===day) phase='live';
      else {
        if(hasPendingMatchdayEvent(day,season)) phase='event_pending';
        else if(season.dashboardReadyDays?.[key]) phase='match_ready';
      }
      entry={day,phase,updatedAt:Date.now()};
      season.matchdayFlow[key]=entry;
    }
    if(season.matchdayResults?.[key]) entry.phase='completed';
    else if(season.pendingBigMatch?.day===day || season.activeLive?.day===day) entry.phase='live';
    else if(hasPendingMatchdayEvent(day,season)) entry.phase='event_pending';
    return entry;
  }

  function setMatchdayFlowPhase(season,day,phase,extra={}){
    const entry=ensureMatchdayFlowEntry(season,day);
    if(!entry) return null;
    entry.phase=phase;
    entry.updatedAt=Date.now();
    Object.assign(entry,extra||{});
    // Compatibilità con i salvataggi V3.2.7: questa mappa resta sincronizzata,
    // ma la fonte autorevole dalla V3.2.8 è matchdayFlow.
    if(!season.dashboardReadyDays || typeof season.dashboardReadyDays!=='object') season.dashboardReadyDays={};
    season.dashboardReadyDays[String(day)]=['match_ready','live','completed'].includes(phase);
    return entry;
  }

  function currentMatchdayFlow(season=ensureSeasonState()){
    return season ? ensureMatchdayFlowEntry(season,season.currentMatchday||1) : null;
  }

  function fantaclassificaIsActive(season=state?.season){
    return !!season?.fantaclassificaActive;
  }

  function sortFantasyLeagueStandings(rows,season=state?.season){
    if(!fantaclassificaIsActive(season)) return sortStandings(rows);
    return (rows||[]).slice().sort((a,b)=>{
      const fantasyDelta=Number(b.fantasyPoints||0)-Number(a.fantasyPoints||0);
      if(Math.abs(fantasyDelta)>.0001) return fantasyDelta;
      const gfDelta=Number(b.gf||0)-Number(a.gf||0);
      if(gfDelta) return gfDelta;
      const gdA=Number(a.gf||0)-Number(a.ga||0), gdB=Number(b.gf||0)-Number(b.ga||0);
      if(gdB!==gdA) return gdB-gdA;
      return Number(a.seed||0)-Number(b.seed||0);
    });
  }

  function sortedStandings() {
    const season = ensureSeasonState();
    if (!season) return [];
    return sortFantasyLeagueStandings(season.standings,season);
  }


  let leagueStandingsSort={key:'position',direction:'asc'};
  const LEAGUE_STANDINGS_DEFAULT_DIRECTION={
    position:'asc',team:'asc',played:'desc',points:'desc',fantasyPoints:'desc',
    wins:'desc',draws:'desc',losses:'asc',gf:'desc',ga:'asc',gd:'desc'
  };

  function sortedFullStandingsForView(){
    const canonical=sortedStandings();
    const positions=new Map(canonical.map((row,index)=>[String(row.managerId),index+1]));
    const rows=canonical.map(row=>({...row,_leaguePosition:positions.get(String(row.managerId))||999}));
    const {key,direction}=leagueStandingsSort;
    const dir=direction==='asc'?1:-1;
    const value=(row)=>{
      if(key==='position') return Number(row._leaguePosition||999);
      if(key==='team') return String(managerById(row.managerId)?.team||'').toLocaleLowerCase('it');
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
      const active=btn.dataset.standingsSort===leagueStandingsSort.key;
      btn.classList.toggle('active',active);
      const arrow=btn.querySelector('span');
      if(arrow) arrow.textContent=active?(leagueStandingsSort.direction==='asc'?'▲':'▼'):'';
      btn.setAttribute('aria-pressed',String(active));
    });
  }

  function setLeagueStandingsSort(key){
    if(!Object.prototype.hasOwnProperty.call(LEAGUE_STANDINGS_DEFAULT_DIRECTION,key)) return;
    if(leagueStandingsSort.key===key){
      leagueStandingsSort.direction=leagueStandingsSort.direction==='asc'?'desc':'asc';
    }else{
      leagueStandingsSort={key,direction:LEAGUE_STANDINGS_DEFAULT_DIRECTION[key]};
    }
    if($('fullStandingsBody')) $('fullStandingsBody').innerHTML=fullStandingsRowsHtml();
    renderFullStandingsSortState();
  }

  function managerById(id) { return state?.managers?.find(m=>m.id===id) || null; }

  function currentUserFixture() {
    const season = ensureSeasonState();
    if (!season) return null;
    const round = season.schedule[season.currentMatchday-1];
    return round?.matches?.find(m=>m.homeId==='user' || m.awayId==='user') || null;
  }


  function userOpponentIdForDay(day=ensureSeasonState()?.currentMatchday){
    const season=ensureSeasonState();
    if(!season || !Number(day)) return null;
    const round=season.schedule?.[Number(day)-1];
    const fixture=round?.matches?.find(m=>m.homeId==='user' || m.awayId==='user');
    if(!fixture) return null;
    return fixture.homeId==='user' ? fixture.awayId : fixture.homeId;
  }

  function cpuFormationForDay(manager,day=ensureSeasonState()?.currentMatchday){
    const forced=forcedFormationRuleForDay(day);
    if(forced && (forced==='5-5-5' || String(manager?.id||'')===String(userOpponentIdForDay(day)||''))) return forced;
    return chooseCpuFormation(manager);
  }

  function pendingBigMatchContext(){
    const season=ensureSeasonState();
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
    const perf=currentFantasyPerformance(player,ctx.perfMap,90);
    return {...perf,pending:false};
  }

  function pendingPartialFantasySnapshot(managerId){
    const ctx=pendingBigMatchContext();
    const manager=managerById(managerId);
    const saved=ctx?.snap?.lineups?.[managerId] || ctx?.season?.lineups?.[String(ctx?.season?.currentMatchday||1)]?.[managerId];
    if(!ctx || !manager || !saved) return null;

    const players=lineupPlayersForManager(manager,saved);
    const performances=players.map(player=>pendingPartialPerformance(player,ctx)).filter(Boolean);
    if(managerId==='user') performances.forEach(perf=>{
      if(perf.pending || perf.noVote) return;
      const riskDelta=riskAdjustmentForPerformance(perf,ctx.pending.day);
      perf.riskDelta=riskDelta;
      perf.fantasy=halfPoint(perf.fantasy+riskDelta);
    });
    const fantasyPoints=halfPoint(performances.reduce((sum,p)=>sum+(p.pending?0:Number(p.fantasy||0)),0));
    return {
      managerId,manager,saved,performances,fantasyPoints,
      pendingCount:performances.filter(p=>p.pending).length,
      votedCount:performances.filter(p=>!p.pending&&!p.noVote).length,
      noVoteCount:performances.filter(p=>!p.pending&&p.noVote).length
    };
  }

  function pendingPartialPlayerInfo(player){
    const ctx=lineupPartialContext?.ctx || pendingBigMatchContext();
    if(!ctx || !player) return null;
    const p=pendingPartialPerformance(player,ctx);
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
    const player=playerMap.get(String(playerId)) || (window.FANTA_PLAYERS||[]).find(p=>String(p.id)===String(playerId));
    if(!player) return;
    const season=ensureSeasonState();
    const stat=playerSeasonStat(player.id) || emptyPlayerSeasonStat(player);
    const form=playerFormMetrics(player.id);
    const availability=playerStatusForDay(player.id,season?.currentMatchday||1);
    const owner=seasonPlayerOwner(player.id);

    $('seasonPlayerName').textContent=player.name;
    $('seasonPlayerClub').textContent=clubName(player.club);
    if($('seasonPlayerAvatar')) $('seasonPlayerAvatar').innerHTML=playerAvatarMarkup(player,player.name);
    const modalFixture=serieAFixtureForPlayer(player,season?.currentMatchday||1);
    const modalDataPro=shopItemActive('fantadata_pro',season);
    const modalDifficulty=modalDataPro?serieAMatchupDifficulty(player,season?.currentMatchday||1):null;
    $('seasonPlayerMeta').textContent=`${ROLE_LABELS[player.role]||player.role} · OVR ${playerOvrLabel(player)}${owner?` · ${owner.manager.team} · ${Number(owner.item.price||0)} cr`:''}${modalFixture?` · vs ${modalFixture.opponentName} · ${modalFixture.venue}`:''}${modalDifficulty?` · ${modalDifficulty.icon} ${modalDifficulty.label}`:''}`;

    const statusEl=$('seasonPlayerStatus');
    statusEl.textContent=availability.label;
    statusEl.className=`season-player-status ${availability.className}`;

    const dataPro=shopItemActive('fantadata_pro',season);
    const scoutPlus=shopItemActive('scout_plus',season);
    $('seasonPlayerStatsGrid').innerHTML=seasonPlayerStatCards(stat,dataPro).map(([label,value,locked])=>`
      <div class="season-player-stat ${locked?'is-premium-locked':''}"><strong>${escapeHtml(String(value))}</strong><span>${label}</span></div>
    `).join('');

    if(dataPro){
      $('seasonPlayerFormBadge').textContent=`${form.arrow} ${form.count?form.avg.toFixed(2):'—'}`;
      $('seasonPlayerFormBadge').className=`player-form-badge ${form.className}`;
      $('seasonPlayerFormTitle').textContent=form.count?`Ultime ${form.count} prestazioni`:'Nessun voto ancora';
      $('seasonPlayerFormRows').innerHTML=form.recent.length
        ? form.recent.slice().reverse().map(x=>`<div class="season-player-form-row"><span>G${x.day}</span><strong>V ${Number(x.vote).toFixed(1)}</strong><b>FV ${Number(x.fantasy).toFixed(1)}</b></div>`).join('')
        : '<div class="season-player-form-empty">Le statistiche inizieranno dopo la prima presenza con voto.</div>';
    } else {
      $('seasonPlayerFormBadge').textContent='🔒 PRO';
      $('seasonPlayerFormBadge').className='player-form-badge neutral premium-locked';
      $('seasonPlayerFormTitle').textContent='Forma dettagliata · FantaData Pro';
      $('seasonPlayerFormRows').innerHTML='<div class="season-player-form-empty premium-data-lock">🔒 Media voto, fantamedia e andamento recente sono disponibili con <b>FantaData Pro</b> nel Negozio.</div>';
    }
    if($('seasonPlayerStarterEstimate')){
      $('seasonPlayerStarterEstimate').innerHTML=scoutPlus
        ? `<span>PROBABILITÀ TITOLARITÀ</span><strong>${estimatedStarterProbability(player)}%</strong><small>Stima Scout Plus · non è una certezza</small>`
        : '<span>PROBABILITÀ TITOLARITÀ</span><strong>🔒</strong><small>Sblocca Scout Plus nel Negozio</small>';
      $('seasonPlayerStarterEstimate').classList.toggle('is-locked',!scoutPlus);
    }

    if($('seasonPlayerEvolutionRows')){
      const evo=evolutionPlayerData(player,season);
      const direction=evo.delta>0?'positive':evo.delta<0?'negative':'neutral';
      $('seasonPlayerEvolutionTitle').textContent=`OVR ${evo.base} → ${evo.current}`;
      $('seasonPlayerEvolutionBadge').textContent=`${evo.delta>0?'+':''}${evo.delta}`;
      $('seasonPlayerEvolutionBadge').className=`player-form-badge ${direction}`;
      const history=evo.history.slice(-4).reverse();
      $('seasonPlayerEvolutionRows').innerHTML=history.length
        ? history.map(ev=>`<div class="season-player-evolution-row"><span>G${ev.day}</span><strong>${ev.before} → ${ev.after}</strong><b class="${ev.change>0?'positive':'negative'}">${ev.change>0?'+':''}${ev.change}</b><small>${escapeHtml(ev.reason)}</small></div>`).join('')
        : '<div class="season-player-form-empty">Nessuna variazione OVR registrata in questa stagione.</div>';
    }

    const modal=$('seasonPlayerModal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
  }

  function closeSeasonPlayerModal(){
    const modal=$('seasonPlayerModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
  }

  function wireSeasonPlayerButtons(root=document){
    root.querySelectorAll('[data-season-player]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(btn.closest?.('#seasonNewsModal')) closeSeasonNewsArchive();
        renderSeasonPlayerModal(btn.dataset.seasonPlayer);
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
    applyGameConfiguration();
  }

  function fullStandingsRowsHtml(){
    const standings=sortedFullStandingsForView();
    return standings.map(s=>{
      const m=managerById(s.managerId), gd=s.gf-s.ga;
      const rowClasses=[s.managerId==='user'?'is-user-standing':'',Number(s._leaguePosition)===1?'is-promotion-standing':''].filter(Boolean).join(' ');
      return `<tr class="${rowClasses}">
        <td>${s._leaguePosition}</td>
        <td><strong>${escapeHtml(m?.team||'—')}</strong><small>${escapeHtml(m?.name||'')}</small></td>
        <td>${s.played}</td>
        <td class="pts">${s.points}</td>
        <td class="fantasy-total">${Number(s.fantasyPoints||0).toFixed(1)}</td>
        <td>${s.wins}</td><td>${s.draws}</td><td>${s.losses}</td>
        <td>${s.gf}</td><td>${s.ga}</td><td>${gd>0?'+':''}${gd}</td>
      </tr>`;
    }).join('');
  }

  function fullScheduleHtml(){
    const season=ensureSeasonState();
    if(!season) return '';
    const day=season.currentMatchday;
    return season.schedule.map(r => {
      const hasResult=!!season.matchdayResults?.[String(r.number)];
      return `<article class="schedule-round ${r.number===day?'current-round':''} ${hasResult?'played-round':''}">
        <div class="schedule-round-head"><strong>G${r.number}</strong><span>${escapeHtml(r.label||'STAGIONE')}</span></div>
        <div class="schedule-round-matches">${r.matches.map(m=>{
          const h=managerById(m.homeId),a=managerById(m.awayId), user=m.homeId==='user'||m.awayId==='user';
          return `<div class="schedule-mini-match ${user?'user-mini-match':''}">
            <span>${escapeHtml(h?.team||'—')}</span>
            <b>${m.played?`${m.homeScore}-${m.awayScore}`:'vs'}</b>
            <span>${escapeHtml(a?.team||'—')}</span>
          </div>`;
        }).join('')}</div>
        ${hasResult?`<button type="button" class="calendar-results-open" data-calendar-results="${r.number}">VEDI RISULTATI</button>`:''}
      </article>`;
    }).join('');
  }

  function renderCalendarDayResults(day){
    const season=ensureSeasonState();
    const result=season?.matchdayResults?.[String(day)];
    const panel=$('calendarResultsPanel');
    if(!panel) return;
    if(!result){
      panel.style.display='none';
      return;
    }
    panel.style.display='';
    $('calendarResultsTitle').textContent=`Giornata ${day}`;
    $('calendarResultsBadge').textContent='CONCLUSA';
    $('calendarResultsList').innerHTML=(result.matches||[]).map(m=>`
      <div class="calendar-result-row ${m.homeId==='user'||m.awayId==='user'?'is-user-result':''}">
        <div><strong>${escapeHtml(m.homeTeam)}</strong><small>${Number(m.homeFantasy||0).toFixed(1)} FP</small></div>
        <b>${m.homeScore} - ${m.awayScore}</b>
        <div><strong>${escapeHtml(m.awayTeam)}</strong><small>${Number(m.awayFantasy||0).toFixed(1)} FP</small></div>
      </div>
    `).join('');
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function leagueFullRosterHtml(manager){
    if(!manager) return '';
    const roster=Array.isArray(manager.roster)?manager.roster:[];
    const roleBlocks=ROLE_ORDER.map(role=>{
      const items=roster.filter(p=>p.role===role).slice().sort((a,b)=>currentPlayerOvr(b)-currentPlayerOvr(a) || String(a.name).localeCompare(String(b.name),'it'));
      return `<section class="league-modal-role role-${role}">
        <header><strong>${escapeHtml(role)}</strong><span>${items.length}/${ROLE_LIMITS[role]}</span></header>
        <div class="league-modal-player-list">${items.map(p=>`<button type="button" class="league-modal-player season-player-open" data-season-player="${escapeHtml(String(p.id))}"><span class="lineup-role-chip role-${p.role}">${p.role}</span><span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(clubName(p.club))} · OVR ${playerOvrLabel(p)}</small></span><b>${Number(p.price||0)} cr</b></button>`).join('')}</div>
      </section>`;
    }).join('');
    const spent=roster.reduce((sum,p)=>sum+Number(p.price||0),0);
    const avg=roster.length?(roster.reduce((sum,p)=>sum+currentPlayerOvr(p),0)/roster.length).toFixed(1):'—';
    return `<div class="league-modal-summary"><div><span>GIOCATORI</span><strong>${roster.length}</strong></div><div><span>SPESA</span><strong>${spent}</strong></div><div><span>OVR MEDIO</span><strong>${avg}</strong></div><div><span>CREDITI</span><strong>${Number(manager.budget||0)}</strong></div></div><div class="league-modal-roles">${roleBlocks}</div>`;
  }

  function openLeagueRosterModal(managerId){
    const modal=$('leagueRosterModal');
    const manager=managerById(managerId);
    if(!modal || !manager) return;
    $('leagueRosterModalTitle').textContent=manager.team||'Squadra';
    $('leagueRosterModalSubtitle').textContent=manager.id==='user' ? `${state.managerName||'Mister'} · ${manager.roster?.length||0} giocatori` : `${manager.name||'CPU'} · ${manager.profile?.label||'CPU'} · ${manager.roster?.length||0} giocatori`;
    $('leagueRosterModalBody').innerHTML=leagueFullRosterHtml(manager);
    wireSeasonPlayerButtons($('leagueRosterModalBody'));
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
  }

  function closeLeagueRosterModal(){
    const modal=$('leagueRosterModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
  }

  function buildLeagueTopXICards(){
    if(!state?.managers?.length) return '';
    return state.managers.map(m=>{
      const personality=m.id==='user' ? `${escapeHtml(state.managerName||'Tu')} · TU` : escapeHtml(m.profile?.label||m.name||'CPU');
      return `<article class="league-topxi-card ${m.id==='user'?'is-user':''}">
        <header class="league-topxi-head">
          <div><span class="manager-online-dot"></span><button type="button" class="league-topxi-team-name" data-open-team-roster="${escapeHtml(String(m.id))}" title="Apri rosa completa di ${escapeHtml(m.team)}">${escapeHtml(m.team)}</button><small>${personality}</small></div>
          <span class="league-topxi-open-hint">ROSA ↗</span>
        </header>
        ${bestXIHtml(m)}
      </article>`;
    }).join('');
  }

  function wireLeagueTopXICards(root){
    if(!root) return;
    root.querySelectorAll('[data-open-team-roster]').forEach(btn=>btn.addEventListener('click',()=>openLeagueRosterModal(btn.dataset.openTeamRoster)));
    wireSeasonPlayerButtons(root);
  }

  function renderLeagueRostersScreen(){
    stopHubNewsCarousel();
    const season=ensureSeasonState();
    if(!season) return renderSummary();
    showScreen('leagueRostersScreen');
    renderLeagueNavActive('rosters');
    renderCareerWallets();
    const grid=$('leagueRostersGrid');
    if(grid){
      grid.innerHTML=buildLeagueTopXICards();
      wireLeagueTopXICards(grid);
    }
  }

  function renderLeagueCalendarScreen(){
    stopHubNewsCarousel();
    const season=ensureSeasonState();
    if(!season) return renderSummary();
    showScreen('leagueCalendarScreen');
    renderLeagueNavActive('dashboard');
    renderCareerWallets();
    if($('leagueFullSchedule')){
      $('leagueFullSchedule').innerHTML=fullScheduleHtml();
      $('leagueFullSchedule').querySelectorAll('[data-calendar-results]').forEach(btn=>btn.addEventListener('click',()=>renderCalendarDayResults(Number(btn.dataset.calendarResults))));
    }
    const latest=Number(season.lastCompletedMatchday||0);
    if(latest>0) renderCalendarDayResults(latest);
    else if($('calendarResultsPanel')) $('calendarResultsPanel').style.display='none';
  }

  function renderCareerHonours(){
    const career=ensureCareerEconomy();
    const seasons=[...(career?.seasonHistory||[])];
    const current=state?.season;
    const seasonNumber=Number(career?.seasonNumber||1);
    if(current?.completed && !seasons.some(entry=>Number(entry.seasonNumber)===seasonNumber)){
      seasons.push({seasonNumber,divisionLabel:careerDivisionLabel(career.division),position:completedSeasonUserPosition(current),personalRecap:completedUserSeasonRecap(current)});
    }
    const trophies=seasons.filter(entry=>Number(entry.position)===1);
    const categories=[
      {icon:'⚽',label:'MIGLIOR CAPOCANNONIERE',key:'scorer',field:'goals',suffix:'gol'},
      {icon:'👟',label:'MIGLIOR ASSIST MAN',key:'assister',field:'assists',suffix:'assist'},
      {icon:'⭐',label:'MIGLIOR MEDIA VOTO',key:'topVote',field:'avgVote',suffix:'media voto'},
      {icon:'🔥',label:'MIGLIOR FANTAMEDIA',key:'topFantasy',field:'avgFantasy',suffix:'fantamedia'}
    ];
    const card=(icon,label,value,detail)=>`<article class="career-honours-card"><span aria-hidden="true">${icon}</span><small>${label}</small><strong>${escapeHtml(value)}</strong><p>${escapeHtml(detail)}</p></article>`;
    const trophyDetail=trophies.length?trophies.map(entry=>`${entry.divisionLabel||careerDivisionLabel(entry.division)} · stagione ${entry.seasonNumber}`).join(' · '):'Nessun titolo conquistato';
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
    if($('careerHonoursGrid')) $('careerHonoursGrid').innerHTML=card('🏆','TROFEI VINTI',String(trophies.length),trophyDetail)+records.join('')+
      card('🔨','PIÙ VOLTE PRESO ALL’ASTA',mostPicked?.name||'—',mostPicked?`${mostPicked.count} acquist${mostPicked.count===1?'o':'i'} all’asta`:'Gli acquisti vengono registrati da questa versione');
  }

  function openCareerHonours(){
    renderLeagueStandingsScreen();
    $('careerHonoursPanel')?.classList.remove('hidden');
    $('openCareerHonoursBtn')?.setAttribute('aria-expanded','true');
    $('careerHonoursPanel')?.scrollIntoView({block:'start',behavior:'smooth'});
  }

  function renderLeagueStandingsScreen(){
    stopHubNewsCarousel();
    const season=ensureSeasonState();
    if(!season) return renderSummary();
    showScreen('leagueStandingsScreen');
    renderLeagueNavActive('standings');
    renderCareerWallets();
    const me=sortedStandings().find(x=>x.managerId==='user')||season.standings[0];
    if($('fullStandingsTitle')) $('fullStandingsTitle').textContent=fantaclassificaIsActive(season)?`Fantaclassifica · dopo ${me?.played||0} giornate`:`Dopo ${me?.played||0} giornate`;
    if($('fullStandingsModeChip')) $('fullStandingsModeChip').textContent=fantaclassificaIsActive(season)?'🏆 FANTACLASSIFICA ATTIVA · ORDINE PER FPT':'FPT = FANTAPUNTI TOTALI';
    if($('fullStandingsBody')) $('fullStandingsBody').innerHTML=fullStandingsRowsHtml();
    if($('fantasyPromotionNote')) $('fantasyPromotionNote').textContent=careerPromotionNote();
    renderCareerHonours();
    document.querySelectorAll('#leagueStandingsScreen [data-standings-sort]').forEach(btn=>{
      btn.onclick=()=>setLeagueStandingsSort(btn.dataset.standingsSort);
    });
    renderFullStandingsSortState();

    const serieA=sortedSerieAStandings();
    const serieADays=serieA[0]?.played||0;
    if($('serieAStandingsTitle')) $('serieAStandingsTitle').textContent=`Dopo ${serieADays} giornate`;
    if($('serieAStandingsBody')) $('serieAStandingsBody').innerHTML=serieA.map((s,i)=>{
      const gd=s.gf-s.ga;
      return `<tr><td>${i+1}</td><td><strong>${escapeHtml(clubName(s.clubId))}</strong></td><td>${s.played}</td><td class="pts">${s.points}</td><td>${s.wins}</td><td>${s.draws}</td><td>${s.losses}</td><td>${s.gf}</td><td>${s.ga}</td><td>${gd>0?'+':''}${gd}</td></tr>`;
    }).join('');

    const playerStats=Object.values(season.playerSeasonStats||{});
    const leaderRows=(key)=>{
      const sorted=playerStats.filter(s=>Number(s[key]||0)>0).sort((a,b)=>Number(b[key]||0)-Number(a[key]||0) || Number(b.fantasySum||0)-Number(a.fantasySum||0)).slice(0,10);
      return sorted.length?sorted.map((s,i)=>{
        const player=playerMap.get(String(s.playerId)) || (window.FANTA_PLAYERS||[]).find(p=>String(p.id)===String(s.playerId)) || {id:s.playerId,name:s.name,club:s.club};
        return `<button type="button" class="season-leader-row" data-season-player="${escapeHtml(s.playerId)}"><span>${i+1}</span><i class="season-leader-face" aria-hidden="true">${playerAvatarMarkup(player,s.name)}</i><div><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(clubShort(s.club))} · ${escapeHtml(visibleFormLabel(s.playerId,1,season))}</small></div><b>${Number(s[key]||0)}</b></button>`;
      }).join(''):'<div class="season-leader-empty">Nessun dato ancora.</div>';
    };
    if($('topScorersList')) $('topScorersList').innerHTML=leaderRows('goals');
    if($('topAssistsList')) $('topAssistsList').innerHTML=leaderRows('assists');
    wireSeasonPlayerButtons($('leagueStandingsScreen'));
  }

  function ensureCareerEconomy(){
    if(!state) return null;
    state.career=CareerEngine.normalizeCareer(state.career,CAREER_STARTING_EUROS,GAME_CONFIG.startingDivision);
    return state.career;
  }

  function sponsorVisualAsset(id){
    return ({
      win_bonus:'assets/sponsors/lavezzi.webp',
      free_subscription:'assets/sponsors/cobocolo.webp',
      future_auction:'assets/sponsors/burgerkane.webp',
      bonus_firma:'assets/sponsors/amauri.webp',
      big_match:'assets/sponsors/netoflix.webp',
      streak_bonus:'assets/sponsors/adibala.webp',
      academy:'assets/sponsors/ala-romelu.webp',
      fantasy_bonus:'assets/sponsors/mctominasy.webp',
      fantacana:'assets/sponsors/haaland-rover.webp'
    })[String(id)] || 'assets/sponsors/lavezzi.webp';
  }

  function sponsorVisualBrand(id){
    return ({
      win_bonus:'LAVEZZI',
      free_subscription:'CoboColo',
      future_auction:'Burger Kane',
      bonus_firma:'Amauri',
      big_match:'Netoflix',
      streak_bonus:'Adibala',
      academy:'Ala Romelu',fantasy_bonus:'McTominasy’s',fantacana:'Haaland Rover'
    })[String(id)] || 'Sponsor';
  }

  function currentSponsorChoice(){
    const id=String(state?.sponsorChoice?.id||state?.sponsorChoice||'');
    return SEASON_SPONSORS[id]||null;
  }

  function currentSponsorOffers(){
    if(!state) return Object.values(SEASON_SPONSORS).slice(0,3);
    const allIds=Object.keys(SEASON_SPONSORS);
    let changed=false;
    if(!Array.isArray(state.sponsorOfferIds)){
      state.sponsorOfferIds=[];
      changed=true;
    }
    const ids=state.sponsorOfferIds.map(id=>String(id)).filter((id,index,list)=>SEASON_SPONSORS[id] && list.indexOf(id)===index);
    if(ids.length!==state.sponsorOfferIds.length) changed=true;
    const missing=shuffledCopy(allIds).filter(id=>!ids.includes(id));
    while(ids.length<3 && missing.length){
      ids.push(missing.shift());
      changed=true;
    }
    state.sponsorOfferIds=ids.slice(0,3);
    if(changed) saveState();
    return state.sponsorOfferIds.map(id=>SEASON_SPONSORS[id]).filter(Boolean);
  }

  function selectSeasonSponsor(id){
    if(!state || state.season?.started) return;
    const sponsor=SEASON_SPONSORS[String(id)];
    if(!sponsor) return;
    state.sponsorChoice={id:sponsor.id,selectedAt:Date.now()};
    saveState();
    renderSponsorSelection();
    showToast(`${sponsor.name}: accordo selezionato.`);
  }

  function selectAcademySponsorPlayer(id){
    if(state?.season?.started || state?.sponsorChoice?.id!=='academy') return;
    const player=state.managers?.[0]?.roster?.find(p=>String(p.id)===String(id) && Number(p.ovr||0)<=97);
    state.sponsorChoice.playerId=player?String(player.id):null;
    saveState();
    renderSponsorSelection();
  }

  function renderSponsorSelection(){
    const panel=$('sponsorSelectionPanel'),grid=$('sponsorCards'),summary=$('sponsorChosenSummary'),startBtn=$('startLeagueBtn');
    if(!panel || !grid) return;
    const selected=currentSponsorChoice();
    const sponsorOffers=currentSponsorOffers();
    grid.innerHTML=sponsorOffers.map((s,index)=>{
      const art=sponsorVisualAsset(s.id);
      const brand=sponsorVisualBrand(s.id);
      return `<div class="sponsor-card-stage ${selected?.id===s.id?'selected':''}">
        <div class="sponsor-card-blur" aria-hidden="true"><img src="${art}" alt=""></div>
        <article class="sponsor-flip-card ${selected?.id===s.id?'selected is-flipped':''}" data-sponsor-card="${escapeHtml(s.id)}" tabindex="0" role="button" aria-label="Carta sponsor ${escapeHtml(s.name)}. Clicca per girare.">
          <div class="sponsor-flip-inner">
            <section class="sponsor-card-face sponsor-card-front">
              <img class="sponsor-card-cover" src="${art}" alt="Sponsor ${escapeHtml(brand)}">
              <span class="sponsor-card-index">0${index+1}</span>
              <div class="sponsor-card-front-footer">
                <span class="sponsor-card-front-category">SPONSOR</span>
                <span class="sponsor-card-front-brand">${escapeHtml(brand)}</span>
                <button type="button" class="sponsor-card-flip-btn" data-sponsor-flip="${escapeHtml(s.id)}">GIRA ↻</button>
              </div>
            </section>
            <section class="sponsor-card-face sponsor-card-back">
              <div class="sponsor-card-back-top">
                <span class="sponsor-choice-icon">${s.icon}</span>
                <span class="sponsor-choice-category">${escapeHtml(s.name)}</span>
                <span class="sponsor-card-badge">CONTRATTO</span>
              </div>
              <div class="sponsor-card-back-copy">
                <strong>${escapeHtml(s.title)}</strong>
                <small>${escapeHtml(s.description)}</small>
              </div>
              <div class="sponsor-card-back-footer">
                <button type="button" class="sponsor-card-flip-back-btn" data-sponsor-flip="${escapeHtml(s.id)}">↺ RIGIRA</button>
                <button type="button" class="sponsor-card-select-btn" data-sponsor-id="${escapeHtml(s.id)}" ${selected?.id===s.id?'disabled':''}>${selected?.id===s.id?'✓ FIRMATO':'FIRMA ✓'}</button>
              </div>
            </section>
          </div>
        </article>
      </div>`;
    }).join('');

    const toggleCard=(id)=>{
      const card=grid.querySelector(`[data-sponsor-card="${CSS.escape(String(id))}"]`);
      if(!card) return;
      const flipped=card.classList.toggle('is-flipped');
      card.setAttribute('aria-label',flipped?'Carta sponsor girata. Leggi l’offerta o firma il contratto.':'Carta sponsor coperta. Clicca per girare.');
    };

    // Un solo gestore per evitare conflitti tra flip 3D e pulsante FIRMA.
    // FIRMA ha sempre priorità: se il click nasce lì, la carta NON gira.
    grid.onclick=(e)=>{
      const signBtn=e.target.closest('[data-sponsor-id]');
      if(signBtn && grid.contains(signBtn)){
        e.preventDefault();
        e.stopPropagation();
        if(signBtn.disabled) return;
        const sponsorId=signBtn.dataset.sponsorId;
        signBtn.disabled=true;
        signBtn.textContent='FIRMATO ✓';
        selectSeasonSponsor(sponsorId);
        return;
      }

      const card=e.target.closest('[data-sponsor-card]');
      if(!card || !grid.contains(card)) return;

      // Qualunque altro punto della carta, compresi GIRA e RIGIRA, esegue il flip.
      e.preventDefault();
      toggleCard(card.dataset.sponsorCard);
    };

    grid.onkeydown=(e)=>{
      if(e.target.closest('[data-sponsor-id]')) return;
      const card=e.target.closest('[data-sponsor-card]');
      if(!card || !grid.contains(card)) return;
      if((e.key==='Enter' || e.key===' ') && !e.target.closest('button')){
        e.preventDefault();
        toggleCard(card.dataset.sponsorCard);
      }
    };

    if(summary) summary.innerHTML=selected
      ? `<span>SPONSOR SCELTO</span><strong>${selected.icon} ${escapeHtml(selected.name)}</strong><small>${escapeHtml(selected.title)}</small>${selected.id==='academy'?`<label class="sponsor-academy-label" for="sponsorAcademyPlayer">Giocatore da far crescere</label><select id="sponsorAcademyPlayer"><option value="">Scegli un giocatore</option>${(state.managers?.[0]?.roster||[]).filter(p=>Number(p.ovr||0)<=97).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'it')).map(p=>`<option value="${escapeHtml(p.id)}" ${String(state.sponsorChoice?.playerId||'')===String(p.id)?'selected':''}>${escapeHtml(p.name)} · ${p.role} · OVR ${p.ovr}</option>`).join('')}</select>`:''}`
      : '<span>SPONSOR</span><strong>Gira una delle 3 carte disponibili e scegli il contratto stagionale.</strong>';
    summary?.querySelector('#sponsorAcademyPlayer')?.addEventListener('change',event=>selectAcademySponsorPlayer(event.target.value));
    if(startBtn){
      startBtn.disabled=false;
      startBtn.textContent=selected?'INIZIA CAMPIONATO':'SCEGLI UNO SPONSOR';
      startBtn.classList.toggle('sponsor-needed', !selected);
    }
  }

  function seasonSponsorFromChoice(choice=currentSponsorChoice()){
    return CareerEngine.createSeasonSponsor(choice?.id==='academy'?{...choice,playerId:state?.sponsorChoice?.playerId}:choice);
  }

  function sponsorFreeSubscriptionAvailable(season=ensureSeasonState()){
    return !!(season?.sponsor?.id==='free_subscription' && !season.sponsor.freeSubscriptionUsed);
  }

  function sponsorCanMakeShopItemFree(id,season=ensureSeasonState()){
    return CareerEngine.sponsorCanMakeItemFree(id,season,SPONSOR_FREE_SHOP_IDS);
  }


  function sortStandingsSnapshot(standings=[]){
    return sortFantasyLeagueStandings(standings,state?.season);
  }

  function grantImmediateSponsorBonus(season=ensureSeasonState()){
    return CareerEngine.grantImmediateSponsorBonus(ensureCareerEconomy(),season);
  }

  function grantBigMatchSponsorReward(season,day,dayResult,preMatchStandings=[]){
    const top3=sortStandingsSnapshot(preMatchStandings).slice(0,3).map(s=>String(s.managerId));
    return CareerEngine.grantBigMatchSponsorReward(ensureCareerEconomy(),season,day,dayResult,top3);
  }

  function grantStreakSponsorReward(season,day,dayResult){
    return CareerEngine.grantStreakSponsorReward(ensureCareerEconomy(),season,day,dayResult);
  }

  function grantWinSponsorReward(season,day,dayResult){
    return CareerEngine.grantWinSponsorReward(ensureCareerEconomy(),season,day,dayResult);
  }

  function grantFutureAuctionSponsorBonus(season=ensureSeasonState()){
    return CareerEngine.grantFutureAuctionBonus(ensureCareerEconomy(),season);
  }

  function ensureSeasonShop(season=ensureSeasonState()){
    if(!season) return null;
    if(!season.shopPurchases || typeof season.shopPurchases!=='object') season.shopPurchases={};
    return season.shopPurchases;
  }

  function shopItemActive(id,season=ensureSeasonState()){
    const purchases=season?.shopPurchases;
    return !!purchases?.[id];
  }

  function careerEuros(){
    return CareerEngine.balance(ensureCareerEconomy());
  }

  function careerFantapoints(){
    return Math.max(0,Math.floor(Number(ensureCareerEconomy()?.fantapoints||0)));
  }

  function ensureConsumableState(season=ensureSeasonState()){
    if(!season) return null;
    season.consumables ||= {inventory:{},effects:{},usageHistory:[],purchaseHistory:[]};
    season.consumables.inventory ||= {};
    season.consumables.effects ||= {};
    if(!Array.isArray(season.consumables.usageHistory)) season.consumables.usageHistory=[];
    if(!Array.isArray(season.consumables.purchaseHistory)) season.consumables.purchaseHistory=[];
    return season.consumables;
  }

  function consumableQuantity(id,season=ensureSeasonState()){
    const data=ensureConsumableState(season);
    return Math.max(0,Math.floor(Number(data?.inventory?.[id]||0)));
  }

  function consumableDayEffect(day=ensureSeasonState()?.currentMatchday,season=ensureSeasonState()){
    const data=ensureConsumableState(season);
    const key=String(day||1);
    data.effects[key] ||= {};
    return data.effects[key];
  }

  function addConsumable(id,amount=1,season=ensureSeasonState()){
    const data=ensureConsumableState(season);
    if(!data) return 0;
    const next=consumableQuantity(id,season)+Math.max(0,Math.floor(Number(amount||0)));
    data.inventory[id]=next;
    return next;
  }

  function consumeConsumable(id,{day=ensureSeasonState()?.currentMatchday,note='',targetPlayerId=null}={}){
    const season=ensureSeasonState(),data=ensureConsumableState(season);
    if(!data || consumableQuantity(id,season)<=0) return false;
    data.inventory[id]=consumableQuantity(id,season)-1;
    data.usageHistory.push({id,day:Number(day||0),note:String(note||''),targetPlayerId:targetPlayerId?String(targetPlayerId):null,usedAt:Date.now()});
    document.querySelectorAll('[data-consumable-inventory-count]').forEach(el=>el.textContent=String(totalConsumablesOwned(season)));
    return true;
  }

  function totalConsumablesOwned(season=ensureSeasonState()){
    const data=ensureConsumableState(season);
    return Object.values(data?.inventory||{}).reduce((sum,value)=>sum+Math.max(0,Math.floor(Number(value||0))),0);
  }

  function shopPurchaseOrigin(id){
    const node=document.querySelector(`[data-shop-buy="${id}"]`);
    return node?.getBoundingClientRect?.();
  }

  function animateShopPurchase(item,origin,currency,before,after){
    if(!origin || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    const wallet=document.querySelector(currency==='fp'?'#shopFantapointsAmount':'#shopWalletAmount');
    const target=document.querySelector('#shopActiveSummary')||wallet;
    if(!target?.animate || !wallet) return;
    const end=target.getBoundingClientRect();
    const token={};wallet._purchaseAnimation=token;
    animateMatchdayRewardNumber(before,after,650,value=>{if(wallet.isConnected&&wallet._purchaseAnimation===token)wallet.textContent=String(value);},()=>wallet.isConnected&&wallet._purchaseAnimation===token);
    const icon=document.createElement('span');icon.className='shop-purchase-flight';
    icon.setAttribute('aria-hidden','true');icon.textContent=item.icon||'★';
    icon.style.left=`${origin.left+origin.width/2}px`;icon.style.top=`${origin.top}px`;
    document.body.appendChild(icon);
    const flight=icon.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(${end.left+end.width/2-origin.left-origin.width/2}px,${end.top+end.height/2-origin.top}px) scale(.5)`,opacity:0}],{duration:650,easing:'ease-in'});
    flight.finished.then(()=>icon.remove(),()=>icon.remove());
    target.animate([{filter:'brightness(1)'},{filter:'brightness(1.7)'},{filter:'brightness(1)'}],{duration:750});
  }

  function buyConsumableItem(item){
    const season=ensureSeasonState(),career=ensureCareerEconomy();
    if(!season||!career||!item?.consumable) return false;
    if(season.completed){showToast('La stagione è terminata: il negozio è chiuso.',true);return false;}
    const cost=Math.max(0,Math.floor(Number(item.cost||0)));
    if(careerFantapoints()<cost){showToast(`Fantapoints insufficienti: servono ${cost} FP per ${item.name}.`,true);return false;}
    const origin=shopPurchaseOrigin(item.id),before=careerFantapoints();
    career.fantapoints=careerFantapoints()-cost;
    career.totalFantapointsSpent=Number(career.totalFantapointsSpent||0)+cost;
    const quantity=addConsumable(item.id,1,season);
    season.consumables.purchaseHistory.push({id:item.id,cost,currency:'fp',quantityAfter:quantity,purchasedAt:Date.now()});
    saveState();
    renderCareerWallets();
    renderLeagueShopScreen();
    animateShopPurchase(item,origin,'fp',before,careerFantapoints());
    showToast(`${item.name} aggiunto all'inventario · x${quantity}.`);
    return true;
  }

  function grantMatchdayFantapoints(season,day,dayResult){
    if(!season||!dayResult||dayResult.fantapointsReward) return dayResult?.fantapointsReward||null;
    const match=(dayResult.matches||[]).find(item=>item.homeId==='user'||item.awayId==='user');
    if(!match) return null;
    const userHome=match.homeId==='user';
    const goals=Math.max(0,Number(userHome?match.homeScore:match.awayScore)||0);
    const conceded=Math.max(0,Number(userHome?match.awayScore:match.homeScore)||0);
    const won=goals>conceded,draw=goals===conceded;
    const parts={participation:3,outcome:won?8:draw?3:0,goals:goals*2,cleanSheet:conceded===0?2:0,powers:0,
      sponsor:season.sponsor?.id==='fantasy_bonus' && goals>=2 ? 2 : 0};
    const total=Object.values(parts).reduce((sum,value)=>sum+Number(value||0),0);
    const career=ensureCareerEconomy(),balanceBefore=careerFantapoints();
    career.fantapoints=balanceBefore+total;
    career.totalFantapointsEarned=Number(career.totalFantapointsEarned||0)+total;
    const reward={day:Number(day),parts,total,balanceBefore,balanceAfter:career.fantapoints,createdAt:Date.now()};
    dayResult.fantapointsReward=reward;
    career.fantapointsHistory.push({seasonNumber:Number(career.seasonNumber||1),...reward});
    career.fantapointsHistory=career.fantapointsHistory.slice(-76);
    return reward;
  }

  function careerDivisionLabel(division=state?.career?.division||GAME_CONFIG.startingDivision){
    const value=Math.max(1,Math.floor(Number(division||GAME_CONFIG.startingDivision)));
    return ({4:'Lega Amatori',3:'Serie C',2:'Serie B',1:'Serie A'})[value] || `Divisione ${value}`;
  }

  function careerPromotionNote(division=state?.career?.division||GAME_CONFIG.startingDivision){
    const value=Math.max(1,Math.floor(Number(division||GAME_CONFIG.startingDivision)));
    if(value<=1) return '* 1° posto: campione della Serie A · Ultimo posto: retrocessione in Serie B';
    const promotion=`* 1° posto: promosso in ${careerDivisionLabel(value-1)}`;
    return value<4?`${promotion} · Ultimo posto: retrocessione in ${careerDivisionLabel(value+1)}`:promotion;
  }

  function careerSeasonLabel(seasonNumber=state?.career?.seasonNumber||1){
    const n=Math.max(1,Math.floor(Number(seasonNumber||1)));
    const start=2026+n-1;
    return `${start}/${String(start+1).slice(-2)}`;
  }

  function renderCareerWallets(){
    document.querySelectorAll('.career-wallet-chip').forEach(wallet=>{
      const parent=wallet.parentElement;
      if(!parent||parent.querySelector(':scope > .fantapoints-wallet')) return;
      const chip=document.createElement('div');
      chip.className=`${wallet.className} fantapoints-wallet`;
      chip.title='Fantapoints disponibili';
      chip.innerHTML='<span>◆</span><small>FP</small><b data-fantapoints-value>0</b>';
      wallet.insertAdjacentElement('afterend',chip);
    });
    const value=careerEuros();
    document.querySelectorAll('[data-career-wallet-value]').forEach(el=>el.textContent=String(value));
    document.querySelectorAll('[data-fantapoints-value]').forEach(el=>el.textContent=String(careerFantapoints()));
    const inventoryCount=state?.season?.started?totalConsumablesOwned(state.season):0;
    document.querySelectorAll('[data-consumable-inventory-count]').forEach(el=>el.textContent=String(inventoryCount));
    const division=Math.max(1,Math.floor(Number(state?.career?.division||GAME_CONFIG.startingDivision)));
    document.querySelectorAll('[data-current-division]').forEach(el=>el.textContent=careerDivisionLabel(division));
  }

  function applyGameConfiguration(){
    document.title=`Fantallenatore — V${GAME_CONFIG.buildVersion}`;
    document.querySelectorAll('[data-game-build]').forEach(el=>el.textContent=`V${GAME_CONFIG.buildVersion}`);
    document.querySelectorAll('[data-game-season]').forEach(el=>el.textContent=careerSeasonLabel());
    document.querySelectorAll('[data-game-league]').forEach(el=>el.textContent=careerDivisionLabel());
    document.querySelectorAll('[data-current-division]').forEach(el=>el.textContent=careerDivisionLabel());
  }

  function formationEventChance(){
    return shopItemActive('fortune') ? .40 : FORMATION_EVENT_CHANCE;
  }

  function seasonShockChance(){
    const division=Math.max(1,Math.floor(Number(state?.career?.division||GAME_CONFIG.startingDivision)));
    return division>=4 ? 0 : division===3 ? .05 : division===2 ? .07 : .09;
  }

  function formationChoiceRarity(templateId){
    return FORMATION_CHOICE_RARITY_BY_TEMPLATE[String(templateId)] || 'common';
  }

  function formationChoiceRarityLabel(rarity){
    return ({common:'COMUNE',rare:'RARA',epic:'EPICA'})[rarity] || 'COMUNE';
  }

  function formationRarityWeights(){
    if(!formationRaritiesUnlocked()) return {common:1,rare:0,epic:0};
    return {common:1.0,rare:.88,epic:.55};
  }

  function formationRaritiesUnlocked(){
    return shopItemActive('special_events');
  }

  function specialFormationEventsUnlocked(){
    return shopItemActive('special_events');
  }

  function deterministicFormationTemplateOrder(day,salt='base'){
    const weights=formationRarityWeights();
    const allowSpecial=specialFormationEventsUnlocked();
    return FORMATION_CHOICE_TEMPLATES.filter(template=>
      (formationChoiceRarity(template.id)==='common' || formationRaritiesUnlocked()) &&
      (allowSpecial || !SPECIAL_FORMATION_EVENT_TEMPLATE_IDS.has(String(template.id)))
    ).map(template=>{
      const rarity=formationChoiceRarity(template.id);
      const weight=Math.max(.05,Number(weights[rarity]||1));
      const r=Math.max(.000001,careerHash(`formation-choice|${day}|${salt}|weighted-template|${template.id}`));
      return {template,score:-Math.log(r)/weight,rarity};
    }).sort((a,b)=>a.score-b.score || String(a.template.id).localeCompare(String(b.template.id),'it'));
  }

  function buyShopItem(id,paymentCurrency='eur'){
    const season=ensureSeasonState(),career=ensureCareerEconomy(),item=SHOP_ITEMS[id];
    if(!season || !career || !item) return;
    if(item.id==='assistant_tactical_pro' && !shopItemActive('assistant_coach',season)){showToast('Serve prima l’Assistente Tecnico.',true);return;}
    if(item.consumable){ buyConsumableItem(item); return; }
    const requestedCurrency=paymentCurrency==='fp'?'fp':'eur';
    const fpCost=Math.max(0,Math.floor(Number(item.fpCost||0)));
    const origin=shopPurchaseOrigin(id),before=requestedCurrency==='fp'?careerFantapoints():careerEuros();
    const result=CareerEngine.buyShopItem(career,season,item,id,{
      freeItemIds:SPONSOR_FREE_SHOP_IDS,
      currency:requestedCurrency,
      fpCost
    });
    if(!result.ok){
      if(result.reason==='season_completed') showToast('La stagione è terminata: gli acquisti stagionali sono chiusi.',true);
      else if(result.reason==='already_active') showToast(`${item.name} è già attivo per questa stagione.`);
      else if(result.reason==='fp_not_available') showToast(`${item.name} non è acquistabile con Fantapoints.`,true);
      else if(result.reason==='insufficient_fantapoints') showToast(`Fantapoints insufficienti: servono ${fpCost} FP per ${item.name}.`,true);
      else if(result.reason==='insufficient_funds') showToast(`Saldo insufficiente: servono ${item.cost} € per ${item.name}.`,true);
      return;
    }
    if(id==='expert_precision' && season.expertDays){
      delete season.expertDays[String(season.currentMatchday||1)];
    }
    saveState();
    renderCareerWallets();
    renderLeagueShopScreen();
    animateShopPurchase(item,origin,requestedCurrency,before,requestedCurrency==='fp'?careerFantapoints():careerEuros());
    const paymentText=result.free?'GRATIS grazie allo sponsor':result.currency==='fp'?`${result.cost} FP`:`${result.cost} €`;
    showToast(`${item.name} attivato fino a fine stagione · ${paymentText}.`);
  }

  let shopCategoryFilter='all';
  let shopPageIndex=0;

  function shopItemsPerPage(){
    const w=Number(window.innerWidth||1280);
    if(w<=720) return 1;
    if(w<=1100) return 2;
    return 4;
  }

  function shopItemEffectLine(item,active=shopItemActive(item.id)){
    if(item?.consumable) return `Inventario: <b>x${consumableQuantity(item.id)}</b> · usa quando disponibile`;
    if(item.id==='fortune') return `Probabilità carte: <b>${Math.round(formationEventChance()*100)}%</b>`;
    if(item.id==='special_events') return `Rare/Epiche e carte speciali: <b>${active?'sbloccate':'bloccate'}</b>`;
    if(item.id==='expert_precision') return active?'Precisione esperti: <b>molto alta</b> · margine d’errore ridotto.':'Precisione esperti: <b>standard</b> · più possibilità di letture sbagliate.';
    if(item.id==='assistant_coach') return active?'AUTO XI e gestione formazione <b>attivi</b>.':'Gestione formazione e indisponibili <b>automatizzata</b>.';
    if(item.id==='scout_plus') return active?'Stima titolarità <b>visibile</b> nei dati giocatore.':'Aggiunge una <b>stima di titolarità</b>.';
    if(item.id==='fantadata_pro') return active?'Statistiche avanzate <b>sbloccate</b>.':'Sblocca <b>statistiche avanzate</b> e forma.';
    return active?'Servizio attivo per la stagione corrente.':'Valido fino alla fine della stagione corrente.';
  }

  function shopCardHtml(item){
    const season=ensureSeasonState();
    const consumable=!!item.consumable;
    const quantity=consumable?consumableQuantity(item.id,season):0;
    const active=!consumable && shopItemActive(item.id,season);
    const freeBySponsor=!consumable && sponsorCanMakeShopItemFree(item.id,season);
    const dualCurrency=!consumable && Number(item.fpCost)>0;
    const euroCanAfford=freeBySponsor || careerEuros()>=Number(item.cost||0);
    const fpCanAfford=dualCurrency && careerFantapoints()>=Number(item.fpCost||0);
    const balance=item.currency==='fp'?careerFantapoints():careerEuros();
    const canAfford=freeBySponsor || balance>=item.cost;
    const locked=!!season?.completed;
    const effectLine=shopItemEffectLine(item,active);
    const priceIcon=item.currency==='fp'?'◆':'💶';
    const priceText=freeBySponsor&&!active?'GRATIS':dualCurrency?`${item.cost} €  /  ${item.fpCost} FP`:`${item.cost} ${item.currency==='fp'?'FP':'€'}`;
    let button='';
    if(consumable){
      button=locked
        ? '<button type="button" class="shop-buy-btn" disabled>CHIUSO</button>'
        : `<button type="button" class="shop-buy-btn ${canAfford?'primary':''}" data-shop-buy="${escapeHtml(item.id)}" ${canAfford?'':'disabled'}>${canAfford?'ACQUISTA +1':'SALDO INSUFFICIENTE'}</button>`;
    }else if(active){
      button='<button type="button" class="shop-buy-btn active" disabled>✓ ATTIVO</button>';
    }else if(locked){
      button='<button type="button" class="shop-buy-btn" disabled>CHIUSO</button>';
    }else if(freeBySponsor){
      button=`<button type="button" class="shop-buy-btn primary" data-shop-buy="${escapeHtml(item.id)}" data-shop-currency="eur">ATTIVA GRATIS</button>`;
    }else if(dualCurrency){
      button=`<div class="shop-dual-buy-actions">
        <button type="button" class="shop-buy-btn shop-buy-euro ${euroCanAfford?'primary':''}" data-shop-buy="${escapeHtml(item.id)}" data-shop-currency="eur" ${euroCanAfford?'':'disabled'}>${euroCanAfford?`COMPRA CON € · ${item.cost} €`:`SERVONO ${item.cost} €`}</button>
        <button type="button" class="shop-buy-btn shop-buy-fp ${fpCanAfford?'primary':''}" data-shop-buy="${escapeHtml(item.id)}" data-shop-currency="fp" ${fpCanAfford?'':'disabled'}>${fpCanAfford?`COMPRA CON FP · ${item.fpCost} FP`:`SERVONO ${item.fpCost} FP`}</button>
      </div>`;
    }else{
      button=`<button type="button" class="shop-buy-btn ${euroCanAfford?'primary':''}" data-shop-buy="${escapeHtml(item.id)}" data-shop-currency="eur" ${euroCanAfford?'':'disabled'}>${euroCanAfford?'ACQUISTA':'SALDO INSUFFICIENTE'}</button>`;
    }
    return `<article class="shop-item-card ${active?'is-active':''} ${consumable?'is-consumable':''} ${dualCurrency?'is-dual-currency':''}">
      <div class="shop-game-card" data-shop-detail="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Apri dettagli di ${escapeHtml(item.name)}">
        <div class="shop-game-card-title">${escapeHtml(item.name)}</div>
        <div class="shop-product-visual shop-art-${escapeHtml(item.id)}">
          ${active?'<span class="shop-product-owned">✓ ATTIVO</span>':''}
          ${consumable&&quantity?`<span class="shop-product-owned consumable-owned">×${quantity}</span>`:''}
          ${item.image?`<img class="shop-product-hero-image" src="${escapeHtml(item.image)}" alt="">`:`<span class="shop-product-hero-icon" aria-hidden="true">${item.icon}</span>`}
        </div>
        <div class="shop-game-effect">${effectLine}</div>
        <div class="shop-game-price ${item.currency==='fp'&&!dualCurrency?'is-fp':''} ${dualCurrency?'is-dual-price':''}">${dualCurrency?`<span class="shop-price-euro">💶 <strong>${item.cost} €</strong></span><span class="shop-price-separator">/</span><span class="shop-price-fp">◆ <strong>${item.fpCost} FP</strong></span>`:`<span>${priceIcon}</span><strong>${priceText}</strong>`}</div>
      </div>
      ${button}
    </article>`;
  }

  function closeShopProductModal(){
    const modal=$('shopProductModal');
    if(!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
  }

  function openShopProductModal(id){
    const item=SHOP_ITEMS[id],season=ensureSeasonState(),modal=$('shopProductModal');
    if(!item || !season || !modal) return;
    const consumable=!!item.consumable;
    const quantity=consumable?consumableQuantity(item.id,season):0;
    const active=!consumable && shopItemActive(item.id,season);
    const freeBySponsor=!consumable && sponsorCanMakeShopItemFree(item.id,season);
    const dualCurrency=!consumable && Number(item.fpCost)>0;
    const balance=item.currency==='fp'?careerFantapoints():careerEuros();
    const canAfford=freeBySponsor || balance>=item.cost;
    const euroCanAfford=freeBySponsor || careerEuros()>=Number(item.cost||0);
    const fpCanAfford=dualCurrency && careerFantapoints()>=Number(item.fpCost||0);
    const locked=!!season.completed;
    const modalIcon=$('shopProductModalIcon');
    const modalImage=$('shopProductModalImage');
    if(modalIcon) modalIcon.textContent=item.icon;
    if(modalImage){
      if(item.image){
        modalImage.src=item.image;
        modalImage.alt=item.name;
        modalImage.hidden=false;
      }else{
        modalImage.hidden=true;
        modalImage.removeAttribute('src');
        modalImage.alt='';
      }
    }
    if(modalIcon) modalIcon.hidden=!!item.image;
    if($('shopProductModalCategory')) $('shopProductModalCategory').textContent=item.category;
    if($('shopProductModalTitle')) $('shopProductModalTitle').textContent=item.name;
    if($('shopProductModalDescription')) $('shopProductModalDescription').textContent=item.description;
    if($('shopProductModalEffect')) $('shopProductModalEffect').innerHTML=shopItemEffectLine(item,active);
    if($('shopProductModalFeatures')) $('shopProductModalFeatures').innerHTML=(item.features||[]).map(x=>`<li><span>✓</span>${escapeHtml(x)}</li>`).join('');
    const visual=$('shopProductModalVisual');
    if(visual) visual.className=`shop-product-modal-visual shop-art-${item.id} ${consumable?'is-consumable':''}`;
    const duration=modal?.querySelector('.shop-product-duration');
    if(duration) duration.textContent=consumable?'CONSUMABILE':'STAGIONALE';
    if($('shopProductModalStatus')) $('shopProductModalStatus').textContent=consumable?`IN INVENTARIO · x${quantity}`:active?'ATTIVO · STAGIONE CORRENTE':'VALIDO FINO A FINE STAGIONE';
    if($('shopProductModalPrice')){ const priceEl=$('shopProductModalPrice'); if(freeBySponsor&&!active) priceEl.textContent='GRATIS'; else if(dualCurrency) priceEl.innerHTML=`<span class="shop-price-euro">${item.cost} €</span> <span class="shop-price-separator">/</span> <span class="shop-price-fp">${item.fpCost} FP</span>`; else priceEl.textContent=`${item.cost} ${item.currency==='fp'?'FP':'€'}`; }
    const buy=$('shopProductModalBuy');
    const buyFp=$('shopProductModalBuyFp');
    if(buy){
      buy.dataset.shopModalBuy=item.id;
      buy.dataset.shopCurrency='eur';
      buy.hidden=dualCurrency && !freeBySponsor ? false : false;
      buy.disabled=(!consumable&&active) || locked || (dualCurrency?!euroCanAfford:!canAfford);
      buy.className=`shop-buy-btn ${((consumable||!active)&&!locked&&(dualCurrency?euroCanAfford:canAfford))?'primary':''} ${active?'active':''}`;
      buy.textContent=consumable
        ? locked?'STAGIONE TERMINATA':canAfford?'ACQUISTA +1':`SERVONO ${item.cost} FP`
        : active?'✓ ATTIVO':locked?'STAGIONE TERMINATA':freeBySponsor?'ATTIVA GRATIS · SPONSOR':dualCurrency?(euroCanAfford?`COMPRA CON € · ${item.cost} €`:`SERVONO ${item.cost} €`):canAfford?'ACQUISTA ORA':`SERVONO ${item.cost} €`;
    }
    if(buyFp){
      const showFp=dualCurrency && !freeBySponsor && !active;
      buyFp.hidden=!showFp;
      buyFp.dataset.shopModalBuy=item.id;
      buyFp.dataset.shopCurrency='fp';
      buyFp.disabled=locked || !fpCanAfford;
      buyFp.className=`shop-buy-btn shop-buy-fp ${(!locked&&fpCanAfford)?'primary':''}`;
      buyFp.textContent=locked?'STAGIONE TERMINATA':fpCanAfford?`COMPRA CON FP · ${item.fpCost} FP`:`SERVONO ${item.fpCost} FP`;
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    setTimeout(()=>$('closeShopProductModal')?.focus(),0);
  }

  function renderShopItems(){
    const grid=$('shopItemsGrid'),season=ensureSeasonState();
    if(!grid || !season) return;
    const items=Object.values(SHOP_ITEMS);
    const visible=shopCategoryFilter==='all' ? items : items.filter(item=>item.section===shopCategoryFilter);
    const perPage=shopItemsPerPage();
    const totalPages=Math.max(1,Math.ceil(visible.length/perPage));
    shopPageIndex=clamp(Number(shopPageIndex||0),0,totalPages-1);
    const pageItems=visible.slice(shopPageIndex*perPage,shopPageIndex*perPage+perPage);
    grid.innerHTML=pageItems.map(shopCardHtml).join('');

    document.querySelectorAll('[data-shop-category]').forEach(btn=>{
      const active=String(btn.dataset.shopCategory)===String(shopCategoryFilter);
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-selected',active?'true':'false');
      btn.onclick=()=>{
        shopCategoryFilter=String(btn.dataset.shopCategory||'all');
        shopPageIndex=0;
        renderShopItems();
      };
    });

    const prev=$('shopPrevPage'),next=$('shopNextPage'),dots=$('shopPageDots');
    if(prev){
      prev.disabled=shopPageIndex<=0;
      prev.onclick=()=>{ if(shopPageIndex>0){shopPageIndex--;renderShopItems();} };
    }
    if(next){
      next.disabled=shopPageIndex>=totalPages-1;
      next.onclick=()=>{ if(shopPageIndex<totalPages-1){shopPageIndex++;renderShopItems();} };
    }
    if(dots){
      dots.innerHTML=totalPages>1
        ? Array.from({length:totalPages},(_,i)=>`<button type="button" class="${i===shopPageIndex?'active':''}" data-shop-page="${i}" aria-label="Pagina ${i+1}" ${i===shopPageIndex?'aria-current="page"':''}></button>`).join('')
        : '';
      dots.querySelectorAll('[data-shop-page]').forEach(btn=>btn.onclick=()=>{shopPageIndex=Number(btn.dataset.shopPage||0);renderShopItems();});
    }

    grid.querySelectorAll('[data-shop-buy]').forEach(btn=>btn.addEventListener('click',e=>{
      e.stopPropagation();
      buyShopItem(btn.dataset.shopBuy,btn.dataset.shopCurrency||'eur');
    }));
    grid.querySelectorAll('[data-shop-detail]').forEach(card=>{
      card.addEventListener('click',()=>openShopProductModal(card.dataset.shopDetail));
      card.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){
          e.preventDefault();
          openShopProductModal(card.dataset.shopDetail);
        }
      });
    });

    const modal=$('shopProductModal');
    if(modal){
      modal.onkeydown=e=>{ if(e.key==='Escape') closeShopProductModal(); };
      const close=$('closeShopProductModal'),backdrop=modal.querySelector('.shop-product-modal-backdrop');
      if(close) close.onclick=closeShopProductModal;
      if(backdrop) backdrop.onclick=closeShopProductModal;
      const modalBuy=$('shopProductModalBuy'),modalBuyFp=$('shopProductModalBuyFp');
      [modalBuy,modalBuyFp].forEach(button=>{
        if(!button) return;
        button.onclick=()=>{
          const id=button.dataset.shopModalBuy;
          if(!id || button.disabled) return;
          const currency=button.dataset.shopCurrency||'eur';
          closeShopProductModal();
          buyShopItem(id,currency);
        };
      });
    }

    if($('shopWalletAmount')) $('shopWalletAmount').textContent=String(careerEuros());
    if($('shopFantapointsAmount')) $('shopFantapointsAmount').textContent=String(careerFantapoints());
    if($('shopSeasonLabel')) $('shopSeasonLabel').textContent=`STAGIONE ${Number(ensureCareerEconomy()?.seasonNumber||1)} · SERVIZI E CONSUMABILI STAGIONALI`;
    const persistentItems=items.filter(item=>!item.consumable);
    const activeItems=persistentItems.filter(item=>shopItemActive(item.id,season));
    const inventoryItems=items.filter(item=>item.consumable&&consumableQuantity(item.id,season)>0);
    if($('shopActiveCount')) $('shopActiveCount').textContent=`${activeItems.length}/${persistentItems.length}`;
    if($('shopActiveSummary')){
      const sponsorNote=sponsorFreeSubscriptionAvailable(season)?'<span>🎁 Sponsor: 1 abbonamento gratuito disponibile</span>':'';
      const activeHtml=activeItems.length?activeItems.map(item=>`<span>${item.icon} ${escapeHtml(item.name)}</span>`).join(''):'';
      const inventoryHtml=inventoryItems.length?inventoryItems.map(item=>`<span class="shop-inventory-chip">${item.icon} ${escapeHtml(item.name)} ×${consumableQuantity(item.id,season)}</span>`).join(''):'';
      $('shopActiveSummary').innerHTML=(sponsorNote+activeHtml+inventoryHtml) || '<small>Nessun servizio attivo e inventario vuoto.</small>';
    }
  }

  function estimatedStarterProbability(player,day=ensureSeasonState()?.currentMatchday||1){
    const season=ensureSeasonState();
    if(!player || !season) return 0;
    const targetDay=Number(day||season.currentMatchday||1);
    const status=playerStatusForDay(player.id,targetDay);
    if(status.unavailable) return 0;

    const slots=clubRoleStarterSlots(player.club,player.role);
    const peers=(window.FANTA_PLAYERS||[])
      .filter(p=>p.club===player.club&&p.role===player.role&&p.marketStatus!=='abroad')
      .slice()
      .sort((a,b)=>{
        const aUnavailable=playerStatusForDay(a.id,targetDay).unavailable?1:0;
        const bUnavailable=playerStatusForDay(b.id,targetDay).unavailable?1:0;
        return aUnavailable-bUnavailable || lineupPlayerValue(b)-lineupPlayerValue(a) || currentPlayerOvr(b)-currentPlayerOvr(a);
      });
    const available=peers.filter(candidate=>!playerStatusForDay(candidate.id,targetDay).unavailable);
    const rankById=new Map(available.map((candidate,index)=>[String(candidate.id),index]));
    const entries=peers.map(candidate=>{
      const unavailable=playerStatusForDay(candidate.id,targetDay).unavailable;
      const rank=rankById.get(String(candidate.id))??peers.length;
      const stat=playerSeasonStat(candidate.id);
      const startRate=stat?.appearances?Number(stat.starts||0)/Math.max(1,Number(stat.appearances||0)):null;
      const historyAdj=startRate==null?0:clamp((startRate-.5)*12,-6,6);
      const form=playerFormMetrics(candidate.id);
      const formAdj=form.count?clamp((form.avg-6)*2.2,-2.8,3.2):0;
      const noise=(careerHash(`starter-prob|${targetDay}|${candidate.id}`)-.5)*3;
      const worldEffect=worldPlayerModifier(targetDay,candidate.id);
      const eventScoreDelta=Number(worldEffect?.starterScoreDelta||0);
      const eventProbabilityDelta=Number(worldEffect?.starterProbabilityDelta||0);
      return {
        id:candidate.id,
        unavailable,
        score:currentPlayerOvr(candidate)+starterHierarchyBias(candidate.role,rank,slots)+historyAdj+formAdj+noise+eventScoreDelta+eventProbabilityDelta*.28
      };
    });

    // Le probabilità competono per i posti realmente disponibili nel ruolo.
    // Esempio P: la somma dei portieri disponibili resta circa 100%, invece di
    // consentire contemporaneamente valori come 94% al primo e 74% al secondo.
    return normalizedStarterProbability(entries,player.id,slots,player.role==='P'?2.4:4.2);
  }

  function scoutStarterBadge(player,day=ensureSeasonState()?.currentMatchday){
    const season=ensureSeasonState();
    if(!player || !season) return '';
    const scout=shopItemActive('scout_plus',season), report=starterReportActive(day);
    if(!scout && !report) return '';
    const pct=estimatedStarterProbability(player,day);
    const level=pct>=70?'high':pct>=40?'medium':'low';
    const source=scout?'Scout Plus':'Report Titolarità';
    return `<span class="scout-starter-badge ${level} ${report&&!scout?'is-consumable-report':''}" title="${source}: probabilità di titolarità ${pct}%">Tit. ${pct}%</span>`;
  }

  function assistantAutoLineupCapabilities(season=ensureSeasonState()){
    return {
      scout:!!shopItemActive('scout_plus',season),
      fantadata:!!shopItemActive('fantadata_pro',season)
    };
  }

  function assistantBasePlayerValue(player){
    if(!player) return -999999;
    const season=ensureSeasonState();
    const status=playerStatusForDay(player.id,season?.currentMatchday||1);
    const statusPenalty=status.unavailable?-4500:0;
    // Assistente Tecnico da solo usa soltanto qualità generale e disponibilità.
    // Forma/rendimento appartengono a FantaData; titolarità stimata appartiene a Scout Plus.
    return currentPlayerOvr(player)*100 + statusPenalty;
  }

  function advancedAutoLineupValue(player){
    if(!player) return -999999;
    const season=ensureSeasonState();
    const caps=assistantAutoLineupCapabilities(season);
    let value=assistantBasePlayerValue(player);
    if(caps.fantadata){
      const stat=playerSeasonStat(player.id);
      const favg=stat?.voteCount?Number(stat.fantasySum||0)/Math.max(1,Number(stat.voteCount||0)):6;
      const form=playerFormMetrics(player.id);
      value += (favg-6)*420 + form.score*340;
      // Il calendario Serie A è un dato FantaData: AUTO XI lo usa solo se l'abbonamento è attivo.
      const matchup=serieAMatchupDifficulty(player,season?.currentMatchday||1);
      if(matchup){
        value += matchup.key==='favorable'?260:matchup.key==='hard'?-240:0;
        value += matchup.home?45:-25;
      }
    }
    if(caps.scout) value += estimatedStarterProbability(player)*8;
    if(shopItemActive('assistant_tactical_pro',season)){
      const choice=activeFormationChoice(season?.currentMatchday);
      const effect=choice?.effect;
      if(String(effect?.targetPlayerId||'')===String(player.id) && ['player_vote','locker_vote','world_player'].includes(effect.kind)) value+=Number(effect.delta||effect.voteDelta||0)*900;
    }
    return value;
  }

  function assistantAutoLineupAnalysisHtml(season=ensureSeasonState()){
    const caps=assistantAutoLineupCapabilities(season);
    return `<strong>🧠 AUTO XI analizza:</strong><span class="auto-xi-chip on">OVR</span><span class="auto-xi-chip on">Disponibilità</span>${caps.scout?'<span class="auto-xi-chip scout on">Scout Plus · Titolarità</span>':'<span class="auto-xi-chip locked">🔒 Titolarità · Scout Plus</span>'}${caps.fantadata?'<span class="auto-xi-chip data on">FantaData · Forma/Rendimento</span><span class="auto-xi-chip data on">FantaData · Avversario Serie A</span>':'<span class="auto-xi-chip locked">🔒 Forma/Rendimento · FantaData</span><span class="auto-xi-chip locked">🔒 Avversario Serie A · FantaData</span>'}`;
  }

  function buildAdvancedAutoLineup(manager,formationKey){
    if(!allowedLineupFormation(formationKey)) formationKey='4-3-3';
    const starters={};
    const counts=lineupCountsForFormation(formationKey);
    const blockedId=adminBlockedStarterForManager(manager?.id,state?.season?.currentMatchday||1);
    ['P','D','C','A'].forEach(role=>{
      const players=(manager.roster||[]).filter(p=>p.role===role && (!blockedId || String(p.id)!==String(blockedId))).slice().sort((a,b)=>{
        const au=playerStatusForDay(a.id,state?.season?.currentMatchday||1).unavailable?1:0;
        const bu=playerStatusForDay(b.id,state?.season?.currentMatchday||1).unavailable?1:0;
        return au-bu || advancedAutoLineupValue(b)-advancedAutoLineupValue(a);
      }).slice(0,counts[role]);
      const slots=lineupSlots(formationKey).filter(s=>s.role===role);
      players.forEach((pl,idx)=>{if(slots[idx]) starters[slots[idx].instanceId]=String(pl.id);});
    });
    const used=new Set(Object.values(starters).map(String));
    const bench=(manager.roster||[]).filter(p=>!used.has(String(p.id))).slice().sort((a,b)=>advancedAutoLineupValue(b)-advancedAutoLineupValue(a)).map(p=>String(p.id));
    const lineup={formation:formationKey,starters,bench,captainId:null,confirmed:true,updatedAt:Date.now()};
    if(blockedId) enforcePlayerBenchedInLineup(manager,lineup,blockedId,state?.season?.currentMatchday||1);
    if(manager?.id==='user') enforceFaithReserveStarterInLineup(manager,lineup,state?.season?.currentMatchday||1);
    if(manager?.id==='user' && shopItemActive('assistant_tactical_pro')) adaptTacticalProLineup(manager,lineup,state?.season?.currentMatchday||1);
    return lineup;
  }

  function bestAdvancedFormation(manager){
    return availableLineupFormations().map(key=>{
      const built=buildAdvancedAutoLineup(manager,key);
      const score=shopItemActive('assistant_tactical_pro')?tacticalExpectedLineupPoints(manager,built,state?.season?.currentMatchday||1):Object.values(built.starters).reduce((sum,id)=>sum+advancedAutoLineupValue(playerMap.get(String(id))||manager.roster.find(p=>String(p.id)===String(id))),0);
      return {key,score};
    }).sort((a,b)=>b.score-a.score)[0]?.key || '4-3-3';
  }

  function grantSeasonPrizeIfNeeded(season=ensureSeasonState()){
    const career=ensureCareerEconomy();
    const standings=sortedStandings();
    const previousGranted=!!season?.careerPrize?.granted;
    const prize=CareerEngine.grantSeasonPrize(career,season,standings);
    if(prize&&!previousGranted) renderCareerWallets();
    return prize;
  }

  function evolutionPlayerData(player,season=ensureSeasonState()){
    if(!player||!season) return null;
    const base=Number(player.ovr||player.overall||0);
    const development=season.playerOvrDevelopment?.[String(player.id)]||{delta:0,lastDay:0,history:[]};
    const current=currentPlayerOvr(player);
    const delta=current-base;
    const history=Array.isArray(development.history)?development.history:[];
    const last=history.length?history[history.length-1]:null;
    const owner=seasonPlayerOwner(player.id);
    const potential=auctionObserverActive()?playerSeasonPotentialProfile(player):null;
    return {player,base,current,delta,history,last,owner,potential};
  }

  function evolutionPotentialClass(potential){
    if(!potential) return '';
    return ({elite:'elite',high:'high',normal:'normal',low:'low',collapse:'collapse'})[potential.tier]||'normal';
  }

  function evolutionHighlightHtml(item){
    if(!item) return '';
    const direction=item.delta>0?'positive':item.delta<0?'negative':'neutral';
    const lastReason=item.last?`G${item.last.day} · ${item.last.reason}`:'Nessuna variazione registrata';
    const mine=item.owner?.manager?.id==='user';
    const potential=item.potential?`<span class="evolution-potential ${evolutionPotentialClass(item.potential)}">POT. ${escapeHtml(item.potential.label)}</span>`:'';
    return `<button type="button" class="evolution-highlight-item ${direction}" data-season-player="${escapeHtml(item.player.id)}">
      <div class="evolution-highlight-rank">${direction==='positive'?'▲':'▼'}</div>
      <div class="evolution-highlight-copy"><strong>${escapeHtml(item.player.name)}</strong><span>${escapeHtml(clubName(item.player.club))} · ${escapeHtml(item.player.role)}${mine?' · TUA ROSA':''}</span><small>${escapeHtml(lastReason)}</small>${potential}</div>
      <div class="evolution-ovr-mini"><span>${item.base}</span><i>→</i><strong>${item.current}</strong><em class="${direction}">${item.delta>0?'+':''}${item.delta}</em></div>
    </button>`;
  }

  function evolutionPlayerRowHtml(item){
    const mine=item.owner?.manager?.id==='user';
    const ownerLabel=mine?'TUA ROSA':item.owner?.manager?.team?item.owner.manager.team:'SVINCOLATO';
    const direction=item.delta>0?'positive':item.delta<0?'negative':'neutral';
    const recent=item.history.slice(-2).reverse();
    const reasons=recent.length
      ? recent.map(ev=>`<span><b>G${ev.day}</b> ${escapeHtml(ev.reason)}</span>`).join('')
      : '<span class="is-empty">Nessuna variazione OVR finora.</span>';
    const potential=item.potential?`<span class="evolution-potential ${evolutionPotentialClass(item.potential)}">OSSERVATORE · ${escapeHtml(item.potential.label)}</span>`:'';
    return `<button type="button" class="evolution-player-row ${direction} ${mine?'is-mine':''}" data-season-player="${escapeHtml(item.player.id)}">
      <div class="evolution-player-main">
        <span class="evolution-role role-${escapeHtml(String(item.player.role||'').toLowerCase())}">${escapeHtml(item.player.role||'')}</span>
        <div><strong>${escapeHtml(item.player.name)}</strong><small>${escapeHtml(clubName(item.player.club))} · ${escapeHtml(ownerLabel)}</small>${potential}</div>
      </div>
      <div class="evolution-ovr-flow"><span><small>INIZIO</small><b>${item.base}</b></span><i>→</i><span><small>ORA</small><strong>${item.current}</strong></span><em class="${direction}">${item.delta>0?'+':''}${item.delta}</em></div>
      <div class="evolution-reasons">${reasons}</div>
      <div class="evolution-last-day"><span>ULTIMO MOVIMENTO</span><strong>${item.last?`G${item.last.day}`:'—'}</strong><small>${item.history.length} ${item.history.length===1?'variazione':'variazioni'}</small></div>
    </button>`;
  }

  function dataCenterContext(){
    const season=ensureSeasonState(),me=managerById('user');
    if(!season || !me) return null;
    const day=Number(season.currentMatchday||1);
    const dataPro=shopItemActive('fantadata_pro',season);
    const scoutPlus=shopItemActive('scout_plus',season);
    const assistant=shopItemActive('assistant_coach',season);
    const roster=(me.roster||[]).slice();
    const available=roster.filter(p=>!playerStatusForDay(p.id,day).unavailable);
    const unavailable=roster.filter(p=>playerStatusForDay(p.id,day).unavailable);
    const avgOvr=roster.length?roster.reduce((sum,p)=>sum+currentPlayerOvr(p),0)/roster.length:0;
    const totals=roster.reduce((acc,p)=>{
      const st=playerSeasonStat(p.id)||emptyPlayerSeasonStat(p);
      acc.goals+=Number(st.goals||0); acc.assists+=Number(st.assists||0);
      acc.minutes+=Number(st.minutes||0); acc.apps+=Number(st.appearances||0);
      return acc;
    },{goals:0,assists:0,minutes:0,apps:0});
    let assistantFormation=null,assistantXI=new Set();
    if(assistant){
      assistantFormation=bestAdvancedFormation(me);
      const built=buildAdvancedAutoLineup(me,assistantFormation);
      assistantXI=new Set(Object.values(built.starters||{}).map(String));
    }
    return {season,me,day,dataPro,scoutPlus,assistant,roster,available,unavailable,avgOvr,totals,assistantFormation,assistantXI};
  }

  function dataCenterPremiumHtml(ctx){
    const {season,me,day,dataPro,scoutPlus,assistant,roster,available,assistantFormation,assistantXI}=ctx;
    let scoutSummary='';
    if(scoutPlus){
      const probs=available.map(p=>({p,pct:estimatedStarterProbability(p)}));
      const safe=probs.filter(x=>x.pct>=70).length;
      const risk=probs.filter(x=>x.pct<40).length;
      const best=probs.slice().sort((a,b)=>b.pct-a.pct)[0];
      scoutSummary=`<div class="mc-premium active"><div class="mc-premium-head"><div><span>🎯 SCOUT PLUS</span><h3>Titolarità della tua rosa</h3></div><b>ATTIVO</b></div><div class="dc-premium-kpis"><div><strong>${safe}</strong><span>≥70%</span></div><div><strong>${risk}</strong><span>&lt;40%</span></div><div><strong>${best?`${best.pct}%`:'—'}</strong><span>STIMA PIÙ ALTA</span></div></div></div>`;
    }else{
      scoutSummary=`<div class="mc-premium locked"><div class="mc-premium-head"><div><span>🎯 SCOUT PLUS</span><h3>Titolarità stimata</h3></div><b>🔒 NON ATTIVO</b></div><p>Sblocca la probabilità stimata di titolarità per ogni giocatore della tua rosa.</p></div>`;
    }
    let dataSummary='';
    if(dataPro){
      const withVotes=roster.map(p=>{const st=playerSeasonStat(p.id)||emptyPlayerSeasonStat(p);return {p,st,fm:st.voteCount?Number(st.fantasySum||0)/Number(st.voteCount):null,mv:st.voteCount?Number(st.voteSum||0)/Number(st.voteCount):null,form:playerFormMetrics(p.id)}}).filter(x=>x.fm!==null);
      const bestFm=withVotes.slice().sort((a,b)=>b.fm-a.fm)[0];
      const hot=withVotes.slice().sort((a,b)=>b.form.score-a.form.score)[0];
      const teamFm=withVotes.length?withVotes.reduce((s,x)=>s+x.fm,0)/withVotes.length:null;
      const favorableCount=roster.filter(p=>serieAMatchupDifficulty(p,day)?.key==='favorable').length;
      dataSummary=`<div class="mc-premium active"><div class="mc-premium-head"><div><span>📊 FANTADATA PRO</span><h3>Rendimento + calendario Serie A</h3></div><b>ATTIVO</b></div><div class="dc-premium-kpis"><div><strong>${teamFm===null?'—':teamFm.toFixed(2)}</strong><span>FM MEDIA</span></div><div><strong>${bestFm?escapeHtml(bestFm.p.name):'—'}</strong><span>MIGLIOR FM</span></div><div><strong>${hot?escapeHtml(hot.p.name):'—'}</strong><span>PIÙ IN FORMA</span></div><div><strong>${favorableCount}</strong><span>MATCH FAVOREVOLI</span></div></div></div>`;
    }else{
      dataSummary=`<div class="mc-premium locked"><div class="mc-premium-head"><div><span>📊 FANTADATA PRO</span><h3>Rendimento dettagliato</h3></div><b>🔒 NON ATTIVO</b></div><p>Sblocca media voto, fantamedia, forma numerica, ultime 5 prestazioni e difficoltà dell’avversario Serie A.</p></div>`;
    }
    const assistantSummary=assistant
      ? `<div class="mc-premium assistant active"><div class="mc-premium-head"><div><span>🧠 ASSISTENTE TECNICO</span><h3>Selezione automatica</h3></div><b>ATTIVO</b></div><div class="mc-assistant-advice"><strong>Modulo AUTO XI suggerito: ${assistantFormation}</strong><p>${assistantAutoLineupAnalysisHtml(season)}</p><span>I giocatori marcati <b>AUTO XI</b> sono quelli che l'Assistente schiererebbe oggi.</span><button id="dataCenterOpenLineup" class="primary">VAI A SCHIERA FORMAZIONE →</button></div></div>`
      : `<div class="mc-premium assistant locked"><div class="mc-premium-head"><div><span>🧠 ASSISTENTE TECNICO</span><h3>AUTO XI e gestione formazione</h3></div><b>🔒 NON ATTIVO</b></div><p>Sblocca il modulo consigliato e l'indicazione dei giocatori che AUTO XI schiererebbe, usando solo i dati degli abbonamenti che possiedi.</p></div>`;
    return {scoutSummary,dataSummary,assistantSummary};
  }

  function renderDataCenterOverviewPanel(ctx=dataCenterContext()){
    const body=$('datacenterOverviewBody');
    if(!body || !ctx) return;
    const {day,roster,available,unavailable,avgOvr,totals}=ctx;
    const {scoutSummary,dataSummary,assistantSummary}=dataCenterPremiumHtml(ctx);
    const moved=roster.map(p=>evolutionPlayerData(p,ctx.season)).filter(x=>x&&x.delta!==0);
    const growing=moved.filter(x=>x.delta>0).length;
    const falling=moved.filter(x=>x.delta<0).length;
    body.innerHTML=`
      <section class="mc-hero dc-hero">
        <div class="mc-opponent-identity dc-team-identity"><span class="fixture-tag">LA TUA ROSA</span><h3>${escapeHtml(state.teamName||ctx.me.team)}</h3><p>Dati aggiornati alla giornata ${day}</p></div>
        <div class="mc-kpis dc-kpis"><div><strong>${roster.length}</strong><span>GIOCATORI</span></div><div><strong>${available.length}</strong><span>DISPONIBILI</span></div><div><strong>${unavailable.length}</strong><span>OUT</span></div><div><strong>${avgOvr.toFixed(1)}</strong><span>OVR MEDIO</span></div></div>
      </section>
      <section class="dc-overview-grid">
        <article class="mc-card dc-free-summary"><div class="mc-card-head"><span>DATI BASE · GRATUITI</span><strong>Produzione stagionale della rosa</strong></div><div class="dc-free-kpis"><div><b>${totals.goals}</b><small>GOL ROSA</small></div><div><b>${totals.assists}</b><small>ASSIST ROSA</small></div><div><b>${totals.apps}</b><small>PRESENZE TOTALI</small></div><div><b>${totals.minutes}</b><small>MINUTI TOTALI</small></div></div></article>
        <article class="mc-card dc-evolution-summary"><div class="mc-card-head"><span>EVOLUZIONE ROSA</span><strong>OVR rispetto all'inizio stagione</strong></div><div class="dc-free-kpis"><div><b>${moved.length}</b><small>HANNO CAMBIATO OVR</small></div><div><b class="positive">${growing}</b><small>IN CRESCITA</small></div><div><b class="negative">${falling}</b><small>IN CALO</small></div><div><b>${roster.length-moved.length}</b><small>STABILI</small></div></div></article>
      </section>
      <section class="mc-grid two dc-premium-grid">${scoutSummary}${dataSummary}</section>
      ${assistantSummary}`;
    body.querySelector('#dataCenterOpenLineup')?.addEventListener('click',()=>requestOpenLineup());
  }

  function dataCenterPlayerRowHtml(p,ctx){
    const {day,dataPro,scoutPlus,assistant,assistantXI}=ctx;
    const st=playerSeasonStat(p.id)||emptyPlayerSeasonStat(p);
    const status=playerStatusForDay(p.id,day);
    const form=playerFormMetrics(p.id);
    const mv=Number(st.voteCount||0)>0?Number(st.voteSum||0)/Number(st.voteCount):null;
    const fm=Number(st.voteCount||0)>0?Number(st.fantasySum||0)/Number(st.voteCount):null;
    const pct=scoutPlus?estimatedStarterProbability(p):null;
    const pctClass=pct===null?'':pct>=70?'high':pct>=40?'medium':'low';
    const serieAFixture=serieAFixtureForPlayer(p,day);
    const serieADifficulty=dataPro?serieAMatchupDifficulty(p,day):null;
    const recent=dataPro&&form.recent.length?form.recent.map(x=>`<span title="G${Number(x.day||0)} · FV ${Number(x.fantasy||0).toFixed(1)}">${Number(x.vote).toFixed(1)}</span>`).join(''):'';
    const assistantLabel=assistant?(assistantXI.has(String(p.id))?'<b class="dc-auto-xi starter">✓ AUTO XI</b>':'<b class="dc-auto-xi bench">PANCHINA</b>'):'<span class="dc-locked">🔒 Assistente</span>';
    const evo=evolutionPlayerData(p,ctx.season);
    const evoDir=evo.delta>0?'positive':evo.delta<0?'negative':'neutral';
    return `<button type="button" class="dc-player-row dc-player-row-evolution ${status.unavailable?'is-unavailable':''}" data-season-player="${escapeHtml(p.id)}">
      <span class="lineup-role-chip role-${escapeHtml(p.role)}">${escapeHtml(p.role)}</span>
      <span class="dc-player-name"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.club||'')} · OVR ${playerOvrLabel(p)}</small><em class="dc-seriea-fixture">${serieAFixture?`vs ${escapeHtml(serieAFixture.opponentName)} · ${serieAFixture.home?'Casa':'Trasferta'}`:'Serie A · —'}</em></span>
      <span class="dc-status ${status.className}"><b>${status.unavailable?'OUT':'OK'}</b><small>${escapeHtml(status.unavailable?status.label:'Disponibile')}</small></span>
      <span class="dc-base-stats"><b>P ${Number(st.appearances||0)} · T ${Number(st.starts||0)}</b><small>${Number(st.minutes||0)} min · ⚽ ${Number(st.goals||0)} · 🅰 ${Number(st.assists||0)}</small></span>
      <span class="dc-evolution-cell ${evoDir}"><small>EVOLUZIONE</small><b>${evo.base} → ${evo.current}</b><em>${evo.delta>0?'+':''}${evo.delta}</em></span>
      <span class="dc-scout-cell ${scoutPlus?pctClass:'locked'}">${scoutPlus?`<b>${pct}%</b><small>Titolarità stimata</small>`:'<b>🔒</b><small>Scout Plus</small>'}</span>
      <span class="dc-data-cell ${dataPro?'active':'locked'}">${dataPro?`<b>MV ${mv===null?'—':mv.toFixed(2)} · FM ${fm===null?'—':fm.toFixed(2)}</b><small>${form.count?`${form.arrow} forma ${form.avg.toFixed(2)}`:'Forma N/D'}</small>${serieADifficulty?serieAMatchupBadgeHtml(p,day):''}${recent?`<em class="dc-recent">${recent}</em>`:''}`:`<b>${escapeHtml(qualitativeFormLabel(form))}</b><small>🔒 numeri + difficoltà partita FantaData</small>`}</span>
      <span class="dc-assistant-cell">${assistantLabel}</span>
      <span class="dc-row-arrow">→</span>
    </button>`;
  }

  function renderDataCenterPlayersPanel(ctx=dataCenterContext()){
    const body=$('datacenterPlayersBody');
    if(!body || !ctx) return;
    const roleOrder={P:0,D:1,C:2,A:3};
    const rows=ctx.roster.slice().sort((a,b)=>{
      const ar=roleOrder[a.role]??9,br=roleOrder[b.role]??9;
      if(ar!==br) return ar-br;
      return currentPlayerOvr(b)-currentPlayerOvr(a) || String(a.name).localeCompare(String(b.name),'it');
    });
    body.innerHTML=`<section class="mc-card dc-roster-card dc-embedded-roster"><div class="mc-card-head"><div><span>GIOCATORI</span><strong>Rendimento, disponibilità ed evoluzione in una sola vista</strong></div><small>Clicca un giocatore per la scheda completa</small></div><div class="dc-column-legend dc-column-legend-evolution"><span>BASE</span><span>EVOLUZIONE</span><span>SCOUT PLUS</span><span>FANTADATA</span><span>ASSISTENTE</span></div><div class="dc-player-list">${rows.map(p=>dataCenterPlayerRowHtml(p,ctx)).join('')}</div></section>`;
    wireSeasonPlayerButtons(body);
  }

  function renderDataCenterEvolutionPanel(){
    const season=ensureSeasonState();
    if(!season) return;
    const all=(window.FANTA_PLAYERS||[]).map(p=>evolutionPlayerData(p,season)).filter(Boolean);
    const changed=all.filter(x=>x.history.length>0);
    const rising=all.filter(x=>x.delta>0).sort((a,b)=>b.delta-a.delta || Number(b.last?.day||0)-Number(a.last?.day||0));
    const falling=all.filter(x=>x.delta<0).sort((a,b)=>a.delta-b.delta || Number(b.last?.day||0)-Number(a.last?.day||0));
    const myRoster=all.filter(x=>x.owner?.manager?.id==='user');
    const myMoved=myRoster.filter(x=>x.history.length>0);
    const metaTotal=Object.values(season.ovrEvolutionMeta||{}).reduce((sum,m)=>sum+Number(m?.actual||0),0);
    const totalEvents=metaTotal || Number(season.playerDevelopmentEvents?.length||0);
    if($('evolutionTotalEvents')) $('evolutionTotalEvents').textContent=String(totalEvents);
    if($('evolutionGrowingCount')) $('evolutionGrowingCount').textContent=String(rising.length);
    if($('evolutionFallingCount')) $('evolutionFallingCount').textContent=String(falling.length);
    if($('evolutionMyMovedCount')) $('evolutionMyMovedCount').textContent=String(myMoved.length);
    const emptyHighlight='<div class="evolution-empty-mini">Nessun movimento ancora. Le variazioni appariranno dopo le prime giornate.</div>';
    if($('evolutionRisers')) $('evolutionRisers').innerHTML=rising.length?rising.slice(0,4).map(evolutionHighlightHtml).join(''):emptyHighlight;
    if($('evolutionFallers')) $('evolutionFallers').innerHTML=falling.length?falling.slice(0,4).map(evolutionHighlightHtml).join(''):emptyHighlight;
    const filterButtons=document.querySelectorAll('#datacenterEvolutionPanel [data-evolution-filter]');
    filterButtons.forEach(btn=>btn.classList.toggle('active',btn.dataset.evolutionFilter===evolutionFilter));
    let visible=[];
    if(evolutionFilter==='mine') visible=myRoster.slice().sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta) || Number(b.last?.day||0)-Number(a.last?.day||0) || b.current-a.current);
    else if(evolutionFilter==='rising') visible=rising.slice();
    else if(evolutionFilter==='falling') visible=falling.slice();
    else if(evolutionFilter==='all') visible=all.slice().sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta) || b.current-a.current);
    else visible=changed.slice().sort((a,b)=>Number(b.last?.day||0)-Number(a.last?.day||0) || Math.abs(b.delta)-Math.abs(a.delta));
    const subtitles={movers:`${visible.length} giocatori hanno già registrato almeno una variazione OVR.`,mine:`La tua rosa: ${myMoved.length} su ${myRoster.length} giocatori hanno già cambiato OVR.`,rising:`${visible.length} giocatori sono sopra il loro OVR iniziale.`,falling:`${visible.length} giocatori sono sotto il loro OVR iniziale.`,all:`Tutti i ${visible.length} giocatori della Serie A virtuale.`};
    if($('evolutionListSubtitle')) $('evolutionListSubtitle').textContent=subtitles[evolutionFilter]||subtitles.movers;
    const list=$('evolutionPlayersList');
    if(list){
      list.innerHTML=visible.length?visible.map(evolutionPlayerRowHtml).join(''):`<div class="evolution-empty-state"><strong>Nessun giocatore in questa categoria.</strong><span>Continua la stagione: crescita, cali, allenamenti e rendimento alimenteranno questa schermata.</span></div>`;
      wireSeasonPlayerButtons(list);
    }
    wireSeasonPlayerButtons($('evolutionRisers'));
    wireSeasonPlayerButtons($('evolutionFallers'));
    filterButtons.forEach(btn=>{btn.onclick=()=>{evolutionFilter=btn.dataset.evolutionFilter||'movers';renderDataCenterEvolutionPanel();};});
  }

  function setDataCenterTab(tab){
    if(!['overview','players','evolution'].includes(tab)) tab='overview';
    dataCenterTab=tab;
    document.querySelectorAll('#leagueDataCenterScreen [data-datacenter-tab]').forEach(btn=>{
      const active=btn.dataset.datacenterTab===tab;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-selected',String(active));
    });
    document.querySelectorAll('#leagueDataCenterScreen [data-datacenter-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.datacenterPanel===tab));
    const ctx=dataCenterContext();
    if(tab==='overview') renderDataCenterOverviewPanel(ctx);
    else if(tab==='players') renderDataCenterPlayersPanel(ctx);
    else renderDataCenterEvolutionPanel();
  }

  function renderLeagueDataCenterScreen(tab=dataCenterTab){
    stopHubNewsCarousel();
    if(!ensureSeasonState()) return renderSummary();
    showScreen('leagueDataCenterScreen');
    renderLeagueNavActive('datacenter');
    renderCareerWallets();
    setDataCenterTab(tab);
  }

  function renderLeagueEvolutionScreen(){
    renderLeagueDataCenterScreen('evolution');
  }


  function socialOwnedPlayers(){
    const user=managerById('user');
    return (user?.roster||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'it'));
  }

  function socialHandle(player){
    const clean=String(player?.name||'giocatore')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.+|\.+$/g,'');
    return `@${clean||'giocatore'}`;
  }

  function socialPersonality(player){
    const roll=careerHash(`social-personality|${player?.id}`);
    if(roll<.25) return {id:'ambitious',label:'AMBIZIOSO',desc:'Apprezza obiettivi chiari e pressione positiva.',pressure:.12,support:.02,praise:.04,spam:.02};
    if(roll<.50) return {id:'sensitive',label:'SENSIBILE',desc:'Reagisce bene alla fiducia, male alla pressione.',pressure:-.15,support:.14,praise:.07,spam:.07};
    if(roll<.75) return {id:'proud',label:'ORGOGLIOSO',desc:'Ama essere riconosciuto, sopporta poco le critiche.',pressure:-.06,support:.04,praise:.15,spam:.05};
    return {id:'reserved',label:'RISERVATO',desc:'Preferisce pochi messaggi e toni tranquilli.',pressure:-.04,support:.07,praise:.05,spam:.10};
  }

  function ensureSocialState(season=state?.season){
    if(!season || !season.started) return null;
    if(!season.social || typeof season.social!=='object') season.social={conversations:{},motivationByDay:{},activity:[]};
    if(!season.social.conversations || typeof season.social.conversations!=='object') season.social.conversations={};
    if(!season.social.motivationByDay || typeof season.social.motivationByDay!=='object') season.social.motivationByDay={};
    if(!Array.isArray(season.social.activity)) season.social.activity=[];

    socialOwnedPlayers().forEach(player=>{
      const id=String(player.id);
      const conv=season.social.conversations[id] ||= {
        playerId:id,followed:true,blocked:false,relationship:50,totalMessages:0,lastMessageDay:0,lastReaction:'none',messages:[]
      };
      conv.followed=true;
      if(!Array.isArray(conv.messages)) conv.messages=[];
      if(!Number.isFinite(Number(conv.relationship))) conv.relationship=50;
      if(!Number.isFinite(Number(conv.totalMessages))) conv.totalMessages=0;
      if(conv.blocked===undefined) conv.blocked=false;
    });
    return season.social;
  }

  function socialConversation(playerId,season=state?.season){
    const social=ensureSocialState(season);
    if(!social) return null;
    return social.conversations[String(playerId)]||null;
  }

  function socialMotivationForPlayer(playerId,day){
    return state?.season?.social?.motivationByDay?.[String(day)]?.[String(playerId)]||null;
  }

  function socialRelationLabel(value){
    const n=Number(value||0);
    if(n>=72) return 'RAPPORTO OTTIMO';
    if(n>=58) return 'RAPPORTO BUONO';
    if(n>=42) return 'RAPPORTO NORMALE';
    if(n>=25) return 'RAPPORTO TESO';
    return 'RAPPORTO DIFFICILE';
  }

  function socialMessageTone(text){
    const norm=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const has=(words)=>words.some(w=>norm.includes(w));
    if(has(['grande','bravo','complimenti','orgoglioso','continua cosi','ottimo','super','fenomeno'])) return 'praise';
    if(has(['credo in te','fiducia','testa alta','tranquillo','forza','dai','sono con te','puoi farcela'])) return 'support';
    if(has(['reazione','devi','pretendo','sveglia','voglio di piu','dimostrami','non basta','panchina'])) return 'pressure';
    if(has(['scarso','vergogna','inutile','fai schifo','ridicolo','disastro'])) return 'hostile';
    return 'neutral';
  }

  function socialReactionData(player,text,conv,day){
    const profile=socialPersonality(player);
    const tone=socialMessageTone(text);
    const outgoing=(conv.messages||[]).filter(m=>m.sender==='user');
    const sameDay=outgoing.filter(m=>Number(m.day)===Number(day)).length;
    const recent=outgoing.filter(m=>Number(m.day)>=Number(day)-2).length;
    const form=playerFormMetrics(player.id);
    const relation=Number(conv.relationship||50);

    let toneGood=0;
    let toneBad=0;
    if(tone==='support') toneGood+=profile.support;
    else if(tone==='praise') toneGood+=profile.praise;
    else if(tone==='pressure') { toneGood+=profile.pressure; toneBad+=profile.pressure<0?Math.abs(profile.pressure)*.72:0; }
    else if(tone==='hostile') { toneGood-=.22; toneBad+=.32; }

    if(form.score<-.45 && tone==='support') toneGood+=.08;
    if(form.score<-.45 && tone==='pressure') toneBad+=.07;
    if(form.score>.45 && tone==='praise') toneGood+=.05;

    const spamPenalty=Math.max(0,sameDay-1)*.15 + Math.max(0,recent-4)*.055;
    const relationBias=clamp((relation-50)/100,-.20,.20);

    let blockChance=0;
    if(sameDay>=3) blockChance=.08 + (sameDay-3)*.22 + profile.spam;
    if(recent>=7) blockChance+=.10;
    if(relation<28) blockChance+=.10;
    if(tone==='hostile') blockChance+=.12;
    blockChance=clamp(blockChance,0,.88);

    const signature=`${day}|${player.id}|${conv.totalMessages+1}|${String(text).slice(0,64)}`;
    if(sameDay>=3 && careerHash(`social-block|${signature}`)<blockChance){
      return {outcome:'blocked',tone,profile,voteDelta:-.25,relationshipDelta:-18};
    }

    let goodChance=clamp(.40+toneGood+relationBias*.45-spamPenalty*.60,.10,.76);
    let badChance=clamp(.22+toneBad-relationBias*.22+spamPenalty*.72,.10,.68);
    if(goodChance+badChance>.88){
      const scale=.88/(goodChance+badChance);
      goodChance*=scale; badChance*=scale;
    }

    const roll=careerHash(`social-reaction|${signature}`);
    if(roll<goodChance) return {outcome:'good',tone,profile,voteDelta:.25,relationshipDelta:6};
    if(roll<goodChance+badChance) return {outcome:'bad',tone,profile,voteDelta:-.25,relationshipDelta:-7};
    return {outcome:'neutral',tone,profile,voteDelta:0,relationshipDelta:1};
  }

  function socialReplyText(player,reaction){
    const key=Math.floor(careerHash(`social-reply|${player.id}|${state?.season?.currentMatchday}|${socialConversation(player.id)?.totalMessages||0}`)*4);
    const replies={
      good:[
        'Grazie mister 🙏 Mi serviva sentirlo.',
        'Messaggio ricevuto 💪 Oggi voglio ripagare la fiducia.',
        'Grazie! Testa giusta e andiamo forte 🔥',
        'Apprezzo davvero, mister. Darò tutto.'
      ],
      neutral:[
        'Ricevuto mister 👍',
        'Ok, ci vediamo in campo.',
        'Va bene mister.',
        'Capito. Pensiamo alla partita.'
      ],
      bad:[
        'Mister, così mi metti solo più pressione.',
        'Preferirei parlare di queste cose di persona.',
        'Non penso che questi messaggi mi aiutino.',
        'Ho capito, ma non mi è piaciuto il tono.'
      ],
      blocked:[
        'Basta messaggi, mister.',
        'Preferisco non ricevere altri messaggi.',
        'Così è troppo. Chiudiamola qui.',
        'Non voglio continuare questa conversazione.'
      ]
    };
    return replies[reaction.outcome]?.[key]||'Ricevuto.';
  }

  function socialRecordMotivation(player,reaction,day,messageId){
    const season=state?.season;
    const social=ensureSocialState(season);
    if(!social) return {applied:false,effect:null};
    const dayKey=String(day), id=String(player.id);
    social.motivationByDay[dayKey] ||= {};
    if(social.motivationByDay[dayKey][id]) return {applied:false,effect:social.motivationByDay[dayKey][id]};

    const effect={
      playerId:id,day:Number(day),outcome:reaction.outcome,
      voteDelta:Number(reaction.voteDelta||0),tone:reaction.tone,
      messageId,createdAt:Date.now()
    };
    social.motivationByDay[dayKey][id]=effect;
    return {applied:true,effect};
  }

  function socialSendMessage(playerId,text){
    const season=ensureSeasonState();
    const player=socialOwnedPlayers().find(p=>String(p.id)===String(playerId));
    const conv=socialConversation(playerId,season);
    const clean=String(text||'').trim().slice(0,180);
    if(!season || !player || !conv || !clean) return;
    if(conv.blocked){
      showToast(`${player.name} ti ha bloccato: non puoi più inviargli messaggi.`,true);
      return;
    }

    const day=Number(season.currentMatchday||1);
    const messageId=`dm_${day}_${player.id}_${Date.now()}`;
    const outgoing={id:messageId,sender:'user',text:clean,day,createdAt:Date.now()};
    conv.messages.push(outgoing);
    conv.totalMessages=Number(conv.totalMessages||0)+1;
    conv.lastMessageDay=day;

    const reaction=socialReactionData(player,clean,conv,day);
    conv.relationship=clamp(Number(conv.relationship||50)+Number(reaction.relationshipDelta||0),0,100);
    conv.lastReaction=reaction.outcome;

    const motivation=socialRecordMotivation(player,reaction,day,messageId);
    const reply=socialReplyText(player,reaction);
    conv.messages.push({
      id:`reply_${messageId}`,sender:'player',text:reply,day,createdAt:Date.now()+1,
      reaction:reaction.outcome
    });

    if(reaction.outcome==='blocked'){
      conv.blocked=true;
      conv.messages.push({
        id:`blocked_${messageId}`,sender:'system',
        text:'Non puoi più inviare messaggi a questo account per il resto della stagione.',
        day,createdAt:Date.now()+2,reaction:'blocked'
      });
    }

    conv.messages=conv.messages.slice(-80);
    season.social.activity.push({
      id:messageId,playerId:String(player.id),day,outcome:reaction.outcome,
      applied:motivation.applied,voteDelta:motivation.applied?Number(reaction.voteDelta||0):0,
      createdAt:Date.now()
    });
    season.social.activity=season.social.activity.slice(-120);

    saveState();
    renderLeagueSocialScreen();

    const feedback = reaction.outcome==='good'
      ? `${player.name} ha reagito bene al messaggio.`
      : reaction.outcome==='bad'
        ? `${player.name} non ha reagito bene.`
        : reaction.outcome==='blocked'
          ? `${player.name} ti ha bloccato.`
          : `${player.name} ha risposto.`;
    showToast(feedback,reaction.outcome==='bad'||reaction.outcome==='blocked');
  }

  function socialPlayerAvatarHtml(player,size='normal'){
    return `<span class="social-player-avatar ${size}">${playerAvatarMarkup(player,player.name)}</span>`;
  }

  function socialConversationPreview(conv){
    const last=(conv?.messages||[]).slice(-1)[0];
    if(!last) return 'Invia il primo messaggio';
    if(last.sender==='system') return '🚫 Non puoi più scrivere';
    return `${last.sender==='user'?'Tu: ':''}${String(last.text||'').slice(0,46)}`;
  }

  function socialStoryHtml(player){
    const conv=socialConversation(player.id);
    const effect=socialMotivationForPlayer(player.id,state?.season?.currentMatchday||1);
    const ring=conv?.blocked?'blocked':effect?.outcome==='good'?'good':effect?.outcome==='bad'?'bad':'default';
    return `<button type="button" class="social-story ${ring} ${String(socialSelectedPlayerId)===String(player.id)?'active':''}" data-social-player="${escapeHtml(player.id)}">
      <span class="social-story-ring">${socialPlayerAvatarHtml(player,'story')}</span>
      <strong>${escapeHtml(String(player.name||'').split(' ')[0])}</strong>
    </button>`;
  }

  function socialConversationRowHtml(player){
    const conv=socialConversation(player.id);
    const active=String(socialSelectedPlayerId)===String(player.id);
    const relation=socialRelationLabel(conv?.relationship);
    return `<button type="button" class="social-conversation-row ${active?'active':''} ${conv?.blocked?'blocked':''}" data-social-player="${escapeHtml(player.id)}">
      ${socialPlayerAvatarHtml(player,'small')}
      <span class="social-conversation-copy">
        <strong>${escapeHtml(player.name)}</strong>
        <small>${escapeHtml(socialConversationPreview(conv))}</small>
      </span>
      <span class="social-conversation-meta">
        <b>${conv?.blocked?'BLOCCATO':escapeHtml(relation.replace('RAPPORTO ',''))}</b>
        <small>${escapeHtml(player.role)} · ${playerOvrLabel(player)}</small>
      </span>
    </button>`;
  }

  function socialMessageHtml(message,player){
    if(message.sender==='system'){
      return `<div class="social-system-message"><span>🚫</span>${escapeHtml(message.text)}</div>`;
    }
    const mine=message.sender==='user';
    const reaction=message.reaction?` reaction-${escapeHtml(message.reaction)}`:'';
    return `<div class="social-message-row ${mine?'mine':'theirs'}${reaction}">
      ${mine?'':socialPlayerAvatarHtml(player,'tiny')}
      <div class="social-message-bubble">
        <p>${escapeHtml(message.text)}</p>
        <small>G${Number(message.day||1)}</small>
      </div>
    </div>`;
  }

  function renderSocialChat(player){
    const season=ensureSeasonState();
    const conv=socialConversation(player.id,season);
    const empty=$('socialChatEmpty'),active=$('socialChatActive');
    if(!conv || !active) return;

    empty?.classList.add('hidden');
    active.classList.remove('hidden');

    const profile=socialPersonality(player);
    const relation=socialRelationLabel(conv.relationship);
    const effect=socialMotivationForPlayer(player.id,season.currentMatchday);
    const effectText=effect
      ? effect.outcome==='good'?'💚 Motivato oggi'
      : effect.outcome==='bad'||effect.outcome==='blocked'?'⚠ Pressione negativa oggi'
      : '💬 Reazione neutra oggi'
      : 'Nessun DM oggi';

    $('socialChatHeader').innerHTML=`
      <div class="social-chat-player">
        ${socialPlayerAvatarHtml(player,'header')}
        <div><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(socialHandle(player))} · ${escapeHtml(clubShort(player.club))}</span></div>
      </div>
      <div class="social-chat-profile">
        <span>${escapeHtml(profile.label)}</span>
        <b>${escapeHtml(relation)}</b>
        <small>${escapeHtml(effectText)}</small>
      </div>`;

    const messages=$('socialChatMessages');
    messages.innerHTML=(conv.messages||[]).length
      ? conv.messages.map(m=>socialMessageHtml(m,player)).join('')
      : `<div class="social-first-message"><div>${socialPlayerAvatarHtml(player,'header')}</div><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(profile.desc)}</span><p>Segui già questo giocatore. Scrivigli un messaggio privato per provare a motivarlo.</p></div>`;

    const input=$('socialMessageInput');
    const send=$('socialSendBtn');
    const info=$('socialComposeInfo');
    const alreadyEffective=!!effect;

    if(input){
      input.disabled=!!conv.blocked;
      input.placeholder=conv.blocked?'Questo giocatore ti ha bloccato':'Scrivi un messaggio...';
    }
    if(send){
      send.disabled=!!conv.blocked;
      send.textContent=conv.blocked?'BLOCCATO':'INVIA';
    }
    $('socialQuickMessages')?.classList.toggle('is-disabled',!!conv.blocked);

    if(info){
      info.className=`social-compose-info ${conv.blocked?'blocked':alreadyEffective?'used':''}`;
      info.textContent=conv.blocked
        ? 'Questo giocatore ti ha bloccato: non puoi più scrivergli per il resto della stagione.'
        : alreadyEffective
          ? 'Hai già influenzato questo giocatore oggi. Altri messaggi non sommano bonus, ma possono irritarlo.'
          : 'La prima reazione di oggi può dare un piccolo bonus, nessun effetto oppure un malus alla prestazione.';
    }

    requestAnimationFrame(()=>{ if(messages) messages.scrollTop=messages.scrollHeight; });
  }

  function renderLeagueSocialScreen(){
    stopHubNewsCarousel();
    const season=ensureSeasonState();
    const social=ensureSocialState(season);
    if(!season || !social) return renderSummary();
    showScreen('leagueSocialScreen');
    renderLeagueNavActive('social');
    renderCareerWallets();

    const players=socialOwnedPlayers();
    if(!players.length) return;

    if(!socialSelectedPlayerId || !players.some(p=>String(p.id)===String(socialSelectedPlayerId))){
      socialSelectedPlayerId=String(players[0].id);
    }

    $('socialFollowingCount').textContent=String(players.length);
    $('socialAccountHandle').textContent=`@${String(state?.teamName||'fantallenatore').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,18)||'fantallenatore'}`;

    const query=String(socialSearchQuery||'').trim().toLowerCase();
    const visible=players.filter(p=>!query || String(p.name||'').toLowerCase().includes(query) || String(clubName(p.club)||'').toLowerCase().includes(query));
    $('socialStories').innerHTML=visible.length
      ? visible.map(socialStoryHtml).join('')
      : '<div class="social-stories-no-results">Nessun giocatore trovato.</div>';

    document.querySelectorAll('#leagueSocialScreen [data-social-player]').forEach(btn=>{
      btn.onclick=()=>{
        socialSelectedPlayerId=String(btn.dataset.socialPlayer);
        renderLeagueSocialScreen();
      };
    });

    const selected=players.find(p=>String(p.id)===String(socialSelectedPlayerId));
    if(selected) renderSocialChat(selected);

    document.querySelectorAll('#leagueSocialScreen [data-social-quick]').forEach(btn=>{
      btn.onclick=()=>{
        const input=$('socialMessageInput');
        if(!input || input.disabled) return;
        input.value=btn.dataset.socialQuick||'';
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.focus();
      };
    });
  }

  function sendCurrentSocialMessage(){
    const input=$('socialMessageInput');
    if(!input || !socialSelectedPlayerId) return;
    const text=input.value.trim();
    if(!text) return;
    input.value='';
    if($('socialMessageCounter')) $('socialMessageCounter').textContent='0/180';
    socialSendMessage(socialSelectedPlayerId,text);
  }



  let shopResizeTimer=0;
  window.addEventListener('resize',()=>{
    clearTimeout(shopResizeTimer);
    shopResizeTimer=setTimeout(()=>{
      if($('leagueShopScreen')?.classList.contains('active')){
        shopPageIndex=0;
        renderShopItems();
      }
    },120);
  });

  function renderLeagueShopScreen(){
    stopHubNewsCarousel();
    const season=ensureSeasonState();
    if(!season) return renderSummary();
    showScreen('leagueShopScreen');
    renderLeagueNavActive('shop');
    renderCareerWallets();
    renderShopItems();
  }

  function expertStarterLabel(pct){
    if(pct>=82) return 'TITOLARITÀ MOLTO ALTA';
    if(pct>=68) return 'TITOLARITÀ ALTA';
    if(pct>=52) return 'TITOLARITÀ MEDIA';
    if(pct>=35) return 'TITOLARITÀ INCERTA';
    return 'RISCHIO PANCHINA';
  }

  function expertAdviceAnalysis(player,mode,day){
    const season=ensureSeasonState();
    const form=playerFormMetrics(player.id);
    const stat=playerSeasonStat(player.id);
    const status=playerStatusForDay(player.id,day);
    if(status.unavailable) return {score:-999999,reasons:['non disponibile'],chips:[]};

    const ovr=currentPlayerOvr(player);
    const starterPct=estimatedStarterProbability(player,day);
    const matchup=serieAMatchupDifficulty(player,day);
    const fixture=serieAFixtureForPlayer(player,day);
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

    score += expertPrecisionScoreBonus(player,mode,day,season);

    const reasons=[];
    const chips=[];

    const starterText=expertStarterLabel(starterPct);
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
    return expertAdviceAnalysis(player,mode,day).score;
  }

  function expertAdviceSentence(player,cfg,analysis){
    const reasons=analysis.reasons||[];
    if(!reasons.length) return cfg.copy;
    const first=reasons[0];
    const rest=reasons.slice(1);
    return `${first.charAt(0).toUpperCase()+first.slice(1)}${rest.length?`; ${rest.join('; ')}`:''}.`;
  }

  // La sorpresa nasce prima del consiglio: l'esperto puo coglierla oppure no.
  // Il sorteggio e lo stato sono separati dalle prestazioni e rimangono identici
  // ricaricando il salvataggio o aprendo piu volte la dashboard.
  const EXPERT_IDS=['professore','fantabomber','moneystats','intuitivo','visionario','sibilla','glitch'];
  const INTUITION_EXPERTS={
    intuitivo:{kinds:['starter','vote'],accuracy:.60,proAccuracy:.88},
    visionario:{kinds:['goal','assist'],accuracy:.46,proAccuracy:.78},
    sibilla:{kinds:['starter','vote'],accuracy:.69,proAccuracy:.92},
    glitch:{kinds:['goal','assist'],accuracy:.38,proAccuracy:.72}
  };
  const INTUITION_KIND_LABEL={starter:'TITOLARITÀ',vote:'VOTO',goal:'GOL',assist:'ASSIST'};

  function expertPrecisionActive(season=null){
    return typeof shopItemActive==='function' && !!shopItemActive('expert_precision',season);
  }

  function expertPrecisionScoreBonus(player,mode,day,season=ensureSeasonState()){
    if(!expertPrecisionActive(season) || !player) return 0;
    const daily=season?.expertDays?.[String(Math.max(1,Number(day||season.currentMatchday||1)))];
    const boost=daily?.boosts?.find(item=>String(item.playerId)===String(player.id));
    if(!boost) return 0;
    const large=boost.size==='large';
    if(mode==='form' && ['starter','vote'].includes(boost.kind)) return large?11:7;
    if(mode==='attack' && ['goal','assist'].includes(boost.kind)) return large?12:8;
    if(mode==='data') return large?7:4.5;
    return 0;
  }

  function expertDayState(day){
    const season=state?.season;
    const manager=managerById('user');
    if(!season || !manager) return null;
    if(!season.expertDays || typeof season.expertDays!=='object') season.expertDays={};
    const key=String(Math.max(1,Number(day||season.currentMatchday||1)));
    const precisionActive=expertPrecisionActive(season);
    const cached=season.expertDays[key];
    if(cached && !!cached.precisionActive===precisionActive) return cached;
    const seasonNo=Number(state?.career?.seasonNumber||1);
    const hash=(label)=>careerHash(`experts|season${seasonNo}|day${key}|${label}`);
    const eligible=(manager.roster||[]).filter(p=>{
      const canonical=playerMap.get(String(p.id));
      return canonical && canonical.marketStatus!=='abroad' && !playerStatusForDay(p.id,Number(key)).unavailable;
    });
    const shuffled=eligible.slice().sort((a,b)=>hash(`boost-player|${a.id}`)-hash(`boost-player|${b.id}`));
    const countRoll=hash('boost-count');
    const count=countRoll<.24?0:countRoll<.82?1:2;
    const kinds=['starter','vote','goal','assist'];
    const boosts=shuffled.slice(0,count).map((player,index)=>({
      playerId:String(player.id),
      kind:kinds[Math.floor(hash(`boost-kind|${index}|${player.id}`)*kinds.length)],
      size:hash(`boost-size|${index}|${player.id}`)<.7?'small':'large'
    }));
    const experts=EXPERT_IDS.slice().sort((a,b)=>hash(`visible|${a}`)-hash(`visible|${b}`)).slice(0,3);
    const forecasts={};
    Object.entries(INTUITION_EXPERTS).forEach(([id,cfg])=>{
      if(!eligible.length) return;
      const relevant=boosts.filter(boost=>cfg.kinds.includes(boost.kind));
      const accuracy=precisionActive?cfg.proAccuracy:cfg.accuracy;
      const hits=relevant.length && hash(`hit|${id}`)<accuracy;
      const misses=eligible.filter(p=>!boosts.some(boost=>boost.playerId===String(p.id)));
      const pool=hits?relevant:misses.length?misses:eligible;
      const index=Math.floor(hash(`pick|${id}`)*pool.length);
      const picked=pool[index];
      const playerId=String(hits?picked.playerId:picked.id);
      const kind=hits?picked.kind:cfg.kinds[Math.floor(hash(`claim|${id}`)*cfg.kinds.length)];
      forecasts[id]={playerId,kind};
    });
    return season.expertDays[key]={experts,boosts,forecasts,precisionActive};
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
    if(INTUITION_EXPERTS[cfg.id]){
      if(cfg.id==='intuitivo'){
        const day=typeof state!=='undefined'?(state?.season?.currentMatchday||1):1;
        const season=typeof state!=='undefined'?(state?.career?.seasonNumber||1):1;
        const seed=`intuitivo-voice|${season}|${day}|${player.id||player.name}|${forecast?.kind}`;
        const index=typeof careerHash==='function'?Math.min(2,Math.floor(careerHash(seed)*3)):0;
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
        const day=typeof state!=='undefined'?(state?.season?.currentMatchday||1):1;
        const season=typeof state!=='undefined'?(state?.career?.seasonNumber||1):1;
        const seed=`visionario-voice|${season}|${day}|${player.id||player.name}|${forecast?.kind}`;
        const index=typeof careerHash==='function'?Math.min(2,Math.floor(careerHash(seed)*3)):0;
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

  let expertStoryState=null;

  function renderExpertStory(){
    const modal=$('expertReasonModal');
    if(!modal?.classList.contains('show') || !expertStoryState) return;
    const {paragraphs,step}=expertStoryState;
    $('expertStoryCounter').textContent=`${step+1} / ${paragraphs.length}`;
    $('expertReasonBody').innerHTML=`<p><small>PARTE ${step+1}</small>${escapeHtml(paragraphs[step])}</p>`;
    $('expertStoryPrev').disabled=step===0;
    $('expertStoryNext').textContent=step===paragraphs.length-1?'HO CAPITO ✓':'CONTINUA →';
  }

  function changeExpertStoryStep(delta){
    if(!expertStoryState) return;
    if(delta>0 && expertStoryState.step>=expertStoryState.paragraphs.length-1){
      closeExpertReason();return;
    }
    expertStoryState.step=Math.max(0,Math.min(expertStoryState.paragraphs.length-1,expertStoryState.step+delta));
    renderExpertStory();
  }

  function closeExpertReason(){
    const modal=$('expertReasonModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    expertStoryState=null;
    const previous=modal._returnFocus;
    if(previous?.isConnected) previous.focus();
  }

  function openExpertReason(cfg,player,analysis,forecast,trigger){
    const modal=$('expertReasonModal');
    if(!modal || !player) return;
    modal._returnFocus=trigger;
    $('expertReasonAvatar').src=cfg.avatar;
    $('expertReasonAvatar').alt=cfg.name;
    const precision=expertPrecisionActive(ensureSeasonState());
    $('expertReasonTag').textContent=`${cfg.tag} · ${precision?'ESPERTI PRO · ':''}GIORNATA ${ensureSeasonState()?.currentMatchday||1}`;
    $('expertReasonTitle').textContent=cfg.name;
    $('expertStoryRole').textContent=precision?'CONSIGLIO PRO':'IL SUO CONSIGLIO';
    $('expertReasonPlayer').textContent=player.name;
    $('expertStoryPlayerFace').innerHTML=playerAvatarMarkup(player,'');
    expertStoryState={paragraphs:expertReasonParagraphs(cfg,player,analysis,forecast,precision),step:0};
    const socialSeed=`expert-video|${state?.career?.seasonNumber||1}|${ensureSeasonState()?.currentMatchday||1}|${cfg.id}`;
    [['expertStoryLikes',120,18000],['expertStoryComments',8,900],['expertStoryShares',15,2400]].forEach(([id,min,max])=>{
      $(id).textContent=Math.floor(min+careerHash(`${socialSeed}|${id}`)*(max-min+1)).toLocaleString('it-IT');
    });
    modal.classList.toggle('is-pro',precision);
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    renderExpertStory();
    modal.querySelector('.expert-reason-close')?.focus();
  }

  function renderExpertAdvice(){
    const grid=$('expertAdviceGrid');
    const season=ensureSeasonState();
    const user=managerById('user');
    if(!grid || !season || !user) return;
    const day=season.currentMatchday||1;
    const precisionActive=expertPrecisionActive(season);
    if($('expertAdviceStatus')) $('expertAdviceStatus').textContent=precisionActive?'ESPERTI PRO ATTIVO · previsioni molto più affidabili':'Consigli generati sui dati della tua rosa';
    const available=(user.roster||[]).filter(p=>!playerStatusForDay(p.id,day).unavailable);
    const daily=expertDayState(day);
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
      if(INTUITION_EXPERTS[cfg.id]){
        const forecast=daily.forecasts[cfg.id];
        const player=available.find(p=>String(p.id)===forecast?.playerId)||null;
        return {cfg,player,analysis:null,forecast};
      }
      const ranked=available
        .map(player=>({player,analysis:expertAdviceAnalysis(player,cfg.mode,day)}))
        .sort((a,b)=>b.analysis.score-a.analysis.score);
      const best=ranked[0]||null;
      return best?{cfg,player:best.player,analysis:best.analysis}:{cfg,player:null,analysis:null};
    });

    grid.innerHTML=picks.map(({cfg,player,analysis,forecast})=>{
      if(!player) return `<article class="expert-advice-card"><div class="expert-avatar">${cfg.avatar?`<img src="${escapeHtml(cfg.avatar)}" alt="${escapeHtml(cfg.name)}">`:'?'}</div><div><span>${cfg.tag}</span><strong>${cfg.name}</strong><p>Nessun consiglio disponibile.</p></div></article>`;

      const intuitive=!!INTUITION_EXPERTS[cfg.id];
      const form=analysis?.form;
      const headline=intuitive?`POSSIBILE SORPRESA · ${INTUITION_KIND_LABEL[forecast.kind]}`:form?.count
        ? `${qualitativeFormLabel(form)} · ${expertStarterLabel(analysis.starterPct)}`
        : `OVR ${playerOvrLabel(player)} · ${expertStarterLabel(analysis.starterPct)}`;
      const sentence=intuitive?intuitionExpertSentence(cfg,forecast.kind,precisionActive):expertAdviceSentence(player,cfg,analysis);
      const chips=intuitive?'':(analysis.chips||[]).map(chip=>`<span>${escapeHtml(chip)}</span>`).join('');

      return `<button type="button" class="expert-advice-card expert-advice-button${intuitive?' expert-advice-intuition':''}" data-expert-reason="${escapeHtml(cfg.id)}" aria-label="Leggi perché ${escapeHtml(cfg.name)} consiglia ${escapeHtml(player.name)}">
        <div class="expert-avatar">${cfg.avatar?`<img src="${escapeHtml(cfg.avatar)}" alt="${escapeHtml(cfg.name)}">`:escapeHtml(cfg.name.slice(0,1))}</div>
        <div class="expert-advice-copy">
          <span>${cfg.tag}${precisionActive?' · PRO':''} · ${escapeHtml(headline)}</span>
          <strong>${cfg.name}</strong>
          <p>"${precisionActive?'Oggi punterei con più fiducia su':intuitive?'Terrei d’occhio':'Per questa giornata sceglierei'} <b>${escapeHtml(player.name)}</b>. ${escapeHtml(sentence)}"</p>
          <div class="expert-context-row">${chips}</div>
        </div>
        <div class="expert-player-pill"><small>${escapeHtml(player.role||'')}</small><b>${escapeHtml(player.name)}</b><em>OVR ${playerOvrLabel(player)}</em></div>
      </button>`;
    }).join('');
    grid.querySelectorAll('[data-expert-reason]').forEach(button=>button.addEventListener('click',()=>{
      const chosen=picks.find(item=>item.cfg.id===button.dataset.expertReason);
      if(chosen?.player) openExpertReason(chosen.cfg,chosen.player,chosen.analysis,chosen.forecast,button);
    }));
  }

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

  function ensureSeasonNewsState(season=ensureSeasonState()){
    if(!season) return null;
    if(!Array.isArray(season.newsFeed)) season.newsFeed=[];
    if(!season.newsGeneratedDays || typeof season.newsGeneratedDays!=='object') season.newsGeneratedDays={};
    if(!season.newsMeta || typeof season.newsMeta!=='object') season.newsMeta={};
    return season;
  }

  function addSeasonNews(item){
    const season=ensureSeasonNewsState();
    if(!season || !item) return null;
    const id=String(item.id||`news_${Date.now()}_${season.newsFeed.length}`);
    const existing=season.newsFeed.find(n=>String(n.id)===id);
    if(existing) return existing;
    const entry={
      id,
      day:clamp(Number(item.day||season.currentMatchday||1),1,FANTASY_SEASON_MATCHDAYS),
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
    const season=ensureSeasonState();
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
      const r=fantasyResultForManager(d,managerId);
      if(r) items.push(r);
    }
    return items;
  }

  function managerStreak(managerId,throughDay){
    const results=recentManagerRun(managerId,throughDay,6).slice().reverse();
    if(!results.length) return {type:null,count:0};
    const type=results[0].outcome;
    let count=0;
    for(const r of results){ if(r.outcome!==type) break; count++; }
    return {type,count};
  }

  function newsFixtureForDay(day){
    const season=ensureSeasonState();
    const round=season?.schedule?.[Number(day)-1];
    return (round?.matches||[]).find(m=>m.homeId==='user'||m.awayId==='user')||null;
  }

  function generatePreMatchNews(day){
    const season=ensureSeasonNewsState();
    if(!season) return;
    const key=`pre:${day}`;
    if(season.newsGeneratedDays[key]) return;
    const user=managerById('user');
    const fixture=newsFixtureForDay(day);
    const oppId=fixture?.homeId==='user'?fixture?.awayId:fixture?.homeId;
    const opponent=managerById(oppId);
    const stamp=Date.now();
    let created=0;
    const add=(suffix,priority,type,title,detail,opts={})=>{
      addSeasonNews({id:`pre_${day}_${suffix}`,day,stage:'pre',priority,type,title,detail,createdAt:stamp+created,...opts});
      created++;
    };

    if(day===1){
      add('kickoff',72,'info','La stagione può cominciare',`${state.teamName} debutta nella Fantallenatore League. Da oggi risultati, forma e indisponibili alimenteranno il notiziario.`,{expiresAfter:1});
    }

    const userOut=(user?.roster||[]).map(player=>({player,status:playerStatusForDay(player.id,day)})).filter(x=>x.status.unavailable);
    userOut.slice(0,2).forEach(({player,status},i)=>{
      add(`user_out_${player.id}`,120-i,status.type==='suspension'?'suspension':'injury',`${player.name} non sarà disponibile`,`${status.label.replace(/^INFORTUNATO · |^SQUALIFICATO · /,'')} · ${clubShort(player.club)}`,{playerId:player.id,expiresAfter:1});
    });

    if(opponent){
      const oppOut=(opponent.roster||[]).map(player=>({player,status:playerStatusForDay(player.id,day)})).filter(x=>x.status.unavailable);
      if(oppOut.length){
        const names=oppOut.slice(0,3).map(x=>x.player.name).join(', ');
        add('opponent_out',104,'opponent',`${opponent.team} arriva con ${oppOut.length} ${oppOut.length===1?'assenza':'assenze'}`,`${names}${oppOut.length>3?` +${oppOut.length-3}`:''} · situazione confermata prima della sfida`,{managerId:opponent.id,expiresAfter:1});
      }
      const rel=state.auctionEvents?.relationships?.[opponent.id];
      if(rel && (Number(rel.betrayals||0)>0 || Number(rel.rivalry||0)>=12)){
        const detail=Number(rel.betrayals||0)>0
          ? `${opponent.name} non ha dimenticato ciò che è successo durante l'asta.`
          : `Tra te e ${opponent.name} la rivalità nata all'asta è ancora accesa.`;
        add('rivalry',90,'rivalry',`Vecchie tensioni prima di ${state.teamName} - ${opponent.team}`,detail,{managerId:opponent.id,expiresAfter:1});
      }
    }

    const userForms=(user?.roster||[]).map(player=>({player,form:playerFormMetrics(player.id)})).filter(x=>x.form.count>=2);
    const hot=userForms.filter(x=>x.form.avg>=6.5 || x.form.score>=.45).sort((a,b)=>b.form.score-a.form.score || b.form.avg-a.form.avg)[0];
    const cold=userForms.filter(x=>x.form.avg<=5.75 || x.form.score<=-.55).sort((a,b)=>a.form.score-b.form.score || a.form.avg-b.form.avg)[0];
    if(hot) add(`hot_${hot.player.id}`,94,'form',`${hot.player.name} arriva in grande forma`,`Media ${hot.form.avg.toFixed(2)} nelle ultime ${hot.form.count} presenze · ${hot.form.arrow} trend positivo`,{playerId:hot.player.id,expiresAfter:1});
    if(cold) add(`cold_${cold.player.id}`,70,'cold',`${cold.player.name} attraversa un momento delicato`,`Media ${cold.form.avg.toFixed(2)} nelle ultime ${cold.form.count} presenze · scelta da valutare`,{playerId:cold.player.id,expiresAfter:1});

    if(day>1){
      const standings=sortedStandings();
      const pos=standings.findIndex(s=>s.managerId==='user')+1;
      const mine=standings.find(s=>s.managerId==='user');
      if(pos>0 && mine){
        const tableDetail=fantaclassificaIsActive(season)
          ? `${Number(mine.fantasyPoints||0).toFixed(1)} fantapunti totali dopo ${mine.played} giornate · Fantaclassifica attiva`
          : `${mine.points} punti dopo ${mine.played} giornate · differenza reti ${mine.gf-mine.ga>=0?'+':''}${mine.gf-mine.ga}`;
        add('table',58,'table',`${state.teamName} è ${pos}ª in classifica`,tableDetail,{expiresAfter:1});
      }
    }

    // Un'indiscrezione narrativa al giorno: è chiaramente marcata come non confermata.
    if(day>=2 && careerHash(`news-rumor|${day}`)<.58){
      const candidates=(window.FANTA_PLAYERS||[]).filter(p=>!user?.roster?.some(x=>String(x.id)===String(p.id)) && !playerStatusForDay(p.id,day).unavailable);
      const player=hashPick(candidates,`news-rumor-player|${day}`);
      if(player){
        const rumors=[
          'potrebbe essere gestito con più prudenza del previsto',
          'potrebbe partire dalla panchina secondo alcune voci',
          'viene indicato come possibile sorpresa della giornata',
          'sta attirando molta attenzione nelle ultime ore'
        ];
        const copy=hashPick(rumors,`news-rumor-copy|${day}|${player.id}`);
        add(`rumor_${player.id}`,46,'rumor',`Voce di giornata su ${player.name}`,`${clubShort(player.club)} · ${copy}. Informazione non confermata.`,{playerId:player.id,reliable:false,source:'Voci dal campo',expiresAfter:1});
      }
    }

    if(!created){
      add('quiet',30,'info','Vigilia senza scossoni','Nessuna notizia urgente: rose e disponibilità non mostrano cambiamenti rilevanti.',{expiresAfter:1});
    }
    season.newsGeneratedDays[key]=Date.now();
  }

  function generatePostMatchNews(day,dayResult=null,liveSnapshot=null){
    const season=ensureSeasonNewsState();
    if(!season) return;
    const key=`post:${day}`;
    if(season.newsGeneratedDays[key]) return;
    const result=dayResult||season.matchdayResults?.[String(day)];
    if(!result) return;
    const userMatch=(result.matches||[]).find(m=>m.homeId==='user'||m.awayId==='user');
    const stamp=Date.now();
    let created=0;
    const add=(suffix,priority,type,title,detail,opts={})=>{
      addSeasonNews({id:`post_${day}_${suffix}`,day,stage:'post',priority,type,title,detail,createdAt:stamp+created,...opts});
      created++;
    };

    if(userMatch){
      const userHome=userMatch.homeId==='user';
      const us=userHome?Number(userMatch.homeScore||0):Number(userMatch.awayScore||0);
      const them=userHome?Number(userMatch.awayScore||0):Number(userMatch.homeScore||0);
      const oppId=userHome?userMatch.awayId:userMatch.homeId;
      const opponent=managerById(oppId);
      const fp=userHome?Number(userMatch.homeFantasy||0):Number(userMatch.awayFantasy||0);
      const outcome=us>them?'Vittoria':us<them?'Sconfitta':'Pareggio';
      add('user_result',132,'result',`${outcome}: ${state.teamName} ${us}-${them} ${opponent?.team||''}`.trim(),`${fp.toFixed(1)} fantapunti · giornata ${day}`,{expiresAfter:2});

      const performances=(userHome?userMatch.homePerformances:userMatch.awayPerformances)||[];
      const best=performances.filter(p=>!p.noVote).slice().sort((a,b)=>Number(b.fantasy||0)-Number(a.fantasy||0))[0];
      if(best && Number(best.fantasy||0)>=7.5){
        const player=playerMap.get(String(best.playerId));
        add(`spotlight_${best.playerId}`,101,'spotlight',`${best.name} è il protagonista della tua giornata`,`${Number(best.fantasy||0).toFixed(1)} fantapunti${Number(best.goals||0)>0?` · ${best.goals} gol`:''}${Number(best.assists||0)>0?` · ${best.assists} assist`:''}`,{playerId:player?.id||best.playerId,expiresAfter:2});
      }

      const streak=managerStreak('user',day);
      if(streak.count>=2 && streak.type!=='D'){
        add('user_streak',83,'streak',streak.type==='W'?`${state.teamName}: ${streak.count} vittorie consecutive`:`${state.teamName}: ${streak.count} sconfitte consecutive`,streak.type==='W'?'La squadra sta costruendo una striscia positiva.':'Serve una reazione nella prossima giornata.',{expiresAfter:2});
      }
    }

    const standings=sortedStandings();
    const pos=standings.findIndex(s=>s.managerId==='user')+1;
    const mine=standings.find(s=>s.managerId==='user');
    if(pos>0 && mine){
      const tableDetail=fantaclassificaIsActive(season)
        ? `${Number(mine.fantasyPoints||0).toFixed(1)} fantapunti totali · Fantaclassifica attiva`
        : `${mine.points} punti · ${mine.wins} vittorie, ${mine.draws} pareggi, ${mine.losses} sconfitte`;
      add('table_after',78,'table',pos===1?`${state.teamName} è in vetta`:`${state.teamName} chiude la giornata al ${pos}° posto`,tableDetail,{expiresAfter:2});
    }

    const richest=(result.matches||[]).slice().sort((a,b)=>(Number(b.homeScore||0)+Number(b.awayScore||0))-(Number(a.homeScore||0)+Number(a.awayScore||0)))[0];
    if(richest && Number(richest.homeScore||0)+Number(richest.awayScore||0)>=5){
      add(`goalfest_${richest.homeId}_${richest.awayId}`,56,'record','Pioggia di gol nella lega',`${richest.homeTeam} ${richest.homeScore}-${richest.awayScore} ${richest.awayTeam} · la partita più spettacolare della giornata`,{expiresAfter:2});
    }

    // Infortuni/squalifiche emersi durante la simulazione, con priorità alla rosa utente.
    const userIds=new Set((managerById('user')?.roster||[]).map(p=>String(p.id)));
    const liveEvents=liveSnapshot?.events||[];
    const seenStatus=new Set();
    liveEvents.forEach(ev=>{
      const pid=String(ev.playerId||'');
      if(!pid || seenStatus.has(pid) || !userIds.has(pid)) return;
      if(ev.type!=='injury' && ev.type!=='red' && ev.type!=='yellow') return;
      const nextStatus=playerStatusForDay(pid,Math.min(18,day+1));
      if(!nextStatus.unavailable) return;
      const player=playerMap.get(pid) || (window.FANTA_PLAYERS||[]).find(p=>String(p.id)===pid); if(!player) return;
      seenStatus.add(pid);
      add(`status_${pid}`,116,nextStatus.type==='injury'?'injury':'suspension',nextStatus.type==='injury'?`Stop per ${player.name}`:`${player.name} salterà la prossima`,`${nextStatus.label.replace(/^INFORTUNATO · |^SQUALIFICATO · /,'')} · ${clubShort(player.club)}`,{playerId:pid,expiresAfter:2});
    });

    const allStats=Object.values(season.playerSeasonStats||{});
    const topScorer=allStats.filter(st=>Number(st.goals||0)>0).sort((a,b)=>Number(b.goals||0)-Number(a.goals||0)||Number(b.fantasySum||0)-Number(a.fantasySum||0))[0];
    if(topScorer && String(season.newsMeta.topScorerId||'')!==String(topScorer.playerId)){
      season.newsMeta.topScorerId=String(topScorer.playerId);
      add(`scorer_${topScorer.playerId}`,64,'scorer',`${topScorer.name} guida i marcatori`,`${Number(topScorer.goals||0)} gol · ${clubShort(topScorer.club)}`,{playerId:topScorer.playerId,expiresAfter:3});
    }
    const topAssist=allStats.filter(st=>Number(st.assists||0)>0).sort((a,b)=>Number(b.assists||0)-Number(a.assists||0)||Number(b.fantasySum||0)-Number(a.fantasySum||0))[0];
    if(topAssist && String(season.newsMeta.topAssistId||'')!==String(topAssist.playerId)){
      season.newsMeta.topAssistId=String(topAssist.playerId);
      add(`assist_${topAssist.playerId}`,61,'assist',`${topAssist.name} sale in testa agli assistman`,`${Number(topAssist.assists||0)} assist · ${clubShort(topAssist.club)}`,{playerId:topAssist.playerId,expiresAfter:3});
    }

    // Una CPU in crisi o in striscia positiva rende la lega più viva.
    const cpuRuns=state.managers.filter(m=>m.id!=='user').map(m=>({m,streak:managerStreak(m.id,day)})).filter(x=>x.streak.count>=3 && x.streak.type!=='D');
    const notable=cpuRuns.sort((a,b)=>b.streak.count-a.streak.count)[0];
    if(notable){
      add(`cpu_streak_${notable.m.id}`,50,'streak',notable.streak.type==='W'?`${notable.m.team} non si ferma più`:`Crisi per ${notable.m.team}`,notable.streak.type==='W'?`${notable.streak.count} vittorie consecutive per ${notable.m.name}.`:`${notable.streak.count} sconfitte consecutive: cresce la pressione su ${notable.m.name}.`,{managerId:notable.m.id,expiresAfter:2});
    }

    season.newsGeneratedDays[key]=Date.now();
  }

  function ensureSeasonNewsForCurrentState(){
    const season=ensureSeasonNewsState();
    if(!season) return;
    // I vecchi salvataggi iniziano l'archivio dalla giornata corrente: evitiamo di
    // inventare retroattivamente notizie usando la classifica/stats attuali.
    if(!season.completed) generatePreMatchNews(season.currentMatchday||1);
  }

  function buildHubNews(){
    const season=ensureSeasonNewsState();
    if(!season) return [];
    ensureSeasonNewsForCurrentState();
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
    const player=playerMap.get(pid) || (window.FANTA_PLAYERS||[]).find(p=>String(p.id)===pid);
    if(!player) return '';
    return `<span class="season-news-player-avatar">${playerAvatarMarkup(player,player.name)}</span>`;
  }

  function renderSeasonNewsArchive(){
    const season=ensureSeasonNewsState();
    const list=$('seasonNewsArchiveList');
    if(!season || !list) return;
    ensureSeasonNewsForCurrentState();
    const news=season.newsFeed.slice().sort((a,b)=>Number(b.day||0)-Number(a.day||0)||Number(b.createdAt||0)-Number(a.createdAt||0));
    list.innerHTML=news.length?news.map(item=>`
      <article class="season-news-archive-item type-${item.type} ${item.playerId?'has-player-avatar':''} ${item.playerId?'is-clickable':''}" ${item.playerId?`data-season-player="${escapeHtml(item.playerId)}"`:''}>
        ${item.playerId?seasonNewsPlayerAvatarHtml(item):''}
        <div class="season-news-archive-copy">
          <div class="season-news-archive-meta">
            <span>${hubNewsTypeLabel(item.type)}</span>
            <b>G${item.day}</b>
            <em class="${item.reliable===false?'rumor':'confirmed'}">${newsReliabilityLabel(item)}</em>
          </div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(visibleNewsDetail(item,season))}</p>
          <small>${escapeHtml(item.source||'Redazione Fantallenatore')}</small>
        </div>
      </article>
    `).join(''):'<div class="hub-news-empty">L’archivio è ancora vuoto.</div>';
    if($('seasonNewsArchiveCount')) $('seasonNewsArchiveCount').textContent=`${news.length} notizi${news.length===1?'a':'e'}`;
    wireSeasonPlayerButtons(list);
  }

  function openSeasonNewsArchive(){
    const modal=$('seasonNewsModal'); if(!modal) return;
    renderSeasonNewsArchive();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
  }

  function closeSeasonNewsArchive(){
    const modal=$('seasonNewsModal'); if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
  }

  function stopHubNewsCarousel(){
    if(hubNewsCarouselTimer){
      clearInterval(hubNewsCarouselTimer);
      hubNewsCarouselTimer=null;
    }
  }

  function setHubNewsSlide(index,restart=false){
    if(!hubNewsCarouselCount) return;
    hubNewsCarouselIndex=((Number(index)||0)%hubNewsCarouselCount+hubNewsCarouselCount)%hubNewsCarouselCount;

    const track=$('hubNewsTrack');
    if(track) track.style.transform=`translateX(-${hubNewsCarouselIndex*100}%)`;

    document.querySelectorAll('#hubNewsDots [data-hub-news-dot]').forEach((dot,i)=>{
      dot.classList.toggle('active',i===hubNewsCarouselIndex);
      dot.setAttribute('aria-current',i===hubNewsCarouselIndex?'true':'false');
    });

    if($('hubNewsCounter')) $('hubNewsCounter').textContent=`${hubNewsCarouselIndex+1} / ${hubNewsCarouselCount}`;

    if(restart){
      stopHubNewsCarousel();
      startHubNewsCarousel();
    }
  }

  function startHubNewsCarousel(){
    stopHubNewsCarousel();
    if(hubNewsCarouselCount<=1) return;
    hubNewsCarouselTimer=window.setInterval(()=>{
      setHubNewsSlide(hubNewsCarouselIndex+1,false);
    },5200);
  }

  function renderHubNews(){
    const track=$('hubNewsTrack');
    const dots=$('hubNewsDots');
    if(!track || !dots) return;

    stopHubNewsCarousel();
    const news=buildHubNews();
    hubNewsCarouselCount=news.length;
    hubNewsCarouselIndex=Math.min(hubNewsCarouselIndex,Math.max(0,news.length-1));

    track.innerHTML=news.length?news.map(item=>`
      <div class="hub-news-slide">
        <button type="button" class="hub-news-item type-${item.type} news-theme-${hubNewsTheme(item.type)} ${item.playerId?'has-player-avatar':''} ${item.playerId?'is-clickable':''}" ${item.playerId?`data-season-player="${escapeHtml(item.playerId)}"`:''}>
          <div class="hub-news-lead">
            <span class="hub-news-type">${hubNewsTypeLabel(item.type)}</span>
            ${item.playerId?seasonNewsPlayerAvatarHtml(item):''}
          </div>
          <div class="hub-news-copy">
            <div class="hub-news-meta-line"><em class="${item.reliable===false?'rumor':'confirmed'}">${newsReliabilityLabel(item)}</em><span>G${item.day}</span></div>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(visibleNewsDetail(item,ensureSeasonState()))}</small>
          </div>
          ${item.playerId?'<span class="hub-news-arrow">→</span>':''}
        </button>
      </div>
    `).join(''):'<div class="hub-news-slide"><div class="hub-news-empty">Nessuna notizia rilevante al momento.</div></div>';

    const miniList=$('hubNewsMiniList');
    if(miniList){
      miniList.innerHTML=news.slice(1,4).map(item=>`
        <button type="button" class="dashboard-news-mini type-${item.type} news-theme-${hubNewsTheme(item.type)} ${item.playerId?'has-player-avatar':''} ${item.playerId?'is-clickable':''}" ${item.playerId?`data-season-player="${escapeHtml(item.playerId)}"`:''}>
          <div class="dashboard-news-mini-lead">
            ${item.playerId?seasonNewsPlayerAvatarHtml(item):`<span class="dashboard-news-mini-type">${hubNewsTypeLabel(item.type)}</span>`}
            ${item.playerId?`<span class="dashboard-news-mini-tag">${hubNewsTypeLabel(item.type)}</span>`:''}
          </div>
          <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(visibleNewsDetail(item,ensureSeasonState()))}</small></div>
          <b>›</b>
        </button>
      `).join('');
      wireSeasonPlayerButtons(miniList);
    }

    hubNewsCarouselCount=Math.max(1,news.length);

    dots.innerHTML=Array.from({length:hubNewsCarouselCount},(_,i)=>`
      <button type="button" class="hub-news-dot ${i===hubNewsCarouselIndex?'active':''}" data-hub-news-dot="${i}" aria-label="Vai alla news ${i+1}" aria-current="${i===hubNewsCarouselIndex?'true':'false'}"></button>
    `).join('');

    dots.querySelectorAll('[data-hub-news-dot]').forEach(dot=>{
      dot.addEventListener('click',()=>setHubNewsSlide(Number(dot.dataset.hubNewsDot),true));
    });

    wireSeasonPlayerButtons(track);
    setHubNewsSlide(hubNewsCarouselIndex,false);
    startHubNewsCarousel();
  }

  function managerRecentLeagueResults(managerId,limit=5){
    const season=ensureSeasonState();
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

  function deterministicCpuFormation(manager,day=ensureSeasonState()?.currentMatchday||1){
    if(!manager) return '4-3-3';
    const type=manager.profile?.archetype||'';
    return availableLineupFormations().map(key=>{
      const counts=lineupCountsForFormation(key);
      let score=0;
      for(const role of ['P','D','C','A']) score+=bestPlayersForRole(manager,role,counts[role]).reduce((s,p)=>s+lineupPlayerValue(p),0);
      let bonus=0;
      if(['bomber','collezionista','spendaccione'].includes(type)) bonus+=counts.A===3?180:0;
      if(['ragioniere','tirchio','esperto'].includes(type)) bonus+=counts.D>=4?90:0;
      if(type==='moneyball') bonus+=counts.C>=4?110:0;
      if(type==='pazzo') bonus+=(careerHash(`match-center-formation|${day}|${manager.id}|${key}`)-.5)*220;
      bonus+=cpuLeagueFormationBias(manager,key,day);
      return {key,score:score+bonus};
    }).sort((a,b)=>b.score-a.score)[0]?.key||'4-3-3';
  }

  function managerMostUsedFormation(manager){
    const season=ensureSeasonState();
    if(!season || !manager) return '4-3-3';
    const counts={};
    for(let day=1;day<Number(season.currentMatchday||1);day++){
      const formation=season.lineups?.[String(day)]?.[manager.id]?.formation;
      if(LINEUP_FORMATIONS[formation]) counts[formation]=(counts[formation]||0)+1;
    }
    const historical=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0];
    return historical||deterministicCpuFormation(manager,season.currentMatchday||1);
  }

  function matchCenterProbablePlayers(manager,formation){
    if(!manager) return [];
    const counts=lineupCountsForFormation(formation);
    const out=[];
    ['P','D','C','A'].forEach(role=>{
      const players=(manager.roster||[]).filter(p=>p.role===role).slice().sort((a,b)=>{
        const au=playerStatusForDay(a.id,state?.season?.currentMatchday||1).unavailable?1:0;
        const bu=playerStatusForDay(b.id,state?.season?.currentMatchday||1).unavailable?1:0;
        return au-bu || estimatedStarterProbability(b)-estimatedStarterProbability(a) || currentPlayerOvr(b)-currentPlayerOvr(a);
      }).slice(0,counts[role]||0);
      players.forEach(p=>out.push(p));
    });
    return out;
  }

  function managerRoleData(manager){
    return ['P','D','C','A'].map(role=>{
      const players=(manager?.roster||[]).filter(p=>p.role===role);
      const ovr=players.length?players.reduce((s,p)=>s+currentPlayerOvr(p),0)/players.length:0;
      const voted=players.map(p=>playerSeasonStat(p.id)).filter(st=>Number(st?.voteCount||0)>0);
      const fmVotes=voted.reduce((s,st)=>s+Number(st.voteCount||0),0);
      const fm=fmVotes?voted.reduce((s,st)=>s+Number(st.fantasySum||0),0)/fmVotes:null;
      return {role,ovr,fm,count:players.length};
    });
  }

  function matchCenterKeyPlayer(manager,dataPro=false){
    const available=(manager?.roster||[]).filter(p=>!playerStatusForDay(p.id,state?.season?.currentMatchday||1).unavailable);
    const pool=available.length?available:(manager?.roster||[]);
    return pool.slice().sort((a,b)=>{
      if(dataPro){
        const av=playerSeasonStat(a.id),bv=playerSeasonStat(b.id);
        const af=av?.voteCount?Number(av.fantasySum||0)/Number(av.voteCount):0;
        const bf=bv?.voteCount?Number(bv.fantasySum||0)/Number(bv.voteCount):0;
        if(Math.abs(bf-af)>.01) return bf-af;
      }
      return currentPlayerOvr(b)-currentPlayerOvr(a);
    })[0]||null;
  }

  function matchCenterRecommendedFormation(userManager,opponentFormation){
    if(!userManager) return '4-3-3';
    const oppCounts=lineupCountsForFormation(opponentFormation||'4-3-3');
    return availableLineupFormations().map(key=>{
      const built=buildAdvancedAutoLineup(userManager,key);
      const counts=lineupCountsForFormation(key);
      let score=Object.values(built.starters).reduce((sum,id)=>sum+advancedAutoLineupValue(playerMap.get(String(id))||userManager.roster.find(p=>String(p.id)===String(id))),0);
      if(oppCounts.A>=3 && counts.D>=4) score+=95;
      if(oppCounts.C>=4 && counts.C>=4) score+=60;
      if(oppCounts.D>=5 && counts.A>=3) score+=55;
      return {key,score};
    }).sort((a,b)=>b.score-a.score)[0]?.key||'4-3-3';
  }

  function renderMatchCenter(){
    const season=ensureSeasonState(),me=managerById('user');
    if(!season || !me) return;
    const day=Number(season.currentMatchday||1);
    const dataPro=shopItemActive('fantadata_pro',season);
    const scoutPlus=shopItemActive('scout_plus',season);
    const assistant=shopItemActive('assistant_coach',season);
    const roster=(me.roster||[]).slice();
    const available=roster.filter(p=>!playerStatusForDay(p.id,day).unavailable);
    const unavailable=roster.filter(p=>playerStatusForDay(p.id,day).unavailable);
    const avgOvr=roster.length?roster.reduce((sum,p)=>sum+currentPlayerOvr(p),0)/roster.length:0;
    const totals=roster.reduce((acc,p)=>{
      const st=playerSeasonStat(p.id)||emptyPlayerSeasonStat(p);
      acc.goals+=Number(st.goals||0); acc.assists+=Number(st.assists||0);
      acc.minutes+=Number(st.minutes||0); acc.apps+=Number(st.appearances||0);
      return acc;
    },{goals:0,assists:0,minutes:0,apps:0});

    let assistantFormation=null,assistantXI=new Set();
    if(assistant){
      assistantFormation=bestAdvancedFormation(me);
      const built=buildAdvancedAutoLineup(me,assistantFormation);
      assistantXI=new Set(Object.values(built.starters||{}).map(String));
    }

    const rows=roster.slice().sort((a,b)=>{
      const roleOrder={P:0,D:1,C:2,A:3};
      const ar=roleOrder[a.role]??9,br=roleOrder[b.role]??9;
      if(ar!==br) return ar-br;
      return currentPlayerOvr(b)-currentPlayerOvr(a) || String(a.name).localeCompare(String(b.name),'it');
    });

    const rowHtml=rows.map(p=>{
      const st=playerSeasonStat(p.id)||emptyPlayerSeasonStat(p);
      const status=playerStatusForDay(p.id,day);
      const form=playerFormMetrics(p.id);
      const mv=Number(st.voteCount||0)>0?Number(st.voteSum||0)/Number(st.voteCount):null;
      const fm=Number(st.voteCount||0)>0?Number(st.fantasySum||0)/Number(st.voteCount):null;
      const pct=scoutPlus?estimatedStarterProbability(p):null;
      const pctClass=pct===null?'':pct>=70?'high':pct>=40?'medium':'low';
      const serieAFixture=serieAFixtureForPlayer(p,day);
      const serieADifficulty=dataPro?serieAMatchupDifficulty(p,day):null;
      const recent=dataPro&&form.recent.length
        ? form.recent.map(x=>`<span title="G${Number(x.day||0)} · FV ${Number(x.fantasy||0).toFixed(1)}">${Number(x.vote).toFixed(1)}</span>`).join('')
        : '';
      const assistantLabel=assistant
        ? (assistantXI.has(String(p.id))?'<b class="dc-auto-xi starter">✓ AUTO XI</b>':'<b class="dc-auto-xi bench">PANCHINA</b>')
        : '<span class="dc-locked">🔒 Assistente</span>';
      return `<button type="button" class="dc-player-row ${status.unavailable?'is-unavailable':''}" data-season-player="${escapeHtml(p.id)}">
        <span class="lineup-role-chip role-${escapeHtml(p.role)}">${escapeHtml(p.role)}</span>
        <span class="dc-player-name"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.club||'')} · OVR ${playerOvrLabel(p)}</small><em class="dc-seriea-fixture">${serieAFixture?`vs ${escapeHtml(serieAFixture.opponentName)} · ${serieAFixture.home?'Casa':'Trasferta'}`:'Serie A · —'}</em></span>
        <span class="dc-status ${status.className}"><b>${status.unavailable?'OUT':'OK'}</b><small>${escapeHtml(status.unavailable?status.label:'Disponibile')}</small></span>
        <span class="dc-base-stats"><b>P ${Number(st.appearances||0)} · T ${Number(st.starts||0)}</b><small>${Number(st.minutes||0)} min · ⚽ ${Number(st.goals||0)} · 🅰 ${Number(st.assists||0)}</small></span>
        <span class="dc-scout-cell ${scoutPlus?pctClass:'locked'}">${scoutPlus?`<b>${pct}%</b><small>Titolarità stimata</small>`:'<b>🔒</b><small>Scout Plus</small>'}</span>
        <span class="dc-data-cell ${dataPro?'active':'locked'}">${dataPro?`<b>MV ${mv===null?'—':mv.toFixed(2)} · FM ${fm===null?'—':fm.toFixed(2)}</b><small>${form.count?`${form.arrow} forma ${form.avg.toFixed(2)}`:'Forma N/D'}</small>${serieADifficulty?serieAMatchupBadgeHtml(p,day):''}${recent?`<em class="dc-recent">${recent}</em>`:''}`:`<b>${escapeHtml(qualitativeFormLabel(form))}</b><small>🔒 numeri + difficoltà partita FantaData</small>`}</span>
        <span class="dc-assistant-cell">${assistantLabel}</span>
        <span class="dc-row-arrow">→</span>
      </button>`;
    }).join('');

    let scoutSummary='';
    if(scoutPlus){
      const probs=available.map(p=>({p,pct:estimatedStarterProbability(p)}));
      const safe=probs.filter(x=>x.pct>=70).length;
      const risk=probs.filter(x=>x.pct<40).length;
      const best=probs.slice().sort((a,b)=>b.pct-a.pct)[0];
      scoutSummary=`<div class="mc-premium active"><div class="mc-premium-head"><div><span>🎯 SCOUT PLUS</span><h3>Titolarità della tua rosa</h3></div><b>ATTIVO</b></div><div class="dc-premium-kpis"><div><strong>${safe}</strong><span>≥70%</span></div><div><strong>${risk}</strong><span>&lt;40%</span></div><div><strong>${best?`${best.pct}%`:'—'}</strong><span>STIMA PIÙ ALTA</span></div></div></div>`;
    }else{
      scoutSummary=`<div class="mc-premium locked"><div class="mc-premium-head"><div><span>🎯 SCOUT PLUS</span><h3>Titolarità stimata</h3></div><b>🔒 NON ATTIVO</b></div><p>Sblocca la probabilità stimata di titolarità per ogni giocatore della tua rosa.</p></div>`;
    }

    let dataSummary='';
    if(dataPro){
      const withVotes=roster.map(p=>{const st=playerSeasonStat(p.id)||emptyPlayerSeasonStat(p);return {p,st,fm:st.voteCount?Number(st.fantasySum||0)/Number(st.voteCount):null,mv:st.voteCount?Number(st.voteSum||0)/Number(st.voteCount):null,form:playerFormMetrics(p.id)}}).filter(x=>x.fm!==null);
      const bestFm=withVotes.slice().sort((a,b)=>b.fm-a.fm)[0];
      const hot=withVotes.slice().sort((a,b)=>b.form.score-a.form.score)[0];
      const teamFm=withVotes.length?withVotes.reduce((s,x)=>s+x.fm,0)/withVotes.length:null;
      const favorableCount=roster.filter(p=>serieAMatchupDifficulty(p,day)?.key==='favorable').length;
      dataSummary=`<div class="mc-premium active"><div class="mc-premium-head"><div><span>📊 FANTADATA PRO</span><h3>Rendimento + calendario Serie A</h3></div><b>ATTIVO</b></div><div class="dc-premium-kpis"><div><strong>${teamFm===null?'—':teamFm.toFixed(2)}</strong><span>FM MEDIA</span></div><div><strong>${bestFm?escapeHtml(bestFm.p.name):'—'}</strong><span>MIGLIOR FM</span></div><div><strong>${hot?escapeHtml(hot.p.name):'—'}</strong><span>PIÙ IN FORMA</span></div><div><strong>${favorableCount}</strong><span>MATCH FAVOREVOLI</span></div></div></div>`;
    }else{
      dataSummary=`<div class="mc-premium locked"><div class="mc-premium-head"><div><span>📊 FANTADATA PRO</span><h3>Rendimento dettagliato</h3></div><b>🔒 NON ATTIVO</b></div><p>Sblocca media voto, fantamedia, forma numerica, ultime 5 prestazioni e difficoltà dell’avversario Serie A.</p></div>`;
    }

    const assistantSummary=assistant
      ? `<div class="mc-premium assistant active"><div class="mc-premium-head"><div><span>🧠 ASSISTENTE TECNICO</span><h3>Selezione automatica</h3></div><b>ATTIVO</b></div><div class="mc-assistant-advice"><strong>Modulo AUTO XI suggerito: ${assistantFormation}</strong><p>${assistantAutoLineupAnalysisHtml(season)}</p><span>I giocatori marcati <b>AUTO XI</b> sono quelli che l'Assistente schiererebbe oggi.</span><button id="matchCenterOpenLineup" class="primary">VAI A SCHIERA FORMAZIONE →</button></div></div>`
      : `<div class="mc-premium assistant locked"><div class="mc-premium-head"><div><span>🧠 ASSISTENTE TECNICO</span><h3>AUTO XI e gestione formazione</h3></div><b>🔒 NON ATTIVO</b></div><p>Sblocca il modulo consigliato e l'indicazione dei giocatori che AUTO XI schiererebbe, usando solo i dati degli abbonamenti che possiedi.</p></div>`;

    const body=$('matchCenterBody');
    if(!body) return;
    if($('matchCenterTitle')) $('matchCenterTitle').textContent=`${state.teamName||me.team} · Data Center`;
    if($('matchCenterSubtitle')) $('matchCenterSubtitle').textContent=`Giornata ${day} · informazioni sulla tua rosa · ${roster.length} giocatori`;
    body.innerHTML=`
      <section class="mc-hero dc-hero">
        <div class="mc-opponent-identity dc-team-identity"><span class="fixture-tag">LA TUA ROSA</span><h3>${escapeHtml(state.teamName||me.team)}</h3><p>Dati aggiornati alla giornata ${day}</p></div>
        <div class="mc-kpis dc-kpis"><div><strong>${roster.length}</strong><span>GIOCATORI</span></div><div><strong>${available.length}</strong><span>DISPONIBILI</span></div><div><strong>${unavailable.length}</strong><span>OUT</span></div><div><strong>${avgOvr.toFixed(1)}</strong><span>OVR MEDIO</span></div></div>
      </section>
      <section class="mc-card dc-free-summary"><div class="mc-card-head"><span>DATI BASE · GRATUITI</span><strong>Presenze, titolarità, minuti, gol e assist</strong></div><div class="dc-free-kpis"><div><b>${totals.goals}</b><small>GOL ROSA</small></div><div><b>${totals.assists}</b><small>ASSIST ROSA</small></div><div><b>${totals.apps}</b><small>PRESENZE TOTALI</small></div><div><b>${totals.minutes}</b><small>MINUTI TOTALI</small></div></div></section>
      <section class="mc-grid two dc-premium-grid">${scoutSummary}${dataSummary}</section>
      ${assistantSummary}
      <section class="mc-card dc-roster-card"><div class="mc-card-head"><span>DATA CENTER GIOCATORI</span><strong>Clicca un giocatore per aprire la scheda completa</strong></div><div class="dc-column-legend"><span>BASE</span><span>SCOUT PLUS</span><span>FANTADATA</span><span>ASSISTENTE</span></div><div class="dc-player-list">${rowHtml}</div></section>`;
    wireSeasonPlayerButtons(body);
    body.querySelector('#matchCenterOpenLineup')?.addEventListener('click',()=>{closeMatchCenter();requestOpenLineup();});
  }

  function openMatchCenter(){
    const modal=$('matchCenterModal');
    if(!modal) return;
    renderMatchCenter();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('match-center-open');
  }

  function closeMatchCenter(){
    const modal=$('matchCenterModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('match-center-open');
  }

  function renderSeasonDashboard() {
    const season = ensureSeasonState();
    if (!season) return renderSummary();
    activateWinterTransferWindowIfNeeded();
    if(routeWinterMarketFlow()) return;
    showScreen('seasonScreen');
    renderLeagueNavActive('dashboard');
    renderCareerWallets();
    const day = season.currentMatchday;
    const round = season.schedule[day-1];
    const fixture = currentUserFixture();
    const me = managerById('user');
    const opponentId = fixture?.homeId==='user' ? fixture.awayId : fixture?.homeId;
    const opponent = managerById(opponentId);
    ensureManagerTeamIdentityState();
    const isHome = fixture?.homeId==='user';
    const standings = sortedStandings();
    const myStanding = standings.find(x=>x.managerId==='user') || season.standings[0];
    const myPos = Math.max(1, standings.findIndex(x=>x.managerId==='user')+1);

    $('seasonSubtitle').textContent = `Giornata ${day} di ${FANTASY_SEASON_MATCHDAYS} · stagione regolare`;
    $('nextMatchdayLabel').textContent = `GIORNATA ${day} / ${FANTASY_SEASON_MATCHDAYS}`;
    $('homeAwayBadge').textContent = isHome ? 'CASA' : 'TRASFERTA';
    $('seasonUserTeam').textContent = me?.team || state.teamName;
    $('seasonUserManager').textContent = me?.name || state.managerName;
    $('nextOpponentName').textContent = opponent?.team || '—';
    $('nextOpponentManager').textContent = opponent ? `${opponent.name} · ${opponent.profile?.label||'CPU'}` : '—';
    applySeasonFixtureHeroVisuals(me, opponent);

    $('matchdayFixturesTitle').textContent = `Giornata ${day}`;

    $('matchdayFixtures').innerHTML = (round?.matches||[]).map((m,i) => {
      const home=managerById(m.homeId), away=managerById(m.awayId);
      const userMatch=m.homeId==='user'||m.awayId==='user';
      return `<div class="season-fixture-row ${userMatch?'is-user-fixture':''}">
        <span class="fixture-index">${String(i+1).padStart(2,'0')}</span>
        <strong class="fixture-home">${escapeHtml(home?.team||'—')}</strong>
        <span class="fixture-score">${m.played?`${m.homeScore} - ${m.awayScore}`:'VS'}</span>
        <strong class="fixture-away">${escapeHtml(away?.team||'—')}</strong>
      </div>`;
    }).join('');

    if($('standingsBodySimple')){
      const myIndex=standings.findIndex(s=>s.managerId==='user');
      const compact=standings.slice(0,5).map((s,i)=>({s,i}));
      if(myIndex>=5) compact.push({separator:true},{s:standings[myIndex],i:myIndex});
      $('standingsBodySimple').innerHTML=compact.map(row=>{
        if(row.separator) return `<tr class="standings-separator"><td colspan="4">···</td></tr>`;
        const {s,i}=row, m=managerById(s.managerId);
        const rowClasses=[s.managerId==='user'?'is-user-standing':'',i===0?'is-promotion-standing':''].filter(Boolean).join(' ');
        return `<tr class="${rowClasses}">
          <td>${i+1}</td>
          <td><strong>${escapeHtml(m?.team||'—')}</strong></td>
          <td>${s.played}</td>
          <td class="pts">${fantaclassificaIsActive(season)?Number(s.fantasyPoints||0).toFixed(1):s.points}</td>
        </tr>`;
      }).join('');
    }
    if(!season.lineups?.[String(day)]?.user && assistantCoachCarryEnabled(season)){
      seedAssistantCoachLineupForDay(day,season);
    }
    const savedLineup = season.lineups?.[String(day)]?.user;
    if ($('lineupBtn')) {
      $('lineupBtn').disabled = false;
      $('lineupBtn').textContent = savedLineup?.confirmed ? 'MODIFICA FORMAZIONE · 11/11' : 'SCHIERA FORMAZIONE';
      $('lineupBtn').classList.toggle('lineup-ready', !!savedLineup?.confirmed);
    }
    renderOpponentMalusBanner(season,day);
    const pendingBigMatch = season.pendingBigMatch?.day===day ? season.pendingBigMatch : null;
    const flow=ensureMatchdayFlowEntry(season,day);
    if ($('playMatchdayBtn')) {
      const roundPlayed = !!round?.matches?.every(m=>m.played);
      const phase=flow?.phase||'lineup';
      const dashboardReady=phase==='match_ready';
      const eventPending=phase==='event_pending';
      $('playMatchdayBtn').disabled = !season.completed && (!!pendingBigMatch || !savedLineup?.confirmed || roundPlayed || phase==='live');
      $('playMatchdayBtn').textContent = pendingBigMatch
        ? 'DIRETTA GOL CONCLUSA'
        : (season.completed ? 'FINE STAGIONE' : (roundPlayed ? 'GIORNATA GIOCATA' : (eventPending ? 'SCEGLI CARTA' : (dashboardReady ? 'DIRETTA GOL' : 'CONTINUA'))));
      $('playMatchdayBtn').classList.toggle('is-live-ready',dashboardReady && !pendingBigMatch && !roundPlayed && !season.completed);
      $('playMatchdayBtn').classList.toggle('is-event-pending',eventPending && !pendingBigMatch && !roundPlayed && !season.completed);
    }
    if ($('simulateMatchdayBtn')) {
      const roundPlayed = !!round?.matches?.every(m=>m.played);
      const phase=flow?.phase||'lineup';
      const canSimulate=phase==='match_ready' && !!savedLineup?.confirmed && !pendingBigMatch && !roundPlayed && !season.completed;
      $('simulateMatchdayBtn').classList.toggle('hidden',!canSimulate);
      $('simulateMatchdayBtn').disabled=!canSimulate;
    }
    if ($('lineupBtn')) {
      if (pendingBigMatch) {
        const partial=pendingPartialFantasySnapshot('user');
        $('lineupBtn').disabled=false;
        $('lineupBtn').textContent=partial ? `VEDI ROSA · ${partial.fantasyPoints.toFixed(1)} PT` : 'VEDI ROSA · PARZIALE';
        $('lineupBtn').classList.add('lineup-locked-preview');
      } else {
        $('lineupBtn').classList.remove('lineup-locked-preview');
      }
    }

    const pendingCard=$('pendingBigMatchHubCard');
    const pendingBtn=$('startPendingBigMatchBtn');
    if(pendingBigMatch?.snapshot){
      const bm=pendingBigMatch.snapshot.matches?.[pendingBigMatch.bigMatchIndex];
      const bigLabel=bm ? `${clubName(bm.homeClub)} vs ${clubName(bm.awayClub)}` : 'Big Match';
      if(pendingCard) pendingCard.style.display='';
      if($('pendingBigMatchTitle')) $('pendingBigMatchTitle').textContent=bigLabel;
      if($('pendingBigMatchSubtitle')) $('pendingBigMatchSubtitle').textContent='Le altre 9 partite di Serie A sono terminate. Avvia il Big Match per completare la giornata.';
      if(pendingBtn) pendingBtn.textContent=`INIZIA BIG MATCH`;
    }else{
      if(pendingCard) pendingCard.style.display='none';
    }

    if ($('standingsTitle')) $('standingsTitle').textContent = fantaclassificaIsActive(season)?`Fantaclassifica · ${myStanding?.played||0} giornate`:`Dopo ${myStanding?.played||0} giornate`;
    if($('compactStandingsMetricHeader')) $('compactStandingsMetricHeader').textContent=fantaclassificaIsActive(season)?'FPT':'PT';
    renderHubNews();
    renderExpertAdvice();
    saveState();
  }


  let opponentMalusNoticeDay=null;
  let opponentMalusNoticeFocus=null;

  function renderOpponentMalusBanner(season,day){
    const banner=$('opponentMalusBanner');
    if(!banner) return;
    const entry=ensureOpponentMalusRoll(day);
    const round=season.schedule?.[Number(day)-1];
    const visible=!!entry?.triggered && !!entry.selectedOption && !season.completed &&
      !season.matchdayResults?.[String(day)] && !round?.matches?.every(match=>match.played);
    banner.classList.toggle('hidden',!visible);
    banner.textContent=visible ? `⚠ MALUS AVVERSARIO ATTIVO · ${entry.selectedOption.title} · VEDI DETTAGLI` : '';
  }

  function showOpponentMalusNotice(day,force=false){
    const entry=ensureOpponentMalusRoll(day);
    if(!entry?.triggered || !entry.selectedOption || (!force && entry.noticeAcknowledgedAt)) return false;
    const modal=$('opponentMalusNotice');
    if(!modal) return false;
    opponentMalusNoticeDay=day;
    opponentMalusNoticeFocus=document.activeElement;
    const option=entry.selectedOption;
    const rival=managerById(entry.opponentId);
    $('opponentMalusNoticeTitle').textContent=`${String(entry.opponentLabel||'Il rivale').toUpperCase()} TI METTE I BASTONI TRA LE RUOTE!`;
    $('opponentMalusNoticeDay').textContent=`GIORNATA ${day}`;
    $('opponentMalusName').textContent=option.title;
    $('opponentMalusText').textContent=option.text;
    const player=playerMap.get(String(option.effect?.targetPlayerId||''));
    $('opponentMalusTarget').innerHTML=player ? playerAvatarMarkup(player,player.name) : '';
    renderFixtureCoachPortrait('opponentMalusPortrait',rival,seasonFixtureTheme(rival,false));
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    $('opponentMalusAcknowledge').focus();
    return true;
  }

  function closeOpponentMalusNotice(acknowledge=false){
    if(opponentMalusNoticeDay===null) return;
    if(acknowledge){
      const entry=state?.season?.opponentMalusEvents?.[String(opponentMalusNoticeDay)];
      if(entry){entry.noticeAcknowledgedAt=Date.now();saveState();}
    }
    $('opponentMalusNotice').classList.add('hidden');
    $('opponentMalusNotice').setAttribute('aria-hidden','true');
    opponentMalusNoticeDay=null;
    opponentMalusNoticeFocus?.focus();
  }

  let weekendArrivalLoading=false;

  function showWeekendArrivalLoading(onComplete){
    const loader=$('weekendArrivalLoader');
    if(!loader || weekendArrivalLoading){
      if(typeof onComplete==='function' && !weekendArrivalLoading) onComplete();
      return;
    }
    weekendArrivalLoading=true;
    loader.classList.remove('is-leaving');
    loader.classList.add('show');
    loader.setAttribute('aria-hidden','false');
    const btn=$('playMatchdayBtn');
    if(btn) btn.disabled=true;

    window.setTimeout(()=>{
      loader.classList.add('is-leaving');
      window.setTimeout(()=>{
        loader.classList.remove('show','is-leaving');
        loader.setAttribute('aria-hidden','true');
        weekendArrivalLoading=false;
        if(typeof onComplete==='function') onComplete();
      },180);
    },880);
  }

  function continueMatchdayFromLineup(season,day){
    const pending=ensureAllPreMatchEventRolls(day);
    if(pending){
      setMatchdayFlowPhase(season,day,'event_pending',{continuedAt:Date.now()});
      saveState();
      if(pending.type==='formation') renderFormationChoiceModal(pending.entry);
      else renderAdminRuleModal(pending.entry);
      return;
    }
    setMatchdayFlowPhase(season,day,'match_ready',{continuedAt:Date.now()});
    saveState();
    showToast(`Giornata ${day} pronta. Puoi modificare ancora la formazione oppure entrare in Diretta Gol.`);
    renderSeasonDashboard();
  }

  function handleDashboardPrimaryAction(){
    const season=ensureSeasonState();
    if(!season || weekendArrivalLoading) return;
    if(season.completed) return renderNextSeasonFlow();
    const day=season.currentMatchday||1;
    const round=season.schedule?.[day-1];
    const savedLineup=season.lineups?.[String(day)]?.user;
    const pendingBigMatch=season.pendingBigMatch?.day===day ? season.pendingBigMatch : null;
    const roundPlayed=!!round?.matches?.every(m=>m.played);
    if(pendingBigMatch || roundPlayed || !savedLineup?.confirmed) return;

    const flow=ensureMatchdayFlowEntry(season,day);
    if(!flow) return;

    if(showOpponentMalusNotice(day)) return;

    if(flow.phase==='event_pending'){
      const pending=nextPendingMatchdayEvent(day,season);
      if(pending?.type==='formation'){
        renderFormationChoiceModal(pending.entry);
        return;
      }
      if(pending?.type==='admin_rule'){
        renderAdminRuleModal(pending.entry);
        return;
      }
      setMatchdayFlowPhase(season,day,'match_ready',{eventResolvedAt:Date.now()});
      saveState();
      renderSeasonDashboard();
      return;
    }

    if(flow.phase==='lineup'){
      showWeekendArrivalLoading(()=>continueMatchdayFromLineup(season,day));
      return;
    }

    if(flow.phase==='match_ready') startSerieALiveMatchday();
  }

  function lineupDayKey() {
    const season = ensureSeasonState();
    return String(season?.currentMatchday || 1);
  }

  function ensureLineupDayStore() {
    const season = ensureSeasonState();
    if (!season) return null;
    if (!season.lineups || typeof season.lineups !== 'object') season.lineups = {};
    const key = lineupDayKey();
    if (!season.lineups[key] || typeof season.lineups[key] !== 'object') season.lineups[key] = {};
    return season.lineups[key];
  }

  function lineupSlots(key) {
    return LINEUP_FORMATIONS[key] || LINEUP_FORMATIONS['4-3-3'];
  }

  function lineupRequiredStarters(formation){
    return lineupSlots(formation).length;
  }

  function lineupPlayerValue(player) {
    const form=playerFormMetrics(player?.id);
    const status=playerStatusForDay(player?.id,state?.season?.currentMatchday||1);
    const statusPenalty=status.unavailable?-4500:0;
    return currentPlayerOvr(player) * 100 + Number(player?.fvm || 0) * .2 + Number(player?.quotation || 0) * .1 + form.score*160 + statusPenalty;
  }

  function cpuLeagueRuleLineupValue(manager,player,day=state?.season?.currentMatchday||1){
    return window.FantaCpuLineupPolicy.playerValue({manager,player,day,state,lineupPlayerValue,leagueRulesFor,cpuLeagueRuleSensitivity,estimatedStarterProbability,currentPlayerOvr,playerFormMetrics,playerSeasonStat,serieAMatchupDifficulty,clamp});
  }

  function cpuLeagueFormationBias(manager,key,day=state?.season?.currentMatchday||1){
    if(!manager || manager.id==='user') return 0;
    const rules=leagueRulesFor(state);
    const sensitivity=cpuLeagueRuleSensitivity(manager);
    const counts=lineupCountsForFormation(key);
    let bonus=0;
    if(rules.defenseModifier==='classic' && counts.D>=4){
      bonus+=135*sensitivity;
      if(counts.D>=5) bonus+=40*sensitivity;
    }
    if(Number(rules.firstGoalThreshold)===65 && counts.A>=3) bonus+=70*sensitivity;
    if(Number(rules.firstGoalThreshold)===67 && counts.D>=4) bonus+=35*sensitivity;
    return bonus;
  }

  function lineupCountsForFormation(key) {
    return lineupSlots(key).reduce((acc,s)=>(acc[s.role]=(acc[s.role]||0)+1,acc),{P:0,D:0,C:0,A:0});
  }

  function normalizeSavedLineup(saved, manager) {
    const formation = allowedLineupFormation(saved?.formation) ? saved.formation : '4-3-3';
    const roster=(manager?.roster||[]);
    const validPlayers = new Set(roster.map(p=>String(p.id)));
    const slotMap = new Map(lineupSlots(formation).map(s=>[s.instanceId,s]));
    const starters = {};
    const used = new Set();
    const wildcardLimit=String(manager?.id||'')==='user' ? adminWildcardStartingSlotLimit() : 0;
    let wildcardUsed=0;
    const adminBlockedId=adminBlockedStarterForManager(manager?.id);
    Object.entries(saved?.starters || {}).forEach(([slotId,playerId]) => {
      const slot = slotMap.get(slotId);
      const player = roster.find(p=>String(p.id)===String(playerId));
      if(adminBlockedId && String(player?.id||'')===String(adminBlockedId)) return;
      const sameRole=!!slot && !!player && player.role===slot.role;
      const legalWildcard=!!slot && !!player && wildcardUsed<wildcardLimit && wildcardSlotCompatible(player.role,slot.role);
      if (!slot || !player || (!sameRole && !legalWildcard) || used.has(String(player.id)) || !validPlayers.has(String(player.id))) return;
      starters[slotId] = String(player.id);
      used.add(String(player.id));
      if(!sameRole) wildcardUsed++;
    });
    const bench=[];
    const benchSeen=new Set();
    (Array.isArray(saved?.bench)?saved.bench:[]).map(String).forEach(id=>{
      if(!validPlayers.has(id)||used.has(id)||benchSeen.has(id)) return;
      bench.push(id); benchSeen.add(id);
    });
    const ro={P:0,D:1,C:2,A:3};
    roster.filter(p=>!used.has(String(p.id))&&!benchSeen.has(String(p.id))).slice().sort((a,b)=>ro[a.role]-ro[b.role] || lineupPlayerValue(b)-lineupPlayerValue(a)).forEach(p=>{
      const id=String(p.id); bench.push(id); benchSeen.add(id);
    });
    const captainId=String(saved?.captainId||'');
    return { formation, starters, bench, captainId:used.has(captainId)?captainId:null, confirmed:!!saved?.confirmed };
  }

  function syncDraftBenchOrder(){
    const manager=managerById('user');
    if(!lineupDraft || !manager) return [];
    const normalized=normalizeSavedLineup(lineupDraft,manager);
    lineupDraft.bench=normalized.bench.slice();
    enforceAdminLastReserve(lineupDraft,manager.id);
    return lineupDraft.bench;
  }

  function draftBenchPlayers(){
    const manager=managerById('user');
    if(!manager || !lineupDraft) return [];
    syncDraftBenchOrder();
    return lineupDraft.bench.map(id=>manager.roster.find(p=>String(p.id)===String(id))).filter(Boolean);
  }

  function moveBenchPlayer(playerId,delta){
    if(lineupReadOnly || !lineupDraft) return;
    syncDraftBenchOrder();
    const id=String(playerId), idx=lineupDraft.bench.indexOf(id);
    if(idx<0 || id===String(adminBlockedStarterForManager('user')||'')) return;
    const lastLocked=!!adminBlockedStarterForManager('user');
    const next=clamp(idx+Number(delta||0),0,lineupDraft.bench.length-1-(lastLocked?1:0));
    if(next===idx) return;
    const [item]=lineupDraft.bench.splice(idx,1);
    lineupDraft.bench.splice(next,0,item);
    lineupDraft.confirmed=false;
    renderLineupScreen();
  }

  function formationChoiceCategoryLabel(category){
    return ({boost:'BOOST',malus:'MALUS AVVERSARIO',risk:'RISCHIO',locker:'SPOGLIATOIO',admin:'ADMIN',rule:'ADMIN'})[category]||'SCELTA';
  }

  function formationChoiceCategoryClass(category){
    if(category==='admin') return 'rule';
    return ['boost','malus','risk','locker','rule'].includes(category)?category:'rule';
  }

  function formationChoiceDayState(day=ensureSeasonState()?.currentMatchday){
    const season=ensureSeasonState();
    if(!season || !day) return null;
    if(!season.formationChoices || typeof season.formationChoices!=='object') season.formationChoices={};
    return season.formationChoices[String(day)]||null;
  }

  function adminRuleDayState(day=ensureSeasonState()?.currentMatchday){
    const season=ensureSeasonState();
    if(!season || !day) return null;
    if(!season.adminRules || typeof season.adminRules!=='object') season.adminRules={};
    return season.adminRules[String(day)]||null;
  }

  function activeAdminRule(day=ensureSeasonState()?.currentMatchday){
    const entry=adminRuleDayState(day);
    return entry?.triggered && entry?.resolved && entry?.selectedOption ? entry.selectedOption : null;
  }

  function activeAdminRuleEffect(day=ensureSeasonState()?.currentMatchday){
    return activeAdminRule(day)?.effect || null;
  }

  function hasPendingMatchdayEvent(day=ensureSeasonState()?.currentMatchday, season=ensureSeasonState()){
    if(!season || !day) return false;
    const key=String(day);
    const formation=season.formationChoices?.[key];
    if(formation?.triggered && !formation.resolved) return true;
    const admin=season.adminRules?.[key];
    if(admin?.triggered && !admin.resolved) return true;
    return false;
  }

  function nextPendingMatchdayEvent(day=ensureSeasonState()?.currentMatchday, season=ensureSeasonState()){
    if(!season || !day) return null;
    const key=String(day);
    const formation=season.formationChoices?.[key];
    if(formation?.triggered && !formation.resolved) return {type:'formation',entry:formation};
    const admin=season.adminRules?.[key];
    if(admin?.triggered && !admin.resolved) return {type:'admin_rule',entry:admin};
    return null;
  }

  function hashPick(list,key){
    if(!list?.length) return null;
    const idx=Math.floor(careerHash(`formation-choice|${key}`)*list.length)%list.length;
    return list[idx]||list[0];
  }

  function sortedByChoiceHash(list,key){
    return list.slice().sort((a,b)=>{
      const av=careerHash(`formation-choice|${key}|${a.id}`);
      const bv=careerHash(`formation-choice|${key}|${b.id}`);
      return av-bv || String(a.name).localeCompare(String(b.name),'it');
    });
  }

  const SERIEA_DERBY_PAIRS = new Set([
    'inter|milan','lazio|roma','juventus|torino'
  ]);

  function isDerbyFixtureForPlayer(player,day=ensureSeasonState()?.currentMatchday||1){
    const fixture=serieAFixtureForPlayer(player,day);
    if(!fixture) return false;
    const pair=[String(player.club),String(fixture.opponentClub)].sort().join('|');
    return SERIEA_DERBY_PAIRS.has(pair);
  }

  function formationChoiceContextForManagers(day, ownManagerId='user', opponentManagerId=userOpponentIdForDay(day), salt='base'){
    const season=ensureSeasonState();
    const round=season?.schedule?.[Number(day)-1];
    const fixture=round?.matches?.find(m=>
      (String(m.homeId)===String(ownManagerId) && String(m.awayId)===String(opponentManagerId)) ||
      (String(m.awayId)===String(ownManagerId) && String(m.homeId)===String(opponentManagerId))
    ) || currentUserFixture();
    const user=managerById(ownManagerId);
    const opponent=managerById(opponentManagerId);
    const userRoster=(user?.roster||[]).filter(p=>!playerStatusForDay(p.id,day).unavailable);
    const oppRoster=(opponent?.roster||[]).filter(p=>!playerStatusForDay(p.id,day).unavailable);

    const pickFrom=(base,key,filter)=>{
      let pool=base.filter(p=>!filter || filter(p));
      if(!pool.length) pool=base.slice();
      const seededKey=`S${state?.career?.seasonNumber||1}|G${day}|${ownManagerId}|${salt}|${key}`;
      return hashPick(sortedByChoiceHash(pool,seededKey),seededKey);
    };
    const pickFromStrict=(base,key,filter)=>{
      const pool=base.filter(p=>!filter || filter(p));
      if(!pool.length) return null;
      const seededKey=`S${state?.career?.seasonNumber||1}|G${day}|${ownManagerId}|${salt}|${key}`;
      return hashPick(sortedByChoiceHash(pool,seededKey),seededKey);
    };

    return {
      day,fixture,oppId:String(opponentManagerId||''),user,opponent,
      pickOwn:(key,filter=null)=>pickFrom(userRoster,key,filter),
      pickOpponent:(key,filter=null)=>pickFrom(oppRoster,key,filter),
      pickOwnStrict:(key,filter=null)=>pickFromStrict(userRoster,key,filter),
      pickOpponentStrict:(key,filter=null)=>pickFromStrict(oppRoster,key,filter)
    };
  }

  function fantasyAppearanceRate(playerId,day){
    const results=state?.season?.matchdayResults||{};
    let played=0,total=0;
    for(let previous=1;previous<Number(day||1);previous++){
      const result=results[String(previous)];
      if(!result)continue;
      const fixture=(result.matches||[]).find(m=>m.homeId==='user'||m.awayId==='user');
      if(!fixture)continue;
      total++;
      const performances=fixture.homeId==='user'?fixture.homePerformances:fixture.awayPerformances;
      if((performances||[]).some(p=>String(p.playerId)===String(playerId) && !p.noVote && p.lineupSource==='starter'))played++;
    }
    return total?played/total:0;
  }

  function formationChoiceContext(day,salt='base'){
    return formationChoiceContextForManagers(day,'user',userOpponentIdForDay(day),salt);
  }

  function specialRivalManager(manager){
    const id=String(manager?.profile?.archetype||manager?.profile?.id||manager?.id||'');
    return id==='admin' || SPECIAL_RIVAL_IDS.includes(id);
  }

  function opponentMalusDayState(day=ensureSeasonState()?.currentMatchday){
    const season=ensureSeasonState();
    if(!season) return null;
    if(!season.opponentMalusEvents || typeof season.opponentMalusEvents!=='object') season.opponentMalusEvents={};
    return season.opponentMalusEvents[String(day)]||null;
  }

  function opponentMalusChanceForManager(manager, division=state?.career?.division||GAME_CONFIG.startingDivision){
    const level=Math.max(1,Math.floor(Number(division||GAME_CONFIG.startingDivision)));
    if(!manager || String(manager.id)==='user') return 0;
    const isSpecial=specialRivalManager(manager);
    if(level===3) return isSpecial ? .12 : 0;
    if(level<=2) return isSpecial ? .20 : .12;
    return 0;
  }

  function generateOpponentMalusOption(day, opponentManager, salt='cpu-malus'){
    const ctx=formationChoiceContextForManagers(day, opponentManager?.id, 'user', `${salt}|${opponentManager?.id||'cpu'}`);
    if(!ctx.user || !ctx.opponent) return null;
    const templates=FORMATION_CHOICE_TEMPLATES
      .filter(template=>template.category==='malus')
      .map(template=>({template, rarity:formationChoiceRarity(template.id), roll:careerHash(`opponent-malus|${day}|${opponentManager?.id||'cpu'}|${template.id}`)}))
      .sort((a,b)=>a.roll-b.roll || String(a.template.id).localeCompare(String(b.template.id),'it'));
    for(let i=0;i<templates.length;i++){
      const built=templates[i].template.build(ctx,i);
      if(built){
        built.rarity=templates[i].rarity;
        return built;
      }
    }
    return null;
  }

  const opponentMalusRollsInProgress=new Set();

  function ensureOpponentMalusRoll(day){
    const season=ensureSeasonState();
    if(!season || !day) return null;
    if(!season.opponentMalusEvents || typeof season.opponentMalusEvents!=='object') season.opponentMalusEvents={};
    const key=String(day);
    let entry=season.opponentMalusEvents[key];
    if(entry?.rolled) return entry;

    const opponentId=userOpponentIdForDay(day);
    const opponent=managerById(opponentId);
    const division=Math.max(1,Math.floor(Number(state?.career?.division||GAME_CONFIG.startingDivision)));
    const chance=opponentMalusChanceForManager(opponent, division);
    const roll=careerHash(`opponent-malus-trigger|D${division}|G${day}|${opponentId||'none'}`);
    const triggered=roll<chance;
    // Target availability reads the active malus. While selecting its target,
    // the same day's malus does not exist yet and must not generate itself.
    if(opponentMalusRollsInProgress.has(key)) return null;
    let option=null;
    opponentMalusRollsInProgress.add(key);
    try{
      option=triggered ? generateOpponentMalusOption(day, opponent, `cpu-malus|D${division}`) : null;
    }finally{
      opponentMalusRollsInProgress.delete(key);
    }
    entry={
      day,
      rolled:true,
      opponentId:opponentId||null,
      opponentLabel:opponent?.profile?.label || opponent?.team || 'Avversario',
      triggerChance:chance,
      roll,
      triggered:!!option && triggered,
      resolved:true,
      selectedOption:option ? {
        ...option,
        cpuMalus:true,
        cpuLabel:opponent?.profile?.label || opponent?.team || 'Avversario',
        text:`${opponent?.profile?.label || opponent?.team || 'Avversario'} ti lancia un malus: ${String(option.text||'').replace(/^.+?[, ]+del tuo prossimo avversario,? ?/i,'').replace(/^.+? parte con /i,'Parte con ')}`
      } : null,
      createdAt:Date.now()
    };
    season.opponentMalusEvents[key]=entry;
    saveState();
    return entry;
  }

  function activeOpponentMalus(day=ensureSeasonState()?.currentMatchday){
    const entry=opponentMalusDayState(day) || ensureOpponentMalusRoll(day);
    return entry?.triggered && entry?.selectedOption ? entry.selectedOption : null;
  }

  function generateFormationChoiceOptions(day,salt='base'){
    const ctx=formationChoiceContext(day,salt);
    if(!ctx.user || !ctx.opponent) return [];

    // Ordine deterministico ma pesato per rarità. Il power-up Cacciatore di rarità
    // aumenta il peso di Rare ed Epiche senza garantire una carta specifica.
    const templates=deterministicFormationTemplateOrder(day,salt);

    const options=[];
    const usedIds=new Set();
    const usedTargets=new Set();

    for(let i=0;i<templates.length && options.length<3;i++){
      const entry=templates[i];
      const built=entry.template.build(ctx,options.length);
      if(built) built.rarity=entry.rarity;
      if(!built || usedIds.has(built.id)) continue;

      // Evita tre carte quasi identiche sullo stesso calciatore.
      const target=built.effect?.targetPlayerId;
      if(target && usedTargets.has(String(target)) && i<templates.length-3) continue;

      options.push(built);
      usedIds.add(built.id);
      if(target) usedTargets.add(String(target));
    }

    return options.slice(0,3);
  }

  function sanitizeLockedFormationChoiceEntry(entry,day){
    if(!entry?.triggered || entry.resolved || formationRaritiesUnlocked()) return entry;
    if(!(entry.options||[]).some(option=>option?.rarity==='rare'||option?.rarity==='epic')) return entry;
    const count=Math.max(0,Number(entry.rerollCount||0));
    entry.options=generateFormationChoiceOptions(day,count?`reroll-${count}`:'base');
    entry.selectedId=null;
    entry.selectedOption=null;
    saveState();
    return entry;
  }

  const ADMIN_RULE_RARITY_PROFILES = Object.freeze({
    4:Object.freeze({common:1.00,rare:0,epic:0}),
    3:Object.freeze({common:.70,rare:.25,epic:.05}),
    2:Object.freeze({common:.50,rare:.35,epic:.15}),
    1:Object.freeze({common:.50,rare:.35,epic:.15})
  });

  function adminRuleRarityProfile(division=state?.career?.division||GAME_CONFIG.startingDivision){
    const value=Math.max(1,Math.floor(Number(division||GAME_CONFIG.startingDivision)));
    return ADMIN_RULE_RARITY_PROFILES[value] || ADMIN_RULE_RARITY_PROFILES[1];
  }

  function generateAdminRuleOption(day,salt='base',excludeId=null){
    const eligible=ADMIN_RULE_TEMPLATES.map(template=>{
      const option=template.build(day);
      if(!option) return null;
      option.rarity=template.rarity||'common';
      option.templateId=template.id;
      return option;
    }).filter(Boolean).filter(option=>!excludeId||String(option.id)!==String(excludeId));
    if(!eligible.length) return null;

    const groups={
      common:eligible.filter(option=>option.rarity==='common'),
      rare:eligible.filter(option=>option.rarity==='rare'),
      epic:eligible.filter(option=>option.rarity==='epic')
    };
    const profile=adminRuleRarityProfile();
    const rarities=['common','rare','epic'].filter(rarity=>groups[rarity].length && Number(profile[rarity]||0)>0);
    if(!rarities.length) return null;

    const total=rarities.reduce((sum,rarity)=>sum+Number(profile[rarity]||0),0);
    const roll=careerHash(`admin-rule-rarity|D${state?.career?.division||GAME_CONFIG.startingDivision}|${day}|${salt}`)*total;
    let cursor=0,selectedRarity=rarities[0];
    for(const rarity of rarities){
      cursor+=Number(profile[rarity]||0);
      if(roll<cursor){selectedRarity=rarity;break;}
    }
    const pool=groups[selectedRarity];
    return sortedByChoiceHash(pool,`admin-rule-pick|${day}|${salt}|${selectedRarity}`)[0] || pool[0];
  }

  function ensureAdminRuleRoll(day){
    const season=ensureSeasonState();
    if(!season) return null;
    const key=String(day);
    if(!season.adminRules || typeof season.adminRules!=='object') season.adminRules={};
    let entry=season.adminRules[key];
    if(entry?.rolled) return entry;

    const roll=careerHash(`admin-rule-trigger|${day}`);
    const chance=ADMIN_RULE_EVENT_CHANCE;
    const triggered=roll<chance;
    const option=triggered?generateAdminRuleOption(day):null;
    entry={
      day,
      rolled:true,
      roll,
      triggerChance:chance,
      triggered:!!option && triggered,
      resolved:!(!!option && triggered),
      selectedId:null,
      selectedOption:option,
      createdAt:Date.now()
    };
    season.adminRules[key]=entry;
    saveState();
    return entry;
  }

  function ensureAllPreMatchEventRolls(day){
    ensureFormationChoiceRoll(day);
    ensureAdminRuleRoll(day);
    ensureOpponentMalusRoll(day);
    return nextPendingMatchdayEvent(day);
  }

  function forcedFormationRuleForDay(day=ensureSeasonState()?.currentMatchday){
    const effect=activeAdminRuleEffect(day);
    return effect?.ruleId==='forced_formation' || effect?.ruleId==='butterfly_555' ? String(effect.formation||'') : null;
  }

  function adminForcedStarterForManager(managerId,day=ensureSeasonState()?.currentMatchday){
    const effect=activeAdminRuleEffect(day);
    if(effect?.ruleId!=='forced_starter_pair') return null;
    if(String(managerId)==='user') return effect.userPlayerId?String(effect.userPlayerId):null;
    if(String(managerId)===String(effect.opponentId||'')) return effect.opponentPlayerId?String(effect.opponentPlayerId):null;
    return null;
  }

  function adminBenchableTopPlayer(manager,day=ensureSeasonState()?.currentMatchday){
    if(!manager) return null;
    const available=(manager.roster||[]).filter(player=>!playerStatusForDay(player.id,day).unavailable);
    const ranked=available.slice().sort((a,b)=>currentPlayerOvr(b)-currentPlayerOvr(a) || Number(b.fvm||0)-Number(a.fvm||0) || String(a.name).localeCompare(String(b.name),'it'));
    return ranked.find(player=>available.some(candidate=>String(candidate.id)!==String(player.id) && candidate.role===player.role)) || null;
  }

  function previousUnusedBenchEligibleIds(day=ensureSeasonState()?.currentMatchday){
    const season=ensureSeasonState(), user=managerById('user');
    const currentDay=Number(day||0), prevDay=currentDay-1;
    if(!season || !user || prevDay<1) return [];
    const previousResult=season.matchdayResults?.[String(prevDay)];
    const previousLineup=season.lineups?.[String(prevDay)]?.user;
    const benchIds=(Array.isArray(previousResult?.userBenchIds)?previousResult.userBenchIds:previousLineup?.bench||[]).map(String);
    if(!benchIds.length) return [];
    const userMatch=(previousResult?.matches||[]).find(match=>match.homeId==='user'||match.awayId==='user');
    const substitutions=userMatch ? (userMatch.homeId==='user'?userMatch.homeSubstitutions:userMatch.awaySubstitutions)||[] : [];
    const entered=new Set(substitutions.map(sub=>String(sub.inPlayerId||''))); 
    const rosterIds=new Set((user.roster||[]).map(player=>String(player.id)));
    return benchIds.filter((id,index)=>benchIds.indexOf(id)===index && rosterIds.has(id) && !entered.has(id) && !playerStatusForDay(id,currentDay).unavailable);
  }

  function adminBlockedStarterForManager(managerId,day=ensureSeasonState()?.currentMatchday){
    const effect=activeAdminRuleEffect(day);
    if(effect?.ruleId!=='top_player_bench') return null;
    if(String(managerId)==='user') return effect.userPlayerId?String(effect.userPlayerId):null;
    if(String(managerId)===String(effect.opponentId||'')) return effect.opponentPlayerId?String(effect.opponentPlayerId):null;
    return null;
  }

  function adminFaithReserveEligibleIds(day=ensureSeasonState()?.currentMatchday){
    const effect=activeAdminRuleEffect(day);
    if(effect?.ruleId!=='faith_reserve') return [];
    return (effect.eligiblePlayerIds||[]).map(String);
  }

  function adminWildcardStartingSlotLimit(day=ensureSeasonState()?.currentMatchday){
    const effect=activeAdminRuleEffect(day);
    if(effect?.ruleId==='double_wildcard_starting_slot') return 2;
    if(effect?.ruleId==='wildcard_starting_slot') return 1;
    return state?.season?.sponsor?.id==='fantacana' ? 1 : 0;
  }

  function wildcardSlotCompatible(playerRole,slotRole){
    const p=String(playerRole||''), s=String(slotRole||'');
    if(!p || !s || p===s) return false;
    if(p==='P' || s==='P') return false;
    if(state?.season?.sponsor?.id==='fantacana') return ['D','C','A'].includes(p) && ['D','C','A'].includes(s);
    return (p==='D'&&s==='C') || (p==='C'&&s==='D') || (p==='C'&&s==='A') || (p==='A'&&s==='C');
  }

  function lineupOutOfRoleEntries(lineup,manager=managerById('user')){
    if(!lineup || !manager) return [];
    const slots=new Map(lineupSlots(lineup.formation).map(slot=>[slot.instanceId,slot]));
    return Object.entries(lineup.starters||{}).map(([slotId,playerId])=>{
      const slot=slots.get(slotId);
      const player=(manager.roster||[]).find(p=>String(p.id)===String(playerId));
      if(!slot || !player || player.role===slot.role) return null;
      return {slotId,playerId:String(player.id),playerRole:player.role,slotRole:slot.role,player};
    }).filter(Boolean);
  }

  function canPlacePlayerInLineupSlot(player,slot,lineup=lineupDraft,day=ensureSeasonState()?.currentMatchday){
    if(!player || !slot) return false;
    const blockedId=adminBlockedStarterForManager('user',day);
    if(blockedId && String(player.id)===String(blockedId)) return false;
    if(player.role===slot.role) return true;
    const wildcardLimit=adminWildcardStartingSlotLimit(day);
    if(wildcardLimit<=0) return false;
    if(!wildcardSlotCompatible(player.role,slot.role)) return false;
    const mismatches=lineupOutOfRoleEntries(lineup).filter(entry=>entry.slotId!==slot.instanceId && String(entry.playerId)!==String(player.id));
    return mismatches.length<wildcardLimit;
  }

  function enforceStarterInLineup(manager,lineup,playerId){
    if(!manager || !lineup || !playerId) return lineup;
    const forced=(manager.roster||[]).find(player=>String(player.id)===String(playerId));
    if(!forced) return lineup;
    const forcedId=String(forced.id);
    if(Object.values(lineup.starters||{}).map(String).includes(forcedId)) return lineup;
    const roleSlots=lineupSlots(lineup.formation).filter(slot=>slot.role===forced.role);
    if(!roleSlots.length) return lineup;
    const targetSlot=roleSlots.slice().sort((a,b)=>{
      const pa=(manager.roster||[]).find(p=>String(p.id)===String(lineup.starters?.[a.instanceId]||''));
      const pb=(manager.roster||[]).find(p=>String(p.id)===String(lineup.starters?.[b.instanceId]||''));
      return lineupPlayerValue(pa)-lineupPlayerValue(pb);
    })[0];
    if(!targetSlot) return lineup;
    const displaced=lineup.starters?.[targetSlot.instanceId]?String(lineup.starters[targetSlot.instanceId]):null;
    lineup.starters[targetSlot.instanceId]=forcedId;
    lineup.bench=(lineup.bench||[]).map(String).filter(id=>id!==forcedId && id!==displaced);
    if(displaced) lineup.bench.unshift(displaced);
    lineup.confirmed=true;
    lineup.updatedAt=Date.now();
    return lineup;
  }

  function enforceAdminLastReserve(lineup,managerId,day=state?.season?.currentMatchday){
    const id=String(adminBlockedStarterForManager(managerId,day)||'');
    if(!id || !lineup || Object.values(lineup.starters||{}).map(String).includes(id)) return lineup;
    lineup.bench=(lineup.bench||[]).map(String).filter(item=>item!==id);
    lineup.bench.push(id);
    return lineup;
  }

  function enforcePlayerBenchedInLineup(manager,lineup,playerId,day=ensureSeasonState()?.currentMatchday){
    if(!manager || !lineup || !playerId) return lineup;
    const blockedId=String(playerId);
    const entry=Object.entries(lineup.starters||{}).find(([,id])=>String(id)===blockedId);
    if(!entry) return enforceAdminLastReserve(lineup,manager.id,day);
    const blocked=(manager.roster||[]).find(player=>String(player.id)===blockedId);
    if(!blocked) return lineup;
    const used=new Set(Object.values(lineup.starters||{}).map(String));
    const candidates=(manager.roster||[]).filter(player=>player.role===blocked.role && String(player.id)!==blockedId && !used.has(String(player.id)) && !playerStatusForDay(player.id,day).unavailable).sort((a,b)=>{
      const av=manager.id==='user'?lineupPlayerValue(a):cpuLeagueRuleLineupValue(manager,a,day);
      const bv=manager.id==='user'?lineupPlayerValue(b):cpuLeagueRuleLineupValue(manager,b,day);
      return bv-av;
    });
    const replacement=candidates[0];
    if(!replacement) return lineup;
    const [slotId]=entry, replacementId=String(replacement.id);
    lineup.starters[slotId]=replacementId;
    lineup.bench=(lineup.bench||[]).map(String).filter(id=>id!==replacementId && id!==blockedId);
    lineup.bench.push(blockedId);
    if(String(lineup.captainId||'')===blockedId) lineup.captainId=null;
    lineup.confirmed=true;
    lineup.updatedAt=Date.now();
    return lineup;
  }

  function enforceFaithReserveStarterInLineup(manager,lineup,day=ensureSeasonState()?.currentMatchday){
    if(!manager || manager.id!=='user' || !lineup) return lineup;
    const eligible=new Set(adminFaithReserveEligibleIds(day));
    if(!eligible.size) return lineup;
    const starterIds=Object.values(lineup.starters||{}).map(String);
    if(starterIds.some(id=>eligible.has(id))) return lineup;
    const candidates=(manager.roster||[]).filter(player=>eligible.has(String(player.id)) && !playerStatusForDay(player.id,day).unavailable).sort((a,b)=>lineupPlayerValue(b)-lineupPlayerValue(a));
    const reserve=candidates[0];
    if(!reserve) return lineup;
    const roleSlots=lineupSlots(lineup.formation).filter(slot=>slot.role===reserve.role && lineup.starters?.[slot.instanceId]);
    if(!roleSlots.length) return lineup;
    const targetSlot=roleSlots.slice().sort((a,b)=>{
      const pa=(manager.roster||[]).find(player=>String(player.id)===String(lineup.starters[a.instanceId]));
      const pb=(manager.roster||[]).find(player=>String(player.id)===String(lineup.starters[b.instanceId]));
      return lineupPlayerValue(pa)-lineupPlayerValue(pb);
    })[0];
    const displaced=String(lineup.starters[targetSlot.instanceId]||'');
    const reserveId=String(reserve.id);
    lineup.starters[targetSlot.instanceId]=reserveId;
    lineup.bench=(lineup.bench||[]).map(String).filter(id=>id!==reserveId && id!==displaced);
    if(displaced) lineup.bench.unshift(displaced);
    lineup.confirmed=true;
    lineup.updatedAt=Date.now();
    return lineup;
  }

  function lineupTurnoverDeltaFromPrevious(lineup, day=ensureSeasonState()?.currentMatchday, required=3){
    const season=ensureSeasonState();
    if(!season || !lineup || Number(day||0)<=1) return {changed:0,required:0,ok:true};
    const prev=season.lineups?.[String(Number(day)-1)]?.user;
    const prevIds=new Set(Object.values(prev?.starters||{}).map(String).filter(Boolean));
    const currentIds=new Set(Object.values(lineup?.starters||{}).map(String).filter(Boolean));
    if(!prevIds.size || !currentIds.size) return {changed:0,required:0,ok:true};
    let overlap=0;
    currentIds.forEach(id=>{ if(prevIds.has(id)) overlap++; });
    const changed=Math.max(0,currentIds.size-overlap);
    return {changed,required:Number(required||0),ok:changed>=Number(required||0)};
  }

  function validateAdminRuleLineup(lineup, day=ensureSeasonState()?.currentMatchday){
    const effect=activeAdminRuleEffect(day);
    if(!effect) return {ok:true};
    if(effect.ruleId==='forced_formation' || effect.ruleId==='butterfly_555'){
      const formation=String(effect.formation||'');
      if(String(lineup?.formation||'')!==formation){
        return {ok:false,message:`Regolamento Admin: per questa giornata devi usare il modulo ${formation}.`};
      }
    }
    if(effect.ruleId==='forced_turnover_3' || effect.ruleId==='forced_turnover_5'){
      const required=effect.ruleId==='forced_turnover_5'?5:3;
      const info=lineupTurnoverDeltaFromPrevious(lineup,day,required);
      if(!info.ok){
        return {ok:false,message:`Regolamento Admin: servono almeno ${required} cambi di titolari rispetto alla giornata precedente. Al momento ne hai cambiati ${info.changed}/${required}.`};
      }
    }
    if(effect.ruleId==='forced_starter_pair'){
      const forcedId=String(effect.userPlayerId||'');
      const currentIds=new Set(Object.values(lineup?.starters||{}).map(String));
      if(forcedId && !currentIds.has(forcedId)){
        return {ok:false,message:`Regolamento Admin: ${effect.userPlayerName||'il giocatore imposto'} deve essere schierato nell'XI titolare.`};
      }
    }
    if(effect.ruleId==='top_player_bench'){
      const blockedId=String(effect.userPlayerId||'');
      const currentIds=new Set(Object.values(lineup?.starters||{}).map(String));
      if(blockedId && (currentIds.has(blockedId) || String(lineup?.bench?.[lineup.bench.length-1]||'')!==blockedId)){
        return {ok:false,message:`Regolamento Admin: ${effect.userPlayerName||'il tuo Top Player'} deve occupare l’ultimo posto in panchina in questa giornata.`};
      }
    }
    if(effect.ruleId==='faith_reserve'){
      const eligible=new Set((effect.eligiblePlayerIds||[]).map(String));
      const currentIds=Object.values(lineup?.starters||{}).map(String);
      if(eligible.size && !currentIds.some(id=>eligible.has(id))){
        return {ok:false,message:'Regolamento Admin: devi schierare titolare almeno una delle riserve della giornata precedente che non erano entrate.'};
      }
    }
    if(effect.ruleId==='wildcard_starting_slot' || effect.ruleId==='double_wildcard_starting_slot'){
      const maxOutOfRole=effect.ruleId==='double_wildcard_starting_slot'?2:1;
      const mismatches=lineupOutOfRoleEntries(lineup);
      if(mismatches.length>maxOutOfRole){
        return {ok:false,message:`Regolamento Admin: puoi utilizzare al massimo ${maxOutOfRole} giocator${maxOutOfRole===1?'e':'i'} fuori ruolo nell'XI.`};
      }
      if(mismatches.some(entry=>!wildcardSlotCompatible(entry.playerRole,entry.slotRole))){
        return {ok:false,message:'Regolamento Admin: i Jolly valgono solo tra ruoli adiacenti D↔C e C↔A; il portiere resta vincolato al ruolo P.'};
      }
    }
    return {ok:true};
  }

  function adminRuleNeedsLineupReconfirm(option, season=ensureSeasonState(), day=ensureSeasonState()?.currentMatchday){
    const effect=option?.effect;
    if(!effect || !season || !day) return false;
    if(!['forced_formation','butterfly_555','forced_turnover_3','forced_turnover_5','forced_starter_pair','top_player_bench','faith_reserve'].includes(effect.ruleId)) return false;
    const saved=season.lineups?.[String(day)]?.user;
    if(!saved?.confirmed) return false;
    if(effect.ruleId==='butterfly_555' && (saved.formation!=='5-5-5' || Object.keys(saved.starters||{}).length!==16)) return true;
    return !validateAdminRuleLineup(saved,day).ok;
  }

  function syncFlowAfterPreMatchResolution(season,day,{forceLineup=false}={}){
    if(forceLineup){
      setMatchdayFlowPhase(season,day,'lineup',{eventResolvedAt:Date.now()});
      return 'lineup';
    }
    const pending=nextPendingMatchdayEvent(day,season);
    if(pending){
      setMatchdayFlowPhase(season,day,'event_pending',{eventResolvedAt:Date.now()});
      return 'event_pending';
    }
    setMatchdayFlowPhase(season,day,'match_ready',{eventResolvedAt:Date.now()});
    return 'match_ready';
  }

  function adminRuleCover(rarity='common'){
    return rarity==='rare' || rarity==='epic'
      ? 'assets/referee_rule_rare_epic.webp'
      : 'assets/referee_rule.webp';
  }

  function ensureForcedFormationDraft(){
    const forced=forcedFormationRuleForDay();
    if(!forced || !lineupDraft || !LINEUP_FORMATIONS[forced] || lineupDraft.formation===forced) return false;
    const currentPlayers=Object.values(lineupDraft.starters).map(draftPlayerById).filter(Boolean);
    const next={};
    ['P','D','C','A'].forEach(role=>{
      const ids=currentPlayers.filter(p=>p.role===role).map(p=>String(p.id));
      const slots=lineupSlots(forced).filter(s=>s.role===role);
      ids.slice(0,slots.length).forEach((id,idx)=>{ next[slots[idx].instanceId]=id; });
    });
    lineupDraft.formation=forced;
    lineupDraft.starters=next;
    syncDraftBenchOrder();
    lineupDraft.confirmed=false;
    lineupSelectedPlayerId=null;
    return true;
  }

  function ensureFormationChoiceRoll(day){
    const season=ensureSeasonState();
    if(!season) return null;
    const key=String(day);
    let entry=season.formationChoices[key];
    if(entry?.seasonShock && !entry.resolved && seasonShockChance()===0){
      delete season.formationChoices[key];
      entry=null;
    }
    if(entry?.rolled){
      const deprecated=(entry.options||[]).some(x=>x?.category==='tactic'||x?.category==='rule') || ['tactic','rule'].includes(entry.selectedOption?.category);
      if(!deprecated) return sanitizeLockedFormationChoiceEntry(entry,day);
      // Migrazione live dei salvataggi precedenti: le vecchie carte tattica/regola
      // non devono più apparire né bloccare il flusso prepartita.
      delete season.formationChoices[key];
      entry=null;
    }

    const roll=careerHash(`formation-event-trigger|${day}`);
    const chance=formationEventChance();
    const triggered=roll<chance;
    const alreadyCursed=Object.values(season.formationChoices||{}).some(choice=>choice?.seasonShock);
    const eligible=(managerById('user')?.roster||[]).some(player=>!playerStatusForDay(player.id,day).unavailable);
    // Sostituisce occasionalmente un evento ordinario; una sola volta per stagione.
    const seasonShock=triggered && !alreadyCursed && eligible &&
      careerHash(`season-shock|${state?.career?.seasonNumber||1}|${day}`)<seasonShockChance();
    const shockOrder=[0,1,2].sort((a,b)=>careerHash(`season-shock-order|${day}|${a}`)-careerHash(`season-shock-order|${day}|${b}`));
    entry={
      day,
      rolled:true,
      roll,
      triggerChance:chance,
      triggered,
      resolved:!triggered,
      selectedId:null,
      selectedOption:null,
      seasonShock,
      options:seasonShock?shockOrder.map((slot,index)=>({id:`season-shock-${day}-${index}`,kind:slot===0?'cruciate':'neutral'})):
        (triggered?generateFormationChoiceOptions(day):[]),
      createdAt:Date.now()
    };
    season.formationChoices[key]=entry;
    saveState();
    return entry;
  }

  function activeFormationChoice(day=ensureSeasonState()?.currentMatchday){
    const entry=formationChoiceDayState(day);
    const option=entry?.triggered && entry?.resolved && entry?.selectedOption ? entry.selectedOption : null;
    if(!option) return null;
    // Le categorie TATTICA e CAMBIO REGOLA sono state rimosse dalle carte normali.
    if(option.category==='tactic' || option.category==='rule') return null;
    return option;
  }

  function tacticForManager(day,managerId){
    if(managerId!=='user') return null;
    const ruleId=activeAdminRuleEffect(day)?.ruleId || null;
    if(ruleId==='extra_subs_7') return 'extra_subs';
    if(ruleId==='wildcard_sub') return 'wildcard_sub';
    if(ruleId==='best_bench') return 'best_bench';
    return null;
  }

  function riskAdjustmentForPerformance(perf,day){
    const choice=activeFormationChoice(day);
    const effect=choice?.effect;
    if(!effect || String(effect.targetPlayerId||'')!==String(perf?.playerId||'')) return 0;

    if(effect.kind==='risk_vote'){
      if(perf?.noVote || perf?.vote===null || perf?.vote===undefined) return Number(effect.penalty||0);
      return Number(perf.vote)>=Number(effect.threshold||6.5)
        ? Number(effect.reward||0)
        : Number(effect.penalty||0);
    }

    if(effect.kind==='risk_goal'){
      return Number(perf?.goals||0)>0 ? Number(effect.reward||0) : Number(effect.penalty||0);
    }

    return 0;
  }

  function fantasyRuleForDay(day){
    const league=leagueRulesFor(state);
    const base={
      goalBonus:3,
      assistBonus:1,
      yellowMalus:.5,
      redMalus:1,
      ownGoalMalus:2,
      missedPenaltyMalus:3,
      savedPenaltyBonus:3,
      goalConcededMalus:1,
      cleanSheetBonus:Number(league.cleanSheetBonus||0),
      decisiveGoalBonus:!!league.decisiveGoalBonus,
      captainBonus:league.captainBonus,
      defenseModifier:league.defenseModifier==='classic'?'classic':'off',
      firstGoalThreshold:clamp(Number(league.firstGoalThreshold||66),65,67),
      goalStep:6,
      minVoteMinutes:SERIEA_MIN_VOTE_MINUTES,
      maxFantasySubs:[1,3,5].includes(Number(league.maxFantasySubs))?Number(league.maxFantasySubs):FANTASY_MAX_SUBS
    };
    // Gli eventi Admin della singola giornata possono sovrascrivere temporaneamente
    // il regolamento stagionale sorteggiato prima dell'asta.
    const adminRuleId=activeAdminRuleEffect(day)?.ruleId || null;
    base.cesarini=adminRuleId==='cesarini';
    if(adminRuleId==='no_substitutions') base.maxFantasySubs=0;
    if(adminRuleId==='goal_threshold_76') base.firstGoalThreshold=76;

    return base;
  }

  function starterReportActive(day=ensureSeasonState()?.currentMatchday){
    return !!consumableDayEffect(day)?.starterReport;
  }

  function specialTrainingPlayerIds(day=ensureSeasonState()?.currentMatchday){
    const effect=consumableDayEffect(day);
    const ids=[];
    if(Array.isArray(effect?.trainingPlayerIds)) ids.push(...effect.trainingPlayerIds.map(String));
    if(effect?.trainingPlayerId) ids.push(String(effect.trainingPlayerId));
    return [...new Set(ids.filter(Boolean))];
  }

  function specialTrainingPlayerId(day=ensureSeasonState()?.currentMatchday){
    return specialTrainingPlayerIds(day)[0] || null;
  }

  function specialTrainingUsedForPlayer(day,playerId){
    return specialTrainingPlayerIds(day).includes(String(playerId||''));
  }

  function blockedOpponentPlayerId(day=ensureSeasonState()?.currentMatchday){
    return consumableDayEffect(day)?.blockedOpponentPlayerId ? String(consumableDayEffect(day).blockedOpponentPlayerId) : null;
  }

  function worldPlayerModifier(day,playerId){
    const targetId=String(playerId||'');
    const choice=activeFormationChoice(day);
    const effect=choice?.effect;
    const cpuEffect=typeof activeOpponentMalus==='function' ? activeOpponentMalus(day)?.effect : null;
    let merged=null;
    if(effect?.kind==='world_player' && String(effect.targetPlayerId||'')===targetId) merged={...effect};
    if(cpuEffect?.kind==='world_player' && String(cpuEffect.targetPlayerId||'')===targetId) merged={...(merged||{}), ...cpuEffect};
    const surprise=expertDayState(day)?.boosts.find(boost=>boost.playerId===targetId);
    if(surprise){
      merged ||= {kind:'world_player',targetPlayerId:targetId};
      const large=surprise.size==='large';
      if(surprise.kind==='starter') merged.starterScoreDelta=Number(merged.starterScoreDelta||0)+(large?8:3);
      if(surprise.kind==='vote') merged.voteDelta=Number(merged.voteDelta||0)+(large?.55:.25);
      if(surprise.kind==='goal') merged.goalMultiplier=Number(merged.goalMultiplier||1)*(large?1.65:1.25);
      if(surprise.kind==='assist') merged.assistMultiplier=Number(merged.assistMultiplier||1)*(large?1.65:1.25);
    }
    if(specialTrainingUsedForPlayer(day,targetId)){
      merged ||= {kind:'world_player',targetPlayerId:targetId};
      merged.voteDelta=Number(merged.voteDelta||0)+.25;
      merged.goalMultiplier=Number(merged.goalMultiplier||1)*1.10;
      merged.assistMultiplier=Number(merged.assistMultiplier||1)*1.10;
    }
    return merged;
  }

  function formationPlayerModifier(day,playerId,kind){
    const targetId=String(playerId||'');
    const userEffect=activeFormationChoice(day)?.effect;
    const cpuEffect=typeof activeOpponentMalus==='function' ? activeOpponentMalus(day)?.effect : null;
    const effects=[userEffect,cpuEffect].filter(Boolean);
    for(const effect of effects){
      if(String(effect.targetPlayerId||'')!==targetId) continue;
      if(effect.kind===kind) return effect;
    }
    return null;
  }

  function formationChoiceCover(category,rarity='common'){
    const normalizedRarity=String(rarity||'common').toLowerCase();
    if(normalizedRarity==='rare' || normalizedRarity==='epic'){
      const special={
        boost:'boost-rare-epic.webp',
        locker:'spogliatoio-rare-epic.webp',
        malus:'malus-rare-epic.webp',
        rule:'regola-rare-epic.webp',
        risk:'rischio-rare-epic.webp'
      };
      if(special[category]) return special[category];
    }
    return ({
      boost:'boost.webp',
      locker:'spogliatoio.webp',
      malus:'malus.webp',
      rule:'regola.webp',
      risk:'rischio.webp',
      tactic:'tattica.webp'
    })[category] || 'regola.webp';
  }

  function rerollFormationChoiceCards(){
    const season=ensureSeasonState();
    if(!season) return;
    const day=season.currentMatchday,entry=formationChoiceDayState(day);
    if(!entry?.triggered || entry.resolved || entry.seasonShock) return;
    if(consumableQuantity('cons_reroll_event',season)<=0){showToast('Non hai Reroll Evento nell’inventario.',true);return;}
    const previous=(entry.options||[]).map(x=>x.id).join('|');
    let count=Math.max(0,Number(entry.rerollCount||0));
    let next=[];
    for(let tries=0;tries<8;tries++){
      count++;
      next=generateFormationChoiceOptions(day,`reroll-${count}`);
      if(next.map(x=>x.id).join('|')!==previous) break;
    }
    if(!next.length){showToast('Nessuna nuova combinazione disponibile.',true);return;}
    if(!consumeConsumable('cons_reroll_event',{day,note:'reroll_event'})) return;
    entry.rerollCount=count;
    entry.options=next;
    entry.selectedId=null;
    entry.selectedOption=null;
    entry.lastRerollAt=Date.now();
    saveState();
    renderFormationChoiceModal(entry);
    showToast(`Carte evento rigenerate · Reroll rimasti: ${consumableQuantity('cons_reroll_event',season)}.`);
  }

  function rerollAdminRuleCard(){
    const season=ensureSeasonState();
    if(!season) return;
    const day=season.currentMatchday,entry=adminRuleDayState(day);
    if(!entry?.triggered || entry.resolved || !entry.selectedOption) return;
    if(consumableQuantity('cons_reroll_admin',season)<=0){showToast('Non hai Reroll Admin nell’inventario.',true);return;}
    const count=Math.max(0,Number(entry.rerollCount||0))+1;
    const next=generateAdminRuleOption(day,`reroll-${count}`,entry.selectedOption.id);
    if(!next){showToast('Nessuna regola Admin alternativa disponibile.',true);return;}
    if(!consumeConsumable('cons_reroll_admin',{day,note:'reroll_admin'})) return;
    entry.rerollCount=count;
    entry.selectedOption=next;
    entry.selectedId=null;
    entry.lastRerollAt=Date.now();
    saveState();
    renderAdminRuleModal(entry);
    showToast(`Regola Admin rigenerata · Reroll rimasti: ${consumableQuantity('cons_reroll_admin',season)}.`);
  }

  function renderFormationChoiceModal(entry){
    entry=sanitizeLockedFormationChoiceEntry(entry,entry?.day);
    const modal=$('formationChoiceModal');
    const box=$('formationChoiceOptions');
    if(!modal || !box || !entry) return;

    if(entry.seasonShock){
      $('formationChoiceDay').textContent=`GIORNATA ${entry.day}`;
      $('formationChoiceKicker').textContent='☠ IMPREVISTO DI STAGIONE';
      $('formationChoiceTitle').textContent='La maledizione';
      $('formationChoiceText').textContent='Tre carte coperte. Girane una: l’effetto si applica immediatamente.';
      $('formationChoiceFooterText').textContent='Una carta nasconde un grave infortunio. Le altre due sono neutrali.';
      $('formationEventRerollBtn')?.classList.add('hidden');
      box.innerHTML=(entry.options||[]).map((option,index)=>`
        <article class="formation-flip-card type-malus rarity-epic" data-shock-card="${escapeHtml(option.id)}" tabindex="0" role="button" aria-label="Carta coperta ${index+1}. Gira e applica subito l’esito.">
          <div class="formation-flip-inner">
            <section class="formation-card-face formation-card-front"><img class="formation-card-cover" src="assets/maledizione-stagione.webp" alt="Maledizione"><span class="formation-card-index">0${index+1}</span><div class="formation-card-front-footer"><span class="formation-card-front-category">MALEDIZIONE</span><button class="formation-card-flip-btn" type="button" tabindex="-1">GIRA ↻</button></div></section>
            <section class="formation-card-face formation-card-back"><div class="formation-card-back-top"><span class="formation-choice-icon">${option.kind==='cruciate'?'🩼':'✨'}</span><span class="formation-choice-category">IMPREVISTO</span></div><div class="formation-card-back-copy"><strong>${option.kind==='cruciate'?'Rotto il crociato!':'Falso allarme'}</strong><small>${option.kind==='cruciate'?escapeHtml(entry.selectedOption?.id===option.id?entry.selectedOption.text:'Un giocatore della tua rosa non sarà disponibile fino a fine stagione!'):'Nessuna conseguenza per la tua squadra.'}</small></div><div class="formation-card-back-footer"><button type="button" class="formation-card-select-btn" data-shock-continue>CONTINUA ✓</button></div></section>
          </div>
        </article>`).join('');
      box.querySelectorAll('[data-shock-card]').forEach(card=>{
        const reveal=()=>{
          if(entry.resolved) return;
          resolveSeasonShock(card.dataset.shockCard);
          const result=entry.selectedOption;
          if(result?.id!==card.dataset.shockCard) return;
          card.querySelector('.formation-card-back-copy small').textContent=result.text;
          card.classList.add('is-flipped');
          box.querySelectorAll('[data-shock-card]').forEach(other=>{if(other!==card){other.setAttribute('aria-disabled','true');other.tabIndex=-1;other.style.pointerEvents='none';}});
          card.setAttribute('aria-label',`${result.title}. ${result.text}`);
          card.querySelector('[data-shock-continue]').focus();
        };
        card.addEventListener('click',event=>{if(event.target.closest('[data-shock-continue]')){hideFormationChoiceModal();openNextSeasonEvent(entry.day);return;}reveal();});
        card.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&!event.target.closest('button')){event.preventDefault();reveal();}});
      });
      $('matchdayEventRestoreBtn')?.classList.add('hidden');
      modal.classList.add('show');modal.setAttribute('aria-hidden','false');
      return;
    }
    $('formationEventRerollBtn')?.classList.remove('hidden');

    $('formationChoiceDay').textContent=`GIORNATA ${entry.day}`;
    if($('formationChoiceKicker')) $('formationChoiceKicker').textContent='⚡ IMPREVISTO DI GIORNATA';
    if($('formationChoiceTitle')) $('formationChoiceTitle').textContent='Prima di andare alla partita...';
    if($('formationChoiceText')) $('formationChoiceText').innerHTML='È successo qualcosa. <strong>Gira le carte</strong>, scopri gli effetti e scegli 1 delle 3 opzioni. Dopo la scelta potrai ancora modificare la formazione prima della Diretta Gol.';
    if($('formationChoiceFooterText')) $('formationChoiceFooterText').textContent='Clicca una carta per girarla. La scelta finale è definitiva.';
    const eventReroll=$('formationEventRerollBtn');
    if(eventReroll){
      const qty=consumableQuantity('cons_reroll_event');
      eventReroll.textContent=`🎴 REROLL · ×${qty}`;
      eventReroll.disabled=qty<=0;
      eventReroll.onclick=rerollFormationChoiceCards;
    }

    box.innerHTML=(entry.options||[]).map((option,index)=>{
      const category=formationChoiceCategoryClass(option.category);
      const cover=formationChoiceCover(option.category, option.rarity||'common');

      return `
        <article class="formation-flip-card type-${category} rarity-${escapeHtml(option.rarity||'common')}" data-flip-card="${escapeHtml(option.id)}" tabindex="0" role="button" aria-label="Carta ${formationChoiceCategoryLabel(option.category)} ${formationChoiceRarityLabel(option.rarity||'common')}. Clicca per girare.">
          <div class="formation-flip-inner">

            <section class="formation-card-face formation-card-front">
              <img class="formation-card-cover" src="${cover}" alt="${escapeHtml(formationChoiceCategoryLabel(option.category))}">
              <span class="formation-card-index">0${index+1}</span>
              <div class="formation-card-front-footer">
                <span class="formation-card-front-category">${formationChoiceCategoryLabel(option.category)}</span><span class="formation-card-rarity rarity-${escapeHtml(option.rarity||'common')}">${formationChoiceRarityLabel(option.rarity||'common')}</span>
                <button type="button" class="formation-card-flip-btn" data-flip-action="${escapeHtml(option.id)}">GIRA ↻</button>
              </div>
            </section>

            <section class="formation-card-face formation-card-back">
              <div class="formation-card-back-top">
                <span class="formation-choice-icon">${option.icon||'?'}</span>
                <span class="formation-choice-category">${formationChoiceCategoryLabel(option.category)}</span><span class="formation-card-rarity rarity-${escapeHtml(option.rarity||'common')}">${formationChoiceRarityLabel(option.rarity||'common')}</span>
              </div>
              <div class="formation-card-back-copy">
                <strong>${escapeHtml(option.title)}</strong>
                <small>${escapeHtml(option.text)}</small>
              </div>
              <div class="formation-card-back-footer">
                <button type="button" class="formation-card-flip-back-btn" data-flip-action="${escapeHtml(option.id)}">↺ RIGIRA</button>
                <button type="button" class="formation-card-select-btn" data-formation-choice="${escapeHtml(option.id)}">SCEGLI ✓</button>
              </div>
            </section>

          </div>
        </article>
      `;
    }).join('');

    const toggleCard=(id)=>{
      const card=box.querySelector(`[data-flip-card="${CSS.escape(String(id))}"]`);
      if(!card) return;
      const flipped=card.classList.toggle('is-flipped');
      card.setAttribute('aria-label',flipped?'Carta girata. Leggi l’effetto o scegli.':'Carta coperta. Clicca per girare.');
    };

    box.querySelectorAll('[data-flip-card]').forEach(card=>{
      card.addEventListener('click',e=>{
        if(e.target.closest('[data-formation-choice]') || e.target.closest('[data-flip-action]')) return;
        toggleCard(card.dataset.flipCard);
      });
      card.addEventListener('keydown',e=>{
        if((e.key==='Enter' || e.key===' ') && !e.target.closest('button')){
          e.preventDefault();
          toggleCard(card.dataset.flipCard);
        }
      });
    });

    box.querySelectorAll('[data-flip-action]').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        toggleCard(btn.dataset.flipAction);
      });
    });

    box.querySelectorAll('[data-formation-choice]').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        resolveFormationChoice(btn.dataset.formationChoice);
      });
    });

    $('matchdayEventRestoreBtn')?.classList.add('hidden');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
  }

  function resolveSeasonShock(optionId){
    const season=ensureSeasonState();
    const day=season?.currentMatchday;
    const entry=season?.formationChoices?.[String(day)];
    if(!entry?.seasonShock || entry.resolved) return;
    const option=(entry.options||[]).find(item=>item.id===optionId);
    if(!option) return;
    let result={id:option.id,title:'Falso allarme',text:'Nessuna conseguenza per la tua squadra.'};
    if(option.kind==='cruciate'){
      const eligible=(managerById('user')?.roster||[]).filter(player=>!playerStatusForDay(player.id,day).unavailable);
      const player=hashPick(eligible,`cruciate|${state?.career?.seasonNumber||1}|${day}`);
      if(player){
        ensurePlayerSeasonSystems(season);
        const status=season.playerStatus[String(player.id)] ||= {injuryUntil:0,suspensionUntil:0,yellowAccum:0,lastReason:''};
        status.injuryUntil=FANTASY_SEASON_MATCHDAYS;
        status.lastReason='Rotto il crociato';
        result={id:option.id,title:'Rotto il crociato!',text:`${player.name} non sarà disponibile fino a fine stagione!`,playerId:String(player.id)};
      }
    }
    entry.selectedId=option.id;
    entry.selectedOption=result;
    entry.resolved=true;
    entry.resolvedAt=Date.now();
    syncFlowAfterPreMatchResolution(season,day,{forceLineup:!!result.playerId});
    saveState();
  }

  function openNextSeasonEvent(day){
    const pending=nextPendingMatchdayEvent(day);
    if(pending?.type==='admin_rule') renderAdminRuleModal(pending.entry);
    else renderSeasonDashboard();
  }

  function hideFormationChoiceModal(){
    const modal=$('formationChoiceModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    if($('matchdayEventRestoreBtn')?.dataset.modal==='formationChoiceModal') $('matchdayEventRestoreBtn').classList.add('hidden');
  }

  function renderAdminRuleModal(entry){
    const modal=$('adminRuleModal');
    const box=$('adminRuleOptions');
    if(!modal || !box || !entry?.selectedOption) return;
    const option=entry.selectedOption;
    if($('adminRuleDay')) $('adminRuleDay').textContent=`GIORNATA ${entry.day}`;
    const adminReroll=$('adminRuleRerollBtn');
    if(adminReroll){
      const qty=consumableQuantity('cons_reroll_admin');
      adminReroll.textContent=`📜 REROLL · ×${qty}`;
      adminReroll.disabled=qty<=0;
      adminReroll.onclick=rerollAdminRuleCard;
    }
    box.innerHTML=`
      <article class="formation-flip-card type-rule admin-rule-card rarity-${escapeHtml(option.rarity||'common')}" data-admin-rule-card="${escapeHtml(option.id)}" tabindex="0" role="button" aria-label="Carta regolamento Admin ${formationChoiceRarityLabel(option.rarity||'common')}. Clicca per girare.">
        <div class="formation-flip-inner">
          <section class="formation-card-face formation-card-front">
            <img class="formation-card-cover" src="${adminRuleCover(option.rarity)}" alt="Regolamento Admin">
            <span class="formation-card-index">01</span>
            <div class="formation-card-front-footer">
              <span class="formation-card-front-category">REGOLAMENTO ADMIN</span><span class="formation-card-rarity rarity-${escapeHtml(option.rarity||'common')}">${formationChoiceRarityLabel(option.rarity||'common')}</span>
              <button type="button" class="formation-card-flip-btn" data-admin-rule-flip="${escapeHtml(option.id)}">GIRA ↻</button>
            </div>
          </section>
          <section class="formation-card-face formation-card-back">
            <div class="formation-card-back-top">
              <span class="formation-choice-icon">${option.icon||'📜'}</span>
              <span class="formation-choice-category">REGOLAMENTO ADMIN</span>
              <span class="formation-card-rarity rarity-${escapeHtml(option.rarity||'common')}">${formationChoiceRarityLabel(option.rarity||'common')}</span>
            </div>
            <div class="formation-card-back-copy">
              <strong>${escapeHtml(option.title)}</strong>
              <small>${escapeHtml(option.text)}</small>
            </div>
            <div class="formation-card-back-footer">
              <button type="button" class="formation-card-flip-back-btn" data-admin-rule-flip="${escapeHtml(option.id)}">↺ RIGIRA</button>
              <button type="button" class="formation-card-select-btn" data-admin-rule-confirm="${escapeHtml(option.id)}">CONFERMA ✓</button>
            </div>
          </section>
        </div>
      </article>`;

    const toggle=()=>{
      const card=box.querySelector('[data-admin-rule-card]');
      if(!card) return;
      const flipped=card.classList.toggle('is-flipped');
      card.setAttribute('aria-label',flipped?'Carta regolamento girata. Leggi l’effetto o conferma.':'Carta regolamento coperta. Clicca per girare.');
    };

    const card=box.querySelector('[data-admin-rule-card]');
    card?.addEventListener('click',e=>{
      if(e.target.closest('[data-admin-rule-confirm]') || e.target.closest('[data-admin-rule-flip]')) return;
      toggle();
    });
    card?.addEventListener('keydown',e=>{
      if((e.key==='Enter' || e.key===' ') && !e.target.closest('button')){
        e.preventDefault();
        toggle();
      }
    });
    box.querySelectorAll('[data-admin-rule-flip]').forEach(btn=>btn.addEventListener('click',e=>{ e.stopPropagation(); toggle(); }));
    box.querySelector('[data-admin-rule-confirm]')?.addEventListener('click',e=>{
      e.stopPropagation();
      resolveAdminRule(entry.selectedOption.id);
    });

    $('matchdayEventRestoreBtn')?.classList.add('hidden');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
  }

  function hideAdminRuleModal(){
    const modal=$('adminRuleModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    if($('matchdayEventRestoreBtn')?.dataset.modal==='adminRuleModal') $('matchdayEventRestoreBtn').classList.add('hidden');
  }

  function minimizeMatchdayEvent(modalId){
    const modal=$(modalId), restore=$('matchdayEventRestoreBtn');
    const season=ensureSeasonState();
    const pending=nextPendingMatchdayEvent(season?.currentMatchday,season);
    if(!modal?.classList.contains('show') || !restore || !pending ||
       (pending.type==='formation'?'formationChoiceModal':'adminRuleModal')!==modalId) return;
    modal.classList.remove('show'); modal.setAttribute('aria-hidden','true');
    restore.dataset.modal=modalId; restore.classList.remove('hidden'); restore.focus();
  }

  function restoreMatchdayEvent(){
    const restore=$('matchdayEventRestoreBtn'), modal=$(restore?.dataset.modal);
    const season=ensureSeasonState();
    const pending=nextPendingMatchdayEvent(season?.currentMatchday,season);
    if(!modal || !pending || (pending.type==='formation'?'formationChoiceModal':'adminRuleModal')!==modal.id){
      restore?.classList.add('hidden'); return;
    }
    restore.classList.add('hidden'); modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
    modal.querySelector('.matchday-event-minimize')?.focus();
  }

  function resolveAdminRule(optionId){
    const season=ensureSeasonState();
    if(!season) return;
    const day=season.currentMatchday;
    const entry=adminRuleDayState(day);
    if(!entry || !entry.triggered || entry.resolved || !entry.selectedOption) return;
    if(String(entry.selectedOption.id)!==String(optionId)) return;
    const option=entry.selectedOption;

    entry.resolved=true;
    entry.selectedId=option.id;
    entry.resolvedAt=Date.now();
    if(option.effect?.ruleId==='fantaclassifica'){
      season.fantaclassificaActive=true;
      season.fantaclassificaActivatedDay=Number(day||1);
      season.fantaclassificaActivatedAt=Date.now();
      leagueStandingsSort={key:'position',direction:'asc'};
    }
    hideAdminRuleModal();

    let forceLineup=false;
    if(adminRuleNeedsLineupReconfirm(option,season,day)){
      const lineup=season.lineups?.[String(day)]?.user;
      if(lineup) lineup.confirmed=false;
      forceLineup=true;
    }

    const nextPhase=syncFlowAfterPreMatchResolution(season,day,{forceLineup});
    saveState();

    if(forceLineup){
      showToast(`${option.title}: devi aggiornare e riconfermare la formazione.`);
      renderSeasonDashboard();
      return;
    }

    const pending=nextPendingMatchdayEvent(day,season);
    if(pending?.type==='formation'){
      renderFormationChoiceModal(pending.entry);
      return;
    }
    if(pending?.type==='admin_rule'){
      renderAdminRuleModal(pending.entry);
      return;
    }

    showToast(option.effect?.ruleId==='fantaclassifica'
      ? '🏆 Fantaclassifica attiva: fino a fine stagione la posizione dipende dai Fantapunti totali.'
      : `${option.title}: regolamento confermato per la giornata.`);
    renderSeasonDashboard();
  }

  function resolveFormationChoice(optionId){
    const season=ensureSeasonState();
    if(!season) return;
    const day=season.currentMatchday;
    const entry=sanitizeLockedFormationChoiceEntry(formationChoiceDayState(day),day);
    if(!entry || !entry.triggered || entry.resolved) return;
    const option=(entry.options||[]).find(x=>x.id===optionId);
    if(!option) return;

    entry.resolved=true;
    entry.selectedId=option.id;
    entry.selectedOption=option;
    entry.resolvedAt=Date.now();
    hideFormationChoiceModal();
    syncFlowAfterPreMatchResolution(season,day);
    saveState();
    const pending=nextPendingMatchdayEvent(day,season);
    if(pending?.type==='admin_rule'){
      renderAdminRuleModal(pending.entry);
      return;
    }
    showToast(`${formationChoiceCategoryLabel(option.category)}: ${option.title}. Puoi ancora modificare la formazione.`);
    renderSeasonDashboard();
  }

  function requestOpenLineup(){
    const season=ensureSeasonState();
    if(!season) return;
    // Le carte vengono controllate solo con CONTINUA. La formazione può essere
    // aperta e modificata liberamente fino all'avvio della Diretta Gol.
    openLineupScreen();
  }

  function openLineupScreen() {
    stopHubNewsCarousel();
    const season = ensureSeasonState();
    const manager = managerById('user');
    if (!season || !manager) return;
    let saved = season.lineups?.[lineupDayKey()]?.user;
    if(!saved && assistantCoachCarryEnabled(season)){
      seedAssistantCoachLineupForDay(season.currentMatchday,season);
      saved=season.lineups?.[lineupDayKey()]?.user;
      if(saved) saveState();
    }
    lineupDraft = normalizeSavedLineup(saved || {formation:'4-3-3',starters:{},bench:[]}, manager);
    ensureForcedFormationDraft();
    lineupSelectedPlayerId = null;
    lineupAssistantAdjustments = [];

    const ctx=pendingBigMatchContext();
    lineupReadOnly=!!ctx;
    lineupPartialContext=lineupReadOnly ? {
      ctx,
      user:pendingPartialFantasySnapshot('user'),
      opponent:(()=>{
        const fixture=currentUserFixture();
        const oppId=fixture?.homeId==='user'?fixture.awayId:fixture?.homeId;
        return oppId?pendingPartialFantasySnapshot(oppId):null;
      })()
    } : null;

    if(!lineupReadOnly && saved?.inheritedFromAssistant && shopItemActive('assistant_coach',season)){
      const changes=repairUnavailableStartersInDraft({silent:true,render:false,preserveConfirmed:true});
      if(changes.length){
        lineupDraft.confirmed=true;
        saveLineupDraft(false);
      }
    }

    showScreen('lineupScreen');
    renderLineupScreen();
  }

  function draftStarterIds() {
    return new Set(Object.values(lineupDraft?.starters || {}).map(String));
  }

  function draftSlotForPlayer(playerId) {
    if (!lineupDraft) return null;
    return Object.keys(lineupDraft.starters).find(slotId=>String(lineupDraft.starters[slotId])===String(playerId)) || null;
  }

  function draftPlayerById(playerId) {
    return managerById('user')?.roster?.find(p=>String(p.id)===String(playerId)) || null;
  }

  function setDraftFormation(key) {
    if (lineupReadOnly) return;
    const forced=forcedFormationRuleForDay();
    if(forced && key!==forced){
      showToast(`Regolamento Admin: per questa giornata puoi usare solo il modulo ${forced}.`, true);
      return;
    }
    if (!allowedLineupFormation(key) || !lineupDraft) return;
    if (lineupDraft.formation===key) return;
    const currentPlayers = Object.values(lineupDraft.starters).map(draftPlayerById).filter(Boolean);
    const next = {};
    ['P','D','C','A'].forEach(role => {
      const ids = currentPlayers.filter(p=>p.role===role).map(p=>String(p.id));
      const slots = lineupSlots(key).filter(s=>s.role===role);
      ids.slice(0,slots.length).forEach((id,idx)=>{ next[slots[idx].instanceId]=id; });
    });
    lineupDraft.formation = key;
    lineupDraft.starters = next;
    if(lineupDraft.captainId && !Object.values(next).map(String).includes(String(lineupDraft.captainId))) lineupDraft.captainId=null;
    syncDraftBenchOrder();
    lineupDraft.confirmed = false;
    lineupSelectedPlayerId = null;
    renderLineupScreen();
  }

  function selectLineupPlayer(playerId) {
    if (lineupReadOnly) return;
    if (!draftPlayerById(playerId)) return;
    lineupSelectedPlayerId = String(playerId);
    renderLineupScreen();
  }

  function nominateLineupCaptain(){
    if(lineupReadOnly || !lineupDraft || !lineupSelectedPlayerId || !draftSlotForPlayer(lineupSelectedPlayerId)) return;
    lineupDraft.captainId=String(lineupSelectedPlayerId);
    lineupDraft.confirmed=false;
    renderLineupScreen();
  }

  function placePlayerInSlot(playerId, slotId, {render=true}={}) {
    if (lineupReadOnly || !lineupDraft || !playerId || !slotId) return false;
    const slot = lineupSlots(lineupDraft.formation).find(s=>s.instanceId===slotId);
    const player = draftPlayerById(playerId);
    if (!slot || !player) return false;
    if (!canPlacePlayerInLineupSlot(player,slot,lineupDraft)) {
      const blockedId=adminBlockedStarterForManager('user');
      const wildcardLimit=adminWildcardStartingSlotLimit();
      const message=blockedId && String(player.id)===String(blockedId)
        ? `${player.name}: il Top Player deve partire dalla panchina per questa giornata.`
        : wildcardLimit>0
          ? `${player.name}: puoi usare al massimo ${wildcardLimit} ${state?.season?.sponsor?.id==='fantacana'?'titolari fuori ruolo tra D, C e A':'Jolly fuori ruolo e soltanto tra D↔C o C↔A'}.`
          : `${player.name} può essere inserito solo in uno slot ${ROLE_LABELS[player.role]||player.role}.`;
      showToast(message, true);
      return false;
    }

    syncDraftBenchOrder();
    const selectedId=String(player.id);
    const selectedBenchIndex=lineupDraft.bench.indexOf(selectedId);
    const oldSlot = draftSlotForPlayer(selectedId);
    const displaced = lineupDraft.starters[slotId] ? String(lineupDraft.starters[slotId]) : null;

    // Trascinando/cliccando sullo stesso slot non serve modificare nulla.
    if (oldSlot===slotId) {
      lineupSelectedPlayerId=null;
      if(render) renderLineupScreen();
      return true;
    }

    if (oldSlot) delete lineupDraft.starters[oldSlot];
    lineupDraft.starters[slotId] = selectedId;

    // Se il giocatore arriva da un altro slot dello stesso ruolo, scambia i due titolari.
    if (displaced && displaced!==selectedId && oldSlot) {
      const displacedPlayer = draftPlayerById(displaced);
      const old = lineupSlots(lineupDraft.formation).find(s=>s.instanceId===oldSlot);
      if (displacedPlayer && old && displacedPlayer.role===old.role) lineupDraft.starters[oldSlot]=displaced;
      else lineupDraft.bench.push(displaced);
    // Se arriva dalla panchina, il giocatore sostituito prende il suo posto nella panchina.
    } else if(displaced && displaced!==selectedId) {
      if(selectedBenchIndex>=0) lineupDraft.bench[selectedBenchIndex]=displaced;
      else lineupDraft.bench.push(displaced);
    }

    syncDraftBenchOrder();
    if(lineupDraft.captainId && !draftSlotForPlayer(lineupDraft.captainId)) lineupDraft.captainId=null;
    lineupDraft.confirmed = false;
    lineupSelectedPlayerId = null;
    if(render) renderLineupScreen();
    return true;
  }

  function openLineupSlotPicker(slotId) {
    if(lineupReadOnly || !lineupDraft) return;
    const slot=lineupSlots(lineupDraft.formation).find(item=>item.instanceId===slotId);
    if(!slot) return;
    document.getElementById('lineupSlotPicker')?.remove();
    const day=ensureSeasonState().currentMatchday;
    const insight=shopItemActive('scout_plus',ensureSeasonState())||starterReportActive(day);
    const current=String(lineupDraft.starters[slotId]||'');
    const players=(managerById('user')?.roster||[]).filter(player=>canPlacePlayerInLineupSlot(player,slot,lineupDraft,day)).sort((a,b)=>Number(b.ovr||0)-Number(a.ovr||0));
    const origin=document.activeElement;
    const dialog=document.createElement('dialog');dialog.id='lineupSlotPicker';dialog.className='lineup-slot-picker';dialog.setAttribute('aria-labelledby','lineupSlotPickerTitle');
    dialog.innerHTML=`<header><h3 id="lineupSlotPickerTitle">Scegli ${escapeHtml(ROLE_LABELS[slot.role]||slot.role)} · ${escapeHtml(slot.key)}</h3><button type="button" data-picker-close aria-label="Chiudi">×</button></header><div class="lineup-slot-picker-list">${players.map(player=>{
      const status=playerStatusForDay(player.id,day),placed=draftSlotForPlayer(player.id);
      return `<button type="button" class="${placed?'is-already-starter':''}" data-picker-player="${escapeHtml(player.id)}" ${status.unavailable?'disabled':''}>${lineupPlayerFaceMarkup(player,'roster')}<strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(clubShort(player.club))} · ${escapeHtml(player.role)} · OVR ${escapeHtml(playerOvrLabel(player))}</small>${insight?scoutStarterBadge(player,day):''}<em>${escapeHtml(status.unavailable?status.label:String(player.id)===current?'In questa posizione':placed?'Già titolare: verrà spostato':'Disponibile')}</em></button>`;
    }).join('')||'<p>Nessun giocatore schierabile in questa posizione.</p>'}</div><footer>${current?'<button type="button" data-picker-empty>Svuota posizione</button>':''}<button type="button" data-picker-close>Annulla</button></footer>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('close',()=>{dialog.remove();if(origin?.isConnected)origin.focus();else document.querySelector('#lineupPitchSlots [data-lineup-slot="'+slotId+'"]')?.focus();});
    dialog.querySelectorAll('[data-picker-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
    dialog.querySelectorAll('[data-picker-player]').forEach(button=>button.addEventListener('click',()=>{
      const player=draftPlayerById(button.dataset.pickerPlayer);
      if(playerStatusForDay(player.id,day).unavailable)return;
      if(placePlayerInSlot(player.id,slotId))dialog.close();
    }));
    dialog.querySelector('[data-picker-empty]')?.addEventListener('click',()=>{
      delete lineupDraft.starters[slotId];if(String(lineupDraft.captainId||'')===current)lineupDraft.captainId=null;
      lineupDraft.confirmed=false;lineupSelectedPlayerId=null;syncDraftBenchOrder();renderLineupScreen();dialog.close();
    });
    dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
    dialog.showModal();
  }

  function placeSelectedInSlot(slotId) {
    if (!lineupSelectedPlayerId) return;
    placePlayerInSlot(lineupSelectedPlayerId, slotId);
  }

  function benchSelectedPlayer() {
    if (lineupReadOnly) return;
    if (!lineupSelectedPlayerId || !lineupDraft) return;
    const slotId = draftSlotForPlayer(lineupSelectedPlayerId);
    if (slotId) delete lineupDraft.starters[slotId];
    if(String(lineupDraft.captainId)===String(lineupSelectedPlayerId)) lineupDraft.captainId=null;
    syncDraftBenchOrder();
    lineupDraft.confirmed = false;
    lineupSelectedPlayerId = null;
    renderLineupScreen();
  }

  function clearLineupDragVisuals(){
    document.querySelectorAll('#lineupScreen .is-dragging,#lineupScreen .drag-valid,#lineupScreen .drag-invalid,#lineupScreen .bench-drop-active').forEach(el=>{
      el.classList.remove('is-dragging','drag-valid','drag-invalid','bench-drop-active');
    });
  }

  function beginLineupDrag(playerId, sourceEl, ev){
    if(lineupReadOnly || !draftPlayerById(playerId)) return;
    lineupDragPlayerId=String(playerId);
    lineupSelectedPlayerId=String(playerId);
    clearLineupDragVisuals();
    sourceEl?.classList.add('is-dragging');
    const player=draftPlayerById(playerId);
    document.querySelectorAll('#lineupPitchSlots [data-lineup-slot]').forEach(el=>{
      const slot=lineupSlots(lineupDraft.formation).find(s=>s.instanceId===el.dataset.lineupSlot);
      el.classList.add(slot&&player&&canPlacePlayerInLineupSlot(player,slot,lineupDraft)?'drag-valid':'drag-invalid');
    });
    if(ev?.dataTransfer){
      ev.dataTransfer.effectAllowed='move';
      try{ ev.dataTransfer.setData('text/plain',String(playerId)); }catch(_e){}
    }
  }

  function endLineupDrag(){
    lineupDragPlayerId=null;
    clearLineupDragVisuals();
  }

  function bindLineupDragDrop(){
    if(lineupReadOnly || !lineupDraft) return;
    const draggableEls=document.querySelectorAll('#lineupRosterList [data-lineup-player], #lineupBenchList [data-bench-player], #lineupPitchSlots [data-lineup-slot].filled');
    draggableEls.forEach(el=>{
      el.setAttribute('draggable','true');
      el.addEventListener('dragstart',ev=>{
        const playerId=el.dataset.lineupPlayer || el.dataset.benchPlayer || lineupDraft.starters[el.dataset.lineupSlot];
        if(!playerId){ ev.preventDefault(); return; }
        beginLineupDrag(playerId,el,ev);
      });
      el.addEventListener('dragend',endLineupDrag);
    });

    document.querySelectorAll('#lineupPitchSlots [data-lineup-slot]').forEach(slotEl=>{
      slotEl.addEventListener('dragover',ev=>{
        if(!lineupDragPlayerId) return;
        const slot=lineupSlots(lineupDraft.formation).find(s=>s.instanceId===slotEl.dataset.lineupSlot);
        const player=draftPlayerById(lineupDragPlayerId);
        if(slot && player && canPlacePlayerInLineupSlot(player,slot,lineupDraft)){
          ev.preventDefault();
          if(ev.dataTransfer) ev.dataTransfer.dropEffect='move';
        }
      });
      slotEl.addEventListener('dragenter',()=>{
        if(!lineupDragPlayerId) return;
        const slot=lineupSlots(lineupDraft.formation).find(s=>s.instanceId===slotEl.dataset.lineupSlot);
        const player=draftPlayerById(lineupDragPlayerId);
        if(slot && player && canPlacePlayerInLineupSlot(player,slot,lineupDraft)) slotEl.classList.add('drag-hover');
      });
      slotEl.addEventListener('dragleave',()=>slotEl.classList.remove('drag-hover'));
      slotEl.addEventListener('drop',ev=>{
        ev.preventDefault();
        slotEl.classList.remove('drag-hover');
        const playerId=lineupDragPlayerId || (()=>{try{return ev.dataTransfer?.getData('text/plain')}catch(_e){return null}})();
        if(playerId) placePlayerInSlot(playerId,slotEl.dataset.lineupSlot);
        endLineupDrag();
      });
    });

    // Un titolare può essere trascinato direttamente nella panchina.
    const benchDrop=$('lineupBenchList');
    if(benchDrop){
      benchDrop.addEventListener('dragover',ev=>{
        if(!lineupDragPlayerId || !draftSlotForPlayer(lineupDragPlayerId)) return;
        ev.preventDefault();
        benchDrop.classList.add('bench-drop-active');
      });
      benchDrop.addEventListener('dragleave',ev=>{
        if(!benchDrop.contains(ev.relatedTarget)) benchDrop.classList.remove('bench-drop-active');
      });
      benchDrop.addEventListener('drop',ev=>{
        ev.preventDefault();
        const playerId=lineupDragPlayerId;
        benchDrop.classList.remove('bench-drop-active');
        if(playerId && draftSlotForPlayer(playerId)){
          lineupSelectedPlayerId=String(playerId);
          benchSelectedPlayer();
        }
        endLineupDrag();
      });
    }
  }

  function clearDraftLineup() {
    if (lineupReadOnly) return;
    if (!lineupDraft) return;
    lineupDraft.starters = {};
    lineupDraft.captainId=null;
    lineupDraft.bench=[];
    syncDraftBenchOrder();
    lineupDraft.confirmed = false;
    lineupSelectedPlayerId = null;
    renderLineupScreen();
  }

  function bestPlayersForRole(manager, role, count) {
    const day=state?.season?.currentMatchday||1;
    const blockedId=adminBlockedStarterForManager(manager?.id,day);
    const candidates=(manager.roster||[]).filter(p=>p.role===role && (!blockedId || String(p.id)!==String(blockedId))).slice().sort((a,b)=>{
      const aUnavailable=playerStatusForDay(a.id,day).unavailable?1:0;
      const bUnavailable=playerStatusForDay(b.id,day).unavailable?1:0;
      const av=manager?.id==='user'?lineupPlayerValue(a):cpuLeagueRuleLineupValue(manager,a,day);
      const bv=manager?.id==='user'?lineupPlayerValue(b):cpuLeagueRuleLineupValue(manager,b,day);
      return aUnavailable-bUnavailable || bv-av || String(a.name).localeCompare(String(b.name),'it');
    });
    return candidates.slice(0,count);
  }

  function buildAutoLineup(manager, formationKey) {
    if(!allowedLineupFormation(formationKey)) formationKey='4-3-3';
    const starters = {};
    const counts = lineupCountsForFormation(formationKey);
    ['P','D','C','A'].forEach(role => {
      const players = bestPlayersForRole(manager,role,counts[role]);
      const slots = lineupSlots(formationKey).filter(s=>s.role===role);
      players.forEach((p,idx)=>{ if(slots[idx]) starters[slots[idx].instanceId]=String(p.id); });
    });
    const used = new Set(Object.values(starters).map(String));
    const day=state?.season?.currentMatchday||1;
    const bench = (manager.roster||[]).filter(p=>!used.has(String(p.id))).slice().sort((a,b)=>{
      const ro={P:0,D:1,C:2,A:3};
      const av=manager?.id==='user'?lineupPlayerValue(a):cpuLeagueRuleLineupValue(manager,a,day);
      const bv=manager?.id==='user'?lineupPlayerValue(b):cpuLeagueRuleLineupValue(manager,b,day);
      return ro[a.role]-ro[b.role] || (manager?.id==='user'?0:Number(playerStatusForDay(a.id,day).unavailable)-Number(playerStatusForDay(b.id,day).unavailable)) || bv-av;
    }).map(p=>String(p.id));
    const captainId=manager?.id!=='user' && leagueRulesFor(state).captainBonus!=='off'
      ? String((manager.roster||[]).filter(p=>used.has(String(p.id))).sort((a,b)=>cpuLeagueRuleLineupValue(manager,b,day)-cpuLeagueRuleLineupValue(manager,a,day))[0]?.id||'')
      : null;
    const lineup={formation:formationKey,starters,bench,captainId,confirmed:true,updatedAt:Date.now()};
    const blockedId=adminBlockedStarterForManager(manager?.id,day);
    if(blockedId) enforcePlayerBenchedInLineup(manager,lineup,blockedId,day);
    if(manager?.id==='user') enforceFaithReserveStarterInLineup(manager,lineup,day);
    return lineup;
  }

  function formationCpuBias(manager, key, day=state?.season?.currentMatchday||1) {
    const counts = lineupCountsForFormation(key);
    const type = manager.profile?.archetype || '';
    let bonus = 0;
    if (['bomber','collezionista','spendaccione'].includes(type)) bonus += counts.A===3 ? 180 : 0;
    if (['ragioniere','tirchio','esperto'].includes(type)) bonus += counts.D>=4 ? 90 : 0;
    if (type==='moneyball') bonus += counts.C>=4 ? 110 : 0;
    if (type==='pazzo') bonus += (Math.random()-.5)*220;
    bonus += cpuLeagueFormationBias(manager,key,day);
    return bonus;
  }

  function chooseCpuFormation(manager) {
    return window.FantaCpuLineupPolicy.chooseFormation(manager,{state,availableLineupFormations,lineupCountsForFormation,bestPlayersForRole,cpuLeagueRuleLineupValue,formationCpuBias});
  }

  function tacticalExpectedPlayerPoints(player,day){
    if(!player || playerStatusForDay(player.id,day).unavailable) return {points:0,vote:0};
    const caps=assistantAutoLineupCapabilities();
    const quality=clamp((currentPlayerOvr(player)-60)/35,0,1);
    const priors={P:[0,0,.10],D:[.035,.045,.11],C:[.13,.14,.10],A:[.32,.12,.08]};
    const rates=priors[player.role]||priors.C;
    let vote=5.7+quality*.8,goals=rates[0]*(.65+quality*.7),assists=rates[1]*(.65+quality*.7),malus=rates[2];
    if(caps.fantadata){
      const stat=playerSeasonStat(player.id),n=Number(stat?.voteCount||0);
      if(n){const weight=n/(n+8);vote=vote*(1-weight)+Number(stat.voteSum||0)/n*weight;goals=goals*(1-weight)+Number(stat.goals||0)/n*weight;assists=assists*(1-weight)+Number(stat.assists||0)/n*weight;malus=malus*(1-weight)+(Number(stat.yellow||0)*.5+Number(stat.red||0)+Number(stat.ownGoal||0)*2+Number(stat.missedPenalty||0)*3)/n*weight;}
      const matchup=serieAMatchupDifficulty(player,day);const factor=matchup?.key==='favorable'?1.15:matchup?.key==='hard'?.85:1;goals*=factor;assists*=factor;
    }
    const effect=activeFormationChoice(day)?.effect;
    if(String(effect?.targetPlayerId||'')===String(player.id)){
      if(['player_vote','locker_vote','world_player'].includes(effect.kind))vote+=Number(effect.delta||effect.voteDelta||0);
      if(effect.kind==='goal_weight'||effect.goalMultiplier)goals*=Number(effect.multiplier||effect.goalMultiplier||1);
      if(effect.kind==='assist_weight'||effect.assistMultiplier)assists*=Number(effect.multiplier||effect.assistMultiplier||1);
    }
    const probability=caps.scout?clamp(estimatedStarterProbability(player,day)/100,.05,1):.9;
    const multiplier=Number(activeAdminRuleEffect(day)?.positiveBonusMultiplier||1);
    return {vote,points:probability*(vote+(goals*3+assists)*multiplier-malus)};
  }

  function tacticalExpectedLineupPoints(manager,lineup,day){
    const players=Object.values(lineup.starters).map(id=>manager.roster.find(p=>String(p.id)===String(id))).filter(Boolean);
    let score=players.reduce((sum,p)=>sum+tacticalExpectedPlayerPoints(p,day).points,0);
    const rules=fantasyRuleForDay(day);
    const defenders=players.filter(p=>p.role==='D');
    const keeper=players.find(p=>p.role==='P');
    if(rules.defenseModifier==='classic'&&defenders.length>=4&&keeper){
      const votes=defenders.map(p=>tacticalExpectedPlayerPoints(p,day).vote).sort((a,b)=>b-a).slice(0,3);
      const avg=(votes.reduce((a,b)=>a+b,0)+tacticalExpectedPlayerPoints(keeper,day).vote)/4;
      score+=(avg>=7?6:avg>=6.5?3:avg>=6?1:0)*Number(activeAdminRuleEffect(day)?.positiveBonusMultiplier||1);
    }
    return score;
  }

  function adaptTacticalProLineup(manager,lineup,day){
    const effect=activeAdminRuleEffect(day);
    const forced=effect?.userPlayerId;
    if(effect?.ruleId==='forced_starter_pair') enforceStarterInLineup(manager,lineup,forced);
    const previous=new Set(Object.values(ensureSeasonState()?.lineups?.[String(day-1)]?.user?.starters||{}).map(String));
    const required=effect?.ruleId==='forced_turnover_5'?5:effect?.ruleId==='forced_turnover_3'?3:0;
    const blocked=String(adminBlockedStarterForManager('user',day)||'');
    const slots=lineupSlots(lineup.formation);
    const changes=[];
    for(let round=0;round<required && !lineupTurnoverDeltaFromPrevious(lineup,day,required).ok;round++){
      const used=new Set(Object.values(lineup.starters).map(String));
      const options=[];
      for(const slot of slots){
        const old=manager.roster.find(p=>String(p.id)===String(lineup.starters[slot.instanceId]));
        if(!old || !previous.has(String(old.id)) || String(old.id)===String(forced||''))continue;
        for(const p of manager.roster)if(p.role===slot.role&&!used.has(String(p.id))&&!previous.has(String(p.id))&&String(p.id)!==blocked&&!playerStatusForDay(p.id,day).unavailable)options.push({slot,p,old,gain:advancedAutoLineupValue(p)-advancedAutoLineupValue(old)});
      }
      options.sort((a,b)=>b.gain-a.gain);const pick=options[0];if(!pick)break;
      lineup.starters[pick.slot.instanceId]=String(pick.p.id);changes.push(`Turnover: ${pick.p.name} per ${pick.old.name}`);
    }
    if(adminWildcardStartingSlotLimit(day)>0){
      const used=new Set(Object.values(lineup.starters).map(String));const options=[];
      for(const slot of slots){
        const old=manager.roster.find(p=>String(p.id)===String(lineup.starters[slot.instanceId]));
        if(!old || slot.role==='P'||String(old.id)===String(forced||''))continue;
        for(const p of manager.roster){
          if(p.role===slot.role||used.has(String(p.id))||String(p.id)===blocked||playerStatusForDay(p.id,day).unavailable||!wildcardSlotCompatible(p.role,slot.role))continue;
          const trial={...lineup,starters:{...lineup.starters,[slot.instanceId]:String(p.id)}};
          if(lineupOutOfRoleEntries(trial,manager).length>adminWildcardStartingSlotLimit(day)||!lineupTurnoverDeltaFromPrevious(trial,day,required).ok)continue;
          const gain=tacticalExpectedLineupPoints(manager,trial,day)-tacticalExpectedLineupPoints(manager,lineup,day);if(gain>0)options.push({slot,p,old,gain});
        }
      }
      options.sort((a,b)=>b.gain-a.gain);const pick=options[0];if(pick){lineup.starters[pick.slot.instanceId]=String(pick.p.id);changes.push(`Fuori ruolo: ${pick.p.name} per ${pick.old.name}`);}
    }
    const used=new Set(Object.values(lineup.starters).map(String));
    lineup.bench=manager.roster.filter(p=>!used.has(String(p.id))).sort((a,b)=>advancedAutoLineupValue(b)-advancedAutoLineupValue(a)).map(p=>String(p.id));
    enforceAdminLastReserve(lineup,'user',day);
    if(lineup.captainId&&!used.has(String(lineup.captainId)))lineup.captainId=null;
    lineup.tacticalProNotes=changes;
    lineup.confirmed=validateAdminRuleLineup(lineup,day).ok && Object.keys(lineup.starters).length===lineupRequiredStarters(lineup.formation);
    return lineup;
  }

  function autoFillUserLineup() {
    if (lineupReadOnly) return;
    if (!lineupDraft) return;
    if(!shopItemActive('assistant_coach')){
      showToast("AUTO XI è una funzione dell'Assistente Tecnico.",true);
      return;
    }
    const manager=managerById('user');
    const formation=bestAdvancedFormation(manager);
    const auto=buildAdvancedAutoLineup(manager,formation);
    lineupDraft.formation=formation;
    lineupDraft.starters=auto.starters;
    lineupDraft.bench=auto.bench.slice();
    if(lineupDraft.captainId && !Object.values(auto.starters).map(String).includes(String(lineupDraft.captainId))) lineupDraft.captainId=null;
    lineupDraft.confirmed=false;
    lineupSelectedPlayerId=null;
    renderLineupScreen();
    const caps=assistantAutoLineupCapabilities();
    const extras=[caps.scout?'Scout Plus':null,caps.fantadata?'FantaData Pro':null].filter(Boolean);
    if(shopItemActive('assistant_tactical_pro') && auto.tacticalProNotes?.length){showToast(auto.tacticalProNotes.join(' · '));return;}
    showToast(`Assistente Tecnico: modulo ${formation} e XI ottimizzati${extras.length?` usando anche ${extras.join(' + ')}`:' su OVR e disponibilità'}.`);
  }

  function ensureAssistantCoachLineup(season=ensureSeasonState()){
    if(!season) return null;
    if(!season.assistantCoachLineup || typeof season.assistantCoachLineup!=='object') season.assistantCoachLineup={enabled:false,formation:null,starters:{},bench:[],updatedAt:0,lastSourceDay:0};
    const t=season.assistantCoachLineup;
    if(typeof t.enabled!=='boolean') t.enabled=false;
    if(!t.starters || typeof t.starters!=='object') t.starters={};
    if(!Array.isArray(t.bench)) t.bench=[];
    return t;
  }

  function assistantCoachCarryEnabled(season=ensureSeasonState()){
    return !!(shopItemActive('assistant_coach',season) && ensureAssistantCoachLineup(season)?.enabled);
  }

  function saveAssistantCoachTemplateFromDraft(){
    const season=ensureSeasonState(), manager=managerById('user');
    if(!season || !manager || !lineupDraft || !shopItemActive('assistant_coach',season)) return false;
    if(lineupDraft.formation==='5-5-5'){
      showToast('Il modulo a farfalla vale solo oggi: la formazione persistente rimane quella delle giornate normali.',true);
      return false;
    }
    if(Object.keys(lineupDraft.starters||{}).length!==11){
      showToast('Completa gli 11 titolari prima di salvare la formazione per le prossime giornate.',true);
      return false;
    }
    if(lineupOutOfRoleEntries(lineupDraft,manager).length){
      showToast("La Wildcard dell'Admin vale solo per questa giornata: la formazione con un fuori ruolo non può essere salvata come formazione persistente.",true);
      return false;
    }
    const normalized=normalizeSavedLineup({formation:lineupDraft.formation,starters:lineupDraft.starters,bench:lineupDraft.bench,captainId:lineupDraft.captainId,confirmed:false},manager);
    const template=ensureAssistantCoachLineup(season);
    template.enabled=true;
    template.formation=normalized.formation;
    template.starters={...normalized.starters};
    template.bench=normalized.bench.slice();
    template.captainId=normalized.captainId;
    template.updatedAt=Date.now();
    template.lastSourceDay=Number(season.currentMatchday||1);
    saveState();
    renderLineupScreen();
    showToast('Formazione completa salvata: titolari, capitano e panchina verranno riproposti nelle prossime giornate.');
    return true;
  }

  function toggleAssistantCoachCarry(){
    const season=ensureSeasonState();
    if(!season || !shopItemActive('assistant_coach',season)) return;
    const template=ensureAssistantCoachLineup(season);
    if(template.enabled){
      template.enabled=false;
      saveState();
      renderLineupScreen();
      showToast('Formazione persistente disattivata.');
      return;
    }
    saveAssistantCoachTemplateFromDraft();
  }

  function assistantCoachTemplateForDay(day,season=ensureSeasonState()){
    const manager=managerById('user');
    const template=ensureAssistantCoachLineup(season);
    if(!season || !manager || !shopItemActive('assistant_coach',season) || !template?.enabled) return null;
    const normalized=normalizeSavedLineup({formation:template.formation,starters:template.starters,bench:template.bench,captainId:template.captainId,confirmed:false},manager);
    if(Object.keys(normalized.starters||{}).length!==11) return null;
    return {formation:normalized.formation,starters:{...normalized.starters},bench:normalized.bench.slice(),captainId:normalized.captainId,confirmed:true,inheritedFromAssistant:true,autoConfirmedByAssistant:true,sourceDay:Number(template.lastSourceDay||0),updatedAt:Date.now()};
  }

  function repairAssistantInheritedLineup(lineup,day,season=ensureSeasonState()){
    const manager=managerById('user');
    if(!lineup || !manager || !season || !shopItemActive('assistant_coach',season)) return {lineup,changes:[]};
    if(shopItemActive('assistant_tactical_pro',season)){
      const auto=buildAdvancedAutoLineup(manager,bestAdvancedFormation(manager));
      auto.inheritedFromAssistant=true;auto.autoConfirmedByAssistant=auto.confirmed;
      return {lineup:auto,changes:auto.tacticalProNotes||[]};
    }
    const normalized=normalizeSavedLineup(lineup,manager);
    const starters={...normalized.starters};
    const bench=normalized.bench.slice();
    const changes=[];

    Object.entries(starters).forEach(([slotId,playerId])=>{
      const outPlayer=(manager.roster||[]).find(p=>String(p.id)===String(playerId));
      if(!outPlayer || !playerStatusForDay(outPlayer.id,day).unavailable) return;
      const candidateIds=bench.filter(id=>{
        const p=(manager.roster||[]).find(x=>String(x.id)===String(id));
        return p && p.role===outPlayer.role && !playerStatusForDay(p.id,day).unavailable;
      });
      const incomingId=candidateIds.sort((a,b)=>{
        const pa=(manager.roster||[]).find(x=>String(x.id)===String(a));
        const pb=(manager.roster||[]).find(x=>String(x.id)===String(b));
        return advancedAutoLineupValue(pb)-advancedAutoLineupValue(pa);
      })[0];
      if(!incomingId) return;
      const incoming=(manager.roster||[]).find(p=>String(p.id)===String(incomingId));
      const benchIndex=bench.indexOf(String(incomingId));
      starters[slotId]=String(incomingId);
      if(benchIndex>=0) bench[benchIndex]=String(outPlayer.id);
      changes.push({outId:String(outPlayer.id),outName:outPlayer.name,inId:String(incoming.id),inName:incoming.name,role:outPlayer.role});
    });

    const repaired=normalizeSavedLineup({formation:normalized.formation,starters,bench,captainId:normalized.captainId,confirmed:true},manager);
    repaired.confirmed=Object.keys(repaired.starters||{}).length===11;
    repaired.inheritedFromAssistant=true;
    repaired.autoConfirmedByAssistant=repaired.confirmed;
    repaired.assistantAdjustments=changes;
    repaired.updatedAt=Date.now();
    return {lineup:repaired,changes};
  }

  function seedAssistantCoachLineupForDay(day,season=ensureSeasonState()){
    if(!season || !day || season.completed) return false;
    if(!season.lineups || typeof season.lineups!=='object') season.lineups={};
    const key=String(day);
    if(!season.lineups[key] || typeof season.lineups[key]!=='object') season.lineups[key]={};
    if(season.lineups[key].user) return false;
    const inherited=assistantCoachTemplateForDay(day,season);
    if(!inherited) return false;
    const prepared=repairAssistantInheritedLineup(inherited,Number(day),season);
    season.lineups[key].user=prepared.lineup;
    return true;
  }

  function unavailableDraftStarters(){
    const day=ensureSeasonState()?.currentMatchday||1;
    if(!lineupDraft) return [];
    return Object.entries(lineupDraft.starters||{}).map(([slotId,id])=>({slotId,player:draftPlayerById(id)})).filter(x=>x.player && playerStatusForDay(x.player.id,day).unavailable);
  }

  function repairUnavailableStartersInDraft({silent=false,render=true,preserveConfirmed=false}={}){
    const season=ensureSeasonState(), manager=managerById('user');
    if(!season || !manager || !lineupDraft || !shopItemActive('assistant_coach',season)) return [];
    syncDraftBenchOrder();
    const day=Number(season.currentMatchday||1);
    const changes=[];
    const outs=unavailableDraftStarters();
    outs.forEach(({slotId,player:outPlayer})=>{
      const candidates=draftBenchPlayers().filter(p=>p.role===outPlayer.role && !playerStatusForDay(p.id,day).unavailable).sort((a,b)=>advancedAutoLineupValue(b)-advancedAutoLineupValue(a));
      const incoming=candidates[0];
      if(!incoming) return;
      const inId=String(incoming.id), outId=String(outPlayer.id);
      const benchIndex=lineupDraft.bench.indexOf(inId);
      lineupDraft.starters[slotId]=inId;
      if(benchIndex>=0) lineupDraft.bench[benchIndex]=outId;
      else lineupDraft.bench.push(outId);
      changes.push({outId,outName:outPlayer.name,inId,inName:incoming.name,role:outPlayer.role});
      syncDraftBenchOrder();
    });
    if(changes.length){
      if(!preserveConfirmed) lineupDraft.confirmed=false;
      lineupAssistantAdjustments=changes;
      if(!silent) showToast(`Assistente Tecnico: ${changes.length} indisponibil${changes.length===1?'e sostituito':'i sostituiti'}.`);
    } else if(!silent && outs.length){
      showToast('Assistente Tecnico: nessun sostituto disponibile nello stesso ruolo.',true);
    }
    if(render) renderLineupScreen();
    return changes;
  }

  function saveLineupDraft(confirm=false) {
    if (lineupReadOnly) return false;
    if (!lineupDraft) return false;
    if (!allowedLineupFormation(lineupDraft.formation)) return false;
    const manager=managerById('user');
    const store=ensureLineupDayStore();
    if (!manager || !store) return false;
    const startersCount=Object.keys(lineupDraft.starters).length;
    if (confirm && startersCount!==lineupRequiredStarters(lineupDraft.formation)) return false;
    syncDraftBenchOrder();
    const bench=lineupDraft.bench.slice();
    store.user={formation:lineupDraft.formation,starters:{...lineupDraft.starters},bench,captainId:Object.values(lineupDraft.starters).map(String).includes(String(lineupDraft.captainId))?String(lineupDraft.captainId):null,confirmed:confirm || !!lineupDraft.confirmed,updatedAt:Date.now()};
    if (confirm && lineupDraft.formation!=='5-5-5' && assistantCoachCarryEnabled() && lineupOutOfRoleEntries(lineupDraft,manager).length===0) {
      const template=ensureAssistantCoachLineup();
      template.formation=lineupDraft.formation;
      template.starters={...lineupDraft.starters};
      template.bench=bench.slice();
      template.captainId=store.user.captainId;
      template.updatedAt=Date.now();
      template.lastSourceDay=Number(ensureSeasonState()?.currentMatchday||1);
    }
    if (confirm) {
      const day=Number(ensureSeasonState()?.currentMatchday||1);
      const forced=forcedFormationRuleForDay(day);
      const opponentId=userOpponentIdForDay(day);
      state.managers.filter(m=>m.id!=='user').forEach(m=>{
        const mustMirrorForced=!!forced && (forced==='5-5-5' || String(m.id)===String(opponentId)) && String(store[m.id]?.formation||'')!==forced;
        const forcedStarterId=adminForcedStarterForManager(m.id,day);
        const blockedStarterId=adminBlockedStarterForManager(m.id,day);
        const starterIds=Object.values(store[m.id]?.starters||{}).map(String);
        const hasForcedStarter=!forcedStarterId || starterIds.includes(String(forcedStarterId));
        const hasBlockedStarter=!!blockedStarterId && starterIds.includes(String(blockedStarterId));
        if (!store[m.id]?.confirmed || !allowedLineupFormation(store[m.id]?.formation) || mustMirrorForced || !hasForcedStarter || hasBlockedStarter){
          store[m.id]=buildAutoLineup(m,cpuFormationForDay(m,day));
          if(forcedStarterId) enforceStarterInLineup(m,store[m.id],forcedStarterId);
          if(blockedStarterId) enforcePlayerBenchedInLineup(m,store[m.id],blockedStarterId,day);
        }
      });
      lineupDraft.confirmed=true;
    }
    return saveState();
  }

  function confirmUserLineup() {
    if (lineupReadOnly) return renderSeasonDashboard();
    const adminValidation=validateAdminRuleLineup(lineupDraft, ensureSeasonState()?.currentMatchday||1);
    if(!adminValidation.ok){
      if ($('lineupValidationText')) $('lineupValidationText').textContent=adminValidation.message;
      showToast(adminValidation.message, true);
      return;
    }
    if (!saveLineupDraft(true)) {
      if ($('lineupValidationText')) $('lineupValidationText').textContent=Object.keys(lineupDraft?.starters||{}).length===lineupRequiredStarters(lineupDraft?.formation)?'Salvataggio non riuscito: riprova.':`Servono tutti i ${lineupRequiredStarters(lineupDraft?.formation)} titolari.`;
      return;
    }
    renderSeasonDashboard();
  }

  function closeConsumableModal(){
    const modal=$('consumableModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    $('consumableTargetPanel')?.classList.add('hidden');
    $('consumableInventoryGrid')?.classList.remove('hidden');
  }

  function lineupConsumableActionState(id,day=ensureSeasonState()?.currentMatchday){
    const season=ensureSeasonState(),effect=consumableDayEffect(day,season);
    if(!season) return {usable:false,label:'NON DISPONIBILE'};
    if(lineupReadOnly) return {usable:false,label:'FORMAZIONE BLOCCATA'};
    if(id==='cons_starter_report'){
      if(shopItemActive('scout_plus',season)) return {usable:false,label:'SCOUT PLUS ATTIVO'};
      if(effect.starterReport) return {usable:false,label:'GIÀ USATO OGGI'};
      return {usable:consumableQuantity(id,season)>0,label:'USA ORA'};
    }
    if(id==='cons_training'){
      const trained=new Set(specialTrainingPlayerIds(day));
      const eligible=(managerById('user')?.roster||[]).some(player=>!playerStatusForDay(player.id,day).unavailable && !trained.has(String(player.id)));
      if(!eligible) return {usable:false,label:'TUTTI GIÀ ALLENATI'};
      return {usable:consumableQuantity(id,season)>0,label:'SCEGLI GIOCATORE'};
    }
    if(id==='cons_opponent_block'){
      if(effect.blockedOpponentPlayerId) return {usable:false,label:'GIÀ USATO OGGI'};
      return {usable:consumableQuantity(id,season)>0,label:'SCEGLI AVVERSARIO'};
    }
    if(id==='cons_reroll_rules') return {usable:false,label:'USA PRIMA DELL’ASTA'};
    if(id==='cons_reroll_admin') return {usable:false,label:'USA SULLA CARTA ADMIN'};
    if(id==='cons_reroll_event') return {usable:false,label:'USA SULLE CARTE EVENTO'};
    if(id==='cons_guaranteed_sale') return {usable:false,label:'USA NEL MERCATO INVERNALE'};
    return {usable:false,label:'NON DISPONIBILE'};
  }

  function renderConsumableInventory(){
    const grid=$('consumableInventoryGrid'),season=ensureSeasonState();
    if(!grid||!season) return;
    const day=season.currentMatchday;
    const ids=['cons_starter_report','cons_training','cons_opponent_block','cons_reroll_event','cons_reroll_admin','cons_reroll_rules','cons_guaranteed_sale'];
    grid.innerHTML=ids.map(id=>{
      const item=SHOP_ITEMS[id],qty=consumableQuantity(id,season),action=lineupConsumableActionState(id,day);
      const canUse=qty>0&&action.usable;
      return `<article class="consumable-inventory-item ${qty<=0?'is-empty':''}">
        <span class="consumable-inventory-icon">${item.icon}</span>
        <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small></div>
        <b>×${qty}</b>
        <button type="button" class="${canUse?'primary':'ghost'}" data-use-consumable="${escapeHtml(id)}" ${canUse?'':'disabled'}>${qty<=0?'ESAURITO':escapeHtml(action.label)}</button>
      </article>`;
    }).join('');
    grid.querySelectorAll('[data-use-consumable]').forEach(btn=>btn.addEventListener('click',()=>beginConsumableUse(btn.dataset.useConsumable)));
    const total=totalConsumablesOwned(season);
    if($('consumableModalTitle')) $('consumableModalTitle').textContent=`Consumabili · ${total} in inventario`;
    if($('consumableModalText')) $('consumableModalText').textContent='Gli oggetti disponibili qui si usano prima della Diretta Gol. Reroll e Cessione Garantita compaiono automaticamente nel loro momento specifico.';
  }

  function openConsumableInventory(){
    const modal=$('consumableModal');
    if(!modal||!ensureSeasonState()) return;
    $('consumableTargetPanel')?.classList.add('hidden');
    $('consumableInventoryGrid')?.classList.remove('hidden');
    renderConsumableInventory();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
  }

  function beginConsumableUse(id){
    const season=ensureSeasonState(),day=season?.currentMatchday;
    if(!season||!day||consumableQuantity(id,season)<=0) return;
    if(id==='cons_starter_report'){
      if(shopItemActive('scout_plus',season)||starterReportActive(day)) return;
      if(!consumeConsumable(id,{day,note:'starter_report'})) return;
      consumableDayEffect(day,season).starterReport=true;
      saveState();
      closeConsumableModal();
      renderLineupScreen();
      showToast('Report Titolarità attivo: percentuali visibili per tutta la giornata.');
      return;
    }
    if(id==='cons_training' || id==='cons_opponent_block') showConsumableTargets(id);
  }

  function showConsumableTargets(id){
    const season=ensureSeasonState(),day=season?.currentMatchday;
    if(!season||!day) return;
    const panel=$('consumableTargetPanel'),grid=$('consumableInventoryGrid'),list=$('consumableTargetList');
    if(!panel||!grid||!list) return;
    const own=id==='cons_training';
    const opponentId=userOpponentIdForDay(day);
    const manager=own?managerById('user'):managerById(opponentId);
    const roster=(manager?.roster||[]).filter(player=>!playerStatusForDay(player.id,day).unavailable).slice().sort((a,b)=>ROLE_ORDER.indexOf(a.role)-ROLE_ORDER.indexOf(b.role)||currentPlayerOvr(b)-currentPlayerOvr(a));
    const trained=own?new Set(specialTrainingPlayerIds(day)):new Set();
    if($('consumableTargetKicker')) $('consumableTargetKicker').textContent=own?'ALLENAMENTO SPECIALE':'BLOCCO AVVERSARIO';
    if($('consumableTargetTitle')) $('consumableTargetTitle').textContent=own?'Scegli un tuo giocatore · ogni giocatore può riceverlo una sola volta':`Scegli chi bloccare · ${manager?.team||'Avversario'}`;
    list.innerHTML=roster.map(player=>{
      const alreadyTrained=own&&trained.has(String(player.id));
      return `<button type="button" class="consumable-target-player ${alreadyTrained?'is-disabled':''}" data-consumable-target="${escapeHtml(String(player.id))}" data-consumable-type="${escapeHtml(id)}" ${alreadyTrained?'disabled':''}><span class="lineup-role-chip role-${player.role}">${player.role}</span><span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(clubShort(player.club))} · OVR ${playerOvrLabel(player)}${!own&&shopItemActive('scout_plus',season)?` · Tit. ${estimatedStarterProbability(player,day)}%`:''}</small></span><b>${alreadyTrained?'GIÀ ALLENATO':own?'ALLENA':'BLOCCA'}</b></button>`;
    }).join('') || '<div class="consumable-target-empty">Nessun giocatore disponibile.</div>';
    list.querySelectorAll('[data-consumable-target]').forEach(btn=>btn.addEventListener('click',()=>applyTargetedConsumable(btn.dataset.consumableType,btn.dataset.consumableTarget)));
    grid.classList.add('hidden');
    panel.classList.remove('hidden');
  }

  function applyTargetedConsumable(id,playerId){
    const season=ensureSeasonState(),day=season?.currentMatchday;
    if(!season||!day||consumableQuantity(id,season)<=0) return;
    const effect=consumableDayEffect(day,season);
    if(id==='cons_training'){
      if(specialTrainingUsedForPlayer(day,playerId)) return;
      const player=managerById('user')?.roster?.find(p=>String(p.id)===String(playerId));
      if(!player || playerStatusForDay(player.id,day).unavailable) return;
      if(!consumeConsumable(id,{day,note:'special_training',targetPlayerId:player.id})) return;
      const ids=specialTrainingPlayerIds(day);
      ids.push(String(player.id));
      effect.trainingPlayerIds=[...new Set(ids)];
      // Campo legacy mantenuto per compatibilità con salvataggi/versioni precedenti.
      effect.trainingPlayerId=effect.trainingPlayerIds[0]||null;
      effect.trainingAppliedAtByPlayer ||= {};
      effect.trainingAppliedAtByPlayer[String(player.id)]=Date.now();
      effect.trainingAppliedAt=Date.now();
      saveState();
      closeConsumableModal();
      renderLineupScreen();
      showToast(`Allenamento Speciale: ${player.name} riceve il boost per la giornata. Puoi usarne un altro su un giocatore diverso.`);
      return;
    }
    if(id==='cons_opponent_block'){
      if(effect.blockedOpponentPlayerId) return;
      const opponentId=userOpponentIdForDay(day),opponent=managerById(opponentId);
      const player=(opponent?.roster||[]).find(p=>String(p.id)===String(playerId));
      if(!player) return;
      if(!consumeConsumable(id,{day,note:'opponent_block',targetPlayerId:player.id})) return;
      effect.blockedOpponentPlayerId=String(player.id);
      effect.blockedOpponentManagerId=String(opponentId||'');
      effect.blockedAt=Date.now();
      if(season.lineups?.[String(day)]?.[opponentId]) delete season.lineups[String(day)][opponentId];
      saveState();
      closeConsumableModal();
      renderLineupScreen();
      showToast(`Blocco Avversario: ${player.name} non potrà essere schierato da ${opponent?.team||'l’avversario'}.`);
    }
  }

  function enforceOpponentConsumableBlock(manager,lineup,day){
    const blockedId=blockedOpponentPlayerId(day),opponentId=userOpponentIdForDay(day);
    if(!blockedId||!manager||String(manager.id)!==String(opponentId)||!lineup) return lineup;
    const blocked=(manager.roster||[]).find(p=>String(p.id)===blockedId);
    if(!blocked) return lineup;
    const blockedSlot=Object.entries(lineup.starters||{}).find(([,id])=>String(id)===blockedId)?.[0]||null;
    lineup.bench=(lineup.bench||[]).map(String).filter(id=>id!==blockedId);
    if(blockedSlot){
      const used=new Set(Object.values(lineup.starters||{}).map(String).filter(id=>id!==blockedId));
      const replacement=(manager.roster||[]).filter(p=>p.role===blocked.role&&String(p.id)!==blockedId&&!used.has(String(p.id))&&!playerStatusForDay(p.id,day).unavailable).sort((a,b)=>cpuLeagueRuleLineupValue(manager,b,day)-cpuLeagueRuleLineupValue(manager,a,day))[0];
      if(replacement){
        lineup.starters[blockedSlot]=String(replacement.id);
        lineup.bench=lineup.bench.filter(id=>id!==String(replacement.id));
      }else delete lineup.starters[blockedSlot];
    }
    const used=new Set(Object.values(lineup.starters||{}).map(String));
    const ro={P:0,D:1,C:2,A:3};
    (manager.roster||[]).filter(p=>String(p.id)!==blockedId&&!used.has(String(p.id))&&!lineup.bench.includes(String(p.id))).slice().sort((a,b)=>ro[a.role]-ro[b.role]||cpuLeagueRuleLineupValue(manager,b,day)-cpuLeagueRuleLineupValue(manager,a,day)).forEach(p=>lineup.bench.push(String(p.id)));
    lineup.blockedByConsumable=blockedId;
    return lineup;
  }

  function renderLineupScreen() {
    const season=ensureSeasonState();
    const scoutPlusActive=shopItemActive('scout_plus',season);
    const dataProActive=shopItemActive('fantadata_pro',season);
    renderCareerWallets();
    const manager=managerById('user');
    if (!season || !manager || !lineupDraft) return;
    const day=season.currentMatchday;
    const captainActive=leagueRulesFor(state).captainBonus!=='off';
    const captainId=captainActive?String(lineupDraft.captainId||''):'';
    const starterInsightActive=scoutPlusActive||starterReportActive(day);
    const fixture=currentUserFixture();
    const opponentId=fixture?.homeId==='user'?fixture?.awayId:fixture?.homeId;
    const opponent=managerById(opponentId);
    if ($('lineupMatchdayNo')) $('lineupMatchdayNo').textContent=day;
    if ($('lineupPageTitle')) $('lineupPageTitle').textContent=`${manager.team} · ${lineupDraft.formation}`;
    if ($('lineupOpponentText')) $('lineupOpponentText').textContent=lineupReadOnly
      ? `G${day} · formazione bloccata · parziale contro ${opponent?.team||'—'}`
      : `G${day} · ${fixture?.homeId==='user'?'Casa':'Trasferta'} contro ${opponent?.team||'—'}`;

    const consumableBtn=$('lineupConsumablesBtn');
    if(consumableBtn){
      const qty=totalConsumablesOwned(season);
      consumableBtn.disabled=lineupReadOnly;
      consumableBtn.classList.toggle('has-items',qty>0);
      consumableBtn.title=lineupReadOnly?'Consumabili non disponibili durante la Diretta Gol':'Apri inventario consumabili';
      if($('lineupConsumablesCount')) $('lineupConsumablesCount').textContent=String(qty);
    }

    const activeTwist=activeAdminRule(day) || activeFormationChoice(day) || activeOpponentMalus(day);
    const twistBanner=$('lineupTwistBanner');
    if(twistBanner){
      twistBanner.style.display=activeTwist?'':'none';
      if(activeTwist){
        if($('lineupTwistType')) $('lineupTwistType').textContent=formationChoiceCategoryLabel(activeTwist.category);
        if($('lineupTwistTitle')) $('lineupTwistTitle').textContent=activeTwist.title;
        if($('lineupTwistText')) $('lineupTwistText').textContent=activeTwist.text;
        if($('lineupTwistBadge')){
          $('lineupTwistBadge').textContent=activeTwist.category==='rule'?'REGOLA ATTIVA':'EFFETTO ATTIVO';
          $('lineupTwistBadge').className=`lineup-twist-badge type-${formationChoiceCategoryClass(activeTwist.category)}`;
        }
      }
    }

    const readonlyBanner=$('lineupReadOnlyBanner');
    if(readonlyBanner){
      readonlyBanner.style.display=lineupReadOnly?'':'none';
      if(lineupReadOnly && lineupPartialContext?.user){
        const u=lineupPartialContext.user, o=lineupPartialContext.opponent;
        if($('lineupPartialScore')) $('lineupPartialScore').textContent=o
          ? `${manager.team} ${u.fantasyPoints.toFixed(1)} - ${o.fantasyPoints.toFixed(1)} ${opponent?.team||'Avversario'}`
          : `${u.fantasyPoints.toFixed(1)} fantapunti parziali`;
        if($('lineupPartialBadge')) $('lineupPartialBadge').textContent=`${u.votedCount}/11 CON VOTO`;
        if($('lineupPartialNote')) $('lineupPartialNote').textContent=
          `${u.pendingCount} titolar${u.pendingCount===1?'e deve':'i devono'} ancora giocare il Big Match. La rosa è consultabile ma completamente bloccata.`;
      }
    }

    if($('lineupSaveBtn')){
      $('lineupSaveBtn').disabled=lineupReadOnly;
      $('lineupSaveBtn').textContent=lineupReadOnly?'BLOCCATA':'Salva';
    }
    const assistantCoachActive=shopItemActive('assistant_coach',season);
    if($('autoLineupBtn')) {
      $('autoLineupBtn').classList.toggle('hidden',!assistantCoachActive);
      $('autoLineupBtn').disabled=lineupReadOnly || !assistantCoachActive;
      $('autoLineupBtn').textContent='AUTO XI';
      const caps=assistantAutoLineupCapabilities(season);
      $('autoLineupBtn').title=`Assistente Tecnico: OVR + disponibilità${caps.scout?' + titolarità Scout Plus':''}${caps.fantadata?' + forma/rendimento + avversario Serie A FantaData':''}`;
    }
    const autoXiInfo=$('autoXiAnalysisInfo');
    if(autoXiInfo){
      autoXiInfo.classList.toggle('hidden',!assistantCoachActive);
      if(assistantCoachActive) autoXiInfo.innerHTML=assistantAutoLineupAnalysisHtml(season);
    }
    if($('carryLineupBtn')){
      const carry=assistantCoachActive && assistantCoachCarryEnabled(season);
      $('carryLineupBtn').classList.toggle('hidden',!assistantCoachActive);
      $('carryLineupBtn').disabled=lineupReadOnly || !assistantCoachActive;
      $('carryLineupBtn').classList.toggle('active',carry);
      $('carryLineupBtn').textContent=carry?'✓ MANTIENI FORMAZIONE · ON':'MANTIENI FORMAZIONE · OFF';
      $('carryLineupBtn').title=carry?'Titolari, capitano e ordine della panchina verranno riproposti nelle prossime giornate. Clicca per disattivare.':'Salva titolari, capitano e ordine della panchina per le prossime giornate.';
    }
    const unavailableNow=unavailableDraftStarters();
    if($('assistantFixOutBtn')){
      const showFix=assistantCoachActive && unavailableNow.length>0 && !lineupReadOnly;
      $('assistantFixOutBtn').classList.toggle('hidden',!showFix);
      $('assistantFixOutBtn').disabled=!showFix;
      $('assistantFixOutBtn').textContent=`SISTEMA OUT${unavailableNow.length?` · ${unavailableNow.length}`:''}`;
    }
    const assistantBanner=$('assistantCoachBanner');
    if(assistantBanner){
      const show=assistantCoachActive && lineupAssistantAdjustments.length>0;
      assistantBanner.style.display=show?'':'none';
      if(show && $('assistantCoachBannerText')) $('assistantCoachBannerText').textContent=lineupAssistantAdjustments.map(x=>`${x.outName} → ${x.inName}`).join(' · ');
    }
    if($('clearLineupBtn')) $('clearLineupBtn').disabled=lineupReadOnly;

    const forcedFormation=forcedFormationRuleForDay(day);
    $('formationButtons').innerHTML=availableLineupFormations().map(key=>`<button class="formation-choice ${key===lineupDraft.formation?'active':''} ${forcedFormation&&key===forcedFormation?'is-forced':''}" data-lineup-formation="${key}" ${(lineupReadOnly || (forcedFormation && key!==forcedFormation)) ? 'disabled' : ''}>${key}</button>`).join('');
    if(!lineupReadOnly) $('formationButtons').querySelectorAll('[data-lineup-formation]').forEach(btn=>btn.addEventListener('click',()=>setDraftFormation(btn.dataset.lineupFormation)));

    const starterIds=draftStarterIds();
    const lineupAdminEffect=activeAdminRuleEffect(day);
    const adminBlockedUserId=!lineupReadOnly?adminBlockedStarterForManager('user',day):null;
    const faithReserveIds=!lineupReadOnly?new Set(adminFaithReserveEligibleIds(day)):new Set();
    const roleOrder=['P','D','C','A'];
    $('lineupRosterList').innerHTML=roleOrder.map(role=>{
      const items=(manager.roster||[]).filter(p=>p.role===role).slice().sort((a,b)=>lineupPlayerValue(b)-lineupPlayerValue(a));
      return `<section class="lineup-role-group"><div class="lineup-role-head"><strong>${ROLE_PLURALS[role]}</strong><span>${items.filter(p=>starterIds.has(String(p.id))).length}/${lineupCountsForFormation(lineupDraft.formation)[role]}</span></div>${items.map(p=>{
        const starter=starterIds.has(String(p.id)), selected=String(p.id)===String(lineupSelectedPlayerId);
        const adminBlocked=!!adminBlockedUserId && String(adminBlockedUserId)===String(p.id);
        const faithReserve=faithReserveIds.has(String(p.id));
        const partial=lineupReadOnly?pendingPartialPlayerInfo(p):null;
        const availability=!lineupReadOnly?playerStatusForDay(p.id,day):null;
        const form=!lineupReadOnly?playerFormMetrics(p.id):null;
        const formText=!lineupReadOnly?visibleFormLabel(p.id,1,season):'';
        const seasonExtra=!lineupReadOnly?` · ${formText}${availability?.unavailable?` · ${availability.label}`:''}`:'';
        const serieAFixture=!lineupReadOnly?serieAFixtureForPlayer(p,day):null;
        const serieADifficulty=!lineupReadOnly&&dataProActive?serieAMatchupDifficulty(p,day):null;
        return `<button class="lineup-roster-player ${starter?'is-starter':''} ${selected?'is-selected':''} ${partial?.className||''} ${availability?.unavailable?'is-unavailable':''} ${adminBlocked?'is-admin-blocked':''} ${faithReserve?'is-admin-reserve':''}" data-lineup-player="${escapeHtml(p.id)}" ${lineupReadOnly||adminBlocked?'disabled':'draggable="true"'}><span class="lineup-roster-leading">${lineupPlayerFaceMarkup(p,'roster')}<span class="lineup-role-chip role-${p.role}">${p.role}</span></span><span class="lineup-roster-copy"><strong>${escapeHtml(p.name)}${!lineupReadOnly&&lineupAdminEffect?.ruleId==='forced_starter_pair'&&String(lineupAdminEffect?.userPlayerId||'')===String(p.id)?'<span class="admin-forced-player-badge">📌 ADMIN</span>':''}${adminBlocked?'<span class="admin-forced-player-badge">🔒 PANCHINA</span>':''}${faithReserve?'<span class="admin-forced-player-badge">🌱 RISERVA</span>':''}</strong><small>${escapeHtml(clubShort(p.club))} · OVR ${playerOvrLabel(p)}${partial?` · ${escapeHtml(partial.label)}`:''}${escapeHtml(seasonExtra)}</small>${serieAFixture?`<em class="lineup-seriea-fixture">vs ${escapeHtml(serieAFixture.opponentShort)} · ${serieAFixture.home?'CASA':'TRASF.'}${serieADifficulty?` · ${serieADifficulty.icon} ${serieADifficulty.label}`:''}</em>`:''}${!lineupReadOnly&&starterInsightActive?scoutStarterBadge(p,day):''}</span><span class="lineup-roster-state">${lineupReadOnly?(partial?.pending?'POST':partial?.noVote?'SV':starter?'TIT':'ROS'):(adminBlocked?'LOCK':availability?.unavailable?'OUT':starter?'TIT':'+')}</span></button>`;
      }).join('')}</section>`;
    }).join('');
    if(!lineupReadOnly) $('lineupRosterList').querySelectorAll('[data-lineup-player]').forEach(btn=>btn.addEventListener('click',()=>selectLineupPlayer(btn.dataset.lineupPlayer)));

    const selectedPlayer=draftPlayerById(lineupSelectedPlayerId);
    const slots=lineupSlots(lineupDraft.formation);
    $('lineupPitch')?.classList.toggle('is-formation-334',lineupDraft.formation==='3-3-4');
    $('lineupPitch')?.classList.toggle('is-formation-555',lineupDraft.formation==='5-5-5');
    $('lineupPitchSlots').innerHTML=slots.map(slot=>{
      const pid=lineupDraft.starters[slot.instanceId];
      const p=pid?draftPlayerById(pid):null;
      const available=selectedPlayer && canPlacePlayerInLineupSlot(selectedPlayer,slot,lineupDraft,day);
      const selected=p && String(p.id)===String(lineupSelectedPlayerId);
      const partial=p&&lineupReadOnly?pendingPartialPlayerInfo(p):null;
      const pitchFixture=p&&!lineupReadOnly?serieAFixtureForPlayer(p,day):null;
      const pitchDifficulty=p&&!lineupReadOnly&&dataProActive?serieAMatchupDifficulty(p,day):null;
      const wildcardRole=p && p.role!==slot.role;
      return `<button class="lineup-slot ${p?'filled':''} role-${slot.role} ${available&&!lineupReadOnly?'available':''} ${selected?'selected-slot':''} ${wildcardRole?'is-admin-wildcard':''} ${partial?.className||''}" data-lineup-slot="${slot.instanceId}" ${!lineupReadOnly&&p?'draggable="true"':''} style="left:${slot.x}%;top:${slot.y}%" ${lineupReadOnly?'disabled':''}><span class="slot-pos">${slot.key}</span>${p?`${lineupPlayerFaceMarkup(p,'pitch')}${String(p.id)===captainId?'<span class="lineup-captain-badge" title="Capitano">C</span>':''}<span class="lineup-slot-copy"><strong title="${escapeHtml(p.name)}">${escapeHtml(compactLineupPlayerName(p.name))}</strong><small>${escapeHtml(clubShort(p.club))} · ${partial?escapeHtml(partial.label):playerOvrLabel(p)}${wildcardRole?' · 🃏 JOLLY':''}${pitchFixture?` · vs ${escapeHtml(pitchFixture.opponentShort)}${pitchDifficulty?` ${pitchDifficulty.icon}`:''}`:''}</small>${!lineupReadOnly&&starterInsightActive?scoutStarterBadge(p,day):''}</span>`:'<strong>+</strong><small>vuoto</small>'}</button>`;
    }).join('');
    if(!lineupReadOnly) $('lineupPitchSlots').querySelectorAll('[data-lineup-slot]').forEach(btn=>btn.addEventListener('click',()=>{
      const slotId=btn.dataset.lineupSlot;
      openLineupSlotPicker(slotId);
    }));

    const bench=draftBenchPlayers();
    $('lineupBenchList').innerHTML=bench.map((p,idx)=>{
      const partial=lineupReadOnly?pendingPartialPlayerInfo(p):null;
      const availability=!lineupReadOnly?playerStatusForDay(p.id,day):null;
      const benchFixture=!lineupReadOnly?serieAFixtureForPlayer(p,day):null;
      const benchDifficulty=!lineupReadOnly&&dataProActive?serieAMatchupDifficulty(p,day):null;
      return `<div class="bench-player-row ${availability?.unavailable?'is-unavailable':''}">
        <button class="bench-player ${String(p.id)===String(lineupSelectedPlayerId)?'is-selected':''} ${partial?.className||''}" data-bench-player="${escapeHtml(p.id)}" ${lineupReadOnly?'disabled':'draggable="true"'}><span class="bench-order-badge">${String(idx+1).padStart(2,'0')}</span><span class="lineup-bench-leading">${lineupPlayerFaceMarkup(p,'bench')}<i class="lineup-role-chip role-${p.role}">${p.role}</i></span><span class="lineup-bench-copy"><strong>${escapeHtml(p.name)}</strong><small>${partial?escapeHtml(partial.label):`${playerOvrLabel(p)}${benchFixture?` · vs ${escapeHtml(benchFixture.opponentShort)}${benchDifficulty?` ${benchDifficulty.icon}`:''}`:''}`}</small>${!lineupReadOnly&&starterInsightActive?scoutStarterBadge(p,day):''}</span></button>
        ${lineupReadOnly?'':`<div class="bench-order-controls"><button type="button" data-bench-up="${escapeHtml(p.id)}" ${idx===0?'disabled':''} title="Sposta prima">▲</button><button type="button" data-bench-down="${escapeHtml(p.id)}" ${idx===bench.length-1?'disabled':''} title="Sposta dopo">▼</button></div>`}
      </div>`;
    }).join('');
    if(!lineupReadOnly){
      $('lineupBenchList').querySelectorAll('[data-bench-player]').forEach(btn=>btn.addEventListener('click',()=>selectLineupPlayer(btn.dataset.benchPlayer)));
      $('lineupBenchList').querySelectorAll('[data-bench-up]').forEach(btn=>btn.addEventListener('click',()=>moveBenchPlayer(btn.dataset.benchUp,-1)));
      $('lineupBenchList').querySelectorAll('[data-bench-down]').forEach(btn=>btn.addEventListener('click',()=>moveBenchPlayer(btn.dataset.benchDown,1)));
      bindLineupDragDrop();
    }

    const count=starterIds.size;
    const required=slots.length;
    const adminValidation=validateAdminRuleLineup(lineupDraft,day);
    $('lineupStarterCount').textContent=`${count}/${required}`;
    $('benchCount').textContent=String(bench.length);
    $('lineupReadyText').textContent=`${count} / ${required}`;
    const baseValidationText=lineupReadOnly
      ? 'Sola lettura: la formazione della giornata è già bloccata.'
      : (count===required?'Formazione valida. Le CPU prepareranno automaticamente i titolari.':`Mancano ${required-count} titolari.`);
    let extraRuleText='';
    const adminEffect=activeAdminRuleEffect(day);
    if(!lineupReadOnly && (adminEffect?.ruleId==='forced_formation' || adminEffect?.ruleId==='butterfly_555')) extraRuleText=` Regola Admin: modulo obbligatorio ${adminEffect.formation}.`;
    if(!lineupReadOnly && (adminEffect?.ruleId==='forced_turnover_3' || adminEffect?.ruleId==='forced_turnover_5')){
      const required=adminEffect.ruleId==='forced_turnover_5'?5:3;
      const turnover=lineupTurnoverDeltaFromPrevious(lineupDraft,day,required);
      extraRuleText=` Regola Admin: cambi titolari ${turnover.changed}/${required} rispetto alla giornata precedente.`;
    }
    if(!lineupReadOnly && adminEffect?.ruleId==='forced_starter_pair'){
      const forcedPlayer=draftPlayerById(adminEffect.userPlayerId);
      const isStarter=Object.values(lineupDraft?.starters||{}).map(String).includes(String(adminEffect.userPlayerId||''));
      extraRuleText=` Regola Admin: ${forcedPlayer?.name||adminEffect.userPlayerName||'giocatore imposto'} deve essere titolare ${isStarter?'✓':'· NON ANCORA SCHIERATO'}.`;
    }
    if(!lineupReadOnly && adminEffect?.ruleId==='top_player_bench'){
      extraRuleText=` Regola Admin: 🔒 ${adminEffect.userPlayerName||'Top Player'} deve partire dalla panchina.`;
    }
    if(!lineupReadOnly && adminEffect?.ruleId==='faith_reserve'){
      const eligible=new Set((adminEffect.eligiblePlayerIds||[]).map(String));
      const used=Object.values(lineupDraft?.starters||{}).map(String).some(id=>eligible.has(id));
      extraRuleText=` Regola Admin: 🌱 schiera almeno una riserva non entrata nella giornata precedente ${used?'✓':'· NON ANCORA SCHIERATA'}.`;
    }
    if(!lineupReadOnly && (adminEffect?.ruleId==='wildcard_starting_slot' || adminEffect?.ruleId==='double_wildcard_starting_slot')){
      const wildcardCount=lineupOutOfRoleEntries(lineupDraft).length;
      const wildcardLimit=adminEffect.ruleId==='double_wildcard_starting_slot'?2:1;
      extraRuleText=` Regola Admin: ${wildcardLimit===2?'Doppio Jolly':'Wildcard'} fuori ruolo ${wildcardCount}/${wildcardLimit} usat${wildcardCount===1?'o':'i'} · compatibilità D↔C e C↔A.`;
    }
    if(!lineupReadOnly && state?.season?.sponsor?.id==='fantacana' && !extraRuleText){
      extraRuleText=` Sponsor Haaland Rover: ${lineupOutOfRoleEntries(lineupDraft).length}/${adminWildcardStartingSlotLimit()} titolare fuori ruolo tra D, C e A.`;
    }
    if(!lineupReadOnly && adminEffect?.ruleId==='no_substitutions') extraRuleText=' Regola Admin: niente sostituzioni dalla panchina in questa giornata.';
    $('lineupValidationText').textContent = (!lineupReadOnly && count===required && !adminValidation.ok)
      ? adminValidation.message
      : `${baseValidationText}${extraRuleText}`.trim();
    if($('captainSelectedBtn')){
      $('captainSelectedBtn').style.display=captainActive?'':'none';
      $('captainSelectedBtn').disabled=lineupReadOnly || !selectedPlayer || !starterIds.has(String(selectedPlayer.id));
      $('captainSelectedBtn').textContent=selectedPlayer && String(selectedPlayer.id)===captainId?'© CAPITANO SCELTO':'© NOMINA CAPITANO';
    }
    if($('lineupCaptainText')){
      const captain=draftPlayerById(captainId);
      $('lineupCaptainText').style.display=captainActive?'':'none';
      $('lineupCaptainText').textContent=`Capitano: ${captain?.name||'da scegliere'} · ${leagueRulesFor(state).captainBonus==='seven'?'+1 con voto ≥ 7':'+2 con voto ≥ 8'}`;
    }
    $('confirmLineupBtn').disabled=lineupReadOnly || count!==required || !adminValidation.ok;
    $('confirmLineupBtn').classList.toggle('lineup-ready', !lineupReadOnly && count===required && adminValidation.ok);
    $('confirmLineupBtn').textContent=lineupReadOnly?'FORMAZIONE BLOCCATA':'CONFERMA FORMAZIONE';
    $('lineupSelectedText').textContent=lineupReadOnly
      ? 'Consulta i voti parziali: nessuna modifica consentita'
      : (selectedPlayer?`${selectedPlayer.name} · ${ROLE_LABELS[selectedPlayer.role]} · scegli uno slot`:'Seleziona un giocatore dalla rosa');
    $('benchSelectedBtn').disabled=lineupReadOnly || !selectedPlayer || !starterIds.has(String(selectedPlayer.id));
  }


  // V2.3 · La giornata fantasy nasce da una simulazione unica della Serie A.
  // Lo stesso calciatore ha quindi lo stesso voto/eventi ovunque: prima si gioca
  // la Serie A, poi quei voti vengono usati per tutte le fantasquadre.
  function seededSerieRand(day, key) {
    return careerHash(`seriea|${day}|${key}`);
  }

  function halfPoint(value) { return Math.round(value * 2) / 2; }

  function buildSerieASchedule() {
    return buildDoubleRoundRobin((window.FANTA_CLUBS||[]).map(club=>club.id),careerHash);
  }

  let serieAStrengthCache={key:null,rows:null};

  function serieAFixtureForPlayer(player,day=ensureSeasonState()?.currentMatchday||1){
    const season=ensureSeasonState();
    if(!player || !season) return null;
    const round=season.serieASchedule?.[Number(day)-1];
    if(!round) return null;
    const match=(round.matches||[]).find(m=>m.homeClub===player.club || m.awayClub===player.club);
    if(!match) return null;
    const home=match.homeClub===player.club;
    const opponentClub=home?match.awayClub:match.homeClub;
    return {
      day:Number(day),
      clubId:player.club,
      opponentClub,
      home,
      venue:home?'Casa':'Trasferta',
      opponentName:clubName(opponentClub),
      opponentShort:clubShort(opponentClub)
    };
  }

  function serieAStrengthRowsForDay(day=ensureSeasonState()?.currentMatchday||1){
    const season=ensureSeasonState();
    const cacheKey=`${Number(day)}|${Number(season?.lastCompletedMatchday||0)}|${Object.keys(season?.playerStatus||{}).length}|M${Number(state?.transferMarket?.worldRevision||0)}`;
    if(serieAStrengthCache.key===cacheKey && Array.isArray(serieAStrengthCache.rows)) return serieAStrengthCache.rows;
    const rows=(window.FANTA_CLUBS||[]).map(club=>({
      clubId:club.id,
      strength:serieAClubStrength(club.id,Number(day))
    })).sort((a,b)=>b.strength-a.strength);
    serieAStrengthCache={key:cacheKey,rows};
    return rows;
  }

  function serieAMatchupDifficulty(player,day=ensureSeasonState()?.currentMatchday||1){
    const fixture=serieAFixtureForPlayer(player,day);
    if(!fixture) return null;
    const rows=serieAStrengthRowsForDay(day);
    const idx=rows.findIndex(x=>x.clubId===fixture.opponentClub);
    const rank=idx>=0?idx+1:Math.ceil(rows.length/2);
    let key='balanced',label='EQUILIBRATA',icon='🟡';
    if(rank<=6){key='hard';label='DIFFICILE';icon='🔴';}
    else if(rank>=Math.max(15,rows.length-5)){key='favorable';label='FAVOREVOLE';icon='🟢';}
    return {...fixture,key,label,icon,rank,opponentStrength:idx>=0?rows[idx].strength:null};
  }

  function serieAFixtureCompactText(player,day=ensureSeasonState()?.currentMatchday||1){
    const fixture=serieAFixtureForPlayer(player,day);
    if(!fixture) return 'Serie A: —';
    return `vs ${fixture.opponentShort} · ${fixture.home?'CASA':'TRASF.'}`;
  }

  function serieAFixtureFullText(player,day=ensureSeasonState()?.currentMatchday||1){
    const fixture=serieAFixtureForPlayer(player,day);
    if(!fixture) return 'Avversario Serie A non disponibile';
    return `vs ${fixture.opponentName} · ${fixture.venue}`;
  }

  function serieAMatchupBadgeHtml(player,day=ensureSeasonState()?.currentMatchday||1){
    const info=serieAMatchupDifficulty(player,day);
    if(!info) return '';
    return `<span class="seriea-matchup-badge ${info.key}" title="FantaData Pro · avversario ${escapeHtml(info.opponentName)} · ${info.venue}">${info.icon} ${info.label}</span>`;
  }

  function clubPool(clubId){
    return (window.FANTA_PLAYERS||[]).filter(p=>p.club===clubId);
  }

  function rankedClubPlayers(clubId,day,key='rank'){
    return clubPool(clubId).slice().sort((a,b)=>{
      const av=currentPlayerOvr(a)+(seededSerieRand(day,`${clubId}|${key}|${a.id}`)-.5)*5;
      const bv=currentPlayerOvr(b)+(seededSerieRand(day,`${clubId}|${key}|${b.id}`)-.5)*5;
      return bv-av || String(a.name).localeCompare(String(b.name),'it');
    });
  }

  function serieAPlayerDayProfile(player,clubId,day){
    const persistent=playerStatusForDay(player.id,day);
    const availabilityRoll=seededSerieRand(day,`${clubId}|availability|${player.id}`);
    const randomUnavailable=!persistent.unavailable && availabilityRoll<.012;
    const unavailable=persistent.unavailable || randomUnavailable;
    const doubtful=!unavailable && availabilityRoll<.075;
    const form=playerFormMetrics(player.id);
    const formNoise=(seededSerieRand(day,`${clubId}|form|${player.id}`)-.5)*3.2;
    const rotationNoise=(seededSerieRand(day,`${clubId}|rotation|${player.id}`)-.5)*3.2;
    const persistentFormBoost=form.score*2.15;
    const worldEffect=worldPlayerModifier(day,player.id);
    const eventStarterDelta=Number(worldEffect?.starterScoreDelta||0);
    const score=currentPlayerOvr(player)+formNoise+rotationNoise+persistentFormBoost+eventStarterDelta-(doubtful?3.1:0);
    return {unavailable,doubtful,score,formNoise,persistentUnavailable:persistent.unavailable,status:persistent,form};
  }

  function chooseSerieATacticalShape(clubId,day,available,profiles){
    const feasible=SERIEA_TACTICAL_SHAPES.filter(shape=>
      ROLE_ORDER.every(role=>available.filter(p=>p.role===role).length>=shape.req[role])
    );
    const shapes=feasible.length?feasible:SERIEA_TACTICAL_SHAPES.filter(shape=>
      ROLE_ORDER.every(role=>clubPool(clubId).filter(p=>p.role===role).length>=shape.req[role])
    );
    const ranked=(shapes.length?shapes:[SERIEA_TACTICAL_SHAPES[0]]).map(shape=>{
      let score=0;
      ROLE_ORDER.forEach(role=>{
        const candidates=available.filter(p=>p.role===role).slice().sort((a,b)=>(profiles.get(String(b.id))?.score||0)-(profiles.get(String(a.id))?.score||0));
        score+=candidates.slice(0,shape.req[role]).reduce((s,p)=>s+(profiles.get(String(p.id))?.score||currentPlayerOvr(p)),0);
      });
      // Identità tattica: il modulo principale riceve un vantaggio moderato,
      // il secondo un vantaggio più piccolo. Non supera una grossa differenza di qualità.
      const prefs=SERIEA_TACTICAL_IDENTITY[clubId]||[];
      if(shape.key===prefs[0]) score+=20;
      else if(shape.key===prefs[1]) score+=8;
      score+=(seededSerieRand(day,`${clubId}|shape|${shape.key}`)-.5)*7.5;
      return {shape,score};
    }).sort((a,b)=>b.score-a.score);
    return ranked[0]?.shape||SERIEA_TACTICAL_SHAPES[0];
  }

  function buildSerieAClubSelection(clubId,day){
    const pool=clubPool(clubId);
    const profiles=new Map(pool.map(p=>[String(p.id),serieAPlayerDayProfile(p,clubId,day)]));
    let available=pool.filter(p=>!profiles.get(String(p.id)).unavailable);
    let shape=chooseSerieATacticalShape(clubId,day,available,profiles);

    // Se le indisponibilità rendessero impossibile un XI, recuperiamo il minimo
    // indispensabile dalla rosa per non rompere la simulazione.
    if(!ROLE_ORDER.every(role=>available.filter(p=>p.role===role).length>=shape.req[role])){
      available=pool.filter(p=>!profiles.get(String(p.id))?.persistentUnavailable);
      shape=chooseSerieATacticalShape(clubId,day,available,profiles);
    }
    // Safety estremo: evita di rompere la simulazione se un club resta senza 11 eleggibili.
    if(!ROLE_ORDER.every(role=>available.filter(p=>p.role===role).length>=shape.req[role])){
      available=pool.slice();
      shape=chooseSerieATacticalShape(clubId,day,available,profiles);
    }

    const starters=[], used=new Set();
    ROLE_ORDER.forEach(role=>{
      const candidates=available.filter(p=>p.role===role).slice().sort((a,b)=>{
        const av=profiles.get(String(a.id))?.score||currentPlayerOvr(a);
        const bv=profiles.get(String(b.id))?.score||currentPlayerOvr(b);
        return bv-av || currentPlayerOvr(b)-currentPlayerOvr(a);
      });
      candidates.slice(0,shape.req[role]).forEach(p=>{starters.push(p);used.add(String(p.id));});
    });

    const bench=available.filter(p=>!used.has(String(p.id))).slice().sort((a,b)=>{
      const av=profiles.get(String(a.id))?.score||currentPlayerOvr(a);
      const bv=profiles.get(String(b.id))?.score||currentPlayerOvr(b);
      return bv-av;
    }).slice(0,12);

    const participants=[];
    starters.forEach(p=>participants.push({
      player:p,starter:true,entryMinute:1,plannedExitMinute:90,
      dayScore:profiles.get(String(p.id))?.score||currentPlayerOvr(p)
    }));
    bench.forEach(p=>participants.push({
      player:p,starter:false,entryMinute:999,plannedExitMinute:90,
      dayScore:profiles.get(String(p.id))?.score||currentPlayerOvr(p)
    }));

    // 3-4 cambi tattici programmati; il quinto slot resta spesso disponibile
    // per un eventuale infortunio.
    const substitutions=[];
    const plannedCount=3+(seededSerieRand(day,`${clubId}|planned-subs`)<.58?1:0);
    const starterItems=participants.filter(x=>x.starter && x.player.role!=='P').slice().sort((a,b)=>
      a.dayScore-b.dayScore || seededSerieRand(day,`${clubId}|subout|${a.player.id}`)-seededSerieRand(day,`${clubId}|subout|${b.player.id}`)
    );
    const benchItems=participants.filter(x=>!x.starter && x.player.role!=='P').slice().sort((a,b)=>b.dayScore-a.dayScore);
    const usedIn=new Set(), usedOut=new Set();

    for(let i=0;i<plannedCount;i++){
      const out=starterItems.find(x=>!usedOut.has(String(x.player.id)) && benchItems.some(y=>!usedIn.has(String(y.player.id))&&y.player.role===x.player.role));
      if(!out) break;
      const incoming=benchItems.find(y=>!usedIn.has(String(y.player.id))&&y.player.role===out.player.role);
      if(!incoming) break;
      const minute=56+Math.floor(seededSerieRand(day,`${clubId}|subminute|${i}|${out.player.id}`)*27);
      out.plannedExitMinute=minute-1;
      incoming.entryMinute=minute;
      usedOut.add(String(out.player.id)); usedIn.add(String(incoming.player.id));
      substitutions.push({
        outPlayerId:String(out.player.id),outPlayerName:out.player.name,
        inPlayerId:String(incoming.player.id),inPlayerName:incoming.player.name,
        role:out.player.role,minute,reason:'tactical',cancelled:false
      });
    }

    return {
      clubId,formation:shape.key,requirements:shape.req,starters,bench,participants,
      substitutions,unavailable:pool.filter(p=>profiles.get(String(p.id))?.unavailable).map(p=>String(p.id))
    };
  }

  function baseLivePerformance(item,day,clubId){
    const p=item.player, ovr=currentPlayerOvr(p);
    const quality=clamp((ovr-75)/20,-1,1);
    const noise=(seededSerieRand(day,`${clubId}|basevote|${p.id}`)-.5)*.78;
    const matchFeel=(seededSerieRand(day,`${clubId}|matchfeel|${p.id}`)-.5)*.32;
    const voteEffect=formationPlayerModifier(day,p.id,'player_vote');
    const worldEffect=worldPlayerModifier(day,p.id);
    const socialMotivation=socialMotivationForPlayer(p.id,day);
    const socialMotivationDelta=Number(socialMotivation?.voteDelta||0);
    const lockerDelta=lockerVoteModifier(day,p.id);
    const injuryRisk=formationPlayerModifier(day,p.id,'risk_injury');
    const base=Number(injuryRisk?.voteDelta||0)+clamp(clamp(6 + quality*.16 + noise + matchFeel + Number(voteEffect?.delta||0) + Number(worldEffect?.voteDelta||0) + socialMotivationDelta,4.75,7.25) + lockerDelta,4,8);
    return {
      day,
      playerId:String(p.id),name:p.name,role:p.role,club:p.club,entryMinute:item.entryMinute,
      plannedExitMinute:item.plannedExitMinute||90,
      starter:item.starter,baseVote:base,liveVote:base,startingVoteBonus:Number(injuryRisk?.voteDelta||0),goals:0,assists:0,yellow:0,red:0,
      ownGoal:0,missedPenalty:0,savedPenalty:0,goalsConceded:0,injury:false,injuryMinute:null,
      ratingsFinalized:false,
      socialMotivationDelta,
      socialMotivationOutcome:socialMotivation?.outcome||null
    };
  }

  function lockerVoteModifier(day,playerId){
    const id=String(playerId),season=ensureSeasonState();
    const starters=Object.values(season?.lineups?.[String(day)]?.user?.starters||{}).map(String);
    const choice=activeFormationChoice(day);
    const effect=choice?.effect||{};
    let delta=0;
    if(effect.kind==='locker_vote' && String(effect.targetPlayerId)===id && starters.includes(id)) delta+=Number(effect.delta||0);
    if(effect.kind==='locker_team' && starters.includes(id)){
      const captainReady=!!effect.role || starters.includes(String(season?.lineups?.[String(day)]?.user?.captainId||''));
      const candidates=starters.filter(candidate=>!effect.role || playerMap.get(candidate)?.role===effect.role)
        .sort((a,b)=>careerHash(`locker-team|${day}|${a}`)-careerHash(`locker-team|${day}|${b}`));
      if(captainReady && candidates.slice(0,Number(effect.maxPlayers||3)).includes(id)) delta+=Number(effect.delta||0);
    }
    const yesterday=activeFormationChoice(Number(day)-1)?.effect;
    if(yesterday?.kind==='locker_vote' && yesterday.nextDayPenalty && String(yesterday.targetPlayerId)===id){
      const priorResult=season?.matchdayResults?.[String(day-1)];
      const priorMatch=(priorResult?.matches||[]).find(m=>m.homeId==='user'||m.awayId==='user');
      const priorPerfs=priorMatch?(priorMatch.homeId==='user'?priorMatch.homePerformances:priorMatch.awayPerformances):[];
      const appeared=(priorPerfs||[]).some(p=>String(p.playerId)===id && p.lineupSource==='starter');
      if(priorMatch && !appeared) delta+=Number(yesterday.nextDayPenalty);
    }
    return delta;
  }

  function participantWeight(perf,kind='goal'){
    const role=perf.role;
    let weight;
    if(kind==='assist') weight=({P:.05,D:.8,C:2.6,A:2.2}[role]||1) * (.65+currentPlayerOvr(playerMap.get(perf.playerId))/100);
    else if(kind==='card') weight=({P:.35,D:2.4,C:1.8,A:1.1}[role]||1);
    else weight=({P:.03,D:.55,C:1.7,A:4.2}[role]||1) * (.55+currentPlayerOvr(playerMap.get(perf.playerId))/100);

    const day=perf.day||state?.season?.currentMatchday;
    const effect=formationPlayerModifier(day,perf.playerId,kind==='assist'?'assist_weight':kind==='goal'?'goal_weight':'');
    if(effect?.multiplier) weight*=Number(effect.multiplier);
    const worldEffect=worldPlayerModifier(day,perf.playerId);
    if(kind==='goal' && worldEffect?.goalMultiplier) weight*=Number(worldEffect.goalMultiplier);
    else if(kind==='assist' && worldEffect?.assistMultiplier) weight*=Number(worldEffect.assistMultiplier);
    else if(kind==='card' && worldEffect?.cardMultiplier) weight*=Number(worldEffect.cardMultiplier);
    return weight;
  }

  function weightedPerformancePick(list,day,key,kind='goal'){
    if(!list.length) return null;
    const weights=list.map(p=>Math.max(.01,participantWeight(p,kind)));
    const total=weights.reduce((a,b)=>a+b,0);
    let target=seededSerieRand(day,key)*total;
    for(let i=0;i<list.length;i++){target-=weights[i];if(target<=0)return list[i];}
    return list[list.length-1];
  }

  function activePerformances(perfs,minute){
    return perfs.filter(p=>p.entryMinute<=minute && (!p.plannedExitMinute || minute<=p.plannedExitMinute));
  }

  // V3.2.35.56.63 · La forza reale di una squadra non è più una sola media OVR.
  // Attacco, protezione difensiva e controllo del centrocampo vengono valutati
  // separatamente. In questo modo un grande portiere non aumenta artificialmente
  // la probabilità di segnare e un attacco forte pesa davvero sulla produzione gol.
  const SERIEA_UNIT_WEIGHTS={
    attack:{P:.02,D:.18,C:.72,A:1.35},
    defense:{P:1.50,D:1.15,C:.42,A:.08},
    control:{P:.05,D:.38,C:1.15,A:.62}
  };

  function serieAUnitWeightedAverage(items,weights,fallback=72){
    let total=0,weight=0;
    (items||[]).forEach(item=>{
      const player=item?.playerId ? playerMap.get(String(item.playerId)) : item;
      if(!player) return;
      const w=Number(weights?.[item.role||player.role]||0);
      if(w<=0) return;
      total+=currentPlayerOvr(player)*w;
      weight+=w;
    });
    return weight>0?total/weight:Number(fallback||72);
  }

  function serieATeamUnitProfile(items){
    const active=(items||[]).filter(Boolean);
    const activeCount=active.length;
    const missing=Math.max(0,11-activeCount);
    const rawAttack=serieAUnitWeightedAverage(active,SERIEA_UNIT_WEIGHTS.attack);
    const rawDefense=serieAUnitWeightedAverage(active,SERIEA_UNIT_WEIGHTS.defense);
    const rawControl=serieAUnitWeightedAverage(active,SERIEA_UNIT_WEIGHTS.control);
    // Un'espulsione deve cambiare davvero la partita. L'attacco perde opzioni,
    // ma la fase difensiva soffre ancora di più quando la squadra resta in 10.
    return {
      activeCount,
      attack:clamp(rawAttack-missing*2.8,55,95),
      defense:clamp(rawDefense-missing*4.2,55,95),
      control:clamp(rawControl-missing*2.6,55,95),
      overall:clamp(rawAttack*.34+rawDefense*.36+rawControl*.30-missing*3.2,55,95)
    };
  }

  function serieAGoalProbability(ownProfile,oppProfile,isHome=false){
    const own=ownProfile||{attack:72,control:72,activeCount:11};
    const opp=oppProfile||{defense:72,control:72,activeCount:11};
    const attackingForce=Number(own.attack||72)*.72+Number(own.control||72)*.28;
    const resistingForce=Number(opp.defense||72)*.78+Number(opp.control||72)*.22;
    const diff=attackingForce-resistingForce;
    const extra=Math.max(0,Math.abs(diff)-4)*.00008*Math.sign(diff||0);
    const qualityEffect=diff*.00055+extra;
    const numericalEdge=(Number(own.activeCount||11)-Number(opp.activeCount||11))*.00035;
    const homeEffect=isHome?.0016:0;
    return clamp(.0132+qualityEffect+numericalEdge+homeEffect,.0032,.033);
  }

  function matchStrength(starters){
    return serieATeamUnitProfile(starters).overall;
  }

  function buildSerieAMatch(day,idx,spec){
    const homeSel=buildSerieAClubSelection(spec.homeClub,day);
    const awaySel=buildSerieAClubSelection(spec.awayClub,day);
    const homePerfs=homeSel.participants.map(x=>baseLivePerformance(x,day,spec.homeClub));
    const awayPerfs=awaySel.participants.map(x=>baseLivePerformance(x,day,spec.awayClub));
    const perfMap=new Map([...homePerfs,...awayPerfs].map(p=>[p.playerId,p]));
    const events=[], redSeen=new Set(), injurySeen=new Set(), yellowCount=new Map();
    const subPlans={home:homeSel.substitutions.map(x=>({...x})),away:awaySel.substitutions.map(x=>({...x}))};

    const subCount=side=>subPlans[side].filter(x=>!x.cancelled).length;
    const cancelFutureSubFor=(side,playerId)=>{
      const plan=subPlans[side].find(s=>!s.cancelled && s.outPlayerId===String(playerId));
      if(!plan) return null;
      plan.cancelled=true;
      const incoming=perfMap.get(String(plan.inPlayerId));
      if(incoming) incoming.entryMinute=999;
      return plan;
    };
    const emergencyReplace=(side,hurt,minute)=>{
      const plans=subPlans[side];
      let existing=plans.find(s=>!s.cancelled && s.outPlayerId===hurt.playerId && s.minute>minute);
      if(existing){
        existing.minute=Math.min(89,minute+1);
        existing.reason='injury';
        const incoming=perfMap.get(String(existing.inPlayerId));
        if(incoming) incoming.entryMinute=existing.minute;
        hurt.plannedExitMinute=minute;
        return;
      }
      // Le sostituzioni reali di Serie A restano a cinque; la regola fantasy ne consente tre di default.
      if(subCount(side)>=5) return;
      const perfs=side==='home'?homePerfs:awayPerfs;
      const incoming=perfs.filter(p=>!p.starter && p.role===hurt.role && p.entryMinute>90 && !plans.some(s=>!s.cancelled&&s.inPlayerId===p.playerId))
        .sort((a,b)=>currentPlayerOvr(playerMap.get(b.playerId))-currentPlayerOvr(playerMap.get(a.playerId)))[0];
      if(!incoming) return;
      incoming.entryMinute=Math.min(89,minute+1);
      hurt.plannedExitMinute=minute;
      plans.push({
        outPlayerId:hurt.playerId,outPlayerName:hurt.name,inPlayerId:incoming.playerId,inPlayerName:incoming.name,
        role:hurt.role,minute:incoming.entryMinute,reason:'injury',cancelled:false
      });
    };

    const addGoal=(minute,team,penalty=false)=>{
      const own=team==='home'?homePerfs:awayPerfs;
      const opp=team==='home'?awayPerfs:homePerfs;
      const active=activePerformances(own,minute);
      const scorer=weightedPerformancePick(active,day,`${idx}|${minute}|${team}|scorer|${events.length}`,'goal');
      if(!scorer) return;
      let assist=null;
      if(!penalty && seededSerieRand(day,`${idx}|${minute}|${team}|assistchance|${events.length}`)<.72){
        assist=weightedPerformancePick(active.filter(p=>p.playerId!==scorer.playerId),day,`${idx}|${minute}|${team}|assist|${events.length}`,'assist');
      }
      const keeper=activePerformances(opp,minute).find(p=>p.role==='P') || opp.find(p=>p.role==='P'&&p.entryMinute<=minute);
      events.push({minute,type:penalty?'penalty_goal':'goal',side:team,playerId:scorer.playerId,playerName:scorer.name,assistId:assist?.playerId||null,assistName:assist?.name||null,keeperId:keeper?.playerId||null});
    };

    const riskEffect=activeFormationChoice(day)?.effect;
    const riskTarget=riskEffect?.kind==='risk_injury'?perfMap.get(String(riskEffect.targetPlayerId)):null;
    const riskFirst=Math.max(2,Number(riskTarget?.entryMinute||0));
    const riskLast=Math.min(89,Number(riskTarget?.plannedExitMinute||90));
    const riskMinute=riskTarget && riskFirst<=riskLast && seededSerieRand(day,`risk-injury-outcome|${riskTarget.playerId}`)<.5
      ? riskFirst+Math.floor(seededSerieRand(day,`risk-injury-minute|${riskTarget.playerId}`)*(riskLast-riskFirst+1)):null;
    for(let minute=2;minute<=90;minute++){
      for(const team of ['home','away']){
        const own=team==='home'?homePerfs:awayPerfs;
        const opp=team==='home'?awayPerfs:homePerfs;
        // Ricalcolo minuto per minuto: sostituzioni, espulsioni e infortuni
        // modificano immediatamente la forza dei due reparti e quindi la chance gol.
        const ownProfile=serieATeamUnitProfile(activePerformances(own,minute));
        const oppProfile=serieATeamUnitProfile(activePerformances(opp,minute));
        const goalP=serieAGoalProbability(ownProfile,oppProfile,team==='home');
        const prefix=`${idx}|${minute}|${team}`;

        if(seededSerieRand(day,`${prefix}|penalty`)<.00145){
          const active=activePerformances(own,minute);
          const taker=weightedPerformancePick(active.filter(p=>p.role==='A'||p.role==='C'),day,`${prefix}|pentaker`,'goal') || weightedPerformancePick(active,day,`${prefix}|pentaker2`,'goal');
          if(taker){
            const keeper=activePerformances(opp,minute).find(p=>p.role==='P') || opp.find(p=>p.role==='P'&&p.entryMinute<=minute);
            const takerOvr=currentPlayerOvr(playerMap.get(String(taker.playerId)));
            const keeperOvr=keeper?currentPlayerOvr(playerMap.get(String(keeper.playerId))):72;
            const penaltyConversion=clamp(.76+(takerOvr-keeperOvr)*.003,.64,.86);
            if(seededSerieRand(day,`${prefix}|penoutcome`)<penaltyConversion) {
              events.push({minute,type:'penalty_goal',side:team,playerId:taker.playerId,playerName:taker.name,assistId:null,assistName:null,keeperId:keeper?.playerId||null});
            } else {
              const saved=!!keeper && seededSerieRand(day,`${prefix}|pensaved`)<clamp(.68+(keeperOvr-takerOvr)*.004,.48,.82);
              events.push({minute,type:'penalty_miss',side:team,playerId:taker.playerId,playerName:taker.name,keeperId:saved?keeper.playerId:null,keeperName:saved?keeper.name:null});
            }
          }
        } else if(seededSerieRand(day,`${prefix}|goal`)<goalP) addGoal(minute,team,false);

        if(seededSerieRand(day,`${prefix}|yellow`)<.021){
          const active=activePerformances(own,minute);
          const booked=weightedPerformancePick(active,day,`${prefix}|yellowwho`,'card');
          if(booked){
            const yc=(yellowCount.get(booked.playerId)||0)+1; yellowCount.set(booked.playerId,yc);
            if(yc>=2 && !redSeen.has(booked.playerId)){
              redSeen.add(booked.playerId);
              booked.plannedExitMinute=Math.min(booked.plannedExitMinute||90,minute);
              cancelFutureSubFor(team,booked.playerId);
              events.push({minute,type:'red',side:team,playerId:booked.playerId,playerName:booked.name,secondYellow:true});
            } else events.push({minute,type:'yellow',side:team,playerId:booked.playerId,playerName:booked.name});
          }
        }
        if(seededSerieRand(day,`${prefix}|red`)<.00048){
          const active=activePerformances(own,minute).filter(p=>!redSeen.has(p.playerId));
          const sent=weightedPerformancePick(active,day,`${prefix}|redwho`,'card');
          if(sent){
            redSeen.add(sent.playerId);
            sent.plannedExitMinute=Math.min(sent.plannedExitMinute||90,minute);
            cancelFutureSubFor(team,sent.playerId);
            events.push({minute,type:'red',side:team,playerId:sent.playerId,playerName:sent.name,secondYellow:false});
          }
        }
        const forcedRisk=minute===riskMinute?activePerformances(own,minute).find(p=>p.playerId===riskTarget?.playerId):null;
        if(forcedRisk || seededSerieRand(day,`${prefix}|injury`)<.00135){
          const active=activePerformances(own,minute).filter(p=>!injurySeen.has(p.playerId) && p.playerId!==riskTarget?.playerId);
          const hurt=forcedRisk || weightedPerformancePick(active,day,`${prefix}|injurywho`,'card');
          if(hurt){
            injurySeen.add(hurt.playerId);
            hurt.plannedExitMinute=Math.min(hurt.plannedExitMinute||90,minute);
            emergencyReplace(team,hurt,minute);
            events.push({minute,type:'injury',side:team,playerId:hurt.playerId,playerName:hurt.name});
          }
        }
      }
    }

    const birthday=activeFormationChoice(day)?.effect;
    if(birthday?.kind==='birthday'){
      const celebrant=perfMap.get(String(birthday.targetPlayerId));
      const side=celebrant?.club===spec.homeClub?'home':celebrant?.club===spec.awayClub?'away':null;
      if(side){
        const first=Math.max(15,Number(celebrant.entryMinute||999));
        const last=Math.min(85,Number(celebrant.plannedExitMinute||90));
        if(first<=last){
          const minute=first+Math.floor(seededSerieRand(day,`birthday-minute|${celebrant.playerId}`)*(last-first+1));
          const ownGoal=seededSerieRand(day,`birthday-outcome|${celebrant.playerId}`)<.5;
          const opposition=side==='home'?awayPerfs:homePerfs;
          const keeper=activePerformances(opposition,minute).find(p=>p.role==='P');
          events.push({minute,type:ownGoal?'own_goal':'goal',side,playerId:celebrant.playerId,
            playerName:celebrant.name,keeperId:ownGoal?null:keeper?.playerId||null,birthday:true});
        }
      }
    }

    // Gli eventi cambio vengono aggiunti dopo aver gestito eventuali rossi/infortuni,
    // così non rientra un giocatore al posto di un espulso.
    for(const side of ['home','away']){
      subPlans[side].filter(s=>!s.cancelled && s.minute<=90).forEach(s=>{
        const outPerf=perfMap.get(String(s.outPlayerId)), inPerf=perfMap.get(String(s.inPlayerId));
        if(outPerf) outPerf.plannedExitMinute=Math.min(outPerf.plannedExitMinute||90,s.minute-1);
        if(inPerf) inPerf.entryMinute=s.minute;
        events.push({
          minute:s.minute,type:'substitution',side,
          playerId:s.inPlayerId,playerName:s.inPlayerName,
          inPlayerId:s.inPlayerId,inPlayerName:s.inPlayerName,
          outPlayerId:s.outPlayerId,outPlayerName:s.outPlayerName,
          reason:s.reason
        });
      });
    }

    const goals=events.filter(e=>e.type==='goal'||e.type==='penalty_goal'||e.type==='own_goal');
    const homeGoals=goals.filter(e=>(e.type==='own_goal'?e.side!=='home':e.side==='home')),
      awayGoals=goals.filter(e=>(e.type==='own_goal'?e.side!=='away':e.side==='away'));
    if(homeGoals.length>awayGoals.length) homeGoals[awayGoals.length].decisiveGoal=true;
    if(awayGoals.length>homeGoals.length) awayGoals[homeGoals.length].decisiveGoal=true;
    events.sort((a,b)=>a.minute-b.minute || (a.type==='substitution'?1:0) - (b.type==='substitution'?1:0) || String(a.type).localeCompare(String(b.type)));
    return {
      index:idx,homeClub:spec.homeClub,awayClub:spec.awayClub,
      homeFormation:homeSel.formation,awayFormation:awaySel.formation,
      homeScore:0,awayScore:0,homePerfs,awayPerfs,perfMap,events,scorers:[],
      substitutions:subPlans
    };
  }


  function serieAClubStrength(clubId,day){
    const selection=buildSerieAClubSelection(clubId,day);
    const starters=selection?.starters||[];
    if(!starters.length) return 0;
    return matchStrength(starters);
  }

  function selectSerieABigMatch(matches,day){
    let bestIndex=0, bestScore=-Infinity;
    matches.forEach((m,index)=>{
      const home=serieAClubStrength(m.homeClub,day);
      const away=serieAClubStrength(m.awayClub,day);
      // Premia soprattutto due rose forti; un piccolo bonus va agli scontri equilibrati.
      const combined=home+away;
      const balance=Math.max(0,6-Math.abs(home-away))*.18;
      const score=combined+balance;
      if(score>bestScore){bestScore=score;bestIndex=index;}
    });
    return bestIndex;
  }

  function buildSerieADay(day){
    const season=ensureSeasonState();
    const round=season?.serieASchedule?.[day-1];
    if(!round) return null;
    const matches=round.matches.map((m,i)=>buildSerieAMatch(day,i,m));
    const bigMatchIndex=selectSerieABigMatch(matches,day);
    const perfMap=new Map();
    const events=[];
    matches.forEach(match=>{
      match.perfMap.forEach((v,k)=>perfMap.set(k,v));
      match.events.forEach(e=>events.push({...e,matchIndex:match.index,homeClub:match.homeClub,awayClub:match.awayClub}));
    });
    events.sort((a,b)=>a.minute-b.minute || a.matchIndex-b.matchIndex);
    const mainEvents=events.filter(e=>e.matchIndex!==bigMatchIndex);
    const bigMatchEvents=events.filter(e=>e.matchIndex===bigMatchIndex);
    return {day,matches,perfMap,events,mainEvents,bigMatchEvents,bigMatchIndex};
  }

  function playedMinutes(perf,minute=90){
    if(!perf || perf.entryMinute>minute) return 0;
    const exit=Math.min(minute,Number(perf.plannedExitMinute||90));
    return Math.max(0,exit-Number(perf.entryMinute||1)+1);
  }

  function decisivePerformance(perf){
    return !!(perf && (perf.goals||perf.assists||perf.red||perf.ownGoal||perf.missedPenalty||perf.savedPenalty));
  }

  function finalizeSerieAMatchRatings(match){
    if(!match || match.ratingsFinalized) return;
    const applySide=(perfs,goalsFor,goalsAgainst)=>{
      const resultMod=goalsFor>goalsAgainst?.12:goalsFor<goalsAgainst?-.12:.02;
      perfs.forEach(perf=>{
        const mins=playedMinutes(perf,90);
        if(!mins) return;
        let mod=resultMod*(mins/90);
        if((perf.role==='P'||perf.role==='D') && goalsAgainst===0 && mins>=60) mod+=perf.role==='P'?.28:.16;
        if((perf.role==='P'||perf.role==='D') && goalsAgainst>=3 && mins>=45) mod-=.16;
        if((perf.role==='C'||perf.role==='A') && goalsFor>=3 && mins>=45) mod+=.07;
        if(perf.injury && Number(perf.injuryMinute||90)<30 && !decisivePerformance(perf)) mod-=.10;
        perf.liveVote=clamp(perf.liveVote+mod,4,9);
        perf.ratingsFinalized=true;
      });
    };
    applySide(match.homePerfs,match.homeScore,match.awayScore);
    applySide(match.awayPerfs,match.awayScore,match.homeScore);
    match.ratingsFinalized=true;
    const decisive=match.events.find(e=>e.decisiveGoal);
    if(decisive){
      const scorer=match.perfMap.get(String(decisive.playerId));
      if(scorer) scorer.decisiveGoals=1;
    }
  }

  function finalizeSerieAPhaseRatings(){
    if(!serieALive) return;
    if(serieALive.phase==='multilive'){
      serieALive.matches.forEach((m,i)=>{if(i!==serieALive.bigMatchIndex) finalizeSerieAMatchRatings(m);});
    }else if(serieALive.phase==='bigmatch'){
      finalizeSerieAMatchRatings(serieABigMatch());
    }
  }

  function liveFantasyValue(perf,minute=90){
    if(!perf || perf.entryMinute>minute) return 0;
    const rules=fantasyRuleForDay(perf.day||state?.season?.currentMatchday||1);
    const mins=playedMinutes(perf,minute);
    // V3.2.35.56.56: qualsiasi calciatore che chiude SV è sostituibile nel fantacalcio,
    // anche se era titolare reale. Gli eventi decisivi continuano a garantire il voto.
    if(minute>=90 && mins<rules.minVoteMinutes && !decisivePerformance(perf)) return 0;
    const choice=activeFormationChoice(perf.day||state?.season?.currentMatchday||1);
    const doubleEvents=choice?.effect?.kind==='risk_double_events' &&
      String(choice.effect.targetPlayerId||'')===String(perf.playerId);

    const eventFactor=doubleEvents?2:1;

    return halfPoint(
      perf.liveVote +
      perf.goals*rules.goalBonus*eventFactor +
      (rules.cesarini?Number(perf.lateGoals||0)*eventFactor:0) +
      (rules.decisiveGoalBonus?Number(perf.decisiveGoals||0):0) +
      perf.assists*rules.assistBonus*eventFactor -
      perf.yellow*rules.yellowMalus*eventFactor -
      perf.red*(perf.secondYellow?0:rules.redMalus)*eventFactor -
      perf.ownGoal*rules.ownGoalMalus*eventFactor -
      perf.missedPenalty*rules.missedPenaltyMalus*eventFactor +
      perf.savedPenalty*rules.savedPenaltyBonus*eventFactor -
      perf.goalsConceded*rules.goalConcededMalus*eventFactor +
      ((minute>=90 && perf.role==='P' && Number(perf.goalsConceded||0)===0)?rules.cleanSheetBonus:0)
    );
  }

  function perfEventText(perf){
    if(!perf) return '—';
    const bits=[];
    if(perf.goals) bits.push(`⚽ ${perf.goals}`);
    if(perf.cesariniBonus) bits.push(`⏱ +${perf.cesariniBonus}`);
    if(perf.goldenBenchBonus) bits.push('🪑 +1');
    if(perf.underdogBonus) bits.push('🌟 +0,5');
    if(perf.assists) bits.push(`👟 ${perf.assists}`);
    if(perf.yellow) bits.push(perf.yellow>1?`🟨 ${perf.yellow}`:'🟨');
    if(perf.red) bits.push('🟥');
    if(perf.ownGoal) bits.push(`↩ ${perf.ownGoal}`);
    if(perf.missedPenalty) bits.push('RIG-');
    if(perf.savedPenalty) bits.push('RIG+');
    if(perf.injury) bits.push('INF');
    if(perf.goalsConceded && perf.role==='P') bits.push(`${perf.goalsConceded}GS`);
    if(Number(perf.socialMotivationDelta||0)>0) bits.push('💬 MOT+');
    if(Number(perf.socialMotivationDelta||0)<0) bits.push('💬 MOT-');
    return bits.length?bits.join(' · '):'—';
  }

  function liveEventBadgesMarkup(perf, emptyText='—'){
    if(!perf) return `<span class="live-event-empty">${escapeHtml(emptyText)}</span>`;
    const chips=[];
    const addChip=(type,icon,count,title,polarity='neutral')=>{
      const qty=Number(count||0);
      if(!qty && qty!==0) return;
      if(qty<=0 && !['injury','mot-plus','mot-minus'].includes(type)) return;
      const countMarkup=(qty>1 || ['conceded','yellow','own-goal','pen-miss','pen-save'].includes(type))
        ? `<span class="chip-count">${qty}</span>`
        : '';
      chips.push(`<span class="live-event-chip type-${type} polarity-${polarity}" title="${escapeHtml(title)}">`+
        `<span class="chip-icon">${icon}</span>${countMarkup}</span>`);
    };

    addChip('goal','⚽',perf.goals,`Gol x${Number(perf.goals||0)}`,'positive');
    addChip('starting-vote','🩹',perf.startingVoteBonus,'Oltre il limite: voto base +1','positive');
    addChip('cesarini','⏱️',perf.cesariniBonus,'Zona Cesarini +1 per gol dall’85°','positive');
    addChip('golden-bench','🪑',perf.goldenBenchBonus,'Panchina d’oro +1','positive');
    if(perf.underdogBonus) addChip('underdog','🌟',1,'Underdog +0,5','positive');
    addChip('assist','👟',perf.assists,`Assist x${Number(perf.assists||0)}`,'positive');
    addChip('yellow','🟨',perf.yellow,`Ammonizione x${Number(perf.yellow||0)}`,'negative');
    addChip('red','🟥',perf.red,perf.secondYellow?'Espulsione per doppia ammonizione':'Espulsione diretta','negative');
    addChip('own-goal','↩',perf.ownGoal,`Autogol x${Number(perf.ownGoal||0)}`,'negative');
    addChip('pen-miss','❌',perf.missedPenalty,`Rigore sbagliato x${Number(perf.missedPenalty||0)}`,'negative');
    addChip('pen-save','🧤',perf.savedPenalty,`Rigore parato x${Number(perf.savedPenalty||0)}`,'positive');
    if(Number(perf.decisiveGoalBonus||0)>0) addChip('decisive-goal','🏆',1,'Gol decisivo +1','positive');
    if(Number(perf.captainBonus||0)>0) addChip('captain','©️',1,`Capitano +${perf.captainBonus}`,'positive');
    if(Number(perf.cleanSheetBonus||0)>0) addChip('clean-sheet','🧱',1,`Porta inviolata +${Number(perf.cleanSheetBonus)}`,'positive');
    addChip('conceded','🥅',perf.goalsConceded,`Gol subiti x${Number(perf.goalsConceded||0)}`,'negative');
    if(perf.injury) addChip('injury','🤕',1,'Infortunio','negative');
    if(Number(perf.socialMotivationDelta||0)>0) addChip('mot-plus','💬+',1,'Motivazione extra','positive');
    if(Number(perf.socialMotivationDelta||0)<0) addChip('mot-minus','💬−',1,'Pressione social','negative');
    if(Number(perf.riskDelta||0)>0) addChip('risk-plus','🎲+',1,'Bonus rischio','positive');
    if(Number(perf.riskDelta||0)<0) addChip('risk-minus','🎲−',1,'Malus rischio','negative');

    return chips.length ? chips.join('') : `<span class="live-event-empty">${escapeHtml(emptyText)}</span>`;
  }

  function performanceText(p) {
    if(!p || p.noVote || p.vote===null) return 'SV';
    const day=p.day||state?.season?.lastCompletedMatchday||state?.season?.currentMatchday||1;
    const rules={...fantasyRuleForDay(day)};
    if(formationPlayerModifier(day,p.playerId,'risk_double_events')) {
      ['goalBonus','assistBonus','yellowMalus','redMalus','ownGoalMalus','missedPenaltyMalus','savedPenaltyBonus','goalConcededMalus']
        .forEach(key=>{rules[key]*=2;});
    }
    const fmt=n=>Number(n).toLocaleString('it-IT',{maximumFractionDigits:1});
    const bits=[];
    if(p.goals) bits.push(`⚽ ${p.goals} +${fmt(p.goals*rules.goalBonus)}`);
    if(p.assists) bits.push(`👟 ${p.assists} +${fmt(p.assists*rules.assistBonus)}`);
    if(p.yellow) bits.push(`🟨 ${p.yellow>1?p.yellow+' ':''}-${fmt(p.yellow*rules.yellowMalus)}`);
    if(p.red) bits.push(p.secondYellow?'🟥 doppio giallo':`🟥 -${fmt(p.red*rules.redMalus)}`);
    if(p.ownGoal) bits.push(`↩ ${p.ownGoal>1?p.ownGoal+' ':''}-${fmt(p.ownGoal*rules.ownGoalMalus)}`);
    if(p.missedPenalty) bits.push(`❌ ${p.missedPenalty>1?p.missedPenalty+' ':''}-${fmt(p.missedPenalty*rules.missedPenaltyMalus)}`);
    if(p.savedPenalty) bits.push(`🧤 ${p.savedPenalty>1?p.savedPenalty+' ':''}+${fmt(p.savedPenalty*rules.savedPenaltyBonus)}`);
    if(Number(p.decisiveGoalBonus||0)>0) bits.push('🏆 GOL DECISIVO +1');
    if(Number(p.captainBonus||0)>0) bits.push(`©️ CAPITANO +${p.captainBonus}`);
    if(Number(p.cleanSheetBonus||0)>0) bits.push(`🧱 +${fmt(p.cleanSheetBonus)}`);
    if(p.goalsConceded) bits.push(`🥅 ${p.goalsConceded} -${fmt(p.goalsConceded*rules.goalConcededMalus)}`);
    if(p.injury) bits.push('🤕');
    if(Number(p.riskDelta||0)!==0) bits.push(`🎲 ${Number(p.riskDelta)>0?'+':''}${Number(p.riskDelta).toLocaleString('it-IT',{maximumFractionDigits:1})}`);
    if(Number(p.socialMotivationDelta||0)>0) bits.push('💬 MOTIVATO');
    if(Number(p.socialMotivationDelta||0)<0) bits.push('💬 PRESSIONE');
    return bits.length ? bits.join(' · ') : '—';
  }

  function fantasyGoals(points,day=state?.season?.currentMatchday||1) {
    const p = Number(points||0);
    const rules=fantasyRuleForDay(day);
    const threshold=Number(rules.firstGoalThreshold||66);
    if (p < threshold) return 0;
    const step=rules.goalStep;
    return Math.max(1, 1 + Math.floor((p - threshold) / step));
  }

  function lineupPlayersForManager(manager, savedLineup) {
    const ids = Object.values(savedLineup?.starters || {}).map(String);
    return ids.map(id => (manager.roster||[]).find(p=>String(p.id)===id)).filter(Boolean);
  }

  function currentFantasyPerformance(player,perfMap,minute=90){
    const perf=perfMap.get(String(player.id));
    if(!perf || perf.entryMinute>minute){
      return {day:state?.season?.currentMatchday||1,playerId:String(player.id),name:player.name,role:player.role,club:player.club,vote:null,fantasy:0,noVote:true,minutes:0,goals:0,assists:0,yellow:0,red:0,ownGoal:0,missedPenalty:0,savedPenalty:0,goalsConceded:0,injury:false};
    }
    const minutes=playedMinutes(perf,minute);
    const rules=fantasyRuleForDay(perf.day||state?.season?.currentMatchday||1);
    const noVote=minute>=90 && minutes<rules.minVoteMinutes && !decisivePerformance(perf);
    const cleanSheetBonus=(!noVote && minute>=90 && perf.role==='P' && Number(perf.goalsConceded||0)===0)
      ? Number(rules.cleanSheetBonus||0)
      : 0;
    return {
      ...perf,
      vote:noVote?null:halfPoint(perf.liveVote),
      fantasy:noVote?0:liveFantasyValue(perf,minute),
      cleanSheetBonus,
      cesariniBonus:!noVote && rules.cesarini?Number(perf.lateGoals||0):0,
      decisiveGoalBonus:!noVote && rules.decisiveGoalBonus?Number(perf.decisiveGoals||0):0,
      noVote,
      minutes
    };
  }

  function lineupBenchPlayers(manager,savedLineup){
    const starterIds=new Set(Object.values(savedLineup?.starters||{}).map(String));
    const ordered=(savedLineup?.bench||[]).map(String);
    const seen=new Set();
    const result=[];
    ordered.forEach(id=>{
      if(seen.has(id)||starterIds.has(id)) return;
      const p=(manager.roster||[]).find(x=>String(x.id)===id);
      if(p){seen.add(id);result.push(p);}
    });
    (manager.roster||[]).forEach(p=>{
      const id=String(p.id);
      if(!starterIds.has(id)&&!seen.has(id)){seen.add(id);result.push(p);}
    });
    const blocked=String(adminBlockedStarterForManager(manager.id)||'');
    const index=result.findIndex(p=>String(p.id)===blocked);
    if(index>=0) result.push(...result.splice(index,1));
    return result;
  }

  function classicDefenseModifierResult(performances,formation,day,minute=90){
    const rules=fantasyRuleForDay(day);
    if(rules.defenseModifier!=='classic' || minute<90) return {bonus:0,average:null,active:false};
    const defenderSlots=lineupSlots(formation||'4-3-3').filter(slot=>slot.role==='D').length;
    if(defenderSlots<4) return {bonus:0,average:null,active:false};
    const valid=(performances||[]).filter(p=>!p?.noVote && p?.vote!==null && p?.vote!==undefined);
    const keeper=valid.find(p=>p.role==='P');
    const defenders=valid.filter(p=>p.role==='D').sort((a,b)=>Number(b.vote||0)-Number(a.vote||0));
    if(!keeper || defenders.length<3) return {bonus:0,average:null,active:false};
    const selected=[keeper,...defenders.slice(0,3)];
    const average=selected.reduce((sum,p)=>sum+Number(p.vote||0),0)/4;
    const bonus=average>=7?6:average>=6.5?3:average>=6?1:0;
    return {bonus,average,active:true};
  }

  function applyAdminTeamScoring(performances,substitutions,manager,day){
    const rule=activeAdminRuleEffect(day)?.ruleId;
    if(rule==='golden_bench'){
      const first=performances.find(p=>p.lineupSource==='substitute' && String(p.playerId)===String(substitutions[0]?.inPlayerId||''));
      if(first && !first.noVote && Number(first.goals)>0){first.goldenBenchBonus=1;first.fantasy=halfPoint(Number(first.fantasy||0)+1);if(substitutions[0])substitutions[0].fantasy=first.fantasy;}
    }
    if(rule==='underdog')for(const perf of performances){
      const player=(manager.roster||[]).find(p=>String(p.id)===String(perf.playerId));
      if(player && perf.lineupSource==='starter' && !perf.noVote && perf.vote!=null && currentPlayerOvr(player)<75){perf.underdogBonus=.5;perf.fantasy=halfPoint(Number(perf.fantasy||0)+.5);}
    }
  }

  function simulateFantasyTeamFromSerieA(manager,savedLineup,perfMap,minute=90){
    const formation=savedLineup?.formation||'4-3-3';
    const slotDefs=lineupSlots(formation);
    const roster=manager.roster||[];
    const bench=lineupBenchPlayers(manager,savedLineup);
    const usedBench=new Set();
    const substitutions=[];
    let subsUsed=0;
    let wildcardUsed=false;
    const day=state?.season?.currentMatchday||1;
    const tactic=tacticForManager(day,manager.id);

    const performances=slotDefs.map(slot=>{
      const starterId=String(savedLineup?.starters?.[slot.instanceId]||'');
      const starter=roster.find(p=>String(p.id)===starterId);
      if(!starter) return null;
      const original=currentFantasyPerformance(starter,perfMap,minute);
      if(!original.noVote || minute<90) return {...original,slotId:slot.instanceId,lineupSource:'starter'};

      let maxSubs=fantasyRuleForDay(original.day||day).maxFantasySubs;
      if(tactic==='extra_subs') maxSubs=7;
      if(subsUsed>=maxSubs) return {...original,slotId:slot.instanceId,lineupSource:'starter'};

      const validBench=bench.filter(p=>{
        const id=String(p.id);
        if(usedBench.has(id)) return false;
        const perf=currentFantasyPerformance(p,perfMap,minute);
        return !perf.noVote;
      });

      let compatible=validBench.filter(p=>p.role===slot.role);

      if(tactic==='best_bench'){
        compatible=compatible.slice().sort((a,b)=>{
          const af=currentFantasyPerformance(a,perfMap,minute).fantasy||0;
          const bf=currentFantasyPerformance(b,perfMap,minute).fantasy||0;
          return bf-af;
        });
      }

      let replacement=compatible[0]||null;

      if(!replacement && tactic==='wildcard_sub' && !wildcardUsed){
        replacement=validBench.slice().sort((a,b)=>{
          const af=currentFantasyPerformance(a,perfMap,minute).fantasy||0;
          const bf=currentFantasyPerformance(b,perfMap,minute).fantasy||0;
          return bf-af;
        })[0]||null;
        if(replacement) wildcardUsed=true;
      }

      if(!replacement) return {...original,slotId:slot.instanceId,lineupSource:'starter'};

      const replacementPerf=currentFantasyPerformance(replacement,perfMap,minute);
      usedBench.add(String(replacement.id));
      subsUsed++;
      substitutions.push({
        slotId:slot.instanceId,role:slot.role,
        outPlayerId:String(starter.id),outPlayerName:starter.name,
        inPlayerId:String(replacement.id),inPlayerName:replacement.name,
        fantasy:replacementPerf.fantasy
      });
      return {
        ...replacementPerf,slotId:slot.instanceId,lineupSource:'substitute',
        replacedPlayerId:String(starter.id),replacedPlayerName:starter.name
      };
    }).filter(Boolean);

    applyAdminTeamScoring(performances,substitutions,manager,day);

    const captainId=String(savedLineup?.captainId || (manager.id!=='user' && leagueRulesFor(state).captainBonus!=='off'
      ? lineupPlayersForManager(manager,savedLineup).sort((a,b)=>cpuLeagueRuleLineupValue(manager,b,day)-cpuLeagueRuleLineupValue(manager,a,day))[0]?.id
      : '') || '');
    const captainRule=leagueRulesFor(state).captainBonus;
    if(captainRule!=='off' && captainId){
      const captain=performances.find(p=>p.lineupSource==='starter' && String(p.playerId)===captainId && !p.noVote);
      const threshold=captainRule==='eight'?8:7;
      if(captain && Number(captain.vote)>=threshold){
        captain.captainBonus=captainRule==='eight'?2:1;
        captain.fantasy=halfPoint(captain.fantasy+captain.captainBonus);
      }
    }

    // RISCHIO: l'effetto deve modificare il FV del singolo giocatore.
    // Prima il malus/bonus era visibile nella riga ma non entrava nel calcolo FV.
    if(manager.id==='user'){
      const chosen=activeFormationChoice(day);
      if(chosen?.category==='risk'){
        const target=performances.find(p=>String(p.playerId)===String(chosen.effect?.targetPlayerId||''));
        if(target){
          const riskDelta=riskAdjustmentForPerformance(target,day);
          target.riskDelta=riskDelta;
          target.fantasy=halfPoint(Number(target.fantasy||0)+Number(riskDelta||0));
        }
      }
    }

    let fantasyPoints=halfPoint(performances.reduce((s,p)=>s+Number(p.fantasy||0),0));
    const defenseModifier=classicDefenseModifierResult(performances,formation,day,minute);
    if(defenseModifier.bonus>0) fantasyPoints=halfPoint(fantasyPoints+defenseModifier.bonus);

    return {
      managerId:manager.id,team:manager.team,fantasyPoints,fantasyGoals:fantasyGoals(fantasyPoints,day),
      performances,substitutions,subsUsed,unresolvedSV:performances.filter(p=>p.noVote).length,
      defenseModifierBonus:defenseModifier.bonus,defenseModifierAverage:defenseModifier.average
    };
  }

  function updateStandingsFromMatch(match) {
    const season=ensureSeasonState(); if(!season) return;
    applyFantasyMatch(season.standings,match);
  }

  function ensureCpuLineupsForDay(day) {
    const season=ensureSeasonState(); if(!season) return null;
    if(!season.lineups[String(day)]) season.lineups[String(day)]={};
    const store=season.lineups[String(day)];
    const forced=forcedFormationRuleForDay(day);
    const opponentId=userOpponentIdForDay(day);
    const blockedId=blockedOpponentPlayerId(day);
    state.managers.filter(m=>m.id!=='user').forEach(m=>{
      const mustMirrorForced=!!forced && (forced==='5-5-5' || String(m.id)===String(opponentId)) && String(store[m.id]?.formation||'')!==forced;
      const forcedStarterId=adminForcedStarterForManager(m.id,day);
      const adminBlockedStarterId=adminBlockedStarterForManager(m.id,day);
      const cpuStarterIds=Object.values(store[m.id]?.starters||{}).map(String);
      const hasForcedStarter=!forcedStarterId || cpuStarterIds.includes(String(forcedStarterId));
      const hasAdminBlockedStarter=!!adminBlockedStarterId && cpuStarterIds.includes(String(adminBlockedStarterId));
      const hasBlockedPlayer=!!blockedId && String(m.id)===String(opponentId) && (cpuStarterIds.includes(String(blockedId)) || (store[m.id]?.bench||[]).map(String).includes(String(blockedId)));
      if(!store[m.id]?.confirmed || !allowedLineupFormation(store[m.id]?.formation) || mustMirrorForced || !hasForcedStarter || hasAdminBlockedStarter || hasBlockedPlayer){
        store[m.id]=buildAutoLineup(m,cpuFormationForDay(m,day));
        if(forcedStarterId && String(forcedStarterId)!==String(blockedId||'')) enforceStarterInLineup(m,store[m.id],forcedStarterId);
        if(adminBlockedStarterId) enforcePlayerBenchedInLineup(m,store[m.id],adminBlockedStarterId,day);
        enforceOpponentConsumableBlock(m,store[m.id],day);
      }
    });
    return store;
  }

  const SERIEA_LIVE_SPEEDS={0.5:0.5,1:1,2:2,4:4};
  let serieAMatchesExpanded=true;

  function serieALiveTickBase(){
    return serieALive?.phase==='bigmatch'?520:460;
  }

  function serieALiveTickDelay(){
    const speed=Number(serieALive?.speed||1);
    return Math.max(120,Math.round(serieALiveTickBase()/speed));
  }

  function restartSerieALiveTimer(){
    if(!serieALive) return;
    if(serieALive.timer){clearInterval(serieALive.timer);serieALive.timer=null;}
    if(serieALive.manualPaused) return;
    serieALive.timer=window.setInterval(tickSerieALive,serieALiveTickDelay());
  }

  function setSerieALiveSpeed(value){
    if(!serieALive || serieALive.reviewComplete || serieALive.phase==='between') return;
    const speed=Number(value);
    if(!SERIEA_LIVE_SPEEDS[speed]) return;
    serieALive.speed=speed;
    serieALive.manualPaused=false;
    restartSerieALiveTimer();
    renderSerieALiveSpeedControls();
  }

  function toggleSerieALivePause(){
    if(!serieALive || serieALive.reviewComplete || serieALive.phase==='between') return;
    serieALive.manualPaused=!serieALive.manualPaused;
    if(serieALive.manualPaused){
      if(serieALive.timer){clearInterval(serieALive.timer);serieALive.timer=null;}
    }else restartSerieALiveTimer();
    renderSerieALiveSpeedControls();
  }

  function jumpToNextSerieAEvent(){
    if(!serieALive || serieALive.reviewComplete || serieALive.phase==='between') return;
    const events=serieALive.phaseEvents||[];
    const remaining=events.slice(serieALive.eventIndex);
    const target=remaining.find(event=>serieAEventTouchesFantasyMatch(event)) || remaining[0];
    if(!target){skipSerieALive();return;}
    if(serieALive.timer){clearInterval(serieALive.timer);serieALive.timer=null;}
    serieALive.manualPaused=false;
    serieALive.autoPauseUntil=0;
    serieALive.tvToken=(serieALive.tvToken||0)+1;
    hideSerieATvBanner();
    serieALive.minute=Math.max(serieALive.minute,Math.max(0,Number(target.minute||1)-1));
    tickSerieALive();
    if(serieALive && !serieALive.reviewComplete && serieALive.phase!=='between'){
      serieALive.manualPaused=true;
      if(serieALive.timer){clearInterval(serieALive.timer);serieALive.timer=null;}
      renderSerieALiveSpeedControls();
    }
  }

  function renderSerieALiveSpeedControls(){
    if(!serieALive) return;
    const controlsLocked=!!serieALive.reviewComplete || serieALive.phase==='between';
    document.querySelectorAll('[data-live-speed]').forEach(btn=>{
      btn.classList.toggle('active',!controlsLocked && !serieALive.manualPaused && Number(btn.dataset.liveSpeed)===Number(serieALive.speed||1));
      btn.disabled=controlsLocked;
    });
    const pause=$('serieAPauseBtn');
    if(pause){
      pause.classList.toggle('active',!!serieALive.manualPaused && !controlsLocked);
      pause.textContent=controlsLocked?'FT':(serieALive.manualPaused?'RIPRENDI':'PAUSA');
      pause.disabled=controlsLocked;
    }
  }

  function serieAEventFantasySide(event){
    const ctx=serieALiveFantasyContext();
    if(!ctx) return '';
    const ids=[event.playerId,event.assistId,event.keeperId,event.inPlayerId,event.outPlayerId].filter(v=>v!==null&&v!==undefined).map(String);
    const userIds=new Set((ctx.userAllPlayers||ctx.userPlayers).map(p=>String(p.id)));
    const oppIds=new Set((ctx.oppAllPlayers||ctx.oppPlayers).map(p=>String(p.id)));
    if(ids.some(id=>userIds.has(id))) return 'user';
    if(ids.some(id=>oppIds.has(id))) return 'opponent';
    return '';
  }

  function captureWatchedVoteSnapshot(){
    const ctx=serieALiveFantasyContext();
    const map=new Map();
    if(!ctx || !serieALive) return map;
    ctx.watchedIds.forEach(id=>{
      const perf=serieALive.perfMap.get(String(id));
      if(perf) map.set(String(id),halfPoint(perf.liveVote));
    });
    return map;
  }

  function updateWatchedVoteFlashes(before){
    if(!serieALive || !before) return;
    if(!(serieALive.voteFlashes instanceof Map)) serieALive.voteFlashes=new Map();
    const now=Date.now();
    before.forEach((oldVote,id)=>{
      const perf=serieALive.perfMap.get(String(id));
      if(!perf) return;
      const next=halfPoint(perf.liveVote);
      if(next!==oldVote){
        serieALive.voteFlashes.set(String(id),{
          from:oldVote,to:next,dir:next>oldVote?'up':'down',until:now+2200
        });
      }
    });
  }

  function tvEventClass(event){
    if(event.type==='own_goal') return 'red';
    if(event.type==='goal'||event.type==='penalty_goal') return 'goal';
    if(event.type==='penalty_miss') return 'penalty-miss';
    if(event.type==='red') return 'red';
    if(event.type==='injury') return 'injury';
    if(event.type==='substitution') return 'substitution';
    return 'generic';
  }

  function tvFinalTitle(event){
    if(event.type==='own_goal') return 'AUTOGOL!';
    if(event.type==='goal') return 'GOOOOL!';
    if(event.type==='penalty_goal') return 'RIGORE SEGNATO!';
    if(event.type==='penalty_miss') return 'RIGORE SBAGLIATO!';
    if(event.type==='red') return 'CARTELLINO ROSSO!';
    if(event.type==='injury') return 'INFORTUNIO';
    if(event.type==='substitution') return 'CAMBIO';
    return 'NOTIZIA DAL CAMPO';
  }

  function tvEventDetail(event){
    if(event.type==='own_goal') return `🎂 Compleanno amaro · punto per ${clubName(event.side==='home'?event.awayClub:event.homeClub)}`;
    const match=serieALive?.matches?.[event.matchIndex];
    const team=event.side==='home'?event.homeClub:event.awayClub;
    if(event.type==='goal'||event.type==='penalty_goal'){
      return `${clubName(team)} · ${match?`${match.homeScore} - ${match.awayScore}`:''}${event.assistName?` · Assist ${event.assistName}`:''}`;
    }
    if(event.type==='penalty_miss') return `${clubName(team)}${event.keeperName?` · Para ${event.keeperName}`:''}`;
    if(event.type==='red') return `${clubName(team)} · squadra in 10`;
    if(event.type==='injury') return `${clubName(team)} · possibile sostituzione`;
    if(event.type==='substitution') return `${clubName(team)} · ${event.outPlayerName} → ${event.inPlayerName}`;
    return clubName(team);
  }

  function tvFantasyFocus(event){
    const fallback={
      kind:'event',playerId:event.playerId,playerName:event.playerName,
      title:tvFinalTitle(event),confirmedTitle:'GOL CONFERMATO!',
      kicker:serieALive?.phase==='bigmatch'?'BIG MATCH':'DIRETTA GOL',detail:tvEventDetail(event)
    };
    const ctx=serieALiveFantasyContext();
    if(!ctx) return fallback;
    const userIds=new Set((ctx.userAllPlayers||ctx.userPlayers||[]).map(p=>String(p.id)));
    const oppIds=new Set((ctx.oppAllPlayers||ctx.oppPlayers||[]).map(p=>String(p.id)));
    const sideFor=id=>userIds.has(String(id))?'user':oppIds.has(String(id))?'opponent':'';
    if(event.type==='penalty_miss' && event.keeperId && sideFor(event.keeperId) && !sideFor(event.playerId)){
      const own=sideFor(event.keeperId)==='user';
      return {kind:'save',playerId:event.keeperId,playerName:playerMap.get(String(event.keeperId))?.name||event.keeperName||'Portiere',title:'RIGORE PARATO!',confirmedTitle:'RIGORE PARATO!',kicker:own?'⭐ TUO PORTIERE':'⚔ PORTIERE AVVERSARIO',detail:`${own?'Bonus per il tuo portiere':'Bonus avversario'}: +3 · Rigore di ${event.playerName}`};
    }
    const candidates=[];
    if(event.type==='goal'||event.type==='penalty_goal'){
      candidates.push({kind:'goal',id:event.playerId,name:event.playerName,side:sideFor(event.playerId),bonus:'+3'});
      if(event.assistId) candidates.push({kind:'assist',id:event.assistId,name:event.assistName,side:sideFor(event.assistId),bonus:'+1'});
      if(event.keeperId){
        const keeper=playerMap.get(String(event.keeperId));
        candidates.push({kind:'conceded',id:event.keeperId,name:keeper?.name||event.keeperName||'Portiere',side:sideFor(event.keeperId),bonus:'-1'});
      }
    }
    const chosen=candidates.find(item=>item.side==='user') || candidates.find(item=>item.side==='opponent');
    if(!chosen) return fallback;
    const owner=chosen.side==='user'?(ctx.user?.team||state.teamName||'La tua squadra'):(ctx.opp?.team||'Avversario');
    const own=chosen.side==='user';
    if(chosen.kind==='assist') return {
      kind:'assist',playerId:chosen.id,playerName:chosen.name,title:'ASSIST!',confirmedTitle:'ASSIST CONFERMATO!',
      kicker:own?'⭐ TUO ASSISTMAN':'⚔ ASSIST AVVERSARIO',
      detail:`${own?'Bonus per':'Bonus avversario'} ${owner}: ${chosen.bonus} · Gol di ${event.playerName}`
    };
    if(chosen.kind==='conceded') return {
      kind:'conceded',playerId:chosen.id,playerName:chosen.name,title:'GOL SUBITO · −1',confirmedTitle:'GOL SUBITO · −1',
      kicker:own?'⚠ TUO PORTIERE':'PORTIERE AVVERSARIO',
      detail:`${own?'Malus per':'Malus avversario'} ${owner}: ${chosen.bonus} · Gol di ${event.playerName}`
    };
    return {
      kind:'goal',playerId:chosen.id,playerName:chosen.name,title:tvFinalTitle(event),confirmedTitle:'GOL CONFERMATO!',
      kicker:own?'⭐ TUO MARCATORE':'⚔ MARCATORE AVVERSARIO',
      detail:`${own?'Bonus per':'Bonus avversario'} ${owner}: ${chosen.bonus}${event.assistName?` · Assist ${event.assistName}`:''}`
    };
  }

  // Decorative particles never change match timing, currency or input availability.
  function animateMatchParticles(container, source, destination=null){
    if(!container || !source || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || !source.animate) return;
    container.querySelectorAll('.match-pixel-particle').forEach(node=>node.remove());
    const bounds=container.getBoundingClientRect(), start=source.getBoundingClientRect();
    const end=destination?.getBoundingClientRect();
    const x=start.left+start.width/2-bounds.left, y=start.top+start.height/2-bounds.top;
    const count=window.matchMedia?.('(max-width: 780px)')?.matches?8:14;
    for(let i=0;i<count;i++){
      const particle=document.createElement('span');
      particle.className='match-pixel-particle'+(end?' is-football':'');
      particle.setAttribute('aria-hidden','true');
      particle.style.left=`${x}px`; particle.style.top=`${y}px`;
      if(end){
        particle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#fff" stroke="#172033" stroke-width="1.5"/><path d="M12 7 17 11 15 17H9L7 11Z M8 2 6 6 2 8 3 4Z M16 2 18 6 22 8 21 4Z M2 15 6 16 8 21 4 20Z M22 15 18 16 16 21 20 20Z" fill="#172033"/><path d="M12 7V1 M7 11 2 8 M17 11 22 8 M9 17 8 22 M15 17 16 22" fill="none" stroke="#172033" stroke-width="1"/></svg>';
      }else particle.style.background=['#ffd84d','#82f0ba','#ffffff'][i%3];
      container.appendChild(particle);
      const angle=i/count*Math.PI*2;
      const dx=end?end.left+end.width/2-bounds.left-x:Math.cos(angle)*(45+i%4*12);
      const dy=end?end.top+end.height/2-bounds.top-y:Math.sin(angle)*45-35;
      const animation=particle.animate([
        {transform:'translate(-50%, -50%) scale(.5) rotate(0deg)',opacity:0},
        {transform:`translate(calc(-50% + ${Math.cos(angle)*24}px), calc(-50% - 22px)) scale(1)`,opacity:1,offset:.25},
        {transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.3) rotate(${end?240:0}deg)`,opacity:0}
      ],{duration:end?680:800,delay:i*8,easing:'ease-out'});
      animation.finished.then(()=>particle.remove(),()=>particle.remove());
    }
  }

  function setSerieATvBanner({kicker,title,player,playerId,minute,detail,type='generic',focused=false,fantasySide='',focusKind=''}){
    const box=$('serieATvEvent');
    if(!box) return;
    if(type==='goal' && focusKind==='conceded') type='conceded';
    if(type==='goal' && focusKind==='assist') type='assist';
    if(type==='penalty-miss' && focusKind==='save') type='penalty-save';
    const relationClass=fantasySide==='user'?'side-user':(fantasySide==='opponent'?'side-opponent':'side-neutral');
    box.className=`seriea-tv-event show type-${type} ${focused?'is-focused':''} ${relationClass}`.trim();
    const celebrating=type==='goal' && fantasySide==='user' && focusKind==='goal';
    box.classList.toggle('is-goal-celebration',celebrating);
    box.querySelector('.tv-feedback-scene')?.remove();
    const feedback=type==='assist'&&fantasySide==='user'?'assist':type==='penalty'?'penalty':type==='penalty-miss'?'miss':type==='penalty-save'?'save':type==='injury'?'injury':type==='substitution'?'replacement':'';
    if(feedback){
      const scene=document.createElement('div');
      scene.className=`tv-feedback-scene feedback-${feedback}`;
      scene.setAttribute('aria-hidden','true');
      scene.innerHTML=feedback==='assist'?'<span class="tv-floating-bonus">+1</span>':feedback==='penalty'?'<span class="tv-penalty-spot"></span><span class="tv-penalty-ball">⚽</span>':feedback==='save'?'<span class="tv-floating-bonus">🧤 +3</span>':feedback==='miss'?'<span class="tv-penalty-ball">⚽</span><b>✕</b>':feedback==='injury'?'<span class="tv-injury-cross">✚</span>':'<span class="tv-replacement-arrow">↔</span>';
      box.querySelector('.seriea-tv-event-card')?.appendChild(scene);
    }
    box.style.setProperty('--goal-team-color',COACH_SHIRTS[normalizedCoachAvatar(state.coachAvatar).shirt]||'#5542a8');
    box.setAttribute('aria-hidden','false');
    const kickerNode=$('serieATvKicker');
    if(kickerNode){
      kickerNode.textContent=kicker||'DIRETTA GOL';
      kickerNode.dataset.side=fantasySide||'neutral';
    }
    $('serieATvTitle').textContent=celebrating?'GOOOL!':title||'EVENTO';
    $('serieATvPlayer').textContent=player||'—';
    $('serieATvDetail').textContent=detail||'';
    if($('serieATvMinute')) $('serieATvMinute').textContent=`${Number(minute ?? serieALive?.minute ?? 0)}'`;
    const avatarPlayer=playerMap.get(String(playerId||''));
    if($('serieATvAvatar')) $('serieATvAvatar').innerHTML=avatarPlayer?playerAvatarMarkup(avatarPlayer,avatarPlayer.name):'';
    if(celebrating){
      animateMatchParticles(box.querySelector('.seriea-tv-event-card'),$('serieATvAvatar'));
      if(!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) $('fantasyLiveScore')?.animate?.([{transform:'scale(1)'},{transform:'scale(1.12)',color:'#ffd84d'},{transform:'scale(1)'}],{duration:420,easing:'ease-out'});
    }
  }

  function hideSerieATvBanner(token){
    if(!serieALive || (token!==undefined && token!==serieALive.tvToken)) return;
    const box=$('serieATvEvent');
    if(box){
      box.classList.remove('show');
      box.setAttribute('aria-hidden','true');
    }
  }

  function triggerSerieATvPresentation(event){
    if(!serieALive) return false;

    // V2.7.2: la regia TV è filtrata esattamente come il feed.
    // Nessun banner o micro-pausa per eventi estranei alla sfida fantasy.
    const focused=serieAEventTouchesFantasyMatch(event);
    if(!focused) return false;

    const important=['goal','penalty_goal','own_goal','penalty_miss','red','injury'];
    if(!important.includes(event.type) && !(event.type==='substitution' && event.reason==='injury')) return false;

    const side=serieAEventFantasySide(event);
    const focus=tvFantasyFocus(event);
    const kicker=event.birthday?'🎂 COMPLEANNO':(event.type==='goal'||event.type==='penalty_goal')?focus.kicker:(side==='user'?'⭐ TUO GIOCATORE':side==='opponent'?'⚔ AVVERSARIO':serieALive.phase==='bigmatch'?'BIG MATCH':'DIRETTA GOL');
    const speed=Number(serieALive.speed||1);
    const token=(serieALive.tvToken||0)+1;
    serieALive.tvToken=token;

    const baseDuration=focused?1800:1250;
    const speedAdjustedDuration=Math.max(700,Math.round(baseDuration/(speed===2?1.35:speed===0.5?.88:1)));
    // V3.2.35.56.19: gli eventi che toccano la sfida fantasy restano visibili 2 secondi in più.
    // Il clock della Diretta Gol rimane fermo finché il banner è a schermo.
    const duration=speedAdjustedDuration+(focused?2000:0);
    serieALive.autoPauseUntil=Date.now()+duration;

    const isGoal=event.type==='goal'||event.type==='penalty_goal';
    const hasVar=isGoal && seededSerieRand(serieALive.day,`tv-var|${event.matchIndex}|${event.minute}|${event.playerId}`)<.18;
    const isPenalty=event.type==='penalty_goal'||event.type==='penalty_miss';

    if(event.type==='substitution'){
      setSerieATvBanner({kicker:'CAMBIO PER INFORTUNIO',title:'ENTRA IL SOSTITUTO',player:event.inPlayerName,playerId:event.inPlayerId,minute:event.minute,detail:`${event.outPlayerName} → ${event.inPlayerName}`,type:'substitution',focused,fantasySide:side});
    }else if(isPenalty){
      setSerieATvBanner({kicker,title:'RIGORE!',player:focus.playerName,playerId:focus.playerId,minute:event.minute,detail:clubName(event.side==='home'?event.homeClub:event.awayClub),type:'penalty',focused,fantasySide:side,focusKind:focus.kind});
      window.setTimeout(()=>{
        if(!serieALive || token!==serieALive.tvToken) return;
        setSerieATvBanner({kicker,title:focus.title,player:focus.playerName,playerId:focus.playerId,minute:event.minute,detail:focus.detail,type:tvEventClass(event),focused,fantasySide:side,focusKind:focus.kind});
      },Math.min(650,Math.round(duration*.38)));
    }else if(hasVar){
      setSerieATvBanner({kicker:'VAR CHECK',title:'CONTROLLO VAR...',player:focus.playerName,playerId:focus.playerId,minute:event.minute,detail:focus.kind==='assist'?`Verifica del gol di ${event.playerName}`:'Verifica del gol in corso',type:'var',focused,fantasySide:side,focusKind:focus.kind});
      window.setTimeout(()=>{
        if(!serieALive || token!==serieALive.tvToken) return;
        setSerieATvBanner({kicker,title:focus.confirmedTitle,player:focus.playerName,playerId:focus.playerId,minute:event.minute,detail:focus.detail,type:'goal',focused,fantasySide:side,focusKind:focus.kind});
      },Math.min(700,Math.round(duration*.42)));
    }else{
      setSerieATvBanner({kicker,title:(event.type==='goal'||event.type==='penalty_goal')?focus.title:tvFinalTitle(event),player:(event.type==='goal'||event.type==='penalty_goal')?focus.playerName:event.playerName,playerId:(event.type==='goal'||event.type==='penalty_goal')?focus.playerId:event.playerId,minute:event.minute,detail:(event.type==='goal'||event.type==='penalty_goal')?focus.detail:tvEventDetail(event),type:tvEventClass(event),focused,fantasySide:side,focusKind:focus.kind});
    }

    window.setTimeout(()=>hideSerieATvBanner(token),duration);
    return true;
  }

  function eventHeadline(event){
    const team=event.side==='home'?event.homeClub:event.awayClub;
    if(event.type==='goal') return `⚽ ${event.birthday?'🎂 COMPLEANNO · ':''}GOL ${clubName(team)} · ${event.playerName}${event.assistName?` · assist ${event.assistName}`:''}`;
    if(event.type==='own_goal') return `↩ 🎂 AUTOGOL ${event.playerName} · punto per ${clubName(event.side==='home'?event.awayClub:event.homeClub)}`;
    if(event.type==='penalty_goal') return `⚽ RIGORE SEGNATO ${clubName(team)} · ${event.playerName}`;
    if(event.type==='penalty_miss') return `❌ RIGORE SBAGLIATO ${clubName(team)} · ${event.playerName}${event.keeperName?` · para ${event.keeperName}`:''}`;
    if(event.type==='red') return `🟥 ROSSO ${clubName(team)} · ${event.playerName}`;
    if(event.type==='injury') return `✚ INFORTUNIO ${clubName(team)} · ${event.playerName}`;
    if(event.type==='yellow') return `🟨 AMMONITO ${clubName(team)} · ${event.playerName}`;
    if(event.type==='substitution') return `↔ CAMBIO ${clubName(team)} · ${event.outPlayerName} → ${event.inPlayerName}${event.reason==='injury'?' · per infortunio':''}`;
    return `${clubName(team)} · ${event.playerName}`;
  }

  function serieALiveFantasyContext(){
    if(!serieALive) return null;
    const fantasyRound=ensureSeasonState()?.schedule?.[serieALive.day-1];
    const fantasyMatch=fantasyRound?.matches?.find(m=>m.homeId==='user'||m.awayId==='user');
    if(!fantasyMatch) return null;
    const oppId=fantasyMatch.homeId==='user'?fantasyMatch.awayId:fantasyMatch.homeId;
    const user=managerById('user'), opp=managerById(oppId);
    const userLineup=serieALive.lineups?.user;
    const oppLineup=serieALive.lineups?.[oppId];
    const userPlayers=lineupPlayersForManager(user,userLineup);
    const oppPlayers=lineupPlayersForManager(opp,oppLineup);
    const userBench=lineupBenchPlayers(user,userLineup);
    const oppBench=lineupBenchPlayers(opp,oppLineup);
    const userAllPlayers=[...userPlayers,...userBench];
    const oppAllPlayers=[...oppPlayers,...oppBench];
    const watchedIds=new Set([...userAllPlayers,...oppAllPlayers].map(p=>String(p.id)));
    return {fantasyMatch,oppId,user,opp,userPlayers,oppPlayers,userBench,oppBench,userAllPlayers,oppAllPlayers,watchedIds};
  }

  function serieAEventTouchesFantasyMatch(event){
    const ctx=serieALiveFantasyContext();
    if(!ctx) return false;
    return [event.playerId,event.assistId,event.keeperId,event.inPlayerId,event.outPlayerId]
      .filter(v=>v!==null && v!==undefined)
      .some(id=>ctx.watchedIds.has(String(id)));
  }

  function fantasyFocusedEventHeadline(event){
    let text=eventHeadline(event);
    const ctx=serieALiveFantasyContext();
    if(!ctx) return text;
    if((event.type==='goal'||event.type==='penalty_goal') && event.keeperId && ctx.watchedIds.has(String(event.keeperId))){
      const keeper=serieALive?.perfMap?.get(String(event.keeperId));
      if(keeper && !text.includes(keeper.name)) text += ` · gol subito da ${keeper.name}`;
    }
    return text;
  }

  function applySerieAEvent(event){
    if(!serieALive) return;
    const watchedVoteBefore=captureWatchedVoteSnapshot();
    const match=serieALive.matches[event.matchIndex];
    const perf=serieALive.perfMap.get(String(event.playerId));
    if(!match || !perf) return;
    const ownPerfs=event.side==='home'?match.homePerfs:match.awayPerfs;
    const opponentPerfs=event.side==='home'?match.awayPerfs:match.homePerfs;
    const clampVote=p=>{if(p) p.liveVote=clamp(Number(p.liveVote||6),4,9);};

    if(event.type==='goal' || event.type==='penalty_goal'){
      if(event.side==='home') match.homeScore++; else match.awayScore++;
      match.scorers = Array.isArray(match.scorers) ? match.scorers : [];
      match.scorers.push({side:event.side,minute:event.minute,playerName:event.playerName,penalty:event.type==='penalty_goal'});
      perf.goals++;
      if(Number(event.minute)>=85) perf.lateGoals=Number(perf.lateGoals||0)+1;
      perf.liveVote+=event.type==='penalty_goal'?.68:.82;
      if(event.assistId){
        const a=serieALive.perfMap.get(String(event.assistId));
        if(a){a.assists++;a.liveVote+=.34;clampVote(a);}
      }
      activePerformances(ownPerfs,event.minute).forEach(p=>{if(p.playerId!==perf.playerId)p.liveVote+=.035;clampVote(p);});
      activePerformances(opponentPerfs,event.minute).forEach(p=>{p.liveVote-=.025;clampVote(p);});
      const keeper=event.keeperId?serieALive.perfMap.get(String(event.keeperId)):activePerformances(opponentPerfs,event.minute).find(p=>p.role==='P');
      if(keeper){keeper.goalsConceded++;keeper.liveVote-=.22;clampVote(keeper);}
    } else if(event.type==='own_goal'){
      if(event.side==='home')match.awayScore++;else match.homeScore++;
      match.scorers=Array.isArray(match.scorers)?match.scorers:[];
      match.scorers.push({side:event.side==='home'?'away':'home',minute:event.minute,playerName:event.playerName,ownGoal:true});
      perf.ownGoal++;perf.liveVote-=.55;
      const ownKeeper=activePerformances(ownPerfs,event.minute).find(p=>p.role==='P');
      if(ownKeeper){ownKeeper.goalsConceded++;ownKeeper.liveVote-=.22;clampVote(ownKeeper);}
    } else if(event.type==='penalty_miss'){
      perf.missedPenalty++; perf.liveVote-=1.0;
      if(event.keeperId){
        const k=serieALive.perfMap.get(String(event.keeperId));
        if(k){k.savedPenalty++;k.liveVote+=.9;clampVote(k);}
      }
    } else if(event.type==='yellow') { perf.yellow++; perf.liveVote-=.14; }
    else if(event.type==='red') {
      perf.red=1;
      if(event.secondYellow){perf.secondYellow=true;perf.yellow=Math.max(2,Number(perf.yellow||0)+1);}
      perf.liveVote-=1.05;
    }
    else if(event.type==='injury') {
      perf.injury=true; perf.injuryMinute=event.minute;
      if(event.minute<25 && !decisivePerformance(perf)) perf.liveVote-=.12;
    } else if(event.type==='substitution') {
      // Nessun bonus/malus: il cambio serve a rendere realistica la presenza in campo.
    }
    clampVote(perf);

    const fullItem={minute:event.minute,text:eventHeadline(event),type:event.type,playerId:event.playerId};
    serieALive.allFeed=Array.isArray(serieALive.allFeed)?serieALive.allFeed:[];
    serieALive.allFeed.unshift(fullItem);
    serieALive.allFeed=serieALive.allFeed.slice(0,180);
    if(serieAEventTouchesFantasyMatch(event)){
      serieALive.feed.unshift({minute:event.minute,text:fantasyFocusedEventHeadline(event),type:event.type,playerId:event.playerId});
      serieALive.feed=serieALive.feed.slice(0,90);
    }
    updateWatchedVoteFlashes(watchedVoteBefore);
  }


  function serieABigMatch(){
    return serieALive?.matches?.[serieALive.bigMatchIndex]||null;
  }

  function isBigMatchClub(clubId){
    const big=serieABigMatch();
    return !!big && (clubId===big.homeClub || clubId===big.awayClub);
  }

  function serieAMinuteForPlayer(player){
    if(!serieALive || !player) return 0;
    const bigClub=isBigMatchClub(player.club);
    if(serieALive.phase==='multilive') return bigClub?0:serieALive.minute;
    if(serieALive.phase==='between') return bigClub?0:90;
    if(serieALive.phase==='bigmatch') return bigClub?serieALive.minute:90;
    return serieALive.minute;
  }

  function serieALiveSnapshotForManager(managerId){
    const manager=managerById(managerId), lineup=serieALive?.lineups?.[managerId];
    if(!manager || !lineup || !serieALive) return {fantasyPoints:0,fantasyGoals:0,performances:[]};
    const players=lineupPlayersForManager(manager,lineup);
    const performances=players.map(player=>currentFantasyPerformance(player,serieALive.perfMap,serieAMinuteForPlayer(player)));
    if(managerId==='user') performances.forEach(perf=>{
      if(perf.noVote) return;
      const riskDelta=riskAdjustmentForPerformance(perf,serieALive.day);
      perf.riskDelta=riskDelta;
      perf.fantasy=halfPoint(perf.fantasy+riskDelta);
    });
    const captainId=String(lineup?.captainId || (manager.id!=='user' && leagueRulesFor(state).captainBonus!=='off'
      ? players.slice().sort((a,b)=>cpuLeagueRuleLineupValue(manager,b,serieALive.day)-cpuLeagueRuleLineupValue(manager,a,serieALive.day))[0]?.id
      : '') || '');
    const rule=leagueRulesFor(state).captainBonus;
    const captain=performances.find(p=>String(p.playerId)===captainId && !p.noVote);
    if(rule!=='off' && captain && Number(captain.vote)>=(rule==='eight'?8:7)){
      captain.captainBonus=rule==='eight'?2:1;
      captain.fantasy=halfPoint(captain.fantasy+captain.captainBonus);
    }
    const fantasyPoints=halfPoint(performances.reduce((s,p)=>s+Number(p.fantasy||0),0));
    return {managerId:manager.id,team:manager.team,fantasyPoints,fantasyGoals:fantasyGoals(fantasyPoints,serieALive?.day||state?.season?.currentMatchday||1),performances};
  }

  function startSerieABigMatchPhase(){
    startPendingBigMatchFromHub();
  }

  function snapshotSerieALive(live) {
    return window.FantaLiveState.snapshot(live);
  }

  function hydrateSerieALive(snapshot, phase=null) {
    return window.FantaLiveState.hydrate(snapshot,phase);
  }

  function finishSerieAMultiLivePhase(){
    if(!serieALive || serieALive.phase!=='multilive') return;
    if(serieALive.timer){clearInterval(serieALive.timer);serieALive.timer=null;}
    hideSerieATvBanner();
    const season=ensureSeasonState();
    if(!season) return;
    serieALive.phase='between';
    serieALive.minute=90;
    serieALive.manualPaused=true;
    serieALive.autoPauseUntil=0;

    const betweenSnapshot=snapshotSerieALive(serieALive);
    season.pendingBigMatch={
      day:serieALive.day,
      bigMatchIndex:serieALive.bigMatchIndex,
      snapshot:JSON.parse(JSON.stringify(betweenSnapshot))
    };
    // Conserviamo anche la schermata intermedia nel salvataggio:
    // se il browser viene chiuso qui, il Big Match riparte direttamente al resume.
    season.activeLive=JSON.parse(JSON.stringify(betweenSnapshot));
    saveState();

    showScreen('serieALiveScreen');
    renderSerieALive();
    showToast('Diretta Gol conclusa. Premi INIZIA BIG MATCH quando sei pronto.');
  }

  function fantasyLiveSnapshot(managerId){
    return serieALiveSnapshotForManager(managerId);
  }

  function setSerieAMatchesExpanded(expanded,{render=false}={}){
    serieAMatchesExpanded=true;
    const panel=$('serieAScoreboardPanel');
    if(panel){
      panel.classList.toggle('is-expanded',serieAMatchesExpanded);
      panel.classList.toggle('is-collapsed',!serieAMatchesExpanded);
    }
    if(render && serieALive) renderSerieALive();
  }

  function renderSerieALive(){
    if(!serieALive) return;
    renderSerieALiveSpeedControls();
    $('serieALiveDay').textContent=serieALive.day;

    const phase=serieALive.phase||'multilive';
    const big=serieABigMatch();
    const bigLabel=big?`${clubName(big.homeClub)} - ${clubName(big.awayClub)}`:'Big Match';
    const reviewComplete=!!serieALive.reviewComplete;
    const scoreboardPanel=$('serieAScoreboardPanel');
    if(scoreboardPanel){
      scoreboardPanel.classList.remove('is-collapsible');
      scoreboardPanel.classList.add('is-static');
    }
    setSerieAMatchesExpanded(true);

    if(reviewComplete){
      $('serieALiveMinute').textContent='FT';
      $('serieALiveClockLabel').textContent='FINALE';
      $('serieAPhaseBadge').textContent='GIORNATA CONCLUSA';
      $('serieALiveTitle').textContent='Diretta Gol conclusa';
      $('serieALiveSubtitle').textContent='Tutte le partite sono terminate. Puoi controllare risultati, fantapunti, voti ed eventi prima di proseguire.';
      $('serieAMatchesEyebrow').textContent='10 RISULTATI FINALI';
      $('serieAMatchesTitle').textContent='Risultati Serie A';
      $('skipSerieALiveBtn').disabled=false;
      $('skipSerieALiveBtn').textContent='VEDI RISULTATO';
    } else if(phase==='between'){
      $('serieALiveMinute').textContent='FT';
      $('serieALiveClockLabel').textContent='DIRETTA';
      $('serieAPhaseBadge').textContent='BIG MATCH';
      $('serieALiveTitle').textContent='Diretta Gol conclusa';
      $('serieALiveSubtitle').textContent=`Le altre 9 partite sono finite. Premi INIZIA BIG MATCH per giocare ${bigLabel}.`;
      $('serieAMatchesEyebrow').textContent='9 RISULTATI FINALI';
      $('serieAMatchesTitle').textContent='Diretta Gol conclusa';
      $('skipSerieALiveBtn').disabled=false;
      $('skipSerieALiveBtn').textContent='INIZIA BIG MATCH';
    } else if(phase==='bigmatch'){
      $('serieALiveMinute').textContent=`${serieALive.minute}'`;
      $('serieALiveClockLabel').textContent='MINUTO';
      $('serieAPhaseBadge').textContent='BIG MATCH';
      $('serieALiveTitle').textContent='Big Match';
      $('serieALiveSubtitle').textContent=`${bigLabel} · l'ultima partita della giornata si gioca da sola.`;
      $('serieAMatchesEyebrow').textContent='1 PARTITA LIVE';
      $('serieAMatchesTitle').textContent='Big Match';
      $('skipSerieALiveBtn').disabled=false;
      $('skipSerieALiveBtn').textContent='SALTA AL 90°';
    } else {
      $('serieALiveMinute').textContent=`${serieALive.minute}'`;
      $('serieALiveClockLabel').textContent='MINUTO';
      $('serieAPhaseBadge').textContent='DIRETTA GOL';
      $('serieALiveTitle').textContent='Diretta Gol';
      $('serieALiveSubtitle').textContent=`9 partite in contemporanea. ${bigLabel} è il Big Match e si giocherà per ultimo.`;
      $('serieAMatchesEyebrow').textContent='9 PARTITE LIVE';
      $('serieAMatchesTitle').textContent='Campi Serie A';
      $('skipSerieALiveBtn').disabled=false;
      $('skipSerieALiveBtn').textContent='SALTA AL 90°';
    }

    if($('nextSerieAEventBtn')){
      const noMoreEvents=serieALive.eventIndex>=(serieALive.phaseEvents||[]).length;
      $('nextSerieAEventBtn').disabled=reviewComplete || phase==='between' || noMoreEvents;
      $('nextSerieAEventBtn').textContent=noMoreEvents?'NESSUN ALTRO EVENTO':'PROSSIMO EVENTO';
    }

    if($('serieABigMatchTeaser')){
      if(reviewComplete){
        $('serieABigMatchTeaser').innerHTML='';
        $('serieABigMatchTeaser').classList.remove('is-live');
      } else if(phase==='multilive'){
        $('serieABigMatchTeaser').innerHTML=big?`<span>BIG MATCH · POSTICIPO</span><strong>${escapeHtml(clubName(big.homeClub))} vs ${escapeHtml(clubName(big.awayClub))}</strong><small>Si giocherà da solo al termine della Diretta Gol</small>`:'';
        $('serieABigMatchTeaser').classList.remove('is-live');
      } else if(phase==='between'){
        $('serieABigMatchTeaser').innerHTML=big?`<span>PROSSIMA</span><strong>${escapeHtml(clubName(big.homeClub))} vs ${escapeHtml(clubName(big.awayClub))}</strong><small>Premi il pulsante qui sotto quando sei pronto.</small>`:'';
        $('serieABigMatchTeaser').classList.remove('is-live');
      } else {
        $('serieABigMatchTeaser').innerHTML='';
        $('serieABigMatchTeaser').classList.add('is-live');
      }
    }

    const visibleMatches=reviewComplete?serieALive.matches:(phase==='bigmatch'?(big?[big]:[]):serieALive.matches.filter((_,i)=>i!==serieALive.bigMatchIndex));
    $('serieAMatchesGrid').classList.toggle('single-big-match',phase==='bigmatch' && !reviewComplete);
    $('serieAMatchesGrid').innerHTML=visibleMatches.map(m=>{
      const homeScorers=(m.scorers||[]).filter(s=>s.side==='home').map(s=>`${escapeHtml(s.playerName)} ${s.minute}'${s.penalty?' (R)':''}`).join('<br>');
      const awayScorers=(m.scorers||[]).filter(s=>s.side==='away').map(s=>`${escapeHtml(s.playerName)} ${s.minute}'${s.penalty?' (R)':''}`).join('<br>');
      return `<div class="seriea-live-match ${phase==='bigmatch'?'is-big-match':''}"><span>${escapeHtml(clubShort(m.homeClub))}</span><strong>${m.homeScore} - ${m.awayScore}</strong><span>${escapeHtml(clubShort(m.awayClub))}</span><small>${escapeHtml(clubName(m.homeClub))} · ${escapeHtml(clubName(m.awayClub))}</small><div class="seriea-match-scorers"><span>${homeScorers||'—'}</span><span>${awayScorers||'—'}</span></div></div>`;
    }).join('');

    const fantasyRound=ensureSeasonState()?.schedule?.[serieALive.day-1];
    const fantasyMatch=fantasyRound?.matches?.find(m=>m.homeId==='user'||m.awayId==='user');
    let us=null, them=null, liveOpponentName='Avversario';
    let finalUserPerformances=null, finalOpponentPerformances=null;
    if(fantasyMatch){
      const oppId=fantasyMatch.homeId==='user'?fantasyMatch.awayId:fantasyMatch.homeId;
      const completedDay=ensureSeasonState()?.matchdayResults?.[String(serieALive.day)];
      const completedMatch=completedDay?.matches?.find(m=>m.homeId==='user'||m.awayId==='user');
      if(reviewComplete && completedMatch){
        const userHome=completedMatch.homeId==='user';
        finalUserPerformances=userHome?completedMatch.homePerformances:completedMatch.awayPerformances;
        finalOpponentPerformances=userHome?completedMatch.awayPerformances:completedMatch.homePerformances;
        const userPoints=Number(userHome?completedMatch.homeFantasy:completedMatch.awayFantasy)||0;
        const opponentPoints=Number(userHome?completedMatch.awayFantasy:completedMatch.homeFantasy)||0;
        us={fantasyPoints:userPoints,fantasyGoals:Number(userHome?completedMatch.homeScore:completedMatch.awayScore)||0,performances:finalUserPerformances};
        them={fantasyPoints:opponentPoints,fantasyGoals:Number(userHome?completedMatch.awayScore:completedMatch.homeScore)||0,performances:finalOpponentPerformances};
      }else{
        us=fantasyLiveSnapshot('user');
        them=fantasyLiveSnapshot(oppId);
      }
      liveOpponentName=managerById(oppId)?.team||'Avversario';
      $('fantasyLiveUserTeam').textContent=state.teamName;
      $('fantasyLiveOppTeam').textContent=liveOpponentName;
      $('fantasyLiveUserPoints').textContent=us.fantasyPoints.toFixed(1);
      $('fantasyLiveOppPoints').textContent=them.fantasyPoints.toFixed(1);
      $('fantasyLiveScore').textContent=`${us.fantasyGoals} - ${them.fantasyGoals}`;
    }

    const latestFantasyEvent=(serieALive.feed||[]).find(item=>item.type!=='substitution') || (serieALive.allFeed||[]).find(item=>item.type!=='substitution') || null;
    const latestText=latestFantasyEvent?.text || (phase==='between' ? 'Le partite principali sono finite.' : phase==='bigmatch' ? 'Big Match in corso.' : "Calcio d'inizio, nessun evento rilevante ancora.");
    if($('serieALastEventTitle')) $('serieALastEventTitle').textContent = latestFantasyEvent ? `${latestFantasyEvent.minute}' · ${latestText}` : 'Nessun evento ancora';
    if($('serieALastEventDetail')) $('serieALastEventDetail').textContent = latestFantasyEvent ? 'Aggiornamento rapido sugli eventi che toccano la tua sfida fantasy.' : latestText;

    if($('serieALiveDuelTitle')){
      if(us && them){
        const delta = halfPoint(Number(us.fantasyPoints||0) - Number(them.fantasyPoints||0));
        const scoreText = `${state.teamName} ${us.fantasyGoals} - ${them.fantasyGoals} ${liveOpponentName}`;
        let duelTitle = 'Partita in equilibrio';
        let duelDetail = `${scoreText} · Fantapunti ${us.fantasyPoints.toFixed(1)} - ${them.fantasyPoints.toFixed(1)}`;
        if(delta > 0) duelTitle = `${state.teamName} avanti di ${delta.toFixed(1)} pt`;
        else if(delta < 0) duelTitle = `${liveOpponentName} avanti di ${Math.abs(delta).toFixed(1)} pt`;
        $('serieALiveDuelTitle').textContent = duelTitle;
        $('serieALiveDuelDetail').textContent = duelDetail;
      }else{
        $('serieALiveDuelTitle').textContent = 'Partita in equilibrio';
        $('serieALiveDuelDetail').textContent = 'I fantapunti si aggiorneranno minuto dopo minuto.';
      }
    }

    if($('serieALiveStatusTitle')){
      const completed = (visibleMatches||[]).filter(m=>Number(m.homeScore)+Number(m.awayScore)>=0 && (serieALive.minute>=90 || phase==='between')).length;
      let statusTitle = 'Diretta Gol in corso';
      let statusDetail = `${visibleMatches.length} campi monitorati · minuto ${phase==='between' ? 'FT' : `${serieALive.minute}'`}`;
      if(reviewComplete){
        statusTitle = 'Giornata conclusa';
        statusDetail = 'Tutti i campi sono al 90°. Puoi rivedere con calma risultati ed eventi.';
      }else if(phase==='between'){
        statusTitle = 'Big Match in arrivo';
        statusDetail = 'Le 9 partite live sono finite. Manca solo il posticipo.';
      }else if(phase==='bigmatch'){
        statusTitle = 'Big Match sotto i riflettori';
        statusDetail = `${bigLabel} · minuto ${serieALive.minute}'`;
      }
      $('serieALiveStatusTitle').textContent = statusTitle;
      $('serieALiveStatusDetail').textContent = statusDetail;
    }

    const ctx=serieALiveFantasyContext();
    const ro={P:0,D:1,C:2,A:3};

    const livePlayerRow=(player,isFantasyBench=false,finalPerformance=null)=>{
      const sideId=(ctx?.user?.roster||[]).some(p=>String(p.id)===String(player.id))?'user':ctx?.oppId;
      const isCaptain=leagueRulesFor(state).captainBonus!=='off' && String(serieALive.lineups?.[sideId]?.captainId||'')===String(player.id);
      const captainIcon=isCaptain?'<span title="Capitano della giornata">©️ </span>':'';
      if(finalPerformance){
        const noVote=!!finalPerformance.noVote;
        const substituted=finalPerformance.lineupSource==='substitute';
        const status=noVote?'SV':substituted?`ENTRATO PER ${finalPerformance.replacedPlayerName||'TITOLARE'}`:'FT';
        const vote=noVote?'—':Number(finalPerformance.vote||0).toFixed(1);
        const fv=noVote?'—':Number(finalPerformance.fantasy||0).toFixed(1);
        return {
          hasPlayed:!noVote,active:false,vote,fv,status,
          html:`<div class="seriea-user-player ${isFantasyBench?'is-fantasy-bench':''} ${substituted?'is-fantasy-substitute':''} ${noVote?'is-sv':''}"><i class="seriea-player-face">${playerAvatarMarkup(player,player.name||'Giocatore')}</i><span class="lineup-role-chip role-${player.role}">${player.role}</span><div><strong>${captainIcon}${escapeHtml(player.name)}</strong><small>${escapeHtml(clubShort(player.club))} · ${escapeHtml(status)}</small></div><span class="seriea-live-events">${noVote?'<span class="live-event-empty">SV</span>':liveEventBadgesMarkup(finalPerformance)}</span><b>${vote}</b><em>${fv}</em></div>`
        };
      }
      const perf=serieALive.perfMap.get(String(player.id));
      const playerMinute=serieAMinuteForPlayer(player);
      const hasPlayed=perf && perf.entryMinute<=playerMinute && playerMinute>0;
      const active=hasPlayed && (!perf.plannedExitMinute || playerMinute<=perf.plannedExitMinute);
      const vote=hasPlayed?halfPoint(perf.liveVote).toFixed(1):'—';
      const fv=hasPlayed?liveFantasyValue(perf,playerMinute).toFixed(1):'—';

      let status='SV';
      if(isBigMatchClub(player.club) && phase!=='bigmatch') status=phase==='between'?'BIG MATCH':'POSTICIPO';
      else if(perf){
        if(!hasPlayed) status='PANCHINA';
        else if(perf.red) status='ESPULSO';
        else if(perf.injury) status='INFORTUNATO';
        else if(!active && Number(perf.plannedExitMinute||90)<playerMinute) status=`USCITO ${perf.plannedExitMinute}'`;
        else if(!perf.starter) status=`ENTRATO ${perf.entryMinute}'`;
        else status=playerMinute>=90?'FT':'LIVE';
      }

      const voteFlash=serieALive.voteFlashes instanceof Map?serieALive.voteFlashes.get(String(player.id)):null;
      const flashActive=voteFlash && voteFlash.until>Date.now();
      if(voteFlash && !flashActive) serieALive.voteFlashes.delete(String(player.id));
      const flashClass=flashActive?`vote-${voteFlash.dir}`:'';
      const delta=flashActive?`<span class="live-vote-delta">${voteFlash.dir==='up'?'▲':'▼'} ${voteFlash.from.toFixed(1)}→${voteFlash.to.toFixed(1)}</span>`:'';

      return {
        hasPlayed,active,vote,fv,status,
        html:`<div class="seriea-user-player ${isFantasyBench?'is-fantasy-bench':''} ${active?'is-live':''} ${perf?.red?'is-red':''} ${perf?.injury?'is-injured':''} ${status==='POSTICIPO'||status==='BIG MATCH'?'is-posticipo':''} ${flashClass}"><i class="seriea-player-face">${playerAvatarMarkup(player,player.name||'Giocatore')}</i><span class="lineup-role-chip role-${player.role}">${player.role}</span><div><strong>${captainIcon}${escapeHtml(player.name)}</strong><small>${escapeHtml(clubShort(player.club))} · ${escapeHtml(status)}</small></div><span class="seriea-live-events">${hasPlayed?liveEventBadgesMarkup(perf):'<span class="live-event-empty">—</span>'}</span><b>${vote}${delta}</b><em>${fv}</em></div>`
      };
    };

    const renderLiveFantasySide=(manager,starters,bench,starterContainerId,benchContainerId,countId,benchCountId,teamLabelId,effectivePerformances=null)=>{
      if(!manager || !$(starterContainerId)) return;

      let starterLiveCount=0;
      const finalRows=Array.isArray(effectivePerformances)
        ? effectivePerformances.map(performance=>({performance,player:(manager.roster||[]).find(p=>String(p.id)===String(performance.playerId))})).filter(x=>x.player)
        : starters.map(player=>({player,performance:null}));
      finalRows.sort((a,b)=>ro[a.player.role]-ro[b.player.role] || String(a.player.name).localeCompare(String(b.player.name),'it'));
      $(starterContainerId).innerHTML=finalRows.map(({player,performance})=>{
        const row=livePlayerRow(player,false,performance);
        if(row.active) starterLiveCount++;
        return row.html;
      }).join('');

      let benchWithVote=0;
      const effectiveIds=new Set(finalRows.map(x=>String(x.player.id)));
      const orderedBench=bench.filter(player=>!effectiveIds.has(String(player.id)));
      if($(benchContainerId)){
        $(benchContainerId).innerHTML=orderedBench.map(player=>{
          const row=livePlayerRow(player,true);
          if(row.hasPlayed && row.vote!=='—') benchWithVote++;
          return row.html;
        }).join('');
      }

      if($(countId)) $(countId).textContent=Array.isArray(effectivePerformances)
        ? `${effectivePerformances.filter(p=>!p.noVote).length}/11 CON VOTO`
        : `${starterLiveCount}/11 LIVE`;
      if($(benchCountId)) $(benchCountId).textContent=`${benchWithVote}/${orderedBench.length} CON VOTO`;
      if($(teamLabelId)) $(teamLabelId).textContent=manager.team||'—';
    };

    if(ctx){
      renderLiveFantasySide(ctx.user,ctx.userPlayers,ctx.userBench,'serieAUserPlayers','serieAUserBench','serieAUserLiveCount','serieAUserBenchCount','serieAUserTeamLabel',finalUserPerformances);
      renderLiveFantasySide(ctx.opp,ctx.oppPlayers,ctx.oppBench,'serieAOppPlayers','serieAOppBench','serieAOppLiveCount','serieAOppBenchCount','serieAOppTeamLabel',finalOpponentPerformances);
    }

    const emptyText=phase==='bigmatch'
      ? 'Big Match iniziato. Qui compaiono solo eventi che coinvolgono giocatori della tua partita fantasy.'
      : phase==='between'
        ? 'Le 9 partite sono terminate. Preparati al Big Match.'
        : 'Nessun evento finora per i giocatori della tua partita fantasy.';
    $('serieANewsFeed').innerHTML=serieALive.feed.length?serieALive.feed.map(item=>{
      const player=playerMap.get(String(item.playerId||''));
      return `<div class="seriea-feed-item type-${item.type}"><b>${item.minute}'</b><i class="seriea-feed-avatar">${player?playerAvatarMarkup(player,''):''}</i><span>${escapeHtml(item.text)}</span></div>`;
    }).join(''):`<div class="seriea-feed-empty">${escapeHtml(emptyText)}</div>`;
  }

  function tickSerieALive(){
    if(!serieALive || serieALive.phase==='between' || serieALive.manualPaused) return;
    if(serieALive.autoPauseUntil && Date.now()<serieALive.autoPauseUntil) return;
    if(serieALive.autoPauseUntil && Date.now()>=serieALive.autoPauseUntil){
      serieALive.autoPauseUntil=0;
      hideSerieATvBanner();
    }

    serieALive.minute=Math.min(90,serieALive.minute+1);
    const events=serieALive.phaseEvents||[];

    while(serieALive.eventIndex<events.length && events[serieALive.eventIndex].minute<=serieALive.minute){
      const event=events[serieALive.eventIndex];
      applySerieAEvent(event);
      serieALive.eventIndex++;

      if(triggerSerieATvPresentation(event)){
        renderSerieALive();
        return;
      }
    }

    if(serieALive.minute>=90) finalizeSerieAPhaseRatings();
    if(serieALive.minute<90 && serieALive.minute%5===0) saveState();
    renderSerieALive();

    if(serieALive.minute>=90){
      if(serieALive.phase==='multilive') finishSerieAMultiLivePhase();
      else {
        if(serieALive.timer){clearInterval(serieALive.timer);serieALive.timer=null;}
        window.setTimeout(finalizeSerieALiveMatchday,850);
      }
    }
  }

  function simulateFullMatchdayDirectly(){
    const season=ensureSeasonState();
    if(!season || season.completed || weekendArrivalLoading) return;
    const day=season.currentMatchday||1;
    const round=season.schedule?.[day-1];
    const flow=ensureMatchdayFlowEntry(season,day);
    const savedLineup=season.lineups?.[String(day)]?.user;
    if(!round || round.matches?.every(m=>m.played) || flow?.phase!=='match_ready' || !savedLineup?.confirmed || season.pendingBigMatch?.day===day) return;

    if(showOpponentMalusNotice(day)) return;
    const lineups=ensureCpuLineupsForDay(day);
    if(!lineups?.user?.confirmed){requestOpenLineup();return;}

    setMatchdayFlowPhase(season,day,'live',{liveStartedAt:Date.now(),directSimulation:true});
    season.dayPhase='match';
    saveState();

    const built=buildSerieADay(day);
    if(!built) return;
    if(serieALive?.timer) clearInterval(serieALive.timer);

    serieALive={
      ...built,
      phase:'multilive',
      phaseEvents:built.mainEvents,
      minute:90,
      eventIndex:0,
      feed:[],
      allFeed:[],
      timer:null,
      lineups,
      speed:1,
      manualPaused:true,
      autoPauseUntil:0,
      tvToken:0,
      voteFlashes:new Map()
    };

    // 9 partite della Diretta Gol.
    while(serieALive.eventIndex<serieALive.phaseEvents.length){
      applySerieAEvent(serieALive.phaseEvents[serieALive.eventIndex]);
      serieALive.eventIndex++;
    }
    finalizeSerieAPhaseRatings();

    // Big Match, subito dopo e senza passaggio intermedio.
    serieALive.phase='bigmatch';
    serieALive.phaseEvents=built.bigMatchEvents;
    serieALive.minute=90;
    serieALive.eventIndex=0;
    while(serieALive.eventIndex<serieALive.phaseEvents.length){
      applySerieAEvent(serieALive.phaseEvents[serieALive.eventIndex]);
      serieALive.eventIndex++;
    }
    finalizeSerieAPhaseRatings();

    finalizeSerieALiveMatchday({directToResult:true});
  }

  function startSerieALiveMatchday(){
    serieAMatchesExpanded=true;
    const season=ensureSeasonState(); if(!season || season.completed) return;
    if(season.pendingBigMatch?.snapshot){
      renderSeasonDashboard();
      showToast('Prima devi giocare il Big Match in attesa.');
      return;
    }
    const day=season.currentMatchday;
    const round=season.schedule[day-1];
    if(!round || round.matches.every(m=>m.played)) return;
    const flow=ensureMatchdayFlowEntry(season,day);
    if(flow?.phase!=='match_ready'){
      renderSeasonDashboard();
      showToast('Premi CONTINUA e completa l’eventuale scelta prima della Diretta Gol.');
      return;
    }
    const lineups=ensureCpuLineupsForDay(day);
    if(!lineups?.user?.confirmed){requestOpenLineup();return;}
    setMatchdayFlowPhase(season,day,'live',{liveStartedAt:Date.now()});
    season.dayPhase='match';
    saveState();
    const built=buildSerieADay(day); if(!built) return;
    if(serieALive?.timer) clearInterval(serieALive.timer);
    serieALive={
      ...built,
      phase:'multilive',
      phaseEvents:built.mainEvents,
      minute:0,
      eventIndex:0,
      feed:[],
      allFeed:[],
      timer:null,
      lineups,
      speed:1,
      manualPaused:false,
      autoPauseUntil:0,
      tvToken:0,
      voteFlashes:new Map()
    };
    saveState();
    showScreen('serieALiveScreen');
    renderSerieALive();
    restartSerieALiveTimer();
  }

  function skipSerieALive(){
    if(!serieALive) return;
    if(serieALive.reviewComplete){
      const day=serieALive.day;
      serieALive=null;
      const season=ensureSeasonState();
      if(season) season.activeLive=null;
      saveState();
      renderMatchdayResult(day);
      return;
    }
    if(serieALive.phase==='between'){
      startPendingBigMatchFromHub();
      return;
    }
    if(serieALive.timer){clearInterval(serieALive.timer);serieALive.timer=null;}
    serieALive.manualPaused=false;
    serieALive.autoPauseUntil=0;
    serieALive.tvToken=(serieALive.tvToken||0)+1;
    hideSerieATvBanner();
    serieALive.minute=90;
    const events=serieALive.phaseEvents||[];
    while(serieALive.eventIndex<events.length){
      applySerieAEvent(events[serieALive.eventIndex]);
      serieALive.eventIndex++;
    }
    finalizeSerieAPhaseRatings();
    renderSerieALive();
    if(serieALive.phase==='multilive') window.setTimeout(finishSerieAMultiLivePhase,260);
    else window.setTimeout(finalizeSerieALiveMatchday,260);
  }

  function startPendingBigMatchFromHub(){
    const season=ensureSeasonState();
    if(!season) return;

    const pending=season.pendingBigMatch;
    let snapshot=null;

    // Flusso normale: passaggio diretto dalla Diretta Gol al Big Match
    // senza mai tornare in Dashboard.
    if(serieALive?.phase==='between'){
      snapshot=snapshotSerieALive(serieALive);
    } else if(!serieALive && pending?.snapshot){
      // Fallback per vecchi salvataggi o resume.
      snapshot=pending.snapshot;
    } else {
      return;
    }

    serieALive=hydrateSerieALive(snapshot,'bigmatch');
    season.pendingBigMatch=null;
    season.activeLive=snapshotSerieALive(serieALive);
    saveState();

    showScreen('serieALiveScreen');
    renderSerieALive();
    restartSerieALiveTimer();
  }

  function updatePersistentPlayerStatuses(day,live){
    const season=ensureSeasonState();
    if(!season||!live) return;
    ensurePlayerSeasonSystems(season);

    (live.events||[]).forEach(event=>{
      const id=String(event.playerId||'');
      if(!id || !season.playerStatus[id]) return;
      const status=season.playerStatus[id];

      if(event.type==='injury'){
        const severeRoll=seededSerieRand(day,`persistent-injury|${event.matchIndex}|${id}|${event.minute}`);
        const duration=severeRoll<.08?4:severeRoll<.28?3:severeRoll<.62?2:1;
        status.injuryUntil=Math.max(Number(status.injuryUntil||0),day+duration);
        status.lastReason=`Infortunio · ${duration} giornat${duration===1?'a':'e'}`;
      }
      if(event.type==='yellow'){
        status.yellowAccum=Number(status.yellowAccum||0)+1;
        if(status.yellowAccum>=5){
          status.yellowAccum-=5;
          status.suspensionUntil=Math.max(Number(status.suspensionUntil||0),day+1);
          status.lastReason='Squalifica per ammonizioni';
        }
      }
      if(event.type==='red'){
        const duration=event.secondYellow?1:(seededSerieRand(day,`red-ban|${event.matchIndex}|${id}`)<.16?2:1);
        status.suspensionUntil=Math.max(Number(status.suspensionUntil||0),day+duration);
        status.lastReason=`Squalifica · ${duration} giornat${duration===1?'a':'e'}`;
      }
    });
  }

  function updatePlayerSeasonStatsFromLive(day,live){
    const season=ensureSeasonState();
    if(!season||!live) return;
    ensurePlayerSeasonSystems(season);

    (live.matches||[]).forEach(match=>{
      const all=[...(match.homePerfs||[]),...(match.awayPerfs||[])];
      all.forEach(perf=>{
        const player=playerMap.get(String(perf.playerId)) || (window.FANTA_PLAYERS||[]).find(p=>String(p.id)===String(perf.playerId));
        if(!player) return;
        const stat=season.playerSeasonStats[String(player.id)] || (season.playerSeasonStats[String(player.id)]=emptyPlayerSeasonStat(player));
        const mins=playedMinutes(perf,90);
        if(mins<=0) return;

        stat.appearances++;
        if(perf.starter) stat.starts++; else stat.subApps++;
        stat.minutes+=mins;
        stat.goals+=Number(perf.goals||0);
        stat.assists+=Number(perf.assists||0);
        stat.yellow+=Number(perf.yellow||0);
        stat.red+=Number(perf.red||0);
        stat.missedPenalty+=Number(perf.missedPenalty||0);
        stat.savedPenalty+=Number(perf.savedPenalty||0);

        const isHome=match.homeClub===perf.club;
        const goalsAgainst=isHome?Number(match.awayScore||0):Number(match.homeScore||0);
        if((perf.role==='P'||perf.role==='D') && goalsAgainst===0 && mins>=60) stat.cleanSheets++;

        const performance=currentFantasyPerformance(player,match.perfMap||live.perfMap,90);
        if(!performance.noVote && performance.vote!==null){
          const vote=Number(performance.vote);
          const fantasy=Number(performance.fantasy||0);
          stat.voteCount++;
          stat.voteSum+=vote;
          stat.fantasySum+=fantasy;
          stat.bestVote=stat.bestVote===null?vote:Math.max(stat.bestVote,vote);
          stat.worstVote=stat.worstVote===null?vote:Math.min(stat.worstVote,vote);
          stat.recent=Array.isArray(stat.recent)?stat.recent:[];
          stat.recent.push({day,vote,fantasy});
          stat.recent=stat.recent.slice(-5);
        }
        stat.lastDay=day;
      });
    });
  }

  function playerOvrDevelopment(playerId,season=ensureSeasonState()){
    if(!season)return null;
    if(!season.playerOvrDevelopment||typeof season.playerOvrDevelopment!=='object') season.playerOvrDevelopment={};
    const id=String(playerId);
    return season.playerOvrDevelopment[id] ||= {delta:0,progress:0,lastDay:0,history:[]};
  }

  function currentPlayerOvr(player){
    if(!player)return 0;
    const base=Number(player.ovr||player.overall||0);
    const season=state?.season?.started?state.season:null;
    const delta=Number(season?.playerOvrDevelopment?.[String(player.id)]?.delta||0);
    return clamp(base+delta,50,99);
  }

  function playerOvrLabel(player){
    const current=currentPlayerOvr(player);
    const base=Number(player?.ovr||player?.overall||current);
    const delta=current-base;
    return `${current}${delta?` (${delta>0?'+':''}${delta})`:''}`;
  }

  function applyPlayerOvrChange(player,amount,day,reason,type='form'){
    const season=ensureSeasonState();
    if(!season||!player||!amount)return null;
    const development=playerOvrDevelopment(player.id,season);
    const before=currentPlayerOvr(player);
    const wantedDelta=clamp(Number(development.delta||0)+Number(amount||0),-10,10);
    const after=clamp(Number(player.ovr||0)+wantedDelta,50,99);
    const actualDelta=after-before;
    if(!actualDelta)return null;
    development.delta=after-Number(player.ovr||0);
    development.lastDay=day;
    development.history=Array.isArray(development.history)?development.history:[];
    development.history.push({day,before,after,change:actualDelta,reason,type});
    development.history=development.history.slice(-20);
    const event={id:`ovr_${day}_${player.id}_${development.history.length}`,day,playerId:String(player.id),before,after,change:actualDelta,reason,type};
    season.playerDevelopmentEvents=Array.isArray(season.playerDevelopmentEvents)?season.playerDevelopmentEvents:[];
    season.playerDevelopmentEvents.push(event);
    season.playerDevelopmentEvents=season.playerDevelopmentEvents.slice(-120);
    addSeasonNews({id:event.id,day,stage:'post',priority:actualDelta>0?92:88,type:actualDelta>0?'growth':'decline',title:actualDelta>0?`${player.name} cresce: OVR ${before} → ${after}`:`${player.name} in calo: OVR ${before} → ${after}`,detail:`${reason} · variazione stagionale ${development.delta>=0?'+':''}${development.delta}`,playerId:player.id,expiresAfter:3});
    return event;
  }

  function updatePlayerOvrEvolution(day,live){
    const season=ensureSeasonState();
    if(!season||!live)return;

    // V3.2.35.8:
    // l'OVR deve essere un sistema vivo e percepibile durante tutta la stagione.
    // Ogni giornata genera normalmente tra 8 e 15 variazioni complessive.
    // La maggior parte nasce dalle prestazioni; almeno 2 sono eventi di contesto/allenamento.
    const targetChanges=8+Math.floor(seededSerieRand(day,'ovr-target-changes')*8); // 8..15
    const performanceCandidates=[];

    (live.matches||[]).forEach(match=>{
      [...(match.homePerfs||[]),...(match.awayPerfs||[])].forEach(perf=>{
        const player=playerMap.get(String(perf.playerId))||(window.FANTA_PLAYERS||[]).find(p=>String(p.id)===String(perf.playerId));
        if(!player)return;

        const performance=currentFantasyPerformance(player,match.perfMap||live.perfMap,90);
        if(performance.noVote||performance.vote===null)return;

        const development=playerOvrDevelopment(player.id,season);
        const vote=Number(performance.vote||0);
        const role=String(player.role||perf.role||'');

        // V3.2.35.56 · Evoluzione OVR normalizzata per ruolo.
        // Prima gli attaccanti avevano un doppio vantaggio: i bonus miglioravano già
        // il rendimento e, in più, gol/assist aggiungevano molto progresso OVR.
        // Qui manteniamo le prestazioni come motore principale, ma diamo a ogni ruolo
        // un metro più coerente con il suo lavoro in campo.
        let points=
          vote>=8 ? 2.5 :
          vote>=7.5 ? 2 :
          vote>=6.8 ? 1 :
          vote<=4.8 ? -2.5 :
          vote<=5 ? -2 :
          vote<=5.5 ? -1 : 0;

        // Piccola normalizzazione continua: compensa il fatto che P/D producono
        // naturalmente meno eventi offensivi, mentre riduce il vantaggio strutturale A.
        points+=({P:.34,D:.12,C:0,A:-.15}[role]||0);

        // Gol e assist restano importanti, ma il loro impatto sull'OVR è scalato
        // per ruolo: un bomber non deve crescere automaticamente più di tutti solo
        // perché il suo ruolo genera più bonus fantasy.
        const goalEvolutionScale=({P:1,D:.9,C:.7,A:.25}[role]||1);
        const assistEvolutionScale=({P:1,D:.85,C:.7,A:.35}[role]||1);
        if(Number(perf.goals||0)>=2) points+=goalEvolutionScale;
        else if(Number(perf.goals||0)===1 && vote>=7) points+=.35*goalEvolutionScale;
        if(Number(perf.assists||0)>=2) points+=.45*assistEvolutionScale;

        // Il clean sheet diventa un merito evolutivo esplicito per P e D,
        // purché il giocatore abbia disputato almeno 60 minuti.
        const goalsAgainst=String(perf.club)===String(match.homeClub)
          ? Number(match.awayScore||0)
          : Number(match.homeScore||0);
        if((role==='P'||role==='D') && goalsAgainst===0 && playedMinutes(perf,90)>=60){
          points+=role==='P'?.20:.08;
        }

        if(Number(perf.red||0)>0) points-=1;

        // Il potenziale segreto assegnato a inizio stagione orienta la carriera del giocatore.
        // ELITE/ALTO sono realmente predisposti a crescere; BASSO/RISCHIO CALO al contrario.
        // Le prestazioni possono comunque accelerare, rallentare o contrastare quella tendenza.
        const hiddenPotential=playerSeasonPotentialProfile(player);
        const trend=Number(hiddenPotential.trend||0);
        const absTrend=Math.abs(trend);

        const trendBias=
          absTrend>=8 ? Math.sign(trend)*1.12 :
          absTrend>=4 ? Math.sign(trend)*.64 :
          trend*.06;

        const trigger=
          absTrend>=8 ? 3.0 :
          absTrend>=4 ? 3.6 :
          4.0;

        development.progress=clamp(Number(development.progress||0)+points+trendBias,-9,9);

        if(development.progress>=trigger){
          performanceCandidates.push({
            player,
            amount:1,
            score:development.progress+(trend>0?Math.min(1.4,trend*.08):0),
            resetStep:trigger,
            reason:hiddenPotential.tier==='elite'
              ? 'Crescita tecnica accelerata e prestazioni convincenti'
              : hiddenPotential.tier==='high'
                ? 'Potenziale in crescita e rendimento positivo'
                : 'Prestazioni eccellenti e grande continuità'
          });
        }else if(development.progress<=-trigger){
          performanceCandidates.push({
            player,
            amount:-1,
            score:-development.progress+(trend<0?Math.min(1.4,-trend*.08):0),
            resetStep:trigger,
            reason:hiddenPotential.tier==='collapse'
              ? 'Regresso tecnico e fiducia in forte calo'
              : hiddenPotential.tier==='low'
                ? 'Potenziale in calo e rendimento negativo'
                : 'Periodo di forma negativo'
          });
        }
      });
    });

    const changedToday=new Set();
    let changesMade=0;

    // Lasciamo sempre almeno 2 slot agli eventi di allenamento/contesto.
    // In questo modo la crescita non dipende esclusivamente dal voto dell'ultima giornata.
    const performanceLimit=Math.max(0,targetChanges-2);

    performanceCandidates
      .sort((a,b)=>b.score-a.score)
      .slice(0,performanceLimit)
      .forEach(item=>{
        if(changedToday.has(String(item.player.id)))return;
        const development=playerOvrDevelopment(item.player.id,season);
        development.progress+=item.amount>0?-item.resetStep:item.resetStep;
        const event=applyPlayerOvrChange(item.player,item.amount,day,item.reason,'performance');
        if(event){
          changedToday.add(String(item.player.id));
          changesMade++;
        }
      });

    const allPlayers=(window.FANTA_PLAYERS||[]).slice();

    // Per gli eventi extra diamo priorità ai giocatori effettivamente coinvolti nella giornata,
    // ma una quota può comunque riguardare riserve/giocatori meno utilizzati.
    const activeIds=new Set();
    (live.matches||[]).forEach(match=>{
      [...(match.homePerfs||[]),...(match.awayPerfs||[])].forEach(perf=>{
        if(perf?.playerId!=null) activeIds.add(String(perf.playerId));
      });
    });
    const activePool=allPlayers.filter(p=>activeIds.has(String(p.id)));
    const randomEvents=[
      {id:'great_training',weight:31,change:1,reason:'Settimana di allenamenti eccellente',type:'training'},
      {id:'breakthrough',weight:2,change:2,reason:'Esplosione inattesa durante gli allenamenti',type:'breakthrough'},
      {id:'confidence',weight:22,change:1,reason:'Fiducia crescente da parte dell’allenatore',type:'confidence'},
      {id:'bad_training',weight:28,change:-1,reason:'Allenamenti sotto le aspettative',type:'training'},
      {id:'coach_conflict',weight:24,change:-1,reason:'Discussione con il mister e fiducia in calo',type:'conflict'},
      {id:'locker_crisis',weight:2,change:-2,reason:'Crisi nello spogliatoio',type:'conflict'}
    ];

    const pickWeighted=(roll,trend=0)=>{
      const bias=clamp(Number(trend||0)/10,-1,1);
      const weighted=randomEvents.map(event=>({
        event,
        // Il potenziale influenza nettamente la direzione dell'evento,
        // senza rendere impossibile un risultato contrario.
        weight:event.weight*(
          event.change>0 ? (1+bias*.92) :
          event.change<0 ? (1-bias*.92) : 1
        )
      }));
      let total=weighted.reduce((s,x)=>s+x.weight,0);
      let cursor=roll*total;
      for(const item of weighted){
        cursor-=item.weight;
        if(cursor<=0)return item.event;
      }
      return weighted[0].event;
    };

    let attempts=0;
    const maxAttempts=Math.max(100,targetChanges*30);

    while(changesMade<targetChanges && attempts<maxAttempts){
      attempts++;

      // Circa il 75% degli eventi extra riguarda qualcuno visto in campo in questa giornata.
      const useActive=activePool.length>0 && seededSerieRand(day,`ovr-extra-active-${attempts}`)<.75;
      const pool=useActive?activePool:allPlayers;
      if(!pool.length)break;

      const index=Math.floor(seededSerieRand(day,`ovr-extra-player-${attempts}`)*pool.length);
      const player=pool[index];
      if(!player || changedToday.has(String(player.id)))continue;

      const hiddenPotential=playerSeasonPotentialProfile(player);
      const event=pickWeighted(
        seededSerieRand(day,`ovr-extra-type-${attempts}-${player.id}`),
        hiddenPotential.trend
      );

      const applied=applyPlayerOvrChange(player,event.change,day,event.reason,event.type);
      if(!applied)continue;

      changedToday.add(String(player.id));
      changesMade++;
    }

    // Piccolo log persistente utile per diagnostica e bilanciamento.
    season.ovrEvolutionMeta ||= {};
    season.ovrEvolutionMeta[String(day)]={
      target:targetChanges,
      actual:changesMade,
      performanceChanges:[...changedToday].length,
      updatedAt:Date.now()
    };
  }

  function updateSerieASeasonWorld(day,live){
    const season=ensureSeasonState();
    if(!season||!live) return;
    ensurePlayerSeasonSystems(season);
    if(season.simDataUpdatedDays[String(day)]) return;

    updateSerieAStandingsFromStoredMatches(season,(live.matches||[]).map(m=>({
      homeClub:m.homeClub,awayClub:m.awayClub,homeScore:m.homeScore,awayScore:m.awayScore
    })));
    updatePlayerSeasonStatsFromLive(day,live);
    updatePersistentPlayerStatuses(day,live);
    updatePlayerOvrEvolution(day,live);
    applyLockerRoomOvrOutcome(day,live);
    season.simDataUpdatedDays[String(day)]=true;
  }

  function applyLockerRoomOvrOutcome(day,live){
    const effect=activeFormationChoice(day)?.effect;
    if(!effect || !['locker_vote','locker_turnaround'].includes(effect.kind) || !effect.ovrCondition && effect.kind!=='locker_turnaround')return;
    const id=String(effect.targetPlayerId),player=playerMap.get(id);
    const starters=Object.values(state?.season?.lineups?.[String(day)]?.user?.starters||{}).map(String);
    if(!player || !starters.includes(id))return;
    const perf=live.perfMap?.get(id);
    if(!perf)return;
    const performance=currentFantasyPerformance(player,live.perfMap,90);
    if(performance.noVote)return;
    const season=ensureSeasonState();
    season.lockerOvrAwarded ||= {};
    if(season.lockerOvrAwarded[id])return;
    const vote=Number(performance.vote);
    const change=vote>=7?1:effect.kind==='locker_turnaround' && vote<6?-1:0;
    if(change && applyPlayerOvrChange(player,change,day,`${activeFormationChoice(day).title}: voto ${vote}`,'locker_event')) season.lockerOvrAwarded[id]=true;
  }

  function finalizeSerieALiveMatchday({directToResult=false}={}){
    if(!serieALive || serieALive.finalizing) return;
    if(serieALive.phase!=='bigmatch') return;
    serieALive.finalizing=true;
    const season=ensureSeasonState(); if(!season) return;
    const day=serieALive.day, round=season.schedule[day-1], lineups=serieALive.lineups;
    if(!round || season.matchdayResults[String(day)]) {
      if(serieALive.timer) clearInterval(serieALive.timer);
      serieALive=null;
      season.activeLive=null;
      renderSeasonDashboard();
      return;
    }
    season.pendingBigMatch=null;
    season.activeLive=null;
    const preDayStandings=season.standings.map(row=>({...row}));
    const dayResult={
      day,
      matches:[],
      createdAt:Date.now(),
      formationChoice:activeFormationChoice(day)?JSON.parse(JSON.stringify(activeFormationChoice(day))):null,
      userBenchIds:(lineups?.user?.bench||[]).map(String)
    };
    round.matches.forEach(match=>{
      const hm=managerById(match.homeId), am=managerById(match.awayId);
      const hs=simulateFantasyTeamFromSerieA(hm,lineups[match.homeId],serieALive.perfMap,90);
      const as=simulateFantasyTeamFromSerieA(am,lineups[match.awayId],serieALive.perfMap,90);
      match.homeScore=hs.fantasyGoals; match.awayScore=as.fantasyGoals; match.played=true;
      match.homeFantasy=hs.fantasyPoints; match.awayFantasy=as.fantasyPoints;
      const detail={
        homeId:match.homeId,awayId:match.awayId,homeScore:match.homeScore,awayScore:match.awayScore,
        homeFantasy:hs.fantasyPoints,awayFantasy:as.fantasyPoints,homeTeam:hm.team,awayTeam:am.team,
        homePerformances:hs.performances,awayPerformances:as.performances,
        homeSubstitutions:hs.substitutions||[],awaySubstitutions:as.substitutions||[],
        homeSubsUsed:hs.subsUsed||0,awaySubsUsed:as.subsUsed||0,
        homeDefenseModifierBonus:Number(hs.defenseModifierBonus||0),awayDefenseModifierBonus:Number(as.defenseModifierBonus||0),
        homeDefenseModifierAverage:hs.defenseModifierAverage??null,awayDefenseModifierAverage:as.defenseModifierAverage??null
      };
      dayResult.matches.push(detail); updateStandingsFromMatch(match);
    });
    updateSerieASeasonWorld(day,serieALive);

    season.serieAResults[String(day)]={
      day,
      matches:serieALive.matches.map(m=>({
        homeClub:m.homeClub,awayClub:m.awayClub,homeScore:m.homeScore,awayScore:m.awayScore,
        homeFormation:m.homeFormation,awayFormation:m.awayFormation,
        scorers:(m.scorers||[]).map(s=>({...s}))
      })),
      events:(serieALive.allFeed||serieALive.feed).slice().reverse()
    };
    season.matchdayResults[String(day)]=dayResult;
    grantMatchdayFantapoints(season,day,dayResult);
    season.lastCompletedMatchday=day;
    const sponsorWinReward=grantWinSponsorReward(season,day,dayResult);
    const sponsorBigMatchReward=grantBigMatchSponsorReward(season,day,dayResult,preDayStandings);
    const sponsorStreakReward=grantStreakSponsorReward(season,day,dayResult);
    const sponsorMidseasonReward=CareerEngine.grantMidseasonSponsorBonus(ensureCareerEconomy(),season,day,sortedStandings());
    generatePostMatchNews(day,dayResult,serieALive);
    setMatchdayFlowPhase(season,day,'completed',{completedAt:Date.now()});
    season.dayPhase='ready';
    if(day>=FANTASY_SEASON_MATCHDAYS) { season.completed=true; grantSeasonPrizeIfNeeded(season); grantFutureAuctionSponsorBonus(season); }
    else {
      season.currentMatchday=day+1;
      ensureMatchdayFlowEntry(season,season.currentMatchday);
      seedAssistantCoachLineupForDay(season.currentMatchday,season);
    }
    activateWinterTransferWindowIfNeeded();
    if(serieALive.timer) clearInterval(serieALive.timer);
    serieALive.timer=null;
    serieALive.minute=90;
    serieALive.manualPaused=true;
    serieALive.autoPauseUntil=0;
    serieALive.reviewComplete=true;
    serieALive.finalizing=false;
    const sponsorRewards=[];
    if(sponsorWinReward) sponsorRewards.push(`+${sponsorWinReward} € vittoria`);
    if(sponsorBigMatchReward) sponsorRewards.push(`+${sponsorBigMatchReward} € Big Match`);
    if(sponsorStreakReward) sponsorRewards.push(`+${sponsorStreakReward} € Serie Positiva`);
    if(sponsorMidseasonReward) sponsorRewards.push(`+${sponsorMidseasonReward} € Amauri · Top 2 G19`);

    hideSerieATvBanner();
    if(directToResult){
      season.activeLive=null;
      const completedDay=day;
      serieALive=null;
      saveState();
      renderMatchdayResult(completedDay);
      showToast(sponsorRewards.length
        ? `Giornata simulata · Sponsor: ${sponsorRewards.join(' · ')}.`
        : 'Giornata simulata.');
      return;
    }

    season.activeLive=snapshotSerieALive(serieALive);
    saveState();
    showScreen('serieALiveScreen');
    renderSerieALive();
    showToast(sponsorRewards.length?`Giornata conclusa · Sponsor: ${sponsorRewards.join(' · ')}. Controlla la Diretta Gol e poi premi VEDI RISULTATO.`:'Giornata conclusa. Controlla la Diretta Gol e poi premi VEDI RISULTATO.');
  }

  function renderMatchdayResult(day) {
    const season=ensureSeasonState();
    const result=season?.matchdayResults?.[String(day)]; if(!result) return renderSeasonDashboard();
    const match=result.matches.find(m=>m.homeId==='user'||m.awayId==='user'); if(!match) return renderSeasonDashboard();
    const userHome=match.homeId==='user';
    const userScore=userHome?match.homeScore:match.awayScore, oppScore=userHome?match.awayScore:match.homeScore;
    const userFantasy=userHome?match.homeFantasy:match.awayFantasy, oppFantasy=userHome?match.awayFantasy:match.homeFantasy;
    const userPerf=userHome?match.homePerformances:match.awayPerformances;
    const userSubs=userHome?(match.homeSubstitutions||[]):(match.awaySubstitutions||[]);
    const userDefenseModifier=Number(userHome?match.homeDefenseModifierBonus:match.awayDefenseModifierBonus)||0;
    const opponentTeam=userHome?match.awayTeam:match.homeTeam;
    showScreen('matchdayResultScreen');
    $('resultMatchdayNo').textContent=day;
    $('resultTitle').textContent=`${state.teamName} ${userScore} - ${oppScore} ${opponentTeam}`;
    $('resultSubtitle').textContent=`${userFantasy.toFixed(1)} fantapunti contro ${oppFantasy.toFixed(1)} · voti generati dalla giornata Serie A${userDefenseModifier>0?` · Mod. difesa +${userDefenseModifier}`:''}`;
    if($('resultFantasyRulesSummary')) $('resultFantasyRulesSummary').textContent=`Gol +3 · Assist +1 · Amm. -0,5 (doppio giallo -1) · Esp. diretta -1 · Autogol -2 · Rigore sbagliato -3 · Rigore parato +3 · Gol subito P -1 · ${leagueRulesSummary(state)}`;
    $('resultUserTeam').textContent=state.teamName; $('resultOpponentTeam').textContent=opponentTeam;
    $('resultUserFantasy').textContent=`${userFantasy.toFixed(1)} pt`; $('resultOpponentFantasy').textContent=`${oppFantasy.toFixed(1)} pt`;
    $('resultScore').textContent=`${userScore} - ${oppScore}`;
    $('resultOutcome').textContent=userScore>oppScore?'VITTORIA':userScore<oppScore?'SCONFITTA':'PAREGGIO';
    $('resultOutcome').className=userScore>oppScore?'win':userScore<oppScore?'loss':'draw';
    const scoreboard=$('resultScore').closest('.result-scoreboard');
    scoreboard.dataset.outcome=userScore>oppScore?'win':userScore<oppScore?'loss':'draw';
    scoreboard.querySelectorAll('.result-team-emblem,.result-coach-portrait').forEach(node=>node.remove());
    for(const [id,managerId] of [['resultUserTeam','user'],['resultOpponentTeam',userHome?match.awayId:match.homeId]]){
      const portrait=document.createElement('span');
      portrait.className='result-coach-portrait';portrait.id=`${id}Portrait`;
      $(id).parentElement.prepend(portrait);
      const manager=managerById(managerId);
      renderFixtureCoachPortrait(portrait.id,manager,seasonFixtureTheme(manager,managerId==='user'));
    }
    renderCareerWallets();
    if($('resultContinueBtn')) $('resultContinueBtn').textContent=day>=FANTASY_SEASON_MATCHDAYS?'TORNA ALLA DASHBOARD':'CONTINUA';
    renderMatchdayFantapointsReward(result);
    if($('resultCareerPrize')){ const prize=season.careerPrize; $('resultCareerPrize').style.display=(day>=FANTASY_SEASON_MATCHDAYS&&prize)?'flex':'none'; if(day>=FANTASY_SEASON_MATCHDAYS&&prize){ $('resultCareerPrize').innerHTML=`<span>FINE STAGIONE · ${prize.position}° POSTO</span><strong>${prize.amount>0?`+${prize.amount} €`:'NESSUN PREMIO'}</strong><small>Saldo carriera: ${careerEuros()} €</small>`; } }
    const ro={P:0,D:1,C:2,A:3};
    if($('resultSubstitutions')){
      $('resultSubstitutions').innerHTML=userSubs.length
        ? `<strong>${userSubs.length} sostituzion${userSubs.length===1?'e':'i'}</strong>${userSubs.map(s=>`<span><i class="lineup-role-chip role-${s.role}">${s.role}</i>${escapeHtml(s.outPlayerName)} <b>→</b> ${escapeHtml(s.inPlayerName)}</span>`).join('')}`
        : `<strong>0 sostituzioni</strong><span>${userPerf.some(p=>p.noVote)?'Restano giocatori senza voto: nessun sostituto utilizzabile.':'Tutti gli 11 titolari hanno portato voto.'}</span>`;
    }
    $('resultRatingsBody').innerHTML=userPerf.slice().sort((a,b)=>ro[a.role]-ro[b.role]).map(p=>`<tr class="${p.noVote?'no-vote-row':''} ${p.lineupSource==='substitute'?'substitute-row':''}"><td><span class="lineup-role-chip role-${p.role}">${p.role}</span></td><td><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(clubShort(p.club))}${p.lineupSource==='substitute'&&p.replacedPlayerName?` · ↳ per ${escapeHtml(p.replacedPlayerName)}`:''}</small></td><td>${p.noVote?'SV':p.vote.toFixed(1)}</td><td>${escapeHtml(performanceText(p))}</td><td><b>${p.noVote?'—':p.fantasy.toFixed(1)}</b></td></tr>`).join('');
    $('resultTotalFantasy').textContent=userFantasy.toFixed(1);
    $('resultOtherMatches').innerHTML=result.matches.filter(m=>m!==match).map(m=>`<div class="result-other-row"><span>${escapeHtml(m.homeTeam)}</span><b>${m.homeScore} - ${m.awayScore}</b><span>${escapeHtml(m.awayTeam)}</span><small>${m.homeFantasy.toFixed(1)} - ${m.awayFantasy.toFixed(1)} pt</small></div>`).join('');
  }

  function closeMatchdayFantapointsReward(){
    const modal=$('matchdayRewardModal');
    if(!modal) return;
    modal.dataset.animationToken='';
    modal.classList.remove('show','is-awarding');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('matchday-reward-open');
  }

  function animateMatchdayRewardNumber(from,to,duration,onValue,isCurrent){
    return new Promise(resolve=>{
      if(duration<=0){onValue(to);resolve();return;}
      const started=performance.now();
      const tick=now=>{
        if(isCurrent && !isCurrent()){resolve();return;}
        const progress=Math.min(1,(now-started)/duration);
        const eased=1-Math.pow(1-progress,3);
        onValue(Math.round(from+(to-from)*eased));
        if(progress<1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  function renderMatchdayFantapointsReward(result){
    const reward=result?.fantapointsReward;
    const modal=$('matchdayRewardModal');
    if(!modal||!reward){closeMatchdayFantapointsReward();return;}
    const parts=reward.parts||{};
    const rows=[
      ['Partita disputata',parts.participation],
      [parts.outcome===8?'Vittoria':parts.outcome===3?'Pareggio':'Risultato',parts.outcome],
      [`${Number(parts.goals||0)/2} gol fantasy`,parts.goals],
      ['Porta inviolata',parts.cleanSheet],
      ['Bonus Fantapoteri',parts.powers],
      ['Sponsor McTominasy’s',parts.sponsor]
    ].filter(([,value])=>Number(value)>0);
    $('resultFantapointsBreakdown').innerHTML=rows.map(([label,value],index)=>`<span class="matchday-reward-row" data-reward-row="${index}" data-reward-target="${Number(value)}"><small>${escapeHtml(label)}</small><b>+<i>0</i> FP</b></span>`).join('');
    const earned=$('resultFantapointsEarned'),balance=$('resultFantapointsBalance');
    const continueBtn=$('resultFantapointsContinueBtn');
    const animate=!result.fantapointsPresented;
    const total=Number(reward.total||0),before=Number(reward.balanceBefore||0),after=Number(reward.balanceAfter||0);
    if(earned) earned.textContent=animate?'0':String(total);
    if(balance) balance.textContent=String(animate?before:after);
    if(animate) document.querySelectorAll('[data-fantapoints-value]').forEach(el=>el.textContent=String(before));
    if(!animate){closeMatchdayFantapointsReward();return;}

    modal.classList.add('show','is-awarding');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('matchday-reward-open');
    if(continueBtn) continueBtn.disabled=true;
    result.fantapointsPresented=true;
    saveState();

    const token=`reward-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    modal.dataset.animationToken=token;
    const isCurrent=()=>modal.dataset.animationToken===token && modal.classList.contains('show');
    const delay=ms=>new Promise(resolve=>window.setTimeout(resolve,ms));
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    (async()=>{
      let accumulated=0;
      const rowEls=[...modal.querySelectorAll('[data-reward-row]')];
      for(const row of rowEls){
        if(!isCurrent()) return;
        const target=Number(row.dataset.rewardTarget||0);
        const valueEl=row.querySelector('b i');
        row.classList.add('is-active');
        await animateMatchdayRewardNumber(0,target,reduced?0:520,value=>{
          if(valueEl) valueEl.textContent=String(value);
          if(earned) earned.textContent=String(accumulated+value);
        },isCurrent);
        if(!isCurrent()) return;
        accumulated+=target;
        if(earned) earned.textContent=String(accumulated);
        row.classList.remove('is-active');
        row.classList.add('is-complete');
        if(!reduced) await delay(180);
      }

      if(!isCurrent()) return;
      modal.classList.add('is-balance-awarding');
      if(after>before) animateMatchParticles(modal.querySelector('.matchday-reward-dialog'),earned,balance);
      await animateMatchdayRewardNumber(before,after,reduced?0:850,value=>{
        if(balance) balance.textContent=String(value);
        document.querySelectorAll('[data-fantapoints-value]').forEach(el=>el.textContent=String(value));
      },isCurrent);
      if(!isCurrent()) return;
      if(balance) balance.textContent=String(after);
      document.querySelectorAll('[data-fantapoints-value]').forEach(el=>el.textContent=String(after));
      modal.classList.remove('is-awarding','is-balance-awarding');
      if(continueBtn){
        continueBtn.disabled=false;
        continueBtn.focus();
      }
    })();
  }

  const QUICK_ROLE_NAMES={P:'Portieri',D:'Difensori',C:'Centrocampisti',A:'Attaccanti'};

  function quickReadyYield(ms=0){
    return new Promise(resolve=>{
      requestAnimationFrame(()=>window.setTimeout(resolve,ms));
    });
  }

  function setQuickReadyLoading(active,{title,text,step,progress}={}){
    const overlay=$('quickReadyLoading');
    if(!overlay) return;
    overlay.classList.toggle('show',!!active);
    overlay.setAttribute('aria-hidden',active?'false':'true');
    document.body.classList.toggle('quick-ready-busy',!!active);

    const btn=$('quickReadyBtn');
    if(btn) btn.disabled=!!active;

    if(title!==undefined && $('quickReadyLoadingTitle')) $('quickReadyLoadingTitle').textContent=title;
    if(text!==undefined && $('quickReadyLoadingText')) $('quickReadyLoadingText').textContent=text;
    if(step!==undefined && $('quickReadyProgressStep')) $('quickReadyProgressStep').textContent=step;

    if(progress!==undefined){
      const pct=Math.max(0,Math.min(100,Math.round(Number(progress)||0)));
      if($('quickReadyProgressBar')) $('quickReadyProgressBar').style.width=`${pct}%`;
      if($('quickReadyProgressPct')) $('quickReadyProgressPct').textContent=`${pct}%`;
    }
  }

  function updateQuickReadyProgress(role,extra=''){
    if(!state) return;
    const total=TOTAL_SLOTS*state.managers.length;
    const done=Math.max(0,Math.min(total,Number(state.stats?.purchases||0)));
    const pct=8+(done/total)*87;
    const roleName=QUICK_ROLE_NAMES[role]||'Rose';
    setQuickReadyLoading(true,{
      title:`Generazione ${roleName.toLowerCase()}...`,
      text:`${done} / ${total} giocatori assegnati${extra?` · ${extra}`:''}`,
      step:roleName,
      progress:pct
    });
  }

  function quickAwardGeneratedPlayer(player, nominator) {
    if (!player || !nominator) return false;
    const legalBidders = state.managers.map(m => {
      if (!canOwn(m,player) || maxLegalBid(m,player)<1) return null;
      let ceiling = m.id==='user' ? autoUserLimit(m,player) : cpuLimit(m,player);
      // The manager who called the player must always be willing to open at 1.
      if (m.id===nominator.id && ceiling<1) ceiling=1;
      if (ceiling<1) return null;
      const mood = .90 + Math.random()*.18;
      const effective = Math.max(1,Math.min(maxLegalBid(m,player),Math.round(ceiling*mood)));
      return {m,ceiling,effective};
    }).filter(Boolean).sort((a,b)=>b.effective-a.effective || Math.random()-.5);

    if (!legalBidders.length) return false;
    const winnerEntry = legalBidders[0];
    const runnerUp = legalBidders[1];
    const winner = winnerEntry.m;
    let price = 1;
    if (runnerUp) {
      const steps=[1,1,1,2,2,3,5];
      const inc=steps[Math.floor(Math.random()*steps.length)];
      price=Math.min(winnerEntry.effective,runnerUp.effective+inc);
    }
    price=Math.max(1,Math.min(price,maxLegalBid(winner,player)));

    winner.budget-=price;
    winner.roster.push({
      id:player.id,name:player.name,role:player.role,club:player.club,
      ovr:player.ovr,quotation:player.quotation,fvm:player.fvm,price
    });
    recordUserAuctionPick(player,winner.id);
    state.availableIds=state.availableIds.filter(id=>id!==player.id);
    state.stats.purchases++;
    state.stats.totalSpent+=price;
    if (!state.stats.highest || price>state.stats.highest.price) {
      state.stats.highest={playerId:player.id,playerName:player.name,managerId:winner.id,team:winner.team,price};
    }
    return true;
  }

  async function generateReadyRosters(fromCareer=false) {

    setQuickReadyLoading(true,{
      title:'Preparazione rose...',
      text:'Inizializzo i 10 fantallenatori e il mercato.',
      step:'Avvio',
      progress:3
    });

    // Fondamentale: lascia al browser il tempo di disegnare davvero l'overlay
    // prima di iniziare il calcolo pesante.
    await quickReadyYield(40);

    try {
      prepareNewGame(fromCareer);
      state.quickStart=true;
      state.turbo=true;
      selectedPlayerId=null;
      autocompleteMode=false;

      setQuickReadyLoading(true,{
        title:'Analisi strategie CPU...',
        text:'Calcolo budget, priorità e obiettivi delle 10 squadre.',
        step:'Strategie',
        progress:7
      });
      await quickReadyYield(20);

      let globalGuard=0;
      const MAX_GENERATED=TOTAL_SLOTS*state.managers.length+20;

      if(openRoleAuction()){
        setQuickReadyLoading(true,{title:'Generazione rosa a ruoli liberi...',text:'Assegno giocatori di tutti i ruoli.',step:'Asta libera',progress:8});
        while(!allRostersComplete() && globalGuard++<TOTAL_SLOTS*state.managers.length*5){
          const nominator=state.managers[state.nominationIndex];
          const player=chooseNomination(nominator)||state.availableIds.map(id=>playerMap.get(id)).find(item=>item&&canOwn(nominator,item)&&maxLegalBid(nominator,item)>=1);
          if(!player || !quickAwardGeneratedPlayer(player,nominator)) break;
          registerNominationCall(nominator.id,player.role);
          state.nominationIndex=nextNominatorIndex(state.nominationIndex);
          if(globalGuard%4===0){
            const done=state.managers.reduce((sum,manager)=>sum+manager.roster.length,0);
            setQuickReadyLoading(true,{text:`${done} / ${TOTAL_SLOTS*state.managers.length} giocatori assegnati`,step:'Asta libera',progress:8+done/(TOTAL_SLOTS*state.managers.length)*87});
            await quickReadyYield(0);
          }
        }
      }else for (let roleIndex=0; roleIndex<ROLE_ORDER.length; roleIndex++) {
        state.currentRoleIndex=roleIndex;
        const role=ROLE_ORDER[roleIndex];
        let roleGuard=0;
        let chunkCounter=0;

        updateQuickReadyProgress(role,'avvio reparto');
        await quickReadyYield(12);

        while (!rolePhaseComplete(role) && roleGuard++<ROLE_LIMITS[role]*state.managers.length*4) {
          globalGuard++;
          if (globalGuard>MAX_GENERATED) break;

          let idx=state.nominationIndex;
          if (roleSlotsRemaining(state.managers[idx],role)<=0) idx=nextNominatorIndex(idx);
          state.nominationIndex=idx;
          const nominator=state.managers[idx];

          let player=chooseNomination(nominator);
          if (!player) {
            player=state.availableIds
              .map(id=>playerMap.get(id))
              .find(p=>p && p.role===role && canOwn(nominator,p));
          }
          if (!player) break;

          if (!quickAwardGeneratedPlayer(player,nominator)) {
            // Absolute fallback: assign the called player to its nominator at the minimum legal price.
            if (canOwn(nominator,player) && maxLegalBid(nominator,player)>=1) {
              const price=1;
              nominator.budget-=price;
              nominator.roster.push({
                id:player.id,name:player.name,role:player.role,club:player.club,
                ovr:player.ovr,quotation:player.quotation,fvm:player.fvm,price
              });
              recordUserAuctionPick(player,nominator.id);
              state.availableIds=state.availableIds.filter(id=>id!==player.id);
              state.stats.purchases++;
              state.stats.totalSpent+=price;
            } else break;
          }

          registerNominationCall(nominator.id,player.role);

          if (!rolePhaseComplete(role)) state.nominationIndex=nextNominatorIndex(idx);

          // Spezza il calcolo in piccoli blocchi: la UI resta viva e leggibile.
          chunkCounter++;
          if (chunkCounter>=4) {
            chunkCounter=0;
            updateQuickReadyProgress(role,player?.name||'');
            await quickReadyYield(0);
          }
        }

        updateQuickReadyProgress(role,'reparto completato');
        await quickReadyYield(25);

        if (!rolePhaseComplete(role)) {
          console.warn('Generazione rose rapide incompleta nel reparto',role);
          break;
        }
        state.nominationIndex=0;
      }

      setQuickReadyLoading(true,{
        title:'Controllo finale...',
        text:'Verifico rose, budget e assegnazioni.',
        step:'Controllo integrità',
        progress:97
      });
      await quickReadyYield(35);

      state.currentRoleIndex=ROLE_ORDER.length;
      state.auction=null;
      state.completed=allRostersComplete();
      auditAndRepairState('quick-ready-rosters');
      saveState();

      if (state.completed) {
        setQuickReadyLoading(true,{
          title:'Rose pronte!',
          text:'Tutte le 10 squadre sono state generate correttamente.',
          step:'Completato',
          progress:100
        });
        await quickReadyYield(260);
        setQuickReadyLoading(false);
        renderSummary();
      } else {
        setQuickReadyLoading(false);
        await window.PixelDialog.alert({eyebrow:'GENERAZIONE ROSE',title:'Rose incomplete',message:'Non sono riuscito a generare tutte le rose. Riprova con un nuovo salvataggio.',confirmLabel:'TORNA AL MENU',tone:'danger'});
        showScreen('setupScreen');
      }
    } catch (err) {
      console.error('Errore generazione rose rapide',err);
      setQuickReadyLoading(false);
      await window.PixelDialog.alert({eyebrow:'ERRORE',title:'Generazione interrotta',message:'Si è verificato un errore durante la generazione delle rose. Riprova.',confirmLabel:'TORNA AL MENU',tone:'danger'});
      showScreen('setupScreen');
    }
  }


  // ========================= V3.2.5 — EVENTI ASTA =========================
  const AUCTION_EVENT_CHANCE=window.FantaAuctionEvents.settings.chance;
  function ensureAuctionEvents(){
    if(!state.auctionEvents) state.auctionEvents={count:0,lastPurchaseAt:-99,history:[],activeEffects:[],pending:null,relationships:{}};
    const ae=state.auctionEvents; ae.history=ae.history||[]; ae.activeEffects=ae.activeEffects||[]; ae.relationships=ae.relationships||{}; return ae;
  }
  function auctionEffects(type){ return state?.auctionEvents?.activeEffects?.filter(e=>e.type===type) || []; }
  function relationship(cpuId){
    const ae=ensureAuctionEvents();
    const r=ae.relationships[cpuId] ||= {trust:50,rivalry:0,agreements:0,betrayals:0,duels:0,respectedPacts:0,duelModelVersion:2,notes:[]};
    if(!Number.isFinite(Number(r.duels))) r.duels=0;
    if(!Number.isFinite(Number(r.respectedPacts))) r.respectedPacts=0;
    // Migrazione V3.2.35.44: i vecchi salvataggi contavano come "duello" anche
    // incroci molto brevi. Non li facciamo diventare automaticamente RIVALI CALDI
    // con le regole nuove: al massimo conserviamo due duelli pregressi.
    if(Number(r.duelModelVersion||0)<2){
      r.duels=Math.min(2,Math.max(0,Number(r.duels||0)));
      r.duelModelVersion=2;
    }
    r.notes=Array.isArray(r.notes)?r.notes:[];
    return r;
  }
  function changeRelationship(cpuId,trustDelta=0,rivalryDelta=0,note=''){
    const r=relationship(cpuId); r.trust=clamp(r.trust+trustDelta,0,100); r.rivalry=clamp(r.rivalry+rivalryDelta,0,100);
    if(note){r.notes.push(note); if(r.notes.length>12) r.notes=r.notes.slice(-12);} if(note.includes('tradimento')) r.betrayals++;
  }
  function registerDirectAuctionDuel(cpuId){
    const a=state?.auction;
    if(!a || !cpuId || cpuId==='user' || autocompleteMode) return;
    a.userDuelCpuIds=Array.isArray(a.userDuelCpuIds)?a.userDuelCpuIds:[];
    a.lastDirectCpuId=cpuId;
    if(a.userDuelCpuIds.includes(cpuId)) return;
    // Conta come memoria di rivalità solo una chiamata già combattuta: prima del
    // nuovo rilancio devono esserci almeno 3 offerte, quindi il cambio di leader
    // che segue porta il duello ad almeno 4 rilanci complessivi.
    if(Number(a.bidCount||0)<3) return;
    a.userDuelCpuIds.push(cpuId);
    const manager=state.managers.find(m=>m.id===cpuId);
    const wasHot=isHotRival(manager);
    const r=relationship(cpuId);
    r.duels=Number(r.duels||0)+1;
    r.rivalry=clamp(Number(r.rivalry||0)+2,0,100);
    if(!wasHot && isHotRival(manager)) showToast(`🔥 ${manager?.profile?.label||'Un avversario'} è diventato RIVALE CALDO.`);
  }

  function resolveRespectedAuctionPact(playerId){
    const pact=auctionEffects('non_aggression_pact').find(e=>e.playerId===playerId);
    if(!pact || pact.relationshipResolved || pact.userBetrayed || pact.cpuBetrayed) return;
    const cpu=state.managers.find(m=>m.id===pact.cpuId);
    if(!cpu) return;
    const wasGood=hasGoodRelations(cpu);
    pact.relationshipResolved=true;
    const r=relationship(cpu.id);
    r.respectedPacts=Number(r.respectedPacts||0)+1;
    changeRelationship(cpu.id,8,-2,'patto_rispettato');
    if(!wasGood && hasGoodRelations(cpu)) showToast(`🤝 ${cpu.profile?.label||cpu.team}: BUONI RAPPORTI.`);
  }
  function lateInRole(){ const role=currentAuctionRole(); const missing=state.managers.reduce((n,m)=>n+roleSlotsRemaining(m,role),0); return missing<=4; }
  function eventEligibleBase(){
    return !!state && !state.completed && !!state.auction && !state.auction.awarding && !ensureAuctionEvents().pending;
  }
  function cpuEventCandidates(){ return state.managers.filter(m=>m.id!=='user' && m.roster.length<TOTAL_SLOTS); }
  function sharedInterestingPlayers(cpu,limit=3){
    const role=currentAuctionRole(), me=state.managers[0];
    return state.availableIds.map(id=>playerMap.get(id)).filter(p=>p&&p.role===role&&canOwn(me,p)&&canOwn(cpu,p)&&maxLegalBid(me,p)>=1&&maxLegalBid(cpu,p)>=1)
      .map(p=>({p,score:baseAuctionValue(p)+cpuLimit(cpu,p)*.55+Number(p.ovr||0)*.25}))
      .sort((a,b)=>b.score-a.score).slice(0,Math.max(limit,8)).sort(()=>Math.random()-.5).slice(0,limit).map(x=>x.p);
  }
  function auctionEventAlreadyShown(type){
    return ensureAuctionEvents().history.some(item=>item.type===type);
  }
  function eventRolePlayers(){
    const role=currentAuctionRole(), me=state.managers[0];
    return state.availableIds.map(id=>playerMap.get(id)).filter(p=>p&&p.role===role&&canOwn(me,p)&&maxLegalBid(me,p)>=1);
  }
  function tablePressureEligible(){
    const cpus=cpuEventCandidates();
    if(!cpus.length) return false;
    const me=state.managers[0];
    const avgBudget=cpus.reduce((sum,m)=>sum+Number(m.budget||0),0)/cpus.length;
    const myQuality=(me.roster||[]).reduce((sum,p)=>sum+Number(p.ovr||0),0);
    const avgQuality=cpus.reduce((sum,m)=>sum+(m.roster||[]).reduce((s,p)=>s+Number(p.ovr||0),0),0)/cpus.length;
    return Number(me.budget||0)>=avgBudget*.97 || myQuality>=avgQuality*1.04;
  }
  function availableEventTypes(){
    const types=[]; const cpus=cpuEventCandidates(); if(!cpus.length) return types;
    if(!auctionEffects('non_aggression_pact').length && cpus.some(c=>sharedInterestingPlayers(c,1).length)) types.push({id:'pact',weight:26,rarity:'RARO'});
    if(state.availableIds.some(id=>playerMap.get(id)?.role===currentAuctionRole())){
      types.push({id:'info',weight:18,rarity:'COMUNE'});
      types.push({id:'contested',weight:18,rarity:'COMUNE'});
      types.push({id:'crazy',weight:18,rarity:'RARO'});
      types.push({id:'opportunity',weight:17,rarity:'COMUNE'});
      types.push({id:'untouchable',weight:15,rarity:'RARO'});
      types.push({id:'sudden',weight:18,rarity:'COMUNE'});
    }
    const duel=cpus.find(c=>relationship(c.id).rivalry>=12) || cpus.find(c=>profileArchetype(c)==='rivale');
    if(duel) types.push({id:'war',weight:10,rarity:'RARO'});
    if(tablePressureEligible()) types.push({id:'pressure',weight:14,rarity:'RARO'});
    return types;
  }
  function weightedPick(items){ let total=items.reduce((n,x)=>n+x.weight,0),r=Math.random()*total; for(const x of items){r-=x.weight;if(r<=0)return x;} return items[0]; }
  function maybeTriggerAuctionEvent(){
    if(!eventEligibleBase() || Math.random()>=AUCTION_EVENT_CHANCE) return false;
    const types=availableEventTypes(); if(!types.length) return false;
    // Se un tipo non è costruibile in questa specifica situazione, prova gli altri
    // senza effettuare un secondo tiro percentuale: la probabilità resta 10% per chiamata.
    const remaining=[...types];
    let ev=null;
    while(remaining.length && !ev){
      const pick=weightedPick(remaining);
      ev=buildAuctionEvent(pick.id,pick.rarity);
      if(!ev){ const i=remaining.indexOf(pick); if(i>=0) remaining.splice(i,1); }
    }
    if(!ev)return false;
    const ae=ensureAuctionEvents();
    ae.count++;
    ae.lastPurchaseAt=state.stats.purchases;
    ae.pending=ev;
    ae.history.push({id:ev.id,type:ev.type,atPurchase:state.stats.purchases,atPlayerId:state.auction?.playerId||null,status:'shown'});
    if(state.auction) state.auction.awaitingAuctionEvent=true;
    saveState();
    showAuctionEventModal(ev);
    return true;
  }
  function pickCpu(preferred){ const pool=cpuEventCandidates(); return pool.find(m=>profileArchetype(m)===preferred)||pool[Math.floor(Math.random()*pool.length)]; }
  function buildAuctionEvent(type,rarity){
    if(type==='pact'){ const cpu=pickCpu('ragioniere'); if(!cpu)return null; const players=sharedInterestingPlayers(cpu,3); if(!players.length)return null; return {id:`pact_${Date.now()}`,type,rarity,cpuId:cpu.id,playerIds:players.map(p=>p.id),refreshUsed:false}; }
    if(type==='info'){ const cpu=pickCpu('esperto'); const pool=eventRolePlayers(); if(!cpu||!pool.length)return null; const top=pool.sort((a,b)=>baseAuctionValue(b)-baseAuctionValue(a)).slice(0,Math.min(8,pool.length)); const pl=top[Math.floor(Math.random()*top.length)]; return {id:`info_${Date.now()}`,type,rarity,cpuId:cpu.id,playerId:pl.id,truth:Math.random()<({esperto:.88,ragioniere:.78,stratega:.84,pazzo:.48}[profileArchetype(cpu)]||.65)}; }
    if(type==='contested'){ const cpu=pickCpu('spendaccione'); const pool=sharedInterestingPlayers(cpu,8); if(!cpu||!pool.length)return null; const pl=pool[Math.floor(Math.random()*pool.length)]; return {id:`contested_${Date.now()}`,type,rarity,cpuId:cpu.id,playerId:pl.id,bluff:Math.random()<.28}; }
    if(type==='war'){ const cpu=cpuEventCandidates().sort((a,b)=>relationship(b.id).rivalry-relationship(a.id).rivalry)[0]; if(!cpu)return null; return {id:`war_${Date.now()}`,type,rarity,cpuId:cpu.id}; }
    if(type==='crazy'){
      const rolePlayers=eventRolePlayers(); const players=rolePlayers.sort((a,b)=>baseAuctionValue(b)-baseAuctionValue(a)).slice(0,Math.min(14,rolePlayers.length));
      if(!players.length)return null;
      const pl=players[Math.floor(Math.random()*Math.min(7,players.length))];
      const interested=cpuEventCandidates().filter(cpu=>canOwn(cpu,pl)&&maxLegalBid(cpu,pl)>=1).sort(()=>Math.random()-.5).slice(0,Math.min(4,Math.max(3,cpuEventCandidates().length)));
      if(interested.length<2)return null;
      return {id:`crazy_${Date.now()}`,type,rarity,playerId:pl.id,cpuIds:interested.map(x=>x.id),multiplier:1.16};
    }
    if(type==='opportunity'){
      const cpus=cpuEventCandidates();
      const pool=eventRolePlayers().map(pl=>{
        const base=Math.max(1,baseAuctionValue(pl));
        const legal=cpus.filter(cpu=>canOwn(cpu,pl)&&maxLegalBid(cpu,pl)>=1);
        const avg=legal.length?legal.reduce((sum,cpu)=>sum+cpuLimit(cpu,pl),0)/legal.length:base;
        const ratio=avg/base;
        const quality=Number(pl.ovr||0)+base*.12;
        return {pl,score:quality+(1.08-ratio)*30};
      }).sort((a,b)=>b.score-a.score).slice(0,6);
      if(!pool.length)return null;
      const pl=pool[Math.floor(Math.random()*pool.length)].pl;
      return {id:`opportunity_${Date.now()}`,type,rarity,playerId:pl.id,multiplier:.82};
    }
    if(type==='untouchable'){
      const preferred=['collezionista','spendaccione','tifoso','bomber'];
      const rank=(m)=>{const i=preferred.indexOf(profileArchetype(m));return i<0?99:i;}; const candidates=cpuEventCandidates().slice().sort((a,b)=>rank(a)-rank(b));
      for(const cpu of candidates){
        const pool=sharedInterestingPlayers(cpu,6).sort((a,b)=>cpuLimit(cpu,b)-cpuLimit(cpu,a));
        if(pool.length){ const pl=pool[Math.floor(Math.random()*Math.min(3,pool.length))]; return {id:`untouchable_${Date.now()}`,type,rarity,cpuId:cpu.id,playerId:pl.id,multiplier:1.24}; }
      }
      return null;
    }
    if(type==='pressure'){
      if(!tablePressureEligible())return null;
      return {id:`pressure_${Date.now()}`,type,rarity,remainingCalls:4,multiplier:1.10};
    }
    if(type==='sudden'){
      const players=eventRolePlayers().sort((a,b)=>baseAuctionValue(b)-baseAuctionValue(a)).slice(0,18);
      if(!players.length)return null;
      const shuffled=players.slice().sort(()=>Math.random()-.5);
      for(const pl of shuffled){
        const base=Math.max(1,baseAuctionValue(pl));
        const cpus=cpuEventCandidates().filter(cpu=>canOwn(cpu,pl)&&maxLegalBid(cpu,pl)>=1).map(cpu=>({cpu,ratio:cpuLimit(cpu,pl)/base})).filter(x=>x.ratio<1.08).sort((a,b)=>a.ratio-b.ratio);
        if(cpus.length){ const pick=cpus[Math.floor(Math.random()*Math.min(4,cpus.length))]; return {id:`sudden_${Date.now()}`,type,rarity,cpuId:pick.cpu.id,playerId:pl.id,multiplier:1.22,activated:false}; }
      }
      return null;
    }
    return null;
  }
  function eventPortrait(cpu){ const art=cpu&&RIVAL_ART[profileArchetype(cpu)]; return art?`<img src="assets/rivals/${art}.webp" alt="${escapeHtml(cpu.profile?.label||cpu.team)}">`:`<span>${escapeHtml(playerInitials(cpu?.name||'?'))}</span>`; }
  function auctionEventGenericPortrait(ev,cpu){
    if(ev.type==='crazy') return '<span>🔥</span>';
    if(ev.type==='opportunity') return '<span>💎</span>';
    if(ev.type==='pressure') return '<span>👀</span>';
    return eventPortrait(cpu);
  }
  function showAuctionEventModal(ev){
    const modal=$('auctionEventModal'); if(!modal||!ev)return;
    const cpu=state.managers.find(m=>m.id===ev.cpuId), p=playerMap.get(ev.playerId);
    $('auctionEventPortrait').innerHTML=auctionEventGenericPortrait(ev,cpu);
    $('auctionEventRarity').textContent=ev.rarity||'EVENTO';
    let title='',desc='',body='',actions='';
    if(ev.type==='pact'){ title='Patto di non belligeranza'; desc=`${cpu.profile?.label||cpu.team} ti propone un accordo: evitare una guerra di rilanci su un obiettivo comune.`; body=`<div class="event-player-choices">${ev.playerIds.map((id,i)=>{const x=playerMap.get(id);return `<button class="event-player-choice ${id===(ev.selectedPlayerId||ev.playerIds[0])?'selected':''}" data-event-player="${id}"><b>${escapeHtml(x.name)}</b><span>${x.role} · OVR ${x.ovr} · Quot. ${x.quotation}</span></button>`}).join('')}</div><p class="event-rule">Se uno dei due è in testa, l'altro dovrebbe ritirarsi. Il patto può essere tradito.</p>`; actions=`<button data-event-action="reject" class="event-btn ghost">Rifiuta</button>${ev.refreshUsed?'':`<button data-event-action="refresh" class="event-btn secondary">Altri nomi</button>`}<button data-event-action="accept" class="event-btn primary">Accetta il patto</button>`; }
    if(ev.type==='info'){ title='Informazione riservata'; desc=`${cpu.profile?.label||cpu.team} ti passa una voce su ${p.name}: potrebbe perdere il posto da titolare.`; body=`<div class="event-info-card"><b>${escapeHtml(p.name)}</b><span>${p.role} · ${escapeHtml(clubName(p.club))} · OVR ${p.ovr}</span></div><p class="event-rule">La fonte potrebbe avere ragione oppure no. Fidarti ridurrà il valore attribuito al giocatore nelle funzioni automatiche.</p>`; actions=`<button data-event-action="ignore" class="event-btn ghost">Ignora</button><button data-event-action="trust" class="event-btn primary">Fidati</button>`; }
    if(ev.type==='contested'){ title='Giocatore conteso'; desc=`${cpu.profile?.label||cpu.team} dichiara pubblicamente: “${p.name} è il mio obiettivo.”`; body=`<div class="event-info-card"><b>${escapeHtml(p.name)}</b><span>${p.role} · ${escapeHtml(clubName(p.club))}</span></div><p class="event-rule">Potrebbe essere sincero o bluffare. La dichiarazione influenza anche l'interesse degli altri allenatori.</p>`; actions=`<button data-event-action="continue" class="event-btn primary">Continua l'asta</button>`; }
    if(ev.type==='war'){ title='Guerra personale'; desc=`${cpu.profile?.label||cpu.team} si è stancato dei duelli e decide di renderti la vita più difficile.`; body=`<p class="event-rule">Per le prossime 3 chiamate, quando siete entrambi coinvolti, la sua valutazione massima aumenta.</p>`; actions=`<button data-event-action="continue" class="event-btn primary">Accetta la sfida</button>`; }
    if(ev.type==='crazy'){
      const names=(ev.cpuIds||[]).map(id=>state.managers.find(m=>m.id===id)?.profile?.label||state.managers.find(m=>m.id===id)?.team).filter(Boolean);
      title='Asta impazzita';
      desc=`Il tavolo si accende improvvisamente su ${p.name}. Più allenatori hanno deciso di spingersi oltre il loro piano iniziale.`;
      body=`<div class="event-info-card"><b>${escapeHtml(p.name)}</b><span>${p.role} · ${escapeHtml(clubName(p.club))} · OVR ${p.ovr}</span></div><p class="event-rule">${escapeHtml(names.slice(0,4).join(', '))} saranno più aggressivi quando ${escapeHtml(p.name)} entrerà in asta.</p>`;
      actions='<button data-event-action="continue" class="event-btn primary">Vediamo cosa succede</button>';
    }
    if(ev.type==='opportunity'){
      title='Occasione di mercato';
      desc=`Al tavolo sembra esserci poco interesse per ${p.name}. Potrebbe essere il momento giusto per provare a prenderlo sotto prezzo.`;
      body=`<div class="event-info-card"><b>${escapeHtml(p.name)}</b><span>${p.role} · ${escapeHtml(clubName(p.club))} · OVR ${p.ovr}</span></div><p class="event-rule">Le CPU saranno temporaneamente meno aggressive su questo giocatore. L'occasione resta valida finché è disponibile.</p>`;
      actions='<button data-event-action="continue" class="event-btn primary">Segnalo l\'occasione</button>';
    }
    if(ev.type==='untouchable'){
      title='Giocatore intoccabile';
      desc=`${cpu.profile?.label||cpu.team} mette le cose in chiaro: “${p.name} è il mio uomo. Non lo lascio.”`;
      body=`<div class="event-info-card"><b>${escapeHtml(p.name)}</b><span>${p.role} · ${escapeHtml(clubName(p.club))} · OVR ${p.ovr}</span></div><p class="event-rule">Quell'allenatore alzerà sensibilmente il proprio tetto di spesa. Se glielo soffi, la rivalità tra voi aumenterà.</p>`;
      actions='<button data-event-action="continue" class="event-btn primary">Sfida accettata</button>';
    }
    if(ev.type==='pressure'){
      title='Pressione del tavolo';
      desc='Gli altri allenatori hanno iniziato a considerarti una minaccia e stanno osservando con più attenzione le tue mosse.';
      body='<p class="event-rule">Per le prossime 3 chiamate in cui puoi partecipare, le CPU saranno mediamente più aggressive contro di te.</p>';
      actions='<button data-event-action="continue" class="event-btn primary">Continua</button>';
    }
    if(ev.type==='sudden'){
      title='Interesse improvviso';
      desc=`${cpu.profile?.label||cpu.team} sembrava freddo su ${p.name}, ma qualcosa è cambiato.`;
      body=`<div class="event-info-card"><b>${escapeHtml(p.name)}</b><span>${p.role} · ${escapeHtml(clubName(p.club))}</span></div><p class="event-rule">Quando il giocatore entrerà in asta, quell'allenatore potrà inserirsi improvvisamente durante i rilanci con una valutazione più alta.</p>`;
      actions='<button data-event-action="continue" class="event-btn primary">Continua l\'asta</button>';
    }
    $('auctionEventTitle').textContent=title; $('auctionEventDescription').textContent=desc; $('auctionEventBody').innerHTML=body; $('auctionEventActions').innerHTML=actions; modal.dataset.eventId=ev.id; $('auctionEventRestoreBtn')?.classList.add('hidden'); modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
    modal.querySelectorAll('[data-event-player]').forEach(b=>b.onclick=()=>{modal.querySelectorAll('[data-event-player]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');ev.selectedPlayerId=b.dataset.eventPlayer;saveState();});
    modal.querySelectorAll('[data-event-action]').forEach(b=>b.onclick=()=>resolveAuctionEvent(b.dataset.eventAction));
  }
  function resolveAuctionEvent(action){ const ae=ensureAuctionEvents(),ev=ae.pending;if(!ev)return; const cpu=state.managers.find(m=>m.id===ev.cpuId);
    if(ev.type==='pact'&&action==='refresh'){ ev.refreshUsed=true; const ids=sharedInterestingPlayers(cpu,6).map(p=>p.id).filter(id=>!ev.playerIds.includes(id)); ev.playerIds=(ids.slice(0,3).length?ids.slice(0,3):ev.playerIds); ev.selectedPlayerId=null; saveState(); return showAuctionEventModal(ev); }
    if(ev.type==='pact'&&action==='accept'){ const playerId=ev.selectedPlayerId||ev.playerIds[0]; ae.activeEffects.push({type:'non_aggression_pact',cpuId:ev.cpuId,playerId,createdAt:state.stats.purchases,userBetrayed:false,cpuBetrayed:false}); relationship(ev.cpuId).agreements++; changeRelationship(ev.cpuId,5,-2,'patto_accettato'); showToast(`Patto attivo su ${playerMap.get(playerId)?.name}.`); }
    if(ev.type==='pact'&&action==='reject') changeRelationship(ev.cpuId,-2,1,'patto_rifiutato');
    if(ev.type==='info'&&action==='trust'){ ae.activeEffects.push({type:'reserved_info',cpuId:ev.cpuId,playerId:ev.playerId,trusted:true,truth:ev.truth}); changeRelationship(ev.cpuId,ev.truth?3:-2,0,'info_ascoltata'); }
    if(ev.type==='contested'&&action==='continue') ae.activeEffects.push({type:'contested_player',cpuId:ev.cpuId,playerId:ev.playerId,bluff:ev.bluff});
    if(ev.type==='war'&&action==='continue') ae.activeEffects.push({type:'personal_war',managerId:ev.cpuId,remainingCalls:4});
    if(ev.type==='crazy'&&action==='continue') ae.activeEffects.push({type:'crazy_auction',playerId:ev.playerId,cpuIds:[...(ev.cpuIds||[])],multiplier:Number(ev.multiplier||1.16)});
    if(ev.type==='opportunity'&&action==='continue') ae.activeEffects.push({type:'market_opportunity',playerId:ev.playerId,multiplier:Number(ev.multiplier||.82)});
    if(ev.type==='untouchable'&&action==='continue') ae.activeEffects.push({type:'untouchable_player',cpuId:ev.cpuId,playerId:ev.playerId,multiplier:Number(ev.multiplier||1.24)});
    if(ev.type==='pressure'&&action==='continue') ae.activeEffects.push({type:'table_pressure',remainingCalls:Number(ev.remainingCalls||4),multiplier:Number(ev.multiplier||1.10)});
    if(ev.type==='sudden'&&action==='continue') ae.activeEffects.push({type:'sudden_interest',cpuId:ev.cpuId,playerId:ev.playerId,multiplier:Number(ev.multiplier||1.22),activated:false});
    ae.history[ae.history.length-1].status=action;
    ae.pending=null;
    closeAuctionEventModal();
    const liveAuction=state.auction;
    if(liveAuction?.awaitingAuctionEvent){
      liveAuction.awaitingAuctionEvent=false;
      saveState();
      renderAll();
      return beginBidRound();
    }
    saveState(); renderAll(); if(state.managers[state.nominationIndex].id!=='user') scheduleNomination();
  }
  function minimizeAuctionEventModal(){
    const modal=$('auctionEventModal'), restore=$('auctionEventRestoreBtn');
    if(!state?.auctionEvents?.pending||!modal||!restore)return;
    modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
    restore.classList.remove('hidden'); restore.focus();
  }
  function restoreAuctionEventModal(){
    const modal=$('auctionEventModal'), restore=$('auctionEventRestoreBtn');
    if(!state?.auctionEvents?.pending||!modal||!restore)return;
    restore.classList.add('hidden'); modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
    $('auctionEventMinimizeBtn')?.focus();
  }
  function closeAuctionEventModal(){ const m=$('auctionEventModal');if(m){m.classList.add('hidden');m.setAttribute('aria-hidden','true');} $('auctionEventRestoreBtn')?.classList.add('hidden'); }
  function activePactForPlayer(playerId){ if(state?.auction?.arcade?.type==='mystery' && state.auction.playerId===playerId)return null; return auctionEffects('non_aggression_pact').find(e=>e.playerId===playerId); }
  function cpuKeepsPact(cpu,pact){ const base={ragioniere:.95,esperto:.90,stratega:.85,tirchio:.85,moneyball:.80,tifoso:.70,spendaccione:.55,pazzo:.35,rivale:.62,gambler:.48,bomber:.68,collezionista:.60}[profileArchetype(cpu)]??.72; const rel=relationship(cpu.id); return Math.random()<clamp(base+(rel.trust-50)*.004-rel.rivalry*.002,.15,.99); }
  async function showPactBetrayPrompt(pact,increment){
    const cpu=state.managers.find(m=>m.id===pact.cpuId),p=playerMap.get(pact.playerId);
    const betray=await window.PixelDialog.confirm({eyebrow:'PATTO ATTIVO',title:'Vuoi tradire l’accordo?',message:`${cpu.profile?.label||cpu.team} è in testa su ${p.name}. Se rilanci perderai fiducia e aumenterà la rivalità.`,consequence:`Rilancio +${increment} · Fiducia −25 · Rivalità +28`,confirmLabel:`TRADISCI E RILANCIA +${increment}`,cancelLabel:'RISPETTA IL PATTO',tone:'danger'});
    if(!betray) return;
    pact.userBetrayed=true;
    changeRelationship(cpu.id,-25,28,'tradimento_user');
    showToast(`${cpu.profile?.label||cpu.team} ricorderà il tradimento.`,true);
    saveState();
    userBid(increment);
  }
  function tickAuctionEventEffectsOnNomination(playerId){
    const ae=ensureAuctionEvents();
    for(const e of ae.activeEffects){
      if(e.type==='personal_war'&&e.remainingCalls>0)e.remainingCalls--;
      if(e.type==='table_pressure'&&e.remainingCalls>0&&state?.auction?.activeIds?.includes('user')) e.remainingCalls--;
    }
    ae.activeEffects=ae.activeEffects.filter(e=>{
      if(e.type==='personal_war'||e.type==='table_pressure') return Number(e.remainingCalls||0)>0;
      if(['non_aggression_pact','reserved_info','contested_player','crazy_auction','market_opportunity','untouchable_player','sudden_interest'].includes(e.type)) return state.availableIds.includes(e.playerId);
      return true;
    });
    const p=playerMap.get(playerId);
    if(!p||!state?.auction)return;
    if(auctionEffects('crazy_auction').some(e=>e.playerId===playerId)) showToast(`🔥 ASTA IMPAZZITA su ${p.name}: più CPU sono pronte a spingersi oltre.`);
    if(auctionEffects('market_opportunity').some(e=>e.playerId===playerId)) showToast(`💎 OCCASIONE DI MERCATO: il tavolo sembra freddo su ${p.name}.`);
    const untouchable=auctionEffects('untouchable_player').find(e=>e.playerId===playerId);
    if(untouchable){ const cpu=state.managers.find(m=>m.id===untouchable.cpuId); if(cpu) showToast(`⚠ ${cpu.profile?.label||cpu.team} considera ${p.name} INTOCCABILE.`); }
  }

  function applyPreAuctionPack(draft){
    if(!draft || draft.preAuctionPack || !leagueRulesFor(draft).packOpening || Number(draft.career?.division||4)>3) return false;
    const occupied=new Set(draft.managers.flatMap(m=>m.roster.map(p=>String(p.id))));
    const available=new Set(draft.availableIds.map(String));
    const seed=String(draft.marketSeed||draft.startedAt||'pack');
    const allocations=[];
    for(const role of ['P','D','C','A']){
      const pool=(window.FANTA_PLAYERS||[]).filter(p=>p.role===role && available.has(String(p.id)) && !occupied.has(String(p.id)))
        .sort((a,b)=>randomHash(`${seed}|pack|${a.id}`)-randomHash(`${seed}|pack|${b.id}`));
      if(pool.length<draft.managers.length) throw new Error('Listone insufficiente per Spacchettamento');
      draft.managers.forEach((manager,index)=>{
        if(manager.budget<4 || manager.roster.filter(p=>p.role===role).length>=ROLE_LIMITS[role]) throw new Error('Rosa o budget incompatibili con Spacchettamento');
        allocations.push({manager,player:pool[index]});
      });
    }
    const assignments={};
    allocations.forEach(({manager,player})=>{
      manager.roster.push({...player,price:1});manager.budget-=1;
      occupied.add(String(player.id));
      (assignments[manager.id]||=[]).push(String(player.id));
      draft.stats.purchases++;draft.stats.totalSpent++;
    });
    draft.availableIds=draft.availableIds.filter(id=>!occupied.has(String(id)));
    draft.preAuctionPack={assignments,presented:false};
    draft.log.unshift('SPACCHETTAMENTO · 4 giocatori a 1 credito per ogni allenatore');
    return true;
  }

  function showPreAuctionPack(){
    const pack=state?.preAuctionPack;
    if(!pack || pack.presented) return false;
    document.getElementById('preAuctionPackModal')?.remove();
    const modal=document.createElement('div');modal.id='preAuctionPackModal';modal.className='pack-opening-modal';
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Spacchettamento');
    const players=(pack.assignments.user||[]).map(id=>playerMap.get(id)).filter(Boolean);
    modal.innerHTML=`<section class="pack-opening-dialog"><h2>SPACCHETTAMENTO</h2><p>Il tuo pacchetto · 1 P, 1 D, 1 C, 1 A · 4 crediti totali</p><div class="pixel-pack"><span class="pixel-pack-edition">FANTALLENATORE PACK</span><img class="pixel-pack-brand" src="assets/pack-fantallenatore-logo.webp" alt="Fantallenatore Approved"><span class="pixel-pack-roles"><i>P</i><i>D</i><i>C</i><i>A</i></span><strong>4 GIOCATORI · 1 CREDITO</strong></div><div class="pack-opening-cards"></div><div class="pack-opening-actions"><button class="secondary" data-pack-skip> SALTA ANIMAZIONE </button><button class="primary big" data-pack-next>APRI PACCHETTO</button></div></section>`;
    document.body.appendChild(modal);
    const grid=modal.querySelector('.pack-opening-cards'),next=modal.querySelector('[data-pack-next]');
    let revealed=0,opened=false;
    const reveal=()=>{
      if(!opened) modal.classList.add('is-pack-burst');
      opened=true;modal.querySelector('.pixel-pack').classList.add('is-open');
      if(revealed<players.length){
        const p=players[revealed++],analysis=auctionPlayerAnalysis(p);
        const card=document.createElement('article');card.className=`pack-player-card ${currentPlayerOvr(p)>=85?'is-top':''}`;
        card.innerHTML=`<span>${escapeHtml(p.role)} · OVR ${currentPlayerOvr(p)}</span><div class="pack-player-face">${playerAvatarMarkup(p,p.name)}</div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(clubShort(p.club))}</small><b>1 CREDITO</b>${auctionObserverActive()?`<small>Pot. ${escapeHtml(analysis.label)} · Tit. ${analysis.starterPct}%</small>`:''}`;
        grid.appendChild(card);card.scrollIntoView?.({block:'nearest',behavior:'smooth'});
      }
      next.textContent=revealed===players.length?'CONTINUA ALL’ASTA':`SCOPRI GIOCATORE ${revealed+1}/4`;
    };
    next.onclick=()=>{
      if(opened && revealed===players.length){pack.presented=true;saveState();modal.remove();renderAll();if(state.managers[state.nominationIndex]?.id!=='user')scheduleNomination();return;}
      reveal();
    };
    modal.querySelector('[data-pack-skip]').onclick=()=>{while(revealed<players.length)reveal();next.focus();};
    modal.onkeydown=e=>{if(e.key==='Tab'){const skip=modal.querySelector('[data-pack-skip]');if(e.shiftKey&&document.activeElement===skip){e.preventDefault();next.focus();}else if(!e.shiftKey&&document.activeElement===next){e.preventDefault();skip.focus();}}};
    next.focus();return true;
  }

  function startAuction(fromCareer=false) {
    prepareNewGame(fromCareer);
    hideRoleTransitionModal();
    selectedPlayerId = null;
    roleRemainderAutoSim = false;
    autocompleteMode = false;
    hideRoleRemainderAutoSim();
    saveState();
    showScreen('auctionScreen');
    renderAll();
    showPreAuctionPack();
  }

  async function resumeAuction() {
    stopGameRuntime();
    state = await loadSaved();
    if (!state) return;
    syncSerieATransferWorld(state);
    if(openRoleAuction() && $('roleFilter')) $('roleFilter').value='ALL';
    auditAndRepairState('resume');
    autocompleteMode = false;
    $('turboToggle').checked = !!state.turbo;
    if (state.completed) {
      const active=state.season?.activeLive;
      const activeResult=active && state.season.matchdayResults?.[String(active.day)];
      if(active?.reviewComplete && activeResult) {
        serieALive=hydrateSerieALive(active);
        serieAMatchesExpanded=true;
        showScreen('serieALiveScreen');
        renderSerieALive();
        return;
      }
      if(active && active.day===state.season.currentMatchday && !activeResult) {
        serieALive=hydrateSerieALive(active);
        showScreen('serieALiveScreen');
        renderSerieALive();
        if(serieALive.phase!=='between') restartSerieALiveTimer();
        return;
      }
      if(state.season?.pendingBigMatch?.snapshot){
        serieALive=hydrateSerieALive(state.season.pendingBigMatch.snapshot,'between');
        state.season.activeLive=snapshotSerieALive(serieALive);
        saveState();
        showScreen('serieALiveScreen');
        renderSerieALive();
        return;
      }
      if(state.season?.started && state.season?.completed) return renderSeasonDashboard();
      if(state.winterMarketFlow?.stage==='trades') return renderTradeWindow('winter');
      if(!state.season?.started && currentTradeWindow('summer').stage!=='completed') return renderTradeWindow('summer');
      return state.season?.started ? renderSeasonDashboard() : renderSummary();
    }
    showScreen('auctionScreen');
    if(state.roleTransition){
      renderAll();
      showRoleTransitionModal();
      return;
    }
    advanceRolePhaseIfNeeded();
    if (!state.auction && (openRoleAuction()?!managerCanNominate(state.managers[state.nominationIndex]):roleSlotsRemaining(state.managers[state.nominationIndex], currentAuctionRole())<=0)) {
      state.nominationIndex = nextNominatorIndex(state.nominationIndex);
    }
    renderAll();
    if (state.auctionEvents?.pending) { showAuctionEventModal(state.auctionEvents.pending); return; }
    if(!openRoleAuction() && !rolePhaseComplete(currentAuctionRole()) && userCompletedCurrentRole(currentAuctionRole())) {
      beginRoleRemainderAutoSim(currentAuctionRole());
      renderAll();
    }
    if(showPreAuctionPack()) return;
    if (state.auction) {
      // A paused local file should never expire while closed: resuming starts a fresh 5-second window.
      state.auction.awaitingUser = false;
      state.auction.awarding = false;
      state.auction.presenting = false;
      beginBidRound();
    } else if (state.managers[state.nominationIndex].id!=='user') scheduleNomination();
  }

  async function autoCompleteAuction() {
    if (!state || state.completed) return;
    if (!await window.PixelDialog.confirm({eyebrow:'AUTOCOMPLETAMENTO',title:'Completare automaticamente l’asta?',message:'Anche la tua squadra verrà gestita da una CPU neutrale fino alla fine dell’asta.',consequence:'L’operazione non può essere annullata durante la simulazione.',confirmLabel:'COMPLETA ASTA',cancelLabel:'ANNULLA',tone:'warning'})) return;
    autocompleteMode = true;
    state.turbo = true;
    $('turboToggle').checked = true;
    if (state.auction) {
      state.auction.awaitingUser = false;
      beginBidRound();
    } else {
      scheduleNomination();
    }
    renderTurn();
  }

  async function resetGame() {
    if (!await window.PixelDialog.confirm({eyebrow:'RESET CARRIERA',title:'Cancellare il salvataggio?',message:'Perderai asta, rose, campionato e progressi della carriera presenti su questo dispositivo.',consequence:'Questa operazione non può essere annullata.',confirmLabel:'CANCELLA TUTTO',cancelLabel:'MANTIENI SALVATAGGIO',tone:'danger'})) return;
    stopGameRuntime();
    await clearSaved();
    state = null;
    careerDraft = null;
    $('careerSetupScreen')?.classList.add('hidden');
    autocompleteMode = false;
    showScreen('setupScreen');
    updateResumeButton();
  }

  async function updateResumeButton() {
    const s = await loadSaved();
    $('resumeBtn').classList.toggle('hidden', !s);
    if (s) $('resumeBtn').textContent = 'RIPRENDI SALVATAGGIO';
  }

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }


  const RIVAL_ART = {
    bomber:'bomberista',ragioniere:'ragioniere',spendaccione:'spendaccione',tirchio:'tirchio',
    moneyball:'moneyball',tifoso:'tifoso',collezionista:'collezionista',esperto:'esperto',
    pazzo:'pazzo',gambler:'gambler',stratega:'ds_stratega',rivale:'rivale',
    squalo:'squalo',camaleonte:'camaleonte',fantadata:'fantadata',predatore:'predatore',broker:'broker',admin:'admin'
  };

  const RIVAL_PRESENTATION = {
    bomber:        { description:'Vive per i bomber. Investe tutto in attacco.', tags:['OFFENSIVO','BOMBER'], tone:'red' },
    ragioniere:    { description:'Calcoli e bilancio. Sempre sul pezzo.', tags:['EQUILIBRATO','GESTIONE'], tone:'blue' },
    spendaccione:  { description:'Non bada a spese. Ama i top player.', tags:['AGGRESSIVO','BIG NAMES'], tone:'red' },
    tirchio:       { description:'Aspetta gli affari. Mai una spesa folle.', tags:['DIFENSIVO','AFFARI'], tone:'green' },
    moneyball:     { description:'Numeri e statistiche. Valore prima del nome.', tags:['STRATEGICO','UNDERDOG'], tone:'blue' },
    esperto:       { description:'Tattica ed esperienza. Conosce il gioco.', tags:['EQUILIBRATO','COMPLETEZZA'], tone:'violet' },
    tifoso:        { description:'Compra i suoi beniamini. Segue sempre il cuore.', tags:['EMOTIVO','FEDELTÀ'], tone:'orange' },
    pazzo:         { description:'Imprevedibile. Fa mosse folli.', tags:['IMPREVEDIBILE','RISCHIO'], tone:'pink' },
    collezionista: { description:'Vuole tutti i top. Ama i giocatori simbolo.', tags:['AGGRESSIVO','COLLEZIONE'], tone:'red' },
    rivale:        { description:'Vuole batterti. Osserva e ti copia.', tags:['COMPETITIVO','ANTI-JHZ'], tone:'crimson' },
    gambler:       { description:'Ama il rischio. Rilancia senza paura.', tags:['AUDACE','RISCHIO'], tone:'pink' },
    stratega:      { description:'Pianifica ogni mossa. Cura tutti i reparti.', tags:['STRATEGICO','PIANIFICAZIONE'], tone:'violet' },
    squalo:        { description:'Sente il sangue nell’acqua e alza il ritmo dell’asta.', tags:['AGGRESSIVO','TOP HUNTER'], tone:'crimson' },
    camaleonte:    { description:'Si adatta al tavolo e cambia pelle in base alla situazione.', tags:['ADATTIVO','LETTURA'], tone:'green' },
    fantadata:     { description:'Vive di numeri, proiezioni e vantaggi marginali.', tags:['DATI','ANALISI'], tone:'violet' },
    predatore:     { description:'Aspetta l’attimo giusto e colpisce i giocatori più appetitosi.', tags:['PRESSIONE','ISTINTO'], tone:'orange' },
    broker:        { description:'Muove capitali e tratta come un vero re del mercato.', tags:['LUSSO','TRATTATIVE'], tone:'blue' },
    admin:         { description:'Il boss della Serie A. Rosa equilibrata, asta lucida e One Shot: una volta per asta prende un giocatore a 1 credito.', tags:['BOSS FINALE','ONE SHOT · 1 USO'], tone:'violet' }
  };


  const FIXTURE_HERO_THEMES = {
    user:{ primary:'#ffd84d', secondary:'#7051ff', panel:'rgba(22,19,49,.82)', line:'rgba(255,216,77,.72)', glow:'rgba(255,216,77,.18)' },
    blue:{ primary:'#72d5ff', secondary:'#2b7cff', panel:'rgba(8,22,59,.82)', line:'rgba(93,201,255,.72)', glow:'rgba(93,201,255,.18)' },
    red:{ primary:'#ffba63', secondary:'#ff5e63', panel:'rgba(48,17,34,.82)', line:'rgba(255,106,124,.68)', glow:'rgba(255,106,124,.18)' },
    green:{ primary:'#8bffb8', secondary:'#2fbe6c', panel:'rgba(12,42,35,.82)', line:'rgba(92,242,133,.68)', glow:'rgba(92,242,133,.17)' },
    violet:{ primary:'#c8a5ff', secondary:'#7e5cff', panel:'rgba(30,14,59,.84)', line:'rgba(160,135,239,.72)', glow:'rgba(139,104,255,.20)' },
    pink:{ primary:'#ff97d2', secondary:'#e553a3', panel:'rgba(57,15,50,.82)', line:'rgba(255,122,194,.70)', glow:'rgba(255,122,194,.18)' },
    orange:{ primary:'#ffc57a', secondary:'#ff8a47', panel:'rgba(58,26,12,.82)', line:'rgba(255,164,87,.74)', glow:'rgba(255,164,87,.18)' },
    crimson:{ primary:'#ff8b99', secondary:'#d73b53', panel:'rgba(62,17,28,.84)', line:'rgba(255,99,123,.72)', glow:'rgba(255,99,123,.20)' }
  };


  const FIXTURE_TEAM_COLORS = {
    user:          { primary:'#ffd84d', secondary:'#6e4fd6' },
    bomber:        { primary:'#e53935', secondary:'#111111' },
    ragioniere:    { primary:'#3d7dff', secondary:'#dbe8ff' },
    spendaccione:  { primary:'#e2ad32', secondary:'#8f2433' },
    tirchio:       { primary:'#39b66a', secondary:'#10271a' },
    moneyball:     { primary:'#40c9e8', secondary:'#173d74' },
    tifoso:        { primary:'#2678d8', secondary:'#101010' },
    collezionista: { primary:'#f4f1df', secondary:'#c79a2f' },
    esperto:       { primary:'#8b68d9', secondary:'#2c1c4e' },
    pazzo:         { primary:'#e553a3', secondary:'#241126' },
    gambler:       { primary:'#eb5a61', secondary:'#342066' },
    stratega:      { primary:'#735fe5', secondary:'#1f2344' },
    rivale:        { primary:'#d83d55', secondary:'#27222f' },
    squalo:        { primary:'#61b8ff', secondary:'#16365a' },
    camaleonte:    { primary:'#7edb67', secondary:'#1f3f2a' },
    fantadata:     { primary:'#6f83ff', secondary:'#2d2454' },
    predatore:     { primary:'#ffb54d', secondary:'#5b2c12' },
    broker:        { primary:'#62d3d7', secondary:'#1f2d45' },
    admin:         { primary:'#a648dd', secondary:'#161020' }
  };

  function fixtureTeamColors(manager, isUser=false){
    if(isUser || manager?.id==='user') return FIXTURE_TEAM_COLORS.user;
    if(manager?.teamColors?.primary && manager?.teamColors?.secondary) return manager.teamColors;
    return FIXTURE_TEAM_COLORS[profileArchetype(manager)] || FIXTURE_TEAM_COLORS.ragioniere;
  }

  function applyFixtureTeamColors(element, colors){
    if(!element || !colors) return;
    element.style.setProperty('--team-primary', colors.primary);
    element.style.setProperty('--team-secondary', colors.secondary);
  }

  function seasonFixtureTheme(manager, isUser=false){
    if(isUser || manager?.id==='user') return FIXTURE_HERO_THEMES.user;
    const tone = RIVAL_PRESENTATION[profileArchetype(manager)]?.tone || 'blue';
    return FIXTURE_HERO_THEMES[tone] || FIXTURE_HERO_THEMES.blue;
  }

  function teamBadgeInitials(team){
    const clean = String(team || '').replace(/[^A-Za-zÀ-ÿ0-9 ]+/g,' ').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if(words.length >= 2) return (words[0][0] + words[1][0]).slice(0,2).toUpperCase();
    return clean.slice(0,2).toUpperCase() || 'FC';
  }

  function simpleHash(value){
    let hash = 0;
    const str = String(value || '');
    for(let i=0;i<str.length;i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    return Math.abs(hash);
  }

  function buildPixelCrestData(label, palette){
    const seed = simpleHash(label);
    const cells = [];
    const startX = 23, startY = 22, size = 8;
    for(let y=0;y<5;y++){
      for(let x=0;x<3;x++){
        const bit = ((seed >> (y*3 + x)) & 1) === 1 || (y===0 && x===1);
        if(!bit) continue;
        const left = startX + x*size;
        const mirror = startX + (4-x)*size;
        const top = startY + y*size;
        cells.push(`<rect x="${left}" y="${top}" width="${size}" height="${size}" fill="${palette.primary}"/>`);
        if(mirror !== left) cells.push(`<rect x="${mirror}" y="${top}" width="${size}" height="${size}" fill="${palette.primary}"/>`);
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" shape-rendering="crispEdges">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette.secondary}"/><stop offset="1" stop-color="#0b1024"/></linearGradient>
      </defs>
      <path d="M24 10h48l12 12v25c0 18-13 29-36 39C25 76 12 65 12 47V22z" fill="url(#g)" stroke="${palette.line}" stroke-width="4"/>
      <path d="M27 15h42l8 8v22c0 14-10 23-29 31C29 68 19 59 19 45V23z" fill="rgba(255,255,255,.05)"/>
      ${cells.join('')}
      <rect x="22" y="60" width="52" height="6" fill="${palette.line}" opacity="0.55"/>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function buildCoachSilhouette(label, palette){
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 76" shape-rendering="crispEdges">
      <path d="M15 76V61c0-12 10-20 23-20s23 8 23 20v15z" fill="${palette.secondary}" stroke="#07101e" stroke-width="3"/>
      <path d="M25 46l13 13 13-13 6 5-9 25H28l-9-25z" fill="${palette.panel}"/>
      <path d="M29 40h18v12l-9 7-9-7z" fill="#d8a36f"/>
      <path d="M23 20h30v13c0 12-7 18-15 18s-15-6-15-18z" fill="#efbd82" stroke="#07101e" stroke-width="3"/>
      <path d="M22 25V15h5V9h22v5h5v15h-6V20H29v5z" fill="${palette.primary}" stroke="#07101e" stroke-width="3"/>
      <rect x="28" y="30" width="5" height="4" fill="#07101e"/><rect x="43" y="30" width="5" height="4" fill="#07101e"/>
      <path d="M31 41h14v4H31z" fill="#8b4938"/>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function renderFixtureCrest(targetId, team, theme){
    const el = $(targetId);
    if(!el) return;
    const initials = teamBadgeInitials(team);
    el.innerHTML = `<img src="${buildPixelCrestData(team, theme)}" alt="Stemma ${escapeHtml(team)}"><span>${escapeHtml(initials)}</span>`;
  }

  function renderFixtureCoachPortrait(targetId, manager, theme){
    const el = $(targetId);
    if(!el) return;
    el.classList.add('is-coach-portrait');
    if(manager?.id==='user'){
      const coach={id:'coach-user',name:manager.name||state?.managerName||'Mister',avatarCustomization:normalizedCoachAvatar(state?.coachAvatar)};
      el.innerHTML=`<img src="${pixelPlayerAvatarData(coach)}" alt="Avatar di ${escapeHtml(coach.name)}">`;
      return;
    }
    if(manager && manager.id !== 'user'){
      const art = RIVAL_ART[profileArchetype(manager)];
      if(art){
        el.innerHTML = `<img src="assets/rivals/${art}.webp" alt="${escapeHtml(manager.profile?.label || manager.name || 'Allenatore')}">`;
        return;
      }
    }
    el.innerHTML = `<img src="${buildCoachSilhouette(manager?.name || 'Mister', theme)}" alt="Allenatore">`;
  }

  function applySeasonFixtureHeroVisuals(me, opponent){
    const userTheme = seasonFixtureTheme(me, true);
    const opponentTheme = seasonFixtureTheme(opponent, false);
    const fixtureTeams=document.querySelectorAll('#seasonScreen .next-fixture .fixture-team');
    applyFixtureTeamColors(fixtureTeams[0], fixtureTeamColors(me, true));
    applyFixtureTeamColors(fixtureTeams[1], fixtureTeamColors(opponent, false));
    // Finché non sono disponibili stemmi ufficiali, il volto del mister
    // diventa l'immagine principale della squadra nel box Prossima partita.
    renderFixtureCoachPortrait('seasonUserCrest', me || {id:'user', name:state.managerName || 'Mister'}, userTheme);
    renderFixtureCoachPortrait('seasonOpponentCrest', opponent, opponentTheme);
    if($('seasonUserCoachPortrait')) $('seasonUserCoachPortrait').innerHTML = '';
    if($('seasonOpponentCoachPortrait')) $('seasonOpponentCoachPortrait').innerHTML = '';
  }

  function rivalCards(managers) {
    return (managers||[]).filter(m=>m.id!=='user').map(m=>{
      const archetype=profileArchetype(m);
      const art=RIVAL_ART[archetype];
      const presentation=RIVAL_PRESENTATION[archetype] || {description:'Un avversario da non sottovalutare.',tags:['RIVALE','ASTA'],tone:'violet'};
      const portrait=art?`<img src="assets/rivals/${art}.webp" alt="${escapeHtml(m.profile.label)}">`
        :`<span class="rival-initials" aria-hidden="true">${escapeHtml(playerInitials(m.name))}</span>`;
      return `<article class="visible-rival-card rival-tone-${escapeHtml(presentation.tone)}">
        <div class="rival-avatar">${portrait}</div>
        <div class="rival-info">
          <strong>${escapeHtml(m.profile.label)}</strong>
          <p>${escapeHtml(presentation.description)}</p>
          <div class="rival-tags"><span>${escapeHtml(presentation.tags[0])}</span><span>${escapeHtml(presentation.tags[1])}</span></div>
        </div>
      </article>`;
    }).join('');
  }

  function renderVisibleRivals(){
    if($('visibleRivals')) $('visibleRivals').innerHTML=rivalCards(state?.managers);
  }

  function renderCareerAvatarEditor(){
    if(!careerDraft) return;
    const avatar=normalizedCoachAvatar(careerDraft.coachAvatar);
    careerDraft.coachAvatar=avatar;
    document.querySelectorAll('#careerTeamStep [data-coach-avatar]').forEach(select=>{
      select.value=avatar[select.dataset.coachAvatar];
    });
    const preview=$('careerAvatarPreview');
    if(preview){
      preview.src=pixelPlayerAvatarData({id:'coach-user',name:$('coachNameInput')?.value||'Mister',avatarCustomization:avatar});
      preview.alt=`Anteprima di ${$('coachNameInput')?.value.trim()||'Mister'}`;
    }
  }

  function updateCareerAvatarEditor(){
    if(!careerDraft) return;
    const selected={};
    document.querySelectorAll('#careerTeamStep [data-coach-avatar]').forEach(select=>{
      selected[select.dataset.coachAvatar]=select.value;
    });
    careerDraft.coachAvatar=normalizedCoachAvatar(selected);
    renderCareerAvatarEditor();
  }

  function careerIdentity({focus=false}={}){
    const teamInput=$('careerTeamNameInput'),coachInput=$('coachNameInput');
    const teamName=teamInput?.value.trim()||'';
    const managerName=coachInput?.value.trim()||'';
    if(!managerName || !teamName){
      if(focus) (!managerName?coachInput:teamInput)?.focus();
      return null;
    }
    return {teamName,managerName};
  }

  function updateCareerIdentityControls(){
    const valid=!!careerIdentity();
    if($('careerIdentityNextBtn')) $('careerIdentityNextBtn').disabled=!valid;
    if($('careerContinueBtn')) $('careerContinueBtn').disabled=!valid;
    if($('quickReadyBtn')) $('quickReadyBtn').disabled=!valid;
    if($('careerIdentityHint')) $('careerIdentityHint').textContent=valid
      ? 'Nomi inseriti. Premi → per creare il tuo personaggio.'
      : 'Inserisci entrambi i nomi per continuare.';
  }

  function setInitialCareerCatalog(pokemon){
    if(!careerDraft || nextSeasonSetupMode) return;
    careerDraft.catalogMode=pokemon?'pokemon':'base';
    careerDraft.pokemonCatalogSeed=pokemon?careerDraft.marketSeed:null;
    careerDraft.transferMarket=TransferEngine.createMarketState(`${careerDraft.marketSeed}|${careerDraft.catalogMode}`);
    careerDraft.playerBaseOvr={};
    activateCatalogBase(careerDraft);
    syncSerieATransferWorld(careerDraft);
    careerDraft.availableIds=(window.FANTA_PLAYERS||[]).map(player=>String(player.id));
    if($('careerCatalogModeHint')) $('careerCatalogModeHint').textContent=pokemon?'ON · Campionato Pokémon':'OFF · Campionato classico';
  }

  function showCareerTeamSubstep(step='identity'){
    const allowed=['identity','avatar','launch'];
    careerTeamSubstep=allowed.includes(step)?step:'identity';
    document.querySelectorAll('#careerTeamStep [data-career-team-substep]').forEach(section=>{
      section.classList.toggle('hidden',section.dataset.careerTeamSubstep!==careerTeamSubstep);
    });
    if(careerTeamSubstep==='avatar') renderCareerAvatarEditor();
    if(careerTeamSubstep==='launch') updateResumeButton();
  }

  function advanceCareerIdentityStep(){
    if(!careerDraft) return;
    const identity=careerIdentity({focus:true});
    if(!identity) return;
    careerDraft.teamName=identity.teamName;
    careerDraft.managerName=identity.managerName;
    careerDraft.managers[0].team=identity.teamName;
    careerDraft.managers[0].name=identity.managerName;
    showCareerTeamSubstep('avatar');
  }

  function openCareerSetup(){
    nextSeasonSetupMode=false;
    careerDraft=freshState($('teamNameInput').value.trim()||'Team JHZ', $('managerNameInput').value.trim()||'Mister');
    careerPowerSelection=[];
    careerRulesNextAction='auction';
    const title=document.querySelector('#careerSetupScreen .career-title h2');
    const subtitle=document.querySelector('#careerSetupScreen .career-title p');
    if(title) title.textContent='Costruisci la squadra e conquista il campionato';
    if(subtitle) subtitle.innerHTML=`Stagione <span data-game-season></span> · <span data-game-league></span>`;
    if($('careerPowersBackBtn')) $('careerPowersBackBtn').textContent='← AVVIO CARRIERA';
    applyGameConfiguration();
    $('careerTeamNameInput').value='';
    $('coachNameInput').value='';
    if($('careerPokemonToggle')) $('careerPokemonToggle').checked=false;
    if($('careerCatalogModeHint')) $('careerCatalogModeHint').textContent='OFF · Campionato classico';
    updateCareerIdentityControls();
    renderCareerAvatarEditor();
    showCareerSetupStep('team');
    showCareerTeamSubstep('identity');
    renderCareerPowerSelection();
    $('careerSetupScreen').classList.remove('hidden');
  }

  function showCareerSetupStep(step){
    $('careerTeamStep')?.classList.toggle('hidden',step!=='team');
    $('careerPowersStep')?.classList.toggle('hidden',step!=='powers');
    $('careerRulesStep')?.classList.toggle('hidden',step!=='rules');
  }

  function continueCareerSetup(){
    if(!careerDraft)return;
    const identity=careerIdentity({focus:true});
    if(!identity) return;
    const {teamName,managerName}=identity;
    careerDraft.teamName=teamName;
    careerDraft.managerName=managerName;
    careerDraft.managers[0].team=teamName;
    careerDraft.managers[0].name=managerName;
    showCareerSetupStep('powers');
  }

  function syncCareerIdentity(){
    if(!careerDraft)return false;
    const identity=careerIdentity({focus:true});
    if(!identity)return false;
    const {teamName,managerName}=identity;
    careerDraft.teamName=teamName;
    careerDraft.managerName=managerName;
    careerDraft.managers[0].team=teamName;
    careerDraft.managers[0].name=managerName;
    return true;
  }

  function rerollPreAuctionRules(){
    const id='cons_reroll_rules';
    // Only the next-season setup can spend items from the completed season.
    if(!nextSeasonSetupMode || !careerDraft || careerDraft.auction || careerDraft.stats?.purchases>0) return false;
    const season=state?.season,flow=state?.nextSeasonFlow;
    if(!season?.completed || !flow || flow.stage!=='market_summary') return false;
    const inventory=season.consumables?.inventory;
    const quantity=Math.max(0,Math.floor(Number(inventory?.[id]||0)));
    if(quantity<1 || Number(careerDraft.carryoverConsumables?.[id]||0)<1) return false;
    const signature=rules=>JSON.stringify([rules.selectedCategories.slice().sort(),PRE_AUCTION_RULE_DEFS.map(rule=>rules[rule.id])]);
    const previous=signature(leagueRulesFor(careerDraft));
    for(let attempt=0;attempt<100;attempt++){
      careerDraft.leagueRulesRerollCount=Math.max(0,Number(careerDraft.leagueRulesRerollCount||0))+1;
      careerDraft.leagueRules=defaultLeagueRules();
      generatePreAuctionLeagueRules(careerDraft);
      if(signature(careerDraft.leagueRules)!==previous) break;
    }
    inventory[id]=quantity-1;
    careerDraft.carryoverConsumables[id]=quantity-1;
    season.consumables.usageHistory.push({id,day:season.currentMatchday,note:'reroll_pre_auction_rules',usedAt:Date.now()});
    // Persist the outcome as well as the spent item, including when setup is closed.
    flow.preAuctionRules=JSON.parse(JSON.stringify(careerDraft.leagueRules));
    flow.preAuctionRulesRerollCount=careerDraft.leagueRulesRerollCount;
    saveState();
    renderCareerLeagueRules();
    showToast(`Regolamento risorteggiato · Rimescola Regole rimasti: ${quantity-1}.`);
    return true;
  }

  function renderCareerLeagueRules(){
    if(!careerDraft) return;
    const rules=generatePreAuctionLeagueRules(careerDraft);
    const cards=leagueRuleCardData(careerDraft);
    const grid=$('careerRulesGrid');
    if(grid){
      grid.innerHTML=cards.map((card,index)=>`<article class="career-rule-card career-admin-rule-card formation-flip-card type-rule rarity-${escapeHtml(card.rarity)} rule-${escapeHtml(card.id)}" data-career-rule-card="${escapeHtml(card.id)}" tabindex="0" role="button" aria-label="Carta regolamento Admin ${formationChoiceRarityLabel(card.rarity)}. Clicca per girare.">
        <div class="formation-flip-inner">
          <section class="formation-card-face formation-card-front">
            <img class="formation-card-cover" src="${adminRuleCover(card.rarity)}" alt="Regolamento Admin">
            <span class="formation-card-index">${index+1}</span>
            <div class="career-admin-rule-front-copy">
              <span class="career-admin-rule-kicker">${card.rarity==='rare'?'REGOLA RARA':'REGOLAMENTO STAGIONE'}</span>
              <strong>${escapeHtml(card.title)}</strong>
              <b>${escapeHtml(card.label)}</b>
            </div>
            <div class="formation-card-front-footer">
              <span class="formation-card-front-category">REGOLA ADMIN</span>
              <button type="button" class="formation-card-flip-btn" data-career-rule-flip="${escapeHtml(card.id)}">GIRA ↻</button>
            </div>
          </section>
          <section class="formation-card-face formation-card-back">
            <div class="formation-card-back-top">
              <span class="formation-choice-icon">${card.icon}</span>
              <span class="formation-choice-category">REGOLA STAGIONE</span>
              <span class="formation-card-rarity rarity-${escapeHtml(card.rarity)}">${card.rarity==='rare'?'RARA · ATTIVA':'ATTIVA'}</span>
            </div>
            <div class="formation-card-back-copy career-admin-rule-back-copy">
              <strong>${escapeHtml(card.title)}</strong>
              <b>${escapeHtml(card.label)}</b>
              <small>${escapeHtml(card.detail)}</small>
              <small class="career-admin-rule-effect">${escapeHtml(leagueRuleEffectText(card.id,card.value))}</small>
            </div>
            <div class="formation-card-back-footer career-admin-rule-back-footer">
              <button type="button" class="formation-card-flip-back-btn" data-career-rule-flip="${escapeHtml(card.id)}">↺ RIGIRA</button>
              <span class="career-admin-rule-accepted">GIÀ ATTIVA ✓</span>
            </div>
          </section>
        </div>
      </article>`).join('');
      grid.querySelectorAll('[data-career-rule-card]').forEach(card=>{
        const toggle=()=>{
          const flipped=card.classList.toggle('is-flipped');
          card.setAttribute('aria-label',flipped?'Carta regolamento girata. Leggi descrizione ed effetti.':'Carta regolamento coperta. Clicca per girare.');
        };
        card.addEventListener('click',e=>{
          if(e.target.closest('[data-career-rule-flip]')) return;
          toggle();
        });
        card.addEventListener('keydown',e=>{
          if((e.key==='Enter' || e.key===' ') && !e.target.closest('button')){
            e.preventDefault();
            toggle();
          }
        });
        card.querySelectorAll('[data-career-rule-flip]').forEach(btn=>btn.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }));
      });
    }
    const standard=$('careerRulesStandard');
    const offered=rules.selectedCategories.includes('alternateCatalog');
    const choice=$('careerCatalogChoice');
    choice?.classList.toggle('hidden',!offered);
    if(offered){
      const current=careerDraft.catalogMode==='pokemon'?'Pokémon':'Serie A';
      const next=current==='Pokémon'?'Serie A':'Pokémon';
      if($('careerCatalogChoiceText')) $('careerCatalogChoiceText').textContent=`Listone attuale: ${current}. Se accetti, passerai al listone ${next} dall’asta. Se rifiuti, resti nel mondo attuale.`;
      choice?.querySelectorAll('[data-catalog-decision]').forEach(button=>{
        button.classList.toggle('selected',rules.catalogDecision===button.dataset.catalogDecision);
        button.setAttribute('aria-pressed',String(rules.catalogDecision===button.dataset.catalogDecision));
      });
    }
    if(standard){
      standard.innerHTML=`<h4>REGOLE PROSSIMA STAGIONE</h4><div class="career-rules-recap-grid">${PRE_AUCTION_RULE_DEFS.map(rule=>{
        const value=rules[rule.id];
        const selected=rules.selectedCategories.includes(rule.id);
        const title=rule.id==='cleanSheetBonus'&&Number(value)===2?'Porta inviolata mega':rule.title;
        if(['alternateCatalog','freeRoleAuction'].includes(rule.id) && Number(careerDraft.career?.division||4)>3) return '';
        const label=rule.id==='alternateCatalog'?(selected?(rules.catalogDecision==='accept'?'CAMBIO ACCETTATO':rules.catalogDecision==='reject'?'CAMBIO RIFIUTATO':'DA DECIDERE'):'NON ESTRATTA'):rule.label(value);
        const shownLabel=rule.id==='freeRoleAuction'&&!selected?'ASTA PER REPARTI':label;
        return `<div class="career-rules-recap-item"><span>${escapeHtml(title)} <em>${selected?'ESTRATTA':'STANDARD'}</em></span><strong>${escapeHtml(shownLabel)}</strong><small>${escapeHtml(selected?rule.detail(value):rule.id==='freeRoleAuction'?'L’asta segue i reparti P → D → C → A.':rule.detail(value))}</small></div>`;
      }).join('')}</div>`;
    }
    const reroll=$('careerRulesRerollBtn');
    if(reroll){
      const quantity=nextSeasonSetupMode?Math.max(0,Math.floor(Number(careerDraft.carryoverConsumables?.cons_reroll_rules||0))):0;
      reroll.textContent=`🎲 RIMESCOLA REGOLE · ${quantity} DISPONIBILI`;
      reroll.disabled=quantity<1;
    }
    const proceed=$('careerRulesContinueBtn');
    const back=$('careerRulesBackBtn');
    if(proceed){
      proceed.textContent=careerRulesNextAction==='ready'?'GENERA LE ROSE':'INIZIA L’ASTA';
      proceed.disabled=offered && !rules.catalogDecision;
    }
    if(back) back.textContent=careerRulesNextAction==='ready'?'← SQUADRA':'← FANTAPOTERI';
  }

  function openCareerRulesStep(nextAction='auction'){
    if(!careerDraft) return;
    if(!syncCareerIdentity()) return;
    careerRulesNextAction=nextAction==='ready'?'ready':'auction';
    generatePreAuctionLeagueRules(careerDraft);
    renderCareerLeagueRules();
    showCareerSetupStep('rules');
  }

  function startReadyRostersFromCareer(){
    if(!careerDraft)return;
    openCareerRulesStep('ready');
  }

  function proceedFromCareerRules(){
    if(!careerDraft || !syncCareerIdentity()) return;
    const rules=leagueRulesFor(careerDraft);
    if(rules.selectedCategories.includes('alternateCatalog') && !rules.catalogDecision) return;
    if(careerRulesNextAction==='ready'){
      generateReadyRosters(true);
      return;
    }
    startAuction(true);
  }

  function backFromCareerRules(){
    if(careerRulesNextAction==='ready'){
      showCareerSetupStep('team');
      showCareerTeamSubstep('launch');
    }else showCareerSetupStep('powers');
  }

  function showGameInstructions(){
    window.GameGuide.open();
  }

  function careerPowerSlotCost(selection=careerPowerSelection){
    return (selection||[]).reduce((sum,power)=>sum+(['observer','oneShot'].includes(power)?3:1),0);
  }

  function renderCareerPowerSelection(){
    const exclusivePower=careerPowerSelection.find(power=>['observer','oneShot'].includes(power));
    const usedSlots=careerPowerSlotCost();
    document.querySelectorAll('[data-career-power]').forEach(card=>{
      const power=card.dataset.careerPower;
      const selected=careerPowerSelection.includes(power);
      const lockedByExclusive=!!exclusivePower && power!==exclusivePower;
      card.classList.toggle('selected',selected);
      card.classList.toggle('power-locked-by-observer',lockedByExclusive);
      card.setAttribute('aria-pressed',String(selected));
      const stateLabel=card.querySelector('.career-power-state');
      if(stateLabel){
        if(selected && ['observer','oneShot'].includes(power)) stateLabel.textContent='SELEZIONATO · OCCUPA 3 SLOT';
        else if(lockedByExclusive) stateLabel.textContent='BLOCCATO DA POTERE ESCLUSIVO';
        else stateLabel.textContent=selected?'SELEZIONATO':'CLICCA PER SELEZIONARE';
      }
      card.setAttribute('aria-disabled', String(lockedByExclusive));
    });
    if($('careerPowerCounter')) $('careerPowerCounter').textContent=`${usedSlots} / 3 SLOT UTILIZZATI`;
    if($('careerStartAuctionBtn')) $('careerStartAuctionBtn').disabled=usedSlots!==3;
  }


  function toggleCareerPower(power){
    if(!['block','scout','bluff','observer','oneShot'].includes(power))return;

    if(['observer','oneShot'].includes(power)){
      if(careerPowerSelection.includes(power)) careerPowerSelection=[];
      else careerPowerSelection=[power];
      renderCareerPowerSelection();
      return;
    }

    const exclusivePower=careerPowerSelection.find(x=>['observer','oneShot'].includes(x));
    if(exclusivePower){
      showToast(`${exclusivePower==='observer'?'OSSERVATORE':'ONE SHOT'} occupa tutti e 3 gli slot: deselezionalo per scegliere altri Fantapoteri.`,true);
      return;
    }

    if(careerPowerSelection.includes(power)) careerPowerSelection=careerPowerSelection.filter(x=>x!==power);
    else if(careerPowerSlotCost()<3) careerPowerSelection.push(power);
    else { showToast('Hai già utilizzato tutti e 3 gli slot Fantapotere.',true); return; }
    renderCareerPowerSelection();
  }

  function startCareerAuction(){
    if(!careerDraft || careerPowerSlotCost()!==3)return;
    if(!syncCareerIdentity())return;
    careerDraft.auctionPowers={block:false,scout:false,bluff:false,observer:false,oneShot:false,uses:{block:0,scout:0,bluff:0,oneShot:0},selected:[...careerPowerSelection]};
    openCareerRulesStep('auction');
  }

  function prepareNewGame(fromCareer=false){
    const teamInput=fromCareer?$('careerTeamNameInput'):$('teamNameInput');
    const managerInput=fromCareer?$('coachNameInput'):$('managerNameInput');
    const teamName=teamInput.value.trim()||'Team JHZ';
    const managerName=managerInput.value.trim()||'Mister';
    stopGameRuntime();
    state=fromCareer && careerDraft?careerDraft:freshState(teamName,managerName);
    applyCatalogDecision(state);
    syncSerieATransferWorld(state);
    applySeasonKeeper(state);
    applyPreAuctionPack(state);
    if($('roleFilter')) $('roleFilter').value=openRoleAuction()?'ALL':'P';
    state.teamName=teamName; state.managerName=managerName;
    state.managers[0].team=teamName; state.managers[0].name=managerName;
    $('teamNameInput').value=teamName; $('managerNameInput').value=managerName;
    careerDraft=null;
    nextSeasonSetupMode=false;
    $('careerSetupScreen').classList.add('hidden');
    applyGameConfiguration();
    renderVisibleRivals();
  }

  // Events
  document.addEventListener('keydown',event=>{
    const modal=$('arcadeAuctionModal');
    if(event.key!=='Tab' || !modal || modal.classList.contains('hidden'))return;
    const controls=[...modal.querySelectorAll('input,select,button')];
    if(!controls.length)return;
    if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus();}
    else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();}
  });
  document.addEventListener('click',event=>{
    const action=event.target.closest('[data-arcade-action]')?.dataset.arcadeAction;
    if(action) handleArcadeAction(action);
  });
  $('startBtn').addEventListener('click',openCareerSetup);
  $('instructionsBtn')?.addEventListener('click',showGameInstructions);
  document.querySelectorAll('#careerTeamStep [data-coach-avatar]').forEach(select=>select.addEventListener('change',updateCareerAvatarEditor));
  $('coachNameInput')?.addEventListener('input',renderCareerAvatarEditor);
  $('coachNameInput')?.addEventListener('input',updateCareerIdentityControls);
  $('careerTeamNameInput')?.addEventListener('input',updateCareerIdentityControls);
  $('careerPokemonToggle')?.addEventListener('change',event=>setInitialCareerCatalog(!!event.target.checked));
  $('careerIdentityNextBtn')?.addEventListener('click',advanceCareerIdentityStep);
  $('careerAvatarBackBtn')?.addEventListener('click',()=>showCareerTeamSubstep('identity'));
  $('careerAvatarNextBtn')?.addEventListener('click',()=>showCareerTeamSubstep('launch'));
  $('careerLaunchBackBtn')?.addEventListener('click',()=>showCareerTeamSubstep('avatar'));
  $('careerContinueBtn')?.addEventListener('click',continueCareerSetup);
  $('careerStartAuctionBtn')?.addEventListener('click',startCareerAuction);
  $('careerRulesRerollBtn')?.addEventListener('click',rerollPreAuctionRules);
  $('careerRulesContinueBtn')?.addEventListener('click',proceedFromCareerRules);
  document.querySelectorAll('#careerCatalogChoice [data-catalog-decision]').forEach(button=>button.addEventListener('click',()=>{
    if(!careerDraft) return;
    careerDraft.leagueRules.catalogDecision=button.dataset.catalogDecision;
    renderCareerLeagueRules();
  }));
  $('careerRulesBackBtn')?.addEventListener('click',backFromCareerRules);
  $('careerPowersBackBtn')?.addEventListener('click',()=>{ if(nextSeasonSetupMode){ $('careerSetupScreen')?.classList.add('hidden'); careerDraft=null; careerPowerSelection=[]; nextSeasonSetupMode=false; renderNextSeasonFlow(); } else { showCareerSetupStep('team'); showCareerTeamSubstep('launch'); } });
  document.querySelectorAll('[data-career-power]').forEach(card=>{
    card.addEventListener('click',()=>{
      if(card.getAttribute('aria-disabled')==='true') return;
      toggleCareerPower(card.dataset.careerPower);
    });
    card.addEventListener('keydown',(event)=>{
      if(event.key==='Enter' || event.key===' '){
        event.preventDefault();
        if(card.getAttribute('aria-disabled')==='true') return;
        toggleCareerPower(card.dataset.careerPower);
      }
    });
  });
  $('careerBackBtn')?.addEventListener('click',()=>{
    careerDraft=null;
    careerPowerSelection=[];
    $('careerSetupScreen').classList.add('hidden');
  });
  $('quickReadyBtn')?.addEventListener('click',startReadyRostersFromCareer);
  $('roleTransitionContinue')?.addEventListener('click',continueAfterRoleTransition);
  document.querySelectorAll('[data-minimize-matchday-event]').forEach(button=>button.addEventListener('click',()=>minimizeMatchdayEvent(button.dataset.minimizeMatchdayEvent)));
  $('matchdayEventRestoreBtn')?.addEventListener('click',restoreMatchdayEvent);

  $('resumeBtn').addEventListener('click',()=>{
    $('careerSetupScreen')?.classList.add('hidden');
    resumeAuction();
  });
  $('saveBtn').addEventListener('click',()=>saveWithFeedback('saveBtn'));
  $('resetBtn').addEventListener('click', resetGame);
  $('newAuctionBtn').addEventListener('click', resetGame);
  $('startLeagueBtn')?.addEventListener('click', startLeague);
  $('tradeOutgoing')?.addEventListener('change',()=>{
    const trade=currentTradeWindow(tradeActiveKind());
    trade.pending=null;renderTradeWindow(trade.kind);
  });
  $('tradeOpponent')?.addEventListener('change',()=>{
    const trade=currentTradeWindow(tradeActiveKind());
    trade.pending=null;renderTradeWindow(trade.kind);
  });
  $('tradeIncoming')?.addEventListener('change',()=>{
    const trade=currentTradeWindow(tradeActiveKind());
    trade.pending=null;renderTradeWindow(trade.kind);
  });
  $('tradeCredits')?.addEventListener('input',()=>{
    const trade=currentTradeWindow(tradeActiveKind());
    const input=$('tradeCredits');
    const max=Math.max(0,Number(input?.max||0));
    const numeric=clamp(tradeCreditsValue(),0,max);
    if(input) input.value=String(numeric);
    trade.notice='Proposta modificata.';
    renderTradeWindow(trade.kind);
  });
  $('tradeCreditsMinus')?.addEventListener('click',()=>adjustTradeCredits(-1));
  $('tradeCreditsPlus')?.addEventListener('click',()=>adjustTradeCredits(1));
  $('tradeClearOutgoing')?.addEventListener('click',()=>tradeSetSelection('tradeOutgoing',''));
  $('tradeClearIncoming')?.addEventListener('click',()=>tradeSetSelection('tradeIncoming',''));
  ['tradeMyRole','tradeMySort','tradeRivalRole','tradeRivalSort'].forEach(id=>$(id)?.addEventListener('change',()=>renderTradeRosterChoices()));
  $('tradeMyRosterList')?.addEventListener('click',ev=>{
    const row=ev.target.closest('[data-trade-outgoing]');
    if(!row) return;
    tradeSetSelection('tradeOutgoing',row.dataset.tradeOutgoing||'');
  });
  $('tradeRivalRosterList')?.addEventListener('click',ev=>{
    const row=ev.target.closest('[data-trade-incoming]');
    if(!row) return;
    tradeSetSelection('tradeIncoming',row.dataset.tradeIncoming||'');
  });
  $('tradeOfferBtn')?.addEventListener('click',submitTradeOffer);
  $('tradeCounterBtn')?.addEventListener('click',acceptTradeCounter);
  $('tradeFinishBtn')?.addEventListener('click',finishTradeWindow);
  $('backToAuctionSummaryBtn')?.addEventListener('click', () => renderSummary());
  $('seasonSaveBtn')?.addEventListener('click',()=>saveWithFeedback('seasonSaveBtn'));
  $('lineupBtn')?.addEventListener('click', requestOpenLineup);
  $('opponentMalusBanner')?.addEventListener('click',()=>showOpponentMalusNotice(state?.season?.currentMatchday,true));
  $('opponentMalusAcknowledge')?.addEventListener('click',()=>closeOpponentMalusNotice(true));
  document.addEventListener('keydown',event=>{
    if(opponentMalusNoticeDay===null) return;
    if(event.key==='Escape'){event.preventDefault();closeOpponentMalusNotice(false);}
    if(event.key==='Tab'){event.preventDefault();$('opponentMalusAcknowledge').focus();}
  });
  $('playMatchdayBtn')?.addEventListener('click', handleDashboardPrimaryAction);
  $('simulateMatchdayBtn')?.addEventListener('click', simulateFullMatchdayDirectly);
  $('openCalendarDashboardBtn')?.addEventListener('click', renderLeagueCalendarScreen);
  $('closeMatchCenterBtn')?.addEventListener('click', closeMatchCenter);
  $('matchCenterModal')?.querySelector('.match-center-backdrop')?.addEventListener('click', closeMatchCenter);
  $('closeLeagueRosterModal')?.addEventListener('click', closeLeagueRosterModal);
  $('leagueRosterModal')?.querySelector('.league-roster-modal-backdrop')?.addEventListener('click', closeLeagueRosterModal);
  $('startPendingBigMatchBtn')?.addEventListener('click', startPendingBigMatchFromHub);
  $('skipSerieALiveBtn')?.addEventListener('click', skipSerieALive);
  $('nextSerieAEventBtn')?.addEventListener('click', jumpToNextSerieAEvent);
  $('auctionEventMinimizeBtn')?.addEventListener('click',minimizeAuctionEventModal);
  $('auctionEventRestoreBtn')?.addEventListener('click',restoreAuctionEventModal);
  document.querySelectorAll('[data-live-speed]').forEach(btn=>btn.addEventListener('click',()=>setSerieALiveSpeed(btn.dataset.liveSpeed)));
  $('serieAPauseBtn')?.addEventListener('click', toggleSerieALivePause);
  $('resultFantapointsContinueBtn')?.addEventListener('click', closeMatchdayFantapointsReward);
  $('resultContinueBtn')?.addEventListener('click', renderSeasonDashboard);
  $('winterTransferContinue')?.addEventListener('click',closeWinterTransferSummary);
  $('nextSeasonPrimaryBtn')?.addEventListener('click',handleNextSeasonPrimaryAction);
  $('simulateWinterMarketBtn')?.addEventListener('click',simulateWinterMarket);
  $('openWinterReleasesBtn')?.addEventListener('click',openWinterReleases);
  $('confirmWinterReleasesBtn')?.addEventListener('click',confirmWinterReleases);
  $('winterGuaranteedSaleBtn')?.addEventListener('click',toggleGuaranteedWinterSaleMode);
  $('backToSeasonBtn')?.addEventListener('click', renderSeasonDashboard);
  $('openFullStandingsBtn')?.addEventListener('click', renderLeagueStandingsScreen);
  $('openCareerHonoursBtn')?.addEventListener('click',()=>{
    const panel=$('careerHonoursPanel');
    panel?.classList.toggle('hidden');
    $('openCareerHonoursBtn')?.setAttribute('aria-expanded',String(!panel?.classList.contains('hidden')));
    if(!panel?.classList.contains('hidden')) renderCareerHonours();
  });
  $('nextSeasonHonoursBtn')?.addEventListener('click',openCareerHonours);
  $('openNewsArchiveBtn')?.addEventListener('click', openSeasonNewsArchive);
  $('closeSeasonNewsModal')?.addEventListener('click', closeSeasonNewsArchive);
  $('seasonNewsModal')?.querySelector('.season-news-modal-backdrop')?.addEventListener('click', closeSeasonNewsArchive);
  $('closeSeasonPlayerModal')?.addEventListener('click', closeSeasonPlayerModal);
  $('socialSendBtn')?.addEventListener('click',sendCurrentSocialMessage);
  $('socialMessageInput')?.addEventListener('input',e=>{
    if($('socialMessageCounter')) $('socialMessageCounter').textContent=`${String(e.target.value||'').length}/180`;
  });
  $('socialMessageInput')?.addEventListener('keydown',e=>{
    if(e.key==='Enter' && !e.shiftKey){
      e.preventDefault();
      sendCurrentSocialMessage();
    }
  });
  $('socialPlayerSearch')?.addEventListener('input',e=>{
    socialSearchQuery=String(e.target.value||'');
    if(document.getElementById('leagueSocialScreen')?.classList.contains('active')) renderLeagueSocialScreen();
  });
  $('seasonPlayerModal')?.addEventListener('click',e=>{if(e.target===$('seasonPlayerModal')) closeSeasonPlayerModal();});
  applyGameConfiguration();
  standardizeLeagueShells();
  renderCareerWallets();
  document.querySelectorAll('[data-season-global-save]').forEach(btn=>btn.addEventListener('click',()=>saveWithFeedback(btn)));
  document.querySelectorAll('[data-season-global-menu]').forEach(btn=>btn.addEventListener('click',renderSummary));
  document.querySelectorAll('[data-datacenter-tab]').forEach(btn=>btn.addEventListener('click',()=>setDataCenterTab(btn.dataset.datacenterTab)));
  document.querySelectorAll('[data-league-nav]').forEach(btn=>btn.addEventListener('click',()=>{
    const target=btn.dataset.leagueNav;
    if(target==='dashboard') renderSeasonDashboard();
    else if(target==='rosters') renderLeagueRostersScreen();
    else if(target==='calendar') renderLeagueCalendarScreen();
    else if(target==='standings') renderLeagueStandingsScreen();
    else if(target==='datacenter') renderLeagueDataCenterScreen();
    else if(target==='evolution') renderLeagueEvolutionScreen();
    else if(target==='social') renderLeagueSocialScreen();
    else if(target==='shop') renderLeagueShopScreen();
  }));
  $('lineupSaveBtn')?.addEventListener('click', () => { if(saveLineupDraft(false)){ $('lineupSaveBtn').textContent='Salvato ✓'; setTimeout(()=>$('lineupSaveBtn').textContent='Salva',800); } });
  document.querySelectorAll('[data-open-consumable-inventory]').forEach(btn=>btn.addEventListener('click',openConsumableInventory));
  $('closeConsumableModal')?.addEventListener('click',closeConsumableModal);
  $('consumableModal')?.querySelector('[data-consumable-close]')?.addEventListener('click',closeConsumableModal);
  $('consumableTargetBack')?.addEventListener('click',()=>{ $('consumableTargetPanel')?.classList.add('hidden'); $('consumableInventoryGrid')?.classList.remove('hidden'); renderConsumableInventory(); });
  $('autoLineupBtn')?.addEventListener('click', autoFillUserLineup);
  $('carryLineupBtn')?.addEventListener('click', toggleAssistantCoachCarry);
  $('assistantFixOutBtn')?.addEventListener('click', ()=>repairUnavailableStartersInDraft());
  $('clearLineupBtn')?.addEventListener('click', clearDraftLineup);
  $('benchSelectedBtn')?.addEventListener('click', benchSelectedPlayer);
  $('captainSelectedBtn')?.addEventListener('click', nominateLineupCaptain);
  $('confirmLineupBtn')?.addEventListener('click', confirmUserLineup);
  $('playerSearch').addEventListener('input', renderPlayerResults);
  $('roleFilter').addEventListener('change', renderPlayerResults);
  $('clubFilter').addEventListener('change', renderPlayerResults);
  $('sortFilter').addEventListener('change', renderPlayerResults);
  $('openNominationModal')?.addEventListener('click', openNominationModal);
  $('openNominationModalBtn')?.addEventListener('click', openNominationModal);
  $('closeNominationModal')?.addEventListener('click', closeNominationModal);
  $('nominationModalBackdrop')?.addEventListener('click', closeNominationModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeNominationModal(); closeSeasonNewsArchive(); closeMatchCenter(); closeLeagueRosterModal(); closeConsumableModal(); } });
  $('passBtn').addEventListener('click', userPass);
  $('powerBlockBtn')?.addEventListener('click',()=>openAuctionPower('block'));
  $('powerScoutBtn')?.addEventListener('click',()=>openAuctionPower('scout'));
  $('powerBluffBtn')?.addEventListener('click',()=>openAuctionPower('bluff'));
  $('powerOneShotBtn')?.addEventListener('click',()=>openAuctionPower('oneShot'));
  $('auctionPowerCancel')?.addEventListener('click',()=>closeAuctionPowerModal(true));
  $('auctionPowerModal')?.querySelector('.auction-event-backdrop')?.addEventListener('click',()=>closeAuctionPowerModal(true));
  document.querySelectorAll('[data-inc]').forEach(btn => btn.addEventListener('click', () => userBid(Number(btn.dataset.inc))));
  $('turboToggle').addEventListener('change', e => { if(state){state.turbo=e.target.checked;saveState();} });
  $('autoCompleteBtn').addEventListener('click', autoCompleteAuction);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden' && state){saveState();void saveManager.flush();}
  });
  window.addEventListener('pagehide',()=>{if(state){saveState();void saveManager.flush();}});
  window.addEventListener('beforeunload',()=>{ if(state) saveState(); });
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden' && state) saveState(); });
  initializeSaveSystem().then(updateResumeButton).catch(e=>{ console.warn('Avvio sistema salvataggi non riuscito',e); updateResumeButton(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && $('seasonPlayerModal')?.classList.contains('show')) closeSeasonPlayerModal(); });
  $('expertReasonModal')?.querySelectorAll('[data-expert-reason-close]').forEach(button=>button.addEventListener('click',closeExpertReason));
  $('expertStoryPrev')?.addEventListener('click',()=>changeExpertStoryStep(-1));
  $('expertStoryNext')?.addEventListener('click',()=>changeExpertStoryStep(1));
  document.addEventListener('keydown',e=>{
    if(!$('expertReasonModal')?.classList.contains('show')) return;
    if(e.key==='Escape'){closeExpertReason();return;}
  });
})();
