const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const players=JSON.parse(fs.readFileSync(path.join(root,'data/giocatori-real.json'),'utf8')).filter(p=>String(p.club)==='pisa');
const clubs=JSON.parse(fs.readFileSync(path.join(root,'data/club-weekly-pisa.json'),'utf8'));
const config=fs.readFileSync(path.join(root,'assets/season-config-weekly-pisa.js'),'utf8');
const adapter=fs.readFileSync(path.join(root,'assets/season/weekly-pisa-mode.js'),'utf8');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const game=fs.readFileSync(path.join(root,'tricolore-pisa.html'),'utf8');
const leaderboard=fs.readFileSync(path.join(root,'sfida-settimana.html'),'utf8');
const finish=fs.readFileSync(path.join(root,'assets/season/13-market-and-finish.js'),'utf8');
const formations={
 '4-3-3':['AS','ATT','AD','CC','CDC','CC','TS','DC','DC','TD','P'],
 '4-4-2':['ATT','ATT','AS','CC','CC','AD','TS','DC','DC','TD','P'],
 '4-2-3-1':['ATT','AS','COC','AD','CDC','CDC','TS','DC','DC','TD','P'],
 '4-5-1':['ATT','AS','COC','AD','CC','CC','TS','DC','DC','TD','P'],
 '3-5-2':['ATT','ATT','AS','COC','AD','CC','CDC','DC','DC','DC','P'],
 '5-3-2':['ATT','ATT','CC','CDC','CC','TS','DC','DC','DC','TD','P'],
 '3-4-3':['AS','ATT','AD','AS','CC','CC','AD','DC','DC','DC','P'],
 '4-3-1-2':['ATT','ATT','COC','CC','CDC','CC','TS','DC','DC','TD','P']
};
const positions=p=>String(p.Position||'').split(',').map(x=>x.trim()).filter(Boolean);
function canBuild(slots){
 const used=new Set();
 const ordered=slots.map((slot,index)=>({slot,index,count:players.filter(p=>positions(p).includes(slot)).length})).sort((a,b)=>a.count-b.count);
 function walk(i){if(i===ordered.length)return true;const {slot}=ordered[i];for(const p of players){if(used.has(p.id)||!positions(p).includes(slot))continue;used.add(p.id);if(walk(i+1))return true;used.delete(p.id)}return false}
 return walk(0);
}
const checks=[];const check=(name,ok,details='')=>checks.push({name,ok:Boolean(ok),details});
check('20 club reali e Pisa presente',clubs.length===20&&clubs.some(c=>c.id==='pisa'),`club ${clubs.length}`);
check('Rosa Pisa completa',players.length===22,`giocatori ${players.length}`);
for(const [formation,slots] of Object.entries(formations))check(`Modulo ${formation} completabile`,canBuild(slots));
check('Config salvataggio separato',/saveBase:'fantaballa_sfida_settimana_pisa_v1'/.test(config));
check('Config squadra fissa Pisa',/clubId:'pisa'/.test(config)&&/fixedTeamName:'Pisa'/.test(config));
check('Invio consentito solo vincendo',/allowAnyFinish:false/.test(config)&&/if\(!allowAnyFinish&&!titleWon\)/.test(finish)&&/posizione_finale:allowAnyFinish\?regularRank:1/.test(finish));
check('Messaggio finale dedicato ai soli vincitori',/nella Sfida della settimana può inviare il risultato soltanto chi vince il Campionato/.test(finish)&&/Invia la vittoria alla/.test(finish));
check('Draft senza roll e reroll',/Nessun roll o reroll/.test(adapter)&&/refreshWeeklyDraft/.test(adapter));
check('Scelta esatta 11 + 3',/11 titolari \+ 3 riserve/.test(adapter)&&/selectionCount:14/.test(config));
check('Box home con immagine fornita',/macro-mode-card weekly-pisa/.test(home)&&/tricolore-pisa\.webp/.test(home));
check('Pagina gioco collegata al config weekly',/season-config-weekly-pisa\.js/.test(game)&&/weekly-pisa-mode\.js/.test(game));
check('Classifica dedicata e premio top 10',/Sfida della settimana/.test(leaderboard)&&/I primi 10 classificati ricevono un \+2 OVR al proprio giocatore/.test(leaderboard));
const failed=checks.filter(c=>!c.ok);
console.log(JSON.stringify({ok:!failed.length,summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},checks},null,2));
if(failed.length)process.exit(1);
