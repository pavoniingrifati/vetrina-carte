(() => {
  'use strict';

  function pairKey(a,b){
    return [String(a),String(b)].sort().join('|');
  }

  function scheduleCandidate(ids,dayIndex,attempt,pairCounts,lastOpp,homeCounts,randomForKey){
    const ordered=ids.slice();
    for(let i=ordered.length-1;i>0;i--){
      const j=Math.floor(randomForKey(`fantasy-shuffle|d${dayIndex}|a${attempt}|i${i}`)*(i+1));
      [ordered[i],ordered[j]]=[ordered[j],ordered[i]];
    }
    const matches=[];
    let penalty=0;
    for(let i=0;i<ordered.length;i+=2){
      const a=ordered[i],b=ordered[i+1];
      if(a==null||b==null) continue;
      const key=pairKey(a,b);
      const repeat=Number(pairCounts.get(key)||0);
      if(lastOpp.get(String(a))===String(b)||lastOpp.get(String(b))===String(a)) penalty+=10000;
      penalty+=Math.pow(repeat,4)*50;
      if(repeat>=5) penalty+=100000+(repeat-5)*100000;
      const homeA=Number(homeCounts.get(String(a))||0);
      const homeB=Number(homeCounts.get(String(b))||0);
      let home=a,away=b;
      if(homeA>homeB){home=b;away=a;}
      else if(homeA===homeB&&randomForKey(`fantasy-home|d${dayIndex}|a${attempt}|${key}`)>.5){home=b;away=a;}
      penalty+=Math.abs(Number(homeCounts.get(String(home))||0)+1-Number(homeCounts.get(String(away))||0))*5;
      matches.push({homeId:home,awayId:away,homeScore:null,awayScore:null,played:false});
    }
    return {matches,penalty};
  }

  function buildFantasySeasonSchedule(managers,totalRounds=38,existingRounds=[],randomForKey=()=>Math.random()){
    const ids=(managers||[]).map(manager=>manager.id);
    const rounds=(existingRounds||[]).map((round,index)=>({
      ...round,number:index+1,label:'STAGIONE',matches:(round.matches||[]).map(match=>({...match}))
    })).slice(0,totalRounds);
    const pairCounts=new Map(),lastOpp=new Map(),homeCounts=new Map();
    ids.forEach(id=>homeCounts.set(String(id),0));
    const register=match=>{
      const key=pairKey(match.homeId,match.awayId);
      pairCounts.set(key,Number(pairCounts.get(key)||0)+1);
      lastOpp.set(String(match.homeId),String(match.awayId));
      lastOpp.set(String(match.awayId),String(match.homeId));
      homeCounts.set(String(match.homeId),Number(homeCounts.get(String(match.homeId))||0)+1);
    };
    rounds.forEach(round=>(round.matches||[]).forEach(register));
    for(let index=rounds.length;index<totalRounds;index++){
      let best=null;
      for(let attempt=0;attempt<1000;attempt++){
        const candidate=scheduleCandidate(ids,index+1,attempt,pairCounts,lastOpp,homeCounts,randomForKey);
        if(!best||candidate.penalty<best.penalty) best=candidate;
      }
      const matches=best?.matches||[];
      rounds.push({number:index+1,label:'STAGIONE',matches});
      matches.forEach(register);
    }
    return rounds;
  }

  function freshStandings(managers){
    return (managers||[]).map((manager,index)=>({
      managerId:manager.id,seed:index,played:0,wins:0,draws:0,losses:0,
      gf:0,ga:0,points:0,fantasyPoints:0
    }));
  }

  function freshClubStandings(clubs){
    return (clubs||[]).map((club,index)=>({
      clubId:club.id,seed:index,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,points:0
    }));
  }

  function sortStandings(rows){
    return (rows||[]).slice().sort((a,b)=>{
      const gdA=Number(a.gf||0)-Number(a.ga||0);
      const gdB=Number(b.gf||0)-Number(b.ga||0);
      return Number(b.points||0)-Number(a.points||0)||gdB-gdA||Number(b.gf||0)-Number(a.gf||0)||Number(a.seed||0)-Number(b.seed||0);
    });
  }

  function applyResult(home,away,homeScore,awayScore){
    if(!home||!away) return false;
    const hs=Number(homeScore||0),as=Number(awayScore||0);
    home.played++;away.played++;
    home.gf+=hs;home.ga+=as;away.gf+=as;away.ga+=hs;
    if(hs>as){home.wins++;away.losses++;home.points+=3;}
    else if(hs<as){away.wins++;home.losses++;away.points+=3;}
    else{home.draws++;away.draws++;home.points++;away.points++;}
    return true;
  }

  function applyFantasyMatch(standings,match){
    const home=(standings||[]).find(row=>row.managerId===match.homeId);
    const away=(standings||[]).find(row=>row.managerId===match.awayId);
    if(!applyResult(home,away,match.homeScore,match.awayScore)) return false;
    home.fantasyPoints=Number(home.fantasyPoints||0)+Number(match.homeFantasy||0);
    away.fantasyPoints=Number(away.fantasyPoints||0)+Number(match.awayFantasy||0);
    return true;
  }

  function applyClubMatches(standings,matches){
    (matches||[]).forEach(match=>{
      const home=(standings||[]).find(row=>row.clubId===match.homeClub);
      const away=(standings||[]).find(row=>row.clubId===match.awayClub);
      applyResult(home,away,match.homeScore,match.awayScore);
    });
    return standings;
  }

  function normalizeStarterProbabilities(entries,slots,options={}){
    const cap=Math.max(1,Math.min(100,Number(options.cap??96)));
    const floor=Math.max(0,Math.min(cap,Number(options.floor??1)));
    const temperature=Math.max(.25,Number(options.temperature||4));
    const rows=(entries||[]).map((entry,index)=>({
      id:String(entry?.id??index),
      score:Number(entry?.score||0),
      unavailable:!!entry?.unavailable
    }));
    const result=Object.fromEntries(rows.map(row=>[row.id,0]));
    const available=rows.filter(row=>!row.unavailable);
    if(!available.length) return result;

    const target=Math.min(available.length*cap,Math.max(0,Number(slots||0))*100);
    if(target<=0) return result;
    const base=Math.min(floor,target/available.length);
    available.forEach(row=>{ result[row.id]=base; });
    let remaining=target-base*available.length;
    let open=available.slice();
    let guard=0;

    while(remaining>.0001 && open.length && guard++<20){
      const maxScore=Math.max(...open.map(row=>row.score));
      const weighted=open.map(row=>({
        row,
        weight:Math.exp(Math.max(-40,Math.min(40,(row.score-maxScore)/temperature)))
      }));
      const totalWeight=weighted.reduce((sum,item)=>sum+item.weight,0)||1;
      let distributed=0;
      const stillOpen=[];
      weighted.forEach(item=>{
        const id=item.row.id;
        const room=Math.max(0,cap-Number(result[id]||0));
        if(room<=.0001) return;
        const share=remaining*(item.weight/totalWeight);
        const add=Math.min(room,share);
        result[id]=Number(result[id]||0)+add;
        distributed+=add;
        if(room-add>.0001) stillOpen.push(item.row);
      });
      remaining-=distributed;
      if(distributed<=.0001) break;
      open=stillOpen;
    }

    // Arrotonda mantenendo il totale il più vicino possibile al target.
    const rounded={...result};
    available.forEach(row=>{ rounded[row.id]=Math.max(0,Math.min(cap,Math.round(result[row.id]))); });
    let delta=Math.round(target)-available.reduce((sum,row)=>sum+rounded[row.id],0);
    if(delta!==0){
      const order=available.slice().sort((a,b)=>delta>0?b.score-a.score:a.score-b.score);
      let safety=0;
      while(delta!==0 && safety++<1000){
        let changed=false;
        for(const row of order){
          if(delta>0 && rounded[row.id]<cap){ rounded[row.id]++; delta--; changed=true; }
          else if(delta<0 && rounded[row.id]>0){ rounded[row.id]--; delta++; changed=true; }
          if(delta===0) break;
        }
        if(!changed) break;
      }
    }
    return rounded;
  }

  function buildDoubleRoundRobin(teamIds,randomForKey=null){
    const teams=(teamIds||[]).slice();
    if(teams.length<2) return [];
    if(typeof randomForKey==='function'){
      for(let index=teams.length-1;index>0;index--){
        const pick=Math.min(index,Math.max(0,Math.floor(randomForKey(`seriea-calendar|${index}`)*(index+1))));
        [teams[index],teams[pick]]=[teams[pick],teams[index]];
      }
    }
    if(teams.length%2) teams.push(null);
    const count=teams.length,rounds=[];
    let rotation=teams.slice();
    for(let roundIndex=0;roundIndex<count-1;roundIndex++){
      const matches=[];
      for(let index=0;index<count/2;index++){
        let home=rotation[index],away=rotation[count-1-index];
        if(home&&away){
          if(roundIndex%2===1) [home,away]=[away,home];
          matches.push({homeClub:home,awayClub:away});
        }
      }
      rounds.push({number:roundIndex+1,matches});
      rotation=[rotation[0],rotation[count-1],...rotation.slice(1,count-1)];
    }
    const returnLeg=rounds.map((round,index)=>({
      number:rounds.length+index+1,
      matches:round.matches.map(match=>({homeClub:match.awayClub,awayClub:match.homeClub}))
    }));
    return rounds.concat(returnLeg);
  }

  window.FantaSeasonEngine=Object.freeze({
    buildFantasySeasonSchedule,freshStandings,freshClubStandings,sortStandings,
    applyFantasyMatch,applyClubMatches,buildDoubleRoundRobin,normalizeStarterProbabilities
  });
})();
