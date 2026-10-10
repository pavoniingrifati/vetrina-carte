'use strict';
const assert=require('node:assert/strict');
const {box,noOverlap,pitch}=require('./geometry');
const inspect=page=>page.evaluate(()=>window.__fantaBrowserTest.inspect());
const seed=(page,name,args)=>page.evaluate(({name,args})=>window.__fantaBrowserTest[name](args),{name,args});
async function active(page,id){await page.locator('#'+id+'.active').waitFor({state:'visible'});}
async function screenshot(page,dir,name){await page.screenshot({path:require('node:path').join(dir,name+'.png'),fullPage:true});}
async function controls(page,mobile){
 if(!mobile)await page.locator('#passBtn').scrollIntoViewIfNeeded();
 const rects=[];for(const selector of ['#userBidControls > button[data-inc="10"]','#userBidControls > button[data-inc="5"]','#userBidControls > button[data-inc="1"]','#passBtn'])rects.push(await box(page,selector,{scroll:false}));
 noOverlap(rects,'Auction buttons');return rects;
}
async function fillMissing(page,mobile){
 for(let i=0;i<11;i++){
  const snapshot=await inspect(page);const slot=snapshot.slots.find(s=>!snapshot.lineupDraft.starters[s.instanceId]);if(!slot)return;
  const used=new Set(Object.values(snapshot.lineupDraft.starters).map(String));const p=snapshot.roster.find(p=>p.role===slot.role&&!used.has(String(p.id)));assert(p,'No fixture player for '+slot.role);
  await page.locator('#lineupPitchSlots [data-lineup-slot="'+slot.instanceId+'"]').click();
  await page.locator('#lineupSlotPicker').waitFor({state:'visible'});
  await page.locator('#lineupSlotPicker [data-picker-player="'+p.id+'"]').click();
 }
 assert.equal(Object.keys((await inspect(page)).lineupDraft.starters).length,11);
}
async function startup(page){
 if(await page.locator('#firstWelcome').count()){
  for(let step=1;step<=3;step++){
   assert.equal(await page.locator('[data-welcome-count]').textContent(),`${step} / 3`);
   await page.locator('[data-welcome-next]').click();
  }
  assert.equal(await page.locator('#firstWelcome').count(),0);
 }
 await page.locator('#startBtn').click();await page.locator('#careerTeamNameInput').waitFor({state:'visible'});
 assert(await page.locator('#careerIdentityNextBtn').isDisabled());
 await page.locator('#careerTeamNameInput').fill('Browser');await page.locator('#coachNameInput').fill('Mister');
 await page.locator('#careerIdentityNextBtn').click();await page.locator('#careerAvatarNextBtn').waitFor({state:'visible'});
 await page.reload({waitUntil:'networkidle'});await page.locator('#startBtn').waitFor({state:'visible'});
}
async function nomination(page){
 await seed(page,'nomination');await active(page,'auctionScreen');
 await page.locator('#openNominationModalBtn').click();await page.locator('#nominationModal').waitFor({state:'visible'});
 const called=await page.locator('#playerResults .call-player').first().getAttribute('data-player');
 await page.locator('#playerResults .call-player').first().click();
 await page.waitForFunction(()=>!!window.__fantaBrowserTest.inspect().auction);
 await seed(page,'stopTimers');assert.equal(String((await inspect(page)).auction.playerId),called);
}
async function auction(page,{mobile,dir}){
 for(const bundle of [false,true]){
  await seed(page,'auction',{analysis:true,bundle});await active(page,'auctionScreen');
  const before=await controls(page,mobile);
  if(mobile){
   await page.locator('#auctionScreen .auction-layout').evaluate(el=>{el.scrollTop=el.scrollHeight;});
   const after=await controls(page,true);for(let i=0;i<before.length;i++)assert(Math.abs(after[i].top-before[i].top)<2,'Dock moved with player details');
  }
  await screenshot(page,dir,bundle?'auction-bundle':'auction-observer');
 }
 await seed(page,'auction',{analysis:true});
 for(const increment of [1,5,10]){
  await seed(page,'auction',{analysis:true});const before=await inspect(page);
  await page.locator('#userBidControls [data-inc="'+increment+'"]').click();await seed(page,'stopTimers');
  const after=await inspect(page);assert.equal(after.auction.price,before.auction.price+increment);assert.equal(after.auction.highBidderId,'user');
 }
 await seed(page,'auction');await page.locator('#passBtn').click();await seed(page,'stopTimers');
 const passed=await inspect(page);assert(!passed.auction||!passed.auction.activeIds.includes('user'),'Pass button did not remove user');
 await seed(page,'auction');await seed(page,'flush');const saved=(await inspect(page)).auction.playerId;
 await page.reload({waitUntil:'networkidle'});await page.locator('#startBtn').click();await page.locator('#resumeBtn').waitFor({state:'visible'});await page.locator('#resumeBtn').click();await active(page,'auctionScreen');await seed(page,'stopTimers');
 assert.equal((await inspect(page)).auction.playerId,saved,'Auction lost after real IndexedDB reload');
 const viewport=page.viewportSize();
 await page.evaluate(()=>{window.__resizeNodes=['passBtn','userBidControls','myRoster','auctionLog'].map(id=>document.getElementById(id));window.FantaMobileAuction.init(document,window);window.FantaMobileUI.init(document,window);});
 for(const width of [1366,390,1366,390,viewport.width]){
  await page.setViewportSize({width,height:viewport.height});
  await page.waitForFunction(()=>document.querySelector('[data-mobile-anchor="auction-controls"]').parentElement.classList.contains('mobile-auction-dock')===matchMedia('(max-width:780px), (max-width:1024px) and (pointer:coarse)').matches);
  assert(await page.evaluate(()=>window.__resizeNodes.every(node=>node===document.getElementById(node.id)&&document.querySelectorAll('#'+node.id).length===1)),'Resize replaced or duplicated gameplay nodes');
  assert.equal(await page.locator('.mobile-auction-hud').count(),1);assert.equal(await page.locator('.mobile-auction-pages').count(),1);
 }
 const budget=(await inspect(page)).budget,desktopText=await page.locator('#myBudget').textContent();
 await page.locator('#myBudget').evaluate(el=>el.textContent='LOCALIZED DISPLAY TEXT');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.locator('[data-auction-budget]').textContent(),String(budget),'Mobile HUD derived budget from desktop text');
 await page.locator('#myBudget').evaluate((el,text)=>el.textContent=text,desktopText);
 await page.evaluate(()=>{window.FantaMobileAuction.init(document,window).destroy();window.FantaMobileUI.init(document,window).destroy();window.FantaMobileUI.init(document,window);window.FantaMobileAuction.init(document,window);});
 assert.equal(await page.locator('.mobile-auction-hud').count(),1);await controls(page,mobile);

}
async function lineup(page,{mobile,dir}){
 await seed(page,'season',{premium:true});await active(page,'seasonScreen');await page.locator('#lineupBtn').click();await active(page,'lineupScreen');
 await page.locator('#autoLineupBtn').click();assert.equal(await page.locator('#lineupPitchSlots .filled').count(),11);
 const geometry=[];
 for(const formation of ['4-3-3','4-4-2']){
  await page.locator('[data-lineup-formation="'+formation+'"]').click();await fillMissing(page,mobile);
  geometry.push({formation,...await pitch(page)});await screenshot(page,dir,'lineup-'+formation);
 }
 const slot=page.locator('#lineupPitchSlots .filled').first();const before=await inspect(page);await slot.click();
 assert.deepEqual((await inspect(page)).lineupDraft.starters,before.lineupDraft.starters,'Selecting a captain replaced a player');
 await box(page,'#captainSelectedBtn');await page.locator('#captainSelectedBtn').click();assert((await inspect(page)).lineupDraft.captainId);
 const rectBefore=await slot.boundingBox();await slot.hover();const rectAfter=await slot.boundingBox();
 assert(Math.abs(rectBefore.x-rectAfter.x)<2&&Math.abs(rectBefore.y-rectAfter.y)<2,'Player moves on hover');
 await box(page,'#confirmLineupBtn');await page.locator('#confirmLineupBtn').click();await active(page,'seasonScreen');
 const saved=await inspect(page);assert(saved.lineups['1'].user.confirmed);assert(saved.lineups['1'].user.captainId);return geometry;
}
async function live(page,{mobile,dir}){
 await page.locator('#playMatchdayBtn').click();await active(page,'serieALiveScreen');await seed(page,'stopTimers');
 await page.waitForFunction(()=>document.querySelector('#serieATvEvent').getAttribute('aria-hidden')==='true');
 const score=await page.locator('.live-command-scoreboard .fantasy-live-score-compact').evaluate(el=>Array.from(el.children).map(c=>{const r=c.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width};}));
 assert(score[0].right<=score[1].left+2&&score[1].right<=score[2].left+2,'Scoreboard teams/result are reordered or overlapping');
 assert(Math.abs(score[0].width-score[2].width)<2,'Scoreboard team columns unequal');
 const counts=await page.evaluate(()=>({user:document.querySelector('#serieAUserPlayers').children.length,opp:document.querySelector('#serieAOppPlayers').children.length}));assert.equal(counts.user,11);assert.equal(counts.opp,11);
 const columns=await page.locator('.seriea-dual-lineups').evaluate(el=>Array.from(el.children).map(c=>{const r=c.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
 assert.equal(columns.length,2);assert(columns[0].right<=columns[1].left+2,'Teams no longer side by side');
 for(const r of columns)assert(r.left>=-2&&r.right<=page.viewportSize().width+2,'Lineup column clipped horizontally');
 for(const selector of ['[data-live-speed="2"]','#serieAPauseBtn','#nextSerieAEventBtn','#skipSerieALiveBtn'])await box(page,selector);
 const actionRects=await Promise.all(['#nextSerieAEventBtn','#skipSerieALiveBtn'].map(s=>page.locator(s).evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})));noOverlap(actionRects,'Live advance controls');
 await screenshot(page,dir,'live-duel');await page.locator('[data-live-speed="2"]').click();await seed(page,'stopTimers');assert.equal((await inspect(page)).live.speed,2);
 await page.locator('#serieAPauseBtn').click();await seed(page,'stopTimers');assert((await inspect(page)).live.manualPaused);
 const prior=(await inspect(page)).live;await page.locator('#nextSerieAEventBtn').click();await seed(page,'stopTimers');const next=(await inspect(page)).live;assert(next.eventIndex>prior.eventIndex||next.phase!==prior.phase,'Next event did not advance the simulation');
 await page.waitForFunction(()=>document.querySelector('#serieATvEvent').getAttribute('aria-hidden')==='true');
 await page.locator('#skipSerieALiveBtn').click();await page.waitForFunction(()=>window.__fantaBrowserTest.inspect().live?.phase==='between');
 await box(page,'#skipSerieALiveBtn');await screenshot(page,dir,'live-before-big-match');await page.locator('#skipSerieALiveBtn').click();await page.waitForFunction(()=>window.__fantaBrowserTest.inspect().live?.phase==='bigmatch');await seed(page,'stopTimers');
 assert.equal((await inspect(page)).live.phase,'bigmatch');
}
async function detector(page,{mobile}){
 await seed(page,'auction');const button=page.locator('#passBtn');const previous=await button.getAttribute('style');
 await button.evaluate(el=>{el.style.setProperty('transition','none','important');el.style.setProperty('transform','translateX(200vw)','important');});
 await page.waitForFunction(()=>document.querySelector('#passBtn').getBoundingClientRect().left>innerWidth);
 try{await assert.rejects(()=>box(page,'#passBtn',{scroll:false}),/outside viewport|clipped/,'Geometry check must reject a deliberately cut button');}
 finally{await button.evaluate((el,style)=>{if(style===null)el.removeAttribute('style');else el.setAttribute('style',style);},previous);}
 await page.waitForFunction(()=>document.querySelector('#passBtn').getBoundingClientRect().right<=innerWidth+2);
 await controls(page,mobile);
}
module.exports={startup,nomination,auction,detector,lineup,live};
