/* Fantaballa Season Engine — 06b-champions-league.js
 * Modalità Fantacampionato Champions League 2026/2027.
 * 36 squadre, 4 fasce, 8 giornate e fase a eliminazione diretta UEFA-style.
 */
function isChampionsCompetition(source=state){return String(source?.competitionVariant||'')==='champions'}
function championsState(){
 if(!state.champions||typeof state.champions!=='object')state.champions={};
 const c=state.champions;
 c.version=1;c.replacedPot4ClubId=String(c.replacedPot4ClubId||'');c.leagueRank=Math.max(0,Number(c.leagueRank)||0);c.leagueTable=Array.isArray(c.leagueTable)?c.leagueTable:[];c.stage=String(c.stage||'league');c.stageIndex=Math.max(0,Number(c.stageIndex)||0);c.ties=Array.isArray(c.ties)?c.ties:[];c.history=Array.isArray(c.history)?c.history:[];c.championId=String(c.championId||'');c.userEliminated=Boolean(c.userEliminated);c.userExitStage=String(c.userExitStage||'');
 return c;
}
function championsCompetitionLabel(value=state?.competitionVariant){const id=normalizeCompetitionVariant(value);return id==='champions'?'🏆 Champions League':id==='legend'?'🌟 Legend':'🇮🇹 Serie A'}
function championsClubPot(team){const club=clubById(team?.clubId||team?.id);return Math.max(1,Math.min(4,Number(club?.pot)||4))}
function championsClubAssociation(team){const club=clubById(team?.clubId||team?.id);return String(club?.association||'').toUpperCase()||'INT'}
function championsShuffle(values){const a=[...(values||[])];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function championsPairKey(a,b){return [String(a),String(b)].sort().join('::')}
function championsAssociationCounter(teams){const counter={};(teams||[]).forEach(team=>counter[String(team.id)]={});return counter}
function championsCanAddEdge(home,away,usedPairs,associationCounts){
 if(!home||!away||championsClubAssociation(home)===championsClubAssociation(away)||usedPairs.has(championsPairKey(home.id,away.id)))return false;
 const homeId=String(home.id),awayId=String(away.id),homeOpp=championsClubAssociation(away),awayOpp=championsClubAssociation(home);return Number(associationCounts?.[homeId]?.[homeOpp]||0)<2&&Number(associationCounts?.[awayId]?.[awayOpp]||0)<2;
}
function championsCountEdge(home,away,associationCounts,delta=1){const homeId=String(home.id),awayId=String(away.id),homeOpp=championsClubAssociation(away),awayOpp=championsClubAssociation(home);associationCounts[homeId][homeOpp]=(associationCounts[homeId][homeOpp]||0)+delta;associationCounts[awayId][awayOpp]=(associationCounts[awayId][awayOpp]||0)+delta;if(associationCounts[homeId][homeOpp]<=0)delete associationCounts[homeId][homeOpp];if(associationCounts[awayId][awayOpp]<=0)delete associationCounts[awayId][awayOpp]}
function championsFindBipartiteMatching(homeTeams,awayTeams,usedPairs,associationCounts){
 const homes=championsShuffle(homeTeams),result=[];
 const search=(remaining,index)=>{
  if(index>=homes.length)return true;
  const home=homes[index],candidates=championsShuffle(remaining.filter(away=>championsCanAddEdge(home,away,usedPairs,associationCounts)));
  for(const away of candidates){championsCountEdge(home,away,associationCounts,1);result.push({home:String(home.id),away:String(away.id)});if(search(remaining.filter(item=>item!==away),index+1))return true;result.pop();championsCountEdge(home,away,associationCounts,-1)}
  return false;
 };
 return search([...awayTeams],0)?result:null;
}
function championsSamePotCycle(teams,usedPairs,associationCounts){
 for(let attempt=0;attempt<600;attempt++){
  const order=championsShuffle(teams),edges=[],applied=[];let valid=true;
  for(let i=0;i<order.length;i++){
   const home=order[i],away=order[(i+1)%order.length];if(!championsCanAddEdge(home,away,usedPairs,associationCounts)){valid=false;break}championsCountEdge(home,away,associationCounts,1);applied.push([home,away]);edges.push({home:String(home.id),away:String(away.id)});
  }
  if(valid)return edges;for(const [home,away] of applied.reverse())championsCountEdge(home,away,associationCounts,-1);
 }
 return null;
}
function championsAssociationLimitsOk(edges,teams){
 const byId=Object.fromEntries(teams.map(team=>[String(team.id),team])),counts={};
 teams.forEach(team=>counts[String(team.id)]={});
 for(const edge of edges){
  const home=byId[String(edge.home)],away=byId[String(edge.away)];if(!home||!away)return false;
  const ha=championsClubAssociation(away),aa=championsClubAssociation(home);
  counts[String(home.id)][ha]=(counts[String(home.id)][ha]||0)+1;
  counts[String(away.id)][aa]=(counts[String(away.id)][aa]||0)+1;
 }
 return Object.values(counts).every(map=>Object.values(map).every(value=>value<=2));
}
function championsPerfectRound(remainingEdges,teamIds){
 const incident={};teamIds.forEach(id=>incident[id]=[]);
 remainingEdges.forEach((edge,index)=>{incident[String(edge.home)]?.push(index);incident[String(edge.away)]?.push(index)});
 const search=(available,selected)=>{
  if(!available.size)return selected.slice();
  let chosen='',options=null;
  for(const id of available){const list=(incident[id]||[]).filter(index=>{const edge=remainingEdges[index];return available.has(String(edge.home))&&available.has(String(edge.away))});if(!list.length)return null;if(!options||list.length<options.length){chosen=id;options=list;if(list.length===1)break}}
  for(const index of championsShuffle(options)){
   const edge=remainingEdges[index],a=String(edge.home),b=String(edge.away);if(!available.has(a)||!available.has(b))continue;
   const next=new Set(available);next.delete(a);next.delete(b);selected.push(index);const found=search(next,selected);if(found)return found;selected.pop();
  }
  return null;
 };
 return search(new Set(teamIds.map(String)),[]);
}
function championsFactorRounds(edges,teams){
 let remaining=edges.map((edge,index)=>({...edge,__id:index})),rounds=[];
 const ids=teams.map(team=>String(team.id));
 for(let r=0;r<8;r++){
  const selected=championsPerfectRound(remaining,ids);if(!selected)return null;
  const selectedSet=new Set(selected.map(index=>remaining[index].__id));rounds.push(selected.map(index=>({home:String(remaining[index].home),away:String(remaining[index].away)})));remaining=remaining.filter(edge=>!selectedSet.has(edge.__id));
 }
 return remaining.length?null:rounds;
}
function championsScheduleQuality(rounds,teams){
 let score=0;for(const team of teams){const venues=rounds.map(round=>{const fx=round.find(match=>match.home===String(team.id)||match.away===String(team.id));return fx?.home===String(team.id)?'H':'A'});for(let i=0;i<venues.length-2;i++)if(venues[i]===venues[i+1]&&venues[i]===venues[i+2])score+=5;if(venues[0]===venues[1])score+=1;if(venues[6]===venues[7])score+=1}return score;
}
function championsBestRoundOrder(rounds,teams){let best=rounds,bestScore=championsScheduleQuality(rounds,teams);for(let i=0;i<700&&bestScore>0;i++){const candidate=championsShuffle(rounds),score=championsScheduleQuality(candidate,teams);if(score<bestScore){best=candidate;bestScore=score}}return best}
function generateChampionsLeagueSchedule(teams){
 const list=(teams||[]).slice();if(list.length!==36)throw new Error(`La Champions richiede 36 squadre, trovate ${list.length}.`);
 const pots={1:[],2:[],3:[],4:[]};list.forEach(team=>pots[championsClubPot(team)].push(team));if(Object.values(pots).some(pot=>pot.length!==9))throw new Error('Le quattro fasce Champions devono contenere esattamente 9 squadre ciascuna.');
 for(let attempt=0;attempt<3000;attempt++){
  const used=new Set(),edges=[],associationCounts=championsAssociationCounter(list);let failed=false;
  for(let p=1;p<=4&&!failed;p++){
   const same=championsSamePotCycle(pots[p],used,associationCounts);if(!same){failed=true;break}same.forEach(edge=>{edges.push(edge);used.add(championsPairKey(edge.home,edge.away))});
  }
  for(let p=1;p<=4&&!failed;p++)for(let q=p+1;q<=4&&!failed;q++){
   const forward=championsFindBipartiteMatching(pots[p],pots[q],used,associationCounts);if(!forward){failed=true;break}forward.forEach(edge=>{edges.push(edge);used.add(championsPairKey(edge.home,edge.away))});
   const reverse=championsFindBipartiteMatching(pots[q],pots[p],used,associationCounts);if(!reverse){failed=true;break}reverse.forEach(edge=>{edges.push(edge);used.add(championsPairKey(edge.home,edge.away))});
  }
  if(failed||edges.length!==144||!championsAssociationLimitsOk(edges,list))continue;
  const rounds=championsFactorRounds(edges,list);if(!rounds)continue;return championsBestRoundOrder(rounds,list);
 }
 throw new Error('Non è stato possibile completare il sorteggio Champions rispettando tutti i vincoli. Riprova il draft.');
}
function championsValidateSchedule(rounds,teams){
 const errors=[],list=teams||[],byId=Object.fromEntries(list.map(team=>[String(team.id),team])),pairSeen=new Set(),stats={};list.forEach(team=>stats[String(team.id)]={matches:0,home:0,away:0,pots:{1:{h:0,a:0},2:{h:0,a:0},3:{h:0,a:0},4:{h:0,a:0}},associations:{}});
 if(!Array.isArray(rounds)||rounds.length!==8)errors.push(`Giornate: ${rounds?.length||0} invece di 8.`);
 (rounds||[]).forEach((round,r)=>{if(round.length!==18)errors.push(`G${r+1}: ${round.length} partite invece di 18.`);const present=new Set();round.forEach(fx=>{const h=String(fx.home),a=String(fx.away),home=byId[h],away=byId[a];if(!home||!away){errors.push(`G${r+1}: squadra sconosciuta.`);return}if(present.has(h)||present.has(a))errors.push(`G${r+1}: squadra duplicata.`);present.add(h);present.add(a);const key=championsPairKey(h,a);if(pairSeen.has(key))errors.push(`Sfida ripetuta: ${h}-${a}.`);pairSeen.add(key);if(championsClubAssociation(home)===championsClubAssociation(away))errors.push(`Stessa federazione: ${home.name}-${away.name}.`);[[h,home,away,'h'],[a,away,home,'a']].forEach(([id,self,opp,venue])=>{const s=stats[id];s.matches++;s[venue==='h'?'home':'away']++;const pot=championsClubPot(opp);s.pots[pot][venue]++;const assoc=championsClubAssociation(opp);s.associations[assoc]=(s.associations[assoc]||0)+1})})});
 Object.entries(stats).forEach(([id,s])=>{if(s.matches!==8||s.home!==4||s.away!==4)errors.push(`${id}: ${s.matches} gare, ${s.home} casa/${s.away} fuori.`);for(let p=1;p<=4;p++)if(s.pots[p].h!==1||s.pots[p].a!==1)errors.push(`${id}: fascia ${p} non 1 casa + 1 trasferta.`);if(Object.values(s.associations).some(n=>n>2))errors.push(`${id}: oltre 2 avversarie della stessa federazione.`)});
 return errors;
}
function finalizeChampionsDraft(userClub,draftedIds){
 const c=championsState(),pot4=CLUBS.filter(club=>!club.championsUser&&Number(club.pot)===4),replaced=pick(pot4);if(!replaced)throw new Error('Quarta fascia Champions non disponibile.');c.replacedPot4ClubId=String(replaced.id);
 const opponents=CLUBS.filter(club=>!club.championsUser&&String(club.id)!==String(replaced.id));
 state.leagueClubIds=opponents.map(club=>String(club.id));
 state.teams=[{id:USER_ID,clubId:userClub.id,name:state.teamName,shortName:userClub.shortName,colors:userClub.colorClub,strength:teamPowerBase()}].concat(opponents.map(club=>({id:club.id,clubId:club.id,name:club.name,shortName:club.shortName,colors:club.colorClub,strength:clubStrength(club.id,draftedIds),roster:buildClubRoster(club.id,draftedIds),statuses:{},mascot:null,playerOverrides:{},chaos:{activeEffects:[],seenDecisionEvents:[],decisions:0,midseasonPickDelta:0,matchDuration:90,futureScorerId:'',futureInjuryZeroPoints:false,sixtyPointFear:false,eventChanceMultiplier:1,nonItalianChemZero:false,formation:'',latestDecision:null}})));
 state.chaos={lastPreparedMatchday:-1,totalDecisions:0,currentRound:null,latest:[],midseasonDone:true};state.cup=freshState().cup;state.cup.status='completed';initializeStoryArc();state.seasonRules.seasonLength=8;state.seasonRules.dynamicLeague='';state.schedule=generateChampionsLeagueSchedule(state.teams);const drawErrors=championsValidateSchedule(state.schedule,state.teams);if(drawErrors.length)throw new Error(`Sorteggio Champions non valido: ${drawErrors[0]}`);
 state.standings={};state.teams.forEach(team=>state.standings[team.id]={id:team.id,name:team.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});resetSeasonAnalytics();c.stage='league';c.stageIndex=0;c.ties=[];c.history=[];c.championId='';c.userEliminated=false;c.userExitStage='';c.leagueRank=0;c.leagueTable=[];state.phase='season';state.matchday=0;state.pendingEvent=null;state.draft.candidates=[];save();prepareEvent();render();requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'})));
}
function championsOpponentAggregate(teamId){
 const id=String(teamId),opponentIds=[];(state.schedule||[]).forEach(round=>(round||[]).forEach(match=>{if(String(match.home)===id)opponentIds.push(String(match.away));else if(String(match.away)===id)opponentIds.push(String(match.home))}));
 return opponentIds.reduce((sum,oppId)=>{const row=state.standings?.[oppId]||{};sum.pts+=Number(row.pts)||0;sum.gd+=(Number(row.gf)||0)-(Number(row.ga)||0);sum.gf+=Number(row.gf)||0;return sum},{pts:0,gd:0,gf:0});
}
function championsSortedTable(){
 const rows=Object.values(state.standings||{});rows.forEach(row=>{row.awayGoals=Math.max(0,Number(row.awayGoals)||0);row.awayWins=Math.max(0,Number(row.awayWins)||0)});
 const sos=new Map(rows.map(row=>[String(row.id),championsOpponentAggregate(row.id)]));
 return rows.sort((a,b)=>b.pts-a.pts||((b.gf-b.ga)-(a.gf-a.ga))||b.gf-a.gf||b.awayGoals-a.awayGoals||b.w-a.w||b.awayWins-a.awayWins||(sos.get(String(b.id))?.pts||0)-(sos.get(String(a.id))?.pts||0)||(sos.get(String(b.id))?.gd||0)-(sos.get(String(a.id))?.gd||0)||(sos.get(String(b.id))?.gf||0)-(sos.get(String(a.id))?.gf||0)||String(a.name||'').localeCompare(String(b.name||''),'it'));
}
function championsRankMap(){const c=championsState(),table=c.leagueTable.length?c.leagueTable:championsSortedTable();return Object.fromEntries(table.map((row,index)=>[String(row.id),index+1]))}
function championsTie(teamAId,teamBId,{stage='playoff',index=0,single=false,rankMap={},secondLegHomeId='',pathRank=99,bracketSlot=-1}={}){const a=String(teamAId),b=String(teamBId),rankA=Number(rankMap[a])||99,rankB=Number(rankMap[b])||99;return{id:`ucl-${stage}-${index}-${a}-${b}`,stage,index,bracketSlot:Number(bracketSlot),teamAId:a,teamBId:b,rankA,rankB,pathRank:Number(pathRank)||99,secondLegHomeId:String(secondLegHomeId||''),single:Boolean(single),status:'pending',winnerId:'',result:null}}
function championsBuildPlayoffTies(table){
 const rankMap=Object.fromEntries(table.map((row,index)=>[String(row.id),index+1])),byRank=rank=>String(table[rank-1]?.id||''),groups=[[9,10,23,24],[11,12,21,22],[13,14,19,20],[15,16,17,18]],ties=[];let index=0;
 groups.forEach(group=>{const seeded=championsShuffle([byRank(group[0]),byRank(group[1])]),unseeded=championsShuffle([byRank(group[2]),byRank(group[3])]);for(let i=0;i<2;i++)ties.push(championsTie(seeded[i],unseeded[i],{stage:'playoff',index:index++,rankMap,secondLegHomeId:seeded[i],pathRank:Number(rankMap[seeded[i]])||99,bracketSlot:index-1}))});return ties;
}
function championsBuildRoundOf16Ties(table,playoffResults){
 const rankMap=Object.fromEntries(table.map((row,index)=>[String(row.id),index+1])),byRank=rank=>String(table[rank-1]?.id||''),winners=playoffResults.map(result=>String(result.winnerId||''));
 const specs=[{seeds:[5,6],wins:[2,3]},{seeds:[3,4],wins:[4,5]},{seeds:[7,8],wins:[0,1]},{seeds:[1,2],wins:[6,7]}],left=[],right=[];
 specs.forEach((spec,groupIndex)=>{const seeds=championsShuffle(spec.seeds.map(byRank)),pool=championsShuffle(spec.wins.map(i=>winners[i]));const make=(side,i)=>{const seed=seeds[i],opp=pool[i],rank=Number(rankMap[seed])||99;return championsTie(seed,opp,{stage:'round16',index:0,rankMap,secondLegHomeId:seed,pathRank:rank,bracketSlot:side*4+groupIndex})};left.push(make(0,0));right.push(make(1,1))});
 return [...left,...right].map((tie,index)=>({...tie,index,id:`ucl-round16-${index}-${tie.teamAId}-${tie.teamBId}`}));
}
function championsWinnerPath(result){return{id:String(result.winnerId||''),pathRank:Math.max(1,Number(result.pathRank)||Number(result.rankA)||Number(result.rankB)||99)}}
function championsBuildBracketTies(previousResults,stage){
 const contenders=previousResults.map(championsWinnerPath),pairs=stage==='quarter'?[[0,1],[2,3],[4,5],[6,7]]:stage==='semi'?[[0,1],[2,3]]:[[0,1]],rankMap=championsRankMap(),single=stage==='final';
 return pairs.map((pair,index)=>{const a=contenders[pair[0]],b=contenders[pair[1]],pathRank=Math.min(a.pathRank,b.pathRank),secondLegHomeId=single?'':(a.pathRank<=b.pathRank?a.id:b.id);return championsTie(a.id,b.id,{stage,index,single,rankMap,secondLegHomeId,pathRank,bracketSlot:index})});
}
function championsStageLabel(stage){return({playoff:'Playoff fase a eliminazione',round16:'Ottavi di finale',quarter:'Quarti di finale',semi:'Semifinali',final:'Finale'}[stage]||'Champions League')}
function championsTeamPower(id){const team=teamById(String(id));return String(id)===String(USER_ID)?Math.max(35,matchPower()):Math.max(35,opponentMatchPower(team))}
function championsSimOneMatch(homeId,awayId,homeAdv=.14,duration=90){const hp=championsTeamPower(homeId),ap=championsTeamPower(awayId),score=simulateScore(hp,ap,homeAdv,duration);return{homeId:String(homeId),awayId:String(awayId),homeGoals:Number(score[0])||0,awayGoals:Number(score[1])||0}}
function championsSimTie(tie){
 const rankMap=championsRankMap(),a=String(tie.teamAId),b=String(tie.teamBId),rankA=Number(rankMap[a])||99,rankB=Number(rankMap[b])||99,pathRank=Math.max(1,Number(tie.pathRank)||Math.min(rankA,rankB));
 if(tie.single){let game=championsSimOneMatch(a,b,0,90),extraTime=false,penalties=null;if(game.homeGoals===game.awayGoals){const extra=simulateScore(championsTeamPower(a),championsTeamPower(b),0,30);game.homeGoals+=extra[0];game.awayGoals+=extra[1];extraTime=true}let winnerId=game.homeGoals>game.awayGoals?a:game.awayGoals>game.homeGoals?b:'';if(!winnerId){const shoot=simulatePenaltyShootout(championsTeamPower(a),championsTeamPower(b));winnerId=shoot.scoreA>shoot.scoreB?a:b;penalties={a:shoot.scoreA,b:shoot.scoreB}}return{...tie,pathRank,status:'completed',winnerId,result:{single:true,game,extraTime,penalties,aggregateA:game.homeGoals,aggregateB:game.awayGoals}}}
 const preferred=String(tie.secondLegHomeId||''),secondHome=(preferred===a||preferred===b)?preferred:(rankA<=rankB?a:b),firstHome=secondHome===a?b:a,firstAway=firstHome===a?b:a,secondAway=secondHome===a?b:a,leg1=championsSimOneMatch(firstHome,firstAway,.14,90),leg2=championsSimOneMatch(secondHome,secondAway,.14,90);let goalsA=(leg1.homeId===a?leg1.homeGoals:leg1.awayGoals)+(leg2.homeId===a?leg2.homeGoals:leg2.awayGoals),goalsB=(leg1.homeId===b?leg1.homeGoals:leg1.awayGoals)+(leg2.homeId===b?leg2.homeGoals:leg2.awayGoals),extraTime=false,penalties=null;
 if(goalsA===goalsB){const extra=simulateScore(championsTeamPower(secondHome),championsTeamPower(secondAway),.06,30);leg2.homeGoals+=extra[0];leg2.awayGoals+=extra[1];goalsA+=(secondHome===a?extra[0]:extra[1]);goalsB+=(secondHome===b?extra[0]:extra[1]);extraTime=true}
 let winnerId=goalsA>goalsB?a:goalsB>goalsA?b:'';if(!winnerId){const shoot=simulatePenaltyShootout(championsTeamPower(a),championsTeamPower(b));winnerId=shoot.scoreA>shoot.scoreB?a:b;penalties={a:shoot.scoreA,b:shoot.scoreB}}
 return{...tie,pathRank,status:'completed',winnerId,result:{single:false,leg1,leg2,aggregateA:goalsA,aggregateB:goalsB,extraTime,penalties}};
}
function advanceChampionsAfterLeaguePhase(){
 const c=championsState();if(c.stage!=='league'&&state.phase==='champions-knockout')return;const table=championsSortedTable().map(row=>({...row}));c.leagueTable=table;c.leagueRank=table.findIndex(row=>String(row.id)===String(USER_ID))+1;
 if(c.leagueRank>24){c.userEliminated=true;c.userExitStage='league'}c.stage='playoff';c.stageIndex=0;c.ties=championsBuildPlayoffTies(table);state.phase='champions-knockout';state.pendingEvent=null;save();render();
}
function championsAdvanceKnockoutStage(){
 const c=championsState();if(!c.ties.length)return;const stage=c.stage,results=c.ties.map(championsSimTie);c.history.push({stage,label:championsStageLabel(stage),results});const userTie=results.find(result=>[String(result.teamAId),String(result.teamBId)].includes(String(USER_ID)));if(userTie&&String(userTie.winnerId)!==String(USER_ID)){c.userEliminated=true;c.userExitStage=stage}
 if(stage==='playoff'){c.stage='round16';c.ties=championsBuildRoundOf16Ties(c.leagueTable,results)}
 else if(stage==='round16'){c.stage='quarter';c.ties=championsBuildBracketTies(results,'quarter')}
 else if(stage==='quarter'){c.stage='semi';c.ties=championsBuildBracketTies(results,'semi')}
 else if(stage==='semi'){c.stage='final';c.ties=championsBuildBracketTies(results,'final')}
 else{c.championId=String(results[0]?.winnerId||'');if(c.championId!==String(USER_ID)&&!c.userEliminated){c.userEliminated=true;c.userExitStage='final'}c.stage='completed';c.ties=[];state.phase='finished'}
 c.stageIndex+=1;save();render();
}
function championsResultText(result){
 const a=teamById(result.teamAId),b=teamById(result.teamBId),r=result.result;if(!r)return'';
 if(r.single)return `${esc(a?.name||'Squadra')} ${r.game.homeGoals}–${r.game.awayGoals} ${esc(b?.name||'Squadra')}${r.penalties?` · rigori ${r.penalties.a}–${r.penalties.b}`:r.extraTime?' · d.t.s.':''}`;
 const l1h=teamById(r.leg1.homeId),l1a=teamById(r.leg1.awayId),l2h=teamById(r.leg2.homeId),l2a=teamById(r.leg2.awayId);return `${esc(l1h?.name||'Squadra')} ${r.leg1.homeGoals}–${r.leg1.awayGoals} ${esc(l1a?.name||'Squadra')} · ${esc(l2h?.name||'Squadra')} ${r.leg2.homeGoals}–${r.leg2.awayGoals} ${esc(l2a?.name||'Squadra')} · agg. ${r.aggregateA}–${r.aggregateB}${r.penalties?` · rigori ${r.penalties.a}–${r.penalties.b}`:''}`;
}
function championsTieCard(tie){const a=teamById(tie.teamAId),b=teamById(tie.teamBId),rankMap=championsRankMap(),ra=rankMap[String(tie.teamAId)]||'',rb=rankMap[String(tie.teamBId)]||'';return `<article class="champions-tie-card ${[String(tie.teamAId),String(tie.teamBId)].includes(String(USER_ID))?'is-user':''}"><div class="champions-tie-team"><span>${ra?`${ra}ª · `:''}${esc(a?.name||'Squadra')}</span><b>${Math.round(championsTeamPower(tie.teamAId))}</b></div><div class="champions-tie-vs">${tie.single?'FINALE':'VS'}</div><div class="champions-tie-team"><span>${rb?`${rb}ª · `:''}${esc(b?.name||'Squadra')}</span><b>${Math.round(championsTeamPower(tie.teamBId))}</b></div></article>`}
function renderChampionsLeagueQualification(){if(!isChampionsCompetition())return'';return `<div class="champions-legend"><span><i class="ucl-zone top8"></i>1–8: ottavi</span><span><i class="ucl-zone playoff"></i>9–24: playoff</span><span><i class="ucl-zone out"></i>25–36: eliminate</span></div>`}
function showChampionsKnockout(){
 const c=championsState(),label=championsStageLabel(c.stage),userStatus=c.userEliminated?`La tua squadra è stata eliminata ${c.userExitStage==='league'?'nella fase campionato':`ai ${championsStageLabel(c.userExitStage).toLowerCase()}`}. Puoi continuare a simulare il torneo fino alla finale.`:`Sei ancora in corsa per la Champions League.`;
 screen.innerHTML=`<div class="champions-knockout-shell"><section class="panel champions-knockout-hero"><div class="label">🏆 Champions League · fase a eliminazione diretta</div><h2>${esc(label)}</h2><p>${esc(userStatus)}</p><div class="champions-league-rank">Fase campionato: <b>${c.leagueRank||'-'}° posto</b> · ${Number(userStanding()?.pts)||0} punti</div></section><section class="panel"><div class="champions-ties-grid">${c.ties.map(championsTieCard).join('')}</div><div class="champions-knockout-actions"><button id="simulateChampionsStage" class="btn primary" type="button">⚽ Simula ${esc(label)}</button></div></section>${c.history.slice().reverse().map(stage=>`<section class="panel champions-history"><div class="label">${esc(stage.label)}</div>${stage.results.map(result=>`<div class="champions-history-row">${championsResultText(result)}</div>`).join('')}</section>`).join('')}</div>`;
 document.getElementById('simulateChampionsStage').onclick=()=>championsAdvanceKnockoutStage();
}
function championsReachedLabel(){const c=championsState();if(c.championId===String(USER_ID))return'Campione';const map={league:'Fase campionato',playoff:'Playoff',round16:'Ottavi di finale',quarter:'Quarti di finale',semi:'Semifinali',final:'Finale'};return map[c.userExitStage]||'Champions League'}
function showChampionsFinished(){
 const c=championsState(),champion=teamById(c.championId),won=String(c.championId)===String(USER_ID),standing=userStanding()||{pts:0,w:0,d:0,l:0,gf:0,ga:0};
 screen.innerHTML=`<div class="champions-final-shell"><section class="panel champions-final-hero ${won?'is-winner':''}"><div class="label">🏆 UEFA Champions League 2026/27</div><h2>${won?'SEI CAMPIONE D’EUROPA!':'Champions League conclusa'}</h2><p>${won?`${esc(state.teamName)} ha vinto la Champions League.`:`Il trofeo va a ${esc(champion?.name||'una squadra avversaria')}.`}</p><div class="champions-final-kpis"><div><span>Fase campionato</span><b>${c.leagueRank||'-'}°</b></div><div><span>Punti</span><b>${standing.pts}</b></div><div><span>Traguardo</span><b>${esc(championsReachedLabel())}</b></div><div><span>Campione</span><b>${esc(champion?.name||'-')}</b></div></div><div class="top-actions"><button class="btn" id="exportChampionsSeason" type="button">Esporta stagione</button><button class="btn red" id="newChampionsSeason" type="button">Nuova stagione</button></div></section>${c.history.map(stage=>`<section class="panel champions-history"><div class="label">${esc(stage.label)}</div>${stage.results.map(result=>`<div class="champions-history-row">${championsResultText(result)}</div>`).join('')}</section>`).join('')}</div>`;
 const exp=document.getElementById('exportChampionsSeason');if(exp)exp.onclick=()=>exportSeason();const fresh=document.getElementById('newChampionsSeason');if(fresh)fresh.onclick=async()=>{const confirmed=await openConfirm({title:'Nuova Champions League',message:'La run attuale verrà azzerata.',confirmText:'Nuova Champions',danger:true});if(!confirmed)return;clearCurrentSaveArtifacts();state=freshState();state.competitionVariant='champions';applyCompetitionVariantData('champions');save();render()};
}
