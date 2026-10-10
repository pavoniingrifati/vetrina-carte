'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'css/manifest.json')));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes('href="'+manifest.runtime+'"'));
assert.equal(manifest.version,2);
assert.equal(manifest.sections[0].file,'css/modules/00-design-tokens.css');
assert.equal(manifest.sections.at(-1).file,'css/modules/12-responsive-qa.css');
const result=require('node:child_process').spawnSync('python3',[path.join(root,'tools/build-css.py'),'--check'],{encoding:'utf8'});
assert.equal(result.status,0,result.stdout+result.stderr);
const css=fs.readFileSync(path.join(root,manifest.runtime),'utf8');
assert(!/@import\b/.test(css),'one runtime stylesheet, no import waterfall');
for(const url of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)){
 if(/^(data:|https?:|#)/.test(url[1]))continue;
 assert(fs.existsSync(path.resolve(root,'css',url[1].split(/[?#]/)[0])),'asset: '+url[1]);
}
console.log('OK: build CSS aggiornato, ordine responsive invariato, risorse relative valide e nessun @import a runtime.');
