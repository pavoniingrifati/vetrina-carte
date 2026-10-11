const fs=require('fs'),vm=require('vm');const path=require('node:path');const root=path.resolve(__dirname,'..');const {createRuntime}=require(root+'/tests/helpers/auction-runtime');
const source=fs.readFileSync(root+'/app_v302.js','utf8');const profiles=vm.runInNewContext(source.slice(source.indexOf('  const PERSONALITIES = ['),source.indexOf('  const SPECIAL_RIVAL_IDS'))+';PERSONALITIES');
const results=[];
for(const division of [3,2,1])for(const profile of profiles.filter(p=>p.id!=='user')){
 const api=createRuntime('profile-controlled'),state=api.initialize(division,false,'profile-controlled'),manager=state.managers[1];manager.profile={...profile,archetype:profile.id,id:manager.id};
 const roles={};for(const role of api.ROLE_ORDER){
  const top=api.players.filter(p=>p.role===role).sort((a,b)=>b.ovr-a.ovr||api.baseAuctionValue(b)-api.baseAuctionValue(a))[0];
  state.auction={playerId:top.id,nominatorId:'user',price:1,highBidderId:'user',activeIds:state.managers.map(m=>m.id)};
  roles[role]={player:top.name,ovr:top.ovr,reference:api.baseAuctionValue(top)*api.ROLE_BID_CORRECTION[role],limit:api.cpuLimit(manager,top),cap:api.cpuAuctionSpendingCap(manager,top),gate:api.strategicSlotInterest(manager,top)};
 }
 results.push({division,archetype:profile.id,label:profile.label,targets:profile.targets,roles});
}
const output=process.argv[2];if(output)fs.writeFileSync(output,JSON.stringify({scope:'Confronto iniziale controllato, non asta completa. Admin in C/B è ipotetico, non presente nel gioco.',rows:results},null,2)+'\n');
console.log(JSON.stringify(results.filter(r=>r.division===1).map(r=>({profile:r.archetype,A:r.roles.A.limit,capA:r.roles.A.cap,C:r.roles.C.limit,capC:r.roles.C.cap,P:r.roles.P.limit,capP:r.roles.P.cap})),null,2));
