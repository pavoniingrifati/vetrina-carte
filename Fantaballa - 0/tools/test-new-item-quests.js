const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const items=read('assets/season/07b-items.js');
const match=read('assets/season/12-match-simulation.js');
const handlers=read('assets/season/event-handlers.js');
const events=JSON.parse(read('data/events/events-common.json'));
const css=read('assets/season/items.css');
const checks=[];
const check=(name,condition)=>checks.push({name,ok:Boolean(condition)});
const decision=(id)=>events.decisions.find(event=>event.id===id);

check('Guanti di Buffon definiti come oggetto raro permanente',items.includes("id:'buffon-gloves'")&&items.includes("rarity:'Raro'")&&items.includes("type:'Permanente'"));
check('Quest Saracinesca: 3 clean sheet in 4 partite',items.includes("id:'saracinesca'")&&items.includes('target:3,deadlineMatches:4'));
check('Guanti limitano i gol subiti a 2',match.includes('buffonGlovesActive()&&Number(officialGoalsAgainst)>2')&&match.includes('officialGoalsAgainst=2'));
check('Effetto Guanti registrato come permanente',items.includes("state.seasonRules.buffonGlovesActive=true"));

check('Gettone VAR definito come raro',items.includes("id:'var-token'")&&items.includes("rarity:'Raro'"));
check('Quest VAR dura 3 partite',items.includes("id:'non-era-mai-rigore'")&&items.includes('target:1,deadlineMatches:3'));
check('Quest VAR rileva rigore contro o rosso',items.includes("penaltyAgainst")&&items.includes("ownRedCard"));
check('VAR annulla squalifica o infortunio',items.includes("status.suspension=0")&&items.includes("status.injury=0"));
check('VAR compare nel riepilogo partita',match.includes('renderVarTokenResultActions(result)')&&match.includes('bindVarTokenResultControls'));

check('Pallone benedetto definito come raro',items.includes("id:'blessed-ball'")&&items.includes("rarity:'Raro'"));
check('Quest Zona Cesarini: un gol nel finale entro 3 gare',items.includes("id:'zona-cesarini'")&&items.includes('target:1,deadlineMatches:3'));
check('Pallone crea un gol tra 81 e 90',items.includes('const minute=81+Math.floor(Math.random()*10)'));
check('Pallone si attiva soltanto senza gol entro 80',items.includes('Number(event?.minute)<=80'));
check('Pallone integrato nella simulazione',match.includes("applyBlessedBallGoal(userGoalEvents"));

check('Bustina Panini definita come epica',items.includes("id:'panini-pack'")&&items.includes("rarity:'Epico'"));
check('Quest Internazionale richiede 8 club',items.includes("id:'internazionale'")&&items.includes('target:8'));
check('Bustina estrae tre candidati',items.includes('shuffle(paniniCandidatePool()).slice(0,3)'));
check('Bustina sostituisce un giocatore della rosa',items.includes('state.draft.roster[index].playerId=String(replacement.id)'));
check('Bustina rispetta i divieti del coach',items.includes('youngBeautifulAllowsPlayer(player)')&&items.includes('youngBeautifulAllowsPlayer(replacement)'));
check('Bustina ha interfaccia epica',css.includes('.season-item-row.is-epic')&&css.includes('.season-panini-modal'));

for(const id of ['quest-saracinesca','quest-non-era-mai-rigore','quest-zona-cesarini','quest-internazionale']){
 const e=decision(id);check(`Evento ${id} registrato`,Boolean(e&&e.questEvent&&e.userOnly&&e.choices?.length===2));
 check(`Handler ${id} registrato`,handlers.includes(`"${id}"`));
}

const failed=checks.filter(item=>!item.ok);
console.log(JSON.stringify({name:'Test nuovi oggetti e quest',passed:checks.length-failed.length,total:checks.length,checks},null,2));
if(failed.length)process.exit(1);
