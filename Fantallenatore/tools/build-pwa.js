'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const files=new Set(['index.html','site.webmanifest']);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)){
  if(!/^(?:https?:|\/\/|#)/.test(match[1]))files.add(match[1]);
}
function assets(dir){
  for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
    const rel=dir+'/'+entry.name;
    if(entry.isDirectory()){if(rel!=='assets/social')assets(rel);}
    else if(/\.(?:png|webp|svg|ttf|woff2?)$/.test(rel))files.add(rel);
  }
}
assets('assets');
const list=[...files].sort(),hash=crypto.createHash('sha256');
for(const file of list){hash.update(file);hash.update(fs.readFileSync(path.join(root,file)));}
const template=fs.readFileSync(path.join(__dirname,'service-worker.template.js'),'utf8');
hash.update(template);
const version=hash.digest('hex').slice(0,20);
const output=template.replace('__VERSION__',JSON.stringify(version)).replace('__FILES__',JSON.stringify(list,null,2));
const target=path.join(root,'sw.js');
if(process.argv.includes('--check')){
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==output){console.error('sw.js non aggiornato: esegui node tools/build-pwa.js');process.exitCode=1;}
  else console.log('OK: PWA cache aggiornata, '+list.length+' risorse, versione '+version);
}else{
  fs.writeFileSync(target,output);console.log('Built sw.js: '+list.length+' risorse, versione '+version);
}
