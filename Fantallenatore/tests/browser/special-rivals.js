'use strict';
const assert=require('node:assert/strict');
async function run({browser,url}){
 const results=[];
 for(const division of [3,1])for(const archetype of ['squalo','camaleonte','fantadata','predatore','broker','rivale','admin']){
  if(archetype==='admin'&&division!==1)continue;
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'it-IT'});
  await context.addInitScript(()=>{let s=98271;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  const result={division,archetype,status:'running'};results.push(result);
  try{
   await page.goto(url,{waitUntil:'networkidle'});
   if(await page.locator('#firstWelcome').count())for(let step=0;step<3;step++)await page.locator('[data-welcome-next]').click();
   const fixture=await page.evaluate(config=>window.__fantaBrowserTest.specialRival(config),{division,archetype});
   // Real timer -> cpuReact -> bid -> user PASS -> actual award and persistence.
   await page.waitForFunction(id=>{
    const a=window.__fantaBrowserTest.inspect().auction;
    return a?.highBidderId===id&&a.bidCount>0;
   },fixture.managerId,{timeout:5000});
   await page.evaluate(()=>window.__fantaBrowserTest.stopTimers());
   const bidding=await page.evaluate(()=>window.__fantaBrowserTest.inspect());
   assert(bidding.auction.price>1&&bidding.auction.price<=fixture.budget-24);
   await page.locator('#passBtn').click();
   await page.waitForFunction(({managerId,playerId})=>window.__fantaBrowserTest.inspect().managers.find(m=>m.id===managerId).roster.some(p=>p.id===playerId),fixture,{timeout:10000});
   const final=await page.evaluate(()=>window.__fantaBrowserTest.inspect());
   const cpu=final.managers.find(m=>m.id===fixture.managerId),owned=cpu.roster.find(p=>p.id===fixture.playerId);
   assert.equal(cpu.budget+owned.price,fixture.budget);assert(cpu.budget>=24);
   assert.deepEqual(errors,[]);
   result.status='passed';result.price=owned.price;console.log(`[OK] special rival / C${division} / ${archetype} / real bid and award`);
  }catch(error){result.status='failed';result.error=error.stack||String(error);console.error(`[ERRORE] special rival ${archetype}: ${error.message}`);}
  finally{await context.close();}
 }
 return results;
}
module.exports={run};
