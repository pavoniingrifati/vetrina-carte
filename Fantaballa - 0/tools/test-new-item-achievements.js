const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const achievements=read('assets/achievements.js');
const quests=read('assets/season/07-effects-quests-chains.js');
const pages=['campionato.html','campionato-real.html','achievement.html'].map(read);
const expected=[
 ['completa-saracinesca','Saracinesca','saracinesca'],
 ['completa-non-era-mai-rigore','Non era mai rigore','non-era-mai-rigore'],
 ['benedetto-sia-il-pallone','Benedetto sia il pallone','zona-cesarini'],
 ['completa-internazionale','Internazionale','internazionale']
];
const checks=[];
const check=(name,ok)=>checks.push({name,ok:Boolean(ok)});
for(const [achievementId,title,questId] of expected){
 check(`Definizione ${title}`,achievements.includes(`id:'${achievementId}'`)&&achievements.includes(`title:'${title}'`));
 check(`Categoria Oggetti per ${title}`,new RegExp(`id:'${achievementId}'[^\n]+category:'Oggetti'`).test(achievements));
 check(`Sblocco da quest ${questId}`,quests.includes(`'${questId}':'${achievementId}'`));
}
check('Cache achievement aggiornata',pages.every(page=>page.includes('assets/achievements.js?v=20260723-2')));
const failed=checks.filter(item=>!item.ok);
console.log(JSON.stringify({name:'Achievement nuove quest oggetti',passed:checks.length-failed.length,total:checks.length,checks},null,2));
if(failed.length)process.exit(1);
