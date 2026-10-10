'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./server'),scenarios=require('./scenarios');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'reports/browser');
const profiles=[
 {name:'desktop-wide',width:1920,height:1080,mobile:false},
 {name:'desktop',width:1366,height:768,mobile:false},
 {name:'desktop-compact',width:1024,height:768,mobile:false},
 {name:'tablet',width:768,height:1024,mobile:true},
 {name:'phone',width:390,height:844,mobile:true},
 {name:'phone-short',width:369,height:682,mobile:true},
 {name:'phone-landscape',width:844,height:390,mobile:true}
];
const stages=['startup','nomination','auction','detector','lineup','live'];
const report={scope:'real UI actions on deterministic prepared careers',status:'running',profiles,results:[],limitations:[
 'Fixtures prepare initial auction/rosters and enable premium analysis; this is not a complete 250-player auction.',
 'Screenshots are captured for review; there is no approved pixel comparison baseline.',
 'Coverage uses Chromium; it does not cover native Safari/iOS or every event/power.'
]};
function write(){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'latest.json'),JSON.stringify(report,null,2)+'\n');}
function unavailable(reason){report.status='not_run';report.reason=reason;report.results=profiles.flatMap(p=>stages.map(stage=>({profile:p.name,stage,status:'not_run'})));write();console.error('[NON ESEGUITO] '+reason);process.exitCode=3;}
(async()=>{
 let chromium;try{({chromium}=require('playwright'));}catch{unavailable('Installare le dipendenze npm e Chromium.');return;}
 let browser;try{browser=await chromium.launch({headless:process.env.FANTA_BROWSER_HEADED!=='1',...(process.env.FANTA_BROWSER_EXECUTABLE?{executablePath:process.env.FANTA_BROWSER_EXECUTABLE}:{})});}catch(error){unavailable('Chromium non disponibile: '+error.message.split('\n')[0]);return;}
 const server=createServer(root);let failed=0;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const url='http://127.0.0.1:'+server.address().port;
  for(const profile of profiles){
   const dir=path.join(output,profile.name);fs.mkdirSync(dir,{recursive:true});
   const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},isMobile:profile.mobile,hasTouch:profile.mobile,locale:'it-IT'});
   // Seed randomness, never replace gameplay functions or event handlers.
   await context.addInitScript(()=>{let s=17329;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};});
   const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
   const failedRequests=[];page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(url))failedRequests.push(r.url()+': '+r.status());});
   let failedStage=null;
   try{
    await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
    for(const stage of stages){
     const record={profile:profile.name,stage,status:'running'};report.results.push(record);
     try{
      const measurements=await scenarios[stage](page,{...profile,dir});
      assert.deepEqual(errors,[],'Uncaught JavaScript errors');assert.deepEqual(failedRequests,[],'Missing local assets');
      record.status='passed';if(measurements)record.measurements=measurements;console.log('[OK] '+profile.name+' / '+stage);
     }catch(error){record.status='failed';record.error=error.stack||String(error);failedStage=stage;throw error;}
    }
   }catch(error){
    failed++;console.error('[ERRORE] '+profile.name+' / '+(failedStage||'load')+': '+error.message);
    if(!failedStage)report.results.push({profile:profile.name,stage:'load',status:'failed',error:error.stack});
    await page.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});
    const completed=new Set(report.results.filter(r=>r.profile===profile.name).map(r=>r.stage));
    for(const stage of stages)if(!completed.has(stage))report.results.push({profile:profile.name,stage,status:'not_run',reason:'Previous stage failed'});
   }finally{await context.close();write();}
  }
  report.status=failed?'failed':'passed';write();process.exitCode=failed?1:0;
  console.log('Browser: '+report.status+'. Report e screenshot: reports/browser/.');
 }finally{await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{report.status='failed';report.reason=error.stack||String(error);write();console.error(error);process.exitCode=1;});
