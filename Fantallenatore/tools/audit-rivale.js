const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..')),out=process.argv[3];
const source=fs.readFileSync(root+'/app_v302.js','utf8');
const profiles=vm.runInNewContext(source.slice(source.indexOf('  const PERSONALITIES = ['),source.indexOf('  const SPECIAL_RIVAL_IDS'))+';PERSONALITIES');
const helper=require(root+'/tests/helpers/auction-runtime'),create=helper.createRuntime;let targetId;
helper.createRuntime=seed=>{const api=create(seed),initialize=api.initialize;api.initialize=(...args)=>{const state=initialize(...args),cpu=state.managers.find(m=>m.profile.archetype==='rivale')||state.managers.find(m=>m.id!=='user'&&m.profile.archetype!=='admin');targetId=cpu.id;cpu.profile={...profiles.find(p=>p.id==='rivale'),id:cpu.id,archetype:'rivale'};return state;};return api;};
const {run}=require(root+'/tests/auction-competitive');const rows=[];
for(const division of process.argv[4]?[Number(process.argv[4])]:[3,2,1])for(const open of [false,true]){
 const r=run({division,freeRoleAuction:open,strategy:'top',seed:'audit-rivale-0'});
 const rivals=r.managers.slice(1),rival=rivals.find(m=>m.id===targetId),others=rivals.filter(m=>m.id!==targetId),rank=1+others.filter(m=>m.bestElevenOvr>rival.bestElevenOvr).length;
 const row={rivalRoster:rival.roster,division,mode:r.mode,rank,ovr:rival.bestElevenOvr,advantage:rival.bestElevenOvr-others.reduce((s,m)=>s+m.bestElevenOvr,0)/others.length,budget:rival.budget,profiles:rivals.map(m=>({profile:m.personality,ovr:m.bestElevenOvr,budget:m.budget})),metrics:r.metrics,findings:r.findings};rows.push(row);console.log(JSON.stringify(row));
}
if(out)fs.writeFileSync(out,JSON.stringify(rows,null,2)+'\n');
