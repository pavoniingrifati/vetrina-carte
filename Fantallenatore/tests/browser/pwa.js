'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const {createServer}=require('./server');
const root=path.resolve(__dirname,'../..'),prefix='/vetrina-carte/Fantallenatore';
async function main(){
  const fixture=createServer(root),worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  let newer=false;
  const server=http.createServer((req,res)=>{
    if(!req.url.startsWith(prefix+'/')){res.writeHead(404);res.end();return;}
    req.url=req.url.slice(prefix.length);
    if(req.url.split('?')[0]==='/sw.js'){
      res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');
      res.end(newer?worker.replace(/const VERSION="([^"]+)";/,'const VERSION="$1-test-update";'):worker);return;
    }
    fixture.emit('request',req,res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.FANTA_CHROMIUM?{executablePath:process.env.FANTA_CHROMIUM}:{})});
  const url='http://127.0.0.1:'+server.address().port+prefix+'/';
  const dir=path.join(root,'reports/browser/pwa');fs.mkdirSync(dir,{recursive:true});
  const results=[];
  async function context(options={}){
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,...options});
    await ctx.addInitScript(()=>localStorage.setItem('fantallenatore_creator_welcome_seen','1'));return ctx;
  }
  try{
    const ctx=await context(),page=await ctx.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const cacheInfo=await page.evaluate(async()=>{
      const reg=await navigator.serviceWorker.getRegistration(),keys=await caches.keys();
      const name=keys.find(key=>key.startsWith('fantallenatore:'+new URL(reg.scope).pathname+':'));
      return {scope:reg.scope,count:(await (await caches.open(name)).keys()).length};
    });
    assert.equal(cacheInfo.scope,url);assert(cacheInfo.count>100);
    const manifest=await page.evaluate(async()=>await (await fetch('site.webmanifest')).json());
    assert.equal(new URL(manifest.start_url,url).href,url);
    assert.equal(manifest.display,'standalone');
    const button=page.locator('#installGameBtn');assert(await button.isVisible());
    assert(!await page.locator('#pwaUpdateBtn').isVisible(),'Initial install is not an update');
    await page.evaluate(()=>{
      window.__promptCalls=0;
      const event=new Event('beforeinstallprompt',{cancelable:true});
      event.prompt=async()=>{window.__promptCalls++;};event.userChoice=Promise.resolve({outcome:'dismissed'});
      window.dispatchEvent(event);window.__promptPrevented=event.defaultPrevented;
    });
    await button.click();assert.equal(await page.evaluate(()=>window.__promptCalls),1);
    assert(await page.evaluate(()=>window.__promptPrevented));assert(!await button.isDisabled());
    await button.click();assert(await page.locator('#pwaInstallDialog').isVisible());
    assert((await page.locator('[data-pwa-install-steps]').textContent()).includes('Installa app'));
    await page.keyboard.press('Escape');assert(!await page.locator('#pwaInstallDialog').isVisible());
    await page.locator('#pwaStatus').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,'home-install.png'),fullPage:true});
    await page.setViewportSize({width:1366,height:768});assert(!await button.isVisible());
    await page.setViewportSize({width:320,height:568});assert(await button.isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await button.click();const bounds=await page.locator('#pwaInstallDialog').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=320);assert(bounds.height<=568);
    await page.locator('[data-pwa-install-close]').click();
    await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));assert(!await button.isVisible());
    results.push({name:'manifest, subdirectory scope, prompt, dismissal, installed state and responsive help',status:'passed'});

    await page.evaluate(async()=>{
      window.__fantaBrowserTest.season({premium:true});await window.__fantaBrowserTest.flush();
      await caches.open('unrelated-game');await caches.open('fantallenatore:/another-game/:keep');
    });
    const roster=await page.evaluate(()=>window.__fantaBrowserTest.inspect().roster.map(p=>p.id));
    await ctx.setOffline(true);await page.goto(url+'?offline=1');
    await page.locator('#startBtn').click();await page.locator('#resumeBtn').click();
    await page.waitForFunction(()=>window.__fantaBrowserTest?.inspect().roster?.length>0);
    assert.deepEqual(await page.evaluate(()=>window.__fantaBrowserTest.inspect().roster.map(p=>p.id)),roster);
    assert(await page.locator('#seasonScreen').isVisible());
    const offlineIcon=await page.evaluate(async()=>{const response=await fetch('assets/app/icon-192.png');return {ok:response.ok,size:(await response.blob()).size};});
    assert(offlineIcon.ok&&offlineIcon.size>100);
    results.push({name:'offline reload, icons and saved career survive',status:'passed'});
    await ctx.setOffline(false);
    await page.evaluate(()=>window.__fantaBrowserTest.season({premium:true}));
    newer=true;
    await page.evaluate(async()=>{window.__pwaRegistration=await navigator.serviceWorker.getRegistration();await window.__pwaRegistration.update();});
    await page.waitForFunction(()=>window.__pwaRegistration.waiting?.state==='installed');
    await page.evaluate(()=>document.getElementById('pwaUpdateBtn').click());
    assert(await page.evaluate(()=>!!window.__pwaRegistration.waiting),'Update waits during gameplay');
    const home=await ctx.newPage();await home.goto(url);
    const update=home.locator('#pwaUpdateBtn');await update.waitFor({state:'visible'});
    await Promise.all([home.waitForEvent('load'),update.click()]);
    await home.waitForFunction(()=>!document.getElementById('pwaUpdateBtn').disabled);
    await home.evaluate(()=>navigator.serviceWorker.ready);
    await home.waitForFunction(()=>document.getElementById('pwaUpdateBtn').hidden);
    const keys=await home.evaluate(()=>caches.keys());
    assert(keys.includes('unrelated-game'));assert(keys.includes('fantallenatore:/another-game/:keep'));
    const own=keys.filter(key=>key.startsWith('fantallenatore:'+prefix+'/:'));
    assert.equal(own.length,1);assert(own[0].endsWith('-test-update'));
    assert(await page.locator('#seasonScreen').isVisible(),'Updating a home tab does not reload another tab in play');
    await home.locator('#startBtn').click();await home.locator('#resumeBtn').click();
    await home.waitForFunction(()=>window.__fantaBrowserTest?.inspect().roster?.length>0);
    assert.deepEqual(await home.evaluate(()=>window.__fantaBrowserTest.inspect().roster.map(p=>p.id)),roster);
    assert.deepEqual(errors,[]);
    results.push({name:'update deferred during play, activated from home, local save and other app caches preserved',status:'passed'});
    await ctx.close();

    const iphone=await context({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
    const safari=await iphone.newPage();await safari.goto(url);await safari.locator('#installGameBtn').click();
    const steps=await safari.locator('[data-pwa-install-steps]').textContent();assert(steps.includes('Safari')&&steps.includes('Condividi')&&steps.includes('Aggiungi alla schermata Home'));
    await safari.screenshot({path:path.join(dir,'iphone-instructions.png')});
    await safari.locator('[data-pwa-install-close]').click();assert(await safari.locator('#startBtn').isVisible());
    results.push({name:'iPhone instructions and accessible modal close',status:'passed'});await iphone.close();

    const installed=await context();await installed.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));
    const app=await installed.newPage();await app.goto(url);assert(!await app.locator('#installGameBtn').isVisible());
    results.push({name:'already standalone: no install entry',status:'passed'});await installed.close();

    const blocked=await context();await blocked.addInitScript(()=>{navigator.serviceWorker.register=()=>Promise.reject(new Error('Storage blocked'));});
    const fallback=await blocked.newPage();await fallback.goto(url);await fallback.waitForFunction(()=>document.getElementById('pwaStatus').textContent.includes('Puoi continuare'));
    await fallback.locator('#installGameBtn').click();assert(await fallback.locator('#pwaInstallDialog').isVisible());
    await fallback.locator('[data-pwa-install-close]').click();await fallback.locator('#startBtn').click();
    assert(await fallback.locator('#careerSetupScreen').isVisible());
    assert(await fallback.locator('#careerTeamNameInput').isVisible());
    results.push({name:'blocked offline storage does not prevent installation help or game startup',status:'passed'});await blocked.close();
    fs.writeFileSync(path.join(root,'reports/pwa-installazione.json'),JSON.stringify({status:'passed',browser:'Chromium',limitations:['Native Android and iPhone installation not exercised on physical devices; native prompt simulated and iPhone instructions tested with its user agent.'],results},null,2)+'\n');
    for(const result of results)console.log('OK '+result.name);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
