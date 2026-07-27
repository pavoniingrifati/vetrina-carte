const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const draftCode=read('assets/season/04-setup-and-draft.js');
const stateCode=read('assets/season/03-state-and-data.js');
const css=read('assets/season/draft-improvements.css');
const checks=[];
const check=(name,condition)=>checks.push({name,ok:Boolean(condition)});

check('Lo stato nuovo non espone una scelta annullabile',!stateCode.includes('lastPlacement:null')&&stateCode.includes("delete next.draft.lastPlacement"));
check('Esiste il calcolo impatto candidato',draftCode.includes('function draftCandidateImpact(player)'));
check('Esiste l’analisi delle lacune della rosa',draftCode.includes('function renderDraftAnalysis'));
check('Annulla ultima scelta è stato rimosso',!draftCode.includes('undoLastDraftPlacement')&&!draftCode.includes('undoDraftBtn')&&!draftCode.includes('Annulla ultima scelta'));
check('Il nuovo markup non crea il secondo pulsante centrale',!draftCode.slice(draftCode.indexOf('function showDraft(){')).includes('id="draftRollBtnCenter"'));
check('Le tre modalità caricano il nuovo CSS', ['campionato.html','campionato-real.html','tricolore-pisa.html'].every(file=>read(file).includes('assets/season/draft-improvements.css?v=20260727-quickpack1')));
check('Le tre modalità invalidano la cache del nuovo JS', ['campionato.html','campionato-real.html','tricolore-pisa.html'].every(file=>read(file).includes('assets/season/04-setup-and-draft.js?v=20260727-quickpack1')));
check('CSS contiene analisi, slot consigliato e destinazioni scroll, senza comando annulla',css.includes('.season-draft-analysis')&&css.includes('.season-field-slot.recommended')&&css.includes('scroll-margin-top')&&!css.includes('.season-undo-draft'));
check('Il click sul giocatore centra il campo',draftCode.includes("scrollDraftIntoView('.season-pitch-wrap','center')"));
check('Dopo il posizionamento si torna al blocco Roll',draftCode.includes("scrollDraftIntoView('.season-draft-main-top','center')"));
check('Il pack non usa più il reveal bloccante',!draftCode.slice(draftCode.indexOf('async function drawDraft')).split('function scrollDraftIntoView')[0].includes('playSeasonPackReveal'));
check('Il reveal rapido anima club e carte senza nasconderle',draftCode.includes('function animateDraftClubReveal')&&draftCode.includes('quick-pack-card-reveal')&&css.includes('@keyframes quickPackCardSettle')&&!css.includes('.quick-pack-card-reveal{pointer-events:none'));

// Smoke test del rendering con un ambiente minimo.
const players=[
 {id:'p1',name:'Portiere Test',Position:'P',role:'P',ovr:78,nation:'Italia',club:'c1'},
 {id:'p2',name:'Difensore Test',Position:'DC',role:'D',ovr:76,nation:'Italia',club:'c1'},
 {id:'p3',name:'Attaccante Test',Position:'ATT',role:'A',ovr:82,nation:'Italia',club:'c1'}
];
const slots=[
 ['P',50,106],['DC',35,83],['DC',65,83],['TS',18,80],['TD',82,80],
 ['CC',35,55],['CC',65,55],['COC',50,40],['AS',24,22],['AD',76,22],['ATT',50,12]
];
const context={
 console,
 state:{phase:'draft',formation:'4-3-3',teamName:'Fantaballa Test',coachName:'Mister Test',coachType:'anonymous',competitionVariant:'serie-a',seasonRules:{},draft:{roster:[],clubId:'',candidates:[],rerolls:3,pendingPlayerId:'',openingClubShown:false}},
 FORMATION_LAYOUTS:{'4-3-3':slots},FORMATIONS:{'4-3-3':slots.map(x=>x[0])},POSITION_ROLE:{P:'P',DC:'D',TS:'D',TD:'D',CDC:'C',CC:'C',COC:'C',AS:'A',AD:'A',ATT:'A'},
 PLAYERS:players,CLUBS:[{id:'c1',name:'Club Test'}],USER_ID:'user',
 window:{matchMedia:()=>({matches:false}),scrollTo:()=>{},setTimeout,clearTimeout},
 document:{querySelectorAll:()=>[],getElementById:()=>null,querySelector:()=>null},
 screen:{innerHTML:''},
 localStorage:{getItem:()=>null,setItem:()=>{}},
 setTimeout,clearTimeout,requestAnimationFrame:fn=>fn(),
 normalizeCampionatoState:value=>value,
 normalizeName:value=>String(value||'').trim().toLowerCase(),
 positions:p=>String(p?.Position||'').split(',').map(x=>x.trim()).filter(Boolean),
 naturalCompatible:(p,code)=>String(p?.Position||'').split(',').map(x=>x.trim()).includes(code),
 userCompatible:(p,code)=>String(p?.Position||'').split(',').map(x=>x.trim()).includes(code),
 roleOf:p=>p?.role||'C',youngBeautifulAllowsPlayer:()=>true,youngBeautifulChemistryBonus:()=>0,
 rosterPlayers:()=>context.state.draft.roster.map(entry=>({...entry,player:entry.player||players.find(p=>p.id===entry.playerId)})),
 playerById:id=>players.find(p=>String(p.id)===String(id)),clubById:id=>id==='c1'?{id:'c1',name:'Club Test'}:null,
 activeUserClub:()=>({id:'user',name:'Fantaballa Test'}),clubPalette:()=>({a:'#173f66',b:'#10243a',c:'#fff',ink:'#10243a'}),
 coachIs:id=>context.state.coachType===id,coachProfile:()=>({name:context.state.coachType==='talent-scout'?'Talent scout':'Anonimo'}),initialDraftRerollLimit:()=>3,
 parallelCupChemistryZero:()=>false,parallelCupChemistryMultiplier:()=>1,ductilityEffectiveBaseOvr:p=>Number(p.ovr)||0,
 avg:list=>list.length?list.reduce((a,b)=>a+b,0)/list.length:0,clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),
 esc:value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
 renderMiniAvatar:()=>'<span class="season-mini-avatar"></span>',renderPlayerJersey:()=>'<span class="season-jersey-wrap"></span>',
 sortPlayersByRole:list=>list,save:()=>{},render:()=>{},toast:message=>{context.lastToast=message},openConfirm:async()=>true,
 freshState:()=>({draft:{roster:[],clubId:'',candidates:[],rerolls:3,pendingPlayerId:'',openingClubShown:false}}),
 finalizeDraft:()=>{},drawDraft:()=>{},mobileDraftTab:'players',draftRolling:false,lastPlacedDraftTimer:null,lastPlacedDraftSlotId:'',
 SEASON_CONFIG:{labels:{packKicker:'Pack'}},pick:list=>list[0],shuffle:list=>[...list]
};
vm.createContext(context);
try{
 vm.runInContext(draftCode,context);
 context.showDraft();
 check('Smoke render non genera la barra superiore duplicata',!context.screen.innerHTML.includes('season-draft-statusbar'));
 check('Smoke render genera un solo pulsante pack',(context.screen.innerHTML.match(/id="draftRollBtn"/g)||[]).length===1&&!context.screen.innerHTML.includes('draftRollBtnCenter'));
 check('Smoke render genera il pannello analisi',context.screen.innerHTML.includes('season-draft-analysis'));
 context.state.draft.clubId='c1';context.state.draft.candidates=['p1','p2','p3'];context.showDraft();
 check('Con allenatore normale le card sono compatte e senza statistiche aggiuntive',!context.screen.innerHTML.includes('season-candidate-impact')&&!context.screen.innerHTML.includes('OVR squadra')&&!context.screen.innerHTML.includes('Migliore scelta')&&!context.screen.innerHTML.includes('season-analysis-recommendation')&&!context.screen.innerHTML.includes('Consigli del Talent scout'));
 context.state.draft.pendingPlayerId='p1';context.showDraft();
 check('Con allenatore normale la selezione non mostra slot consigliati',context.screen.innerHTML.includes('season-draft-selection-preview')&&!context.screen.innerHTML.includes('Slot consigliato')&&!context.screen.innerHTML.includes('season-field-slot available recommended'));
 context.state.draft.pendingPlayerId='';context.state.coachType='talent-scout';context.showDraft();
 check('Il Talent scout mostra migliore scelta e consigli',context.screen.innerHTML.includes('Migliore scelta')&&context.screen.innerHTML.includes('season-analysis-recommendation')&&context.screen.innerHTML.includes('Consigli del Talent scout'));
 context.state.draft.pendingPlayerId='p1';context.showDraft();
 check('Il Talent scout mostra lo slot consigliato',context.screen.innerHTML.includes('Slot consigliato')&&context.screen.innerHTML.includes('aria-label="Slot consigliato dal Talent scout"'));
 context.placeDraftStarter('starter-0');
 check('Il posizionamento rende definitiva la scelta',context.state.draft.roster.length===1&&context.state.draft.roster[0].playerId==='p1'&&!('lastPlacement' in context.state.draft));
 check('Dopo il posizionamento non esiste alcun comando per cambiare la scelta',typeof context.undoLastDraftPlacement==='undefined'&&!draftCode.includes('undoDraftBtn')&&!draftCode.includes('Annulla ultima scelta'));
}catch(error){
 checks.push({name:'Smoke test runtime',ok:false,error:String(error.stack||error)});
}

const failed=checks.filter(item=>!item.ok);
console.log(JSON.stringify({name:'Draft improvements',passed:checks.length-failed.length,total:checks.length,checks},null,2));
if(failed.length)process.exit(1);
