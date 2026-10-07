(() => {
  'use strict';

  function build({results={},roster=[],development={},position=10}={}){
    const members=new Map((roster||[]).map(p=>[String(p.id),p]));
    const totals=new Map();
    Object.values(results||{}).filter(Boolean).sort((a,b)=>Number(a.day||0)-Number(b.day||0)).forEach(day=>{
      const match=(day.matches||[]).find(m=>m.homeId==='user'||m.awayId==='user');
      if(!match) return;
      const performances=match.homeId==='user'?match.homePerformances:match.awayPerformances;
      (performances||[]).forEach(perf=>{
        if(!perf?.playerId || perf.noVote || !Number.isFinite(Number(perf.vote)) || !Number.isFinite(Number(perf.fantasy))) return;
        const id=String(perf.playerId);
        const row=totals.get(id)||{id,name:perf.name||members.get(id)?.name||'Giocatore',appearances:0,goals:0,assists:0,voteSum:0,fantasySum:0};
        row.appearances++;
        row.goals+=Number(perf.goals||0);
        row.assists+=Number(perf.assists||0);
        row.voteSum+=Number(perf.vote);
        row.fantasySum+=Number(perf.fantasy);
        totals.set(id,row);
      });
    });
    const rows=[...totals.values()];
    const rank=(candidates,score)=>candidates.slice().sort((a,b)=>score(b)-score(a)||b.appearances-a.appearances||a.name.localeCompare(b.name,'it'))[0]||null;
    const format=row=>row?{id:row.id,name:row.name,appearances:row.appearances,goals:row.goals,assists:row.assists,avgVote:row.voteSum/row.appearances,avgFantasy:row.fantasySum/row.appearances}:null;
    const played=rows.filter(p=>p.appearances>=5);
    const bought=played.filter(p=>members.has(p.id)&&Number.isFinite(Number(members.get(p.id).price))&&Number(members.get(p.id).price)>0);
    const best=rank(bought,p=>{
      const cost=Number(members.get(p.id).price);
      return (p.fantasySum-p.appearances*6 + p.goals*.9+p.assists*.3)/(1+cost/35);
    });
    const growth=(roster||[]).map(player=>{
      const base=Number(player.ovr??player.overall);
      const delta=Number(development?.[String(player.id)]?.delta||0);
      if(!Number.isFinite(base) || !Number.isFinite(delta)) return null;
      const end=Math.max(50,Math.min(99,base+delta));
      return {id:String(player.id),name:player.name,start:base,end,delta:end-base};
    }).filter(Boolean);
    const improved=growth.filter(p=>p.delta>0).sort((a,b)=>b.delta-a.delta||a.name.localeCompare(b.name,'it'))[0]||null;
    const declined=growth.filter(p=>p.delta<0).sort((a,b)=>a.delta-b.delta||a.name.localeCompare(b.name,'it'))[0]||null;
    return {
      position:Number(position)||10,
      scorer:format(rank(rows.filter(p=>p.goals>0),p=>p.goals)),
      assister:format(rank(rows.filter(p=>p.assists>0),p=>p.assists)),
      topVote:format(rank(played,p=>p.voteSum/p.appearances)),
      topFantasy:format(rank(played,p=>p.fantasySum/p.appearances)),
      bestPurchase:best?{...format(best),cost:Number(members.get(best.id).price)}:null,
      improved,declined
    };
  }
  window.FantaSeasonRecap=Object.freeze({build});
})();
