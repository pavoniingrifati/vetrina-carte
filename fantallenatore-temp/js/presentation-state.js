/* Small, read-only presentation snapshots. No DOM, storage or gameplay decisions. */
(function(){
 'use strict';
 function auctionSnapshot(state,{totalSlots,roleLimits,userCanAct=false}){
  const manager=state?.managers?.[0];if(!manager)return null;
  const roles=Object.entries(roleLimits).map(([role,limit])=>Object.freeze({role,limit,count:manager.roster.filter(p=>p.role===role).length}));
  return Object.freeze({budget:manager.budget,filledSlots:manager.roster.length,totalSlots,roles:Object.freeze(roles),phase:state.completed?'completed':state.auction?'live':'nomination',canBid:!!state.auction&&!state.completed&&!!userCanAct});
 }
 function create(){
  let current=null,auctionRef=null;const subscribers=new Set();
  return Object.freeze({
   publishAuction(state,options){
    const auction=state?.auction??null;
    const userCanAct=options.userCanAct??((auction===auctionRef&&current?.canBid)||false);
    const next=auctionSnapshot(state,{...options,userCanAct});auctionRef=auction;
    if(JSON.stringify(next)===JSON.stringify(current))return current;
    current=next;for(const listener of subscribers)listener(current);return current;
   },
   subscribeAuction(listener){subscribers.add(listener);listener(current);return ()=>subscribers.delete(listener);},
   getAuction(){return current;}
  });
 }
 const api={auctionSnapshot,create};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else window.FantaPresentationState=Object.freeze({...api,...create()});
})();
