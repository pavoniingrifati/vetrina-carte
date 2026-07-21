/* Fantaballa Season Engine — 05-opponents-and-chaos.js
 * Rose avversarie, modalità Caos, potenza squadre e chiusura del draft.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
function buildClubRoster(clubId,excludedIds=[]){
 const excluded=new Set((excludedIds||[]).map(String));
 const pool=PLAYERS.filter(player=>String(player.club)===String(clubId)&&!excluded.has(String(player.id))).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0)||String(a.name).localeCompare(String(b.name),'it'));
 const selected=[];const used=new Set();
 [['P',2],['D',5],['C',4],['A',3]].forEach(([role,count])=>{
   pool.filter(player=>roleOf(player)===role).slice(0,count).forEach(player=>{selected.push(player);used.add(String(player.id))});
 });
 pool.filter(player=>!used.has(String(player.id))).slice(0,Math.max(0,14-selected.length)).forEach(player=>selected.push(player));
 return selected.slice(0,14).map(player=>String(player.id));
}
function clubStrength(clubId,excludedIds=[]){
 const ids=buildClubRoster(clubId,excludedIds);
 const values=ids.slice().sort((a,b)=>(Number(playerById(b)?.ovr)||0)-(Number(playerById(a)?.ovr)||0)).slice(0,11).map(id=>Number(playerById(id)?.ovr)||60);
 while(values.length<11)values.push(60);
 return Math.round(avg(values)*10)/10;
}
function currentUserPlayerIds(){return state?.draft?.roster?.map(entry=>String(entry.playerId))||[]}
function refreshOpponentClubRosters(){
 const excluded=currentUserPlayerIds(),meritTransfer=meritStoryState();if(meritTransfer.transferred&&meritTransfer.playerId&&!excluded.includes(String(meritTransfer.playerId)))excluded.push(String(meritTransfer.playerId));
 (state.teams||[]).forEach(team=>{
   if(!team||team.id===USER_ID||!team.clubId||team.externalCompetition||team.controlSwapLockedRoster)return;
   team.roster=buildClubRoster(team.clubId,excluded);
   team.strength=clubStrength(team.clubId,excluded);
 });
 ensureMeritTransferredPlayer();
}
function buildNationRoster(nation){
 const pool=PLAYERS.filter(player=>player.nation===nation).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0)||String(a.name).localeCompare(String(b.name),'it'));
 return pool.slice(0,14).map(player=>String(player.id));
}
function opponentStatusOf(team,id){
 if(!team.statuses||typeof team.statuses!=='object')team.statuses={};
 const key=String(id);
 if(!team.statuses[key])team.statuses[key]={injury:0,suspension:0};
 return team.statuses[key];
}
function opponentRosterPlayers(team){
 if(!team||team.id===USER_ID)return[];
 if(!Array.isArray(team.roster)||!team.roster.length)team.roster=team.clubId?buildClubRoster(team.clubId,currentUserPlayerIds()):buildNationRoster(team.name);
 const players=team.roster.map(id=>chaosPlayer(team,id)).filter(Boolean);
 if(team.mascot)players.push({...team.mascot,role:'A',Position:'ATT',nation:team.name,subscriber:'no',isMascot:true});
 return players;
}
function opponentAvailablePlayers(team){
 return opponentRosterPlayers(team).filter(player=>{
   const status=opponentStatusOf(team,player.id);
   return status.injury<=0&&status.suspension<=0;
 }).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0));
}

function chaosEnabled(){return state.gameMode==='chaos'}
function ensureChaosTeam(team){
 if(!team||team.id===USER_ID)return null;
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
 team.chaos.nonItalianChemZero=Boolean(team.chaos.nonItalianChemZero);
 team.chaos.sponsorChoice=['ballarini','football-manager'].includes(String(team.chaos.sponsorChoice))?String(team.chaos.sponsorChoice):'';
 team.chaos.sponsorOvrExtra=team.chaos.sponsorChoice==='ballarini'?5:0;
 team.chaos.physioInjuryMultiplier=team.chaos.sponsorChoice==='football-manager'?.5:1;
 team.chaos.equalOrBetterMidseasonPlayerId=String(team.chaos.equalOrBetterMidseasonPlayerId||'');
 team.chaos.latestDecision=team.chaos.latestDecision&&typeof team.chaos.latestDecision==='object'?team.chaos.latestDecision:null;
 team.playerOverrides=team.playerOverrides&&typeof team.playerOverrides==='object'?team.playerOverrides:{};
 return team.chaos;
}
function pushChaosEffect(team,type,value=0,rounds=1,extra={}){
 const chaos=ensureChaosTeam(team);if(!chaos)return null;
 const effect={type,value:Number(value)||0,rounds:rounds===Infinity?9999:Math.max(1,Number(rounds)||1),...extra};
 chaos.activeEffects.push(effect);return effect;
}
function chaosEffect(team,type){const chaos=ensureChaosTeam(team);return chaos?chaos.activeEffects.filter(effect=>effect.type===type):[]}
function chaosPowerBonus(team){
 const chaos=ensureChaosTeam(team);if(!chaos)return 0;
 return chaos.activeEffects.reduce((sum,effect)=>sum+(effect.type==='power'?(Number(effect.value)||0):0),0);
}
function chaosEffectRounds(text=''){
 const value=String(text).toLowerCase();
 if(value.includes('fino a fine stagione')||value.includes('per tutta la stagione')||value.includes('da ora'))return 9999;
 const match=value.match(/(?:per (?:le prossime )?|per i prossimi )(\d+) (?:giornate|partite)/);if(match)return Math.max(1,Number(match[1])||1);
 if(value.includes('prossima partita')||value.includes('prossima gara'))return 1;
 return 1;
}
function chaosPlayer(team,id){
 const base=playerById(id);if(!base)return null;
 const override=team?.playerOverrides?.[String(id)]||{};return {...base,...override,id:String(base.id)};
}
function chaosSetPlayerOvr(team,id,value){
 if(!team||!id)return null;team.playerOverrides=team.playerOverrides&&typeof team.playerOverrides==='object'?team.playerOverrides:{};
 const player=chaosPlayer(team,id);if(!player)return null;const current=Math.max(1,Number(player.ovr)||60),requested=Math.max(1,Number(value)||60),chaos=ensureChaosTeam(team),after=requested>current&&chaos?.sponsorChoice==='ballarini'?requested+5:requested;team.playerOverrides[String(id)]={...(team.playerOverrides[String(id)]||{}),ovr:after};return chaosPlayer(team,id);
}
function chaosRandomRosterPlayer(team,filterFn=null){const pool=opponentRosterPlayers(team).filter(player=>!filterFn||filterFn(player));return pool.length?pick(pool):null}
function chaosInjure(team,count=1,duration=1){
 const pool=shuffle(opponentRosterPlayers(team).filter(player=>!player.isMascot)).slice(0,Math.max(1,Number(count)||1));
 pool.forEach(player=>{const status=opponentStatusOf(team,player.id);status.injury=Math.max(status.injury,Math.max(1,Number(duration)||1));});
 if(pool.length&&ensureChaosTeam(team)?.futureInjuryZeroPoints&&state.standings?.[team.id])state.standings[team.id].pts=0;
 return pool.map(player=>player.name);
}
function chaosSuspend(team,count=1,duration=1){
 const pool=shuffle(opponentRosterPlayers(team).filter(player=>!player.isMascot)).slice(0,Math.max(1,Number(count)||1));
 pool.forEach(player=>{const status=opponentStatusOf(team,player.id);status.suspension=Math.max(status.suspension,Math.max(1,Number(duration)||1));});return pool.map(player=>player.name);
}
function chaosRegisterGeneratedPlayer(player){
 state.seasonRules.generatedEventPlayers=Array.isArray(state.seasonRules.generatedEventPlayers)?state.seasonRules.generatedEventPlayers:[];
 const copy={...player,id:String(player.id)};const index=state.seasonRules.generatedEventPlayers.findIndex(item=>String(item.id)===copy.id);
 if(index>=0)state.seasonRules.generatedEventPlayers[index]=copy;else state.seasonRules.generatedEventPlayers.push(copy);return copy;
}
function chaosReplaceWeakest(team,pool=PLAYERS,label='mercato parallelo'){
 if(!team||!Array.isArray(team.roster)||!team.roster.length)return '';
 const candidates=opponentRosterPlayers(team).filter(player=>team.roster.map(String).includes(String(player.id))&&!player.isMascot).sort((a,b)=>(Number(a.ovr)||0)-(Number(b.ovr)||0));
 const weakest=candidates[0],available=(Array.isArray(pool)?pool:[]).filter(player=>player&&player.id&&!team.roster.map(String).includes(String(player.id)));
 if(!weakest||!available.length)return '';
 const source=pick(available);const incoming=chaosRegisterGeneratedPlayer({...source,id:`chaos-${team.id}-${state.matchday}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,club:team.id,eventPlayer:true});
 const index=team.roster.findIndex(id=>String(id)===String(weakest.id));if(index>=0)team.roster[index]=String(incoming.id);
 return `${weakest.name} → ${incoming.name} (${label})`;
}
function chaosRebuildWeakest(team,count=3){
 const changes=[];for(let i=0;i<Math.max(1,Number(count)||1);i++){const change=chaosReplaceWeakest(team,PLAYERS,'rebuild');if(change)changes.push(change)}return changes;
}
function chaosNextOpponent(teamId){
 const round=state.schedule?.[state.matchday]||[],fixture=round.find(match=>String(match.home)===String(teamId)||String(match.away)===String(teamId));
 if(!fixture)return null;return teamById(String(fixture.home)===String(teamId)?fixture.away:fixture.home);
}
function chaosApplyGlobalRule(decisionId,choiceIndex){
 if(decisionId==='fantaballa-fa-video'&&choiceIndex===1){state.seasonRules.drawPoints=6;return true}
 if(decisionId==='fgci-regolamento-rossi-punti'){if(choiceIndex===0)state.seasonRules.redCardGoals=true;else state.seasonRules.pointsEqualGoals=true;return true}
 if(decisionId==='fgci-regolamento-gol-tardivi'){if(choiceIndex===0)state.seasonRules.lateGoalsDouble=true;else state.seasonRules.zeroZeroNoPoints=true;return true}
 if(decisionId==='fgci-regole-estreme'){if(choiceIndex===0)extendSeasonTo76();else activateHungerGames();return true}
 if(decisionId==='fgci-formazioni-estreme'){forceSeasonFormation(choiceIndex===0?'4-4-4':'3-3-3');return true}
 if(decisionId==='fgci-cartellini-estremi'){if(choiceIndex===0)activateYellowEqualsRed();else activatePinkCardRule();return true}
 if(decisionId==='figc-regola-gol'){activateFederationGoalRule(choiceIndex===0?'golden':'last');return true}
 if(decisionId==='figc-formula-uno-niente-pareggio'){activateFigcCompetitionRule(choiceIndex===0?'formula-one':'no-draw');return true}
 if(decisionId==='fgci-punti-gol'){activateFgciPointsRule(choiceIndex===0?'heavy-goals':'clean-sheet');return true}
 if(decisionId==='fgci-risultati-estremi'){activateFgciResultRule(choiceIndex===0?'boredom-wins':'all-in');return true}
 if(decisionId==='nuovo-video-fantaballa'){activateFantaballaVideoRule(choiceIndex===0?'reverse-points':'two-goals-to-win');return true}
 if(decisionId==='figura-pelata-misteriosa'){if(choiceIndex===0)activateExpandedLeague();else activateEliteLeague();return true}
 return false;
}
function applyChaosTeamDecision(team,decision,choiceIndex){
 const chaos=ensureChaosTeam(team),choice=decision?.choices?.[choiceIndex];if(!chaos||!choice)return '';
 const id=String(decision.id||''),text=String(choice.effect||''),lower=text.toLowerCase(),rounds=chaosEffectRounds(text);
 chaos.decisions++;chaos.seenDecisionEvents=[...new Set([...chaos.seenDecisionEvents,id])];
 if(chaosApplyGlobalRule(id,choiceIndex))return text;
 if(id==='figura-aldila'&&choiceIndex===0){chaos.formation='2-4-4';return 'ATAKARE: solo questa squadra giocherà con il 2-4-4 fino a fine stagione.'}
 if(id==='figlio-presidente'){if(choiceIndex===0)pushChaosEffect(team,'forcedLoss',1,1);else pushChaosEffect(team,'power',6,1);chaos.midseasonPickDelta=clamp(chaos.midseasonPickDelta+(choiceIndex===0?1:-1),-1,1);return text}
 if(id==='pulmino-bordello'){if(choiceIndex===0){pushChaosEffect(team,'power',1,2);pushChaosEffect(team,'power',-1,1)}else{pushChaosEffect(team,'power',10,1);chaos.midseasonPickDelta=clamp(chaos.midseasonPickDelta-1,-1,1)}return text}
 if(id==='tifoso-formazione'){if(choiceIndex===0&&state.standings?.[team.id])state.standings[team.id].pts-=1;else pushChaosEffect(team,'maxDraw',1,1);return text}
 if(id==='quelli-del-fantacalcio'){pushChaosEffect(team,choiceIndex===0?'noGoals':'baseOnly',1,choiceIndex===0?1:3);return text}
 if(id==='underdog'){if(choiceIndex===1)pushChaosEffect(team,'forcedScore',1,1,{gf:6,ga:0});else{const players=opponentRosterPlayers(team).filter(player=>Number(player.ovr)>=60&&Number(player.ovr)<=70);const best=Math.max(...opponentRosterPlayers(team).map(player=>Number(player.ovr)||60));if(players.length)chaosSetPlayerOvr(team,pick(players).id,best)}return text}
 if(id==='rapito-alieni'){
   const player=chaosRandomRosterPlayer(team);if(!player)return 'Nessun giocatore disponibile.';
   if(choiceIndex===0){chaosSetPlayerOvr(team,player.id,(Number(player.ovr)||60)+5);return `${player.name} riceve +5 OVR fino a fine stagione.`}
   chaos.equalOrBetterMidseasonPlayerId=String(player.id);return `${player.name} dovrà essere scambiato a metà stagione con un giocatore di pari o maggiore OVR.`;
 }
 if(id==='demone-durata-partite'){chaos.matchDuration=choiceIndex===0?30:120;if(choiceIndex===1)pushChaosEffect(team,'injuryRisk',1,9999,{chance:.25});return text}
 if(id==='personaggio-mantello-multiverso'){chaosReplaceWeakest(team,choiceIndex===0?CLASSIC_PLAYERS:REAL_PLAYERS,choice.label);return text}
 if(id==='generale-misterioso'){if(choiceIndex===0)return chaosReplaceNonItalianWithItalians(team);chaos.nonItalianChemZero=true;return 'I giocatori non italiani della squadra avranno 0 Intesa fino a fine stagione.'}
 if(id==='personaggio-misterioso-sosia'){if(choiceIndex===0)chaosReplaceWeakest(team,[...CLASSIC_PLAYERS,...REAL_PLAYERS],choice.label);else{const scorer=chaosRandomRosterPlayer(team);chaos.futureScorerId=String(scorer?.id||'');chaos.futureInjuryZeroPoints=Boolean(scorer)}return text}
 if(id==='personaggio-corona-spine'){if(choiceIndex===0)return reverseStandingsPoints();chaos.eventChanceMultiplier=2;return 'La probabilità di eventi per questa squadra passa dal 45% al 90% fino a fine stagione.'}
 if(id==='nuovo-sponsor'){if(choiceIndex===0){chaos.sponsorChoice='ballarini';chaos.sponsorOvrExtra=5}else{chaos.sponsorChoice='football-manager';chaos.physioInjuryMultiplier=.5}return text}
 if(id==='misterfm-fa-video'){if(choiceIndex===0)chaosRebuildWeakest(team,3);else{const player=chaosRandomRosterPlayer(team);if(player)chaosSetPlayerOvr(team,player.id,(Number(player.ovr)||60)+(Math.random()<.5?20:-20))}return text}
 if(id==='fantaballa-fa-video'&&choiceIndex===0){const attackers=opponentRosterPlayers(team).filter(player=>roleOf(player)==='A');const outgoing=attackers.sort((a,b)=>(Number(a.ovr)||0)-(Number(b.ovr)||0))[0]||chaosRandomRosterPlayer(team);if(outgoing){const maradona=chaosRegisterGeneratedPlayer({id:`chaos-maradona-${team.id}-${Date.now()}`,name:'Diego Armando Maradona',nation:'Argentina',Position:'ATT, AS, AD',role:'A',ovr:120,subscriber:'no',club:team.id,eventPlayer:true});const index=team.roster.findIndex(value=>String(value)===String(outgoing.id));if(index>=0)team.roster[index]=String(maradona.id)}if(state.standings?.[team.id])state.standings[team.id].pts=0;return text}
 if(id==='mago-do-nascimento'){if(choiceIndex===0)pushChaosEffect(team,'injuredBonus',40,9999);else{const player=chaosRandomRosterPlayer(team);if(player)chaosSetPlayerOvr(team,player.id,(Number(player.ovr)||60)+20)}return text}
 if(id==='var-misterioso'){if(choiceIndex===0)zeroFiveTeamsIncluding(team.id);else pushChaosEffect(team,'redRisk',1,2,{chance:.75});return text}
 if(id==='sessanta-sfumature'){if(choiceIndex===0){const roster=opponentRosterPlayers(team);const eligible=roster.filter(player=>{const base=Number(playerById(player.id)?.ovr??player.ovr)||0;return base>=60&&base<=65});const chosen=eligible.length?pick(eligible):null;const best=roster.filter(player=>!chosen||String(player.id)!==String(chosen.id)).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0];if(chosen){const base=Number(playerById(chosen.id)?.ovr??chosen.ovr)||60;chaosSetPlayerOvr(team,chosen.id,base*2)}if(best){team.roster=team.roster.filter(id=>String(id)!==String(best.id));delete team.playerOverrides?.[String(best.id)];delete team.statuses?.[String(best.id)];if(String(chaos.equalOrBetterMidseasonPlayerId||'')===String(best.id))chaos.equalOrBetterMidseasonPlayerId='';}}else chaos.sixtyPointFear=true;return text}
 if(id==='personaggio-capelli-bianchi'){if(choiceIndex===0){if(Math.random()<.5)opponentRosterPlayers(team).forEach(player=>chaosSetPlayerOvr(team,player.id,(Number(player.ovr)||60)+10));else chaosInjure(team,Math.max(1,team.roster.length),9999)}else{const target=chaosNextOpponent(team.id);if(target)pushChaosEffect(target,'power',10,1)}return text}
 if(id==='rissa-mascotte'&&choiceIndex===1){const targets=state.teams.filter(item=>item.id!==USER_ID&&item.id!==team.id);const target=targets.length?pick(targets):team;target.mascot={id:`chaos-mascot-${team.id}-${Date.now()}`,name:`Mascotte di ${team.name}`,ovr:99};return text}
 if(id==='drone-avversario'){const target=chaosNextOpponent(team.id);if(target){if(choiceIndex===0)pushChaosEffect(target,'power',-10,1);else chaosInjure(target,2,1)}return text}
 if(id==='aggiornamento-var'){if(choiceIndex===0)pushChaosEffect(team,'randomResult',1,1);else pushChaosEffect(team,'redRisk',1,1,{chance:.70});return text}
 if(id==='mentalista'){
   if(choiceIndex===0){
     const attacker=chaosRandomRosterPlayer(team,player=>roleOf(player)==='A');
     if(!attacker)return 'Nessun attaccante disponibile da ipnotizzare.';
     if(Math.random()<.25){chaosSetPlayerOvr(team,attacker.id,1);return `Il mentalista sbaglia: ${attacker.name} diventa un pollo da 1 OVR fino a fine stagione.`}
     pushChaosEffect(team,'power',8/11,1);return `${attacker.name} riceve +8 OVR nella prossima partita.`;
   }
   pushChaosEffect(team,'redRisk',1,1,{chance:.35});return text;
 }
 if(lower.includes('perdi sicuramente')||lower.includes('sconfitta obbligatoria'))pushChaosEffect(team,'forcedLoss',1,1);
 if(lower.includes('vittoria assicurata')||lower.includes('vinci sicuramente'))pushChaosEffect(team,'forcedWin',1,1);
 if(lower.includes('al massimo pareggiare'))pushChaosEffect(team,'maxDraw',1,1);
 if(lower.includes('non ti assegnano neanche un gol')||lower.includes('segnerà 0 gol'))pushChaosEffect(team,'noGoals',1,rounds);
 if(lower.includes('1 punto di penalizzazione')&&state.standings?.[team.id])state.standings[team.id].pts-=1;
 if(lower.includes('punti vanno a 0')&&state.standings?.[team.id])state.standings[team.id].pts=0;
 const ovrMatch=text.match(/([+-]\d+)\s*OVR/i);if(ovrMatch){let value=Number(ovrMatch[1])||0;if(lower.includes('un giocatore')||lower.includes('attaccante'))value/=11;pushChaosEffect(team,'power',value,rounds)}
 const chemMatch=text.match(/([+-]\d+)\s*Intesa/i);if(chemMatch)pushChaosEffect(team,'power',(Number(chemMatch[1])||0)/5,rounds);
 if(lower.includes('×2 intesa')||lower.includes('intesa viene moltiplicata'))pushChaosEffect(team,'power',3,rounds);
 if(lower.includes('un giocatore casuale si infortuna')||lower.includes('un giocatore casuale subisce'))chaosInjure(team,1,1);
 if(lower.includes('2 giocatori')&&lower.includes('infortun'))chaosInjure(team,2,1);
 if(lower.includes('tutti gli abbonati sono infortunati')){const ids=opponentRosterPlayers(team).filter(isSubscriber).map(player=>player.id);ids.forEach(id=>opponentStatusOf(team,id).injury=1)}
 if(lower.includes('rischio di infortunio')||lower.includes('aumentano infortuni'))pushChaosEffect(team,'injuryRisk',1,rounds,{chance:.35});
 if(lower.includes('espulsione')||lower.includes('cartellino rosso'))pushChaosEffect(team,'redRisk',1,rounds,{chance:.25});
 if(lower.includes('1 scelta in più'))chaos.midseasonPickDelta=clamp(chaos.midseasonPickDelta+1,-1,1);
 if(lower.includes('1 scelta in meno'))chaos.midseasonPickDelta=clamp(chaos.midseasonPickDelta-1,-1,1);
 return text;
}
function applyChaosAutoEvent(team,event){
 const title=String(event?.title||'Evento casuale');let result='';
 if(title==='Problema muscolare')result=`${chaosInjure(team,1,2).join(', ')}: infortunio di 2 giornate`;
 else if(title==='Contusione')result=`${chaosInjure(team,1,1).join(', ')}: contusione`;
 else if(title==='Settimana perfetta'){pushChaosEffect(team,'power',1,1);result='+5 Intesa nella prossima partita'}
 else if(title==='Sostegno degli abbonati'){pushChaosEffect(team,'power',.6,2);result='+3 Intesa agli abbonati per 2 giornate'}
 else{pushChaosEffect(team,'redRisk',1,1,{chance:.2});result='rischio squalifica aumentato'}
 return result;
}
function prepareChaosOpponentEvents(){
 if(!chaosEnabled()||state.phase!=='season')return;
 state.chaos=state.chaos&&typeof state.chaos==='object'?state.chaos:{};
 if(Number(state.chaos.lastPreparedMatchday)===Number(state.matchday))return;
 const reports=[];let decisions=0,automatic=0,normal=0;
 state.teams.filter(team=>team.id!==USER_ID&&!isTeamEliminated(team.id)).forEach(team=>{
   const chaos=ensureChaosTeam(team),multiplier=clamp(Number(chaos?.eventChanceMultiplier)||1,1,2),normalChance=Math.max(0,1-(.45*multiplier)),autoLimit=normalChance+(.10*multiplier),roll=Math.random();
   if(roll<normalChance){normal++;return}
   if(roll<autoLimit){const event=pick(AUTO_EVENTS),result=applyChaosAutoEvent(team,event);automatic++;reports.push({kind:'auto',teamId:team.id,teamName:team.name,title:event.title,choice:'Evento automatico',effect:result});return}
   const beforeMidseasonOnly=new Set(['pulmino-bordello','figlio-presidente','whatsapp-pubblicato','rissa-mascotte','rapito-alieni','figura-aldila','figura-misteriosa-tattico-fantaguru','figlio-del-mister']);
   let available=DECISIONS.filter(decision=>!decision.chainOnly&&!decision.questEvent&&!decision.userOnly&&!chaos.seenDecisionEvents.includes(String(decision.id))&&(state.matchday<19||!beforeMidseasonOnly.has(String(decision.id))));
   if(!available.length){chaos.seenDecisionEvents=[];available=DECISIONS.filter(decision=>!decision.chainOnly&&!decision.questEvent&&!decision.userOnly&&(state.matchday<19||!beforeMidseasonOnly.has(String(decision.id))))}
   const decision=pick(available),choiceIndex=Math.floor(Math.random()*decision.choices.length),choice=decision.choices[choiceIndex],effect=applyChaosTeamDecision(team,decision,choiceIndex);
   decisions++;const title=typeof decision.title==='string'?decision.title:String(decision.id).replaceAll('-',' ');const report={kind:'decision',teamId:team.id,teamName:team.name,title,choice:choice.label,effect:effect||choice.effect};chaos.latestDecision=report;reports.push(report);
 });
 state.chaos.lastPreparedMatchday=Number(state.matchday);state.chaos.totalDecisions=Math.max(0,Number(state.chaos.totalDecisions)||0)+decisions;
 state.chaos.currentRound={matchday:state.matchday+1,decisions,automatic,normal,total:decisions+automatic+normal};state.chaos.latest=reports.slice(-12);
}
function renderChaosLeagueFeed(){
 if(!chaosEnabled())return '';
 const current=state.chaos?.currentRound||{},reports=Array.isArray(state.chaos?.latest)?state.chaos.latest:[];
 const rows=reports.filter(report=>report.kind==='decision').slice(-6).reverse();
 return `<div class="chaos-feed"><div class="chaos-feed-head"><b>🌀 Modalità Caos</b><span>Giornata ${Number(current.matchday)||state.matchday+1}</span></div><div class="chaos-feed-summary">Le ${Math.max(0,state.teams.filter(team=>team.id!==USER_ID&&!isTeamEliminated(team.id)).length)} avversarie hanno gestito i propri eventi: ${Number(current.decisions)||0} decisioni, ${Number(current.automatic)||0} eventi automatici e ${Number(current.normal)||0} settimane normali.</div><div class="chaos-feed-list">${rows.length?rows.map(report=>`<div class="chaos-feed-row"><b>${esc(report.teamName)}</b><span>${esc(report.title)} — <strong>${esc(report.choice)}</strong></span></div>`).join(''):'<div class="chaos-feed-row"><b>Nessuna scelta</b><span>In questa giornata alle avversarie sono capitati soltanto eventi automatici o settimane normali.</span></div>'}</div></div>`;
}
function chaosTeamMatchRules(team){
 const chaos=ensureChaosTeam(team),has=type=>chaos?.activeEffects.some(effect=>effect.type===type),find=type=>chaos?.activeEffects.find(effect=>effect.type===type)||null;
 return {forcedLoss:has('forcedLoss'),forcedWin:has('forcedWin'),maxDraw:has('maxDraw'),noGoals:has('noGoals'),randomResult:has('randomResult'),forcedScore:find('forcedScore'),futureScorer:Boolean(chaos?.futureScorerId)};
}
function applyChaosScoreRules(homeTeam,awayTeam,homeScore,awayScore){
 let home=Math.max(0,Number(homeScore)||0),away=Math.max(0,Number(awayScore)||0);const hr=chaosTeamMatchRules(homeTeam),ar=chaosTeamMatchRules(awayTeam);
 if(hr.randomResult||ar.randomResult){home=Math.floor(Math.random()*6);away=Math.floor(Math.random()*6)}
 if(hr.futureScorer)home=Math.max(1,home);if(ar.futureScorer)away=Math.max(1,away);if(hr.noGoals)home=0;if(ar.noGoals)away=0;
 if(hr.forcedScore){home=Math.max(0,Number(hr.forcedScore.gf)||6);away=Math.max(0,Number(hr.forcedScore.ga)||0)}
 if(ar.forcedScore){away=Math.max(0,Number(ar.forcedScore.gf)||6);home=Math.max(0,Number(ar.forcedScore.ga)||0)}
 if(hr.forcedWin&&home<=away)home=away+1;if(ar.forcedWin&&away<=home)away=home+1;
 if(hr.forcedLoss&&home>=away)away=home+1;if(ar.forcedLoss&&away>=home)home=away+1;
 if(hr.maxDraw&&home>away)home=away;if(ar.maxDraw&&away>home)away=home;
 return [home,away];
}
function applyChaosOpponentToUserScore(opponent,goalsFor,goalsAgainst){
 const rules=chaosTeamMatchRules(opponent);let gf=Math.max(0,Number(goalsFor)||0),ga=Math.max(0,Number(goalsAgainst)||0);
 if(rules.randomResult){gf=Math.floor(Math.random()*6);ga=Math.floor(Math.random()*6)}
 if(rules.futureScorer)ga=Math.max(1,ga);if(rules.noGoals)ga=0;
 if(rules.forcedScore){ga=Math.max(0,Number(rules.forcedScore.gf)||6);gf=Math.max(0,Number(rules.forcedScore.ga)||0)}
 if(rules.forcedWin&&ga<=gf)ga=gf+1;if(rules.forcedLoss&&ga>=gf)gf=ga+1;if(rules.maxDraw&&ga>gf)ga=gf;
 return [gf,ga];
}
function tickChaosOpponentEffects(){
 if(!chaosEnabled())return;
 state.teams.filter(team=>team.id!==USER_ID).forEach(team=>{const chaos=ensureChaosTeam(team);if(!chaos)return;
   const injuryRisks=chaos.activeEffects.filter(effect=>effect.type==='injuryRisk');injuryRisks.forEach(effect=>{const multiplier=chaos.sponsorChoice==='football-manager'?Math.max(.1,Number(chaos.physioInjuryMultiplier)||.5):1;if(Math.random()<clamp((Number(effect.chance)||.25)*multiplier,0,1))chaosInjure(team,1,1)});
   const redRisks=chaos.activeEffects.filter(effect=>effect.type==='redRisk');redRisks.forEach(effect=>{if(Math.random()<(Number(effect.chance)||.2))chaosSuspend(team,1,1)});
   chaos.activeEffects.forEach(effect=>effect.rounds--);chaos.activeEffects=chaos.activeEffects.filter(effect=>effect.rounds>0);
   if(chaos.sixtyPointFear&&Number(state.standings?.[team.id]?.pts)===60)state.standings[team.id].pts=0;
 });
}
function runChaosOpponentMidseason(){
 if(!chaosEnabled()||state.chaos?.midseasonDone)return;const reports=[];
 state.teams.filter(team=>team.id!==USER_ID&&!isTeamEliminated(team.id)).forEach(team=>{
   const chaos=ensureChaosTeam(team),count=clamp(2+(Number(chaos.midseasonPickDelta)||0),1,3),changes=[];
   const requiredId=String(chaos.equalOrBetterMidseasonPlayerId||''),outgoing=requiredId?chaosPlayer(team,requiredId):null;
   if(outgoing&&team.roster.map(String).includes(requiredId)){
     const used=new Set(team.roster.map(String)),threshold=Number(outgoing.ovr)||60,macro=roleOf(outgoing);
     let pool=PLAYERS.filter(player=>player&&player.id&&!used.has(String(player.id))&&roleOf(player)===macro&&(Number(player.ovr)||0)>=threshold);
     if(!pool.length){const fallback=PLAYERS.filter(player=>player&&player.id&&!used.has(String(player.id))&&roleOf(player)===macro).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0))[0];if(fallback)pool=[chaosRegisterGeneratedPlayer({...fallback,id:`chaos-alien-market-${team.id}-${Date.now()}`,club:team.id,ovr:threshold,eventPlayer:true})]}
     if(pool.length){const incoming=pick(pool),index=team.roster.findIndex(id=>String(id)===requiredId);if(index>=0)team.roster[index]=String(incoming.id);changes.push(`${outgoing.name} → ${incoming.name} (${Number(incoming.ovr)||threshold} OVR, pari o superiore)`);delete team.playerOverrides?.[requiredId];delete team.statuses?.[requiredId];}
     chaos.equalOrBetterMidseasonPlayerId='';
   }
   const remaining=Math.max(0,count-changes.length);if(remaining)changes.push(...chaosRebuildWeakest(team,remaining));
   if(changes.length)reports.push({kind:'decision',teamId:team.id,teamName:team.name,title:'Mercato di metà stagione',choice:`${changes.length} cambi automatici`,effect:changes.join(' · ')});
 });
 state.chaos.midseasonDone=true;if(reports.length)state.chaos.latest=reports.slice(-12);
}

function opponentMatchPower(team){
 if(!team||team.id===USER_ID)return matchPower();
 const lineup=teamMatchLineup(team),target=Math.max(1,activeAiMatchSlots(team).length);
 const values=lineup.map(entry=>isEmergencyYouthEntry(entry)?50:(Number(entry?.player?.ovr)||50));
 while(values.length<target)values.push(50);
 const chaos=ensureChaosTeam(team),nonItalianShare=lineup.length?lineup.filter(entry=>entry?.player&&!isItalianPlayer(entry.player)).length/lineup.length:0;
 const closedPortsPenalty=chaos?.nonItalianChemZero?nonItalianShare*4:0;
 return avg(values)+chaosPowerBonus(team)-closedPortsPenalty;
}
function nationalStrength(nation){
 const ids=buildNationRoster(nation);
 const values=ids.slice(0,11).map(id=>Number(playerById(id)?.ovr)||60);
 return Math.round(avg(values)*10)/10;
}
function buildFullyRandomDraftRoster(){
 const slots=formationSlots();
 const used=new Set();
 const starters=[];
 const orderedSlots=slots.map((slot,index)=>({slot,index,count:PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player)&&userCompatible(player,slot.code)).length})).sort((a,b)=>a.count-b.count||a.index-b.index);
 for(const item of orderedSlots){
   const candidates=shuffle(PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id))&&userCompatible(player,item.slot.code)));
   const player=coachHighOvrPick(candidates);
   if(!player)return false;
   used.add(String(player.id));
   starters[item.index]={playerId:String(player.id),slotId:item.slot.instanceId,slot:item.slot.code,bench:false,player:{...player}};
 }
 const benchPlayers=coachHighOvrSample(PLAYERS.filter(player=>youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id))),3);
 if(benchPlayers.length<3)return false;
 state.draft=freshState().draft;
 state.draft.rerolls=initialDraftRerollLimit();
 state.draft.roster=[
   ...starters,
   ...benchPlayers.map((player,index)=>({playerId:String(player.id),slotId:`bench-${index+1}`,slot:`PAN${index+1}`,bench:true,player:{...player}}))
 ];
 state.draft.clubId='';
 state.draft.candidates=[];
 state.draft.pendingPlayerId='';
 return true;
}
function startFullyRandomDraft(){
 if(coachIs('three-five-two')){
   const possible=draftPossibleClubs(),clubId=possible.length?pick(possible):'';
   if(!clubId||!buildThreeFiveTwoOpeningRoster(clubId))return toast('Non ci sono abbastanza giocatori per creare la rosa del 3-5-2.');
   const club=clubById(clubId);
   finalizeDraft();
   toast(`3-5-2: rosa automatica generata dal primo club ${club?.name||clubId}. Il campionato è iniziato.`);
   return;
 }
 if(!buildFullyRandomDraftRoster())return toast('Non ci sono abbastanza giocatori per creare una rosa casuale.');
 finalizeDraft();
 toast('Rosa casuale con ruoli corretti generata: il campionato è iniziato.');
}
function finalizeDraft(){
 if(!draftComplete())return toast('Completa 11 titolari e 3 riserve.');
 state.draft.pendingPlayerId='';
 const userClub=activeUserClub();
 state.userClubId=userClub.id;
 state.teamName=String(state.teamName||userClub.name).trim()||userClub.name;
 if(coachIs('three-five-two'))state.formation='3-5-2';
 state.seasonRules.leagueFormation=state.formation;
 state.seasonRules.userFormationOverride=coachIs('three-five-two')?'3-5-2':'';
 const draftedIds=currentUserPlayerIds();
 setAchievementCareerFlag('initialRosterIds',draftedIds.map(String));
 const opponents=shuffle(CLUBS.filter(club=>club.id!==userClub.id)).slice(0,19);
 state.leagueClubIds=opponents.map(club=>String(club.id));
 state.teams=[{
   id:USER_ID,
   clubId:userClub.id,
   name:state.teamName,
   shortName:userClub.shortName,
   colors:userClub.colorClub,
   strength:teamPowerBase()
 }].concat(opponents.map(club=>({
   id:club.id,
   clubId:club.id,
   name:club.name,
   shortName:club.shortName,
   colors:club.colorClub,
   strength:clubStrength(club.id,draftedIds),
   roster:buildClubRoster(club.id,draftedIds),
   statuses:{},
   mascot:null,
   playerOverrides:{},
   chaos:{activeEffects:[],seenDecisionEvents:[],decisions:0,midseasonPickDelta:0,matchDuration:90,futureScorerId:'',futureInjuryZeroPoints:false,sixtyPointFear:false,eventChanceMultiplier:1,nonItalianChemZero:false,formation:'',latestDecision:null}
 })));
 state.chaos={lastPreparedMatchday:-1,totalDecisions:0,currentRound:null,latest:[],midseasonDone:false};
 state.cup=freshState().cup;
 initializeStoryArc();
 state.schedule=generateSchedule(state.teams.map(team=>team.id));
 state.standings={};
 state.teams.forEach(team=>state.standings[team.id]={id:team.id,name:team.name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});
 resetSeasonAnalytics();
 state.phase='season';
 state.matchday=0;
 state.pendingEvent=null;
 state.draft.candidates=[];
 save();
 prepareEvent();
 render()
}
