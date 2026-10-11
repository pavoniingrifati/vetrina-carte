'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRuntime}=require('./helpers/auction-runtime');
const args=process.argv.slice(2);
function option(name,fallback){const index=args.indexOf(name);return index<0?fallback:args[index+1];}
const seeds=Number(option('--seeds','1'));
assert(Number.isInteger(seeds)&&seeds>=1&&seeds<=100,'--seeds deve essere tra 1 e 100');
const output=option('--report',null),strict=args.includes('--strict');
const strategies=['equilibrata','top','attendista'];
const labels={4:'Amatori',3:'Serie C',2:'Serie B',1:'Serie A'};
const mean=xs=>xs.length?xs.reduce((s,n)=>s+n,0)/xs.length:0;
const rounded=n=>Math.round(n*100)/100;
function reference(api,p){return api.baseAuctionValue(p)*api.ROLE_BID_CORRECTION[p.role];}
function userLimit(api,p,strategy){
  const m=api.state.managers[0],legal=api.maxLegalBid(m,p);
  if(!legal)return 0;
  const phase=1-api.state.managers.reduce((s,m)=>s+api.roleSlotsRemaining(m,p.role),0)/(api.ROLE_LIMITS[p.role]*10);
  const rank=api.playerMap.get(p.id)._auditRoleRank;
  const top=rank<10;
  const multiplier=strategy==='top'?(top?1.65:.75):strategy==='attendista'?(phase<.65?.45:1.05):1.1;
  const spent=m.roster.filter(x=>x.role===p.role).reduce((s,x)=>s+x.price,0);
  const roleRoom=api.MARKET_ROLE_TARGET[p.role]-spent;
  const plannedCap=strategy==='equilibrata'?Math.max(1,roleRoom-(api.roleSlotsRemaining(m,p.role)-1)):legal;
  return Math.max(1,Math.min(legal,plannedCap,Math.round(reference(api,p)*multiplier)));
}
function userNomination(api,strategy){
  const m=api.state.managers[0];
  let candidates=api.state.availableIds.map(id=>api.playerMap.get(id)).filter(p=>api.canOwn(m,p));
  if(!api.state.freeRoleAuction)candidates=candidates.filter(p=>p.role===api.ROLE_ORDER[api.state.currentRoleIndex]);
  if(strategy==='attendista')return candidates.sort((a,b)=>reference(api,a)-reference(api,b)||a.id.localeCompare(b.id))[0];
  return candidates.sort((a,b)=>b.ovr-a.ovr||reference(api,b)-reference(api,a)||a.id.localeCompare(b.id))[0];
}
function bestEleven(api,manager){
  const shapes=[{P:1,D:4,C:3,A:3},{P:1,D:3,C:4,A:3},{P:1,D:3,C:5,A:2},{P:1,D:4,C:4,A:2},{P:1,D:5,C:3,A:2},{P:1,D:4,C:5,A:1}];
  return Math.max(...shapes.map(shape=>Object.entries(shape).reduce((sum,[role,count])=>sum+manager.roster.filter(p=>p.role===role).sort((a,b)=>b.ovr-a.ovr).slice(0,count).reduce((s,p)=>s+p.ovr,0),0)/11));
}
function run({division,freeRoleAuction,strategy,seed}){
  const api=createRuntime(seed),state=api.initialize(division,freeRoleAuction,seed);
  for(const role of api.ROLE_ORDER)api.players.filter(p=>p.role===role).sort((a,b)=>b.ovr-a.ovr||reference(api,b)-reference(api,a)||a.id.localeCompare(b.id)).forEach((p,i)=>p._auditRoleRank=i);
  const awards=[];
  let from=-1;
  while(state.stats.purchases<250){
    assert(awards.length<250,'Asta non termina');
    while(!freeRoleAuction&&state.managers.every(m=>api.roleSlotsRemaining(m,api.ROLE_ORDER[state.currentRoleIndex])===0))state.currentRoleIndex++;
    assert(freeRoleAuction||state.currentRoleIndex<4,'Reparti esauriti prima delle 250 assegnazioni');
    const idx=api.nextNominatorIndex(from),caller=state.managers[idx];state.nominationIndex=idx;
    const p=caller.id==='user'?userNomination(api,strategy):api.chooseNomination(caller);
    assert(p,`Chiamante senza giocatori: ${caller.id}`);
    const active=state.managers.filter(m=>api.canOwn(m,p)&&api.maxLegalBid(m,p)>=1);
    const rolePhase=1-state.managers.reduce((s,m)=>s+api.roleSlotsRemaining(m,p.role),0)/(api.ROLE_LIMITS[p.role]*10);
    const eligible=active.filter(m=>m.id!=='user').length;
    state.auction={playerId:p.id,nominatorId:caller.id,price:1,highBidderId:caller.id,activeIds:active.map(m=>m.id),bidCount:0};
    api.registerNominationCall(caller.id,p.role);
    const interested=active.filter(m=>m.id!=='user'&&api.cpuLimit(m,p)>1).length;
    const bidders=new Set();let turn=idx,quiet=0,iterations=0;
    // Sequential legal reactions until no participant can raise. No timer/UI simulation.
    // User PASS removes the user for the current call, as in the real UI.
    let userPassed=false;
    while(quiet<10){
      assert(++iterations<10000,'Rilanci non terminano');turn=(turn+1)%10;
      const m=state.managers[turn],a=state.auction;
      if(!active.includes(m)||m.id===a.highBidderId||(m.id==='user'&&userPassed)){quiet++;continue;}
      const limit=m.id==='user'?userLimit(api,p,strategy):api.cpuLimit(m,p);
      if(limit<=a.price){if(m.id==='user'){userPassed=true;a.activeIds=a.activeIds.filter(id=>id!=='user');}quiet++;continue;}
      const increment=m.id==='user'?1:Math.min(api.jumpSize(m,a.price,limit,p),limit-a.price);
      a.price=Math.min(limit,a.price+Math.max(1,increment));a.highBidderId=m.id;a.bidCount++;bidders.add(m.id);quiet=0;
    }
    const a=state.auction,result=api.award(p,a.highBidderId,a.price);
    assert(result.ok,`Assegnazione illegale: ${result.reason}`);
    awards.push({number:awards.length+1,playerId:p.id,name:p.name,role:p.role,ovr:p.ovr,top10:p._auditRoleRank<10,reference:rounded(reference(api,p)),price:a.price,winner:a.highBidderId,caller:caller.id,phase:rounded(rolePhase),eligibleCpus:eligible,interestedCpus:interested,cpuBidders:[...bidders].filter(id=>id!=='user').length,bids:a.bidCount});
    for(const m of state.managers){assert(m.budget>=api.slotsRemaining(m),'Riserva minima violata');assert.equal(m.budget+m.roster.reduce((s,p)=>s+p.price,0),500,'Contabilità incoerente');}
    from=idx;
  }
  const managers=state.managers.map(m=>{
    assert.equal(m.roster.length,25);
    for(const [role,count] of Object.entries(api.ROLE_LIMITS))assert.equal(m.roster.filter(p=>p.role===role).length,count);
    return {id:m.id,personality:m.profile.archetype,budget:m.budget,averageOvr:rounded(mean(m.roster.map(p=>p.ovr))),bestElevenOvr:rounded(bestEleven(api,m)),top10:m.roster.filter(p=>api.playerMap.get(p.id)._auditRoleRank<10).length,roster:m.roster};
  });
  assert.equal(new Set(managers.flatMap(m=>m.roster.map(p=>p.id))).size,250);
  const tops=awards.filter(a=>a.top10),user=managers[0],cpus=managers.slice(1);
  assert(tops.length>0&&tops.length<=40,'Identificazione dei top per ruolo non valida');
  assert.equal(managers.reduce((s,m)=>s+m.top10,0),tops.length,'Top nelle rose diversi dalle assegnazioni');
  assert(awards.every(a=>Number.isFinite(a.reference)&&a.reference>0&&Number.isFinite(a.phase)),'Misure non valide');
  const cheap=tops.filter(a=>a.winner==='user'&&a.price<=a.reference*.25);
  const metrics={cpuResidual:rounded(mean(cpus.map(m=>m.budget))),userResidual:user.budget,userTop10:user.top10,top10Sold:tops.length,topPriceRatio:rounded(mean(tops.map(a=>a.price/a.reference))),cheapUserTop10:cheap.length,lateCheapUserTop10:cheap.filter(a=>a.phase>=.6).length,userElevenOvr:user.bestElevenOvr,cpuElevenOvr:rounded(mean(cpus.map(m=>m.bestElevenOvr))),userAdvantage:rounded(user.bestElevenOvr-mean(cpus.map(m=>m.bestElevenOvr))),uncontestedTop10:tops.filter(a=>a.eligibleCpus>=2&&a.interestedCpus===0).length};
  // Explicit audit criteria, fixed before collecting the baseline. These are design
  // targets, not claims that every legitimate lucky auction is a game bug.
  const findings=[];
  if(division<=2&&metrics.lateCheapUserTop10>=2)findings.push('Almeno 2 top10 per ruolo presi tardi dall’utente a <=25% del riferimento');
  if(division<=2&&metrics.userTop10>=20)findings.push('L’utente concentra almeno metà dei 40 top10 per ruolo');
  if(division<=2&&metrics.cpuResidual>=100)findings.push('Le CPU lasciano mediamente almeno 100/500 crediti inutilizzati');
  return {division,label:labels[division],mode:freeRoleAuction?'libera':'reparti',strategy,seed,metrics,findings,managers,awards};
}
if(require.main===module){
const runs=[];
for(const division of [4,3,2,1])for(const freeRoleAuction of division===4?[false]:[false,true])for(const strategy of strategies)for(let i=0;i<seeds;i++){
  const r=run({division,freeRoleAuction,strategy,seed:`audit-asta-${i}`});runs.push(r);
  console.log(`${r.label.padEnd(7)} ${r.mode.padEnd(7)} ${strategy.padEnd(11)} seed ${i}: CPU residui ${r.metrics.cpuResidual}, top utente ${r.metrics.userTop10}, top tardivi economici ${r.metrics.lateCheapUserTop10}, OVR11 ${r.metrics.userAdvantage>=0?'+':''}${r.metrics.userAdvantage}${r.findings.length?' [ATTENZIONE]':''}`);
}
const report={schemaVersion:1,build:require('node:fs').readFileSync(path.join(__dirname,'../js/game-rules.js'),'utf8').match(/buildVersion: '([^']+)'/)[1],createdAt:new Date().toISOString(),seedCount:seeds,scope:'250 acquisti, decisioni CPU e turni reali; regolamento base, listone iniziale, nessun evento/potere/sponsor. Risoluzione senza timer, click o rapporti dinamici. OVR11 è un indicatore di qualità, non una previsione di vittoria.',criteria:{lateCheapUserTop10:'B/A: almeno 2 top10 per ruolo dopo il 60% degli slot, prezzo <=25% del riferimento',userTop10:'B/A: almeno 20 dei 40 top10 per ruolo',cpuResidual:'B/A: residuo medio CPU >=100 crediti'},runs};
if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
const flagged=runs.filter(r=>r.findings.length);
console.log(`\nIntegrità: ${runs.length} aste complete, ${runs.length*250} acquisti validi. Bilanciamento: ${flagged.length} scenari oltre le soglie di attenzione.`);
if(strict&&flagged.length)process.exitCode=2;
}
module.exports={run};
