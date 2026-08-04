/* Faccine giocatori condivise per la modalità Direttore Sportivo. */
(function(){
'use strict';
function isFantaballaCreator(player){
 const id=String(player?.id||'').trim(),name=String(player?.name||'').trim().toLowerCase(),style=String(player?.creatorStyle||'').trim().toLowerCase();
 return id==='384'||name==='fantaballa'||style==='fantaballa';
}
function isSubscriber(player){return !isFantaballaCreator(player)&&String(player&&player.subscriber||'').trim().toLowerCase()==='si'}
function isCreator(player){return isFantaballaCreator(player)||String(player&&player.creator||'').trim().toLowerCase()==='si'}
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
 const colors=player?.avatarColors||player?.colors||{};
 const primary=colors.primary||'#1769AA';
 const secondary=colors.secondary||avatarShade(primary,.45);
 const accent=colors.accent||avatarMix(primary,secondary,.5);
 const text=colors.text||avatarTextColor(primary);
 const name=String(player?.clubName||player?.teamName||avatarSourceKey(player)||'Fantaballa');
 return {name,shortName:String(player?.shortClubName||name).slice(0,3).toUpperCase(),primary,secondary,accent,text};
}
function avatarTier(player){
 const ovr=Number(player?.ovr)||0,legend=false;
 if(legend&&ovr>=113)return {key:'legend',glow:'#fff0a0',rim:'#ffffff',spark:'#fffbe0',stars:5,label:'GOAT'};
 if(legend&&ovr>=108)return {key:'legend',glow:'#9ff3ff',rim:'#f6feff',spark:'#ffffff',stars:5,label:'DIA'};
 if(legend&&ovr>=101)return {key:'legend',glow:'#8ae8ff',rim:'#eefcff',spark:'#ffffff',stars:4,label:'DIA'};
 if(ovr>=95)return {key:'legend',glow:'#86e7ff',rim:'#ecfcff',spark:'#ffffff',stars:4,label:'DIA'};
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
  eyeColor:'#1b1a17',
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
 const isFantaballa=creatorStyle==='fantaballa'||String(player?.id||'')==='384'||creatorName==='fantaballa';
 const isMisterFm=creatorStyle==='misterfm'||String(player?.id||'')==='852'||creatorName==='misterfm';
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
 if(isFantaballa){
  preset.skin='#efbf9a';
  preset.hair='#30231d';
  preset.eyebrows='#3b2921';
  preset.eyeColor='#79b8dc';
  preset.faceShape='oval';
  preset.hairStyle='sideSweep';
  preset.eyeStyle='azureWide';
  preset.mouthStyle='serious';
  preset.beardStyle='shortBeard';
  preset.accessory='none';
  preset.kitStyle='solid';
 }
 if(isMisterFm){
  preset.skin='#eeb991';
  preset.hair='#4b301f';
  preset.eyebrows='#382316';
  preset.eyeColor='#473124';
  preset.faceShape='oval';
  preset.hairStyle='crop';
  preset.eyeStyle='wide';
  preset.mouthStyle='smile';
  preset.beardStyle='stubble';
  preset.accessory='capGlasses';
  preset.kitStyle='solid';
 }
 return preset;
}
function renderAvatarSvg(player,sub=false){
 const sharedSvg=window.FantaballaCreatorAvatars?.renderSvg?.(player,{subscriber:sub});
 if(sharedSvg)return sharedSvg;
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
   sideSweep:`<path d="M18.1 32.4c2.8-13.1 12.9-22.1 25.2-22.1 10.4 0 18.2 5.8 21.5 17.5-6.9-3.1-13.8-3.8-20.8-2.4-8.7 1.7-14.3 6.8-19.7 13.8-.8-1.6-1.4-3.9-1.3-6.2-1.8.5-3.4.3-4.9-.6z" fill="${a.hair}"/><path d="M21.5 29.9c8.9-10.8 21-15.3 35.4-10.1-8.4-.2-15.9 2.1-22 7.1-4.2 3.4-7.4 7.4-10.2 11.9-2.2-1.9-3.3-5-3.2-8.9z" fill="${avatarShade(a.hair,.08)}" opacity=".82"/>`,
   curly:`<path d="M18.9 32c3.8-12.6 12.2-20.5 22-20.5 10.5 0 18.6 5.4 22.1 16.5-1.4-.6-2.8-.8-4.5-.8 0 0-1.2-5-4.9-5-2.5 0-3.8 2.5-3.8 2.5s-2.3-5-6.5-5-5.4 3.5-5.4 3.5-2.2-3.2-5.9-2.2c-4 1.1-5.4 6-5.4 6s-2.8 1.2-3.7 5z" fill="${a.hair}"/>`,
   spike:`<path d="M19.2 33c1.4-5.2 5.2-12.8 10.2-18.2l5 4.8 5.2-7.6 6.2 7.2 4.8-6c5.2 4 9.2 10.5 10.4 19-6.4-4.2-12.8-6.4-21.6-6.4-8.4 0-14.8 2.4-20.2 7.2z" fill="${a.hair}"/>`,
   fade:`<path d="M22.3 31.5C26 20 33.7 14.2 42 14.2c9.3 0 16.7 5.5 20.3 15.7-4.9-2.1-10.6-3-18.9-3-8.5 0-14.4 1.8-21.1 4.6z" fill="${a.hair}"/><path d="M20.6 32.5c1.3-5 3.5-9.5 6-12-2.3 6.2-2.4 10.5-.9 15.4-1.8.8-3.4 1.4-5.1 2.2z" fill="${a.hair}" opacity=".32"/><path d="M58.8 20.5c2.4 2.8 4.8 7.4 5.7 11.8-1.8-.8-3.7-1.4-5.5-1.8 1-4.7.7-7.6-.2-10z" fill="${a.hair}" opacity=".32"/>`,
   long:`<path d="M18.8 30.5c4.6-13 12.4-20.2 23.2-20.2 10.4 0 18.6 5.5 22 17-5.2-2.2-10.3-3.2-16.2-3.2-10.8 0-18 3.2-24.5 9z" fill="${a.hair}"/><path d="M20.2 33.3c1.2 10.8 1.2 19.2-1.1 28.2 4.8-2.5 8.8-6.8 10.2-14l1.1-14.2z" fill="${a.hair}" opacity=".92"/><path d="M63.8 33.3c-1.2 10.8-1.2 19.2 1.1 28.2-4.8-2.5-8.8-6.8-10.2-14l-1.1-14.2z" fill="${a.hair}" opacity=".92"/>`
 };
 const brows=`<path d="M26.6 34.5c3-1.8 6.2-2.6 9.7-2.4" fill="none" stroke="${a.eyebrows}" stroke-width="2" stroke-linecap="round"/><path d="M47 32.1c3.5-.2 6.7.6 9.7 2.4" fill="none" stroke="${a.eyebrows}" stroke-width="2" stroke-linecap="round"/>`;
 const eyesMap={
   dot:`<circle cx="33.2" cy="42.3" r="2.1" fill="${a.eyeColor}"/><circle cx="50.8" cy="42.3" r="2.1" fill="${a.eyeColor}"/>`,
   smile:`<path d="M30 42.5c1.5 1.9 3 2.6 4.6 2.6 1.5 0 3-.7 4.5-2.6" fill="none" stroke="#1b1a17" stroke-width="1.55" stroke-linecap="round"/><path d="M45 42.5c1.5 1.9 3 2.6 4.6 2.6 1.5 0 3-.7 4.5-2.6" fill="none" stroke="#1b1a17" stroke-width="1.55" stroke-linecap="round"/>`,
   focused:`<path d="M30 42.1h6.8" stroke="#1b1a17" stroke-width="1.65" stroke-linecap="round"/><path d="M47.2 42.1H54" stroke="#1b1a17" stroke-width="1.65" stroke-linecap="round"/><circle cx="33.2" cy="42.8" r="1.2" fill="${a.eyeColor}"/><circle cx="50.8" cy="42.8" r="1.2" fill="${a.eyeColor}"/>`,
   wide:`<ellipse cx="33.2" cy="42.3" rx="3.1" ry="2.6" fill="#fff"/><ellipse cx="50.8" cy="42.3" rx="3.1" ry="2.6" fill="#fff"/><circle cx="33.2" cy="42.3" r="1.5" fill="${a.eyeColor}"/><circle cx="50.8" cy="42.3" r="1.5" fill="${a.eyeColor}"/>`,
   azureWide:`<ellipse cx="33.2" cy="42.2" rx="3.7" ry="3.15" fill="#fff" stroke="rgba(90,52,31,.2)" stroke-width=".65"/><ellipse cx="50.8" cy="42.2" rx="3.7" ry="3.15" fill="#fff" stroke="rgba(90,52,31,.2)" stroke-width=".65"/><circle cx="33.2" cy="42.2" r="2" fill="${a.eyeColor}"/><circle cx="50.8" cy="42.2" r="2" fill="${a.eyeColor}"/><circle cx="33.2" cy="42.2" r=".8" fill="#17202a"/><circle cx="50.8" cy="42.2" r=".8" fill="#17202a"/><circle cx="32.6" cy="41.5" r=".45" fill="#fff"/><circle cx="50.2" cy="41.5" r=".45" fill="#fff"/>`
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
   shortBeard:`<path d="M27.4 51.7c1.1 8.9 7.1 15.2 14.6 15.2s13.5-6.3 14.6-15.2c-2.6 2.5-5 3.9-7.6 4.8-2.1.7-4.3 1-7 1-2.8 0-5-.3-7.1-1-2.5-.9-4.9-2.3-7.5-4.8z" fill="${avatarMix(a.hair,a.skin,.28)}" opacity=".76"/><path d="M31.7 52.3c2.5 2 5.4 2.8 8.3 2.8h4c2.9 0 5.8-.8 8.3-2.8-1.3 2.8-4.5 4.4-8.2 4.4h-4.2c-3.7 0-6.9-1.6-8.2-4.4z" fill="${a.hair}" opacity=".88"/><path d="M31.3 58.2c3 3.6 6.6 5.4 10.7 5.4 4.1 0 7.7-1.8 10.7-5.4" fill="none" stroke="${avatarShade(a.hair,.15)}" stroke-width="1.15" stroke-linecap="round" opacity=".78"/>`,
   goatee:`<path d="M37.1 57c1.3 5.6 3 10 4.9 12.3 1.9-2.3 3.6-6.7 4.9-12.3" fill="rgba(58,37,23,.58)"/><path d="M34.4 54.6c2.4 2.3 5.1 3.3 7.6 3.3 2.5 0 5.2-.9 7.6-3.3" fill="rgba(58,37,23,.46)"/>`,
   moustache:`<path d="M33.8 51c1.9 2 4.3 2.8 6.6 2.8 0 0 .5-1.5 1.6-1.5 1.2 0 1.6 1.5 1.6 1.5 2.3 0 4.7-.8 6.6-2.8-1.9 3.2-4.2 4.8-7.4 4.8h-1.6c-3.2 0-5.5-1.6-7.4-4.8z" fill="rgba(58,37,23,.72)"/>`
 };
 const accessoryMap={
   none:'',
   glasses:`<g stroke="#0f172a" stroke-width="1.9" fill="rgba(219,234,254,.25)"><rect x="25.4" y="38.2" width="13.4" height="9.6" rx="3.2"/><rect x="45.2" y="38.2" width="13.4" height="9.6" rx="3.2"/><path d="M38.8 43h6.4"/></g>`,
   headband:`<path d="M23.2 31.4c6-2.8 12-4.1 18.8-4.1 6.8 0 12.8 1.3 18.8 4.1" fill="none" stroke="#ef4444" stroke-width="4.2" stroke-linecap="round" opacity=".92"/>`,
   topHat:`<g><ellipse cx="42" cy="20.2" rx="22.5" ry="5.6" fill="#0f1115" opacity=".98"/><path d="M26 21V9.8c0-2.5 2-4.5 4.5-4.5h23c2.5 0 4.5 2 4.5 4.5V21z" fill="#15171c"/><rect x="24.5" y="19.2" width="35" height="3.6" rx="1.8" fill="#292c32"/><path d="M27 9.6h30" stroke="rgba(255,255,255,.18)" stroke-width="1.1" stroke-linecap="round"/></g>`,
  capGlasses:`<g><path d="M20.5 26.8c5.6-8.4 13.4-12.9 21.5-12.9 8.3 0 16.6 4.6 21.5 12.9l-4 2.5c-5.1-5.9-11.1-8.9-17.5-8.9-6.3 0-12.5 3-17.5 8.9z" fill="#f0b83e"/><path d="M24.2 28.2h35.6v5.2H24.2z" fill="#fffdf8" stroke="rgba(75,48,31,.18)" stroke-width=".7"/><path d="M24.8 26.8c4.6-5.2 10.6-7.8 17.2-7.8 6.6 0 12.6 2.6 17.2 7.8" fill="none" stroke="rgba(255,255,255,.48)" stroke-width="1.1" stroke-linecap="round"/><g stroke="#524036" stroke-width="1.9" fill="rgba(219,234,254,.22)"><rect x="24.8" y="38.2" width="14.2" height="10" rx="3.4"/><rect x="45" y="38.2" width="14.2" height="10" rx="3.4"/><path d="M39 43h6"/></g></g>`
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

window.FantaballaPlayerAvatars=Object.freeze({version:1,renderMiniAvatar,renderAvatarSvg});
})();
