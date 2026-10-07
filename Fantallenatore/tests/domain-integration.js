'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'js/domains/manifest.json')));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),shell=fs.readFileSync(path.join(root,'app_v302.js'),'utf8');
const names=new Set();
for(const module of manifest){
 assert(html.indexOf('src="'+module.file+'"')>=0,module.file+' must load');
 assert(html.indexOf('src="'+module.file+'"')<html.indexOf('src="app_v302.js"'),module.file+' loads before shell');
 for(const name of module.functions){assert(!names.has(name),'unique domain owner: '+name);names.add(name);assert(shell.includes('@domain '+module.name+' '+name));}
}
const cases=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/v223-domain-engine.json')));
for(const {seed,hashes} of cases){
 const api=require('./helpers/season-runtime').createRuntime(seed);
 for(let day=1;day<=hashes.length;day++)assert.equal(crypto.createHash('sha256').update(JSON.stringify(api.day(day))).digest('hex'),hashes[day-1],seed+' day '+day+' matches V223');
}
console.log(`OK: ${manifest.length} domini reali, ${names.size} funzioni univoche, ordine offline e nove giornate identiche alla V223 (tre semi).`);
