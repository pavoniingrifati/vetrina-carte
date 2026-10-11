'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const window={};
vm.runInNewContext(fs.readFileSync('js/domains/trade-roster-controller.js','utf8'),{window,Date});
function fixture(kind='winter'){
 const out={id:'out',role:'A',name:'Offerto',price:10,ovr:90,fvm:90};
 const incoming={id:'in',role:'A',name:'Richiesto',price:30,ovr:80,fvm:50};
 const me={id:'user',team:'Mia',budget:100,roster:[out]},rival={id:'cpu',team:'Rivale',budget:50,roster:[incoming]};
 const nodes={};
 const node=id=>nodes[id] ||= {value:'',options:[],classList:{hidden:false,toggle(name,on){this[name]=on;}},disabled:false};
 node('tradeOpponent').value='cpu';node('tradeOutgoing').value='out';node('tradeIncoming').value='in';node('tradeCredits').value='25';
 const ledger={user:{},cpu:{}};
 const rt={state:{completed:true,career:{seasonNumber:1},managers:[me,rival],winterMarketFlow:{stage:kind==='winter'?'trades':'idle',finalBudgets:{}},season:{currentMatchday:20,lineups:{20:{}},assistantCoachLineup:{enabled:true,formation:'old'}}},$:node,managerById:id=>[me,rival].find(m=>m.id===id),currentPlayerOvr:p=>p.ovr,baseAuctionValue:p=>p.fvm,playerFormMetrics:()=>({score:0}),playerSeasonStat:()=>({}),playerStatusForDay:()=>({unavailable:false}),careerHash:()=>.1,ROLE_PLURALS:{A:'Attaccanti'},winterLedgerFor:id=>ledger[id],saveState:()=>{},clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),escapeHtml:String,playerOvrLabel:p=>p.ovr,showScreen:()=>{},seasonFixtureTheme:()=>({}),renderFixtureCoachPortrait:()=>{}};
 Object.assign(rt,window.FantaDomains['trade-roster-controller'].create(rt));
 rt.tradePlayerCardMarkup=()=>'';rt.renderTradeRosterChoices=()=>{};
 return {rt,nodes,node,me,rival,out,incoming,ledger};
}
{
 const {rt,node,me,rival,out,incoming,ledger}=fixture();
 const trade=rt.currentTradeWindow('winter');
 trade.pending={rivalId:'cpu',outgoingId:'out',incomingId:'in',credits:25};
 rt.renderTradeWindow('winter');
 assert.equal(trade.pending,null);assert.match(trade.notice,/senza crediti/);
 assert.equal(node('tradeCreditBox').classList.hidden,true);assert.equal(node('tradeCounterBtn').classList.hidden,true);
 for(const id of ['tradeCredits','tradeCreditsMinus','tradeCreditsPlus']) assert.equal(node(id).disabled,true);
 assert.match(node('tradeSelectionTip').textContent,/senza crediti/);
 assert.match(node('tradeWindowDescription').textContent,/senza crediti/);
 assert.equal(node('tradeCredits').value,'0');
 node('tradeCredits').value='99';assert.equal(rt.tradeOfferSelection().credits,0);assert.equal(rt.tradeCreditsValue(),0);
 rt.adjustTradeCredits(10);assert.equal(node('tradeCredits').value,'0');
 const cashOffer={...rt.tradeOfferSelection(),credits:25};
 assert.equal(rt.tradeOfferValid(cashOffer),false);assert.equal(rt.completeTrade(cashOffer,trade),false);
 assert.equal(rt.tradeCpuDecision(cashOffer,trade).type,'reject');
 assert.equal(me.budget,100);assert.equal(rival.budget,50);
 rt.submitTradeOffer();
 assert.equal(trade.completed,1);assert.equal(me.roster[0],incoming);assert.equal(rival.roster[0],out);
 assert.equal(me.budget,100);assert.equal(rival.budget,50);
 assert.equal(rt.state.tradeBudgetAdjustments.user,20);assert.equal(rt.state.tradeBudgetAdjustments.cpu,-20);
 assert.equal(ledger.user.tradeCashDelta,0);assert.equal(ledger.cpu.tradeCashDelta,0);
 assert.equal(rt.state.winterMarketFlow.finalBudgets.user,100);assert.equal(rt.state.season.lineups[20],undefined);
 assert.equal(rt.state.season.assistantCoachLineup.enabled,true);assert.equal(rt.state.season.assistantCoachLineup.formation,null);
 assert.doesNotMatch(trade.history[0],/cr/);
 // The window guard also works when called outside the active winter phase.
 rt.state.winterMarketFlow.stage='idle';assert.equal(rt.completeTrade(cashOffer,trade),false);
 rt.renderTradeWindow('summer');
 assert.equal(node('tradeCreditBox').classList.hidden,false);
 for(const id of ['tradeCredits','tradeCreditsMinus','tradeCreditsPlus']) assert.equal(node(id).disabled,false);
 assert.match(node('tradeSelectionTip').textContent,/conguaglio/);
}
{
 const {rt,out,incoming}=fixture();
 // Same-valued players previously triggered a cash counteroffer.
 out.ovr=incoming.ovr;out.fvm=incoming.fvm;
 const offer=rt.tradeOfferSelection();
 assert.equal(rt.tradeCpuDecision(offer,{kind:'winter',seasonNumber:1}).type,'reject');
 const summer=rt.tradeCpuDecision(offer,{kind:'summer',seasonNumber:1});
 assert.equal(summer.type,'counter');assert(summer.credits>0);
}
{
 const {rt,me,rival,node}=fixture('summer');
 rt.renderTradeWindow('summer');assert.equal(node('tradeCreditBox').classList.hidden,false);
 assert.equal(rt.tradeOfferSelection().credits,25);
 const trade=rt.currentTradeWindow('summer');
 trade.pending={rivalId:'cpu',outgoingId:'out',incomingId:'in',credits:25};
 rt.acceptTradeCounter();assert.equal(trade.completed,1);assert.equal(me.budget,75);assert.equal(rival.budget,75);
 assert.match(trade.history[0],/25 cr/);
}
console.log('OK: January UI and logic forbid credits, old counters cleared, dry swaps preserve budgets and ledger, summer credits/counters retained.');
