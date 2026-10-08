/* Read-only overview: final fantasy results and premium season statistics. */
(() => {
 'use strict';
 const mean=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
 const number=v=>v!=null&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
 function build({season,managers,userId='user',premium=false,statFor}){
  const teams=new Map(managers.map(m=>[String(m.id),{manager:m,days:[],goals:0,conceded:0,wins:0,draws:0,losses:0}]));
  const rounds=Object.entries(season.matchdayResults||{}).sort((a,b)=>Number(a[0])-Number(b[0]));
  for(const [key,round] of rounds)for(const match of round.matches||[]){
   for(const side of ['home','away']){
    const team=teams.get(String(match[side+'Id']));if(!team)continue;
    const other=side==='home'?'away':'home',points=number(match[side+'Fantasy']);
    const goals=number(match[side+'Score']),conceded=number(match[other+'Score']);
    if(points===null||goals===null||conceded===null)continue;
    team.days.push({day:Number(round.day||key),points,goals,conceded});team.goals+=goals;team.conceded+=conceded;
    if(goals>conceded)team.wins++;else if(goals===conceded)team.draws++;else team.losses++;
   }
  }
  const rows=[...teams.values()].map(t=>({...t,average:mean(t.days.map(d=>d.points))}));
  const user=rows.find(t=>String(t.manager.id)===String(userId))||{days:[],average:null,goals:0,conceded:0,wins:0,draws:0,losses:0};
  const played=rows.filter(t=>t.days.length),leaguePoints=played.flatMap(t=>t.days.map(d=>d.points));
  const rank=user.average===null?null:1+played.filter(t=>t.average>user.average+1e-8).length;
  const goalRank=user.days.length?1+played.filter(t=>t.goals>user.goals).length:null;
  const defenseRank=user.days.length?1+played.filter(t=>t.conceded<user.conceded).length:null;
  const players=[];
  if(premium)for(const manager of managers)for(const player of manager.roster||[]){
   const stat=statFor(player.id)||{},votes=number(stat.voteCount),sum=number(stat.fantasySum);
   if(!votes||votes<1||sum===null)continue;
   const fm=sum/votes,cost=number(player.price);
   players.push({player,manager,votes,sum,fm,cost,ratio:cost>0?fm/cost:null});
  }
  const top=players.filter(x=>String(x.manager.id)===String(userId)).sort((a,b)=>b.fm-a.fm||b.votes-a.votes||String(a.player.id).localeCompare(String(b.player.id))).slice(0,5);
  const value=players.filter(x=>x.ratio!==null).sort((a,b)=>b.ratio-a.ratio||b.fm-a.fm||String(a.player.id).localeCompare(String(b.player.id))).slice(0,5);
  const roleAverage=(list,role)=>{const subset=list.filter(x=>x.player.role===role),votes=subset.reduce((s,x)=>s+x.votes,0);return votes?subset.reduce((s,x)=>s+x.sum,0)/votes:null;};
  const roles=['P','D','C','A'].map(role=>({role,user:roleAverage(players.filter(x=>String(x.manager.id)===String(userId)),role),league:roleAverage(players,role)}));
  return {user,rank,goalRank,defenseRank,leagueAverage:mean(leaguePoints),leagueGoals:mean(played.flatMap(t=>t.days.map(d=>d.goals))),userGoalAverage:mean(user.days.map(d=>d.goals)),top,value,roles,premium};
 }
 function chart(days,escape){
  if(!days.length)return '<div class="dcv-empty">Il grafico apparirà dopo la prima giornata conclusa.</div>';
  const values=days.map(d=>d.points),min=Math.floor((Math.min(...values)-5)/5)*5,max=Math.ceil((Math.max(...values)+5)/5)*5;
  const x=i=>54+(days.length===1?350:i*700/(days.length-1)),y=v=>205-(v-min)*155/(max-min);
  const f=v=>Number(v).toFixed(1),points=days.map((d,i)=>`${f(x(i))},${f(y(d.points))}`).join(' ');
  const grids=Array.from({length:5},(_,i)=>{const value=min+(max-min)*i/4;return `<line x1="54" x2="780" y1="${f(y(value))}" y2="${f(y(value))}" class="dcv-gridline"/><text x="42" y="${f(y(value)+4)}" text-anchor="end">${value.toFixed(0)}</text>`;}).join('');
  const stride=Math.max(1,Math.ceil(days.length/10));
  const dots=days.map((d,i)=>{const label=days.length<=10||i%stride===0||i===days.length-1;const best=d.points===Math.max(...values),worst=d.points===Math.min(...values)&&!best;return `<circle cx="${f(x(i))}" cy="${f(y(d.points))}" r="5" class="${best?'dcv-best':worst?'dcv-worst':'dcv-dot'}"/>${label?`<text x="${f(x(i))}" y="${f(y(d.points)-13)}" text-anchor="middle" class="dcv-point-value">${d.points.toLocaleString('it-IT')}</text><text x="${f(x(i))}" y="232" text-anchor="middle">G${d.day}</text>`:''}`;}).join('');
  return `<svg class="dcv-chart" viewBox="0 0 820 250" role="img" aria-label="${escape('Fantapunti per giornata: '+days.map(d=>'G'+d.day+' '+d.points).join('; '))}">${grids}<polyline points="${points}" class="dcv-line"/>${dots}</svg>`;
 }
 function render({ctx,managers,statFor,avatar,escape}){
  const model=build({season:ctx.season,managers,premium:ctx.dataPro,statFor}),u=model.user,fmt=(v,d=1)=>v===null?'—':v.toLocaleString('it-IT',{maximumFractionDigits:d,minimumFractionDigits:d});
  const empty='<p class="dcv-empty">Non ci sono ancora prestazioni con voto.</p>';
  const locked=label=>`<div class="dcv-lock"><span aria-hidden="true">🔒</span><strong>${label}</strong><p>Bloccato: manca FantaData Pro.</p><small>Attiva FantaData Pro nel Negozio per vedere questi dati.</small></div>`;
  const player=(x,i,mode)=>`<button type="button" class="dcv-player" data-season-player="${escape(String(x.player.id))}" aria-label="Apri scheda di ${escape(x.player.name)}"><span class="dcv-rank">${i+1}</span><span class="dcv-face">${avatar(x.player,x.player.name)}</span><span class="dcv-player-copy"><strong>${escape(x.player.name)}</strong><small>${escape(x.player.role)} · ${escape(x.manager.team||x.manager.name)} · ${x.votes} voti</small></span><span class="dcv-player-value"><b>${fmt(x.fm,2)}</b><small>FM${mode==='value'?` · ${x.cost} crediti`:''}</small>${mode==='value'?`<em>${fmt(x.ratio,2)} FM/credito</em>`:''}</span></button>`;
  const cards=[['📈','Media fantapunti',fmt(u.average)],['⚽','Gol fatti',u.days.length?`${u.goals} · ${model.goalRank}° in lega`:'—'],['🥅','Gol subiti',u.days.length?`${u.conceded} · ${model.defenseRank}° in lega`:'—'],['🏁','Bilancio partite',u.days.length?`${u.wins}V · ${u.draws}N · ${u.losses}P`:'—']];
  const best=u.days.length?Math.max(...u.days.map(d=>d.points)):null,worst=u.days.length?Math.min(...u.days.map(d=>d.points)):null;
  const roleNames={P:'Portieri',D:'Difensori',C:'Centrocampisti',A:'Attaccanti'};
  const roleHtml=model.roles.map(r=>{const delta=r.user===null||r.league===null?null:r.user-r.league;return `<div class="dcv-role"><div><span class="lineup-role-chip role-${r.role}">${r.role}</span><strong>${roleNames[r.role]}</strong><b>${fmt(r.user,2)}</b></div><div class="dcv-track"><span style="width:${Math.min(100,Math.max(0,(r.user||0)/12*100))}%" class="${delta!==null&&delta<0?'negative':'positive'}"></span>${r.league!==null?`<i style="left:${Math.min(100,Math.max(0,r.league/12*100))}%"></i>`:''}</div><small>${delta===null?'Dati insufficienti':`${delta>=0?'+':''}${fmt(delta,2)} rispetto alla media lega (${fmt(r.league,2)})`}</small></div>`;}).join('');
  return `<section class="dcv-hero"><span>RENDIMENTO DELLA TUA SQUADRA</span><h3>${model.rank===null?'La tua stagione prende forma':`Sei il <em>${model.rank}° fantallenatore</em> della tua lega per rendimento medio`}</h3><p>${escape(ctx.me.team||'La tua squadra')} · ${u.days.length} giornate concluse</p></section>
  <div class="dcv-kpis">${cards.map(([icon,label,value])=>`<article><span>${icon}</span><div><small>${label}</small><strong>${value}</strong></div></article>`).join('')}</div>
  <section class="dcv-panel dcv-trend"><header><h3>Andamento punti stagione</h3><div class="dcv-chart-summary"><span><b>${fmt(u.average)}</b> media</span><span><b class="positive">${fmt(best)}</b> migliore</span><span><b class="negative">${fmt(worst)}</b> peggiore</span></div></header>${chart(u.days,escape)}</section>
  <div class="dcv-columns"><section class="dcv-panel"><header><h3>Top 5 della tua rosa</h3><small>Fantamedia · almeno un voto</small></header>${ctx.dataPro?(model.top.map((x,i)=>player(x,i,'fm')).join('')||empty):locked('Rendimento dei giocatori')}</section>
  <section class="dcv-panel"><header><h3>Top 5 qualità/prezzo della lega</h3><small>Fantamedia divisa per costo d’acquisto</small></header>${ctx.dataPro?(model.value.map((x,i)=>player(x,i,'value')).join('')||'<p class="dcv-empty">Servono giocatori con costo d’acquisto positivo e almeno un voto.</p>'):locked('Analisi qualità/prezzo')}</section>
  <section class="dcv-panel"><header><h3>Rendimento per ruolo</h3><small>Fantamedia ponderata sui voti · riferimento media lega</small></header>${ctx.dataPro?roleHtml:locked('Analisi dei reparti')}</section>
  <section class="dcv-panel"><header><h3>La tua squadra e la tua lega</h3></header><div class="dcv-comparison"><span></span><strong>Tu</strong><strong>Media lega</strong><span>Fantapunti a partita</span><b>${fmt(u.average)}</b><b>${fmt(model.leagueAverage)}</b><span>Gol fatti a partita</span><b>${fmt(model.userGoalAverage,2)}</b><b>${fmt(model.leagueGoals,2)}</b></div></section></div>`;
 }
 window.FantaDataOverview=Object.freeze({build,render});
})();
