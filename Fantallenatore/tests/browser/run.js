'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
(async()=>{
 let chromium;try{({chromium}=require('playwright'));}catch{console.error('[NON ESEGUITO] Browser: installare Playwright e Chromium.');process.exitCode=3;return;}
 let browser;try{browser=await chromium.launch({headless:true});}catch(error){console.error('[NON ESEGUITO] Browser non disponibile: '+error.message.split('\n')[0]);process.exitCode=3;return;}
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[ext]||'application/octet-stream');res.end(data);});});
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
  await page.locator('#startBtn').click();await page.locator('#careerTeamNameInput').waitFor({state:'visible'});
  assert.equal(await page.locator('#careerIdentityNextBtn').isDisabled(),true);
  await page.locator('#careerTeamNameInput').fill('Test Browser');await page.locator('#coachNameInput').fill('Mister Test');
  assert.equal(await page.locator('#careerIdentityNextBtn').isEnabled(),true);
  await page.locator('#careerIdentityNextBtn').click();await page.locator('#careerAvatarNextBtn').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);await page.reload({waitUntil:'networkidle'});await page.locator('#startBtn').waitFor({state:'visible'});assert.deepEqual(errors,[]);
  await context.close();console.log('[OK] Browser smoke: avvio, validazione identità, passaggio avatar, reload senza errori JS. Non copre asta o stagione.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
