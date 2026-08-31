function formulaOneInjuredRoster(teamId){
 const id=String(teamId||''),team=teamById(id),isUser=id===String(USER_ID);
 const rosterIds=(isUser?(state.draft?.roster||[]).map(entry=>String(entry?.playerId||entry?.player?.id||'')):(Array.isArray(team?.roster)?team.roster:[]).map(String)).filter(Boolean);
 const statuses=isUser?(state.statuses||{}):(team?.statuses||{});
 return rosterIds.map(playerId=>{
   const status=statuses[String(playerId)]||{};
   const hasInjury=Boolean(status.seasonOut)||Number(status.injury)>0;
   if(!hasInjury)return null; // Espulsioni e squalifiche non causano il tavolino.
   const player=isUser?(rosterEntry(playerId)?.player||playerById(playerId)):chaosPlayer(team,playerId);
   return{playerId:String(playerId),name:String(player?.name||'Giocatore'),injury:Math.max(0,Number(status.injury)||0),seasonOut:Boolean(status.seasonOut)};
 }).filter(Boolean);
}
function formulaOneInjuryWalkoverForMatch(homeId,awayId){
 if(!formulaOneRuleActive())return null;
 const homeInjured=formulaOneInjuredRoster(homeId),awayInjured=formulaOneInjuredRoster(awayId),homeForfeit=homeInjured.length>0,awayForfeit=awayInjured.length>0;
 if(!homeForfeit&&!awayForfeit)return null;
 const doubleForfeit=homeForfeit&&awayForfeit,winnerId=doubleForfeit?'':String(homeForfeit?awayId:homeId);
 return{active:true,homeId:String(homeId||''),awayId:String(awayId||''),homeForfeit,awayForfeit,doubleForfeit,homeInjured,awayInjured,homeScore:doubleForfeit?0:(homeForfeit?0:3),awayScore:doubleForfeit?0:(awayForfeit?0:3),winnerId};
}
function formulaOneWalkoverUserView(walkover,userHome){
 if(!walkover?.active)return null;
 const userForfeit=Boolean(userHome?walkover.homeForfeit:walkover.awayForfeit),opponentForfeit=Boolean(userHome?walkover.awayForfeit:walkover.homeForfeit),userInjured=userHome?walkover.homeInjured:walkover.awayInjured,opponentInjured=userHome?walkover.awayInjured:walkover.homeInjured;
 return{active:true,userForfeit,opponentForfeit,doubleForfeit:Boolean(walkover.doubleForfeit),userInjured:userInjured||[],opponentInjured:opponentInjured||[],gf:userForfeit?0:3,ga:opponentForfeit&&!userForfeit?0:3,winnerId:walkover.doubleForfeit?'':String(walkover.winnerId||'')};
}
function formulaOneApplyDoubleForfeitStanding(teamId){
 const standing=state.standings?.[String(teamId||'')];if(!standing)return;standing.p++;standing.l++;standing.ga+=3;
}
function emptyLeagueMatchAwards(){return{homeGoalkeeperId:'',awayGoalkeeperId:'',homeCleanSheet:false,awayCleanSheet:false,mvpId:'',mvpScore:0,mvpTeamId:'',ductilityBoosts:[]}}
function simulatePenaltyShootout(powerA=70,powerB=70){
 let a=0,b=0,kicksA=0,kicksB=0;
 const chanceA=clamp(.73+(Number(powerA)-Number(powerB))/450,.58,.88),chanceB=clamp(.73+(Number(powerB)-Number(powerA))/450,.58,.88);
 for(let round=0;round<5;round++){
   kicksA++;if(Math.random()<chanceA)a++;
   if(a>b+(5-round))break;
   kicksB++;if(Math.random()<chanceB)b++;
   if(b>a+(4-round))break;
 }
 let sudden=0;while(a===b&&sudden<12){kicksA++;kicksB++;const hitA=Math.random()<chanceA,hitB=Math.random()<chanceB;if(hitA)a++;if(hitB)b++;sudden++;}
 if(a===b){if(Math.random()<.5)a++;else b++;}
 return{scoreA:a,scoreB:b,kicksA,kicksB};
}
function appendExtraTimeGoalEvents(total,lineup,team,opponent,events,startMinute=90){
 const additions=buildTeamGoals(Math.max(0,Number(total)||0),lineup,team,opponent,[],30).map(event=>{const minute=Math.max(1,Number(event.minute)||1)+Math.max(0,Number(startMinute)||90);return{...event,minute,goalValue:Math.max(1,Number(goalValueForMinute(minute))||1),description:`Supplementari: ${event.description||'la palla finisce in rete.'}`}});
 if(Array.isArray(events)){events.push(...additions);events.sort((a,b)=>(Number(a?.minute)||0)-(Number(b?.minute)||0));}
 return additions;
}
function resolveNoDrawMatch({scoreA=0,scoreB=0,eventsA=[],eventsB=[],lineupA=[],lineupB=[],teamA=null,teamB=null,powerA=70,powerB=70,duration=90,force=false}={}){
 let a=Number(scoreA)||0,b=Number(scoreB)||0;const regulationDuration=Math.max(30,Number(duration)||90),base={scoreA:a,scoreB:b,outcomeScoreA:a,outcomeScoreB:b,winnerId:a>b?String(teamA?.id||''):b>a?String(teamB?.id||''):'',extraTime:false,penalties:null,duration:regulationDuration,regulationDuration,note:''};
 if((!force&&!noDrawRuleActive())||a!==b)return base;
 const extra=simulateScore(Math.max(35,Number(powerA)||70),Math.max(35,Number(powerB)||70),0,30,.62),addedA=appendExtraTimeGoalEvents(extra[0],lineupA,teamA,teamB,eventsA,regulationDuration),addedB=appendExtraTimeGoalEvents(extra[1],lineupB,teamB,teamA,eventsB,regulationDuration);
 a+=scoreGoalEvents(addedA);b+=scoreGoalEvents(addedB);base.extraTime=true;base.duration=regulationDuration+30;base.scoreA=a;base.scoreB=b;base.outcomeScoreA=a;base.outcomeScoreB=b;
 if(a!==b){base.winnerId=String((a>b?teamA:teamB)?.id||'');base.note=`Niente pareggio: ${a>b?teamA?.name:teamB?.name} vince dopo i tempi supplementari.`;return base;}
 const shootout=simulatePenaltyShootout(powerA,powerB),winnerA=shootout.scoreA>shootout.scoreB;base.penalties={home:shootout.scoreA,away:shootout.scoreB,winnerId:String((winnerA?teamA:teamB)?.id||'')};base.winnerId=base.penalties.winnerId;base.outcomeScoreA=a+(winnerA?1:0);base.outcomeScoreB=b+(winnerA?0:1);base.note=`Niente pareggio: ${winnerA?teamA?.name:teamB?.name} vince ${shootout.scoreA}-${shootout.scoreB} ai calci di rigore.`;return base;
}
function matchOutcomeScores(gf,ga,winnerId='',teamId=''){
 let scored=Number(gf)||0,conceded=Number(ga)||0;const winner=String(winnerId||''),team=String(teamId||'');
 if(scored===conceded&&winner){if(winner===team)scored++;else conceded++;}
 return{gf:scored,ga:conceded};
}
function formulaOnePerformanceEntries(roundResults=[]){
 const entries=[];
 (roundResults||[]).forEach(result=>{
   if(result?.rested)return;
   const winner=String(result?.winnerId||''),homeId=String(result?.homeId||''),awayId=String(result?.awayId||''),homeScore=Number(result?.homeScore)||0,awayScore=Number(result?.awayScore)||0,walkover=result?.formulaOneInjuryWalkover||null;
   [[homeId,String(result?.homeName||''),awayId,homeScore,awayScore,'home'],[awayId,String(result?.awayName||''),homeId,awayScore,homeScore,'away']].forEach(([teamId,name,opponentId,gf,ga,side])=>{
     if(!teamId||isTeamEliminated(teamId))return;
     const doubleForfeit=Boolean(walkover?.doubleForfeit),forfeited=Boolean(side==='home'?walkover?.homeForfeit:walkover?.awayForfeit);
     if(doubleForfeit){gf=0;ga=3;}
     const outcome=doubleForfeit||forfeited?0:winner?(winner===teamId?3:0):(gf>ga?3:gf===ga?1:0),opponent=teamById(opponentId),opponentPower=Math.round((opponentMatchPower(opponent)||0)*10)/10;
     entries.push({teamId,name:name||teamById(teamId)?.name||teamId,opponentId,gf,ga,goalDifference:gf-ga,outcome,opponentPower,points:0,position:0,walkover:Boolean(walkover?.active),forfeited,doubleForfeit});
   });
 });
 return entries.sort((a,b)=>b.outcome-a.outcome||b.goalDifference-a.goalDifference||b.gf-a.gf||a.ga-b.ga||b.opponentPower-a.opponentPower||String(a.name).localeCompare(String(b.name),'it'));
}
function applyFormulaOneRoundPoints(roundResults=[]){
 if(!formulaOneRuleActive())return{ranking:[],user:null};
 const ranking=formulaOnePerformanceEntries(roundResults);ranking.forEach((entry,index)=>{
   entry.position=index+1;
   entry.basePoints=Number(FORMULA_ONE_POINTS[index]||0);
   const marottaVictory=Boolean(state.seasonRules?.marottaDoubleWins&&String(entry.teamId)===String(USER_ID)&&Number(entry.outcome)===3);
   entry.marottaDoubled=marottaVictory;
   entry.points=marottaVictory?entry.basePoints*2:entry.basePoints;
   if(state.standings?.[entry.teamId])state.standings[entry.teamId].pts+=entry.points;
 });
 return{ranking,user:ranking.find(entry=>String(entry.teamId)===String(USER_ID))||null};
}
function formulaOneRankingSummary(ranking=[]){return(ranking||[]).slice(0,10).map(entry=>`${entry.position}. ${entry.name} +${entry.points}`).join(' · ')}
function activateFgciPointsRule(rule='heavy-goals'){
 const normalized=rule==='clean-sheet'?'clean-sheet':'heavy-goals';
 state.seasonRules.fgciPointsRule=normalized;
 return normalized==='heavy-goals'?'Da ora e fino a fine stagione ogni squadra perde 1 punto per ogni gol subito.':'Da ora e fino a fine stagione ogni squadra guadagna 1 punto quando mantiene la porta inviolata.';
}
function fgciPointsRuleLabel(rule=state.seasonRules?.fgciPointsRule){return rule==='heavy-goals'?'Gol pesanti':rule==='clean-sheet'?'Porta inviolata':''}
function activateFgciResultRule(rule='boredom-wins'){
 const normalized=rule==='all-in'?'all-in':'boredom-wins';
 state.seasonRules.fgciResultRule=normalized;
 return normalized==='boredom-wins'?'Da ora e fino a fine stagione ogni 0-0 assegna 7 punti a entrambe le squadre.':'Da ora e fino a fine stagione ogni squadra sconfitta perde 3 punti in classifica.';
}
function fgciResultRuleLabel(rule=state.seasonRules?.fgciResultRule){return rule==='boredom-wins'?'Vince la noia':rule==='all-in'?'Tutto per tutto':''}
function fgciResultRuleTarget(gf,ga,basePoints=0,rule=state.seasonRules?.fgciResultRule){
 const normalized=String(rule||''),scored=Number(gf)||0,conceded=Number(ga)||0;
 if(normalized==='boredom-wins'&&scored===0&&conceded===0)return 7;
 if(normalized==='all-in'&&scored<conceded)return-3;
 return Number(basePoints)||0;
}
function fgciResultRuleNote(gf,ga,rule=state.seasonRules?.fgciResultRule){
 const normalized=String(rule||'');
 if(normalized==='boredom-wins'&&Number(gf)===0&&Number(ga)===0)return'Vince la noia: lo 0-0 assegna 7 punti a entrambe le squadre.';
 if(normalized==='all-in'&&Number(gf)<Number(ga))return'Tutto per tutto: la sconfitta vale -3 punti.';
 return'';
}
function activateFantaballaVideoRule(rule='reverse-points'){
 const normalized=rule==='two-goals-to-win'?'two-goals-to-win':'reverse-points';
 state.seasonRules.fantaballaVideoRule=normalized;
 return normalized==='reverse-points'
  ?'Chi vince perde! è attivo: fino a fine stagione le sconfitte valgono 3 punti, i pareggi 1 e le vittorie 0.'
  :'Segna o non vinci è attivo: fino a fine stagione una squadra deve segnare almeno 2 gol per ottenere una vittoria; ogni 1-0 viene trasformato in 1-1.';
}
function fantaballaVideoRuleLabel(rule=state.seasonRules?.fantaballaVideoRule){return rule==='reverse-points'?'Chi vince perde!':rule==='two-goals-to-win'?'Segna o non vinci':''}
function fantaballaVideoPointsNote(gf,ga,rule=state.seasonRules?.fantaballaVideoRule){
 if(String(rule||'')!=='reverse-points')return'';
 const scored=Number(gf)||0,conceded=Number(ga)||0;
 if(scored>conceded)return'Chi vince perde!: la vittoria assegna 0 punti.';
 if(scored===conceded)return'Chi vince perde!: il pareggio assegna 1 punto.';
 return'Chi vince perde!: la sconfitta assegna 3 punti.';
}
function applyFantaballaVideoScoreRule(scoreA,scoreB,eventsA,eventsB,teamA,teamB,duration=90,rule=state.seasonRules?.fantaballaVideoRule){
 let a=Number(scoreA)||0,b=Number(scoreB)||0,changed=false,note='';
 if(String(rule||'')!=='two-goals-to-win')return{scoreA:a,scoreB:b,changed,note};
 if(a===1&&b===0){
  const equalizer=regulationGoalEvent(teamB,teamA,duration,'Segna o non vinci');
  equalizer.minute=Math.max(1,Number(duration)||90);equalizer.description=`Segna o non vinci: ${teamA?.name||'la squadra in vantaggio'} non ha segnato almeno 2 gol. Il risultato diventa 1-1.`;
  if(Array.isArray(eventsB))eventsB.push(equalizer);b=1;changed=true;note=equalizer.description;
 }else if(b===1&&a===0){
  const equalizer=regulationGoalEvent(teamA,teamB,duration,'Segna o non vinci');
  equalizer.minute=Math.max(1,Number(duration)||90);equalizer.description=`Segna o non vinci: ${teamB?.name||'la squadra in vantaggio'} non ha segnato almeno 2 gol. Il risultato diventa 1-1.`;
  if(Array.isArray(eventsA))eventsA.push(equalizer);a=1;changed=true;note=equalizer.description;
 }
 if(Array.isArray(eventsA))eventsA.sort((x,y)=>(Number(x?.minute)||0)-(Number(y?.minute)||0));
 if(Array.isArray(eventsB))eventsB.sort((x,y)=>(Number(x?.minute)||0)-(Number(y?.minute)||0));
 return{scoreA:a,scoreB:b,changed,note};
}
function activateItaliaCatenaccioRule(rule='allegri'){
 const normalized=rule==='goal-disgust'?'goal-disgust':'allegri';
 state.seasonRules.italiaCatenaccioRule=normalized;
 return normalized==='allegri'?'Allegri insegna è attivo: fino a fine stagione la tua squadra può segnare al massimo un gol per partita.':'Il gol? Che schifo! è attivo: ogni volta che segni più di 3 gol perdi 6 punti in classifica.';
}
function italiaCatenaccioRuleLabel(rule=state.seasonRules?.italiaCatenaccioRule){return rule==='allegri'?'Allegri insegna':rule==='goal-disgust'?'Il gol? Che schifo!':''}
function capGoalEvents(events,maxGoals=1){
 const source=Array.isArray(events)?events:[],limit=Math.max(0,Math.floor(Number(maxGoals)||0)),kept=[];let remaining=limit;
 source.sort((a,b)=>(Number(a?.minute)||0)-(Number(b?.minute)||0));
 for(const event of source){if(remaining<=0)break;const value=Math.max(1,Number(event?.goalValue)||1),accepted=Math.min(value,remaining);event.goalValue=accepted;kept.push(event);remaining-=accepted;}
 source.splice(0,source.length,...kept);return limit-remaining;
}
function applyItaliaCatenaccioPointPenalty(gf){
 if(String(state.seasonRules?.italiaCatenaccioRule)!=='goal-disgust'||Number(gf)<=3)return 0;
 const standing=userStanding();if(standing)standing.pts-=6;return-6;
}
function parityResetState(source=state){
 const rules=source?.seasonRules||(source.seasonRules={});
 const pending=rules.pendingParityReset&&typeof rules.pendingParityReset==='object'?rules.pendingParityReset:(rules.pendingParityReset={});
 pending.active=Boolean(pending.active);
 pending.parity=['even','odd'].includes(String(pending.parity))?String(pending.parity):'';
 pending.dueMatchday=Number.isFinite(Number(pending.dueMatchday))?Number(pending.dueMatchday):-1;
 pending.scheduledAt=Number.isFinite(Number(pending.scheduledAt))?Number(pending.scheduledAt):-1;
 pending.appliedMatchday=Number.isFinite(Number(pending.appliedMatchday))?Number(pending.appliedMatchday):-1;
 pending.lastResult=String(pending.lastResult||'');
 if(!pending.parity||pending.dueMatchday<0)pending.active=false;
 return pending;
}
function scheduleStandingsResetByParity(parity='even'){
 const normalized=parity==='odd'?'odd':'even',label=normalized==='even'?'pari':'dispari';
 const pending=parityResetState(),dueMatchday=Math.min(seasonLength(),(Number(state.matchday)||0)+1);
 Object.assign(pending,{active:true,parity:normalized,dueMatchday,scheduledAt:Number(state.matchday)||0,appliedMatchday:-1,lastResult:''});
 return `La scelta ${label} è stata registrata. La classifica resta invariata: l’azzeramento verrà applicato soltanto dopo la giornata ${dueMatchday}.`;
}
function resetStandingsByParity(parity='even'){
 const normalized=parity==='odd'?'odd':'even',wanted=normalized==='even'?0:1;
 const ids=Array.isArray(state.teams)&&state.teams.length?state.teams.map(team=>String(team.id||'')):Object.keys(state.standings||{});
 let matching=0,reset=0;
 [...new Set(ids)].forEach(id=>{
   const standing=state.standings?.[id],points=Number(standing?.pts);
   if(!standing||!Number.isFinite(points)||!Number.isInteger(points)||Math.abs(points)%2!==wanted)return;
   matching++;
   if(points!==0){if(String(id)===String(USER_ID))setAchievementCareerFlag('parityReset',{resetMatchday:(Number(state.matchday)||0)+1,parity:normalized});standing.pts=0;reset++}
 });
 const label=normalized==='even'?'pari':'dispari';
 if(!matching)return`Nessuna squadra aveva un punteggio ${label}: la classifica non cambia.`;
 if(!reset)return`Le ${matching} squadre con punti ${label} erano già a 0: la classifica non cambia.`;
 const alreadyZero=matching-reset;
 return`${reset} ${reset===1?'squadra è stata portata':'squadre sono state portate'} a 0 perché ${reset===1?'aveva':'avevano'} punti ${label}.${alreadyZero>0?` Altre ${alreadyZero} erano già a 0.`:''}`;
}
function resolvePendingParityResetAfterRound(result){
 const pending=parityResetState(),completedMatchday=(Number(state.matchday)||0)+1;
 if(!pending.active||completedMatchday<Number(pending.dueMatchday))return'';
 const parity=pending.parity,label=parity==='odd'?'Dispari':'Pari',detail=resetStandingsByParity(parity);
 pending.active=false;pending.appliedMatchday=completedMatchday;pending.lastResult=detail;
 const notice=`${label}: ${detail}`;
 if(result){result.parityResetNotice=notice;result.parityResetChoice=label;result.parityResetMatchday=completedMatchday;}
 return notice;
}
function fgciPointsAdjustment(gf,ga,rule=state.seasonRules?.fgciPointsRule){
 const normalized=String(rule||'');
 if(normalized==='heavy-goals')return-Math.max(0,Number(ga)||0);
 if(normalized==='clean-sheet'&&Math.max(0,Number(ga)||0)===0)return 1;
 return 0;
}
function fgciPointsRuleNote(gf,ga,rule=state.seasonRules?.fgciPointsRule){
 const adjustment=fgciPointsAdjustment(gf,ga,rule),label=fgciPointsRuleLabel(rule);if(!label)return'';
 if(String(rule)==='heavy-goals')return`${label}: ${Math.max(0,Number(ga)||0)} ${Math.max(0,Number(ga)||0)===1?'gol subito':'gol subiti'}, ${adjustment} ${Math.abs(adjustment)===1?'punto':'punti'}.`;
 return adjustment>0?`${label}: porta inviolata, +1 punto.`:`${label}: nessun punto bonus perché hai subito gol.`;
}
function applyFederationGoalRuleToEvents(teamAEvents,teamBEvents,teamA,teamB){
 const rule=String(state.seasonRules?.federationGoalRule||'');if(!['golden','last'].includes(rule))return null;
 const a=Array.isArray(teamAEvents)?teamAEvents:[],b=Array.isArray(teamBEvents)?teamBEvents:[];
 const timeline=[...a.map(event=>({event,side:'a',tie:Math.random()})),...b.map(event=>({event,side:'b',tie:Math.random()}))].sort((x,y)=>(Number(x.event?.minute)||0)-(Number(y.event?.minute)||0)||x.tie-y.tie);
 if(!timeline.length)return{rule,scoreA:0,scoreB:0,winnerId:'',endedMinute:0,note:`${federationGoalRuleLabel(rule)}: nessuna squadra ha segnato, quindi la partita termina in pareggio.`};
 if(rule==='golden'){
   const first=timeline[0];first.event.goalValue=1;
   a.splice(0,a.length,...(first.side==='a'?[first.event]:[]));b.splice(0,b.length,...(first.side==='b'?[first.event]:[]));
   const winner=first.side==='a'?teamA:teamB;
   return{rule,scoreA:first.side==='a'?1:0,scoreB:first.side==='b'?1:0,winnerId:String(winner?.id||''),endedMinute:Number(first.event?.minute)||1,note:`Golden goal: ${winner?.name||'la squadra che ha segnato'} vince con il primo gol al ${Number(first.event?.minute)||1}′.`};
 }
 const last=timeline[timeline.length-1],actualA=scoreGoalEvents(a),actualB=scoreGoalEvents(b),winner=last.side==='a'?teamA:teamB;
 let scoreA=actualA,scoreB=actualB;
 if(last.side==='a'&&scoreA<=scoreB)scoreA=scoreB+1;
 if(last.side==='b'&&scoreB<=scoreA)scoreB=scoreA+1;
 return{rule,scoreA,scoreB,winnerId:String(winner?.id||''),endedMinute:Number(last.event?.minute)||90,note:`Chi segna per ultimo vince: ${winner?.name||'la squadra dell’ultimo marcatore'} ottiene la vittoria grazie al gol del ${Number(last.event?.minute)||90}′.`};
}
function leagueScheduleCycle(teamIds,roundCount){
 const ids=[...new Set((teamIds||[]).map(String).filter(Boolean))];if(ids.length<2)return[];
 const base=generateSchedule(ids),rounds=[];for(let index=0;index<Math.max(0,Number(roundCount)||0);index++)rounds.push((base[index%base.length]||[]).map(match=>({...match})));
 return rounds;
}
function leagueStructureTeamIds(source=state){
 const teams=Array.isArray(source?.teams)?source.teams:[],knownIds=new Set(teams.map(team=>String(team?.id||'')).filter(Boolean)),rules=source?.seasonRules||{};
 const explicit=[...new Set((Array.isArray(rules.dynamicLeagueTeamIds)?rules.dynamicLeagueTeamIds:[]).map(String).filter(id=>knownIds.has(id)))];if(explicit.length>=2)return explicit;
 if(rules.dynamicLeague==='elite'){
   const futureIds=new Set();(Array.isArray(source?.schedule)?source.schedule:[]).slice(Math.max(0,Number(source?.matchday)||0)).forEach(round=>(round||[]).forEach(match=>{if(knownIds.has(String(match?.home||'')))futureIds.add(String(match.home));if(knownIds.has(String(match?.away||'')))futureIds.add(String(match.away))}));
   const scheduled=teams.map(team=>String(team.id)).filter(id=>futureIds.has(id));if(scheduled.length>=2)return scheduled;
   const removed=new Set((Array.isArray(rules.eliminatedTeamIds)?rules.eliminatedTeamIds:[]).map(String)),qualified=teams.map(team=>String(team.id)).filter(id=>!removed.has(id));if(qualified.length>=2)return qualified;
 }
 return teams.map(team=>String(team.id)).filter(Boolean);
}
function regularLeagueSeasonLength(teamIds){const count=[...new Set((teamIds||[]).map(String).filter(Boolean))].length;return count>=2?(count-1)*2:0}
function desiredLeagueSeasonLength(source=state,teamIds=leagueStructureTeamIds(source)){
 const regular=regularLeagueSeasonLength(teamIds),marathon=Boolean(source?.seasonRules?.marathon),played=Math.max(0,Number(source?.matchday)||0);
 if(!regular)return Math.max(1,Number(source?.seasonRules?.seasonLength)||38);
 if(source?.seasonRules?.dynamicLeague==='elite')return Math.max(marathon?76:38,played+regular*(marathon?2:1));
 return regular*(marathon?2:1);
}
function rebuildRemainingLeagueSchedule(teamIds,targetLength){
 const completed=(state.schedule||[]).slice(0,Math.max(0,Number(state.matchday)||0)).map(round=>round.map(match=>({...match})));
 const total=Math.max(completed.length,Math.floor(Number(targetLength)||38)),remaining=Math.max(0,total-completed.length);
 state.schedule=[...completed,...leagueScheduleCycle(teamIds,remaining)];state.seasonRules.seasonLength=state.schedule.length;return state.schedule.length;
}
function expandedLeagueClubPool(){
 const playerClubs=new Set((otherCompetitionPlayers()||[]).map(player=>String(player?.club||'')).filter(Boolean));
 return shuffle((OTHER_CLUBS||[]).filter(club=>club&&playerClubs.has(String(club.id))&&!/^fantaballa(?:-|$)/i.test(String(club.id))));
}
function expandedLeagueRoster(club,sourceKey,teamId){
 const pool=(otherCompetitionPlayers()||[]).filter(player=>String(player?.club)===String(club.id)).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0)||String(a.name).localeCompare(String(b.name),'it'));
 const selected=[],used=new Set();[['P',2],['D',5],['C',4],['A',3]].forEach(([role,count])=>pool.filter(player=>roleOf(player)===role).slice(0,count).forEach(player=>{if(!used.has(String(player.id))){selected.push(player);used.add(String(player.id))}}));
 pool.filter(player=>!used.has(String(player.id))).slice(0,Math.max(0,14-selected.length)).forEach(player=>selected.push(player));
 return selected.slice(0,14).map(player=>chaosRegisterGeneratedPlayer({...player,id:`league-${sourceKey}-${club.id}-${player.id}`,club:teamId,originalClub:String(club.id),externalCompetition:sourceKey,eventPlayer:true})).map(player=>String(player.id));
}
function createExpandedLeagueTeam(club,index){
 const sourceKey=PLAYERS===REAL_PLAYERS?'classic':'real',teamId=`expanded-${sourceKey}-${club.id}`,roster=expandedLeagueRoster(club,sourceKey,teamId),values=roster.slice(0,11).map(id=>Number(playerById(id)?.ovr)||60);
 while(values.length<11)values.push(60);
 return{id:teamId,clubId:teamId,originalClubId:String(club.id),name:String(club.name||`Nuova squadra ${index+1}`),shortName:String(club.shortName||club.name||'NEW').slice(0,4).toUpperCase(),colors:club.colorClub||null,strength:Math.round(avg(values)*10)/10,roster,statuses:{},mascot:null,playerOverrides:{},externalCompetition:sourceKey,chaos:{activeEffects:[],seenDecisionEvents:[],decisions:0,midseasonPickDelta:0,matchDuration:90,futureScorerId:'',futureInjuryZeroPoints:false,sixtyPointFear:false,eventChanceMultiplier:1,nonItalianChemZero:false,formation:'',latestDecision:null}};
}
function activateExpandedLeague(){
 if(state.seasonRules.dynamicLeague)return `La struttura della lega è già stata modificata da ${state.seasonRules.dynamicLeagueLabel||'un altro evento'}.`;
 const clubs=expandedLeagueClubPool().slice(0,20);if(clubs.length<20)return `Nell’altro database sono disponibili soltanto ${clubs.length} club completi: il campionato non può essere allargato a 40 squadre.`;
 const leaderPoints=Math.max(0,...Object.values(state.standings||{}).map(row=>Number(row?.pts)||0));
 const pointCap=Math.max(0,Math.floor(leaderPoints));
 const additions=clubs.map(createExpandedLeagueTeam);additions.forEach(team=>{
  const startingPoints=pointCap>0?Math.floor(Math.random()*(pointCap+1)):0;
  state.teams.push(team);
  state.standings[team.id]={id:team.id,name:team.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:startingPoints};
 });
 state.seasonRules.dynamicLeague='expanded';state.seasonRules.dynamicLeagueLabel='Campionato allargato';state.seasonRules.dynamicLeagueAppliedAt=Number(state.matchday)||0;
 const activeIds=state.teams.map(team=>String(team.id));state.seasonRules.dynamicLeagueTeamIds=[...activeIds];
 const target=desiredLeagueSeasonLength(state,activeIds);rebuildRemainingLeagueSchedule(activeIds,target);
 return `Campionato allargato attivato: entrano 20 club casuali da ${otherCompetitionName()} con punti iniziali casuali da 0 a ${pointCap}, il punteggio della capolista al momento dell'evento. Ora partecipano ${activeIds.length} squadre e la stagione arriverà a ${state.schedule.length} giornate${state.seasonRules.marathon?' perché la Maratona raddoppia anche il nuovo campionato':''}.`;
}
function activateEliteLeague(){
 if(state.seasonRules.dynamicLeague)return `La struttura della lega è già stata modificata da ${state.seasonRules.dynamicLeagueLabel||'un altro evento'}.`;
 const fullTable=Object.values(state.standings||{}).sort((a,b)=>b.pts-a.pts||((b.gf-b.ga)-(a.gf-a.ga))||b.gf-a.gf||b.w-a.w);if(fullTable.length<11)return 'Non ci sono abbastanza squadre per creare il Campionato élite.';
 const qualified=fullTable.slice(0,10).map(row=>String(row.id)),removed=fullTable.slice(10).map(row=>String(row.id));
 state.seasonRules.dynamicLeague='elite';state.seasonRules.dynamicLeagueLabel='Campionato élite';state.seasonRules.dynamicLeagueAppliedAt=Number(state.matchday)||0;state.seasonRules.dynamicLeagueTeamIds=[...qualified];state.seasonRules.eliminatedTeamIds=[...new Set([...(state.seasonRules.eliminatedTeamIds||[]).map(String),...removed])];
 const target=desiredLeagueSeasonLength(state,qualified);rebuildRemainingLeagueSchedule(qualified,target);
 const removedNames=removed.map(id=>teamById(id)?.name||state.standings?.[id]?.name||id);
 if(removed.includes(USER_ID)){state.phase='finished';return `Campionato élite attivato: le ultime ${removed.length} squadre vengono escluse. La tua squadra non era nelle prime 10 e la stagione termina qui.`}
 return `Campionato élite attivato: restano soltanto le prime 10. Sono state escluse ${removedNames.join(', ')}. Il calendario è stato ricostruito fino alla giornata ${state.schedule.length}.`;
}
