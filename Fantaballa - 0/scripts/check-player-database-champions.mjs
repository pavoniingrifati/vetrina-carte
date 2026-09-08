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
 const p=players.find(x=>x.name===name); if(!p)fail(`manca ${name}`); else if(p.Position!==pos)fail(`${name}: ${p.Position} != ${pos}`);
}
if(!process.exitCode)console.log(`[DATABASE CHAMPIONS] OK: giocatori.html espone i ${players.length} giocatori Champions e i 36 club UEFA.`);
