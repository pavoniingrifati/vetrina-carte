/* Fantaballa Season Engine — 04-setup-and-draft.js
 * Configurazione squadra, interfaccia del draft, intesa e costruzione della rosa.
 * Modulo classico: l'ordine di caricamento è definito negli HTML del Campionato.
 */
function formationSlots(key=state.formation){return (FORMATION_LAYOUTS[key]||FORMATION_LAYOUTS['4-3-3']).map((row,index)=>({code:row[0],x:row[1],y:row[2],instanceId:`starter-${index}`}))}
const SEASON_ROSTER_SIZE=14;
function seasonStarterTarget(key=state.formation){return formationSlots(key).length}

function renderPitchBoardStrip(){
 const logo='site-icon-192.png';
 const token=()=>`<span class="season-board-token"><img src="${logo}" alt="" aria-hidden="true" decoding="async"><span class="season-board-word">Fantaballa</span></span>`;
 return `<div class="season-board-strip">${token()}${token()}${token()}</div>`;
}
function renderPitchBoardSide(side='left'){
 const logo='site-icon-192.png';
 const text=`<span class="season-board-side-token"><span class="season-board-vertical">Fantaballa</span></span>`;
 const icon=`<span class="season-board-side-token season-board-side-logo"><img src="${logo}" alt="" aria-hidden="true" decoding="async"></span>`;
 return `<div class="season-board-side ${side}">${text}${icon}${text}</div>`;
}

function seasonBenchTarget(key=state.formation){const rosterSize=state.phase==='draft'?SEASON_ROSTER_SIZE:Math.max(SEASON_ROSTER_SIZE,Array.isArray(state?.draft?.roster)?state.draft.roster.length:SEASON_ROSTER_SIZE);return Math.max(0,rosterSize-seasonStarterTarget(key))}
function seasonBenchNumbers(key=state.formation){return Array.from({length:seasonBenchTarget(key)},(_,index)=>index+1)}
function starterEntries(){return rosterPlayers().filter(r=>!r.bench)}
function benchEntries(){return rosterPlayers().filter(r=>r.bench)}
function draftComplete(){return starterEntries().length>=11&&benchEntries().length>=3}
function benchDraftPhase(){return starterEntries().length>=11}
function usedDraftPlayerIds(){return new Set(state.draft.roster.map(r=>String(r.playerId)))}
function occupiedStarterSlotIds(){return new Set(state.draft.roster.filter(r=>!r.bench).map(r=>String(r.slotId)))}
function openStarterSlots(){const used=occupiedStarterSlotIds();return formationSlots().filter(slot=>!used.has(slot.instanceId))}
function availableStarterSlotsForPlayer(player){return openStarterSlots().filter(slot=>userCompatible(player,slot.code))}
function draftPlayerIsValid(player){if(!player||!youngBeautifulAllowsPlayer(player)||usedDraftPlayerIds().has(String(player.id)))return false;const canStart=availableStarterSlotsForPlayer(player).length>0;const canBench=benchEntries().length<3;return canStart||canBench}
function draftCandidatesForClub(clubId){return PLAYERS.filter(player=>String(player.club)===String(clubId)&&draftPlayerIsValid(player)).sort((a,b)=>{const pa=positions(a)[0]||'',pb=positions(b)[0]||'';return pa.localeCompare(pb,'it')||(Number(b.ovr)||0)-(Number(a.ovr)||0)||String(a.name).localeCompare(String(b.name),'it')})}
function draftPossibleClubs(){const available=new Set();PLAYERS.forEach(player=>{if(player.club&&draftPlayerIsValid(player))available.add(String(player.club))});return CLUBS.map(club=>String(club.id)).filter(id=>available.has(id))}
function threeFiveTwoDraftPick(clubId,used,{slotCode='',role=''}={}){
 const valid=player=>player&&youngBeautifulAllowsPlayer(player)&&!used.has(String(player.id));
 const clubKey=String(clubId||'');
 const macro=slotCode?POSITION_ROLE[slotCode]:role;
 const tests=[];
 if(slotCode){
   tests.push(player=>String(player.club||'')===clubKey&&naturalCompatible(player,slotCode));
   tests.push(player=>naturalCompatible(player,slotCode));
 }
 if(macro){
   tests.push(player=>String(player.club||'')===clubKey&&roleOf(player)===macro);
   tests.push(player=>roleOf(player)===macro);
 }
 tests.push(player=>String(player.club||'')===clubKey);
 tests.push(()=>true);
 for(const test of tests){
   const candidates=shuffle(PLAYERS.filter(player=>valid(player)&&test(player)));
   if(candidates.length)return pick(candidates);
 }
 return null;
}
function buildThreeFiveTwoOpeningRoster(clubId){
 state.formation='3-5-2';
 state.seasonRules=state.seasonRules&&typeof state.seasonRules==='object'?state.seasonRules:{};
 state.seasonRules.userFormationOverride='3-5-2';
 const slots=formationSlots('3-5-2'),used=new Set(),starters=[];
 const ordered=slots.map((slot,index)=>({slot,index,count:PLAYERS.filter(player=>String(player.club||'')===String(clubId||'')&&naturalCompatible(player,slot.code)).length})).sort((a,b)=>a.count-b.count||a.index-b.index);
 for(const item of ordered){
   const player=threeFiveTwoDraftPick(clubId,used,{slotCode:item.slot.code});
   if(!player)return false;
   used.add(String(player.id));
   starters[item.index]={playerId:String(player.id),slotId:item.slot.instanceId,slot:item.slot.code,bench:false,player:{...player}};
 }
 const benchRoles=['P','D','A'],bench=[];
 for(let index=0;index<benchRoles.length;index++){
   const player=threeFiveTwoDraftPick(clubId,used,{role:benchRoles[index]});
   if(!player)return false;
   used.add(String(player.id));
   bench.push({playerId:String(player.id),slotId:`bench-${index+1}`,slot:`PAN${index+1}`,bench:true,player:{...player}});
 }
 state.draft.roster=[...starters,...bench];
 state.draft.clubId=String(clubId||'');
 state.draft.openingClubShown=true;
 state.draft.candidates=[];
 state.draft.pendingPlayerId='';
 state.draft.rerolls=0;
 mobileDraftTab='roster';
 return true;
}
function talentScoutOpeningClub(possibleClubIds=[]){
 if(!coachIs('talent-scout')||state.draft?.openingClubShown)return'';
 const coachKey=normalizeName(state.coachName),allowed=new Set((possibleClubIds||[]).map(String));if(!coachKey||!allowed.size)return'';
 const namesake=PLAYERS.find(player=>normalizeName(player?.name)===coachKey&&allowed.has(String(player?.club||''))&&draftPlayerIsValid(player))||PLAYERS.find(player=>normalizeName(player?.name)===coachKey&&allowed.has(String(player?.club||'')));
 return namesake?String(namesake.club||''):'';
}
function drawnClub(){return clubById(state.draft.clubId)}
function marketClub(){return clubById(state.midseason?.clubId)}
function playerInitials(name){return String(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?'}
function formationPositionSummary(key){const counts={};(FORMATIONS[key]||[]).forEach(code=>counts[code]=(counts[code]||0)+1);return Object.entries(counts).map(([code,count])=>count>1?`${code}×${count}`:code).join(' · ')}
function draftAverageOvr(){const list=rosterPlayers();return list.length?avg(list.map(r=>Number(r.player.ovr)||0)):0}
function draftSubscriberCount(){return rosterPlayers().filter(r=>String(r.player.subscriber).toLowerCase()==='si').length}
function formatSignedIntesa(value){const n=Math.round(Number(value)||0);return `${n>=0?'+':''}${n}`}
function isItalianPlayer(player){const nation=normalizeName(player?.nation||'');return nation==='italia'||nation==='italy'||nation==='italiano'||nation==='italiana'}
function closedPortsAffects(player,rules=state?.seasonRules){return Boolean(rules?.nonItalianChemZero)&&Boolean(player)&&!isItalianPlayer(player)}
function playerClubChemistryKey(player){return normalizeName(player&&player.club||'')}
function nationMirrorsClub(player){
 const club=clubById(player&&player.club);
 return !!club&&normalizeName(player&&player.nation||'')===normalizeName(club.name||'');
}
function nationChemistryBonus(player,list){
 if(!player||nationMirrorsClub(player))return 0;
 const playerId=String(player.id);
 const nationKey=normalizeName(player.nation||'');
 if(!nationKey)return 0;
 const sameNation=(list||[]).filter(other=>other&&String(other.id)!==playerId&&normalizeName(other.nation||'')===nationKey).length;
 return Math.min(8,sameNation);
}
function clubChemistryBonus(player,list){
 if(!player)return 0;
 const playerId=String(player.id);
 const clubKey=playerClubChemistryKey(player);
 if(!clubKey)return 0;
 return (list||[]).reduce((total,other)=>{
   if(!other||String(other.id)===playerId||playerClubChemistryKey(other)!==clubKey)return total;
   return total+(roleOf(other)===roleOf(player)?2:1);
 },0);
}
function draftChemistry(source=starterEntries()){
 const entries=(Array.isArray(source)?source:[]).filter(item=>item&&!item.bench);
 const players=entries.map(item=>item.player||item).filter(Boolean);
 const subscriberNationCounts={};
 players.forEach(player=>{if(isSubscriber(player)){const key=normalizeName(player.nation);subscriberNationCounts[key]=(subscriberNationCounts[key]||0)+1}});
 const playerBonus={};
 const playerBaseBonus={};
 const playerClubBonus={};
 const playerSubscriberBonus={};
 const playerCoachBonus={};
 players.forEach(player=>{
   const playerId=String(player.id);
   if(closedPortsAffects(player)){playerBaseBonus[playerId]=0;playerClubBonus[playerId]=0;playerSubscriberBonus[playerId]=0;playerCoachBonus[playerId]=0;playerBonus[playerId]=0;return}
   const base=nationChemistryBonus(player,players);
   const clubBonus=clubChemistryBonus(player,players);
   const nationKey=normalizeName(player.nation);
   const subscriberBase=isSubscriber(player)?5:0;
   const subscriberPair=isSubscriber(player)&&(subscriberNationCounts[nationKey]||0)>=2?10:0;
   const subscriberTotal=subscriberBase+subscriberPair;
   const coachBonus=(normalizeName(player.name)===normalizeName(state.coachName)?10:0)+youngBeautifulChemistryBonus(player);
   playerBaseBonus[playerId]=base;
   playerClubBonus[playerId]=clubBonus;
   playerSubscriberBonus[playerId]=subscriberTotal;
   playerCoachBonus[playerId]=coachBonus;
   playerBonus[playerId]=base+clubBonus+subscriberTotal+coachBonus;
 });
 if(parallelCupChemistryZero()||coachIs('ductility')){
   [playerBonus,playerBaseBonus,playerClubBonus,playerSubscriberBonus,playerCoachBonus].forEach(map=>Object.keys(map).forEach(key=>map[key]=0));
 }else{
   const cupMultiplier=parallelCupChemistryMultiplier();
   if(cupMultiplier!==1)[playerBonus,playerBaseBonus,playerClubBonus,playerSubscriberBonus,playerCoachBonus].forEach(map=>Object.keys(map).forEach(key=>map[key]=(Number(map[key])||0)*cupMultiplier));
 }
 const totalBonus=Object.values(playerBonus).reduce((sum,value)=>sum+value,0);
 const baseTotalBonus=Object.values(playerBaseBonus).reduce((sum,value)=>sum+value,0);
 const clubTotalBonus=Object.values(playerClubBonus).reduce((sum,value)=>sum+value,0);
 const subscriberTotalBonus=Object.values(playerSubscriberBonus).reduce((sum,value)=>sum+value,0);
 const coachTotalBonus=Object.values(playerCoachBonus).reduce((sum,value)=>sum+value,0);
 const averageBonus=players.length?totalBonus/players.length:0;
 const score=players.length?Math.max(0,Math.min(100,Math.round((averageBonus/31)*100))):0;
 return {players,playerBonus,playerBaseBonus,playerClubBonus,playerSubscriberBonus,playerCoachBonus,totalBonus,baseTotalBonus,clubTotalBonus,subscriberTotalBonus,coachTotalBonus,averageBonus,score};
}
function draftEffectiveAverageOvr(chem=draftChemistry()){
 return chem.players.length?avg(chem.players.map(player=>ductilityEffectiveBaseOvr(player)+(chem.playerBonus[String(player.id)]||0))):0;
}
function draftCandidateChemPreview(player){
 if(!player||benchDraftPhase())return 0;
 const previewEntries=[...starterEntries(),{playerId:String(player.id),player,bench:false}];
 const preview=draftChemistry(previewEntries);
 return preview.playerBonus[String(player.id)]||0;
}
function renderDraftChemistryCard(chem=draftChemistry()){
 const effective=draftEffectiveAverageOvr(chem);
 return `<div class="season-chemistry-card"><div class="season-chemistry-head"><span>Intesa titolari</span><b>${chem.score}/100</b></div><div class="season-chemistry-bar"><i style="width:${chem.score}%"></i></div><div class="season-chemistry-total"><span>Bonus totale</span><b>${formatSignedIntesa(chem.totalBonus)}</b></div><div class="season-chemistry-breakdown"><span>NAZ ${formatSignedIntesa(chem.baseTotalBonus)}</span><span>CLUB ${formatSignedIntesa(chem.clubTotalBonus)}</span><span>ABB ${formatSignedIntesa(chem.subscriberTotalBonus)}</span><span>ALL ${formatSignedIntesa(chem.coachTotalBonus)}</span></div><div class="season-chemistry-effective"><span>OVR titolari con intesa</span><b>${chem.players.length?effective.toFixed(1):'—'}</b></div><small>Le 3 riserve non aumentano l’intesa finché restano in panchina.</small></div>`;
}
function remainingSlotSummary(){const counts={};openStarterSlots().forEach(slot=>counts[slot.code]=(counts[slot.code]||0)+1);return Object.entries(counts).map(([code,count])=>count>1?`${code}×${count}`:code).join(' · ')||'Completati'}
function waitDraft(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function packNationFontSize(name){const len=String(name||'').trim().length;if(len<=8)return 30;if(len<=11)return 25;if(len<=15)return 21;if(len<=19)return 18;return 15}
function teamNameFontSize(name){const len=String(name||'').trim().length;if(len<=10)return 34;if(len<=14)return 29;if(len<=18)return 24;if(len<=22)return 20;return 16}
function applyPackNationLabel(el,name){if(!el)return;el.textContent=name;el.style.fontSize=`${packNationFontSize(name)}px`;el.title=name}

function isSubscriber(player){return String(player&&player.subscriber||'').trim().toLowerCase()==='si'}
function isCreator(player){return String(player&&player.creator||'').trim().toLowerCase()==='si'}
function hashString(str){let h=2166136261>>>0;for(const ch of String(str||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function seededChoice(list,seed,shift=0){return list[(Math.floor(seed/Math.pow(7,shift))>>>0)%list.length]}
function avatarHexToRgb(color){
 const value=String(color||'').trim();
 const match=value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
 if(!match)return null;
 let hex=match[1];
 if(hex.length===3)hex=hex.split('').map(ch=>ch+ch).join('');
 return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
}
function avatarRgbToHex(rgb){return `#${rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}`}
function avatarMix(a,b,t=.5){
 const ra=avatarHexToRgb(a)||[24,44,74], rb=avatarHexToRgb(b)||[255,255,255];
 return avatarRgbToHex(ra.map((v,i)=>v+(rb[i]-v)*t));
}
function avatarShade(color,amount=.15){return amount>=0?avatarMix(color,'#ffffff',amount):avatarMix(color,'#000000',Math.abs(amount))}
function avatarLuma(color){const rgb=avatarHexToRgb(color)||[255,255,255];return (0.299*rgb[0]+0.587*rgb[1]+0.114*rgb[2])/255}
function avatarTextColor(color){return avatarLuma(color)>.63?'#10243a':'#ffffff'}
function avatarRoleCode(player){return String(player?.Position||player?.role||'').toUpperCase().split(',')[0].trim()||'--'}
function avatarIsGoalkeeper(player){return /^(P|POR|GK)$/.test(avatarRoleCode(player))}
function avatarSourceKey(player){
 const source=player?.clubName||player?.teamName||player?.squadra||player?.team||player?.club||player?.nation||'Fantaballa';
 return String(source);
}
function avatarClubInfo(player){
 const clubId=player?.club||player?.clubId||'';
 const club=clubId&&typeof clubById==='function'?clubById(clubId):null;
 const colors=club?.colorClub||club?.colors||{};
 const primary=colors.primary||'#1769AA';
 const secondary=colors.secondary||avatarShade(primary,.45);
 const accent=colors.accent||avatarMix(primary,secondary,.5);
 const text=colors.text||avatarTextColor(primary);
 return {name:club?.name||avatarSourceKey(player),shortName:club?.shortName||String(club?.name||avatarSourceKey(player)).slice(0,3).toUpperCase(),primary,secondary,accent,text};
}
function avatarTier(player){
 const ovr=Number(player?.ovr)||0;
 if(ovr>=90)return {key:'legend',glow:'#f6d365',rim:'#fff1a8',spark:'#fff8cf',stars:4,label:'LEG'};
 if(ovr>=85)return {key:'elite',glow:'#b993ff',rim:'#eedcff',spark:'#f6efff',stars:3,label:'ELI'};
 if(ovr>=80)return {key:'gold',glow:'#f7c948',rim:'#ffefad',spark:'#fff8da',stars:2,label:'GLD'};
 if(ovr>=75)return {key:'silver',glow:'#b7c5d3',rim:'#eef4f8',spark:'#ffffff',stars:1,label:'SLV'};
 return {key:'base',glow:'#8fb4d8',rim:'rgba(255,255,255,.4)',spark:'rgba(255,255,255,.8)',stars:0,label:'ROO'};
}
function avatarPalette(player){
 const club=avatarClubInfo(player);
 const tier=avatarTier(player);
 const isGoalkeeper=avatarIsGoalkeeper(player);
 const primary=isGoalkeeper?avatarMix(club.primary,'#16a34a',.28):club.primary;
 const secondary=isGoalkeeper?avatarMix(club.secondary,'#facc15',.22):club.secondary;
 const accent=isGoalkeeper?avatarMix(club.accent,'#ffffff',.18):club.accent;
 const bg1=avatarShade(primary,-.16), bg2=avatarShade(secondary,.12), glow=avatarMix(primary,tier.glow,.38);
 return {primary,secondary,accent,bg1,bg2,glow,rim:tier.rim,text:club.text,club};
}
function avatarSeed(player){
 const role=avatarRoleCode(player);
 const source=avatarSourceKey(player);
 const seed=hashString(`${player?.name||''}|${player?.nation||''}|${role}|${source}`);
 const preset={
  seed,
  skin:seededChoice(['#f6caa5','#edb98f','#d99870','#be805b','#915b40','#f0d5bb'],seed,1),
  hair:seededChoice(['#1b1512','#432818','#6f4e37','#c18f59','#d8d8d8','#111827','#7f1d1d','#312e81'],seed,2),
  eyebrows:seededChoice(['#2a1a12','#4a2d1d','#6b4423','#40240f'],seed,3),
  faceShape:seededChoice(['round','oval','square'],seed,4),
  hairStyle:seededChoice(['crop','part','curly','spike','fade','long'],seed,5),
  eyeStyle:seededChoice(['dot','smile','focused','wide'],seed,6),
  mouthStyle:seededChoice(['smile','serious','grin'],seed,7),
  beardStyle:seededChoice(['none','none','stubble','goatee','moustache'],seed,8),
  accessory:seededChoice(['none','none','glasses','headband'],seed,9),
  kitStyle:seededChoice(['stripe','sash','hoops','split','solid'],seed,10)
 };
 const creatorStyle=String(player?.creatorStyle||'').trim().toLowerCase();
 const creatorName=String(player?.name||'').trim().toLowerCase();
 const isBaroneSportivo=creatorStyle==='barone-sportivo'||String(player?.id||'')==='850'||creatorName==='barone sportivo';
 const isStefanoFinari=creatorStyle==='stefano-finari'||String(player?.id||'')==='851'||creatorName==='stefano finari';
 if(isBaroneSportivo){
  preset.skin='#f0d5bb';
  preset.hair='#8a5a33';
  preset.eyebrows='#5a371d';
  preset.faceShape='oval';
  preset.hairStyle='part';
  preset.eyeStyle='focused';
  preset.mouthStyle='serious';
  preset.beardStyle='stubble';
  preset.accessory='topHat';
  preset.kitStyle='solid';
 }
 if(isStefanoFinari){
  preset.skin='#f0c39f';
  preset.hair='#3a241a';
  preset.eyebrows='#251812';
  preset.faceShape='oval';
  preset.hairStyle='fade';
  preset.eyeStyle='wide';
  preset.mouthStyle='smile';
  preset.beardStyle='moustache';
  preset.accessory='none';
  preset.kitStyle='solid';
 }
 return preset;
}
function renderAvatarSvg(player,sub=false){
 const a=avatarSeed(player), p=avatarPalette(player), tier=avatarTier(player), id=`av-${a.seed}`, overall=Number(player?.ovr)||0;
 const face=a.faceShape==='square'
   ? `<rect x="18" y="14" width="48" height="54" rx="16" fill="${a.skin}" stroke="rgba(90,52,31,.18)" stroke-width="1.2"/>`
   : `<ellipse cx="42" cy="41" rx="${a.faceShape==='oval'?23:24}" ry="${a.faceShape==='oval'?28:26}" fill="${a.skin}" stroke="rgba(90,52,31,.18)" stroke-width="1.2"/>`;
 const ears=`<ellipse cx="15.2" cy="41.5" rx="4.8" ry="7.6" fill="${a.skin}"/><ellipse cx="68.8" cy="41.5" rx="4.8" ry="7.6" fill="${a.skin}"/>`;
 const cheeks=`<circle cx="26.5" cy="52.2" r="2.6" fill="rgba(255,147,147,.14)"/><circle cx="57.5" cy="52.2" r="2.6" fill="rgba(255,147,147,.14)"/>`;
 const neck=`<rect x="37.2" y="62" width="9.6" height="9.8" rx="4.2" fill="${a.skin}" opacity=".98"/>`;
 const collar=`<path d="M31 82c1.6-7.6 6.8-13 11-13 4.2 0 9.4 5.4 11 13" fill="rgba(255,255,255,.08)"/>`;
 const hairMap={
   crop:`<path d="M18.5 31c2.6-13.4 12.4-21.4 23.5-21.4 10.8 0 19.8 5.6 23.3 18.8-6.4-2.9-13.8-4.1-23.3-4.1-9.8 0-16.8 2.5-23.5 6.7z" fill="${a.hair}"/>`,
   part:`<path d="M18.4 31c4.8-12.8 14.6-20.8 23.6-20.8 8.6 0 16.6 5.2 21.8 18-5.5-2.4-10.8-3.6-15.7-3.6l-5.8 8-5.8-8c-6.8 0-12.6 2.2-18.1 6.4z" fill="${a.hair}"/>`,
   curly:`<path d="M18.9 32c3.8-12.6 12.2-20.5 22-20.5 10.5 0 18.6 5.4 22.1 16.5-1.4-.6-2.8-.8-4.5-.8 0 0-1.2-5-4.9-5-2.5 0-3.8 2.5-3.8 2.5s-2.3-5-6.5-5-5.4 3.5-5.4 3.5-2.2-3.2-5.9-2.2c-4 1.1-5.4 6-5.4 6s-2.8 1.2-3.7 5z" fill="${a.hair}"/>`,
   spike:`<path d="M19.2 33c1.4-5.2 5.2-12.8 10.2-18.2l5 4.8 5.2-7.6 6.2 7.2 4.8-6c5.2 4 9.2 10.5 10.4 19-6.4-4.2-12.8-6.4-21.6-6.4-8.4 0-14.8 2.4-20.2 7.2z" fill="${a.hair}"/>`,
   fade:`<path d="M22.3 31.5C26 20 33.7 14.2 42 14.2c9.3 0 16.7 5.5 20.3 15.7-4.9-2.1-10.6-3-18.9-3-8.5 0-14.4 1.8-21.1 4.6z" fill="${a.hair}"/><path d="M20.6 32.5c1.3-5 3.5-9.5 6-12-2.3 6.2-2.4 10.5-.9 15.4-1.8.8-3.4 1.4-5.1 2.2z" fill="${a.hair}" opacity=".32"/><path d="M58.8 20.5c2.4 2.8 4.8 7.4 5.7 11.8-1.8-.8-3.7-1.4-5.5-1.8 1-4.7.7-7.6-.2-10z" fill="${a.hair}" opacity=".32"/>`,
   long:`<path d="M18.8 30.5c4.6-13 12.4-20.2 23.2-20.2 10.4 0 18.6 5.5 22 17-5.2-2.2-10.3-3.2-16.2-3.2-10.8 0-18 3.2-24.5 9z" fill="${a.hair}"/><path d="M20.2 33.3c1.2 10.8 1.2 19.2-1.1 28.2 4.8-2.5 8.8-6.8 10.2-14l1.1-14.2z" fill="${a.hair}" opacity=".92"/><path d="M63.8 33.3c-1.2 10.8-1.2 19.2 1.1 28.2-4.8-2.5-8.8-6.8-10.2-14l-1.1-14.2z" fill="${a.hair}" opacity=".92"/>`
 };
 const brows=`<path d="M26.6 34.5c3-1.8 6.2-2.6 9.7-2.4" fill="none" stroke="${a.eyebrows}" stroke-width="2" stroke-linecap="round"/><path d="M47 32.1c3.5-.2 6.7.6 9.7 2.4" fill="none" stroke="${a.eyebrows}" stroke-width="2" stroke-linecap="round"/>`;
 const eyesMap={
   dot:`<circle cx="33.2" cy="42.3" r="2.1" fill="#1b1a17"/><circle cx="50.8" cy="42.3" r="2.1" fill="#1b1a17"/>`,
   smile:`<path d="M30 42.5c1.5 1.9 3 2.6 4.6 2.6 1.5 0 3-.7 4.5-2.6" fill="none" stroke="#1b1a17" stroke-width="1.55" stroke-linecap="round"/><path d="M45 42.5c1.5 1.9 3 2.6 4.6 2.6 1.5 0 3-.7 4.5-2.6" fill="none" stroke="#1b1a17" stroke-width="1.55" stroke-linecap="round"/>`,
   focused:`<path d="M30 42.1h6.8" stroke="#1b1a17" stroke-width="1.65" stroke-linecap="round"/><path d="M47.2 42.1H54" stroke="#1b1a17" stroke-width="1.65" stroke-linecap="round"/><circle cx="33.2" cy="42.8" r="1.2" fill="#1b1a17"/><circle cx="50.8" cy="42.8" r="1.2" fill="#1b1a17"/>`,
   wide:`<ellipse cx="33.2" cy="42.3" rx="3.1" ry="2.6" fill="#fff"/><ellipse cx="50.8" cy="42.3" rx="3.1" ry="2.6" fill="#fff"/><circle cx="33.2" cy="42.3" r="1.5" fill="#1b1a17"/><circle cx="50.8" cy="42.3" r="1.5" fill="#1b1a17"/>`
 };
 const nose=`<path d="M42 45c1.9 2.8 2 5.8-.1 7.4" fill="none" stroke="rgba(119,74,46,.32)" stroke-width="1.45" stroke-linecap="round"/>`;
 const mouthMap={
   smile:`<path d="M33 56c3.3 2.9 6 4 9 4 3 0 5.7-1.1 9-4" fill="none" stroke="rgba(110,47,34,.94)" stroke-width="2" stroke-linecap="round"/>`,
   serious:`<path d="M34.2 56.4h15.6" fill="none" stroke="rgba(110,47,34,.94)" stroke-width="1.95" stroke-linecap="round"/>`,
   grin:`<path d="M32.4 54.8c3 3.8 6.1 5.1 9.6 5.1 3.2 0 6.5-1.3 9.6-5.1" fill="#fff8ef" stroke="rgba(110,47,34,.94)" stroke-width="1.65" stroke-linejoin="round"/>`
 };
 const beardMap={
   none:'',
   stubble:`<path d="M28.2 52.8c3 8.4 8.4 13.2 13.8 13.2 5.5 0 10.8-4.8 13.8-13.2" fill="rgba(138,90,51,.38)"/><path d="M30 55.5c2.8 4.6 7.2 7.5 12 7.5s9.2-2.9 12-7.5" fill="none" stroke="rgba(169,112,65,.72)" stroke-width="1.45" stroke-linecap="round"/>`,
   goatee:`<path d="M37.1 57c1.3 5.6 3 10 4.9 12.3 1.9-2.3 3.6-6.7 4.9-12.3" fill="rgba(58,37,23,.58)"/><path d="M34.4 54.6c2.4 2.3 5.1 3.3 7.6 3.3 2.5 0 5.2-.9 7.6-3.3" fill="rgba(58,37,23,.46)"/>`,
   moustache:`<path d="M33.8 51c1.9 2 4.3 2.8 6.6 2.8 0 0 .5-1.5 1.6-1.5 1.2 0 1.6 1.5 1.6 1.5 2.3 0 4.7-.8 6.6-2.8-1.9 3.2-4.2 4.8-7.4 4.8h-1.6c-3.2 0-5.5-1.6-7.4-4.8z" fill="rgba(58,37,23,.72)"/>`
 };
 const accessoryMap={
   none:'',
   glasses:`<g stroke="#0f172a" stroke-width="1.9" fill="rgba(219,234,254,.25)"><rect x="25.4" y="38.2" width="13.4" height="9.6" rx="3.2"/><rect x="45.2" y="38.2" width="13.4" height="9.6" rx="3.2"/><path d="M38.8 43h6.4"/></g>`,
   headband:`<path d="M23.2 31.4c6-2.8 12-4.1 18.8-4.1 6.8 0 12.8 1.3 18.8 4.1" fill="none" stroke="#ef4444" stroke-width="4.2" stroke-linecap="round" opacity=".92"/>`,
   topHat:`<g><ellipse cx="42" cy="20.2" rx="22.5" ry="5.6" fill="#0f1115" opacity=".98"/><path d="M26 21V9.8c0-2.5 2-4.5 4.5-4.5h23c2.5 0 4.5 2 4.5 4.5V21z" fill="#15171c"/><rect x="24.5" y="19.2" width="35" height="3.6" rx="1.8" fill="#292c32"/><path d="M27 9.6h30" stroke="rgba(255,255,255,.18)" stroke-width="1.1" stroke-linecap="round"/></g>`
 };
 const sparkles=tier.stars?`<g fill="${tier.spark}" opacity=".86"><circle cx="21" cy="15" r="1.4"/><circle cx="61" cy="14" r="1.2"/><path d="M63 26l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/></g>`:'';
 const crown=sub?`<g><circle cx="15" cy="15" r="8.8" fill="#f6c74e" stroke="#fff5bf" stroke-width="1.1"/><path d="M10.2 17.5l1.5-5 3 2.2 2.6-3.3 2.6 3.3 3-2.2 1.5 5z" fill="#8b5a00"/></g>`:'';
 const topMark=overall>=88?`<g><circle cx="68.5" cy="15.5" r="8.2" fill="${tier.glow}"/><text x="68.5" y="18.6" text-anchor="middle" font-size="6.2" font-weight="900" fill="#10243a" font-family="system-ui, sans-serif">TOP</text></g>`:'';
 const rimColor=sub ? '#ffe76a' : tier.rim;
 return `<svg viewBox="0 0 84 84" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${avatarShade(p.bg1,.08)}"/><stop offset="100%" stop-color="${avatarShade(p.bg2,.02)}"/></linearGradient><radialGradient id="${id}-halo" cx="50%" cy="38%" r="60%"><stop offset="0%" stop-color="${avatarShade(p.glow,.42)}" stop-opacity=".82"/><stop offset="100%" stop-color="${avatarShade(p.glow,-.18)}" stop-opacity="0"/></radialGradient><radialGradient id="${id}-shine" cx="28%" cy="18%" r="70%"><stop offset="0%" stop-color="rgba(255,255,255,.38)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient></defs><rect x="4.5" y="4.5" width="75" height="75" rx="22" fill="url(#${id}-bg)"/><circle cx="42" cy="40" r="29" fill="url(#${id}-halo)"/>${collar}${neck}${ears}${face}${hairMap[a.hairStyle]||hairMap.crop}${cheeks}${accessoryMap[a.accessory]||''}${brows}${eyesMap[a.eyeStyle]||eyesMap.dot}${nose}${mouthMap[a.mouthStyle]||mouthMap.smile}${beardMap[a.beardStyle]||''}${sparkles}${crown}${topMark}<rect x="4.5" y="4.5" width="75" height="75" rx="22" fill="url(#${id}-shine)" opacity=".55"/><rect x="4.5" y="4.5" width="75" height="75" rx="22" fill="none" stroke="${rimColor}" stroke-width="${sub?'2.2':overall>=85?'1.7':'1.2'}"/></svg>`;
}
function renderMiniAvatar(player,extra=''){
 const sub=isSubscriber(player), creator=isCreator(player);
 const badge=sub?'<span class="av-subscriber-badge">★</span>':creator?'<span class="av-creator-badge">CR</span>':'';
 return `<span class="season-mini-avatar ${sub?'subscriber':''} ${creator?'creator':''} ${extra}" style="background:transparent!important">${renderAvatarSvg(player,sub)}${badge}</span>`;
}

function nationPalette(name){
 const seed=hashString(name||'nation');
 const hue=seed%360; const hue2=(hue+((seed>>4)%90)+30)%360; const hue3=(hue+((seed>>7)%170)+110)%360;
 const a=`hsl(${hue} 72% 56%)`; const b=`hsl(${hue2} 68% 42%)`; const c=`hsl(${hue3} 82% 92%)`;
 const ink=((seed>>10)%2)?'#10243a':'#1d160e';
 return {a,b,c,ink}
}
function jerseyColorRgb(color){
 const value=String(color||'').trim();
 let match=value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
 if(match){
  let hex=match[1];
  if(hex.length===3)hex=hex.split('').map(ch=>ch+ch).join('');
  if(hex.length===8)hex=hex.slice(0,6);
  return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
 }
 match=value.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i);
 if(match)return [Number(match[1]),Number(match[2]),Number(match[3])];
 match=value.match(/^hsla?\(\s*([\d.]+)(?:deg)?[ ,]+([\d.]+)%[ ,]+([\d.]+)%/i);
 if(match){
  const h=((Number(match[1])%360)+360)%360/360,s=Number(match[2])/100,l=Number(match[3])/100;
  const hueToRgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p};
  if(s===0){const gray=Math.round(l*255);return[gray,gray,gray]}
  const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
  return [Math.round(hueToRgb(p,q,h+1/3)*255),Math.round(hueToRgb(p,q,h)*255),Math.round(hueToRgb(p,q,h-1/3)*255)];
 }
 return null;
}
function jerseyNumberColor(color){
 const rgb=jerseyColorRgb(color);
 if(!rgb)return '#111111';
 const brightness=(rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000;
 return brightness<150?'#FFFFFF':'#111111';
}
function renderPlayerJersey(player,extra='',chemistryBonus=0){
 const pal=clubPalette(activeUserClub()); const sub=isSubscriber(player); const currentChem=effectiveChemistryFromBase(player,chemistryBonus); const shownOvr=Math.round(ductilityEffectiveBaseOvr(player)+currentChem+activeOvrBonus(player));
 const numberColor=jerseyNumberColor(pal.b||pal.secondary||pal.a);
 return `<span class="season-jersey-wrap ${sub?'subscriber':''} ${extra}" style="--nation-a:${pal.a};--nation-b:${pal.b};--nation-c:${pal.c};--nation-ink:${pal.ink};--jersey-number-color:${numberColor}" title="OVR base ${Math.round(ductilityEffectiveBaseOvr(player))} · Intesa attuale ${formatSignedIntesa(currentChem)}"><span class="season-jersey"><span class="season-jersey-number">${shownOvr}</span></span>${sub?'<span class="season-jersey-sub-star">★</span>':''}</span>`
}

function persistSetupIdentity(teamInput,coachInput,saveState=true){
 const teamName=String(teamInput?.value??state.teamName??'').trim();
 const coachName=String(coachInput?.value??state.coachName??'').trim();
 state.teamName=teamName||DEFAULT_TEAM_NAME;
 state.coachName=coachName;
 try{
   localStorage.setItem(SETUP_TEAM_NAME_KEY,state.teamName);
   localStorage.setItem(SETUP_COACH_NAME_KEY,state.coachName);
   localStorage.setItem(SETUP_COACH_TYPE_KEY,normalizeCoachType(state.coachType));
   localStorage.setItem(SETUP_PALETTE_KEY,state.teamPaletteId||'fantaballa');
 }catch(error){console.warn('Preferenze squadra non salvate',error)}
 if(saveState)save();
}
function scheduleSetupIdentitySave(teamInput,coachInput){
 persistSetupIdentity(teamInput,coachInput,false);
 clearTimeout(setupIdentitySaveTimer);
 setupIdentitySaveTimer=setTimeout(()=>save(),220);
}
function setupScrollTo(id){requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}))}
function restoreSetupScroll(scrollTop){const target=Math.max(0,Number(scrollTop)||0),apply=()=>{const root=document.documentElement,previous=root.style.scrollBehavior;root.style.scrollBehavior='auto';window.scrollTo(0,target);root.style.scrollBehavior=previous};requestAnimationFrame(()=>requestAnimationFrame(apply));setTimeout(apply,120)}
function captureCoachSelectorViewport(){const selector=document.querySelector('.season-coach-selector');return selector?selector.getBoundingClientRect().top:null}
function restoreCoachSelectorViewport(previousTop){if(previousTop==null)return;const apply=()=>{const selector=document.querySelector('.season-coach-selector');if(!selector)return;const currentTop=selector.getBoundingClientRect().top;const delta=currentTop-previousTop;if(Math.abs(delta)>1){const root=document.documentElement,prev=root.style.scrollBehavior;root.style.scrollBehavior='auto';window.scrollBy(0,delta);root.style.scrollBehavior=prev}};requestAnimationFrame(()=>requestAnimationFrame(apply));setTimeout(apply,100);setTimeout(apply,260);document.querySelectorAll('.season-coach-selector img').forEach(img=>{if(img.complete)return;img.addEventListener('load',apply,{once:true})})}
function renderSetupProgress(step){return `<div class="season-setup-progress" aria-label="Progresso configurazione">${[1,2,3,4].map(index=>`<span class="${index<=step?'done':''}"></span>`).join('')}</div>`}
function renderPaletteButtons(){return TEAM_PALETTES.map(preset=>`<button type="button" class="season-palette-btn ${state.teamPaletteId===preset.id?'active':''}" data-team-palette="${esc(preset.id)}" aria-pressed="${state.teamPaletteId===preset.id?'true':'false'}"><span class="season-palette-swatch" style="--palette-primary:${preset.primary};--palette-secondary:${preset.secondary}"></span><small>${esc(preset.name)}</small></button>`).join('')}
function coachProfileIndex(value=state?.coachType){return Math.max(0,COACH_PROFILES.findIndex(profile=>profile.id===normalizeCoachType(value)))}
function coachProfileAt(offset=0,value=state?.coachType){const index=coachProfileIndex(value);return COACH_PROFILES[(index+offset+COACH_PROFILES.length)%COACH_PROFILES.length]||COACH_PROFILES[0]}
function renderCoachCarousel(){const current=coachProfile(),prev=coachProfileAt(-1),next=coachProfileAt(1),index=coachProfileIndex()+1;return `<div class="season-coach-carousel"><button type="button" class="season-coach-nav prev" data-coach-nav="-1" aria-label="Allenatore precedente">‹</button><div class="season-coach-peek left" data-coach-type="${esc(prev.id)}" role="button" tabindex="0" aria-label="Seleziona ${esc(prev.name)}"><img src="${esc(prev.image)}" alt="" loading="lazy" decoding="async"><span>${esc(prev.name)}</span></div><article class="season-coach-hero active"><div class="season-coach-hero-art"><img src="${esc(current.image)}" alt="${esc(current.name)}" decoding="async" fetchpriority="high"></div><div class="season-coach-hero-copy"><div class="season-coach-card-head"><span class="season-coach-card-icon">${current.icon}</span><div><small>Tipo di allenatore</small><b>${esc(current.name)}</b><em>${esc(current.tagline||'')}</em></div></div><span class="season-coach-index">${index}/${COACH_PROFILES.length}</span><span class="season-coach-effect pro"><strong>Pro</strong>${esc(current.pro)}</span><span class="season-coach-effect con"><strong>Contro</strong>${esc(current.con)}</span></div></article><div class="season-coach-peek right" data-coach-type="${esc(next.id)}" role="button" tabindex="0" aria-label="Seleziona ${esc(next.name)}"><img src="${esc(next.image)}" alt="" loading="lazy" decoding="async"><span>${esc(next.name)}</span></div><button type="button" class="season-coach-nav next" data-coach-nav="1" aria-label="Allenatore successivo">›</button></div><div class="season-coach-dots">${COACH_PROFILES.map(profile=>`<button type="button" class="${profile.id===current.id?'active':''}" data-coach-type="${esc(profile.id)}" aria-label="Seleziona ${esc(profile.name)}"></button>`).join('')}</div>`}
function showSetup(){
 const step=clamp(Number(state.setupStep)||1,1,4),userClub=activeUserClub(),userPal=clubPalette(userClub);
 const teamValue=String(state.teamName||localStorage.getItem(SETUP_TEAM_NAME_KEY)||DEFAULT_TEAM_NAME);
 const coachValue=String(state.coachName||localStorage.getItem(SETUP_COACH_NAME_KEY)||'');
 const allFormations=Object.keys(FORMATIONS).filter(form=>!['2-4-4','4-4-4','3-3-3'].includes(form));
 if(coachIs('three-five-two'))state.formation='3-5-2';
 const formations=coachIs('three-five-two')?['3-5-2']:allFormations;
 screen.innerHTML=`<div class="season-setup-flow">${renderSetupProgress(step)}
 <section class="panel season-setup-step" id="setupModeStep" data-step-label="Passo 1 di 4"><div class="season-setup-step-head"><span class="season-setup-step-number">1</span><div><div class="season-setup-kicker">${esc(SEASON_CONFIG.labels.competitionName)}</div><h2>Scegli la modalità</h2><p>Prima di creare la squadra, scegli come devono comportarsi gli eventi durante la stagione.</p></div></div><div class="season-mode-grid"><button type="button" class="season-mode-btn ${step>1&&state.gameMode!=='chaos'?'active':''}" data-game-mode="normal"><b>Normale</b><small>Gli eventi, le quest e le decisioni riguardano <strong>soltanto la tua squadra</strong>. Le 19 avversarie disputano normalmente il campionato.</small></button><button type="button" class="season-mode-btn ${step>1&&state.gameMode==='chaos'?'active':''}" data-game-mode="chaos"><b>🌀 Caos</b><small>Anche le <strong>19 avversarie</strong> ricevono eventi, prendono decisioni e subiscono conseguenze reali sulle proprie rose.</small></button></div></section>
 ${step>=2?`<section class="panel season-setup-step" id="setupIdentityStep" data-step-label="Passo 2 di 4"><div class="season-setup-step-head"><span class="season-setup-step-number">2</span><div><h2>Identità della squadra</h2><p>Scegli nome della squadra, nome dell’allenatore, colori sociali e il profilo con cui affronterai la stagione.</p></div></div><div class="season-identity-grid"><div><div class="season-identity-fields"><div class="field"><label>Nome squadra</label><input id="teamName" maxlength="32" value="${esc(teamValue)}" placeholder="${esc(DEFAULT_TEAM_NAME)}" autocomplete="organization"></div><div class="field"><label>Nome allenatore</label><input id="coachName" maxlength="32" value="${esc(coachValue)}" placeholder="Il tuo nome" autocomplete="name"></div></div><div class="season-setup-tip">Se il nome dell’allenatore coincide con quello di un calciatore scelto, quel giocatore ottiene +10 OVR bonus di Intesa.</div><div class="season-palette-title">Palette sociali</div><div class="season-palette-grid">${renderPaletteButtons()}</div><div class="season-coach-title">Tipo di allenatore</div><div class="season-coach-selector">${renderCoachCarousel()}</div></div><aside class="season-identity-preview"><div class="season-club-preview custom-preview" style="--club-primary:${userPal.primary};--club-secondary:${userPal.secondary};--club-accent:${userPal.accent};--club-text:${userPal.text}"><span class="season-club-preview-badge" id="setupPreviewBadge">${esc(setupTeamBadge(teamValue))}</span><div><small>Anteprima squadra</small><b id="setupPreviewName">${esc(teamValue||DEFAULT_TEAM_NAME)}</b><em id="setupPreviewCoach">Allenatore: ${esc(coachValue||'da inserire')}</em><em class="season-preview-coach-type">Profilo: ${esc(coachProfile().name)}</em></div></div><div class="season-setup-tip secondary">Questi colori verranno usati nei box della tua squadra e sulle maglie dei giocatori posizionati in campo durante il draft e la stagione.</div></aside></div><div class="season-step-actions"><button id="continueIdentity" class="btn primary" type="button">Continua ai moduli →</button></div></section>`:''}
 ${step>=3?`<section class="panel season-setup-step" id="setupFormationStep" data-step-label="Passo 3 di 4"><div class="season-setup-step-head"><span class="season-setup-step-number">3</span><div><h2>Scegli il modulo</h2><p>Il modulo determina gli undici slot da completare e i ruoli richiesti nel draft.</p></div></div><div class="season-formation-grid">${formations.map(form=>`<button type="button" class="season-formation-btn ${state.formation===form?'active':''}" data-form="${form}"><b>${form}</b><small>${esc(formationPositionSummary(form))}</small></button>`).join('')}</div><div class="season-selected-summary"><span>${state.gameMode==='chaos'?'🌀 Caos':'Normale'}</span><span id="setupIdentitySummary">${esc(teamValue)} · ${esc(coachValue)}</span><span>${esc(coachProfile().name)}</span></div></section>`:''}
 ${step>=4?`<section class="panel season-setup-step" id="setupDraftStep" data-step-label="Passo 4 di 4"><div class="season-setup-step-head"><span class="season-setup-step-number">4</span><div><h2>Come vuoi fare il draft?</h2><p>Scegli il controllo completo oppure avvia subito la stagione con una rosa generata casualmente.</p></div></div><div class="season-draft-choice-grid"><button id="startDraft" class="season-draft-choice" type="button"><span class="season-draft-choice-icon">🎯</span><b>Draft manuale</b><p>${coachIs('three-five-two')?'Apri il primo pack club: quel club genera immediatamente i tuoi 14 giocatori, completando casualmente gli eventuali ruoli mancanti.':'Spacchetti i club, scegli ogni giocatore e lo posizioni personalmente in uno slot compatibile. Completi 11 titolari e 3 riserve.'}</p><span>Inizia il draft manuale →</span></button><button id="startRandomDraft" class="season-draft-choice" type="button"><span class="season-draft-choice-icon">🎲</span><b>Draft automatico</b><p>${coachIs('three-five-two')?'Il gioco estrae subito un club e genera i 14 giocatori con le stesse regole del primo pack.':'Il gioco crea subito una rosa casuale. Gli undici titolari rispettano i ruoli del modulo; con Talent scout aumenta la probabilità di ottenere OVR elevati.'}</p><span>Genera e avvia →</span></button></div><div class="season-selected-summary"><span>${state.gameMode==='chaos'?'🌀 Caos':'Normale'}</span><span>${esc(state.formation)}</span><span>${esc(teamValue)}</span><span>${esc(coachProfile().name)}</span></div></section>`:''}
 </div>`;
 const teamInput=document.getElementById('teamName'),coachInput=document.getElementById('coachName');
 const refreshIdentityPreview=()=>{const teamName=String(teamInput?.value||'').trim()||DEFAULT_TEAM_NAME,coachName=String(coachInput?.value||'').trim()||'da inserire';const nameEl=document.getElementById('setupPreviewName'),coachEl=document.getElementById('setupPreviewCoach'),badgeEl=document.getElementById('setupPreviewBadge');if(nameEl)nameEl.textContent=teamName;if(coachEl)coachEl.textContent=`Allenatore: ${coachName}`;if(badgeEl)badgeEl.textContent=setupTeamBadge(teamName)};
 [teamInput,coachInput].filter(Boolean).forEach(input=>input.addEventListener('input',()=>{scheduleSetupIdentitySave(teamInput,coachInput);refreshIdentityPreview()}));
 document.querySelectorAll('[data-game-mode]').forEach(button=>button.onclick=()=>{state.gameMode=button.dataset.gameMode==='chaos'?'chaos':'normal';state.setupStep=Math.max(2,step);save();showSetup();setupScrollTo('setupIdentityStep')});
 document.querySelectorAll('[data-team-palette]').forEach(button=>button.onclick=()=>{persistSetupIdentity(teamInput,coachInput,false);state.teamPaletteId=String(button.dataset.teamPalette||'fantaballa');state.teamColors=teamColorsForPalette(state.teamPaletteId);try{localStorage.setItem(SETUP_PALETTE_KEY,state.teamPaletteId)}catch{}save();showSetup();setupScrollTo('setupIdentityStep')});
 document.querySelectorAll('[data-coach-type]').forEach(button=>{button.onpointerdown=event=>event.preventDefault();button.onclick=event=>{event.preventDefault();const coachScrollTop=window.scrollY;const coachSelectorTop=captureCoachSelectorViewport();persistSetupIdentity(teamInput,coachInput,false);state.coachType=normalizeCoachType(button.dataset.coachType);syncCoachRestrictions();try{localStorage.setItem(SETUP_COACH_TYPE_KEY,state.coachType)}catch{}save();showSetup();restoreSetupScroll(coachScrollTop);restoreCoachSelectorViewport(coachSelectorTop)};button.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();button.click()}}});
 document.querySelectorAll('[data-coach-nav]').forEach(button=>{button.onpointerdown=event=>event.preventDefault();button.onclick=event=>{event.preventDefault();const coachScrollTop=window.scrollY;const coachSelectorTop=captureCoachSelectorViewport();persistSetupIdentity(teamInput,coachInput,false);const direction=Number(button.dataset.coachNav||0)||0;const currentIndex=coachProfileIndex();const nextProfile=COACH_PROFILES[(currentIndex+direction+COACH_PROFILES.length)%COACH_PROFILES.length]||COACH_PROFILES[0];state.coachType=normalizeCoachType(nextProfile.id);syncCoachRestrictions();try{localStorage.setItem(SETUP_COACH_TYPE_KEY,state.coachType)}catch{}save();showSetup();restoreSetupScroll(coachScrollTop);restoreCoachSelectorViewport(coachSelectorTop)}});
 const continueIdentity=document.getElementById('continueIdentity');if(continueIdentity)continueIdentity.onclick=()=>{const teamName=String(teamInput?.value||'').trim(),coachName=String(coachInput?.value||'').trim();if(!teamName||!coachName)return toast('Inserisci sia il nome della squadra sia il nome dell’allenatore.');clearTimeout(setupIdentitySaveTimer);persistSetupIdentity(teamInput,coachInput,false);state.setupStep=3;save();showSetup();setupScrollTo('setupFormationStep')};
 document.querySelectorAll('[data-form]').forEach(button=>button.onclick=()=>{clearTimeout(setupIdentitySaveTimer);persistSetupIdentity(teamInput,coachInput,false);state.formation=coachIs('three-five-two')?'3-5-2':button.dataset.form;state.setupStep=4;save();showSetup();setupScrollTo('setupDraftStep')});
 const beginDraft=automatic=>{clearTimeout(setupIdentitySaveTimer);persistSetupIdentity(teamInput,coachInput,false);if(!String(state.teamName||'').trim()||!String(state.coachName||'').trim())return toast('Completa nome squadra e allenatore prima di iniziare.');state.coachName=String(state.coachName).trim();state.coachType=normalizeCoachType(state.coachType);syncCoachRestrictions();try{localStorage.setItem(SETUP_COACH_NAME_KEY,state.coachName);localStorage.setItem(SETUP_COACH_TYPE_KEY,state.coachType);localStorage.setItem(SETUP_PALETTE_KEY,state.teamPaletteId||'fantaballa')}catch{}if(automatic)return startFullyRandomDraft();state.phase='draft';state.draft=freshState().draft;state.draft.rerolls=initialDraftRerollLimit();save();render()};
 const manual=document.getElementById('startDraft'),automatic=document.getElementById('startRandomDraft');if(manual)manual.onclick=()=>beginDraft(false);if(automatic)automatic.onclick=()=>beginDraft(true);
}


function clubCardRgb(color){
 const value=String(color||'').trim();
 const match=value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
 if(!match)return null;
 let hex=match[1];
 if(hex.length===3)hex=hex.split('').map(char=>char+char).join('');
 return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
}
function clubCardLuminance(color){
 const rgb=clubCardRgb(color);
 if(!rgb)return .35;
 const linear=rgb.map(channel=>{const value=channel/255;return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4)});
 return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
}
function clubCardNameTheme(backgroundColor){
 const light=clubCardLuminance(backgroundColor)>.46;
 return light
  ?{ink:'#111111',bg:'rgba(255,255,255,.88)',border:'rgba(17,17,17,.28)',shadow:'0 1px 0 rgba(255,255,255,.8)'}
  :{ink:'#FFFFFF',bg:'rgba(0,0,0,.58)',border:'rgba(255,255,255,.7)',shadow:'0 2px 5px rgba(0,0,0,.72)'};
}

async function playSeasonPackReveal(possibleClubIds,finalClubId,isReroll){
 modalRoot.innerHTML=`<div class="season-pack-reveal" id="seasonPackReveal"><div class="season-pack-stage" role="dialog" aria-live="assertive" aria-label="Apertura pacchetto club campionato"><div class="season-pack-kicker">${esc(SEASON_CONFIG.labels.packKicker)}</div><div class="season-pack-scene" aria-hidden="true"><div class="season-pack-burst"></div><div class="season-pack-card-stack"><div class="season-pack-card-back"></div><div class="season-pack-card-back"></div><div class="season-pack-card-back"></div></div><div class="season-pack-nation-card" id="seasonPackNationCard"><div class="season-pack-card-label" id="seasonPackCardLabel">${isReroll?'Second chance':'Club draft'}</div><div class="season-pack-code" id="seasonPackCode">---</div><div class="season-pack-name" id="seasonPackNation">???</div></div><div class="season-pack-envelope" id="seasonPackEnvelope"><div class="season-pack-lid"></div><div class="season-pack-tear"></div><div class="season-pack-title-badge">FANTABALLA</div><div class="season-pack-seal">⚽</div></div></div><div class="season-pack-caption" id="seasonPackCaption">Scarta il pacchetto...</div></div></div>`;
 const overlay=document.getElementById('seasonPackReveal');
 const label=document.getElementById('seasonPackNation');
 const code=document.getElementById('seasonPackCode');
 const card=document.getElementById('seasonPackNationCard');
 const caption=document.getElementById('seasonPackCaption');
 const cardLabel=document.getElementById('seasonPackCardLabel');
 const applyClub=clubId=>{
   const club=clubById(clubId)||{name:'???',shortName:'---',colorClub:{}};
   const pal=clubPalette(club);
   applyPackNationLabel(label,club.name);
   code.textContent=String(club.shortName||club.name.slice(0,3)).toUpperCase();
   card.style.background=`linear-gradient(135deg,${pal.primary} 0 48%,${pal.secondary} 48% 78%,${pal.accent} 78% 100%)`;
   const nameTheme=clubCardNameTheme(pal.accent);
   card.style.color=nameTheme.ink;
   card.style.setProperty('--pack-name-ink',nameTheme.ink);
   card.style.setProperty('--pack-name-bg',nameTheme.bg);
   card.style.setProperty('--pack-name-border',nameTheme.border);
   card.style.setProperty('--pack-name-shadow',nameTheme.shadow);
   return club;
 };
 cardLabel.textContent=isReroll?'Second chance':'Club draft';
 overlay.classList.add('show');
 void overlay.offsetWidth;
 overlay.classList.add('opening');
 for(let i=0;i<10;i++){
   applyClub(pick(possibleClubIds));
   caption.innerHTML=i<4?'Strappa il bordo...':i<8?'Le figurine stanno uscendo...':'Reveal finale...';
   await waitDraft(80+i*14)
 }
 overlay.classList.remove('opening');
 overlay.classList.add('bursting');
 await waitDraft(360);
 const finalClub=applyClub(finalClubId);
 overlay.classList.add('show-result');
 caption.innerHTML=`<strong>${esc(finalClub.name)}</strong> è il club pescato`;
 await waitDraft(1180);
 modalRoot.innerHTML='';
}
async function drawDraft(useReroll=false){
 if(draftRolling||draftComplete())return;
 primeDraftAudio();
 const savedScrollY=window.scrollY;
 if(useReroll){
   if(state.draft.rerolls<=0)return toast('Re-roll terminati');
   if(state.draft.rerolls===1){const confirmed=await openConfirm({title:'Ultimo re-roll',message:'Questo è l’ultimo re-roll disponibile. Vuoi cambiare davvero il club?',confirmText:'Usa l’ultimo re-roll'});if(!confirmed)return;}
   state.draft.rerolls--
 }
 const possibleBase=draftPossibleClubs();
 const possible=useReroll&&possibleBase.length>1?possibleBase.filter(id=>id!==state.draft.clubId):possibleBase;
 if(!possible.length)return toast('Non ci sono più giocatori validi per gli slot rimasti.');
 const openingClubId=!useReroll?talentScoutOpeningClub(possible):'';
 const finalClubId=openingClubId||(coachIs('talent-scout')?coachHighOvrPick(possible.map(id=>{const candidates=draftCandidatesForClub(id),quality=candidates.length?Math.max(...candidates.map(player=>Number(player.ovr)||0)):0;return{id,ovr:quality}}))?.id:pick(possible));
 const finalClub=clubById(finalClubId);
 draftRolling=true;
 state.draft.pendingPlayerId='';
 state.draft.candidates=[];
 save();
 playDraftPackSound();
 document.querySelectorAll('#draftRollBtn,#draftRollBtnCenter').forEach(button=>{
   button.disabled=true;
   button.setAttribute('aria-busy','true');
 });
 try{
   await playSeasonPackReveal(possible,finalClubId,useReroll);
   if(coachIs('three-five-two')&&!state.draft.roster.length&&!useReroll){
     if(!buildThreeFiveTwoOpeningRoster(finalClubId))throw new Error(`Impossibile generare la rosa 3-5-2 da ${finalClub?.name||finalClubId}`);
     draftRolling=false;
     save();
     render();
     toast(`3-5-2: ${finalClub?.name||'il primo club'} ha generato automaticamente la rosa di 14 giocatori.`);
     return;
   }
   const drawn=draftCandidatesForClub(finalClubId);
   state.draft.clubId=finalClubId;
   state.draft.openingClubShown=true;
   state.draft.candidates=drawn.map(player=>String(player.id));
   if(!state.draft.candidates.length)throw new Error(`Nessun giocatore disponibile per ${finalClub?.name||finalClubId}`);
   mobileDraftTab='players';
   draftRolling=false;
   save();
   render();
   animateDraftCandidateReveal(drawn);
   requestAnimationFrame(()=>window.scrollTo({top:savedScrollY,left:0,behavior:'auto'}));
 }catch(error){
   console.error('Errore apertura pack club campionato',error);
   modalRoot.innerHTML='';
   state.draft.clubId='';
   state.draft.candidates=[];
   if(useReroll)state.draft.rerolls=Math.min(initialDraftRerollLimit(),state.draft.rerolls+1);
   draftRolling=false;
   save();
   render();
   requestAnimationFrame(()=>window.scrollTo({top:savedScrollY,left:0,behavior:'auto'}));
   toast('Errore durante il pack. Riprova senza perdere il re-roll.');
 }
}
function selectDraftCandidate(id){if(draftRolling||draftComplete())return;const p=playerById(id);if(!draftPlayerIsValid(p))return toast('Giocatore non compatibile con gli slot rimasti.');const selecting=state.draft.pendingPlayerId!==String(id);state.draft.pendingPlayerId=selecting?String(id):'';if(selecting)mobileDraftTab='field';save();render()}
function placeDraftStarter(slotId){
 const player=playerById(state.draft.pendingPlayerId),slot=formationSlots().find(s=>s.instanceId===slotId);
 if(!player||!slot||!availableStarterSlotsForPlayer(player).some(s=>s.instanceId===slotId))return;
 if(lastPlacedDraftTimer){clearTimeout(lastPlacedDraftTimer);lastPlacedDraftTimer=null}
 lastPlacedDraftSlotId=slot.instanceId;
 state.draft.roster.push({playerId:String(player.id),slotId:slot.instanceId,slot:slot.code,bench:false,player:{...player}});
 finishDraftPlacement(true)
}
function placeDraftBench(slotId){
 const player=playerById(state.draft.pendingPlayerId);
 if(!player||usedDraftPlayerIds().has(String(player.id)))return;
 const index=Number(String(slotId).replace(/\D/g,''));
 if(!index||state.draft.roster.some(r=>r.bench&&r.slotId===slotId)||benchEntries().length>=3)return;
 state.draft.roster.push({playerId:String(player.id),slotId,slot:`PAN${index}`,bench:true,player:{...player}});
 finishDraftPlacement(false)
}
function finishDraftPlacement(showPitchAnimation=false){
 state.draft.pendingPlayerId='';
 state.draft.clubId='';
 state.draft.candidates=[];
 mobileDraftTab=showPitchAnimation?'pitch':(draftComplete()?'roster':'players');
 save();
 render();
 if(showPitchAnimation&&lastPlacedDraftSlotId){
   const placedId=lastPlacedDraftSlotId;
   lastPlacedDraftTimer=setTimeout(()=>{
     document.querySelectorAll('.season-field-slot.just-placed').forEach(element=>element.classList.remove('just-placed'));
     if(lastPlacedDraftSlotId===placedId)lastPlacedDraftSlotId='';
     lastPlacedDraftTimer=null;
   },900)
 }
 if(draftComplete())toast('Rosa completa: 11 titolari + 3 riserve.')
}
async function resetSeasonDraft(){
 const confirmed=await openConfirm({title:'Azzera il draft',message:'La rosa scelta verrà cancellata, ma squadra, allenatore e modulo resteranno invariati.',confirmText:'Azzera draft',danger:true});if(!confirmed)return;
 if(lastPlacedDraftTimer){clearTimeout(lastPlacedDraftTimer);lastPlacedDraftTimer=null}
 lastPlacedDraftSlotId='';
 state.draft=freshState().draft;
 state.draft.rerolls=initialDraftRerollLimit();
 mobileDraftTab='players';
 save();
 render()
}
async function backToSeasonSetup(){
 if(state.draft.roster.length){const confirmed=await openConfirm({title:'Torna al modulo',message:'Il draft attuale verrà cancellato. Squadra e allenatore resteranno salvati.',confirmText:'Torna al modulo',danger:true});if(!confirmed)return;}
 if(lastPlacedDraftTimer){clearTimeout(lastPlacedDraftTimer);lastPlacedDraftTimer=null}
 lastPlacedDraftSlotId='';
 state.phase='setup';
 state.draft=freshState().draft;
 state.draft.rerolls=initialDraftRerollLimit();
 save();
 render()
}

function renderSeasonPitch(){
 const assigned=new Map(starterEntries().map(r=>[String(r.slotId),r]));
 const pending=playerById(state.draft.pendingPlayerId);
 const available=new Set(pending?availableStarterSlotsForPlayer(pending).map(s=>s.instanceId):[]);
 const chemistry=draftChemistry();
 return `<div class="season-pitch-panel"><div class="season-pitch-title"><b>Formazione ${esc(state.formation)}</b><span>Regole Gary MEDel · Position precise</span></div><div class="season-pitch-shell">${renderPitchBoardStrip()}<div class="season-pitch-middle">${renderPitchBoardSide('left')}<div class="season-pitch-wrap"><svg class="season-pitch-svg" viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true"><rect x="0.8" y="0.8" width="98.4" height="118.4" fill="none" stroke="rgba(255,255,255,.8)" stroke-width=".8"/><rect x="21" y="1" width="58" height="18" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".6"/><rect x="34" y="1" width="32" height="8" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><rect x="43" y="1" width="14" height="3" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".5"/><rect x="21" y="101" width="58" height="18" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".6"/><rect x="34" y="111" width="32" height="8" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><rect x="43" y="116" width="14" height="3" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".5"/><line x1="0.8" y1="60" x2="99.2" y2="60" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><circle cx="50" cy="60" r="12.2" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><circle cx="50" cy="60" r=".7" fill="rgba(255,255,255,.75)"/><circle cx="50" cy="18" r=".7" fill="rgba(255,255,255,.75)"/><circle cx="50" cy="102" r=".7" fill="rgba(255,255,255,.75)"/><path d="M40,19 A10,10 0 0 0 60,19" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><path d="M40,101 A10,10 0 0 1 60,101" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><path d="M0.8,5 A4,4 0 0 0 4.8,0.8" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><path d="M99.2,5 A4,4 0 0 1 95.2,0.8" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><path d="M0.8,115 A4,4 0 0 1 4.8,119.2" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><path d="M99.2,115 A4,4 0 0 0 95.2,119.2" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/></svg>${formationSlots().map(slot=>{const entry=assigned.get(slot.instanceId),isAvailable=available.has(slot.instanceId);const sub=entry&&isSubscriber(entry.player),creator=entry&&isCreator(entry.player);const chemBonus=entry?(chemistry.playerBonus[String(entry.player.id)]||0):0;return `<button type="button" class="season-field-slot ${entry?'filled':''} ${isAvailable?'available':''} ${sub?'subscriber-player':''} ${creator?'creator-player':''} ${slot.instanceId===lastPlacedDraftSlotId?'just-placed':''}" data-starter-slot="${slot.instanceId}" data-position="${slot.code}" style="left:${slot.x}%;top:${slot.y}%">${entry?`${renderPlayerJersey(entry.player,'',chemBonus)}<span class="season-slot-name">${sub?'<span class="season-field-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(entry.player.name)}</span><span class="season-slot-role">${esc(slot.code)}</span><span class="season-slot-chem ${chemBonus>0?'positive':''}">${formatSignedIntesa(chemBonus)} INT</span>`:`<span class="season-slot-badge">${esc(slot.code)}</span><span class="season-slot-name">${esc(slot.code)}</span>`}</button>`}).join('')}</div>${renderPitchBoardSide('right')}</div>${renderPitchBoardStrip()}</div><div class="season-pitch-help">${pending?`Hai scelto <b>${esc(pending.name)}</b>: clicca uno degli slot illuminati compatibili oppure una casella panchina.`:'Rolla un club, scegli un giocatore e poi clicca uno slot del campo o della panchina.'}</div>${renderSeasonBench()}</div>`
}
function renderSeasonBench(){
 const bench=benchEntries(),pending=playerById(state.draft.pendingPlayerId);
 return `<div class="season-bench"><div class="season-bench-head"><span>Panchina</span><span>${bench.length}/3 riserve</span></div><div class="season-bench-grid">${[1,2,3].map(i=>{const id=`bench-${i}`,entry=bench.find(r=>r.slotId===id),available=Boolean(pending&&!entry&&bench.length<3),sub=entry&&isSubscriber(entry.player),creator=entry&&isCreator(entry.player);return `<button type="button" class="season-bench-slot ${entry?'filled':''} ${available?'available':''} ${sub?'subscriber':''} ${creator?'creator':''}" data-bench-slot="${id}">${entry?`<span class="season-bench-player">${renderMiniAvatar(entry.player,'bench')}<span class="season-bench-copy"><b>${sub?'<span class="season-inline-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(entry.player.name)}</b><small>${esc(entry.player.Position)} · OVR ${esc(entry.player.ovr)}</small></span></span>`:`<span>Riserva ${i}</span><small>${available?'Clicca per mandare il giocatore selezionato in panchina':'Slot libero di panchina'}</small>`}</button>`}).join('')}</div></div>`
}


function draftRarityMeta(ovr){
 const value=Number(ovr)||0;
 if(value>=85)return {key:'icon',label:'Icona',sound:4};
 if(value>=80)return {key:'elite',label:'Élite',sound:3};
 if(value>=75)return {key:'gold',label:'Oro',sound:2};
 if(value>=70)return {key:'silver',label:'Argento',sound:1};
 if(value>=65)return {key:'bronze',label:'Bronzo',sound:0};
 return {key:'common',label:'Comune',sound:0};
}
let draftAudioContext=null;
function primeDraftAudio(){
 try{
   const AudioContextClass=window.AudioContext||window.webkitAudioContext;
   if(!AudioContextClass)return null;
   if(!draftAudioContext)draftAudioContext=new AudioContextClass();
   if(draftAudioContext.state==='suspended')draftAudioContext.resume().catch(()=>{});
   return draftAudioContext;
 }catch(error){return null}
}
function draftTone(frequency,start,duration,volume=.035,type='sine'){
 const context=primeDraftAudio();
 if(!context)return;
 const oscillator=context.createOscillator();
 const gain=context.createGain();
 oscillator.type=type;
 oscillator.frequency.setValueAtTime(frequency,start);
 gain.gain.setValueAtTime(.0001,start);
 gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+.018);
 gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
 oscillator.connect(gain);gain.connect(context.destination);
 oscillator.start(start);oscillator.stop(start+duration+.025);
}
function playDraftPackSound(){
 const context=primeDraftAudio();if(!context)return;
 const now=context.currentTime+.02;
 draftTone(150,now,.20,.025,'triangle');
 draftTone(230,now+.12,.22,.028,'triangle');
 draftTone(340,now+.25,.28,.032,'sine');
}
function playDraftRaritySound(ovr){
 const context=primeDraftAudio();if(!context)return;
 const tier=draftRarityMeta(ovr).sound;
 if(tier<2)return;
 const now=context.currentTime+.015;
 if(tier===2){draftTone(523.25,now,.18,.03);draftTone(659.25,now+.12,.24,.032);return}
 if(tier===3){draftTone(392,now,.18,.035,'triangle');draftTone(523.25,now+.11,.22,.038,'triangle');draftTone(783.99,now+.24,.34,.042,'sine');return}
 draftTone(392,now,.20,.04,'triangle');draftTone(523.25,now+.09,.24,.042,'triangle');draftTone(659.25,now+.19,.28,.045,'triangle');draftTone(1046.5,now+.34,.48,.052,'sine');
}
function animateDraftCandidateReveal(players){
 const cards=[...document.querySelectorAll('.season-candidate[data-candidate]')];
 if(!cards.length)return;
 const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduced)return;
 cards.forEach(card=>card.classList.add('pack-hidden'));
 void cards[0].offsetWidth;
 cards.forEach((card,index)=>{
   setTimeout(()=>{
     card.classList.remove('pack-hidden');
     card.classList.add('pack-revealed');
     const ovr=Number(card.dataset.ovr)||0;
     if(ovr>=75)playDraftRaritySound(ovr);
     setTimeout(()=>card.classList.remove('pack-revealed'),900);
   },120+index*105);
 });
}


function animateMidseasonCandidateReveal(){
 const cards=[...document.querySelectorAll('.midseason-market-player[data-market]')];
 if(!cards.length||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 cards.forEach(card=>{card.classList.add('pack-hidden');card.style.opacity='0';card.style.transform='translateY(14px) scale(.95)'});
 void cards[0].offsetWidth;
 cards.forEach((card,index)=>setTimeout(()=>{
   card.classList.remove('pack-hidden');card.style.opacity='';card.style.transform='';card.classList.add('pack-revealed');
   const ovr=Number(card.dataset.ovr)||0;if(ovr>=75)playDraftRaritySound(ovr);
   setTimeout(()=>card.classList.remove('pack-revealed'),900);
 },100+index*150));
}

function draftCandidateOvrStyle(ovr){
 const value=Math.max(40,Math.min(99,Number(ovr)||40));
 const ratio=Math.max(0,Math.min(1,(value-50)/49));
 const lightness=Math.round(94-ratio*54);
 const saturation=Math.round(34+ratio*38);
 const borderLightness=Math.max(26,lightness-11);
 const dark=lightness<60;
 const veryDark=lightness<47;
 const text=dark?'#ffffff':'#10243a';
 const chipBg=dark?'rgba(255,255,255,.17)':'rgba(255,255,255,.72)';
 const chipText=dark?'#ffffff':'#10243a';
 const positionBg=dark?'rgba(255,233,108,.22)':'rgba(231,216,248,.94)';
 const positionText=dark?'#fff4b0':'#542b82';
 const subBg=dark?'rgba(221,201,255,.24)':'rgba(217,199,255,.95)';
 const subText=dark?'#f5eaff':'#402062';
 const avatarBg=veryDark?'linear-gradient(145deg,#0c1725,#172e49)':dark?'linear-gradient(145deg,#2d1f4d,#10243a)':'linear-gradient(145deg,#304f70,#10243a)';
 const ovrBg=dark?'#ffe96c':'#10243a';
 const ovrText=dark?'#10243a':'#ffffff';
 return `--candidate-bg:hsl(207 ${saturation}% ${lightness}%);--candidate-border:hsl(207 ${Math.min(82,saturation+8)}% ${borderLightness}%);--candidate-text:${text};--candidate-chip-bg:${chipBg};--candidate-chip-text:${chipText};--candidate-position-bg:${positionBg};--candidate-position-text:${positionText};--candidate-sub-bg:${subBg};--candidate-sub-text:${subText};--candidate-avatar-bg:${avatarBg};--candidate-avatar-text:#fff;--candidate-ovr-bg:${ovrBg};--candidate-ovr-text:${ovrText};--candidate-ovr-border:${dark?'rgba(16,36,58,.2)':'rgba(255,255,255,.28)'};--candidate-shadow:${dark?'0 1px 2px rgba(0,0,0,.26)':'none'}`;
}

function renderDraftCandidates(){
 if(draftRolling)return '<div class="season-empty">Apertura del pacchetto club…</div>';
 if(!state.draft.clubId)return '<div class="season-empty">Premi <b>Apri pack club</b>. Verranno mostrati tutti i giocatori compatibili appartenenti al club estratto. Più l’OVR è alto, più il box diventa scuro.</div>';
 const candidates=sortPlayersByRole(state.draft.candidates.map(playerById).filter(Boolean));
 if(!candidates.length)return '<div class="season-empty">Nessun giocatore valido in questo club. Usa il re-roll.</div>';
 return candidates.map((p,index)=>{const ovr=Math.max(0,Math.min(100,Number(p.ovr)||0));const sub=isSubscriber(p),creator=isCreator(p);const chemPreview=draftCandidateChemPreview(p);const rarity=draftRarityMeta(p.ovr);return `<button type="button" class="season-candidate rarity-${rarity.key} ${sub?'subscriber':''} ${creator?'creator':''} ${state.draft.pendingPlayerId===String(p.id)?'active':''}" data-candidate="${esc(p.id)}" data-ovr="${ovr}" style="${draftCandidateOvrStyle(p.ovr)}" aria-label="${esc(p.name)}, overall ${esc(p.ovr)}, rarità ${esc(rarity.label)}, intesa ${chemPreview}"><span class="season-candidate-rank">#${index+1}</span>${renderMiniAvatar(p)}<span class="season-candidate-body"><span class="season-candidate-name">${esc(p.name)}</span><span class="season-candidate-meter" aria-hidden="true"><i style="width:${ovr}%"></i></span><span class="season-candidate-meta"><span class="season-chip position">${esc(p.Position)}</span><span class="season-rarity-badge">${esc(rarity.label)}</span>${sub?'<span class="season-chip sub">ABBONATO</span>':''}${creator?'<span class="season-chip creator">CREATOR</span>':''}<span class="season-chip chemistry ${benchDraftPhase()?'bench':''}">${benchDraftPhase()?'PAN':`${formatSignedIntesa(chemPreview)} INT`}</span></span></span><span class="season-chip ovr">${esc(p.ovr)}</span></button>`}).join('')
}
function renderRosterMini(){
 const rows=rosterPlayers();
 if(state.phase==='draft'){
   const starters=starterEntries();
   const bench=benchEntries();
   const chemistry=draftChemistry(starters);
   const slotRows=formationSlots().map(slot=>({slot:slot.code,slotId:slot.instanceId,bench:false,entry:starters.find(r=>String(r.slotId)===String(slot.instanceId))||null}));
   const benchRows=[1,2,3].map(i=>({slot:`PAN${i}`,slotId:`bench-${i}`,bench:true,entry:bench.find(r=>String(r.slotId)===`bench-${i}`)||null}));
   return `<div class="season-roster-mini">${slotRows.concat(benchRows).map(row=>{const entry=row.entry;const sub=entry&&isSubscriber(entry.player),creator=entry&&isCreator(entry.player);const chemBonus=entry&&!row.bench?(chemistry.playerBonus[String(entry.player.id)]||0):null;return `<div class="season-roster-line ${row.bench?'bench':''} ${entry?'filled':'empty'} ${sub?'subscriber':''} ${creator?'creator':''}"><span class="season-roster-slot">${esc(row.slot)}</span>${entry?renderMiniAvatar(entry.player,'small'):''}<div class="season-roster-player">${entry?`<b>${sub?'<span class="season-inline-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(entry.player.name)}</b><small>${esc(entry.player.nation)} · ${esc(entry.player.Position)}${chemBonus!==null?` · <span class="season-roster-chem">${formatSignedIntesa(chemBonus)} INT</span>`:''}</small>`:`<b>—</b><small>${row.bench?'Riserva da scegliere':'Slot disponibile'}</small>`}</div><span class="season-roster-ovr">${entry?esc(entry.player.ovr):'—'}</span></div>`}).join('')}</div>`;
 }
 return `<div class="roster-list">${rows.length?rows.map(r=>`<div class="roster-row ${r.bench?'bench':''}"><span class="slot-code">${esc(r.slot)}</span>${renderMiniAvatar(r.player,'small')}<div><b>${esc(r.player.name)}</b><small>${esc(r.player.nation)} · ${esc(r.player.Position)}</small></div><span class="chip ovr">${r.player.ovr}</span></div>`).join(''):'<p>Nessun giocatore scelto.</p>'}</div>`
}
function renderSeasonRosterField(){
 const starters=starterEntries();
 const bench=benchEntries();
 const chemistry=draftChemistry(starters),resolvedLineup=resolveLineup();
 const assigned=new Map(starters.map(r=>[String(r.slotId),r]));
 const slots=formationSlots();
 const starterTarget=seasonStarterTarget(),benchTarget=seasonBenchTarget(),benchNumbers=seasonBenchNumbers();
 const avgOverall=resolvedLineup.length?resolvedLineupAverage(resolvedLineup).toFixed(1):'—',emergencyYouthCount=resolvedLineup.filter(isEmergencyYouthEntry).length;
 const benchMarkup=benchTarget?`<div class="season-roster-bench-wrap"><div class="season-roster-bench-title">Panchina</div><div class="season-roster-bench-grid">${benchNumbers.map(i=>{const entry=bench.find(r=>String(r.slotId)===`bench-${i}`);const sub=entry&&isSubscriber(entry.player),creator=entry&&isCreator(entry.player);return `<div class="season-roster-bench-card ${entry?'filled':''} ${sub?'subscriber':''} ${creator?'creator':''}">${entry?`${renderMiniAvatar(entry.player,'small')}<div class="season-roster-bench-copy"><b>${sub?'<span class="season-inline-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(entry.player.name)}</b><small>${esc(entry.player.nation)} · ${esc(entry.player.Position)}</small></div><span class="season-roster-ovr">${esc(entry.player.ovr)}</span>`:`<b>Riserva ${i}</b><small>Slot panchina vuoto</small>`}</div>`}).join('')}</div></div>`:`<div class="season-roster-bench-wrap"><div class="season-roster-bench-title">Panchina</div><div class="season-empty">La regola ${esc(state.formation)} porta tutti i 14 giocatori in campo: nessun panchinaro disponibile.</div></div>`;
 return `<div class="season-roster-board"><div class="season-roster-board-head"><div><div class="label">Rosa titolare</div><h3>Modulo ${esc(state.formation)}</h3></div><div class="season-roster-board-meta"><span class="season-board-pill">OVR partita ${avgOverall}</span><span class="season-board-pill">Intesa ${chemistry.score}/100</span>${emergencyYouthCount?`<span class="season-board-pill">Primavera ${emergencyYouthCount}</span>`:``}<span class="season-board-pill">${starters.length}/${starterTarget} titolari</span><span class="season-board-pill">${bench.length}/${benchTarget} riserve</span></div></div><div class="season-roster-shell">${renderPitchBoardStrip()}<div class="season-roster-middle">${renderPitchBoardSide('left')}<div class="season-roster-pitch"><svg class="season-pitch-svg" viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true"><rect x="1" y="1" width="98" height="118" fill="none" stroke="rgba(255,255,255,.8)" stroke-width=".8"/><rect x="21" y="1" width="58" height="18" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".6"/><rect x="34" y="1" width="32" height="8" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><rect x="21" y="101" width="58" height="18" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".6"/><rect x="34" y="111" width="32" height="8" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><line x1="1" y1="60" x2="99" y2="60" stroke="rgba(255,255,255,.75)" stroke-width=".55"/><circle cx="50" cy="60" r="12" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".55"/></svg>${slots.map(slot=>{const entry=assigned.get(String(slot.instanceId));if(!entry)return `<div class="season-roster-field-slot empty" style="left:${slot.x}%;top:${slot.y}%"><span class="season-slot-badge">${esc(slot.code)}</span><span class="season-slot-name">${esc(slot.code)}</span></div>`;const sub=isSubscriber(entry.player),creator=isCreator(entry.player);const chemBonus=chemistry.playerBonus[String(entry.player.id)]||0;const portsZero=closedPortsAffects(entry.player);return `<div class="season-roster-field-slot filled ${sub?'subscriber-player':''} ${creator?'creator-player':''}" style="left:${slot.x}%;top:${slot.y}%">${renderPlayerJersey(entry.player,'',chemBonus)}<span class="season-slot-name">${sub?'<span class="season-field-sub-star">★</span>':''}${creator?'<span class="season-inline-creator">CR</span>':''}${esc(entry.player.name)}</span><span class="season-slot-role">${esc(slot.code)}</span><span class="season-slot-chem ${portsZero?'zeroed':chemBonus>0?'positive':''}">${portsZero?'⛔ 0 INT':`${formatSignedIntesa(chemBonus)} INT`}</span></div>`}).join('')}</div>${renderPitchBoardSide('right')}</div>${renderPitchBoardStrip()}</div>${benchMarkup}</div>`
}

function setMobileDraftTab(tab,scrollToTabs=true){
 const allowed=['players','field','roster'];
 mobileDraftTab=allowed.includes(tab)?tab:'players';
 document.querySelectorAll('[data-mobile-tab]').forEach(button=>{
   const active=button.dataset.mobileTab===mobileDraftTab;
   button.classList.toggle('active',active);
   button.setAttribute('aria-selected',active?'true':'false');
   button.tabIndex=active?0:-1;
 });
 document.querySelectorAll('[data-mobile-pane]').forEach(panel=>{
   const active=panel.dataset.mobilePane===mobileDraftTab;
   panel.classList.toggle('mobile-active',active);
   panel.hidden=false;
   const mobile=window.matchMedia('(max-width:860px)').matches;
   panel.setAttribute('aria-hidden',mobile&&!active?'true':'false');
 });
 if(scrollToTabs&&window.matchMedia('(max-width:860px)').matches){
   const tabs=document.getElementById('seasonMobileTabs');
   if(tabs)tabs.scrollIntoView({behavior:'smooth',block:'start'});
 }
}
function bindMobileDraftTabs(){
 document.querySelectorAll('[data-mobile-tab]').forEach(button=>{
   button.onclick=()=>setMobileDraftTab(button.dataset.mobileTab,true);
   button.onkeydown=event=>{
     if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
     event.preventDefault();
     const order=['players','field','roster'];
     let index=order.indexOf(mobileDraftTab);
     if(event.key==='ArrowLeft')index=(index+order.length-1)%order.length;
     if(event.key==='ArrowRight')index=(index+1)%order.length;
     if(event.key==='Home')index=0;
     if(event.key==='End')index=order.length-1;
     setMobileDraftTab(order[index],false);
     document.querySelector(`[data-mobile-tab="${order[index]}"]`)?.focus();
   };
 });
 setMobileDraftTab(mobileDraftTab,false);
}

function showDraft(){
 state=normalizeCampionatoState(state);
 const starters=starterEntries().length;
 const bench=benchEntries().length;
 const total=starters+bench;
 const hasPack=state.draft.candidates.length>0;
 const draftRerollLimit=initialDraftRerollLimit();
 const canReroll=hasPack&&state.draft.rerolls>0&&!draftComplete();
 const chemistry=draftChemistry();
 const effectiveAverage=draftEffectiveAverageOvr(chemistry);
 const rollDisabled=draftRolling||draftComplete()||(hasPack&&!canReroll);
 const rerollWord=state.draft.rerolls===1?'RE-ROLL DISPONIBILE':'RE-ROLL DISPONIBILI';
 const rollText=draftRolling?'Apertura pack…':!hasPack?'Rolla il club 🎲':state.draft.rerolls>0?`Re-rolla · ${state.draft.rerolls} rimasti 🎲`:'Re-roll terminati';
 const centerRollTitle=draftRolling?'APERTURA PACK…':!hasPack?'ROLLA IL CLUB':state.draft.rerolls>0?'RE-ROLLA IL CLUB':'RE-ROLL TERMINATI';
 const centerRollSub=draftRolling?'Sto aprendo il pacchetto club':!hasPack?`Estrai uno dei ${CLUBS.length} club`:state.draft.rerolls>0?`${state.draft.rerolls} ${rerollWord}`:'Scegli uno dei giocatori già estratti';
 const currentDrawClub=drawnClub();
 const drawPal=clubPalette(currentDrawClub||activeUserClub());
 const drawStyle=`--draw-a:${drawPal.a};--draw-b:${drawPal.b};--draw-c:${drawPal.c};--draw-ink:${drawPal.ink}`;
 screen.innerHTML=`<div class="season-draft-page">
   <nav class="season-mobile-tabs" id="seasonMobileTabs" role="tablist" aria-label="Sezioni draft">
     <button type="button" class="season-mobile-tab ${mobileDraftTab==='players'?'active':''}" id="seasonMobilePlayers" data-mobile-tab="players" role="tab" aria-controls="seasonPlayersPane" aria-selected="${mobileDraftTab==='players'?'true':'false'}"><span class="season-mobile-tab-icon" aria-hidden="true">👥</span><span>Giocatori</span><b>${state.draft.candidates.length||0}</b></button>
     <button type="button" class="season-mobile-tab ${mobileDraftTab==='field'?'active':''}" id="seasonMobileField" data-mobile-tab="field" role="tab" aria-controls="seasonFieldPane" aria-selected="${mobileDraftTab==='field'?'true':'false'}"><span class="season-mobile-tab-icon" aria-hidden="true">⚽</span><span>Campo</span><b>${starters}/11</b>${state.draft.pendingPlayerId?'<i class="season-mobile-tab-alert" aria-label="Giocatore da posizionare"></i>':''}</button>
     <button type="button" class="season-mobile-tab ${mobileDraftTab==='roster'?'active':''}" id="seasonMobileRoster" data-mobile-tab="roster" role="tab" aria-controls="seasonRosterPane" aria-selected="${mobileDraftTab==='roster'?'true':'false'}"><span class="season-mobile-tab-icon" aria-hidden="true">📋</span><span>Rosa</span><b>${total}/14</b></button>
   </nav>
   <div class="season-draft-shell">
     <aside id="seasonPlayersPane" class="season-draft-panel season-draft-panel-left season-mobile-pane ${mobileDraftTab==='players'?'mobile-active':''}" data-mobile-pane="players" role="tabpanel" aria-labelledby="seasonMobilePlayers">
       <div class="season-draft-identity"><div><span>Squadra</span><b>${esc(state.teamName)}</b></div><div><span>Allenatore</span><b>${esc(state.coachName)} · ${esc(coachProfile().name)}</b></div></div>
       <div class="season-draw-card" style="${drawStyle}"><div class="season-draw-head"><span class="season-draw-mini">Drawn</span><span class="season-draw-pick">Pick ${String(Math.min(14,total+1)).padStart(2,'0')}</span></div><div class="season-draw-row"><div class="season-draw-copy"><div class="season-draw-nation" title="${currentDrawClub?esc(currentDrawClub.name):'Apri il pack'}">${currentDrawClub?esc(currentDrawClub.name):'Apri il pack'}</div></div></div></div>
       <div class="season-roll-actions"><button id="draftRollBtn" class="season-roll-btn" ${rollDisabled?'disabled':''}>${rollText}</button><button id="resetDraftBtnDesktop" class="season-roll-reset" type="button">↺ Reset draft</button></div>
       <div class="season-reroll-note ${hasPack?'active-reroll':'first-roll'}">${hasPack?(state.draft.rerolls>0?`Ti restano ${state.draft.rerolls} re-roll su ${draftRerollLimit}. · `:'Hai terminato i re-roll. · '):''}Le riserve possono essere scelte in qualsiasi momento.</div>
       <div class="season-candidates-head"><span>Scegli un giocatore</span><span>${state.draft.candidates.length||0} validi</span></div>
       <div class="season-candidate-list">${renderDraftCandidates()}</div>
     </aside>
     <main id="seasonFieldPane" aria-labelledby="seasonMobileField" class="season-draft-main season-mobile-pane ${mobileDraftTab==='field'?'mobile-active':''}" data-mobile-pane="field" role="tabpanel">
       <button id="draftRollBtnCenter" class="season-roll-btn season-roll-btn-center ${hasPack?'is-reroll':'is-first-roll'}" ${rollDisabled?'disabled':''} aria-label="${esc(centerRollTitle)}. ${esc(centerRollSub)}"><span class="season-roll-main">${centerRollTitle} <span aria-hidden="true">🎲</span></span><span class="season-roll-sub">${centerRollSub}</span></button>
       ${renderSeasonPitch()}
     </main>
     <aside id="seasonRosterPane" aria-labelledby="seasonMobileRoster" class="season-draft-panel season-draft-panel-right season-mobile-pane ${mobileDraftTab==='roster'?'mobile-active':''}" data-mobile-pane="roster" role="tabpanel">
       <div class="season-box-score-head"><div><strong>Box score · ${starters}/11</strong><small class="season-box-score-label">Overall medio titolari</small></div><span class="season-box-score-number">${starters?Math.round(effectiveAverage):0}</span></div>
       ${renderRosterMini()}
       ${draftComplete()?`<div class="season-draft-complete"><h3>Rosa pronta</h3><div>11 titolari e 3 riserve selezionati con regole Gary MEDel.</div><button id="startSeasonBtn" class="btn primary">Inizia il campionato</button></div>`:''}
     </aside>
   </div>
 </div>`;
 bindMobileDraftTabs();
 document.querySelectorAll('[data-candidate]').forEach(button=>button.onclick=()=>selectDraftCandidate(button.dataset.candidate));
 document.querySelectorAll('.season-field-slot.available').forEach(button=>button.onclick=()=>placeDraftStarter(button.dataset.starterSlot));
 document.querySelectorAll('.season-bench-slot.available').forEach(button=>button.onclick=()=>placeDraftBench(button.dataset.benchSlot));
 const roll=document.getElementById('draftRollBtn');if(roll)roll.onclick=()=>drawDraft(hasPack);
 const rollCenter=document.getElementById('draftRollBtnCenter');if(rollCenter)rollCenter.onclick=()=>drawDraft(hasPack);
 const reset=document.getElementById('resetDraftBtn');if(reset)reset.onclick=resetSeasonDraft;
 const resetDesktop=document.getElementById('resetDraftBtnDesktop');if(resetDesktop)resetDesktop.onclick=resetSeasonDraft;
 const back=document.getElementById('backSetupBtn');if(back)back.onclick=()=>{state.phase='setup';save();render()};
 const start=document.getElementById('startSeasonBtn');if(start)start.onclick=finalizeDraft;
 if(draftComplete())setMobileDraftTab('roster',false);
 else if(state.draft.pendingPlayerId&&window.matchMedia('(max-width:860px)').matches)setMobileDraftTab('field',false);
 else if(!window.matchMedia('(max-width:860px)').matches){
   mobileDraftTab='players';
 }
}

