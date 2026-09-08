#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
const players=JSON.parse(fs.readFileSync(path.join(ROOT,'data/champions/giocatori-champions.json'),'utf8'));
const posDb=JSON.parse(fs.readFileSync(path.join(ROOT,'data/champions/posizioni-champions-2026-27.json'),'utf8'));
const generator=fs.readFileSync(path.join(ROOT,'scripts/build-champions-data.mjs'),'utf8');
const allowed=new Set(['P','DC','TS','TD','CDC','CC','COC','AS','AD','ATT']);
const roleOf={P:'P',DC:'D',TS:'D',TD:'D',CDC:'C',CC:'C',COC:'C',AS:'A',AD:'A',ATT:'A'};
function fail(msg){console.error(`[CHAMPIONS POS] ${msg}`);process.exitCode=1;}
if(players.length!==970)fail(`attesi 970 giocatori, trovati ${players.length}`);
if(Object.keys(posDb?.players||{}).length!==players.length)fail(`database posizioni non copre tutto il listone`);
const ids=new Set();
for(const p of players){
 if(ids.has(p.id))fail(`ID duplicato ${p.id}`); ids.add(p.id);
 const tokens=String(p.Position||'').split(',').map(v=>v.trim()).filter(Boolean);
 if(!tokens.length||tokens.some(v=>!allowed.has(v)))fail(`${p.name}: posizione non valida ${p.Position}`);
 if(roleOf[tokens[0]]!==p.role)fail(`${p.name}: macro-ruolo ${p.role} incoerente con ${p.Position}`);
 const src=posDb.players[p.fullName||p.name];
 if(!src)fail(`${p.fullName||p.name}: manca nel database posizioni`);
 else if(src.Position!==p.Position||src.role!==p.role)fail(`${p.fullName||p.name}: output non allineato alla fonte posizioni`);
}
if(/function\s+choosePos\s*\(/.test(generator)||/const\s+posPatterns\s*=/.test(generator))fail('il generatore contiene ancora assegnazione pseudo-casuale delle posizioni');
const expected={
 'Harry Kane':'ATT',
 'Christopher Nkunku':'ATT, AS',
 'Erling Haaland':'ATT',
 'Bukayo Saka':'AD',
 'Achraf Hakimi':'TD, AD',
 'Virgil van Dijk':'DC',
 'Alphonso Davies':'TS, AS',
 'Michael Olise':'AD, COC',
 'Arda Güler':'AD, COC',
 'Ayden Heaven':'DC'
};
const byName=new Map(players.map(p=>[p.fullName||p.name,p]));
for(const [name,pos] of Object.entries(expected)){
 const p=byName.get(name); if(!p)fail(`manca ${name}`); else if(p.Position!==pos)fail(`${name}: atteso ${pos}, trovato ${p.Position}`);
}
const counts={}; for(const p of players)counts[p.positionSource]=(counts[p.positionSource]||0)+1;
if(!process.exitCode){
 console.log(`[CHAMPIONS POS] OK: ${players.length}/970 giocatori coperti; nessuna posizione pseudo-casuale.`);
 console.log(`[CHAMPIONS POS] fonti: ${Object.entries(counts).map(([k,v])=>`${k}=${v}`).join(', ')}`);
 console.log('[CHAMPIONS POS] controlli sentinella Kane/Nkunku/Haaland/Saka/Hakimi/Van Dijk e altri: OK.');
}
