const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'assets/season/season-contrast.css'),'utf8');
const pages=['campionato.html','campionato-real.html','tricolore-pisa.html'];
const tests=[];
function check(name,condition){tests.push({name,ok:Boolean(condition)});}
for(const page of pages){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 check(`${page}: contrast stylesheet loaded`,/season-contrast\.css\?v=20260727-contrast1/.test(html));
 const home=html.indexOf('season-home.css');
 const contrast=html.indexOf('season-contrast.css');
 check(`${page}: contrast loaded after home`,home>=0&&contrast>home);
}
check('light surface ink variable',css.includes('--season-ink:#10243a'));
check('event cards forced dark',/#screen \.event-card[\s\S]*color:var\(--season-ink\)!important/.test(css));
check('quest cards forced dark',/#screen \.quest-card[\s\S]*color:var\(--season-ink\)!important/.test(css));
check('chaos feed forced dark',/#screen :is\(\.chaos-feed,\.season-rules-card\)/.test(css));
check('table cells forced dark',/#screen table td\{[\s\S]*color:var\(--season-ink\)!important/.test(css));
check('table headers stay white',/#screen table th\{[\s\S]*color:#fff!important/.test(css));
check('user row dark on gold',/#screen table \.us-row td\{[\s\S]*color:var\(--season-ink\)!important/.test(css));
check('calendar rows forced dark',css.includes('.calendar-row'));
check('market/light rows covered',css.includes('.midseason-panel')&&css.includes('.midseason-impact'));
check('dark event choices preserved',css.includes('.season-event-choice.tone-blue')&&css.includes('.season-event-choice.tone-red'));
const failed=tests.filter(t=>!t.ok);
for(const t of tests)console.log(`${t.ok?'✓':'✗'} ${t.name}`);
console.log(`\n${tests.length-failed.length}/${tests.length} test superati.`);
if(failed.length)process.exit(1);
