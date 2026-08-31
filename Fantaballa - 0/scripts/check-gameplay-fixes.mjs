#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(resolve(ROOT,relative),'utf8');
const fail=message=>{console.error(`✗ ${message}`);process.exitCode=1};
const ok=message=>console.log(`✓ ${message}`);

const stateSource=await read('assets/season/03-state-and-data.js');
const draftSource=await read('assets/season/04-setup-and-draft.js');
const effectsSource=await read('assets/season/07-effects-quests-chains.js');
const realPlayers=JSON.parse(await read('data/giocatori-real.json'));
const legendPlayers=JSON.parse(await read('data/storico/giocatori-storici.json'));

if(/function roleOf\(p\)\{return p\.role\|\|/.test(stateSource))fail('roleOf usa ancora direttamente p.role senza normalizzazione.');
else if(!stateSource.includes('function normalizeMacroRole(value)')||!stateSource.includes('const explicit=normalizeMacroRole(p?.role)'))fail('normalizzazione macro-ruolo non trovata in roleOf.');
else ok('roleOf normalizza il ruolo dettagliato prima dell’uso.');

const POSITION_ROLE={P:'P',DC:'D',TS:'D',TD:'D',CDC:'C',CC:'C',COC:'C',AS:'A',AD:'A',ATT:'A'};
function normalizedRole(player){
 const raw=String(player?.role||'').trim().toUpperCase();
 if(['P','D','C','A'].includes(raw))return raw;
 if(POSITION_ROLE[raw])return POSITION_ROLE[raw];
 const positions=String(player?.Position||player?.position||'').split(',').map(value=>value.trim().toUpperCase()).filter(Boolean);
 return positions.map(code=>POSITION_ROLE[code]).find(Boolean)||'C';
}
const invalidLegend=legendPlayers.filter(player=>!['P','D','C','A'].includes(normalizedRole(player)));
if(invalidLegend.length)fail(`${invalidLegend.length} giocatori Legend non producono un macro-ruolo valido.`);
else {
 const counts={P:0,D:0,C:0,A:0};legendPlayers.forEach(player=>counts[normalizedRole(player)]++);
 ok(`Legend normalizzato: P ${counts.P} · D ${counts.D} · C ${counts.C} · A ${counts.A}.`);
}

const unknownReal=realPlayers.filter(player=>String(player?.nation||'').trim().toLowerCase()==='non indicata').length;
if(!draftSource.includes("'nonindicata'"))fail('"Non indicata" non è esclusa dalle nazionalità valide per l’Intesa.');
else ok(`Nazionalità placeholder protetta: ${unknownReal} giocatori REAL con "Non indicata".`);

if(!draftSource.includes('chemistryNationKey(other)===nationKey'))fail('Bonus nazione draft non usa la chiave nazionalità validata.');
else ok('Bonus nazione draft usa la chiave nazionalità validata.');

if(!draftSource.includes('if(key)subscriberNationCounts[key]'))fail('Conteggio subscriber per nazione include ancora chiavi nazionalità vuote/non valide.');
else ok('Subscriber draft esclude nazionalità non valide dal bonus di gruppo.');

if(/o\.nation===player\.nation/.test(effectsSource))fail('Intesa runtime usa ancora confronto grezzo della nazionalità.');
else if(!effectsSource.includes('chemistryNationKey(o)===nationKey'))fail('Intesa runtime non usa chemistryNationKey per il bonus subscriber.');
else ok('Intesa runtime esclude nazionalità non valide anche dal bonus subscriber.');

if(process.exitCode)process.exit(process.exitCode);
