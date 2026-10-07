'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'app_v302.js'),'utf8');
const from=src.indexOf('  const LEAGUE_RULE_DEFAULTS =');
const to=src.indexOf('  function leagueRuleCardData(',from);
assert(from>=0&&to>from);
const context={FANTASY_MAX_SUBS:3,GAME_CONFIG:{startingDivision:4},state:null,
 randomHash(value){let h=2166136261;for(const char of String(value)){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return ((h>>>0)%100000)/100000;}};
vm.createContext(context);
vm.runInContext(src.slice(from,to)+'\nthis.rulesTest={generatePreAuctionLeagueRules};',context);
const generate=context.rulesTest.generatePreAuctionLeagueRules;
for(let division=4;division>=1;division--){
 let found=false;
 for(let i=0;i<300;i++){
  const rules=generate({marketSeed:`free-role-${division}-${i}`,career:{division}});
  assert.equal(rules.selectedCategories.length,3);
  if(rules.selectedCategories.includes('freeRoleAuction')){
   assert(division<=3,'Regola estratta prima della Serie C');
   assert.equal(rules.freeRoleAuction,true);
   found=true;
  }
 }
 if(division<=3) assert(found,`Regola mai sorteggiata in divisione ${division}`);
}
const nominationStart=src.indexOf('  function nominationCallCount(');
const nominationEnd=src.indexOf('  function allRostersComplete(',nominationStart);
assert(nominationStart>0&&nominationEnd>nominationStart);
const players=new Map([['d1',{id:'d1',role:'D'}],['a1',{id:'a1',role:'A'}]]);
const pointerContext={state:{managers:[{id:'user',roster:[]},{id:'cpu1',roster:[]},{id:'cpu2',roster:[]}],availableIds:['d1','a1'],nominationCalls:{}},
 playerMap:players,ROLE_ORDER:['P','D','C','A'],currentAuctionRole:()=> 'P',openRoleAuction:()=>true,
 slotsRemaining:manager=>25-manager.roster.length,
 canOwn:(manager,player)=>manager.id==='cpu2'&&player.role==='D',maxLegalBid:()=>1};
pointerContext.managerCanNominate=manager=>manager.id==='cpu2';
vm.createContext(pointerContext);
vm.runInContext(src.slice(nominationStart,nominationEnd)+'\nthis.next=nextNominatorIndex;',pointerContext);
assert.equal(pointerContext.next(0),2,'La CPU che cerca difensori viene saltata quando la fase corrente indica portieri');
console.log('OK: regola dalla Serie C, chiamate libere e turni CPU su ruoli ancora da completare.');
