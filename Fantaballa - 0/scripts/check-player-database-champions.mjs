#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
const html=fs.readFileSync(path.join(ROOT,'giocatori.html'),'utf8');
const players=JSON.parse(fs.readFileSync(path.join(ROOT,'data/champions/giocatori-champions.json'),'utf8'));
const clubs=JSON.parse(fs.readFileSync(path.join(ROOT,'data/champions/club-champions.json'),'utf8'));
function fail(msg){console.error(`[DATABASE CHAMPIONS] ${msg}`);process.exitCode=1;}
if(!/champions:\{label:'Champions League'/.test(html))fail('manca tab Champions League in giocatori.html');
if(!/data\/champions\/giocatori-champions\.json\?v=[a-f0-9]{12}/.test(html))fail('giocatori.html non carica il listone Champions con hash');
if(!/data\/champions\/club-champions\.json\?v=[a-f0-9]{12}/.test(html))fail('giocatori.html non carica i club Champions con hash');
if(!/database:'champions'/.test(html))fail('giocatori Champions non vengono marcati con database=champions');
if(!/`champions:\$\{club\.id\}`/.test(html))fail('club Champions non registrati nella mappa locale');
if(players.length!==970)fail(`attesi 970 giocatori Champions, trovati ${players.length}`);
if(clubs.filter(c=>c.uefa202627).length!==36)fail('attesi 36 club reali Champions');
const sentinels={'Harry Kane':'ATT','Christopher Nkunku':'ATT, AS','Bukayo Saka':'AD','Achraf Hakimi':'TD, AD'};
for(const [name,pos] of Object.entries(sentinels)){
 const p=players.find(x=>(x.fullName||x.name)===name); if(!p)fail(`manca ${name}`); else if(p.Position!==pos)fail(`${name}: ${p.Position} != ${pos}`);
}
const displayKeysByClub=new Set();
for(const p of players){if(!String(p.fullName||'').trim())fail(`${p.id}: fullName mancante`);const key=`${p.club}|${String(p.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}`;if(displayKeysByClub.has(key))fail(`nome breve duplicato nello stesso club: ${p.club} / ${p.name}`);displayKeysByClub.add(key);}
const shortSentinels={'Harry Kane':'Kane','Christopher Nkunku':'Nkunku','Erling Haaland':'Haaland','Bukayo Saka':'Saka','Achraf Hakimi':'Hakimi','Virgil van Dijk':'van Dijk'};
for(const [full,short] of Object.entries(shortSentinels)){const p=players.find(x=>x.fullName===full);if(!p)fail(`manca ${full}`);else if(p.name!==short)fail(`${full}: nome breve atteso ${short}, trovato ${p.name}`);}
if(!/player\.fullName\|\|''/.test(html))fail('la ricerca del database non include fullName');
if(!process.exitCode)console.log(`[DATABASE CHAMPIONS] OK: giocatori.html espone i ${players.length} giocatori Champions con cognome/nome breve e conserva fullName.`);
