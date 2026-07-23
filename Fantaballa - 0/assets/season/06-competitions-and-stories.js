/* Fantaballa Season Engine — 06-competitions-and-stories.js
 * Calendario, coppa parallela e archi narrativi principali.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
function generateSchedule(ids){let arr=[...ids],rounds=[];for(let r=0;r<arr.length-1;r++){let matches=[];for(let i=0;i<arr.length/2;i++){let h=arr[i],a=arr[arr.length-1-i];if(r%2&&i===0)[h,a]=[a,h];matches.push({home:h,away:a})}rounds.push(matches);arr=[arr[0],arr[arr.length-1],...arr.slice(1,-1)]}return rounds.concat(rounds.map(rd=>rd.map(m=>({home:m.away,away:m.home}))));}
function sortedTable(){return Object.values(state.standings).filter(team=>!isTeamEliminated(team.id)).sort((a,b)=>b.pts-a.pts||((b.gf-b.ga)-(a.gf-a.ga))||b.gf-a.gf||b.w-a.w)}
function userStanding(){return state.standings[USER_ID]}
function teamById(id){return state.teams.find(t=>t.id===id)}
function currentRound(){return state.schedule[state.matchday]||[]}
function userFixture(){return currentRound().find(m=>m.home===USER_ID||m.away===USER_ID)}

const PARALLEL_CUP_MATCHDAYS=[[20,21],[25,26],[30,31]];
const PARALLEL_CUP_STAGE_NAMES=['Quarti di finale','Semifinali','Finale'];
function parallelCupState(){
 state.cup=state.cup&&typeof state.cup==='object'?state.cup:freshState().cup;
 return state.cup;
}
function parallelCupChemistryMultiplier(){return parallelCupState().rewardType==='chemistry_x2'?2:1}
function parallelCupChemistryZero(){return parallelCupState().penaltyType==='chemistry_zero'}
function parallelCupDisciplineImmunity(){return parallelCupState().rewardType==='discipline_immunity'}
function currentCompetitionName(){if(PLAYERS===REAL_PLAYERS&&state?.competitionVariant==='legend')return'Fantacampionato Legend';return PLAYERS===REAL_PLAYERS?'Fantacampionato del Ca***':'Campionato del Ca***'}
function otherCompetitionName(){return PLAYERS===REAL_PLAYERS?'Campionato del Ca***':'Fantacampionato del Ca***'}
function otherCompetitionPlayers(){return PLAYERS===REAL_PLAYERS?CLASSIC_PLAYERS:REAL_PLAYERS}
function otherClubPlayerPool(clubId){return (otherCompetitionPlayers()||[]).filter(player=>String(player.club)===String(clubId)).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))}
function otherClubStrength(clubId){const values=otherClubPlayerPool(clubId).slice(0,11).map(player=>Number(player.ovr)||50);while(values.length<11)values.push(50);return Math.round(avg(values)*10)/10}
function parallelCupParticipant(id){return (parallelCupState().participants||[]).find(item=>String(item.id)===String(id))||null}
function parallelCupUserId(){return String(parallelCupState().userParticipantId||'cup-user')}
function parallelCupParticipantName(id){return parallelCupParticipant(id)?.name||'Squadra'}
function parallelCupParticipantPower(participant){
 if(!participant)return 60;
 if(participant.user)return Math.max(35,matchPower());
 if(participant.origin==='current'){
   const team=teamById(participant.teamId);
   return Math.max(35,team?opponentMatchPower(team):(Number(participant.strength)||60));
 }
 return Math.max(35,Number(participant.strength)||60);
}
function makeParallelCupTie(teamAId,teamBId,stageIndex,index){return{id:`cup-${stageIndex}-${index}`,teamAId:String(teamAId),teamBId:String(teamBId),legs:[],winnerId:'',aggregateA:0,aggregateB:0,penalties:''}}
function parallelCupEligibleOtherClubs(){
 const playerClubs=new Set((otherCompetitionPlayers()||[]).map(player=>String(player.club||'')).filter(Boolean));
 return (OTHER_CLUBS||[]).filter(club=>club&&playerClubs.has(String(club.id))&&!/^fantaballa(?:-|$)/i.test(String(club.id)));
}
function initializeParallelCup(){
 const cup=parallelCupState();
 if(cup.status!=='pending')return cup;
 const table=sortedTable(),rank=table.findIndex(row=>String(row.id)===USER_ID)+1;
 cup.qualifiedRank=rank;
 cup.currentCompetition=currentCompetitionName();
 cup.otherCompetition=otherCompetitionName();
 cup.notice='';
 if(rank<1||rank>4){cup.status='not_qualified';cup.userAlive=false;cup.notice=`Qualificazione mancata: al giro di boa eri ${rank>0?`${rank}°`:'fuori classifica'}.`;return cup}
 const currentTop=table.slice(0,4);
 if(currentTop.length<4){cup.status='not_qualified';cup.userAlive=false;cup.notice='Coppa non avviata: al giro di boa erano rimaste meno di quattro squadre disponibili.';return cup}
 const otherClubs=shuffle(parallelCupEligibleOtherClubs()).slice(0,4);
 if(otherClubs.length<4){cup.status='not_qualified';cup.userAlive=false;cup.notice='Coppa non avviata: nell’altro database non ci sono quattro club completi.';return cup}
 const participants=[];
 currentTop.forEach((row,index)=>{
   const team=teamById(row.id)||{};
   const user=String(row.id)===USER_ID;
   participants.push({id:user?'cup-user':`current:${row.id}`,teamId:String(row.id),clubId:String(team.clubId||row.id),name:user?state.teamName:(team.name||row.name),origin:'current',user,seed:index+1,strength:Number(team.strength)||60,colors:team.colors||null});
 });
 otherClubs.forEach((club,index)=>participants.push({id:`other:${club.id}`,teamId:'',clubId:String(club.id),name:club.name,origin:'other',user:false,seed:index+1,strength:otherClubStrength(club.id),colors:club.colorClub||null}));
 cup.participants=participants;
 cup.userParticipantId='cup-user';
 cup.userAlive=true;
 cup.winnerId='';
 cup.rewardApplied=false;
 cup.penaltyApplied=false;
 cup.rewardType='';
 cup.penaltyType='';
 cup.history=[];
 cup.stages=PARALLEL_CUP_STAGE_NAMES.map((name,index)=>({name,matchdays:[...PARALLEL_CUP_MATCHDAYS[index]],processedLegs:[],ties:[]}));
 cup.stages[0].ties=currentTop.map((row,index)=>makeParallelCupTie(String(row.id)===USER_ID?'cup-user':`current:${row.id}`,`other:${otherClubs[index].id}`,0,index));
 cup.status='active';
 cup.notice=`Qualificato da ${rank}°: affronterai quattro club del ${cup.otherCompetition}.`;
 return cup;
}
function parallelCupDedicatedEvent(userHome){
 const events=[
  {title:'Notte magica',description:'+4 OVR alla tua squadra per questa partita di coppa.',userBonus:4,opponentBonus:0},
  {title:'Turnover obbligatorio',description:'Rotazioni forzate: -3 OVR alla tua squadra per questa partita.',userBonus:-3,opponentBonus:0},
  {title:'Dodicesimo uomo',description:userHome?'Il pubblico di casa vale +4 OVR.':'Il settore ospiti vale +2 OVR.',userBonus:userHome?4:2,opponentBonus:0},
  {title:'Viaggio infinito',description:userHome?'L’avversaria arriva stanca: -3 OVR per lei.':'La trasferta pesa: -3 OVR alla tua squadra.',userBonus:userHome?0:-3,opponentBonus:userHome?-3:0},
  {title:'Pressione internazionale',description:'La tensione favorisce l’avversaria: +3 OVR per lei.',userBonus:0,opponentBonus:3}
 ];
 return {...pick(events)};
}
function parallelCupApplyEliminationPenalty(){
 const cup=parallelCupState();if(cup.penaltyApplied)return;
 cup.penaltyApplied=true;cup.userAlive=false;
 const outcomes=[
  {type:'ovr_minus_5',notice:'Eliminato dalla coppa: -5 OVR a tutta la squadra fino a fine stagione.',apply(){pushSeasonEffect('teamOvr',-5,{source:'Sconfitta nella Coppa parallela'})}},
  {type:'chemistry_zero',notice:'Eliminato dalla coppa: Intesa azzerata fino a fine stagione.',apply(){}},
  {type:'none',notice:'Eliminato dalla coppa: nessun malus applicato.',apply(){}}
 ];
 const outcome=pick(outcomes);cup.penaltyType=outcome.type;outcome.apply();cup.notice=outcome.notice;
}
function parallelCupApplyWinnerReward(){
 const cup=parallelCupState();if(cup.rewardApplied)return;
 cup.rewardApplied=true;cup.userAlive=true;
 const outcomes=[
  {type:'ovr_plus_10',notice:'Coppa vinta: +10 OVR a tutta la squadra fino a fine stagione.',apply(){pushSeasonEffect('teamOvr',10,{source:'Vittoria della Coppa parallela'})}},
  {type:'chemistry_x2',notice:'Coppa vinta: Intesa raddoppiata fino a fine stagione.',apply(){}},
  {type:'discipline_immunity',notice:'Coppa vinta: nessun tuo giocatore potrà infortunarsi o essere espulso fino a fine stagione.',apply(){}}
 ];
 const outcome=pick(outcomes);cup.rewardType=outcome.type;outcome.apply();cup.notice=outcome.notice;
}
function parallelCupResolveTie(tie){
 tie.aggregateA=(tie.legs||[]).reduce((sum,leg)=>sum+(Number(leg.aGoals)||0),0);
 tie.aggregateB=(tie.legs||[]).reduce((sum,leg)=>sum+(Number(leg.bGoals)||0),0);
 if(tie.aggregateA>tie.aggregateB)tie.winnerId=tie.teamAId;
 else if(tie.aggregateB>tie.aggregateA)tie.winnerId=tie.teamBId;
 else{
   const a=parallelCupParticipant(tie.teamAId),b=parallelCupParticipant(tie.teamBId),pa=parallelCupParticipantPower(a),pb=parallelCupParticipantPower(b),winner=Math.random()<pa/(pa+pb)?tie.teamAId:tie.teamBId;
   tie.winnerId=winner;tie.penalties=winner===tie.teamAId?'5-4':'4-5';
 }
 const userId=parallelCupUserId();
 if([tie.teamAId,tie.teamBId].includes(userId)&&tie.winnerId!==userId)parallelCupApplyEliminationPenalty();
}
function parallelCupAdvanceStage(stageIndex){
 const cup=parallelCupState(),stage=cup.stages[stageIndex];if(!stage||stageIndex>=cup.stages.length-1)return;
 const winners=stage.ties.map(tie=>tie.winnerId).filter(Boolean),next=cup.stages[stageIndex+1];
 if(stageIndex===0&&winners.length===4)next.ties=[makeParallelCupTie(winners[0],winners[1],1,0),makeParallelCupTie(winners[2],winners[3],1,1)];
 else if(stageIndex===1&&winners.length===2)next.ties=[makeParallelCupTie(winners[0],winners[1],2,0)];
}
function parallelCupFinish(){
 const cup=parallelCupState(),finalStage=cup.stages?.[2],winner=finalStage?.ties?.[0]?.winnerId||'';
 if(!winner)return;cup.winnerId=winner;cup.status='completed';
 if(winner===parallelCupUserId())parallelCupApplyWinnerReward();
 else if(cup.userAlive)parallelCupApplyEliminationPenalty();
}
function parallelCupParticipantTeam(participant){
 if(!participant)return{id:'cup-team',name:'Squadra',colors:null};
 if(participant.user)return teamById(USER_ID)||{id:USER_ID,name:state.teamName,clubId:state.userClubId,colors:activeUserClub().colorClub};
 if(participant.origin==='current')return teamById(participant.teamId)||{id:participant.id,name:participant.name,clubId:participant.clubId,colors:participant.colors||null};
 return{id:participant.id,name:participant.name,clubId:participant.clubId,colors:participant.colors||null};
}
function parallelCupParticipantLineup(participant){
 if(!participant)return[];
 if(participant.user)return resolveLineup();
 if(participant.origin==='current')return teamMatchLineup(teamById(participant.teamId));
 const pool=otherClubPlayerPool(participant.clubId).map(player=>({...player,id:`${participant.id}:${player.id}`}));
 const slots=FORMATIONS[leagueFormationKey()]||AI_MATCH_SLOTS,used=new Set();
 return slots.map((slot,index)=>{
   const role=POSITION_ROLE[slot]||'C';
   let player=pool.find(candidate=>!used.has(String(candidate.id))&&compatible(candidate,slot));
   if(!player)player=pool.find(candidate=>!used.has(String(candidate.id))&&roleOf(candidate)===role);
   if(!player)player=pool.find(candidate=>!used.has(String(candidate.id)));
   if(!player){const youth=makeEmergencyYouthEntry(slot,index,participant.id,`cup-${participant.id}-${index}`);player=youth.player}
   used.add(String(player.id));
   return{playerId:String(player.id),player,slot,slotId:`cup-${participant.id}-${index}`,bench:false,malus:0};
 });
}
function parallelCupPendingMatch(){
 const cup=parallelCupState();
 if(cup.status!=='active'||!cup.userAlive)return null;
 const existing=cup.pendingMatch&&typeof cup.pendingMatch==='object'?cup.pendingMatch:null;
 if(existing){
   const stage=cup.stages?.[Number(existing.stageIndex)],tie=stage?.ties?.find(item=>String(item.id)===String(existing.tieId));
   if(stage&&tie&&!stage.processedLegs.includes(Number(existing.legIndex)))return existing;
   cup.pendingMatch=null;
 }
 const targetMatchday=state.matchday+1;
 for(let stageIndex=0;stageIndex<(cup.stages||[]).length;stageIndex++){
   const stage=cup.stages[stageIndex],legIndex=(stage.matchdays||[]).indexOf(Number(targetMatchday));
   if(legIndex<0||stage.processedLegs.includes(legIndex)||!stage.ties?.length)continue;
   const tie=stage.ties.find(item=>[item.teamAId,item.teamBId].includes(parallelCupUserId()));
   if(!tie)return null;
   const teamA=parallelCupParticipant(tie.teamAId),teamB=parallelCupParticipant(tie.teamBId),home=legIndex===0?teamA:teamB;
   if(!teamA||!teamB)return null;
   cup.pendingMatch={stageIndex,legIndex,tieId:tie.id,matchday:targetMatchday,userHome:Boolean(home.user),event:parallelCupDedicatedEvent(Boolean(home.user))};
   return cup.pendingMatch;
 }
 return null;
}
function parallelCupCompleteLeg(pending,userData){
 const cup=parallelCupState(),stageIndex=Number(pending?.stageIndex),legIndex=Number(pending?.legIndex),stage=cup.stages?.[stageIndex];
 if(!stage||stage.processedLegs.includes(legIndex))return null;
 let userReport=null;
 stage.ties.forEach((tie,tieIndex)=>{
   const teamA=parallelCupParticipant(tie.teamAId),teamB=parallelCupParticipant(tie.teamBId);if(!teamA||!teamB)return;
   const home=legIndex===0?teamA:teamB,away=legIndex===0?teamB:teamA,userInTie=Boolean(teamA.user||teamB.user),userHome=Boolean(home.user);
   let homeGoals=0,awayGoals=0,event=null,homeEvents=[],awayEvents=[],commentary=[];
   if(userInTie&&userData){
     homeGoals=Math.max(0,Number(userData.homeGoals)||0);awayGoals=Math.max(0,Number(userData.awayGoals)||0);event=userData.event||null;homeEvents=Array.isArray(userData.homeEvents)?userData.homeEvents:[];awayEvents=Array.isArray(userData.awayEvents)?userData.awayEvents:[];commentary=Array.isArray(userData.commentary)?userData.commentary:[];
   }else{
     const homePower=parallelCupParticipantPower(home),awayPower=parallelCupParticipantPower(away);[homeGoals,awayGoals]=simulateScore(homePower,awayPower,.14,90);
   }
   const aGoals=legIndex===0?homeGoals:awayGoals,bGoals=legIndex===0?awayGoals:homeGoals;
   const leg={matchday:Number(pending.matchday),leg:legIndex+1,homeId:home.id,awayId:away.id,homeName:home.name,awayName:away.name,homeGoals,awayGoals,aGoals,bGoals,event};
   tie.legs.push(leg);tie.aggregateA=(Number(tie.aggregateA)||0)+aGoals;tie.aggregateB=(Number(tie.aggregateB)||0)+bGoals;
   if(legIndex===1)parallelCupResolveTie(tie);
   if(userInTie){
     const userIsA=Boolean(teamA.user),gf=userIsA?aGoals:bGoals,ga=userIsA?bGoals:aGoals;
     userReport={stage:stage.name,stageIndex,leg:legIndex===0?'Andata':'Ritorno',legIndex,opponent:userIsA?teamB.name:teamA.name,opponentId:userIsA?teamB.id:teamA.id,home:userHome,gf,ga,homeGoals,awayGoals,event,aggregateUser:userIsA?tie.aggregateA:tie.aggregateB,aggregateOpponent:userIsA?tie.aggregateB:tie.aggregateA,decided:legIndex===1,advanced:legIndex===1&&tie.winnerId===parallelCupUserId(),penalties:tie.penalties||'',winner:legIndex===1?parallelCupParticipantName(tie.winnerId):'',homeEvents,awayEvents,commentary,userGoalEvents:userHome?homeEvents:awayEvents,opponentGoalEvents:userHome?awayEvents:homeEvents};
   }
   cup.history.push({stageIndex,tieIndex,...leg});
 });
 stage.processedLegs.push(legIndex);
 if(legIndex===1){if(stageIndex<2)parallelCupAdvanceStage(stageIndex);else parallelCupFinish()}
 cup.pendingMatch=null;cup.lastResult=userReport;
 if(userReport&&cup.status==='active'&&cup.userAlive)cup.notice=userReport.decided?`Turno superato: ${userReport.aggregateUser}-${userReport.aggregateOpponent} nel doppio confronto.`:`Andata completata: aggregato provvisorio ${userReport.aggregateUser}-${userReport.aggregateOpponent}.`;
 return userReport;
}
function parallelCupTieScore(tie){
 if(!tie)return'–';if(!tie.legs?.length)return'–';
 const score=`${Number(tie.aggregateA)||0}-${Number(tie.aggregateB)||0}`;
 return tie.penalties?`${score} (${tie.penalties} dcr)`:score;
}
function parallelCupOutcomeLabel(){
 const cup=parallelCupState();
 if(cup.status==='pending')return'Qualificazione da decidere';
 if(cup.status==='not_qualified')return'Non qualificato';
 if(cup.status==='completed'&&cup.winnerId===parallelCupUserId())return'Vincitore';
 if(!cup.userAlive)return'Eliminato';
 return'In corsa';
}
function parallelCupNextInfo(){
 const cup=parallelCupState();if(cup.status!=='active')return null;
 for(let stageIndex=0;stageIndex<cup.stages.length;stageIndex++){
  const stage=cup.stages[stageIndex];
  for(let legIndex=0;legIndex<stage.matchdays.length;legIndex++){
   if(stage.processedLegs.includes(legIndex)||!stage.ties?.length)continue;
   const userTie=stage.ties.find(tie=>[tie.teamAId,tie.teamBId].includes(parallelCupUserId()));
   return{stage:stage.name,matchday:stage.matchdays[legIndex],leg:legIndex===0?'Andata':'Ritorno',opponent:userTie?parallelCupParticipantName(userTie.teamAId===parallelCupUserId()?userTie.teamBId:userTie.teamAId):'',userPlaying:Boolean(userTie&&cup.userAlive)};
  }
 }
 return null;
}
function renderParallelCupPanel(){
 const cup=parallelCupState();if(cup.status!=='active'||!cup.userAlive)return'';
 const outcome=parallelCupOutcomeLabel(),next=parallelCupNextInfo();
 const stages=(cup.stages||[]).map(stage=>`<div class="parallel-cup-stage"><span>${esc(stage.name)}</span>${stage.ties?.length?stage.ties.map(tie=>`<div class="parallel-cup-tie ${[tie.teamAId,tie.teamBId].includes(parallelCupUserId())?'parallel-cup-user':''}"><b>${esc(parallelCupParticipantName(tie.teamAId))} – ${esc(parallelCupParticipantName(tie.teamBId))}</b><em>${esc(parallelCupTieScore(tie))}</em></div>`).join(''):'<div class="parallel-cup-tie"><b>Da definire</b><em>–</em></div>'}</div>`).join('');
 return `<section class="parallel-cup-panel"><div class="parallel-cup-head"><div><span>🏆 Coppa parallela</span><h3>${esc(cup.currentCompetition||currentCompetitionName())} vs ${esc(cup.otherCompetition||otherCompetitionName())}</h3></div><div class="parallel-cup-status">${esc(outcome)}</div></div><p class="parallel-cup-copy">${esc(cup.notice||'Le prime quattro al giro di boa affrontano quattro club casuali dell’altro campionato, con andata e ritorno.')}</p>${next?`<div class="parallel-cup-next"><b>Prossimo turno:</b> Giornata ${next.matchday} · ${esc(next.stage)} · ${esc(next.leg)}${next.userPlaying&&next.opponent?` contro ${esc(next.opponent)}`:''}</div>`:''}${stages?`<div class="parallel-cup-stages">${stages}</div>`:''}</section>`;
}
function renderParallelCupResult(report){
 if(!report)return'';
 const verdict=report.decided?(report.advanced?'Qualificazione conquistata.':`Eliminazione: ${esc(report.winner)} passa il turno.`):`Aggregato provvisorio ${report.aggregateUser}-${report.aggregateOpponent}.`;
 return `<div class="goal-line cup-result-line"><b>🏆 ${esc(report.stage)} · ${esc(report.leg)}</b><br>${esc(state.teamName)} ${report.gf}-${report.ga} ${esc(report.opponent)}. ${report.event?`Evento coppa: ${esc(report.event.title)} — ${esc(report.event.description)} `:''}${verdict}${report.penalties?` Rigori: ${esc(report.penalties)}.`:''}</div>`;
}
function seasonHonourLabel(rank,eliminated=false){const cupWon=parallelCupState().winnerId===parallelCupUserId();if(rank===1&&!eliminated&&cupWon)return'Double';if(rank===1&&!eliminated)return'Campionato';if(cupWon)return'Coppa parallela';return'Nessun trofeo'}
function seasonFinalHeadline(rank,eliminated=false){const cupWon=parallelCupState().winnerId===parallelCupUserId();if(eliminated)return'Eliminato dagli Hunger Games';if(rank===1&&cupWon)return'Double!';if(cupWon)return'Coppa vinta!';if(rank===1)return'Campioni!';return'Campionato terminato'}



function error404StoryState(){
 state.story=state.story&&typeof state.story==='object'?state.story:{};
 state.story.error404=state.story.error404&&typeof state.story.error404==='object'?state.story.error404:freshState().story.error404;
 return state.story.error404;
}
function initializeError404Story(scheduled=true){
 const story=error404StoryState();Object.assign(story,freshState().story.error404);story.initialized=true;story.scheduled=Boolean(scheduled);story.stage=story.scheduled?'opening_waiting':'inactive';
}
function error404CorruptionActive(){const story=error404StoryState();return Boolean(story.scheduled&&story.corrupted&&!story.antivirusInstalled&&!story.completed)}
function error404RandomScore(){return Math.floor(Math.random()*6)}
function error404Outcome(scoreA,scoreB,teamA,teamB,duration=90){
 const a=Math.max(0,Number(scoreA)||0),b=Math.max(0,Number(scoreB)||0);return{scoreA:a,scoreB:b,outcomeScoreA:a,outcomeScoreB:b,winnerId:a>b?String(teamA?.id||''):b>a?String(teamB?.id||''):'',extraTime:false,penalties:null,note:'',duration:Number(duration)||90,regulationDuration:Number(duration)||90};
}
function prepareError404StoryEvent(){
 const story=error404StoryState();if(state.phase!=='season'||state.pendingEvent||!story.initialized||!story.scheduled||story.completed)return false;
 if(story.stage==='opening_waiting'&&Number(state.matchday)===0){story.stage='opening';state.pendingEvent={kind:'storyError404',storyType:'opening',resolved:false,title:'Errore 404',text:'Riavviare partita'};return true}
 if(story.stage==='technician_waiting'&&!story.technicianShown&&Number(state.matchday)>=Number(story.technicianDueMatchday)){story.technicianShown=true;story.stage='technician';state.pendingEvent={kind:'storyError404',storyType:'technician',resolved:false,title:'È arrivato il tecnico del liceo.',text:'Il sistema continua a restituire errori.'};return true}
 if(story.stage==='restart_waiting'&&!story.restartShown&&Number(state.matchday)>=Number(story.restartDueMatchday)){story.restartShown=true;story.stage='restart_required';state.pendingEvent={kind:'storyError404',storyType:'restart',resolved:false,title:'Gioco corrotto. Riavvio obbligatorio',text:'RIAVVIO DEL SISTEMA NECESSARIO'};return true}
 return false;
}
function forceError404LastPlace(){
 const standing=userStanding();if(standing){const others=Object.values(state.standings||{}).filter(row=>String(row.id)!==USER_ID).map(row=>Number(row.pts)||0);standing.pts=(others.length?Math.min(...others):0)-1000}
 const story=error404StoryState();story.corrupted=false;story.completed=true;story.stage='restarted_to_last';state.pendingEvent=null;state.phase='finished';
}
function restartLeagueAfterError404(){
 const story=error404StoryState(),savedPoints=Object.fromEntries(Object.entries(state.standings||{}).map(([id,row])=>[String(id),Number(row?.pts)||0]));
 Object.entries(state.standings||{}).forEach(([id,row])=>{row.p=0;row.w=0;row.d=0;row.l=0;row.gf=0;row.ga=0;row.pts=Number(savedPoints[String(id)])||0});
 state.stats={goals:{},assists:{},appearances:{},cleanSheets:{},mvpVotes:{},mvpPoints:{},playerNames:{},playerTeams:{},playerTeamNames:{}};
 state.history=[];state.lastResult=null;state.lastRoundResults=[];state.matchday=0;state.pendingEvent=null;state.playInjured={};state.statuses={};
 (state.teams||[]).forEach(team=>{if(String(team.id)!==USER_ID)team.statuses={}});
 const oldEventLog=Array.isArray(state.analytics?.eventLog)?state.analytics.eventLog:[],initialOvr=Number(state.analytics?.initialOvr)||teamPowerBase();state.analytics={initialOvr,injuries:0,redCards:0,eventLog:oldEventLog,biggestResult:null};
 state.schedule=generateSchedule((state.teams||[]).map(team=>team.id));state.cup=freshState().cup;state.midseason=freshState().midseason;state.chaos={...(state.chaos||{}),lastPreparedMatchday:-1,currentRound:null,latest:[],midseasonDone:false};
 story.corrupted=false;story.completed=true;story.restarted=true;story.stage='restarted_clean';state.phase='season';
}
function resolveError404Action(action){
 const event=state.pendingEvent,story=error404StoryState();if(!event||event.kind!=='storyError404'||event.resolved)return;
 if(event.storyType==='opening'){
   if(action==='restart'){forceError404LastPlace()}
   else if(action==='continue'){story.corrupted=true;story.technicianDueMatchday=1+Math.floor(Math.random()*3);story.stage='technician_waiting';state.pendingEvent=null}
   else return;
 }else if(event.storyType==='technician'){
   if(action==='install'){story.antivirusInstalled=true;story.corrupted=false;story.completed=true;story.stage='antivirus_installed';state.pendingEvent=null}
   else if(action==='ignore'){const first=Math.max(Number(state.matchday)+1,4),last=Math.max(first,seasonLength()-1);story.restartDueMatchday=first+Math.floor(Math.random()*(last-first+1));story.stage='restart_waiting';state.pendingEvent=null}
   else return;
 }else if(event.storyType==='restart'){
   if(action!=='restart')return;restartLeagueAfterError404();
 }
 seasonEventMinimized=false;seasonEventUiKey='';save();render();
}
function renderError404StoryEvent(event){
 const key=JSON.stringify(['error404',event.storyType,state.matchday]);if(seasonEventUiKey!==key){seasonEventUiKey=key;seasonEventMinimized=false}
 let choices='';
 if(event.storyType==='opening')choices=`<button class="choice season-event-choice tone-red" data-error404-action="restart"><b>RIAVVIA LA PARTITA</b></button><button class="choice season-event-choice tone-blue" data-error404-action="continue"><b>CONTINUA COMUNQUE</b></button>`;
 else if(event.storyType==='technician')choices=`<button class="choice season-event-choice tone-blue" data-error404-action="install"><b>INSTALLA L’ANTIVIRUS</b></button><button class="choice season-event-choice tone-red" data-error404-action="ignore"><b>NON DARE ASCOLTO AL TECNICO</b></button>`;
 else choices=`<button class="choice season-event-choice tone-red" data-error404-action="restart"><b>RIAVVIA</b></button>`;
 return `<div class="season-event-overlay" role="presentation" ${seasonEventMinimized?'hidden':''}><section class="season-event-dialog story-event-dialog error404-story-dialog" role="dialog" aria-modal="true" aria-labelledby="seasonEventTitle" aria-describedby="seasonEventCopy"><button class="season-event-minimize" data-event-minimize type="button" aria-label="Riduci l’evento e consulta la pagina">━ Riduci</button><div class="season-event-head"><div class="season-event-kicker">Evento storia · sistema</div><h2 class="season-event-title" id="seasonEventTitle">${esc(event.title)}</h2><p class="season-event-copy" id="seasonEventCopy">${esc(event.text)}</p></div><div class="choice-grid season-event-choice-grid">${choices}</div><p class="season-event-hint">ERR_CODE: 404_STORY_ARC</p></section></div><aside class="season-event-dock story-event-dock" ${seasonEventMinimized?'':'hidden'} aria-label="Evento storia in attesa"><button class="season-event-dock-button" data-event-expand type="button"><span class="season-event-dock-pulse" aria-hidden="true"></span><span class="season-event-dock-copy"><span>Evento storia</span><b>${esc(event.title)}</b></span><span class="season-event-dock-open">Riapri ↑</span></button></aside>`;
}
function bindError404StoryControls(){document.querySelectorAll('[data-error404-action]').forEach(button=>button.onclick=()=>resolveError404Action(button.dataset.error404Action))}
function renderError404StoryPanel(){
 const story=error404StoryState();if(!story.scheduled||story.completed||!story.corrupted)return'';
 return `<section class="event-card"><div class="label">Storia · Errore 404</div><h3>⚠ Sistema corrotto</h3><p>I file della stagione non rispondono correttamente.</p></section>`;
}
function corruptError404Text(value){
 const text=String(value||'');if(text.length<4)return text;const swaps=[['a','@'],['e','3'],['i','1'],['o','0'],['s','$'],['r','Я']];let out=text;const [from,to]=swaps[Math.floor(Math.random()*swaps.length)];const index=out.toLowerCase().indexOf(from);if(index>=0)out=out.slice(0,index)+to+out.slice(index+1);else{const cut=Math.max(1,Math.min(out.length-1,Math.floor(Math.random()*out.length)));out=out.slice(0,cut)+out[cut]+out.slice(cut)}return out;
}
function applyError404VisualState(){
 const active=error404CorruptionActive();document.body.classList.toggle('error404-corrupted',active);if(!active)return;
 const root=document.documentElement;root.style.setProperty('--error404-x',`${-3+Math.floor(Math.random()*7)}px`);root.style.setProperty('--error404-y',`${-2+Math.floor(Math.random()*5)}px`);root.style.setProperty('--error404-r',`${(-.45+Math.random()*.9).toFixed(2)}deg`);root.style.setProperty('--error404-skew',`${(-.8+Math.random()*1.6).toFixed(2)}deg`);
 const panels=[...document.querySelectorAll('#screen .panel')];if(panels.length){panels[Math.floor(Math.random()*panels.length)]?.classList.add('glitch-panel-a');panels[Math.floor(Math.random()*panels.length)]?.classList.add('glitch-panel-b')}
 const labels=[...document.querySelectorAll('#screen .label, #screen .calendar-row b')].filter(node=>node&&node.textContent&&node.textContent.trim().length>3&&!node.closest('.error404-story-dialog'));
 labels.sort(()=>Math.random()-.5).slice(0,Math.min(4,labels.length)).forEach(node=>{node.textContent=corruptError404Text(node.textContent);node.classList.add('error404-glitch-word')});
}

function fantaballopoliState(){
 state.story=state.story&&typeof state.story==='object'?state.story:{};
 state.story.fantaballopoli=state.story.fantaballopoli&&typeof state.story.fantaballopoli==='object'?state.story.fantaballopoli:freshState().story.fantaballopoli;
 return state.story.fantaballopoli;
}
function initializeFantaballopoliStory(scheduled=true){
 const story=fantaballopoliState();Object.assign(story,freshState().story.fantaballopoli);story.initialized=true;story.scheduled=Boolean(scheduled);story.triggerMatchday=2+Math.floor(Math.random()*15);story.stage=story.scheduled?'waiting':'inactive';
}
function initializeStoryArc(){
 initializeMeritStory(false);initializeFantaballopoliStory(false);initializeError404Story(false);
 const storyChance=.2*coachEventChanceFactor();
 if(Math.random()>=storyChance)return;
 const selected=Math.floor(Math.random()*3);if(selected===0)initializeMeritStory(true);else if(selected===1)initializeFantaballopoliStory(true);else initializeError404Story(true);
}
function fantaballopoliAllowsNegativeOvr(){return Boolean(fantaballopoliState().negativeOvrAllowed)}
function fantaballopoliHighestRosterEntry(){
 return [...rosterPlayers()].sort((a,b)=>{const av=(Number(a.player?.ovr)||0)+activeOvrBonus(a.player),bv=(Number(b.player?.ovr)||0)+activeOvrBonus(b.player);return bv-av||String(a.player?.name||'').localeCompare(String(b.player?.name||''),'it')})[0]||null;
}
function prepareFantaballopoliStoryEvent(){
 const story=fantaballopoliState();if(state.phase!=='season'||state.pendingEvent||!story.initialized||!story.scheduled||story.completed)return false;
 if(story.stage==='waiting'&&Number(state.matchday)>=Number(story.triggerMatchday)&&Number(state.matchday)<19){story.stage='opening';state.pendingEvent={kind:'storyFantaballopoli',storyType:'opening',resolved:false,title:'Fantaballopoli',text:'Un personaggio misterioso ti chiede di perdere la prossima partita.'};setAchievementCareerFlag('fantaballopoliStarted',true);unlockAchievement('benvenuti-a-fantaballopoli');return true}
 if(story.stage==='part2_waiting'){
   const target=rosterEntry(story.targetPlayerId);if(!target){story.stage='ended';story.completed=true;return false}
   state.pendingEvent={kind:'storyFantaballopoli',storyType:'part2',resolved:false,title:'Il giocatore scomodo',text:`Il personaggio misterioso ritorna. «${story.targetPlayerName} è scomodo ai poteri forti. Scambialo al prossimo draft di metà campionato.»`};return true
 }
 if(story.stage==='curse'&&story.curseMatches>=story.satisfactionAfter){story.stage='satisfaction_waiting'}
 if(story.stage==='satisfaction_waiting'){state.pendingEvent={kind:'storyFantaballopoli',storyType:'satisfaction',resolved:false,title:'Sei soddisfatto?',text:'Il personaggio misterioso ritorna. «Sei soddisfatto del nostro accordo?»'};return true}
 if(story.stage==='corruption'&&!story.investigatorShown&&Number(state.matchday)>=Number(story.investigatorDueMatchday||30))story.stage='investigator_waiting';
 if(story.stage==='investigator_waiting'){story.investigatorShown=true;state.pendingEvent={kind:'storyFantaballopoli',storyType:'investigator',resolved:false,title:'L’investigatore',text:'Un investigatore arriva nel tuo ufficio. «Forse questo campionato è truccato.»'};setAchievementCareerFlag('fantaballopoliInvestigatorReached',true);unlockAchievement('intercettazioni');return true}
 return false;
}
function fantaballopoliForcesLoss(){const story=fantaballopoliState();return Boolean(story.forcedLossPending&&story.stage==='forced_loss_pending')}
function fantaballopoliMatchRule(){
 const story=fantaballopoliState();const active=story.corruptionFull&&story.stage==='corruption';
 return {forcedLoss:fantaballopoliForcesLoss(),forcedWin:Boolean(active&&story.corruptionMatchIndex<=1),tenExpulsions:Boolean(active&&story.corruptionMatchIndex===0),negativeOpponentGoals:Boolean(active&&story.corruptionMatchIndex===1),extremeOpponentRisk:Boolean(active)};
}
function applyFantaballopoliOpponentRisks(opponent,lineup,rule){
 const result={expelled:[],injured:[],powerPenalty:0};if(!opponent||!rule)return result;
 const entries=(Array.isArray(lineup)?lineup:[]).filter(entry=>entry?.player),expelled=new Map(),injured=new Map();
 if(rule.tenExpulsions)shuffle(entries).slice(0,10).forEach(entry=>expelled.set(String(entry.playerId),entry));
 if(rule.extremeOpponentRisk)entries.forEach(entry=>{if(Math.random()<.60)expelled.set(String(entry.playerId),entry);if(Math.random()<physioAdjustedInjuryChance(.60))injured.set(String(entry.playerId),entry)});
 expelled.forEach(entry=>{const status=opponentStatusOf(opponent,entry.playerId);status.suspension=Math.max(2,Number(status.suspension)||0)});
 injured.forEach(entry=>{const status=opponentStatusOf(opponent,entry.playerId);status.injury=Math.max(2,Number(status.injury)||0)});
 result.expelled=[...expelled.values()];result.injured=[...injured.values()];result.powerPenalty=Math.min(55,result.expelled.length*4+result.injured.length*2);return result;
}
function createGiudaForEntry(entry){
 if(!entry)return null;const story=fantaballopoliState(),target=story.targetPlayerId?playerById(story.targetPlayerId):null,source=target||entry.player||playerById(entry.playerId)||{};
 const id=story.giudaId||`story-giuda-${String(state.meta?.createdAt||Date.now()).replace(/[^0-9]/g,'')}-${Date.now()}`;
 const giudaOvr=coachIs('young-beautiful')?84:666;
 const giuda=registerGeneratedEventPlayer({...source,baseOvr:giudaOvr,id,name:'Giuda',ovr:giudaOvr,club:'fantaballopoli',Position:source.Position||story.targetRole||entry.slot,role:source.role||roleOf(source),roleLabel:source.roleLabel||'',subscriber:'no',eventPlayer:true,fantaballopoli:true});
 story.giudaId=String(giuda.id);story.targetRole=String(entry.slot||source.Position||'');return giuda;
}
function fantaballopoliRequiresGiuda(playerId){const story=fantaballopoliState();return story.stage==='awaiting_midseason'&&String(playerId||'')===String(story.targetPlayerId||'')}
function removeGiudaFromRoster(){
 const story=fantaballopoliState(),id=String(story.giudaId||'');if(!id)return false;const index=state.draft.roster.findIndex(entry=>String(entry.playerId)===id);if(index<0)return false;state.draft.roster.splice(index,1);delete state.statuses[id];delete state.playInjured[id];return true;
}
function resolveFantaballopoliMidseason(){
 const story=fantaballopoliState();if(story.midseasonResolved||story.stage!=='awaiting_midseason')return false;story.midseasonResolved=true;
 const change=(state.midseason?.changes||[]).find(item=>String(item.outId)===String(story.targetPlayerId));
 if(!change){story.stage='ended_not_traded';story.completed=true;return false}
 let index=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(change.incomingId));
 if(index<0)index=state.draft.roster.findIndex(entry=>String(entry.slot)===String(change.slot));
 if(index<0){story.stage='ended_not_traded';story.completed=true;return false}
 const giuda=createGiudaForEntry(state.draft.roster[index]);if(!giuda)return false;
 state.draft.roster[index].playerId=String(giuda.id);state.draft.roster[index].player={...giuda};
 change.incomingId=String(giuda.id);change.incoming='Giuda';change.incomingOvr=Number(giuda.ovr)||666;
 story.curseActive=true;story.negativeOvrAllowed=true;story.curseMatches=0;story.satisfactionAfter=3+Math.floor(Math.random()*3);story.stage='curse';story.completed=false;setAchievementCareerFlag('fantaballopoliTradeComplied',true);setAchievementCareerFlag('fantaballopoliGiudaBetrayal',true);unlockAchievement('giuda');refreshOpponentClubRosters();return true;
}
function applyFantaballopoliCurse(result){
 const story=fantaballopoliState();if(!story.curseActive||!story.giudaId)return;
 const affected=[];rosterPlayers().forEach(entry=>{if(String(entry.playerId)===String(story.giudaId))return;const player=entry.player||playerById(entry.playerId)||{};const before=Number.isFinite(Number(player.ovr))?Number(player.ovr):0,after=before-20;entry.player={...player,ovr:after};affected.push({id:String(entry.playerId),name:player.name||'Giocatore',before,after})});
 story.curseMatches++;if(result)result.fantaballopoliCurse={count:affected.length,hidden:true};
 if(story.stage==='curse'&&story.curseMatches>=story.satisfactionAfter)story.stage='satisfaction_waiting';
}
function tickFantaballopoliAfterMatch(result){
 const story=fantaballopoliState();if(!result||story.completed)return;
 if(story.forcedLossPending&&story.stage==='forced_loss_pending'){
   story.forcedLossPending=false;const target=fantaballopoliHighestRosterEntry();
   if(target){story.targetPlayerId=String(target.playerId);story.targetPlayerName=String(target.player?.name||'Il giocatore più forte');story.targetRole=String(target.slot||target.player?.Position||'');story.stage='part2_waiting'}else{story.stage='ended';story.completed=true}
 }
 if(story.curseActive)applyFantaballopoliCurse(result);
 if(story.corruptionFull&&story.stage==='corruption')story.corruptionMatchIndex++;
}
function restartLeagueAfterFantaballopoli(){
 const story=fantaballopoliState();removeGiudaFromRoster();story.curseActive=false;story.corruptionFull=false;story.forcedLossPending=false;story.scheduled=false;story.completed=true;story.stage='completed';
 const generated=(state.seasonRules?.generatedEventPlayers||[]).filter(player=>String(player.id)!==String(story.giudaId));
 const formation=state.seasonRules?.leagueFormation||state.formation;const currentTeams=(state.teams||[]).filter(team=>team&&team.id);const draftedIds=currentUserPlayerIds();
 state.seasonRules={...freshState().seasonRules,leagueFormation:formation,generatedEventPlayers:generated};
 state.activeEffects=[];state.statuses={};state.playInjured={};state.pendingEvent=null;state.history=[];state.lastResult=null;state.lastRoundResults=[];state.stats=freshState().stats;state.quest=freshState().quest;state.eventChains=freshState().eventChains;state.cup=freshState().cup;state.midseason=freshState().midseason;state.seenDecisionEvents=[];state.analytics=freshState().analytics;state.chaos=freshState().chaos;state.submitted=false;
 state.meta.submissionCode='';state.meta.submittedAt='';state.meta.submissionPendingAt='';state.meta.lastSubmissionError='';
 currentTeams.forEach(team=>{if(team.id===USER_ID){team.strength=teamPowerBase();return}team.roster=buildClubRoster(team.clubId||team.id,draftedIds);team.statuses={};team.playerOverrides={};team.chaos=freshState().teams?.[0]?.chaos||{activeEffects:[],seenDecisionEvents:[],decisions:0,midseasonPickDelta:0,matchDuration:90,futureScorerId:'',futureInjuryZeroPoints:false,sixtyPointFear:false,eventChanceMultiplier:1,nonItalianChemZero:false,formation:'',latestDecision:null}});
 state.teams=currentTeams;state.schedule=generateSchedule(state.teams.map(team=>team.id));state.seasonRules.seasonLength=state.schedule.length;state.standings={};state.teams.forEach(team=>state.standings[team.id]={id:team.id,name:team.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});state.matchday=0;state.phase='season';resetSeasonAnalytics();save();prepareEvent();render();toast('Fantaballopoli conclusa. Il campionato riparte dalla giornata 1.');
}
function resolveFantaballopoliAction(action){
 const event=state.pendingEvent,story=fantaballopoliState();if(!event||event.kind!=='storyFantaballopoli'||event.resolved)return;
 if(event.storyType==='opening'){
   if(action==='accept'){setAchievementCareerFlag('fantaballopoliOpeningAccepted',true);story.forcedLossPending=true;story.stage='forced_loss_pending';event.result='Accordo accettato. La prossima partita è già decisa.'}
   else{setAchievementCareerFlag('fantaballopoliOpeningRejected',true);story.stage='rejected';story.completed=true;unlockAchievement('mani-pulite');event.result='Hai rifiutato. La storia Fantaballopoli termina qui.'}
   event.resolved=true;
 }else if(event.storyType==='part2'){
   story.stage='awaiting_midseason';event.resolved=true;event.result=`Al draft di metà campionato potrai decidere se scambiare ${story.targetPlayerName}.`;
 }else if(event.storyType==='satisfaction'){
   if(action==='stop'){removeGiudaFromRoster();story.curseActive=false;story.stage='ended_deal';story.completed=true;event.result='Giuda scompare e la maledizione termina. Il suo posto resta vuoto.'}
   else{setAchievementCareerFlag('fantaballopoliAcceptedMore',true);story.corruptionFull=true;story.corruptionMatchIndex=0;story.investigatorDueMatchday=29+Math.floor(Math.random()*6);story.stage='corruption';if(achievementFantaballopoliAcceptedAll())unlockAchievement('dentro-fino-al-collo');event.result='Hai chiesto di più. Il personaggio misterioso sorride.'}
   event.resolved=true;
 }else if(event.storyType==='investigator'){
   if(action==='confess'){if(userStanding())userStanding().pts=-30;story.stage='confessed';story.completed=true;story.curseActive=false;story.corruptionFull=false;event.resolved=true;event.result='Hai ammesso le tue colpe: la squadra scende a -30 punti. La storia termina.'}
   else{
     story.abruptEnd=true;const rank=sortedTable().findIndex(row=>row.id===USER_ID)+1;
     if(rank!==1){story.stage='ended_denial_no_title';story.completed=true;story.curseActive=false;story.corruptionFull=false;state.pendingEvent=null;state.phase='finished'}
     else{story.stage='accusation';state.pendingEvent={kind:'storyFantaballopoli',storyType:'accusation',resolved:false,title:'L’accusa',text:`Il personaggio misterioso arriva con l’investigatore. «È lui, Mister ${state.coachName||'Mister'}! Ha corrotto questo campionato e ha provato a corrompere anche me.»`}}
   }
 }else if(event.storyType==='accusation'){
   state.pendingEvent=null;
   if(action==='blame'){story.finale={eligible:true,played:false,userGoals:0,opponentGoals:0,won:false,pointsApplied:false};story.stage='juventus_final';state.phase='fantaballopoli-final'}
   else{story.stage='restart_message';state.phase='fantaballopoli-restart'}
 }
 seasonEventMinimized=false;seasonEventUiKey='';save();render();
}
function renderFantaballopoliEvent(event){
 const key=JSON.stringify(['fantaballopoli',event.storyType,state.matchday]);if(seasonEventUiKey!==key){seasonEventUiKey=key;seasonEventMinimized=false}
 let choices='';
 if(event.storyType==='opening')choices=`<button class="choice season-event-choice tone-blue" data-fanta-action="accept"><b>Accetta</b><small>La prossima partita verrà persa automaticamente.</small></button><button class="choice season-event-choice tone-red" data-fanta-action="reject"><b>Rifiuta</b><small>La storia termina immediatamente.</small></button>`;
 else if(event.storyType==='part2')choices=`<button class="choice season-event-choice tone-blue" data-fanta-action="ack"><b>Ho capito</b><small>La decisione verrà presa al draft di metà campionato.</small></button>`;
 else if(event.storyType==='satisfaction')choices=`<button class="choice season-event-choice tone-red" data-fanta-action="stop"><b>No</b><small>Perdi Giuda, il suo slot resta vuoto e la maledizione termina.</small></button><button class="choice season-event-choice tone-blue" data-fanta-action="more"><b>Ne voglio di più</b><small>Accetta un nuovo accordo con i poteri forti.</small></button>`;
 else if(event.storyType==='investigator')choices=`<button class="choice season-event-choice tone-red" data-fanta-action="confess"><b>Ammetti le tue colpe</b><small>Perdi tutti i punti e vai a -30 in campionato.</small></button><button class="choice season-event-choice tone-blue" data-fanta-action="deny"><b>Nega tutto</b><small>Il campionato termina immediatamente.</small></button>`;
 else choices=`<button class="choice season-event-choice tone-blue" data-fanta-action="blame"><b>Nega e incolpa il personaggio misterioso</b><small>Nessuno ti crede: affronterai la Juventus 05/06.</small></button><button class="choice season-event-choice tone-red" data-fanta-action="admit-both"><b>Ammetti la colpa, ma coinvolgi il personaggio misterioso</b><small>Ti verrà chiesto di dimostrare il tuo valore.</small></button>`;
 return `<div class="season-event-overlay" role="presentation" ${seasonEventMinimized?'hidden':''}><section class="season-event-dialog story-event-dialog" role="dialog" aria-modal="true" aria-labelledby="seasonEventTitle" aria-describedby="seasonEventCopy"><button class="season-event-minimize" data-event-minimize type="button" aria-label="Riduci l’evento e consulta la pagina">━ Riduci</button><div class="season-event-head"><div class="season-event-kicker">Evento storia</div><h2 class="season-event-title" id="seasonEventTitle">${esc(event.title)}</h2><p class="season-event-copy" id="seasonEventCopy">${esc(event.text)}</p></div><div class="choice-grid season-event-choice-grid">${choices}</div><p class="season-event-hint">Fantaballopoli è una storia alternativa e indipendente dagli altri percorsi narrativi.</p></section></div><aside class="season-event-dock story-event-dock" ${seasonEventMinimized?'':'hidden'} aria-label="Evento storia in attesa"><button class="season-event-dock-button" data-event-expand type="button"><span class="season-event-dock-pulse" aria-hidden="true"></span><span class="season-event-dock-copy"><span>Storia in attesa</span><b>${esc(event.title)}</b></span><span class="season-event-dock-open">Riapri ↑</span></button></aside>`;
}
function bindFantaballopoliControls(){document.querySelectorAll('[data-fanta-action]').forEach(button=>button.onclick=()=>resolveFantaballopoliAction(button.dataset.fantaAction))}
function renderFantaballopoliPanel(){
 const story=fantaballopoliState();syncFantaballopoliAchievements();if(!story.scheduled||story.completed||['idle','inactive','waiting','opening','rejected'].includes(story.stage))return'';
 if(story.stage==='awaiting_midseason'||story.stage==='part2_waiting')return `<section class="event-card"><div class="label">Storia · Fantaballopoli</div><h3>${esc(story.targetPlayerName||'Il giocatore scomodo')}</h3><p>I poteri forti vogliono che venga scambiato al draft di metà campionato.</p></section>`;
 if(['curse','satisfaction_waiting'].includes(story.stage))return `<section class="event-card"><div class="label">Storia · Fantaballopoli</div><h3>Giuda · OVR 666</h3><p>Il nuovo giocatore è entrato nella rosa. Il personaggio misterioso tornerà presto.</p></section>`;
 if(['corruption','investigator_waiting'].includes(story.stage))return `<section class="event-card"><div class="label">Storia · Fantaballopoli</div><h3>L’accordo con i poteri forti</h3><p>Il campionato sta prendendo una piega sempre più sospetta.</p></section>`;
 return'';
}
function showFantaballopoliRestart(){
 screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Fantaballopoli</div><h2>Allora dimostra il tuo valore</h2><div class="final-position">↻</div><p>Giuda scomparirà. Il resto della squadra rimarrà con te e il campionato ripartirà dalla giornata 1. La storia sarà conclusa.</p></div><button id="restartAfterFantaballopoli" class="btn primary">Ricomincia il campionato</button></section>`;
 document.getElementById('restartAfterFantaballopoli').onclick=restartLeagueAfterFantaballopoli;
}
function playFantaballopoliJuventusFinal(){
 const story=fantaballopoliState(),finale=story.finale;if(!finale?.eligible||finale.played)return;
 const tableBefore=sortedTable();finale.rankBeforeBonus=tableBefore.findIndex(row=>String(row.id)===String(USER_ID))+1;finale.pointsBeforeBonus=Number(userStanding()?.pts)||0;
 let [gf,ga]=simulateScore(Math.max(35,matchPower()),105,.02,90);if(gf===ga){if(Math.random()<.42)gf++;else ga++}finale.played=true;finale.userGoals=gf;finale.opponentGoals=ga;finale.won=gf>ga;
 if(finale.won){
   if(!finale.pointsApplied&&userStanding()){userStanding().pts+=38;finale.pointsApplied=true}
   unlockAchievement('juve-battuta');
 }else if(userStanding()){const others=Object.values(state.standings||{}).filter(row=>row.id!==USER_ID).map(row=>Number(row.pts)||0);userStanding().pts=(others.length?Math.min(...others):0)-1000}
 finale.rankAfterBonus=sortedTable().findIndex(row=>String(row.id)===String(USER_ID))+1;
 if(finale.won&&finale.pointsApplied&&Number(finale.rankBeforeBonus)>1&&Number(finale.rankAfterBonus)===1)unlockAchievement('trentotto-denari');
 story.curseActive=false;story.corruptionFull=false;story.completed=true;save();render();
}
function finishFantaballopoliJuventusFinal(){state.phase='finished';save();render()}
function showFantaballopoliFinal(){
 const finale=fantaballopoliState().finale;if(!finale.played){screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Sfida finale · Fantaballopoli</div><h2>Juventus 05/06</h2><div class="final-position">VS</div><p>Nessuno crede alla tua versione dei fatti. Devi affrontare una delle squadre più temute.</p></div><div class="panel"><p>Vittoria: <b>+38 punti</b> in campionato. Sconfitta: <b>ultimo posto</b>.</p><button id="playFantaballopoliFinal" type="button" data-single-action data-busy-announcement="Sfida avviata." class="btn primary">Gioca la sfida</button></div></section>`;document.getElementById('playFantaballopoliFinal').onclick=playFantaballopoliJuventusFinal;return}
 screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Fantaballopoli conclusa</div><h2>${finale.won?'Hai sconfitto la Juventus 05/06':'La Juventus 05/06 ti ha condannato'}</h2><div class="final-position">${finale.userGoals}–${finale.opponentGoals}</div><p>${finale.won?'Sono stati aggiunti 38 punti alla classifica.':'La tua squadra è stata portata all’ultimo posto.'}</p></div><button id="finishFantaballopoliFinal" class="btn primary">Vai al recap finale</button></section>`;document.getElementById('finishFantaballopoliFinal').onclick=finishFantaballopoliJuventusFinal;
}

function meritStoryState(){
 state.story=state.story&&typeof state.story==='object'?state.story:{};
 state.story.merit=state.story.merit&&typeof state.story.merit==='object'?state.story.merit:freshState().story.merit;
 return state.story.merit;
}
function initializeMeritStory(scheduled=true){
 const story=meritStoryState();
 Object.assign(story,freshState().story.merit);
 story.initialized=true;
 story.scheduled=Boolean(scheduled);
 story.triggerMatchday=2+Math.floor(Math.random()*15);
 story.stage=story.scheduled?'waiting':'inactive';
}
function meritStoryOvrModifier(player){return Number(meritStoryState().ovrModifiers?.[String(player?.id||'')])||0}
function addMeritStoryOvrModifier(playerId,value){
 const story=meritStoryState(),id=String(playerId||'');if(!id||!Number(value))return 0;
 story.ovrModifiers=story.ovrModifiers&&typeof story.ovrModifiers==='object'?story.ovrModifiers:{};
 const sponsorExtra=Number(value)>0?sponsorOvrExtraFor(value):0,adjusted=Number(value)>0?Number(value)+sponsorExtra:Number(value);
 if(sponsorExtra)recordBallariniPlayerBonus(id,sponsorExtra);
 story.ovrModifiers[id]=(Number(story.ovrModifiers[id])||0)+adjusted;
 return story.ovrModifiers[id];
}
function meritLowestBenchEntry(){return [...benchEntries()].sort((a,b)=>(Number(a.player?.ovr)||0)-(Number(b.player?.ovr)||0)||String(a.player?.name||'').localeCompare(String(b.player?.name||''),'it'))[0]||null}
function meritCompatibleStarters(){
 const story=meritStoryState(),player=rosterEntry(story.playerId)?.player||playerById(story.playerId);
 if(!player)return[];
 const starters=starterEntries();
 const compatibleStarters=starters.filter(entry=>userCompatible(player,entry.slot));
 return (compatibleStarters.length?compatibleStarters:starters).sort((a,b)=>(Number(a.player?.ovr)||0)-(Number(b.player?.ovr)||0));
}
function prepareMeritStoryEvent(){
 const story=meritStoryState();
 if(state.phase!=='season'||state.pendingEvent||!story.initialized||!story.scheduled||story.stage!=='waiting'||Number(state.matchday)<Number(story.triggerMatchday)||Number(state.matchday)>=19)return false;
 const entry=meritLowestBenchEntry();
 if(!entry){if(Number(state.matchday)<18)story.triggerMatchday=Math.min(18,Number(state.matchday)+1);else story.stage='missed';return false}
 story.playerId=String(entry.playerId);story.playerName=String(entry.player?.name||'Il panchinaro');story.stage='opening';
 state.pendingEvent={kind:'storyMerit',storyType:'opening',resolved:false,title:'Merito di più!',text:`${story.playerName} ti si avvicina. «Sono stufo di fare la panchina!»`,context:{selectingStarter:false}};
 return true;
}
function promoteMeritPlayer(starterId){
 const story=meritStoryState(),benchIndex=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(story.playerId)),starterIndex=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(starterId)&&!entry.bench);
 if(benchIndex<0||starterIndex<0)return false;
 const benchEntry=state.draft.roster[benchIndex],starterEntry=state.draft.roster[starterIndex];
 state.draft.roster[benchIndex]={...benchEntry,slotId:starterEntry.slotId,slot:starterEntry.slot,bench:false};
 state.draft.roster[starterIndex]={...starterEntry,slotId:benchEntry.slotId,slot:benchEntry.slot,bench:true};
 const promotedStatus=statusOf(story.playerId);promotedStatus.injury=0;promotedStatus.suspension=0;promotedStatus.seasonOut=false;promotedStatus.seasonOutReason='';
 story.promoted=true;story.guaranteedGoalPending=true;story.stage='promoted';
 unlockAchievement('la-grande-occasione');
 state.pendingEvent.resolved=true;state.pendingEvent.result=`${story.playerName} entra in campo al posto di ${starterEntry.player?.name||'un titolare'}.`;
 save();render();return true;
}
function transferMeritPlayer(){
 const story=meritStoryState(),index=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(story.playerId));
 if(index<0)return false;
 const entry=state.draft.roster[index],recipient=pick((state.teams||[]).filter(team=>team&&team.id!==USER_ID&&!isTeamEliminated(team.id)));
 state.draft.roster.splice(index,1);
 if(recipient){recipient.roster=Array.isArray(recipient.roster)?recipient.roster:[];if(!recipient.roster.map(String).includes(String(story.playerId)))recipient.roster.push(String(story.playerId));story.recipientTeamId=String(recipient.id);story.recipientTeamName=String(recipient.name||'un’altra squadra')}
 story.transferred=true;story.stage='ended_transferred';
 state.pendingEvent.resolved=true;state.pendingEvent.result=`${story.playerName} lascia immediatamente la rosa e viene ceduto a ${story.recipientTeamName||'un’altra squadra del campionato'}.`;
 save();render();return true;
}
function ensureMeritTransferredPlayer(){
 const story=meritStoryState();if(!story.transferred||!story.recipientTeamId||!story.playerId)return;
 const team=teamById(story.recipientTeamId);if(!team)return;team.roster=Array.isArray(team.roster)?team.roster:[];if(!team.roster.map(String).includes(String(story.playerId)))team.roster.push(String(story.playerId));
}
function chooseMeritOpeningAction(action){
 const event=state.pendingEvent;if(!event||event.kind!=='storyMerit'||event.storyType!=='opening'||event.resolved)return;
 if(action==='reject'){transferMeritPlayer();return}
 const starters=meritCompatibleStarters();if(!starters.length){event.resolved=true;event.result='Non ci sono titolari disponibili da sostituire.';save();render();return}
 event.context=event.context&&typeof event.context==='object'?event.context:{};event.context.selectingStarter=true;save();render();
}
function strongestMeritAttacker(){
 const attackers=rosterPlayers().filter(entry=>roleOf(entry.player)==='A');
 const pool=attackers.length?attackers:rosterPlayers();
 return [...pool].sort((a,b)=>((Number(b.player?.ovr)||0)+activeOvrBonus(b.player))-((Number(a.player?.ovr)||0)+activeOvrBonus(a.player)))[0]||null;
}
function prepareMeritPostMidseasonEvent(){
 const story=meritStoryState();if(!story.promoted||story.postMidseasonShown||story.transferred)return false;
 const entry=rosterEntry(story.playerId),kept=Boolean(entry&&!entry.bench);
 story.postMidseasonShown=true;story.branch=kept?'kept':'traded';story.stage=kept?'kept_pending':'traded_pending';
 state.pendingEvent=kept
  ?{kind:'storyMerit',storyType:'kept',resolved:false,title:'La fiducia',text:`${story.playerName} bussa al tuo ufficio. «Grazie mille della fiducia, Mister ${state.coachName||'Mister'}.»`}
  :{kind:'storyMerit',storyType:'traded',resolved:false,title:'Sei un infame!',text:`Un uomo palesemente ubriaco ti si avvicina. È ${story.playerName}. «Sei un infame! Mi hai rovinato la carriera, pensavo che credessi in me!»`};
 return true;
}
function acknowledgeMeritPostEvent(){
 const event=state.pendingEvent,story=meritStoryState();if(!event||event.kind!=='storyMerit'||event.resolved)return;
 if(event.storyType==='traded'){
   const attacker=strongestMeritAttacker();
   story.challenge={active:Boolean(attacker),status:attacker?'active':'lost',attackerId:String(attacker?.playerId||''),attackerName:String(attacker?.player?.name||''),matchesPlayed:0,goals:0};
   story.stage=attacker?'challenge':'challenge_lost';
   event.result=attacker?`${attacker.player.name}, il tuo attaccante più forte, deve segnare almeno 3 gol nelle prossime 3 partite.`:'Non hai un attaccante disponibile: la storia termina.';
 }else{
   story.stage='loyalty';
   event.result=`Da ora ${story.playerName} guadagna +5 OVR dopo ogni vittoria e perde 3 OVR dopo ogni sconfitta.`;
 }
 event.resolved=true;save();render();
}
function renderMeritStoryEvent(event){
 const story=meritStoryState(),eventKey=JSON.stringify(['merit',event.storyType,event.context||{},state.matchday]);if(seasonEventUiKey!==eventKey){seasonEventUiKey=eventKey;seasonEventMinimized=false}
 let choices='';
 if(event.storyType==='opening'){
   if(event.context?.selectingStarter){
     choices=meritCompatibleStarters().map(entry=>`<div class="season-event-choice-float"><button class="choice season-event-choice tone-blue" data-merit-starter="${esc(entry.playerId)}" type="button"><span class="season-event-option-label">Titolare da sostituire</span><b>${esc(entry.player?.name||'Giocatore')}</b><small>${esc(entry.slot)} · OVR ${Number(entry.player?.ovr)||0}</small></button></div>`).join('');
   }else choices=`<div class="season-event-choice-float"><button class="choice season-event-choice tone-blue" data-merit-action="promote" type="button"><span class="season-event-option-label">Opzione A</span><b>Mettilo in campo</b><small>Prenderà il posto di un tuo titolare.</small></button></div><div class="season-event-choice-float"><button class="choice season-event-choice tone-red" data-merit-action="reject" type="button"><span class="season-event-option-label">Opzione B</span><b>Sei un bidone!</b><small>Fallo marcire in panchina.</small></button></div>`;
 }else{
   const copy=event.storyType==='traded'?'Accetta la sfida':'Continua';
   const effect=event.storyType==='traded'?'Il tuo attaccante più forte dovrà segnare 3 gol in 3 partite.':'Ogni vittoria darà +5 OVR al giocatore; ogni sconfitta gli toglierà 3 OVR.';
   choices=`<div class="season-event-choice-float"><button class="choice season-event-choice tone-blue" data-merit-ack type="button"><span class="season-event-option-label">Storia</span><b>${copy}</b><small>${effect}</small></button></div>`;
 }
 return `<div class="season-event-overlay" role="presentation" ${seasonEventMinimized?'hidden':''}><section class="season-event-dialog story-event-dialog" role="dialog" aria-modal="true" aria-labelledby="seasonEventTitle" aria-describedby="seasonEventCopy"><button class="season-event-minimize" data-event-minimize type="button" aria-label="Riduci l’evento e consulta la pagina">━ Riduci</button><div class="season-event-head"><div class="season-event-kicker">Evento storia</div><h2 class="season-event-title" id="seasonEventTitle">${esc(event.title)}</h2><p class="season-event-copy" id="seasonEventCopy">${esc(event.text)}</p></div><div class="choice-grid season-event-choice-grid">${choices}</div><p class="season-event-hint">Questa scelta può modificare il percorso narrativo della stagione.</p></section></div><aside class="season-event-dock story-event-dock" ${seasonEventMinimized?'':'hidden'} aria-label="Evento storia in attesa"><button class="season-event-dock-button" data-event-expand type="button"><span class="season-event-dock-pulse" aria-hidden="true"></span><span class="season-event-dock-copy"><span>Storia in attesa</span><b>${esc(event.title)}</b></span><span class="season-event-dock-open">Riapri ↑</span></button></aside>`;
}
function bindMeritStoryControls(){
 document.querySelectorAll('[data-merit-action]').forEach(button=>button.onclick=()=>chooseMeritOpeningAction(button.dataset.meritAction));
 document.querySelectorAll('[data-merit-starter]').forEach(button=>button.onclick=()=>promoteMeritPlayer(button.dataset.meritStarter));
 document.querySelectorAll('[data-merit-ack]').forEach(button=>button.onclick=acknowledgeMeritPostEvent);
}
function renderMeritStoryPanel(){
 const story=meritStoryState();
 if(!story.promoted||story.transferred||['opening','waiting','inactive','idle','missed'].includes(story.stage))return'';
 if(story.challenge?.status==='active')return `<section class="event-card"><div class="label">Storia · Merito di più!</div><h3>Sfida di ${esc(story.challenge.attackerName)}</h3><p>Segnare 3 gol in 3 partite: <b>${story.challenge.goals}/3 gol</b> · <b>${story.challenge.matchesPlayed}/3 partite</b>.</p></section>`;
 if(story.challenge?.status==='won')return `<section class="event-card"><div class="label">Storia · Sfida completata</div><h3>${esc(story.challenge.attackerName)} ha mantenuto la promessa</h3><p>Ha ottenuto <b>+10 OVR</b> fino a fine stagione. Se sarà capocannoniere potrà sbloccare l’Argentina.</p></section>`;
 if(story.challenge?.status==='lost')return `<section class="event-card"><div class="label">Storia conclusa</div><h3>Sfida fallita</h3><p>${esc(story.challenge.attackerName||'L’attaccante')} ha ricevuto <b>−10 OVR</b> fino a fine stagione.</p></section>`;
 if(story.branch==='kept'&&story.stage==='loyalty')return `<section class="event-card"><div class="label">Storia · Fiducia</div><h3>${esc(story.playerName)}</h3><p>Modificatore accumulato: <b>${(Number(story.ovrModifiers?.[story.playerId])||0)>=0?'+':''}${Number(story.ovrModifiers?.[story.playerId])||0} OVR</b>. Vittoria +5, sconfitta −3.</p></section>`;
 return'';
}
function applyMeritGuaranteedGoal(events,lineup,team,opponent,duration){
 const story=meritStoryState();if(!story.guaranteedGoalPending||story.stage!=='promoted')return false;
 const scorer=(lineup||[]).find(entry=>String(entry.playerId||entry.player?.id)===String(story.playerId));if(!scorer)return false;
 let goal=(events||[]).find(event=>String(event.playerId)===String(story.playerId));
 if(!goal){const others=(lineup||[]).filter(entry=>entry?.player&&String(entry.playerId)!==String(story.playerId)),assist=Math.random()<.72&&others.length?pick(others):null,minute=Math.max(3,Math.min(Number(duration)||90,Math.floor(6+Math.random()*Math.max(1,(Number(duration)||90)-10))));if((events||[]).length){goal=events[0];goal.playerId=String(story.playerId);goal.player=scorer.player.name;goal.assistId=String(assist?.playerId||'');goal.assist=assist?.player?.name||'';goal.description=goalDescription(scorer.player,assist?.player,team?.name||'',opponent?.name||'avversario');goal.isMeritStoryGoal=true}else{goal={minute,playerId:String(story.playerId),assistId:String(assist?.playerId||''),player:scorer.player.name,assist:assist?.player?.name||'',teamId:String(team?.id||USER_ID),teamName:team?.name||state.teamName,goalValue:goalValueForMinute(minute),isMeritStoryGoal:true,description:goalDescription(scorer.player,assist?.player,team?.name||'',opponent?.name||'avversario')};events.push(goal)}}else goal.isMeritStoryGoal=true;
 story.guaranteedGoalPending=false;return true;
}
function tickMeritStoryAfterMatch(result){
 const story=meritStoryState();if(!result)return;
 result.storyUpdates=Array.isArray(result.storyUpdates)?result.storyUpdates:[];
 if(story.challenge?.active&&story.challenge.status==='active'){
   const scored=(result.goals||[]).filter(goal=>String(goal.playerId)===String(story.challenge.attackerId)).length;
   story.challenge.goals+=scored;story.challenge.matchesPlayed++;
   result.storyUpdates.push({title:'Sfida 3 gol in 3 partite',message:`${story.challenge.attackerName}: ${story.challenge.goals}/3 gol dopo ${story.challenge.matchesPlayed}/3 partite.`,success:true});
   if(story.challenge.matchesPlayed>=3){
     story.challenge.active=false;
     const success=story.challenge.goals>=3;story.challenge.status=success?'won':'lost';story.stage=success?'challenge_won':'challenge_lost';addMeritStoryOvrModifier(story.challenge.attackerId,success?10:-10);
     result.storyUpdates.push({title:success?'Sfida vinta':'Sfida persa',message:success?`${story.challenge.attackerName} riceve +10 OVR fino a fine stagione.`:`${story.challenge.attackerName} perde 10 OVR fino a fine stagione. La storia termina qui.`,success});
   }
 }
 if(story.branch==='kept'&&story.stage==='loyalty'&&rosterEntry(story.playerId)){
   const delta=Number(result.gf)>Number(result.ga)?5:Number(result.gf)<Number(result.ga)?-3:0;
   if(delta){const total=addMeritStoryOvrModifier(story.playerId,delta);result.storyUpdates.push({title:'La fiducia',message:`${story.playerName} ${delta>0?'guadagna +5':'perde 3'} OVR. Modificatore totale: ${total>=0?'+':''}${total}.`,success:delta>0})}
 }
}
function meritPlayerLeadsBucket(playerId,bucket){
 const values=Object.values(state.stats?.[bucket]||{}).map(Number).filter(Number.isFinite),best=values.length?Math.max(...values):0,value=Number(state.stats?.[bucket]?.[String(playerId)])||0;return best>0&&value===best;
}
function prepareMeritStoryFinale(){
 const story=meritStoryState();if(isTeamEliminated(USER_ID)||story.finale?.played||story.finale?.eligible)return false;
 let nation='',opponent='';
 if(story.branch==='traded'&&story.challenge?.status==='won'&&meritPlayerLeadsBucket(story.challenge.attackerId,'goals')){nation='Argentina';opponent='Nazionale Argentina'}
 if(story.branch==='kept'&&['goals','assists','mvpVotes','cleanSheets'].some(bucket=>meritPlayerLeadsBucket(story.playerId,bucket))){nation='Brasile';opponent='Nazionale Brasile'}
 if(!nation)return false;
 story.finale={eligible:true,opponent,nation,played:false,userGoals:0,opponentGoals:0,won:false,pointsDelta:0,pointsApplied:false};state.phase='story-final';return true;
}
function playMeritStoryFinale(){
 const story=meritStoryState(),finale=story.finale;if(!finale?.eligible||finale.played)return;
 const userPower=Math.max(35,matchPower()),opponentPower=Math.max(82,nationalStrength(finale.nation)+8);let [gf,ga]=simulateScore(userPower,opponentPower,.05,90);if(gf===ga){if(Math.random()<.5)gf++;else ga++}
 finale.played=true;finale.userGoals=gf;finale.opponentGoals=ga;finale.won=gf>ga;finale.pointsDelta=finale.won?20:-20;
 if(!finale.pointsApplied&&userStanding()){userStanding().pts+=finale.pointsDelta;finale.pointsApplied=true}
 save();render();
}
function finishMeritStoryFinale(){state.phase='finished';save();render()}
function showMeritStoryFinale(){
 const story=meritStoryState(),finale=story.finale,branch=story.branch==='traded'?'Il tuo attaccante è diventato capocannoniere. La sfida promessa è arrivata.':`${story.playerName} ha chiuso al primo posto in una classifica individuale.`;
 if(!finale.played){screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Finale segreto della storia</div><h2>${esc(finale.opponent)}</h2><div class="final-position">VS</div><p>${esc(branch)}</p></div><div class="panel"><h3>Partita speciale</h3><p>La sfida viene giocata prima del recap finale. Vittoria: <b>+20 punti</b>. Sconfitta: <b>−20 punti</b>.</p><button id="playMeritFinale" type="button" data-single-action data-busy-announcement="Sfida avviata." class="btn primary">Gioca contro ${esc(finale.opponent)}</button></div></section>`;document.getElementById('playMeritFinale').onclick=playMeritStoryFinale;return}
 screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Finale segreto concluso</div><h2>${finale.won?'Impresa completata!':'Sfida persa'}</h2><div class="final-position">${finale.userGoals}–${finale.opponentGoals}</div><p>${esc(state.teamName)} contro ${esc(finale.opponent)}.</p></div><div class="panel"><h3>${finale.pointsDelta>0?'+20':'−20'} punti in campionato</h3><p>Il risultato è stato applicato alla classifica prima del recap finale.</p><button id="finishMeritFinale" class="btn primary">Vai al recap finale</button></div></section>`;document.getElementById('finishMeritFinale').onclick=finishMeritStoryFinale;
}

