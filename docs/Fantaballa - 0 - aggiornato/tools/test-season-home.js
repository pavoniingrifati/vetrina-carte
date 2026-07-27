const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/season/11-season-ui-and-lineup.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/season/season-home.css'),'utf8');
const checks=[];
function check(name,ok){checks.push({name,ok:Boolean(ok)});}
check('Home giornata dedicata',js.includes('class="season-home"'));
check('Partita protagonista',js.includes('season-home-match')&&js.includes('season-home-next-match'));
check('Evento e stato squadra affiancati',js.includes('season-home-primary-grid')&&js.includes('renderSeasonHomeAttention')&&js.includes('renderSeasonHomeStatus'));
check('Classifica contestuale',js.includes('renderSeasonNearbyStandings'));
check('Prossimi impegni',js.includes('renderSeasonUpcomingFixtures'));
check('Caos compatto',js.includes('renderSeasonHomeChaos'));
check('Pulsanti partita incorporati',js.includes('season-home-match-actions'));
check('Navigazione ai tab completa',js.includes('activateSeasonTab'));
check('Responsive desktop e mobile',css.includes('@media(max-width:1050px)')&&css.includes('@media(max-width:700px)'));
for(const page of ['campionato.html','campionato-real.html','tricolore-pisa.html']){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 check(`${page} carica CSS Home`,html.includes('assets/season/season-home.css?v=20260727-home1'));
 check(`${page} invalida cache JS Home`,html.includes('11-season-ui-and-lineup.js?v=20260727-home1'));
}
const failed=checks.filter(item=>!item.ok);
console.log(JSON.stringify({name:'Home giornata',passed:checks.length-failed.length,total:checks.length,checks},null,2));
if(failed.length)process.exit(1);
