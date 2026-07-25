const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
require(path.join(root,'assets/weekly-leaderboard.js'));
const api=global.FANTABALLA_WEEKLY_LEADERBOARD;
let failed=0,passed=0;
function check(name,condition){if(condition){passed++;console.log(`PASS ${name}`)}else{failed++;console.error(`FAIL ${name}`)}}
const rows=[
 {squadra:'Pisa',allenatore:'Legacy',modalita:'Sfida della settimana',modalita_tipo:'altro',punti:70,vittorie:22,gol_fatti:60,gol_subiti:20},
 {squadra:'Pisa',allenatore:'Recovered',modalita:'Classica',modalita_tipo:'classica',codice_vittoria:'sfida_settimana_pisa-20260725-abc',punti:72,vittorie:23,gol_fatti:61,gol_subiti:20},
 {squadra:'Pisa',allenatore:'Normale',modalita:'Fantacampionato del Ca***',modalita_tipo:'campionato_real',punti:80,vittorie:25,gol_fatti:70,gol_subiti:20},
 {squadra:'Pisa',allenatore:'Legacy',modalita:'Tricolore col Pisa!',modalita_tipo:'sfida_settimana',punti:75,vittorie:24,gol_fatti:65,gol_subiti:18}
];
const weekly=rows.filter(api.isWeekly).map(api.rowView);
const best=api.bestPerCoach(weekly);
check('Riconosce tipo canonico',api.isWeekly(rows[3]));
check('Riconosce etichetta legacy',api.isWeekly(rows[0]));
check('Recupera dal codice univoco',api.isWeekly(rows[1]));
check('Esclude Fantacampionato normale del Pisa',!api.isWeekly(rows[2]));
check('Mantiene il miglior risultato per allenatore',best.length===2&&best[0].coach==='Legacy'&&best[0].points===75);
check('Ordina per punti e differenza reti',best[1].coach==='Recovered');
const script=fs.readFileSync(path.join(root,'google-apps-script/invio_vittoria.gs'),'utf8');
check('Apps Script espone codice vittoria',/codice_vittoria:\s*submissionCode/.test(script));
check('Apps Script recupera righe legacy dal prefisso',/\^sfida_settimana_pisa\[-_\]/.test(script));
check('Apps Script filtra la classifica settimanale su richiesta',/filteredClassifica/.test(script)&&/requestParams\.modalita_tipo/.test(script));
console.log(`\n${passed} pass, ${failed} fail`);
process.exitCode=failed?1:0;
