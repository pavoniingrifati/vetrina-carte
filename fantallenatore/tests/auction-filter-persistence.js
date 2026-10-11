'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const window={},document={createElement:()=>({}),querySelectorAll:()=>[]};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/domains/auction-views.js'),'utf8'),{window,document});
const noop=()=>{},node=()=>({value:'',classList:{add:noop,remove:noop,toggle:noop}});
const nodes=Object.fromEntries(['playerSearch','roleFilter','turnLabel','playerSearchArea','cpuThinking','cpuThinkingText','liveAuction','nominationBox','playerResults'].map(id=>[id,node()]));
nodes.sortFilter={value:'recommended',options:[{value:'recommended'},{value:'ovr'},{value:'potential'},{value:'starter'}]};
let free=false,role='P';
const runtime={state:{managers:[{id:'user'},{id:'cpu',team:'Rivale'}],nominationIndex:0,currentRoleIndex:0,availableIds:[],auctionPowers:{selected:['observer']}},$:id=>nodes[id],
 openRoleAuction:()=>free,allRostersComplete:()=>false,advanceRolePhaseIfNeeded:noop,currentAuctionRole:()=>role,ROLE_ORDER:['P','D','C','A'],ROLE_LABELS:{P:'Portiere',D:'Difensore'},ROLE_PLURALS:{P:'Portieri',D:'Difensori'},playerMap:new Map(),baseAuctionValue:()=>0};
const api=window.FantaDomains['auction-views'].create(runtime);
for(const freeMode of [false,true]){
 free=freeMode;role='P';runtime.state.currentRoleIndex=0;
 for(const selected of ['ovr','potential','starter','recommended']){
  nodes.sortFilter.value=selected;nodes.playerSearch.value='Mario';
  runtime.state.availableIds=['first'];runtime.state.nominationIndex=0;api.renderTurn();
  runtime.state.nominationIndex=1;api.renderTurn();
  runtime.state.availableIds=[];runtime.state.nominationIndex=0;api.renderTurn();
  assert.equal(nodes.sortFilter.value,selected);assert.equal(nodes.playerSearch.value,'Mario');
  role='D';runtime.state.currentRoleIndex=1;api.renderTurn();assert.equal(nodes.sortFilter.value,selected);
 }
}
console.log('OK: ordinamento e ricerca conservati dopo turno CPU, acquisto e cambio reparto, in asta libera e a reparti.');
