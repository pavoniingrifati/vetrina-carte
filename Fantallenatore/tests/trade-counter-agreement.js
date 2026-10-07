const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const app=fs.readFileSync(path.join(__dirname,'../app_v302.js'),'utf8');
for(const credits of [24,25]){
 const trade={stage:'open',completed:0,attempts:1,pending:{rivalId:'cpu',outgoingId:'a',incomingId:'b',credits:24}};
 let completed=false,evaluated=false;
 const ctx={state:{},currentTradeWindow:()=>trade,tradeOfferSelection:()=>({rival:{id:'cpu'},outgoing:{id:'a'},incoming:{id:'b'},credits}),tradeOfferValid:()=>true,tradeCpuDecision:()=>{evaluated=true;return {type:'reject'}},completeTrade:()=>{completed=true},renderTradeWindow:()=>{},saveState:()=>{}};
 vm.createContext(ctx);vm.runInContext(app.slice(app.indexOf('  function submitTradeOffer('),app.indexOf('  function acceptTradeCounter(')),ctx);ctx.submitTradeOffer();assert(completed&&!evaluated,'Conguaglio concordato rifiutato');
}
console.log('OK: richiesti 24, offerte di 24 e 25 accettate senza nuovo sorteggio.');
