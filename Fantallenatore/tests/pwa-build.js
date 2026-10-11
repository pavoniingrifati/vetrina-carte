'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'site.webmanifest'),'utf8'));
assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.id,'./');assert.equal(manifest.display,'standalone');
assert(manifest.icons.some(icon=>icon.purpose==='maskable'));
for(const icon of manifest.icons){const file=fs.readFileSync(path.join(root,icon.src)),size=Number(icon.sizes.split('x')[0]);assert.equal(file.subarray(1,4).toString(),'PNG');assert.equal(file.readUInt32BE(16),size);assert.equal(file.readUInt32BE(20),size);}
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');new vm.Script(sw);
const files=JSON.parse(sw.match(/const FILES=([\s\S]*?);\nconst SCOPE/)[1]);
for(const file of ['index.html','app_v302.js','data_v302.js','css/game.css','js/pwa-install.js','assets/fonts/Minecraftia-Regular.ttf'])assert(files.includes(file),file+' available offline');
for(const file of files){assert(!file.startsWith('/')&&!file.includes('..'));assert(fs.existsSync(path.join(root,file)));}
const check=spawnSync(process.execPath,[path.join(root,'tools/build-pwa.js'),'--check'],{encoding:'utf8'});assert.equal(check.status,0,check.stdout+check.stderr);
console.log('OK: PWA scoped to game folder, valid app icons and complete current offline release.');
