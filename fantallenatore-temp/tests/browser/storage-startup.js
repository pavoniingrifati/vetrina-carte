'use strict';
const assert=require('node:assert/strict'),scenarios=require('./scenarios');
const cases=['denied-all','denied-local','denied-indexed','blocked-open','silent-open','silent-read','permission-hangs'];
async function run({browser,url}){
 const results=[];
 for(const scenario of cases){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'it-IT'});
  await context.addInitScript(scenario=>{
   const denied=()=>{throw new DOMException('Dati locali bloccati','SecurityError');};
   if(scenario==='denied-all'||scenario==='denied-local')Object.defineProperty(window,'localStorage',{get:denied});
   if(scenario==='denied-all'||scenario==='denied-indexed')Object.defineProperty(window,'indexedDB',{get:denied});
   if(scenario==='blocked-open'||scenario==='silent-open')Object.defineProperty(window,'indexedDB',{value:{open(){const request={};if(scenario==='blocked-open')setTimeout(()=>request.onblocked?.(),0);return request;}}});
   if(scenario==='silent-read')Object.defineProperty(window,'indexedDB',{value:{open(){const request={};setTimeout(()=>{request.result={close(){},objectStoreNames:{contains:()=>true},transaction(){const tx={abort(){tx.onabort?.();},objectStore:()=>({get:()=>({})})};return tx;}};request.onsuccess?.();},0);return request;}}});
   if(scenario==='permission-hangs')Object.defineProperty(navigator,'storage',{value:{persist:()=>new Promise(()=>{})}});
  },scenario);
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  const result={scenario,status:'running'};results.push(result);
  try{
   await page.goto(url,{waitUntil:'networkidle'});
   await scenarios.startup(page); // Real buttons create the career draft despite unavailable storage.
   const fallback=!['denied-local','permission-hangs'].includes(scenario);
   await page.waitForFunction(expected=>window.__fantaBrowserTest.storageBackend()===expected,fallback?'legacy':'indexeddb');
   if(scenario==='permission-hangs'){
    await page.evaluate(async()=>{window.__fantaBrowserTest.nomination();await window.__fantaBrowserTest.flush();});
    await page.reload({waitUntil:'networkidle'});
    await page.locator('#startBtn').click(); // Resume lives inside the career setup dialog.
    await page.locator('#resumeBtn').waitFor({state:'visible',timeout:1500});
    await page.locator('#resumeBtn').click();
    await page.locator('#auctionScreen.active').waitFor({state:'visible'});
   }
   if(scenario==='denied-all'){
    const saved=await page.evaluate(async()=>{window.__fantaBrowserTest.nomination();try{await window.__fantaBrowserTest.flush();return true;}catch{return false;}});
    assert.equal(saved,false,'Unavailable storage must never report a successful save');
    await page.locator('#gameToast.error').waitFor({state:'visible'});
    assert.match(await page.locator('#gameToast').textContent(),/bloccando i dati locali/);
   }
   assert.deepEqual(errors,[],'Uncaught startup errors');result.status='passed';console.log('[OK] storage startup / '+scenario);
  }catch(error){result.status='failed';result.error=error.stack||String(error);console.error('[ERRORE] storage startup / '+scenario+': '+error.message);}
  finally{await context.close();}
 }
 return results;
}
module.exports={run};
