'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),shell=fs.readFileSync(path.join(root,'app_v302.js'),'utf8'),controller=fs.readFileSync(path.join(root,'js/domains/lineup-controller.js'),'utf8');
const formations=vm.runInNewContext('('+shell.match(/const LINEUP_FORMATIONS = ([\s\S]*?);\n\n  function allowedLineupFormation/)[1]+')',{makeFormationSlots:(key,rows)=>rows.map((r,i)=>({instanceId:key+i,role:r[1],x:r[2],y:r[3]}))});
// Evaluate the actual placement expressions used by the renderer.
const placement=controller.slice(controller.indexOf('      const roleSlots=slots.filter'),controller.indexOf('      const pid=$runtime.lineupDraft.starters',controller.indexOf('      const roleSlots=slots.filter')));
let checked=0;
for(const [key,slots] of Object.entries(formations))for(let width of [320,375,450,560]){
 const dense=slots.some(s=>slots.filter(x=>x.role===s.role).length>=5);if(dense)width=Math.max(width,450);
 const size=Math.min(width*(dense?.18:.22),dense?100:120),height=width*1.5;
 const boxes=slots.map(slot=>vm.runInNewContext(placement+';({x:portraitX,y:portraitY})',{slots,slot})).map(p=>({left:width*p.x/100-size/2,right:width*p.x/100+size/2,top:height*p.y/100-size*1.06/2,bottom:height*p.y/100+size*1.06/2}));
 for(const box of boxes)assert(box.left>=0&&box.right<=width&&box.top>=0&&box.bottom<=height,key+' stays inside pitch');
 for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){const x=boxes[a],y=boxes[b];assert(x.right<=y.left||y.right<=x.left||x.bottom<=y.top||y.bottom<=x.top,key+' no overlapping portraits');}
 checked++;
}
const css=fs.readFileSync(path.join(root,'css/modules/lineup.css'),'utf8');const portraitStart=css.indexOf('/* Owns formation pitch portraits.');assert(portraitStart>=0);const next=css.indexOf('/* @section',portraitStart);const portraits=css.slice(portraitStart,next<0?undefined:next);assert(!portraits.includes('transform:translate'));assert(portraits.includes('transform:none!important'));assert(css.includes(':hover,:focus,:focus-visible,:active,.filled'));assert(css.includes('translate:-50% -50%!important'));
console.log('OK: '+checked+' combinations of formations and widths, boundaries, no overlaps and shared interactive centering.');
