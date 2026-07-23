const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
const summary=fs.readFileSync(path.join(root,'assets/season/09-analytics-and-summary.js'),'utf8');
const effects=fs.readFileSync(path.join(root,'assets/season/07-effects-quests-chains.js'),'utf8');
const special=fs.readFileSync(path.join(root,'assets/season/08-special-rules.js'),'utf8');
const profile=fs.readFileSync(path.join(root,'assets/season/03-state-and-data.js'),'utf8');
const checks=[];
function ok(name,condition){checks.push({name,ok:Boolean(condition)});if(!condition)throw new Error(name)}
ok('Profilo: due partite senza vittoria',profile.includes('Dopo 2 partite consecutive senza vittoria'));
ok('Profilo: bonus +2/+2',profile.includes('+2 OVR e +2 Intesa aggiuntivi'));
ok('Pareggi inclusi nella serie senza vittorie',summary.includes('function coachTrailingNonWinCount()'));
ok('Serie di almeno due non vittorie',summary.includes('coachTrailingNonWinCount()>=2'));
ok('Effetti temporanei OVR +2',effects.includes('sponsoredValue+2'));
ok('Effetti temporanei Intesa +2',effects.includes('value:2,...companionBase'));
ok('Potenziamenti permanenti OVR +2',special.includes('sponsoredRequested+2'));
ok('Potenziamenti permanenti Intesa +2',special.includes('addMotivatorPermanentChemistry(player.id,2)'));
console.log(JSON.stringify({name:'Test aggiornamento Motivatore',passed:checks.filter(x=>x.ok).length,total:checks.length,checks},null,2));
