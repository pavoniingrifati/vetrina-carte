'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const core=process.argv.includes('--core');
const skipAuctions=core||process.argv.includes('--skip-auctions');
let incomplete=false;
let auctionStatus='not_run';
const results=[];
const files=fs.readdirSync(__dirname).filter(name=>name.endsWith('.js')&&!['run-all.js','auction-competitive.js'].includes(name)).sort();
let failed=0;
for(const file of files){
  const result=spawnSync(process.execPath,[path.join(__dirname,file)],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',maxBuffer:16*1024*1024});
  results.push({file,status:result.status===0?'passed':'failed'});
  if(result.status===0)console.log(`[OK] ${file}`);
  else {failed++;console.error(`[ERRORE] ${file}\n${result.stdout||''}${result.stderr||''}${result.error||''}`);}
}
if(!skipAuctions){
  console.log('\nVerifica integrità e diagnosi del bilanciamento delle aste:');
  const result=spawnSync(process.execPath,[path.join(__dirname,'auction-competitive.js'),'--strict','--report',path.join(__dirname,'../reports/auction-latest.json')],{cwd:path.resolve(__dirname,'..'),stdio:'inherit'});
  auctionStatus=result.status===0?'passed':'failed';
  results.push({file:'auction-competitive.js',status:auctionStatus});
  if(result.status!==0)failed++;
  else {const summary=spawnSync(process.execPath,[path.join(__dirname,'../tools/summarize-auctions.js'),path.join(__dirname,'../reports/auction-latest.json')],{stdio:'inherit'});if(summary.status!==0)failed++;}
}
if(!core){
 const browser=spawnSync(process.execPath,[path.join(__dirname,'browser/run.js')],{stdio:'inherit'});
 incomplete=browser.status===3||skipAuctions;
 if(browser.status!==0&&browser.status!==3)failed++;
 results.push({file:'browser/run.js',status:browser.status===3?'not_run':browser.status===0?'passed':'failed'});
}
fs.mkdirSync(path.join(__dirname,'../reports'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../reports/test-latest.json'),JSON.stringify({scope:core?'core':'core+auctions+browser-smoke',status:failed?'failed':incomplete?'incomplete':'passed',auctionStatus,results,limitations:['Browser smoke non copre rilanci, salvataggio della carriera o stagione','Storage integration usa adapter, non IndexedDB del browser','Giornate integration usano punteggi fixture, non simulazione calcistica']},null,2));
console.log(`\n${files.length} script di regressione: ${failed?'verifiche fallite: '+failed:'tutti superati'}.`);
console.log('Soglie aste bloccanti. Browser smoke limitato; flussi asta e stagione UI ancora da verificare.');
if(incomplete)console.log('COPERTURA INCOMPLETA: browser non eseguito (exit 3).');
process.exitCode=failed?1:incomplete?3:0;
