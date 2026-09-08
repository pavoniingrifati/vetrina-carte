#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
const SOURCE=path.join(ROOT,'data/champions/rose-uefa-2026-27.json');
const REAL_PLAYERS=path.join(ROOT,'data/giocatori-real.json');
const POSITIONS=path.join(ROOT,'data/champions/posizioni-champions-2026-27.json');
const REAL_CLUBS=path.join(ROOT,'data/club-real.json');
const OUT_PLAYERS=path.join(ROOT,'data/champions/giocatori-champions.json');
const OUT_CLUBS=path.join(ROOT,'data/champions/club-champions.json');
const CHECK=process.argv.includes('--check');
const source=JSON.parse(fs.readFileSync(SOURCE,'utf8'));
const realPlayers=JSON.parse(fs.readFileSync(REAL_PLAYERS,'utf8'));
const positionDb=JSON.parse(fs.readFileSync(POSITIONS,'utf8'));
const positionRecords=positionDb?.players||{};
const realClubs=JSON.parse(fs.readFileSync(REAL_CLUBS,'utf8'));
const natNames={ITA:'Italia',ARG:'Argentina',BRA:'Brasile',ESP:'Spagna',FRA:'Francia',ENG:'Inghilterra',GER:'Germania',POR:'Portogallo',NED:'Paesi Bassi',BEL:'Belgio',CRO:'Croazia',URU:'Uruguay',SRB:'Serbia',SUI:'Svizzera',TUR:'Turchia',POL:'Polonia',SCO:'Scozia',DEN:'Danimarca',NOR:'Norvegia',SWE:'Svezia',AUT:'Austria',GRE:'Grecia',MAR:'Marocco',ALG:'Algeria',COL:'Colombia',SEN:'Senegal',NGA:'Nigeria',CIV:"Costa d'Avorio",GHA:'Ghana',CMR:'Camerun',CAN:'Canada',USA:'Stati Uniti',MEX:'Messico',JPN:'Giappone',KOR:'Corea del Sud',UKR:'Ucraina',RUS:'Russia',GEO:'Georgia',SVK:'Slovacchia',SVN:'Slovenia',CZE:'Cechia',HUN:'Ungheria',ROU:'Romania',ALB:'Albania',FIN:'Finlandia',ISL:'Islanda',IRL:'Irlanda',NIR:'Irlanda del Nord',WAL:'Galles',BIH:'Bosnia ed Erzegovina',MNE:'Montenegro',MKD:'Macedonia del Nord',KOS:'Kosovo',ARM:'Armenia',AZE:'Azerbaigian',KAZ:'Kazakistan',UZB:'Uzbekistan',ISR:'Israele',GAB:'Gabon',GUI:'Guinea',GNB:'Guinea-Bissau',MLI:'Mali',BFA:'Burkina Faso',TUN:'Tunisia',EGY:'Egitto',ANG:'Angola',MOZ:'Mozambico',RSA:'Sudafrica',COD:'RD Congo',DOM:'Rep. Dominicana',ECU:'Ecuador',PAR:'Paraguay',VEN:'Venezuela',AUS:'Australia',NZL:'Nuova Zelanda',IDN:'Indonesia',CUW:'Curaçao',CPV:'Capo Verde',JAM:'Giamaica',RWA:'Ruanda',PAN:'Panama',LBY:'Libia',SUR:'Suriname',GLP:'Guadalupa',GAM:'Gambia',MTN:'Mauritania',HON:'Honduras'};
const realClubMap={inter:'inter',roma:'roma',napoli:'napoli',como:'como'};
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'')}
function bestRealMatch(clubId,name){const rid=realClubMap[clubId];if(!rid)return null;const target=norm(name);const pool=realPlayers.filter(p=>String(p.club)===rid);let hit=pool.find(p=>norm(p.name)===target);if(hit)return hit;const candidates=pool.filter(p=>{const n=norm(p.name);return target.length>=5&&n.length>=5&&(n.includes(target)||target.includes(n))});return candidates.length===1?candidates[0]:null}
function slug(v){return norm(v).slice(0,42)||'player'}
function hashInt(v){return Number.parseInt(crypto.createHash('sha1').update(String(v)).digest('hex').slice(0,8),16)>>>0}
const roleLabel={P:'Portiere',D:'Difensore',C:'Centrocampista',A:'Attaccante'};
const VALID_POSITIONS=new Set(['P','DC','TS','TD','CDC','CC','COC','AS','AD','ATT']);
const ROLE_BY_POSITION={P:'P',DC:'D',TS:'D',TD:'D',CDC:'C',CC:'C',COC:'C',AS:'A',AD:'A',ATT:'A'};
function positionRecord(clubId,name){
 const rec=positionRecords[name];
 if(!rec)throw new Error(`[CHAMPIONS] Posizione mancante per ${name} (${clubId}). Aggiorna data/champions/posizioni-champions-2026-27.json.`);
 if(rec.club&&rec.club!==clubId)throw new Error(`[CHAMPIONS] Club posizione incoerente per ${name}: ${rec.club} != ${clubId}`);
 const tokens=String(rec.Position||'').split(',').map(v=>v.trim()).filter(Boolean);
 if(!tokens.length||tokens.some(v=>!VALID_POSITIONS.has(v)))throw new Error(`[CHAMPIONS] Posizione non valida per ${name}: ${rec.Position}`);
 const expectedRole=ROLE_BY_POSITION[tokens[0]];
 if(!expectedRole||rec.role!==expectedRole)throw new Error(`[CHAMPIONS] Macro-ruolo incoerente per ${name}: ${rec.role} / ${rec.Position}`);
 return {...rec,Position:tokens.join(', ')};
}
const star={
 'Kylian Mbappé':93,'Erling Haaland':93,'Jude Bellingham':92,'Lamine Yamal':92,'Pedri':92,'Rodri':92,'Ousmane Dembélé':92,'Harry Kane':92,
 'Vinícius Júnior':91,'Florian Wirtz':91,'Michael Olise':91,'Jamal Musiala':91,'Vitinha':91,'Bukayo Saka':91,'Declan Rice':90,'William Saliba':90,'Gabriel':90,'Thibaut Courtois':90,'Gianluigi Donnarumma':90,'Alisson Becker':90,
 'Martin Ødegaard':89,'Bruno Guimarães':89,'Viktor Gyökeres':89,'Virgil van Dijk':89,'Nuno Mendes':89,'Willian Pacho':89,'Khvicha Kvaratskhelia':89,'Joshua Kimmich':89,'Rúben Dias':89,'Achraf Hakimi':89,'Julián Alvarez':89,'Victor Osimhen':89,'Rafael Leão':89,
 'Bruno Fernandes':89,'Alexander Isak':89,'Raphinha':89,'Federico Valverde':89,'Bernardo Silva':88,'Dominik Szoboszlai':88,'Alexis Mac Allister':88,'Ryan Gravenberch':87,'Bradley Barcola':88,'Désiré Doué':88,'João Neves':88,'Frenkie de Jong':88,'Jules Koundé':87,'Jan Oblak':88,'Cristian Romero':87,'Álex Baena':86,'Ademola Lookman':87,'Serhou Guirassy':87,'Gregor Kobel':87,'Nico Schlotterbeck':86,'Diogo Costa':87,'Matthijs de Ligt':86,'Youri Tielemans':86,'Rayan Cherki':87,'Phil Foden':88,'Enzo Fernández':88,'Joško Gvardiol':88,'Marc Guéhi':87,'Jeremy Doku':86,'Ronald Araújo':87,'Cody Gakpo':86,'Hugo Ekitiké':87,'Jonathan Tah':87,'Luis Díaz':88,'Alphonso Davies':87,'Gavi':87,'Dani Olmo':87,'Karim Adeyemi':86,'Anthony Gordon':86,'Fermín López':86,
 'Ederson':87,'Nathan Aké':86,'Milan Škriniar':86,'N\'Golo Kanté':86,'Romelu Lukaku':86,'Mason Greenwood':87,'Marco Asensio':85,'Leroy Sané':86,'İlkay Gündoğan':85,'Lucas Torreira':84,'Christopher Nkunku':86,'Péter Gulácsi':84,'David Raum':84,'Diogo Dalot':84,'Marcus Rashford':85,'Matheus Cunha':86,'Bryan Mbeumo':86,'Benjamin Šeško':85,'Isco':86,'Antony':84,'João Cancelo':86,'Marc Cucurella':86,'Trent Alexander-Arnold':88,'Ibrahima Konaté':87,'Denzel Dumfries':86
};
function generatedOvr(club,role,index,name){if(star[name]!=null)return star[name];const depth=index===0?2:index<=2?1:index>=10?-7:index>=7?-5:index>=5?-3:index>=3?-1:0;const jitter=(hashInt(`${club.id}|${name}`)%5)-2;const roleAdj=role==='P'?0:role==='A'?1:0;return Math.max(60,Math.min(93,Math.round(club.baseOvr+depth+jitter+roleAdj)))}
function palette(id,pot){const h=hashInt(id);const hue=h%360;const hue2=(hue+140+(pot*7))%360;return{primary:`hsl(${hue} 66% 38%)`,secondary:`hsl(${hue2} 60% 34%)`,accent:`hsl(${(hue+48)%360} 80% 55%)`,text:'#FFFFFF'}}
const players=[];let reused=0;const ids=new Set();
for(const club of source.clubs){for(const sourceRole of ['P','D','C','A']){club.players[sourceRole].forEach((raw,index)=>{const real=bestRealMatch(club.id,raw.name);const pos=positionRecord(club.id,raw.name);const role=pos.role;const Position=pos.Position;let id=`ucl-${club.id}-${slug(raw.name)}`;let suffix=2;while(ids.has(id))id=`ucl-${club.id}-${slug(raw.name)}-${suffix++}`;ids.add(id);let player;if(real){reused++;player={...real,id,name:raw.name,club:club.id,role,Position,roleLabel:roleLabel[role],uefaNat:raw.nat,positionSource:pos.source||'manual',positionConfidence:pos.confidence||'high',ovrSource:'fantaballa-real-2026-27'};}else{const ovr=generatedOvr(club,role,index,raw.name);player={id,name:raw.name,role,Position,roleLabel:roleLabel[role],nation:natNames[raw.nat]||raw.nat||'Non indicata',ovr,subscriber:'no',abbonato:'no',club:club.id,uefaNat:raw.nat,positionSource:pos.source||'manual',positionConfidence:pos.confidence||'medium',ovrSource:star[raw.name]!=null?'fantaballa-star-calibration':'fantaballa-ucl-calibration'};}players.push(player)})}}
const user=realClubs.find(c=>String(c.id)==='fantaballa-real')||{id:'fantaballa-real',name:'Fantaballa REAL',shortName:'REAL',colorClub:{primary:'#173A61',secondary:'#F2C84B',accent:'#E84A3A',text:'#FFFFFF'},defaultFormation:'4-3-3'};
const clubs=[{...user,pot:4,association:'FBA',championsUser:true,rosterSize:14},...source.clubs.map(c=>({id:c.id,name:c.name,shortName:c.shortName,colorClub:palette(c.id,c.pot),rosterSize:players.filter(p=>p.club===c.id).length,defaultFormation:'4-3-3',pot:c.pot,association:c.association,baseOvr:c.baseOvr,uefa202627:true}))];
function writeOrCheck(file,data){const text=JSON.stringify(data,null,2)+'\n';if(CHECK){const current=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';if(current!==text){console.error(`[CHAMPIONS] OUTDATED ${path.relative(ROOT,file)}`);process.exitCode=1}else console.log(`[CHAMPIONS] OK ${path.relative(ROOT,file)}`)}else{fs.writeFileSync(file,text,'utf8');console.log(`[CHAMPIONS] scritto ${path.relative(ROOT,file)}`)}}
const sourcePlayerNames=source.clubs.flatMap(c=>['P','D','C','A'].flatMap(r=>c.players[r].map(p=>p.name)));
const extraPositionNames=Object.keys(positionRecords).filter(name=>!sourcePlayerNames.includes(name));
if(Object.keys(positionRecords).length!==sourcePlayerNames.length||extraPositionNames.length){throw new Error(`[CHAMPIONS] Il database posizioni deve coprire esattamente il listone: posizioni=${Object.keys(positionRecords).length}, giocatori=${sourcePlayerNames.length}, extra=${extraPositionNames.length}`);}
writeOrCheck(OUT_PLAYERS,players);writeOrCheck(OUT_CLUBS,clubs);
const counts=Object.fromEntries(source.clubs.map(c=>[c.shortName,players.filter(p=>p.club===c.id).length]));
console.log(`[CHAMPIONS] ${source.clubs.length} club reali + Fantaballa; ${players.length} giocatori; ${reused} record riusati dal listone REAL.`);
if(!CHECK){const low=Object.entries(counts).filter(([,n])=>n<14);if(low.length)console.warn('[CHAMPIONS] rose sotto 14:',low)}
