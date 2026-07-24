/* Fantaballa Season Engine — 03-state-and-data.js
 * Formazioni, profili allenatore, stato, salvataggi, caricamento e normalizzazione dati.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
const FORMATIONS={
 '4-3-3':['AS','ATT','AD','CC','CDC','CC','TS','DC','DC','TD','P'],
 '4-4-2':['ATT','ATT','AS','CC','CC','AD','TS','DC','DC','TD','P'],
 '4-2-3-1':['ATT','AS','COC','AD','CDC','CDC','TS','DC','DC','TD','P'],
 '4-5-1':['ATT','AS','COC','AD','CC','CC','TS','DC','DC','TD','P'],
 '3-5-2':['ATT','ATT','AS','COC','AD','CC','CDC','DC','DC','DC','P'],
 '5-3-2':['ATT','ATT','CC','CDC','CC','TS','DC','DC','DC','TD','P'],
 '3-4-3':['AS','ATT','AD','AS','CC','CC','AD','DC','DC','DC','P'],
 '4-3-1-2':['ATT','ATT','COC','CC','CDC','CC','TS','DC','DC','TD','P'],
 '2-4-4':['AS','ATT','ATT','AD','CC','CDC','COC','CC','DC','DC','P'],
 '4-4-4':['AS','ATT','ATT','AD','CC','CDC','COC','CC','TS','DC','DC','TD','P','P'],
 '3-3-3':['ATT','ATT','ATT','CC','CDC','CC','DC','DC','DC']
};

const FORMATION_LAYOUTS={
 '4-3-3':[['AS',18,17],['ATT',50,12],['AD',82,17],['CC',27,44],['CDC',50,55],['CC',73,44],['TS',12,68],['DC',32,78],['DC',68,78],['TD',88,68],['P',50,90]],
 '4-4-2':[['ATT',34,15],['ATT',66,15],['AS',13,42],['CC',36,51],['CC',64,51],['AD',87,42],['TS',12,68],['DC',32,78],['DC',68,78],['TD',88,68],['P',50,90]],
 '4-2-3-1':[['ATT',50,11],['AS',16,34],['COC',50,30],['AD',84,34],['CDC',35,54],['CDC',65,54],['TS',12,68],['DC',32,78],['DC',68,78],['TD',88,68],['P',50,90]],
 '4-5-1':[['ATT',50,11],['AS',13,35],['COC',50,30],['AD',87,35],['CC',34,53],['CC',66,53],['TS',12,68],['DC',32,78],['DC',68,78],['TD',88,68],['P',50,90]],
 '3-5-2':[['ATT',34,14],['ATT',66,14],['AS',12,39],['COC',50,31],['AD',88,39],['CC',32,55],['CDC',68,55],['DC',22,79],['DC',50,72],['DC',78,79],['P',50,90]],
 '5-3-2':[['ATT',34,14],['ATT',66,14],['CC',27,45],['CDC',50,52],['CC',73,45],['TS',11,61],['DC',27,79],['DC',50,72],['DC',73,79],['TD',89,61],['P',50,90]],
 '3-4-3':[['AS',18,17],['ATT',50,12],['AD',82,17],['AS',13,43],['CC',34,52],['CC',66,52],['AD',87,43],['DC',22,79],['DC',50,72],['DC',78,79],['P',50,90]],
 '4-3-1-2':[['ATT',34,13],['ATT',66,13],['COC',50,31],['CC',27,50],['CDC',50,58],['CC',73,50],['TS',12,68],['DC',32,78],['DC',68,78],['TD',88,68],['P',50,90]],
 '2-4-4':[['AS',12,16],['ATT',38,10],['ATT',62,10],['AD',88,16],['CC',16,48],['CDC',38,56],['COC',62,50],['CC',84,48],['DC',34,77],['DC',66,77],['P',50,91]],
 '4-4-4':[['AS',10,15],['ATT',36,9],['ATT',64,9],['AD',90,15],['CC',13,43],['CDC',38,52],['COC',62,49],['CC',87,43],['TS',8,69],['DC',31,78],['DC',69,78],['TD',92,69],['P',38,92],['P',62,92]],
 '3-3-3':[['ATT',18,15],['ATT',50,9],['ATT',82,15],['CC',20,48],['CDC',50,55],['CC',80,48],['DC',20,79],['DC',50,73],['DC',80,79]]
};

const TEAM_PALETTES=[
 {id:'fantaballa',name:'Fantaballa',primary:'#173A58',secondary:'#8F60C9',text:'#FFFFFF'},
 {id:'rossonera',name:'Rossonera',primary:'#B3122D',secondary:'#151515',text:'#FFFFFF'},
 {id:'nerazzurra',name:'Nerazzurra',primary:'#0756A5',secondary:'#111827',text:'#FFFFFF'},
 {id:'bianconera',name:'Bianconera',primary:'#171717',secondary:'#F3F4F6',text:'#FFFFFF'},
 {id:'giallorossa',name:'Giallorossa',primary:'#7C1727',secondary:'#F1B928',text:'#FFFFFF'},
 {id:'biancoceleste',name:'Biancoceleste',primary:'#4A9FD8',secondary:'#F7FAFC',text:'#10243A'},
 {id:'viola',name:'Viola',primary:'#5D2E8C',secondary:'#F4ECFA',text:'#FFFFFF'},
 {id:'granata',name:'Granata',primary:'#761C38',secondary:'#E6C79C',text:'#FFFFFF'},
 {id:'verdena',name:'Verde-nera',primary:'#13723D',secondary:'#111111',text:'#FFFFFF'},
 {id:'blugialla',name:'Blu-gialla',primary:'#174EA6',secondary:'#F4D03F',text:'#FFFFFF'},
 {id:'arancioblu',name:'Arancio-blu',primary:'#D85D16',secondary:'#173A61',text:'#FFFFFF'},
 {id:'rosanera',name:'Rosa-nera',primary:'#C83D89',secondary:'#171717',text:'#FFFFFF'}
];
function teamPalettePreset(id){return TEAM_PALETTES.find(item=>item.id===String(id))||TEAM_PALETTES[0]}
function teamColorsForPalette(id){const preset=teamPalettePreset(id);return{primary:preset.primary,secondary:preset.secondary,accent:preset.secondary,text:preset.text||'#FFFFFF'}}

const COACH_PROFILES=[
 {id:'anonymous',name:'Anonimo',icon:'🥷',image:'assets/coach-profiles/anonymous.webp',tagline:'Cialtrone',pro:'Nessun effetto.',con:'Nessun effetto.'},
 {id:'talent-scout',name:'Talent scout',icon:'🔎',image:'assets/coach-profiles/talent-scout.webp',tagline:'Occhio al talento',pro:'Un re-roll aggiuntivo nei draft, maggiore probabilità di trovare giocatori con OVR alto e primo pack garantito dalla squadra del giocatore con lo stesso nome dell’allenatore.',con:'Nessun nuovo giocatore può arrivare fuori dal draft iniziale e da quello di metà stagione.'},
 {id:'motivator',name:'Motivatore',icon:'📣',image:'assets/coach-profiles/motivator.webp',tagline:'Qui si realizzano i sogni',pro:'Dopo 2 partite consecutive senza vittoria, +3 OVR alla squadra nella partita seguente. Ogni nuovo bonus OVR o Intesa riceve anche +2 OVR e +2 Intesa aggiuntivi.',con:'Dopo 3 vittorie consecutive, -3 OVR alla squadra nella partita seguente.'},
 {id:'salvation',name:'Mister salvezza',icon:'🛟',image:'assets/coach-profiles/salvation.webp',tagline:'Serenità.',pro:'Con OVR medio della rosa sotto 70, la squadra segna un gol aggiuntivo a partita.',con:'Con OVR medio della rosa sopra 80, la squadra subisce almeno un gol a partita.'},
 {id:'young-beautiful',name:'Giovani e belli',icon:'✨',image:'assets/coach-profiles/giovani-e-belli.webp',tagline:'La meglio gioventù',pro:'I giocatori con OVR base da 60 a 69 ricevono +20 Intesa. Quelli con OVR base da 70 a 75 ricevono +10 Intesa.',con:'Non puoi avere giocatori con OVR base pari o superiore a 85: non appaiono nei draft e ogni loro arrivo durante la stagione viene bloccato. Hai 0 re-roll nel draft iniziale.'},
 {id:'ductility',name:'Duttilità',icon:'🔀',image:'assets/coach-profiles/duttilita.webp',tagline:'Tutti dappertutto',pro:'I giocatori possono essere schierati in qualsiasi ruolo senza malus. Ogni gol segnato da un giocatore schierato fuori ruolo gli assegna +1 OVR permanente fino a fine stagione.',con:'I giocatori non ricevono alcun bonus di Intesa e non possono ottenere altri potenziamenti positivi di OVR durante la stagione.'},
 {id:'three-five-two',name:'3-5-2',icon:'🧠',image:'assets/coach-profiles/tre-cinque-due.webp',tagline:'Una sola idea, quattordici uomini',pro:'Il primo club estratto nel draft genera automaticamente una rosa di 14 giocatori casuali. Gli undici titolari vengono scelti prima nei ruoli corretti del 3-5-2; se il club non li possiede, il gioco completa i ruoli con giocatori casuali.',con:'La probabilità degli eventi è dimezzata, puoi utilizzare soltanto il modulo 3-5-2 per tutta la stagione e non hai il draft di metà stagione.'},
 {id:'rokky',name:'Rokky',icon:'🕵️',image:'assets/coach-profiles/rokky.webp',tagline:'Il risultato si può sistemare',pro:'A fine partita, se hai subito almeno un gol, puoi tentare di annullarne uno. Il tentativo riesce nell’80% dei casi. Inoltre inizi ogni run con un Fischietto di Collina.',con:'Nel 20% dei casi vieni scoperto e perdi tutti i punti in classifica. Inoltre tutti ti odiano: ogni avversario riceve +5 OVR quando ti affronta.'}
];
function normalizeCoachType(value){const id=String(value||'anonymous');return COACH_PROFILES.some(profile=>profile.id===id)?id:'anonymous'}
function coachProfile(value=state?.coachType){return COACH_PROFILES.find(profile=>profile.id===normalizeCoachType(value))||COACH_PROFILES[0]}
function coachIs(value){return normalizeCoachType(state?.coachType)===String(value)}
function syncCoachRestrictions(){
 if(!state)return;
 state.seasonRules=state.seasonRules&&typeof state.seasonRules==='object'?state.seasonRules:{};
 if(coachIs('three-five-two')){state.formation='3-5-2';state.seasonRules.userFormationOverride='3-5-2'}
 else if(state.phase==='setup'&&state.seasonRules.userFormationOverride==='3-5-2')state.seasonRules.userFormationOverride='';
}
function coachEventChanceFactor(){return coachIs('three-five-two')?.5:1}
function youngBeautifulBaseOvr(player){return originalBaseOvr(player)}
function youngBeautifulChemistryBonus(player){if(!coachIs('young-beautiful')||!player)return 0;const base=youngBeautifulBaseOvr(player);return base>=60&&base<=69?20:base>=70&&base<=75?10:0}
function youngBeautifulAllowsPlayer(player){return !coachIs('young-beautiful')||youngBeautifulBaseOvr(player)<85}
function youngBeautifulBlockMessage(player){const name=String(player?.name||'Questo giocatore'),base=youngBeautifulBaseOvr(player);return `Giovani e belli: ${name} ha ${base} OVR base e non può entrare in rosa. Il limite massimo consentito è 84.`}
function initialDraftRerollLimit(value=state?.coachType){const coach=normalizeCoachType(value);return coach==='young-beautiful'?0:coach==='talent-scout'?4:3}
function talentScoutBlocksExternalArrival(){return coachIs('talent-scout')&&state?.phase==='season'}
function talentScoutBlockMessage(){return 'Talent scout: il contratto impedisce nuovi arrivi fuori dal draft iniziale e dal draft di metà stagione.'}
function coachHighOvrPick(pool){
 const list=(Array.isArray(pool)?pool:[]).filter(Boolean);if(!list.length)return null;if(!coachIs('talent-scout'))return pick(list);
 const sorted=[...list].sort((a,b)=>(Number(b?.ovr)||0)-(Number(a?.ovr)||0));
 const premium=sorted.slice(0,Math.max(1,Math.ceil(sorted.length*.38)));
 return Math.random()<.72?pick(premium):pick(sorted);
}
function coachHighOvrSample(pool,count=1){
 const source=[...(Array.isArray(pool)?pool:[])],out=[];while(source.length&&out.length<count){const chosen=coachHighOvrPick(source);if(!chosen)break;out.push(chosen);source.splice(source.indexOf(chosen),1)}return out;
}
function setupTeamBadge(name){const words=String(name||'FAN').trim().split(/\s+/).filter(Boolean);return (words.length>1?words.slice(0,3).map(word=>word[0]).join(''):words[0]?.slice(0,3)||'FAN').toUpperCase()}

const POSITION_ROLE={P:'P',DC:'D',TS:'D',TD:'D',CDC:'C',CC:'C',COC:'C',AS:'A',AD:'A',ATT:'A'};

const TEARLESS_EVENT_PLAYER={id:'mystery-tearless',name:'Tearless',role:'A',Position:'ATT',roleLabel:'Attaccante',nation:'Italia',ovr:51,baseOvr:51,subscriber:'no',abbonato:'no',club:'tearless-channel'};
const ITALIA_2006_EVENT_PLAYERS=[
 {id:'italia-2006-buffon',name:'Gianluigi Buffon',role:'P',Position:'P',roleLabel:'Portiere',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-peruzzi',name:'Angelo Peruzzi',role:'P',Position:'P',roleLabel:'Portiere',nation:'Italia',ovr:80,baseOvr:80,club:'italia-2006'},
 {id:'italia-2006-amelia',name:'Marco Amelia',role:'P',Position:'P',roleLabel:'Portiere',nation:'Italia',ovr:75,baseOvr:75,club:'italia-2006'},
 {id:'italia-2006-cannavaro',name:'Fabio Cannavaro',role:'D',Position:'DC',roleLabel:'Difensore',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-nesta',name:'Alessandro Nesta',role:'D',Position:'DC',roleLabel:'Difensore',nation:'Italia',ovr:97,baseOvr:97,club:'italia-2006'},
 {id:'italia-2006-materazzi',name:'Marco Materazzi',role:'D',Position:'DC',roleLabel:'Difensore',nation:'Italia',ovr:85,baseOvr:85,club:'italia-2006'},
 {id:'italia-2006-barzagli',name:'Andrea Barzagli',role:'D',Position:'DC',roleLabel:'Difensore',nation:'Italia',ovr:76,baseOvr:76,club:'italia-2006'},
 {id:'italia-2006-grosso',name:'Fabio Grosso',role:'D',Position:'TS',roleLabel:'Difensore',nation:'Italia',ovr:89,baseOvr:89,club:'italia-2006'},
 {id:'italia-2006-zambrotta',name:'Gianluca Zambrotta',role:'D',Position:'TD, TS',roleLabel:'Difensore',nation:'Italia',ovr:90,baseOvr:90,club:'italia-2006'},
 {id:'italia-2006-zaccardo',name:'Cristian Zaccardo',role:'D',Position:'TD, DC',roleLabel:'Difensore',nation:'Italia',ovr:76,baseOvr:76,club:'italia-2006'},
 {id:'italia-2006-oddo',name:'Massimo Oddo',role:'D',Position:'TD',roleLabel:'Difensore',nation:'Italia',ovr:80,baseOvr:80,club:'italia-2006'},
 {id:'italia-2006-pirlo',name:'Andrea Pirlo',role:'C',Position:'CC, CDC, COC',roleLabel:'Centrocampista',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-gattuso',name:'Gennaro Gattuso',role:'C',Position:'CDC, CC',roleLabel:'Centrocampista',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-de-rossi',name:'Daniele De Rossi',role:'C',Position:'CDC, CC',roleLabel:'Centrocampista',nation:'Italia',ovr:92,baseOvr:92,club:'italia-2006'},
 {id:'italia-2006-perrotta',name:'Simone Perrotta',role:'C',Position:'CC, COC',roleLabel:'Centrocampista',nation:'Italia',ovr:81,baseOvr:81,club:'italia-2006'},
 {id:'italia-2006-camoranesi',name:'Mauro German Camoranesi',role:'C',Position:'CC, COC',roleLabel:'Centrocampista',nation:'Italia',ovr:88,baseOvr:88,club:'italia-2006'},
 {id:'italia-2006-barone',name:'Simone Barone',role:'C',Position:'CC',roleLabel:'Centrocampista',nation:'Italia',ovr:75,baseOvr:75,club:'italia-2006'},
 {id:'italia-2006-totti',name:'Francesco Totti',role:'C',Position:'COC, ATT',roleLabel:'Centrocampista',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-toni',name:'Luca Toni',role:'A',Position:'ATT',roleLabel:'Attaccante',nation:'Italia',ovr:95,baseOvr:95,club:'italia-2006'},
 {id:'italia-2006-gilardino',name:'Alberto Gilardino',role:'A',Position:'ATT',roleLabel:'Attaccante',nation:'Italia',ovr:88,baseOvr:88,club:'italia-2006'},
 {id:'italia-2006-del-piero',name:'Alessandro Del Piero',role:'A',Position:'AS, ATT, COC',roleLabel:'Attaccante',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-inzaghi',name:'Filippo Inzaghi',role:'A',Position:'ATT',roleLabel:'Attaccante',nation:'Italia',ovr:99,baseOvr:99,club:'italia-2006'},
 {id:'italia-2006-iaquinta',name:'Vincenzo Iaquinta',role:'A',Position:'ATT, AD',roleLabel:'Attaccante',nation:'Italia',ovr:82,baseOvr:82,club:'italia-2006'}
];
const ITALIA_2006_FINAL_XI=['Gianluigi Buffon','Gianluca Zambrotta','Fabio Cannavaro','Alessandro Nesta','Fabio Grosso','Gennaro Gattuso','Andrea Pirlo','Daniele De Rossi','Francesco Totti','Luca Toni','Alessandro Del Piero'];

function isLegacySetupTeamName(value){
 const normalized=String(value||'').trim().toLowerCase();
 return !normalized||normalized===String(DEFAULT_TEAM_NAME||'').trim().toLowerCase()||normalized==='fantaballa real';
}
function isLegacySetupCoachName(value){
 const normalized=String(value||'').trim().toLowerCase();
 return !normalized||normalized==='il tuo nome';
}
function initialSetupTeamName(){
 let value='';
 try{value=String(localStorage.getItem(SETUP_TEAM_NAME_KEY)||'').trim()}catch{}
 if(isLegacySetupTeamName(value)){
   try{if(value)localStorage.removeItem(SETUP_TEAM_NAME_KEY)}catch{}
   return '';
 }
 return value;
}
function initialSetupCoachName(){
 let value='';
 try{value=String(localStorage.getItem(SETUP_COACH_NAME_KEY)||'').trim()}catch{}
 if(isLegacySetupCoachName(value)){
   try{if(value)localStorage.removeItem(SETUP_COACH_NAME_KEY)}catch{}
   return '';
 }
 return value;
}

let PLAYERS=[];let CLASSIC_PLAYERS=[];let REAL_PLAYERS=[];let CLUBS=[];let OTHER_CLUBS=[];let COMMENTARY=null;let SEASON_DATASETS={};let state=loadState()||freshState();let draftRolling=false;let mobileDraftTab='players';let lastPlacedDraftSlotId='';let lastPlacedDraftTimer=null;let setupIdentitySaveTimer=null;let seasonEventMinimized=false;let seasonEventUiKey='';
const screen=document.getElementById('screen'),modalRoot=document.getElementById('modalRoot'),toastEl=document.getElementById('toast');
function freshState(){return{version:CURRENT_STATE_VERSION,meta:{seasonId:generateSeasonId(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),mode:SAVE_MODE,saveFormatVersion:SAVE_FORMAT_VERSION,gameVersion:SEASON_ENGINE_VERSION,autosave:true,submissionCode:'',submittedAt:''},phase:'setup',competitionVariant:'serie-a',userClubId:DEFAULT_FRESH_USER_CLUB_ID,teamName:initialSetupTeamName(),coachName:initialSetupCoachName(),coachType:normalizeCoachType(localStorage.getItem(SETUP_COACH_TYPE_KEY)||'anonymous'),formation:'4-3-3',gameMode:'normal',setupStep:1,teamPaletteId:String(localStorage.getItem(SETUP_PALETTE_KEY)||'fantaballa'),teamColors:teamColorsForPalette(String(localStorage.getItem(SETUP_PALETTE_KEY)||'fantaballa')),chaos:{lastPreparedMatchday:-1,totalDecisions:0,currentRound:null,latest:[],midseasonDone:false},draft:{roster:[],clubId:'',candidates:[],rerolls:3,pendingPlayerId:'',openingClubShown:false},leagueClubIds:[],teams:[],schedule:[],standings:{},matchday:0,history:[],statuses:{},playInjured:{},pendingEvent:null,seenDecisionEvents:[],activeEffects:[],seasonRules:{midseasonPickDelta:0,midseasonExtraRerolls:0,autoDecisions:false,autoMidseason:false,botMidseason:false,mandatoryMidseasonPlayerId:'',mandatoryMidseasonPlayerIds:[],equalOrBetterMidseasonPlayerIds:[],marottaDoubleWins:false,marottaLossPenalty:0,winPoints:3,drawPoints:1,seasonLength:38,marathon:false,matchDuration:90,longMatchRisk:false,deathMatchClubId:'',deathMatchClubName:'',deathMatchClubBonus:10,sixtyPointFear:false,sixtyPointFearTriggered:false,redCardGoals:false,pointsEqualGoals:false,yellowEqualsRed:false,pinkCardEndsMatch:false,federationGoalRule:'',figcCompetitionRule:'',fgicLeagueRule:'',bottomHelpRoundTeamIds:[],fgciPointsRule:'',fgciResultRule:'',fantaballaVideoRule:'',italiaCatenaccioRule:'',spaceJamRule:'',spaceJamTalentPending:false,spaceJamLastOutcome:'',frenchEventChoice:'',frenchFlyingKeeperId:'',frenchFlyingAttackerId:'',frenchFlyingAttackSlot:'',frenchLateAttackerBoostActive:false,frenchLateAttackerBoostCount:0,frenchLateAttackerBoosts:{},sponsorChoice:'',sponsorOvrExtra:0,sponsorOvrBoostCount:0,ballariniPlayerBonus:{},physioInjuryMultiplier:1,fmTacticianWins:0,fmInjuryOccurred:false,dynamicLeague:'',dynamicLeagueLabel:'',dynamicLeagueAppliedAt:-1,dynamicLeagueTeamIds:[],nonItalianChemZero:false,eventChanceMultiplier:1,leagueFormation:'',userFormationOverride:'',injuredOvrBonus:0,lateGoalsDouble:false,zeroZeroNoPoints:false,topPlayerAfterMandatoryId:'',guaranteedTopPlayerNextMidseason:false,coachTopSwapPlayerId:'',fantaguruBetterMidseason:false,autoOptimizeLineup:false,futureScorerPlayerId:'',futureScorerPlayerName:'',futureInjuryZeroPoints:false,futureInjuryPenaltyNotice:'',hungerGames:false,eliminatedTeamIds:[],generatedEventPlayers:[],laCurvaRewardActive:false,motivatorPermanentChemistry:{},ductilityScorerOvr:{},pendingParityReset:{active:false,parity:'',dueMatchday:-1,scheduledAt:-1,appliedMatchday:-1,lastResult:''},curvaContest:{active:false,mode:'',status:'idle',startedMatchday:-1,deadlineMatchday:-1,pendingTeamId:'',lastResult:'',switchedFromTeamName:'',switchedToTeamName:''},secretRefereeDeal:{active:false,choice:'',startedMatchday:-1,earnedPoints:0,matchesChecked:0,discovered:false,discoveredMatchday:-1,lastAdjustment:0}},inventory:{capacity:3,items:[],active:null,rokkyStarterGranted:false},quest:{active:false,id:'',title:'',status:'idle',acceptedMatchday:-1,matchesPlayed:0,progress:0,target:0,deadlineMatches:0,targetPlayerId:'',targetPlayerName:'',targetTeamIds:[],facedTeamIds:[],rewardActive:false,objective:'',reward:'',penalty:'',summary:'',notice:'',awaitingPlayerSelection:false},eventChains:{mentalista:{active:false,stage:0,playerId:'',playerName:'',originalOvr:0,dueMatchday:-1,training:false,nature:false,goals:0,completed:false},general:{active:false,stage:0,dueMatchday:-1,replacements:[],nationalBoostPending:false,completed:false},pinguino:{active:false,stage:0,dueMatchday:-1,mode:'',completed:false,wins:0,nonWins:0},mysteryCharacter:{active:false,stage:0,branch:'',playerId:'',playerName:'',dueMatchday:-1,completed:false,finale:{eligible:false,categories:[],played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0}}},analytics:{initialOvr:0,injuries:0,redCards:0,eventLog:[],biggestResult:null},stats:{goals:{},assists:{},appearances:{},cleanSheets:{},mvpVotes:{},mvpPoints:{},playerNames:{},playerTeams:{},playerTeamNames:{}},midseason:{step:0,target:2,outgoingId:'',mandatoryOutgoingId:'',mandatoryOutgoingIds:[],clubId:'',candidates:[],pendingCandidateId:'',drawsUsed:0,completed:false,auto:false,autoCompleted:false,changes:[]},cup:{status:'pending',qualifiedRank:0,currentCompetition:'',otherCompetition:'',participants:[],userParticipantId:'cup-user',userAlive:true,winnerId:'',rewardApplied:false,penaltyApplied:false,rewardType:'',penaltyType:'',notice:'',history:[],stages:[],pendingMatch:null,lastResult:null},story:{merit:{initialized:false,scheduled:false,triggerMatchday:-1,stage:'idle',playerId:'',playerName:'',recipientTeamId:'',recipientTeamName:'',promoted:false,guaranteedGoalPending:false,transferred:false,branch:'',postMidseasonShown:false,challenge:{active:false,status:'idle',attackerId:'',attackerName:'',matchesPlayed:0,goals:0},ovrModifiers:{},finale:{eligible:false,opponent:'',nation:'',played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false}},fantaballopoli:{initialized:false,scheduled:false,triggerMatchday:-1,stage:'idle',forcedLossPending:false,targetPlayerId:'',targetPlayerName:'',targetRole:'',midseasonResolved:false,giudaId:'',curseActive:false,negativeOvrAllowed:false,curseMatches:0,satisfactionAfter:0,corruptionFull:false,corruptionMatchIndex:0,investigatorDueMatchday:0,investigatorShown:false,abruptEnd:false,completed:false,finale:{eligible:false,played:false,userGoals:0,opponentGoals:0,won:false,pointsApplied:false,rankBeforeBonus:0,rankAfterBonus:0,pointsBeforeBonus:0}},error404:{initialized:false,scheduled:false,stage:'idle',corrupted:false,technicianDueMatchday:-1,restartDueMatchday:-1,technicianShown:false,restartShown:false,antivirusInstalled:false,completed:false,restarted:false}},playoffs:{initialized:false,status:'idle',stageIndex:0,stageName:'',qualifiers:[],ties:[],history:[],championId:'',userQualified:false,userEliminated:false,lastStageResults:[]},lastResult:null,submitted:false};}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}function pick(a){return a[Math.floor(Math.random()*a.length)]}function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function toast(msg){toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>toastEl.classList.remove('show'),2200)}
function phaseLabel(value){return({setup:'Impostazione',draft:'Draft iniziale',season:'Campionato',midseason:'Mercato di metà stagione',finished:'Stagione conclusa'})[value]||'Stagione'}
function updateSaveStatus(){
 const el=document.getElementById('saveStatus');if(!el)return;
 const phase=phaseLabel(state?.phase);
 const round=state?.phase==='season'?` · G${Math.min(seasonLength(),(Number(state.matchday)||0)+1)}`:'';
 el.textContent=`Salvataggio automatico · ${phase}${round}`;
 el.title='Il gioco salva automaticamente dopo ogni scelta e ogni partita';
}
function closeRobustModal(){modalRoot.innerHTML=''}
function openConfirm({title='Conferma',message='',confirmText='Conferma',cancelText='Annulla',danger=false}={}){
 return new Promise(resolve=>{
   modalRoot.innerHTML=`<div class="robust-modal-backdrop" role="presentation"><section class="robust-modal" role="dialog" aria-modal="true" aria-labelledby="robustConfirmTitle"><div class="robust-modal-head"><div><div class="label">Conferma operazione</div><h2 id="robustConfirmTitle">${esc(title)}</h2></div><button class="robust-close" id="robustConfirmClose" type="button" aria-label="Chiudi">×</button></div><p class="robust-modal-copy">${esc(message)}</p><div class="robust-actions"><button id="robustConfirmCancel" class="btn" type="button">${esc(cancelText)}</button><button id="robustConfirmOk" class="btn ${danger?'red':'primary'}" type="button">${esc(confirmText)}</button></div></section></div>`;
   const finish=value=>{closeRobustModal();resolve(value)};
   document.getElementById('robustConfirmClose').onclick=()=>finish(false);
   document.getElementById('robustConfirmCancel').onclick=()=>finish(false);
   document.getElementById('robustConfirmOk').onclick=()=>finish(true);
   modalRoot.querySelector('.robust-modal-backdrop').onclick=event=>{if(event.target===event.currentTarget)finish(false)};
   document.getElementById('robustConfirmOk').focus();
 });
}
function validateGameData(players,clubs,validationConfig=SEASON_CONFIG.validation||{}){
 const fatal=[],warnings=[];
 if(!Array.isArray(players))fatal.push(`${SEASON_CONFIG.data.primaryPlayers} deve contenere un array.`);
 if(!Array.isArray(clubs))fatal.push(`${SEASON_CONFIG.data.primaryClubs} deve contenere un array.`);
 if(fatal.length)return{fatal,warnings};
 const clubIds=new Set(),playerIds=new Set();
 clubs.forEach((club,index)=>{
   const id=String(club?.id||'').trim();
   if(!id)fatal.push(`Club ${index+1}: id mancante.`);else if(clubIds.has(id))fatal.push(`ID club duplicato: ${id}.`);else clubIds.add(id);
   if(!String(club?.name||'').trim())fatal.push(`Club ${id||index+1}: nome mancante.`);
   const colors=club?.colorClub||club?.colors||{};
   ['primary','secondary'].forEach(key=>{if(!String(colors[key]||'').trim())warnings.push(`${club?.name||id}: colore ${key} mancante.`)});
 });
 players.forEach((player,index)=>{
   const id=String(player?.id??'').trim();
   if(!id)fatal.push(`Giocatore ${index+1}: id mancante.`);else if(playerIds.has(id))fatal.push(`ID giocatore duplicato: ${id}.`);else playerIds.add(id);
   if(!String(player?.name||'').trim())fatal.push(`Giocatore ${id||index+1}: nome mancante.`);
   if(!String(player?.Position||'').trim())fatal.push(`${player?.name||id}: Position mancante.`);
   const ovr=Number(player?.ovr),maximumOvr=Math.max(100,Number(validationConfig?.maximumOvr)||100);if(!Number.isFinite(ovr)||ovr<1||ovr>maximumOvr)fatal.push(`${player?.name||id}: OVR non valido (massimo ${maximumOvr}).`);
   const club=String(player?.club||'').trim();if(!clubIds.has(club))fatal.push(`${player?.name||id}: club “${club||'mancante'}” non presente in club.json.`);
 });
 const validation=validationConfig||{};
 if(clubs.length<Number(validation.minimumClubCount||20))fatal.push(String(validation.minimumClubMessage||'Sono presenti soltanto {count} club.').replace('{count}',clubs.length));
 if(Number.isFinite(Number(validation.expectedClubCount))&&clubs.length!==Number(validation.expectedClubCount))warnings.push(String(validation.expectedClubMessage||'Sono presenti {count} club.').replace('{count}',clubs.length));
 const clubsToValidate=validation.excludeClubId?clubs.filter(club=>String(club.id)!==String(validation.excludeClubId)):clubs;
 clubsToValidate.forEach(club=>{
   const roster=players.filter(player=>String(player.club)===String(club.id));
   const roles={P:0,D:0,C:0,A:0};roster.forEach(player=>roles[roleOf(player)]=(roles[roleOf(player)]||0)+1);
   const minimumRosterSize=Number(validation.minimumRosterSize||11),warningRosterUnder=Number(validation.warningRosterUnder||0);
   if(roster.length<minimumRosterSize)fatal.push(`${club.name}: soltanto ${roster.length} giocatori.`);
   else if(warningRosterUnder&&roster.length<warningRosterUnder)warnings.push(`${club.name}: rosa corta (${roster.length} giocatori); in caso di molte assenze verranno usati i valori di riserva.`);
   if(!roles.P)fatal.push(`${club.name}: nessun portiere.`);
   if(roles.D<4||roles.C<3||roles.A<2)warnings.push(`${club.name}: distribuzione ruoli fragile (P ${roles.P}, D ${roles.D}, C ${roles.C}, A ${roles.A}).`);
 });
 return{fatal,warnings};
}
function versionedResourceUrl(url){const value=String(url||'');if(!value||/^(?:https?:|data:|blob:)/i.test(value))return value;const sep=value.includes('?')?'&':'?';return `${value}${sep}v=20260723-pills1`}
async function fetchJsonResource(url,label,{optional=false}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
   const response=await fetch(versionedResourceUrl(url),{cache:'default',signal:controller.signal});
   if(!response.ok)throw Error(`${label}: risposta HTTP ${response.status}`);
   const raw=await response.text();
   try{return JSON.parse(raw)}catch{throw Error(`${label}: il file non contiene JSON valido`)}
 }catch(error){if(optional)return null;throw error}finally{clearTimeout(timer)}
}
function showBootError(error){
 screen.innerHTML=`<section class="panel robust-error"><div class="label">Controllo sicurezza</div><h2>Impossibile aprire il Campionato</h2><p>Il salvataggio non è stato cancellato. Correggi i file indicati e riprova.</p><div class="robust-error-detail">${esc(error?.message||error)}</div><div class="top-actions" style="margin-top:14px"><button class="btn primary" id="retryBootBtn" type="button">Riprova</button><a class="btn" href="index.html">Torna al menu</a></div></section>`;
 const retry=document.getElementById('retryBootBtn');if(retry)retry.onclick=()=>location.reload();
}

function updateCompetitionChrome(){
 const profile=competitionVariantProfile(state?.competitionVariant),legend=profile.id==='legend';
 document.body?.classList.toggle('competition-legend',legend);
 const meta=document.getElementById('competitionHeaderMeta');if(meta)meta.textContent=legend?'Legend · 38 giornate · 20 squadre per run · 40 club disponibili · 796 campioni · OVR fino a 116':'Serie A · 38 giornate · 20 club · 455 calciatori reali';
 const hero=document.getElementById('competitionHeroText');if(hero)hero.textContent=legend?'Le squadre che hanno fatto la storia del calcio mondiale dentro il Fantacampionato: draft tra 40 club leggendari, 38 giornate, eventi, infortuni, squalifiche e mercato di metà stagione.':'I calciatori e i club della stagione 2025/26 dentro il Campionato di Fantaballa: draft, 38 giornate, eventi, infortuni, squalifiche e mercato di metà stagione.';
}
function applyCompetitionVariantData(value){
 const variant=normalizeCompetitionVariant(value),dataset=SEASON_DATASETS[variant]||SEASON_DATASETS['serie-a'];
 if(!dataset||!Array.isArray(dataset.players)||!Array.isArray(dataset.clubs))throw new Error(`Database ${variant} non disponibile.`);
 PLAYERS=dataset.players;CLUBS=dataset.clubs;REAL_PLAYERS=PLAYERS;
 if(state)state.competitionVariant=variant;
 dataDiagnostics=validateGameData(PLAYERS,CLUBS,dataset.validation||SEASON_CONFIG.validation||{});
 updateCompetitionChrome();
 return dataDiagnostics;
}
function resetSetupForCompetitionVariant(value){
 const current=state||{},variant=normalizeCompetitionVariant(value),next=freshState();
 next.competitionVariant=variant;
 next.teamName=String(current.teamName||next.teamName);
 next.coachName=String(current.coachName||next.coachName);
 next.coachType=normalizeCoachType(current.coachType||next.coachType);
 next.formation=FORMATIONS[String(current.formation||'')]?String(current.formation):next.formation;
 next.gameMode=current.gameMode==='chaos'?'chaos':'normal';
 next.teamPaletteId=String(current.teamPaletteId||next.teamPaletteId);
 next.teamColors=normalizeClubColors(current.teamColors||next.teamColors);
 next.setupStep=1;
 state=next;
 applyCompetitionVariantData(variant);
}

function positions(p){return String(p.Position||p.position||p.role||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean)}
function naturalCompatible(p,code){return positions(p).includes(code)}
function compatible(p,code){return naturalCompatible(p,code)}
function userCompatible(p,code){return coachIs('ductility')||naturalCompatible(p,code)}
function roleOf(p){return p.role||POSITION_ROLE[positions(p)[0]]||'C'}
const DRAFT_ROLE_ORDER={P:0,D:1,C:2,A:3};
const DRAFT_POSITION_ORDER=['P','DC','TS','TD','DC/TS','DC/TD','TS/TD','CDC','CC','COC','CC/CDC','CC/COC','ATT','AS','AD','AS/ATT','AD/ATT','ATT/COC','AS/COC','AD/COC'];
function comparePlayersByRole(a,b){
 const roleDiff=(DRAFT_ROLE_ORDER[roleOf(a)]??9)-(DRAFT_ROLE_ORDER[roleOf(b)]??9);
 if(roleDiff)return roleDiff;
 const aPosition=String(a?.Position||positions(a).join('/')||'').toUpperCase();
 const bPosition=String(b?.Position||positions(b).join('/')||'').toUpperCase();
 const positionDiff=(DRAFT_POSITION_ORDER.indexOf(aPosition)<0?99:DRAFT_POSITION_ORDER.indexOf(aPosition))-(DRAFT_POSITION_ORDER.indexOf(bPosition)<0?99:DRAFT_POSITION_ORDER.indexOf(bPosition));
 if(positionDiff)return positionDiff;
 const ovrDiff=(Number(b?.ovr)||0)-(Number(a?.ovr)||0);
 if(ovrDiff)return ovrDiff;
 return String(a?.name||'').localeCompare(String(b?.name||''),'it',{sensitivity:'base'});
}
function sortPlayersByRole(players){return [...players].sort(comparePlayersByRole)}
function sortRosterEntriesByRole(entries){return [...entries].sort((a,b)=>comparePlayersByRole(a.player,b.player)||String(a.slot||'').localeCompare(String(b.slot||''),'it'))}
function playerById(id){return PLAYERS.find(p=>String(p.id)===String(id))||(Array.isArray(state?.seasonRules?.generatedEventPlayers)?state.seasonRules.generatedEventPlayers.find(p=>String(p.id)===String(id)):null)}
function clubById(id){return CLUBS.find(club=>String(club.id)===String(id))||null}
function activeUserClub(){const base=clubById(state.userClubId)||CLUBS[0]||SEASON_CONFIG.user.fallbackClub;const colors=normalizeClubColors(state?.teamColors||base.colorClub);return{...base,name:String(state?.teamName||base.name),shortName:setupTeamBadge(state?.teamName||base.shortName),colorClub:colors,colors}}
function normalizeClubColors(source={}){return{primary:source.primary||'#245786',secondary:source.secondary||'#10243A',accent:source.accent||'#FFE96C',text:source.text||'#FFFFFF'}}
function clubPalette(clubOrId){const club=typeof clubOrId==='string'?clubById(clubOrId):clubOrId;const colors=normalizeClubColors(club?.colorClub||club?.colors||{});return{a:colors.primary,b:colors.secondary,c:colors.accent,ink:colors.text,primary:colors.primary,secondary:colors.secondary,accent:colors.accent,text:colors.text}}
function teamPalette(team){if(!team)return clubPalette(activeUserClub());const configured=team.colors||clubById(team.clubId||team.id)?.colorClub;if(configured)return clubPalette({colorClub:configured});const legacy=nationPalette(team.name||'club');return{a:legacy.a,b:legacy.b,c:legacy.c,ink:legacy.ink,primary:legacy.a,secondary:legacy.b,accent:legacy.c,text:'#FFFFFF'}}
function teamCssVars(team){const pal=teamPalette(team);return `--team-primary:${pal.primary};--team-secondary:${pal.secondary};--team-accent:${pal.accent};--team-text:${pal.text}`}
function teamColorDot(team){return `<span class="team-color-dot" style="${teamCssVars(team)}" aria-hidden="true"></span>`}
function rosterEntry(id){return state.draft.roster.find(r=>String(r.playerId)===String(id))}
function rosterPlayers(){return state.draft.roster.map(r=>({...r,player:r.player||playerById(r.playerId)})).filter(r=>r.player)}
function avg(arr){return arr.length?arr.reduce((s,n)=>s+n,0)/arr.length:0}
function normalizeName(s){return String(s||'').trim().toLowerCase().replace(/[^a-z0-9à-ÿ]+/g,'')}
function statusOf(id){
 if(!state.statuses[id])state.statuses[id]={injury:0,suspension:0,seasonOut:false,seasonOutReason:''};
 const status=state.statuses[id];
 status.injury=Math.max(0,Number(status.injury)||0);
 status.suspension=Math.max(0,Number(status.suspension)||0);
 status.seasonOut=Boolean(status.seasonOut);
 status.seasonOutReason=String(status.seasonOutReason||'');
 return status;
}
function seasonLength(source=state){const configured=Math.max(1,Number(source?.seasonRules?.seasonLength)||38),scheduled=Array.isArray(source?.schedule)?source.schedule.length:0;return source?.seasonRules?.dynamicLeague?Math.max(configured,scheduled):Math.max(38,configured,scheduled)}
function remainingSeasonMatches(){return Math.max(1,seasonLength()-(Number(state.matchday)||0))}
const SEASON_LONG_EFFECT_SOURCES=new Set(['quest-like-a-bomber','quest-la-curva-penalty','quest-la-curva-reward','quest-ammazza-grandi','quest-ammazza-grandi-penalty','Controllo dei documenti','Generale cacciato','Ehi ma ti chiami come me','Sconfitta nella Coppa parallela','Vittoria della Coppa parallela']);
function effectLastsUntilSeasonEnd(effect={}){return Boolean(effect?.untilSeasonEnd||Number(effect?.rounds)>=9999||SEASON_LONG_EFFECT_SOURCES.has(String(effect?.source||'')))}
function normalizeActiveEffect(effect={}){const normalized={...effect,rounds:Math.max(1,Number(effect?.rounds)||1)};normalized.untilSeasonEnd=effectLastsUntilSeasonEnd(normalized);return normalized}
function normalizeActiveEffects(effects=[]){const normalized=(Array.isArray(effects)?effects:[]).filter(effect=>effect&&typeof effect==='object').map(normalizeActiveEffect);normalized.forEach((effect,index)=>{if(!effect.motivatorExtra||effect.untilSeasonEnd)return;const parent=normalized.slice(Math.max(0,index-2),index).reverse().find(candidate=>!candidate.motivatorExtra&&candidate.untilSeasonEnd&&Number(candidate.rounds)===Number(effect.rounds)&&String(candidate.playerId||'')===String(effect.playerId||''));if(parent)effect.untilSeasonEnd=true});return normalized}
function futureInjuryPenalty(playerName=''){
 if(!state.seasonRules?.futureInjuryZeroPoints)return false;
 const standing=userStanding();if(standing)standing.pts=0;
 const name=String(playerName||'Un tuo giocatore');
 state.seasonRules.futureInjuryPenaltyNotice=`${name} si è infortunato: per la regola del giocatore dal futuro i tuoi punti sono stati azzerati.`;
 return true;
}
function setOwnPlayerInjury(entry,rounds=1){
 if(!entry)return false;const player=entry.player||playerById(entry.playerId);if(!player)return false;
 if(parallelCupDisciplineImmunity()){const cup=parallelCupState();cup.notice=`Protezione Coppa: evitato l’infortunio di ${player.name}.`;return false;}
 if(state.activeEffects.some(effect=>effect.type==='injuryImmunity')){const q=questState();q.notice=`MilanLab ha evitato l’infortunio di ${player.name}.`;return false;}
 if(typeof redPillProtectsPlayer==='function'&&redPillProtectsPlayer(entry.playerId)){state.seasonRules.redPillLastProtection=`La Pillola rossa ha evitato l’infortunio di ${player.name}.`;return false;}
 const adjustedRounds=failMilanLabForInjury(entry,rounds),status=statusOf(entry.playerId),before=Number(status.injury)||0;status.injury=Math.max(before,adjustedRounds);
 if(status.injury>before){if(sponsorFootballManagerActive())state.seasonRules.fmInjuryOccurred=true;futureInjuryPenalty(player.name)}
 return true;
}
function startingGoalkeeperEntry(){const starter=getStarterEntries().find(entry=>entry.slot==='P'||roleOf(entry.player)==='P');if(starter)return starter;if(state.formation==='3-3-3')return null;return rosterPlayers().find(entry=>roleOf(entry.player)==='P')||null}
function ruleOutForSeason(entry,reason=''){if(!entry)return 'Nessun giocatore disponibile.';const player=entry.player||playerById(entry.playerId);if(!player)return 'Nessun giocatore disponibile.';if(!setOwnPlayerInjury(entry,remainingSeasonMatches()))return `${player.name} è protetto e non può infortunarsi.`;const status=statusOf(entry.playerId);status.seasonOut=true;status.seasonOutReason=String(reason||'Fuori fino a fine stagione');delete state.playInjured[String(entry.playerId)];return `${player.name} è fuori per il resto della stagione.${state.seasonRules.futureInjuryZeroPoints?' I tuoi punti sono stati azzerati.':''}`}
function mandatoryMidseasonPlayerIds(source=state){
 const rules=source?.seasonRules||{};
 const mid=source?.midseason||{};
 const ids=[...(Array.isArray(mid.mandatoryOutgoingIds)?mid.mandatoryOutgoingIds:[]),mid.mandatoryOutgoingId,...(Array.isArray(rules.mandatoryMidseasonPlayerIds)?rules.mandatoryMidseasonPlayerIds:[]),rules.mandatoryMidseasonPlayerId].map(String).filter(Boolean);
 return [...new Set(ids)].filter(id=>source===state?Boolean(rosterEntry(id)):true);
}
function queueMandatoryMidseasonPlayer(id){
 const playerId=String(id||'');if(!playerId)return false;
 const current=mandatoryMidseasonPlayerIds();
 if(!current.includes(playerId))current.push(playerId);
 state.seasonRules.mandatoryMidseasonPlayerIds=current.slice(0,3);
 state.seasonRules.mandatoryMidseasonPlayerId=state.seasonRules.mandatoryMidseasonPlayerIds[0]||'';
 return true;
}
function equalOrBetterMidseasonPlayerIds(source=state){
 const rules=source?.seasonRules||{};
 return [...new Set((Array.isArray(rules.equalOrBetterMidseasonPlayerIds)?rules.equalOrBetterMidseasonPlayerIds:[]).map(String).filter(Boolean))];
}
function queueEqualOrBetterMidseasonPlayer(id){
 const playerId=String(id||'');if(!playerId)return false;
 queueMandatoryMidseasonPlayer(playerId);
 const ids=equalOrBetterMidseasonPlayerIds();if(!ids.includes(playerId))ids.push(playerId);
 state.seasonRules.equalOrBetterMidseasonPlayerIds=ids.slice(0,3);
 return true;
}
function requiresEqualOrBetterMidseason(id,source=state){return equalOrBetterMidseasonPlayerIds(source).includes(String(id||''))}
function clearMandatoryMidseasonPlayer(id){
 const playerId=String(id||'');
 const remaining=mandatoryMidseasonPlayerIds().filter(item=>item!==playerId);
 state.seasonRules.mandatoryMidseasonPlayerIds=remaining;
 state.seasonRules.mandatoryMidseasonPlayerId=remaining[0]||'';
 state.seasonRules.equalOrBetterMidseasonPlayerIds=equalOrBetterMidseasonPlayerIds().filter(item=>item!==playerId);
 if(state.midseason){state.midseason.mandatoryOutgoingIds=remaining;state.midseason.mandatoryOutgoingId=remaining[0]||'';}
}


function normalizeCampionatoState(input){
 const next=input&&typeof input==='object'?input:freshState();
 next.competitionVariant=normalizeCompetitionVariant(next.competitionVariant);
 next.userClubId=String(next.userClubId||DEFAULT_NORMALIZED_USER_CLUB_ID);
 const loadedTeamName=String(next.teamName||'').trim();
 const loadedCoachName=String(next.coachName||'').trim();
 next.teamName=String(next.phase==='setup'&&isLegacySetupTeamName(loadedTeamName)?initialSetupTeamName():(loadedTeamName||initialSetupTeamName()||(next.phase==='setup'?'':clubById(next.userClubId)?.name||DEFAULT_TEAM_NAME)));
 next.coachName=String(next.phase==='setup'&&isLegacySetupCoachName(loadedCoachName)?initialSetupCoachName():(loadedCoachName||initialSetupCoachName()));
 next.coachType=normalizeCoachType(next.coachType||localStorage.getItem(SETUP_COACH_TYPE_KEY)||'anonymous');
 next.gameMode=next.gameMode==='chaos'?'chaos':'normal';
 next.setupStep=clamp(Number(next.setupStep)||1,1,4);
 const normalizedSetupPalette=teamPalettePreset(next.teamPaletteId||localStorage.getItem(SETUP_PALETTE_KEY)||'fantaballa');
 next.teamPaletteId=normalizedSetupPalette.id;
 const existingUserTeamColors=Array.isArray(next.teams)?next.teams.find(team=>String(team?.id)===String(USER_ID))?.colors:null;
 next.teamColors=normalizeClubColors(next.teamColors||existingUserTeamColors||clubById(next.userClubId)?.colorClub||teamColorsForPalette(normalizedSetupPalette.id));
 if(next.phase&&next.phase!=='setup')next.setupStep=4;
 next.chaos=next.chaos&&typeof next.chaos==='object'?next.chaos:{};
 next.chaos.lastPreparedMatchday=Number.isFinite(Number(next.chaos.lastPreparedMatchday))?Number(next.chaos.lastPreparedMatchday):-1;
 next.chaos.totalDecisions=Math.max(0,Number(next.chaos.totalDecisions)||0);
 next.chaos.currentRound=next.chaos.currentRound&&typeof next.chaos.currentRound==='object'?next.chaos.currentRound:null;
 next.chaos.latest=Array.isArray(next.chaos.latest)?next.chaos.latest:[];
 next.chaos.midseasonDone=Boolean(next.chaos.midseasonDone);
 if(!next.draft||typeof next.draft!=='object')next.draft=freshState().draft;
 next.draft.roster=Array.isArray(next.draft.roster)?next.draft.roster:[];
 const legacyDraftClubKey=String(next.draft.clubId||next.draft.nation||'');
 const migratedDraftClub=clubById(legacyDraftClubKey)||CLUBS.find(club=>normalizeName(club.name)===normalizeName(legacyDraftClubKey))||null;
 next.draft.clubId=migratedDraftClub?String(migratedDraftClub.id):'';
 next.draft.nation='';
 next.draft.candidates=Array.isArray(next.draft.candidates)?next.draft.candidates.map(String):[];
 if(!next.draft.clubId)next.draft.candidates=[];
 next.draft.pendingPlayerId=String(next.draft.pendingPlayerId||'');
 next.draft.openingClubShown=Boolean(next.draft.openingClubShown||next.draft.roster.length||next.draft.clubId);
 const coachDraftLimit=initialDraftRerollLimit(next.coachType);
 next.draft.rerolls=Math.max(0,Math.min(coachDraftLimit,Number.isFinite(Number(next.draft.rerolls))?Number(next.draft.rerolls):coachDraftLimit));
 if(next.coachType==='talent-scout'&&next.phase==='draft'&&!next.draft.roster.length&&!next.draft.clubId&&next.draft.rerolls===3)next.draft.rerolls=4;
 const layouts=formationSlots(next.formation||'4-3-3');
 const used=new Set();
 next.draft.roster.forEach((entry,index)=>{
   entry.playerId=String(entry.playerId||entry.player?.id||'');
   entry.bench=Boolean(entry.bench||String(entry.slot||'').startsWith('PAN'));
   entry.captainForcedMatches=Math.max(0,Math.floor(Number(entry.captainForcedMatches)||0));
   entry.leaderQuestForcedMatches=Math.max(0,Math.floor(Number(entry.leaderQuestForcedMatches)||0));
   if(entry.bench){entry.slot=entry.slot||`PAN${Math.min(3,index+1)}`;entry.slotId=entry.slotId||`bench-${String(entry.slot).replace(/\D/g,'')||1}`;return}
   let found=layouts.find(slot=>slot.instanceId===entry.slotId&&!used.has(slot.instanceId));
   if(!found)found=layouts.find(slot=>slot.code===entry.slot&&!used.has(slot.instanceId));
   if(!found)found=layouts.find(slot=>!used.has(slot.instanceId));
   if(found){entry.slotId=found.instanceId;entry.slot=found.code;used.add(found.instanceId)}
 });
 next.activeEffects=normalizeActiveEffects(next.activeEffects);
 next.seenDecisionEvents=Array.isArray(next.seenDecisionEvents)?[...new Set(next.seenDecisionEvents.map(String))]:[];
 next.statuses=next.statuses&&typeof next.statuses==='object'?next.statuses:{};
 Object.values(next.statuses).forEach(status=>{if(!status||typeof status!=='object')return;status.injury=Math.max(0,Number(status.injury)||0);status.suspension=Math.max(0,Number(status.suspension)||0);status.seasonOut=Boolean(status.seasonOut);status.seasonOutReason=String(status.seasonOutReason||'');});
 next.playInjured=next.playInjured&&typeof next.playInjured==='object'?next.playInjured:{};
 next.analytics=next.analytics&&typeof next.analytics==='object'?next.analytics:{};
 next.analytics.initialOvr=Math.max(0,Number(next.analytics.initialOvr)||0);
 next.analytics.injuries=Math.max(0,Number(next.analytics.injuries)||0);
 next.analytics.redCards=Math.max(0,Number(next.analytics.redCards)||0);
 next.analytics.eventLog=Array.isArray(next.analytics.eventLog)?next.analytics.eventLog:[];
 next.analytics.biggestResult=next.analytics.biggestResult&&typeof next.analytics.biggestResult==='object'?next.analytics.biggestResult:null;
 if(!next.analytics.initialOvr&&next.draft.roster.length){const initialStarters=next.draft.roster.filter(entry=>!entry.bench),values=initialStarters.map(entry=>Number(entry.player?.ovr)||Number(PLAYERS.find(player=>String(player.id)===String(entry.playerId))?.ovr)||0).filter(Boolean);if(values.length)next.analytics.initialOvr=Math.round((values.reduce((sum,value)=>sum+value,0)/values.length)*10)/10;}
 next.seasonRules=next.seasonRules&&typeof next.seasonRules==='object'?next.seasonRules:{};
 next.seasonRules.midseasonPickDelta=clamp(Number(next.seasonRules.midseasonPickDelta)||0,-1,1);
 next.seasonRules.midseasonExtraRerolls=clamp(Number(next.seasonRules.midseasonExtraRerolls)||0,0,3);
 next.seasonRules.autoDecisions=Boolean(next.seasonRules.autoDecisions);
 next.seasonRules.autoMidseason=Boolean(next.seasonRules.autoMidseason);
 next.seasonRules.botMidseason=Boolean(next.seasonRules.botMidseason);
 next.seasonRules.mandatoryMidseasonPlayerId=String(next.seasonRules.mandatoryMidseasonPlayerId||'');
 next.seasonRules.mandatoryMidseasonPlayerIds=[...new Set([...(Array.isArray(next.seasonRules.mandatoryMidseasonPlayerIds)?next.seasonRules.mandatoryMidseasonPlayerIds:[]),next.seasonRules.mandatoryMidseasonPlayerId].map(String).filter(Boolean))].slice(0,3);
 next.seasonRules.mandatoryMidseasonPlayerId=next.seasonRules.mandatoryMidseasonPlayerIds[0]||'';
 next.seasonRules.equalOrBetterMidseasonPlayerIds=[...new Set((Array.isArray(next.seasonRules.equalOrBetterMidseasonPlayerIds)?next.seasonRules.equalOrBetterMidseasonPlayerIds:[]).map(String).filter(id=>next.seasonRules.mandatoryMidseasonPlayerIds.includes(id)))].slice(0,3);
 next.seasonRules.marottaDoubleWins=Boolean(next.seasonRules.marottaDoubleWins);
 next.seasonRules.marottaLossPenalty=Math.max(0,Number(next.seasonRules.marottaLossPenalty)||0);
 next.seasonRules.winPoints=Number.isFinite(Number(next.seasonRules.winPoints))?Math.max(0,Number(next.seasonRules.winPoints)):3;
 next.seasonRules.drawPoints=Number.isFinite(Number(next.seasonRules.drawPoints))?Math.max(0,Number(next.seasonRules.drawPoints)):1;
 next.seasonRules.seasonLength=clamp(Math.floor(Number(next.seasonRules.seasonLength)||38),1,200);
 next.seasonRules.matchDuration=[30,90,120].includes(Number(next.seasonRules.matchDuration))?Number(next.seasonRules.matchDuration):90;
 next.seasonRules.longMatchRisk=Boolean(next.seasonRules.longMatchRisk);
 next.seasonRules.deathMatchClubId=String(next.seasonRules.deathMatchClubId||'');
 next.seasonRules.deathMatchClubName=String(next.seasonRules.deathMatchClubName||'');
 next.seasonRules.deathMatchClubBonus=Math.max(0,Number(next.seasonRules.deathMatchClubBonus)||10);
 next.seasonRules.sixtyPointFear=Boolean(next.seasonRules.sixtyPointFear);
 next.seasonRules.sixtyPointFearTriggered=Boolean(next.seasonRules.sixtyPointFearTriggered);
 next.seasonRules.redCardGoals=Boolean(next.seasonRules.redCardGoals);
 next.seasonRules.pointsEqualGoals=Boolean(next.seasonRules.pointsEqualGoals);
 next.seasonRules.yellowEqualsRed=Boolean(next.seasonRules.yellowEqualsRed);
 next.seasonRules.pinkCardEndsMatch=Boolean(next.seasonRules.pinkCardEndsMatch);
 next.seasonRules.federationGoalRule=['golden','last'].includes(String(next.seasonRules.federationGoalRule))?String(next.seasonRules.federationGoalRule):'';
 next.seasonRules.figcCompetitionRule=['formula-one','no-draw'].includes(String(next.seasonRules.figcCompetitionRule))?String(next.seasonRules.figcCompetitionRule):'';
 next.seasonRules.fgicLeagueRule=['playoffs','bottom-help'].includes(String(next.seasonRules.fgicLeagueRule))?String(next.seasonRules.fgicLeagueRule):'';
 next.seasonRules.bottomHelpRoundTeamIds=[...new Set((Array.isArray(next.seasonRules.bottomHelpRoundTeamIds)?next.seasonRules.bottomHelpRoundTeamIds:[]).map(String).filter(Boolean))];
 next.seasonRules.fgciPointsRule=['heavy-goals','clean-sheet'].includes(String(next.seasonRules.fgciPointsRule))?String(next.seasonRules.fgciPointsRule):'';
 next.seasonRules.fgciResultRule=['boredom-wins','all-in'].includes(String(next.seasonRules.fgciResultRule))?String(next.seasonRules.fgciResultRule):'';
 next.seasonRules.fantaballaVideoRule=['reverse-points','two-goals-to-win'].includes(String(next.seasonRules.fantaballaVideoRule))?String(next.seasonRules.fantaballaVideoRule):'';
 next.seasonRules.italiaCatenaccioRule=['allegri','goal-disgust'].includes(String(next.seasonRules.italiaCatenaccioRule))?String(next.seasonRules.italiaCatenaccioRule):'';
 next.seasonRules.spaceJamRule=['talent-steal','random-kickoff'].includes(String(next.seasonRules.spaceJamRule))?String(next.seasonRules.spaceJamRule):'';
 next.seasonRules.spaceJamTalentPending=Boolean(next.seasonRules.spaceJamTalentPending&&next.seasonRules.spaceJamRule==='talent-steal');
 next.seasonRules.spaceJamLastOutcome=String(next.seasonRules.spaceJamLastOutcome||'');
 next.seasonRules.frenchEventChoice=['flying-keeper','late-turn'].includes(String(next.seasonRules.frenchEventChoice))?String(next.seasonRules.frenchEventChoice):'';
 next.seasonRules.frenchFlyingKeeperId=String(next.seasonRules.frenchFlyingKeeperId||'');
 next.seasonRules.frenchFlyingAttackerId=String(next.seasonRules.frenchFlyingAttackerId||'');
 next.seasonRules.frenchFlyingAttackSlot=String(next.seasonRules.frenchFlyingAttackSlot||'');
 next.seasonRules.frenchLateAttackerBoostActive=Boolean(next.seasonRules.frenchLateAttackerBoostActive&&next.seasonRules.frenchEventChoice==='late-turn');
 next.seasonRules.frenchLateAttackerBoostCount=Math.max(0,Number(next.seasonRules.frenchLateAttackerBoostCount)||0);
 next.seasonRules.frenchLateAttackerBoosts=next.seasonRules.frenchLateAttackerBoosts&&typeof next.seasonRules.frenchLateAttackerBoosts==='object'?next.seasonRules.frenchLateAttackerBoosts:{};
 Object.keys(next.seasonRules.frenchLateAttackerBoosts).forEach(id=>{next.seasonRules.frenchLateAttackerBoosts[id]=Math.max(0,Number(next.seasonRules.frenchLateAttackerBoosts[id])||0)});
 next.seasonRules.sponsorChoice=['ballarini','football-manager'].includes(String(next.seasonRules.sponsorChoice))?String(next.seasonRules.sponsorChoice):'';
 next.seasonRules.sponsorOvrExtra=next.seasonRules.sponsorChoice==='ballarini'?5:0;
 next.seasonRules.sponsorOvrBoostCount=Math.max(0,Number(next.seasonRules.sponsorOvrBoostCount)||0);
 next.seasonRules.ballariniPlayerBonus=next.seasonRules.ballariniPlayerBonus&&typeof next.seasonRules.ballariniPlayerBonus==='object'?next.seasonRules.ballariniPlayerBonus:{};
 Object.keys(next.seasonRules.ballariniPlayerBonus).forEach(id=>{next.seasonRules.ballariniPlayerBonus[id]=Math.max(0,Number(next.seasonRules.ballariniPlayerBonus[id])||0)});
 next.seasonRules.physioInjuryMultiplier=next.seasonRules.sponsorChoice==='football-manager'?.5:1;
 next.seasonRules.fmTacticianWins=Math.max(0,Number(next.seasonRules.fmTacticianWins)||0);
 next.seasonRules.fmInjuryOccurred=Boolean(next.seasonRules.fmInjuryOccurred);
 next.seasonRules.dynamicLeague=['expanded','elite'].includes(String(next.seasonRules.dynamicLeague))?String(next.seasonRules.dynamicLeague):'';
 next.seasonRules.dynamicLeagueLabel=String(next.seasonRules.dynamicLeagueLabel||'');
 next.seasonRules.dynamicLeagueAppliedAt=Number.isFinite(Number(next.seasonRules.dynamicLeagueAppliedAt))?Number(next.seasonRules.dynamicLeagueAppliedAt):-1;
 const legacyMarathonRules=Number(next.seasonRules.winPoints)===1.5&&Number(next.seasonRules.drawPoints)===0&&next.seasonRules.pointsEqualGoals===false&&Number(next.seasonRules.seasonLength)>=76;
 next.seasonRules.marathon=Boolean(next.seasonRules.marathon||legacyMarathonRules);
 next.seasonRules.dynamicLeagueTeamIds=[...new Set((Array.isArray(next.seasonRules.dynamicLeagueTeamIds)?next.seasonRules.dynamicLeagueTeamIds:[]).map(String).filter(Boolean))];
 next.seasonRules.nonItalianChemZero=Boolean(next.seasonRules.nonItalianChemZero);
 next.seasonRules.eventChanceMultiplier=clamp(Number(next.seasonRules.eventChanceMultiplier)||1,1,2);
 next.seasonRules.leagueFormation=FORMATIONS[String(next.seasonRules.leagueFormation||'')]?String(next.seasonRules.leagueFormation):'';
 next.seasonRules.userFormationOverride=FORMATIONS[String(next.seasonRules.userFormationOverride||'')]?String(next.seasonRules.userFormationOverride):'';
 next.seasonRules.injuredOvrBonus=Math.max(0,Number(next.seasonRules.injuredOvrBonus)||0);
 next.seasonRules.lateGoalsDouble=Boolean(next.seasonRules.lateGoalsDouble);
 next.seasonRules.zeroZeroNoPoints=Boolean(next.seasonRules.zeroZeroNoPoints);
 next.seasonRules.topPlayerAfterMandatoryId=String(next.seasonRules.topPlayerAfterMandatoryId||'');
 next.seasonRules.guaranteedTopPlayerNextMidseason=Boolean(next.seasonRules.guaranteedTopPlayerNextMidseason);
 next.seasonRules.coachTopSwapPlayerId=String(next.seasonRules.coachTopSwapPlayerId||'');
 next.seasonRules.fantaguruBetterMidseason=Boolean(next.seasonRules.fantaguruBetterMidseason);
 next.seasonRules.autoOptimizeLineup=Boolean(next.seasonRules.autoOptimizeLineup);
 next.seasonRules.futureScorerPlayerId=String(next.seasonRules.futureScorerPlayerId||'');
 next.seasonRules.futureScorerPlayerName=String(next.seasonRules.futureScorerPlayerName||'');
 next.seasonRules.futureInjuryZeroPoints=Boolean(next.seasonRules.futureInjuryZeroPoints);
 next.seasonRules.futureInjuryPenaltyNotice=String(next.seasonRules.futureInjuryPenaltyNotice||'');
 next.seasonRules.hungerGames=Boolean(next.seasonRules.hungerGames);
 next.seasonRules.eliminatedTeamIds=[...new Set((Array.isArray(next.seasonRules.eliminatedTeamIds)?next.seasonRules.eliminatedTeamIds:[]).map(String).filter(Boolean))];
 next.seasonRules.generatedEventPlayers=Array.isArray(next.seasonRules.generatedEventPlayers)?next.seasonRules.generatedEventPlayers.filter(player=>player&&player.id).map(player=>({...player,id:String(player.id),ovr:Math.max(1,Number(player.ovr)||60)})):[];
 next.seasonRules.opponentExcludedPlayerIds=[...new Set((Array.isArray(next.seasonRules.opponentExcludedPlayerIds)?next.seasonRules.opponentExcludedPlayerIds:[]).map(String).filter(Boolean))];
 const stefanoChallenge=next.seasonRules.stefanoFinariChallenge&&typeof next.seasonRules.stefanoFinariChallenge==='object'?next.seasonRules.stefanoFinariChallenge:{};stefanoChallenge.active=Boolean(stefanoChallenge.active);stefanoChallenge.startedMatchday=Number.isFinite(Number(stefanoChallenge.startedMatchday))?Number(stefanoChallenge.startedMatchday):-1;stefanoChallenge.resolved=Boolean(stefanoChallenge.resolved);stefanoChallenge.result=String(stefanoChallenge.result||'');next.seasonRules.stefanoFinariChallenge=stefanoChallenge;
 next.seasonRules.laCurvaRewardActive=Boolean(next.seasonRules.laCurvaRewardActive);
 next.seasonRules.buffonGlovesActive=Boolean(next.seasonRules.buffonGlovesActive);
 next.seasonRules.motivatorPermanentChemistry=next.seasonRules.motivatorPermanentChemistry&&typeof next.seasonRules.motivatorPermanentChemistry==='object'?Object.fromEntries(Object.entries(next.seasonRules.motivatorPermanentChemistry).map(([id,value])=>[String(id),Math.max(0,Number(value)||0)]).filter(([,value])=>value>0)):{};
 next.seasonRules.ductilityScorerOvr=next.seasonRules.ductilityScorerOvr&&typeof next.seasonRules.ductilityScorerOvr==='object'?Object.fromEntries(Object.entries(next.seasonRules.ductilityScorerOvr).map(([id,value])=>[String(id),Math.max(0,Math.floor(Number(value)||0))]).filter(([,value])=>value>0)):{};
 const pendingParity=next.seasonRules.pendingParityReset&&typeof next.seasonRules.pendingParityReset==='object'?next.seasonRules.pendingParityReset:{};
 pendingParity.active=Boolean(pendingParity.active);
 pendingParity.parity=['even','odd'].includes(String(pendingParity.parity))?String(pendingParity.parity):'';
 pendingParity.dueMatchday=Number.isFinite(Number(pendingParity.dueMatchday))?Number(pendingParity.dueMatchday):-1;
 pendingParity.scheduledAt=Number.isFinite(Number(pendingParity.scheduledAt))?Number(pendingParity.scheduledAt):-1;
 pendingParity.appliedMatchday=Number.isFinite(Number(pendingParity.appliedMatchday))?Number(pendingParity.appliedMatchday):-1;
 pendingParity.lastResult=String(pendingParity.lastResult||'');
 if(!pendingParity.parity||pendingParity.dueMatchday<0)pendingParity.active=false;
 next.seasonRules.pendingParityReset=pendingParity;
 const curvaContest=next.seasonRules.curvaContest&&typeof next.seasonRules.curvaContest==='object'?next.seasonRules.curvaContest:{};
 curvaContest.active=Boolean(curvaContest.active);
 curvaContest.mode=['title','home','away'].includes(String(curvaContest.mode))?String(curvaContest.mode):'';
 curvaContest.status=['idle','active','won','lost','away'].includes(String(curvaContest.status))?String(curvaContest.status):'idle';
 curvaContest.startedMatchday=Number.isFinite(Number(curvaContest.startedMatchday))?Number(curvaContest.startedMatchday):-1;
 curvaContest.deadlineMatchday=Number.isFinite(Number(curvaContest.deadlineMatchday))?Number(curvaContest.deadlineMatchday):-1;
 curvaContest.pendingTeamId=String(curvaContest.pendingTeamId||'');
 curvaContest.lastResult=String(curvaContest.lastResult||'');
 curvaContest.switchedFromTeamName=String(curvaContest.switchedFromTeamName||'');
 curvaContest.switchedToTeamName=String(curvaContest.switchedToTeamName||'');
 if(!curvaContest.mode)curvaContest.active=false;
 next.seasonRules.curvaContest=curvaContest;
 const secretDeal=next.seasonRules.secretRefereeDeal&&typeof next.seasonRules.secretRefereeDeal==='object'?next.seasonRules.secretRefereeDeal:{};
 secretDeal.active=Boolean(secretDeal.active);
 secretDeal.choice=['accept','refuse'].includes(String(secretDeal.choice))?String(secretDeal.choice):'';
 secretDeal.startedMatchday=Number.isFinite(Number(secretDeal.startedMatchday))?Number(secretDeal.startedMatchday):-1;
 secretDeal.earnedPoints=Math.max(0,Number(secretDeal.earnedPoints)||0);
 secretDeal.matchesChecked=Math.max(0,Number(secretDeal.matchesChecked)||0);
 secretDeal.discovered=Boolean(secretDeal.discovered);
 secretDeal.discoveredMatchday=Number.isFinite(Number(secretDeal.discoveredMatchday))?Number(secretDeal.discoveredMatchday):-1;
 secretDeal.lastAdjustment=Number(secretDeal.lastAdjustment)||0;
 if(!secretDeal.choice)secretDeal.active=false;
 next.seasonRules.secretRefereeDeal=secretDeal;
 next.inventory=next.inventory&&typeof next.inventory==='object'?next.inventory:{};
 next.inventory.capacity=clamp(Math.floor(Number(next.inventory.capacity)||3),1,10);
 next.inventory.items=(Array.isArray(next.inventory.items)?next.inventory.items:[]).filter(item=>item&&typeof item==='object'&&String(item.id||'')).map(item=>({id:String(item.id),quantity:Math.max(1,Math.floor(Number(item.quantity)||1)),acquiredMatchday:Number.isFinite(Number(item.acquiredMatchday))?Number(item.acquiredMatchday):Number(next.matchday)||0,source:String(item.source||'')}));
 const mergedInventoryItems=new Map();next.inventory.items.forEach(item=>{const current=mergedInventoryItems.get(item.id);if(current)current.quantity+=item.quantity;else mergedInventoryItems.set(item.id,{...item})});next.inventory.items=[...mergedInventoryItems.values()];
 const activeInventoryItem=next.inventory.active&&typeof next.inventory.active==='object'?next.inventory.active:null;
 next.inventory.active=activeInventoryItem&&String(activeInventoryItem.id||'')?{id:String(activeInventoryItem.id),playerId:String(activeInventoryItem.playerId||''),playerName:String(activeInventoryItem.playerName||''),activatedMatchday:Number.isFinite(Number(activeInventoryItem.activatedMatchday))?Number(activeInventoryItem.activatedMatchday):Number(next.matchday)||0,retainedCount:Math.max(0,Math.floor(Number(activeInventoryItem.retainedCount)||0))}:null;
 next.inventory.rokkyStarterGranted=Boolean(next.inventory.rokkyStarterGranted);
 const pendingPack=next.inventory.pendingPack&&typeof next.inventory.pendingPack==='object'?next.inventory.pendingPack:null;next.inventory.pendingPack=pendingPack?{candidateIds:[...new Set((Array.isArray(pendingPack.candidateIds)?pendingPack.candidateIds:[]).map(String).filter(Boolean))].slice(0,3),openedMatchday:Number.isFinite(Number(pendingPack.openedMatchday))?Number(pendingPack.openedMatchday):Number(next.matchday)||0}:null;if(next.inventory.pendingPack&&!next.inventory.pendingPack.candidateIds.length)next.inventory.pendingPack=null;
 next.quest=next.quest&&typeof next.quest==='object'?next.quest:{};
 next.quest.active=Boolean(next.quest.active);next.quest.id=String(next.quest.id||'');next.quest.title=String(next.quest.title||'');next.quest.status=String(next.quest.status||'idle');next.quest.acceptedMatchday=Number.isFinite(Number(next.quest.acceptedMatchday))?Number(next.quest.acceptedMatchday):-1;next.quest.matchesPlayed=Math.max(0,Number(next.quest.matchesPlayed)||0);next.quest.progress=Math.max(0,Number(next.quest.progress)||0);next.quest.target=Math.max(0,Number(next.quest.target)||0);next.quest.deadlineMatches=Math.max(0,Number(next.quest.deadlineMatches)||0);next.quest.targetPlayerId=String(next.quest.targetPlayerId||'');next.quest.targetPlayerName=String(next.quest.targetPlayerName||'');next.quest.targetTeamIds=[...new Set((Array.isArray(next.quest.targetTeamIds)?next.quest.targetTeamIds:[]).map(String))];next.quest.facedTeamIds=[...new Set((Array.isArray(next.quest.facedTeamIds)?next.quest.facedTeamIds:[]).map(String))];next.quest.rewardActive=Boolean(next.quest.rewardActive);next.quest.objective=String(next.quest.objective||'');next.quest.reward=String(next.quest.reward||'');next.quest.penalty=String(next.quest.penalty||'');next.quest.summary=String(next.quest.summary||'');next.quest.notice=String(next.quest.notice||'');
 next.quest.awaitingPlayerSelection=Boolean(next.quest.awaitingPlayerSelection);next.quest.scorerIds=[...new Set((Array.isArray(next.quest.scorerIds)?next.quest.scorerIds:[]).map(String).filter(Boolean))];next.quest.scorerNames=next.quest.scorerNames&&typeof next.quest.scorerNames==='object'?next.quest.scorerNames:{};
 next.eventChains=next.eventChains&&typeof next.eventChains==='object'?next.eventChains:{};
 next.eventChains.mentalista=next.eventChains.mentalista&&typeof next.eventChains.mentalista==='object'?next.eventChains.mentalista:{};
 next.eventChains.mentalista.active=Boolean(next.eventChains.mentalista.active);
 next.eventChains.mentalista.stage=Math.max(0,Number(next.eventChains.mentalista.stage)||0);
 next.eventChains.mentalista.playerId=String(next.eventChains.mentalista.playerId||'');
 next.eventChains.mentalista.playerName=String(next.eventChains.mentalista.playerName||'');
 next.eventChains.mentalista.originalOvr=Math.max(1,Number(next.eventChains.mentalista.originalOvr)||1);
 next.eventChains.mentalista.dueMatchday=Number.isFinite(Number(next.eventChains.mentalista.dueMatchday))?Number(next.eventChains.mentalista.dueMatchday):-1;
 next.eventChains.mentalista.training=Boolean(next.eventChains.mentalista.training);
 next.eventChains.mentalista.nature=Boolean(next.eventChains.mentalista.nature);
 next.eventChains.mentalista.goals=Math.max(0,Number(next.eventChains.mentalista.goals)||0);
 next.eventChains.mentalista.completed=Boolean(next.eventChains.mentalista.completed);
 next.eventChains.general=next.eventChains.general&&typeof next.eventChains.general==='object'?next.eventChains.general:{};
 next.eventChains.general.active=Boolean(next.eventChains.general.active);
 next.eventChains.general.stage=Math.max(0,Number(next.eventChains.general.stage)||0);
 next.eventChains.general.dueMatchday=Number.isFinite(Number(next.eventChains.general.dueMatchday))?Number(next.eventChains.general.dueMatchday):-1;
 next.eventChains.general.replacements=Array.isArray(next.eventChains.general.replacements)?next.eventChains.general.replacements.filter(item=>item&&item.originalPlayer).map(item=>({...item,replacementId:String(item.replacementId||''),slotId:String(item.slotId||''),originalPlayer:{...item.originalPlayer,id:String(item.originalPlayer.id||'')}})):[];
 next.eventChains.general.nationalBoostPending=Boolean(next.eventChains.general.nationalBoostPending);
 next.eventChains.general.completed=Boolean(next.eventChains.general.completed);
 next.eventChains.pinguino=next.eventChains.pinguino&&typeof next.eventChains.pinguino==='object'?next.eventChains.pinguino:{};
 next.eventChains.pinguino.active=Boolean(next.eventChains.pinguino.active);
 next.eventChains.pinguino.stage=Math.max(0,Number(next.eventChains.pinguino.stage)||0);
 next.eventChains.pinguino.dueMatchday=Number.isFinite(Number(next.eventChains.pinguino.dueMatchday))?Number(next.eventChains.pinguino.dueMatchday):-1;
 next.eventChains.pinguino.mode=['ludopatia','tipster'].includes(String(next.eventChains.pinguino.mode))?String(next.eventChains.pinguino.mode):'';
 next.eventChains.pinguino.completed=Boolean(next.eventChains.pinguino.completed);
 next.eventChains.pinguino.wins=Math.max(0,Number(next.eventChains.pinguino.wins)||0);
 next.eventChains.pinguino.nonWins=Math.max(0,Number(next.eventChains.pinguino.nonWins)||0);

 next.eventChains.mysteryCharacter=next.eventChains.mysteryCharacter&&typeof next.eventChains.mysteryCharacter==='object'?next.eventChains.mysteryCharacter:{};
 const mysteryCharacterState=next.eventChains.mysteryCharacter;
 mysteryCharacterState.active=Boolean(mysteryCharacterState.active);
 mysteryCharacterState.stage=Math.max(0,Number(mysteryCharacterState.stage)||0);
 mysteryCharacterState.branch=['tearless','champion'].includes(String(mysteryCharacterState.branch))?String(mysteryCharacterState.branch):'';
 mysteryCharacterState.playerId=String(mysteryCharacterState.playerId||'');
 mysteryCharacterState.playerName=String(mysteryCharacterState.playerName||'');
 mysteryCharacterState.dueMatchday=Number.isFinite(Number(mysteryCharacterState.dueMatchday))?Number(mysteryCharacterState.dueMatchday):-1;
 mysteryCharacterState.completed=Boolean(mysteryCharacterState.completed);
 mysteryCharacterState.finale=mysteryCharacterState.finale&&typeof mysteryCharacterState.finale==='object'?mysteryCharacterState.finale:{};
 mysteryCharacterState.finale.eligible=Boolean(mysteryCharacterState.finale.eligible);
 mysteryCharacterState.finale.categories=[...new Set((Array.isArray(mysteryCharacterState.finale.categories)?mysteryCharacterState.finale.categories:[]).map(String).filter(Boolean))];
 mysteryCharacterState.finale.played=Boolean(mysteryCharacterState.finale.played);
 mysteryCharacterState.finale.userGoals=Math.max(0,Number(mysteryCharacterState.finale.userGoals)||0);
 mysteryCharacterState.finale.opponentGoals=Math.max(0,Number(mysteryCharacterState.finale.opponentGoals)||0);
 mysteryCharacterState.finale.won=Boolean(mysteryCharacterState.finale.won);
 mysteryCharacterState.finale.pointsDelta=Number(mysteryCharacterState.finale.pointsDelta)||0;
 mysteryCharacterState.finale.pointsApplied=Boolean(mysteryCharacterState.finale.pointsApplied);
 mysteryCharacterState.finale.rankBeforeBonus=Math.max(0,Number(mysteryCharacterState.finale.rankBeforeBonus)||0);
 mysteryCharacterState.finale.rankAfterBonus=Math.max(0,Number(mysteryCharacterState.finale.rankAfterBonus)||0);
 mysteryCharacterState.finale.pointsBeforeBonus=Number(mysteryCharacterState.finale.pointsBeforeBonus)||0;

 (Array.isArray(next.draft?.roster)?next.draft.roster:[]).forEach(entry=>{entry.tipsterForcedMatches=Math.max(0,Number(entry.tipsterForcedMatches)||0);entry.tipsterForced=entry.tipsterForcedMatches>0;});

 next.story=next.story&&typeof next.story==='object'?next.story:{};
 next.story.merit=next.story.merit&&typeof next.story.merit==='object'?next.story.merit:{};
 const meritStoryState=next.story.merit;
 meritStoryState.initialized=Boolean(meritStoryState.initialized);
 meritStoryState.scheduled=Boolean(meritStoryState.scheduled);
 meritStoryState.triggerMatchday=Number.isFinite(Number(meritStoryState.triggerMatchday))?clamp(Number(meritStoryState.triggerMatchday),1,18):-1;
 meritStoryState.stage=String(meritStoryState.stage||'idle');
 meritStoryState.playerId=String(meritStoryState.playerId||'');
 meritStoryState.playerName=String(meritStoryState.playerName||'');
 meritStoryState.recipientTeamId=String(meritStoryState.recipientTeamId||'');
 meritStoryState.recipientTeamName=String(meritStoryState.recipientTeamName||'');
 meritStoryState.promoted=Boolean(meritStoryState.promoted);
 meritStoryState.guaranteedGoalPending=Boolean(meritStoryState.guaranteedGoalPending);
 meritStoryState.transferred=Boolean(meritStoryState.transferred);
 meritStoryState.branch=['traded','kept'].includes(String(meritStoryState.branch))?String(meritStoryState.branch):'';
 meritStoryState.postMidseasonShown=Boolean(meritStoryState.postMidseasonShown);
 meritStoryState.challenge=meritStoryState.challenge&&typeof meritStoryState.challenge==='object'?meritStoryState.challenge:{};
 meritStoryState.challenge.active=Boolean(meritStoryState.challenge.active);
 meritStoryState.challenge.status=['idle','active','won','lost'].includes(String(meritStoryState.challenge.status))?String(meritStoryState.challenge.status):'idle';
 meritStoryState.challenge.attackerId=String(meritStoryState.challenge.attackerId||'');
 meritStoryState.challenge.attackerName=String(meritStoryState.challenge.attackerName||'');
 meritStoryState.challenge.matchesPlayed=Math.max(0,Number(meritStoryState.challenge.matchesPlayed)||0);
 meritStoryState.challenge.goals=Math.max(0,Number(meritStoryState.challenge.goals)||0);
 meritStoryState.ovrModifiers=meritStoryState.ovrModifiers&&typeof meritStoryState.ovrModifiers==='object'?Object.fromEntries(Object.entries(meritStoryState.ovrModifiers).map(([id,value])=>[String(id),Number(value)||0]).filter(([,value])=>value!==0)):{};
 meritStoryState.finale=meritStoryState.finale&&typeof meritStoryState.finale==='object'?meritStoryState.finale:{};
 meritStoryState.finale.eligible=Boolean(meritStoryState.finale.eligible);
 meritStoryState.finale.opponent=String(meritStoryState.finale.opponent||'');
 meritStoryState.finale.nation=String(meritStoryState.finale.nation||'');
 meritStoryState.finale.played=Boolean(meritStoryState.finale.played);
 meritStoryState.finale.userGoals=Math.max(0,Number(meritStoryState.finale.userGoals)||0);
 meritStoryState.finale.opponentGoals=Math.max(0,Number(meritStoryState.finale.opponentGoals)||0);
 meritStoryState.finale.won=Boolean(meritStoryState.finale.won);
 meritStoryState.finale.pointsDelta=Number(meritStoryState.finale.pointsDelta)||0;
 meritStoryState.finale.pointsApplied=Boolean(meritStoryState.finale.pointsApplied);

 next.story.fantaballopoli=next.story.fantaballopoli&&typeof next.story.fantaballopoli==='object'?next.story.fantaballopoli:{};
 const fantaStoryState=next.story.fantaballopoli;
 fantaStoryState.initialized=Boolean(fantaStoryState.initialized);
 fantaStoryState.scheduled=Boolean(fantaStoryState.scheduled);
 fantaStoryState.triggerMatchday=Number.isFinite(Number(fantaStoryState.triggerMatchday))?clamp(Number(fantaStoryState.triggerMatchday),1,18):-1;
 fantaStoryState.stage=String(fantaStoryState.stage||'idle');
 fantaStoryState.forcedLossPending=Boolean(fantaStoryState.forcedLossPending);
 fantaStoryState.targetPlayerId=String(fantaStoryState.targetPlayerId||'');
 fantaStoryState.targetPlayerName=String(fantaStoryState.targetPlayerName||'');
 fantaStoryState.targetRole=String(fantaStoryState.targetRole||'');
 fantaStoryState.midseasonResolved=Boolean(fantaStoryState.midseasonResolved);
 fantaStoryState.giudaId=String(fantaStoryState.giudaId||'');
 fantaStoryState.curseActive=Boolean(fantaStoryState.curseActive);
 fantaStoryState.negativeOvrAllowed=Boolean(fantaStoryState.negativeOvrAllowed);
 fantaStoryState.curseMatches=Math.max(0,Number(fantaStoryState.curseMatches)||0);
 fantaStoryState.satisfactionAfter=clamp(Number(fantaStoryState.satisfactionAfter)||0,0,5);
 fantaStoryState.corruptionFull=Boolean(fantaStoryState.corruptionFull);
 fantaStoryState.corruptionMatchIndex=Math.max(0,Number(fantaStoryState.corruptionMatchIndex)||0);
 fantaStoryState.investigatorDueMatchday=clamp(Number(fantaStoryState.investigatorDueMatchday)||0,0,35);
 fantaStoryState.investigatorShown=Boolean(fantaStoryState.investigatorShown);
 fantaStoryState.abruptEnd=Boolean(fantaStoryState.abruptEnd);
 fantaStoryState.completed=Boolean(fantaStoryState.completed);
 fantaStoryState.finale=fantaStoryState.finale&&typeof fantaStoryState.finale==='object'?fantaStoryState.finale:{};
 fantaStoryState.finale.eligible=Boolean(fantaStoryState.finale.eligible);
 fantaStoryState.finale.played=Boolean(fantaStoryState.finale.played);
 fantaStoryState.finale.userGoals=Math.max(0,Number(fantaStoryState.finale.userGoals)||0);
 fantaStoryState.finale.opponentGoals=Math.max(0,Number(fantaStoryState.finale.opponentGoals)||0);
 fantaStoryState.finale.won=Boolean(fantaStoryState.finale.won);
 fantaStoryState.finale.pointsApplied=Boolean(fantaStoryState.finale.pointsApplied);
 fantaStoryState.finale.rankBeforeBonus=Math.max(0,Number(fantaStoryState.finale.rankBeforeBonus)||0);
 fantaStoryState.finale.rankAfterBonus=Math.max(0,Number(fantaStoryState.finale.rankAfterBonus)||0);
 fantaStoryState.finale.pointsBeforeBonus=Number(fantaStoryState.finale.pointsBeforeBonus)||0;

 next.story.error404=next.story.error404&&typeof next.story.error404==='object'?next.story.error404:{};
 const error404StoryState=next.story.error404;
 error404StoryState.initialized=Boolean(error404StoryState.initialized);
 error404StoryState.scheduled=Boolean(error404StoryState.scheduled);
 error404StoryState.stage=String(error404StoryState.stage||'idle');
 error404StoryState.corrupted=Boolean(error404StoryState.corrupted);
 error404StoryState.technicianDueMatchday=Number.isFinite(Number(error404StoryState.technicianDueMatchday))&&Number(error404StoryState.technicianDueMatchday)>=1?clamp(Number(error404StoryState.technicianDueMatchday),1,3):-1;
 error404StoryState.restartDueMatchday=Number.isFinite(Number(error404StoryState.restartDueMatchday))&&Number(error404StoryState.restartDueMatchday)>=1?Math.max(1,Number(error404StoryState.restartDueMatchday)):-1;
 error404StoryState.technicianShown=Boolean(error404StoryState.technicianShown);
 error404StoryState.restartShown=Boolean(error404StoryState.restartShown);
 error404StoryState.antivirusInstalled=Boolean(error404StoryState.antivirusInstalled);
 error404StoryState.completed=Boolean(error404StoryState.completed);
 error404StoryState.restarted=Boolean(error404StoryState.restarted);
 if((meritStoryState.initialized||fantaStoryState.initialized)&&!error404StoryState.initialized){error404StoryState.initialized=true;error404StoryState.scheduled=false;error404StoryState.stage='inactive'}
 if(meritStoryState.initialized&&!fantaStoryState.initialized){fantaStoryState.initialized=true;fantaStoryState.scheduled=false;fantaStoryState.stage='inactive'}
 if(!meritStoryState.initialized&&!fantaStoryState.initialized&&!error404StoryState.initialized&&next.phase==='season'&&Number(next.matchday)<19){
   const storyRoll=Math.random(),selected=storyRoll<.2?(['merit','fantaballopoli','error404'][Math.floor(Math.random()*3)]):'none';
   meritStoryState.initialized=true;meritStoryState.scheduled=selected==='merit';meritStoryState.triggerMatchday=2+Math.floor(Math.random()*15);meritStoryState.stage=meritStoryState.scheduled?'waiting':'inactive';
   fantaStoryState.initialized=true;fantaStoryState.scheduled=selected==='fantaballopoli';fantaStoryState.triggerMatchday=2+Math.floor(Math.random()*15);fantaStoryState.stage=fantaStoryState.scheduled?'waiting':'inactive';
   error404StoryState.initialized=true;error404StoryState.scheduled=selected==='error404';error404StoryState.stage=error404StoryState.scheduled?'opening_waiting':'inactive';
 }
 next.cup=next.cup&&typeof next.cup==='object'?next.cup:{};
 next.cup.status=['pending','not_qualified','active','completed'].includes(String(next.cup.status))?String(next.cup.status):'pending';
 next.cup.qualifiedRank=Math.max(0,Number(next.cup.qualifiedRank)||0);
 next.cup.currentCompetition=String(next.cup.currentCompetition||'');
 next.cup.otherCompetition=String(next.cup.otherCompetition||'');
 next.cup.participants=Array.isArray(next.cup.participants)?next.cup.participants.map(item=>({...item,id:String(item?.id||''),teamId:String(item?.teamId||''),clubId:String(item?.clubId||''),name:String(item?.name||'Squadra'),origin:item?.origin==='other'?'other':'current',user:Boolean(item?.user),strength:Number(item?.strength)||60})).filter(item=>item.id):[];
 next.cup.userParticipantId=String(next.cup.userParticipantId||'cup-user');
 next.cup.userAlive=next.cup.status==='pending'?true:Boolean(next.cup.userAlive);
 next.cup.winnerId=String(next.cup.winnerId||'');
 next.cup.rewardApplied=Boolean(next.cup.rewardApplied);
 next.cup.penaltyApplied=Boolean(next.cup.penaltyApplied);
 next.cup.rewardType=['ovr_plus_10','chemistry_x2','discipline_immunity'].includes(String(next.cup.rewardType))?String(next.cup.rewardType):'';
 next.cup.penaltyType=['ovr_minus_5','chemistry_zero','none'].includes(String(next.cup.penaltyType))?String(next.cup.penaltyType):'';
 next.cup.notice=String(next.cup.notice||'');
 next.cup.history=Array.isArray(next.cup.history)?next.cup.history:[];
 next.cup.stages=Array.isArray(next.cup.stages)?next.cup.stages.map((stage,index)=>({name:String(stage?.name||PARALLEL_CUP_STAGE_NAMES[index]||'Turno'),matchdays:Array.isArray(stage?.matchdays)?stage.matchdays.map(Number):[...(PARALLEL_CUP_MATCHDAYS[index]||[])],processedLegs:[...new Set((Array.isArray(stage?.processedLegs)?stage.processedLegs:[]).map(Number))],ties:Array.isArray(stage?.ties)?stage.ties.map((tie,tieIndex)=>({id:String(tie?.id||`cup-${index}-${tieIndex}`),teamAId:String(tie?.teamAId||''),teamBId:String(tie?.teamBId||''),legs:Array.isArray(tie?.legs)?tie.legs:[],winnerId:String(tie?.winnerId||''),aggregateA:Number(tie?.aggregateA)||0,aggregateB:Number(tie?.aggregateB)||0,penalties:String(tie?.penalties||'')})).filter(tie=>tie.teamAId&&tie.teamBId):[]})):[];
 next.cup.pendingMatch=next.cup.pendingMatch&&typeof next.cup.pendingMatch==='object'?{stageIndex:Number(next.cup.pendingMatch.stageIndex)||0,legIndex:Number(next.cup.pendingMatch.legIndex)||0,tieId:String(next.cup.pendingMatch.tieId||''),matchday:Number(next.cup.pendingMatch.matchday)||0,userHome:Boolean(next.cup.pendingMatch.userHome),event:next.cup.pendingMatch.event&&typeof next.cup.pendingMatch.event==='object'?next.cup.pendingMatch.event:null}:null;
 next.cup.lastResult=next.cup.lastResult&&typeof next.cup.lastResult==='object'?next.cup.lastResult:null;
 next.midseason=next.midseason&&typeof next.midseason==='object'?next.midseason:{};
 next.midseason.step=Math.max(0,Number(next.midseason.step)||0);
 next.midseason.target=clamp(Number(next.midseason.target)||midseasonTargetFrom(next),1,3);
 next.midseason.outgoingId=String(next.midseason.outgoingId||'');
 next.midseason.mandatoryOutgoingId=String(next.midseason.mandatoryOutgoingId||next.seasonRules.mandatoryMidseasonPlayerId||'');
 next.midseason.mandatoryOutgoingIds=[...new Set([...(Array.isArray(next.midseason.mandatoryOutgoingIds)?next.midseason.mandatoryOutgoingIds:[]),next.midseason.mandatoryOutgoingId,...next.seasonRules.mandatoryMidseasonPlayerIds].map(String).filter(Boolean))].slice(0,3);
 next.midseason.mandatoryOutgoingId=next.midseason.mandatoryOutgoingIds[0]||'';
 const legacyMarketClubKey=String(next.midseason.clubId||next.midseason.nation||'');
 const migratedMarketClub=clubById(legacyMarketClubKey)||CLUBS.find(club=>normalizeName(club.name)===normalizeName(legacyMarketClubKey))||null;
 const fantaballopoliMarket=normalizeName(legacyMarketClubKey)===normalizeName('Fantaballopoli');
 next.midseason.clubId=fantaballopoliMarket?'Fantaballopoli':(migratedMarketClub?String(migratedMarketClub.id):'');
 next.midseason.nation='';
 next.midseason.candidates=Array.isArray(next.midseason.candidates)?next.midseason.candidates.map(String):[];
 if(!next.midseason.clubId)next.midseason.candidates=[];
 next.midseason.pendingCandidateId=String(next.midseason.pendingCandidateId||'');
 next.midseason.drawsUsed=Math.max(0,Number(next.midseason.drawsUsed)||0);
 if(!next.midseason.candidates.includes(next.midseason.pendingCandidateId))next.midseason.pendingCandidateId='';
 next.midseason.completed=Boolean(next.midseason.completed);
 next.midseason.auto=Boolean(next.midseason.auto);
 next.midseason.autoCompleted=Boolean(next.midseason.autoCompleted);
 next.midseason.changes=Array.isArray(next.midseason.changes)?next.midseason.changes:[];
 next.stats=next.stats&&typeof next.stats==='object'?next.stats:{};
 ['goals','assists','appearances','cleanSheets','mvpVotes','mvpPoints','playerNames','playerTeams','playerTeamNames'].forEach(key=>{
   next.stats[key]=next.stats[key]&&typeof next.stats[key]==='object'?next.stats[key]:{};
 });
 next.leagueClubIds=Array.isArray(next.leagueClubIds)?[...new Set(next.leagueClubIds.map(String).filter(id=>clubById(id)))]:[];
 next.teams=Array.isArray(next.teams)?next.teams:[];
 next.teams.forEach(team=>{
   if(!team)return;
   const config=team.id===USER_ID?clubById(next.userClubId):clubById(team.clubId||team.id);
   if(config){
     team.clubId=config.id;
     team.shortName=team.shortName||config.shortName;
     team.colors=team.colors||config.colorClub;
     if(team.id!==USER_ID)team.name=config.name;
   }
   if(team.id===USER_ID)return;
   team.chaos=team.chaos&&typeof team.chaos==='object'?team.chaos:{};
   team.chaos.activeEffects=Array.isArray(team.chaos.activeEffects)?team.chaos.activeEffects:[];
   team.chaos.seenDecisionEvents=[...new Set((Array.isArray(team.chaos.seenDecisionEvents)?team.chaos.seenDecisionEvents:[]).map(String))];
   team.chaos.decisions=Math.max(0,Number(team.chaos.decisions)||0);
   team.chaos.midseasonPickDelta=clamp(Number(team.chaos.midseasonPickDelta)||0,-1,1);
   team.chaos.matchDuration=[30,90,120].includes(Number(team.chaos.matchDuration))?Number(team.chaos.matchDuration):90;
   team.chaos.futureScorerId=String(team.chaos.futureScorerId||'');
   team.chaos.futureInjuryZeroPoints=Boolean(team.chaos.futureInjuryZeroPoints);
   team.chaos.sixtyPointFear=Boolean(team.chaos.sixtyPointFear);
   team.chaos.eventChanceMultiplier=clamp(Number(team.chaos.eventChanceMultiplier)||1,1,2);
   team.chaos.formation=FORMATIONS[String(team.chaos.formation||'')]?String(team.chaos.formation):'';
   team.playerOverrides=team.playerOverrides&&typeof team.playerOverrides==='object'?team.playerOverrides:{};
   team.roster=Array.isArray(team.roster)&&team.roster.length?team.roster.map(String):(config?buildClubRoster(config.id):buildNationRoster(team.name));
   team.statuses=team.statuses&&typeof team.statuses==='object'?team.statuses:{};
   if(team.mascot&&typeof team.mascot==='object'){
     team.mascot.id=String(team.mascot.id||`mascot-${team.id}`);
     team.mascot.ovr=99;
   }
   team.controlSwapLockedRoster=Boolean(team.controlSwapLockedRoster);
   team.strength=Number(team.strength)||(config?clubStrength(config.id):nationalStrength(team.name));
 });
 if(!next.leagueClubIds.length&&next.teams.length)next.leagueClubIds=next.teams.map(team=>String(team.clubId||team.id)).filter(id=>id!==String(next.userClubId)&&clubById(id)).slice(0,19);
 next.playoffs=next.playoffs&&typeof next.playoffs==='object'?next.playoffs:{};
 next.playoffs.initialized=Boolean(next.playoffs.initialized);
 next.playoffs.status=['idle','active','completed'].includes(String(next.playoffs.status))?String(next.playoffs.status):'idle';
 next.playoffs.stageIndex=clamp(Math.floor(Number(next.playoffs.stageIndex)||0),0,2);
 next.playoffs.stageName=String(next.playoffs.stageName||'');
 next.playoffs.qualifiers=Array.isArray(next.playoffs.qualifiers)?next.playoffs.qualifiers.map(item=>({teamId:String(item?.teamId||''),seed:Math.max(1,Number(item?.seed)||99),name:String(item?.name||'')})).filter(item=>item.teamId):[];
 next.playoffs.ties=Array.isArray(next.playoffs.ties)?next.playoffs.ties:[];
 next.playoffs.history=Array.isArray(next.playoffs.history)?next.playoffs.history:[];
 next.playoffs.championId=String(next.playoffs.championId||'');
 next.playoffs.userQualified=Boolean(next.playoffs.userQualified);
 next.playoffs.userEliminated=Boolean(next.playoffs.userEliminated);
 next.playoffs.lastStageResults=Array.isArray(next.playoffs.lastStageResults)?next.playoffs.lastStageResults:[];
 next.version=CURRENT_STATE_VERSION;
 next.meta=next.meta&&typeof next.meta==='object'?next.meta:{};
 next.meta.seasonId=String(next.meta.seasonId||generateSeasonId());
 next.meta.createdAt=isoOrFallback(next.meta.createdAt,new Date().toISOString());
 next.meta.updatedAt=isoOrFallback(next.meta.updatedAt,next.meta.createdAt);
 next.meta.mode=SAVE_MODE;
 next.meta.saveFormatVersion=SAVE_FORMAT_VERSION;
 next.meta.gameVersion=String(next.meta.gameVersion||SEASON_ENGINE_VERSION);
 next.meta.submissionCode=String(next.meta.submissionCode||'');
 next.meta.submittedAt=String(next.meta.submittedAt||'');
 next.submitted=Boolean(next.submitted);
 next.meta.saveSlot=activeSaveSlot;
 if(!FORMATIONS[next.formation])next.formation='4-3-3';
 if(next.coachType==='three-five-two'){next.formation='3-5-2';next.seasonRules.userFormationOverride='3-5-2';if(next.phase==='midseason'){next.midseason.completed=true;next.midseason.autoCompleted=true;next.phase=next.matchday>=Math.max(1,Number(next.seasonRules?.seasonLength)||38)?(next.seasonRules.fgicLeagueRule==='playoffs'?'playoffs':'finished'):'season'}}
 if(!next.seasonRules.leagueFormation)next.seasonRules.leagueFormation=next.formation;
 if(next.seasonRules.userFormationOverride&&next.formation!==next.seasonRules.userFormationOverride)next.formation=next.seasonRules.userFormationOverride;
 if(!['setup','draft','season','midseason','story-final','italia-2006-final','fantaballopoli-final','fantaballopoli-restart','playoffs','finished'].includes(next.phase))next.phase='setup';
 next.schedule=Array.isArray(next.schedule)?next.schedule:[];
 if(next.teams.length&&(next.seasonRules.marathon||next.seasonRules.dynamicLeague)){
   const structuralIds=leagueStructureTeamIds(next);
   if(structuralIds.length>=2){
     if(next.seasonRules.dynamicLeague&&!next.seasonRules.dynamicLeagueTeamIds.length)next.seasonRules.dynamicLeagueTeamIds=[...structuralIds];
     const desiredLength=desiredLeagueSeasonLength(next,structuralIds),completedCount=Math.min(Math.max(0,Number(next.matchday)||0),next.schedule.length),completed=next.schedule.slice(0,completedCount).map(round=>round.map(match=>({...match})));
     if(next.schedule.length!==desiredLength){const base=generateSchedule(structuralIds),remaining=Math.max(0,desiredLength-completed.length),future=[];for(let index=0;base.length&&index<remaining;index++)future.push((base[index%base.length]||[]).map(match=>({...match})));next.schedule=[...completed,...future]}
     next.seasonRules.seasonLength=Math.max(desiredLength,completed.length);
   }
 }
 next.history=Array.isArray(next.history)?next.history:[];
 next.standings=next.standings&&typeof next.standings==='object'?next.standings:{};
 next.matchday=clamp(Number(next.matchday)||0,0,seasonLength(next));
 return next;
}
