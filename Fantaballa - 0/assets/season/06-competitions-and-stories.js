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

const FANTABALLOPOLI_BOSSES=Object.freeze({
 inter:{
  id:'inter-onesti',name:'L’Inter degli Onesti',season:'2005/2006',formation:'4-4-2',
  colors:{primary:'#0756A5',secondary:'#111111',accent:'#D9C15D',text:'#FFFFFF'},
  starters:[
   {name:'Júlio César',position:'P',ovr:89},{name:'Javier Zanetti',position:'TD',ovr:93},{name:'Iván Córdoba',position:'DC',ovr:91},{name:'Walter Samuel',position:'DC',ovr:94},{name:'Giuseppe Favalli',position:'TS',ovr:84},
   {name:'Luís Figo',position:'AD',ovr:91},{name:'Esteban Cambiasso',position:'CDC',ovr:91},{name:'Juan Sebastián Verón',position:'CC',ovr:90},{name:'Dejan Stanković',position:'AS',ovr:90},
   {name:'Adriano',position:'ATT',ovr:94},{name:'Julio Cruz',position:'ATT',ovr:88}
  ],
  bench:['Francesco Toldo','Paolo Orlandoni','Nicolás Burdisso','Marco Materazzi','Siniša Mihajlović','Zé Maria','Pierre Womé','Cristiano Zanetti','David Pizarro','Kily González','Santiago Solari','Álvaro Recoba','Obafemi Martins']
 },
 juve:{
  id:'juve-triade',name:'La Juve della Triade',season:'2005/2006',formation:'4-4-2',
  colors:{primary:'#111111',secondary:'#F3F4F6',accent:'#D6B34C',text:'#FFFFFF'},
  starters:[
   {name:'Gianluigi Buffon',position:'P',ovr:96},{name:'Gianluca Zambrotta',position:'TD',ovr:93},{name:'Lilian Thuram',position:'DC',ovr:94},{name:'Fabio Cannavaro',position:'DC',ovr:96},{name:'Giorgio Chiellini',position:'TS',ovr:86},
   {name:'Mauro Camoranesi',position:'AD',ovr:91},{name:'Patrick Vieira',position:'CC',ovr:94},{name:'Emerson',position:'CDC',ovr:93},{name:'Pavel Nedvěd',position:'AS',ovr:94},
   {name:'Zlatan Ibrahimović',position:'ATT',ovr:92},{name:'David Trezeguet',position:'ATT',ovr:95}
  ],
  bench:['Christian Abbiati','Alessandro Birindelli','Robert Kovač','Gianluca Pessotto','Federico Balzaretti','Jonathan Zebina','Manuele Blasi','Giuliano Giannichedda','Adrian Mutu','Alessandro Del Piero','Marcelo Zalayeta']
 }
});

function fantaballopoliState(){
 state.story=state.story&&typeof state.story==='object'?state.story:{};
 const defaults=freshState().story.fantaballopoli;
 if(!state.story.fantaballopoli||typeof state.story.fantaballopoli!=='object')state.story.fantaballopoli={};
 const story=state.story.fantaballopoli;
 Object.entries(defaults).forEach(([key,value])=>{if(story[key]===undefined)story[key]=Array.isArray(value)?value.map(item=>item&&typeof item==='object'?{...item}:item):value&&typeof value==='object'?{...value}:value});
 for(const key of ['challenge','cartonati','intercettazioni','finale']){
  if(!story[key]||typeof story[key]!=='object')story[key]={};
  Object.entries(defaults[key]||{}).forEach(([field,value])=>{if(story[key][field]===undefined)story[key][field]=Array.isArray(value)?value.map(item=>item&&typeof item==='object'?{...item}:item):value&&typeof value==='object'?{...value}:value});
 }
 return story;
}
function initializeFantaballopoliStory(scheduled=true){
 const story=fantaballopoliState();Object.assign(story,freshState().story.fantaballopoli);story.initialized=true;story.scheduled=Boolean(scheduled);story.triggerMatchday=2+Math.floor(Math.random()*15);story.stage=story.scheduled?'waiting':'inactive';
}
function initializeStoryArc(){
 initializeMeritStory(false);initializeFantaballopoliStory(false);initializeError404Story(false);
 const storyChance=.2*coachEventChanceFactor();if(Math.random()>=storyChance)return;
 const selected=Math.floor(Math.random()*3);if(selected===0)initializeMeritStory(true);else if(selected===1)initializeFantaballopoliStory(true);else initializeError404Story(true);
}
function fantaballopoliAllowsNegativeOvr(){return false}
function fantaballopoliHighestRosterEntry(){
 return [...rosterPlayers()].sort((a,b)=>{const av=(Number(a.player?.ovr)||0)+activeOvrBonus(a.player),bv=(Number(b.player?.ovr)||0)+activeOvrBonus(b.player);return bv-av||String(a.player?.name||'').localeCompare(String(b.player?.name||''),'it')})[0]||null;
}
function fantaballopoliSelectTarget(){
 const story=fantaballopoliState(),target=fantaballopoliHighestRosterEntry();if(!target)return null;
 story.targetPlayerId=String(target.playerId);story.targetPlayerName=String(target.player?.name||'Il giocatore più forte');story.targetRole=String(target.slot||target.player?.Position||'');return target;
}
function fantaballopoliRemoveRosterPlayer(playerId){
 const id=String(playerId||''),index=state.draft.roster.findIndex(entry=>String(entry.playerId)===id);if(index<0)return false;
 state.draft.roster.splice(index,1);delete state.statuses[id];delete state.playInjured[id];refreshOpponentClubRosters();return true;
}
function fantaballopoliChallengeDefinition(id){
 const definitions={
  'evil-result':{title:'Prima prova — Il risultato prestabilito',objective:'Vinci la prossima partita. L’avversaria ha +10 OVR, i gol dei tuoi infortunati valgono doppio e il pareggio non è ammesso.',reward:'Cartonato dell’Arbitro',matches:1,next:'evil-giuda'},
  'evil-giuda':{title:'Seconda prova — La dimostrazione di forza',objective:'Vinci la prossima partita facendo segnare Giuda oppure con almeno due gol di scarto.',reward:'Cartonato di Giuda',matches:1,next:'evil-dossier'},
  'evil-dossier':{title:'Terza prova — Distruggere il dossier',objective:'Segna almeno un gol in ciascuna delle prossime cinque partite.',reward:'Cartonato del Silenzio',matches:5,next:''},
  'good-twelve':{title:'Prima prova — Vincere contro dodici',objective:'Vinci la prossima partita contro dodici avversari e dopo un rigore automatico contro. Il pareggio non è ammesso.',reward:'Intercettazione dell’Arbitro',matches:1,next:'good-witness'},
  'good-witness':{title:'Seconda prova — Proteggere il Testimone',objective:'Per tre partite il Testimone deve essere titolare, segnare almeno una volta e non essere espulso.',reward:'Testimonianza del Giocatore',matches:3,next:'good-dominion'},
  'good-dominion':{title:'Terza prova — Spezzare il dominio',objective:'Segna almeno tre gol in una singola partita entro le prossime tre giornate.',reward:'Intercettazione della Triade',matches:3,next:''}
 };
 return definitions[String(id||'')]||null;
}
function startFantaballopoliChallenge(id){
 const story=fantaballopoliState(),definition=fantaballopoliChallengeDefinition(id);if(!definition)return false;
 story.lastChallengeResult=null;story.challenge={id:String(id),active:true,status:'active',matchesPlayed:0,matchesRequired:definition.matches,progress:0,scored:false,lastMatchday:Number(state.matchday)||0,resultText:'',nextId:definition.next||''};story.stage='challenge_active';return true;
}
function rewardFantaballopoliChallenge(id){
 const story=fantaballopoliState();
 if(id==='evil-result')story.cartonati.arbitro=true;
 else if(id==='evil-giuda')story.cartonati.giuda=true;
 else if(id==='evil-dossier')story.cartonati.silenzio=true;
 else if(id==='good-twelve')story.intercettazioni.arbitro=true;
 else if(id==='good-witness')story.intercettazioni.testimone=true;
 else if(id==='good-dominion')story.intercettazioni.triade=true;
}
function finishFantaballopoliChallenge(success,text=''){
 const story=fantaballopoliState(),challenge=story.challenge,definition=fantaballopoliChallengeDefinition(challenge.id);challenge.active=false;challenge.status=success?'success':'failed';challenge.resultText=String(text||'');if(success)rewardFantaballopoliChallenge(challenge.id);
 story.lastChallengeResult={id:challenge.id,success:Boolean(success),title:definition?.title||'Prova della Triade',reward:definition?.reward||'',text:challenge.resultText,nextId:challenge.nextId||''};story.stage='challenge_result_waiting';
}
function prepareFantaballopoliStoryEvent(){
 const story=fantaballopoliState();if(state.phase!=='season'||state.pendingEvent||!story.initialized||!story.scheduled||story.completed)return false;
 if(story.stage==='waiting'&&Number(state.matchday)>=Number(story.triggerMatchday)&&Number(state.matchday)<19){
  story.stage='opening';state.pendingEvent={kind:'storyFantaballopoli',storyType:'opening',resolved:false,title:'Fantaballopoli',text:'Tre figure misteriose ti ordinano di perdere la prossima partita. Puoi entrare nella Triade, combatterla oppure non partecipare alla storia.'};setAchievementCareerFlag('fantaballopoliStarted',true);unlockAchievement('benvenuti-a-fantaballopoli');return true;
 }
 if(story.stage==='evil_player_waiting'){
  const target=rosterEntry(story.targetPlayerId);if(!target){story.stage='evil_waiting_midseason';return false}
  state.pendingEvent={kind:'storyFantaballopoli',storyType:'evil-player',resolved:false,title:'Il giocatore scomodo',text:`${story.targetPlayerName} ha scoperto la partita venduta e minaccia di parlare. La Triade pretende che sparisca.`};return true;
 }
 if(story.stage==='good_witness_waiting'){
  const target=rosterEntry(story.targetPlayerId);if(!target){story.stage='good_boss_waiting';return false}
  state.pendingEvent={kind:'storyFantaballopoli',storyType:'good-witness',resolved:false,title:'Il Testimone',text:`${story.targetPlayerName} ha registrato l’ordine della Triade. Proteggilo: la sua testimonianza può indebolire La Juve della Triade.`};return true;
 }
 if(story.stage==='evil_trials_waiting'){
  state.pendingEvent={kind:'storyFantaballopoli',storyType:'evil-trials',resolved:false,title:'Le tre prove della Triade',text:'Dopo il draft riappaiono le tre figure misteriose. Ogni prova superata ti consegnerà un Cartonato capace di indebolire L’Inter degli Onesti.'};return true;
 }
 if(story.stage==='evil_no_giuda_waiting'){
  state.pendingEvent={kind:'storyFantaballopoli',storyType:'evil-no-giuda',resolved:false,title:'Nessun testimone',text:'Hai eliminato il giocatore scomodo senza cederlo. Non hai ottenuto Giuda e non potrai conquistare i Cartonati: affronterai L’Inter degli Onesti con tutti i suoi poteri.'};return true;
 }
 if(story.stage==='challenge_result_waiting'){
  const result=story.lastChallengeResult||{};state.pendingEvent={kind:'storyFantaballopoli',storyType:'challenge-result',resolved:false,title:result.success?'Prova superata':'Prova fallita',text:result.success?`${result.title}: hai ottenuto ${result.reward}. ${result.text||''}`:`${result.title}: non hai ottenuto ${result.reward}. ${result.text||''}`};return true;
 }
 return false;
}
function fantaballopoliForcesLoss(){const story=fantaballopoliState();return Boolean(story.forcedLossPending&&story.stage==='evil_forced_loss')}
function fantaballopoliMatchRule(){
 const story=fantaballopoliState(),challenge=story.challenge||{},id=challenge.active?String(challenge.id||''):'';
 return {forcedLoss:fantaballopoliForcesLoss(),challengeId:id,opponentOvrBonus:id==='evil-result'?10:0,injuredGoalsDouble:id==='evil-result',forceNoDraw:id==='evil-result'||id==='good-twelve',extraOpponentPlayer:id==='good-twelve',automaticPenaltyAgainst:id==='good-twelve'};
}
function applyFantaballopoliOpponentRisks(){return{expelled:[],injured:[],powerPenalty:0}}
function fantaballopoliOpponentLineup(lineup,opponent,rule){
 const rows=Array.isArray(lineup)?[...lineup]:[];if(!rule?.extraOpponentPlayer)return rows;
 const average=Math.round(avg(rows.map(entry=>Number(entry?.player?.ovr)||60)))||70,player={id:`story-twelfth-${String(opponent?.id||'opponent')}`,name:'Dodicesimo uomo',ovr:average,Position:'COC',role:'C',roleLabel:'Centrocampista',club:String(opponent?.clubId||opponent?.id||'')};rows.push({playerId:String(player.id),player,slot:'COC',bench:false,storyTwelfth:true});return rows;
}
function applyFantaballopoliPenaltyGoal(events,opponent,userTeam,matchMinutes,rule){
 if(!rule?.automaticPenaltyAgainst||!Array.isArray(events))return false;
 const goal=regulationGoalEvent(opponent,userTeam,matchMinutes,'Rigore della Triade');goal.isFantaballopoliPenalty=true;goal.description='La Triade assegna un rigore automatico agli avversari.';events.push(goal);return true;
}
function applyFantaballopoliInjuredGoalValues(events,lineup,rule){
 if(!rule?.injuredGoalsDouble||!Array.isArray(events))return 0;
 const injuredIds=new Set((Array.isArray(lineup)?lineup:[]).filter(entry=>{const id=String(entry?.playerId||entry?.player?.id||''),status=state.statuses?.[id];return id&&(Number(status?.injury)>0||Boolean(state.playInjured?.[id]))}).map(entry=>String(entry.playerId||entry.player?.id||'')));
 let doubled=0;events.forEach(event=>{if(injuredIds.has(String(event?.playerId||''))){event.goalValue=Math.max(2,Number(event.goalValue)||1);event.isFantaballopoliInjuredDouble=true;doubled++}});return doubled;
}
function createGiudaForEntry(entry){
 if(!entry)return null;const story=fantaballopoliState(),target=story.targetPlayerId?playerById(story.targetPlayerId):null,source=target||entry.player||playerById(entry.playerId)||{};
 const id=story.giudaId||`story-giuda-${String(state.meta?.createdAt||Date.now()).replace(/[^0-9]/g,'')}-${Date.now()}`,giudaOvr=coachIs('young-beautiful')?84:666;
 const giuda=registerGeneratedEventPlayer({...source,baseOvr:giudaOvr,id,name:'Giuda',ovr:giudaOvr,club:'fantaballopoli',Position:source.Position||story.targetRole||entry.slot,role:source.role||roleOf(source),roleLabel:source.roleLabel||'',subscriber:'no',eventPlayer:true,fantaballopoli:true});story.giudaId=String(giuda.id);story.targetRole=String(entry.slot||source.Position||'');return giuda;
}
function fantaballopoliRequiresGiuda(playerId){const story=fantaballopoliState();return story.path==='evil'&&story.stage==='awaiting_midseason'&&String(playerId||'')===String(story.targetPlayerId||'')}
function removeGiudaFromRoster(){const story=fantaballopoliState();return fantaballopoliRemoveRosterPlayer(story.giudaId)}
function resolveFantaballopoliMidseason(){
 const story=fantaballopoliState();if(story.midseasonResolved||story.path!=='evil')return false;
 if(story.stage==='evil_waiting_midseason'){story.midseasonResolved=true;story.targetTradeOrdered=false;story.targetTraded=false;story.stage='evil_no_giuda_waiting';return true}
 if(story.stage!=='awaiting_midseason')return false;story.midseasonResolved=true;
 const changes=Array.isArray(state.midseason?.changes)?state.midseason.changes:(state.midseason.changes=[]);let change=changes.find(item=>String(item.outId)===String(story.targetPlayerId));
 let index=change?state.draft.roster.findIndex(entry=>String(entry.playerId)===String(change.incomingId)):-1;if(index<0&&change)index=state.draft.roster.findIndex(entry=>String(entry.slot)===String(change.slot));
 if(index<0){index=state.draft.roster.findIndex(entry=>String(entry.playerId)===String(story.targetPlayerId));if(index>=0){const outgoing=state.draft.roster[index],oldPlayer=outgoing.player||playerById(outgoing.playerId);change={outId:String(story.targetPlayerId),incomingId:'',out:oldPlayer?.name||story.targetPlayerName||'Giocatore',incoming:'',slot:outgoing.slot,clubId:'Fantaballopoli',beforeOverall:0,afterOverall:0,deltaOverall:0,beforeChemistry:0,afterChemistry:0,deltaChemistry:0};changes.push(change)}}
 if(index<0){story.targetTradeOrdered=false;story.targetTraded=false;story.stage='evil_no_giuda_waiting';return false}
 const giuda=createGiudaForEntry(state.draft.roster[index]);if(!giuda){story.targetTradeOrdered=false;story.targetTraded=false;story.stage='evil_no_giuda_waiting';return false}
 state.draft.roster[index].playerId=String(giuda.id);state.draft.roster[index].player={...giuda};change.incomingId=String(giuda.id);change.incoming='Giuda';change.incomingOvr=Number(giuda.ovr)||666;change.clubId='Fantaballopoli';
 story.targetTradeOrdered=false;story.targetTraded=true;story.stage='evil_trials_waiting';story.completed=false;if(typeof clearMandatoryMidseasonPlayer==='function')clearMandatoryMidseasonPlayer(story.targetPlayerId);setAchievementCareerFlag('fantaballopoliTradeComplied',true);setAchievementCareerFlag('fantaballopoliGiudaBetrayal',true);unlockAchievement('giuda');refreshOpponentClubRosters();return true;
}
function fantaballopoliResultWon(result){return String(result?.winnerId||'')===String(USER_ID)||(Number(result?.gf)||0)>(Number(result?.ga)||0)}
function tickFantaballopoliChallenge(result){
 const story=fantaballopoliState(),challenge=story.challenge;if(!challenge?.active||!result)return;
 const id=String(challenge.id||''),won=fantaballopoliResultWon(result),gf=Number.isFinite(Number(result.displayGf))?Number(result.displayGf):Number(result.gf)||0,ga=Number.isFinite(Number(result.displayGa))?Number(result.displayGa):Number(result.ga)||0;
 challenge.matchesPlayed++;
 if(id==='evil-result'){finishFantaballopoliChallenge(won,won?'Il risultato prestabilito è stato rispettato.':'La Triade non perdona il risultato sbagliato.');}
 else if(id==='evil-giuda'){
  const giudaScored=(result.goals||[]).some(goal=>String(goal?.playerId||'')===String(story.giudaId||'')),margin=gf-ga,success=won&&(giudaScored||margin>=2);finishFantaballopoliChallenge(success,success?(giudaScored?'Giuda è diventato il simbolo della vittoria.':'La vittoria larga ha dimostrato la forza della Triade.'):'Hai vinto senza rispettare le condizioni oppure non hai vinto.');
 }else if(id==='evil-dossier'){
  if(gf<1)finishFantaballopoliChallenge(false,'La serie si interrompe: in questa partita non hai segnato.');else{challenge.progress++;if(challenge.matchesPlayed>=5)finishFantaballopoliChallenge(challenge.progress>=5,'Hai segnato in tutte e cinque le partite e indebolito il dossier.');}
 }else if(id==='good-twelve'){finishFantaballopoliChallenge(won,won?'Hai battuto dodici avversari nonostante il rigore contro.':'La Triade ha imposto il proprio risultato.');}
 else if(id==='good-witness'){
  const starter=(result.lineup||[]).some(entry=>String(entry?.playerId||entry?.player?.id||'')===String(story.targetPlayerId||'')),sentOff=String(result.ownSuspensionId||'')===String(story.targetPlayerId||''),scored=(result.goals||[]).some(goal=>String(goal?.playerId||'')===String(story.targetPlayerId||''));if(scored)challenge.scored=true;
  if(!starter)finishFantaballopoliChallenge(false,`${story.targetPlayerName} non è stato schierato titolare.`);else if(sentOff)finishFantaballopoliChallenge(false,`${story.targetPlayerName} è stato espulso.`);else if(challenge.matchesPlayed>=3)finishFantaballopoliChallenge(Boolean(challenge.scored),challenge.scored?'Il Testimone ha resistito e ha segnato.':'Il Testimone non ha segnato nelle tre partite.');
 }else if(id==='good-dominion'){
  if(gf>=3)finishFantaballopoliChallenge(true,`Hai segnato ${gf} gol e spezzato il dominio della Triade.`);else if(challenge.matchesPlayed>=3)finishFantaballopoliChallenge(false,'Non hai mai segnato almeno tre gol nella stessa partita.');
 }
 if(story.lastChallengeResult)result.fantaballopoliChallengeOutcome={...story.lastChallengeResult};
}
function tickFantaballopoliAfterMatch(result){
 const story=fantaballopoliState();if(!result||story.completed)return;
 if(story.forcedLossPending&&story.stage==='evil_forced_loss'){story.forcedLossPending=false;if(fantaballopoliSelectTarget())story.stage='evil_player_waiting';else{story.stage='evil_boss_waiting'}}
 tickFantaballopoliChallenge(result);
}
function resolveFantaballopoliAction(action){
 const event=state.pendingEvent,story=fantaballopoliState();if(!event||event.kind!=='storyFantaballopoli'||event.resolved)return;
 if(event.storyType==='opening'){
  if(action==='accept'){story.path='evil';story.power=Math.max(1,Number(story.power)||0);story.suspicion=Math.max(1,Number(story.suspicion)||0);story.forcedLossPending=true;story.stage='evil_forced_loss';setAchievementCareerFlag('fantaballopoliOpeningAccepted',true);event.result='Hai accettato: la prossima partita verrà persa e servirai la Triade.'}
  else if(action==='resist'){story.path='resistance';fantaballopoliSelectTarget();story.stage='good_witness_waiting';setAchievementCareerFlag('fantaballopoliOpeningRejected',true);event.result='Hai rifiutato l’ordine. La Triade ora ti considera un nemico.'}
  else{story.path='none';story.stage='opted_out';story.completed=true;story.scheduled=false;event.result='Hai rifiutato di partecipare. Il campionato continuerà normalmente.'}
  event.resolved=true;
 }else if(event.storyType==='evil-player'){
  if(action==='trade'){
   story.targetTradeOrdered=true;story.targetTraded=false;story.stage='awaiting_midseason';story.power=Math.max(0,Number(story.power)||0)+1;story.suspicion=Math.max(0,Number(story.suspicion)||0)+1;
   state.seasonRules.mandatoryMidseasonPlayerIds=[...new Set([...(state.seasonRules.mandatoryMidseasonPlayerIds||[]).map(String),String(story.targetPlayerId)])];state.seasonRules.mandatoryMidseasonPlayerId=state.seasonRules.mandatoryMidseasonPlayerIds[0]||'';event.result=`${story.targetPlayerName} dovrà essere ceduto al prossimo draft. In cambio arriverà Giuda.`;
  }else{story.targetTradeOrdered=false;story.targetTraded=false;story.targetLocked=true;fantaballopoliRemoveRosterPlayer(story.targetPlayerId);story.stage='evil_waiting_midseason';story.power=Math.max(0,Number(story.power)||0)+1;event.result=`${story.targetPlayerName} è stato chiuso per sempre nello spogliatoio e rimosso dalla squadra.`}
  event.resolved=true;
 }else if(event.storyType==='good-witness'){startFantaballopoliChallenge('good-twelve');event.resolved=true;event.result='Il Testimone resta con te. Inizia la prima prova contro la Triade.';
 }else if(event.storyType==='evil-trials'){startFantaballopoliChallenge('evil-result');event.resolved=true;event.result='Inizia la prima prova della Triade.';
 }else if(event.storyType==='evil-no-giuda'){story.stage='evil_boss_waiting';event.resolved=true;event.result='La resa dei conti arriverà a fine campionato.';
 }else if(event.storyType==='challenge-result'){
  const nextId=String(story.lastChallengeResult?.nextId||'');if(nextId)startFantaballopoliChallenge(nextId);else story.stage=story.path==='evil'?'evil_boss_waiting':'good_boss_waiting';event.resolved=true;event.result=nextId?'La prova successiva è attiva.':'Le prove sono terminate. Il boss ti aspetta a fine campionato.';
 }
 seasonEventMinimized=false;seasonEventUiKey='';save();render();
}
function renderFantaballopoliEvent(event){
 const key=JSON.stringify(['fantaballopoli',event.storyType,state.matchday]);if(seasonEventUiKey!==key){seasonEventUiKey=key;seasonEventMinimized=false}
 let choices='';
 if(event.storyType==='opening')choices=`<button class="choice season-event-choice tone-blue" data-fanta-action="accept"><b>Accetta di perdere</b><small>Entra nella Triade. Il boss finale sarà L’Inter degli Onesti.</small></button><button class="choice season-event-choice tone-red" data-fanta-action="resist"><b>Rifiuta di perdere</b><small>Combatti il sistema. Il boss finale sarà La Juve della Triade.</small></button><button class="choice season-event-choice" data-fanta-action="optout"><b>Non voglio partecipare</b><small>Annulla Fantaballopoli per questa stagione e continua normalmente.</small></button>`;
 else if(event.storyType==='evil-player')choices=`<button class="choice season-event-choice tone-blue" data-fanta-action="trade"><b>Cederlo al prossimo draft</b><small>Al prossimo draft riceverai Giuda, un talento misterioso scelto dalla Triade.</small></button><button class="choice season-event-choice tone-red" data-fanta-action="lock"><b>Non cederlo</b><small>Chiudilo per sempre nello spogliatoio: viene rimosso e non darà più problemi.</small></button>`;
 else if(event.storyType==='good-witness')choices=`<button class="choice season-event-choice tone-blue" data-fanta-action="start"><b>Proteggi il Testimone</b><small>Avvia le tre prove per raccogliere le Intercettazioni.</small></button>`;
 else if(event.storyType==='evil-trials')choices=`<button class="choice season-event-choice tone-blue" data-fanta-action="start"><b>Affronta le prove</b><small>Ogni Cartonato ottenuto disattiverà un potere dell’Inter degli Onesti.</small></button>`;
 else if(event.storyType==='evil-no-giuda')choices=`<button class="choice season-event-choice tone-red" data-fanta-action="continue"><b>Continua</b><small>Arriva a fine campionato e affronta L’Inter degli Onesti senza Cartonati.</small></button>`;
 else choices=`<button class="choice season-event-choice tone-blue" data-fanta-action="next"><b>${fantaballopoliState().lastChallengeResult?.nextId?'Prossima prova':'Verso il boss finale'}</b><small>La storia continua anche se la prova è fallita.</small></button>`;
 return `<div class="season-event-overlay" role="presentation" ${seasonEventMinimized?'hidden':''}><section class="season-event-dialog story-event-dialog" role="dialog" aria-modal="true" aria-labelledby="seasonEventTitle" aria-describedby="seasonEventCopy"><button class="season-event-minimize" data-event-minimize type="button" aria-label="Riduci l’evento e consulta la pagina">━ Riduci</button><div class="season-event-head"><div class="season-event-kicker">Evento storia</div><h2 class="season-event-title" id="seasonEventTitle">${esc(event.title)}</h2><p class="season-event-copy" id="seasonEventCopy">${esc(event.text)}</p></div><div class="choice-grid season-event-choice-grid">${choices}</div><p class="season-event-hint">Fantaballopoli è facoltativa: la scelta iniziale determina definitivamente il percorso.</p></section></div><aside class="season-event-dock story-event-dock" ${seasonEventMinimized?'':'hidden'} aria-label="Evento storia in attesa"><button class="season-event-dock-button" data-event-expand type="button"><span class="season-event-dock-pulse" aria-hidden="true"></span><span class="season-event-dock-copy"><span>Storia in attesa</span><b>${esc(event.title)}</b></span><span class="season-event-dock-open">Riapri ↑</span></button></aside>`;
}
function bindFantaballopoliControls(){document.querySelectorAll('[data-fanta-action]').forEach(button=>button.onclick=()=>resolveFantaballopoliAction(button.dataset.fantaAction))}
function fantaballopoliCollectedLabels(story=fantaballopoliState()){
 const values=story.path==='evil'?[[story.cartonati.arbitro,'Cartonato dell’Arbitro'],[story.cartonati.giuda,'Cartonato di Giuda'],[story.cartonati.silenzio,'Cartonato del Silenzio']]:[[story.intercettazioni.arbitro,'Intercettazione dell’Arbitro'],[story.intercettazioni.testimone,'Testimonianza del Giocatore'],[story.intercettazioni.triade,'Intercettazione della Triade']];return values.map(([active,label])=>`${active?'✅':'⬜'} ${label}`).join(' · ');
}
function renderFantaballopoliPanel(){
 const story=fantaballopoliState();syncFantaballopoliAchievements();if(!story.scheduled||story.completed||['idle','inactive','waiting','opening','opted_out'].includes(story.stage))return'';
 const challenge=story.challenge?.active?fantaballopoliChallengeDefinition(story.challenge.id):null,progress=challenge?`<p><b>${esc(challenge.title)}</b><br>${esc(challenge.objective)}<br>Partite: ${Number(story.challenge.matchesPlayed)||0}/${Number(story.challenge.matchesRequired)||challenge.matches}</p>`:'';
 const pathTitle=story.path==='evil'?'Dalla parte della Triade':'Contro la Triade',boss=story.path==='evil'?'L’Inter degli Onesti':'La Juve della Triade';return `<section class="event-card"><div class="label">Storia · Fantaballopoli</div><h3>${esc(pathTitle)}</h3><p>Boss finale: <b>${esc(boss)}</b></p>${progress}<p class="subline">${esc(fantaballopoliCollectedLabels(story))}</p></section>`;
}
function fantaballopoliBossDefinition(story=fantaballopoliState()){
 const base=story.path==='evil'?FANTABALLOPOLI_BOSSES.inter:FANTABALLOPOLI_BOSSES.juve;
 const boss={...base,starters:(base.starters||[]).map(player=>({...player})),bench:[...(base.bench||[])]};
 if(story.path==='evil'&&story.targetTraded&&story.targetPlayerName){
  const witness=playerById(story.targetPlayerId)||{},role=String(witness.Position||story.targetRole||'ATT'),matching=boss.starters.map((player,index)=>({player,index})).filter(item=>roleOf(item.player)===roleOf(witness));
  const replacementPool=matching.length?matching:boss.starters.map((player,index)=>({player,index}));replacementPool.sort((a,b)=>(Number(a.player.ovr)||0)-(Number(b.player.ovr)||0));const index=replacementPool[0]?.index??boss.starters.length-1,replaced=boss.starters[index];
  boss.starters[index]={name:String(story.targetPlayerName),position:role,Position:role,role:witness.role||roleOf(witness),ovr:Math.max(88,Number(witness.ovr)||Number(replaced?.ovr)||88),witness:true};if(replaced?.name&&!boss.bench.includes(replaced.name))boss.bench.push(replaced.name);
 }
 return boss;
}
function fantaballopoliBossBasePower(boss){return Math.round(avg((boss?.starters||[]).map(player=>Number(player.ovr)||70))*10)/10}
function fantaballopoliBossPowers(story=fantaballopoliState()){
 if(story.path==='evil')return[
  {id:'referee',name:'Vigilanza arbitrale',active:!story.cartonati.arbitro,description:'Può annullare un tuo gol, assegnare un rigore o provocare un’espulsione.'},
  {id:'giuda',name:'Gabbia per Giuda',active:!story.cartonati.giuda,description:'Neutralizza Giuda e riduce la potenza della tua squadra.'},
  {id:'dossier',name:'Dossier completo',active:!story.cartonati.silenzio,description:'L’Inter riceve +10 OVR e il tuo spogliatoio perde fiducia.'}
 ];
 return[
  {id:'referee',name:'Arbitro della Triade',active:!story.intercettazioni.arbitro,description:'Può assegnare un rigore, espellere un tuo giocatore o annullare un gol.'},
  {id:'palace',name:'Protezione del Palazzo',active:!story.intercettazioni.testimone,description:'Tutti i titolari della Juve ricevono +10 OVR.'},
  {id:'recovery',name:'Recupero infinito',active:!story.intercettazioni.triade,description:'Se la Juve perde nel finale ottiene occasioni e minuti aggiuntivi.'}
 ];
}
function prepareFantaballopoliFinale(){
 const story=fantaballopoliState();if(!story.scheduled||story.completed||!['evil','resistance'].includes(story.path)||story.finale?.played)return false;
 if(story.challenge?.active)finishFantaballopoliChallenge(false,'La stagione è terminata prima del completamento della prova.');
 const boss=fantaballopoliBossDefinition(story);story.finale={...freshState().story.fantaballopoli.finale,eligible:true,bossId:boss.id,bossName:boss.name};story.stage='boss_final';state.phase='fantaballopoli-final';return true;
}
function fantaballopoliFinalScorers(total,pool){const names=(pool||[]).map(item=>typeof item==='string'?item:item.name).filter(Boolean),out=[];for(let i=0;i<Math.max(0,Number(total)||0);i++)out.push(pick(names)||'Marcatore');return out}
function playFantaballopoliFinal(){
 const story=fantaballopoliState(),finale=story.finale,boss=fantaballopoliBossDefinition(story);if(!finale?.eligible||finale.played)return;
 const powers=fantaballopoliBossPowers(story),active=id=>powers.some(power=>power.id===id&&power.active),notes=[];let userPower=Math.max(35,matchPower()),bossPower=Math.max(35,fantaballopoliBossBasePower(boss));
 if(story.path==='resistance'&&active('palace')){bossPower+=10;notes.push('Protezione del Palazzo: +10 OVR alla Juve della Triade.')}
 if(story.path==='evil'&&active('dossier')){bossPower+=10;userPower=Math.max(25,userPower-5);notes.push('Dossier completo: +10 OVR all’Inter e -5 potenza alla tua squadra.')}
 if(story.path==='evil'&&active('giuda')&&story.giudaId&&rosterEntry(story.giudaId)){userPower=Math.max(25,userPower-10);notes.push('Gabbia per Giuda: la tua potenza scende di 10.')}
 let refereeEffect='';if(active('referee'))refereeEffect=pick(['penalty','red','annul']);if(refereeEffect==='red'){userPower=Math.max(25,userPower-10);notes.push(`${story.path==='evil'?'Vigilanza arbitrale':'Arbitro della Triade'}: espulsione, -10 potenza.`)}
 let [gf,ga]=simulateScore(userPower,bossPower,0,90);gf=Math.max(0,Number(gf)||0);ga=Math.max(0,Number(ga)||0);
 if(refereeEffect==='penalty'){ga++;notes.push(`${story.path==='evil'?'Vigilanza arbitrale':'Arbitro della Triade'}: rigore trasformato dal boss.`)}
 else if(refereeEffect==='annul'){if(gf>0){gf--;notes.push(`${story.path==='evil'?'Vigilanza arbitrale':'Arbitro della Triade'}: un tuo gol viene annullato.`)}else{ga++;notes.push(`${story.path==='evil'?'Vigilanza arbitrale':'Arbitro della Triade'}: senza gol da annullare, viene assegnato un rigore al boss.`)}}
 let guaranteedWitnessGoal=false;if(story.path==='evil'&&story.targetTraded&&story.targetPlayerName){ga++;guaranteedWitnessGoal=true;notes.push(`${story.targetPlayerName}, ceduto al draft, segna sicuramente per L’Inter degli Onesti.`)}
 if(story.path==='resistance'&&active('recovery')&&gf>ga){if(Math.random()<.85){ga++;notes.push('Recupero infinito: la Juve trova un gol oltre il 90°.')}if(gf>ga&&Math.random()<.35){ga++;notes.push('Recupero infinito: arriva un’altra occasione fuori tempo massimo.')}}
 let extraTime=false,penalties=null;if(gf===ga){const extra=simulateScore(userPower,bossPower,0,30,.62);gf+=Number(extra[0])||0;ga+=Number(extra[1])||0;extraTime=true;notes.push('La boss fight prosegue ai tempi supplementari.')}if(gf===ga){const shootout=simulatePenaltyShootout(userPower,bossPower),userWins=shootout.scoreA>shootout.scoreB;penalties={for:shootout.scoreA,against:shootout.scoreB};finale.won=userWins;notes.push(`Calci di rigore: ${shootout.scoreA}-${shootout.scoreB}.`)}else finale.won=gf>ga;
 const userScorers=fantaballopoliFinalScorers(gf,rosterPlayers().map(entry=>entry.player));const bossScorers=fantaballopoliFinalScorers(ga,boss.starters);if(guaranteedWitnessGoal&&bossScorers.length)bossScorers[0]=story.targetPlayerName;
 finale.played=true;finale.userGoals=gf;finale.opponentGoals=ga;finale.extraTime=extraTime;finale.penalties=penalties;finale.notes=notes;finale.userScorers=userScorers;finale.opponentScorers=bossScorers;finale.activePowers=powers.filter(power=>power.active).map(power=>power.id);finale.rankBeforeBonus=sortedTable().findIndex(row=>String(row.id)===String(USER_ID))+1;finale.pointsBeforeBonus=Number(userStanding()?.pts)||0;
 if(finale.won&&userStanding()&&!finale.pointsApplied){userStanding().pts=finale.pointsBeforeBonus*2;finale.pointsApplied=true;finale.pointsAfterBonus=Number(userStanding().pts)||0;if(story.path==='resistance'){unlockAchievement('juve-battuta');unlockAchievement('sistema-abbattuto')}else unlockAchievement('inter-onesti-battuta');unlockAchievement('trentotto-denari');unlockAchievement('scudetto-di-cartone')}
 else finale.pointsAfterBonus=Number(userStanding()?.pts)||0;
 finale.rankAfterBonus=sortedTable().findIndex(row=>String(row.id)===String(USER_ID))+1;story.completed=true;story.stage='boss_completed';save();render();
}
function finishFantaballopoliFinal(){state.phase='finished';save();render()}

function playFantaballopoliJuventusFinal(){return playFantaballopoliFinal()}
function finishFantaballopoliJuventusFinal(){return finishFantaballopoliFinal()}
function restartLeagueAfterFantaballopoli(){state.phase='finished';save();render()}
function showFantaballopoliRestart(){screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Salvataggio precedente</div><h2>Fantaballopoli è stata aggiornata</h2><p>Questo salvataggio appartiene alla vecchia versione della storia. Puoi chiudere la stagione senza perdere il recap già ottenuto.</p></div><button id="finishLegacyFantaballopoli" class="btn primary">Vai al recap finale</button></section>`;document.getElementById('finishLegacyFantaballopoli').onclick=restartLeagueAfterFantaballopoli}
function renderFantaballopoliBossRoster(boss){return `<div class="goal-line"><b>Formazione ${esc(boss.formation)} · rosa ${esc(boss.season)}</b><br>${boss.starters.map(player=>`${esc(player.name)} (${esc(player.position)}, ${Number(player.ovr)} OVR)`).join(' · ')}</div><div class="goal-line"><b>Panchina</b><br>${boss.bench.map(esc).join(' · ')}</div>`}
function showFantaballopoliFinal(){
 const story=fantaballopoliState(),finale=story.finale,boss=fantaballopoliBossDefinition(story),powers=fantaballopoliBossPowers(story);if(!finale.played){
  const powerRows=powers.map(power=>`<div class="goal-line"><b>${power.active?'⚠️':'✅'} ${esc(power.name)}</b><br>${power.active?esc(power.description):'Potere disattivato grazie alle prove superate.'}</div>`).join('');screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Boss finale · Fantaballopoli</div><h2>${esc(boss.name)}</h2><div class="final-position">VS</div><p>${story.path==='evil'?'Difendi la Triade contro la rosa dell’Inter 2005/2006.':'Abbatti il sistema affrontando la rosa della Juventus 2005/2006.'}</p></div><section class="panel"><h3>Poteri del boss</h3>${powerRows}<p class="subline">${esc(fantaballopoliCollectedLabels(story))}</p></section><section class="panel"><h3>Rosa del boss</h3>${renderFantaballopoliBossRoster(boss)}</section><section class="panel"><p>Se vinci, i tuoi <b>${Number(userStanding()?.pts)||0} punti</b> in campionato vengono raddoppiati. In caso di sconfitta restano invariati.</p><button id="playFantaballopoliFinal" type="button" data-single-action data-busy-announcement="Boss fight avviata." class="btn primary">Affronta ${esc(boss.name)}</button></section></section>`;document.getElementById('playFantaballopoliFinal').onclick=playFantaballopoliFinal;return;
 }
 const penaltyLine=finale.penalties?` · rigori ${Number(finale.penalties.for)}-${Number(finale.penalties.against)}`:finale.extraTime?' · d.t.s.':'',notes=(finale.notes||[]).map(note=>`<div class="goal-line">${esc(note)}</div>`).join('');screen.innerHTML=`<section class="panel season-finished-view"><div class="final-hero"><div class="label">Fantaballopoli conclusa</div><h2>${finale.won?`Hai sconfitto ${esc(boss.name)}`:`${esc(boss.name)} ha vinto`}</h2><div class="final-position">${Number(finale.userGoals)}–${Number(finale.opponentGoals)}</div><p>${penaltyLine?esc(penaltyLine.replace(/^ · /,'')):''}</p></div><section class="panel"><div class="goal-line"><b>${esc(state.teamName)}</b><br>${(finale.userScorers||[]).map(esc).join(' · ')||'Nessun marcatore'}</div><div class="goal-line"><b>${esc(boss.name)}</b><br>${(finale.opponentScorers||[]).map(esc).join(' · ')||'Nessun marcatore'}</div>${notes}<div class="goal-line"><b>Punti campionato</b><br>${Number(finale.pointsBeforeBonus)||0} → <b>${Number(finale.pointsAfterBonus)||0}</b>${finale.won?' · raddoppiati':' · invariati'}</div></section><button id="finishFantaballopoliFinal" class="btn primary">Vai al recap finale</button></section>`;document.getElementById('finishFantaballopoliFinal').onclick=finishFantaballopoliFinal;
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

