'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
class Host{
 set innerHTML(html){this.html=html;this.controls={};for(const attr of ['wrt-sort','wrt-role','winter-release-player'])this.controls[attr]=Array.from(html.matchAll(new RegExp('data-'+attr+'="([^"]*)"','g')),m=>({dataset:{[attr.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:m[1]},addEventListener(type,fn){this[type]=fn;}}));this.input={selectionStart:2,focus(){},setSelectionRange(){},addEventListener(type,fn){this[type]=fn;}};}
 get innerHTML(){return this.html;}
 querySelectorAll(selector){return this.controls[selector.slice(6,-1)]||[];}
 querySelector(){return this.input;}
}
const body=new Host(),nodes={winterReleaseList:body};for(const id of ['winterReleaseBudget','winterReleaseCount','winterReleaseRefund','winterReleaseSlots','winterGuaranteedSaleHint'])nodes[id]={};
const window={},document={querySelectorAll:selector=>body.querySelectorAll(selector)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/domains/career-market-controller.js'),'utf8'),{window,document,console});
const roster=[{id:'p1',name:'Alfa',role:'P',club:'A',ovr:90,quotation:17,price:40},{id:'p2',name:'Beta',role:'A',club:'B',ovr:85,quotation:7,price:25},{id:'p3',name:'Gamma',role:'D',club:'A',ovr:80,quotation:0,price:5}],flow={stage:'releases',userReleaseIds:[]},me={roster,budget:100};
let pro=false,scout=false,guaranteed=null;
const runtime={state:{winterMarketFlow:flow,season:{}},ROLE_ORDER:['P','D','C','A'],TOTAL_SLOTS:25,$:id=>nodes[id],ensureWinterMarketFlow:()=>flow,processCpuWinterReleases:()=>{},showScreen:()=>{},managerById:()=>me,shopItemActive:key=>key==='fantadata_pro'?pro:scout,playerSeasonStat:()=>({appearances:19,starts:17,minutes:1500,goals:4,assists:2,voteCount:10,voteSum:65,fantasySum:80}),currentPlayerOvr:p=>p.ovr,playerOvrLabel:p=>p.ovr,playerStatusForDay:id=>({label:id==='p2'?'INFORTUNATO · rientro G24':'DISPONIBILE'}),estimatedStarterProbability:()=>75,clubName:id=>id==='A'?'Roma':'Napoli',clubShort:id=>id,escapeHtml:s=>String(s),playerAvatarMarkup:p=>'<img alt="" src="'+p.id+'.webp">',saveState:()=>{},consumableQuantity:()=>1,useGuaranteedWinterSale:id=>{guaranteed=id;}};
const api=window.FantaDomains['career-market-controller'].create(runtime);runtime.renderWinterReleaseScreen=api.renderWinterReleaseScreen;runtime.toggleWinterRelease=api.toggleWinterRelease;
const click=(attr,value)=>body.controls[attr].find(node=>Object.values(node.dataset)[0]===value).click();
const snapshot=JSON.stringify(roster);
for(const combo of [[false,false],[true,false],[false,true],[true,true]]){
 [pro,scout]=combo;api.renderWinterReleaseScreen();
 assert.equal(body.controls['wrt-sort'].length,13);assert.equal(body.controls['winter-release-player'].length,3);
 assert.equal(body.innerHTML.includes('6.50'),pro);assert.equal(body.innerHTML.includes('8.00'),pro);assert.equal(body.innerHTML.includes('75%'),scout);
 assert.ok(body.innerHTML.includes('INFORTUNATO · rientro G24'));assert.ok(!body.innerHTML.includes('[object Object]'));
}
click('wrt-sort','refund');assert.equal(body.controls['winter-release-player'][0].dataset.winterReleasePlayer,'p1');
click('winter-release-player','p1');assert.equal(nodes.winterReleaseCount.textContent,1);assert.equal(nodes.winterReleaseRefund.textContent,'+17');assert.equal(nodes.winterReleaseBudget.textContent,100);assert.ok(body.innerHTML.includes('✓ SELEZIONATO'));
click('wrt-role','A');assert.equal(body.controls['winter-release-player'].length,1);assert.equal(nodes.winterReleaseRefund.textContent,'+17');
click('wrt-role','');body.input.input({target:{value:'Gamma',selectionStart:5}});assert.equal(body.controls['winter-release-player'].length,1);assert.equal(body.controls['winter-release-player'][0].dataset.winterReleasePlayer,'p3');
body.input.input({target:{value:'',selectionStart:0}});click('winter-release-player','p1');assert.equal(nodes.winterReleaseRefund.textContent,'+0');
runtime.winterGuaranteedSaleMode=true;api.renderWinterReleaseScreen();click('winter-release-player','p2');assert.equal(guaranteed,'p2');assert.equal(flow.userReleaseIds.length,0);
assert.equal(JSON.stringify(roster),snapshot);
console.log('OK: tabella svincoli, tredici colonne, premium, ricerca, ruolo, rimborso base, selezione conservata e cessione garantita.');
