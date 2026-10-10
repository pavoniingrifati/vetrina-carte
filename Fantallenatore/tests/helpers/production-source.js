'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
// Compatibility for isolated legacy diagnostics that extract one function.
// Integration runtimes load the real domain factories; this view contains no second implementation.
function readProductionSource(){
 let shell=fs.readFileSync(path.join(root,'app_v302.js'),'utf8');
 if(!shell.includes('// DOMAIN_BINDINGS_BEGIN'))return shell;
 shell=shell.replace(/  \/\/ DOMAIN_BINDINGS_BEGIN[\s\S]*?  \/\/ DOMAIN_BINDINGS_END\n/,'');
 const files=new Map(JSON.parse(fs.readFileSync(path.join(root,'js/domains/manifest.json'),'utf8')).map(m=>[m.name,fs.readFileSync(path.join(root,m.file),'utf8')]));
 return shell.replace(/\/\* @domain ([\w-]+) (\w+) \*\//g,(_all,module,name)=>{
  const text=files.get(module),start=text.search(new RegExp('(?:async )?function '+name+'\\('));
  if(start<0)throw Error('Funzione assente: '+module+'/'+name);
  const lineEnd=text.indexOf('\n',start),first=text.slice(start,lineEnd);
  let body;
  if(first.trimEnd().endsWith('}'))body=first;
  else{const end=text.indexOf('\n  }',start);if(end<0)throw Error('Fine funzione assente: '+name);body=text.slice(start,end+4);}
  return body.replace(/\$runtime\./g,'');
 });
}
function domainFiles(){return JSON.parse(fs.readFileSync(path.join(root,'js/domains/manifest.json'),'utf8')).map(m=>m.file);}
module.exports={readProductionSource,domainFiles};
