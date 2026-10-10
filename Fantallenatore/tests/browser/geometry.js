'use strict';
const assert=require('node:assert/strict');
async function box(page,selector,{scroll=true,hit=true}={}){
 const locator=page.locator(selector).first();await locator.waitFor({state:'visible'});if(scroll){await locator.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
 const result=await locator.evaluate(el=>{
  const r=el.getBoundingClientRect(),style=getComputedStyle(el),x=r.left+r.width/2,y=r.top+r.height/2,target=document.elementFromPoint(x,y);
  const clips=[];for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(['hidden','clip','auto','scroll'].includes(s.overflowX)||['hidden','clip','auto','scroll'].includes(s.overflowY)){const b=p.getBoundingClientRect();clips.push({x:s.overflowX,y:s.overflowY,left:b.left,top:b.top,right:b.right,bottom:b.bottom});}}
  return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,viewport:{width:innerWidth,height:innerHeight},hit:el===target||el.contains(target),cover:target?{tag:target.tagName,id:target.id,classes:target.className}:null,visibility:style.visibility,clips};
 });
 assert(result.width>0&&result.height>0,selector+' has no area');assert(result.left>=-2&&result.top>=-2&&result.right<=result.viewport.width+2&&result.bottom<=result.viewport.height+2,selector+' outside viewport: '+JSON.stringify(result));
 for(const c of result.clips){if(c.x!=='visible')assert(result.left>=c.left-2&&result.right<=c.right+2,selector+' clipped horizontally');if(c.y!=='visible')assert(result.top>=c.top-2&&result.bottom<=c.bottom+2,selector+' clipped vertically');}
 if(hit)assert(result.hit,selector+' covered at click point: '+JSON.stringify(result));return result;
}
function noOverlap(rects,label,tolerance=2){
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
  const a=rects[i],b=rects[j],w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
  assert(!(w>tolerance&&h>tolerance),label+' overlap: '+JSON.stringify({a,b}));
 }
}
async function pitch(page){
 const result=await page.locator('.lineup-pitch').evaluate(el=>{
  const bounds=el.getBoundingClientRect();return {bounds:{left:bounds.left,top:bounds.top,right:bounds.right,bottom:bounds.bottom},players:Array.from(el.querySelectorAll('.lineup-slot.filled')).map(p=>{const r=p.getBoundingClientRect();return {slot:p.dataset.lineupSlot,left:r.left,top:r.top,right:r.right,bottom:r.bottom};})};
 });
 assert.equal(result.players.length,11);for(const r of result.players)assert(r.left>=result.bounds.left-2&&r.right<=result.bounds.right+2&&r.top>=result.bounds.top-2&&r.bottom<=result.bounds.bottom+2,'Player outside pitch: '+JSON.stringify(r));noOverlap(result.players,'Pitch players');return result;
}
module.exports={box,noOverlap,pitch};
