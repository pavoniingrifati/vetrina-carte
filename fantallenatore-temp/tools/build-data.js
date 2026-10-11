'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const sourcePath=path.join(root,'data','serie-a.json');
const foreignSourcePath=path.join(root,'data','foreign-players.json');
const outputPath=path.join(root,'data_v302.js');
const database=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const foreignDatabase=JSON.parse(fs.readFileSync(foreignSourcePath,'utf8'));

function fail(message){ throw new Error(`Database Serie A non valido: ${message}`); }
if(Number(database.schemaVersion)!==1) fail('schemaVersion non supportata');
if(!Array.isArray(database.clubs)||!database.clubs.length) fail('club mancanti');
if(!Array.isArray(database.players)||!database.players.length) fail('giocatori mancanti');
if(Number(foreignDatabase.schemaVersion)!==2) fail('schemaVersion database estero non supportata');
if(!Array.isArray(foreignDatabase.players)||foreignDatabase.players.length!==300) fail('il catalogo estero deve contenere 300 giocatori');

const clubIds=new Set();
database.clubs.forEach((club,index)=>{
  if(!club?.id||!club?.name) fail(`club incompleto alla posizione ${index}`);
  if(clubIds.has(String(club.id))) fail(`club duplicato: ${club.id}`);
  clubIds.add(String(club.id));
});

const playerIds=new Set();
database.players.forEach((player,index)=>{
  if(!player?.id||!player?.name) fail(`giocatore incompleto alla posizione ${index}`);
  if(playerIds.has(String(player.id))) fail(`giocatore duplicato: ${player.id}`);
  if(!['P','D','C','A'].includes(player.role)) fail(`ruolo non valido per ${player.name}`);
  if(!clubIds.has(String(player.club))) fail(`club inesistente per ${player.name}: ${player.club}`);
  if(!Number.isFinite(Number(player.ovr))) fail(`OVR non valido per ${player.name}`);
  playerIds.add(String(player.id));
});

const foreignIds=new Set();
foreignDatabase.players.forEach((player,index)=>{
  if(!player?.id||!player?.name) fail(`giocatore estero incompleto alla posizione ${index}`);
  if(foreignIds.has(String(player.id))||playerIds.has(String(player.id))) fail(`ID giocatore estero duplicato: ${player.id}`);
  const allowedKeys=['id','name'];
  if(Object.keys(player).some(key=>!allowedKeys.includes(key))) fail(`il catalogo estero deve contenere soltanto ID e nome: ${player.name}`);
  foreignIds.add(String(player.id));
});

const banner='// FILE GENERATO: non modificare direttamente.\n// Fonti ufficiali: data/serie-a.json + data/foreign-players.json · eseguire node tools/build-data.js\n';
const foreignPlayers=foreignDatabase.players.map(player=>({...player,catalogVersion:foreignDatabase.catalogVersion||'foreign-names-v2'}));
const output=`${banner}window.FANTA_PLAYERS=${JSON.stringify(database.players)};\nwindow.FANTA_CLUBS=${JSON.stringify(database.clubs)};\nwindow.FANTA_FOREIGN_PLAYERS=${JSON.stringify(foreignPlayers)};\n`;
fs.writeFileSync(outputPath,output);
console.log(`Database generato: ${database.players.length} giocatori Serie A, ${database.clubs.length} club, ${foreignPlayers.length} giocatori esteri.`);
